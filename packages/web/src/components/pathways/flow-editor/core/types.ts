export type ViewMode = "column" | "radial";

export interface CustomNodeData {
  label: string;
  stopId: string;
  locationType: string;
  color: string;
  viewMode?: ViewMode;
  connectionCount?: number;
  layer?: number;
  ring?: number;
  status?: string;
  wheelchairStatus?: string;
  stopLat?: number;
  stopLon?: number;
  isDimmed?: boolean;
  isPopupSelected?: boolean;
  popupSelectionColor?: string;
  isDetachedConnectionNode?: boolean;
  detachedConnectionCount?: number;
  detachedEndpointSummary?: string;
  detachedTypeColor?: string;
  isDetachedConnectionEditing?: boolean;
  isSelectedFrom?: boolean;
  isSelectedTo?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export type FlowHandleId = "left" | "right" | "top" | "bottom";

export type EdgeLabelMode = "type" | "time";

export type PathwayEdgeData = {
  connections?: any[];
  pairConnections?: any[];
  allPairConnections?: any[];
  pairConnectionCount?: number;
  typeLabel?: string;
  typeConnectionCount?: number;
  distinctTypeCount?: number;
  siblingIndex?: number;
  siblingCount?: number;
  edgeId?: string;
  isDimmed?: boolean;
  isPopupSelected?: boolean;
  popupSelectionColor?: string;
  edgeLabelMode?: EdgeLabelMode;
  onDelete?: () => void;
};

export type FlowStopOption = {
  id: string;
  label: string;
  color?: string;
  searchLabel?: string;
};

export type PathTraversalCost = {
  hasCompleteTraversalTime: boolean;
  totalTraversalTime: number;
  hopCount: number;
};

export type PathTraversalEdge = {
  toNodeId: string;
  connection: any;
  connectionId: string;
};

export type ConnectionFilterGraph = {
  stopOptionById: Map<string, FlowStopOption>;
  routeStopOptionById: Map<string, FlowStopOption>;
  validConnections: any[];
  filterConnections: any[];
  wheelchairAccessibleStopIds: Set<string>;
  wheelchairAccessibleConnectionIds: Set<string>;
  showWheelchairAccessibleSwitch: boolean;
  outgoingNodeIdsByNode: Map<string, Set<string>>;
  incomingNodeIdsByNode: Map<string, Set<string>>;
  traversalEdgesByFromNode: Map<string, PathTraversalEdge[]>;
  traversalEdgesByToNode: Map<string, PathTraversalEdge[]>;
  fromIds: Set<string>;
  toIds: Set<string>;
};

export type FlowGraphBuildResult = {
  nodes: any[];
  edges: any[];
};

export type FilterStats = {
  totalNodes: number;
  totalEdges: number;
  isolatedNodes: number;
  orphanedEdges: number;
  isolatedNodesList: any[];
  orphanedEdgesList: any[];
};

export type DetachedConnectionDraft = {
  nodeId: string;
  connection: any;
  position: { x: number; y: number };
  fromStopId: string | null;
  toStopId: string | null;
};

export type DetachedConnectionEndpointFocus = "from" | "to";

export type EdgeFormValues = {
  from_stop_id: string;
  to_stop_id: string;
  pathway_mode: string;
  is_bidirectional: string;
  traversal_time: string;
  length: string;
  stair_count: string;
  max_slope: string;
  min_width: string;
  signposted_as: string;
  reversed_signposted_as: string;
};

export type EdgeOptionalFieldKey =
  | "stair_count"
  | "max_slope"
  | "min_width"
  | "signposted_as"
  | "reversed_signposted_as";
