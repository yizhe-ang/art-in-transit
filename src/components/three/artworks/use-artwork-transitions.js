import {
  DEFAULT_BORDER_INTENSITY,
  DEFAULT_BORDER_OPACITY,
  DEFAULT_BORDER_WIDTH,
  HOVER_TRANSITION_DAMPING,
  HOVER_TRANSITION_EPSILON,
  LAYOUT_TARGETS,
  LAYOUT_TRANSITION_DAMPING,
  LAYOUT_TRANSITION_EPSILON,
  MAX_LAYOUT_TRANSITION_DELTA,
  NO_HOVERED_ARTWORK_ID,
} from "@/components/three/artworks/constants"
import { useCallback, useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"

export const borderWidthUniform = uniform(DEFAULT_BORDER_WIDTH)
export const borderIntensityUniform = uniform(DEFAULT_BORDER_INTENSITY)
export const borderOpacityUniform = uniform(DEFAULT_BORDER_OPACITY)
export const lineLayoutProgressUniform = uniform(0)
export const timeLayoutProgressUniform = uniform(0)
export const embeddingLayoutProgressUniform = uniform(0)
export const embeddingRawLayoutProgressUniform = uniform(0)
export const hoveredArtworkIdUniform = uniform(NO_HOVERED_ARTWORK_ID, "int")
export const previousHoveredArtworkIdUniform = uniform(
  NO_HOVERED_ARTWORK_ID,
  "int"
)
export const hoverTransitionUniform = uniform(1)
export const hoveredArtworkStartInfluenceUniform = uniform(0)
export const previousHoveredArtworkStartInfluenceUniform = uniform(0)

export function useArtworkTransitions({
  artworkLayout,
  borderIntensity,
  borderOpacity,
  borderWidth,
}) {
  const invalidate = useThree((state) => state.invalidate)
  const map = useMap()
  const hoverAnimationActiveRef = useRef(false)
  const layoutAnimationActiveRef = useRef(false)
  const repaintFrameRef = useRef(null)
  const layoutTargetRef = useRef(
    LAYOUT_TARGETS[artworkLayout] ?? LAYOUT_TARGETS.map
  )

  const getArtworkHoverInfluence = useCallback((artworkId) => {
    if (artworkId === null || artworkId === NO_HOVERED_ARTWORK_ID) {
      return 0
    }

    const transition = hoverTransitionUniform.value

    if (artworkId === hoveredArtworkIdUniform.value) {
      return THREE.MathUtils.lerp(
        hoveredArtworkStartInfluenceUniform.value,
        1,
        transition
      )
    }

    if (artworkId === previousHoveredArtworkIdUniform.value) {
      return THREE.MathUtils.lerp(
        previousHoveredArtworkStartInfluenceUniform.value,
        0,
        transition
      )
    }

    return 0
  }, [])

  const scheduleRepaint = useCallback(() => {
    invalidate()

    if (!map || repaintFrameRef.current !== null) return

    repaintFrameRef.current = requestAnimationFrame(() => {
      repaintFrameRef.current = null
      map.triggerRepaint?.()
    })
  }, [invalidate, map])

  const handleArtworkHoverChange = useCallback(
    (pickedId, previousPickedId) => {
      const previousTransitionArtworkId = previousHoveredArtworkIdUniform.value
      const nextPreviousPickedId =
        previousPickedId ??
        (previousTransitionArtworkId !== NO_HOVERED_ARTWORK_ID &&
        previousTransitionArtworkId !== pickedId
          ? previousTransitionArtworkId
          : null)

      hoveredArtworkStartInfluenceUniform.value =
        getArtworkHoverInfluence(pickedId)
      previousHoveredArtworkStartInfluenceUniform.value =
        getArtworkHoverInfluence(nextPreviousPickedId)
      hoveredArtworkIdUniform.value = pickedId ?? NO_HOVERED_ARTWORK_ID
      previousHoveredArtworkIdUniform.value =
        nextPreviousPickedId ?? NO_HOVERED_ARTWORK_ID
      hoverTransitionUniform.value = 0
      hoverAnimationActiveRef.current = true
      scheduleRepaint()
    },
    [getArtworkHoverInfluence, scheduleRepaint]
  )

  useEffect(() => {
    return () => {
      if (repaintFrameRef.current !== null) {
        cancelAnimationFrame(repaintFrameRef.current)
        repaintFrameRef.current = null
      }

      hoveredArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
      previousHoveredArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
      hoverTransitionUniform.value = 1
      hoveredArtworkStartInfluenceUniform.value = 0
      previousHoveredArtworkStartInfluenceUniform.value = 0
      hoverAnimationActiveRef.current = false
      layoutAnimationActiveRef.current = false
      embeddingRawLayoutProgressUniform.value = 0
      layoutTargetRef.current = LAYOUT_TARGETS.map
    }
  }, [])

  useEffect(() => {
    layoutTargetRef.current =
      LAYOUT_TARGETS[artworkLayout] ?? LAYOUT_TARGETS.map
    layoutAnimationActiveRef.current = true
    scheduleRepaint()
  }, [artworkLayout, scheduleRepaint])

  useEffect(() => {
    borderWidthUniform.value = borderWidth
    borderIntensityUniform.value = borderIntensity
    borderOpacityUniform.value = borderOpacity
  }, [borderIntensity, borderOpacity, borderWidth])

  useFrame((_, delta) => {
    if (!hoverAnimationActiveRef.current) return

    hoverTransitionUniform.value = THREE.MathUtils.damp(
      hoverTransitionUniform.value,
      1,
      HOVER_TRANSITION_DAMPING,
      delta
    )

    if (1 - hoverTransitionUniform.value > HOVER_TRANSITION_EPSILON) {
      scheduleRepaint()
      return
    }

    hoverTransitionUniform.value = 1
    previousHoveredArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
    previousHoveredArtworkStartInfluenceUniform.value = 0
    hoveredArtworkStartInfluenceUniform.value =
      hoveredArtworkIdUniform.value === NO_HOVERED_ARTWORK_ID ? 0 : 1
    hoverAnimationActiveRef.current = false
  })

  useFrame((_, delta) => {
    if (!layoutAnimationActiveRef.current) return

    const target = layoutTargetRef.current
    const transitionDelta = Math.min(delta, MAX_LAYOUT_TRANSITION_DELTA)

    lineLayoutProgressUniform.value = THREE.MathUtils.damp(
      lineLayoutProgressUniform.value,
      target.line,
      LAYOUT_TRANSITION_DAMPING,
      transitionDelta
    )
    timeLayoutProgressUniform.value = THREE.MathUtils.damp(
      timeLayoutProgressUniform.value,
      target.time,
      LAYOUT_TRANSITION_DAMPING,
      transitionDelta
    )
    embeddingLayoutProgressUniform.value = THREE.MathUtils.damp(
      embeddingLayoutProgressUniform.value,
      target.embedding,
      LAYOUT_TRANSITION_DAMPING,
      transitionDelta
    )
    embeddingRawLayoutProgressUniform.value = THREE.MathUtils.damp(
      embeddingRawLayoutProgressUniform.value,
      target.embeddingRaw,
      LAYOUT_TRANSITION_DAMPING,
      transitionDelta
    )

    const lineDistance = Math.abs(lineLayoutProgressUniform.value - target.line)
    const timeDistance = Math.abs(timeLayoutProgressUniform.value - target.time)
    const embeddingDistance = Math.abs(
      embeddingLayoutProgressUniform.value - target.embedding
    )
    const embeddingRawDistance = Math.abs(
      embeddingRawLayoutProgressUniform.value - target.embeddingRaw
    )

    if (
      lineDistance > LAYOUT_TRANSITION_EPSILON ||
      timeDistance > LAYOUT_TRANSITION_EPSILON ||
      embeddingDistance > LAYOUT_TRANSITION_EPSILON ||
      embeddingRawDistance > LAYOUT_TRANSITION_EPSILON
    ) {
      scheduleRepaint()
      return
    }

    lineLayoutProgressUniform.value = target.line
    timeLayoutProgressUniform.value = target.time
    embeddingLayoutProgressUniform.value = target.embedding
    embeddingRawLayoutProgressUniform.value = target.embeddingRaw
    layoutAnimationActiveRef.current = false
  })

  return {
    handleArtworkHoverChange,
    scheduleRepaint,
  }
}
