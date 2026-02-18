import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { logger } from "@/lib/logger";

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
    if (hasData) {
      setFileTypes((prev) => ({ ...prev, stops: true }));
    }
  }, [hasData, setFileTypes]);

  const handleButtonClick = () => {
    setFileTypes((prev) => ({ ...prev, stops: !prev.stops }));
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
      columns={[
        {
          accessorKey: "status",
          header: "Change Type",
          cell: ({ row }) => {
            const status = row.getValue("status");
            const currentStop = row.original;
            const stopId = currentStop.stop_id;
            const originalData = originalDataMap[stopId];

            if (status === 'new') return '🆕 New';
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
