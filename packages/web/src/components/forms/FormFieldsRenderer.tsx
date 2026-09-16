import { useFormContext } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import MapInput from "./MapInput"
import RouteLineInput from "./RouteLineInput"

interface FormFieldsRendererProps {
  inputData: any[]
  isLoading?: boolean
  mode?: "add" | "edit"
  submittedData?: any | null
}

function FormFieldsRenderer({
  inputData,
  isLoading = false,
  mode = "add",
  submittedData = null,
}: FormFieldsRendererProps) {
  const { control, trigger } = useFormContext()
  const isEditMode = mode === "edit"

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
                const displayValue = isLoading && submittedData ? submittedData[name] : field.value

                const shouldShowError =
                  !isLoading && fieldState.error && (fieldState.isTouched || fieldState.isDirty)

                const wrappedOnChange = async (value: any) => {
                  field.onChange(value)
                  await trigger(name)
                }

                return (
                  <FormItem className={isEditMode ? "flex flex-col mb-4" : ""}>
                    <FormLabel className={isEditMode ? "text-lg" : ""}>{label}</FormLabel>
                    {!isLoading && parts.editLabel && (
                      <div className="text-xs text-muted-foreground">
                        Current: {parts.editLabel}
                      </div>
                    )}
                    <FormControl>
                      {parts.renderInput({
                        ...field,
                        onChange: wrappedOnChange,
                        value: displayValue,
                        ref: field.ref,
                        disabled: isLoading,
                      })}
                    </FormControl>
                    {shouldShowError && (
                      <FormMessage className="text-destructive">
                        {fieldState.error?.message}
                      </FormMessage>
                    )}
                  </FormItem>
                )
              }}
            />
          )
        } else if (type === "map") {
          return (
            <MapInput
              key="map"
              parts={parts}
              control={control}
              isLoading={isLoading}
              submittedData={submittedData}
            />
          )
        } else if (type === "routeLine") {
          return (
            <RouteLineInput
              key={name}
              name={name}
              label={label}
              parts={parts}
              control={control}
              isLoading={isLoading}
              submittedData={submittedData}
              mode={mode}
            />
          )
        }
        return null
      })}
    </div>
  )
}

export default FormFieldsRenderer
