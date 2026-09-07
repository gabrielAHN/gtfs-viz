import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface FormActionsProps {
  isBusy: boolean
  /** Required fields are filled and valid */
  isValid: boolean
  /** Form data has changed from initial state (for edit) or has data (for add) */
  hasChanges: boolean
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
  busyLabel?: string
  cancelLabel?: string
  error?: string | null
  children?: ReactNode
}

/**
 * Shared form wrapper with save/cancel buttons and busy overlay.
 * Save is enabled only when isValid AND hasChanges are both true.
 * When busy, an overlay covers the entire form content and buttons.
 */
export function FormActions({
  isBusy,
  isValid,
  hasChanges,
  onSave,
  onCancel,
  saveLabel = "Save",
  busyLabel = "Saving...",
  cancelLabel = "Cancel",
  error,
  children,
}: FormActionsProps) {
  const canSave = isValid && hasChanges && !isBusy

  return (
    <div className="relative min-h-0">
      {children}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive mt-2">
          {error}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} disabled={!canSave} className="flex-1">
          {saveLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isBusy}>
          {cancelLabel}
        </Button>
      </div>
      {isBusy && (
        <div className="absolute inset-0 z-10 rounded-md bg-background/80 backdrop-blur-[2px]">
          <div className="sticky top-1/3 flex items-center justify-center py-8">
            <div className="rounded-md border bg-background px-5 py-3 text-sm font-medium shadow-md flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {busyLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
