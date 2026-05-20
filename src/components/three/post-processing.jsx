import { useMemo } from "react"
import * as THREE from "three/webgpu"
import { pass } from "three/tsl"
import { useFrame, useThree } from "@react-three/fiber"
import { dotScreen } from "three/addons/tsl/display/DotScreenNode.js"

const PostProcessing = () => {
  const renderer = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const renderPipeline = useMemo(() => {
    const renderPipeline = new THREE.RenderPipeline(renderer)

    const scenePass = pass(scene, camera)
    const scenePassColor = scenePass.getTextureNode() // get the rendered image

    // const dotScreenPass = dotScreen(scenePassColor)
    // dotScreenPass.scale.value = 0.01

    renderPipeline.outputNode = scenePass
    // renderPipeline.outputNode = dotScreenPass

    return renderPipeline
  }, [renderer, scene, camera])

  useFrame(() => {
    renderPipeline.render()
  }, 1)

  return <></>
}

export default PostProcessing
