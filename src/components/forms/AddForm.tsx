import { useFormContext } from "react-hook-form"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import MapInput from "./MapInput"

function AddFormUI({ inputData }) {
  const { control } = useFormContext()

  return (
    <div>
      {inputData.map(({ name, label, type, parts }) => {
        if (type === "formField" && parts.renderInput) {
          return (
            <FormField
              key={name}
              control={control}
              name={name}
              rules={parts.rules}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>{parts.renderInput(field)}</FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        } else if (type === "map") {
          return <MapInput key="map" parts={parts} control={control} />;
        }
        return null;
      })}
    </div>
  );
}

export default AddFormUI
