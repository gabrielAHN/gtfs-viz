import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { fetchTableData } from "@/lib/duckdb/DataFetching/fetchGTFSData"
import { fetchOriginalRows } from "@/lib/duckdb/DataFetching/fetchExportData"
import { mutationExportFn } from "@/lib/duckdb/DataEditing/editingFn"

interface UseExportTableConfig {
  editTableName: string
  sourceTableName: string
  fileTypeKey: string
  itemIdKey: string
  setFileTypes: (fn: (prev: any) => any) => void
  invalidateKeys?: string[]
  enabled?: boolean
  onMutationSuccess?: () => void | Promise<void>
}

export function useExportTable({
  editTableName,
  sourceTableName,
  fileTypeKey,
  itemIdKey,
  setFileTypes,
  invalidateKeys = [],
  enabled = true,
  onMutationSuccess,
}: UseExportTableConfig) {
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const initialized = duckDB?.initialized ?? false
  const queryClient = useQueryClient()
  const [isExpanded, setIsExpanded] = useState(false)
  const [clickInfo, setClickInfo] = useState<any>()
  const [originalDataMap, setOriginalDataMap] = useState<Record<string, any>>({})

  const {
    data: tableData = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [editTableName],
    queryFn: () => fetchTableData({ conn, table: editTableName }),
    enabled: !!conn && initialized && enabled,
  })

  const hasData = tableData.length > 0

  // Sync hasData → fileTypes (with ref guard to prevent infinite loops)
  const hasDataRef = useRef(hasData)
  const setFileTypesRef = useRef(setFileTypes)
  setFileTypesRef.current = setFileTypes
  useEffect(() => {
    if (hasDataRef.current !== hasData) {
      hasDataRef.current = hasData
      setFileTypesRef.current((prev: any) => ({ ...prev, [fileTypeKey]: hasData }))
    }
  }, [hasData, fileTypeKey])

  // Fetch original data for diff comparison
  useEffect(() => {
    async function fetchOriginal() {
      if (!conn || !tableData || tableData.length === 0) {
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev))
        return
      }
      const edited = tableData.filter(
        (item: any) => item.status === "edit" || item.status === "new edit",
      )
      if (edited.length === 0) {
        setOriginalDataMap((prev) => (Object.keys(prev).length > 0 ? {} : prev))
        return
      }
      const ids = edited.map((item: any) => String(item[itemIdKey]))
      const map = await fetchOriginalRows(conn, sourceTableName, itemIdKey, ids)
      setOriginalDataMap(map)
    }
    fetchOriginal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, tableData.length, itemIdKey, sourceTableName])

  const mutation = useMutation({
    mutationFn: async (mutateType: string) =>
      mutationExportFn({
        conn,
        mutateType,
        SelectStation: undefined,
        selectedRow: clickInfo,
        TableName: editTableName,
        tableName: editTableName,
        rowIdField: itemIdKey,
      }),
    onSuccess: async () => {
      await onMutationSuccess?.()
      queryClient.invalidateQueries({ queryKey: [editTableName] })
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      setClickInfo(undefined)
    },
  })

  const handleButtonClick = () => {
    setFileTypes((prev: any) => ({ ...prev, [fileTypeKey]: !prev[fileTypeKey] }))
  }

  return {
    conn,
    initialized,
    queryClient,
    tableData,
    isLoading,
    isError,
    error,
    hasData,
    isExpanded,
    setIsExpanded,
    clickInfo,
    setClickInfo,
    originalDataMap,
    mutation,
    handleButtonClick,
  }
}
