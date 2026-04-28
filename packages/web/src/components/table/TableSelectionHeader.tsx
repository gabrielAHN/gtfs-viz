import { Button } from "@/components/ui/button";
import { BiX } from "react-icons/bi";
import { getStopColor } from "@/components/style";

interface TableSelectionHeaderProps {
  clickInfo: any;
  onClose: () => void;
  emptyMessage?: string;
  children?: React.ReactNode;
}

function TableSelectionHeader({
  clickInfo,
  onClose,
  emptyMessage = "Select a row to view actions",
  children,
}: TableSelectionHeaderProps) {
  const getNodeColor = (locationType: string) => {
    const [r, g, b] = getStopColor(locationType);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="mb-3">
      {!clickInfo ? (
        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
          {emptyMessage}
        </div>
      ) : (
        <div
          className="border-2 rounded-md bg-background shadow-sm"
          style={{
            borderColor: getNodeColor(clickInfo.location_type_name),
          }}
        >
          {}
          <div
            className="flex items-center justify-between p-3 border-b"
            style={{
              backgroundColor: `${getNodeColor(clickInfo.location_type_name)}20`,
              borderBottomColor: getNodeColor(clickInfo.location_type_name),
            }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getNodeColor(clickInfo.location_type_name),
                  }}
                />
                <h3 className="font-semibold text-sm">{clickInfo.stop_name}</h3>
              </div>
              <p className="text-xs text-muted-foreground ml-4">
                ID: {clickInfo.stop_id}
                {clickInfo.location_type_name && ` • ${clickInfo.location_type_name}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <BiX className="h-4 w-4" />
            </Button>
          </div>

          {}
          <div className="p-3 space-y-2">{children}</div>
        </div>
      )}
    </div>
  );
}

export default TableSelectionHeader;
