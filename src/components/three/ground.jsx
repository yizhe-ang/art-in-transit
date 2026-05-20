import * as THREE from "three/webgpu"

const SIZE = 60_000

const Ground = () => {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -100, 0]}>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicNodeMaterial
        // color="red"
        side={THREE.DoubleSide}
        transparent
        opacity={0.5}
      />
    </mesh>
  )
}

export default Ground
