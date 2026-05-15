import Artworks from "@/components/three/artworks"

const Scene = () => {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#60666C"]} position={[1, 4.5, 3]} />

      {/* <mesh>
          <meshPhysicalNodeMaterial />
          <boxGeometry />
        </mesh> */}

      <Artworks />
    </>
  )
}

export default Scene
