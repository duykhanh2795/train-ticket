-- name: LockBookableTrip :one
SELECT status FROM train_trips
WHERE id = sqlc.arg(trip_id)
FOR SHARE;

-- name: LockOriginDeparture :one
SELECT departure_at FROM trip_stops
WHERE trip_id = sqlc.arg(trip_id)
  AND stop_order = sqlc.arg(from_stop)
FOR SHARE;

-- name: CreateBooking :exec
INSERT INTO bookings (
    id, customer_id, trip_id, status, created_at, expires_at, fare_vnd
)
VALUES (
    sqlc.arg(id), sqlc.arg(customer_id), sqlc.arg(trip_id),
    sqlc.arg(status), sqlc.arg(created_at), sqlc.arg(expires_at), sqlc.arg(fare_vnd)
);

-- name: CreateBookingPassenger :exec
INSERT INTO booking_passengers (booking_id, seat_id, full_name)
VALUES (sqlc.arg(booking_id), sqlc.arg(seat_id), sqlc.arg(full_name));

-- name: FindBookingForUpdate :one
SELECT id, customer_id, trip_id, status, created_at, expires_at, fare_vnd
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

-- name: ListCustomerBookings :many
SELECT
    bookings.id AS booking_id,
    bookings.trip_id,
    CASE
        WHEN bookings.status = 'held' AND bookings.expires_at <= NOW() THEN 'expired'
        ELSE bookings.status
    END::text AS status,
    bookings.created_at,
    bookings.expires_at,
    bookings.fare_vnd,
    trips.train_number,
    trips.service_date::text AS service_date,
    trip_seats.coach_number,
    trip_seats.seat_number,
    trip_seats.seat_type,
    reservations.from_stop,
    reservations.to_stop,
    origin.name AS origin_station,
    destination.name AS destination_station
FROM bookings
JOIN train_trips AS trips ON trips.id = bookings.trip_id
JOIN LATERAL (
    SELECT * FROM seat_reservations
    WHERE booking_id = bookings.id
    ORDER BY seat_id LIMIT 1
) AS reservations ON TRUE
JOIN trip_seats ON trip_seats.trip_id = reservations.trip_id
               AND trip_seats.seat_id = reservations.seat_id
JOIN trip_stops AS origin_stop ON origin_stop.trip_id = bookings.trip_id
                              AND origin_stop.stop_order = reservations.from_stop
JOIN stations AS origin ON origin.id = origin_stop.station_id
JOIN trip_stops AS destination_stop ON destination_stop.trip_id = bookings.trip_id
                                   AND destination_stop.stop_order = reservations.to_stop
JOIN stations AS destination ON destination.id = destination_stop.station_id
WHERE bookings.customer_id = sqlc.arg(customer_id)
ORDER BY bookings.created_at DESC, bookings.id DESC
LIMIT sqlc.arg(page_size)::integer OFFSET sqlc.arg(page_offset)::integer;

-- name: GetCustomerBooking :one
SELECT
    bookings.id AS booking_id,
    bookings.trip_id,
    CASE
        WHEN bookings.status = 'held' AND bookings.expires_at <= NOW() THEN 'expired'
        ELSE bookings.status
    END::text AS status,
    bookings.created_at,
    bookings.expires_at,
    bookings.fare_vnd,
    trips.train_number,
    trips.service_date::text AS service_date,
    trip_seats.coach_number,
    trip_seats.seat_number,
    trip_seats.seat_type,
    reservations.from_stop,
    reservations.to_stop,
    origin.name AS origin_station,
    destination.name AS destination_station
FROM bookings
JOIN train_trips AS trips ON trips.id = bookings.trip_id
JOIN LATERAL (
    SELECT * FROM seat_reservations
    WHERE booking_id = bookings.id
    ORDER BY seat_id LIMIT 1
) AS reservations ON TRUE
JOIN trip_seats ON trip_seats.trip_id = reservations.trip_id
               AND trip_seats.seat_id = reservations.seat_id
JOIN trip_stops AS origin_stop ON origin_stop.trip_id = bookings.trip_id
                              AND origin_stop.stop_order = reservations.from_stop
JOIN stations AS origin ON origin.id = origin_stop.station_id
JOIN trip_stops AS destination_stop ON destination_stop.trip_id = bookings.trip_id
                                   AND destination_stop.stop_order = reservations.to_stop
JOIN stations AS destination ON destination.id = destination_stop.station_id
WHERE bookings.id = sqlc.arg(booking_id)
  AND bookings.customer_id = sqlc.arg(customer_id);

-- name: ListBookingSeats :many
SELECT reservations.booking_id, reservations.seat_id,
       seats.coach_number, seats.seat_number, seats.seat_type,
       COALESCE(passengers.full_name, '')::text AS full_name
FROM seat_reservations AS reservations
JOIN trip_seats AS seats ON seats.trip_id = reservations.trip_id
                        AND seats.seat_id = reservations.seat_id
LEFT JOIN booking_passengers AS passengers
       ON passengers.booking_id = reservations.booking_id
      AND passengers.seat_id = reservations.seat_id
WHERE reservations.booking_id = ANY(sqlc.arg(booking_ids)::text[])
ORDER BY reservations.booking_id, reservations.seat_id;
