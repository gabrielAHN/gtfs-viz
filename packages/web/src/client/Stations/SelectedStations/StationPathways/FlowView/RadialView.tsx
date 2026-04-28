import FlowView, { useFlowViewContext } from "./index";

export default function RadialView() {
  const props = useFlowViewContext();

  return <FlowView {...props} viewMode="radial" />;
}
