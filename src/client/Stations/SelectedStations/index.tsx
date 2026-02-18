import { useState } from "react";
import { useDuckDB } from "@/context/duckdb.client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BiInfoCircle, BiMapAlt, BiGridAlt } from "react-icons/bi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCheckStationInfo } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { EditIndicator } from "@/components/ui/EditIndicator";

import StationInfo from "./StationInfo";
import StationParts from "./StationParts";
import StationPathways from "./StationPathways";

interface SelectedStationsProps {
  stationId: string;
}

function SelectedStations({ stationId }: SelectedStationsProps) {
  const [tabValue, setTabValue] = useState("StationInfo");
  const { conn, initialized } = useDuckDB();
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["fetchStationInfoData", stationId],
    queryFn: async () => {

      return fetchCheckStationInfo({
        conn,
        table: "StopsView",
        stop_id: stationId,
      });
    },
    enabled: !!conn && !!stationId && initialized,
    retry: false,
  });

  if (isLoading || isFetching) {
    return (
      <>
        <Skeleton className="h-30" />
        <br />
        <Skeleton className="h-30" />
      </>
    );
  }

  if (error) {
    return <div>Error loading station information.</div>;
  }

  if (!data) {
    return <div>No station information available.</div>;
  }

  const ToggleTabs = [
    { value: "StationInfo", label: "Info", icon: <BiInfoCircle /> },
    { value: "StationParts", label: "Parts", icon: <BiGridAlt /> },
  ];

  if (data.pathways_status === "✅") {
    ToggleTabs.push({
      value: "StationPathways",
      label: "Pathways",
      icon: <BiMapAlt />,
    });
  }

  const TabChange = (e) => {
    setTabValue(e);
  };

  return (
    <div>
      <div className="text-4xl font-bold flex justify-center items-center gap-3 mb-6">
        <EditIndicator status={data?.status} className="h-8 w-8" />
        {data.stop_name}
      </div>
      <Tabs value={tabValue} onValueChange={TabChange}>
        <TabsList className="h-[2.8em]">
          {ToggleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="StationInfo">
          <StationInfo Data={data} />
        </TabsContent>
        <TabsContent value="StationParts">
          <StationParts StationView={data} />
        </TabsContent>
        <TabsContent value="StationPathways">
          <StationPathways StationView={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SelectedStations;
