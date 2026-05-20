import Map from "@/components/map/map"
import ArtworkDialog from "@/components/interface/artwork-dialog"
import { Leva } from "leva"

export function App() {
  return (
    <>
      <Leva collapsed />

      <div className="fixed inset-0">
        <Map />
      </div>

      <ArtworkDialog />
    </>
  )
}

export default App
