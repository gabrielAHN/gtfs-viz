import { BiPencil } from "react-icons/bi"

interface EditIndicatorProps {
  status?: string
  className?: string
}

const getStatusKind = (status?: string | null): "edit" | "new" | "deleted" | null => {
  if (status === "new" || status === "new edit") return "new"
  if (status === "edit") return "edit"
  if (status === "deleted") return "deleted"
  return null
}

export function EditIndicator({ status, className = "h-5 w-5" }: EditIndicatorProps) {
  const statusKind = getStatusKind(status)

  if (!statusKind || !status) return null

  return (
    <span className="inline-flex relative group shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full ${className} ${
          statusKind === "new"
            ? "bg-green-100 dark:bg-green-900/40"
            : statusKind === "deleted"
              ? "bg-red-100 dark:bg-red-900/40"
              : "bg-amber-100 dark:bg-amber-900/40"
        }`}
      >
        {statusKind === "new" ? (
          <span className="text-[9px] leading-none flex items-center justify-center">🆕</span>
        ) : statusKind === "deleted" ? (
          <BiPencil className="h-3 w-3 text-red-600 dark:text-red-400" />
        ) : (
          <BiPencil className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        )}
      </span>
      <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
        {statusKind === "new" ? "New" : statusKind === "deleted" ? "Deleted" : "Edited"}
      </span>
    </span>
  )
}
