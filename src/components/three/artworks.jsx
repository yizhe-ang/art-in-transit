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
  billboarding,
  instancedArray,
  instanceIndex,
  int,
  positionLocal,
  texture,
  uv,
  uniform,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1800
const MIN_ZOOM_SCALE = 0.25
const DEFAULT_LINE_STAGGER = 0.08

// TODO: Gpu picking
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

const Artworks = () => {
  // TODO: Refactor this out somewhere?
  const gl = useThree((state) => state.gl)
  const map = useMap()
  const referenceZoomRef = useRef(null)

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
