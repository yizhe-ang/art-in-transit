import { LINE_ORDER, getPointAtDistance } from "@/components/three/rail-routes"
import { MathUtils, Vector3 } from "three"

const RAIL_PROGRESS_END = 0.9
const LAST_ANIMATED_LINE_NAME = "North South Line"
const LAST_ANIMATED_LINE_INDEX = LINE_ORDER.indexOf(LAST_ANIMATED_LINE_NAME)

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

function getAnimationLineIndex(lineIndex) {
  if (lineIndex < 0 || LAST_ANIMATED_LINE_INDEX < 0) {
    return lineIndex
  }

  if (lineIndex === LAST_ANIMATED_LINE_INDEX) {
    return LINE_ORDER.length - 1
  }

  if (lineIndex > LAST_ANIMATED_LINE_INDEX) {
    return lineIndex - 1
  }

  return lineIndex
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
  const renderedPosition = new Vector3()

  artworkRoutes.forEach((artworkRoute, index) => {
    const animationLineIndex = getAnimationLineIndex(artworkRoute.lineIndex)
    const lineProgress = getLineProgress(
      progress,
      animationLineIndex,
      lineStagger,
      LINE_ORDER.length
    )

    if (!artworkRoute.route) {
      setPositionAt(array, index, artworkRoute.finalPosition)
      return
    }

    const routeProgress = MathUtils.clamp(lineProgress / RAIL_PROGRESS_END, 0, 1)
    const settleProgress = MathUtils.clamp(
      (lineProgress - RAIL_PROGRESS_END) / (1 - RAIL_PROGRESS_END),
      0,
      1
    )
    const distance = artworkRoute.targetDistance * routeProgress

    getPointAtDistance(artworkRoute.route, distance, currentPosition)
    renderedPosition.copy(currentPosition).lerp(
      artworkRoute.finalPosition,
      settleProgress
    )
    setPositionAt(array, index, renderedPosition)
  })

  positionBuffer.needsUpdate = true
}
