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

const LayoutControls = ({
  isMapInteractionUnlocked: isMapInteractionUnlockedProp,
  layoutDependency,
  layoutTransition,
} = {}) => {
  const artworkLayout = useStore((state) => state.artworkLayout)
  const setArtworkLayout = useStore((state) => state.setArtworkLayout)
  const storedIsMapInteractionUnlocked = useStore(
    (state) => state.isMapInteractionUnlocked
  )
  const shouldReduceMotion = useReducedMotion()
  const isMapInteractionUnlocked =
    isMapInteractionUnlockedProp ?? storedIsMapInteractionUnlocked
  const footerLayoutDependency = layoutDependency ?? isMapInteractionUnlocked
  const footerLayoutTransition =
    layoutTransition ??
    (shouldReduceMotion
      ? { duration: 0.06, ease: "linear" }
      : { type: "spring", bounce: 0.14, visualDuration: 0.32 })

  return (
    <AnimatePresence mode="popLayout">
      {isMapInteractionUnlocked && (
        <motion.div
          layout={shouldReduceMotion ? false : "position"}
          layoutDependency={footerLayoutDependency}
          className="flex max-w-full items-center gap-1 rounded-lg border border-white/55 bg-white/82 p-1 shadow-[0_10px_35px_rgba(0,72,81,0.18)] backdrop-blur-md"
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 12 }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0 }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 8 }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0.06, ease: "linear" }
              : {
                  type: "spring",
                  bounce: 0.16,
                  visualDuration: 0.36,
                  layout: footerLayoutTransition,
                }
          }
          style={{ willChange: "transform, opacity" }}
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
