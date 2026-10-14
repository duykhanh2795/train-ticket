-- name: SearchTrips :many
SELECT
    trips.id AS trip_id,
    trips.train_number,
    trips.service_date,
    origin_stop.stop_order AS from_stop,
    destination_stop.stop_order AS to_stop,
    origin_stop.departure_at,
    destination_stop.arrival_at
FROM train_trips AS trips
JOIN trip_stops AS origin_stop
    ON origin_stop.trip_id = trips.id
JOIN trip_stops AS destination_stop
    ON destination_stop.trip_id = trips.id
WHERE origin_stop.station_id = sqlc.arg(origin_station_id)
  AND destination_stop.station_id = sqlc.arg(destination_station_id)
  AND origin_stop.stop_order < destination_stop.stop_order
  AND trips.service_date = sqlc.arg(service_date)::date
  AND trips.status = 'scheduled'
  AND origin_stop.departure_at IS NOT NULL
  AND destination_stop.arrival_at IS NOT NULL
ORDER BY origin_stop.departure_at, trips.id;
