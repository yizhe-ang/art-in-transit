import Artworks from "@/components/three/artworks"
import Lines from "@/components/three/lines"
import Ground from "@/components/three/ground"
import Lights from "@/components/three/lights"
import PostProcessing from "@/components/three/post-processing"

const Scene = () => {
  return (
    <>
      {/* <Lights /> */}

      {/* <Ground /> */}

      <Lines />

      <Artworks />

      <PostProcessing />
    </>
  )
}

export default Scene
