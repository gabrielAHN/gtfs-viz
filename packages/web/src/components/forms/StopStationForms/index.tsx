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
  onFormMutatingChange?: (isMutating: boolean) => void;
  inline?: boolean;
  hideHeader?: boolean;
  showConversionActions?: boolean;
  showLevelField?: boolean;
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
  onFormMutatingChange,
  inline = false,
  hideHeader = false,
  showConversionActions = true,
  showLevelField = false,
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
    onFormMutatingChange,
    showConversionActions,
    showLevelField,
  });

  if (!OpenValue.state || !mode) return null;

  if (inline) {
    return <FormComponent {...formProps} hideHeader={hideHeader} />;
  }

  return (
    <FormPopup setOpenValue={setOpenValue} OpenValue={OpenValue}>
      <FormComponent {...formProps} />
    </FormPopup>
  );
}

export default StopStationForm;
