import { createContext, useContext, type ReactNode } from "react";
import { PathwayFlowEditor } from "@/components/pathways/PathwayFlowEditor";
import type {
  PathwayFlowEditorProps,
  ViewMode,
} from "@/components/pathways/PathwayFlowEditor";

export type FlowViewBaseProps = Omit<PathwayFlowEditorProps, "viewMode">;

export interface FlowViewProps extends FlowViewBaseProps {
  viewMode: ViewMode;
}

const FlowViewContext = createContext<FlowViewBaseProps | null>(null);

export function FlowViewProvider({
  value,
  children,
}: {
  value: FlowViewBaseProps;
  children: ReactNode;
}) {
  return (
    <FlowViewContext.Provider value={value}>{children}</FlowViewContext.Provider>
  );
}

export function useFlowViewContext() {
  const context = useContext(FlowViewContext);

  if (!context) {
    throw new Error("FlowView context is missing");
  }

  return context;
}

export default function FlowView({
  pathwayData,
  viewMode,
  ...props
}: FlowViewProps) {
  const hasPathwayConnections = (pathwayData?.connections?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {!hasPathwayConnections ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          No pathways exist for this station yet. Use the flow editor below to
          create nodes and connections.
        </div>
      ) : null}

      <PathwayFlowEditor
        {...props}
        pathwayData={pathwayData}
        viewMode={viewMode}
      />
    </div>
  );
}
