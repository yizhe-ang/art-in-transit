import { useMemo } from "react"
import * as THREE from "three/webgpu"
import { pass, screenUV, texture } from "three/tsl"
import { useFrame, useThree } from "@react-three/fiber"
import { dotScreen } from "three/addons/tsl/display/DotScreenNode.js"
import { useTexture } from "@react-three/drei"

const PostProcessing = () => {
  const renderer = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const paperTexture = useTexture("/textures/paper.jpg")

  const renderPipeline = useMemo(() => {
    const renderPipeline = new THREE.RenderPipeline(renderer)

    const scenePass = pass(scene, camera)

    const paper = texture(paperTexture, screenUV)

    const outputNode = scenePass.mul(paper)

    renderPipeline.outputNode = outputNode

    return renderPipeline
  }, [renderer, scene, camera, paperTexture])

  useFrame(() => {
    renderPipeline.render()
  }, 1)

  return <></>
}

export default PostProcessing
