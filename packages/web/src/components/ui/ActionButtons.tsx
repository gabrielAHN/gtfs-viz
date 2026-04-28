import { Button } from "@/components/ui/button";
import { BiPencil, BiTrash } from "react-icons/bi";

interface EditButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "delete";
}

export function EditButton({
  onClick,
  disabled = false,
  className = "w-full",
  size = "sm",
  variant = "outline",
}: EditButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      <BiPencil className="mr-2 h-5 w-5" />
      Edit
    </Button>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export function DeleteButton({
  onClick,
  disabled = false,
  isPending = false,
  className = "w-full",
  size = "sm",
}: DeleteButtonProps) {
  return (
    <Button
      size={size}
      variant="delete"
      className={className}
      onClick={onClick}
      disabled={disabled || isPending}
    >
      <BiTrash className="mr-2 h-5 w-5" />
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
