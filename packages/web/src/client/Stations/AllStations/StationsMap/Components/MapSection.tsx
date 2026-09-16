import { useEffect, useState, useCallback, useRef } from "react"

import DeckglMap from "@/components/maps/DeckglMap.lazy"

import { DATA_STATUS, getStopColor } from "@/components/style"
import { ScatterplotLayer } from "@deck.gl/layers"
import { useThemeContext } from "@/context/theme.client"
import { createPointOutline } from "@/components/maps/MapOutlineHelpers"

function MapSection({
  MapLayers,
  TableData,
  setMapLayers,
  DataColor,
  viewState,
  setViewState,
  BoundBox,
  setBoundBox,
  ClickInfo,
  setClickInfo,
}) {
  const { theme } = useThemeContext()
  const [HoverInfo, setHoverInfo] = useState()
  const lastAutoZoomedStopId = useRef(null)

  const handleClick = useCallback(
    (event) => {
      if (event.object) {
        setClickInfo(event)
      } else {
        setClickInfo(undefined)
      }
    },
    [setClickInfo],
  )

  // Bounds set by parent via fetchStationsMapBounds macro

  useEffect(() => {
    if (!ClickInfo) return

    const clickData = ClickInfo?.object || ClickInfo

    if (clickData?.stop_lon && clickData?.stop_lat && clickData?.stop_id) {
      if (lastAutoZoomedStopId.current === clickData.stop_id) return
      setViewState((prev) => ({
        ...prev,
        longitude: clickData.stop_lon,
        latitude: clickData.stop_lat,
        zoom: 15,
        transitionDuration: 300,
      }))
      lastAutoZoomedStopId.current = clickData.stop_id
    }
  }, [ClickInfo, setViewState])

  useEffect(() => {
    if (!TableData || TableData.length === 0) {
      setMapLayers([])
      return
    }

    const mapPoints = TableData.filter((row) => row.stop_lon !== null && row.stop_lat !== null)

    if (mapPoints.length === 0) {
      setMapLayers([])
      return
    }

    const baseLayer = new ScatterplotLayer({
      id: "all-table-view",
      data: mapPoints,
      getFillColor: (row) => {
        const value = row[DataColor]

        if (DATA_STATUS[value]) {
          return DATA_STATUS[value].color
        }

        return getStopColor(value, theme)
      },
      getPosition: (row) => [Number(row.stop_lon), Number(row.stop_lat)],
      pickable: true,
      getLineWidth: 0.025,
      stroked: true,
      radiusUnits: "pixels",
      radiusMinPixels: 4,
    })

    const layers = [baseLayer]

    const clickData = ClickInfo?.object || ClickInfo
    const hoverData = HoverInfo?.object || HoverInfo

    if (
      HoverInfo?.layer?.id === "all-table-view" &&
      hoverData &&
      (!clickData || hoverData.stop_id !== clickData.stop_id)
    ) {
      const hoverOutline = createPointOutline({
        id: "hover-stop-point",
        data: [hoverData],
        theme,
        state: "hover",
      })
      layers.push(hoverOutline)
    }

    if (clickData && clickData.stop_id) {
      const selectedOutline = createPointOutline({
        id: "selected-stop-point",
        data: [clickData],
        theme,
        state: "selected",
      })
      layers.push(selectedOutline)
    }

    setMapLayers(layers)
  }, [TableData, DataColor, ClickInfo, HoverInfo, theme])

  if (!viewState || !BoundBox) return null

  return (
    <DeckglMap
      MinZoom={7}
      dragRotate={false}
      maxPitch={0}
      MapLayers={MapLayers}
      BoundBox={BoundBox}
      viewState={viewState}
      setClickInfo={handleClick}
      setViewState={setViewState}
      setHoverInfo={setHoverInfo}
    />
  )
}

export default MapSection
