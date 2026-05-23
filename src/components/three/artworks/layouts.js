import { LINE_ORDER } from "@/components/three/rail-routes"

const DEFAULT_ALTITUDE = 20
const DEFAULT_SIZE = 1800
const LINE_ROW_COLUMN_GAP = DEFAULT_SIZE * 1.98
const LINE_ROW_GAP = DEFAULT_SIZE * 1.45
const LINE_ROW_GUIDE_PADDING = DEFAULT_SIZE * 0.5
const TIME_COLUMN_GAP = DEFAULT_SIZE * 1.98
const TIME_STACK_GAP = DEFAULT_SIZE * 1.25
const TIME_YEAR_LABEL_GAP = DEFAULT_SIZE * 0.58
const FALLBACK_LINE_INDEX = LINE_ORDER.length
export const TIME_STACK_BASELINES = {
  CENTERED: "centered",
  ZERO_DOWN: "zero-down",
}

function setPositionAt(array, index, x, y, z) {
  array[index * 3 + 0] = x
  array[index * 3 + 1] = y
  array[index * 3 + 2] = z
}

function getStationSortNumber(stationCode) {
  return Number(stationCode?.match(/^[A-Z]+(\d+)/)?.[1] ?? Infinity)
}

function compareArtworkStations(a, b) {
  return (
    getStationSortNumber(a.stationCode) - getStationSortNumber(b.stationCode) ||
    (a.stationCode ?? "").localeCompare(b.stationCode ?? "") ||
    a.originalIndex - b.originalIndex
  )
}

function getArtworkYearValue(artwork) {
  const year = Number.parseInt(artwork?.year, 10)
  return Number.isFinite(year) ? year : Infinity
}

function getArtworkYearLabel(year) {
  return Number.isFinite(year) ? String(year) : "Unknown"
}

function createArtworkTimeGroups(artworkRoutes, artworks) {
  const groupsByYear = new Map()

  artworkRoutes.forEach((_, originalIndex) => {
    const artwork = artworks[originalIndex]
    const year = getArtworkYearValue(artwork)
    const group = groupsByYear.get(year) ?? []

    group.push(originalIndex)
    groupsByYear.set(year, group)
  })

  const years = [...groupsByYear.keys()].sort((a, b) => a - b)
  const yearCenterOffset = (years.length - 1) * TIME_COLUMN_GAP * 0.5

  return years.map((year, yearIndex) => {
    const group = groupsByYear.get(year)

    return {
      group,
      label: getArtworkYearLabel(year),
      x: yearIndex * TIME_COLUMN_GAP - yearCenterOffset,
      year,
    }
  })
}

export function createArtworkFinalPositionArray(artworkRoutes) {
  const array = new Float32Array(artworkRoutes.length * 3)

  artworkRoutes.forEach((artworkRoute, index) => {
    setPositionAt(
      array,
      index,
      artworkRoute.finalPosition.x,
      artworkRoute.finalPosition.y,
      artworkRoute.finalPosition.z
    )
  })

  return array
}

export function createArtworkLineRowLayout(artworkRoutes, lineColors = []) {
  const array = new Float32Array(artworkRoutes.length * 3)
  const guides = []
  const rows = LINE_ORDER.map((lineName, lineIndex) => ({
    lineIndex,
    lineName,
    items: [],
  }))
  const fallbackRow = {
    lineIndex: FALLBACK_LINE_INDEX,
    lineName: "Fallback",
    items: [],
  }

  artworkRoutes.forEach((artworkRoute, originalIndex) => {
    const row = rows[artworkRoute.lineIndex] ?? fallbackRow
    row.items.push({
      ...artworkRoute,
      originalIndex,
    })
  })

  if (fallbackRow.items.length > 0) {
    rows.push(fallbackRow)
  }

  const rowCenterOffset = (rows.length - 1) * LINE_ROW_GAP * 0.5

  rows.forEach((row, rowIndex) => {
    const sortedItems = [...row.items].sort(compareArtworkStations)
    const columnCenterOffset =
      (sortedItems.length - 1) * LINE_ROW_COLUMN_GAP * 0.5
    const z = rowCenterOffset - rowIndex * LINE_ROW_GAP

    sortedItems.forEach((artworkRoute, columnIndex) => {
      setPositionAt(
        array,
        artworkRoute.originalIndex,
        columnIndex * LINE_ROW_COLUMN_GAP - columnCenterOffset,
        DEFAULT_ALTITUDE,
        z
      )
    })

    if (sortedItems.length > 0) {
      const startX = -columnCenterOffset - LINE_ROW_GUIDE_PADDING
      const endX =
        (sortedItems.length - 1) * LINE_ROW_COLUMN_GAP -
        columnCenterOffset +
        LINE_ROW_GUIDE_PADDING

      guides.push({
        color: lineColors[row.lineIndex],
        length: Math.abs(endX - startX),
        lineIndex: row.lineIndex,
        lineName: row.lineName,
        start: [startX, DEFAULT_ALTITUDE, z],
        end: [endX, DEFAULT_ALTITUDE, z],
      })
    }
  })

  return {
    guides,
    positions: array,
  }
}

export function createArtworkLineRowPositionArray(artworkRoutes) {
  return createArtworkLineRowLayout(artworkRoutes).positions
}

export function createArtworkTimePositionArray(
  artworkRoutes,
  artworks,
  timeStackBaseline = TIME_STACK_BASELINES.CENTERED
) {
  const array = new Float32Array(artworkRoutes.length * 3)
  const groups = createArtworkTimeGroups(artworkRoutes, artworks)

  groups.forEach(({ group, x }) => {
    const stackCenterOffset = (group.length - 1) * TIME_STACK_GAP * 0.5

    group.forEach((originalIndex, stackIndex) => {
      const z =
        timeStackBaseline === TIME_STACK_BASELINES.ZERO_DOWN
          ? -stackIndex * TIME_STACK_GAP
          : stackCenterOffset - stackIndex * TIME_STACK_GAP

      setPositionAt(array, originalIndex, x, DEFAULT_ALTITUDE, z)
    })
  })

  return array
}

export function createArtworkTimeYearLabels(
  artworkRoutes,
  artworks,
  timeStackBaseline = TIME_STACK_BASELINES.CENTERED
) {
  const groups = createArtworkTimeGroups(artworkRoutes, artworks)

  return groups.map(({ group, label, x, year }) => {
    const stackCenterOffset = (group.length - 1) * TIME_STACK_GAP * 0.5
    const topZ =
      timeStackBaseline === TIME_STACK_BASELINES.ZERO_DOWN
        ? 0
        : stackCenterOffset

    return {
      label,
      position: [x, DEFAULT_ALTITUDE, topZ + TIME_YEAR_LABEL_GAP],
      year,
    }
  })
}
