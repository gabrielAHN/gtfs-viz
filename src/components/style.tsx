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
};

export const WheelchairStatus = {
  "✅": {
    value: 1
  },
  "❌": {
    value: 2
  },
  "🟡": {
    value: 0
  }
}

export const StopTypeColors = {
  Platform: { color: [220, 38, 38] },
  Station: { color: [59, 130, 246] },
  "Exit/Entrance": { color: [250, 204, 21] },
  "Pathway Node": { color: [34, 197, 94] },
  Unknown: { color: [128, 128, 128] },
};

export const PathwayColors = {
  Walkway: { color: [220, 38, 38] },
  Stairs: { color: [93, 105, 177] },
  "Moving sidewalk/travelator": { color: [82, 188, 163] },
  Escalator: { color: [153, 201, 69] },
  Elevator: { color: [204, 97, 176] },
  "Fare gate": { color: [36, 121, 108] },
  "Exit gate": { color: [218, 165, 27] },
  "❓": { color: [47, 138, 196] },
};

export const ConnectTypeColors = {
  directional: {
    from: [0, 0, 255],
    to: [0, 255, 0],
  },
  bidirectional: {
    bidirectional: [0, 255, 255],
  },
};
