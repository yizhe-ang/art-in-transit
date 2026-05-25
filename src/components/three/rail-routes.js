import rail from "@/data/sg-rail.geo.json"
import { origin, lineColors } from "@/components/map/constants"
import { coordsToVector3 } from "react-three-map/maplibre"
import * as THREE from "three"

export const LINE_ORDER = [
  "North South Line",
  "North East Line",
  "Circle Line",
  "Downtown Line",
  "Thomson-East Coast Line",
]

export const STATION_PREFIX_TO_LINE = {
  CC: "Circle Line",
  CE: "Circle Line",
  DT: "Downtown Line",
  NE: "North East Line",
  NS: "North South Line",
  TE: "Thomson-East Coast Line",
}

export function getLineParts(feature) {
  if (feature.geometry.type === "LineString") {
    return [feature.geometry.coordinates]
  }

  if (feature.geometry.type === "MultiLineString") {
    return feature.geometry.coordinates
  }

  return []
}

export function makePolylineCurve(points) {
  const path = new THREE.CurvePath()

  for (let i = 1; i < points.length; i++) {
    path.add(new THREE.LineCurve3(points[i - 1], points[i]))
  }

  return path
}

function coordsToRoutePoint([longitude, latitude], altitude) {
  return new THREE.Vector3(
    ...coordsToVector3({ longitude, latitude, altitude }, origin)
  )
}

function getRouteLengths(points) {
  const cumulativeLengths = new Float32Array(points.length)
  let length = 0

  for (let i = 1; i < points.length; i++) {
    length += points[i - 1].distanceTo(points[i])
    cumulativeLengths[i] = length
  }

  return { cumulativeLengths, length }
}

export function buildRailRoutes({ altitude = 8, lineNames } = {}) {
  const allowedLineNames = lineNames ? new Set(lineNames) : null

  return rail.features.flatMap((feature) => {
    const lineName = feature.properties?.name

    if (allowedLineNames && !allowedLineNames.has(lineName)) {
      return []
    }

    return getLineParts(feature)
      .filter((coordinates) => coordinates.length > 1)
      .map((coordinates, index) => {
        const points = coordinates.map((coordinate) => {
          return coordsToRoutePoint(coordinate, altitude)
        })
        const { cumulativeLengths, length } = getRouteLengths(points)

        return {
          id: `${feature.id}-${index}`,
          name: lineName,
          color: lineColors[feature.properties.line_color] ?? "#748477",
          curve: makePolylineCurve(points),
          cumulativeLengths,
          length,
          points,
          segments: Math.max(16, points.length - 1),
        }
      })
  })
}

export function getArtworkStationCode(artwork) {
  const stationCode =
    artwork.stationCode ||
    artwork.stationLabel?.match(/\b(?:CC|CE|DT|NE|NS|TE)\d+[A-Z]?\b/)?.[0] ||
    artwork.stationName?.match(/\b(?:CC|CE|DT|NE|NS|TE)\d+[A-Z]?\b/)?.[0]

  return stationCode ?? null
}

export function getArtworkStationCodes(artwork) {
  if (!artwork) {
    return []
  }

  const stationCodePattern = /\b(?:CC|CE|DT|EW|NE|NS|TE)\d+[A-Z]?\b/gi
  const stationCodes = [
    artwork.stationCode,
    artwork.stationLabel,
    artwork.stationName,
  ].flatMap((value) => {
    return value?.match(stationCodePattern) ?? []
  })

  return [
    ...new Set(stationCodes.map((stationCode) => stationCode.toUpperCase())),
  ]
}

export function formatStationName(stationName) {
  return stationName
    ?.replace(/^(?:\/\s*)?(?:CC|CE|DT|EW|NE|NS|TE)\d+[A-Z]?\s*:?\s*/i, "")
    .trim()
}

export function getLineNameForStationCode(stationCode) {
  const prefix = stationCode?.match(/^[A-Z]+/)?.[0]
  return STATION_PREFIX_TO_LINE[prefix] ?? null
}

export function getPointAtDistance(
  route,
  distance,
  target = new THREE.Vector3()
) {
  if (route.points.length === 0) {
    return target.set(0, 0, 0)
  }

  if (distance <= 0) {
    return target.copy(route.points[0])
  }

  if (distance >= route.length) {
    return target.copy(route.points[route.points.length - 1])
  }

  for (let i = 1; i < route.points.length; i++) {
    const segmentStartDistance = route.cumulativeLengths[i - 1]
    const segmentEndDistance = route.cumulativeLengths[i]

    if (distance <= segmentEndDistance) {
      const segmentLength = segmentEndDistance - segmentStartDistance
      const t =
        segmentLength === 0
          ? 0
          : (distance - segmentStartDistance) / segmentLength
      return target.copy(route.points[i - 1]).lerp(route.points[i], t)
    }
  }

  return target.copy(route.points[route.points.length - 1])
}

export function getClosestPointOnRoute(route, target) {
  const closestPoint = new THREE.Vector3()
  const segmentPoint = new THREE.Vector3()
  let closestDistanceAlong = 0
  let closestDistanceSq = Infinity

  for (let i = 1; i < route.points.length; i++) {
    const start = route.points[i - 1]
    const end = route.points[i]
    const segment = segmentPoint.subVectors(end, start)
    const segmentLengthSq = segment.lengthSq()
    const t =
      segmentLengthSq === 0
        ? 0
        : THREE.MathUtils.clamp(
            target.clone().sub(start).dot(segment) / segmentLengthSq,
            0,
            1
          )
    const point = segment.multiplyScalar(t).add(start)
    const distanceSq = point.distanceToSquared(target)

    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq
      closestPoint.copy(point)
      closestDistanceAlong =
        route.cumulativeLengths[i - 1] +
        route.points[i - 1].distanceTo(route.points[i]) * t
    }
  }

  return {
    distanceAlong: closestDistanceAlong,
    distanceSq: closestDistanceSq,
    point: closestPoint,
  }
}
