export const doesRowPassInitialFilters = ({
  row,
  StartDropdown,
  EndDropdown,
  EmptyConnect,
}) => {
  const { start_stop, end_stop, shortest_time } = row;

  if (StartDropdown && start_stop !== StartDropdown) {
    return false;
  }

  if (EndDropdown && end_stop !== EndDropdown) {
    return false;
  }

  if (EmptyConnect && (shortest_time === null || shortest_time === undefined)) {
    return false;
  }

  return true;
};
