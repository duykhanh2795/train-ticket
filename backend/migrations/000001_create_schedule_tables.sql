-- +goose Up
CREATE TABLE stations (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stations_code_not_blank CHECK (BTRIM(code) <> ''),
    CONSTRAINT stations_name_not_blank CHECK (BTRIM(name) <> '')
);

CREATE TABLE train_trips (
    id TEXT PRIMARY KEY,
    train_number TEXT NOT NULL,
    service_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT train_trips_number_not_blank CHECK (BTRIM(train_number) <> ''),
    CONSTRAINT train_trips_status_valid CHECK (status IN ('scheduled', 'cancelled', 'completed'))
);

CREATE INDEX train_trips_service_date_idx ON train_trips (service_date, status);

CREATE TABLE trip_stops (
    trip_id TEXT NOT NULL REFERENCES train_trips(id) ON DELETE CASCADE,
    station_id TEXT NOT NULL REFERENCES stations(id),
    stop_order SMALLINT NOT NULL CHECK (stop_order >= 0),
    arrival_at TIMESTAMPTZ,
    departure_at TIMESTAMPTZ,
    PRIMARY KEY (trip_id, stop_order),
    UNIQUE (trip_id, station_id),
    CONSTRAINT trip_stops_time_order CHECK (
        arrival_at IS NULL OR departure_at IS NULL OR departure_at >= arrival_at
    )
);

CREATE INDEX trip_stops_station_trip_idx ON trip_stops (station_id, trip_id);

-- +goose Down
DROP TABLE trip_stops;
DROP TABLE train_trips;
DROP TABLE stations;
