import Combobox from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multiselect";
import { rgbToHex } from "@/components/colorUtil";
import { getStopColor } from "@/components/style";
import { useThemeContext } from "@/context/theme.client";
import { BiPlus, BiReset } from "react-icons/bi";

interface PartsHeaderProps {
  StationPartTypes?: any[];
  LocationsList?: string[];
  setLocationsList?: (value: string[]) => void;
  StationStopIds?: any[];
  StopsID?: string;
  setStopsID?: (value: string | undefined) => void;
  WheelchairStatusData?: any[];
  WheelchairStatusList?: string[];
  setWheelchairStatusList?: (value: string[]) => void;
  EditStatusList?: string[];
  setEditStatusList?: (value: string[]) => void;
  setOpen?: (value: { formType: string; state: boolean }) => void;
  onReset?: () => void;
  hasEditedItems?: boolean;
}

function PartsHeader({
  StationPartTypes,
  LocationsList = [],
  setLocationsList,
  StationStopIds,
  StopsID,
  setStopsID,
  WheelchairStatusData,
  WheelchairStatusList = [],
  setWheelchairStatusList,
  EditStatusList = [],
  setEditStatusList,
  setOpen,
  onReset,
  hasEditedItems = false,
}: PartsHeaderProps) {
  const { theme } = useThemeContext();

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      setLocationsList?.([]);
      setStopsID?.(undefined);
      setWheelchairStatusList?.([]);
      setEditStatusList?.([]);
    }
  };

  const isResetDisabled = LocationsList.length === 0 && !StopsID && WheelchairStatusList.length === 0 && EditStatusList.length === 0;

  const handleOpen = ({ formType }: { formType: string }) => {
    setOpen?.({ formType, state: true });
  };

  return (
    <div className="flex flex-col w-full p-3 rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row md:flex-row lg:flex-row gap-4 w-full">
        <div className="flex flex-row sm:flex-row md:flex-row lg:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => handleOpen({ formType: "add" })}
            className="w-full sm:w-auto flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <BiPlus className="mr-2 h-4 w-4" />
            Add Node
          </Button>
          <Button
            disabled={isResetDisabled}
            variant="outline"
            onClick={handleReset}
            className="w-full sm:w-auto flex items-center justify-center disabled:opacity-50"
          >
            <BiReset className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
        <div className="flex flex-col sm:flex-1 sm:flex-row gap-3 w-full">
          {StationStopIds ? (
            <Combobox
              Selections={StationStopIds.map((item) => item.value)}
              Message="Stop IDs"
              value={StopsID}
              setValue={(val) => setStopsID?.(val)}
            />
          ) : (
            <Skeleton className="h-10 rounded-md flex-1 min-w-[200px]" />
          )}
          {StationPartTypes ? (
            <MultiSelect
              key={`location-types-${StationPartTypes.map((t) => t.label)
                .sort()
                .join("-")}`}
              options={StationPartTypes.map((item) => ({
                ...item,
                color: rgbToHex(getStopColor(item.label, theme)),
              }))}
              onValueChange={(newValue) => setLocationsList?.(newValue)}
              defaultValue={LocationsList}
              placeholder="Location Type"
            />
          ) : (
            <Skeleton className="h-10 rounded-md flex-1" />
          )}
          {WheelchairStatusData ? (
            <MultiSelect
              options={WheelchairStatusData}
              onValueChange={(newValue) => setWheelchairStatusList?.(newValue)}
              defaultValue={WheelchairStatusList}
              placeholder="Wheelchair Status"
            />
          ) : (
            <Skeleton className="h-10 rounded-md flex-1" />
          )}
          {hasEditedItems && (
            <MultiSelect
              options={[
                { label: "Yes", value: "edited" },
                { label: "No", value: "not_edited" },
              ]}
              onValueChange={(newValue) => setEditStatusList?.(newValue)}
              defaultValue={EditStatusList}
              placeholder="Edited"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default PartsHeader;
