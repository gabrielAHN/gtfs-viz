import { ReactNode } from "react";

interface MapContainerProps {
  children: ReactNode;
  instructionText?: string;
  showLegend?: boolean;
  legendContent?: ReactNode;
  clickPopup?: ReactNode;
}

function MapContainer({
  children,
  instructionText = "Click on the map to view details",
  showLegend = false,
  legendContent,
  clickPopup,
}: MapContainerProps) {
  return (
    <div className="flex flex-col h-full w-full">
      {}
      {clickPopup && (
        <div className="w-full sm:hidden p-2 flex-shrink-0">
          {clickPopup}
        </div>
      )}

      {}
      <div className="relative flex-1 min-h-0">
        <div className="h-full w-full border rounded overflow-hidden">
          {children}
        </div>

        {}
        {instructionText && (
          <div className="absolute top-2 left-2 z-10 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded pointer-events-none">
            {instructionText}
          </div>
        )}

        {}
        {clickPopup && (
          <div className="hidden sm:block absolute top-2 bottom-2 left-2 z-30 w-64 sm:w-72 overflow-hidden">
            {clickPopup}
          </div>
        )}

        {}
        {showLegend && legendContent && (
          <div className="absolute bottom-2 right-2 z-20">
            {legendContent}
          </div>
        )}
      </div>
    </div>
  );
}

export default MapContainer;
