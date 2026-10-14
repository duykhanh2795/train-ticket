-- name: InsertInbox :execrows
INSERT INTO notification_inbox (consumer_name, event_id)
VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: InsertNotificationJob :exec
INSERT INTO notification_jobs (consumer_name, event_id, booking_id, customer_id, event_type, payload)
VALUES ($1, $2, $3, $4, $5, $6);
