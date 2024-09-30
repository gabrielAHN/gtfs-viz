import {
  Autocomplete,
  TextField,
  Select,
  OutlinedInput,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Skeleton,
} from "@mui/material";
import { HeaderObjectProps, RenderSelectProps } from "@/types/objectTypes";
import SearchComponent from "@/components/MuiComponent/SearchComponent";
import { useMemo, useCallback } from "react";

function Header(props: HeaderObjectProps) {
  const {
    SearchText,
    setSearchText,
    StopsIdData,
    StopIdDropdown,
    setStopIdDropdown,
    StopsNameData,
    StopNameDropDown,
    setStopNameDropDown,
    PathwaysStatusData,
    PathwaysStatusDropDown,
    setPathwaysStatusDropDown,
    WheelChairStatusDropDown,
    setWheelChairStatusDropDown,
    WheelchairStatusData,
  } = props;

  const renderSelect = useCallback(
    <T,>({ data, value, onChange, label }: RenderSelectProps<T>) => (
      <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select
          multiple
          value={value.length === 0 ? data : value}
          onChange={onChange}
          input={<OutlinedInput label={label} />}
          renderValue={(selected) => (
            <div className="flex flex-wrap gap-1">
              {(selected as T[]).map((val) => (
                <Chip key={String(val)} label={String(val)} />
              ))}
            </div>
          )}
        >
          {data.map((item) => (
            <MenuItem key={String(item)} value={item}>
              {String(item)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    ),
    []
  );

  const handleDropdownChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<any[]>>) =>
      (_event: any, value: any) =>
        setter(value),
    []
  );

  const dropdowns = useMemo(
    () => (
      <>
        <div className="flex-1 min-w-[200px] h-[56px]">
          {StopsIdData ? (
            <Autocomplete
              disablePortal
              value={StopIdDropdown}
              options={StopsIdData}
              onChange={handleDropdownChange(setStopIdDropdown)}
              renderInput={(params) => (
                <TextField {...params} label="Stops IDs" />
              )}
            />
          ) : (
            <Skeleton variant="rounded" height={56} />
          )}
        </div>
        <div className="flex-1 min-w-[200px] h-[56px]">
          {StopsNameData ? (
            <Autocomplete
              disablePortal
              value={StopNameDropDown}
              options={StopsNameData}
              onChange={handleDropdownChange(setStopNameDropDown)}
              renderInput={(params) => (
                <TextField {...params} label="Stops Names" />
              )}
            />
          ) : (
            <Skeleton variant="rounded" height={56} />
          )}
        </div>
      </>
    ),
    [
      StopsIdData,
      StopIdDropdown,
      StopsNameData,
      StopNameDropDown,
      setStopIdDropdown,
      setStopNameDropDown,
      handleDropdownChange,
    ]
  );

  return (
    <div className="flex flex-wrap gap-4 mb-5">
      <div className="flex flex-wrap lg:flex-nowrap w-full gap-4">
        <div className="flex-1 min-w-[200px] h-[56px]">
          <SearchComponent
            LabelSearch={"Search for a Station Name"}
            SearchText={SearchText}
            setSearchText={setSearchText}
          />
        </div>
        {dropdowns}
        <div className="flex flex-wrap w-full lg:w-auto gap-4">
          <div className="flex-1 min-w-[200px] h-[56px]">
            {PathwaysStatusData ? (
              renderSelect({
                data: PathwaysStatusData,
                value: PathwaysStatusDropDown,
                onChange: (event) =>
                  setPathwaysStatusDropDown(
                    event.target.value as typeof PathwaysStatusDropDown
                  ),
                label: "Pathways Status",
              })
            ) : (
              <Skeleton variant="rounded" height={56} />
            )}
          </div>
          <div className="flex-1 min-w-[200px] h-[56px]">
            {WheelchairStatusData ? (
              renderSelect({
                data: WheelchairStatusData,
                value: WheelChairStatusDropDown,
                onChange: (event) =>
                  setWheelChairStatusDropDown(
                    event.target.value as typeof WheelChairStatusDropDown
                  ),
                label: "Wheelchair Status",
              })
            ) : (
              <Skeleton variant="rounded" height={56} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
