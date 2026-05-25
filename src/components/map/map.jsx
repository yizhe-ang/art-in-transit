import MapImpl from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import Rail from "@/components/map/rail"
import loadImages from "@/components/map/loadImages"
import { useEffect, useRef, useState } from "react"
import Three from "@/components/three/three"
import { bounds } from "@/components/map/constants"
import { useStore } from "@/store"
import PaperOverlay from "@/components/map/paper-overlay"
import MapLightenOverlay from "@/components/map/map-lighten-overlay"

const dragPanOptions = {
  linearity: 0.3,
  maxSpeed: 1400,
  deceleration: 1800,
}

const scrollZoomOptions = {
  around: "center",
}

const MOBILE_BREAKPOINT = 768
const MOBILE_BOUNDS_INSET_RATIO = 0.2

const getInitialBounds = () => {
  if (typeof window === "undefined" || window.innerWidth >= MOBILE_BREAKPOINT) {
    return bounds
  }

  const [west, south, east, north] = bounds
  const longitudeInset = (east - west) * MOBILE_BOUNDS_INSET_RATIO
  const latitudeInset = (north - south) * MOBILE_BOUNDS_INSET_RATIO

  return [
    west + longitudeInset,
    south + latitudeInset,
    east - longitudeInset,
    north - latitudeInset,
  ]
}

const enableMapInteractions = (map) => {
  map.dragPan.enable(dragPanOptions)
  map.scrollZoom.enable(scrollZoomOptions)
  map.touchZoomRotate.enable()
  map.doubleClickZoom.enable()
  map.keyboard.enable()
  map.boxZoom.enable()
  map.dragRotate.enable()
}

const disableMapInteractions = (map) => {
  map.dragPan.disable()
  map.scrollZoom.disable()
  map.touchZoomRotate.disable()
  map.doubleClickZoom.disable()
  map.keyboard.disable()
  map.boxZoom.disable()
  map.dragRotate.disable()
}

const Map = () => {
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const mapRef = useRef(null)
  const setMap = useStore((state) => state.setMap)
  const setMapImagesReady = useStore((state) => state.setMapImagesReady)
  const initialBounds = getInitialBounds()

  useEffect(() => {
    setMapImagesReady(false)
  }, [setMapImagesReady])

  useEffect(() => {
    return useStore.subscribe((state, previousState) => {
      if (
        state.isMapInteractionUnlocked ===
        previousState?.isMapInteractionUnlocked
      ) {
        return
      }

      const map = mapRef.current

      if (!map) {
        return
      }

      if (state.isMapInteractionUnlocked) {
        enableMapInteractions(map)
        map.scrollZoom.setWheelZoomRate(1 / 700)
        map.scrollZoom.setZoomRate(1 / 120)
        return
      }

      disableMapInteractions(map)
    })
  }, [])

  return (
    <>
      <MapImpl
        canvasContextAttributes={{
          antialias: true,
        }}
        initialViewState={{
          bounds: initialBounds,
        }}
        // minZoom={4}
        // maxBounds={[103.05, 0.52, 104.18, 1.98]}
        dragPan={dragPanOptions}
        scrollZoom={scrollZoomOptions}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onLoad={(event) => {
          const map = event.target

          mapRef.current = map
          setMap(map)

          map.scrollZoom.setWheelZoomRate(1 / 700)
          map.scrollZoom.setZoomRate(1 / 120)

          if (useStore.getState().isMapInteractionUnlocked) {
            enableMapInteractions(map)
          } else {
            disableMapInteractions(map)
          }

          loadImages(map)
            .then(() => {
              setImagesLoaded(true)
              setMapImagesReady(true)
            })
            .catch((error) => {
              console.error("Map image loading failed:", error)
            })
        }}
      >
        {imagesLoaded && <Rail />}

        <MapLightenOverlay />

        <PaperOverlay />

        <Three />
      </MapImpl>
    </>
  )
}

export default Map
