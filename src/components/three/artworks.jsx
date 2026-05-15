import data from "@/data/bloomberg-art-in-transit-gallery.json"
import { origin } from "@/components/map/constants"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useMemo } from "react"
import * as THREE from "three/webgpu"
import { useKTX2 } from "@react-three/drei"
import {
  instanceIndex,
  instancedArray,
  int,
  positionLocal,
  texture,
  uv,
} from "three/tsl"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 500

const Artworks = () => {
  const artworksTexture = useKTX2("/artworks/artworks.ktx2", "/basis/")

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

  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])

  const nodes = useMemo(() => {
    const positionNode = positionLocal.add(positions.toAttribute())

    return {
      positionNode,
    }
  }, [positions])

  return (
    <>
      <instancedMesh args={[geometry, undefined, COUNT]} frustumCulled={false}>
        <meshPhysicalNodeMaterial {...nodes} />
      </instancedMesh>
    </>
  )
}

export default Artworks
