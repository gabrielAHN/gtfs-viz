import { Input } from "@/components/ui/input"

type CoordinateInputProps = {
  type: "lat" | "lon"
  value: any
  onChange: (value: any) => void
  ref?: any
  disabled?: boolean
}

const PLACEHOLDERS = { lat: "eg. 48.865", lon: "eg. 2.321" }

/**
 * Number input for latitude or longitude values.
 */
function CoordinateInput({ type, value, onChange, ref, disabled }: CoordinateInputProps) {
  return (
    <Input
      ref={ref}
      type="number"
      placeholder={PLACEHOLDERS[type]}
      step={0.00000000000000001}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

export default CoordinateInput
