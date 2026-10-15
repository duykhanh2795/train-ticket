-- +goose Up
-- The composite primary key already indexes booking_id as its first column.
DROP INDEX seat_reservations_booking_idx;

-- +goose Down
CREATE INDEX seat_reservations_booking_idx ON seat_reservations (booking_id, seat_id);
