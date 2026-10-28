-- Legacy fixture. Prefer go run ./cmd/devseed for a dated, non-destructive trip.
-- Reference timetable: SE1, https://giotaugiave.dsvn.vn/ (viewed 2026-10-23).
-- Departure/arrival times below follow the published timetable, not a live service-date confirmation.
-- Seats, availability, and segment fares remain synthetic demo data; tickets are not valid for travel.

INSERT INTO stations (id, code, name, city) VALUES
    ('HN', 'HN', 'Ga Hà Nội', 'Hà Nội'),
    ('ND', 'ND', 'Ga Nam Định', 'Nam Định'),
    ('VINH', 'VINH', 'Ga Vinh', 'Nghệ An'),
    ('DN', 'DN', 'Ga Đà Nẵng', 'Đà Nẵng'),
    ('SG', 'SG', 'Ga Sài Gòn', 'TP. Hồ Chí Minh')
ON CONFLICT (id) DO NOTHING;

INSERT INTO train_trips (id, train_number, service_date, status) VALUES
    ('DEMO-SE1', 'SE1', CURRENT_DATE + 1, 'scheduled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_seats (trip_id, seat_id, coach_number, seat_number, seat_type)
SELECT
    'DEMO-SE1',
    '1-' || LPAD(seat_number::text, 2, '0'),
    '1',
    LPAD(seat_number::text, 2, '0'),
    CASE WHEN seat_number <= 8 THEN 'vip' ELSE 'standard' END
FROM generate_series(1, 72) AS numbers(seat_number)
ON CONFLICT (trip_id, seat_id) DO NOTHING;

INSERT INTO trip_stops (trip_id, station_id, stop_order, arrival_at, departure_at) VALUES
    ('DEMO-SE1', 'HN',   0, NULL,                                                   ((CURRENT_DATE + 1) + TIME '21:45') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'ND',   1, ((CURRENT_DATE + 1) + TIME '23:23') AT TIME ZONE 'Asia/Ho_Chi_Minh', ((CURRENT_DATE + 1) + TIME '23:26') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'VINH', 2, ((CURRENT_DATE + 2) + TIME '03:21') AT TIME ZONE 'Asia/Ho_Chi_Minh', ((CURRENT_DATE + 2) + TIME '03:28') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'DN',   3, ((CURRENT_DATE + 2) + TIME '13:14') AT TIME ZONE 'Asia/Ho_Chi_Minh', ((CURRENT_DATE + 2) + TIME '13:29') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ('DEMO-SE1', 'SG',   4, ((CURRENT_DATE + 3) + TIME '06:30') AT TIME ZONE 'Asia/Ho_Chi_Minh', NULL)
ON CONFLICT (trip_id, stop_order) DO NOTHING;

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
ON CONFLICT (trip_id, from_stop, seat_type) DO NOTHING;
