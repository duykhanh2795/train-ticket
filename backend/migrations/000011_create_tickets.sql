-- +goose Up
CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT tickets_id_not_blank CHECK (BTRIM(id) <> ''),
    CONSTRAINT tickets_one_per_booking_seat UNIQUE (booking_id, seat_id),
    CONSTRAINT tickets_booking_passenger_fkey
        FOREIGN KEY (booking_id, seat_id)
        REFERENCES booking_passengers (booking_id, seat_id) ON DELETE RESTRICT
);

CREATE INDEX tickets_booking_idx ON tickets (booking_id);

-- +goose Down
DROP TABLE tickets;
