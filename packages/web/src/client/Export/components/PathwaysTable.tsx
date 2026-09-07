import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { BiMap } from "react-icons/bi"
import { Button } from "@/components/ui/button"
import { useDuckDB } from "@/context/duckdb.client"
import { logger } from "@/lib/logger"
import { fetchTableData } from "@/lib/duckdb/DataFetching/fetchGTFSData"
import {
  fetchOriginalPathways,
  fetchStopMetadataForPathways,
} from "@/lib/duckdb/DataFetching/fetchExportData"
import { mutationExportFn } from "@/lib/duckdb/DataEditing/editingFn"
import { createEditPathwayTable, createEditStopTable, recreatePathwaysView } from "@/lib/extensions"

import EditeTables from "./TableComponent"

const PATHWAY_MODE_LABELS: Record<number, string> = {
  1: "Walkway",
  2: "Stairs",
  3: "Moving sidewalk/travelator",
  4: "Escalator",
  5: "Elevator",
  6: "Fare gate",
  7: "Exit gate",
}

const getPathwayModeLabel = (pathwayMode?: number | null) => {
  if (pathwayMode == null) {
    return "-"
  }

  return PATHWAY_MODE_LABELS[pathwayMode] ?? "❓"
}

const getDirectionTypeLabel = (isBidirectional?: number | null) => {
  if (isBidirectional == null) {
    return "-"
  }

  return isBidirectional === 1 ? "bidirectional" : "directional"
}

const getStopStationId = (stop: any) => {
  if (!stop) {
    return undefined
  }

  return stop.parent_station && stop.parent_station !== "" ? stop.parent_station : stop.stop_id
}

