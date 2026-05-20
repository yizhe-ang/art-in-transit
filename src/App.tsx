import Map from "@/components/map/map"
import { Leva } from "leva"

export function App() {
  return (
    <>
      <Leva collapsed />

      <div className="fixed inset-0">
        <Map />
      </div>
    </>
  )
}

export default App
