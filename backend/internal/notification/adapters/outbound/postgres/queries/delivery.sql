-- name: ClaimNotificationJob :one
UPDATE notification_jobs AS jobs
SET claim_token = sqlc.arg(claim_token),
    claimed_until = sqlc.arg(claimed_until)
FROM (
    SELECT id FROM notification_jobs
    WHERE notification_jobs.status = 'pending'
      AND notification_jobs.next_attempt_at <= sqlc.arg(at)
      AND (notification_jobs.claimed_until IS NULL OR notification_jobs.claimed_until <= sqlc.arg(at))
    ORDER BY notification_jobs.next_attempt_at, notification_jobs.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
) AS candidate
WHERE jobs.id = candidate.id
RETURNING jobs.id, jobs.booking_id, jobs.customer_id, jobs.event_type, jobs.event_id, jobs.attempts;

-- name: FindConfirmationEmail :one
SELECT users.email, users.full_name, trips.train_number,
       trips.service_date::text AS service_date,
       origin.name AS origin_station, destination.name AS destination_station
FROM bookings
JOIN auth_users AS users ON users.id = bookings.customer_id
JOIN train_trips AS trips ON trips.id = bookings.trip_id
JOIN LATERAL (
    SELECT from_stop, to_stop FROM seat_reservations
    WHERE booking_id = bookings.id AND status = 'confirmed'
    ORDER BY seat_id LIMIT 1
) AS reservation ON TRUE
JOIN trip_stops AS origin_stop
  ON origin_stop.trip_id = bookings.trip_id AND origin_stop.stop_order = reservation.from_stop
JOIN trip_stops AS destination_stop
  ON destination_stop.trip_id = bookings.trip_id AND destination_stop.stop_order = reservation.to_stop
JOIN stations AS origin ON origin.id = origin_stop.station_id
JOIN stations AS destination ON destination.id = destination_stop.station_id
WHERE bookings.id = sqlc.arg(booking_id)
  AND bookings.customer_id = sqlc.arg(customer_id)
  AND bookings.status = 'confirmed'
  AND EXISTS (SELECT 1 FROM tickets WHERE booking_id = bookings.id);

-- name: MarkNotificationSent :execrows
UPDATE notification_jobs
SET status = 'sent', sent_at = sqlc.arg(at), attempts = attempts + 1,
    claim_token = NULL, claimed_until = NULL, last_error_code = NULL
WHERE id = sqlc.arg(id) AND claim_token = sqlc.arg(claim_token)
  AND status = 'pending';

-- name: MarkNotificationSkipped :execrows
UPDATE notification_jobs
SET status = 'skipped', claim_token = NULL, claimed_until = NULL
WHERE id = sqlc.arg(id) AND claim_token = sqlc.arg(claim_token)
  AND status = 'pending';

-- name: MarkNotificationAttemptFailed :execrows
UPDATE notification_jobs
SET status = sqlc.arg(status), attempts = attempts + 1,
    next_attempt_at = sqlc.arg(next_attempt_at), last_error_code = sqlc.arg(error_code),
    claim_token = NULL, claimed_until = NULL
WHERE id = sqlc.arg(id) AND claim_token = sqlc.arg(claim_token)
  AND status = 'pending';
