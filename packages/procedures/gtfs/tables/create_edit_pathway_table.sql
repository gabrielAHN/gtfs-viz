

CREATE TABLE IF NOT EXISTS EditPathwayTable (
    row_id INTEGER NOT NULL,
    pathway_id TEXT NOT NULL,
    from_stop_id TEXT NOT NULL,
    to_stop_id TEXT NOT NULL,
    pathway_mode INTEGER DEFAULT 1,
    is_bidirectional INTEGER DEFAULT 1,
    length DOUBLE,
    traversal_time INTEGER,
    stair_count INTEGER,
    max_slope DOUBLE,
    min_width DOUBLE,
    signposted_as TEXT,
    reversed_signposted_as TEXT,
    status TEXT
);
