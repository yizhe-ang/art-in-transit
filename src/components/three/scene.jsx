import Artworks from "@/components/three/artworks"
import Lines from "@/components/three/lines"

const Scene = () => {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#60666C"]} position={[1, 4.5, 3]} />

      {/* <mesh>
          <meshPhysicalNodeMaterial />
          <boxGeometry />
        </mesh> */}

      <Lines />

      <Artworks />
    </>
  )
}

export default Scene
