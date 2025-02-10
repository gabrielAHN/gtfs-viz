import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";
import {
  fetchCheckStationData,
  fetchStationPartTypes,
  fetchStationStopIds,
} from "@/hooks/DuckdbCalls/DataFetching/fetchStationInfoData";

import { Map, Table } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import Header from "./Header";
import Form from "./Components/Form"
import MapView from "./MapView";
import TableView from "./TableView";

export const ToggleTabs = [
  { value: "map", label: "Map", icon: <Map className="w-5" /> },
  { value: "table", label: "Table", icon: <Table className="w-5" /> }
];

function StationParts() {
  const { conn } = useDuckDB();
  const { StationView } = useStationViewContext();

  const [StopsID, setStopsID] = useState();
  const [Open, setOpen] = useState({ 'formType': null, 'state': false });
  const [ClickInfo, setClickInfo] = useState();
  const [LocationsList, setLocationsList] = useState([]);

  const { data: StationPartTypes } = useQuery({
    queryKey: ["fetchStationPartTypes", StopsID],
    queryFn: () =>
      fetchStationPartTypes({ conn, table: 'StopsView', StationView, StopsID }),
  });

  const { data: StationStopIds } = useQuery({
    queryKey: ["fetchStationStopIds", LocationsList],
    queryFn: () =>
      fetchStationStopIds({ conn, table: 'StopsView', StationView, LocationsList }),
  });

  const { data } = useQuery({
    queryKey: [
      "fetchStationData",
      LocationsList,
      StopsID,
    ],
    queryFn: () =>
      fetchCheckStationData({
        conn,
        table: "StopsView",
        StationView,
        LocationsList,
        StopsID,
      }),
  });

  return (
    <div className="relative flex flex-col space-y-4">
      <Tabs defaultValue="map" >
        <TabsList className="h-9 mb-2" >
          {
            ToggleTabs.map((tab) => (
              <TabsTrigger className="h-7" key={tab.value} value={tab.value} >
                {tab.icon}
                <span className="ml-2" > {tab.label} </span>
              </TabsTrigger>
            ))
          }
        </TabsList>
        <Header
          setOpen={setOpen}
          StationPartTypes={StationPartTypes}
          LocationsList={LocationsList}
          setLocationsList={setLocationsList}
          StationStopIds={StationStopIds}
          StopsID={StopsID}
          setStopsID={setStopsID}
        />
        <Form
          Data={data}
          OpenValue={Open}
          setOpenValue={setOpen}
          ClickInfo={ClickInfo}
          setClickInfo={setClickInfo}
        />
        <TabsContent value="map" >
          <MapView
            data={data}
            setOpen={setOpen}
            ClickInfo={ClickInfo}
            setClickInfo={setClickInfo}
          />
        </TabsContent>
        <TabsContent value="table" >
          <TableView 
            data={data}
            setOpen={setOpen}
            ClickInfo={ClickInfo}
            setClickInfo={setClickInfo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
export default StationParts;
