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
import {
  createArtworkFinalPositionArray,
  createArtworkLineRowPositionArray,
  createArtworkTimePositionArray,
  TIME_STACK_BASELINES,
} from "@/components/three/artworks/layouts"
import { useArtworkGpuPicking } from "@/components/three/artworks/gpu-picking"
import {
  artworkZoomScale,
  useArtworkZoomScale,
} from "@/components/three/artworks/zoom-scale"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useLoader, useThree } from "@react-three/fiber"
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js"
import { folder, useControls } from "leva"
import {
  billboarding,
  equal,
  float,
  instancedArray,
  instanceIndex,
  int,
  mix,
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
const HOVER_SCALE = 1.18
const HOVER_TRANSITION_DAMPING = 14
const HOVER_TRANSITION_EPSILON = 0.001
const NO_HOVERED_ARTWORK_ID = -1
const FALLBACK_LINE_INDEX = LINE_ORDER.length
const FALLBACK_LINE_COLOR = "#748477"

const borderWidthUniform = uniform(DEFAULT_BORDER_WIDTH)
const borderIntensityUniform = uniform(DEFAULT_BORDER_INTENSITY)
const borderOpacityUniform = uniform(DEFAULT_BORDER_OPACITY)
const lineLayoutProgressUniform = uniform(0)
const timeLayoutProgressUniform = uniform(0)
const hoveredArtworkIdUniform = uniform(NO_HOVERED_ARTWORK_ID, "int")
const previousHoveredArtworkIdUniform = uniform(NO_HOVERED_ARTWORK_ID, "int")
const hoverTransitionUniform = uniform(1)
const hoveredArtworkStartInfluenceUniform = uniform(0)
const previousHoveredArtworkStartInfluenceUniform = uniform(0)
const transitioningArtworkIdUniform = uniform(NO_HOVERED_ARTWORK_ID, "int")

const TRANSITION_DURATION = 0.3
const PROXY_NDC_Z = 0.5

const transitionLayerUniform = uniform(0, "int")

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

function isArtworkTransitionActive(transition) {
  return (
    transition?.phase === "measuring" ||
    transition?.phase === "animating" ||
    transition?.phase === "holding"
  )
}

function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function getVectorFromArray(array, index, target) {
  return target.set(
    array[index * 3],
    array[index * 3 + 1],
    array[index * 3 + 2]
  )
}

function projectClipPointToScreen(point, matrix, viewportSize, target) {
  target.copy(point).applyMatrix4(matrix)

  return {
    x: (target.x * 0.5 + 0.5) * viewportSize.width,
    y: (-target.y * 0.5 + 0.5) * viewportSize.height,
  }
}

function getScreenRectForBillboard({
  camera,
  center,
  height,
  target,
  viewportSize,
  width,
}) {
  const halfWidth = width / 2
  const halfHeight = height / 2

  target.worldMatrix.identity()
  target.worldMatrix.setPosition(center)
  target.modelViewMatrix.multiplyMatrices(
    camera.matrixWorldInverse,
    target.worldMatrix
  )

  const modelViewElements = target.modelViewMatrix.elements
  modelViewElements[4] = 0
  modelViewElements[5] = 1
  modelViewElements[6] = 0
  modelViewElements[8] = 0
  modelViewElements[9] = 0
  modelViewElements[10] = 1

  target.modelViewProjectionMatrix.multiplyMatrices(
    camera.projectionMatrix,
    target.modelViewMatrix
  )

  const points = [
    target.corners[0].set(-halfWidth, halfHeight, 0),
    target.corners[1].set(halfWidth, halfHeight, 0),
    target.corners[2].set(halfWidth, -halfHeight, 0),
    target.corners[3].set(-halfWidth, -halfHeight, 0),
  ]

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  points.forEach((point) => {
    const screenPoint = projectClipPointToScreen(
      point,
      target.modelViewProjectionMatrix,
      viewportSize,
      target.screenPoint
    )

    left = Math.min(left, screenPoint.x)
    top = Math.min(top, screenPoint.y)
    right = Math.max(right, screenPoint.x)
    bottom = Math.max(bottom, screenPoint.y)
  })

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom)
  ) {
    return null
  }

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3)
}

function lerpRect(fromRect, toRect, progress) {
  return {
    left: THREE.MathUtils.lerp(fromRect.left, toRect.left, progress),
    top: THREE.MathUtils.lerp(fromRect.top, toRect.top, progress),
    width: THREE.MathUtils.lerp(fromRect.width, toRect.width, progress),
    height: THREE.MathUtils.lerp(fromRect.height, toRect.height, progress),
  }
}