const PathwaysTable = ({ FileTypes, setFileTypes }) => {
  const { conn } = useDuckDB()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isExpanded, setIsExpanded] = useState(false)
  const [clickInfo, setClickInfo] = useState<any>()
  const [originalDataMap, setOriginalDataMap] = useState<Record<string, any>>({})
  const [stopMetadataMap, setStopMetadataMap] = useState<Record<string, any>>({})

  const {
    data: tableData = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["EditPathwayTable"],
    queryFn: async () => {
      if (!conn) {
        return []
      }

      try {
        await createEditPathwayTable(conn)
      } catch (createError) {
        logger.warn("Could not create EditPathwayTable before export query:", createError)
      }

      return fetchTableData({ conn, table: "EditPathwayTable" })
    },
    enabled: !!conn,
  })

  useEffect(() => {
    const fetchSupportingData = async () => {
      if (!conn || tableData.length === 0) {
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev))
        setStopMetadataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev))
        return
      }

      try {
        await createEditStopTable(conn)
      } catch (createError) {
        logger.warn("Could not create EditStopTable before pathway export query:", createError)
      }

      const editedItems = tableData.filter(
        (item: any) => item.status === "edit" || item.status === "new edit",
      )

      const stopIds = Array.from(
        new Set(
          tableData.flatMap((item: any) => [item.from_stop_id, item.to_stop_id].filter(Boolean)),
        ),
      )

      try {
        const [origMap, stopMap] = await Promise.all([
          fetchOriginalPathways(
            conn,
            editedItems.map((item: any) => item.pathway_id),
          ),
          fetchStopMetadataForPathways(conn, stopIds as string[]),
        ])
        setOriginalDataMap(origMap)
        setStopMetadataMap(stopMap)
      } catch (supportingDataError) {
        logger.error("Error fetching original pathway export data:", supportingDataError)
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev))
        setStopMetadataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev))
      }
    }

    fetchSupportingData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, tableData.length])

  const mutation = useMutation({
    mutationFn: async (mutateType: "row" | "table") => {
      await mutationExportFn({
        conn,
        mutateType,
        selectedRow: clickInfo,
        tableName: "EditPathwayTable",
        rowIdField: "pathway_id",
      })
    },
    onSuccess: async () => {
      if (conn) {
        await recreatePathwaysView(conn)
      }

      await queryClient.invalidateQueries({ queryKey: ["EditPathwayTable"] })
      await queryClient.invalidateQueries({ queryKey: ["stationPathwaysComplete"] })
      await queryClient.invalidateQueries({ queryKey: ["fetchRouteData"] })
      await queryClient.invalidateQueries({ queryKey: ["fetchPathwaysFiltered"] })
      setClickInfo(undefined)
    },
  })

  const hasData = useMemo(() => tableData.length > 0, [tableData])

  const hasDataRef = useRef(hasData)
  const setFileTypesRef = useRef(setFileTypes)
  setFileTypesRef.current = setFileTypes
  useEffect(() => {
    if (hasDataRef.current !== hasData) {
      hasDataRef.current = hasData
      setFileTypesRef.current((prev: any) => ({ ...prev, pathways: hasData }))
    }
  }, [hasData])

  const handleButtonClick = () => {
    setFileTypes((prev) => ({ ...prev, pathways: !prev.pathways }))
  }

  const getStopLabel = (stopId?: string) => {
    if (!stopId) {
      return "-"
    }

    const stop = stopMetadataMap[stopId]
    if (!stop) {
      return stopId
    }

    return stop.stop_name ? `${stop.stop_name} (${stopId})` : stopId
  }

  const getStationIdForPathway = (pathway: any) => {
    if (!pathway) {
      return undefined
    }

    const originalPathway = originalDataMap[pathway.pathway_id]
    const fromStop =
      stopMetadataMap[pathway.from_stop_id] ?? stopMetadataMap[originalPathway?.from_stop_id]
    const toStop =
      stopMetadataMap[pathway.to_stop_id] ?? stopMetadataMap[originalPathway?.to_stop_id]

    const fromStationId = getStopStationId(fromStop)
    const toStationId = getStopStationId(toStop)

    if (fromStationId && toStationId && fromStationId !== toStationId) {
      return undefined
    }

    return fromStationId ?? toStationId
  }

  const renderSelectionActions = ({ clickInfo: selectedPathway }) => {
    if (!selectedPathway) {
      return null
    }

    const stationId = getStationIdForPathway(selectedPathway)
    const canOpenFlow = !!stationId

    return (
      <Button
        variant="default"
        disabled={!canOpenFlow}
        onClick={() => {
          if (!stationId) {
            return
          }

          navigate({
            to: "/stations/pathways/flow/column",
            search: {
              selectedStationId: stationId,
              selectedNodeId: undefined,
              selectedPathwayId:
                selectedPathway.status === "deleted" ? undefined : selectedPathway.pathway_id,
              fromStop: selectedPathway.from_stop_id || undefined,
              toStop: selectedPathway.to_stop_id || undefined,
            },
          })
        }}
      >
        <BiMap className="mr-2 h-5 w-5" />
        {canOpenFlow ? "Go to Flow" : "Station Not Found"}
      </Button>
    )
  }

  return (
    <EditeTables
      FileTypes={FileTypes}
      setFileTypes={setFileTypes}
      fileTypeKey="pathways"
      itemIdKey="pathway_id"
      title="pathways.txt"
      emptyTitle="pathways.txt"
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
      columns={[
        {
          accessorKey: "status",
          header: "Change Type",
          cell: ({ row }) => {
            const status = row.getValue("status")
            const originalData = originalDataMap[row.original.pathway_id]

            if (status === "new" || (status === "new edit" && !originalData)) {
              return <span className="text-green-600 dark:text-green-400">🆕 New</span>
            }
            if (status === "deleted") {
              return <span className="text-red-600 dark:text-red-400">🗑️ Deleted</span>
            }

            return <span className="text-yellow-600 dark:text-yellow-400">Modified</span>
          },
        },
        { accessorKey: "pathway_id", header: "Pathway ID" },
        {
          accessorKey: "from_stop_id",
          header: "From Stop",
          cell: ({ row }) => getStopLabel(row.getValue("from_stop_id")),
        },
        {
          accessorKey: "to_stop_id",
          header: "To Stop",
          cell: ({ row }) => getStopLabel(row.getValue("to_stop_id")),
        },
        {
          accessorKey: "pathway_mode",
          header: "Pathway Type",
          cell: ({ row }) => getPathwayModeLabel(row.getValue("pathway_mode")),
        },
        {
          accessorKey: "is_bidirectional",
          header: "Direction",
          cell: ({ row }) => getDirectionTypeLabel(row.getValue("is_bidirectional")),
        },
        {
          accessorKey: "traversal_time",
          header: "Traversal Time",
          cell: ({ row }) => {
            const value = row.getValue("traversal_time")
            return value ?? "-"
          },
        },
        {
          accessorKey: "length",
          header: "Length",
          cell: ({ row }) => {
            const value = row.getValue("length")
            return value ?? "-"
          },
        },
      ]}
    />
  )
}

export default PathwaysTable
