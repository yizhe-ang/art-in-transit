import data from "@/data/bloomberg-art-in-transit-gallery.json"
import embeddingLayout from "@/data/artwork-embedding-layout.json"
import manifest from "@/data/artwork-texture-manifest.json"
import { useStore } from "@/store"
import {
  createArtworkLinePositionArray,
  updateArtworkLineProgress,
} from "@/components/three/artworks/line-progress"
import {
  createArtworkFinalPositionArray,
  createArtworkEmbeddingLayoutPositionArray,
  createArtworkLineRowLayout,
  createArtworkTimePositionArray,
  createArtworkTimeYearLabels,
  TIME_STACK_BASELINES,
} from "@/components/three/artworks/layouts"
import { useArtworkGpuPicking } from "@/components/three/artworks/gpu-picking"
import { useArtworkZoomScale } from "@/components/three/artworks/zoom-scale"
import {
  DEFAULT_BORDER_INTENSITY,
  DEFAULT_BORDER_OPACITY,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_LINE_STAGGER,
  SIZE,
} from "@/components/three/artworks/constants"
import {
  createArtworkRoutes,
  getArtworkKey,
} from "@/components/three/artworks/artwork-routes"
import { useArtworkCameraFocus } from "@/components/three/artworks/use-artwork-camera-focus"
import { useArtworkMaterialNodes } from "@/components/three/artworks/use-artwork-material-nodes"
import {
  artworkDistortionVelocityUniform,
  embeddingLayoutProgressUniform,
  embeddingRawLayoutProgressUniform,
  lineLayoutProgressUniform,
  timeLayoutProgressUniform,
  useArtworkTransitions,
} from "@/components/three/artworks/use-artwork-transitions"
import LineLayoutGuides from "@/components/three/artworks/line-layout-guides"
import TimeYearLabels from "@/components/three/artworks/time-year-labels"
import { useMap } from "react-three-map/maplibre"
import { useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useLoader, useThree } from "@react-three/fiber"
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js"
import { folder, useControls } from "leva"
import { instancedArray, uniformArray } from "three/tsl"

const COUNT = data.artworks.length

// TODO: Some shadow? Ambient occlusion?

// TODO: Layouts
// 1. Embeddings, grid (see diagram chasing)
// 2. Line by line
// 3. Time
// 4. Look at the metadata and figure out

