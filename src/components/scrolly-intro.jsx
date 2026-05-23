import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useStore } from "@/store"

gsap.registerPlugin(useGSAP, ScrollTrigger)

// TODO: Lenis?

const ScrollyIntro = () => {
  useGSAP(
    () => {
      const setArtworkLineProgress =
        useStore.getState().setArtworkLineProgress
      const progressState = {
        value: useStore.getState().artworkLineProgress,
      }

      setArtworkLineProgress(0)
      progressState.value = 0

      gsap.to(progressState, {
        value: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#step-1",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
        onUpdate: () => {
          setArtworkLineProgress(progressState.value)
        },
      })

      return () => {
        setArtworkLineProgress(0)
      }
    },
    { dependencies: [] }
  )

  return <></>
}

export default ScrollyIntro
