import { useMemo } from "react"
import * as THREE from "three"
import { coordsToVector3 } from "react-three-map/maplibre"
import rail from "@/data/sg-rail.geo.json"
import { origin, lineColors } from "@/components/map/constants"
import { folder, useControls } from "leva"
import { float, select, uniform, uv } from "three/tsl"

function getLineParts(feature) {
  if (feature.geometry.type === "LineString") {
    return [feature.geometry.coordinates]
  }

  if (feature.geometry.type === "MultiLineString") {
    return feature.geometry.coordinates
  }

  return []
}

function makePolylineCurve(points) {
  const path = new THREE.CurvePath()

  for (let i = 1; i < points.length; i++) {
    path.add(new THREE.LineCurve3(points[i - 1], points[i]))
  }

  return path
}

const Lines = () => {
  const routes = useMemo(() => {
    return rail.features.flatMap((feature) => {
      return getLineParts(feature)
        .filter((coordinates) => coordinates.length > 1)
        .map((coordinates, index) => {
          const points = coordinates.map(([longitude, latitude]) => {
            return new THREE.Vector3(
              ...coordsToVector3({ longitude, latitude, altitude: 8 }, origin)
            )
          })

          return {
            id: `${feature.id}-${index}`,
            color: lineColors[feature.properties.line_color] ?? "#748477",
            curve: makePolylineCurve(points),
            segments: Math.max(16, points.length - 1),
          }
        })
    })
  }, [])

  const u = useMemo(() => {
    return {
      drawT: uniform(0),
    }
  }, [])

  const nodes = useMemo(() => {
    const isDrawn = uv().x.lessThanEqual(u.drawT)

    const opacityNode = select(isDrawn, float(1), float(0))

    const alphaTestNode = float(0.5)

    return {
      opacityNode,
      alphaTestNode,
    }
  }, [u])

  useControls({
    lines: folder({
      drawT: {
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (value) => {
          u.drawT.value = value
        },
      },
    }),
  })

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
