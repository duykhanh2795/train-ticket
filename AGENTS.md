# Repository instructions

These instructions apply to the whole `train-ticket` repository. Read a more
specific `AGENTS.md` when working below its directory (for example,
`frontend/AGENTS.md`). User requirements take priority over this file.

## Project map

- `backend/`: Go 1.26 modular monolith using Gin, PostgreSQL/pgx, SQLc, Goose,
  Kafka and Viper. `cmd/api`, `cmd/worker` and `cmd/migrate` are entry points.
- `frontend/`: Next.js App Router, TypeScript, Tailwind and shadcn/ui. Follow
  `frontend/AGENTS.md` and the installed Next.js documentation for framework
  details.
- `backend/internal/<context>/`: `domain`, `application`, and inbound/outbound
  `adapters`. `backend/internal/app` wires dependencies; `bootstrap` opens shared
  infrastructure; `platform` and `transport/http` contain genuinely shared code.
- Architecture and commands: `backend/docs/architecture.md`,
  `backend/docs/development.md`, `backend/README.md`. These may lag behind code;
  verify claims against the implementation and update stale text in scope.

## Approved landing page

- The visual design of the Next.js landing page at `/` is user-approved.
  Its markup, CSS, typography, spacing, colors, images, and responsive layout
  must stay unchanged during functional integration unless the user explicitly
  requests a visual change.
- Implement landing behavior in `frontend/src/features/landing/landing-interactions.tsx`
  and related routing/state code. Do not replace the approved markup with
  shadcn components or restyle it as part of wiring a feature.
- Keep `frontend/landing/landing-railo-refined.html` as the visual reference.
  If a visual edit is explicitly requested later, compare the Next.js result
  with that reference at the same viewport and theme.

## Before changing code

1. Read `git status --short` and preserve existing user changes. Never clean,
   reset, reformat, commit or push unrelated work.
2. Trace the affected behavior end to end: route -> handler -> application ->
   domain/ports -> adapter -> SQL/migration, plus worker and frontend callers
   when relevant. Search for existing implementations before adding a helper.
3. State the business invariant and failure cases before choosing a layer or
   dependency. Prefer a small targeted fix over a new abstraction or folder.
4. Check current library APIs in installed code or primary documentation when
   behavior is version-sensitive. Do not assume a tutorial or stale repo note
   matches the versions in this project.

## Boundaries and Go code

- Domain owns business state and invariants. It must not import Gin, pgx, Kafka,
  Redis, SQLc, Viper or HTTP DTOs. Application orchestrates use cases and
  declares small ports it actually consumes. Adapters translate protocols and
  implement ports. Composition belongs in `internal/app`, not `cmd` or handlers.
- Keep request/response DTOs in inbound adapters, application commands/read
  models in application, and persistence models in outbound adapters. Map
  explicitly at boundaries; do not expose generated SQLc structs as API/domain
  models.
- Do not add a service, interface, constructor, wrapper struct or `utils` package
  solely for symmetry. Use an interface for a real dependency boundary and define
  it near its consumer. A one-field struct is fine when it owns behavior or
  lifecycle; a plain function is fine when no state or injection is needed.
- Place a shared helper at the narrowest common owner. Before extracting code,
  confirm the repeated operations have the same semantics and error policy.
  Keep shared HTTP concerns in `internal/transport/http`; do not repeat headers,
  response mapping or authentication checks in every handler.
- Use `context.Context` from the caller for I/O and cancellation. Wrap errors
  with useful operation context, preserve sentinel errors with `%w`, and map
  them to safe HTTP responses at the boundary. Do not log credentials, tokens,
  passenger data or raw connection URLs.
- Keep constructors and exported APIs consistent with neighboring packages.
  Validate required dependencies when failure would otherwise become a later
  panic. Do not hide errors or use panic for ordinary runtime failures.

## Railway and payment invariants

- Stop ranges are half-open: `[from_stop, to_stop)`. Adjacent ranges may reuse
  a seat; overlapping ranges on the same trip and seat may not. PostgreSQL is
  the final authority for availability, even if a cache or UI says otherwise.
- A hold must verify trip status, boarding time, stop range, seat, ownership and
  server-calculated fare at the write boundary. Search and seat-list endpoints
  are snapshots, not authorization to book. Handle concurrent requests with a
  shared transaction and consistent lock order; never replace the database
  invariant with a Redis-only lock.
- Booking, seat reservation, payment state and their outbox event must commit
  atomically where the flow promises atomicity. Re-check expiry/state under lock
  on confirm, cancel and worker expiry. Use an injected clock where time affects
  business decisions; use UTC instants for persisted comparisons.
- Only a verified VNPAY IPN may settle payment and confirm a booking. Browser
  return parameters are display-only. Duplicate, late, mismatched and retried
  callbacks must have explicit idempotent outcomes; never issue a ticket for an
  expired or unfulfilled hold.
- Kafka/outbox delivery is at-least-once. Preserve stable event IDs, consumer
  deduplication, durable write-before-offset-commit and retry behavior. Consider
  poison messages and worker process failure; do not silently skip an offset or
  claim exactly-once delivery.

## Data, configuration and deployment

- Change SQL in the context's `queries/*.sql` and schema through a new numbered
  Goose migration. Never edit `sqlcgen` by hand. Run SQLc generation after SQL
  changes and inspect generated signatures and all affected repositories.
- Do not renumber or rewrite a migration already applied to a shared database.
  Check for duplicate versions and both `Up`/`Down` behavior. Do not run
  migrations against Neon or seed live data unless the task calls for it.
- Keep secret values in ignored local configuration or runtime environment, not
  tracked examples, source, logs, Docker build args or tool output. Update
  `config.example.yaml`, deployment examples and docs when adding settings.
- Treat the worker, API and migration command as separate processes. Check that
  a feature is actually wired into routes/composition, has required schema, and
  can start with its documented dependencies; a compiling package is not enough.
- Avoid assertions that code is "production-ready" solely because it builds.
  Identify missing integrations, operations, security controls and live checks.

## Completion check

- Format touched Go files with `gofmt`; regenerate SQLc when needed. For backend
  changes, run `go build ./...` and `go vet ./...` from `backend/`. Run tests only
  when the user asks for tests or verification; never claim unrun checks passed.
- Review the diff for unrelated edits, secret exposure, dead routes, stale docs,
  duplicate logic, SQLc drift and changed error semantics. Use `git diff --check`.
- Report what changed, why, which checks ran, and material limitations. Distinguish
  code-level verification from Neon/Kafka/VNPAY integration validation. Do not
  describe an incomplete scaffold as a finished feature.
