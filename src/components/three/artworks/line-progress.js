import { LINE_ORDER, getPointAtDistance } from "@/components/three/rail-routes"
import { MathUtils, Vector3 } from "three"

export function getLineProgress(progress, lineIndex, lineStagger, lineCount) {
  if (lineIndex < 0) {
    return progress
  }

  const maxStagger = 0.95 / Math.max(1, lineCount - 1)
  const stagger = MathUtils.clamp(lineStagger, 0, maxStagger)
  const lineStart = lineIndex * stagger
  const lineDuration = 1 - (lineCount - 1) * stagger

  return MathUtils.clamp((progress - lineStart) / lineDuration, 0, 1)
}

function setPositionAt(array, index, position) {
  array[index * 3 + 0] = position.x
  array[index * 3 + 1] = position.y
  array[index * 3 + 2] = position.z
}

export function createArtworkLinePositionArray(artworkRoutes) {
  const array = new Float32Array(artworkRoutes.length * 3)

  artworkRoutes.forEach((artworkRoute, index) => {
    setPositionAt(
      array,
      index,
      artworkRoute.route?.points[0] ?? artworkRoute.finalPosition
    )
  })

  return array
}

export function updateArtworkLineProgress({
  positions,
  artworkRoutes,
  progress,
  lineStagger,
}) {
  const positionBuffer = positions.value
  const array = positionBuffer.array
  const currentPosition = new Vector3()

  artworkRoutes.forEach((artworkRoute, index) => {
    const lineProgress = getLineProgress(
      progress,
      artworkRoute.lineIndex,
      lineStagger,
      LINE_ORDER.length
    )

    if (!artworkRoute.route || lineProgress >= 1) {
      setPositionAt(array, index, artworkRoute.finalPosition)
      return
    }

    const distance = artworkRoute.targetDistance * lineProgress
    getPointAtDistance(artworkRoute.route, distance, currentPosition)
    setPositionAt(array, index, currentPosition)
  })

  positionBuffer.needsUpdate = true
}
