import data from "@/data/bloomberg-art-in-transit-gallery.json"
import manifest from "@/data/artwork-texture-manifest.json"
import { origin } from "@/components/map/constants"
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
import { coordsToVector3 } from "react-three-map/maplibre"
import { useEffect, useMemo, useRef } from "react"
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
  Fn,
  uint,
  vec3,
} from "three/tsl"

const PICK_ID_BYTE = 256

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1800
const MIN_ZOOM_SCALE = 0.25
const DEFAULT_LINE_STAGGER = 0.2

// TODO: Some shadow? Ambient occlusion?

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

const Artworks = () => {
  // TODO: Refactor this out somewhere?
  const gl = useThree((state) => state.gl)
  const map = useMap()

  const referenceZoomRef = useRef(null)
  const pickedId = useRef()
  const prevPickedId = useRef()

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
    const array = createArtworkLinePositionArray(artworkRoutes)
    return instancedArray(array, "vec3")
  }, [artworkRoutes])
  const positionsRef = useRef(positions)

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

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
        min: 0,
        max: 0.2,
        step: 0.01,
      },
    }),
  })

  useEffect(() => {
    updateArtworkLineProgress({
      positions: positionsRef.current,
      artworkRoutes,
      progress,
      lineStagger,
    })
  }, [artworkRoutes, lineStagger, progress])

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

  // Picking
  const pickingScene = useMemo(() => new THREE.Scene(), [])
  const pickingTexture = useMemo(() => new THREE.RenderTarget(1, 1), [])

  const { pickingMesh } = useMemo(() => {
    const material = new THREE.MeshBasicNodeMaterial({
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
    })

    material.positionNode = positionNode
    material.vertexNode = vertexNode

    // FIXME:
    material.colorNode = Fn(() => {
      const pickId = instanceIndex.add(uint(1))
      const byte = uint(PICK_ID_BYTE)

      return vec3(
        pickId.mod(byte).toFloat().div(255),
        pickId.div(byte).mod(byte).toFloat().div(255),
        pickId.div(uint(65536)).mod(byte).toFloat().div(255)
      )
    })()

    const mesh = new THREE.InstancedMesh(geometry, material, COUNT)
    mesh.frustumCulled = false

    return { pickingMesh: mesh }
  }, [geometry, positionNode, vertexNode])

  useEffect(() => {
    pickingScene.add(pickingMesh)

    return () => {
      pickingScene.remove(pickingMesh)
      pickingMesh.material.dispose()
    }
  }, [pickingMesh, pickingScene])

  useFrame(({ gl, camera, pointer, size }) => {
    const mouseX = ((pointer.x + 1) / 2) * size.width
    const mouseY = ((1 - pointer.y) / 2) * size.height

    const pixelRatio = gl.getPixelRatio()

    camera.setViewOffset(
      gl.domElement.width, // full width
      gl.domElement.height, // full top
      Math.floor(mouseX * pixelRatio), // rect x
      Math.floor(mouseY * pixelRatio), // rect y
      1, // rect width
      1 // rect height
    )

    gl.setRenderTarget(pickingTexture)

    gl.render(pickingScene, camera)

    // Restore active render target to canvas
    gl.setRenderTarget(null)

    // Clear the view offset so rendering returns to normal
    camera.clearViewOffset()

    gl.readRenderTargetPixelsAsync(pickingTexture, 0, 0, 1, 1, 0).then(
      (pixelBuffer) => {
        pickedId.current =
          (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | pixelBuffer[2]
      }
    )

    console.log(pickedId.current)
  })

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
