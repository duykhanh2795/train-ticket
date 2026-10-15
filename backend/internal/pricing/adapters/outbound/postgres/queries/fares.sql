-- name: ListSegmentFares :many
SELECT seat_type, from_stop, amount_vnd
FROM trip_segment_fares
WHERE trip_id = sqlc.arg(trip_id)
  AND from_stop >= sqlc.arg(from_stop)::smallint
  AND from_stop < sqlc.arg(to_stop)::smallint
ORDER BY seat_type, from_stop;

-- name: GetSeatType :one
SELECT seat_type FROM trip_seats
WHERE trip_id = sqlc.arg(trip_id) AND seat_id = sqlc.arg(seat_id);
