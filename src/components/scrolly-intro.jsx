import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { button, folder, useControls } from "leva"
import { useStore } from "@/store"
import { drawTUniform } from "@/components/three/lines"

gsap.registerPlugin(useGSAP, ScrollTrigger)

// TODO: Lenis?

const cameraTo = {
  longitude: 103.84338723745145,
  latitude: 1.310764844801426,
  zoom: 14.090032064289693,
  pitch: 60,
  bearing: -34.49132978279283,
}

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

      const setArtworkLineProgress = useStore.getState().setArtworkLineProgress

      const scrollState = {
        value: useStore.getState().artworkLineProgress,
      }
      const cameraState = {
        longitude: map.getCenter().lng,
        latitude: map.getCenter().lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }

      map.jumpTo({
        center: [cameraTo.longitude, cameraTo.latitude],
        zoom: cameraTo.zoom,
        pitch: cameraTo.pitch,
        bearing: cameraTo.bearing,
      })

      setArtworkLineProgress(0)
      // drawTUniform.value = 0
      scrollState.value = 0

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: "#step-1",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
        onUpdate: () => {
          // drawTUniform.value = scrollState.value
          setArtworkLineProgress(scrollState.value)
          map.jumpTo({
            center: [cameraState.longitude, cameraState.latitude],
            zoom: cameraState.zoom,
            pitch: cameraState.pitch,
            bearing: cameraState.bearing,
          })
          map.triggerRepaint?.()
        },
        defaults: {
          ease: "none",
        },
      })

      timeline
        .from(cameraState, {
          ...cameraTo,
        })
        .to(
          scrollState,
          {
            value: 1,
          },
          "<"
        )

      // return () => {
      //   drawTUniform.value = 0
      //   setArtworkLineProgress(0)
      // }
    },
    { dependencies: [map] }
  )

  return <></>
}

export default ScrollyIntro
