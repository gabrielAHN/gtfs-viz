import * as duckdb from "@duckdb/duckdb-wasm"
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"

export const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
}

export type DuckDBInstance = {
  conn: Awaited<ReturnType<duckdb.AsyncDuckDB["connect"]>>
  db: duckdb.AsyncDuckDB
  opfs: boolean
}

const SESSION_FILE_KEY = "duckdb_session_file"
const FILE_PREFIX = "gtfs-viz-"
const FILE_SUFFIX = ".duckdb"
const SESSIONS_KEY = "gtfs-viz.sessions"
const HEARTBEAT_MS = 5_000
const STALE_AFTER_MS = 30_000
const OPFS_FILE_RX = /^gtfs-viz.*\.duckdb$/

let instancePromise: Promise<DuckDBInstance> | null = null

let storageMode: "opfs" | "memory" | "unknown" = "unknown"
export const getStorageMode = () => storageMode

export const isOpfsLockError = (error: unknown): boolean =>
  /access handle|NoModificationAllowedError|another open/i.test(
    String((error as { message?: string } | null)?.message ?? error ?? ""),
  )

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const newSessionFileName = () =>
  `${FILE_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${FILE_SUFFIX}`

const readSessionFile = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_FILE_KEY)
  } catch {
    return null
  }
}
const writeSessionFile = (name: string | null) => {
  try {
    if (name) sessionStorage.setItem(SESSION_FILE_KEY, name)
    else sessionStorage.removeItem(SESSION_FILE_KEY)
  } catch {}
}

type Sessions = Record<string, number>
const readSessions = (): Sessions => {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}") as Sessions
  } catch {
    return {}
  }
}
const writeSessions = (sessions: Sessions) => {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch {}
}
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let heartbeatFile: string | null = null
const beat = () => {
  if (!heartbeatFile) return
  const sessions = readSessions()
  sessions[heartbeatFile] = Date.now()
  writeSessions(sessions)
}
const startHeartbeat = (name: string) => {
  stopHeartbeat()
  heartbeatFile = name
  beat()
  heartbeatTimer = setInterval(beat, HEARTBEAT_MS)
}
const stopHeartbeat = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
  if (heartbeatFile) {
    const sessions = readSessions()
    delete sessions[heartbeatFile]
    writeSessions(sessions)
  }
  heartbeatFile = null
}

const getOpfsRoot = async (): Promise<any | null> => {
  try {
    const storage = (navigator as unknown as { storage?: { getDirectory?: () => Promise<any> } })
      .storage
    return (await storage?.getDirectory?.()) ?? null
  } catch {
    return null
  }
}

const removeFileAndWal = async (root: any, name: string): Promise<boolean> => {
  try {
    await root.removeEntry(name)
  } catch {
    return false
  }
  try {
    await root.removeEntry(`${name}.wal`)
  } catch {}
  return true
}

const fileExists = async (root: any, name: string): Promise<boolean> => {
  try {
    await root.getFileHandle(name)
    return true
  } catch {
    return false
  }
}

export async function cleanupOrphanDatabases(current: string | null): Promise<void> {
  try {
    const root = await getOpfsRoot()
    if (!root) return
    const sessions = readSessions()
    const now = Date.now()
    const names: string[] = []
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === "file") names.push(name)
    }
    const mains = new Set(names.filter((n) => OPFS_FILE_RX.test(n)))
    for (const name of mains) {
      if (name === current) continue
      const lastBeat = sessions[name]
      if (lastBeat && now - lastBeat < STALE_AFTER_MS) continue
      if (await removeFileAndWal(root, name)) {
        delete sessions[name]
      }
    }
    for (const name of names) {
      if (!name.endsWith(".wal")) continue
      const main = name.slice(0, -4)
      if (OPFS_FILE_RX.test(main) && !(await fileExists(root, main))) {
        try {
          await root.removeEntry(name)
        } catch {}
      }
    }
    writeSessions(sessions)
  } catch {}
}

const openOpfsFile = (db: duckdb.AsyncDuckDB, name: string) =>
  db.open({
    path: `opfs://${name}`,
    accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
  })

