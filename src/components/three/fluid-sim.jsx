import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import { folder, useControls } from "leva"
import FluidSimulation from "@/lib/fluidSim"
import MouseTrail from "@/lib/mouseTrail"

const MIN_SIM_SIZE = 1
const DEFAULT_RESOLUTION_SCALE = 1

function getRenderSize(size, dpr, resolutionScale) {
  return {
    width: Math.max(
      MIN_SIM_SIZE,
      Math.round(size.width * dpr * resolutionScale)
    ),
    height: Math.max(
      MIN_SIM_SIZE,
      Math.round(size.height * dpr * resolutionScale)
    ),
  }
}

function getPointerFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect()

  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  }
}

const FluidSim = forwardRef(function FluidSim(
  {
    children,
    enabled: defaultEnabled = true,
    persistInactiveTrail: defaultPersistInactiveTrail = true,
    resolutionScale: defaultResolutionScale = DEFAULT_RESOLUTION_SCALE,
    onTexture,
  },
  ref
) {
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const viewportDpr = useThree((state) => state.viewport.dpr)
  const map = useMap()
  const pointerRef = useRef(null)
  const settleFramesRef = useRef(0)

  const {
    enabled,
    resolutionScale,
    trailSize,
    minTrailSize,
    lerpSpeed,
    fadeInSpeed,
    fadeOutSpeed,
    persistInactiveTrail,
    moveThreshold,
    noiseScale,
    displacementStrength,
    fadeAmount,
    settleFrames,
  } = useControls({
    "fluid sim": folder({
      enabled: defaultEnabled,
      resolutionScale: {
        value: defaultResolutionScale,
        min: 0.25,
        max: 1.5,
        step: 0.05,
      },
      trailSize: {
        // value: 0.2,
        value: 0.005,
        min: 0.02,
        max: 0.6,
        step: 0.01,
      },
      minTrailSize: {
        // value: 100,
        value: 5,
        min: 1,
        max: 400,
        step: 1,
      },
      lerpSpeed: {
        value: 0.075,
        min: 0.01,
        max: 0.5,
        step: 0.005,
      },
      fadeInSpeed: {
        value: 0.1,
        min: 0.01,
        max: 0.5,
        step: 0.01,
      },
      fadeOutSpeed: {
        value: 0.1,
        min: 0.01,
        max: 0.5,
        step: 0.01,
      },
      persistInactiveTrail: defaultPersistInactiveTrail,
      moveThreshold: {
        value: 0.5,
        min: 0,
        max: 10,
        step: 0.1,
      },
      noiseScale: {
        value: 20,
        min: 1,
        max: 80,
        step: 1,
      },
      displacementStrength: {
        value: 0.01,
        min: 0,
        max: 0.08,
        step: 0.001,
      },
      fadeAmount: {
        value: 0.015,
        min: 0.001,
        max: 0.08,
        step: 0.001,
      },
      settleFrames: {
        value: 90,
        min: 0,
        max: 240,
        step: 1,
      },
    }),
  })

  const dpr =
    viewportDpr ?? gl.getPixelRatio?.() ?? window.devicePixelRatio ?? 1
  const renderSize = useMemo(() => {
    return getRenderSize(size, dpr, resolutionScale)
  }, [dpr, resolutionScale, size])
  const [sim] = useState(() => {
    return new FluidSimulation(renderSize.width, renderSize.height)
  })
  const [trail] = useState(() => {
    return new MouseTrail(renderSize.width, renderSize.height)
  })

  useEffect(() => {
    sim.onResize(renderSize.width, renderSize.height)
    trail.resize(renderSize.width, renderSize.height)
  }, [renderSize.height, renderSize.width, sim, trail])

  useEffect(() => {
    sim.setOptions({
      noiseScale,
      displacementStrength,
      fadeAmount,
    })
  }, [displacementStrength, fadeAmount, noiseScale, sim])

  useEffect(() => {
    trail.setOptions({
      trailSize,
      minTrailSize,
      lerpSpeed,
      fadeInSpeed,
      fadeOutSpeed,
      persistInactiveTrail,
      moveThreshold,
    })
  }, [
    fadeInSpeed,
    fadeOutSpeed,
    lerpSpeed,
    minTrailSize,
    moveThreshold,
    persistInactiveTrail,
    trail,
    trailSize,
  ])

  useEffect(() => {
    onTexture?.(sim.texture)
  }, [onTexture, sim])

  useEffect(() => {
    const canvas = map?.getCanvas?.() ?? gl.domElement
    const eventTarget = canvas.parentElement ?? gl.domElement

    const handlePointerMove = (event) => {
      if (!enabled) return

      pointerRef.current = getPointerFromEvent(event, canvas)
      settleFramesRef.current = settleFrames
      map?.triggerRepaint?.()
    }

    const handlePointerLeave = () => {
      pointerRef.current = null
    }

    eventTarget.addEventListener("pointermove", handlePointerMove)
    eventTarget.addEventListener("pointerleave", handlePointerLeave)

    return () => {
      eventTarget.removeEventListener("pointermove", handlePointerMove)
      eventTarget.removeEventListener("pointerleave", handlePointerLeave)
    }
  }, [enabled, gl, map, settleFrames])

  useImperativeHandle(
    ref,
    () => ({
      get texture() {
        return sim.texture
      },
      get trailTexture() {
        return trail.texture
      },
      reset() {
        trail.reset()
      },
    }),
    [sim, trail]
  )

  useEffect(() => {
    return () => {
      sim.dispose()
      trail.dispose()
    }
  }, [sim, trail])

  useFrame(() => {
    if (!enabled) return

    const pointer = pointerRef.current

    if (pointer) {
      trail.update(pointer.x, pointer.y)
    }

    sim.update(gl, trail.texture)

    if (pointer || settleFramesRef.current > 0) {
      settleFramesRef.current = Math.max(0, settleFramesRef.current - 1)
      map?.triggerRepaint?.()
    }
  }, 0)

  return children?.(sim.texture) ?? null
})

export default FluidSim
