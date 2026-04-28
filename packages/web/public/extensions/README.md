# GTFS DuckDB Extensions

`public/extensions/gtfs` is the single authoritative extension folder for GTFS in this app.

## Structure

```text
public/extensions/
└── gtfs/
    ├── install.sql
    ├── install_pathways.sql
    ├── install_all.sql
    ├── procedures/
    │   ├── install.sql
    │   ├── ingestion/
    │   ├── pathfinding/
    │   ├── queries/
    │   ├── tables/
    │   └── utils/
    └── README.md
```

## Runtime

The web app loads SQL procedures from:

```text
/extensions/gtfs/procedures/<path>.sql
```

That path is implemented in [src/lib/extensions.ts](/Users/gh/Projects/personal_project/gtfs-viz/src/lib/extensions.ts).

## Install options

For one-step CLI setup:

```sql
.read public/extensions/gtfs/install_all.sql
```

For modular setup:

```sql
.read public/extensions/gtfs/install.sql
.read public/extensions/gtfs/install_pathways.sql
.read public/extensions/gtfs/procedures/install.sql
```

See [public/extensions/gtfs/README.md](/Users/gh/Projects/personal_project/gtfs-viz/public/extensions/gtfs/README.md) for details.