const Artworks = () => {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const map = useMap()
  const artworkLayout = useStore((state) => state.artworkLayout)
  const isMapInteractionUnlocked = useStore(
    (state) => state.isMapInteractionUnlocked
  )
  const artworkCameraFocusRequest = useStore(
    (state) => state.artworkCameraFocusRequest
  )
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)

  useArtworkZoomScale()

  const artworksTexture = useLoader(
    KTX2Loader,
    "/artworks/artworks-256.ktx2",
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
    return createArtworkRoutes(data.artworks)
  }, [])

  const artworkIndexByKey = useMemo(() => {
    return new Map(
      data.artworks.map((artwork, index) => [getArtworkKey(artwork), index])
    )
  }, [])

  const animatedPositions = useMemo(() => {
    const array = createArtworkLinePositionArray(artworkRoutes)
    return instancedArray(array, "vec3")
  }, [artworkRoutes])
  const animatedPositionsRef = useRef(animatedPositions)
  const materialRef = useRef(null)

  const renderPositions = useMemo(() => {
    const array = createArtworkLinePositionArray(artworkRoutes)
    return instancedArray(array, "vec3")
  }, [artworkRoutes])
  const renderPositionsRef = useRef(renderPositions)

  const lineRowLayout = useMemo(() => {
    return createArtworkLineRowLayout(artworkRoutes, lineBorderColors)
  }, [artworkRoutes, lineBorderColors])

  const lineRowPositions = useMemo(() => {
    return instancedArray(lineRowLayout.positions, "vec3")
  }, [lineRowLayout.positions])

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
    lineStagger,
    timeStackBaseline,
    borderWidth,
    borderIntensity,
    borderOpacity,
    distortionStrength,
    distortionDamping,
  } = useControls({
    artworks: folder({
      lineStagger: {
        value: DEFAULT_LINE_STAGGER,
        min: 0,
        max: 0.2,
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
      distortionStrength: {
        value: 1,
        min: 0,
        max: 2.5,
        step: 0.01,
      },
      distortionDamping: {
        value: 4.5,
        min: 1,
        max: 20,
        step: 0.1,
      },
    }),
  })

  const { handleArtworkHoverChange } = useArtworkTransitions({
    artworkLayout,
    borderIntensity,
    borderOpacity,
    borderWidth,
    distortionDamping,
    distortionStrength,
  })

  const aspectRatios = useMemo(() => {
    const array = new Float32Array(COUNT)

    manifest.entries.forEach((entry, index) => {
      array[index] = entry.aspectRatio ?? 1
    })

    return array
  }, [])

  const timePositionArray = useMemo(() => {
    return createArtworkTimePositionArray(
      artworkRoutes,
      data.artworks,
      timeStackBaseline
    )
  }, [artworkRoutes, timeStackBaseline])

  const timePositions = useMemo(() => {
    return instancedArray(timePositionArray, "vec3")
  }, [timePositionArray])

  const embeddingLayoutPositionArray = useMemo(() => {
    return createArtworkEmbeddingLayoutPositionArray(
      artworkRoutes,
      embeddingLayout,
      aspectRatios
    )
  }, [artworkRoutes, aspectRatios])

  const embeddingLayoutPositions = useMemo(() => {
    return instancedArray(embeddingLayoutPositionArray, "vec4")
  }, [embeddingLayoutPositionArray])

  useArtworkCameraFocus({
    artworkCameraFocusRequest,
    artworkIndexByKey,
    artworkLayout,
    embeddingLayoutPositionArray,
    finalPositionArray,
    lineRowPositions: lineRowLayout.positions,
    map,
    timePositionArray,
  })

  const timeYearLabels = useMemo(() => {
    return createArtworkTimeYearLabels(
      artworkRoutes,
      data.artworks,
      timeStackBaseline
    )
  }, [artworkRoutes, timeStackBaseline])

  useEffect(() => {
    const applyArtworkLineProgress = (progress, velocity = 0) => {
      artworkDistortionVelocityUniform.value = velocity

      updateArtworkLineProgress({
        positions: animatedPositionsRef.current,
        artworkRoutes,
        progress,
        lineStagger,
      })

      const renderPositionBuffer = renderPositionsRef.current.value

      if (progress < 1) {
        renderPositionBuffer.array.set(animatedPositionsRef.current.value.array)
      } else {
        renderPositionBuffer.array.set(finalPositionArray)
      }

      renderPositionBuffer.needsUpdate = true

      invalidate()
      map?.triggerRepaint?.()
    }

    const initialState = useStore.getState()
    applyArtworkLineProgress(
      initialState.artworkLineProgress,
      initialState.artworkLineVelocity
    )

    return useStore.subscribe((state, previousState) => {
      if (
        state.artworkLineProgress === previousState.artworkLineProgress &&
        state.artworkLineVelocity === previousState.artworkLineVelocity
      ) {
        return
      }

      applyArtworkLineProgress(
        state.artworkLineProgress,
        state.artworkLineVelocity
      )
    })
  }, [artworkRoutes, finalPositionArray, invalidate, lineStagger, map])

  const artworkMetadata = useMemo(() => {
    const array = new Float32Array(COUNT * 4)

    aspectRatios.forEach((aspectRatio, index) => {
      const direction = artworkRoutes[index]?.travelDirection

      array[index * 4 + 0] = aspectRatio
      array[index * 4 + 1] = Math.atan2(direction?.z ?? 0, direction?.x ?? 1)
      array[index * 4 + 2] = artworkRoutes[index]?.depthSlot ?? 0
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
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, 16, 16)
    // geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])

  // TODO: Velocity of user's scroll should correspond with the
  // bending of the artworks etc. vroom vroom. Like a train accelerating.
  // Look towards webgl image galleries for inspiration

  // TODO: To remain same size regardless of zoom
  const { colorNode, opacityNode, positionNode, vertexNode } =
    useArtworkMaterialNodes({
      artworkMetadataAttribute,
      artworksTexture,
      embeddingLayoutPositions,
      lineBorderColorUniforms,
      lineRowPositions,
      renderPositions,
      timePositions,
    })

  // TODO: Slight opacity, painted reveal on hover
  // Or just do a screen-space effect

  // Interactions / picking
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
    enabled: isMapInteractionUnlocked,
    onHoverChange: handleArtworkHoverChange,
    onClick: handleArtworkClick,
  })

  return (
    <>
      <LineLayoutGuides
        guides={lineRowLayout.guides}
        embeddingLayoutProgressUniform={embeddingLayoutProgressUniform}
        embeddingRawLayoutProgressUniform={embeddingRawLayoutProgressUniform}
        lineLayoutProgressUniform={lineLayoutProgressUniform}
        timeLayoutProgressUniform={timeLayoutProgressUniform}
      />
      <instancedMesh
        args={[geometry, undefined, COUNT]}
        frustumCulled={false}
        // renderOrder={10}
        receiveShadow
        castShadow
      >
        <meshBasicNodeMaterial
          ref={materialRef}
          transparent
          depthTest
          depthWrite={isMapInteractionUnlocked}
          positionNode={positionNode}
          vertexNode={vertexNode}
          colorNode={colorNode}
          opacityNode={opacityNode}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <TimeYearLabels
        embeddingLayoutProgressUniform={embeddingLayoutProgressUniform}
        embeddingRawLayoutProgressUniform={embeddingRawLayoutProgressUniform}
        labels={timeYearLabels}
        timeLayoutProgressUniform={timeLayoutProgressUniform}
      />
    </>
  )
}

export default Artworks
