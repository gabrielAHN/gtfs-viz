import { useState, useCallback, startTransition, useEffect } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollBar, ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import {
  BiChevronUp,
  BiChevronDown,
  BiChevronRight,
  BiChevronLeft,
  BiChevronsRight,
  BiChevronsLeft,
  BiRightArrow,
} from "react-icons/bi";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BiPencil } from "react-icons/bi";

function TableComponent({
  data,
  columns,
  ClickInfo,
  setClickInfo,
  children,
  hasActiveFilters,
  onClearFilters,
  onSortingChange,
  clearSortingTrigger,
}) {
  const [sorting, setSorting] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (onSortingChange) {
      onSortingChange(sorting);
    }
  }, [sorting, onSortingChange]);

  useEffect(() => {
    if (clearSortingTrigger !== undefined && clearSortingTrigger > 0) {
      setSorting([]);
    }
  }, [clearSortingTrigger]);

  const handleRowClick = useCallback(
    (row) => {
      if (!setClickInfo) return;

      startTransition(() => {
        const isCurrentlySelected = ClickInfo?.stop_id === row.stop_id;
        setClickInfo(isCurrentlySelected ? undefined : row);
      });
    },
    [setClickInfo, ClickInfo],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        setPageIndex((prevPage) => {
          const nextPage = updater({ pageIndex: prevPage, pageSize }).pageIndex;
          return typeof nextPage === "number" ? nextPage : prevPage;
        });
        setPageSize((prevSize) => {
          const nextSize = updater({ pageIndex, pageSize: prevSize }).pageSize;
          return typeof nextSize === "number" ? nextSize : prevSize;
        });
      } else {
        setPageIndex(updater.pageIndex ?? 0);
        setPageSize(updater.pageSize ?? 10);
      }
    },
    enableMultiSort: true,
    enableSortingRemoval: true,
    maxMultiSortColCount: 5,
    isMultiSortEvent: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4 rounded-md border shadow-sm p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 items-center sm:gap-4 mb-2">
        <div className="sm:col-span-1 order-2 sm:order-1 mt-2">{children}</div>
        <div className="sm:col-span-1 flex flex-col sm:items-end order-1 sm:order-2 space-y-2">
          <div className="text-sm">
            Page <strong>{pageIndex + 1}</strong> of{" "}
            <strong>{table.getPageCount()}</strong>
          </div>
          <div className="flex space-x-1">
            <Button
              variant="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <BiChevronsLeft />
            </Button>
            <Button
              variant="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <BiChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <BiChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <BiChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="relative min-h-[10vh] max-h-[75vh] w-full overflow-auto rounded-md border">
        <table className="min-w-[1200px] w-full text-sm ">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="sticky top-0 w-8 px-2"></TableHead>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="sticky top-0 ">
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center space-x-1 ${
                          header.column.getCanSort()
                            ? "cursor-pointer select-none"
                            : ""
                        }`}
                        onClick={
                          header.column.getCanSort()
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getCanSort() && (
                          <div className="flex items-center gap-1">
                            {header.column.getIsSorted() === "asc" ? (
                              <BiChevronUp className="w-4 h-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <BiChevronDown className="w-4 h-4" />
                            ) : (
                              <BiRightArrow className="w-4 h-4 opacity-30" />
                            )}
                            {header.column.getIsSorted() &&
                              sorting.length > 1 && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 w-4 p-0 flex items-center justify-center text-xs"
                                >
                                  {header.column.getSortIndex() + 1}
                                </Badge>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => {
                const isSelected = ClickInfo?.stop_id === row.original.stop_id;
                const isEdited =
                  row.original.status === "edit" ||
                  row.original.status === "new" ||
                  row.original.status === "new edit";
                return (
                  <TableRow
                    key={row.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/10 dark:bg-primary/20 border-l-4 border-l-primary font-medium"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleRowClick(row.original)}
                  >
                    <TableCell className="w-8 px-2">
                      {isEdited && (
                        <Avatar>
                          <AvatarFallback className="bg-primary">
                            <BiPencil className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-1">
        <div className="text-xs text-muted-foreground">
          {sorting.length > 0 || hasActiveFilters ? (
            <>
              <span>
                {sorting.length > 0 &&
                  `Sorted by ${sorting.length} column${sorting.length > 1 ? "s" : ""}`}
                {sorting.length > 0 && hasActiveFilters && " • "}
                {hasActiveFilters && "Filters active"}
                {" • "}
              </span>
              <Button
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground underline ml-1"
                onClick={() => {
                  setSorting([]);
                  if (onClearFilters) {
                    onClearFilters();
                  }
                }}
              >
                Clear all{" "}
                {sorting.length > 0 && hasActiveFilters
                  ? "sorting & filters"
                  : hasActiveFilters
                    ? "filters"
                    : "sorting"}
              </Button>
            </>
          ) : (
            <span className="hidden sm:inline">
              Click column headers to sort by multiple columns
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm">Rows per page:</span>
          <Select
            onValueChange={(value) => table.setPageSize(Number(value))}
            value={pageSize.toString()}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default TableComponent;
