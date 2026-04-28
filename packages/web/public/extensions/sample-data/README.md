# Sample GTFS Data

Place your GTFS zip files in this directory to use them with the import procedures.

## Recommended GTFS Datasets with Pathways

### 1. NYC MTA Subway (Comprehensive)
- **URL**: https://transitfeeds.com/p/mta/79
- **File**: `google_transit.zip`
- **Notes**: Extensive pathway network including accessibility data

### 2. BART (San Francisco Bay Area)
- **URL**: http://www.bart.gov/schedules/developers/gtfs
- **File**: `google_transit.zip`
- **Notes**: Clean pathway data for Bay Area stations

### 3. Washington DC Metro (WMATA)
- **URL**: https://developer.wmata.com/
- **File**: `gtfs.zip`
- **Notes**: Good example of elevator and escalator pathways

### 4. London Underground
- **URL**: https://tfl.gov.uk/info-for/open-data-users/
- **File**: `tfl-gtfs.zip`
- **Notes**: Complex multi-level stations

## Usage

1. Download a GTFS zip file from one of the above sources
2. Place it in this directory (e.g., `public/extensions/sample-data/google_transit.zip`)
3. Use the import procedures to load it into DuckDB

### From DuckDB CLI:

```sql
-- Load import procedures
.read procedures/ingestion/import_gtfs.sql
.read procedures/ingestion/reformat_tables.sql

-- Import and reformat from local zip file
SELECT setup_gtfs_from_zip('public/extensions/sample-data/google_transit.zip');

-- Or from any path
SELECT setup_gtfs_from_zip('/path/to/your/gtfs.zip');
```

### From the App:

The app can use these procedures to load sample data:

```typescript
// Load and import sample GTFS data
await conn.query(".read /extensions/procedures/ingestion/import_gtfs.sql");
await conn.query(".read /extensions/procedures/ingestion/reformat_tables.sql");
await conn.query("SELECT setup_gtfs_from_zip('/extensions/sample-data/google_transit.zip')");
```

## File Structure

Your GTFS zip file should contain these files:
- `stops.txt` (required)
- `pathways.txt` (required for pathway visualization)
- `routes.txt` (optional)
- `trips.txt` (optional)
- `stop_times.txt` (optional)
- `agency.txt` (optional)

## Testing Your Data

After importing, verify the data:

```sql
-- Check stops
SELECT location_type_name, COUNT(*)
FROM stops
GROUP BY location_type_name;

-- Check pathways
SELECT pathway_mode_name, direction_type, COUNT(*)
FROM pathways
GROUP BY pathway_mode_name, direction_type;

-- Find stations with pathways
SELECT stop_id, stop_name, COUNT(pathway_id) as pathway_count
FROM stops s
LEFT JOIN pathways p ON s.stop_id = p.from_stop_id
WHERE s.location_type = 1
GROUP BY s.stop_id, s.stop_name
HAVING pathway_count > 0
ORDER BY pathway_count DESC
LIMIT 10;
```
