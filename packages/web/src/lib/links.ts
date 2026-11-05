// The gtfs-tools CLI serves this app as its dashboard from a local daemon that answers every page
// path with the app, so a relative /docs/ link would open the dashboard again. Links therefore go
// to the public docs site. Builds that serve the docs next to the app set VITE_GTFS_DOCS_URL=/docs/
// (yarn build:deploy and yarn dev); yarn build:dashboard unsets it.
export const PUBLIC_DOCS_URL = "https://gtfs-viz-production-f1a4.up.railway.app/docs/"

export const DOCS_URL = (import.meta.env.VITE_GTFS_DOCS_URL || PUBLIC_DOCS_URL).replace(/\/?$/, "/")

// Full imports go to the gtfs-tools CLI (gabrielAHN/gtfs-tools); its page stays in these docs.
export const CLI_DOCS_URL = `${DOCS_URL}gtfs-tools/cli/`
