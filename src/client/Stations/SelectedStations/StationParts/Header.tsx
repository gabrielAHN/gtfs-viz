import { useEffect, ChangeEvent } from "react";
import {
  Select,
  OutlinedInput,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Autocomplete,
  TextField,
  Skeleton,
} from "@mui/material";
import { StopTypeColors } from "@/util/gtfsStyling";
import SearchComponent from "@/components/MuiComponent/SearchComponent";
import { rgbToHex } from "@/util/colorUtil";
import { LocationType } from "@/types/objectTypes";

function Header({
  StationLocationList,
  SearchText,
  setSearchText,
  LocationsList,
  setLocationsList,
  StationStopIds,
  StopsID,
  setStopsID,
}) {
  useEffect(() => {
    if (StationLocationList) {
      setLocationsList(StationLocationList.StationPartsData);
    }
  }, [StationLocationList, setLocationsList]);

  useEffect(() => {
    if (LocationsList.length === 0 && StationLocationList) {
      setLocationsList(StationLocationList.StationPartsData);
    }
  }, [LocationsList, StationLocationList, setLocationsList]);

  const handleDropdownChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedLocationTypeNames = event.target.value as string[];

    if (selectedLocationTypeNames.length === 0) {
      setLocationsList(StationLocationList?.StationPartsData || []);
      return;
    }

    const selectedValues = selectedLocationTypeNames
      .map((locationTypeName) =>
        StationLocationList?.StationPartsData.find(
          (item) => item.location_type_name === locationTypeName
        )
      )
      .filter(Boolean) as LocationType[];

    setLocationsList(selectedValues);
  };

  const handleStopIdDropdownChange = (_event: any, value: string | null) => {
    setStopsID(value);

    if (value) {
      const matchingLocation = StationLocationList?.StationPartsData.find(
        (location) => location.stop_id === value
      );

      if (matchingLocation) {
        setLocationsList([matchingLocation]);
        return;
      }
    }

    if (StationLocationList) {
      setLocationsList(StationLocationList.StationPartsData);
    }
  };

  return (
    <div className="flex flex-col gap-4 mt-3 w-full">
      <div className="flex flex-wrap lg:flex-nowrap w-full gap-4">
        <div className="flex-1 min-w-[200px]">
          <SearchComponent
            LabelSearch="Search Stop Id or Name"
            SearchText={SearchText}
            setSearchText={setSearchText}
          />
        </div>
        <div className="flex-1 min-w-[300px]">
          {StationStopIds ? (
            <Autocomplete
              disablePortal
              disabled={StationStopIds?.StopIdsData.length === 0}
              value={StopsID ?? ""}
              options={StationStopIds.StopIdsData.map((item) => item.stop_id)}
              onChange={handleStopIdDropdownChange}
              isOptionEqualToValue={(option, value) =>
                option.value === value.value
              }
              renderInput={(params) => (
                <TextField {...params} label="Stop ID" />
              )}
            />
          ) : (
            <Skeleton variant="rounded" height={50} />
          )}
        </div>
        <div className="flex-1 min-w-[200px]">
          {StationLocationList ? (
            <FormControl fullWidth>
              <InputLabel>Locations List</InputLabel>
              <Select
                multiple
                disabled={LocationsList.length === 0}
                value={LocationsList.map((item) => item.location_type_name)}
                onChange={handleDropdownChange}
                input={<OutlinedInput label="Locations List" />}
                renderValue={(selected) => (
                  <div className="flex flex-wrap gap-1">
                    {(selected as string[]).map((locationTypeName) => (
                      <Chip
                        key={locationTypeName}
                        label={locationTypeName}
                        style={{
                          backgroundColor: rgbToHex(
                            StopTypeColors[locationTypeName]?.color || [
                              107, 114, 128,
                            ]
                          ),
                          color: "white",
                        }}
                      />
                    ))}
                  </div>
                )}
              >
                {StationLocationList.StationPartsData.map((item) => (
                  <MenuItem
                    key={item.location_type_name}
                    value={item.location_type_name}
                  >
                    {item.location_type_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Skeleton variant="rounded" height={50} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Header;
