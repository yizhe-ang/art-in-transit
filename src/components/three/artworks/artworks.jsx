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
  useArtworkZoomScale,
} from "@/components/three/artworks/zoom-scale"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useLoader, useThree } from "@react-three/fiber"
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js"
import { folder, useControls } from "leva"
import {
  billboarding,
  float,
  instancedArray,
  instanceIndex,
  int,
  or,
  positionLocal,
  select,
  texture,
  uniform,
  uniformArray,
  uv,
  vec4,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1800
const DEFAULT_LINE_STAGGER = 0.2
const CLUSTER_OFFSET = SIZE * 0.18
const COORDINATE_KEY_PRECISION = 6
const DEFAULT_BORDER_WIDTH = 0.035
const DEFAULT_BORDER_INTENSITY = 1
const DEFAULT_BORDER_OPACITY = 0.75
const FALLBACK_LINE_INDEX = LINE_ORDER.length
const FALLBACK_LINE_COLOR = "#748477"

const borderWidthUniform = uniform(DEFAULT_BORDER_WIDTH)
const borderIntensityUniform = uniform(DEFAULT_BORDER_INTENSITY)
const borderOpacityUniform = uniform(DEFAULT_BORDER_OPACITY)

// TODO: Some shadow? Ambient occlusion?

// TODO: Layouts
// 1. Embeddings, grid (see diagram chasing)
// 2. Line by line
// 3. Time
// 4. Look at the metadata and figure out

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

function getArtworkClusterKey(artwork) {
  const stationCode = getArtworkStationCode(artwork)

  if (stationCode) {
    return `station:${stationCode}`
  }

  return `coord:${Number(artwork.longitude).toFixed(
    COORDINATE_KEY_PRECISION
  )},${Number(artwork.latitude).toFixed(COORDINATE_KEY_PRECISION)}`
}

function getRouteDirectionAtDistance(route, distance, target) {
  if (!route?.points?.length) {
    return target.set(1, 0, 0)
  }

  for (let index = 1; index < route.points.length; index += 1) {
    const endDistance = route.cumulativeLengths[index]

    if (distance <= endDistance) {
      target.subVectors(route.points[index], route.points[index - 1])
      target.y = 0

      if (target.lengthSq() > 0) {
        return target.normalize()
      }
    }
  }

  target.subVectors(
    route.points[route.points.length - 1],
    route.points[Math.max(0, route.points.length - 2)]
  )
  target.y = 0

  return target.lengthSq() > 0 ? target.normalize() : target.set(1, 0, 0)
}

function getClusterOffset({ index, count, direction, target }) {
  if (count <= 1) {
    return target.set(0, 0, 0)
  }

  const along = direction
  const across = new THREE.Vector3(-along.z, 0, along.x)

  if (across.lengthSq() === 0) {
    across.set(1, 0, 0)
  } else {
    across.normalize()
  }

  target.set(0, 0, 0)

  if (count === 2) {
    return target.addScaledVector(
      across,
      (index === 0 ? -1 : 1) * CLUSTER_OFFSET
    )
  }

  if (count === 3) {
    const offsets = [
      [-0.9, -0.25],
      [0.9, -0.25],
      [0, 0.65],
    ]
    const [acrossScale, alongScale] = offsets[index]

    return target
      .addScaledVector(across, acrossScale * CLUSTER_OFFSET)
      .addScaledVector(along, alongScale * CLUSTER_OFFSET)
  }

  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
  const radius = CLUSTER_OFFSET * 1.1

  return target
    .addScaledVector(across, Math.cos(angle) * radius)
    .addScaledVector(along, Math.sin(angle) * radius)
}

const Artworks = () => {
  const gl = useThree((state) => state.gl)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)

  useArtworkZoomScale()

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

  const { artworkRoutes, lineBorderColors } = useMemo(() => {
    const routes = buildRailRoutes({
      altitude: ALTITUDE,
      lineNames: LINE_ORDER,
    })
    const lineColorByName = new Map()
    const routesByLine = routes.reduce((groups, route) => {
      const lineRoutes = groups.get(route.name) ?? []
      lineRoutes.push(route)
      groups.set(route.name, lineRoutes)

      if (!lineColorByName.has(route.name)) {
        lineColorByName.set(route.name, route.color)
      }

      return groups
    }, new Map())
    const lineBorderColors = LINE_ORDER.map((lineName) => {
      return new THREE.Color(lineColorByName.get(lineName) ?? FALLBACK_LINE_COLOR)
    })

    lineBorderColors.push(new THREE.Color(FALLBACK_LINE_COLOR))

    const artworkRouteItems = data.artworks.map((artwork) => {
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
        clusterKey: getArtworkClusterKey(artwork),
        finalPosition,
        lineIndex: lineIndex === -1 ? FALLBACK_LINE_INDEX : lineIndex,
        route: selectedRoute,
        targetDistance: selectedClosestPoint?.distanceAlong ?? 0,
      }
    })

    const clusterGroups = artworkRouteItems.reduce((groups, artworkRoute) => {
      const group = groups.get(artworkRoute.clusterKey) ?? []
      group.push(artworkRoute)
      groups.set(artworkRoute.clusterKey, group)
      return groups
    }, new Map())
    const direction = new THREE.Vector3()
    const offset = new THREE.Vector3()

    clusterGroups.forEach((group) => {
      if (group.length <= 1) return

      group.forEach((artworkRoute, index) => {
        getRouteDirectionAtDistance(
          artworkRoute.route,
          artworkRoute.targetDistance,
          direction
        )
        getClusterOffset({
          index,
          count: group.length,
          direction,
          target: offset,
        })
        artworkRoute.finalPosition = artworkRoute.finalPosition
          .clone()
          .add(offset)
      })
    })

    return { artworkRoutes: artworkRouteItems, lineBorderColors }
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

  const { progress, lineStagger, borderWidth, borderIntensity, borderOpacity } =
    useControls({
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
        borderWidth: {
          value: DEFAULT_BORDER_WIDTH,
          min: 0,
          max: 0.12,
          step: 0.001,
        },
        borderIntensity: {
          value: DEFAULT_BORDER_INTENSITY,
          min: 0,
          max: 2,
          step: 0.01,
        },
        borderOpacity: {
          value: DEFAULT_BORDER_OPACITY,
          min: 0,
          max: 1,
          step: 0.01,
        },
      }),
    })

  useEffect(() => {
    borderWidthUniform.value = borderWidth
    borderIntensityUniform.value = borderIntensity
    borderOpacityUniform.value = borderOpacity
  }, [borderIntensity, borderOpacity, borderWidth])

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

  const scales = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    aspectRatios.forEach((aspectRatio, index) => {
      array[index * 3 + 0] = aspectRatio
      array[index * 3 + 1] = 1
      array[index * 3 + 2] = 1
    })

    return instancedArray(array, "vec3")
  }, [aspectRatios])

  const aspectRatioAttributes = useMemo(() => {
    return instancedArray(aspectRatios, "float")
  }, [aspectRatios])

  const lineIds = useMemo(() => {
    const array = new Int32Array(COUNT)

    artworkRoutes.forEach((artworkRoute, index) => {
      array[index] = artworkRoute.lineIndex
    })

    return instancedArray(array, "int")
  }, [artworkRoutes])

  const lineBorderColorUniforms = useMemo(() => {
    return uniformArray(lineBorderColors, "color")
  }, [lineBorderColors])

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
    const uvNode = uv()
    const artworkColor = texture(artworksTexture, uvNode.flipY()).depth(
      int(instanceIndex)
    )
    const lineBorderColor = lineBorderColorUniforms.element(
      lineIds.toAttribute().toInt()
    )
    const aspectRatio = aspectRatioAttributes.toAttribute()
    const horizontalBorderWidth = borderWidthUniform.div(aspectRatio)
    const intensifiedBorderColor = lineBorderColor.mul(borderIntensityUniform)
    const edgeMask = or(
      or(
        uvNode.x.lessThan(horizontalBorderWidth),
        uvNode.x.greaterThan(float(1).sub(horizontalBorderWidth))
      ),
      or(
        uvNode.y.lessThan(borderWidthUniform),
        uvNode.y.greaterThan(float(1).sub(borderWidthUniform))
      )
    )

    return select(
      edgeMask,
      vec4(intensifiedBorderColor, artworkColor.a.mul(borderOpacityUniform)),
      artworkColor
    )
  }, [artworksTexture, aspectRatioAttributes, lineBorderColorUniforms, lineIds])

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
