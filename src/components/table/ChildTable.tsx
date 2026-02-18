import { StopTypeColors } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { ScrollBar, ScrollArea } from "@/components/ui/scroll-area";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";

function ChildTable({ parentColumn, childColumn, rows }) {
  return (
    <div className="w-full overflow-x-auto rounded-sm">
      <table className="min-w-max w-full border-collapse">

        <TableHeader className="sticky top-0 z-10 bg-gray-100 dark:bg-stone-800 shadow-md">
          <TableRow>
            <TableHead className="w-40 p-2 border">
              <div className="flex justify-between w-full">
                <div className="w-1/2">{parentColumn.label}</div>
                <div className="w-1/2">{childColumn.label}</div>
                <div className="w-1/2 text-left">Time</div>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <ScrollArea className="relative min-h-[10vh] max-h-[75vh] w-full overflow-auto">
            {rows.map((row, index) => (
              <TableRow key={index} className="border-b">
                <TableCell className="w-40 p-2 border whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div
                      style={{
                        backgroundColor: rgbToHex(
                          StopTypeColors[row.primaryLocationType]?.color
                        ),
                      }}
                      className="w-2 h-2 rounded-full"
                    />
                    <div className="text-xs font-medium">{row[parentColumn.value]}</div>
                  </div>
                </TableCell>
                <TableCell className="p-2 min-w-[500px] border">
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 min-w-[500px]">
                      {row[childColumn.value].map((Column, idx) => (
                        <div key={idx} className="contents">
                          <div className="flex items-center whitespace-nowrap">
                            <div
                              style={{
                                backgroundColor: rgbToHex(
                                  StopTypeColors[Column.secondaryLocationType]?.color
                                ),
                              }}
                              className="w-2 h-2 rounded-full mx-1"
                            />
                            <div className="text-xs font-medium">
                              {Column[childColumn.childValue]}
                            </div>
                          </div>
                          <div className="text-xs whitespace-nowrap text-left">
                            {Column.shortest_time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </ScrollArea>
        </TableBody>
      </table>
    </div>
  );
}

export default ChildTable;
