import Artworks from "@/components/three/artworks"
import Lines from "@/components/three/lines"
import FluidSim from "@/components/three/fluid-sim"
import PostProcessing from "@/components/three/post-processing"

const Scene = () => {
  return (
    <>
      <Lines />

      <Artworks />

      {/* <FluidSim>
        {(fluidMaskNode) => <PostProcessing fluidMaskNode={fluidMaskNode} />}
      </FluidSim> */}
    </>
  )
}

export default Scene
