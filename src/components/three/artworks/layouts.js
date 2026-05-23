import { LINE_ORDER } from "@/components/three/rail-routes"

const DEFAULT_ALTITUDE = 20
const DEFAULT_SIZE = 1800
const LINE_ROW_COLUMN_GAP = DEFAULT_SIZE * 1.98
const LINE_ROW_GAP = DEFAULT_SIZE * 1.45
const LINE_ROW_GUIDE_PADDING = DEFAULT_SIZE * 0.5
const TIME_COLUMN_GAP = DEFAULT_SIZE * 1.98
const TIME_STACK_GAP = DEFAULT_SIZE * 1.25
const TIME_YEAR_LABEL_ALTITUDE = 0
const TIME_YEAR_LABEL_STACK_GAP = DEFAULT_SIZE * 0.42
const FALLBACK_LINE_INDEX = LINE_ORDER.length
const EMBEDDING_RAW_SCALE = 1.5
const EMBEDDING_RAW_PADDING = DEFAULT_SIZE * 0.04
const EMBEDDING_RAW_RELAXATION_ITERATIONS = 400
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

const STATION_PREFIX_LAYOUT_ORDER = {
  CE: 0,
  CC: 1,
}

function getStationPrefix(stationCode) {
  return stationCode?.match(/^[A-Z]+/)?.[0] ?? null
}

function getStationPrefixLayoutOrder(stationCode) {
  const prefix = getStationPrefix(stationCode)
  return STATION_PREFIX_LAYOUT_ORDER[prefix] ?? Number.MAX_SAFE_INTEGER
}

function compareArtworkStations(a, b) {
  return (
    getStationPrefixLayoutOrder(a.stationCode) -
      getStationPrefixLayoutOrder(b.stationCode) ||
    getStationSortNumber(a.stationCode) - getStationSortNumber(b.stationCode) ||
    (a.stationCode ?? "").localeCompare(b.stationCode ?? "") ||
    a.originalIndex - b.originalIndex
  )
}

function compareArtworkTimeStackItems(artworkRoutes, aIndex, bIndex) {
  const a = artworkRoutes[aIndex]
  const b = artworkRoutes[bIndex]

  return (
    (a?.lineIndex ?? FALLBACK_LINE_INDEX) -
      (b?.lineIndex ?? FALLBACK_LINE_INDEX) ||
    getStationSortNumber(a?.stationCode) - getStationSortNumber(b?.stationCode) ||
    (a?.stationCode ?? "").localeCompare(b?.stationCode ?? "") ||
    aIndex - bIndex
  )
}

function getArtworkYearValue(artwork) {
  const year = Number.parseInt(artwork?.year, 10)
  return Number.isFinite(year) ? year : Infinity
}

function getArtworkYearLabel(year) {
  return Number.isFinite(year) ? String(year) : "Unknown"
}

function separateEmbeddingPair(first, second, padding) {
  const dx = second.x - first.x
  const dz = second.z - first.z
  const overlapX = (first.width + second.width) * 0.5 + padding - Math.abs(dx)
  const overlapZ =
    (first.height + second.height) * 0.5 + padding - Math.abs(dz)

  if (overlapX <= 0 || overlapZ <= 0) return

  if (overlapX < overlapZ) {
    const direction =
      dx === 0 ? (first.index < second.index ? 1 : -1) : Math.sign(dx)
    const offset = overlapX * 0.5 * direction

    first.x -= offset
    second.x += offset
  } else {
    const direction =
      dz === 0 ? (first.index < second.index ? 1 : -1) : Math.sign(dz)
    const offset = overlapZ * 0.5 * direction

    first.z -= offset
    second.z += offset
  }
}

function createRelaxedEmbeddingRawPositions(
  artworkRoutes,
  positionsByIndex,
  aspectRatios = []
) {
  const items = artworkRoutes.map((artworkRoute, index) => {
    const positions = positionsByIndex.get(index)
    const snapped = positions?.snapped ?? artworkRoute.finalPosition
    const raw = positions?.raw ?? snapped

    return {
      height: DEFAULT_SIZE,
      index,
      raw,
      width: DEFAULT_SIZE * (aspectRatios[index] ?? 1),
      x: raw.x,
      z: raw.z,
    }
  })
  const centroid = items.reduce(
    (acc, item) => {
      acc.x += item.x
      acc.z += item.z
      return acc
    },
    { x: 0, z: 0 }
  )

  centroid.x /= items.length || 1
  centroid.z /= items.length || 1

  items.forEach((item) => {
    item.x = centroid.x + (item.x - centroid.x) * EMBEDDING_RAW_SCALE
    item.z = centroid.z + (item.z - centroid.z) * EMBEDDING_RAW_SCALE
  })

  for (
    let iteration = 0;
    iteration < EMBEDDING_RAW_RELAXATION_ITERATIONS;
    iteration += 1
  ) {
    for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < items.length;
        secondIndex += 1
      ) {
        separateEmbeddingPair(
          items[firstIndex],
          items[secondIndex],
          EMBEDDING_RAW_PADDING
        )
      }
    }
  }

  return new Map(items.map((item) => [item.index, item]))
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

  const finiteYears = [...groupsByYear.keys()]
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const firstYear = finiteYears[0]
  const lastYear = finiteYears.at(-1)
  const years =
    firstYear === undefined
      ? []
      : Array.from(
          { length: lastYear - firstYear + 1 },
          (_, index) => firstYear + index
        )

  if (groupsByYear.has(Infinity)) {
    years.push(Infinity)
  }

  const yearCenterOffset = (years.length - 1) * TIME_COLUMN_GAP * 0.5

  return years.map((year, yearIndex) => {
    const group = [...(groupsByYear.get(year) ?? [])].sort((aIndex, bIndex) =>
      compareArtworkTimeStackItems(artworkRoutes, aIndex, bIndex)
    )

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
    const z = rowIndex * LINE_ROW_GAP - rowCenterOffset

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

export function createArtworkEmbeddingLayoutPositionArray(
  artworkRoutes,
  layout,
  aspectRatios
) {
  const array = new Float32Array(artworkRoutes.length * 4)
  const positionsByIndex = new Map(
    (layout?.items ?? []).map((item) => [
      item.index,
      {
        snapped: item.position,
        raw: item.umapPosition,
      },
    ])
  )
  const rawPositionsByIndex = createRelaxedEmbeddingRawPositions(
    artworkRoutes,
    positionsByIndex,
    aspectRatios
  )

  artworkRoutes.forEach((artworkRoute, index) => {
    const positions = positionsByIndex.get(index)
    const snapped = positions?.snapped ?? artworkRoute.finalPosition
    const raw = rawPositionsByIndex.get(index) ?? positions?.raw ?? snapped
    const offset = index * 4

    array[offset + 0] = snapped.x
    array[offset + 1] = snapped.z
    array[offset + 2] = raw.x
    array[offset + 3] = raw.z
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
    const labelStackEdgeZ =
      timeStackBaseline === TIME_STACK_BASELINES.ZERO_DOWN
        ? 0
        : stackCenterOffset

    return {
      key: `year:${Number.isFinite(year) ? year : "unknown"}`,
      label,
      position: [
        x,
        TIME_YEAR_LABEL_ALTITUDE,
        labelStackEdgeZ + TIME_YEAR_LABEL_STACK_GAP,
      ],
    }
  })
}
