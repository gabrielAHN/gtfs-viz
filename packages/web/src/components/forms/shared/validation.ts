/**
 * Shared validation rules for form fields.
 */

export const STOP_ID_PATTERN = {
  value: /^[a-zA-Z0-9-_]+$/,
  message: "Invalid Stop Id format",
}

export const LATITUDE_RULES = {
  required: "Latitude is required",
  min: { value: -90, message: "Latitude must be >= -90" },
  max: { value: 90, message: "Latitude must be <= 90" },
}

export const LONGITUDE_RULES = {
  required: "Longitude is required",
  min: { value: -180, message: "Longitude must be >= -180" },
  max: { value: 180, message: "Longitude must be <= 180" },
}
