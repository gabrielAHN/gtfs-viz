export interface SqlExecutor {
  query(sql: string): Promise<unknown>;
}

export interface ExtensionClientOptions {
  repository?: string;
}

const COMMUNITY_NOTE = 'Community builds of gtfs need a DuckDB v2.0.0 CLI; set GTFS_EXTENSION_REPOSITORY (CLI) or VITE_GTFS_EXTENSION_REPOSITORY (web) to use another repository.';
const ORIGIN_NOTE = 'gtfs is already installed from a different repository. Run duckdb -c "FORCE INSTALL gtfs FROM community" to switch to the community build, or set GTFS_EXTENSION_REPOSITORY to the original repository. FORCE INSTALL is never run automatically.';

function repositoryLiteral(repository: string): string {
  // The DuckDB community repository is named by its keyword, never as a string literal.
  if (repository === 'community') return 'community';
  const invalid = () => new TypeError('repository must be an explicit HTTP(S) URL without credentials, whitespace, backslashes, query, or fragment, or exactly "community"');
  if (typeof repository !== 'string' || /[\s\\\u0000-\u001f\u007f?#]/u.test(repository) || !/^https?:\/\//.test(repository)) throw invalid();
  let url: URL;
  try { url = new URL(repository); } catch { throw invalid(); }
  if (!url.hostname || url.username || url.password) throw invalid();
  return `'${repository.replaceAll("'", "''")}'`;
}

const installGuidance = (message: string) => /origin is different/i.test(message)
  ? ORIGIN_NOTE
  : `Check repository reachability, browser CORS, and the artifact for this DuckDB version/platform. ${COMMUNITY_NOTE} No fallback was attempted.`;

export function createExtensionClient(executor: SqlExecutor, options: ExtensionClientOptions) {
  const repository = options?.repository === undefined ? undefined : repositoryLiteral(options.repository);
  const run = async (operation: string, sql: string, guidance: string | ((message: string) => string)): Promise<void> => {
    try {
      await executor.query(sql);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`gtfs ${operation} failed: ${message}. ${typeof guidance === 'function' ? guidance(message) : guidance}`, { cause });
    }
  };
  return {
    install: () => { if (repository === undefined) throw new Error('Configure GTFS_EXTENSION_REPOSITORY (CLI) or VITE_GTFS_EXTENSION_REPOSITORY (web) with a gtfs repository URL, or with "community" for the DuckDB community repository (needs DuckDB v2.0.0).'); return run('install', `INSTALL gtfs FROM ${repository}`, installGuidance); },
    load: () => run('load', 'LOAD gtfs', 'Configure GTFS_EXTENSION_REPOSITORY (CLI) or VITE_GTFS_EXTENSION_REPOSITORY (web), or install a compatible gtfs artifact first. Verify its signature. Signature policy was not changed; no fallback was attempted.'),
    prepare: () => run('prepare', 'PRAGMA gtfs_prepare', 'Await load() on this database before preparing edit tables.'),
    init: () => run('init', 'PRAGMA gtfs_init', 'Await load(), prepare(), and normalized source-table import before initializing.'),
    refresh: () => run('refresh', 'PRAGMA gtfs_refresh', 'Await load() and initialize the dataset before refreshing.'),
    importDirectory: (directory: string) => run('import', `PRAGMA gtfs_import('${directory.replaceAll("'", "''")}')`, 'Await load() first and make stops.txt readable in the given directory. No fallback was attempted.'),
  };
}
