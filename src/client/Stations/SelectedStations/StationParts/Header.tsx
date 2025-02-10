import Combobox from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton"
import { MultiSelect } from "@/components/ui/multiselect";
import { rgbToHex } from "@/components/colorUtil";
import { StopTypeColors } from "@/components/style";
import { Plus, RotateCcw } from "lucide-react"

function Header({
  StationPartTypes,
  LocationsList,
  setLocationsList,
  StationStopIds,
  StopsID,
  setStopsID,
  setOpen
}) {

  const handleReset = () => {
    setLocationsList([]);
    setStopsID();
  };
  
  const isResetDisabled =
  (LocationsList.length === 0) &&
  (!StopsID);

  const handleOpen = ({ formType }: { formType: string }) => {
    setOpen({ formType, state: true });
  };

  return (
    <div className="flex flex-col gap-4 mt-3 w-full">
      <div className="flex flex-col sm:flex-row md:flex-row lg:flex-row gap-4 w-full">
        <div className="flex flex-row sm:flex-row md:flex-row lg:flex-row gap-2 sm:gap-4">
          <Button
            variant="outline"
            onClick={() => handleOpen({ formType: "add" })}
            className="w-full sm:w-auto flex items-center justify-center"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Node
          </Button>
          <Button
            disabled={isResetDisabled}
            variant="outline"
            onClick={handleReset}
            className="w-full sm:w-auto flex items-center justify-center"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Reset
          </Button>
        </div>
        <div className="flex flex-col sm:flex-1 sm:flex-row gap-4 w-full">
          {StationStopIds ? (
            <Combobox
              Selections={StationStopIds.map((item) => item.label)}
              Message="Stop IDs"
              value={StopsID}
              setValue={(val) => setStopsID(val)}
            />
          ) : (
            <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
          )}
          {StationPartTypes ? (
            <MultiSelect
              options={StationPartTypes.map((item) => ({
                ...item,
                color: rgbToHex(StopTypeColors[item.label].color),
              }))}
              onValueChange={(newValue) => setLocationsList(newValue)}
              defaultValue={LocationsList}
              placeholder="Location Type"
            />
          ) : (
            <Skeleton className="h-12 rounded-md" />
          )}
        </div>
      </div>
    </div>
  );
}

export default Header;
