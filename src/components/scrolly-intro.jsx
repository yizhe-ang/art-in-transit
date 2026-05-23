import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { button, folder, useControls } from "leva"
import { ArrowRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/store"
import { brushOffsetUniform } from "@/components/three/lines"
import {
  RAIL_DRAW_LAYERS,
  RAIL_REST_LAYER_PAINTS,
} from "@/components/map/rail-reveal"

gsap.registerPlugin(useGSAP, ScrollTrigger)

// TODO: Lenis?

const cameraTo = {
  longitude: 103.84338723745145,
  latitude: 1.310764844801426,
  zoom: 14.090032064289693,
  pitch: 60,
  bearing: -34.49132978279283,
}

const RAIL_DRAW_STAGGER = 0.04
const RAIL_GRADIENT_EDGE = 0.001
const TRANSPARENT_LINE_COLOR = "rgba(0, 0, 0, 0)"

const clamp01 = (value) => Math.min(1, Math.max(0, value))

function getStaggeredLineProgress(progress, lineIndex, lineCount) {
  const maxStagger = 0.85 / Math.max(1, lineCount - 1)
  const stagger = Math.min(RAIL_DRAW_STAGGER, maxStagger)
  const lineStart = lineIndex * stagger
  const lineDuration = 1 - (lineCount - 1) * stagger

  return clamp01((progress - lineStart) / lineDuration)
}

function createLineGradient(color, progress) {
  if (progress <= 0) {
    return [
      "interpolate",
      ["linear"],
      ["line-progress"],
      0,
      TRANSPARENT_LINE_COLOR,
      1,
      TRANSPARENT_LINE_COLOR,
    ]
  }

  if (progress >= 1 - RAIL_GRADIENT_EDGE) {
    return ["interpolate", ["linear"], ["line-progress"], 0, color, 1, color]
  }

  const gradientEdge = Math.min(1, progress + RAIL_GRADIENT_EDGE)

  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    color,
    progress,
    color,
    gradientEdge,
    TRANSPARENT_LINE_COLOR,
    1,
    TRANSPARENT_LINE_COLOR,
  ]
}

function setPaintPropertyIfLayerExists(map, layerId, paintProperty, value) {
  if (!map.getLayer(layerId)) {
    return
  }

  map.setPaintProperty(layerId, paintProperty, value)
}

function applyRailReveal(map, { drawProgress, restOpacity }) {
  RAIL_DRAW_LAYERS.forEach((line, index) => {
    const lineProgress = getStaggeredLineProgress(
      drawProgress,
      index,
      RAIL_DRAW_LAYERS.length
    )

    setPaintPropertyIfLayerExists(
      map,
      line.id,
      "line-gradient",
      createLineGradient(line.color, lineProgress)
    )
  })

  RAIL_REST_LAYER_PAINTS.forEach(({ id, paints }) => {
    Object.entries(paints).forEach(([paintProperty, targetValue]) => {
      setPaintPropertyIfLayerExists(
        map,
        id,
        paintProperty,
        targetValue * restOpacity
      )
    })
  })
}

const ScrollyIntro = () => {
  const map = useStore((state) => state.map)
  const isMapInteractionUnlocked = useStore(
    (state) => state.isMapInteractionUnlocked
  )
  const setMapInteractionUnlocked = useStore(
    (state) => state.setMapInteractionUnlocked
  )
  const shouldReduceMotion = useReducedMotion()
  const [showCta, setShowCta] = useState(false)
  const showCtaRef = useRef(false)

  const { brushFlowDistance } = useControls({
    "scrolly intro": folder({
      brushFlowDistance: {
        value: 1.5,
        min: 0,
        max: 8,
        step: 0.05,
      },
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

  useEffect(() => {
    if (!isMapInteractionUnlocked) {
      return
    }

    const root = document.documentElement
    const body = document.body
    const previousStyles = {
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    }
    const finalScrollY = Math.max(0, root.scrollHeight - window.innerHeight)

    window.scrollTo({ top: finalScrollY, left: 0, behavior: "auto" })
    root.style.overflow = "hidden"
    root.style.overscrollBehavior = "none"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"
    showCtaRef.current = false

    return () => {
      root.style.overflow = previousStyles.rootOverflow
      root.style.overscrollBehavior = previousStyles.rootOverscrollBehavior
      body.style.overflow = previousStyles.bodyOverflow
      body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior
    }
  }, [isMapInteractionUnlocked])

  useGSAP(
    () => {
      if (!map) {
        return
      }

      const setArtworkLineProgress = useStore.getState().setArtworkLineProgress

      const scrollState = {
        value: useStore.getState().artworkLineProgress,
      }
      const railState = {
        drawProgress: 0,
        restOpacity: 0,
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
      scrollState.value = 0
      brushOffsetUniform.value = 0
      applyRailReveal(map, railState)

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: "#step-1",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
        onUpdate: () => {
          setArtworkLineProgress(scrollState.value)
          applyRailReveal(map, railState)
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
      const ctaTrigger = ScrollTrigger.create({
        trigger: "#step-1",
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const shouldShow =
            !useStore.getState().isMapInteractionUnlocked && self.progress >= 0.85

          if (showCtaRef.current === shouldShow) {
            return
          }

          showCtaRef.current = shouldShow
          setShowCta(shouldShow)
        },
      })

      timeline
        .from(cameraState, {
          ...cameraTo,
          duration: 1,
        })
        .to(
          scrollState,
          {
            value: 1,
            duration: 1,
          },
          "<"
        )
        .to(
          brushOffsetUniform,
          {
            value: brushFlowDistance,
            duration: 1,
          },
          "<"
        )
        .to(
          railState,
          {
            drawProgress: 1,
            duration: 0.78,
          },
          "<"
        )
        .to(
          railState,
          {
            restOpacity: 1,
            duration: 0.22,
          },
          0.78
        )

      return () => {
        ctaTrigger.kill()
        // setArtworkLineProgress(0)
      }
    },
    { dependencies: [brushFlowDistance, map] }
  )

  return (
    <AnimatePresence>
      {showCta && !isMapInteractionUnlocked && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 sm:bottom-28"
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, transform: "translateY(14px)" }
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
              : { type: "spring", bounce: 0.18, visualDuration: 0.42 }
          }
        >
          <Button
            type="button"
            size="lg"
            className="pointer-events-auto gap-2 bg-lta-dark-green px-5 text-white shadow-[0_12px_36px_rgba(0,72,81,0.24)] ring-1 ring-white/70 hover:bg-lta-dark-green/92"
            onClick={() => {
              setMapInteractionUnlocked(true)
            }}
          >
            Explore the map
            <ArrowRight aria-hidden="true" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ScrollyIntro
