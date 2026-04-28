

CREATE TABLE IF NOT EXISTS EditStopTable (
    row_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_name TEXT,
    stop_lat DOUBLE PRECISION,
    stop_lon DOUBLE PRECISION,
    location_type_name TEXT,
    parent_station TEXT,
    level_id TEXT,
    wheelchair_status TEXT,
    status TEXT
);

ALTER TABLE EditStopTable ADD COLUMN IF NOT EXISTS level_id TEXT;
