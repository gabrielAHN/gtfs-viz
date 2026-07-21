import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { normalizeHex } from "../colors";

type ColorInputProps = {
  value: unknown;
  onChange: (value: string) => void;
  disabled?: boolean;
  fallback?: string;
};

/**
 * Color picker + hex text input combo.
 * Used for route_color and route_text_color fields.
 */
const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  ({ value, onChange, disabled, fallback = "#4f46e5" }, ref) => {
    const displayValue = normalizeHex(value, fallback);
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={ref}
          type="color"
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-10 w-14 p-1"
        />
        <Input
          type="text"
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }
);

ColorInput.displayName = "ColorInput";

export default ColorInput;
