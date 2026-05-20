import * as THREE from "three"

const DEFAULT_PADDING = 12
const DEFAULT_ITERATIONS = 4
const DEFAULT_ANCHOR_STRENGTH = 0.18
const DEFAULT_MAX_OFFSET = 160
const MIN_CELL_SIZE = 32
const MAP_HEIGHT_PLANE_NORMAL = new THREE.Vector3(0, 1, 0)

const projectToScreen = (position, camera, viewport, target) => {
  target.copy(position).project(camera)

  return {
    x: (target.x * 0.5 + 0.5) * viewport.width,
    y: (-target.y * 0.5 + 0.5) * viewport.height,
    z: target.z,
  }
}

const getProjectedScreenSize = ({
  camera,
  viewport,
  position,
  width,
  height,
  scratchCenter,
  scratchWidth,
  scratchHeight,
  cameraRight,
  cameraUp,
}) => {
  const center = projectToScreen(position, camera, viewport, scratchCenter)
  const widthEdge = projectToScreen(
    scratchWidth.copy(position).addScaledVector(cameraRight, width * 0.5),
    camera,
    viewport,
    scratchWidth
  )
  const heightEdge = projectToScreen(
    scratchHeight.copy(position).addScaledVector(cameraUp, height * 0.5),
    camera,
    viewport,
    scratchHeight
  )

  return {
    width: Math.abs(widthEdge.x - center.x) * 2,
    height: Math.abs(heightEdge.y - center.y) * 2,
  }
}

const addToGrid = (grid, key, index) => {
  let bucket = grid.get(key)

  if (!bucket) {
    bucket = []
    grid.set(key, bucket)
  }

  bucket.push(index)
}

const buildGrid = (items, cellSize) => {
  const grid = new Map()

  items.forEach((item, index) => {
    const minCellX = Math.floor((item.x - item.width * 0.5) / cellSize)
    const maxCellX = Math.floor((item.x + item.width * 0.5) / cellSize)
    const minCellY = Math.floor((item.y - item.height * 0.5) / cellSize)
    const maxCellY = Math.floor((item.y + item.height * 0.5) / cellSize)

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        addToGrid(grid, `${cellX},${cellY}`, index)
      }
    }
  })

  return grid
}

const separatePair = (a, b, padding) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const overlapX = (a.width + b.width) * 0.5 + padding - Math.abs(dx)
  const overlapY = (a.height + b.height) * 0.5 + padding - Math.abs(dy)

  if (overlapX <= 0 || overlapY <= 0) return false

  if (overlapX < overlapY) {
    const direction = dx === 0 ? (a.index < b.index ? 1 : -1) : Math.sign(dx)
    const offset = overlapX * 0.5 * direction
    a.x -= offset
    b.x += offset
  } else {
    const direction = dy === 0 ? (a.index < b.index ? 1 : -1) : Math.sign(dy)
    const offset = overlapY * 0.5 * direction
    a.y -= offset
    b.y += offset
  }

  return true
}

const pullTowardAnchor = (item, anchorStrength, maxOffset) => {
  item.x += (item.anchorX - item.x) * anchorStrength
  item.y += (item.anchorY - item.y) * anchorStrength

  const dx = item.x - item.anchorX
  const dy = item.y - item.anchorY
  const distance = Math.hypot(dx, dy)

  if (distance <= maxOffset || distance === 0) return

  const scale = maxOffset / distance
  item.x = item.anchorX + dx * scale
  item.y = item.anchorY + dy * scale
}

const screenToWorldAtMapHeight = ({
  camera,
  viewport,
  screenX,
  screenY,
  height,
  raycaster,
  plane,
  target,
}) => {
  const ndcX = (screenX / viewport.width) * 2 - 1
  const ndcY = -(screenY / viewport.height) * 2 + 1

  plane.set(MAP_HEIGHT_PLANE_NORMAL, -height)
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)

  return raycaster.ray.intersectPlane(plane, target)
}

// Collision resolution happens in screen space, then maps back onto the
// constant-height map plane. react-three-map stores altitude in world y,
// so layout nudges can only move along the map plane: world x/z.
export function updateArtworkCollisionLayout({
  output,
  finalPositions,
  aspectRatios,
  camera,
  viewport,
  baseSize,
  zoomScale,
  altitude,
  padding = DEFAULT_PADDING,
  iterations = DEFAULT_ITERATIONS,
  anchorStrength = DEFAULT_ANCHOR_STRENGTH,
  maxOffset = DEFAULT_MAX_OFFSET,
}) {
  if (!viewport.width || !viewport.height) {
    output.set(finalPositions)
    return
  }

  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()

  const cameraRight = new THREE.Vector3().setFromMatrixColumn(
    camera.matrixWorld,
    0
  )
  const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const scratchPosition = new THREE.Vector3()
  const scratchCenter = new THREE.Vector3()
  const scratchWidth = new THREE.Vector3()
  const scratchHeight = new THREE.Vector3()
  const items = []
  let cellSize = MIN_CELL_SIZE

  for (let index = 0; index < aspectRatios.length; index += 1) {
    scratchPosition.fromArray(finalPositions, index * 3)
    const screen = projectToScreen(
      scratchPosition,
      camera,
      viewport,
      scratchCenter
    )
    const size = getProjectedScreenSize({
      camera,
      viewport,
      position: scratchPosition,
      width: baseSize * zoomScale * (aspectRatios[index] ?? 1),
      height: baseSize * zoomScale,
      scratchCenter,
      scratchWidth,
      scratchHeight,
      cameraRight,
      cameraUp,
    })

    cellSize = Math.max(cellSize, size.width + padding, size.height + padding)
    items.push({
      index,
      x: screen.x,
      y: screen.y,
      anchorX: screen.x,
      anchorY: screen.y,
      width: size.width,
      height: size.height,
    })
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const grid = buildGrid(items, cellSize)
    const checkedPairs = new Set()

    for (const bucket of grid.values()) {
      for (let aIndex = 0; aIndex < bucket.length; aIndex += 1) {
        for (let bIndex = aIndex + 1; bIndex < bucket.length; bIndex += 1) {
          const first = bucket[aIndex]
          const second = bucket[bIndex]
          const pairKey =
            first < second ? `${first}:${second}` : `${second}:${first}`

          if (checkedPairs.has(pairKey)) continue
          checkedPairs.add(pairKey)
          separatePair(items[first], items[second], padding)
        }
      }
    }

    items.forEach((item) => {
      pullTowardAnchor(item, anchorStrength, maxOffset)
    })
  }

  const raycaster = new THREE.Raycaster()
  const plane = new THREE.Plane()
  const worldPosition = new THREE.Vector3()

  items.forEach((item) => {
    const finalPositionOffset = item.index * 3
    const finalHeight = finalPositions[finalPositionOffset + 1] ?? altitude
    const result = screenToWorldAtMapHeight({
      camera,
      viewport,
      screenX: item.x,
      screenY: item.y,
      height: finalHeight,
      raycaster,
      plane,
      target: worldPosition,
    })

    if (!result) {
      output[finalPositionOffset + 0] = finalPositions[finalPositionOffset + 0]
      output[finalPositionOffset + 1] = finalPositions[finalPositionOffset + 1]
      output[finalPositionOffset + 2] = finalPositions[finalPositionOffset + 2]
      return
    }

    output[finalPositionOffset + 0] = result.x
    output[finalPositionOffset + 1] = finalHeight
    output[finalPositionOffset + 2] = result.z
  })
}
