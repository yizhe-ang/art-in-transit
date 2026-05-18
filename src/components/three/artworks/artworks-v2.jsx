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
import { useFrame, useLoader, useThree } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js"
import { folder, useControls } from "leva"
import {
  billboarding,
  instancedArray,
  instanceIndex,
  int,
  positionLocal,
  texture,
  uint,
  uv,
  vec3,
  uniform,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1800
const MIN_ZOOM_SCALE = 0.25
const DEFAULT_LINE_STAGGER = 0.08
const PICK_ID_BYTE = 256

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

function decodePickId(pixel) {
  const pickId = pixel[0] + pixel[1] * PICK_ID_BYTE + pixel[2] * 65536
  return pickId === 0 ? null : pickId - 1
}

function clearCameraViewOffset(camera) {
  camera.clearViewOffset?.()
  camera.updateProjectionMatrix?.()
}

const Artworks = () => {
  // TODO: Refactor this out somewhere?
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const map = useMap()
  const referenceZoomRef = useRef(null)
  const hoveredArtworkRef = useRef(null)
  const capturedArtworkRef = useRef(null)
  const selectedArtworkRef = useRef(null)
  const pickRequestIdRef = useRef(0)
  const pickPixelRef = useRef(new Uint8Array(4))

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
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
      },
      lineStagger: {
        value: DEFAULT_LINE_STAGGER,
        min: 0,
        max: 0.2,
        step: 0.01,
      },
    }),
  })

  useEffect(() => {
    updateArtworkPositions(progress, lineStagger)
  }, [lineStagger, progress, updateArtworkPositions])

  const zoomScale = useMemo(() => uniform(1), [])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    if (!map) return

    const zoom = map.getZoom()

    if (referenceZoomRef.current === null) {
      referenceZoomRef.current = zoom
    }

    zoomScale.value = THREE.MathUtils.clamp(
      Math.pow(2, referenceZoomRef.current - zoom),
      MIN_ZOOM_SCALE,
      1
    )
  })
  /* eslint-enable react-hooks/immutability */

  const scales = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    manifest.entries.forEach((entry, index) => {
      array[index * 3 + 0] = entry.aspectRatio ?? 1
      array[index * 3 + 1] = 1
      array[index * 3 + 2] = 1
    })

    return instancedArray(array, "vec3")
  }, [])

  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE)
    // geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])

  // TODO: Velocity of user's scroll should correspond with the
  // bending of the artworks etc. vroom vroom. Like a train accelerating.
  // Look towards webgl image galleries for inspiration

  // TODO: To remain same size regardless of zoom
  const positionNode = useMemo(() => {
    const positionNode = positionLocal.mul(scales.toAttribute()).mul(zoomScale)

    return positionNode
  }, [scales, zoomScale])

  const vertexNode = useMemo(() => {
    return billboarding({
      position: positions.toAttribute(),
      horizontal: false,
      vertical: true,
    })
  }, [positions])

  // TODO: Slight opacity, painted reveal on hover

  const colorNode = useMemo(() => {
    const colorNode = texture(artworksTexture, uv().flipY()).depth(
      int(instanceIndex)
    )

    return colorNode
  }, [artworksTexture])

  const pickingScene = useMemo(() => new THREE.Scene(), [])

  const pickingColorNode = useMemo(() => {
    const pickId = instanceIndex.add(uint(1))
    const byte = uint(PICK_ID_BYTE)

    return vec3(
      pickId.mod(byte).toFloat().div(255),
      pickId.div(byte).mod(byte).toFloat().div(255),
      pickId.div(uint(65536)).mod(byte).toFloat().div(255)
    )
  }, [])

  const pickingMaterial = useMemo(() => {
    const material = new THREE.MeshBasicNodeMaterial({
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
    })

    material.positionNode = positionNode
    material.vertexNode = vertexNode
    material.colorNode = pickingColorNode

    return material
  }, [pickingColorNode, positionNode, vertexNode])

  const pickingMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(geometry, pickingMaterial, COUNT)
    mesh.frustumCulled = false
    return mesh
  }, [geometry, pickingMaterial])

  useEffect(() => {
    pickingScene.add(pickingMesh)

    return () => {
      pickingScene.remove(pickingMesh)
      pickingMaterial.dispose()
    }
  }, [pickingMaterial, pickingMesh, pickingScene])

  const pickRenderTargetRef = useRef(null)

  if (pickRenderTargetRef.current === null) {
    const renderTarget = new THREE.RenderTarget(1, 1, {
      colorSpace: THREE.NoColorSpace,
      depthBuffer: true,
      format: THREE.RGBAFormat,
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      samples: 0,
      type: THREE.UnsignedByteType,
    })

    renderTarget.scissorTest = true
    pickRenderTargetRef.current = renderTarget
  }

  useEffect(() => {
    return () => {
      pickRenderTargetRef.current?.dispose()
    }
  }, [])

  const pickArtwork = useCallback(
    async (event) => {
      const canvas = map?.getCanvas()
      const bounds = canvas?.getBoundingClientRect()

      if (!canvas || !bounds || bounds.width === 0 || bounds.height === 0) {
        return null
      }

      const requestId = (pickRequestIdRef.current += 1)
      const pixelRatioX = canvas.width / bounds.width
      const pixelRatioY = canvas.height / bounds.height
      const x = Math.floor((event.clientX - bounds.left) * pixelRatioX)
      const y = Math.floor((bounds.bottom - event.clientY) * pixelRatioY)

      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        return {
          instanceId: null,
          stale: requestId !== pickRequestIdRef.current,
        }
      }

      const currentRenderTarget = gl.getRenderTarget()
      const currentViewport = new THREE.Vector4()
      const currentScissor = new THREE.Vector4()
      const currentScissorTest = gl.getScissorTest()
      const currentClearColor = gl.getClearColor(new THREE.Color())
      const currentClearAlpha = gl.getClearAlpha()

      gl.getViewport(currentViewport)
      gl.getScissor(currentScissor)

      const pickRenderTarget = pickRenderTargetRef.current

      pickRenderTarget.setSize(1, 1)
      pickRenderTarget.viewport.set(0, 0, 1, 1)
      pickRenderTarget.scissor.set(0, 0, 1, 1)
      pickRenderTarget.scissorTest = true
      camera.setViewOffset?.(canvas.width, canvas.height, x, y, 1, 1)
      camera.updateProjectionMatrix?.()

      try {
        gl.setRenderTarget(pickRenderTarget)
        gl.setClearColor(0x000000, 0)
        gl.clear(true, true, false)
        gl.render(pickingScene, camera)

        const pixel = await gl.readRenderTargetPixelsAsync(
          pickRenderTarget,
          0,
          0,
          1,
          1
        )

        pickPixelRef.current.set(pixel)

        return {
          instanceId: decodePickId(pickPixelRef.current),
          stale: requestId !== pickRequestIdRef.current,
        }
      } finally {
        clearCameraViewOffset(camera)
        gl.setRenderTarget(currentRenderTarget)
        gl.setViewport(currentViewport)
        gl.setScissor(currentScissor)
        gl.setScissorTest(currentScissorTest)
        gl.setClearColor(currentClearColor, currentClearAlpha)
      }
    },
    [camera, gl, map, pickingScene]
  )

  const releasePointerCapture = useCallback((event) => {
    if (event.target.hasPointerCapture?.(event.pointerId)) {
      event.target.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handlePointerMove = useCallback(
    async (event) => {
      const pick = await pickArtwork(event)

      if (!pick || pick.stale) return

      const { instanceId } = pick

      if (capturedArtworkRef.current === null) {
        hoveredArtworkRef.current = instanceId
      }
    },
    [pickArtwork]
  )

  const handlePointerDown = useCallback(
    async (event) => {
      const pick = await pickArtwork(event)

      if (!pick || pick.stale || pick.instanceId === null) return

      capturedArtworkRef.current = pick.instanceId
      hoveredArtworkRef.current = pick.instanceId
      event.target.setPointerCapture?.(event.pointerId)
    },
    [pickArtwork]
  )

  const handlePointerUp = useCallback(
    async (event) => {
      const pick = await pickArtwork(event)

      if (!pick || pick.stale) return

      releasePointerCapture(event)
      capturedArtworkRef.current = null

      if (pick.instanceId !== null) {
        hoveredArtworkRef.current = pick.instanceId
      }
    },
    [pickArtwork, releasePointerCapture]
  )

  const handleClick = useCallback(
    async (event) => {
      const pick = await pickArtwork(event)

      if (!pick || pick.stale || pick.instanceId === null) return

      selectedArtworkRef.current = pick.instanceId
    },
    [pickArtwork]
  )

  const handlePointerCancel = useCallback(
    (event) => {
      pickRequestIdRef.current += 1
      releasePointerCapture(event)
      hoveredArtworkRef.current = null
      capturedArtworkRef.current = null
    },
    [releasePointerCapture]
  )

  useEffect(() => {
    const canvas = map?.getCanvas()

    if (!canvas) return

    canvas.addEventListener("click", handleClick)
    canvas.addEventListener("pointercancel", handlePointerCancel)
    canvas.addEventListener("pointerdown", handlePointerDown)
    canvas.addEventListener("pointerleave", handlePointerCancel)
    canvas.addEventListener("pointermove", handlePointerMove)
    canvas.addEventListener("pointerup", handlePointerUp)

    return () => {
      canvas.removeEventListener("click", handleClick)
      canvas.removeEventListener("pointercancel", handlePointerCancel)
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("pointerleave", handlePointerCancel)
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerup", handlePointerUp)
    }
  }, [
    handleClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    map,
  ])

  return (
    <>
      <instancedMesh args={[geometry, undefined, COUNT]} frustumCulled={false}>
        <meshBasicNodeMaterial
          positionNode={positionNode}
          vertexNode={vertexNode}
          colorNode={colorNode}
        />
      </instancedMesh>
    </>
  )
}

export default Artworks
