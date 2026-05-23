import { Button } from "@/components/ui/button"
import { useStore } from "@/store"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

const LAYOUTS = [
  { id: "map", label: "Map" },
  { id: "line", label: "Line" },
  { id: "time", label: "Time" },
  // { id: "embedding", label: "Grid" },
  { id: "embeddingRaw", label: "Similarity" },
]

const LayoutControls = () => {
  const artworkLayout = useStore((state) => state.artworkLayout)
  const setArtworkLayout = useStore((state) => state.setArtworkLayout)
  const isMapInteractionUnlocked = useStore(
    (state) => state.isMapInteractionUnlocked
  )
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isMapInteractionUnlocked && (
        <motion.div
          className="flex max-w-full items-center gap-1 rounded-lg border border-white/55 bg-white/82 p-1 shadow-[0_10px_35px_rgba(0,72,81,0.18)] backdrop-blur-md"
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, transform: "translateY(12px)" }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, transform: "translateY(0px)" }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, transform: "translateY(8px)" }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0.06, ease: "linear" }
              : { type: "spring", bounce: 0.16, visualDuration: 0.36 }
          }
        >
          {LAYOUTS.map((layout) => {
            const active = artworkLayout === layout.id

            return (
              <Button
                key={layout.id}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                aria-pressed={active}
                onClick={() => {
                  if (active) return
                  setArtworkLayout(layout.id)
                }}
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default LayoutControls
