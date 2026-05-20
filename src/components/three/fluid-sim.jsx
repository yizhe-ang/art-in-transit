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
import FluidSimulation from "@/lib/FluidSim"
import MouseTrail from "@/lib/MouseTrail"

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
    enabled = true,
    resolutionScale = DEFAULT_RESOLUTION_SCALE,
    onTexture,
  },
  ref
) {
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const viewportDpr = useThree((state) => state.viewport.dpr)
  const map = useMap()
  const pointerRef = useRef(null)

  const dpr = viewportDpr ?? gl.getPixelRatio?.() ?? window.devicePixelRatio ?? 1
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
    onTexture?.(sim.texture)
  }, [onTexture, sim])

  useEffect(() => {
    const canvas = map?.getCanvas?.() ?? gl.domElement
    const eventTarget = canvas.parentElement ?? gl.domElement

    const handlePointerMove = (event) => {
      if (!enabled) return

      pointerRef.current = getPointerFromEvent(event, canvas)
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
  }, [enabled, gl, map])

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
  }, 0)

  return children?.(sim.texture) ?? null
})

export default FluidSim
