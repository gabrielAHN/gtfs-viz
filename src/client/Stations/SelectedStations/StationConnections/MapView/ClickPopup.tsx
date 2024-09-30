import { Button } from "@mui/material";
import {
  StopTypeColors,
  PathwayColors,
  ConnectTypeColors,
} from "@/util/gtfsStyling";
import TableComponent from "@/components/MuiComponent/TableComponent";
import { rgbToHex } from "@/util/colorUtil";

function ClickPopup({
  ClickInfo,
  setClickInfo,
  ConnectionType,
  timeIntervalRanges,
}) {
  const handleClose = () => {
    setClickInfo(null);
  };

  const ArcPopup = (d) => {
    const arcStatus = d?.directional ?? null;

    if (ConnectionType === "directional") {
      let ClickColor = [0, 0, 0];

      if (arcStatus == "directional") {
        ClickColor = ConnectTypeColors[arcStatus].from;
      } else if (arcStatus == "bidirectional") {
        ClickColor = ConnectTypeColors[arcStatus]["bidirectional"];
      }
      return rgbToHex(ClickColor);
    } else if (ConnectionType === "timeInterval") {
      const value = d.timeInterval;

      for (const range of timeIntervalRanges) {
        if (value >= range.min && value <= range.max) {
          return range.color;
        }
      }
    } else if (ConnectionType === "PathwayTypes") {
      return rgbToHex(PathwayColors[d.pathwayType].color);
    }
  };

  return (
    <div className="relative z-10 md:absolute md:left-2 md:top-2 w-full md:w-1/3">
      {ClickInfo.layer.id === "TableView" ? (
        <div
          className={`p-3 bg-white text-xs shadow-md rounded-xl shadow-[rgba(0,0,0,0.75)] w-full border-4`}
          style={{
            borderColor: rgbToHex(
              StopTypeColors[ClickInfo.object.location_type_name]?.color
            ),
          }}
        >
          <h1 className="font-bold text-lg">{ClickInfo.object.stop_name}</h1>
          <div className="overflow-x-auto">
            <TableComponent
              Data={ClickInfo.object}
              ColumnsData={[
                "stop_id",
                "stop_lon",
                "stop_lat",
                "location_type_name",
                "wheelchair_boarding_name",
              ]}
              ColumnName={[
                "Stop Id",
                "Stop Lon",
                "Stop Lat",
                "Type",
                "Wheelchair Boarding",
              ]}
            />
          </div>
          <div className="flex flex-col gap-1 mt-4">
            <Button variant="outlined" onClick={handleClose} size="small">
              Close
            </Button>
          </div>
        </div>
      ) : ClickInfo.layer.id === "ArcLayer"|| ClickInfo.layer.id === "PointLayer" ? (
        <div
          className={`p-3 bg-white text-xs shadow-md rounded-xl shadow-[rgba(0,0,0,0.75)] w-full border-4`}
          style={{ borderColor: ArcPopup(ClickInfo.object) }}
        >
          <h1 className="font-bold text-lg">{ClickInfo.object.id}</h1>
          <div className="overflow-x-auto">
            <TableComponent
              Data={ClickInfo.object}
              ColumnsData={[
                "directional",
                "pathwayType",
                "timeInterval",
                "from_name",
                "from_coord",
                "to_name",
                "to_coord",
              ]}
              ColumnName={[
                "Direction Type",
                "Pathway Type",
                "Time Interval",
                "From Name",
                "From Coord",
                "To Name",
                "To Coord",
              ]}
            />
          </div>
          <div className="flex flex-col gap-1 mt-4">
            <Button variant="outlined" onClick={handleClose} size="small">
              Close
            </Button>
          </div>
        </div>
      ):null
    }
    </div>
  );
}

export default ClickPopup;
