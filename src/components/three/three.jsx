import "maplibre-gl/dist/maplibre-gl.css"
import Map from "react-map-gl/maplibre"
import { Canvas } from "react-three-map/maplibre"
import Scene from "@/components/three/scene"
import Rail from "@/components/three/rail"
import loadImages from "@/components/three/loadImages"
import { useState } from "react"

const center = [103.8475, 1.3011]
const lowerLat = 1.23,
  upperLat = 1.475,
  lowerLong = 103.59,
  upperLong = 104.05
const bounds = [lowerLong, lowerLat, upperLong, upperLat]

const Three = () => {
  const [imagesLoaded, setImagesLoaded] = useState(false)

  return (
    <>
      <Map
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

        <Canvas
          latitude={center[1]}
          longitude={center[0]}
          overlay
          renderer
          // background="sunset"
        >
          <Scene />
        </Canvas>
      </Map>
    </>
  )
}

export default Three
