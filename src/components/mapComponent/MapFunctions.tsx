import { findCenter, getBoundingBox } from "@/util/geo";

export function getMapsFunction(data) {
  let Coordinates = Object.values(data.data)
    .filter(({ stop_lat, stop_lon }) => stop_lat != null && stop_lon != null)
    .map(({ stop_lat, stop_lon }) => ({
      lat: parseFloat(stop_lat),
      lon: parseFloat(stop_lon),
    }));

  if (Coordinates.length === 0) {
    return { lat: 0, lon: 0 };
  }

  const CenterData = findCenter(Coordinates);
  const BoundBox = getBoundingBox(Coordinates);

  return {
    CenterData: CenterData,
    BoundBox: BoundBox,
  };
}
