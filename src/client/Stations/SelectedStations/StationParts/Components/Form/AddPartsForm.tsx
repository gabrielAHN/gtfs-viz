import { useStationViewContext, useDuckDB } from "@/context/combinedContext";

import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { validateTableData } from "@/hooks/DuckdbCalls/DataEditing/validatingData";

import FormComponent from "@/components/forms/FormComponent";

function AddPartsForm({ Data, mutationFn, handleSuccess }) {
    const { StationView } = useStationViewContext();
    const { conn } = useDuckDB();

    const inputData = [
        {
            name: "stopId",
            label: "Stop Id",
            type: "formField",
            parts: {
            renderInput: (field) => (
                <Input
                    ref={field.ref}
                    type="text"
                    placeholder="eg. place-CM-0493"
                    value={field.value}
                    onChange={field.onChange}
                />
            ),
            rules: {
                pattern: {
                    value: /^[a-zA-Z0-9-_]+$/,
                    message: "Invalid Stop Id format",
                },
                validate: async (value) => {
                    const queryResult = await validateTableData({
                        conn: conn,
                        table: 'StationsTable',
                        column: 'stop_id',
                        value: value
                    });
                    return queryResult || "Stop Id already exists";
                },
            }
            }
        },
        {
            name: "name",
            label: "Name",
            type: "formField",
            parts: {
                renderInput: (field) => (
                    <Input
                        ref={field.ref}
                        type="text"
                        placeholder="eg. Place de la Concorde"
                        value={field.value}
                        onChange={field.onChange}
                    />
                )
            }
        },
        {
            name: "wheelchair",
            label: "Wheelchair Accessible",
            type: "formField",
            parts: {
            renderInput: ({ value, onChange, onBlur, ref }) => (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger ref={ref} onBlur={onBlur}>
                        <SelectValue placeholder="Station Wheelchair Accessible" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="🟡">No Information 🟡</SelectItem>
                        <SelectItem value="✅">Accessible ✅</SelectItem>
                        <SelectItem value="❌">Not Accessible ❌</SelectItem>
                    </SelectContent>
                </Select>
            ),
            }
        },
        {
            name: "location_type_name",
            label: "Location Type",
            type: "formField",
            parts: {
            renderInput: ({ value, onChange, onBlur, ref }) => (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger ref={ref} onBlur={onBlur}>
                        <SelectValue placeholder="Location Type Name" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Platform">Platform</SelectItem>
                        <SelectItem value="Exit/Entrance">Exit/Entrance</SelectItem>
                        <SelectItem value="Pathway Node">Pathway Node</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                    </SelectContent>
                </Select>
            )
            }
        },
        {
            name: "location",
            type: "map",
            parts: {
                data: Data,
                lat : {
                    name: "lat",
                    label: "Latitude",
                    renderInput: (field) => (
                        <Input
                            ref={field.ref}
                            type="number"
                            placeholder="eg. 48.865"
                            step={0.00000000000000001}
                            value={field.value}
                            onChange={field.onChange}
                        />
                    ),
                    rules: {
                        min: { value: -90, message: "Latitude must be >= -90" },
                        max: { value: 90, message: "Latitude must be <= 90" },
                    },
                },
                lon: {
                    name: "lon",
                    label: "Longitude",
                    renderInput: (field) => (
                        <Input
                            ref={field.ref}
                            type="number"
                            placeholder="eg. 2.321"
                            step={0.00000000000000001}
                            value={field.value}
                            onChange={field.onChange}
                        />
                    ),
                    rules: {
                        min: { value: -180, message: "Longitude must be >= -180" },
                        max: { value: 180, message: "Longitude must be <= 180" },
                    },
                },
            }
        }
    ];

    return (
        <FormComponent
            inputData={inputData}
            mutationFn={mutationFn}
            header="Add Part"
            buttonLabel="Create"
            onSuccess={handleSuccess}
            defaultValues={{
                stopId: "",
                name: "",
                wheelchair: "",
                location_type_name: "",
                parent_station: StationView.stop_id,
                lat: "",
                lon: "",
            }}
        />
    );
}

export default AddPartsForm;
