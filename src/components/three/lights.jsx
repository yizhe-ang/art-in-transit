const lights = () => {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#60666C"]} position={[1, 4.5, 3]} />

      <directionalLight args={["#ffffff", 1]} position={[-1, 4.5, 3]} />
    </>
  )
}

export default lights
