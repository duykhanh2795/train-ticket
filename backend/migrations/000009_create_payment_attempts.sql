-- +goose Up
CREATE TABLE payment_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount_vnd BIGINT NOT NULL CHECK (amount_vnd > 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'failed', 'succeeded', 'paid_unfulfilled')),
    checkout_url TEXT NOT NULL DEFAULT '',
    provider_txn_id TEXT,
    response_code TEXT,
    transaction_status TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX payment_attempts_one_pending_per_booking
    ON payment_attempts (booking_id) WHERE status = 'pending';
CREATE UNIQUE INDEX payment_attempts_provider_txn_unique
    ON payment_attempts (provider_txn_id) WHERE provider_txn_id IS NOT NULL AND provider_txn_id <> '';
CREATE INDEX payment_attempts_booking_idx ON payment_attempts (booking_id, id DESC);

-- +goose Down
DROP TABLE payment_attempts;
