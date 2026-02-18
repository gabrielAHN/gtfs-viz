import { useState, useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"

import EditFormUI from "./EditForm"
import AddFormUI from "./AddForm"

interface FormComponentProps {
  inputData: any[]
  mutationFn: (data: any) => Promise<any>
  header: string
  buttonLabel: "Create" | "Edit"
  onSuccess?: () => void
  onError?: (error: any) => void
  defaultValues?: Record<string, any>
}

function FormComponent({
  inputData,
  mutationFn,
  header,
  buttonLabel,
  onSuccess,
  onError,
  defaultValues = {},
}: FormComponentProps) {
  const form = useForm({
    defaultValues,
    mode: "all",
  })

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, dirtyFields },
  } = form

  const [submissionError, setSubmissionError] = useState < string | null > (null)

  const mutation = useMutation({
    mutationFn,
    onSuccess: () => {
      reset(defaultValues)
      setSubmissionError(null)
      onSuccess?.()
    },
    onError: (error: any) => {
      setSubmissionError(error.message)
      onError?.(error)
    },
  })

  const onSubmit = (data: any) => {
    setSubmissionError(null)

    if (buttonLabel === "Create") {
      mutation.mutate(data)
      return
    }

    mutation.mutate(data)
  }

  const handleReset = () => {
    reset(defaultValues)
    setSubmissionError(null)
  }

  const watchAllValues = watch()
  const allFieldsFilled = useMemo(() => {
    return Object.keys(defaultValues).every(
      (field) => watchAllValues[field] !== "" || watchAllValues['parent_station'] === ''
    )
  }, [defaultValues, watchAllValues])

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="text-3xl font-bold">{header}</label>
        {buttonLabel === "Edit" && (
          <EditFormUI key='edit' inputData={inputData} defaultValues={defaultValues} />
        )}
        {buttonLabel === "Create" && <AddFormUI key='add' inputData={inputData} />}
        <div className="flex gap-4 mt-4">
          <Button
            type="submit"
            variant="outline"
            disabled={
              buttonLabel === "Create"
                ? !allFieldsFilled
                : !isDirty && !submissionError
            }
            className={`px-6 py-2 ${submissionError ? "bg-red-500 text-white" : ""
              }`}
          >
            {mutation.isLoading
              ? "Processing..."
              : submissionError
                ? "Error"
                : buttonLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            disabled={!isDirty}
            className="px-6 py-2"
          >
            Reset
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default FormComponent
