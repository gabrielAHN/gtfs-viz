import { BiX } from "react-icons/bi";
import PopupTable from "@/components/table/PopupTable";

interface MapClickPopupProps {
  title: string | React.ReactNode;
  data: Record<string, any>;
  onClose: () => void;
  borderColor?: string;
  columns: string[];
  columnNames: string[];
  actions?: React.ReactNode;
}

function MapClickPopup({
  title,
  data,
  onClose,
  borderColor = "#3b82f6",
  columns,
  columnNames,
  actions,
}: MapClickPopupProps) {
  return (
    <div
      className="bg-background border-2 rounded shadow-lg max-h-full flex flex-col relative"
      style={{ borderColor }}
    >
      {}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 hover:bg-accent rounded flex-shrink-0 z-10"
        aria-label="Close"
      >
        <BiX className="h-4 w-4" />
      </button>

      {}
      <div className="flex items-center gap-2 p-2 pr-10 border-b flex-shrink-0">
        <h2 className="font-semibold text-sm truncate">{title}</h2>
      </div>

      <div className="overflow-y-auto p-2 flex-1 min-h-0">
        <PopupTable
          Data={data}
          ColumnsData={columns}
          ColumnName={columnNames}
        />
      </div>

      {actions && (
        <div className="p-2 border-t flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default MapClickPopup;
