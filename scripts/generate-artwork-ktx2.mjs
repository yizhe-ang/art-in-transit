import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const DATA_PATH = path.join(ROOT_DIR, "src/data/bloomberg-art-in-transit-gallery.json")
const MANIFEST_PATH = path.join(ROOT_DIR, "src/data/artwork-texture-manifest.json")
const ARTWORKS_DIR = path.join(ROOT_DIR, "public/artworks")
const ARTWORKS_CACHE_DIR = path.join(ROOT_DIR, ".cache/artworks")
const SOURCE_DIR = path.join(ARTWORKS_CACHE_DIR, "source")
const DEFAULT_OUTPUT_PATH = path.join(ARTWORKS_DIR, "artworks-256.ktx2")
const FILE_LIST_PATH = path.join(ARTWORKS_CACHE_DIR, "artworks-files.txt")
const PLACEHOLDER_PATH = path.join(SOURCE_DIR, "placeholder.ppm")
const DEFAULT_TILE_SIZE = 256
const MAX_RETRIES = 3
const REQUEST_DELAY_MS = 150

function readCliOptions(argv) {
  const options = {
    force: false,
    outputPath: DEFAULT_OUTPUT_PATH,
    tileSize: DEFAULT_TILE_SIZE,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--force") {
      options.force = true
      continue
    }

    if (arg === "--size") {
      const value = argv[index + 1]
      const tileSize = Number.parseInt(value, 10)

      if (!Number.isInteger(tileSize) || tileSize <= 0) {
        throw new Error("--size must be a positive integer")
      }

      options.tileSize = tileSize
      index += 1
      continue
    }

    if (arg === "--output") {
      const value = argv[index + 1]

      if (!value) {
        throw new Error("--output must be followed by a file path")
      }

      options.outputPath = path.resolve(ROOT_DIR, value)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

const { force, outputPath, tileSize } = readCliOptions(process.argv.slice(2))

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function extensionForUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase()

  if (pathname.endsWith(".png")) return ".png"
  if (pathname.endsWith(".jpg")) return ".jpg"
  if (pathname.endsWith(".jpeg")) return ".jpeg"

  return ".jpeg"
}

function sourceFilePath(index, url) {
  const paddedIndex = String(index).padStart(3, "0")
  return path.join(SOURCE_DIR, `${paddedIndex}-${hash(url)}${extensionForUrl(url)}`)
}

function parsePngDimensions(buffer) {
  const pngSignature = "89504e470d0a1a0a"

  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return null
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function parseJpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null
  }

  let offset = 2

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    while (buffer[offset] === 0xff) {
      offset += 1
    }

    const marker = buffer[offset]
    offset += 1

    if (marker === 0xd9 || marker === 0xda) {
      break
    }

    if (offset + 2 > buffer.length) {
      break
    }

    const segmentLength = buffer.readUInt16BE(offset)

    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      break
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xcf) &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc

    if (isStartOfFrame) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      }
    }

    offset += segmentLength
  }

  return null
}

