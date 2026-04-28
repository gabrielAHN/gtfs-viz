import {
    useMemo,
    useState,
    useEffect,
    useCallback,
    startTransition,
    Fragment,
} from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Skeleton } from "@/components/ui/skeleton";
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
    BiCheck,
    BiRefresh,
    BiUndo,
    BiX,
    BiChevronRight,
    BiChevronLeft,
    BiChevronsRight,
    BiChevronsLeft,
    BiRightArrow,
} from "react-icons/bi";
import { Badge } from "@/components/ui/badge";

function EditeTables(props) {
    const {
        FileTypes, hasData, isLoading,
        isError, error, tableData, clickInfo, setClickInfo,
        columns, handleButtonClick, setIsExpanded,
        isExpanded, mutation, originalDataMap = {},
        fileTypeKey = "stops",
        itemIdKey = "stop_id",
        title = "Stop Edits",
        emptyTitle = "No Stop Edits",
        getOriginalDataKey = (item) => item?.[itemIdKey],
        renderSelectionActions,
        renderSelectedSupplementaryRows,
    } = props

    const getItemId = useCallback(
        (item) => item?.object?.[itemIdKey] ?? item?.[itemIdKey],
        [itemIdKey],
    );

    const originalData = clickInfo && (clickInfo.status === 'edit' || clickInfo.status === 'new edit')
        ? originalDataMap[getOriginalDataKey(clickInfo)]
        : null;

    const buttonClasses = useMemo(() => {
        if (!hasData) {
            return "flex items-center rounded-sm justify-center w-12 h-12 bg-stone-300 text-stone-400 cursor-not-allowed dark:bg-stone-800";
        }
        return FileTypes[fileTypeKey]
            ? "flex items-center justify-center w-12 h-12 bg-green-500 hover:bg-green-600 rounded-sm"
            : "flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 rounded-sm";
    }, [FileTypes, fileTypeKey, hasData]);

    const triggerClasses = useMemo(() => {
        if (!hasData) {
            return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-400 dark:bg-stone-600 cursor-not-allowed rounded-sm";
        }

        if (FileTypes[fileTypeKey]) {
            return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm cursor-pointer transition-colors";
        }
        return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-300 dark:bg-stone-600 hover:bg-stone-200 dark:hover:bg-stone-500 rounded-sm cursor-pointer transition-colors";
    }, [FileTypes, fileTypeKey, hasData]);

    const [sorting, setSorting] = useState([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const handleRowClick = useCallback(
        (row) => {
            if (!setClickInfo) return;

            startTransition(() => {
                const isCurrentlySelected = getItemId(clickInfo) === getItemId(row);
                setClickInfo(isCurrentlySelected ? undefined : row);
            });
        },
        [clickInfo, getItemId, setClickInfo],
    );

    const table = useReactTable({
        data: tableData,
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

    if (isLoading) return <Skeleton className="w-full h-40" />;
    if (isError)
        return <div className="text-red-500">Error: {error.message}</div>;
    return (
        <Collapsible
            open={isExpanded}
            onOpenChange={setIsExpanded}
            disabled={!hasData}
            className="border rounded p-2"
        >
            <div className="flex gap-2">
                <button
                    onClick={handleButtonClick}
                    disabled={!hasData}
                    className={buttonClasses}
                >
                    {FileTypes[fileTypeKey] ? <BiCheck size={24} /> : <BiX size={24} />}
                </button>
                <CollapsibleTrigger asChild>
                    <div className={triggerClasses}>
                        <div className="flex items-center w-full">
                            <span className="flex items-center">
                                {isExpanded ? (
                                    <BiChevronUp size={16} />
                                ) : (
                                    <BiChevronDown size={16} />
                                )}
                                <span className="ml-1 text-lg font-bold">
                                    {hasData ? title : emptyTitle}
                                </span>
                            </span>
                        </div>
                    </div>
                </CollapsibleTrigger>
            </div>
            {hasData && (
                <CollapsibleContent className="mt-2 w-full">
                    <div className="space-y-4 rounded-md border shadow-sm p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 items-center sm:gap-4 mb-2">
                            <div className="sm:col-span-1 order-2 sm:order-1 mt-2">
                                <div className="flex justify-start space-x-2 flex-wrap gap-y-2">
                                    {renderSelectionActions?.({
                                        clickInfo,
                                        originalData,
                                        tableData,
                                        originalDataMap,
                                    })}
                                    {clickInfo && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => mutation.mutate('row')}
                                        >
                                            <BiUndo className="mr-2 h-5 w-5" />
                                            Revert Edit
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        onClick={() => mutation.mutate('table')}
                                    >
                                        <BiRefresh className="mr-2 h-5 w-5" />
                                        Revert All Changes
                                    </Button>
                                </div>
                            </div>
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
                            <table className="min-w-[1200px] w-full text-sm">
                                <TableHeader>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => (
                                                <TableHead key={header.id} className="sticky top-0">
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
                                            const isSelected = getItemId(clickInfo) === getItemId(row.original);
                                            const currentOriginal =
                                                originalDataMap[getOriginalDataKey(row.original)];
                                            const hasOriginal = currentOriginal && (row.original.status === 'edit' || row.original.status === 'new edit');

                                            return (
                                                <Fragment key={row.id}>
                                                    <TableRow
                                                        className={`cursor-pointer transition-colors ${
                                                            isSelected
                                                                ? "bg-primary/10 dark:bg-primary/20 border-l-4 border-l-primary font-medium"
                                                                : "hover:bg-muted/50"
                                                        }`}
                                                        onClick={() => handleRowClick(row.original)}
                                                    >
                                                        {row.getVisibleCells().map((cell) => (
                                                            <TableCell key={cell.id}>
                                                                {flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext(),
                                                                )}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                    {isSelected && hasOriginal && (
                                                        <>
                                                            {renderSelectedSupplementaryRows?.({
                                                                row: row.original,
                                                                originalRow: currentOriginal,
                                                                columns,
                                                                tableData,
                                                                originalDataMap,
                                                            })}
                                                            <TableRow className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500">
                                                                <TableCell className="font-medium text-blue-800 dark:text-blue-300 text-xs">
                                                                    ORIGINAL
                                                                </TableCell>
                                                                {columns.slice(1).map((col: any) => {
                                                                    const value = currentOriginal[col.accessorKey];
                                                                    const currentValue = row.original[col.accessorKey];

                                                                    const normalizedOriginal = value === null || value === undefined || value === '' ? null : value;
                                                                    const normalizedCurrent = currentValue === null || currentValue === undefined || currentValue === '' ? null : currentValue;
                                                                    const hasChanged = normalizedOriginal !== normalizedCurrent;

                                                                    return (
                                                                        <TableCell
                                                                            key={col.accessorKey}
                                                                            className={hasChanged ? "bg-yellow-100 dark:bg-yellow-900/30 font-medium" : ""}
                                                                        >
                                                                            {col.accessorKey === 'status' ? (
                                                                                <span className="text-muted-foreground italic text-xs">Original</span>
                                                                            ) : col.cell ? (
                                                                                flexRender(col.cell, { row: { original: currentOriginal, getValue: (key: string) => currentOriginal[key] } })
                                                                            ) : (
                                                                                value || '-'
                                                                            )}
                                                                        </TableCell>
                                                                    );
                                                                })}
                                                            </TableRow>
                                                        </>
                                                    )}
                                                </Fragment>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} className="text-center">
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
                                {sorting.length > 0 ? (
                                    <>
                                        <span>
                                            Sorted by {sorting.length} column{sorting.length > 1 ? "s" : ""}
                                            {" • "}
                                        </span>
                                        <Button
                                            variant="link"
                                            className="h-auto p-0 text-xs text-muted-foreground underline ml-1"
                                            onClick={() => setSorting([])}
                                        >
                                            Clear sorting
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
                </CollapsibleContent>
            )}
        </Collapsible>
    );
};

export default EditeTables;
