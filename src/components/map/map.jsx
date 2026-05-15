import MapImpl from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import Rail from "@/components/three/rail"
import loadImages from "@/components/map/loadImages"
import { useState } from "react"
import Three from "@/components/three/three"

const lowerLat = 1.23,
  upperLat = 1.475,
  lowerLong = 103.59,
  upperLong = 104.05
const bounds = [lowerLong, lowerLat, upperLong, upperLat]

const Map = () => {
  const [imagesLoaded, setImagesLoaded] = useState(false)

  return (
    <>
      <MapImpl
        canvasContextAttributes={{
          antialias: true,
        }}
        initialViewState={{
          bounds,
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onLoad={(event) => {
          const map = event.target

          loadImages(map).then(() => {
            setImagesLoaded(true)
          })
        }}
      >
        {imagesLoaded && <Rail />}

        <Three />
      </MapImpl>
    </>
  )
}

export default Map
