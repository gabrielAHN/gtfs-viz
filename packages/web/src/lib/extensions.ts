import {
  installExtension,
  installMacros,
  installInit,
  reinstallMacros as legacyReinstall,
  recreateStopsView as legacyStops,
  recreatePathwaysView as legacyPathways,
} from "@gtfs-viz/duckdb-extension"
import { createExtensionClient } from "@gtfs-viz/duckdb-extension/client"

export const getExtensionRepository = (conn: any): string | undefined =>
  conn.__gtfsVizCliNative
    ? conn.extensionRepository
    : import.meta.env.VITE_GTFS_EXTENSION_REPOSITORY

const connections = new WeakMap<object, Promise<ReturnType<typeof createExtensionClient>>>()

export async function downloaded(conn: any) {
  const repository = getExtensionRepository(conn)
  if (repository === undefined) return undefined
  let pending = connections.get(conn)
  if (!pending) {
    pending = (async () => {
      const client = createExtensionClient(conn, { repository })
      await client.install()
      await client.load()
      return client
    })()
    connections.set(conn, pending)
  }
  return pending
}

const execute = (conn: any) => async (sql: string) => {
  await conn.query(sql)
}

export const installGtfsExtension = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) {
    await client.prepare()
    await client.init()
  } else await installExtension(execute(conn))
}

export const reinstallMacros = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  const res = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = 'stops'",
  )
  if (Number(res.toArray()[0]?.n ?? 0) === 0) return
  if (client) await client.refresh()
  else await legacyReinstall(execute(conn))
}

export const installEnumsAndEditTables = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.prepare()
  else await installMacros(execute(conn))
}

export const createStationsTable = async (conn: any): Promise<void> => {
  await downloaded(conn)
  await conn.query(
    "CREATE OR REPLACE TABLE StationsTable AS SELECT * FROM get_stations_table_data()",
  )
}

export const createStopsTable = async (conn: any): Promise<void> => {
  await downloaded(conn)
  await conn.query("CREATE OR REPLACE TABLE StopsTable AS SELECT * FROM get_stops_table_data()")
}

export const createEditStopTable = installEnumsAndEditTables
export const createEditPathwayTable = installEnumsAndEditTables
export const createEditRouteTable = installEnumsAndEditTables

export const refreshRoutesTables = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.refresh()
  else await installInit(execute(conn))
}

export const createStopsView = async (conn: any): Promise<void> => {
  await downloaded(conn)
  await conn.query("ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id VARCHAR")
  await refreshRoutesTables(conn)
}

export const createPathwaysView = refreshRoutesTables
export const loadPathwayQueryProcedures = async (_conn: any): Promise<void> => {}
export const recreatePathwayNetwork = refreshRoutesTables

export const reloadQueryMacros = async (conn: any): Promise<void> => {
  await downloaded(conn)
  const result = await conn.query(
    "SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'pathway_network'",
  )
  if (Number(result.toArray()[0]?.count || 0) > 0) await refreshRoutesTables(conn)
}

export const recreateStopsView = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.refresh()
  else await legacyStops(execute(conn))
}

export const recreatePathwaysView = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.refresh()
  else await legacyPathways(execute(conn))
}

export const installEnums = installEnumsAndEditTables
