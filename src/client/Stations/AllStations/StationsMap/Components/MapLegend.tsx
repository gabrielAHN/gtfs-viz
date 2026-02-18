import { useState } from "react";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
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
      <div className="flex items-center justify-between mb-2">
        <CollapsibleTrigger asChild>
          <button
            className="p-1 hover:bg-accent rounded"
            aria-expanded={Expanded}
            aria-label="Toggle Legend"
          >
            {Expanded ? <BiChevronUp size={16} /> : <BiChevronDown size={16} />}
          </button>
        </CollapsibleTrigger>
        <Select onValueChange={handleChange} defaultValue={DataColor}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Color By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pathways_status">Pathway</SelectItem>
            <SelectItem value="wheelchair_status">Wheelchair</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CollapsibleContent>
        {StatusList.map((status, index) => {
          const statusData = DATA_STATUS[status];
          const displayName = statusData?.name || status;

          return (
            <div key={index} className="flex items-center mb-2">
              <div
                className={`w-3 h-3 rounded-full mr-2 ${statusData?.tailwindColor || 'bg-gray-400'}`}
              />
              <p className="text-sm">{displayName}</p>
            </div>
          );
        })}
      </CollapsibleContent>
      </Collapsible>
  );
}

export default MapLegend;
