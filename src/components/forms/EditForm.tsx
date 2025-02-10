import { useFormContext } from "react-hook-form"
import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form"
import MapInput from "./MapInput"

function EditFormUI({
    inputData
}) {
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
                            render={({ field, fieldState }) => {
                                return (
                                    <FormItem className="flex flex-col mb-4">

                                        <FormLabel className="text-lg">{label}</FormLabel>
                                        <FormControl>
                                            {parts.renderInput({
                                                ...field,
                                                ref: field.ref,
                                            })}
                                        </FormControl>
                                        {fieldState.error && (
                                            <FormMessage className="text-red-500">
                                                {fieldState.error.message}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                )
                            }}
                        />
                    );
                } else if (type === "map") {
                    return <MapInput key="map" parts={parts} control={control} />;
                }
                return null;
            })}
        </div>
    )
}

export default EditFormUI
