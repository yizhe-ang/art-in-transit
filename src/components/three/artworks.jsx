import data from "@/data/bloomberg-art-in-transit-gallery.json"
import { useLocalNodes, useUniforms } from "@react-three/fiber/webgpu"
import { instancedArray, positionLocal } from "three/tsl"
import { origin } from "@/components/map/constants"
import { coordsToVector3 } from "react-three-map/maplibre"
import { useMemo } from "react"

const COUNT = data.artworks.length
const ALTITUDE = 20
const SIZE = 120

const Artworks = () => {
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

  const { positionNode } = useLocalNodes(() => {
    const positionNode = positionLocal.add(positions.toAttribute())

    return {
      positionNode,
    }
  })

  return (
    <>
      <instancedMesh args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshPhysicalNodeMaterial positionNode={positionNode} />
      </instancedMesh>
    </>
  )
}

export default Artworks
