"""Native DuckDB corridor regressions. Run: python3 -m unittest discover -s packages/duckdb-extension/tests -v
Requires the duckdb CLI and its installed spatial extension (no Python dependencies).
"""
import json
import math
import os
import pathlib
import subprocess
import unittest

HEADER = pathlib.Path(__file__).resolve().parents[1] / 'src/include/gtfs_sql.hpp'


def query(points, select, spacing=16):
    source = HEADER.read_text()
    sql = source[source.index('CREATE TABLE IF NOT EXISTS RouteShapeLanesTable'):source.index('CREATE OR REPLACE MACRO prepare_route_shape_lanes_rail')]
    rows = []
    for route, coordinates in points.items():
        for i, (x, y) in enumerate(coordinates):
            rows.append(f"('{route}','{route}',{i},{y / 111320.0},{x / 111320.0})")
    setup = f"SET home_directory='{pathlib.Path.home()}'; " + """LOAD spatial;
CREATE TABLE input(route_id VARCHAR, shape_id VARCHAR, shape_pt_sequence DOUBLE, shape_pt_lat DOUBLE, shape_pt_lon DOUBLE);
INSERT INTO input VALUES """ + ','.join(rows) + """;
CREATE VIEW shapes AS SELECT * EXCLUDE(route_id) FROM input;
CREATE VIEW TripsView AS SELECT DISTINCT route_id, route_id || shape_id AS trip_id, shape_id FROM input;
CREATE VIEW RoutesView AS SELECT DISTINCT route_id, 3 AS route_type, route_id AS route_name, '000000' AS route_color_hex, 'ffffff' AS route_text_color_hex FROM input;
"""
    ids = '[' + ','.join("'" + r + "'" for r in points) + ']'
    result = subprocess.run(['duckdb', '-json', ':memory:'], input=setup + sql + f'\nINSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes({ids}, simplify_meters := 0.0);\n' + select, text=True, capture_output=True, env={**os.environ, 'HOME': str(pathlib.Path.home())})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


class CorridorLanesTest(unittest.TestCase):
    def test_same_corridor_curve_does_not_swap_lanes(self):
        # A gentle real curve crosses the old compass tie-break seam (atan(.37)).
        # Two identical GTFS shapes MUST remain one lane apart everywhere.
        arc = [(1000 * math.sin(t / 100), 1000 * (1 - math.cos(t / 100))) for t in range(0, 81, 2)]
        rows = query({'A': arc, 'B': arc}, "SELECT route_id, min(slot_s) lo, max(slot_s) hi FROM RouteShapeLanesTable GROUP BY route_id ORDER BY route_id;")
        for row in rows:
            self.assertAlmostEqual(row['lo'], row['hi'], places=6, msg=str(rows))
        self.assertAlmostEqual(abs(rows[0]['lo'] - rows[1]['lo']), 1.0, places=6)


if __name__ == '__main__':
    unittest.main()
