import FormComponent from "@/components/forms/FormComponent";
import FormPopup from "@/components/ui/formpopup";
import { useStopStationForm } from "@/components/forms/hooks/useStopStationForm";

type StopStationFormProps = {
  Data: any[];
  setOpenValue: (value: { formType: string | null; state: boolean }) => void;
  OpenValue: { formType: string | null; state: boolean };
  ClickInfo: any;
  setClickInfo: (value: any) => void;
  type: "station" | "stop";
  parentStation?: string;
  onZoomToLocation?: (lat: number, lon: number) => void;
};

function StopStationForm({
  Data,
  setOpenValue,
  OpenValue,
  ClickInfo,
  setClickInfo,
  type,
  parentStation,
  onZoomToLocation,
}: StopStationFormProps) {
  const mode = OpenValue.formType as "add" | "edit";

  const formProps = useStopStationForm({
    Data,
    ClickInfo,
    type,
    mode,
    parentStation,
    onSuccess: () => {
      setOpenValue({ formType: null, state: false });
      setClickInfo();
    },
    onZoomToLocation,
  });

  if (!OpenValue.state || !mode) return null;

  return (
    <FormPopup setOpenValue={setOpenValue} OpenValue={OpenValue}>
      <FormComponent {...formProps} />
    </FormPopup>
  );
}

export default StopStationForm;
