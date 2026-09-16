import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { Form } from "@/components/ui/form"
import FormFieldsRenderer from "./FormFieldsRenderer"
import FormShell from "./shared/FormShell"

interface FormField {
  name: string
  label?: string
  type: "formField" | "map" | "routeLine"
  parts: any
}

interface FormComponentProps {
  inputData: FormField[]
  mutationFn: (data: any) => Promise<any>
  header: string
  buttonLabel: "Create" | "Edit"
  onSuccess?: (data?: any) => void
  onError?: (error: any) => void
  onReset?: () => void
  defaultValues?: Record<string, any>
  customActions?: ReactNode
  disableInputs?: boolean
  validationMode?: "onBlur" | "onChange" | "onSubmit" | "all"
  enableSubmitButton?: boolean
  onMutationStateChange?: (isPending: boolean) => void
  hideHeader?: boolean
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
  onMutationStateChange,
  hideHeader = false,
}: FormComponentProps) {
  const form = useForm({
    defaultValues,
    mode: validationMode,
    reValidateMode: validationMode === "all" ? "onChange" : validationMode,
    criteriaMode: "all",
    shouldFocusError: true,
  })

  const {
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = form

  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [submittedData, setSubmittedData] = useState<any>(null)

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data) => {
      reset(defaultValues)
      setSubmissionError(null)
      setSubmittedData(null)
      onSuccess?.(data)
    },
    onError: (error: any) => {
      setSubmissionError(error.message)
      setSubmittedData(null)
      onError?.(error)
    },
  })

  useEffect(() => {
    onMutationStateChange?.(mutation.isPending)
  }, [mutation.isPending, onMutationStateChange])

  const onSubmit = (data: any) => {
    setSubmissionError(null)
    setSubmittedData(data)
    mutation.mutate(data)
  }

  const handleReset = () => {
    reset(defaultValues)
    setSubmissionError(null)
    onReset?.()
  }

  const isBusy = mutation.isPending || disableInputs

  return (
    <Form {...form}>
      <FormShell
        onSubmit={handleSubmit(onSubmit)}
        isBusy={isBusy}
        isSubmitDisabled={
          !enableSubmitButton ||
          (buttonLabel === "Create" && !isValid) ||
          (buttonLabel === "Edit" && !isDirty)
        }
        submitLabel={buttonLabel}
        busyLabel={buttonLabel === "Edit" ? "Saving changes..." : "Creating..."}
        error={submissionError}
        onReset={handleReset}
        customActions={customActions}
        header={header}
        hideHeader={hideHeader}
      >
        <FormFieldsRenderer
          inputData={inputData}
          isLoading={isBusy}
          mode={buttonLabel === "Edit" ? "edit" : "add"}
          submittedData={mutation.isPending ? submittedData : null}
        />
      </FormShell>
    </Form>
  )
}

export default FormComponent
