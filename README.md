# GTFS Viz 🚉

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)

### Description
The GTFS Viz project that visulizes the at scale vislizes GTFS files. For now mainly to visulize Station information specifically pathways data in detail.

Main feature is is completelly browser based using [Duckdb Wasm](https://duckdb.org/docs/api/wasm/overview) to process the gtfs data at scale in the browser without a backend.

Feel free to contribute to the project by making a PR or opening an issue.

![GTFS Viz](https://github.com/gabrielAHN/gtfs-viz/blob/main/images/gtfs-viz.gif?raw=true)


> **Requirements:** Need newer browsers and good GPU computer to run.

### Running Locally
```
yarn
yarn dev
```

#### Features
- [x] View Stations in Table and Map
- [x] See Details like Station Pathways and Exit Counts
- [x] Add and Edit Station(s)
- [x] Add and Edit Station parts like exits, pathways,and 
- [x] Export Edited Stops File

### Coming Soon
- [ ] Station Pathway Editing
- [ ] GTFS routes Viz 📈

### Stack
Data Processing ⚙️⚙️
- [DuckDB](https://duckdb.org/)


Style 🎨
- [Tailwindcss](https://tailwindcss.com/)
- [Shadcn](https://ui.shadcn.com/)
- [Vite](https://vitejs.dev/)

