import data from "@/data/bloomberg-art-in-transit-gallery.json"
import manifest from "@/data/artwork-texture-manifest.json"
import { origin } from "@/components/map/constants"
import { useStore } from "@/store"
import {
  LINE_ORDER,
  buildRailRoutes,
  getArtworkStationCode,
  getClosestPointOnRoute,
  getLineNameForStationCode,
} from "@/components/three/rail-routes"
import {
  createArtworkLinePositionArray,
  updateArtworkLineProgress,
} from "@/components/three/artworks/line-progress"
import { useArtworkGpuPicking } from "@/components/three/artworks/gpu-picking"
import {
  artworkZoomScale,
  useArtworkCollisionLayout,
} from "@/components/three/artworks/collision-layout"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useLoader, useThree } from "@react-three/fiber"
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
  float,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1800
const DEFAULT_LINE_STAGGER = 0.2

// TODO: Some shadow? Ambient occlusion?

// TODO: Use d3-force to prevent them from overlapping?

// TODO: Positioning
// 1. Small offsets
// 2. Strict no overlap
// 3. Cluster stacks

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

const Artworks = ({ useCollisionLayout = false }) => {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)

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

  const animatedPositions = useMemo(() => {
    const array = createArtworkLinePositionArray(artworkRoutes)
    return instancedArray(array, "vec3")
  }, [artworkRoutes])
  const animatedPositionsRef = useRef(animatedPositions)

  const renderPositions = useMemo(() => {
    const array = createArtworkLinePositionArray(artworkRoutes)
    return instancedArray(array, "vec3")
  }, [artworkRoutes])
  const renderPositionsRef = useRef(renderPositions)

  const finalPositionArray = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    artworkRoutes.forEach((artworkRoute, index) => {
      array[index * 3 + 0] = artworkRoute.finalPosition.x
      array[index * 3 + 1] = artworkRoute.finalPosition.y
      array[index * 3 + 2] = artworkRoute.finalPosition.z
    })

    return array
  }, [artworkRoutes])

  useEffect(() => {
    animatedPositionsRef.current = animatedPositions
  }, [animatedPositions])

  useEffect(() => {
    renderPositionsRef.current = renderPositions
  }, [renderPositions])

  const {
    progress,
    lineStagger,
    collisionLayoutEnabled,
    collisionPadding,
    collisionIterations,
    collisionAnchorStrength,
    collisionMaxOffset,
  } = useControls({
    artworks: folder({
      progress: {
        value: 1,
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
      collisionLayoutEnabled: useCollisionLayout,
      collisionPadding: {
        value: 12,
        min: 0,
        max: 80,
        step: 1,
      },
      collisionIterations: {
        value: 4,
        min: 1,
        max: 12,
        step: 1,
      },
      collisionAnchorStrength: {
        value: 0.18,
        min: 0,
        max: 0.8,
        step: 0.01,
      },
      collisionMaxOffset: {
        value: 160,
        min: 0,
        max: 500,
        step: 1,
      },
    }),
  })

  useEffect(() => {
    updateArtworkLineProgress({
      positions: animatedPositionsRef.current,
      artworkRoutes,
      progress,
      lineStagger,
    })

    const renderPositionBuffer = renderPositionsRef.current.value

    if (progress < 1) {
      renderPositionBuffer.array.set(animatedPositionsRef.current.value.array)
      renderPositionBuffer.needsUpdate = true
      return
    }

    renderPositionBuffer.array.set(finalPositionArray)
    renderPositionBuffer.needsUpdate = true
  }, [artworkRoutes, finalPositionArray, lineStagger, progress])

  const aspectRatios = useMemo(() => {
    const array = new Float32Array(COUNT)

    manifest.entries.forEach((entry, index) => {
      array[index] = entry.aspectRatio ?? 1
    })

    return array
  }, [])

  useArtworkCollisionLayout({
    enabled: useCollisionLayout && collisionLayoutEnabled,
    progress,
    renderPositionsRef,
    finalPositionArray,
    aspectRatios,
    camera,
    viewport: size,
    baseSize: SIZE,
    altitude: ALTITUDE,
    padding: collisionPadding,
    iterations: collisionIterations,
    anchorStrength: collisionAnchorStrength,
    maxOffset: collisionMaxOffset,
  })

  const scales = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    aspectRatios.forEach((aspectRatio, index) => {
      array[index * 3 + 0] = aspectRatio
      array[index * 3 + 1] = 1
      array[index * 3 + 2] = 1
    })

    return instancedArray(array, "vec3")
  }, [aspectRatios])

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
    const positionNode = positionLocal
      .mul(scales.toAttribute())
      .mul(artworkZoomScale)

    return positionNode
  }, [scales])

  const vertexNode = useMemo(() => {
    return billboarding({
      position: renderPositions.toAttribute(),
      horizontal: false,
      vertical: true,
    })
  }, [renderPositions])

  const colorNode = useMemo(() => {
    const colorNode = texture(artworksTexture, uv().flipY()).depth(
      int(instanceIndex)
    )

    return colorNode
  }, [artworksTexture])

  // TODO: Slight opacity, painted reveal on hover
  // Or just do a screen-space effect

  const opacityNode = useMemo(() => {
    return float(0.9)
  }, [])

  // Interactions / picking
  const handleArtworkHoverChange = useCallback(() => {
    // console.debug("Artwork hover changed", { pickedId, previousPickedId })
  }, [])

  const handleArtworkClick = useCallback(
    (pickedId) => {
      if (pickedId === null) return

      const artwork = data.artworks[pickedId]
      if (!artwork) return

      setSelectedArtwork(artwork)
      setOpenArtworkDialog(true)
    },
    [setOpenArtworkDialog, setSelectedArtwork]
  )

  useArtworkGpuPicking({
    geometry,
    positionNode,
    vertexNode,
    count: COUNT,
    onHoverChange: handleArtworkHoverChange,
    onClick: handleArtworkClick,
  })

  return (
    <>
      <instancedMesh
        args={[geometry, undefined, COUNT]}
        frustumCulled={false}
        receiveShadow
        castShadow
      >
        <meshBasicNodeMaterial
          transparent
          positionNode={positionNode}
          vertexNode={vertexNode}
          colorNode={colorNode}
          opacityNode={opacityNode}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </>
  )
}

export default Artworks
