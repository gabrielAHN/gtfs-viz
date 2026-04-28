# GTFS Extension Quick Start

## DuckDB CLI

One-step install:

```sql
.read public/extensions/gtfs/install_all.sql
```

If you want the pieces separately:

```sql
.read public/extensions/gtfs/install.sql
.read public/extensions/gtfs/install_pathways.sql
.read public/extensions/gtfs/procedures/install.sql
```

## Minimal import flow

```sql
CREATE OR REPLACE TABLE stops AS
SELECT * FROM read_csv_auto('stops.txt');

CREATE OR REPLACE TABLE pathways AS
SELECT * FROM read_csv_auto('pathways.txt');

.read public/extensions/gtfs/install_all.sql
```

## App runtime

The app fetches procedures from:

```text
/extensions/gtfs/procedures/<path>.sql
```

So the GTFS folder is the only public procedure source that should be maintained.
