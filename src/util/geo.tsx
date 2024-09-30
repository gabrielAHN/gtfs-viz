export function findCenter(Coordinates) {
  const avgLat =
    Coordinates.reduce((sum, coord) => sum + coord.lat, 0) / Coordinates.length;
  const avgLon =
    Coordinates.reduce((sum, coord) => sum + coord.lon, 0) / Coordinates.length;
  return { lat: avgLat, lon: avgLon };
}

export function getBoundingBox(Coordinates) {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;

  Coordinates.forEach(({ lat, lon }) => {
    minLat = Math.min(minLat, parseFloat(lat));
    maxLat = Math.max(maxLat, parseFloat(lat));
    minLng = Math.min(minLng, parseFloat(lon));
    maxLng = Math.max(maxLng, parseFloat(lon));
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}