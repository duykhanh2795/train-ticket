-- +goose Up
CREATE TABLE trip_seats (
    trip_id TEXT NOT NULL REFERENCES train_trips(id) ON DELETE CASCADE,
    seat_id TEXT NOT NULL,
    coach_number TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    seat_type TEXT NOT NULL DEFAULT 'standard',
    PRIMARY KEY (trip_id, seat_id),
    UNIQUE (trip_id, coach_number, seat_number),
    CONSTRAINT trip_seats_id_not_blank CHECK (BTRIM(seat_id) <> ''),
    CONSTRAINT trip_seats_coach_not_blank CHECK (BTRIM(coach_number) <> ''),
    CONSTRAINT trip_seats_number_not_blank CHECK (BTRIM(seat_number) <> ''),
    CONSTRAINT trip_seats_type_valid CHECK (seat_type IN ('standard', 'sleeper', 'vip'))
);

CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    trip_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT bookings_customer_not_blank CHECK (BTRIM(customer_id) <> ''),
    CONSTRAINT bookings_status_valid CHECK (status IN ('held', 'confirmed', 'cancelled', 'expired')),
    CONSTRAINT bookings_expiry_after_creation CHECK (expires_at > created_at),
    CONSTRAINT bookings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES train_trips(id) ON DELETE RESTRICT
);

CREATE INDEX bookings_customer_created_idx ON bookings (customer_id, created_at DESC);
CREATE INDEX bookings_status_expiry_idx ON bookings (status, expires_at) WHERE status = 'held';

CREATE TABLE seat_reservations (
    booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE RESTRICT,
    trip_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    from_stop SMALLINT NOT NULL,
    to_stop SMALLINT NOT NULL,
    status TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT seat_reservations_segment_valid CHECK (from_stop >= 0 AND to_stop > from_stop),
    CONSTRAINT seat_reservations_status_valid CHECK (status IN ('held', 'confirmed', 'released')),
    CONSTRAINT seat_reservations_trip_seat_fkey
        FOREIGN KEY (trip_id, seat_id) REFERENCES trip_seats(trip_id, seat_id) ON DELETE RESTRICT
);

CREATE INDEX seat_reservations_inventory_idx ON seat_reservations (trip_id, seat_id);

-- +goose Down
DROP TABLE seat_reservations;
DROP TABLE bookings;
DROP TABLE trip_seats;
