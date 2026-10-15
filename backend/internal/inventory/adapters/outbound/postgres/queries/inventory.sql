-- name: LockTripSeat :one
SELECT
    trip_seats.trip_id,
    trip_seats.seat_id,
    (SELECT COUNT(*)::INTEGER FROM trip_stops WHERE trip_id = trip_seats.trip_id) AS stop_count
FROM trip_seats
WHERE trip_seats.trip_id = sqlc.arg(trip_id)
  AND trip_seats.seat_id = sqlc.arg(seat_id)
FOR UPDATE OF trip_seats;

-- name: ListBookingSeatIDs :many
SELECT seat_id FROM seat_reservations
WHERE booking_id = sqlc.arg(booking_id)
ORDER BY seat_id;

-- name: LockBookingSeat :one
SELECT trip_seats.trip_id, trip_seats.seat_id,
    (SELECT COUNT(*)::INTEGER FROM trip_stops WHERE trip_id = trip_seats.trip_id) AS stop_count
FROM seat_reservations
JOIN trip_seats ON trip_seats.trip_id = seat_reservations.trip_id
               AND trip_seats.seat_id = seat_reservations.seat_id
WHERE seat_reservations.booking_id = sqlc.arg(booking_id)
  AND seat_reservations.seat_id = sqlc.arg(seat_id)
FOR UPDATE OF trip_seats;

-- name: ListSeatReservations :many
SELECT booking_id, from_stop, to_stop, status, expires_at
FROM seat_reservations
WHERE trip_id = sqlc.arg(trip_id)
  AND seat_id = sqlc.arg(seat_id)
ORDER BY booking_id;

-- name: UpsertSeatReservation :exec
INSERT INTO seat_reservations (
    booking_id, trip_id, seat_id, from_stop, to_stop, status, expires_at
)
VALUES (
    sqlc.arg(booking_id), sqlc.arg(trip_id), sqlc.arg(seat_id),
    sqlc.arg(from_stop), sqlc.arg(to_stop), sqlc.arg(status), sqlc.arg(expires_at)
)
ON CONFLICT (booking_id, seat_id) DO UPDATE SET
    from_stop = EXCLUDED.from_stop,
    to_stop = EXCLUDED.to_stop,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at;

-- name: ListTripSeats :many
SELECT
    seats.seat_id,
    seats.coach_number,
    seats.seat_number,
    seats.seat_type,
    NOT EXISTS (
        SELECT 1
        FROM seat_reservations AS reservations
        WHERE reservations.trip_id = seats.trip_id
          AND reservations.seat_id = seats.seat_id
          AND reservations.from_stop < sqlc.arg(to_stop)::smallint
          AND reservations.to_stop > sqlc.arg(from_stop)::smallint
          AND (
              reservations.status = 'confirmed'
              OR (reservations.status = 'held' AND reservations.expires_at > NOW())
          )
    ) AS available
FROM trip_seats AS seats
WHERE seats.trip_id = sqlc.arg(trip_id)
ORDER BY seats.coach_number, seats.seat_number;
