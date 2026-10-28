-- name: CreateAttempt :one
INSERT INTO payment_attempts (booking_id, amount_vnd, created_at, expires_at, updated_at)
VALUES ($1, $2, $3, $4, $3)
RETURNING *;

-- name: SaveCheckoutURL :execrows
UPDATE payment_attempts SET checkout_url = $2 WHERE id = $1 AND status = 'pending';

-- name: FindPendingAttempt :one
SELECT * FROM payment_attempts WHERE booking_id = $1 AND status = 'pending';

-- name: FindAttempt :one
SELECT * FROM payment_attempts WHERE id = $1;

-- name: FindOwnedAttempt :one
SELECT payment_attempts.* FROM payment_attempts
JOIN bookings ON bookings.id = payment_attempts.booking_id
WHERE payment_attempts.id = $1 AND bookings.customer_id = $2;

-- name: LockAttempt :one
SELECT * FROM payment_attempts WHERE id = $1 FOR UPDATE;

-- name: SettleAttempt :execrows
UPDATE payment_attempts
SET status = $2, provider_txn_id = $3, response_code = $4,
    transaction_status = $5, updated_at = $6
WHERE id = $1 AND status IN ('pending', 'failed');
