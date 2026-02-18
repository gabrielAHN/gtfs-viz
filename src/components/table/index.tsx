import { useState } from "react";
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
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";

function TableComponent({ data, columns, ClickInfo, setClickInfo, children }) {
  const [sorting, setSorting] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4 rounded-md border shadow-sm p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 items-center sm:gap-4 mb-2">
        <div className="sm:col-span-1 order-2 sm:order-1 mt-2">
          {children}
        </div>
        <div className="sm:col-span-1 flex flex-col sm:items-end order-1 sm:order-2 space-y-2">
          <div className="text-sm">
            Page <strong>{pageIndex + 1}</strong> of <strong>{table.getPageCount()}</strong>
          </div>
          <div className="flex space-x-1">
            <Button
              variant="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="relative min-h-[10vh] max-h-[75vh] w-full overflow-auto rounded-md border">
        <table className="min-w-[1200px] w-full text-sm ">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="sticky top-0 "
                  >
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
                          header.getContext()
                        )}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === "asc" ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4 opacity-30" />
                          ))}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer ${
                    ClickInfo?.stop_id === row.original.stop_id
                      ? "dark:bg-stone-800 bg-stone-200 hover:bg-stone-200 "
                      : "dark:hover:bg-stone-900 hover:bg-stone-100"
                  }`}
                  onClick={() =>
                    setClickInfo((prev) =>
                      prev?.row_id === row.original.row_id ? null : row.original
                    )
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex justify-end p-1">
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
