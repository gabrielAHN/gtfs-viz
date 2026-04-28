import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

export const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

async function DuckDB() {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

  const worker = new Worker(bundle.mainWorker!);

  worker.addEventListener('error', (event) => {
    const message = event.message || '';
    if (message.includes('onager') ||
        message.includes('Extension') ||
        message.includes('DB manager') ||
        message.includes('does not exist') ||
        message.includes('Catalog Error')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  const logger = new duckdb.VoidLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const conn = await db.connect();

  await conn.query(`SET autoinstall_known_extensions = false;`);
  await conn.query(`SET autoload_known_extensions = false;`);

  return { conn, db };
}
export default DuckDB;
