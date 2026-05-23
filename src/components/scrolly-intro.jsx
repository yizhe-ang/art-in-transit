import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { button, folder, useControls } from "leva"
import { useStore } from "@/store"
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

      // return () => {
      //   setArtworkLineProgress(0)
      // }
    },
    { dependencies: [map] }
  )

  return <></>
}

export default ScrollyIntro
