import { useQueryClient } from "@tanstack/react-query";
import { useDuckDB, useStationViewContext } from "@/context/combinedContext";
import { mutationEditStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";
import { CreateStationsTable } from "@/hooks/DuckdbCalls/Ingestion/CreateStationTable";

import EditStationForm from "./EditStationForm";
import FormPopup from "@/components/ui/formpopup";


function StationForm({ Data, setOpenValue, OpenValue }) {
    const queryClient = useQueryClient();
    const { StationView } = useStationViewContext();
    const { conn } = useDuckDB();

    const mutationEditFn = (formData) => {
        return mutationEditStationFn({
            conn: conn,
            formData: formData,
            SelectStation: StationView,
        });
    };

    const handleSuccess = async () => {
        await conn.query(CreateStationsTable)
        queryClient.invalidateQueries(["fetchStationInfoData"]);
        setOpenValue(false)
    };

    return (
        <FormPopup setOpenValue={setOpenValue} OpenValue={OpenValue} >
            <EditStationForm
                Data={Data}
                mutationFn={mutationEditFn}
                handleSuccess={handleSuccess}
                SelectStation={StationView}
                />                 
        </FormPopup>
    );
}

export default StationForm;
