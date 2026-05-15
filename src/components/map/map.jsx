import MapImpl from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import Rail from "@/components/map/rail"
import loadImages from "@/components/map/loadImages"
import { useState } from "react"
import Three from "@/components/three/three"
import { bounds } from "@/components/map/constants"

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
