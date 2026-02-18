# GTFS Viz 🚉

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)

Browser-based GTFS visualization and editing tool. Process transit data entirely in your browser using DuckDB WASM.

## What is GTFS Viz?

GTFS Viz enables transit agencies, developers, and transit enthusiasts to visualize, analyze, and edit GTFS files without backend servers. All data processing happens client-side for privacy and speed.

### Key Features

**Data Management**
- Upload GTFS zip files or load example datasets
- Process large datasets entirely in-browser with DuckDB WASM
- Export edited stops and stations back to GTFS format

**Stations & Stops**
- View in both table and interactive map formats
- See station entrances, exits, platforms, and pathways
- Add, edit, and delete stations and their components
- Upgrade stops to stations or downgrade stations to stops

**Pathways & Navigation**
- Visualize pathway connections within stations
- Calculate routes between different points
- Identify accessible routes and barriers

## Installation

```bash
yarn
yarn dev
```

App runs at `http://localhost:5173`

## Deployment

Deploy to Railway with one click:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)

### How Deployment Works

1. **Build**: Railway runs `yarn install` and `yarn build`
2. **Deploy**: Caddy serves static files from `/app/dist`
3. **Serve**: App available at your Railway URL

Configuration:
- `railpack.json`: Build steps and Caddy deployment
- `Caddyfile`: Static file server with caching and security headers

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## Tech Stack

- **DuckDB WASM**: In-browser SQL database
- **TanStack Router**: Type-safe routing
- **TanStack Query**: Data fetching and caching
- **Deck.gl**: WebGL-powered map visualization
- **Shadcn UI**: Component library

## Performance

- Dedicated GPU recommended for large datasets
- DuckDB caches data in IndexedDB for faster subsequent loads
- Large GTFS files (>100MB) may take longer on initial load