function applyScreenRectToMesh({ camera, mesh, rect }) {
  const viewportSize = getViewportSize()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const centerNdc = new THREE.Vector3(
    (centerX / viewportSize.width) * 2 - 1,
    -(centerY / viewportSize.height) * 2 + 1,
    PROXY_NDC_Z
  )
  const rightNdc = new THREE.Vector3(
    ((centerX + rect.width / 2) / viewportSize.width) * 2 - 1,
    -(centerY / viewportSize.height) * 2 + 1,
    PROXY_NDC_Z
  )
  const topNdc = new THREE.Vector3(
    (centerX / viewportSize.width) * 2 - 1,
    -((centerY - rect.height / 2) / viewportSize.height) * 2 + 1,
    PROXY_NDC_Z
  )
  const centerWorld = centerNdc.unproject(camera)
  const rightWorld = rightNdc.unproject(camera)
  const topWorld = topNdc.unproject(camera)

  mesh.position.copy(centerWorld)
  mesh.quaternion.copy(camera.quaternion)
  mesh.scale.set(
    centerWorld.distanceTo(rightWorld) * 2,
    centerWorld.distanceTo(topWorld) * 2,
    1
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

const ArtworkTransitionProxy = ({ artworksTexture }) => {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const transition = useStore((state) => state.artworkImageTransition)
  const updateArtworkImageTransition = useStore(
    (state) => state.updateArtworkImageTransition
  )
  const meshRef = useRef(null)
  const progressRef = useRef(0)
  const [hasReducedMotion, setHasReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const handleChange = () => {
      setHasReducedMotion(mediaQuery.matches)
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  useEffect(() => {
    if (!transition) {
      progressRef.current = 0
      return
    }

    transitionLayerUniform.value = transition.artworkId ?? 0
    invalidate()
  }, [invalidate, transition])

  useEffect(() => {
    if (!transition?.toRect) {
      progressRef.current = 0
    }
  }, [transition?.artworkId, transition?.toRect])

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(1, 1)
  }, [])

  const colorNode = useMemo(() => {
    return texture(artworksTexture, uv().flipY()).depth(transitionLayerUniform)
  }, [artworksTexture])

  useFrame((_, delta) => {
    if (!transition?.fromRect || !meshRef.current) {
      return
    }

    if (hasReducedMotion) {
      if (transition.phase !== "done") {
        updateArtworkImageTransition({ phase: "done" })
      }
      return
    }

    if (!transition.toRect) {
      applyScreenRectToMesh({
        camera,
        mesh: meshRef.current,
        rect: transition.fromRect,
      })
      invalidate()
      return
    }

    if (transition.phase === "measuring") {
      progressRef.current = 0
      updateArtworkImageTransition({ phase: "animating" })
    }

    if (transition.phase === "animating" || transition.phase === "measuring") {
      progressRef.current = Math.min(
        1,
        progressRef.current + delta / TRANSITION_DURATION
      )

      const easedProgress = easeOutCubic(progressRef.current)
      const rect = lerpRect(
        transition.fromRect,
        transition.toRect,
        easedProgress
      )

      applyScreenRectToMesh({
        camera,
        mesh: meshRef.current,
        rect,
      })

      if (progressRef.current >= 1) {
        updateArtworkImageTransition({
          phase: transition.imageLoaded ? "done" : "holding",
        })
      }

      invalidate()
      return
    }

    if (transition.phase === "holding") {
      applyScreenRectToMesh({
        camera,
        mesh: meshRef.current,
        rect: transition.toRect,
      })

      if (transition.imageLoaded) {
        updateArtworkImageTransition({ phase: "done" })
      } else {
        invalidate()
      }
    }
  })

  if (
    !transition?.fromRect ||
    transition.phase === "done" ||
    hasReducedMotion
  ) {
    return null
  }

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false} renderOrder={10}>
      <meshBasicNodeMaterial
        transparent
        depthTest={false}
        depthWrite={false}
        colorNode={colorNode}
        opacityNode={float(0.96)}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

const Artworks = () => {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const openArtworkDialogWithTransition = useStore(
    (state) => state.openArtworkDialogWithTransition
  )
  const artworkImageTransition = useStore(
    (state) => state.artworkImageTransition
  )
  const hoverAnimationActiveRef = useRef(false)
  const sourceRectTargetRef = useRef({
    corners: [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ],
    modelViewMatrix: new THREE.Matrix4(),
    modelViewProjectionMatrix: new THREE.Matrix4(),
    screenPoint: new THREE.Vector3(),
    worldMatrix: new THREE.Matrix4(),
  })
  const currentPositionRef = useRef({
    render: new THREE.Vector3(),
    lineRow: new THREE.Vector3(),
    time: new THREE.Vector3(),
    current: new THREE.Vector3(),
  })

  useArtworkZoomScale()

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

  useEffect(() => {
    return () => {
      hoveredArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
      previousHoveredArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
      transitioningArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
      hoverTransitionUniform.value = 1
      hoveredArtworkStartInfluenceUniform.value = 0
      previousHoveredArtworkStartInfluenceUniform.value = 0
      hoverAnimationActiveRef.current = false
    }
  }, [])

  useFrame((_, delta) => {
    if (!hoverAnimationActiveRef.current) return

    hoverTransitionUniform.value = THREE.MathUtils.damp(
      hoverTransitionUniform.value,
      1,
      HOVER_TRANSITION_DAMPING,
      delta
    )

    if (1 - hoverTransitionUniform.value > HOVER_TRANSITION_EPSILON) {
      return
    }

    hoverTransitionUniform.value = 1
    previousHoveredArtworkIdUniform.value = NO_HOVERED_ARTWORK_ID
    previousHoveredArtworkStartInfluenceUniform.value = 0
    hoveredArtworkStartInfluenceUniform.value =
      hoveredArtworkIdUniform.value === NO_HOVERED_ARTWORK_ID ? 0 : 1
    hoverAnimationActiveRef.current = false
  })

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
        stationCode,
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

  const lineRowPositions = useMemo(() => {
    const array = createArtworkLineRowPositionArray(artworkRoutes)
    return instancedArray(array, "vec3")
  }, [artworkRoutes])

  const finalPositionArray = useMemo(() => {
    return createArtworkFinalPositionArray(artworkRoutes)
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
    lineLayoutProgress,
    timeLayoutProgress,
    timeStackBaseline,
    borderWidth,
    borderIntensity,
    borderOpacity,
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
        lineLayoutProgress: {
          value: 0,
          min: 0,
          max: 1,
          step: 0.01,
        },
        timeLayoutProgress: {
          value: 0,
          min: 0,
          max: 1,
          step: 0.01,
        },
        timeStackBaseline: {
          value: TIME_STACK_BASELINES.ZERO_DOWN,
          options: {
            Centered: TIME_STACK_BASELINES.CENTERED,
            "Zero, stack down": TIME_STACK_BASELINES.ZERO_DOWN,
          },
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

  const timePositions = useMemo(() => {
    const array = createArtworkTimePositionArray(
      artworkRoutes,
      data.artworks,
      timeStackBaseline
    )
    return instancedArray(array, "vec3")
  }, [artworkRoutes, timeStackBaseline])

  useEffect(() => {
    borderWidthUniform.value = borderWidth
    borderIntensityUniform.value = borderIntensity
    borderOpacityUniform.value = borderOpacity
  }, [borderIntensity, borderOpacity, borderWidth])

  useEffect(() => {
    lineLayoutProgressUniform.value = lineLayoutProgress
  }, [lineLayoutProgress])

  useEffect(() => {
    timeLayoutProgressUniform.value = timeLayoutProgress
  }, [timeLayoutProgress])

  useEffect(() => {
    transitioningArtworkIdUniform.value = isArtworkTransitionActive(
      artworkImageTransition
    )
      ? artworkImageTransition.artworkId
      : NO_HOVERED_ARTWORK_ID
  }, [artworkImageTransition])

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

  const artworkMetadata = useMemo(() => {
    const array = new Float32Array(COUNT * 4)

    aspectRatios.forEach((aspectRatio, index) => {
      array[index * 4 + 0] = aspectRatio
      array[index * 4 + 1] = 1
      array[index * 4 + 2] = 1
    })

    artworkRoutes.forEach((artworkRoute, index) => {
      array[index * 4 + 3] = artworkRoute.lineIndex
    })

    return instancedArray(array, "vec4")
  }, [artworkRoutes, aspectRatios])

  const artworkMetadataAttribute = useMemo(() => {
    return artworkMetadata.toAttribute()
  }, [artworkMetadata])

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
    const zoomScale = mix(
      mix(artworkZoomScale, float(1), lineLayoutProgressUniform),
      float(1),
      timeLayoutProgressUniform
    )
    const artworkIndex = int(instanceIndex)
    const hoveredInfluence = select(
      equal(artworkIndex, hoveredArtworkIdUniform),
      mix(
        hoveredArtworkStartInfluenceUniform,
        float(1),
        hoverTransitionUniform
      ),
      float(0)
    )
    const previousHoveredInfluence = select(
      equal(artworkIndex, previousHoveredArtworkIdUniform),
      mix(
        previousHoveredArtworkStartInfluenceUniform,
        float(0),
        hoverTransitionUniform
      ),
      float(0)
    )
    const hoverScale = mix(
      float(1),
      float(HOVER_SCALE),
      hoveredInfluence.add(previousHoveredInfluence)
    )
    const positionNode = positionLocal
      .mul(artworkMetadataAttribute.xyz)
      .mul(zoomScale)
      .mul(hoverScale)

    return positionNode
  }, [artworkMetadataAttribute])

  const vertexNode = useMemo(() => {
    const rowLayoutPosition = mix(
      renderPositions.toAttribute(),
      lineRowPositions.toAttribute(),
      lineLayoutProgressUniform
    )

    return billboarding({
      position: mix(
        rowLayoutPosition,
        timePositions.toAttribute(),
        timeLayoutProgressUniform
      ),
      horizontal: false,
      vertical: true,
    })
  }, [lineRowPositions, renderPositions, timePositions])

  const colorNode = useMemo(() => {
    const uvNode = uv()
    const artworkColor = texture(artworksTexture, uvNode.flipY()).depth(
      int(instanceIndex)
    )
    const lineBorderColor = lineBorderColorUniforms.element(
      artworkMetadataAttribute.w.toInt()
    )
    const aspectRatio = artworkMetadataAttribute.x
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
  }, [artworksTexture, artworkMetadataAttribute, lineBorderColorUniforms])

  // TODO: Slight opacity, painted reveal on hover
  // Or just do a screen-space effect

  const opacityNode = useMemo(() => {
    return select(
      equal(int(instanceIndex), transitioningArtworkIdUniform),
      float(0),
      float(0.9)
    )
  }, [])

  // Interactions / picking
  const getArtworkSourceRect = useCallback(
    (artworkId) => {
      const renderPositionArray = renderPositionsRef.current.value.array
      const lineRowPositionArray = lineRowPositions.value.array
      const timePositionArray = timePositions.value.array
      const positionTarget = currentPositionRef.current
      const renderPosition = getVectorFromArray(
        renderPositionArray,
        artworkId,
        positionTarget.render
      )
      const lineRowPosition = getVectorFromArray(
        lineRowPositionArray,
        artworkId,
        positionTarget.lineRow
      )
      const timePosition = getVectorFromArray(
        timePositionArray,
        artworkId,
        positionTarget.time
      )
      const currentPosition = positionTarget.current
        .copy(renderPosition)
        .lerp(lineRowPosition, lineLayoutProgress)
        .lerp(timePosition, timeLayoutProgress)
      const zoomScale = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(artworkZoomScale.value, 1, lineLayoutProgress),
        1,
        timeLayoutProgress
      )
      const hoverScale = THREE.MathUtils.lerp(
        1,
        HOVER_SCALE,
        getArtworkHoverInfluence(artworkId)
      )
      const scale = zoomScale * hoverScale
      const aspectRatio = aspectRatios[artworkId] ?? 1

      return getScreenRectForBillboard({
        camera,
        center: currentPosition,
        height: SIZE * scale,
        target: sourceRectTargetRef.current,
        viewportSize: getViewportSize(),
        width: SIZE * aspectRatio * scale,
      })
    },
    [
      aspectRatios,
      camera,
      getArtworkHoverInfluence,
      lineLayoutProgress,
      lineRowPositions,
      timeLayoutProgress,
      timePositions,
    ]
  )

  const handleArtworkHoverChange = useCallback(
    (pickedId, previousPickedId) => {
      const previousTransitionArtworkId =
        previousHoveredArtworkIdUniform.value
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
    },
    [getArtworkHoverInfluence]
  )

  const handleArtworkClick = useCallback(
    (pickedId) => {
      if (pickedId === null) return

      const artwork = data.artworks[pickedId]
      if (!artwork) return

      const fromRect = getArtworkSourceRect(pickedId)

      openArtworkDialogWithTransition({
        artwork,
        artworkImageTransition: fromRect
          ? {
              artworkId: pickedId,
              artwork,
              fromRect,
              toRect: null,
              imageLoaded: false,
              phase: "measuring",
            }
          : null,
      })
    },
    [getArtworkSourceRect, openArtworkDialogWithTransition]
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

      <ArtworkTransitionProxy artworksTexture={artworksTexture} />
    </>
  )
}

export default Artworks
