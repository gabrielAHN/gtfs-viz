import { useMemo, useState, useEffect, useCallback, startTransition, Fragment } from "react";
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
    BiMap,
} from "react-icons/bi";
import { Badge } from "@/components/ui/badge";
import { useDuckDB } from "@/context/duckdb.client";
import { useNavigate } from "@tanstack/react-router";

function EditeTables(props) {
    const {
        FileTypes, setFileTypes, hasData, isLoading,
        isError, error, tableData, clickInfo, setClickInfo,
        columns, handleButtonClick, setIsExpanded,
        isExpanded, mutation, originalDataMap = {}
    } = props

    const { conn } = useDuckDB();
    const navigate = useNavigate();

    const originalData = clickInfo && (clickInfo.status === 'edit' || clickInfo.status === 'new edit')
        ? originalDataMap[clickInfo.stop_id]
        : null;

    const isDowngrade = originalData &&
                        originalData.location_type_name === 'Station' &&
                        clickInfo?.location_type_name === 'Stop';

    const droppedParts = isDowngrade
        ? tableData.filter((item: any) => {
            const itemOriginal = originalDataMap[item.stop_id];
            return itemOriginal &&
                   itemOriginal.parent_station === clickInfo.stop_id &&
                   (item.parent_station === null || item.parent_station === '');
          })
        : [];

    const isDetachedPart = originalData &&
                          originalData.parent_station &&
                          (!clickInfo?.parent_station || clickInfo.parent_station === '');

    const parentWasDowngraded = isDetachedPart ? (() => {
        const parentInTable = tableData.find((item: any) => item.stop_id === originalData.parent_station);
        const parentOriginal = originalDataMap[originalData.parent_station];
        return parentOriginal &&
               parentOriginal.location_type_name === 'Station' &&
               parentInTable &&
               parentInTable.location_type_name === 'Stop';
    })() : false;

    const buttonClasses = useMemo(() => {
        if (!hasData) {
            return "flex items-center rounded-sm justify-center w-12 h-12 bg-stone-300 text-stone-400 cursor-not-allowed dark:bg-stone-800";
        }
        return FileTypes.stops
            ? "flex items-center justify-center w-12 h-12 bg-green-500 hover:bg-green-600 rounded-sm"
            : "flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 rounded-sm";
    }, [hasData, FileTypes.stops]);

    const triggerClasses = useMemo(() => {
        if (hasData && FileTypes.stops) {
            return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm cursor-pointer transition-colors";
        }
        return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-400 dark:bg-stone-600 cursor-not-allowed rounded-sm";
    }, [hasData, FileTypes.stops]);

    const [sorting, setSorting] = useState([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const handleRowClick = useCallback(
        (row) => {
            if (!setClickInfo) return;

            startTransition(() => {
                const isCurrentlySelected = clickInfo?.stop_id === row.stop_id;
                setClickInfo(isCurrentlySelected ? undefined : row);
            });
        },
        [setClickInfo, clickInfo],
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
            disabled={!hasData || FileTypes.stops}
            className="border rounded p-2"
        >
            <div className="flex gap-2">
                <button
                    onClick={handleButtonClick}
                    disabled={!hasData}
                    className={buttonClasses}
                >
                    {FileTypes.stops ? <BiCheck size={24} /> : <BiX size={24} />}
                </button>
                <CollapsibleTrigger asChild>
                    <div className={triggerClasses}>
                        <div className="flex items-center w-full">
                            <span className="flex items-center">
                                {isExpanded && FileTypes.stops ? (
                                    <BiChevronUp size={16} />
                                ) : (
                                    <BiChevronDown size={16} />
                                )}
                                <span className="ml-1 text-lg font-bold">
                                    {hasData ? "Stop Edits" : "No Stop Edits"}
                                </span>
                            </span>
                        </div>
                    </div>
                </CollapsibleTrigger>
            </div>
            {hasData && FileTypes.stops && (
                <CollapsibleContent className="mt-2 w-full">
                    <div className="space-y-4 rounded-md border shadow-sm p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 items-center sm:gap-4 mb-2">
                            <div className="sm:col-span-1 order-2 sm:order-1 mt-2">
                                <div className="flex justify-start space-x-2 flex-wrap gap-y-2">
                                    {clickInfo && (() => {
                                        const locationType = clickInfo.location_type_name;
                                        const stopId = clickInfo.stop_id;
                                        const parentStation = clickInfo.parent_station;
                                        const status = clickInfo.status;
                                        const originalParentStation = originalData?.parent_station;

                                        if (locationType === 'Station' || locationType === 'Stop') {
                                            return (
                                                <Button
                                                    variant="default"
                                                    onClick={() => {
                                                        if (locationType === 'Station') {
                                                            navigate({
                                                                to: '/stations/map',
                                                                search: { selectedStationId: stopId }
                                                            });
                                                        } else {
                                                            navigate({
                                                                to: '/stops/map',
                                                                search: { selectedStopId: stopId }
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <BiMap className="mr-2 h-5 w-5" />
                                                    Go to {locationType === 'Station' ? 'Station' : 'Stop'}
                                                </Button>
                                            );
                                        }

                                        const effectiveParentStation = parentStation || originalParentStation;

                                        if (effectiveParentStation && effectiveParentStation !== '') {
                                            return (
                                                <Button
                                                    variant="default"
                                                    onClick={() => {
                                                        if (status === 'deleted') {
                                                            navigate({
                                                                to: '/stations/parts/map',
                                                                search: { selectedStationId: effectiveParentStation }
                                                            });
                                                        } else {
                                                            navigate({
                                                                to: '/stations/parts/map',
                                                                search: {
                                                                    selectedStationId: effectiveParentStation,
                                                                    selectedNodeId: stopId
                                                                }
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <BiMap className="mr-2 h-5 w-5" />
                                                    Go to {parentStation ? 'Parent Station' : 'Former Parent Station'}
                                                </Button>
                                            );
                                        }

                                        return (
                                            <Button
                                                variant="default"
                                                disabled
                                            >
                                                <BiMap className="mr-2 h-5 w-5" />
                                                No Parent Station
                                            </Button>
                                        );
                                    })()}
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
                                            const isSelected = clickInfo?.stop_id === row.original.stop_id;
                                            const currentOriginal = originalDataMap[row.original.stop_id];
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
                                                            {isDowngrade && droppedParts.length > 0 && (
                                                                <TableRow className="bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500">
                                                                    <TableCell colSpan={columns.length} className="p-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                                                                                🔻 {droppedParts.length} station part{droppedParts.length > 1 ? 's' : ''} affected by this downgrade:
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
                                                                                🔗 Parent station was detached because station "{originalData.parent_station}" was downgraded to a stop
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
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
