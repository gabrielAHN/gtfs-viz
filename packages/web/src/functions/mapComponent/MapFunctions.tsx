import { findCenter, getBoundingBox } from "@/functions/mapComponent/components/geo";
import { logger } from "@/lib/logger";

export function getMapsFunction(data) {
  let Coordinates = Object.values(data.data)
    .filter(({ stop_lat, stop_lon }) => stop_lat != null && stop_lon != null)
    .map(({ stop_lat, stop_lon }) => ({
      lat: parseFloat(stop_lat),
      lon: parseFloat(stop_lon),
    }));

  if (Coordinates.length === 0) {
    return {
      CenterData: { lat: 0, lon: 0 },
      BoundBox: null,
    };
  }

  const CenterData = findCenter(Coordinates);
  const BoundBox = getBoundingBox(Coordinates);

  return {
    CenterData: CenterData,
    BoundBox: BoundBox,
  };
}
