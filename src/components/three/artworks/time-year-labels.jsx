import { useFrame, useLoader, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import {
  MSDFTextGeometry,
  MSDFTextNodeMaterial,
} from "three-msdf-text-utils/webgpu"

const FONT_URL = "/fonts/msdf/LTAIdentity.Medium-msdf.json"
const ATLAS_URL = "/fonts/msdf/LTAIdentity.Medium-msdf-atlas.png"
const LABEL_SCALE = 11
const LABEL_COLOR = "#f7f3e8"
const LABEL_ALPHA_TEST = 0.01
const LABEL_RENDER_ORDER = 5

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

const TimeYearLabel = ({ camera, font, label, material, position }) => {
  const groupRef = useRef(null)
  const geometry = useMemo(() => {
    return createLabelGeometry(label, font)
  }, [font, label])
  const centeredPosition = useMemo(() => {
    return [
      -geometry.layout.width * 0.5,
      -geometry.layout.height * 0.5,
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
      scale={LABEL_SCALE}
    >
      <mesh
        frustumCulled={false}
        geometry={geometry}
        material={material}
        position={centeredPosition}
        renderOrder={LABEL_RENDER_ORDER}
      />
    </group>
  )
}

const TimeYearLabels = ({ labels, timeLayoutProgressUniform }) => {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const fontData = useLoader(THREE.FileLoader, FONT_URL)
  const atlasTexture = useLoader(THREE.TextureLoader, ATLAS_URL)
  const opacityUniformRef = useRef(null)
  const font = useMemo(() => parseFontData(fontData), [fontData])
  const material = useMemo(() => {
    return new MSDFTextNodeMaterial({
      alphaTest: LABEL_ALPHA_TEST,
      color: LABEL_COLOR,
      map: atlasTexture,
      opacity: 0,
      transparent: true,
    })
  }, [atlasTexture])

  useEffect(() => {
    opacityUniformRef.current = material.opacity
  }, [material])

  useEffect(() => {
    configureAtlasTexture(atlasTexture)
  }, [atlasTexture])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame(() => {
    const opacityUniform = opacityUniformRef.current

    if (
      opacityUniform &&
      opacityUniform.value !== timeLayoutProgressUniform.value
    ) {
      opacityUniform.value = timeLayoutProgressUniform.value
      invalidate()
    }
  })

  return (
    <group>
      {labels.map((label) => (
        <TimeYearLabel
          camera={camera}
          font={font}
          key={label.key}
          label={label.label}
          material={material}
          position={label.position}
        />
      ))}
    </group>
  )
}

export default TimeYearLabels
