import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "@huggingface/transformers"
import { UMAP } from "umap-js"

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const DATA_PATH = path.join(
  ROOT_DIR,
  "src/data/bloomberg-art-in-transit-gallery.json"
)
const MANIFEST_PATH = path.join(
  ROOT_DIR,
  "src/data/artwork-texture-manifest.json"
)
const OUTPUT_PATH = path.join(
  ROOT_DIR,
  "src/data/artwork-embedding-layout.json"
)
const MODEL_ID = "Xenova/clip-vit-base-patch32"
const MODEL_DTYPE = "q8"
const UMAP_SEED = 419
const UMAP_NEIGHBORS = 12
const UMAP_MIN_DIST = 0.16
const UMAP_EPOCHS = 500
const DEFAULT_ALTITUDE = 20
const DEFAULT_SIZE = 1800
const GRID_CELL_WIDTH = DEFAULT_SIZE * 1.98
const GRID_CELL_DEPTH = DEFAULT_SIZE * 1.45
const RAW_UMAP_WIDTH = GRID_CELL_WIDTH * 5
const RAW_UMAP_DEPTH = GRID_CELL_DEPTH * 5

function hash(value) {
  return createHash("sha256").update(value).digest("hex")
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizePoints(points) {
  const bounds = points.reduce(
    (acc, point) => {
      acc.minX = Math.min(acc.minX, point[0])
      acc.maxX = Math.max(acc.maxX, point[0])
      acc.minY = Math.min(acc.minY, point[1])
      acc.maxY = Math.max(acc.maxY, point[1])
      return acc
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    }
  )
  const width = bounds.maxX - bounds.minX || 1
  const height = bounds.maxY - bounds.minY || 1

  return points.map((point) => ({
    x: ((point[0] - bounds.minX) / width) * 2 - 1,
    y: ((point[1] - bounds.minY) / height) * 2 - 1,
  }))
}

function part1By1(value) {
  let n = value & 0x0000ffff
  n = (n | (n << 8)) & 0x00ff00ff
  n = (n | (n << 4)) & 0x0f0f0f0f
  n = (n | (n << 2)) & 0x33333333
  n = (n | (n << 1)) & 0x55555555
  return n
}

function mortonCode(x, y) {
  return (part1By1(x) | (part1By1(y) << 1)) >>> 0
}

function normalizedMortonCode(x, y) {
  const quantizedX = Math.max(0, Math.min(65535, Math.round(x * 65535)))
  const quantizedY = Math.max(0, Math.min(65535, Math.round(y * 65535)))

  return mortonCode(quantizedX, quantizedY)
}

function createGridCells(count) {
  const columns = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / columns)
  const columnOffset = (columns - 1) * 0.5
  const rowOffset = (rows - 1) * 0.5
  const cells = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        column,
        row,
        morton: normalizedMortonCode(
          columns <= 1 ? 0.5 : column / (columns - 1),
          rows <= 1 ? 0.5 : row / (rows - 1)
        ),
        x: (column - columnOffset) * GRID_CELL_WIDTH,
        z: (rowOffset - row) * GRID_CELL_DEPTH,
      })
    }
  }

  return {
    cells: cells.sort((a, b) => a.morton - b.morton),
    columns,
    rows,
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

async function main() {
  const [gallery, manifest] = await Promise.all([
    readJson(DATA_PATH),
    readJson(MANIFEST_PATH),
  ])
  const artworks = gallery.artworks ?? []

  if (artworks.length === 0) {
    throw new Error("No artworks found in gallery data.")
  }

  if ((manifest.entries ?? []).length !== artworks.length) {
    throw new Error(
      `Manifest/artwork count mismatch: ${manifest.entries?.length ?? 0} manifest entries for ${artworks.length} artworks.`
    )
  }

  console.log(`Loading ${MODEL_ID} (${MODEL_DTYPE})...`)
  const extractor = await pipeline("image-feature-extraction", MODEL_ID, {
    dtype: MODEL_DTYPE,
  })
  const embeddings = []

  for (const [index, entry] of manifest.entries.entries()) {
    const sourcePath = path.join(ROOT_DIR, entry.sourcePath)

    console.log(
      `[${String(index + 1).padStart(3, "0")}/${artworks.length}] ${artworks[index].artworkTitle}`
    )

    const output = await extractor(sourcePath, {
      normalize: true,
      pooling: "mean",
    })

    embeddings.push(Array.from(output.data))
  }

  console.log("Reducing embeddings with UMAP...")
  const umap = new UMAP({
    nComponents: 2,
    nEpochs: UMAP_EPOCHS,
    nNeighbors: UMAP_NEIGHBORS,
    minDist: UMAP_MIN_DIST,
    random: mulberry32(UMAP_SEED),
  })
  const normalized = normalizePoints(umap.fit(embeddings))
  const indexedPoints = normalized
    .map((point, index) => ({
      index,
      morton: normalizedMortonCode((point.x + 1) * 0.5, (point.y + 1) * 0.5),
      point,
    }))
    .sort((a, b) => a.morton - b.morton || a.index - b.index)
  const grid = createGridCells(artworks.length)
  const items = new Array(artworks.length)

  indexedPoints.forEach((item, orderIndex) => {
    const cell = grid.cells[orderIndex]
    const artwork = artworks[item.index]

    items[item.index] = {
      index: item.index,
      artworkTitle: artwork.artworkTitle,
      artist: artwork.artist,
      stationCode: artwork.stationCode,
      stationName: artwork.stationName,
      umap: {
        x: Number(item.point.x.toFixed(6)),
        y: Number(item.point.y.toFixed(6)),
      },
      grid: {
        column: cell.column,
        row: cell.row,
      },
      position: {
        x: Number(cell.x.toFixed(3)),
        y: DEFAULT_ALTITUDE,
        z: Number(cell.z.toFixed(3)),
      },
      umapPosition: {
        x: Number((item.point.x * RAW_UMAP_WIDTH).toFixed(3)),
        y: DEFAULT_ALTITUDE,
        z: Number((-item.point.y * RAW_UMAP_DEPTH).toFixed(3)),
      },
    }
  })

  const output = {
    sourceData: path.relative(ROOT_DIR, DATA_PATH),
    sourceScrapedAt: gallery.scrapedAt ?? null,
    sourceHash: hash(JSON.stringify(artworks)),
    textureManifest: path.relative(ROOT_DIR, MANIFEST_PATH),
    textureGeneratedAt: manifest.generatedAt ?? null,
    textureManifestHash: hash(JSON.stringify(manifest.entries)),
    model: {
      id: MODEL_ID,
      dtype: MODEL_DTYPE,
      dimensions: embeddings[0]?.length ?? 0,
    },
    reduction: {
      method: "umap-js",
      seed: UMAP_SEED,
      nComponents: 2,
      nEpochs: UMAP_EPOCHS,
      nNeighbors: UMAP_NEIGHBORS,
      minDist: UMAP_MIN_DIST,
    },
    layout: {
      defaultMethod: "morton-grid",
      altitude: DEFAULT_ALTITUDE,
      baseSize: DEFAULT_SIZE,
      snappedGrid: {
        method: "morton-grid",
        columns: grid.columns,
        rows: grid.rows,
        cellWidth: GRID_CELL_WIDTH,
        cellDepth: GRID_CELL_DEPTH,
      },
      rawUmap: {
        method: "raw-umap",
        width: RAW_UMAP_WIDTH,
        depth: RAW_UMAP_DEPTH,
      },
    },
    count: items.length,
    items,
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Wrote ${path.relative(ROOT_DIR, OUTPUT_PATH)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
