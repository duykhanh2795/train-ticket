# Train Ticket

Backend API for a multi-segment railway booking system.

The backend is organized as a DDD modular monolith. See
[`docs/architecture.md`](docs/architecture.md) for bounded contexts and dependency
rules.

See [development commands and worker metrics](docs/development.md) for the
PowerShell helper, pinned code-generation tools, inbox deduplication, and
consumer failure behavior.

See [admin catalog operations](docs/admin.md) for the admin role, station and
trip publishing, and read-only booking overview.

For container builds and local Kafka/Neon Compose commands, see
[container deployment](deployments/README.md).

## Configuration

Copy `config.example.yaml` to `config.yaml` and set the HTTP address and Neon
`database_url` there. Do not commit database credentials. Environment variables
override values in `config.yaml`.
By default, Gin ignores forwarded client-IP headers. If the API runs behind a
reverse proxy, set `http_trusted_proxies` (or `HTTP_TRUSTED_PROXIES`) to only
that proxy's IP address or CIDR; `ClientIP()` is used when creating a VNPAY
checkout URL.
Set `database_pool_max_conns` (or `DATABASE_POOL_MAX_CONNS`) per API/worker
process to stay within the database's connection budget; the default is 10.

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
For development data after migrations, run `go run ./cmd/devseed` from `backend/`.
It adds a dated `DEMO-SE1-YYYYMMDD` trip for the next Vietnam-local day using
published SE1 stop times. Its 72 seats and fares are synthetic. Re-running the
command preserves existing bookings and reservations. Do not use these tickets
for real travel.

Register with `POST /api/v1/auth/register` (`full_name`, `email`, `password`)
or sign in with `POST /api/v1/auth/login` (`email`, `password`). Passwords must
contain 12–72 bytes. Both responses include a `session_token` that the API
accepts in an `Authorization: Bearer` header. The token expires after seven
days; `GET /api/v1/auth/me` returns the current user, and
`POST /api/v1/auth/logout` revokes the session. The Next.js frontend stores the
token in an HttpOnly cookie and never exposes it to browser JavaScript.

Authenticated users can manage their saved passengers through
`POST`/`GET /api/v1/saved-passengers` and
`PATCH`/`DELETE /api/v1/saved-passengers/{id}`. Create and rename requests use
`{"full_name":"Nguyen Van A"}`; the owner always comes from the session.
Apply migration `000010` before using these routes.

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
that owner may start checkout, view their payment, or cancel an active hold.

The stop range is half-open: `[from_stop, to_stop)`. A successful hold expires
after `booking_hold_duration` (10 minutes by default). PostgreSQL is the source
of truth for inventory and serializes concurrent holds on the same trip seat.
Start checkout before expiry with
`POST /api/v1/bookings/{booking_id}/checkout`. It returns a signed
`checkout_url` and `payment_id` in VNPAY mode; the frontend redirects to that URL.
The amount comes from the stored booking fare. The public
`GET /api/v1/payments/vnpay/ipn` verifies the VNPAY signature and settles
the attempt. Configure this exact URL as a publicly reachable HTTPS IPN URL
in VNPAY Merchant Admin. Set `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, and
`VNPAY_RETURN_URL` in `config.yaml` or environment variables. The Return
URL should point to the frontend `/payment/result` page; its query parameters
are display-only. Until credentials are configured, checkout returns 503.
For a development-only payment without VNPAY, set `PAYMENT_MODE=mock`,
`HTTP_ADDRESS=127.0.0.1:8080`, and `PUBLIC_APP_URL=http://localhost:3000`
before starting the API. Mock mode is rejected unless the API binds to a
loopback interface and the frontend URL is local HTTP. Checkout opens the
frontend payment result page, where the signed-in booking owner can click
**Complete demo payment**. That calls the authenticated
`POST /api/v1/payments/{payment_id}/mock/complete` endpoint. The endpoint is
registered only in mock mode and uses the same transactional settlement,
booking confirmation, ticket issuance and outbox path as the VNPAY IPN.
It transfers no money and must never be used for actual sales. The hold must
still be active and every seat must have passenger details.
The signed IPN confirms booking, seats, tickets, and the outbox event atomically.
`GET /api/v1/payments/{payment_id}` returns the persisted result only to the
booking owner. A successful payment arriving after the hold is no longer valid
is marked `paid_unfulfilled` for manual refund and does not issue a ticket.
Cancel an active hold with `POST /api/v1/bookings/{booking_id}/cancel`; this
releases its seat segments and records a `booking.cancelled` outbox event in
the same transaction. Confirmed bookings cannot be cancelled until a refund
flow is implemented.
Authenticated customers can list their own bookings with
`GET /api/v1/bookings?limit=20&offset=0` and open one with
`GET /api/v1/bookings/{booking_id}`. The list returns `has_more` for pagination;
another customer's booking returns 404. Read responses show an overdue hold as
`expired` even before the expiry worker updates its stored status.
After a verified payment confirms a booking, the same transaction issues one
ticket for each named passenger seat. The booking owner can read them with
`GET /api/v1/bookings/{booking_id}/tickets`; another account receives 404 and
an unconfirmed booking receives 409. Apply migration `000011` before using
ticket issuance or this endpoint. Ticket QR codes carry a ticket reference in
the form `railway:ticket:v1:<ticket-id>`.

Gate staff can inspect and admit tickets through authenticated
`POST /api/v1/gate/tickets/inspect` and `POST /api/v1/gate/tickets/admit`,
both with `{"qr_code":"railway:ticket:v1:<ticket-id>"}`. The Next.js staff
screen is at `/gate` and accepts pasted QR content or a keyboard-style QR
scanner. Apply migration `000012` before using these endpoints. A gate account
must have a row in `gate_agents`; public registration does not assign one.
An operator can provision an existing account for one station using a
controlled database operation, for example:

```sql
INSERT INTO gate_agents (user_id, station_id)
SELECT id, '<station-id>' FROM auth_users WHERE email = '<staff-email>'
ON CONFLICT (user_id) DO UPDATE SET station_id = EXCLUDED.station_id;
```

Inspection requires the staff member's assigned station to match the ticket's
boarding station. Admission also requires a confirmed booking and seat,
a scheduled trip, and a scan between two hours before and thirty minutes
after the planned departure. A ticket can be admitted once; later scans show
`already_used`. The timetable is the only departure source until live delay
data is integrated. There is no camera scanner or staff management UI yet.

The notification worker can email a booking confirmation and a link to the
owner's ticket page after `booking.confirmed`. Apply migration `000013` and
configure SMTP on the worker as described in `docs/development.md`. SMTP is
disabled by default; without it, notification jobs remain pending. Failed
delivery retries with backoff and is visible in `notification_jobs`.

The worker and API can run as separate processes against the same Neon database. The worker
also needs a Kafka broker. Configure `KAFKA_BROKERS` as a comma-separated list
(default `localhost:9092`) and `KAFKA_TOPIC` (default `booking.events`). If Kafka
is unavailable, booking changes and outbox events remain persisted; the worker
retries publishing with backoff.
Upstash Redis is not connected yet; it can be added later for caching or
notifications, but it will not decide whether a seat is available. The API also
exposes `GET /healthz`.
