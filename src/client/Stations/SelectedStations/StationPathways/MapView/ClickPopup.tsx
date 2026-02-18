
import {
  StopTypeColors,
  PathwayColors,
  ConnectTypeColors,
} from "@/components/style";
import PopupTable from "@/components/table/PopupTable";
import { X } from "lucide-react"
import { rgbToHex } from "@/components/colorUtil";

function ClickPopup({
  ClickInfo,
  setClickInfo,
  ConnectionType,
  timeIntervalRanges,
}) {
  const handleClose = () => {
    setClickInfo();
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
    <div className="relative z-10 md:absolute md:left-5 md:top-4 w-full md:w-[40vh]">
      {
        ClickInfo?.layer?.id == "TableView" && (
          <div
            className={`bg-white dark:bg-stone-900 p-4 rounded-md border-4 relative`}
            style={{ borderColor: rgbToHex(StopTypeColors[ClickInfo.object.location_type_name]?.color) }}
          >
            <div className="flex justify-between items-center mb-4">
              <h1 className="font-bold text-lg">{ClickInfo.object.stop_name}</h1>
              <X
                className="w-[2vh]"
                onClick={handleClose}
              />
            </div>
            <PopupTable
              Data={ClickInfo.object}
              ColumnsData={[
                "stop_id",
                "stop_lon",
                "stop_lat",
                "status",
                "location_type_name",
                "wheelchair_status",
              ]}
              ColumnName={[
                "Stop Id",
                "Stop Lon",
                "Stop Lat",
                "Status",
                "Location Type",
                "Wheelchair Boarding",
              ]}
            />
          </div>
        )
      }
      {(ClickInfo?.layer?.id === "ArcLayer" || ClickInfo?.layer?.id === "PointLayer") && (() => {
        const ConnectionData = {
          ...ClickInfo.object,
          from_Lat: ClickInfo.object.from_coord[0],
          from_Lon: ClickInfo.object.from_coord[1],
          to_Lat: ClickInfo.object.to_coord[0],
          to_Lon: ClickInfo.object.to_coord[1],
        };

        return (
          <div
            className="bg-white dark:bg-stone-900 p-4 rounded-md border-4 relative "
            style={{ borderColor: ArcPopup(ClickInfo.object) }}
          >
            <div className="flex justify-between items-center mb-4">
              <h1 className="font-bold text-lg">{ClickInfo.object.id}</h1>
              <X className="w-[2vh]" onClick={handleClose} />
            </div>
            <div className="h-[50vh] overflow-y-auto">
              <PopupTable
                Data={ConnectionData}
                ColumnsData={[
                  "directional",
                  "pathwayType",
                  "timeInterval",
                  "from_name",
                  "from_Lat",
                  "from_Lon",
                  "to_name",
                  "to_Lat",
                  "to_Lon",
                ]}
                ColumnName={[
                  "Direction Type",
                  "Pathway Type",
                  "Time Interval",
                  "From Name",
                  "From Latitude",
                  "From Longitude",
                  "To Name",
                  "To Latitude",
                  "To Longitude",
                ]}
              />
            </div>
          </div>
        );
      })()}

    </div>
  );
}

export default ClickPopup;
