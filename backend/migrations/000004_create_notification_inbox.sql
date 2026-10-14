-- +goose Up
CREATE TABLE notification_inbox (
    consumer_name TEXT NOT NULL,
    event_id TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_name, event_id)
);

-- A durable job, not proof of external email delivery.
CREATE TABLE notification_jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consumer_name TEXT NOT NULL,
    event_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (consumer_name, event_id),
    FOREIGN KEY (consumer_name, event_id) REFERENCES notification_inbox (consumer_name, event_id)
);
CREATE INDEX notification_jobs_pending_idx ON notification_jobs (created_at) WHERE status = 'pending';

-- +goose Down
DROP TABLE notification_jobs;
DROP TABLE notification_inbox;
