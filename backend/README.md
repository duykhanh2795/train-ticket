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
The frontend reads seat availability for the selected segment through
`GET /api/v1/trips/{trip_id}/seats?from_stop=0&to_stop=2`. This read is a
snapshot; the hold endpoint makes the final availability decision inside a
PostgreSQL transaction.
Replace the date with a scheduled trip's service date in `YYYY-MM-DD` format.
To add demo timetable data, run `deployments/dev-seed.sql` in the Neon SQL Editor
after applying the migrations. The demo seed creates seats `1-01` through `1-72`
for trip `DEMO-SE1`.

Register with `POST /api/v1/auth/register` (`full_name`, `email`, `password`)
or sign in with `POST /api/v1/auth/login` (`email`, `password`). Passwords must
contain 12–72 bytes. Both responses include a `session_token` that the API
accepts in an `Authorization: Bearer` header. The token expires after seven
days; `GET /api/v1/auth/me` returns the current user, and
`POST /api/v1/auth/logout` revokes the session. The Next.js frontend stores the
token in an HttpOnly cookie and never exposes it to browser JavaScript.

Hold a seat with:

```http
POST /api/v1/bookings/holds
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "trip_id": "DEMO-SE1",
  "seat_id": "1-01",
  "from_stop": 0,
  "to_stop": 2
}
```

The backend determines the booking owner from the authenticated session. Only
that owner may confirm the booking.

The stop range is half-open: `[from_stop, to_stop)`. A successful hold expires
after `booking_hold_duration` (10 minutes by default). PostgreSQL is the source
of truth for inventory and serializes concurrent holds on the same trip seat.
Confirm a hold before it expires with `POST /api/v1/bookings/{booking_id}/confirm`.
This endpoint currently demonstrates the booking lifecycle; when payment is
implemented, only a verified payment result should confirm a booking. The worker
and API can run as separate processes against the same Neon database. The worker
also needs a Kafka broker. Configure `KAFKA_BROKERS` as a comma-separated list
(default `localhost:9092`) and `KAFKA_TOPIC` (default `booking.events`). If Kafka
is unavailable, booking changes and outbox events remain persisted; the worker
retries publishing with backoff.
Upstash Redis is not connected yet; it can be added later for caching or
notifications, but it will not decide whether a seat is available. The API also
exposes `GET /healthz`.
