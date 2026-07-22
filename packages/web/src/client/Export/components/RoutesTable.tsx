import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PathLayer } from "@deck.gl/layers";
import { useDuckDB } from "@/context/duckdb.client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { BiInfoCircle, BiGitCompare } from "react-icons/bi";
import { safeHexToRgb } from "@/components/colorUtil";

import { fetchTableData } from "@/lib/duckdb/DataFetching/fetchGTFSData";
import { fetchOriginalRows, fetchOriginalRouteShapes } from "@/lib/duckdb/DataFetching/fetchExportData";
import { mutationExportFn } from "@/lib/duckdb/DataEditing/editingFn";
import { refreshRoutesTables } from "@/lib/extensions";
import { parseRouteLineValue } from "@/components/forms/RouteLineInput/routeLine";
import MapContainer from "@/components/maps/MapContainer";
import DeckglMap from "@/components/maps/DeckglMap.lazy";
import { fitBoundsToPoints, DEFAULT_BOUNDS } from "@/functions/mapComponent/fitBounds";

import EditeTables from "./TableComponent";

const DEFAULT_VIEW = { longitude: 0, latitude: 0, zoom: 2, pitch: 0, bearing: 0 };

function ShapeMiniMap({
  points,
  color,
  label,
  conn,
}: {
  points: { lat: number; lon: number }[];
  color: number[];
  label: string;
  conn: any;
}) {
  const [viewState, setViewState] = useState<any>(DEFAULT_VIEW);

  useEffect(() => {
    if (!conn || points.length === 0) return;
    let cancelled = false;
    fitBoundsToPoints(conn, points).then((fit) => {
      if (!cancelled && fit) setViewState(fit.viewState);
    });
    return () => { cancelled = true; };
  }, [conn, points]);

  const layers = useMemo(() => {
    if (points.length < 2) return [];
    return [
      new PathLayer({
        id: `shape-compare-${label}`,
        data: [{ path: points.map((p) => [p.lon, p.lat]) }],
        getPath: (d: any) => d.path,
        getColor: color,
        getWidth: 4,
        widthUnits: "pixels" as const,
        capRounded: true,
        jointRounded: true,
        pickable: false,
      }),
    ];
  }, [points, color, label]);

  const [boundBox, setBoundBox] = useState<any>(DEFAULT_BOUNDS);

  useEffect(() => {
    if (!conn || points.length === 0) return;
    let cancelled = false;
    fitBoundsToPoints(conn, points).then((fit) => {
      if (!cancelled && fit) setBoundBox(fit.boundBox);
    });
    return () => { cancelled = true; };
  }, [conn, points]);

  if (points.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="h-40 w-full rounded-md border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          No shape data
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label} ({points.length} points)
      </span>
      <div className="h-40 w-full overflow-hidden rounded-md border">
        <MapContainer instructionText="">
          <DeckglMap
            MinZoom={2}
            dragRotate={false}
            maxPitch={0}
            MapLayers={layers}
            BoundBox={boundBox}
            viewState={viewState}
            setViewState={setViewState}
            setClickInfo={() => {}}
            setHoverInfo={() => {}}
          />
        </MapContainer>
      </div>
    </div>
  );
}

