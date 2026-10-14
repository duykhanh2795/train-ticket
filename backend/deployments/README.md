# Deployment configuration

The application uses Neon for PostgreSQL. Set `DATABASE_URL` in the runtime
environment; do not store Neon credentials in this directory or commit them.

The API and booking expiry worker both connect to Neon through `DATABASE_URL`.
Run `go run ./cmd/api` and `go run ./cmd/worker` as separate processes. The worker
releases expired holds every five seconds. Upstash Redis is not connected; keep
PostgreSQL as the source of truth for seat reservations.
