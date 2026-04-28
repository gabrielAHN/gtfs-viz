export type PopupFieldDefinition = {
  key: string;
  label: string;
};

const hasPopupValue = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

export function getAvailablePopupFields(
  data: Record<string, any> | undefined,
  fields: PopupFieldDefinition[],
) {
  if (!data) {
    return {
      columns: [] as string[],
      columnNames: [] as string[],
    };
  }

  const visibleFields = fields.filter((field) => hasPopupValue(data[field.key]));

  return {
    columns: visibleFields.map((field) => field.key),
    columnNames: visibleFields.map((field) => field.label),
  };
}
