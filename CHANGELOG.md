# Changelog

All notable changes to GTFS Viz will be documented in this file.

## [2.2.0] - 2024-02-16

### Added
- **Station/Stop Type Management**
  - Upgrade stops to stations with type validation
  - Downgrade stations to stops with automatic child handling
  - Coordinate validation (lat/lon required for all operations)
  - Parent-child management (automatically detach children during downgrade)
  - Auto-navigation after upgrade/downgrade operations

- **Enhanced Export System**
  - Visual change indicators (🆕 New, 🗑️ Deleted, 🔻 Downgraded, 🔗 Detached)
  - Inline original value comparison when clicking rows
  - Detect station downgrades with affected parts count
  - Show detached parts when parent station is downgraded
  - Parent station column added to export table
  - Navigate from export to source item in map/table view
  - Highlight changed fields in yellow for easy comparison

- **Stops Route Filtering**
  - Filter stops route to only show "Stop" and "Unknown/Null" types
  - Exclude stations, platforms, and entrances from stops view
  - Consistent filtering across all dropdowns and data views

- **Form UX Improvements**
  - Disable all form inputs during async operations
  - Visual feedback during mutations
  - Prevent user input conflicts during data modifications

### Fixed
- **GTFS Import Errors**
  - Handle CSV files missing optional columns (parent_station, location_type, wheelchair_boarding)
  - Add ALTER TABLE statements to create missing columns with defaults
  - Restructure SQL with CTE pattern to avoid column reference errors
  - Validate CSV structure before import

- **Data Integrity**
  - NOT NULL constraint errors by validating coordinates before operations
  - Parent station handling during downgrades (set to null)
  - Proper status tracking for all edit operations

### Changed
- **Code Quality**
  - Removed comments from 184 files across codebase
  - Self-documenting code with clear naming
  - Kept only essential keywords (IMPORTANT, WARNING, NOTE) in lib/extensions

- **Infrastructure**
  - Migrated to TanStack Router for type-safe routing
  - Reorganized hooks from src/hooks/DuckdbCalls to src/lib/duckdb
  - Updated build configuration (Vite, TypeScript)
  - Simplified Railway deployment (consolidated into railpack.json)
  - Added health check endpoint (/health) with 100s timeout
  - Added restart policy (ON_FAILURE, max 3 retries)

- **Documentation**
  - Updated README with project description and features
  - Added tech stack documentation
  - Created streamlined DEPLOYMENT.md (65 lines)
  - Added deployment workflow explanation

### Deployment
- Railway deployment simplified with single railpack.json configuration
- Health checks enabled for monitoring
- Asset optimization with long-term caching
- Security headers configured (XSS, clickjacking protection)
- Gzip compression enabled

## [2.1.0] - 2024-01-15

### Added
- GitHub funding configuration
- Community support setup for open source contributions
- Sponsorship options enabled

## [2.0.0] - 2023-12-01

### Added
- Complete application rewrite with modern stack
- Browser-based GTFS file processing with DuckDB WASM
- Interactive map visualization with Deck.gl
- Dual view (table and map) for stations and stops
- Station component management (entrances, exits, platforms, pathways)
- Pathway visualization and pathfinding
- Edit stations and stops with form interface
- Export edited data back to GTFS format

### Technology Stack
- React + TypeScript
- DuckDB WASM for in-browser SQL database
- Deck.gl for WebGL-powered mapping
- TanStack Query for data management
- Shadcn UI components

## [1.0.0] - 2023-06-01

### Added
- Initial release of GTFS Viz
- Basic GTFS visualization features
