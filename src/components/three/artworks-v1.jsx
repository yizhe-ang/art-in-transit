import data from "@/data/bloomberg-art-in-transit-gallery.json"
import manifest from "@/data/artwork-texture-manifest.json"
import { origin } from "@/components/map/constants"
import {
  LINE_ORDER,
  buildRailRoutes,
  getArtworkStationCode,
  getClosestPointOnRoute,
  getLineNameForStationCode,
  getPointAtDistance,
} from "@/components/three/rail-routes"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useLoader, useThree, useFrame } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js"
import { folder, useControls } from "leva"
import {
  instancedArray,
  instanceIndex,
  int,
  texture,
  uv,
  uniform,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1800
const MIN_ZOOM_SCALE = 0.25
const DEFAULT_LINE_STAGGER = 0.08
const artworkZoomScale = uniform(1)

// TODO: Some shadow? Ambient occlusion?

function getArtworkPosition(artwork) {
  return new THREE.Vector3(
    ...coordsToVector3(
      {
        longitude: artwork.longitude,
        latitude: artwork.latitude,
        altitude: ALTITUDE,
      },
      origin
    )
  )
}

function getLineProgress(progress, lineIndex, lineStagger) {
  if (lineIndex < 0) {
    return progress
  }

  const maxStagger = 0.95 / Math.max(1, LINE_ORDER.length - 1)
  const stagger = THREE.MathUtils.clamp(lineStagger, 0, maxStagger)
  const lineStart = lineIndex * stagger
  const lineDuration = 1 - (LINE_ORDER.length - 1) * stagger

  return THREE.MathUtils.clamp((progress - lineStart) / lineDuration, 0, 1)
}

function setPositionAt(array, index, position) {
  array[index * 3 + 0] = position.x
  array[index * 3 + 1] = position.y
  array[index * 3 + 2] = position.z
}

function getPositionAt(array, index, target) {
  return target.set(
    array[index * 3 + 0],
    array[index * 3 + 1],
    array[index * 3 + 2]
  )
}

const Artworks = () => {
  // TODO: Refactor this out somewhere?
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const map = useMap()
  const referenceZoomRef = useRef(null)
  const artworkMeshRef = useRef(null)
  const pickingMeshRef = useRef(null)
  const hoveredArtworkRef = useRef(null)
  const capturedArtworkRef = useRef(null)
  const selectedArtworkRef = useRef(null)
  const artworkTransform = useMemo(() => new THREE.Object3D(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])
  const instanceMatrix = useMemo(() => new THREE.Matrix4(), [])
  const worldMatrix = useMemo(() => new THREE.Matrix4(), [])
  const screenCorners = useMemo(
    () => [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ],
    []
  )
  const localCorners = useMemo(
    () => [
      new THREE.Vector3(-SIZE / 2, 0, -SIZE / 2),
      new THREE.Vector3(SIZE / 2, 0, -SIZE / 2),
      new THREE.Vector3(-SIZE / 2, 0, SIZE / 2),
      new THREE.Vector3(SIZE / 2, 0, SIZE / 2),
    ],
    []
  )

  const artworksTexture = useLoader(
    KTX2Loader,
    "/artworks/artworks.ktx2",
    (loader) => {
      loader.setTranscoderPath("/basis/")
      loader.detectSupport(gl)
    }
  )

  // TODO: Do I actually need this?
  useEffect(() => {
    gl.initTexture?.(artworksTexture)
  }, [gl, artworksTexture])

  const artworkRoutes = useMemo(() => {
    const routes = buildRailRoutes({
      altitude: ALTITUDE,
      lineNames: LINE_ORDER,
    })
    const routesByLine = routes.reduce((groups, route) => {
      const lineRoutes = groups.get(route.name) ?? []
      lineRoutes.push(route)
      groups.set(route.name, lineRoutes)
      return groups
    }, new Map())

    return data.artworks.map((artwork) => {
      const finalPosition = getArtworkPosition(artwork)
      const stationCode = getArtworkStationCode(artwork)
      const lineName = getLineNameForStationCode(stationCode)
      const lineIndex = LINE_ORDER.indexOf(lineName)
      const routeCandidates = routesByLine.get(lineName) ?? []

      let selectedRoute = null
      let selectedClosestPoint = null

      routeCandidates.forEach((route) => {
        const closestPoint = getClosestPointOnRoute(route, finalPosition)

        if (
          selectedClosestPoint === null ||
          closestPoint.distanceSq < selectedClosestPoint.distanceSq
        ) {
          selectedRoute = route
          selectedClosestPoint = closestPoint
        }
      })

      return {
        finalPosition,
        lineIndex,
        route: selectedRoute,
        targetDistance: selectedClosestPoint?.distanceAlong ?? 0,
      }
    })
  }, [])

  const positions = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    artworkRoutes.forEach((artworkRoute, index) => {
      setPositionAt(
        array,
        index,
        artworkRoute.route?.points[0] ?? artworkRoute.finalPosition
      )
    })

    return instancedArray(array, "vec3")
  }, [artworkRoutes])
  const positionsRef = useRef(positions)

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  const updateArtworkPositions = useCallback(
    (progress, lineStagger) => {
      const positionBuffer = positionsRef.current.value
      const array = positionBuffer.array
      const currentPosition = new THREE.Vector3()

      artworkRoutes.forEach((artworkRoute, index) => {
        const lineProgress = getLineProgress(
          progress,
          artworkRoute.lineIndex,
          lineStagger
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
    },
    [artworkRoutes]
  )

  const { progress, lineStagger } = useControls({
    artworks: folder({
      progress: {
        value: 1,
        min: 0,
        max: 1,
        step: 0.01,
      },
      lineStagger: {
        value: DEFAULT_LINE_STAGGER,
        min: 0.2,
        max: 0.2,
        step: 0.01,
      },
    }),
  })

  useEffect(() => {
    updateArtworkPositions(progress, lineStagger)
  }, [lineStagger, progress, updateArtworkPositions])

  const scales = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    manifest.entries.forEach((entry, index) => {
      array[index * 3 + 0] = entry.aspectRatio ?? 1
      array[index * 3 + 1] = 1
      array[index * 3 + 2] = 1
    })

    return instancedArray(array, "vec3")
  }, [])

  const syncArtworkMeshes = useCallback(
    () => {
      const artworkMesh = artworkMeshRef.current
      const pickingMesh = pickingMeshRef.current

      if (!artworkMesh || !pickingMesh) return

      const positionArray = positionsRef.current.value.array
      const scaleArray = scales.value.array

      for (let index = 0; index < COUNT; index += 1) {
        getPositionAt(positionArray, index, artworkTransform.position)
        artworkTransform.quaternion.identity()
        artworkTransform.scale.set(
          scaleArray[index * 3 + 0] * artworkZoomScale.value,
          scaleArray[index * 3 + 1] * artworkZoomScale.value,
          1
        )
        artworkTransform.updateMatrix()
        artworkMesh.setMatrixAt(index, artworkTransform.matrix)
        pickingMesh.setMatrixAt(index, artworkTransform.matrix)
      }

      artworkMesh.instanceMatrix.needsUpdate = true
      pickingMesh.instanceMatrix.needsUpdate = true
      artworkMesh.boundingSphere = null
      pickingMesh.boundingSphere = null
    },
    [artworkTransform, scales]
  )

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

    syncArtworkMeshes()
  })

  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])

  // TODO: Velocity of user's scroll should correspond with the
  // bending of the artworks etc. vroom vroom. Like a train accelerating.
  // Look towards webgl image galleries for inspiration

  // TODO: Slight opacity, painted reveal on hover

  const colorNode = useMemo(() => {
    const colorNode = texture(artworksTexture, uv().flipY()).depth(
      int(instanceIndex)
    )

    return colorNode
  }, [artworksTexture])

  const handlePointerEnter = useCallback((event) => {
    event.stopPropagation()
    hoveredArtworkRef.current = event.instanceId ?? null
  }, [])

  const handlePointerMove = useCallback((event) => {
    event.stopPropagation()

    if (capturedArtworkRef.current === null) {
      hoveredArtworkRef.current = event.instanceId ?? null
    }
  }, [])

  const handlePointerDown = useCallback(
    (event) => {
      event.stopPropagation()

      if (event.instanceId === undefined || event.instanceId === null) {
        return
      }

      capturedArtworkRef.current = event.instanceId
      event.target.setPointerCapture?.(event.pointerId)
    },
    []
  )

  const releasePointerCapture = useCallback((event) => {
    if (event.target.hasPointerCapture?.(event.pointerId)) {
      event.target.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handlePointerUp = useCallback(
    (event) => {
      event.stopPropagation()
      releasePointerCapture(event)
      capturedArtworkRef.current = null
    },
    [releasePointerCapture]
  )

  const handlePointerLeave = useCallback((event) => {
    event.stopPropagation()

    if (capturedArtworkRef.current === null) {
      hoveredArtworkRef.current = null
    }
  }, [])

  const handleClick = useCallback((event) => {
    event.stopPropagation()
    selectedArtworkRef.current = event.instanceId ?? null

    console.log(event.instanceId)
  }, [])

  const handlePointerCancel = useCallback(
    (event) => {
      event.stopPropagation()
      releasePointerCapture(event)
      hoveredArtworkRef.current = null
      capturedArtworkRef.current = null
    },
    [releasePointerCapture]
  )

  const intersectArtwork = useCallback(
    (event) => {
      const pickingMesh = pickingMeshRef.current

      if (!pickingMesh || !camera.userData.projByViewInv) {
        return null
      }

      const canvas = map?.getCanvas()
      const bounds = canvas?.getBoundingClientRect()

      if (!bounds) return null

      pointer.set(event.clientX - bounds.left, event.clientY - bounds.top)
      pickingMesh.updateMatrixWorld()

      for (let index = COUNT - 1; index >= 0; index -= 1) {
        pickingMesh.getMatrixAt(index, instanceMatrix)
        worldMatrix.multiplyMatrices(pickingMesh.matrixWorld, instanceMatrix)

        for (let cornerIndex = 0; cornerIndex < 4; cornerIndex += 1) {
          const corner = screenCorners[cornerIndex]
          corner
            .copy(localCorners[cornerIndex])
            .applyMatrix4(worldMatrix)
            .project(camera)

          corner.x = (corner.x * 0.5 + 0.5) * bounds.width
          corner.y = (1 - (corner.y * 0.5 + 0.5)) * bounds.height
        }

        const minX = Math.min(...screenCorners.map((corner) => corner.x))
        const maxX = Math.max(...screenCorners.map((corner) => corner.x))
        const minY = Math.min(...screenCorners.map((corner) => corner.y))
        const maxY = Math.max(...screenCorners.map((corner) => corner.y))

        if (
          pointer.x >= minX &&
          pointer.x <= maxX &&
          pointer.y >= minY &&
          pointer.y <= maxY
        ) {
          return {
            instanceId: index,
            object: pickingMesh,
          }
        }
      }

      return null
    },
    [
      camera,
      instanceMatrix,
      localCorners,
      map,
      pointer,
      screenCorners,
      worldMatrix,
    ]
  )

  const createArtworkEvent = useCallback((event, intersection) => {
    return {
      ...intersection,
      instanceId: intersection?.instanceId ?? null,
      pointerId: event.pointerId,
      target: event.target,
      stopPropagation: () => event.stopPropagation(),
    }
  }, [])

  useEffect(() => {
    const canvas = map?.getCanvas()

    if (!canvas) return

    const handleCanvasPointerMove = (event) => {
      const intersection = intersectArtwork(event)
      const artworkEvent = createArtworkEvent(event, intersection)
      const instanceId = intersection?.instanceId ?? null

      if (instanceId !== hoveredArtworkRef.current) {
        if (hoveredArtworkRef.current !== null) {
          handlePointerLeave(artworkEvent)
        }

        if (instanceId !== null) {
          handlePointerEnter(artworkEvent)
        }
      }

      if (instanceId !== null || capturedArtworkRef.current !== null) {
        handlePointerMove(artworkEvent)
      }
    }

    const handleCanvasPointerDown = (event) => {
      const intersection = intersectArtwork(event)

      if (!intersection) return

      handlePointerDown(createArtworkEvent(event, intersection))
    }

    const handleCanvasPointerUp = (event) => {
      const intersection = intersectArtwork(event)

      if (!intersection && capturedArtworkRef.current === null) return

      handlePointerUp(createArtworkEvent(event, intersection))
    }

    const handleCanvasClick = (event) => {
      const intersection = intersectArtwork(event)

      if (!intersection) return

      handleClick(createArtworkEvent(event, intersection))
    }

    const handleCanvasPointerCancel = (event) => {
      handlePointerCancel(createArtworkEvent(event, null))
    }

    canvas.addEventListener("click", handleCanvasClick)
    canvas.addEventListener("pointercancel", handleCanvasPointerCancel)
    canvas.addEventListener("pointerdown", handleCanvasPointerDown)
    canvas.addEventListener("pointerleave", handleCanvasPointerCancel)
    canvas.addEventListener("pointermove", handleCanvasPointerMove)
    canvas.addEventListener("pointerup", handleCanvasPointerUp)

    return () => {
      canvas.removeEventListener("click", handleCanvasClick)
      canvas.removeEventListener("pointercancel", handleCanvasPointerCancel)
      canvas.removeEventListener("pointerdown", handleCanvasPointerDown)
      canvas.removeEventListener("pointerleave", handleCanvasPointerCancel)
      canvas.removeEventListener("pointermove", handleCanvasPointerMove)
      canvas.removeEventListener("pointerup", handleCanvasPointerUp)
    }
  }, [
    createArtworkEvent,
    handleClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    intersectArtwork,
    map,
  ])

  return (
    <>
      <instancedMesh
        ref={pickingMeshRef}
        args={[geometry, undefined, COUNT]}
        frustumCulled={false}
        onClick={handleClick}
        onLostPointerCapture={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerLeave}
        onPointerOver={handlePointerEnter}
        onPointerUp={handlePointerUp}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          opacity={0}
          side={THREE.DoubleSide}
          transparent
        />
      </instancedMesh>

      <instancedMesh
        ref={artworkMeshRef}
        args={[geometry, undefined, COUNT]}
        frustumCulled={false}
      >
        <meshBasicNodeMaterial colorNode={colorNode} />
      </instancedMesh>
    </>
  )
}

export default Artworks
