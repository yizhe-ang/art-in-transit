import { useGSAP } from "@gsap/react"
import gsap from "gsap"

gsap.registerPlugin(useGSAP)

// TODO: Lenis?

const ScrollyIntro = () => {
  useGSAP(
    () => {
      gsap.timeline({
        scrollTrigger: {
          trigger: "#step-1",
          start: "top top",
          end: "bottom bottom",
        },
      })
    },
    { dependencies: [] }
  )

  return <></>
}

export default ScrollyIntro
