import { useFrame, useThree } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three/webgpu"
import { float, uniform } from "three/tsl"

const GUIDE_ALTITUDE_OFFSET = -4
const GUIDE_RADIUS = 100
const GUIDE_RADIAL_SEGMENTS = 4
const GUIDE_SEGMENTS = 1
const GUIDE_OPACITY = 0.72

function createGuideNodes(opacityUniform) {
  return {
    opacityNode: opacityUniform.mul(float(GUIDE_OPACITY)),
  }
}

function offsetGuidePoint(point) {
  return new THREE.Vector3(point[0], point[1] + GUIDE_ALTITUDE_OFFSET, point[2])
}

const guideOpacityUniform = uniform(0)

const LineLayoutGuide = ({ guide }) => {
  const curve = useMemo(() => {
    return new THREE.LineCurve3(
      offsetGuidePoint(guide.start),
      offsetGuidePoint(guide.end)
    )
  }, [guide.end, guide.start])
  const lineNodes = useMemo(() => {
    return createGuideNodes(guideOpacityUniform)
  }, [])

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <tubeGeometry
        args={[
          curve,
          GUIDE_SEGMENTS,
          GUIDE_RADIUS,
          GUIDE_RADIAL_SEGMENTS,
          false,
        ]}
      />
      <meshBasicNodeMaterial
        color={guide.color}
        depthWrite={false}
        transparent
        {...lineNodes}
      />
    </mesh>
  )
}

const LineLayoutGuides = ({
  guides,
  lineLayoutProgressUniform,
  timeLayoutProgressUniform,
}) => {
  const invalidate = useThree((state) => state.invalidate)

  useFrame(() => {
    const nextOpacity = THREE.MathUtils.clamp(
      lineLayoutProgressUniform.value * (1 - timeLayoutProgressUniform.value),
      0,
      1
    )

    if (guideOpacityUniform.value !== nextOpacity) {
      guideOpacityUniform.value = nextOpacity
      invalidate()
    }
  })

  return (
    <group>
      {guides.map((guide) => (
        <LineLayoutGuide key={guide.lineName} guide={guide} />
      ))}
    </group>
  )
}

export default LineLayoutGuides
