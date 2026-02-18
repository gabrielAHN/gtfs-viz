import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Select
      onValueChange={(value) => {
        const selectedItem = ExampleDataDict.find(
          (item) => item.name === value
        );
        if (selectedItem) {
          handleExampleFileUpload(selectedItem.url);
        }
      }}
    >
      <SelectTrigger className="w-[30vh] text-center">
        <SelectValue
          placeholder="Example Datasets"
          className="text-center text-gray-500"
        />
      </SelectTrigger>
      <SelectContent>
        {ExampleDataDict.map((item, index) => (
          <SelectItem key={index} value={item.name}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
