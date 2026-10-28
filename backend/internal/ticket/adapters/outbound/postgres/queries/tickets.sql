-- name: HasTicketPassengers :one
SELECT EXISTS (
    SELECT 1 FROM seat_reservations AS reservations
    WHERE reservations.booking_id = sqlc.arg(booking_id)
)
AND NOT EXISTS (
    SELECT 1
    FROM seat_reservations AS reservations
    LEFT JOIN booking_passengers AS passengers
      ON passengers.booking_id = reservations.booking_id
     AND passengers.seat_id = reservations.seat_id
    WHERE reservations.booking_id = sqlc.arg(booking_id)
      AND passengers.seat_id IS NULL
) AS ready;

-- name: ListTicketSeatIDs :many
SELECT passengers.seat_id
FROM booking_passengers AS passengers
JOIN bookings ON bookings.id = passengers.booking_id
WHERE passengers.booking_id = sqlc.arg(booking_id)
  AND bookings.status = 'confirmed'
ORDER BY passengers.seat_id;

-- name: CreateTicket :execrows
INSERT INTO tickets (id, booking_id, seat_id, issued_at)
SELECT sqlc.arg(id), passengers.booking_id, passengers.seat_id, sqlc.arg(issued_at)
FROM booking_passengers AS passengers
JOIN bookings ON bookings.id = passengers.booking_id
JOIN seat_reservations AS reservations
  ON reservations.booking_id = passengers.booking_id
 AND reservations.seat_id = passengers.seat_id
WHERE passengers.booking_id = sqlc.arg(booking_id)
  AND passengers.seat_id = sqlc.arg(seat_id)
  AND bookings.status = 'confirmed'
  AND reservations.status = 'confirmed'
ON CONFLICT (booking_id, seat_id) DO NOTHING;

-- name: ListTicketsByBooking :many
SELECT tickets.id, tickets.booking_id, tickets.seat_id, tickets.issued_at,
       passengers.full_name, seats.coach_number, seats.seat_number
FROM tickets
JOIN bookings ON bookings.id = tickets.booking_id
JOIN booking_passengers AS passengers
  ON passengers.booking_id = tickets.booking_id
 AND passengers.seat_id = tickets.seat_id
JOIN seat_reservations AS reservations
  ON reservations.booking_id = tickets.booking_id
 AND reservations.seat_id = tickets.seat_id
JOIN trip_seats AS seats
  ON seats.trip_id = reservations.trip_id
 AND seats.seat_id = reservations.seat_id
WHERE tickets.booking_id = sqlc.arg(booking_id)
  AND bookings.customer_id = sqlc.arg(customer_id)
  AND bookings.status = 'confirmed'
ORDER BY seats.coach_number, seats.seat_number, tickets.id;

-- name: GetTicketBookingStatus :one
SELECT status
FROM bookings
WHERE id = sqlc.arg(booking_id)
  AND customer_id = sqlc.arg(customer_id);

-- name: GetGateAgentStation :one
SELECT station_id
FROM gate_agents
WHERE user_id = sqlc.arg(user_id)
FOR SHARE;

-- name: GetGateTicket :one
SELECT tickets.id, tickets.booking_id, tickets.seat_id,
       passengers.full_name, seats.coach_number, seats.seat_number,
       trips.train_number, trips.service_date, trips.status AS trip_status,
       bookings.status AS booking_status,
       boarding.station_id AS boarding_station_id, boarding.departure_at,
       scans.scanned_at
FROM tickets
JOIN bookings ON bookings.id = tickets.booking_id
JOIN train_trips AS trips ON trips.id = bookings.trip_id
JOIN booking_passengers AS passengers
  ON passengers.booking_id = tickets.booking_id
 AND passengers.seat_id = tickets.seat_id
JOIN seat_reservations AS reservations
  ON reservations.booking_id = tickets.booking_id
 AND reservations.seat_id = tickets.seat_id
JOIN trip_seats AS seats
  ON seats.trip_id = reservations.trip_id
 AND seats.seat_id = reservations.seat_id
JOIN trip_stops AS boarding
  ON boarding.trip_id = reservations.trip_id
 AND boarding.stop_order = reservations.from_stop
LEFT JOIN ticket_gate_scans AS scans ON scans.ticket_id = tickets.id
WHERE tickets.id = sqlc.arg(ticket_id)
  AND reservations.status = 'confirmed';

-- name: LockGateTicket :one
SELECT tickets.id, tickets.booking_id, tickets.seat_id,
       passengers.full_name, seats.coach_number, seats.seat_number,
       trips.train_number, trips.service_date, trips.status AS trip_status,
       bookings.status AS booking_status,
       boarding.station_id AS boarding_station_id, boarding.departure_at,
       scans.scanned_at
FROM tickets
JOIN bookings ON bookings.id = tickets.booking_id
JOIN train_trips AS trips ON trips.id = bookings.trip_id
JOIN booking_passengers AS passengers
  ON passengers.booking_id = tickets.booking_id
 AND passengers.seat_id = tickets.seat_id
JOIN seat_reservations AS reservations
  ON reservations.booking_id = tickets.booking_id
 AND reservations.seat_id = tickets.seat_id
JOIN trip_seats AS seats
  ON seats.trip_id = reservations.trip_id
 AND seats.seat_id = reservations.seat_id
JOIN trip_stops AS boarding
  ON boarding.trip_id = reservations.trip_id
 AND boarding.stop_order = reservations.from_stop
LEFT JOIN ticket_gate_scans AS scans ON scans.ticket_id = tickets.id
WHERE tickets.id = sqlc.arg(ticket_id)
  AND reservations.status = 'confirmed'
FOR UPDATE OF tickets;

-- name: RecordGateScan :execrows
INSERT INTO ticket_gate_scans (ticket_id, gate_agent_id, station_id, scanned_at)
VALUES (sqlc.arg(ticket_id), sqlc.arg(gate_agent_id), sqlc.arg(station_id), sqlc.arg(scanned_at))
ON CONFLICT (ticket_id) DO NOTHING;
