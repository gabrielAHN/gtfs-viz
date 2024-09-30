import { StopTypeColors } from "@/util/gtfsStyling";
import { rgbToHex } from "@/util/colorUtil";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

function StartTable({ rows }) {
  return (
    <TableContainer className="overflow-x-auto">
      <Table className="table-auto w-full min-w-[640px]">
        <TableHead>
          <TableRow>
            <TableCell className="p-1">Start Stop</TableCell>
            <TableCell className="p-1">
              <div className="grid grid-cols-2">
                <div>End Stop</div>
                <div>Time</div>
              </div>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} className="hover:bg-gray-100">
              <TableCell className="p-1">
                <div className="text-xs font-medium">{row.start_stop}</div>
                <div
                  style={{
                    backgroundColor: rgbToHex(
                      StopTypeColors[row.primaryLocationType]?.color
                    ),
                  }}
                  className="w-2 h-2 rounded-full mx-auto"
                />
              </TableCell>
              <TableCell className="p-1">
                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {row.endStops.map((endStop, idx) => (
                      <div key={idx} className="contents">
                        <div className="flex items-center">
                          <div className="text-xs font-medium">
                            {endStop.end_stop}
                          </div>
                          <div
                            style={{
                              backgroundColor: rgbToHex(
                                StopTypeColors[endStop.secondaryLocationType]
                                  ?.color
                              ),
                            }}
                            className="w-2 h-2 rounded-full mx-1"
                          />
                        </div>
                        <div className="text-xs">{endStop.shortest_time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default StartTable;
