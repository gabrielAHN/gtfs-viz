import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import { rgbToHex } from "@/util/colorUtil";
import { StopTypeColors } from "@/util/gtfsStyling";

function TableView({ StationData }) {
  if (!StationData) {
    return <Skeleton variant="rounded" className="w-full h-full" />;
  }

  const ColumnNames = ["Stop Name", "Stop ID", "Lat", "Lon", "Type"];

  const Row = ({ row }) => {
    return (
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell align="right">{row.stop_name}</TableCell>
        <TableCell align="right">{row.stop_id}</TableCell>
        <TableCell align="right">{row.stop_lat}</TableCell>
        <TableCell align="right">{row.stop_lon}</TableCell>
        <TableCell align="right">
          <Chip
            style={{
              backgroundColor: rgbToHex(
                StopTypeColors[row.location_type_name]?.color
              ),
              color: "white",
            }}
            label={row.location_type_name}
          />
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="h-full max-h-[58vh] overflow-y-auto">
      <Table>
        <TableHead>
          <TableRow>
            {ColumnNames.map((columnName, index) => (
              <TableCell
                key={index}
                align="right"
                style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "white",
                  zIndex: 1,
                }}
              >
                {columnName}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {StationData.StationData.map((row, index) => (
            <Row key={row.stop_id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default TableView;
