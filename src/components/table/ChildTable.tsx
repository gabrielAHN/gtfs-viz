import { getStopColor } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import { ScrollBar, ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";

function ChildTable({ parentColumn, childColumn, rows, isLoading = false, sortBy, sortOrder, onSortChange }) {
  const { theme } = useThemeContext();

  const handleTimeSort = () => {
    if (!onSortChange) return;

    if (sortBy === "time") {
      
      if (sortOrder === "asc") {
        onSortChange("time", "desc");
      } else if (sortOrder === "desc") {
        onSortChange(undefined, undefined);
      } else {
        onSortChange("time", "asc");
      }
    } else {
      
      onSortChange("time", "asc");
    }
  };

  const getSortIcon = () => {
    if (sortBy !== "time") return null;
    if (sortOrder === "asc") return " ↑";
    if (sortOrder === "desc") return " ↓";
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-md border shadow-sm">
      <ScrollArea className="relative min-h-[10vh] max-h-[75vh] w-full overflow-auto">
        <table className="min-w-max w-full border-collapse">
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="p-2 border-b border-r first:rounded-tl-md">
                {parentColumn.label}
              </TableHead>
              <TableHead className="p-2 border-b border-r">
                {childColumn.label}
              </TableHead>
              <TableHead
                className={`p-2 border-b text-left first:rounded-tl-md last:rounded-tr-md ${onSortChange ? 'cursor-pointer hover:bg-accent/30' : ''}`}
                onClick={handleTimeSort}
              >
                Time (seconds){getSortIcon()}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const childStops = row[childColumn.value] || [];
              const isLastRow = index === rows.length - 1;
              const lastChildIdx = childStops.length - 1;

              return childStops.map((childStop, childIdx) => {
                const isLastChild = childIdx === lastChildIdx;

                return (
                  <TableRow key={`${index}-${childIdx}`}>
                    {childIdx === 0 && (
                      <TableCell
                        className={`p-2 border-b border-r whitespace-nowrap align-top ${isLastRow && isLastChild ? 'rounded-bl-md border-b-0' : ''}`}
                        rowSpan={childStops.length}
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            style={{
                              backgroundColor: rgbToHex(
                                getStopColor(row.primaryLocationType, theme)
                              ),
                            }}
                            className="w-2 h-2 rounded-full"
                          />
                          <div className="text-xs font-medium">{row[parentColumn.value]}</div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className={`p-2 border-b border-r whitespace-nowrap ${isLastRow && isLastChild ? 'border-b-0' : ''}`}>
                      <div className="flex items-center space-x-2">
                        <div
                          style={{
                            backgroundColor: rgbToHex(
                              getStopColor(childStop.secondaryLocationType, theme)
                            ),
                          }}
                          className="w-2 h-2 rounded-full"
                        />
                        <div className="text-xs font-medium">
                          {childStop[childColumn.childValue]}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`p-2 border-b text-left ${isLastRow && isLastChild ? 'rounded-br-md border-b-0' : ''}`}>
                      <div className="text-xs">
                        {childStop.shortest_time !== null ? `${childStop.shortest_time}` : 'N/A'}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              });
            })}
          </TableBody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default ChildTable;
