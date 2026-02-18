

export const loadProcedure = async (conn: any, path: string): Promise<void> => {
  const response = await fetch(`/extensions/gtfs/procedures/${path}.sql`);
  if (!response.ok) {
    throw new Error(`Failed to load procedure: ${path} - HTTP ${response.status}`);
  }
  const sql = await response.text();

  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => {
      
      if (!stmt || stmt.length === 0) return false;
      
      const lines = stmt.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });
      return lines.length > 0;
    });

  for (const statement of statements) {
    await conn.query(statement);
  }
};

export const createStationsTable = async (conn: any): Promise<void> => {
  await loadProcedure(conn, 'tables/create_stations_table');
};

export const createStopsTable = async (conn: any): Promise<void> => {
  await loadProcedure(conn, 'tables/create_stops_table');
};

export const createEditStopTable = async (conn: any): Promise<void> => {
  await loadProcedure(conn, 'tables/create_edit_stop_table');
};

export const createStopsView = async (conn: any): Promise<void> => {
  await loadProcedure(conn, 'tables/create_stops_view');

  const { BASIC_QUERY_MACROS } = await import('./gtfs-ingestion/queries');
  await conn.query(BASIC_QUERY_MACROS);
};

export const reloadQueryMacros = async (conn: any): Promise<void> => {
  const { BASIC_QUERY_MACROS, PATHWAY_QUERY_MACROS } = await import('./gtfs-ingestion/queries');
  await conn.query(BASIC_QUERY_MACROS);

  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'pathway_network'
    `);
    const count = result.toArray()[0]?.count || 0;
    if (Number(count) > 0) {
      await conn.query(PATHWAY_QUERY_MACROS);
    }
  } catch (error) {
    console.warn('Could not check for pathway_network view:', error);
  }
};

export const recreateStopsView = async (conn: any): Promise<void> => {
  const { CREATE_STOPS_VIEW } = await import('./gtfs-ingestion/procedures');

  await conn.query('DROP VIEW IF EXISTS StopsView');

  await conn.query(CREATE_STOPS_VIEW);

  const { BASIC_QUERY_MACROS } = await import('./gtfs-ingestion/queries');
  await conn.query(BASIC_QUERY_MACROS);
};
