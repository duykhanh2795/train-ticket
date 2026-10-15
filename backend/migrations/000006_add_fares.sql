-- +goose Up
CREATE TABLE trip_segment_fares (
    trip_id TEXT NOT NULL,
    from_stop SMALLINT NOT NULL,
    seat_type TEXT NOT NULL,
    amount_vnd BIGINT NOT NULL,
    PRIMARY KEY (trip_id, from_stop, seat_type),
    FOREIGN KEY (trip_id, from_stop) REFERENCES trip_stops (trip_id, stop_order) ON DELETE CASCADE,
    CONSTRAINT trip_segment_fares_type_valid CHECK (seat_type IN ('standard', 'sleeper', 'vip')),
    CONSTRAINT trip_segment_fares_amount_positive CHECK (amount_vnd > 0)
);

-- Existing trips receive starter fares. Operators can replace them with
-- trip-specific amounts; new trips must have fares configured before sale.
INSERT INTO trip_segment_fares (trip_id, from_stop, seat_type, amount_vnd)
SELECT stops.trip_id, stops.stop_order, rates.seat_type, rates.amount_vnd
FROM trip_stops AS stops
JOIN LATERAL (
    VALUES ('standard', 100000::BIGINT), ('sleeper', 160000::BIGINT), ('vip', 220000::BIGINT)
) AS rates(seat_type, amount_vnd) ON TRUE
WHERE EXISTS (
    SELECT 1 FROM trip_stops AS next_stop
    WHERE next_stop.trip_id = stops.trip_id AND next_stop.stop_order = stops.stop_order + 1
);

-- Historical bookings have no trustworthy quote and remain NULL.
ALTER TABLE bookings ADD COLUMN fare_vnd BIGINT;
ALTER TABLE bookings ADD CONSTRAINT bookings_fare_positive CHECK (fare_vnd IS NULL OR fare_vnd > 0);

-- +goose Down
ALTER TABLE bookings DROP CONSTRAINT bookings_fare_positive;
ALTER TABLE bookings DROP COLUMN fare_vnd;
DROP TABLE trip_segment_fares;
