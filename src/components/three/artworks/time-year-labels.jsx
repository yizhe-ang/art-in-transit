import { useFrame, useLoader } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import {
  MSDFTextGeometry,
  MSDFTextNodeMaterial,
} from "three-msdf-text-utils/webgpu"

const TIME_YEAR_LABEL_ATLAS_PATH =
  "/fonts/msdf/LTAIdentity.Medium-msdf-atlas.png"
const TIME_YEAR_LABEL_FONT_PATH = "/fonts/msdf/LTAIdentity.Medium-msdf.json"
const TIME_YEAR_LABEL_SCALE = 18
const TIME_YEAR_LABEL_COLOR = "rgba(255, 255, 255, 0.94)"
const TIME_YEAR_LABEL_STROKE_COLOR = "rgba(0, 0, 0, 0.78)"

function configureTimeYearLabelAtlas(texture) {
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true

  return texture
}

function createTimeYearLabelGeometry(label, font) {
  const geometry = new MSDFTextGeometry({
    text: label,
    font,
    align: "center",
    mode: "nowrap",
    letterSpacing: 0,
  })

  geometry.computeBoundingBox()
  geometry.translate(-geometry.layout.width * 0.5, -geometry.layout.height * 0.5, 0)

  return geometry
}

function TimeYearLabels({ labels, timeLayoutProgressUniform }) {
  const atlasTexture = useLoader(THREE.TextureLoader, TIME_YEAR_LABEL_ATLAS_PATH)
  const materialRef = useRef(null)
  const labelRefs = useRef([])
  const [font, setFont] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(TIME_YEAR_LABEL_FONT_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load MSDF font: ${response.status}`)
        }

        return response.json()
      })
      .then((fontData) => {
        if (!cancelled) setFont(fontData)
      })
      .catch((error) => {
        if (!cancelled) console.error(error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    configureTimeYearLabelAtlas(atlasTexture)
  }, [atlasTexture])

  const material = useMemo(() => {
    return new MSDFTextNodeMaterial({
      map: atlasTexture,
      transparent: true,
      alphaTest: 0.01,
      opacity: 0,
      color: TIME_YEAR_LABEL_COLOR,
      strokeColor: TIME_YEAR_LABEL_STROKE_COLOR,
      strokeOutsetWidth: 0.08,
      strokeInsetWidth: 0.24,
    })
  }, [atlasTexture])

  useEffect(() => {
    materialRef.current = material

    return () => {
      material.dispose()
    }
  }, [material])

  const geometries = useMemo(() => {
    if (!font) return []

    return labels.map((label) => ({
      key: label.year,
      label,
      geometry: createTimeYearLabelGeometry(label.label, font),
    }))
  }, [font, labels])

  useEffect(() => {
    labelRefs.current.length = geometries.length

    return () => {
      geometries.forEach(({ geometry }) => {
        geometry.dispose()
      })
    }
  }, [geometries])

  useFrame(({ camera }) => {
    const opacity = THREE.MathUtils.clamp(timeLayoutProgressUniform.value, 0, 1)

    if (materialRef.current) {
      materialRef.current.opacity.value = opacity
    }

    labelRefs.current.forEach((label) => {
      label?.quaternion.copy(camera.quaternion)
    })
  })

  if (!font) return null

  return (
    <group>
      {geometries.map(({ key, label, geometry }, index) => (
        <group
          key={key}
          position={label.position}
          ref={(element) => {
            labelRefs.current[index] = element
          }}
          scale={TIME_YEAR_LABEL_SCALE}
        >
          <mesh geometry={geometry} material={material} frustumCulled={false} />
        </group>
      ))}
    </group>
  )
}

export default TimeYearLabels