function parsePpmDimensions(buffer) {
  if (buffer.subarray(0, 2).toString("ascii") !== "P6") {
    return null
  }

  const header = buffer.subarray(0, 128).toString("ascii")
  const tokens = header
    .replace(/#[^\n\r]*/g, "")
    .trim()
    .split(/\s+/)

  if (tokens[0] !== "P6" || tokens.length < 4) {
    return null
  }

  return {
    width: Number.parseInt(tokens[1], 10),
    height: Number.parseInt(tokens[2], 10),
  }
}

async function readImageDimensions(filePath) {
  const buffer = await readFile(filePath)
  const dimensions =
    parsePngDimensions(buffer) ??
    parseJpegDimensions(buffer) ??
    parsePpmDimensions(buffer)

  if (
    !dimensions ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    throw new Error(`Unsupported image dimensions for ${path.relative(ROOT_DIR, filePath)}`)
  }

  return dimensions
}

async function fileExists(filePath) {
  try {
    const stats = await stat(filePath)
    return stats.isFile() && stats.size > 0
  } catch {
    return false
  }
}

async function writePlaceholder() {
  const width = 8
  const height = 8
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`)
  const pixels = Buffer.alloc(width * height * 3)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (x + y) % 2 === 0 ? 42 : 74
      const offset = (y * width + x) * 3
      pixels[offset + 0] = value
      pixels[offset + 1] = value
      pixels[offset + 2] = value
    }
  }

  await writeFile(PLACEHOLDER_PATH, Buffer.concat([header, pixels]))
}

async function fetchImage(url, filePath, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "art-in-transit-asset-generator/1.0",
    },
  }).catch((error) => {
    if (attempt >= MAX_RETRIES) throw error
    return null
  })

  if (response?.ok) {
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(filePath, buffer)
    return
  }

  if (attempt >= MAX_RETRIES) {
    const status = response ? `${response.status} ${response.statusText}` : "network error"
    throw new Error(`Failed to fetch ${url}: ${status}`)
  }

  await sleep(REQUEST_DELAY_MS * attempt)
  return fetchImage(url, filePath, attempt + 1)
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const stdio = options.quiet ? ["ignore", "pipe", "pipe"] : "inherit"
    const child = spawn(command, commandArgs, {
      cwd: ROOT_DIR,
      stdio,
    })
    let output = ""

    if (options.quiet) {
      child.stdout?.on("data", (data) => {
        output += data.toString()
      })
      child.stderr?.on("data", (data) => {
        output += data.toString()
      })
    }

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output)
        return
      }

      reject(new Error(`${command} exited with code ${code}\n${output}`))
    })
  })
}

async function main() {
  const rawData = await readFile(DATA_PATH, "utf8")
  const data = JSON.parse(rawData)
  const artworks = data.artworks ?? []

  if (artworks.length === 0) {
    throw new Error(`No artworks found in ${DATA_PATH}`)
  }

  await mkdir(SOURCE_DIR, { recursive: true })
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writePlaceholder()

  const entries = []
  const layerFiles = []
  let cachedCount = 0
  let downloadedCount = 0
  let placeholderCount = 0

  for (const [index, artwork] of artworks.entries()) {
    const imageUrl = artwork.imageUrls?.[0] ?? null
    let sourcePath = PLACEHOLDER_PATH
    let status = "placeholder"
    let error = null

    if (imageUrl) {
      const candidatePath = sourceFilePath(index, imageUrl)

      try {
        if (!force && (await fileExists(candidatePath))) {
          cachedCount += 1
          status = "cached"
        } else {
          await fetchImage(imageUrl, candidatePath)
          downloadedCount += 1
          status = "downloaded"
          await sleep(REQUEST_DELAY_MS)
        }

        sourcePath = candidatePath
      } catch (fetchError) {
        placeholderCount += 1
        error = fetchError.message
        console.warn(`Layer ${index} fell back to placeholder: ${error}`)
      }
    } else {
      placeholderCount += 1
      error = "Artwork has no imageUrls[0]"
      console.warn(`Layer ${index} fell back to placeholder: ${error}`)
    }

    let dimensions = { width: 1, height: 1 }

    try {
      dimensions = await readImageDimensions(sourcePath)
    } catch (dimensionError) {
      console.warn(
        `Layer ${index} fell back to square aspect ratio: ${dimensionError.message}`
      )
    }

    const aspectRatio = dimensions.width / dimensions.height

    layerFiles.push(sourcePath)
    entries.push({
      layer: index,
      stationCode: artwork.stationCode ?? null,
      stationName: artwork.stationName ?? null,
      artworkTitle: artwork.artworkTitle ?? null,
      artist: artwork.artist ?? null,
      imageUrl,
      sourcePath: path.relative(ROOT_DIR, sourcePath),
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio,
      status,
      error,
    })
  }

  await writeFile(FILE_LIST_PATH, `${layerFiles.map((filePath) => path.relative(ROOT_DIR, filePath)).join("\n")}\n`)

  const toktxArgs = [
    "--t2",
    "--layers",
    String(artworks.length),
    "--genmipmap",
    "--assign_oetf",
    "srgb",
    "--encode",
    "uastc",
    "--uastc_rdo_l",
    "1.5",
    "--zcmp",
    "--resize",
    `${tileSize}x${tileSize}`,
    outputPath,
    `@${path.relative(ROOT_DIR, FILE_LIST_PATH)}`,
  ]

  console.log(`Encoding ${artworks.length} layers to ${path.relative(ROOT_DIR, outputPath)}`)
  await run("toktx", toktxArgs)

  console.log(`Validating ${path.relative(ROOT_DIR, outputPath)}`)
  const validationOutput = await run("basisu", ["-validate", "-file", outputPath], { quiet: true })
  const validationSummary =
    validationOutput
      .split("\n")
      .find((line) => line.includes("Success") || line.includes("Failed")) ?? "basisu validation completed"
  console.log(validationSummary)

  const publicRelativeOutputPath = path.relative(path.join(ROOT_DIR, "public"), outputPath)
  const texturePath = publicRelativeOutputPath.startsWith("..")
    ? path.relative(ROOT_DIR, outputPath)
    : `/${publicRelativeOutputPath.split(path.sep).join("/")}`

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceData: path.relative(ROOT_DIR, DATA_PATH),
    texture: {
      path: texturePath,
      width: tileSize,
      height: tileSize,
      layers: artworks.length,
      encoding: "uastc",
      mipmaps: true,
      colorSpace: "srgb",
    },
    stats: {
      cached: cachedCount,
      downloaded: downloadedCount,
      placeholders: placeholderCount,
    },
    entries,
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  const generatedFiles = await readdir(ARTWORKS_DIR)
  console.log(`Stats: ${downloadedCount} downloaded, ${cachedCount} cached, ${placeholderCount} placeholder`)
  console.log(`Wrote ${path.relative(ROOT_DIR, MANIFEST_PATH)}`)
  console.log(`Artwork asset directory now contains: ${generatedFiles.sort().join(", ")}`)
  console.log(`Artwork source cache: ${path.relative(ROOT_DIR, SOURCE_DIR)}`)

  if (placeholderCount > 0) {
    console.warn(`${placeholderCount} layer(s) used the placeholder. See manifest errors for details.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
