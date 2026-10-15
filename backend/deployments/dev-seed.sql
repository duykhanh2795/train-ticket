-- Run this in the Neon SQL Editor after applying migrations/ with Goose.
-- These records are demo data; do not use them as real timetable data.

INSERT INTO stations (id, code, name, city) VALUES
    ('HN', 'HN', 'Ga Hà Nội', 'Hà Nội'),
    ('ND', 'ND', 'Ga Nam Định', 'Nam Định'),
    ('VINH', 'VINH', 'Ga Vinh', 'Nghệ An'),
    ('DN', 'DN', 'Ga Đà Nẵng', 'Đà Nẵng'),
    ('SG', 'SG', 'Ga Sài Gòn', 'TP. Hồ Chí Minh')
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    city = EXCLUDED.city;

INSERT INTO train_trips (id, train_number, service_date, status) VALUES
    ('DEMO-SE1', 'SE1', CURRENT_DATE + 1, 'scheduled')
ON CONFLICT (id) DO UPDATE SET
    train_number = EXCLUDED.train_number,
    service_date = EXCLUDED.service_date,
    status = EXCLUDED.status;

INSERT INTO trip_seats (trip_id, seat_id, coach_number, seat_number, seat_type)
SELECT
    'DEMO-SE1',
    '1-' || LPAD(seat_number::text, 2, '0'),
    '1',
    LPAD(seat_number::text, 2, '0'),
    CASE WHEN seat_number <= 8 THEN 'vip' ELSE 'standard' END
FROM generate_series(1, 72) AS numbers(seat_number)
ON CONFLICT (trip_id, seat_id) DO UPDATE SET
    coach_number = EXCLUDED.coach_number,
    seat_number = EXCLUDED.seat_number,
    seat_type = EXCLUDED.seat_type;

DELETE FROM trip_stops WHERE trip_id = 'DEMO-SE1';

INSERT INTO trip_stops (trip_id, station_id, stop_order, arrival_at, departure_at) VALUES
    ('DEMO-SE1', 'HN',   0, NULL,                                                   ((CURRENT_DATE + 1) + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'ND',   1, ((CURRENT_DATE + 1) + TIME '10:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', ((CURRENT_DATE + 1) + TIME '10:10') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'VINH', 2, ((CURRENT_DATE + 1) + TIME '14:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', ((CURRENT_DATE + 1) + TIME '14:10') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'DN',   3, ((CURRENT_DATE + 1) + TIME '21:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', ((CURRENT_DATE + 1) + TIME '21:10') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'SG',   4, ((CURRENT_DATE + 2) + TIME '05:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', NULL);

-- VND per adjacent segment. The selected service date belongs to DEMO-SE1;
-- another trip/date can have different prices for the same route.
INSERT INTO trip_segment_fares (trip_id, from_stop, seat_type, amount_vnd)
SELECT 'DEMO-SE1', fares.from_stop, fares.seat_type, fares.amount_vnd
FROM (VALUES
    (0,  80000::BIGINT), (1, 150000::BIGINT),
    (2, 350000::BIGINT), (3, 400000::BIGINT)
) AS legs(from_stop, standard_vnd)
CROSS JOIN LATERAL (VALUES
    (legs.from_stop, 'standard', legs.standard_vnd),
    (legs.from_stop, 'sleeper',  legs.standard_vnd * 16 / 10),
    (legs.from_stop, 'vip',      legs.standard_vnd * 2)
) AS fares(from_stop, seat_type, amount_vnd)
WHERE true
ON CONFLICT (trip_id, from_stop, seat_type) DO UPDATE
SET amount_vnd = EXCLUDED.amount_vnd;
