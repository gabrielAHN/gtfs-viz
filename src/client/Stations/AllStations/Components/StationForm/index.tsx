import { useQueryClient } from "@tanstack/react-query";
import { useDuckDB } from "@/context/combinedContext";
import { mutationAddStationFn, mutationEditStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";

import AddStationForm from "./AddStationForm";
import EditStationForm from "./EditStationForm";
import FormPopup from "@/components/ui/formpopup";


function StationForm({ Data, setOpenValue, OpenValue, ClickInfo, setClickInfo }) {
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
        queryClient.invalidateQueries(["createStationTable"]);
        queryClient.invalidateQueries(["fetchStationsData"]);
        queryClient.invalidateQueries(["fetchStopsIdData"]);
        queryClient.invalidateQueries(["fetchStopsNamesData"]);
        setOpenValue({ 'formType': null, 'state': false });
        setClickInfo()
    };

    return (
        <FormPopup setOpenValue={setOpenValue} OpenValue={OpenValue} >
            {
                OpenValue.formType === "add" ? (
                    <AddStationForm
                        Data={Data}
                        mutationFn={mutationAddFn}
                        handleSuccess={handleSuccess}
                    />
                ) :
                    OpenValue.formType === "edit" ? (
                        <EditStationForm
                            Data={Data}
                            mutationFn={mutationEditFn}
                            handleSuccess={handleSuccess}
                            SelectStation={ClickInfo}
                        />
                    ) : null
            }
        </FormPopup>
    );
}

export default StationForm;
