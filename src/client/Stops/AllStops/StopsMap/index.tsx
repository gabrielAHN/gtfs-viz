import { useState, useMemo, useEffect } from 'react';

import { Button } from "@/components/ui/button";
import { BiPencil, BiTrash, BiReset } from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/lib/duckdb/DataEditing/editingFn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStopColor, WHEELCHAIR_STATUS } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditIndicator } from "@/components/ui/EditIndicator";

import MapSection from './Components/MapSection';
import MapClickPopup from '@/components/maps/MapClickPopup';
import MapContainer from '@/components/maps/MapContainer';
import MapLegend from '@/components/maps/MapLegend';
import { createStopsTable, createStopsView } from "@/lib/extensions";

function StopsMap({ data, setOpen, ClickInfo, setClickInfo, externalViewState }) {
  const { conn } = useDuckDB();
  const queryClient = useQueryClient();
  const { theme } = useThemeContext();

  const [MapLayers, setMapLayers] = useState([]);
  const [DataColor, setDataColor] = useState("location_type_name");
  const [viewState, setViewState] = useState();
  const [BoundBox, setBoundBox] = useState();

  const mutation = useMutation({
    mutationFn: async () => {
      const clickData = ClickInfo?.object || ClickInfo;
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: clickData,
      });
    },
    onSuccess: async () => {
      await createStopsView(conn);
      await createStopsTable(conn);

      queryClient.invalidateQueries({ queryKey: ["createStopsTable"] });
      queryClient.invalidateQueries({ queryKey: ["fetchStopsData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchStopsIdData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchStopsNamesData"] });
      setClickInfo(undefined);
    },
  });

  useEffect(() => {
    if (externalViewState) {
      setViewState(externalViewState);
    }
  }, [externalViewState]);

  const handleGoToLocation = () => {
    const clickData = ClickInfo?.object || ClickInfo;
    setViewState({
      longitude: clickData.stop_lon,
      latitude: clickData.stop_lat,
      zoom: 15,
    });
  };

  const legendItems = useMemo(() => {
    if (!data || data.length === 0) return [];

    const valueSet = new Set(data.map(row => row[DataColor]).filter(Boolean));

    return Array.from(valueSet).map(value => {
      let color;
      let label;

      if (DataColor === "location_type_name") {
        color = rgbToHex(getStopColor(value, theme));
        label = value;
      } else if (DataColor === "wheelchair_status") {
        color = rgbToHex(WHEELCHAIR_STATUS[value]?.color || [128, 128, 128]);
        label = WHEELCHAIR_STATUS[value]?.name || value;
      } else {
        color = "#808080";
        label = value;
      }

      return { label, color };
    });
  }, [data, DataColor, theme]);

  if (!data || data.length === 0) {
    return (
      <div className="relative h-[74vh] w-full border rounded overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          No stop data available.
        </div>
      </div>
    );
  }

  const clickData = ClickInfo?.object || ClickInfo;

  return (
    <MapContainer
      instructionText="Click a point to edit, delete, or view details about a stop"
      showLegend={legendItems.length > 0}
      legendContent={
        <MapLegend
          title="Stops"
          items={legendItems}
          collapsible={true}
          defaultExpanded={true}
        >
          <Select onValueChange={setDataColor} value={DataColor}>
            <SelectTrigger className="h-7 text-xs mb-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="location_type_name">Location Type</SelectItem>
              <SelectItem value="wheelchair_status">Wheelchair Status</SelectItem>
            </SelectContent>
          </Select>
        </MapLegend>
      }
      clickPopup={
        clickData ? (
          <MapClickPopup
            title={
              <div className="flex items-center gap-2">
                <EditIndicator status={clickData.status} />
                <span>{clickData.stop_name}</span>
              </div>
            }
            data={clickData}
            onClose={() => setClickInfo(undefined)}
            columns={[
              "stop_id",
              "stop_name",
              "stop_lon",
              "stop_lat",
              "location_type_name",
              "wheelchair_status",
            ]}
            columnNames={[
              "Stop ID",
              "Stop Name",
              "Longitude",
              "Latitude",
              "Location Type",
              "Wheelchair",
            ]}
            actions={
              <TooltipProvider delayDuration={300}>
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGoToLocation}
                    className="w-full bg-primary/10 dark:bg-primary/20 border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30"
                  >
                    <BiReset className="mr-2 h-5" />
                    Zoom to Stop
                  </Button>
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setOpen({ formType: "edit", state: true })}
                        >
                          <BiPencil className="mr-2 h-5 w-5" />
                          Edit
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="delete"
                          className="w-full"
                          onClick={() => mutation.mutate()}
                          disabled={mutation.isPending}
                        >
                          <BiTrash className="mr-2 h-5 w-5" />
                          {mutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>
            }
          />
        ) : undefined
      }
    >
      <MapSection
        MapLayers={MapLayers}
        TableData={data}
        setMapLayers={setMapLayers}
        ClickInfo={ClickInfo}
        setClickInfo={setClickInfo}
        DataColor={DataColor}
        viewState={viewState}
        setViewState={setViewState}
        BoundBox={BoundBox}
        setBoundBox={setBoundBox}
      />
    </MapContainer>
  );
}

export default StopsMap;
