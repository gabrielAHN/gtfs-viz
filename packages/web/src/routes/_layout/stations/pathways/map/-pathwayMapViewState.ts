const zoomLevel = 18

const toFiniteNumber = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const getCoordinatePair = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined
  }

  const longitude = toFiniteNumber(value[0])
  const latitude = toFiniteNumber(value[1])

  if (longitude === undefined || latitude === undefined) {
    return undefined
  }

  return { longitude, latitude }
}

const getCoordinatePairFromFields = (longitudeValue: unknown, latitudeValue: unknown) => {
  const longitude = toFiniteNumber(longitudeValue)
  const latitude = toFiniteNumber(latitudeValue)

  if (longitude === undefined || latitude === undefined) {
    return undefined
  }

  return { longitude, latitude }
}

const getStopViewState = (clickData: any) => {
  const coordinate = getCoordinatePairFromFields(clickData?.stop_lon, clickData?.stop_lat)

  if (!coordinate) {
    return undefined
  }

  return {
    ...coordinate,
    zoom: zoomLevel,
  }
}

const getPathwayCoordinates = (clickData: any) => {
  const fromCoord =
    getCoordinatePair(clickData?.from_coord) ??
    getCoordinatePairFromFields(clickData?.from_lon, clickData?.from_lat)
  const toCoord =
    getCoordinatePair(clickData?.to_coord) ??
    getCoordinatePairFromFields(clickData?.to_lon, clickData?.to_lat)

  if (fromCoord && toCoord) {
    return { fromCoord, toCoord }
  }

  if (fromCoord) {
    return { fromCoord, toCoord: fromCoord }
  }

  if (toCoord) {
    return { fromCoord: toCoord, toCoord }
  }

  return undefined
}

const getPathwayViewState = (clickData: any, layerId?: string) => {
  const coordinates = getPathwayCoordinates(clickData)

  if (!coordinates) {
    return undefined
  }

  const { fromCoord, toCoord } = coordinates

  if (layerId === "PointLayer") {
    return {
      longitude: fromCoord.longitude,
      latitude: fromCoord.latitude,
      zoom: zoomLevel,
    }
  }

  return {
    longitude: (fromCoord.longitude + toCoord.longitude) / 2,
    latitude: (fromCoord.latitude + toCoord.latitude) / 2,
    zoom: zoomLevel,
  }
}

export const getPathwayMapTargetViewState = (clickInfo: any) => {
  const clickData = clickInfo?.object || clickInfo
  const layerId = clickInfo?.layer?.id

  if (!clickData) {
    return undefined
  }

  if (layerId === "TableView" || clickData.stop_lon !== undefined) {
    return getStopViewState(clickData)
  }

  if (
    layerId === "ArcLayer" ||
    layerId === "PointLayer" ||
    clickData.from_coord !== undefined ||
    clickData.to_coord !== undefined ||
    clickData.from_lon !== undefined ||
    clickData.to_lon !== undefined
  ) {
    return getPathwayViewState(clickData, layerId)
  }

  return undefined
}
