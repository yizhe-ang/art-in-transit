import { Layer, Source } from "react-map-gl/maplibre"
import { useStore } from "@/store"

const MAP_LIGHTEN_OPACITY = 0.62

const fullWorldFeature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
    ],
  },
}

const mapLightenSource = {
  type: "FeatureCollection",
  features: [fullWorldFeature],
}

const MapLightenOverlay = () => {
  const isLightened = useStore((state) => state.artworkLayout !== "map")

  return (
    <Source id="map-lighten-overlay-source" type="geojson" data={mapLightenSource}>
      <Layer
        id="map-lighten-overlay"
        type="fill"
        paint={{
          "fill-color": "#ffffff",
          "fill-opacity": isLightened ? MAP_LIGHTEN_OPACITY : 0,
          "fill-opacity-transition": {
            duration: 300,
          },
        }}
      />
    </Source>
  )
}

export default MapLightenOverlay
