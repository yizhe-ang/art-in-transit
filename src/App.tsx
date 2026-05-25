import Map from "@/components/map/map"
import Steps from "@/components/steps"
import ScrollyIntro from "@/components/scrolly-intro"
import HeroTitle from "@/components/hero-title"
import HeroScrollIndicator from "@/components/hero-scroll-indicator"
import ArtworkDialog from "@/components/interface/artwork-dialog"
import AboutDialog from "@/components/interface/about-dialog"
import LayoutControls from "@/components/interface/layout-controls"
import InitialLoadingOverlay from "@/components/interface/initial-loading-overlay"
import { Leva } from "leva"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"

export function App() {
  const shouldReduceMotion = useReducedMotion()
  const footerLayoutTransition = shouldReduceMotion
    ? ({ duration: 0.06, ease: "linear" } as const)
    : ({ type: "spring", bounce: 0.14, visualDuration: 0.32 } as const)

  return (
    <>
      <Leva collapsed hidden={import.meta.env.PROD} />

      <div className="fixed inset-0">
        <Map />
      </div>

      <HeroTitle />
      <HeroScrollIndicator />

      <Steps />

      <ScrollyIntro />

      <ArtworkDialog />
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-6">
        <LayoutGroup id="footer-controls">
          <motion.div
            layout={shouldReduceMotion ? false : "position"}
            transition={{ layout: footerLayoutTransition }}
            className="pointer-events-auto flex max-w-full items-center gap-2"
          >
            <motion.div
              layout={shouldReduceMotion ? false : "position"}
              transition={{ layout: footerLayoutTransition }}
              className="shrink-0"
            >
              <AboutDialog />
            </motion.div>
            <LayoutControls />
          </motion.div>
        </LayoutGroup>
      </div>

      <InitialLoadingOverlay />
    </>
  )
}

export default App
