import rail from "@/data/sg-rail.geo.json"
import { lineColors } from "@/components/map/constants"

export const RAIL_REST_LAYER_PAINTS = [
  {
    id: "lines-case",
    paints: {
      "line-opacity": 0.25,
    },
  },
  {
    id: "lines-label",
    paints: {
      "text-opacity": 1,
    },
  },
  {
    id: "stations-point",
    paints: {
      "icon-opacity": 1,
    },
  },
  {
    id: "stations-point-label",
    paints: {
      "text-opacity": 1,
    },
  },
  {
    id: "stations-label",
    paints: {
      "icon-opacity": 1,
      "text-opacity": 1,
    },
  },
]

export function getRailDrawLayers() {
  const lineEntries = []
  const seenLineNames = new Set()

  for (const feature of rail.features) {
    if (
      !["LineString", "MultiLineString"].includes(feature.geometry?.type) ||
      seenLineNames.has(feature.properties?.name)
    ) {
      continue
    }

    const lineName = feature.properties.name

    seenLineNames.add(lineName)
    lineEntries.push({
      id: `lines-draw-${lineEntries.length}`,
      name: lineName,
      color: lineColors[feature.properties.line_color] ?? "#748477",
    })
  }

  return lineEntries
}

export const RAIL_DRAW_LAYERS = getRailDrawLayers()
