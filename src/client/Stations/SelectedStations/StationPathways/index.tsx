import { useState } from "react";
import MapView from "./MapView";
import TableView from "./TableView";

import { Map, Table } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ToggleTabs = [
  { value: "map", label: "Map", icon: <Map /> },
  { value: "table", label: "Table", icon: <Table /> }
];

function StationPathways() {
  const [TabValue, setTabValue] = useState("map");

  const TabChange = (e)=>{setTabValue(e)}

  return (
    <div className="relative flex flex-col space-y-4">
      <Tabs value={TabValue} onValueChange={TabChange}>
        <TabsList className="h-9">
          {ToggleTabs.map((tab) => (
            <TabsTrigger className="h-7" key={tab.value} value={tab.value}>
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="map">
          <MapView />
        </TabsContent>
        <TabsContent value="table">
          <TableView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
export default StationPathways;
