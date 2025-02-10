
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import FormComponent from "@/components/forms/FormComponent"

function EditStationForm({ Data, mutationFn, handleSuccess, SelectStation }) {
  const inputData = [
    {
      name: "name",
      label: "Name",
      type: "formField",
      parts: {
        editLabel: SelectStation.stop_name,
        renderInput: (field) => (
          <Input
            ref={field.ref}
            type="text"
            placeholder="eg. Place de la Concorde"
            value={field.value}
            onChange={field.onChange}
          />
        ),
      }
    },
    {
      name: "wheelchair",
      label: "Wheelchair Accessible",
      type: "formField",
      parts: {
        editLabel: SelectStation.wheelchair_status,
        renderInput: (field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectTrigger ref={field.ref}>
              <SelectValue placeholder="Station Wheelchair Accessible" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="🟡">No Information 🟡</SelectItem>
              <SelectItem value="✅">Accessible ✅</SelectItem>
              <SelectItem value="❌">Not Accessible ❌</SelectItem>
            </SelectContent>
          </Select>
        ),
      }
    },
    {
      name: "location",
      type: "map",
      parts: {
        data: [Data],
        lat: {
          name: "lat",
          label: "Latitude",
          editLabel: SelectStation.stop_lat,
          renderInput: (field) => (
            <Input
              ref={field.ref}
              type="number"
              placeholder="eg. 48.865"
              step={0.00000000000000001}
              value={field.value}
              onChange={field.onChange}
            />
          ),
          rules: {
            min: { value: -90, message: "Latitude must be >= -90" },
            max: { value: 90, message: "Latitude must be <= 90" },
          },
        },
        lon: {
          name: "lon",
          label: "Longitude",
          editLabel: SelectStation.stop_lon,
          renderInput: (field) => (
            <Input
              ref={field.ref}
              type="number"
              placeholder="eg. 2.321"
              step={0.00000000000000001}
              value={field.value}
              onChange={field.onChange}
            />
          ),
          rules: {
            min: { value: -180, message: "Longitude must be >= -180" },
            max: { value: 180, message: "Longitude must be <= 180" },
          },
        },
      }
    }
  ]

  return (
    <FormComponent
      inputData={inputData}
      mutationFn={mutationFn}
      header="Edit Station test"
      buttonLabel="Edit"
      onSuccess={handleSuccess}
      defaultValues={{
        stopId: SelectStation.stop_id || "",
        name: SelectStation.stop_name || "",
        wheelchair: SelectStation.wheelchair_status || "",
        location_type_name: SelectStation.location_type_name,
        parent_station: SelectStation.parent_station,
        lat: SelectStation.stop_lat || "",
        lon: SelectStation.stop_lon || "",
      }}
    />
  )
}

export default EditStationForm
