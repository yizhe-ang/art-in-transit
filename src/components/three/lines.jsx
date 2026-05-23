import { useEffect, useMemo } from "react"
import { buildRailRoutes } from "@/components/three/rail-routes"
import { publicUrl } from "@/lib/public-url"
import { useLoader, useThree } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import { folder, useControls } from "leva"
import * as THREE from "three/webgpu"
import { float, max, select, texture, uniform, uv, vec2 } from "three/tsl"

// TODO: Brush repeat could be fun to animate

const BRUSH_REPEAT_LENGTH = 2_400
const MIN_BRUSH_REPEATS = 1

// eslint-disable-next-line react-refresh/only-export-components
export const drawTUniform = uniform(1)
// eslint-disable-next-line react-refresh/only-export-components
export const brushOffsetUniform = uniform(0)
const brushRepeatLengthUniform = uniform(BRUSH_REPEAT_LENGTH)
const strokeOpacityUniform = uniform(1)
const alphaCutoffUniform = uniform(0.08)

function configureStrokeTexture(strokeTexture) {
  strokeTexture.wrapS = THREE.RepeatWrapping
  strokeTexture.wrapT = THREE.ClampToEdgeWrapping
  strokeTexture.minFilter = THREE.LinearMipmapLinearFilter
  strokeTexture.magFilter = THREE.LinearFilter
  strokeTexture.colorSpace = THREE.NoColorSpace
  strokeTexture.needsUpdate = true

  return strokeTexture
}

function createLineNodes(strokeTexture, routeLength) {
  const brushRepeats = max(
    float(MIN_BRUSH_REPEATS),
    float(routeLength).div(brushRepeatLengthUniform)
  )
  const brushUv = vec2(uv().x.mul(brushRepeats).sub(brushOffsetUniform), uv().y)
  const brushAlpha = texture(strokeTexture, brushUv).a
  const drawMask = select(uv().x.lessThanEqual(drawTUniform), float(1), float(0))

  return {
    opacityNode: drawMask.mul(brushAlpha).mul(strokeOpacityUniform),
    alphaTestNode: alphaCutoffUniform,
  }
}

const PainterlyRoute = ({ route, strokeTexture }) => {
  const lineNodes = useMemo(() => {
    return createLineNodes(strokeTexture, route.length)
  }, [route.length, strokeTexture])

  return (
    <mesh>
      <tubeGeometry args={[route.curve, route.segments, 35, 8, false]} />
      <meshBasicNodeMaterial color={route.color} transparent {...lineNodes} />
    </mesh>
  )
}

const Lines = () => {
  const invalidate = useThree((state) => state.invalidate)
  const map = useMap()
  const strokeTexture = useLoader(
    THREE.TextureLoader,
    publicUrl("/textures/stroke.png")
  )

  useEffect(() => {
    configureStrokeTexture(strokeTexture)
  }, [strokeTexture])

  const routes = useMemo(() => {
    return buildRailRoutes()
  }, [])

  const { alphaCutoff, brushRepeatLength, strokeOpacity } = useControls({
    lines: folder({
      brushRepeatLength: {
        value: BRUSH_REPEAT_LENGTH,
        min: 600,
        max: 6_000,
        step: 100,
      },
      strokeOpacity: {
        value: 1,
        min: 0,
        max: 1,
        step: 0.01,
      },
      alphaCutoff: {
        value: 0.08,
        min: 0,
        max: 0.4,
        step: 0.01,
      },
    }),
  })

  useEffect(() => {
    alphaCutoffUniform.value = alphaCutoff
    brushRepeatLengthUniform.value = brushRepeatLength
    strokeOpacityUniform.value = strokeOpacity
    invalidate()
    map?.triggerRepaint?.()
  }, [alphaCutoff, brushRepeatLength, invalidate, map, strokeOpacity])

  return (
    <>
      <group>
        {routes.map((route) => (
          <PainterlyRoute
            key={route.id}
            route={route}
            strokeTexture={strokeTexture}
          />
        ))}
      </group>
    </>
  )
}

export default Lines
