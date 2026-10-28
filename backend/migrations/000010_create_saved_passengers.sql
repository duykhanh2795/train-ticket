-- +goose Up
CREATE TABLE saved_passengers (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT saved_passengers_id_not_blank CHECK (BTRIM(id) <> ''),
    CONSTRAINT saved_passengers_name_valid
        CHECK (CHAR_LENGTH(BTRIM(full_name)) BETWEEN 2 AND 120)
);

CREATE INDEX saved_passengers_owner_created_idx
    ON saved_passengers (owner_id, created_at DESC, id DESC);

-- +goose Down
DROP TABLE saved_passengers;
