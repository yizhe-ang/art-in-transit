import {
  ALTITUDE,
  ARTWORK_DEPTH_STEP,
  HOVER_ALTITUDE_OFFSET,
  HOVER_SCALE,
} from "@/components/three/artworks/constants"
import { artworkZoomScale } from "@/components/three/artworks/zoom-scale"
import {
  borderIntensityUniform,
  borderOpacityUniform,
  borderWidthUniform,
  embeddingLayoutProgressUniform,
  embeddingRawLayoutProgressUniform,
  hoveredArtworkIdUniform,
  hoveredArtworkStartInfluenceUniform,
  hoverTransitionUniform,
  lineLayoutProgressUniform,
  previousHoveredArtworkIdUniform,
  previousHoveredArtworkStartInfluenceUniform,
  timeLayoutProgressUniform,
} from "@/components/three/artworks/use-artwork-transitions"
import { useMemo } from "react"
import {
  billboarding,
  equal,
  float,
  instanceIndex,
  int,
  mix,
  or,
  positionLocal,
  select,
  texture,
  uv,
  vec3,
  vec4,
} from "three/tsl"

export function useArtworkMaterialNodes({
  artworkMetadataAttribute,
  artworksTexture,
  embeddingLayoutPositions,
  lineBorderColorUniforms,
  lineRowPositions,
  renderPositions,
  timePositions,
}) {
  const hoverInfluenceNode = useMemo(() => {
    const artworkIndex = int(instanceIndex)
    const hoveredInfluence = select(
      equal(artworkIndex, hoveredArtworkIdUniform),
      mix(
        hoveredArtworkStartInfluenceUniform,
        float(1),
        hoverTransitionUniform
      ),
      float(0)
    )
    const previousHoveredInfluence = select(
      equal(artworkIndex, previousHoveredArtworkIdUniform),
      mix(
        previousHoveredArtworkStartInfluenceUniform,
        float(0),
        hoverTransitionUniform
      ),
      float(0)
    )
    return hoveredInfluence.add(previousHoveredInfluence)
  }, [])

  const positionNode = useMemo(() => {
    const lineZoomScale = mix(
      artworkZoomScale,
      float(1),
      lineLayoutProgressUniform
    )
    const timeZoomScale = mix(
      lineZoomScale,
      float(1),
      timeLayoutProgressUniform
    )
    const zoomScale = mix(
      timeZoomScale,
      float(1),
      embeddingLayoutProgressUniform
    )
    const embeddingZoomScale = mix(
      zoomScale,
      float(1),
      embeddingRawLayoutProgressUniform
    )
    const hoverScale = mix(float(1), float(HOVER_SCALE), hoverInfluenceNode)

    return positionLocal
      .mul(artworkMetadataAttribute.xyz)
      .mul(embeddingZoomScale)
      .mul(hoverScale)
  }, [artworkMetadataAttribute, hoverInfluenceNode])

  const vertexNode = useMemo(() => {
    const embeddingLayoutAttribute = embeddingLayoutPositions.toAttribute()
    const snappedEmbeddingPosition = vec3(
      embeddingLayoutAttribute.x,
      float(ALTITUDE),
      embeddingLayoutAttribute.y
    )
    const rawEmbeddingPosition = vec3(
      embeddingLayoutAttribute.z,
      float(ALTITUDE),
      embeddingLayoutAttribute.w
    )
    const rowLayoutPosition = mix(
      renderPositions.toAttribute(),
      lineRowPositions.toAttribute(),
      lineLayoutProgressUniform
    )
    const layoutPosition = mix(
      rowLayoutPosition,
      timePositions.toAttribute(),
      timeLayoutProgressUniform
    )
    const organizedLayoutPosition = mix(
      layoutPosition,
      snappedEmbeddingPosition,
      embeddingLayoutProgressUniform
    )
    const embeddingLayoutPosition = mix(
      organizedLayoutPosition,
      rawEmbeddingPosition,
      embeddingRawLayoutProgressUniform
    )
    const hoverLift = vec3(
      float(0),
      hoverInfluenceNode.mul(HOVER_ALTITUDE_OFFSET),
      float(0)
    )
    const instanceDepthLift = vec3(
      float(0),
      artworkMetadataAttribute.z.mul(ARTWORK_DEPTH_STEP),
      float(0)
    )

    return billboarding({
      position: embeddingLayoutPosition.add(hoverLift).add(instanceDepthLift),
      horizontal: false,
      vertical: true,
    })
  }, [
    artworkMetadataAttribute,
    embeddingLayoutPositions,
    hoverInfluenceNode,
    lineRowPositions,
    renderPositions,
    timePositions,
  ])

  const colorNode = useMemo(() => {
    const uvNode = uv()
    const artworkColor = texture(artworksTexture, uvNode.flipY()).depth(
      int(instanceIndex)
    )
    const lineBorderColor = lineBorderColorUniforms.element(
      artworkMetadataAttribute.w.toInt()
    )
    const aspectRatio = artworkMetadataAttribute.x
    const horizontalBorderWidth = borderWidthUniform.div(aspectRatio)
    const intensifiedBorderColor = lineBorderColor.mul(borderIntensityUniform)
    const edgeMask = or(
      or(
        uvNode.x.lessThan(horizontalBorderWidth),
        uvNode.x.greaterThan(float(1).sub(horizontalBorderWidth))
      ),
      or(
        uvNode.y.lessThan(borderWidthUniform),
        uvNode.y.greaterThan(float(1).sub(borderWidthUniform))
      )
    )

    return select(
      edgeMask,
      vec4(intensifiedBorderColor, artworkColor.a.mul(borderOpacityUniform)),
      artworkColor
    )
  }, [artworksTexture, artworkMetadataAttribute, lineBorderColorUniforms])

  const opacityNode = useMemo(() => {
    return float(0.9)
  }, [])

  return {
    colorNode,
    opacityNode,
    positionNode,
    vertexNode,
  }
}
