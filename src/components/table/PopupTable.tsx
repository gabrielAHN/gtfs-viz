import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DATA_STATUS, WHEELCHAIR_STATUS } from "@/components/style";

function PopupTable({ Data, ColumnsData, ColumnName }) {
  if (!Data) {
    return null;
  }

  const ColumnData = ColumnName.reduce((obj, key, index) => {
    obj[key] = ColumnsData[index];
    return obj;
  }, {});

  const getPathwaysStatusLabel = (emoji: string): string => {
    const baseName = DATA_STATUS[emoji]?.name;
    if (!baseName) return emoji;

    if (emoji === "✅") return "Has Pathways";
    if (emoji === "❌") return "No Pathways";
    if (emoji === "🟡") return "Partial Pathways";

    return baseName;
  };

  const getWheelchairStatusLabel = (emoji: string): string => {
    return WHEELCHAIR_STATUS[emoji]?.name || emoji;
  };

  const getEditStatusLabel = (status: string): string => {
    switch (status) {
      case "edit":
        return "Edited";
      case "new":
        return "New";
      case "new edit":
        return "New & Edited";
      default:
        return status;
    }
  };

  const renderCellValue = (columnKey: string, value: any) => {
    if (value == null) return "-";

    const valueStr = String(value);

    if (columnKey === "pathways_status") {
      const label = getPathwaysStatusLabel(valueStr);
      return (
        <span className="inline-block relative group" data-tooltip={label}>
          {valueStr}
          <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
            {label}
          </span>
        </span>
      );
    }

    if (columnKey === "wheelchair_status") {
      const label = getWheelchairStatusLabel(valueStr);
      return (
        <span className="inline-block relative group" data-tooltip={label}>
          {valueStr}
          <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
            {label}
          </span>
        </span>
      );
    }

    if (columnKey === "status") {
      const label = getEditStatusLabel(valueStr);
      return (
        <span className="inline-block relative group" data-tooltip={label}>
          {valueStr}
          <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
            {label}
          </span>
        </span>
      );
    }

    return valueStr;
  };

  return (
    <div className="w-full border rounded-md overflow-hidden">
      <Table>
        <TableBody>
          {Object.entries(ColumnData).map(
            ([column, columnKey], index, array) => (
              <TableRow
                key={column}
                className={`bg-inherit ${index === 0 ? "first:rounded-t-md" : ""} ${index === array.length - 1 ? "last:rounded-b-md" : ""}`}
              >
                <TableCell className="font-medium">{column}</TableCell>
                <TableCell className="text-right">
                  {renderCellValue(columnKey, Data[columnKey])}
                </TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
export default PopupTable;
