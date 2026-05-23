import { origin } from "@/components/map/constants"
import {
  LINE_ORDER,
  buildRailRoutes,
  getArtworkStationCode,
  getClosestPointOnRoute,
  getLineNameForStationCode,
} from "@/components/three/rail-routes"
import {
  ALTITUDE,
  FALLBACK_LINE_COLOR,
  FALLBACK_LINE_INDEX,
  SIZE,
} from "@/components/three/artworks/constants"
import { coordsToVector3 } from "react-three-map/maplibre"
import * as THREE from "three/webgpu"

const CLUSTER_OFFSET = SIZE * 0.18
const COORDINATE_KEY_PRECISION = 6

export function getArtworkPosition(artwork) {
  return new THREE.Vector3(
    ...coordsToVector3(
      {
        longitude: artwork.longitude,
        latitude: artwork.latitude,
        altitude: ALTITUDE,
      },
      origin
    )
  )
}

export function getArtworkKey(artwork) {
  return artwork?.itemUrl ?? artwork?.sourceTitle ?? artwork?.artworkTitle
}

function getArtworkClusterKey(artwork) {
  const stationCode = getArtworkStationCode(artwork)

  if (stationCode) {
    return `station:${stationCode}`
  }

  return `coord:${Number(artwork.longitude).toFixed(
    COORDINATE_KEY_PRECISION
  )},${Number(artwork.latitude).toFixed(COORDINATE_KEY_PRECISION)}`
}

function getRouteDirectionAtDistance(route, distance, target) {
  if (!route?.points?.length) {
    return target.set(1, 0, 0)
  }

  for (let index = 1; index < route.points.length; index += 1) {
    const endDistance = route.cumulativeLengths[index]

    if (distance <= endDistance) {
      target.subVectors(route.points[index], route.points[index - 1])
      target.y = 0

      if (target.lengthSq() > 0) {
        return target.normalize()
      }
    }
  }

  target.subVectors(
    route.points[route.points.length - 1],
    route.points[Math.max(0, route.points.length - 2)]
  )
  target.y = 0

  return target.lengthSq() > 0 ? target.normalize() : target.set(1, 0, 0)
}

function getClusterOffset({ index, count, direction, target }) {
  if (count <= 1) {
    return target.set(0, 0, 0)
  }

  const along = direction
  const across = new THREE.Vector3(-along.z, 0, along.x)

  if (across.lengthSq() === 0) {
    across.set(1, 0, 0)
  } else {
    across.normalize()
  }

  target.set(0, 0, 0)

  if (count === 2) {
    return target.addScaledVector(
      across,
      (index === 0 ? -1 : 1) * CLUSTER_OFFSET
    )
  }

  if (count === 3) {
    const offsets = [
      [-0.9, -0.25],
      [0.9, -0.25],
      [0, 0.65],
    ]
    const [acrossScale, alongScale] = offsets[index]

    return target
      .addScaledVector(across, acrossScale * CLUSTER_OFFSET)
      .addScaledVector(along, alongScale * CLUSTER_OFFSET)
  }

  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
  const radius = CLUSTER_OFFSET * 1.1

  return target
    .addScaledVector(across, Math.cos(angle) * radius)
    .addScaledVector(along, Math.sin(angle) * radius)
}

function createLineBorderColors(routes) {
  const lineColorByName = new Map()

  routes.forEach((route) => {
    if (!lineColorByName.has(route.name)) {
      lineColorByName.set(route.name, route.color)
    }
  })

  const lineBorderColors = LINE_ORDER.map((lineName) => {
    return new THREE.Color(lineColorByName.get(lineName) ?? FALLBACK_LINE_COLOR)
  })

  lineBorderColors.push(new THREE.Color(FALLBACK_LINE_COLOR))

  return lineBorderColors
}

function groupRoutesByLine(routes) {
  return routes.reduce((groups, route) => {
    const lineRoutes = groups.get(route.name) ?? []
    lineRoutes.push(route)
    groups.set(route.name, lineRoutes)
    return groups
  }, new Map())
}

function createArtworkRouteItems(artworks, routesByLine) {
  return artworks.map((artwork) => {
    const finalPosition = getArtworkPosition(artwork)
    const stationCode = getArtworkStationCode(artwork)
    const lineName = getLineNameForStationCode(stationCode)
    const lineIndex = LINE_ORDER.indexOf(lineName)
    const routeCandidates = routesByLine.get(lineName) ?? []

    let selectedRoute = null
    let selectedClosestPoint = null

    routeCandidates.forEach((route) => {
      const closestPoint = getClosestPointOnRoute(route, finalPosition)

      if (
        selectedClosestPoint === null ||
        closestPoint.distanceSq < selectedClosestPoint.distanceSq
      ) {
        selectedRoute = route
        selectedClosestPoint = closestPoint
      }
    })

    return {
      clusterKey: getArtworkClusterKey(artwork),
      finalPosition,
      lineIndex: lineIndex === -1 ? FALLBACK_LINE_INDEX : lineIndex,
      route: selectedRoute,
      stationCode,
      targetDistance: selectedClosestPoint?.distanceAlong ?? 0,
    }
  })
}

function offsetClusteredArtworkRoutes(artworkRoutes) {
  const clusterGroups = artworkRoutes.reduce((groups, artworkRoute) => {
    const group = groups.get(artworkRoute.clusterKey) ?? []
    group.push(artworkRoute)
    groups.set(artworkRoute.clusterKey, group)
    return groups
  }, new Map())
  const direction = new THREE.Vector3()
  const offset = new THREE.Vector3()

  clusterGroups.forEach((group) => {
    if (group.length <= 1) return

    group.forEach((artworkRoute, index) => {
      getRouteDirectionAtDistance(
        artworkRoute.route,
        artworkRoute.targetDistance,
        direction
      )
      getClusterOffset({
        index,
        count: group.length,
        direction,
        target: offset,
      })
      artworkRoute.finalPosition = artworkRoute.finalPosition.clone().add(offset)
    })
  })
}

export function createArtworkRoutes(artworks) {
  const routes = buildRailRoutes({
    altitude: ALTITUDE,
    lineNames: LINE_ORDER,
  })
  const routesByLine = groupRoutesByLine(routes)
  const artworkRoutes = createArtworkRouteItems(artworks, routesByLine)

  offsetClusteredArtworkRoutes(artworkRoutes)

  return {
    artworkRoutes,
    lineBorderColors: createLineBorderColors(routes),
  }
}
