import * as THREE from "three/webgpu"

// TODO: Have a normal map?

const SIZE = 60_000

const Ground = () => {
  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[SIZE, SIZE]} />
      <meshPhysicalNodeMaterial
        // color="red"
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default Ground
