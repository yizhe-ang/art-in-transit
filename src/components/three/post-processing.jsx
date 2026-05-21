import { useMemo } from "react"
import * as THREE from "three/webgpu"
import { pass, screenUV, texture } from "three/tsl"
import { useFrame, useThree } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"

const PostProcessing = ({ fluidMaskNode }) => {
  const renderer = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const paperTexture = useTexture("/textures/paper.jpg")

  const renderPipeline = useMemo(() => {
    const renderPipeline = new THREE.RenderPipeline(renderer)

    const scenePass = pass(scene, camera)

    const paper = texture(paperTexture, screenUV)

    let outputNode = scenePass.mul(paper)

    if (fluidMaskNode) {
      // outputNode = outputNode.mul(fluidMaskNode)
    }

    renderPipeline.outputNode = outputNode

    return renderPipeline
  }, [renderer, scene, camera, paperTexture, fluidMaskNode])

  useFrame(() => {
    renderPipeline.render()
  }, 1)

  return <></>
}

export default PostProcessing
