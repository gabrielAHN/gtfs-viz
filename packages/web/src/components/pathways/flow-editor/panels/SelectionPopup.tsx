import type { ComponentProps } from "react";
import { forwardRef } from "react";

import { PathwayFlowEdgePanel } from "./EdgePanel";
import {
  PathwayFlowNodeFormPanel,
  PathwayFlowNodeInfoPanel,
} from "./NodePanels";

type ActiveBottomPanelKind = "nodeForm" | "edge" | "node" | null;

type PathwayFlowSelectionPopupProps = {
  activeBottomPanelKind: ActiveBottomPanelKind;
  hasScrollableBottomPanel: boolean;
  nodeFormPanelProps: ComponentProps<typeof PathwayFlowNodeFormPanel>;
  nodeInfoPanelProps: ComponentProps<typeof PathwayFlowNodeInfoPanel> | null;
  edgePanelProps: ComponentProps<typeof PathwayFlowEdgePanel> | null;
};

export const PathwayFlowSelectionPopup = forwardRef<
  HTMLDivElement,
  PathwayFlowSelectionPopupProps
>(function PathwayFlowSelectionPopup(
  {
    activeBottomPanelKind,
    hasScrollableBottomPanel,
    nodeFormPanelProps,
    nodeInfoPanelProps,
    edgePanelProps,
  },
  ref,
) {
  if (!activeBottomPanelKind) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`space-y-3 px-3 pb-3 md:absolute md:bottom-4 md:right-4 md:z-[500] md:w-[min(32rem,calc(100%-2rem))] md:max-h-[calc(75%-1rem)] md:px-0 md:pb-0 ${
        hasScrollableBottomPanel ? "md:h-[calc(75%-1rem)]" : ""
      }`}
    >
      {activeBottomPanelKind === "nodeForm" ? (
        <PathwayFlowNodeFormPanel {...nodeFormPanelProps} />
      ) : null}

      {activeBottomPanelKind === "node" && nodeInfoPanelProps ? (
        <PathwayFlowNodeInfoPanel {...nodeInfoPanelProps} />
      ) : null}

      {activeBottomPanelKind === "edge" && edgePanelProps ? (
        <PathwayFlowEdgePanel {...edgePanelProps} />
      ) : null}
    </div>
  );
});
