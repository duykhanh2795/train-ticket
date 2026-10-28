-- +goose Up
ALTER TABLE notification_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notification_jobs ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE notification_jobs ADD COLUMN claim_token TEXT;
ALTER TABLE notification_jobs ADD COLUMN claimed_until TIMESTAMPTZ;
ALTER TABLE notification_jobs ADD COLUMN sent_at TIMESTAMPTZ;
ALTER TABLE notification_jobs ADD COLUMN last_error_code TEXT;
ALTER TABLE notification_jobs DROP CONSTRAINT notification_jobs_status_check;
ALTER TABLE notification_jobs ADD CONSTRAINT notification_jobs_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));
DROP INDEX notification_jobs_pending_idx;
CREATE INDEX notification_jobs_delivery_idx
    ON notification_jobs (next_attempt_at, id) WHERE status = 'pending';

-- +goose Down
DROP INDEX notification_jobs_delivery_idx;
CREATE INDEX notification_jobs_pending_idx ON notification_jobs (created_at) WHERE status = 'pending';
UPDATE notification_jobs SET status = 'pending' WHERE status = 'skipped';
ALTER TABLE notification_jobs DROP CONSTRAINT notification_jobs_status_check;
ALTER TABLE notification_jobs ADD CONSTRAINT notification_jobs_status_check
    CHECK (status IN ('pending', 'sent', 'failed'));
ALTER TABLE notification_jobs DROP COLUMN last_error_code;
ALTER TABLE notification_jobs DROP COLUMN sent_at;
ALTER TABLE notification_jobs DROP COLUMN claimed_until;
ALTER TABLE notification_jobs DROP COLUMN claim_token;
ALTER TABLE notification_jobs DROP COLUMN next_attempt_at;
ALTER TABLE notification_jobs DROP COLUMN attempts;
