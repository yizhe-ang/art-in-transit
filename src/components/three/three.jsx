import "maplibre-gl/dist/maplibre-gl.css"
import { extend, useFrame } from "@react-three/fiber"
import { useRef, useState } from "react"
import Map from "react-map-gl/maplibre"
import { Canvas } from "react-three-map/maplibre"
import Scene from "@/components/three/scene"

const Three = () => {
  return (
    <>
      return{" "}
      <Map
        canvasContextAttributes={{
          antialias: true,
        }}
        initialViewState={{
          latitude: 51,
          longitude: 0,
          zoom: 13,
          pitch: 60,
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      >
        <Canvas latitude={51} longitude={0}>
          <Scene />
        </Canvas>
      </Map>
    </>
  )
}

export default Three
