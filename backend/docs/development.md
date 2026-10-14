# Local development

## HTTP contracts

Successful endpoints return their own response DTO with the appropriate HTTP
status (for example, 201 when creating a hold). All API errors have the shape:

```json
{"error":"seat is unavailable for this segment","code":"seat_unavailable","request_id":"server-generated-uuid"}
```

The server generates `X-Request-ID` for every request and propagates it via
request context. Access logs include this ID, the route template, status, and
duration. Internal failures log the underlying cause; responses expose only
safe messages. The client-provided request ID is not used as a log identity.

Gin binding validates required fields, lengths, and basic segment shape before
calling the use case. Domain/application checks remain in place for calls from
workers and other adapters. JSON bodies are limited to 1 MiB. Middleware uses
Gin's shared binding validator rather than constructing one per request.

Booking endpoints are still demo endpoints without authentication. Customer ID
currently comes from the request body. When auth is implemented, resolve it from
the authenticated principal, group protected routes with auth middleware, and
check booking ownership in the use case. Payment verification must control
confirmation. Do not treat these routes as production-ready security boundaries.

When implementing auth, define password/token ports in its application package,
and implement them in outbound security adapters. There is no placeholder auth
middleware or pretend authentication in this change.

## Commands

Migration commands read `database_url` from `backend/config.yaml` using the
same configuration loader as API and worker. `DATABASE_URL`, when set, takes
precedence. From `backend`, run `go run ./cmd/migrate -action up` to apply
migrations and `go run ./cmd/migrate -action status` to inspect their state.
Restart API and worker after applying migrations. PostgreSQL connections use
pgx exec mode without named prepared statements for pooler compatibility.

### Start local Kafka

Open Docker Desktop in Linux containers mode, then from `backend` run:

```powershell
docker compose -f deployments/compose.kafka.yaml up -d
docker compose -f deployments/compose.kafka.yaml ps -a
docker compose -f deployments/compose.kafka.yaml logs kafka-init
```

The broker should be healthy and `kafka-init` should exit with code 0. The init
service creates `booking.events`. The Go processes run on the host and use
`localhost:9092`; containers use `kafka:19092`. Data persists in a named volume.
After database migrations have been applied, run `go run ./cmd/worker`.

```powershell
docker compose -f deployments/compose.kafka.yaml down
```

This stops Kafka while preserving its data. This single-broker plaintext setup
is for local development. It does not provide broker redundancy.

Run from `backend` in PowerShell:

```powershell
./scripts/dev.ps1 generate
./scripts/dev.ps1 migrate
./scripts/dev.ps1 api
./scripts/dev.ps1 worker
./scripts/dev.ps1 build
./scripts/dev.ps1 test
```

The script finds tools in PATH, GOBIN, or GOPATH/bin. Generator versions used:

```powershell
$env:CGO_ENABLED = '0'
go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1
go install github.com/pressly/goose/v3/cmd/goose@v3.28.0
```

Edit SQL files under each context's PostgreSQL `queries` directory, then run
generate. Do not edit `sqlcgen` manually. Migrations remain shared because all
contexts currently share one PostgreSQL database and booking transaction.

Configure `DATABASE_URL`, `KAFKA_BROKERS` (comma-separated), `KAFKA_TOPIC`,
`KAFKA_CONSUMER_GROUP`, and `WORKER_METRICS_ADDRESS` as needed. Default Kafka
topic is `booking.events`, group is `notification-v1`, and metrics listen on
`127.0.0.1:9091`. Provision the Kafka topic before starting the worker.

The worker exposes Prometheus metrics at `http://127.0.0.1:9091/metrics`:

- `booking_outbox_pending` and `booking_outbox_oldest_age_seconds`
- `booking_events_published_total` and `booking_event_publish_failures_total`
- `notification_inbox_events_total{result="accepted|duplicate"}`
- `notification_consumer_failures_total`
- `worker_batch_duration_seconds` and `worker_batch_failures_total`

Inbox insertion and notification job creation commit atomically. Kafka offsets
commit only afterward. Redeliveries create no extra job. Notification jobs stay
pending until an email provider/delivery worker is implemented; no email is sent
by this consumer. External delivery will need its own retry/idempotency design.

Consumer failures retry the current event before fetching another. Invalid JSON
or invalid event contracts stop the worker without committing the offset, so an
operator can inspect the recorded partition/offset. Dead-letter routing is not
implemented. Kafka currently uses plaintext connections; hosted TLS/SASL brokers
require additional transport configuration.

Outbox drains up to 100 events per polling run, claiming one event at a time
with a 30-second lease and a 10-second publish timeout. Delivery remains
at-least-once. Multiple dispatchers can publish
lifecycle events out of order; the notification jobs are independent event
records, not a projection of current booking status. A future stateful consumer
must use aggregate versions or explicit ordering.
