-- name: CreateBooking :exec
INSERT INTO bookings (
    id, customer_id, trip_id, status, created_at, expires_at
)
VALUES (
    sqlc.arg(id), sqlc.arg(customer_id), sqlc.arg(trip_id),
    sqlc.arg(status), sqlc.arg(created_at), sqlc.arg(expires_at)
);

-- name: FindBookingForUpdate :one
SELECT id, customer_id, trip_id, status, created_at, expires_at
FROM bookings
WHERE id = sqlc.arg(id)
FOR UPDATE;

-- name: UpdateBookingStatus :execrows
UPDATE bookings
SET status = sqlc.arg(status)
WHERE id = sqlc.arg(id);

-- name: ListExpiredBookingHolds :many
SELECT id
FROM bookings
WHERE status = 'held'
  AND expires_at <= sqlc.arg(at)
ORDER BY expires_at, id
LIMIT sqlc.arg(row_limit)::INTEGER;
