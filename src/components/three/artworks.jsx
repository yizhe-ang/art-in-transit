import data from "@/data/bloomberg-art-in-transit-gallery.json"
import manifest from "@/data/artwork-texture-manifest.json"
import { origin } from "@/components/map/constants"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useLoader, useThree } from "@react-three/fiber"
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js"
import {
  instancedArray,
  instanceIndex,
  int,
  positionLocal,
  texture,
  uv,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 1500

// TODO: Gpu picking

const Artworks = () => {
  // TODO: Refactor this out somewhere?
  const gl = useThree((state) => state.gl)
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

  const positions = useMemo(() => {
    const array = new Float32Array(COUNT * 3)

    data.artworks.forEach((artwork, index) => {
      const [x, y, z] = coordsToVector3(
        {
          longitude: artwork.longitude,
          latitude: artwork.latitude,
          altitude: ALTITUDE,
        },
        origin
      )

      array[index * 3 + 0] = x
      array[index * 3 + 1] = y
      array[index * 3 + 2] = z
    })

    return instancedArray(array, "vec3")
  }, [])

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
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])

  // TODO: Billboard them?
  // TODO: Use sprite?

  // TODO: To remain same size regardless of zoom
  const positionNode = useMemo(() => {
    const positionNode = positionLocal
      .mul(scales.toAttribute())
      .add(positions.toAttribute())

    return positionNode
  }, [positions, scales])

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
          colorNode={colorNode}
        />
      </instancedMesh>
    </>
  )
}

export default Artworks
