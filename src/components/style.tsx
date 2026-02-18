export const DATA_STATUS = {
  "✅": {
    name: "yes",
    color: [128, 255, 128],
    tailwindColor: "bg-green-300",
  },
  "❌": {
    name: "no",
    color: [255, 128, 128],
    tailwindColor: "bg-red-400",
  },
  "🟡": {
    name: "some",
    color: [255, 255, 0],
    tailwindColor: "bg-yellow-200",
  },
  "❓": {
    name: "unknown",
    color: [255, 255, 128],
    tailwindColor: "bg-gray-500",
  },
  "🔵": {
    name: "No Information",
    color: [100, 149, 237],
    tailwindColor: "bg-blue-400",
  },
  "🟢": {
    name: "Accessible",
    color: [128, 255, 128],
    tailwindColor: "bg-green-400",
  },
  "🔴": {
    name: "Not Accessible",
    color: [255, 128, 128],
    tailwindColor: "bg-red-400",
  },
};

export const WheelchairStatus = {
  "🔵": {
    value: 0
  },
  "🟢": {
    value: 1
  },
  "🔴": {
    value: 2
  },
  "🟡": {
    value: 3
  }
}

export const WHEELCHAIR_STATUS = {
  "🔵": {
    name: "No Information",
    color: [100, 149, 237],
  },
  "🟢": {
    name: "Accessible",
    color: [128, 255, 128],
  },
  "🔴": {
    name: "Not Accessible",
    color: [255, 128, 128],
  },
  "🟡": {
    name: "Unknown",
    color: [255, 255, 128],
  },
};

export const EDITED_STATUS = {
  edited: {
    name: "Edited",
    color: [255, 165, 0],
  },
  not_edited: {
    name: "Not Edited",
    color: [128, 128, 128],
  },
};

export const StopTypeColors = {
  Stop: {
    color: [100, 200, 255],
  },
  Platform: {
    color: [255, 80, 80],
  },
  Station: {
    color: [100, 160, 255],
  },
  "Exit/Entrance": {
    color: [255, 220, 80],
  },
  "Entrance/Exit": {
    color: [255, 220, 80],
  },
  "Pathway Node": {
    color: [80, 230, 120],
  },
  "Generic Node": {
    color: [80, 230, 120],
  },
  "Boarding Area": {
    color: [200, 120, 240],
  },
  Unknown: {
    color: [160, 160, 160],
  },
};

export const PathwayColors = {
  Walkway: {
    color: [255, 80, 80],       
  },
  Stairs: {
    color: [120, 135, 220],     
  },
  "Moving sidewalk/travelator": {
    color: [100, 220, 190],     
  },
  Escalator: {
    color: [180, 235, 100],     
  },
  Elevator: {
    color: [240, 120, 200],     
  },
  "Fare gate": {
    color: [70, 160, 140],      
  },
  "Exit gate": {
    color: [255, 200, 80],      
  },
  "❓": {
    color: [80, 180, 240],      
  },
};

export const ConnectTypeColors = {
  directional: {
    from: [100, 100, 255],   
    to: [0, 255, 100],       
  },
  bidirectional: {
    bidirectional: [100, 230, 255],   
  },
};

export const MapHighlightColors = {
  hover: [222, 198, 117, 220], 
  selected: {
    dark: [222, 207, 117], 
    light: [180, 158, 61], 
  },
};

export const TimeIntervalColors = [
  'hsl(200, 80%, 45%)',  
  'hsl(180, 70%, 40%)',  
  'hsl(150, 60%, 40%)',  
  'hsl(45, 90%, 50%)',   
  'hsl(25, 90%, 50%)',   
];

export const getStopColor = (locationType: string, theme?: 'dark' | 'light'): [number, number, number] => {
  return StopTypeColors[locationType]?.color || [160, 160, 160]; 
};

export const getPathwayColor = (pathwayType: string, theme?: 'dark' | 'light'): [number, number, number] => {
  return PathwayColors[pathwayType]?.color || [160, 160, 160]; 
};

export const getDirectionalColor = (direction: 'from' | 'to', theme?: 'dark' | 'light'): [number, number, number] => {
  return ConnectTypeColors.directional[direction];
};

export const getBidirectionalColor = (theme?: 'dark' | 'light'): [number, number, number] => {
  return ConnectTypeColors.bidirectional.bidirectional;
};

export const getConnectionTypeColor = (row: any, connectionType: string, theme?: 'dark' | 'light'): any => {
  if (connectionType === "directional") {
    const arcStatus = row?.directional ?? null;
    if (arcStatus === "directional") {
      return {
        from: getDirectionalColor('from'),
        to: getDirectionalColor('to'),
      };
    }
    if (arcStatus === "bidirectional") {
      return getBidirectionalColor();
    }
  } else if (connectionType === "PathwayTypes") {
    return getPathwayColor(row.pathwayType);
  }
  return [160, 160, 160]; 
};

export const getHighlightColor = (theme: 'dark' | 'light' = 'dark'): [number, number, number] => {
  return MapHighlightColors.selected[theme];
};
