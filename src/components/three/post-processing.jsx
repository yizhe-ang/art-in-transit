import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import {
  clamp,
  float,
  luminance,
  mix,
  pass,
  screenUV,
  smoothstep,
  // texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl"
import { useFrame, useThree } from "@react-three/fiber"
// import { useTexture } from "@react-three/drei"
import { folder, useControls } from "leva"

const strengthUniform = uniform(1)
const thresholdUniform = uniform(0.08)
const softnessUniform = uniform(0.6)
const effectAmountUniform = uniform(0.35)
const brightnessUniform = uniform(0.02)
const saturationUniform = uniform(-0.18)
const contrastUniform = uniform(-0.08)

const PostProcessing = ({ fluidMaskNode }) => {
  const renderer = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  // const paperTexture = useTexture("/textures/paper.jpg")

  const {
    enabled,
    debugMask,
    flipY,
    strength,
    threshold,
    softness,
    effectAmount,
    brightness,
    saturation,
    contrast,
  } = useControls({
    "fluid mask": folder({
      enabled: true,
      debugMask: false,
      flipY: true,
      strength: {
        value: 1,
        min: 0,
        max: 1,
        step: 0.01,
      },
      threshold: {
        value: 0.08,
        min: 0,
        max: 0.5,
        step: 0.01,
      },
      softness: {
        value: 0.6,
        min: 0.01,
        max: 1,
        step: 0.01,
      },
      effectAmount: {
        value: 0.35,
        min: 0,
        max: 1,
        step: 0.01,
      },
      brightness: {
        value: 0.02,
        min: -0.5,
        max: 0.8,
        step: 0.01,
      },
      saturation: {
        value: -0.18,
        min: -1,
        max: 1.5,
        step: 0.01,
      },
      contrast: {
        value: -0.08,
        min: -0.5,
        max: 0.8,
        step: 0.01,
      },
    }),
  })

  useEffect(() => {
    strengthUniform.value = strength
    thresholdUniform.value = threshold
    softnessUniform.value = softness
    effectAmountUniform.value = effectAmount
    brightnessUniform.value = brightness
    saturationUniform.value = saturation
    contrastUniform.value = contrast
  }, [
    brightness,
    contrast,
    effectAmount,
    saturation,
    softness,
    strength,
    threshold,
  ])

  const renderPipeline = useMemo(() => {
    const renderPipeline = new THREE.RenderPipeline(renderer)
    renderPipeline._quadMesh.material.transparent = true
    renderPipeline._quadMesh.material.depthTest = false
    renderPipeline._quadMesh.material.depthWrite = false

    const scenePass = pass(scene, camera)
    const sceneAlpha = scenePass.a

    // const paper = texture(paperTexture, screenUV)

    // let outputNode = scenePass.mul(paper)
    let outputNode = scenePass

    if (enabled && fluidMaskNode) {
      const maskUV = flipY
        ? vec2(screenUV.x, float(1).sub(screenUV.y))
        : screenUV
      const rawMask = float(1).sub(fluidMaskNode.sample(maskUV).r)
      const shapedMask = smoothstep(
        thresholdUniform,
        thresholdUniform.add(softnessUniform),
        rawMask
      ).mul(strengthUniform)

      if (debugMask) {
        outputNode = vec4(vec3(shapedMask), sceneAlpha)
      } else {
        const normalColor = outputNode.rgb
        const luminanceColor = vec3(luminance(normalColor))
        const fadedSaturationColor = mix(
          luminanceColor,
          normalColor,
          float(1).add(saturationUniform)
        )
        const fadedContrastColor = fadedSaturationColor
          .sub(vec3(0.5))
          .mul(float(1).add(contrastUniform))
          .add(vec3(0.5))
        const fadedColor = clamp(
          fadedContrastColor.add(vec3(brightnessUniform)),
          vec3(0),
          vec3(1)
        )
        const subtleFadedColor = mix(
          normalColor,
          fadedColor,
          effectAmountUniform
        )

        outputNode = vec4(
          mix(subtleFadedColor, normalColor, shapedMask),
          sceneAlpha
        )
      }
    }

    renderPipeline.outputNode = outputNode

    return renderPipeline
  }, [
    renderer,
    scene,
    camera,
    // paperTexture,
    enabled,
    debugMask,
    flipY,
    fluidMaskNode,
  ])

  useFrame(() => {
    renderPipeline.render()
  }, 1)

  return <></>
}

export default PostProcessing
