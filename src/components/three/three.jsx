import { Canvas } from "react-three-map/maplibre"
import Scene from "@/components/three/scene"

const center = [103.8475, 1.3011]

const Three = () => {
  return (
    <>
      <Canvas
        latitude={center[1]}
        longitude={center[0]}
        overlay
        renderer
        // background="sunset"
      >
        <Scene />
      </Canvas>
    </>
  )
}

export default Three
