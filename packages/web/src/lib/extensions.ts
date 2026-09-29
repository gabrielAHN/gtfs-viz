import { createExtensionClient } from "@gtfs-viz/duckdb-client/client"

const webRepository = (repository: string | undefined) =>
  repository && repository.startsWith("/") && typeof location !== "undefined"
    ? `${location.origin}${repository.replace(/\/$/, "")}`
    : repository

export const getExtensionRepository = (conn: any): string | undefined =>
  conn.__gtfsVizCliNative
    ? conn.extensionRepository
    : webRepository(import.meta.env.VITE_GTFS_EXTENSION_REPOSITORY)

const connections = new WeakMap<object, Promise<ReturnType<typeof createExtensionClient>>>()

export async function downloaded(conn: any) {
  const repository = getExtensionRepository(conn)
  let pending = connections.get(conn)
  if (!pending) {
    pending = (async () => {
      const client = createExtensionClient(conn, { repository })
      if (repository !== undefined) await client.install()
      await client.load()
      return client
    })()
    connections.set(conn, pending)
  }
  return pending
}

export const installGtfsExtension = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) {
    await client.prepare()
    await client.init()
  }
}

export const reinstallMacros = async (conn: any): Promise<void> => {
  await downloaded(conn)
}

export const installEnumsAndEditTables = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.prepare()
}

export const createStationsTable = async (conn: any): Promise<void> => {
  await downloaded(conn)
  await conn.query("PRAGMA gtfs_refresh")
}

export const createStopsTable = async (conn: any): Promise<void> => {
  await downloaded(conn)
  await conn.query("PRAGMA gtfs_refresh")
}

export const createEditStopTable = installEnumsAndEditTables
export const createEditPathwayTable = installEnumsAndEditTables
export const createEditRouteTable = installEnumsAndEditTables

export const refreshRoutesTables = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.refresh()
}

export const createStopsView = async (conn: any): Promise<void> => {
  await downloaded(conn)
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
}

export const recreatePathwaysView = async (conn: any): Promise<void> => {
  const client = await downloaded(conn)
  if (client) await client.refresh()
}

export const installEnums = installEnumsAndEditTables
