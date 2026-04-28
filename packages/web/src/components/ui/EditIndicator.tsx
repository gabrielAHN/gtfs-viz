import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BiPencil, BiPlus } from "react-icons/bi";

interface EditIndicatorProps {
  status?: string;
  className?: string;
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "edit":
      return "Edited Existing";
    case "new":
    case "new edit":
      return "New";
    default:
      return "Modified";
  }
};

const getStatusKind = (status?: string | null): "edit" | "new" | null => {
  if (status === "new" || status === "new edit") {
    return "new";
  }

  if (status === "edit") {
    return "edit";
  }

  return null;
};

export function EditIndicator({
  status,
  className = "h-6 w-6",
}: EditIndicatorProps) {
  const statusKind = getStatusKind(status);

  if (!statusKind || !status) return null;

  const label = getStatusLabel(status);

  return (
    <span className="inline-block relative group">
      <Avatar className={className}>
        <AvatarFallback className="bg-primary">
          {statusKind === "new" ? (
            <BiPlus className="h-4 w-4" />
          ) : (
            <BiPencil className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
        {label}
      </span>
    </span>
  );
}
