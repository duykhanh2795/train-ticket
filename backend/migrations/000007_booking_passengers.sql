-- +goose Up
ALTER TABLE seat_reservations DROP CONSTRAINT seat_reservations_pkey;
ALTER TABLE seat_reservations ADD PRIMARY KEY (booking_id, seat_id);
CREATE INDEX seat_reservations_booking_idx ON seat_reservations (booking_id, seat_id);

CREATE TABLE booking_passengers (
    booking_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    PRIMARY KEY (booking_id, seat_id),
    FOREIGN KEY (booking_id, seat_id)
        REFERENCES seat_reservations (booking_id, seat_id) ON DELETE RESTRICT,
    CONSTRAINT booking_passengers_name_valid
        CHECK (CHAR_LENGTH(BTRIM(full_name)) BETWEEN 2 AND 120)
);

-- +goose Down
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM seat_reservations
        GROUP BY booking_id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'cannot roll back multi-seat bookings without losing reservations';
    END IF;
END $$;
DROP TABLE booking_passengers;
DROP INDEX seat_reservations_booking_idx;
ALTER TABLE seat_reservations DROP CONSTRAINT seat_reservations_pkey;
ALTER TABLE seat_reservations ADD PRIMARY KEY (booking_id);
