import { useQueryClient } from "@tanstack/react-query";
import { useDuckDB } from "@/context/combinedContext";
import { mutationAddStationFn, mutationEditStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";

import FormPopup from "@/components/ui/formpopup";

import AddPartsForm from "./AddPartsForm";
import EditPartsForm from "./EditPartsForm";

function Form({Data, OpenValue, setOpenValue, ClickInfo, setClickInfo}) {
    const queryClient = useQueryClient();
    const { conn } = useDuckDB();

    const mutationAddFn = (formData) => {
        return mutationAddStationFn({
            conn: conn,
            formData: formData
        });
    };
    const mutationEditFn = (formData) => {
        return mutationEditStationFn({
            conn: conn,
            formData: formData,
            SelectStation: ClickInfo,
        });
    };

    const handleSuccess = () => {
        queryClient.invalidateQueries(["fetchStationData"]);
        setOpenValue({ 'formType': null, 'state': false });
        setClickInfo()
    };

return(
    <FormPopup setOpenValue={setOpenValue} OpenValue={OpenValue} >
        {
            OpenValue.formType === "add" ? (
                <AddPartsForm
                    Data={Data}
                    mutationFn={mutationAddFn}
                    handleSuccess={handleSuccess}
                />
            ) :
            OpenValue.formType === "edit" ? (
                <EditPartsForm
                    Data={Data}
                    mutationFn={mutationEditFn}
                    handleSuccess={handleSuccess}
                    SelectStation={ClickInfo}
                />
            ) : null
        }
    </FormPopup>
)
}
export default  Form;