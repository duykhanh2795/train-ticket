-- name: EnqueueOutbox :exec
INSERT INTO outbox_messages (id, aggregate_type, aggregate_id, event_type, payload, occurred_at)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: ClaimOutbox :many
WITH candidates AS (
    SELECT id FROM outbox_messages
    WHERE published_at IS NULL AND available_at <= sqlc.arg(claim_time)::timestamptz
      AND (claimed_until IS NULL OR claimed_until <= sqlc.arg(claim_time)::timestamptz)
    ORDER BY occurred_at, id
    LIMIT sqlc.arg(batch_size)::int
    FOR UPDATE SKIP LOCKED
)
UPDATE outbox_messages AS messages
SET claimed_by = sqlc.arg(owner)::text, claimed_until = sqlc.arg(lease_until)::timestamptz,
    attempts = messages.attempts + 1
FROM candidates WHERE messages.id = candidates.id
RETURNING messages.id, messages.aggregate_type, messages.aggregate_id,
          messages.event_type, messages.payload, messages.occurred_at, messages.attempts;

-- name: MarkOutboxPublished :execrows
UPDATE outbox_messages
SET published_at = sqlc.arg(published_at)::timestamptz,
    claimed_by = NULL, claimed_until = NULL, last_error = NULL
WHERE id = sqlc.arg(id)::text AND claimed_by = sqlc.arg(owner)::text AND published_at IS NULL;

-- name: MarkOutboxFailed :execrows
UPDATE outbox_messages
SET available_at = sqlc.arg(failed_at)::timestamptz + make_interval(secs => LEAST(300, power(2, LEAST(attempts, 9))::int)),
    claimed_by = NULL, claimed_until = NULL, last_error = sqlc.arg(detail)::text
WHERE id = sqlc.arg(id)::text AND claimed_by = sqlc.arg(owner)::text AND published_at IS NULL;

-- name: OutboxStats :one
SELECT count(*)::bigint AS pending,
       COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(occurred_at))), 0)::double precision AS oldest_age_seconds
FROM outbox_messages WHERE published_at IS NULL;
