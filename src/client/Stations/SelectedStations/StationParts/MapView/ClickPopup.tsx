import { Button } from "@mui/material";
import { StopTypeColors } from "@/util/gtfsStyling";
import TableComponent from "@/components/MuiComponent/TableComponent";
import { rgbToHex } from "@/util/colorUtil";

function ClickPopup({ ClickInfo, setClickInfo }) {
  const handleClose = () => {
    setClickInfo(null);
  };

  return (
    <div
      className="relative z-10 md:absolute md:left-2 md:top-2 w-full md:w-1/3
     "
    >
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
            Title="Station Info"
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
    </div>
  );
}

export default ClickPopup;
