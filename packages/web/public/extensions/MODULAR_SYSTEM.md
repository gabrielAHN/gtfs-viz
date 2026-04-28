# GTFS SQL Layout

The modular SQL files now live under one extension root:

```text
public/extensions/gtfs/
```

## Procedure folders

```text
public/extensions/gtfs/procedures/
├── install.sql
├── ingestion/
├── pathfinding/
├── queries/
├── tables/
└── utils/
```

## Load order

For full setup:

```sql
.read public/extensions/gtfs/install_all.sql
```

For partial setup:

```sql
.read public/extensions/gtfs/install.sql
.read public/extensions/gtfs/install_pathways.sql
.read public/extensions/gtfs/procedures/install.sql
```

## Runtime note

The app’s procedure loader resolves files from `/extensions/gtfs/procedures/...`, so keeping GTFS as the only procedure tree avoids drift between documented SQL files and the runtime fetch path.
