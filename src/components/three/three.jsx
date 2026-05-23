import { Canvas } from "react-three-map/maplibre"
import Scene from "@/components/three/scene"
import { center } from "@/components/map/constants"
import { useStore } from "@/store"
import * as THREE from "three/webgpu"
import { extend } from "@react-three/fiber"
import { useEffect } from "react"

extend(THREE)

const Three = () => {
  const setThreeSceneReady = useStore((state) => state.setThreeSceneReady)

  useEffect(() => {
    setThreeSceneReady(false)

    return () => {
      setThreeSceneReady(false)
    }
  }, [setThreeSceneReady])

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
          requestAnimationFrame(() => {
            setThreeSceneReady(true)
          })
          return renderer
        }}
      >
        <Scene />
      </Canvas>
    </>
  )
}

export default Three
