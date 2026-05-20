import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"

const MIN_ZOOM_SCALE = 0.25

export const artworkZoomScale = uniform(1)

export function useArtworkZoomScale() {
  const map = useMap()
  const referenceZoomRef = useRef(null)

  useFrame(() => {
    if (!map) return

    const zoom = map.getZoom()

    if (referenceZoomRef.current === null) {
      referenceZoomRef.current = zoom
    }

    artworkZoomScale.value = THREE.MathUtils.clamp(
      Math.pow(2, referenceZoomRef.current - zoom),
      MIN_ZOOM_SCALE,
      1
    )
  })
}
