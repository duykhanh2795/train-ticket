# Admin catalog

The admin page is at `/admin` in the Next.js frontend. The API exposes
`GET /api/v1/admin/me`, `GET/POST /api/v1/admin/stations`,
`GET/POST /api/v1/admin/trips`, and `GET /api/v1/admin/bookings`.
All routes require an active user session and an entry in `admin_users`.
The frontend menu shows Admin only after the API confirms permission; the
backend checks permission on every request.

Apply the current Goose migrations before using the page:

```powershell
cd backend
go run ./cmd/migrate -action up
```

Grant the role to an existing registered account through a controlled
database session. There is no public role-grant endpoint:

```sql
INSERT INTO admin_users (user_id)
SELECT id FROM auth_users WHERE email = '<admin-email>'
ON CONFLICT (user_id) DO NOTHING;
```

Verify that the statement affected one row or that the intended account
already has a row. Revoke with `DELETE FROM admin_users WHERE user_id = ...`.

Create stations first, then a trip. The trip request includes an ordered list
of at least two stops, one or more coach groups, and a positive fare for every
adjacent stop segment and seat type used by a coach. Timestamps use RFC3339;
the admin UI accepts Vietnam-local time. The API validates station uniqueness,
chronological stops, departure date, seat counts, and fare coverage. It writes
the entire trip in one PostgreSQL transaction. Existing trips and bookings are
read only in this first admin workflow; payment settlement and ticket issuance
remain under their existing verified paths.

The catalog accepts manually entered data. Operators must verify schedules,
prices, and seat inventory before publishing. This feature does not import
official railway data or validate that a train is available for real travel.
