import rail from "@/data/sg-rail.geo.json"
import {
  formatStationName,
  LINE_ORDER,
  STATION_PREFIX_TO_LINE,
} from "@/components/three/rail-routes"

const DEFAULT_ALTITUDE = 20
const DEFAULT_SIZE = 1800
const LINE_ROW_COLUMN_GAP = DEFAULT_SIZE * 1.98
const LINE_ROW_DUPLICATE_FAN_X_GAP = DEFAULT_SIZE * 0.42
const LINE_ROW_DUPLICATE_FAN_Z_GAP = DEFAULT_SIZE * 0.28
const LINE_ROW_GAP = DEFAULT_SIZE * 1.45
const LINE_ROW_GUIDE_PADDING = DEFAULT_SIZE * 0.5
const TIME_COLUMN_GAP = DEFAULT_SIZE * 1.98
const TIME_LAYOUT_Z_OFFSET = 3000
const TIME_STACK_GAP = DEFAULT_SIZE * 1.25
const TIME_YEAR_LABEL_ALTITUDE = 0
const TIME_YEAR_LABEL_STACK_GAP = DEFAULT_SIZE * 0.42
const FALLBACK_LINE_INDEX = LINE_ORDER.length
const EMBEDDING_RAW_SCALE = 1.5
const EMBEDDING_RAW_PADDING = DEFAULT_SIZE * 0.04
const EMBEDDING_RAW_RELAXATION_ITERATIONS = 400
const STATION_CODE_PATTERN = /\b(?:CC|CE|DT|NE|NS|TE)\d+[A-Z]?\b/gi
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

function getLineNameForStationCode(stationCode) {
  return STATION_PREFIX_TO_LINE[getStationPrefix(stationCode)] ?? null
}

function getStationPrefixLayoutOrder(stationCode) {
  const prefix = getStationPrefix(stationCode)
  return STATION_PREFIX_LAYOUT_ORDER[prefix] ?? Number.MAX_SAFE_INTEGER
}

function compareStationCodes(a, b) {
  return (
    getStationPrefixLayoutOrder(a) - getStationPrefixLayoutOrder(b) ||
    getStationSortNumber(a) - getStationSortNumber(b) ||
    (a ?? "").localeCompare(b ?? "")
  )
}

function compareArtworkStations(a, b) {
  return (
    compareStationCodes(a.stationCode, b.stationCode) ||
    a.originalIndex - b.originalIndex
  )
}

function getCenteredStackOffset(index, count, gap) {
  return (index - (count - 1) * 0.5) * gap
}

function getStationCodes(value) {
  return [
    ...new Set(
      value?.match(STATION_CODE_PATTERN)?.map((code) => {
        return code.toUpperCase()
      }) ?? []
    ),
  ]
}

function createLineStationSlots() {
  const stationCodesByLine = LINE_ORDER.reduce((groups, lineName) => {
    groups.set(lineName, new Set())
    return groups
  }, new Map())
  const stationNameByCode = new Map()

  rail.features.forEach((feature) => {
    if (feature.properties?.stop_type !== "station") {
      return
    }

    getStationCodes(feature.properties?.station_codes).forEach(
      (stationCode) => {
        const lineName = getLineNameForStationCode(stationCode)

        stationCodesByLine.get(lineName)?.add(stationCode)
        stationNameByCode.set(stationCode, feature.properties?.name)
      }
    )
  })

  return {
    stationNameByCode,
    stationSlotsByLine: LINE_ORDER.map((lineName) => {
      return [...(stationCodesByLine.get(lineName) ?? [])].sort(
        compareStationCodes
      )
    }),
  }
}

const {
  stationNameByCode: LINE_STATION_NAME_BY_CODE,
  stationSlotsByLine: LINE_STATION_SLOTS,
} = createLineStationSlots()

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
  const stationLabels = []
  const rows = LINE_ORDER.map((lineName, lineIndex) => ({
    lineIndex,
    lineName,
    items: [],
    stationSlots: LINE_STATION_SLOTS[lineIndex] ?? [],
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
    const usesStationSlots = row.lineIndex !== FALLBACK_LINE_INDEX
    const rowStationCodes = new Set(row.stationSlots)
    const missingStationCodes = new Set()

    if (usesStationSlots) {
      sortedItems.forEach((item) => {
        if (item.stationCode && !rowStationCodes.has(item.stationCode)) {
          missingStationCodes.add(item.stationCode)
        }
      })
    }

    const stationSlots = [
      ...row.stationSlots,
      ...[...missingStationCodes].sort(compareStationCodes),
    ]
    const stationColumnByCode = new Map(
      stationSlots.map((stationCode, columnIndex) => [stationCode, columnIndex])
    )
    const duplicateStationGroups = new Map()
    const columnCount = usesStationSlots
      ? stationSlots.length
      : sortedItems.length
    const columnCenterOffset =
      (columnCount - 1) * LINE_ROW_COLUMN_GAP * 0.5
    const z = rowIndex * LINE_ROW_GAP - rowCenterOffset

    if (usesStationSlots) {
      stationSlots.forEach((stationCode, columnIndex) => {
        const stationName = LINE_STATION_NAME_BY_CODE.get(stationCode)
        const label = formatStationName(stationName) ?? stationCode

        stationLabels.push({
          key: `station:${row.lineIndex}:${stationCode}`,
          label,
          position: [
            columnIndex * LINE_ROW_COLUMN_GAP - columnCenterOffset,
            DEFAULT_ALTITUDE,
            z,
          ],
        })
      })
    }

    if (usesStationSlots) {
      sortedItems.forEach((item) => {
        if (!item.stationCode) return

        const group = duplicateStationGroups.get(item.stationCode) ?? []

        group.push(item.originalIndex)
        duplicateStationGroups.set(item.stationCode, group)
      })
    }

    sortedItems.forEach((artworkRoute, columnIndex) => {
      const stationColumnIndex = stationColumnByCode.get(
        artworkRoute.stationCode
      )
      const duplicateGroup = duplicateStationGroups.get(artworkRoute.stationCode)
      const duplicateIndex =
        duplicateGroup?.indexOf(artworkRoute.originalIndex) ?? 0
      const duplicateXOffset =
        duplicateGroup && duplicateGroup.length > 1
          ? getCenteredStackOffset(
              duplicateIndex,
              duplicateGroup.length,
              LINE_ROW_DUPLICATE_FAN_X_GAP
            )
          : 0
      const duplicateZOffset =
        duplicateGroup && duplicateGroup.length > 1
          ? getCenteredStackOffset(
              duplicateIndex,
              duplicateGroup.length,
              LINE_ROW_DUPLICATE_FAN_Z_GAP
            )
          : 0

      setPositionAt(
        array,
        artworkRoute.originalIndex,
        (stationColumnIndex ?? columnIndex) * LINE_ROW_COLUMN_GAP -
          columnCenterOffset +
          duplicateXOffset,
        DEFAULT_ALTITUDE,
        z + duplicateZOffset
      )
    })

    if (columnCount > 0) {
      const startX = -columnCenterOffset - LINE_ROW_GUIDE_PADDING
      const endX =
        (columnCount - 1) * LINE_ROW_COLUMN_GAP -
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
    stationLabels,
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

      setPositionAt(
        array,
        originalIndex,
        x,
        DEFAULT_ALTITUDE,
        z + TIME_LAYOUT_Z_OFFSET
      )
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
        labelStackEdgeZ + TIME_YEAR_LABEL_STACK_GAP + TIME_LAYOUT_Z_OFFSET,
      ],
    }
  })
}
