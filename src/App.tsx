import Map from "@/components/map/map"
import ArtworkDialog from "@/components/interface/artwork-dialog"
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
      <LayoutControls />
    </>
  )
}

export default App
