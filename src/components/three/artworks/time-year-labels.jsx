import { Html } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import * as THREE from "three/webgpu"

const TIME_YEAR_LABEL_DISTANCE_FACTOR = 4000
const TIME_YEAR_LABEL_STYLE = {
  color: "rgba(255, 255, 255, 0.94)",
  fontFamily: "var(--font-heading), var(--font-sans), sans-serif",
  fontSize: "24px",
  fontWeight: 600,
  letterSpacing: "0",
  lineHeight: 1,
  opacity: 0,
  pointerEvents: "none",
  textShadow: "0 2px 12px rgba(0, 0, 0, 0.78)",
  userSelect: "none",
  whiteSpace: "nowrap",
  willChange: "opacity",
}

function TimeYearLabels({ labels, timeLayoutProgressUniform }) {
  const labelRefs = useRef([])
  const initialOpacity = THREE.MathUtils.clamp(
    timeLayoutProgressUniform.value,
    0,
    1
  ).toFixed(3)

  useEffect(() => {
    labelRefs.current.length = labels.length
  }, [labels.length])

  useFrame(() => {
    const opacity = THREE.MathUtils.clamp(timeLayoutProgressUniform.value, 0, 1)
    const opacityValue = opacity.toFixed(3)

    labelRefs.current.forEach((element) => {
      if (!element || element.style.opacity === opacityValue) return

      element.style.opacity = opacityValue
    })
  })

  return (
    <group>
      {labels.map((label, index) => (
        <Html
          key={label.year}
          center
          distanceFactor={TIME_YEAR_LABEL_DISTANCE_FACTOR}
          position={label.position}
          sprite
          style={{ pointerEvents: "none" }}
          transform
        >
          <div
            ref={(element) => {
              labelRefs.current[index] = element
            }}
            style={{
              ...TIME_YEAR_LABEL_STYLE,
              opacity: initialOpacity,
            }}
          >
            {label.label}
          </div>
        </Html>
      ))}
    </group>
  )
}

export default TimeYearLabels
