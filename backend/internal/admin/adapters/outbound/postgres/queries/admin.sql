-- name: IsAdmin :one
SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = $1);

-- name: ListStations :many
SELECT id, code, name, city FROM stations ORDER BY name, id;

-- name: InsertStation :exec
INSERT INTO stations (id, code, name, city) VALUES ($1, $2, $3, $4);

-- name: ListAdminTrips :many
SELECT t.id, t.train_number, t.service_date, t.status,
       (SELECT COUNT(*) FROM trip_stops s WHERE s.trip_id = t.id) AS stop_count,
       (SELECT COUNT(*) FROM trip_seats s WHERE s.trip_id = t.id) AS seat_count
FROM train_trips t ORDER BY t.service_date DESC, t.created_at DESC LIMIT $1 OFFSET $2;

-- name: InsertAdminTrip :exec
INSERT INTO train_trips (id, train_number, service_date, status)
VALUES ($1, $2, $3, 'scheduled');

-- name: InsertAdminTripStop :exec
INSERT INTO trip_stops (trip_id, station_id, stop_order, arrival_at, departure_at)
VALUES ($1, $2, $3, $4, $5);

-- name: InsertAdminTripSeat :exec
INSERT INTO trip_seats (trip_id, seat_id, coach_number, seat_number, seat_type)
VALUES ($1, $2, $3, $4, $5);

-- name: InsertAdminTripFare :exec
INSERT INTO trip_segment_fares (trip_id, from_stop, seat_type, amount_vnd)
VALUES ($1, $2, $3, $4);

-- name: ListAdminBookings :many
SELECT b.id, b.trip_id, b.customer_id, b.status, b.created_at, b.expires_at,
       b.fare_vnd, t.train_number, t.service_date,
       u.email AS customer_email
FROM bookings b
JOIN train_trips t ON t.id = b.trip_id
LEFT JOIN auth_users u ON u.id = b.customer_id
ORDER BY b.created_at DESC, b.id DESC LIMIT $1 OFFSET $2;
