import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DATA_STATUS } from "@/components/style";

function MapLegend({ TableData, DataColor, setDataColor }) {
  const [Expanded, setExpanded] = useState(true);

  const handleExpandClick = () => {
    setExpanded(!Expanded);
  };

  const handleChange = (value) => {
    setDataColor(value);
  };

  const StatusList = Array.from(
    new Set(Object.entries(TableData).map(([_, value]) => value[DataColor]))
  );

  return (
    <Collapsible
      open={Expanded}
      onOpenChange={handleExpandClick}
      className="absolute right-5 top-20 z-50 max-w-[200px] bg-primary-foreground shadow-md p-4 rounded-md"
    >
      <div className="flex items-center justify-between">
      <CollapsibleTrigger asChild>
          <button
            className="flex items-center text-sm font-medium mr-4"
            aria-expanded={Expanded}
            aria-label="Toggle Legend"
          >
            {Expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </CollapsibleTrigger>
        <Select onValueChange={handleChange} defaultValue={DataColor}>
          <SelectTrigger>
            <SelectValue placeholder="Select Data Color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pathways_status">Pathway</SelectItem>
            <SelectItem value="wheelchair_status">Wheelchair</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CollapsibleContent className="mt-4">
        {StatusList.map((status, index) => (
          <div key={index} className="flex items-center mb-2">
            <div
              className={`w-3 h-3 rounded-full mr-2 ${DATA_STATUS[status]?.tailwindColor}`}
            />
            <p className="text-sm">{DATA_STATUS[status]?.name}</p>
          </div>
        ))}
      </CollapsibleContent>
      </Collapsible>
  );
}

export default MapLegend;
