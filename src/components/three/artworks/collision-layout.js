import { useEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import * as THREE from "three/webgpu"
import { artworkZoomScale } from "@/components/three/artworks/zoom-scale"
import { updateArtworkCollisionLayout } from "@/components/three/artworks/layout"

const MIN_ZOOM_SCALE = 0.25
const LAYOUT_ZOOM_EPSILON = 0.02
const LAYOUT_SCALE_EPSILON = 0.002

export function useArtworkCollisionLayout({
  enabled,
  progress,
  renderPositionsRef,
  finalPositionArray,
  aspectRatios,
  camera,
  viewport,
  baseSize,
  altitude,
  padding,
  iterations,
  anchorStrength,
  maxOffset,
}) {
  const map = useMap()
  const referenceZoomRef = useRef(null)
  const layoutDirtyRef = useRef(true)
  const layoutStateRef = useRef({
    zoom: null,
    zoomScale: null,
    width: null,
    height: null,
  })

  useEffect(() => {
    layoutDirtyRef.current = true
  }, [
    enabled,
    renderPositionsRef,
    aspectRatios,
    anchorStrength,
    finalPositionArray,
    iterations,
    maxOffset,
    padding,
  ])

  useFrame(() => {
    if (!map) return

    const zoom = map.getZoom()

    if (referenceZoomRef.current === null) {
      referenceZoomRef.current = zoom
    }

    const zoomScale = THREE.MathUtils.clamp(
      Math.pow(2, referenceZoomRef.current - zoom),
      MIN_ZOOM_SCALE,
      1
    )
    artworkZoomScale.value = zoomScale

    if (progress < 1) return

    const previousLayoutState = layoutStateRef.current
    const shouldUpdateLayout =
      layoutDirtyRef.current ||
      previousLayoutState.zoom === null ||
      Math.abs(previousLayoutState.zoom - zoom) > LAYOUT_ZOOM_EPSILON ||
      Math.abs(previousLayoutState.zoomScale - zoomScale) >
        LAYOUT_SCALE_EPSILON ||
      previousLayoutState.width !== viewport.width ||
      previousLayoutState.height !== viewport.height

    if (!shouldUpdateLayout) return

    const renderPositionBuffer = renderPositionsRef.current.value

    if (enabled) {
      updateArtworkCollisionLayout({
        output: renderPositionBuffer.array,
        finalPositions: finalPositionArray,
        aspectRatios,
        camera,
        viewport,
        baseSize,
        zoomScale,
        altitude,
        padding,
        iterations,
        anchorStrength,
        maxOffset,
      })
    } else {
      renderPositionBuffer.array.set(finalPositionArray)
    }

    renderPositionBuffer.needsUpdate = true
    layoutDirtyRef.current = false
    layoutStateRef.current = {
      zoom,
      zoomScale,
      width: viewport.width,
      height: viewport.height,
    }
  })
}
