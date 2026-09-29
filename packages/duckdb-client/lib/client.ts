export interface SqlExecutor {
  query(sql: string): Promise<unknown>;
}

export interface ExtensionClientOptions {
  repository?: string;
}

function repositoryLiteral(repository: string): string {
  const invalid = () => new TypeError('repository must be an explicit HTTP(S) URL without credentials, whitespace, backslashes, query, or fragment');
  if (typeof repository !== 'string' || /[\s\\\u0000-\u001f\u007f?#]/u.test(repository) || !/^https?:\/\//.test(repository)) throw invalid();
  let url: URL;
  try { url = new URL(repository); } catch { throw invalid(); }
  if (!url.hostname || url.username || url.password) throw invalid();
  return `'${repository.replaceAll("'", "''")}'`;
}

export function createExtensionClient(executor: SqlExecutor, options: ExtensionClientOptions) {
  const repository = options?.repository === undefined ? undefined : repositoryLiteral(options.repository);
  const run = async (operation: string, sql: string, guidance: string): Promise<void> => {
    try {
      await executor.query(sql);
    } catch (cause) {
      throw new Error(`gtfs ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}. ${guidance}`, { cause });
    }
  };
  return {
    install: () => { if (repository === undefined) throw new Error('Configure GTFS_EXTENSION_REPOSITORY (CLI) or VITE_GTFS_EXTENSION_REPOSITORY (web) with a matching signed gtfs repository. No public distribution or fallback is available.'); return run('install', `INSTALL gtfs FROM ${repository}`, 'Check repository reachability, browser CORS, and the artifact for this DuckDB version/platform. No fallback was attempted.'); },
    load: () => run('load', 'LOAD gtfs', 'Configure GTFS_EXTENSION_REPOSITORY (CLI) or VITE_GTFS_EXTENSION_REPOSITORY (web), or install a compatible gtfs artifact first. Verify its signature. Signature policy was not changed; no fallback was attempted.'),
    prepare: () => run('prepare', 'PRAGMA gtfs_prepare', 'Await load() on this database before preparing edit tables.'),
    init: () => run('init', 'PRAGMA gtfs_init', 'Await load(), prepare(), and normalized source-table import before initializing.'),
    refresh: () => run('refresh', 'PRAGMA gtfs_refresh', 'Await load() and initialize the dataset before refreshing.'),
    importDirectory: (directory: string) => run('import', `PRAGMA gtfs_import('${directory.replaceAll("'", "''")}')`, 'Await load() first and make stops.txt readable in the given directory. No fallback was attempted.'),
  };
}
