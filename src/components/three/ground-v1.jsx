import { useLoader } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { folder, useControls } from "leva"

// TODO: Have a normal map? React to lighting etc.
// TODO: Do this directly in the maplibre layer?

const SIZE = 60_000

function createPaperAlphaMap(
  sourceTexture,
  { threshold, softness, contrast, repeat }
) {
  const image = sourceTexture.image
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })

  canvas.width = image.width
  canvas.height = image.height

  context.drawImage(image, 0, 0)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722

    // Only darker paper fibers become visible.
    // Most of the texture becomes alpha 0.
    const rawFiber = THREE.MathUtils.smoothstep(
      threshold - luminance,
      0,
      softness
    )
    const fiber = Math.pow(rawFiber, contrast)

    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = Math.round(fiber * 255)
  }

  context.putImageData(imageData, 0, 0)

  const alphaMap = new THREE.CanvasTexture(canvas)
  alphaMap.wrapS = THREE.RepeatWrapping
  alphaMap.wrapT = THREE.RepeatWrapping
  alphaMap.repeat.set(repeat, repeat)
  alphaMap.needsUpdate = true

  return alphaMap
}

const Ground = () => {
  const paperTexture = useLoader(THREE.TextureLoader, "/textures/paper.jpg")

  const { repeat, opacity, tint, threshold, softness, contrast } = useControls({
    ground: folder({
      repeat: {
        value: 110,
        min: 10,
        max: 220,
        step: 1,
      },
      opacity: {
        value: 0.22,
        min: 0,
        max: 1,
        step: 0.01,
      },
      tint: {
        value: "#2f261d",
      },
      threshold: {
        value: 0.66,
        min: 0,
        max: 1,
        step: 0.01,
      },
      softness: {
        value: 0.18,
        min: 0.01,
        max: 0.8,
        step: 0.01,
      },
      contrast: {
        value: 2.2,
        min: 0.2,
        max: 4,
        step: 0.05,
      },
    }),
  })

  const paperAlphaMap = useMemo(() => {
    return createPaperAlphaMap(paperTexture, {
      threshold,
      softness,
      contrast,
      repeat,
    })
  }, [paperTexture, threshold, softness, contrast, repeat])

  useEffect(() => {
    return () => {
      paperAlphaMap.dispose()
    }
  }, [paperAlphaMap])

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.5, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicMaterial
        color={tint}
        alphaMap={paperAlphaMap}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default Ground
