import { fitBoundsToData, DEFAULT_CENTER, DEFAULT_BOUNDS } from "./fitBounds"

export async function getMapsFunction(conn: any, data: { data: any[] }) {
  const fit = await fitBoundsToData(
    conn,
    Object.values(data.data).filter(
      ({ stop_lat, stop_lon }) => stop_lat != null && stop_lon != null,
    ),
  )

  if (!fit) {
    return {
      CenterData: DEFAULT_CENTER,
      BoundBox: DEFAULT_BOUNDS,
      ViewState: {
        longitude: DEFAULT_CENTER.lon,
        latitude: DEFAULT_CENTER.lat,
        zoom: 10,
        pitch: 0,
        bearing: 0,
      },
    }
  }

  return {
    CenterData: { lat: fit.viewState.latitude, lon: fit.viewState.longitude },
    BoundBox: fit.boundBox,
    ViewState: fit.viewState,
  }
}
