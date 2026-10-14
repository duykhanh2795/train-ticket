-- +goose Up
CREATE TABLE outbox_messages (
    id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INTEGER NOT NULL DEFAULT 0,
    claimed_by TEXT,
    claimed_until TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    last_error TEXT,
    CONSTRAINT outbox_id_not_blank CHECK (BTRIM(id) <> ''),
    CONSTRAINT outbox_aggregate_type_not_blank CHECK (BTRIM(aggregate_type) <> ''),
    CONSTRAINT outbox_aggregate_id_not_blank CHECK (BTRIM(aggregate_id) <> ''),
    CONSTRAINT outbox_event_type_not_blank CHECK (BTRIM(event_type) <> ''),
    CONSTRAINT outbox_attempts_nonnegative CHECK (attempts >= 0)
);

CREATE INDEX outbox_pending_idx
    ON outbox_messages (available_at, occurred_at)
    WHERE published_at IS NULL;

-- +goose Down
DROP TABLE outbox_messages;