async function openSessionDatabase(
  db: duckdb.AsyncDuckDB,
  allowReuse: boolean,
): Promise<string | null> {
  if (!(await getOpfsRoot())) return null

  const reused = allowReuse ? readSessionFile() : null
  if (!allowReuse) writeSessionFile(null)
  if (reused) {
    const delaysMs = [400, 400, 800, 1200]
    let lastError: unknown = null
    for (const delay of delaysMs) {
      await sleep(delay)
      try {
        await openOpfsFile(db, reused)
        return reused
      } catch (error) {
        lastError = error
      }
    }
    if (!isOpfsLockError(lastError)) {
      const root = await getOpfsRoot()
      if (root) await removeFileAndWal(root, reused)
    }
  }

  const fresh = newSessionFileName()
  writeSessionFile(fresh)
  for (const delay of [0, 300, 900]) {
    if (delay) await sleep(delay)
    try {
      await openOpfsFile(db, fresh)
      return fresh
    } catch {}
  }
  writeSessionFile(null)
  return null
}

const probeWritable = async (conn: Awaited<ReturnType<duckdb.AsyncDuckDB["connect"]>>) => {
  try {
    await conn.query(`CREATE OR REPLACE TABLE __gtfs_viz_write_probe AS SELECT 1 AS ok;`)
    await conn.query(`DROP TABLE __gtfs_viz_write_probe;`)
    return true
  } catch {
    return false
  }
}

async function spawnInstance(bundle: duckdb.DuckDBBundle, allowReuse: boolean) {
  const worker = new Worker(bundle.mainWorker!)

  worker.addEventListener("error", (event) => {
    const message = event.message || ""
    if (
      message.includes("onager") ||
      message.includes("Extension") ||
      message.includes("DB manager") ||
      message.includes("does not exist") ||
      message.includes("Catalog Error")
    ) {
      event.preventDefault()
      event.stopPropagation()
    }
  })

  const logger = new duckdb.VoidLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  const sessionFile = await openSessionDatabase(db, allowReuse)
  const conn = await db.connect()
  return { db, conn, sessionFile }
}

async function createDuckDB(): Promise<DuckDBInstance> {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)

  let inst = await spawnInstance(bundle, true)
  if (inst.sessionFile && readSessionFile() === inst.sessionFile) {
    for (let attempt = 0; attempt < 3 && !(await probeWritable(inst.conn)); attempt++) {
      try {
        await inst.conn.close()
      } catch {}
      try {
        await inst.db.terminate()
      } catch {}
      await sleep(600 * (attempt + 1))
      inst = await spawnInstance(bundle, attempt < 2)
    }
  }
  const { db, conn, sessionFile } = inst

  const opfs = sessionFile !== null
  storageMode = opfs ? "opfs" : "memory"
  if (sessionFile) {
    startHeartbeat(sessionFile)
    setTimeout(() => void cleanupOrphanDatabases(sessionFile), 2_000)
  }

  await conn.query(`SET threads = 1;`)
  await conn.query(`SET memory_limit = '1600MB';`)
  await conn.query(`SET preserve_insertion_order = false;`)

  try {
    await conn.query(`SET autoinstall_known_extensions = true;`)
    await conn.query(`SET autoload_known_extensions = true;`)
    await conn.query(`LOAD spatial;`)
  } catch {}
  await conn.query(`SET autoinstall_known_extensions = false;`)
  await conn.query(`SET autoload_known_extensions = false;`)

  return { conn, db, opfs }
}

function DuckDB(): Promise<DuckDBInstance> {
  instancePromise ??= createDuckDB().catch((error) => {
    instancePromise = null
    throw error
  })
  return instancePromise
}

export async function disposeDuckDB(): Promise<void> {
  const pending = instancePromise
  instancePromise = null
  storageMode = "unknown"
  stopHeartbeat()
  if (!pending) return
  try {
    const { conn, db } = await pending
    try {
      await conn.close()
    } catch {}
    try {
      await db.terminate()
    } catch {}
  } catch {}
}

export async function deleteSessionDatabase(): Promise<boolean> {
  const name = readSessionFile()
  writeSessionFile(null)
  if (!name) return true
  const root = await getOpfsRoot()
  if (!root) return true
  for (const delay of [0, 200, 400, 800, 1200, 1600, 2000]) {
    if (delay) await sleep(delay)
    if (!(await fileExists(root, name))) {
      try {
        await root.removeEntry(`${name}.wal`)
      } catch {}
      return true
    }
    if (await removeFileAndWal(root, name)) return true
  }
  return !(await fileExists(root, name))
}

export default DuckDB
