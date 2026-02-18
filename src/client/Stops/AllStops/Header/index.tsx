import { BiPlus, BiReset } from "react-icons/bi";
import Combobox from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multiselect";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

interface HeaderProps {
  setOpen: (openState: { formType: string; state: boolean }) => void;
  StopsIdData: Array<{ label: string }>;
  StopIdDropdown: string;
  setStopIdDropdown: (value: string) => void;
  StopsNameData: Array<{ label: string }>;
  StopNameDropDown: string;
  setStopNameDropDown: (value: string) => void;
  LocationTypeData: Array<{ label: string; value: string }>;
  LocationTypeDropDown: string[];
  setLocationTypeDropDown: (values: string[]) => void;
  WheelChairStatusData: Array<{ label: string; value: string }>;
  WheelChairStatusDropDown: string[];
  setWheelChairStatusDropDown: (values: string[]) => void;
  EditStatusDropDown?: string[];
  setEditStatusDropDown?: (values: string[]) => void;
  onResetFilters?: () => void;
  isResetDisabled?: boolean;
  hasEditedItems?: boolean;
}

const Header: React.FC<HeaderProps> = (props) => {
  const {
    setOpen,
    StopsIdData,
    StopIdDropdown,
    setStopIdDropdown,
    StopsNameData,
    StopNameDropDown,
    setStopNameDropDown,
    LocationTypeData,
    LocationTypeDropDown,
    setLocationTypeDropDown,
    WheelChairStatusDropDown,
    setWheelChairStatusDropDown,
    WheelChairStatusData,
    EditStatusDropDown = [],
    setEditStatusDropDown,
    onResetFilters,
    isResetDisabled: isResetDisabledProp,
    hasEditedItems = false
  } = props;

  const handleOpen = ({ formType }: { formType: string }) => {
    setOpen({ formType, state: true });
  };

  const isResetDisabled =
    isResetDisabledProp !== undefined ? isResetDisabledProp :
    (!StopIdDropdown || StopIdDropdown.trim() === "") &&
    (!StopNameDropDown || StopNameDropDown.trim() === "") &&
    (!LocationTypeDropDown || LocationTypeDropDown.length === 0) &&
    (!WheelChairStatusDropDown || WheelChairStatusDropDown.length === 0) &&
    (!EditStatusDropDown || EditStatusDropDown.length === 0);

  const handleReset = () => {
    setStopIdDropdown("");
    setStopNameDropDown("");
    setLocationTypeDropDown([]);
    setWheelChairStatusDropDown([]);
    setEditStatusDropDown?.([]);
    if (onResetFilters) {
      onResetFilters();
    }
  };

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col sm:flex-col md:flex-row lg:flex-row lg:items-center lg:justify-start gap-4 w-full">
        <Button
          variant="outline"
          disabled={!WheelChairStatusData}
          onClick={() => handleOpen({ formType: "add" })}
          className="w-full md:w-auto flex items-center justify-center"
        >
          <BiPlus className="mr-2 h-5 w-5" />
          Stop
        </Button>
        <Button
          disabled={isResetDisabled}
          variant="outline"
          onClick={handleReset}
          className="w-full md:w-auto flex items-center justify-center"
        >
          <BiReset className="mr-2 h-5 w-5" />
          Reset
        </Button>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${hasEditedItems ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-2 mb-1`}>
        <div className="col-span-1">
          {StopsNameData ? (
            <Combobox
              Selections={StopsNameData.map((item) => item.label)}
              Message="Stop Name"
              value={StopNameDropDown}
              setValue={(val) => setStopNameDropDown(val)}
            />
          ) : (
            <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
          )}
        </div>
        <div className="col-span-1">
          {StopsIdData ? (
            <Combobox
              Selections={StopsIdData.map((item) => item.label)}
              Message="Stop ID"
              value={StopIdDropdown}
              setValue={(val) => setStopIdDropdown(val)}
            />
          ) : (
            <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
          )}
        </div>
        <div className="col-span-1">
          {LocationTypeData ? (
            <MultiSelect
              options={LocationTypeData}
              onValueChange={(newValue) => setLocationTypeDropDown(newValue)}
              defaultValue={LocationTypeDropDown}
              placeholder="Location Type"
            />
          ) : (
            <Skeleton className="h-12 rounded-md" />
          )}
        </div>
        <div className="col-span-1">
          {WheelChairStatusData ? (
            <MultiSelect
              options={WheelChairStatusData}
              onValueChange={(newValue) => setWheelChairStatusDropDown(newValue)}
              defaultValue={WheelChairStatusDropDown}
              placeholder="Wheelchair Status"
            />
          ) : (
            <Skeleton className="h-12 rounded-md" />
          )}
        </div>
        {hasEditedItems && (
          <div className="col-span-1">
            <MultiSelect
              options={[
                { label: "Yes", value: "edited" },
                { label: "No", value: "not_edited" },
              ]}
              onValueChange={(newValue) => setEditStatusDropDown?.(newValue)}
              defaultValue={EditStatusDropDown}
              placeholder="Edited"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
