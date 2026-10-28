-- Development-only fixture. Published SE1 times: https://giotaugiave.dsvn.vn/
-- Seats and fares are synthetic. This does not create valid railway tickets.
-- Re-running it never deletes or overwrites existing trips or bookings.
BEGIN;

INSERT INTO stations (id, code, name, city) VALUES
  ('HN', 'HN', 'Ga Hà Nội', 'Hà Nội'),
  ('ND', 'ND', 'Ga Nam Định', 'Nam Định'),
  ('VINH', 'VINH', 'Ga Vinh', 'Nghệ An'),
  ('DN', 'DN', 'Ga Đà Nẵng', 'Đà Nẵng'),
  ('SG', 'SG', 'Ga Sài Gòn', 'TP. Hồ Chí Minh')
ON CONFLICT (id) DO NOTHING;

DO $seed$
DECLARE
  service_day DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1;
  trip_key TEXT;
BEGIN
  trip_key := 'DEMO-SE1-' || TO_CHAR(service_day, 'YYYYMMDD');
  INSERT INTO train_trips (id, train_number, service_date, status)
  VALUES (trip_key, 'SE1', service_day, 'scheduled')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO trip_stops (trip_id, station_id, stop_order, arrival_at, departure_at) VALUES
    (trip_key, 'HN', 0, NULL, (service_day + TIME '21:45') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    (trip_key, 'ND', 1, (service_day + TIME '23:23') AT TIME ZONE 'Asia/Ho_Chi_Minh', (service_day + TIME '23:26') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    (trip_key, 'VINH', 2, (service_day + 1 + TIME '03:21') AT TIME ZONE 'Asia/Ho_Chi_Minh', (service_day + 1 + TIME '03:28') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    (trip_key, 'DN', 3, (service_day + 1 + TIME '13:14') AT TIME ZONE 'Asia/Ho_Chi_Minh', (service_day + 1 + TIME '13:29') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    (trip_key, 'SG', 4, (service_day + 2 + TIME '06:30') AT TIME ZONE 'Asia/Ho_Chi_Minh', NULL)
  ON CONFLICT (trip_id, stop_order) DO NOTHING;

  INSERT INTO trip_seats (trip_id, seat_id, coach_number, seat_number, seat_type)
  SELECT trip_key, '1-' || LPAD(n::text, 2, '0'), '1', LPAD(n::text, 2, '0'),
         CASE WHEN n <= 8 THEN 'vip' ELSE 'standard' END
  FROM GENERATE_SERIES(1, 72) AS n
  ON CONFLICT (trip_id, seat_id) DO NOTHING;

  INSERT INTO trip_segment_fares (trip_id, from_stop, seat_type, amount_vnd)
  SELECT trip_key, legs.from_stop, types.seat_type,
         CASE types.seat_type
           WHEN 'vip' THEN legs.standard_vnd * 2
           WHEN 'sleeper' THEN legs.standard_vnd * 16 / 10
           ELSE legs.standard_vnd
         END
  FROM (VALUES
    (0::SMALLINT, 80000::BIGINT),
    (1::SMALLINT, 150000::BIGINT),
    (2::SMALLINT, 350000::BIGINT),
    (3::SMALLINT, 400000::BIGINT)
  ) AS legs(from_stop, standard_vnd)
  CROSS JOIN (VALUES ('standard'), ('sleeper'), ('vip')) AS types(seat_type)
  ON CONFLICT (trip_id, from_stop, seat_type) DO NOTHING;
END $seed$;

COMMIT;
