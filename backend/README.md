# Train Ticket

Backend API for a multi-segment railway booking system.

The backend is organized as a DDD modular monolith. See
[`docs/architecture.md`](docs/architecture.md) for bounded contexts and dependency
rules.

See [development commands and worker metrics](docs/development.md) for the
PowerShell helper, pinned code-generation tools, inbox deduplication, and
consumer failure behavior.

## Configuration

Copy `config.example.yaml` to `config.yaml` and set the HTTP address and Neon
`database_url` there. Do not commit database credentials. Environment variables
override values in `config.yaml`.

## Run

```powershell
go run ./cmd/migrate -action up
go run ./cmd/api
```

Run the background worker in a second terminal. It releases expired seat
reservations and publishes booking lifecycle events from the PostgreSQL outbox
to Kafka:

```powershell
go run ./cmd/worker
```

The API listens on `:8080` by default and requires a reachable Neon PostgreSQL
database at startup. Search trips with
`GET /api/v1/trips/search?origin_id=HN&destination_id=SG&service_date=YYYY-MM-DD`.
Search results include `fare_from_vnd`, the lowest configured seat-type price
for that trip and stop range; availability is checked when seats are listed.
The frontend reads seat availability for the selected segment through
`GET /api/v1/trips/{trip_id}/seats?from_stop=0&to_stop=2`. This read is a
snapshot; the hold endpoint makes the final availability decision inside a
PostgreSQL transaction.
Seat responses include `fare_vnd` for the selected stop range. The price sums
the trip's adjacent-segment fares for that seat type, so trips on different
service dates can have different prices. A missing fare is returned as `null`
and cannot be booked. The hold endpoint recalculates and stores this amount
in `bookings.fare_vnd`; the browser cannot supply a price. Historical bookings
without a stored quote also return `null`.
Replace the date with a scheduled trip's service date in `YYYY-MM-DD` format.
To add demo timetable data, run `deployments/dev-seed.sql` in the Neon SQL Editor
after applying the migrations. The demo seed creates seats `1-01` through `1-72`
and segment fares for trip `DEMO-SE1`. Re-run it after migration `000006` if
you loaded the demo trip earlier.

Register with `POST /api/v1/auth/register` (`full_name`, `email`, `password`)
or sign in with `POST /api/v1/auth/login` (`email`, `password`). Passwords must
contain 12–72 bytes. Both responses include a `session_token` that the API
accepts in an `Authorization: Bearer` header. The token expires after seven
days; `GET /api/v1/auth/me` returns the current user, and
`POST /api/v1/auth/logout` revokes the session. The Next.js frontend stores the
token in an HttpOnly cookie and never exposes it to browser JavaScript.

Hold one to six seats for named passengers in a single booking:

```http
POST /api/v1/bookings/holds
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "trip_id": "DEMO-SE1",
  "passengers": [
    {"seat_id": "1-01", "full_name": "Nguyen Van A"},
    {"seat_id": "1-02", "full_name": "Tran Thi B"}
  ],
  "from_stop": 0,
  "to_stop": 2
}
```

The API accepts the earlier single `seat_id` request for compatibility, but
that request has no passenger name. New clients should send `passengers`.
The backend validates unique seats and passenger names, recalculates every
seat's fare, and holds all seats in one transaction. A conflict on any seat
rolls back the entire booking. `fare_vnd` is the total for the booking.

The backend determines the booking owner from the authenticated session. Only
that owner may confirm or cancel the booking.

The stop range is half-open: `[from_stop, to_stop)`. A successful hold expires
after `booking_hold_duration` (10 minutes by default). PostgreSQL is the source
of truth for inventory and serializes concurrent holds on the same trip seat.
Confirm a hold before it expires with `POST /api/v1/bookings/{booking_id}/confirm`.
Cancel an active hold with `POST /api/v1/bookings/{booking_id}/cancel`; this
releases its seat segments and records a `booking.cancelled` outbox event in
the same transaction. Confirmed bookings cannot be cancelled until a refund
flow is implemented.
Authenticated customers can list their own bookings with
`GET /api/v1/bookings?limit=20&offset=0` and open one with
`GET /api/v1/bookings/{booking_id}`. The list returns `has_more` for pagination;
another customer's booking returns 404. Read responses show an overdue hold as
`expired` even before the expiry worker updates its stored status.
The confirmation endpoint currently demonstrates the booking lifecycle; when payment is
implemented, only a verified payment result should confirm a booking. The worker
and API can run as separate processes against the same Neon database. The worker
also needs a Kafka broker. Configure `KAFKA_BROKERS` as a comma-separated list
(default `localhost:9092`) and `KAFKA_TOPIC` (default `booking.events`). If Kafka
is unavailable, booking changes and outbox events remain persisted; the worker
retries publishing with backoff.
Upstash Redis is not connected yet; it can be added later for caching or
notifications, but it will not decide whether a seat is available. The API also
exposes `GET /healthz`.
