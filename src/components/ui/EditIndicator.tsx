import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BiPencil } from "react-icons/bi";

interface EditIndicatorProps {
  status?: string;
  className?: string;
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "edit":
      return "Edited";
    case "new":
      return "New";
    case "new edit":
      return "New & Edited";
    default:
      return "Modified";
  }
};

export function EditIndicator({
  status,
  className = "h-6 w-6",
}: EditIndicatorProps) {
  const isEdited =
    status === "edit" || status === "new" || status === "new edit";

  if (!isEdited) return null;

  const label = getStatusLabel(status);

  return (
    <span className="inline-block relative group">
      <Avatar className={className}>
        <AvatarFallback className="bg-primary">
          <BiPencil className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
        {label}
      </span>
    </span>
  );
}
