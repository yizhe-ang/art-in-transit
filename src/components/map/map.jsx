import MapImpl from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import Rail from "@/components/map/rail"
import loadImages from "@/components/map/loadImages"
import { useState } from "react"
import Three from "@/components/three/three"
import { bounds } from "@/components/map/constants"
import { useStore } from "@/store"
import PaperOverlay from "@/components/map/paper-overlay"

const dragPanOptions = {
  linearity: 0.3,
  maxSpeed: 1400,
  deceleration: 1800,
}

const scrollZoomOptions = {
  around: "center",
}

const Map = () => {
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const setMap = useStore((state) => state.setMap)

  return (
    <>
      <MapImpl
        canvasContextAttributes={{
          antialias: true,
        }}
        initialViewState={{
          bounds,
        }}
        dragPan={dragPanOptions}
        scrollZoom={scrollZoomOptions}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onLoad={(event) => {
          const map = event.target

          setMap(map)

          map.scrollZoom.setWheelZoomRate(1 / 700)
          map.scrollZoom.setZoomRate(1 / 120)

          loadImages(map).then(() => {
            setImagesLoaded(true)
          })
        }}
      >
        {imagesLoaded && <Rail />}

        <PaperOverlay />

        <Three />
      </MapImpl>
    </>
  )
}

export default Map
