import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { button, folder, useControls } from "leva"
import { useStore } from "@/store"

gsap.registerPlugin(useGSAP, ScrollTrigger)

// TODO: Lenis?

const ScrollyIntro = () => {
  const map = useStore((state) => state.map)

  useControls({
    "scrolly intro": folder({
      "Log camera keyframe": button(() => {
        const currentMap = useStore.getState().map

        if (!currentMap) {
          console.warn("Scrolly intro camera keyframe: map is not ready yet.")
          return
        }

        const center = currentMap.getCenter()
        const keyframe = {
          longitude: center.lng,
          latitude: center.lat,
          zoom: currentMap.getZoom(),
          pitch: currentMap.getPitch(),
          bearing: currentMap.getBearing(),
        }

        console.log("Scrolly intro camera keyframe:", keyframe)
      }),
    }),
  })

  useGSAP(
    () => {
      if (!map) {
        return
      }

      const setArtworkLineProgress =
        useStore.getState().setArtworkLineProgress
      const scrollState = {
        value: useStore.getState().artworkLineProgress,
        longitude: map.getCenter().lng,
        latitude: map.getCenter().lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }

      setArtworkLineProgress(0)
      scrollState.value = 0

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: "#step-1",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
        onUpdate: () => {
          setArtworkLineProgress(scrollState.value)
          map.jumpTo({
            center: [scrollState.longitude, scrollState.latitude],
            zoom: scrollState.zoom,
            pitch: scrollState.pitch,
            bearing: scrollState.bearing,
          })
          map.triggerRepaint?.()
        },
      })

      timeline.to(scrollState, {
        value: 1,
        longitude: 103.85,
        latitude: 1.31,
        zoom: 12.5,
        pitch: 45,
        bearing: -20,
        ease: "none",
      })

      return () => {
        setArtworkLineProgress(0)
      }
    },
    { dependencies: [map] }
  )

  return <></>
}

export default ScrollyIntro