const RoutesTable = ({ FileTypes, setFileTypes }: any) => {
  const duckDB = useDuckDB();
  const conn = duckDB?.conn;
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [clickInfo, setClickInfo] = useState<any>();
  const [originalDataMap, setOriginalDataMap] = useState<Record<string, any>>({});
  const [originalShapeMap, setOriginalShapeMap] = useState<Record<string, { lat: number; lon: number }[]>>({});
  const [showCompare, setShowCompare] = useState(false);
  const queryClient = useQueryClient();

  const { data: tableData = [], isLoading, isError, error } = useQuery({
    queryKey: ["EditRouteTable"],
    queryFn: () => fetchTableData({ conn, table: "EditRouteTable" }),
    enabled: !!conn,
  });

  useEffect(() => {
    async function fetchOriginalData() {
      if (!conn || !tableData || tableData.length === 0) {
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
        setOriginalShapeMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
        return;
      }

      const editedItems = tableData.filter(
        (item: any) => item.status === "edit" || item.status === "new edit",
      );

      if (editedItems.length === 0) {
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
        setOriginalShapeMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
        return;
      }

      try {
        const ids = editedItems.map((item: any) => String(item.route_id));
        const [dataMap, shapeMap] = await Promise.all([
          fetchOriginalRows(conn, "routes", "route_id", ids),
          fetchOriginalRouteShapes(conn, ids),
        ]);
        setOriginalDataMap(dataMap);
        setOriginalShapeMap(shapeMap);
      } catch (err) {
        logger.error("Error fetching original route data for export table:", err);
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
        setOriginalShapeMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      }
    }

    fetchOriginalData();
  }, [conn, tableData]);

  // Reset compare when selection changes
  useEffect(() => {
    setShowCompare(false);
  }, [clickInfo]);

  const mutation = useMutation({
    mutationFn: async (mutateType: any) => {
      await mutationExportFn({
        conn,
        mutateType,
        SelectStation: clickInfo,
        selectedRow: clickInfo,
        TableName: "EditRouteTable",
        tableName: "EditRouteTable",
        rowIdField: "route_id",
      });
    },
    onSuccess: async () => {
      await refreshRoutesTables(conn);
      queryClient.invalidateQueries({ queryKey: ["EditRouteTable"] });
      queryClient.invalidateQueries({ queryKey: ["fetchRoutesData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchRouteShapes"] });
      queryClient.invalidateQueries({ queryKey: ["fetchRouteStops"] });
      queryClient.invalidateQueries({ queryKey: ["routeChips"] });
      setClickInfo(undefined);
    },
  });

  const hasData = useMemo(() => tableData.length > 0, [tableData]);

  const hasDataRef = useRef(hasData);
  const setFileTypesRef = useRef(setFileTypes);
  setFileTypesRef.current = setFileTypes;
  useEffect(() => {
    if (hasDataRef.current !== hasData) {
      hasDataRef.current = hasData;
      setFileTypesRef.current((prev: any) => ({ ...prev, routes: hasData }));
    }
  }, [hasData]);

  const handleButtonClick = () => {
    setFileTypes((prev: any) => ({ ...prev, routes: !prev.routes }));
  };

  const getShapeStatus = useCallback(
    (row: any) => {
      const routeId = row.route_id;
      const status = row.status;
      const editedShape = parseRouteLineValue(row.shape_points_json);
      const originalShape = originalShapeMap[routeId] || [];

      if (status === "new" || (status === "new edit" && !originalDataMap[routeId])) {
        return editedShape.length > 0 ? "new" : "none";
      }
      if (status === "deleted") return "deleted";

      if (editedShape.length === 0 && originalShape.length === 0) return "none";
      if (editedShape.length === 0 && originalShape.length > 0) return "removed";
      if (editedShape.length > 0 && originalShape.length === 0) return "added";

      if (editedShape.length !== originalShape.length) return "modified";
      const isDifferent = editedShape.some(
        (p, i) =>
          Math.abs(p.lat - originalShape[i].lat) > 0.000001 ||
          Math.abs(p.lon - originalShape[i].lon) > 0.000001,
      );
      return isDifferent ? "modified" : "unchanged";
    },
    [originalDataMap, originalShapeMap],
  );

  const renderSelectionActions = ({ clickInfo: selectedRoute }: any) => {
    if (!selectedRoute) return null;

    const isDeletedRoute = selectedRoute.status === "deleted";
    const routeId = selectedRoute.route_id;
    const shapeStatus = getShapeStatus(selectedRoute);
    const hasShapeComparison =
      shapeStatus === "modified" || shapeStatus === "added" || shapeStatus === "removed";
    const hasOriginal = !!originalDataMap[routeId];

    return (
      <>
        <Button
          variant="default"
          disabled={isDeletedRoute}
          onClick={() => {
            if (isDeletedRoute) return;
            router.navigate({
              to: "/routes/info",
              search: { selectedRouteId: routeId },
            });
          }}
        >
          <BiInfoCircle className="mr-2 h-5 w-5" />
          {isDeletedRoute ? "Route Deleted" : "Go to Route"}
        </Button>
        {hasOriginal && hasShapeComparison && (
          <Button
            variant="outline"
            onClick={() => setShowCompare((prev) => !prev)}
          >
            <BiGitCompare className="mr-2 h-5 w-5" />
            {showCompare ? "Hide Shapes" : "Compare Shapes"}
          </Button>
        )}
      </>
    );
  };

  const renderSelectedSupplementaryRows = ({
    row,
    originalRow,
    columns,
  }: any) => {
    if (!row || !showCompare) return null;

    const routeId = row.route_id;
    const editedPoints = parseRouteLineValue(row.shape_points_json);
    const originalPoints = originalShapeMap[routeId] || [];
    const routeColor = [...safeHexToRgb(row.route_color), 255];

    return (
      <TableRow className="bg-muted/30 border-l-4 border-l-blue-500">
        <TableCell colSpan={columns.length} className="p-3">
          <div className="grid grid-cols-2 gap-4">
            <ShapeMiniMap
              points={originalPoints}
              color={[100, 140, 200, 255]}
              label="Original"
              conn={conn}
            />
            <ShapeMiniMap
              points={editedPoints}
              color={routeColor}
              label="Edited"
              conn={conn}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <EditeTables
      FileTypes={FileTypes}
      setFileTypes={setFileTypes}
      hasData={hasData}
      isLoading={isLoading}
      error={error}
      isError={isError}
      tableData={tableData}
      clickInfo={clickInfo}
      setClickInfo={setClickInfo}
      isExpanded={isExpanded}
      setIsExpanded={setIsExpanded}
      handleButtonClick={handleButtonClick}
      mutation={mutation}
      originalDataMap={originalDataMap}
      renderSelectionActions={renderSelectionActions}
      renderSelectedSupplementaryRows={renderSelectedSupplementaryRows}
      fileTypeKey="routes"
      itemIdKey="route_id"
      title="routes.txt"
      emptyTitle="routes.txt"
      columns={[
        {
          accessorKey: "status",
          header: "Change Type",
          cell: ({ row }: any) => {
            const status = row.getValue("status");
            const routeId = row.original.route_id;
            const originalData = originalDataMap[routeId];

            if (status === "new" || (status === "new edit" && !originalData)) {
              return "New";
            }
            if (status === "deleted") return "Deleted";
            return <span className="text-yellow-600 dark:text-yellow-400">Modified</span>;
          },
        },
        { accessorKey: "route_id", header: "Route ID" },
        {
          accessorKey: "route_short_name",
          header: "Route Name",
          cell: ({ row }: any) => {
            const r = row.original;
            return r.route_short_name || r.route_long_name || r.route_id;
          },
        },
        {
          accessorKey: "route_type",
          header: "Type",
          cell: ({ row }: any) => {
            const type = row.original.route_type;
            const typeNames: Record<number, string> = {
              0: "Tram",
              1: "Subway",
              2: "Rail",
              3: "Bus",
              4: "Ferry",
              5: "Cable tram",
              6: "Aerial lift",
              7: "Funicular",
              11: "Trolleybus",
              12: "Monorail",
            };
            return typeNames[type] || `Type ${type}`;
          },
        },
        {
          accessorKey: "route_color",
          header: "Color",
          cell: ({ row }: any) => {
            const color = row.original.route_color;
            if (!color) return "—";
            const hex = color.startsWith("#") ? color : `#${color}`;
            return (
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-6 rounded-sm border"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-xs text-muted-foreground">{hex}</span>
              </span>
            );
          },
        },
        {
          accessorKey: "shape_points_json",
          header: "Shape",
          cell: ({ row }: any) => {
            const shapeStatus = getShapeStatus(row.original);
            switch (shapeStatus) {
              case "modified":
                return (
                  <span className="text-yellow-600 dark:text-yellow-400">Modified</span>
                );
              case "added":
                return (
                  <span className="text-green-600 dark:text-green-400">Added</span>
                );
              case "removed":
                return (
                  <span className="text-red-600 dark:text-red-400">Removed</span>
                );
              case "new":
                return (
                  <span className="text-green-600 dark:text-green-400">New</span>
                );
              case "unchanged":
                return (
                  <span className="text-muted-foreground">Unchanged</span>
                );
              case "deleted":
                return <span className="text-muted-foreground">—</span>;
              default:
                return <span className="text-muted-foreground">—</span>;
            }
          },
        },
      ]}
    />
  );
};

export default RoutesTable;
