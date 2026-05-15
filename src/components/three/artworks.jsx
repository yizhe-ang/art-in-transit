import data from "@/data/bloomberg-art-in-transit-gallery.json"

const COUNT = data.artworks.length

const Artworks = () => {
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
