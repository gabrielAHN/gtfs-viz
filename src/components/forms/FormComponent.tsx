import { useState, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import FormFieldsRenderer from "./FormFieldsRenderer";

interface FormField {
  name: string;
  label: string;
  type: "formField" | "map";
  parts: any;
}

export type LocationTypeConfig = {
  show: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
  required?: boolean;
};

export const LOCATION_TYPE_CONFIGS = {
  STOP: {
    show: false,
    defaultValue: "Stop",
    required: false,
  } as LocationTypeConfig,

  STATION: {
    show: false,
    defaultValue: "Station",
    required: false,
  } as LocationTypeConfig,

  NODE: {
    show: true,
    options: [
      { value: "Exit/Entrance", label: "Exit/Entrance" },
      { value: "Pathway Node", label: "Pathway Node" },
      { value: "Boarding Area", label: "Boarding Area" },
    ],
    required: true,
  } as LocationTypeConfig,
};

interface FormComponentProps {
  inputData: FormField[];
  mutationFn: (data: any) => Promise<any>;
  header: string;
  buttonLabel: "Create" | "Edit";
  onSuccess?: (data?: any) => void;
  onError?: (error: any) => void;
  onReset?: () => void;
  defaultValues?: Record<string, any>;
  customActions?: ReactNode;
  disableInputs?: boolean;
  validationMode?: "onBlur" | "onChange" | "onSubmit" | "all";
  enableSubmitButton?: boolean;
  locationType?: LocationTypeConfig;
  onMutationStateChange?: (isPending: boolean) => void;
}

function FormComponent({
  inputData,
  mutationFn,
  header,
  buttonLabel,
  onSuccess,
  onError,
  onReset,
  defaultValues = {},
  customActions,
  disableInputs = false,
  validationMode = "onBlur",
  enableSubmitButton = true,
  locationType,
  onMutationStateChange,
}: FormComponentProps) {
  const form = useForm({
    defaultValues,
    mode: validationMode, 
    reValidateMode: validationMode, 
    criteriaMode: "all", 
    shouldFocusError: true,
  });

  const {
    handleSubmit,
    reset,
    formState: { isDirty, isValid, dirtyFields, touchedFields },
  } = form;

  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data) => {
      reset(defaultValues);
      setSubmissionError(null);
      setSubmittedData(null); 
      onSuccess?.(data);
    },
    onError: (error: any) => {
      setSubmissionError(error.message);
      setSubmittedData(null); 
      onError?.(error);
    },
  });

  useEffect(() => {
    onMutationStateChange?.(mutation.isPending);
  }, [mutation.isPending, onMutationStateChange]);

  const onSubmit = (data: any) => {
    setSubmissionError(null);
    setSubmittedData(data); 
    mutation.mutate(data);
  };

  const handleReset = () => {
    reset(defaultValues);
    setSubmissionError(null);
    onReset?.();
  };

  const enhancedInputData = useMemo(() => {
    if (!locationType || !locationType.show) {
      return inputData;
    }

    const nameIndex = inputData.findIndex((field) => field.name === "name");
    const insertIndex = nameIndex >= 0 ? nameIndex + 1 : 1;

    const locationTypeField = {
      name: "location_type_name",
      label: "Location Type",
      type: "formField" as const,
      parts: {
        renderInput: ({ value, onChange, ref, disabled }: any) => (
          <Select
            value={value || ""}
            onValueChange={(val) => {
              onChange(val);
            }}
            disabled={disabled}
          >
            <SelectTrigger ref={ref}>
              <SelectValue placeholder="Select Location Type" />
            </SelectTrigger>
            <SelectContent>
              {locationType.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        rules: locationType.required
          ? {
              required: "Location Type is required",
            }
          : undefined,
      },
    };

    const newInputData = [...inputData];
    newInputData.splice(insertIndex, 0, locationTypeField);
    return newInputData;
  }, [inputData, locationType]);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <h2 className="text-2xl font-bold mb-2">{header}</h2>
        <FormFieldsRenderer
          inputData={enhancedInputData}
          isLoading={mutation.isPending || disableInputs}
          mode={buttonLabel === "Edit" ? "edit" : "add"}
          submittedData={mutation.isPending ? submittedData : null}
        />
        <div className="flex gap-4 mt-3 pt-2">
          <Button
            type="submit"
            variant="outline"
            disabled={
              !enableSubmitButton ||
              mutation.isPending ||
              disableInputs ||
              (buttonLabel === "Create" && !isValid) ||
              (buttonLabel === "Edit" && !isDirty)
            }
            className={`px-6 py-2 ${
              submissionError
                ? "bg-destructive text-destructive-foreground"
                : ""
            }`}
          >
            {mutation.isPending
              ? buttonLabel === "Edit"
                ? "Editing..."
                : "Creating..."
              : submissionError
                ? "Retry"
                : buttonLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            disabled={mutation.isPending || disableInputs}
            className="px-6 py-2"
          >
            Reset
          </Button>
          {customActions}
        </div>
      </form>
    </Form>
  );
}

export default FormComponent;
