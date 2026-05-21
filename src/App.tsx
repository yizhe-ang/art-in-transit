import Map from "@/components/map/map"
import ArtworkDialog from "@/components/interface/artwork-dialog"
import AboutDialog from "@/components/interface/about-dialog"
import LayoutControls from "@/components/interface/layout-controls"
import { Leva } from "leva"

export function App() {
  return (
    <>
      <Leva collapsed />

      <div className="fixed inset-0">
        <Map />
      </div>

      <ArtworkDialog />
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-6">
        <div className="pointer-events-auto flex max-w-full items-center gap-2">
          <AboutDialog />
          <LayoutControls />
        </div>
      </div>
    </>
  )
}

export default App
