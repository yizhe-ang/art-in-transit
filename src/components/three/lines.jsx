import { useEffect, useMemo } from "react"
import { buildRailRoutes } from "@/components/three/rail-routes"
import { folder, useControls } from "leva"
import { float, select, uniform, uv } from "three/tsl"

// TODO: These should have a pencil / brush texture

const drawTUniform = uniform(0)

const lineNodes = {
  opacityNode: select(uv().x.lessThanEqual(drawTUniform), float(1), float(0)),
  alphaTestNode: float(0.5),
}

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

  useEffect(() => {
    drawTUniform.value = drawT
  }, [drawT])

  return (
    <>
      <group>
        {routes.map((route) => (
          <mesh key={route.id}>
            <tubeGeometry args={[route.curve, route.segments, 35, 6, false]} />
            <meshBasicNodeMaterial
              color={route.color}
              transparent
              {...lineNodes}
            />
          </mesh>
        ))}
      </group>
    </>
  )
}

export default Lines
