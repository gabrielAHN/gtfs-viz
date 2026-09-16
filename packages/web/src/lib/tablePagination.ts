import { useCallback, useMemo } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { OnChangeFn, PaginationState } from "@tanstack/react-table"

type PaginationNavigate = (options: {
  search: (previous: Record<string, unknown>) => Record<string, unknown>
  replace: boolean
  resetScroll: boolean
}) => Promise<void>

export const DEFAULT_TABLE_PAGE_SIZE = 10
export const TABLE_PAGE_SIZES = [10, 20, 30, 50] as const

const positiveInteger = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export const parseTablePage = (value: unknown) => {
  const page = positiveInteger(value)
  return page && page > 1 ? page : undefined
}

export const parseTablePageSize = (value: unknown) => {
  const pageSize = positiveInteger(value)
  return pageSize &&
    TABLE_PAGE_SIZES.some((size) => size === pageSize) &&
    pageSize !== DEFAULT_TABLE_PAGE_SIZE
    ? pageSize
    : undefined
}

export const tablePaginationSearch = (search: Record<string, unknown>, paginationKey?: string) => {
  const pageParam = paginationKey ? `${paginationKey}Page` : "page"
  const pageSizeParam = paginationKey ? `${paginationKey}PageSize` : "pageSize"
  return {
    [pageParam]: parseTablePage(search[pageParam]),
    [pageSizeParam]: parseTablePageSize(search[pageSizeParam]),
  }
}

export function useUrlTablePagination(paginationKey?: string) {
  const navigate = useNavigate() as unknown as PaginationNavigate
  const search = useRouterState({
    select: (state) => state.location.search,
  }) as Record<string, unknown>
  const pageParam = paginationKey ? `${paginationKey}Page` : "page"
  const pageSizeParam = paginationKey ? `${paginationKey}PageSize` : "pageSize"
  const page = positiveInteger(search[pageParam]) ?? 1
  const parsedPageSize = positiveInteger(search[pageSizeParam])
  const pageSize =
    parsedPageSize && TABLE_PAGE_SIZES.some((size) => size === parsedPageSize)
      ? parsedPageSize
      : DEFAULT_TABLE_PAGE_SIZE
  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize }),
    [page, pageSize],
  )

  const onPaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const nextValue = typeof updater === "function" ? updater(pagination) : updater
      const nextPageIndex = Math.max(0, Math.floor(nextValue.pageIndex))
      const nextPageSize = TABLE_PAGE_SIZES.some((size) => size === nextValue.pageSize)
        ? nextValue.pageSize
        : DEFAULT_TABLE_PAGE_SIZE
      if (nextPageIndex === pagination.pageIndex && nextPageSize === pagination.pageSize) return
      void navigate({
        search: (previous) => ({
          ...previous,
          [pageParam]: nextPageIndex > 0 ? nextPageIndex + 1 : undefined,
          [pageSizeParam]: nextPageSize !== DEFAULT_TABLE_PAGE_SIZE ? nextPageSize : undefined,
        }),
        replace: true,
        resetScroll: false,
      })
    },
    [navigate, pageParam, pageSizeParam, pagination],
  )

  return { pagination, onPaginationChange }
}
