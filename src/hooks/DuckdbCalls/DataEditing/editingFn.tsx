import {
    insertTableRow, editTableRow, editNewTableRow,
    deleteEditRow, truncateTable
} from "@/hooks/DuckdbCalls/DataEditing/insertData";

export const mutationEditStationFn = async ({conn, formData, SelectStation}) => {
    if ( SelectStation.status === '') {
        editTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: formData.lat,
                stop_lon: formData.lon,
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station,
                status: 'edit',
              }
        })
    } 
    else if (
        SelectStation.status === 'new' || 
        SelectStation.status === 'new edit'
    ) {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            old_stop: SelectStation.row_id,
            formData: {
                row_id: SelectStation.row_id,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: formData.lat,
                stop_lon: formData.lon,
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station,
                status: 'new edit',
              }
        })
    } 
    else if (SelectStation.status === 'edit') {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            column: 'stop_id',
            old_stop: SelectStation.stop_id,
            formData: {
                row_id: SelectStation.row_id,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: formData.lat,
                stop_lon: formData.lon,
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station,
                status: 'edit',
              }
        })
    } 
};


export const mutationAddStationFn = async ({conn, formData}) => {
        insertTableRow({
            conn,
            table: "EditStopTable",
            formData: {
                row_id: `edit_${formData.stopId}`,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair,
                stop_lat: formData.lat,
                stop_lon: formData.lon,
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station,
                status: 'new'
            }
        });
    };

export const mutationExportFn = async ({conn, mutateType, SelectStation, TableName}) => {
    if (mutateType === 'row') {
        deleteEditRow({
            conn,
            table: TableName,
            formData: {
                stop_id: SelectStation.stop_id
            }
        })
    }
    if (mutateType === 'table') {
        truncateTable({
            conn,
            table: TableName
        })
    } 
}


export const mutationDeleteStationFn = async ({conn, SelectStation}) => {

    if (SelectStation?.status === 'new edit') {
        deleteEditRow({
            conn,
            table: "EditStopTable",
            formData: {
                stop_id: SelectStation.stop_id
            }
        })
    } 
    if (SelectStation?.status === 'new') {
        deleteEditRow({
            conn,
            table: "EditStopTable",
            formData: {
                stop_id: SelectStation.stop_id
            }
        })
    } 
    if (SelectStation?.status === 'edit') {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            old_stop: SelectStation.row_id,
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_Id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: SelectStation.location_type_name,
                parent_station: SelectStation.parent_station,
                status: 'deleted'
            }
        })
    } 
    if (SelectStation.status === '') {
        insertTableRow({
            conn,
            table: "EditStopTable",
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status || null,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: SelectStation.location_type_name,
                parent_station: SelectStation.parent_station  || null,
                status: 'deleted',
              }
        })
    }
};