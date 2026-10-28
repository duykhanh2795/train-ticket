# Backend architecture

The backend is a DDD-style modular monolith. Each business module is a bounded
context with its own domain model, application use cases, and adapters. The API
and worker are separate executables over the same modules, not separate services.

## Bounded contexts

| Context | Owns |
| --- | --- |
| `schedule` | Stations, scheduled train trips, ordered stops, and timetable search |
| `inventory` | Seat availability and reservations over trip segments |
| `booking` | Booking lifecycle and coordination of seat holds |
| `passenger` | Account-owned saved passenger details |
| `payment` | Payment state, confirmation, and refund rules |
| `ticket` | Ticket issuance, owner-scoped lookup, and station-scoped gate admission |
| `notification` | Delivery of booking and payment notifications |

## Package layout

Each business module follows this shape where its responsibilities exist:

```text
internal/<context>/
├── domain/                         # Aggregates, entities, value objects, rules
├── application/                    # Commands/queries, use cases, ports
└── adapters/
    ├── inbound/http/               # Gin handlers and HTTP DTOs
    ├── inbound/kafka/              # Message consumers, when needed
    ├── outbound/postgres/          # Repository implementations
    ├── outbound/kafka/             # Event publishers, when needed
    └── outbound/<provider>/        # External systems, when needed
```

Not every read endpoint needs to load a domain aggregate. The schedule search is
a query use case: its PostgreSQL adapter returns an application-owned read model
and filters by travel date and stop order in SQL. Domain aggregates are reserved
for operations that enforce business invariants, such as seat holds and booking
state transitions.

`internal/platform/` owns shared client setup (PostgreSQL pool, Redis client).
`internal/transport/http/` owns shared Gin middleware and
router composition. `internal/app/` is the composition root. `cmd/api` and
`cmd/worker` only start their respective processes.

The worker is composed by `internal/app/worker.go`, which owns background
loops, metrics HTTP lifecycle, and graceful cancellation. Kafka reader/writer
adapters own their connections; application packages only consume ports.

## Dependency rules

- Domain packages depend only on the Go standard library and other domain types
  inside the same context. They do not import Gin, SQL drivers, Redis, or Kafka.
- Application packages own use cases and define the interfaces they require.
- Inbound adapters translate HTTP or messages into application commands. HTTP
  request and response DTOs stay in the adapter and are never domain entities.
- Outbound adapters implement application ports. The composition root supplies
  those implementations at startup.
- Context-to-context calls go through an application port and an in-process
  adapter, rather than importing another context's persistence implementation.

## Booking and seat-hold flow

`booking.application.HoldBooking` creates a held booking, starts one unit of work,
asks the inventory context to hold the requested seat segment, and saves the
booking. Confirmation and expiry lock the booking, transition its state, and
confirm or release its inventory reservation in the same unit of work. The
inventory adapter loads the `SeatInventory` aggregate for update, applies its
domain rule, and saves it using the same transaction context. PostgreSQL commits
each booking and seat-reservation transition atomically.

Inventory represents a journey as a half-open range of stop indexes `[from, to)`.
Claims conflict only for the same trip and seat when their ranges overlap; adjacent
journeys can reuse the same physical seat. PostgreSQL remains the final authority
for concurrent booking correctness. The PostgreSQL adapter locks the matching
`trip_seats` row with `SELECT ... FOR UPDATE` before loading reservations. That
serializes competing holds for one physical seat while allowing unrelated seats
to proceed independently. The lock, reservation write, and booking insert share
one Unit of Work transaction. Redis may later help with caching, but it is not
the source of truth for seat availability.

The API creates a VNPAY checkout for an active hold using
`POST /api/v1/bookings/{id}/checkout`. Only a verified VNPAY IPN can confirm
the booking; the browser return page reads persisted payment status. A separate
`cmd/worker` process scans bounded batches of expired
holds and releases their seats. The worker rechecks and locks each booking in a
transaction, so a simultaneous payment confirmation wins cleanly or the expiry
proceeds without leaving the seat reserved. Payment, booking, reservation and
the confirmed outbox event commit in one database transaction.

Booking lifecycle events are inserted into `outbox_messages` in the same
PostgreSQL transaction as hold, confirmation, and expiration. The worker leases
pending outbox rows with `FOR UPDATE SKIP LOCKED`, publishes them to the
configured Kafka topic, then marks them published. Delivery is at-least-once:
if Kafka accepts an event and the worker exits before marking the row, it may be
published again. Consumers must deduplicate by the deterministic event ID.
Failed sends receive bounded exponential backoff; expired leases can be
claimed by another worker.

Notification consumes booking integration events using its own application
contract. It inserts `(consumer_name, event_id)` into `notification_inbox` and
creates a `notification_jobs` row in the same transaction. Kafka offsets are
committed only after this transaction succeeds. A repeated event returns a
duplicate result without creating another job. Jobs are durable pending work;
external email delivery has not yet been connected.

SQLc generates outbox and inbox queries, consistent with other repository
adapters. Event DTOs stay at the receiving context's application boundary;
notification never imports booking persistence. Worker Prometheus metrics use
a private registry and bounded task/result labels without customer or event IDs.

## Concurrency and messaging choices

The course sources describe synchronous database CAS, Redis Lua as an atomic
stock gate, and asynchronous Kafka order processing with idempotency tokens.
These are alternatives with different consistency trade-offs, not layers to
stack together by default. This project currently uses PostgreSQL row locking
and a single transaction because a train seat is reserved over a stop interval,
and booking plus inventory state must agree before the API confirms a hold.

Redis Lua is not used to decide seat availability. A Redis decrement would need
reliable reconciliation with PostgreSQL, while the database aggregate already
checks overlapping stop ranges. Redis can be added for read caching or advisory
holds after measuring a bottleneck and defining expiry/recovery behavior. Kafka
handles post-commit lifecycle events through the outbox; booking requests remain
synchronous.

## Current implementation boundary

Schedule has a PostgreSQL migration, sqlc query, repository adapter, and a Gin
search endpoint at `GET /api/v1/trips/search` (requires origin, destination, and
service date). Booking and inventory include hold, confirm, and expiry flows,
with PostgreSQL repositories and shared transactions. The API connects to Neon
using `DATABASE_URL`; run `go run ./cmd/worker` separately for hold expiration
and Kafka outbox delivery.
Demo timetable and seat rows are provided in `deployments/dev-seed.sql`. Upstash
Redis is not connected; PostgreSQL is the source of truth for reservations.
Payment has a VNPAY sandbox protocol adapter, SQLc repository, checkout use
case and idempotent IPN settlement. The handler verifies the callback signature,
then matches the reference and server-stored amount. It locks the booking before
the payment attempt to preserve lock order. A paid attempt arriving after the
hold has expired is recorded as `paid_unfulfilled` for manual reconciliation;
it does not allocate a seat. Automated refund and reconciliation are future
work.
Ticket issuance and gate admission are implemented. Notification implements
inbound event validation and a durable inbox/job queue, while email delivery remains future
work. Operational commands and messaging limitations are documented in
`docs/development.md`.

Keep the monolith until there is a demonstrated need to deploy or scale contexts
independently. Add each adapter only when a real use case needs it.
