import { LINE_ORDER } from "@/components/three/rail-routes"

export const ALTITUDE = 20
export const ARTWORK_DEPTH_STEP = 12
export const SIZE = 1800
export const DEFAULT_LINE_STAGGER = 0.2
export const DEFAULT_BORDER_WIDTH = 0.035
export const DEFAULT_BORDER_INTENSITY = 1
export const DEFAULT_BORDER_OPACITY = 0.75
// export const HOVER_ALTITUDE_OFFSET = 260
export const HOVER_ALTITUDE_OFFSET = 100
export const HOVER_SCALE = 1.18
export const HOVER_TRANSITION_DAMPING = 14
export const HOVER_TRANSITION_EPSILON = 0.001
export const LAYOUT_TRANSITION_DAMPING = 5.5
export const LAYOUT_TRANSITION_EPSILON = 0.001
export const MAX_LAYOUT_TRANSITION_DELTA = 1 / 30
export const NO_HOVERED_ARTWORK_ID = -1
export const CAMERA_FOCUS_DURATION = 650
export const MAP_CAMERA_FOCUS_ZOOM = 14
export const ORGANIZED_CAMERA_FOCUS_ZOOM = 12.5
export const FALLBACK_LINE_INDEX = LINE_ORDER.length
export const FALLBACK_LINE_COLOR = "#748477"

export const LAYOUT_TARGETS = {
  map: {
    embedding: 0,
    embeddingRaw: 0,
    line: 0,
    time: 0,
  },
  line: {
    embedding: 0,
    embeddingRaw: 0,
    line: 1,
    time: 0,
  },
  time: {
    embedding: 0,
    embeddingRaw: 0,
    line: 1,
    time: 1,
  },
  embedding: {
    embedding: 1,
    embeddingRaw: 0,
    line: 0,
    time: 0,
  },
  embeddingRaw: {
    embedding: 0,
    embeddingRaw: 1,
    line: 0,
    time: 0,
  },
}
