import { useEffect, useState } from "react";
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Waypoints, Grip } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCheckStationInfo } from "@/hooks/DuckdbCalls/DataFetching/fetchStationInfoData";

import StationInfo from "./StationInfo";
import StationParts from "./StationParts";
import StationPathways from "./StationPathways"

function SelectedStations() {
  const { StationView, setStationView } = useStationViewContext();
  const [tabValue, setTabValue] = useState("StationInfo");
  const { conn } = useDuckDB();
  const {
    data,
    error,
    isLoading,
    isFetching,
    isSuccess
  } = useQuery({
    queryKey: ["fetchStationInfoData"],
    queryFn: async () => {
      // await conn.query(CreateStationsTable);
      return fetchCheckStationInfo({
        conn,
        table: "StopsView",
        stop_id: StationView.stop_id
      });
    }
  });

  // 1. Call useEffect at the top level
  useEffect(() => {
    // Only update context when data is successfully fetched
    if (isSuccess && data) {
      setStationView(data);
    }
  }, [isSuccess, data, setStationView]);

  // 2. Then do your conditional returns
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
    { value: "StationInfo", label: "Info", icon: <Info /> },
    { value: "StationParts", label: "Parts", icon: <Grip /> }
  ];

  if (data.pathways_status === "✅") {
    ToggleTabs.push({
      value: "StationPathways",
      label: "Pathways",
      icon: <Waypoints />
    });
  }

  const TabChange = (e)=>{setTabValue(e)}

  return (
    <div>
      <div className="text-4xl font-bold flex justify-center mb-6">
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
          <StationParts />
        </TabsContent>
        <TabsContent value="StationPathways">
          <StationPathways />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SelectedStations;
