import { useMemo } from "react"
import { buildRailRoutes } from "@/components/three/rail-routes"
import { folder, useControls } from "leva"
import { float, select, uniform, uv } from "three/tsl"

const Lines = () => {
  const routes = useMemo(() => {
    return buildRailRoutes()
  }, [])

  const { drawT } = useControls({
    lines: folder({
      drawT: {
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
      },
    }),
  })

  const u = useMemo(() => {
    return {
      drawT: uniform(drawT),
    }
  }, [drawT])

  const nodes = useMemo(() => {
    const isDrawn = uv().x.lessThanEqual(u.drawT)

    const opacityNode = select(isDrawn, float(1), float(0))

    const alphaTestNode = float(0.5)

    return {
      opacityNode,
      alphaTestNode,
    }
  }, [u])

  return (
    <>
      <group>
        {routes.map((route) => (
          <mesh key={route.id}>
            <tubeGeometry args={[route.curve, route.segments, 35, 6, false]} />
            <meshBasicNodeMaterial color={route.color} transparent {...nodes} />
          </mesh>
        ))}
      </group>
    </>
  )
}

export default Lines
