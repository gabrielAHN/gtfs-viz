import type { DragEvent, PointerEvent, RefObject } from "react";
import { useEffect } from "react";
import {
  Background,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  ReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";

import { FlowLegendPanel } from "./FlowLegendPanel";
import { OrphanConnectionsSidebar } from "../sidebar/OrphanConnectionsSidebar";
import { edgeTypes, nodeTypes } from "../core/shared";

type FlowCanvasPaneProps = {
  viewMode: "column" | "radial";
  theme: string;
  handleCanvasPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => void;
  hasOrphanConnectionsSidebar: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  availableOrphanConnections: any[];
  orphanPathwayIdFilter?: string;
  setOrphanPathwayIdFilter: (value?: string) => void;
  orphanPathwayIdOptions: Array<{ value: string; label: string }>;
  orphanPathwayTypeFilter: string;
  setOrphanPathwayTypeFilter: (value: string) => void;
  orphanPathwayTypeOptions: string[];
  filteredAvailableOrphanConnections: any[];
  activeDetachedConnectionDraftPathwayId: string | null;
  detachedConnectionDrafts: any[];
  startDetachedConnectionRepair: (connection: any) => void;
  displayNodes: any[];
  displayEdges: any[];
  onCanvasDragOver: (event: DragEvent) => void;
  onCanvasDrop: (event: DragEvent) => void;
  handleNodesChange: (...args: any[]) => void;
  onEdgesChange: (...args: any[]) => void;
  onInit: (...args: any[]) => void;
  handleNodeDragStop: (...args: any[]) => void;
  onEdgeClick: (...args: any[]) => void;
  onNodeClick: (...args: any[]) => void;
  onPaneClick: (...args: any[]) => void;
  onConnect: (...args: any[]) => void;
  onReconnect: (...args: any[]) => void;
  legendRef: RefObject<HTMLDivElement | null>;
  legendOpen: boolean;
  setLegendOpen: (value: boolean) => void;
  pathwayLegendItems: Array<{ label: string; color: string }>;
  stopLegendItems: Array<{ label: string; color: string }>;
};

function FlowCanvasHandleSync({
  nodeIds,
  viewMode,
}: {
  nodeIds: string[];
  viewMode: "column" | "radial";
}) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      nodeIds.forEach((nodeId) => updateNodeInternals(nodeId));
    });

    return () => cancelAnimationFrame(frame);
  }, [nodeIds, updateNodeInternals, viewMode]);

  return null;
}

