

CREATE OR REPLACE TABLE EditStopTable (
    row_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_name TEXT NOT NULL,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    location_type_name TEXT,
    parent_station TEXT,
    wheelchair_status TEXT,
    status TEXT
);
