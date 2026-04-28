import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { BiMap } from "react-icons/bi";

import { fetchTableData } from "@/lib/duckdb/DataFetching/fetchGTFSData";
import { mutationExportFn } from "@/lib/duckdb/DataEditing/editingFn";
import { createStationsTable, createStopsTable, createStopsView } from "@/lib/extensions";

import EditeTables from "./TableComponent";

const StopsTable = ({ FileTypes, setFileTypes }) => {
  const { conn } = useDuckDB();
  const router = useRouter();
  const routerState = useRouterState();
  const [isExpanded, setIsExpanded] = useState(false);
  const [clickInfo, setClickInfo] = useState();
  const [originalDataMap, setOriginalDataMap] = useState({});
  const queryClient = useQueryClient();

  const { data: tableData = [], isLoading, isError, error } = useQuery({
    queryKey: ["EditStopTable"],
    queryFn: () => fetchTableData({ conn, table: "EditStopTable" })
  });

  useEffect(() => {
    async function fetchOriginalData() {
      if (!conn || !tableData || tableData.length === 0) {
        setOriginalDataMap((prev) => {
          
          if (Object.keys(prev).length > 0) {
            return {};
          }
          return prev;
        });
        return;
      }

      const editedItems = tableData.filter((item: any) =>
        item.status === 'edit' || item.status === 'new edit'
      );

      if (editedItems.length === 0) {
        setOriginalDataMap((prev) => {
          
          if (Object.keys(prev).length > 0) {
            return {};
          }
          return prev;
        });
        return;
      }

      try {
        const stopIds = editedItems.map((item: any) => `'${item.stop_id}'`).join(', ');
        const query = `SELECT * FROM stops WHERE stop_id IN (${stopIds})`;
        const result = await conn.query(query);
        const rows = result.toArray().map((row: any) => row.toJSON());

        const dataMap: any = {};
        rows.forEach((row: any) => {
          dataMap[row.stop_id] = row;
        });

        setOriginalDataMap((prev) => {
          
          const prevKeys = Object.keys(prev).sort().join(',');
          const newKeys = Object.keys(dataMap).sort().join(',');
          if (prevKeys === newKeys) {
            
            const hasChanges = Object.keys(dataMap).some(
              key => JSON.stringify(prev[key]) !== JSON.stringify(dataMap[key])
            );
            if (!hasChanges) {
              return prev;
            }
          }
          return dataMap;
        });
      } catch (error) {
        logger.error('Error fetching original data for export table:', error);
        setOriginalDataMap((prev) => {
          if (Object.keys(prev).length > 0) {
            return {};
          }
          return prev;
        });
      }
    }

    fetchOriginalData();
  }, [conn, tableData]);

  const mutation = useMutation({
    mutationFn: async (mutateType) => {
      await mutationExportFn({
        conn: conn,
        mutateType: mutateType,
        SelectStation: clickInfo,
        TableName: 'EditStopTable'
      });
    },
    onSuccess: async () => {
      await createStopsView(conn);
      await createStationsTable(conn);
      await createStopsTable(conn);

      const currentPath = routerState.location.pathname;
      const isOnStationsRoute = currentPath.startsWith("/stations");

      try {
        const stationsResult = await conn.query(`SELECT COUNT(*) as count FROM StationsTable LIMIT 1`);
        const stationsCount = stationsResult.toArray()[0]?.count || 0;

        const stopsResult = await conn.query(`SELECT COUNT(*) as count FROM StopsTable LIMIT 1`);
        const stopsCount = stopsResult.toArray()[0]?.count || 0;

        logger.log('After deletion - Stations:', stationsCount, 'Stops:', stopsCount);

        if (isOnStationsRoute && stationsCount === 0 && stopsCount > 0) {
          logger.log('No stations remaining, redirecting to stops route');
          router.navigate({ to: "/stops/map" });
        } else if (!isOnStationsRoute && stopsCount === 0 && stationsCount > 0) {
          
          logger.log('No stops remaining, redirecting to stations route');
          router.navigate({ to: "/stations/map" });
        }
      } catch (error) {
        logger.error('Error checking data after deletion:', error);
      }

      queryClient.invalidateQueries(["EditStopTable"]);
      queryClient.invalidateQueries({ queryKey: ["fetchStationsData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchStopsData"] });
      setClickInfo();
    }
  });

  const hasData = useMemo(() => tableData.length > 0, [tableData]);

  useEffect(() => {
    setFileTypes((prev) => {
      const nextValue = hasData ? (prev.stops ?? true) : false;
      if (prev.stops === nextValue) {
        return prev;
      }

      return { ...prev, stops: nextValue };
    });
  }, [hasData, setFileTypes]);

  const handleButtonClick = () => {
    setFileTypes((prev) => ({ ...prev, stops: !prev.stops }));
  };

  const renderSelectionActions = ({ clickInfo: selectedStop, originalData }) => {
    if (!selectedStop) {
      return null;
    }

    const locationType = selectedStop.location_type_name;
    const stopId = selectedStop.stop_id;
    const parentStation = selectedStop.parent_station;
    const status = selectedStop.status;
    const originalParentStation = originalData?.parent_station;

    if (locationType === "Station" || locationType === "Stop") {
      return (
        <Button
          variant="default"
          onClick={() => {
            if (locationType === "Station") {
              router.navigate({
                to: "/stations/map",
                search: { selectedStationId: stopId },
              });
              return;
            }

            router.navigate({
              to: "/stops/map",
              search: { selectedStopId: stopId },
            });
          }}
        >
          <BiMap className="mr-2 h-5 w-5" />
          Go to {locationType === "Station" ? "Station" : "Stop"}
        </Button>
      );
    }

    const effectiveParentStation = parentStation || originalParentStation;

    if (effectiveParentStation && effectiveParentStation !== "") {
      return (
        <Button
          variant="default"
          onClick={() => {
            if (status === "deleted") {
              router.navigate({
                to: "/stations/parts/map",
                search: { selectedStationId: effectiveParentStation },
              });
              return;
            }

            router.navigate({
              to: "/stations/parts/map",
              search: {
                selectedStationId: effectiveParentStation,
                selectedNodeId: stopId,
              },
            });
          }}
        >
          <BiMap className="mr-2 h-5 w-5" />
          Go to {parentStation ? "Parent Station" : "Former Parent Station"}
        </Button>
      );
    }

    return (
      <Button variant="default" disabled>
        <BiMap className="mr-2 h-5 w-5" />
        No Parent Station
      </Button>
    );
  };

  const renderSelectedSupplementaryRows = ({
    row,
    originalRow,
    columns,
    tableData,
    originalDataMap,
  }) => {
    if (!row || !originalRow) {
      return null;
    }

    const isDowngrade =
      originalRow.location_type_name === "Station" &&
      row.location_type_name === "Stop";

    const droppedParts = isDowngrade
      ? tableData.filter((item: any) => {
          const itemOriginal = originalDataMap[item.stop_id];
          return (
            itemOriginal &&
            itemOriginal.parent_station === row.stop_id &&
            (item.parent_station === null || item.parent_station === "")
          );
        })
      : [];

    const parentWasDowngraded =
      originalRow.parent_station &&
      (!row.parent_station || row.parent_station === "") &&
      (() => {
        const parentInTable = tableData.find(
          (item: any) => item.stop_id === originalRow.parent_station,
        );
        const parentOriginal = originalDataMap[originalRow.parent_station];

        return (
          parentOriginal &&
          parentOriginal.location_type_name === "Station" &&
          parentInTable &&
          parentInTable.location_type_name === "Stop"
        );
      })();

    return (
      <>
        {isDowngrade && droppedParts.length > 0 && (
          <TableRow className="bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500">
            <TableCell colSpan={columns.length} className="p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  🔻 {droppedParts.length} station part
                  {droppedParts.length > 1 ? "s" : ""} affected by this downgrade:
                </span>
                <div className="flex flex-wrap gap-2">
                  {droppedParts.map((part: any) => (
                    <Badge key={part.stop_id} variant="outline" className="text-xs">
                      {part.stop_name || part.stop_id} ({part.location_type_name})
                    </Badge>
                  ))}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
        {parentWasDowngraded && (
          <TableRow className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-l-purple-500">
            <TableCell colSpan={columns.length} className="p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                  🔗 Parent station was detached because station "
                  {originalRow.parent_station}" was downgraded to a stop
                </span>
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
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
      columns={[
        {
          accessorKey: "status",
          header: "Change Type",
          cell: ({ row }) => {
            const status = row.getValue("status");
            const currentStop = row.original;
            const stopId = currentStop.stop_id;
            const originalData = originalDataMap[stopId];

            if (status === 'new' || (status === 'new edit' && !originalData)) {
              return '🆕 New';
            }
            if (status === 'deleted') return '🗑️ Deleted';

            if ((status === 'edit' || status === 'new edit') && originalData) {
              if (originalData.location_type_name === 'Station' && currentStop.location_type_name === 'Stop') {

                const droppedParts = tableData.filter((item: any) => {
                  const itemOriginal = originalDataMap[item.stop_id];
                  return itemOriginal &&
                         itemOriginal.parent_station === stopId &&
                         (item.parent_station === null || item.parent_station === '');
                });

                if (droppedParts.length > 0) {
                  return (
                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                      🔻 Downgraded from Station ({droppedParts.length} part{droppedParts.length > 1 ? 's' : ''} dropped)
                    </span>
                  );
                }
                return (
                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                    🔻 Downgraded from Station
                  </span>
                );
              }

              if (originalData.parent_station && (!currentStop.parent_station || currentStop.parent_station === '')) {
                const parentInTable = tableData.find((item: any) => item.stop_id === originalData.parent_station);
                const parentOriginal = originalDataMap[originalData.parent_station];

                if (parentOriginal && parentOriginal.location_type_name === 'Station' &&
                    parentInTable && parentInTable.location_type_name === 'Stop') {
                  return (
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      🔗 Detached (parent station downgraded)
                    </span>
                  );
                }
              }
            }

            return <span className="text-yellow-600 dark:text-yellow-400">Modified</span>;
          }
        },
        { accessorKey: "location_type_name", header: "Location Type" },
        { accessorKey: "stop_id", header: "Stop Id" },
        { accessorKey: "stop_name", header: "Stop Name" },
        {
          accessorKey: "parent_station",
          header: "Parent Station",
          cell: ({ row }) => {
            const value = row.getValue("parent_station");
            return value || '-';
          }
        },
        { accessorKey: "stop_lat", header: "Latitude" },
        { accessorKey: "stop_lon", header: "Longitude" },
        { accessorKey: "wheelchair_status" , header: "Wheelchair" },
      ]}

    />
  );
};

export default StopsTable;
