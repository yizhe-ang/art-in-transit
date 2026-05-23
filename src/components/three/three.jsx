import { Canvas } from "react-three-map/maplibre"
import Scene from "@/components/three/scene"
import { center } from "@/components/map/constants"
import * as THREE from "three/webgpu"
import { extend } from "@react-three/fiber"

extend(THREE)

const Three = () => {
  return (
    <>
      <Canvas
        latitude={center[1]}
        longitude={center[0]}
        frameloop="demand"
        overlay
        gl={async (props) => {
          const renderer = new THREE.WebGPURenderer({
            ...props,
            alpha: true,
          })
          await renderer.init()
          renderer.setClearColor(0x000000, 0)
          return renderer
        }}
      >
        <Scene />
      </Canvas>
    </>
  )
}

export default Three
