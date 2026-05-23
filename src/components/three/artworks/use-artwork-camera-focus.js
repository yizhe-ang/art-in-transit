import { origin } from "@/components/map/constants"
import {
  ALTITUDE,
  CAMERA_FOCUS_DURATION,
  MAP_CAMERA_FOCUS_ZOOM,
  ORGANIZED_CAMERA_FOCUS_ZOOM,
} from "@/components/three/artworks/constants"
import { getArtworkKey } from "@/components/three/artworks/artwork-routes"
import { useEffect } from "react"
import { vector3ToCoords } from "react-three-map/maplibre"
import * as THREE from "three/webgpu"

function getPositionFromArray(array, index, target) {
  const offset = index * 3

  return target.set(array[offset], array[offset + 1], array[offset + 2])
}

function getArtworkLayoutTargetPosition({
  artworkLayout,
  embeddingLayoutPositionArray,
  finalPositions,
  index,
  lineRowPositions,
  target,
  timePositionArray,
}) {
  const embeddingOffset = index * 4

  if (artworkLayout === "line") {
    return getPositionFromArray(lineRowPositions, index, target)
  }

  if (artworkLayout === "time") {
    return getPositionFromArray(timePositionArray, index, target)
  }

  if (artworkLayout === "embedding") {
    return target.set(
      embeddingLayoutPositionArray[embeddingOffset],
      ALTITUDE,
      embeddingLayoutPositionArray[embeddingOffset + 1]
    )
  }

  if (artworkLayout === "embeddingRaw") {
    return target.set(
      embeddingLayoutPositionArray[embeddingOffset + 2],
      ALTITUDE,
      embeddingLayoutPositionArray[embeddingOffset + 3]
    )
  }

  return getPositionFromArray(finalPositions, index, target)
}

function shouldReduceCameraMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  )
}

function getCameraFocusZoom(artworkLayout) {
  return artworkLayout === "map"
    ? MAP_CAMERA_FOCUS_ZOOM
    : ORGANIZED_CAMERA_FOCUS_ZOOM
}

export function useArtworkCameraFocus({
  artworkCameraFocusRequest,
  artworkIndexByKey,
  artworkLayout,
  embeddingLayoutPositionArray,
  finalPositionArray,
  lineRowPositions,
  map,
  timePositionArray,
}) {
  useEffect(() => {
    if (!map || !artworkCameraFocusRequest?.artwork) {
      return
    }

    const artworkKey = getArtworkKey(artworkCameraFocusRequest.artwork)
    const artworkIndex = artworkIndexByKey.get(artworkKey)

    if (artworkIndex === undefined) {
      return
    }

    const targetPosition = getArtworkLayoutTargetPosition({
      artworkLayout,
      embeddingLayoutPositionArray,
      finalPositions: finalPositionArray,
      index: artworkIndex,
      lineRowPositions,
      target: new THREE.Vector3(),
      timePositionArray,
    })
    const targetCoords = vector3ToCoords(targetPosition.toArray(), origin)
    const duration = shouldReduceCameraMotion() ? 0 : CAMERA_FOCUS_DURATION

    map.stop?.()
    map.easeTo({
      center: [targetCoords.longitude, targetCoords.latitude],
      duration,
      easing: (time) => 1 - Math.pow(1 - time, 3),
      zoom: getCameraFocusZoom(artworkLayout),
    })
  }, [
    artworkCameraFocusRequest,
    artworkIndexByKey,
    artworkLayout,
    embeddingLayoutPositionArray,
    finalPositionArray,
    lineRowPositions,
    map,
    timePositionArray,
  ])
}
