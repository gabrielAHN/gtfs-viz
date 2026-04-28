import { useState, useMemo, useEffect } from "react";

import { useDuckDB } from "@/context/duckdb.client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/lib/duckdb/DataEditing/editingFn";
import { getStopColor, StopTypeColors, WHEELCHAIR_STATUS } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditButton, DeleteButton } from "@/components/ui/ActionButtons";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BiReset } from "react-icons/bi";

import MapSection from "./MapSection";
import MapClickPopup from "@/components/maps/MapClickPopup";
import MapContainer from "@/components/maps/MapContainer";
import MapLegend from "@/components/maps/MapLegend";
import { createStationsTable, createStopsView } from "@/lib/extensions";

function PartsMap({ data, setOpen, ClickInfo, setClickInfo, externalViewState }) {
  const { conn } = useDuckDB();
  const queryClient = useQueryClient();
  const { theme } = useThemeContext();

  const [MapLayers, setMapLayers] = useState([]);
  const [viewState, setViewState] = useState();
  const [BoundBox, setBoundBox] = useState();
  const [DataColor, setDataColor] = useState("location_type_name");

  const [localClickInfo, setLocalClickInfo] = useState(ClickInfo);

  useEffect(() => {
    setLocalClickInfo(ClickInfo);
  }, [ClickInfo]);

  useEffect(() => {
    if (externalViewState) {
      setViewState(externalViewState);
    }
  }, [externalViewState]);

  const handleSetClickInfo = (value: any) => {
    setLocalClickInfo(value);
    if (setClickInfo) {
      setClickInfo(value);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const clickData = localClickInfo?.object || localClickInfo;
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: clickData,
      });
    },
    onSuccess: async () => {
      await createStopsView(conn);
      await createStationsTable(conn);
      queryClient.invalidateQueries({ queryKey: ["fetchStationData"] });
      handleSetClickInfo(undefined);
    },
  });

  const handleGoToLocation = () => {
    const clickData = localClickInfo?.object || localClickInfo;
    if (clickData?.stop_lon && clickData?.stop_lat) {
      setViewState({
        longitude: clickData.stop_lon,
        latitude: clickData.stop_lat,
        zoom: 18,
      });
    }
  };

  const legendItems = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    if (DataColor === "wheelchair_status") {
      const wheelchairStatuses = Array.from(
        new Set(data.map((item) => item.wheelchair_status).filter(Boolean)),
      );
      return wheelchairStatuses.map((status) => ({
        label: WHEELCHAIR_STATUS[status]?.name || status,
        color: rgbToHex(WHEELCHAIR_STATUS[status]?.color || [128, 128, 128]),
      }));
    }

    const locationTypes = Array.from(
      new Set(data.map((item) => item.location_type_name).filter(Boolean)),
    );
    return locationTypes.map((locationType) => ({
      label: StopTypeColors[locationType]?.name || locationType,
      color: rgbToHex(getStopColor(locationType, theme) || [128, 128, 128]),
    }));
  }, [data, DataColor, theme]);

  if (!data || data.length === 0) {
    return (
      <div className="relative h-[74vh] w-full border rounded overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          No platform data available for this station.
        </div>
      </div>
    );
  }

  const clickData = localClickInfo?.object || localClickInfo;

  const popupElement = clickData ? (
    <MapClickPopup
            title={
              <div className="flex items-center gap-2">
                <EditIndicator status={clickData.status} />
                <span>{clickData.stop_name || "Unknown Part"}</span>
              </div>
            }
            data={clickData}
            onClose={() => handleSetClickInfo(undefined)}
            borderColor={rgbToHex(
              getStopColor(clickData.location_type_name, theme) || [59, 130, 246],
            )}
            columns={[
              "stop_id",
              "stop_lon",
              "stop_lat",
              "location_type_name",
              "wheelchair_status",
            ]}
            columnNames={[
              "Stop Id",
              "Stop Lon",
              "Stop Lat",
              "Location Type",
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
                    Zoom to Part
                  </Button>
                  {clickData.location_type_name !== "Station" && (
                    <div className="flex gap-2">
                      <EditButton
                        onClick={() => setOpen({ formType: "edit", state: true })}
                        className="w-full"
                      />
                      <DeleteButton
                        onClick={() => mutation.mutate()}
                        isPending={mutation.isPending}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </TooltipProvider>
            }
          />
  ) : null;

  return (
    <MapContainer
      instructionText="Click a point to edit or delete a station part"
      showLegend={legendItems.length > 0}
      legendContent={
        <MapLegend
          title="Station Parts"
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
      clickPopup={popupElement}
    >
      <MapSection
        MapLayers={MapLayers}
        Data={data}
        setMapLayers={setMapLayers}
        DataColor={DataColor}
        ClickInfo={localClickInfo}
        setClickInfo={handleSetClickInfo}
        viewState={viewState}
        setViewState={setViewState}
        BoundBox={BoundBox}
        setBoundBox={setBoundBox}
      />
    </MapContainer>
  );
}

export default PartsMap;
