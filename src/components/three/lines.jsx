import { useMemo } from "react"
import * as THREE from "three"
import { coordsToVector3 } from "react-three-map/maplibre"
import rail from "@/data/sg-rail.geo.json"
import { center, lineColors } from "@/components/map/constants"

const origin = { longitude: center[0], latitude: center[1], altitude: 0 }

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

  console.log(routes)

  return (
    <>
      <group>
        {routes.map((route) => (
          <mesh key={route.id}>
            <tubeGeometry args={[route.curve, route.segments, 35, 6, false]} />
            <meshBasicNodeMaterial color={route.color} roughness={0.45} />
          </mesh>
        ))}
      </group>
    </>
  )
}

export default Lines
