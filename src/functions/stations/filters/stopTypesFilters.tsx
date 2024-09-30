export const doesRowPassStopTypesFilters = ({
  row,
  StartStopTypesDropdown,
  EndStopTypesDropdown,
}) => {
  const startType = row.from_location_type_name || "Unknown";
  const endType = row.to_location_type_name || "Unknown";

  if (
    Array.isArray(StartStopTypesDropdown) &&
    StartStopTypesDropdown.length > 0 &&
    !StartStopTypesDropdown.includes(startType)
  ) {
    return false;
  }

  if (
    Array.isArray(EndStopTypesDropdown) &&
    EndStopTypesDropdown.length > 0 &&
    !EndStopTypesDropdown.includes(endType)
  ) {
    return false;
  }

  return true;
};
