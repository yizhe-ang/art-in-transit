import { Button } from "@/components/ui/button"
import { useStore } from "@/store"

const LAYOUTS = [
  { id: "map", label: "Map" },
  { id: "line", label: "Line" },
  { id: "time", label: "Time" },
]

const LayoutControls = () => {
  const artworkLayout = useStore((state) => state.artworkLayout)
  const setArtworkLayout = useStore((state) => state.setArtworkLayout)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-lg border border-white/55 bg-white/82 p-1 shadow-[0_10px_35px_rgba(0,72,81,0.18)] backdrop-blur-md">
        {LAYOUTS.map((layout) => {
          const active = artworkLayout === layout.id

          return (
            <Button
              key={layout.id}
              type="button"
              size="sm"
              variant={active ? "default" : "ghost"}
              aria-pressed={active}
              onClick={() => setArtworkLayout(layout.id)}
              className={
                active
                  ? "bg-lta-dark-green text-white hover:bg-lta-dark-green/90"
                  : "text-lta-dark-green hover:bg-lta-light-green/24"
              }
            >
              {layout.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export default LayoutControls
