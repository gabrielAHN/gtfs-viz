import { InputLabel, MenuItem, FormControl, Select } from "@mui/material";

export const ExampleDataDict = [
  {
    name: "Boston MBTA GTFS",
    url: "https://www.googleapis.com/download/storage/v1/b/mdb-latest/o/us-massachusetts-massachusetts-bay-transportation-authority-mbta-gtfs-437.zip?alt=media",
  },
  {
    name: "San Diego Metro GTFS",
    url: "https://storage.googleapis.com/storage/v1/b/mdb-latest/o/us-california-san-diego-international-airport-metropolitan-transit-system-mts-gtfs-13.zip?alt=media",
  },
  {
    name: "Budapest Metro GTFS",
    url: "https://storage.googleapis.com/storage/v1/b/mdb-latest/o/hu-budapest-budapesti-kozlekedesi-kozpont-bkk-gtfs-990.zip?alt=media",
  },
  {
    name: "Paris Metro GTFS",
    url: "https://storage.googleapis.com/storage/v1/b/mdb-latest/o/fr-paris-ile-de-france-mobilite-gtfs-1026.zip?alt=media",
  },
];

export default function ExampleDatasets({ handleExampleFileUpload }) {
  return (
    <FormControl fullWidth>
      <InputLabel>Example Datasets</InputLabel>
      <Select
        label="Example Datasets"
        value=""
        onChange={handleExampleFileUpload}
      >
        {ExampleDataDict.map((item, index) => (
          <MenuItem key={index} value={item}>
            {item.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
