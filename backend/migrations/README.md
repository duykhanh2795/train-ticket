# Database migrations

The migrations create the schedule tables (`stations`, `train_trips`,
`trip_stops`) and booking/inventory tables (`trip_seats`, `bookings`,
`seat_reservations`). Migrations are explicit: do not create or change schema
automatically at API startup.

Set `DATABASE_URL` to the connection string from Neon, then apply the schema with
Goose from the repository root:

```powershell
$env:DATABASE_URL = "<Neon connection string>"
goose -dir migrations postgres $env:DATABASE_URL up
```

To roll back the latest migration:

```powershell
goose -dir migrations postgres $env:DATABASE_URL down
```

After migration, run `deployments/dev-seed.sql` in the Neon SQL Editor to create a
demo train and its seats. The sqlc configuration reads the schema from this
directory. After changing a migration or a query under a context's
`adapters/outbound/postgres/queries` directory, regenerate typed query code from
the repository root:

```powershell
sqlc generate
```
