const Scene = () => {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#60666C"]} position={[1, 4.5, 3]} />
      <object3D scale={500}>
        {/* <Box position={[-1.2, 1, 0]} />
        <Box position={[1.2, 1, 0]} /> */}

        <mesh>
          <meshPhysicalNodeMaterial />
          <boxGeometry />
        </mesh>
      </object3D>
    </>
  )
}

export default Scene
