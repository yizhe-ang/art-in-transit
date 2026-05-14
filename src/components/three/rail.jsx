import { Source, Layer } from "react-map-gl/maplibre"
import rail from "@/data/sg-rail.geo.json"
import railWalks from "@/data/sg-rail-walks.geo.json"

// TODO: Tune beforeId

const lineColors = {
  orangered: "#d42e12",
  mediumseagreen: "#009645",
  orange: "#fa9e0d",
  saddlebrown: "#9D5B25",
  darkmagenta: "#9900aa",
  darkslateblue: "#005ec4",
  gray: "#748477",
}
const lineColorsExpression = [
  "match",
  ["get", "line_color"],
  ...Object.keys(lineColors)
    .map((c) => [c, lineColors[c]])
    .flat(),
  "#748477",
]

const linesCase = {
  id: "lines-case",
  source: "rail",
  filter: ["==", ["geometry-type"], "LineString"],
  type: "line",
  minzoom: 11,
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 22, 30],
    "line-color": lineColorsExpression,
    "line-opacity": 0.25,
    "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 0, 22, 14],
  },
}

const lines = {
  id: "lines",
  source: "rail",
  filter: ["==", ["geometry-type"], "LineString"],
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1, 22, 2],
    "line-color": lineColorsExpression,
  },
}

const linesLabel = {
  id: "lines-label",
  source: "rail",
  filter: ["==", ["geometry-type"], "LineString"],
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
  },
}

const stationsLabelNonEn = {
  id: "stations-label-non-en",
  source: "rail",
  filter: ["==", ["get", "stop_type"], "station"],
  type: "symbol",
  minzoom: 13,
  layout: {
    "text-field": [
      "format",
      ["get", "name_zh-Hans"],
      {},
      "\n",
      {},
      ["get", "name_ta"],
      {
        // 'text-font': ['literal', ['Noto Sans Tamil Medium']],
        // 'font-scale': 1.1, // Slightly larger text size for Tamil
      },
    ],
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 16, 16],
    // "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-anchor": "top",
    "text-offset": [0, 0.8],
    "text-max-width": 20,
    "text-optional": true,
  },
  paint: {
    "text-halo-color": "#fff",
    "text-halo-width": 2,
    "text-halo-blur": 1,
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
  },
}

const Rail = () => {
  return (
    <>
      <Source id="rail" type="geojson" data={rail}>
        <Layer {...linesCase} />
        <Layer {...lines} />
        <Layer {...linesLabel} />
        <Layer {...stationsPoint} />
        <Layer {...stationsPointLabel} />
        <Layer {...stationsLabelNonEn} />
        <Layer {...stationsLabel} />
      </Source>
    </>
  )
}

export default Rail
