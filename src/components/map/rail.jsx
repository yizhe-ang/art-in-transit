import { Source, Layer } from "react-map-gl/maplibre"
import rail from "@/data/sg-rail.geo.json"
import { lineColors } from "@/components/map/constants"
import { RAIL_DRAW_LAYERS } from "@/components/map/rail-reveal"

// TODO: Tune beforeId

const lineColorsExpression = [
  "match",
  ["get", "line_color"],
  ...Object.keys(lineColors)
    .map((c) => [c, lineColors[c]])
    .flat(),
  "#748477",
]

const lineGeometryFilter = [
  "any",
  ["==", ["geometry-type"], "LineString"],
  ["==", ["geometry-type"], "MultiLineString"],
]

const transparentLineColor = "rgba(0, 0, 0, 0)"

function createLineDrawLayer(line) {
  return {
    id: line.id,
    source: "rail",
    filter: ["all", lineGeometryFilter, ["==", ["get", "name"], line.name]],
    type: "line",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1, 22, 2],
      "line-color": line.color,
      "line-gradient": [
        "interpolate",
        ["linear"],
        ["line-progress"],
        0,
        transparentLineColor,
        1,
        transparentLineColor,
      ],
    },
  }
}

const linesCase = {
  id: "lines-case",
  source: "rail",
  filter: lineGeometryFilter,
  type: "line",
  minzoom: 11,
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 22, 30],
    "line-color": lineColorsExpression,
    "line-opacity": 0,
    "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 0, 22, 14],
  },
}

const linesLabel = {
  id: "lines-label",
  source: "rail",
  filter: lineGeometryFilter,
  type: "symbol",
  minzoom: 13,
  layout: {
    "symbol-placement": "line",
    "text-field": ["get", "name"],
    // "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-letter-spacing": 0.1,
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 22, 16],
    "text-pitch-alignment": "viewport",
    "text-rotation-alignment": "map",
    "text-max-angle": 30,
    "text-padding": 1,
  },
  paint: {
    "text-color": lineColorsExpression,
    "text-halo-blur": 1,
    "text-halo-color": "#fff",
    "text-halo-width": 2,
    "text-opacity": 0,
  },
}

const stationsPoint = {
  id: "stations-point",
  source: "rail",
  filter: ["==", ["get", "stop_type"], "station"],
  type: "symbol",
  minzoom: 10,
  maxzoom: 14,
  layout: {
    "icon-image": ["get", "station_colors"],
    "icon-size": ["interpolate", ["exponential", 2], ["zoom"], 10, 0.2, 14, 1],
    "icon-allow-overlap": true,
  },
  paint: {
    "icon-opacity": 0,
  },
}

const stationsPointLabel = {
  id: "stations-point-label",
  source: "rail",
  filter: [
    "all",
    ["==", ["get", "stop_type"], "station"],
    ["in", "-", ["get", "station_codes"]],
  ],
  type: "symbol",
  minzoom: 10,
  maxzoom: 13,
  layout: {
    "symbol-avoid-edges": true,
    "text-field": ["get", "name"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 13, 12],
    // "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-variable-anchor": ["left", "right"],
    "text-radial-offset": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      ["*", 0.25, ["get", "network_count"]],
      13,
      ["*", 0.5, ["get", "network_count"]],
    ],
    "text-max-width": 20,
    "text-optional": true,
  },
  paint: {
    "text-color": "rgba(0,0,0,.5)",
    "text-halo-color": "rgba(255,255,255,.5)",
    "text-halo-width": 1,
    "text-halo-blur": 1,
    "text-opacity": 0,
  },
}

const stationsLabel = {
  id: "stations-label",
  source: "rail",
  filter: ["==", ["get", "stop_type"], "station"],
  type: "symbol",
  minzoom: 13,
  layout: {
    "text-field": ["get", "name"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 16, 16],
    // "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-anchor": "bottom",
    "text-offset": [0, -0.8],
    "text-max-width": 20,
    // 'text-allow-overlap': true,
    "icon-image": ["get", "station_codes"],
    "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.3, 15, 0.5],
    "icon-ignore-placement": true,
    "icon-allow-overlap": true,
  },
  paint: {
    "text-halo-color": "#fff",
    "text-halo-width": 2,
    "text-halo-blur": 1,
    "icon-opacity": 0,
    "text-opacity": 0,
  },
}

const Rail = () => {
  return (
    <>
      <Source id="rail" type="geojson" data={rail} lineMetrics>
        <Layer {...linesCase} />
        {RAIL_DRAW_LAYERS.map((line) => (
          <Layer key={line.id} {...createLineDrawLayer(line)} />
        ))}
        <Layer {...linesLabel} />
        <Layer {...stationsPoint} />
        <Layer {...stationsPointLabel} />
        <Layer {...stationsLabel} />
      </Source>
    </>
  )
}

export default Rail
