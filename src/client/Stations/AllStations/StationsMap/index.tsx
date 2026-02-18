import { useState, useMemo, useEffect } from 'react';

import { Button } from "@/components/ui/button";
import { BiPencil, BiTrash, BiRightArrow, BiReset } from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import { useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/lib/duckdb/DataEditing/editingFn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATA_STATUS } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
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
import { createStationsTable, createStopsView } from "@/lib/extensions";

function StationsMap({ data, setOpen, ClickInfo, setClickInfo, externalViewState }) {
  const { conn } = useDuckDB();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [MapLayers, setMapLayers] = useState([]);
  const [DataColor, setDataColor] = useState("pathways_status");
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
      await createStationsTable(conn);

      queryClient.invalidateQueries({ queryKey: ["createStationTable"] });
      queryClient.invalidateQueries({ queryKey: ["fetchStationsData"] });
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

    const statusSet = new Set(data.map(row => row[DataColor]).filter(Boolean));

    return Array.from(statusSet).map(status => ({
      label: DATA_STATUS[status]?.name || status,
      color: rgbToHex(DATA_STATUS[status]?.color || [128, 128, 128]),
    }));
  }, [data, DataColor]);

  if (!data || data.length === 0) {
    return (
      <div className="relative h-[74vh] w-full border rounded overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          No station data available.
        </div>
      </div>
    );
  }

  const clickData = ClickInfo?.object || ClickInfo;

  return (
    <MapContainer
      instructionText="Click a point to edit, delete, or learn more about a station"
      showLegend={legendItems.length > 0}
      legendContent={
        <MapLegend
          title="Stations"
          items={legendItems}
          collapsible={true}
          defaultExpanded={true}
        >
          <Select onValueChange={setDataColor} value={DataColor}>
            <SelectTrigger className="h-7 text-xs mb-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pathways_status">Pathways Status</SelectItem>
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
              "stop_lon",
              "stop_lat",
              "pathways_status",
              "wheelchair_status",
            ]}
            columnNames={[
              "Stop Id",
              "Stop Lon",
              "Stop Lat",
              "Pathway",
              "Wheelchair Boarding",
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
                    Zoom to Station
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      router.navigate({
                        to: "/stations/parts/map",
                        search: { selectedStationId: clickData.stop_id }
                      });
                    }}
                  >
                    <BiRightArrow className="mr-2 h-4 w-4" />
                    Select Station
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

export default StationsMap;
