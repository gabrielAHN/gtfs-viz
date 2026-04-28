import FlowView, { useFlowViewContext } from "./index";

export default function ColumnView() {
  const props = useFlowViewContext();

  return <FlowView {...props} viewMode="column" />;
}
