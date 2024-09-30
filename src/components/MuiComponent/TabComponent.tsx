import { ToggleButton, ToggleButtonGroup } from "@mui/material";

function ToggleComponent({ TabList, ToggleValue, setToggleValue, sizeTab }) {
  const changeTab = (event, newView) => {
    setToggleValue(newView);
  };

  return (
    <ToggleButtonGroup
      size={sizeTab}
      value={ToggleValue}
      exclusive
      onChange={changeTab}
    >
      {TabList.map((tab) => (
        <ToggleButton
          key={tab.value}
          size={sizeTab}
          value={tab.value}
          className="flex items-center justify-center"
        >
          {tab.icon && tab.icon}
          <span className={tab.icon ? "ml-2" : ""}>{tab.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export default ToggleComponent;