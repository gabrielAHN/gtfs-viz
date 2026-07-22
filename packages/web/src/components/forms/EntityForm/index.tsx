import { useState } from "react";
import FormComponent from "@/components/forms/FormComponent";
import FormPopup from "@/components/ui/formpopup";
import { useEntityForm } from "@/components/forms/hooks/useEntityForm";

type EntityFormProps = {
  Data: any[];
  setOpenValue: (value: { formType: string | null; state: boolean }) => void;
  OpenValue: { formType: string | null; state: boolean };
  ClickInfo: any;
  setClickInfo: (value: any) => void;
  type: "station" | "stop" | "route";
  parentStation?: string;
  onZoomToLocation?: (lat: number, lon: number) => void;
  onFormMutatingChange?: (isMutating: boolean) => void;
  inline?: boolean;
  hideHeader?: boolean;
  showConversionActions?: boolean;
  showLevelField?: boolean;
};

function EntityForm({
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
}: EntityFormProps) {
  const mode = OpenValue.formType as "add" | "edit";
  const [isMutating, setIsMutating] = useState(false);

  const formProps = useEntityForm({
    type,
    mode,
    Data,
    ClickInfo,
    onSuccess: () => {
      setOpenValue({ formType: null, state: false });
      setClickInfo(undefined);
    },
    onFormMutatingChange: (v: boolean) => {
      setIsMutating(v);
      onFormMutatingChange?.(v);
    },
    parentStation,
    onZoomToLocation,
    showConversionActions,
    showLevelField,
  });

  if (!OpenValue.state || !mode) return null;

  if (inline) {
    return <FormComponent {...formProps} hideHeader={hideHeader} />;
  }

  return (
    <FormPopup setOpenValue={setOpenValue} OpenValue={OpenValue} isBusy={isMutating}>
      <FormComponent {...formProps} />
    </FormPopup>
  );
}

export default EntityForm;
