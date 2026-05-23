import { useFrame, useLoader, useThree } from "@react-three/fiber"
import { publicUrl } from "@/lib/public-url"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import {
  MSDFTextGeometry,
  MSDFTextNodeMaterial,
} from "three-msdf-text-utils/webgpu"
import { uniform } from "three/tsl"

const FONT_URL = publicUrl("/fonts/msdf/LTAIdentity.Medium-msdf.json")
const ATLAS_URL = publicUrl("/fonts/msdf/LTAIdentity.Medium-msdf-atlas.png")
const LABEL_SCALE = 13
const LABEL_COLOR = "#004851"
const LABEL_STROKE_COLOR = "#f7f1df"
const LABEL_STROKE_OUTSET_WIDTH = 0.9
const LABEL_STROKE_INSET_WIDTH = 0
const LABEL_ALPHA_TEST = 0.01
const LABEL_RENDER_ORDER = 1000
const LABEL_LOCAL_Y_OFFSET = 120
const labelOpacityUniform = uniform(1)

function parseFontData(fontData) {
  return typeof fontData === "string" ? JSON.parse(fontData) : fontData
}

function configureAtlasTexture(texture) {
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

function createLabelGeometry(label, font) {
  return new MSDFTextGeometry({
    align: "center",
    font,
    mode: "nowrap",
    text: label,
  })
}

const TimeYearLabel = ({
  camera,
  fillMaterial,
  font,
  label,
  outlineMaterial,
  position,
}) => {
  const groupRef = useRef(null)
  const geometry = useMemo(() => {
    return createLabelGeometry(label, font)
  }, [font, label])
  const centeredPosition = useMemo(() => {
    return [
      -geometry.layout.width * 0.5,
      -geometry.layout.height * 0.5 + LABEL_LOCAL_Y_OFFSET,
      0,
    ]
  }, [geometry])

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useFrame(() => {
    groupRef.current?.quaternion.copy(camera.quaternion)
  })

  return (
    <group
      ref={groupRef}
      frustumCulled={false}
      position={position}
      scale={[LABEL_SCALE, -LABEL_SCALE, LABEL_SCALE]}
    >
      <mesh
        frustumCulled={false}
        geometry={geometry}
        material={outlineMaterial}
        position={centeredPosition}
        renderOrder={LABEL_RENDER_ORDER - 1}
      />
      <mesh
        frustumCulled={false}
        geometry={geometry}
        material={fillMaterial}
        position={centeredPosition}
        renderOrder={LABEL_RENDER_ORDER}
      />
    </group>
  )
}

const TimeYearLabels = ({
  embeddingLayoutProgressUniform,
  embeddingRawLayoutProgressUniform,
  labels,
  timeLayoutProgressUniform,
}) => {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const fontData = useLoader(THREE.FileLoader, FONT_URL)
  const atlasTexture = useLoader(THREE.TextureLoader, ATLAS_URL)
  const font = useMemo(() => parseFontData(fontData), [fontData])
  const fillMaterial = useMemo(() => {
    const material = new MSDFTextNodeMaterial({
      alphaTest: LABEL_ALPHA_TEST,
      color: LABEL_COLOR,
      depthTest: false,
      depthWrite: false,
      map: atlasTexture,
      opacity: 1,
      strokeColor: LABEL_COLOR,
      strokeInsetWidth: 0,
      strokeOutsetWidth: 0,
      transparent: true,
    })

    material.depthTest = false
    material.depthWrite = false
    material.opacityNode = labelOpacityUniform.mul(material.opacityNode)
    material.side = THREE.DoubleSide

    return material
  }, [atlasTexture])
  const outlineMaterial = useMemo(() => {
    const material = new MSDFTextNodeMaterial({
      alphaTest: LABEL_ALPHA_TEST,
      color: LABEL_STROKE_COLOR,
      depthTest: false,
      depthWrite: false,
      map: atlasTexture,
      opacity: 1,
      strokeColor: LABEL_STROKE_COLOR,
      strokeInsetWidth: LABEL_STROKE_INSET_WIDTH,
      strokeOutsetWidth: LABEL_STROKE_OUTSET_WIDTH,
      transparent: true,
    })

    material.depthTest = false
    material.depthWrite = false
    material.opacityNode = labelOpacityUniform.mul(material.opacityNode)
    material.side = THREE.DoubleSide

    return material
  }, [atlasTexture])

  useEffect(() => {
    configureAtlasTexture(atlasTexture)
  }, [atlasTexture])

  useEffect(() => {
    return () => {
      fillMaterial.dispose()
    }
  }, [fillMaterial])

  useEffect(() => {
    return () => {
      outlineMaterial.dispose()
    }
  }, [outlineMaterial])

  useFrame(() => {
    const nextOpacity =
      timeLayoutProgressUniform.value *
      (1 - embeddingLayoutProgressUniform.value) *
      (1 - embeddingRawLayoutProgressUniform.value)

    if (labelOpacityUniform.value !== nextOpacity) {
      labelOpacityUniform.value = nextOpacity
      invalidate()
    }
  })

  return (
    <group>
      {labels.map((label) => (
        <TimeYearLabel
          camera={camera}
          fillMaterial={fillMaterial}
          font={font}
          key={label.key}
          label={label.label}
          outlineMaterial={outlineMaterial}
          position={label.position}
        />
      ))}
    </group>
  )
}

export default TimeYearLabels
