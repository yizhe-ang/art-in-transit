import data from "@/data/bloomberg-art-in-transit-gallery.json"
import {
  useLocalNodes,
  useUniforms,
  useBuffers,
} from "@react-three/fiber/webgpu"
import { instancedArray } from "three/tsl"
import { origin } from "@/components/map/constants"
import { coordsToVector3 } from "react-three-map/maplibre"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 120

const Artworks = () => {
  useBuffers(() => {
    const positionsArray = new Float32Array(COUNT * 3)

    data.artworks.forEach((artwork, index) => {
      const [x, y, z] = coordsToVector3(
        {
          longitude: artwork.longitude,
          latitude: artwork.latitude,
          altitude: ALTITUDE,
        },
        origin
      )

      positionsArray[index * 3 + 0] = x
      positionsArray[index * 3 + 1] = y
      positionsArray[index * 3 + 2] = z
    })

    return {
      positions: instancedArray(positionsArray, "vec3"),
    }
  }, "artworks")

  const { positionNode } = useLocalNodes(({ buffers }) => {
    const { positions } = buffers.artworks

    const positionNode = positions.toAttribute()

    return {
      positionNode,
    }
  })

  return (
    <>
      <instancedMesh args={[undefined, undefined, COUNT]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshPhysicalNodeMaterial positionNode={positionNode} />
      </instancedMesh>
    </>
  )
}

export default Artworks
