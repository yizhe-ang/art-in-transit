import data from "@/data/bloomberg-art-in-transit-gallery.json"
import {
  useLocalNodes,
  useUniforms,
  useBuffers,
} from "@react-three/fiber/webgpu"
import { instancedArray } from "three/tsl"

const COUNT = data.artworks.length

const Artworks = () => {
  useBuffers(() => {
    return {
      positions: instancedArray(COUNT, "vec3"),
    }
  }, "artworks")

  return (
    <>
      <instancedMesh args={[undefined, undefined, COUNT]}>
        <planeGeometry args={[1, 1]} />
        <meshPhysicalNodeMaterial />
      </instancedMesh>
    </>
  )
}

export default Artworks