export function FlowCanvasPane({
  viewMode,
  theme,
  handleCanvasPointerDownCapture,
  hasOrphanConnectionsSidebar,
  sidebarOpen,
  setSidebarOpen,
  availableOrphanConnections,
  orphanPathwayIdFilter,
  setOrphanPathwayIdFilter,
  orphanPathwayIdOptions,
  orphanPathwayTypeFilter,
  setOrphanPathwayTypeFilter,
  orphanPathwayTypeOptions,
  filteredAvailableOrphanConnections,
  activeDetachedConnectionDraftPathwayId,
  detachedConnectionDrafts,
  startDetachedConnectionRepair,
  displayNodes,
  displayEdges,
  onCanvasDragOver,
  onCanvasDrop,
  handleNodesChange,
  onEdgesChange,
  onInit,
  handleNodeDragStop,
  onEdgeClick,
  onNodeClick,
  onPaneClick,
  onConnect,
  onReconnect,
  legendRef,
  legendOpen,
  setLegendOpen,
  pathwayLegendItems,
  stopLegendItems,
}: FlowCanvasPaneProps) {
  return (
    <div
      className="relative h-[calc(100vh-300px)] overflow-hidden"
      onPointerDownCapture={handleCanvasPointerDownCapture}
    >
      <OrphanConnectionsSidebar
        theme={theme}
        hasOrphanConnectionsSidebar={hasOrphanConnectionsSidebar}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        availableOrphanConnections={availableOrphanConnections}
        orphanPathwayIdFilter={orphanPathwayIdFilter}
        setOrphanPathwayIdFilter={setOrphanPathwayIdFilter}
        orphanPathwayIdOptions={orphanPathwayIdOptions}
        orphanPathwayTypeFilter={orphanPathwayTypeFilter}
        setOrphanPathwayTypeFilter={setOrphanPathwayTypeFilter}
        orphanPathwayTypeOptions={orphanPathwayTypeOptions}
        filteredAvailableOrphanConnections={filteredAvailableOrphanConnections}
        activeDetachedConnectionDraftPathwayId={
          activeDetachedConnectionDraftPathwayId
        }
        detachedConnectionDrafts={detachedConnectionDrafts}
        startDetachedConnectionRepair={startDetachedConnectionRepair}
      />

      <style>{`
        .react-flow__edge-path {
          stroke-width: 2px !important;
          stroke-opacity: 0.8 !important;
        }
        .react-flow__edge {
          z-index: 100 !important;
          pointer-events: all !important;
        }
        .react-flow__edge:hover .react-flow__edge-path {
          stroke-width: 4px !important;
          stroke-opacity: 1 !important;
        }
        .react-flow__edge-path.pathway-flow-selected-edge-main {
          stroke-width: 4px !important;
          stroke-opacity: 1 !important;
        }
        .react-flow__edge-path.pathway-flow-selected-edge-core {
          stroke-width: 6px !important;
          stroke-opacity: 1 !important;
        }
        .react-flow__edge-path.pathway-flow-selected-edge-loading {
          stroke-width: 5px !important;
          stroke-opacity: 1 !important;
        }
        .react-flow__edge-path.pathway-flow-selected-edge-glow {
          stroke-width: 9px !important;
          stroke-opacity: 0.44 !important;
        }
        .react-flow__handle {
          opacity: 1 !important;
        }
        .react-flow__handle-left {
          left: -8px !important;
        }
        .react-flow__handle-right {
          right: -8px !important;
        }
        @keyframes detached-connection-border-shift {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
        @keyframes detached-connection-border-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.12);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.24);
          }
        }
        .detached-connection-node {
          will-change: transform, background-position, box-shadow;
        }
        @keyframes selected-edge-dash {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -32;
          }
        }
        @keyframes selected-edge-pill-pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18),
              0 10px 18px rgba(15, 23, 42, 0.18);
          }
          50% {
            transform: scale(1.04);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.32),
              0 12px 22px rgba(15, 23, 42, 0.24);
          }
        }
        @keyframes selected-node-halo {
          0% {
            transform: scale(0.98);
            opacity: 0.9;
          }
          70% {
            transform: scale(1.14);
            opacity: 0.18;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
        @keyframes selected-node-core-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }

        .react-flow__controls {
          background: ${theme === "dark" ? "#1a1a1a" : "#ffffff"} !important;
          border: 1px solid ${theme === "dark" ? "#404040" : "#e5e7eb"} !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, ${theme === "dark" ? "0.5" : "0.1"}) !important;
        }
        .react-flow__controls-button {
          background: ${theme === "dark" ? "#1a1a1a" : "#ffffff"} !important;
          border-bottom: 1px solid ${theme === "dark" ? "#404040" : "#e5e7eb"} !important;
          color: ${theme === "dark" ? "#e5e7eb" : "#1a1a1a"} !important;
        }
        .react-flow__controls-button:hover {
          background: ${theme === "dark" ? "#2a2a2a" : "#f9fafb"} !important;
        }
        .react-flow__controls-button svg {
          fill: ${theme === "dark" ? "#e5e7eb" : "#1a1a1a"} !important;
        }

        [data-radix-popper-content-wrapper] {
          z-index: 1000 !important;
        }
      `}</style>

      <ReactFlow
        key={`pathway-flow-${viewMode}`}
        nodes={displayNodes}
        edges={displayEdges}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{
          stroke: "hsl(var(--primary))",
          strokeWidth: 2,
          strokeDasharray: "5 5",
          opacity: 0.8,
        }}
        className="bg-background"
        minZoom={0.1}
        maxZoom={4}
        deleteKeyCode={null}
        elementsSelectable
        edgesFocusable
        nodesDraggable
        nodesConnectable
        onConnect={onConnect}
        onReconnect={onReconnect}
        edgesReconnectable
        isValidConnection={(connection) =>
          !!connection.source &&
          !!connection.target &&
          connection.source !== connection.target
        }
        nodesFocusable
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <FlowCanvasHandleSync
          nodeIds={displayNodes.map((node) => String(node.id))}
          viewMode={viewMode}
        />
        <Background />
        <Controls />
      </ReactFlow>

      <FlowLegendPanel
        legendRef={legendRef}
        legendOpen={legendOpen}
        setLegendOpen={setLegendOpen}
        pathwayLegendItems={pathwayLegendItems}
        stopLegendItems={stopLegendItems}
      />
    </div>
  );
}
