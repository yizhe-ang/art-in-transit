import { mkdir, writeFile } from "node:fs/promises"

const SOURCE_URL = "https://guides.bloombergconnects.org/en-US/guide/artInTransit/text-map"
const OUTPUT_PATH = new URL("../src/data/bloomberg-art-in-transit-gallery.json", import.meta.url)
const REQUEST_DELAY_MS = 150
const MAX_RETRIES = 3

const namedEntities = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "-",
  mdash: "-",
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const base = entity[1]?.toLowerCase() === "x" ? 16 : 10
      const codePoint = Number.parseInt(entity.slice(base === 16 ? 2 : 1), base)
      return Number.isNaN(codePoint) ? `&${entity};` : String.fromCodePoint(codePoint)
    }

    return namedEntities[entity.toLowerCase()] ?? `&${entity};`
  })
}

function decodeJsString(value) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`)
  } catch {
    return value
  }
}

function stripTags(value) {
  return decodeEntities(
    value
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/\\u0026/gi, "&")
      .replace(/\\"/g, '"')
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  )
}

function firstMatch(value, pattern) {
  return value.match(pattern)?.[1] ?? null
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function absoluteUrl(value, baseUrl = SOURCE_URL) {
  if (!value) return null
  return new URL(value, baseUrl).href
}

function mapUrlForItem(itemUrl) {
  return `${itemUrl.replace(/\/$/, "")}/map`
}

function parseStation(stationLabel) {
  const normalized = stationLabel.replace(/\s+/g, " ").trim()
  const [, code, name] = normalized.match(/^([A-Z]{1,3}\d+[A-Z]?)\s+(.+)$/) ?? []

  return {
    stationCode: code ?? null,
    stationName: name ?? normalized,
    stationLabel: normalized,
  }
}

async function fetchHtml(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "art-in-transit-scraper/1.0",
    },
  }).catch((error) => {
    if (attempt >= MAX_RETRIES) throw error
    return null
  })

  if (response?.ok) {
    return response.text()
  }

  if (attempt >= MAX_RETRIES) {
    const status = response ? `${response.status} ${response.statusText}` : "network error"
    throw new Error(`Failed to fetch ${url}: ${status}`)
  }

  await sleep(REQUEST_DELAY_MS * attempt)
  return fetchHtml(url, attempt + 1)
}

function parseMapLocationUrls(html) {
  const urls = []

  for (const [, href] of html.matchAll(/href="([^"]*text-map\/mapLocation\/[^"]+)"/g)) {
    urls.push(absoluteUrl(href))
  }

  for (const [, href] of html.matchAll(/\\"href\\":\\"([^"]*text-map\/mapLocation\/[^"\\]+)\\"/g)) {
    urls.push(absoluteUrl(decodeJsString(href)))
  }

  return unique(urls)
}

function parseArtworkCandidates(html, mapLocationUrl) {
  const candidates = []
  const seenItemUrls = new Set()
  const anchorPattern = /<a\b[^>]*href="([^"]*\/guide\/artInTransit\/item\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g

  for (const [, href, anchorHtml] of html.matchAll(anchorPattern)) {
    const itemUrl = absoluteUrl(href, mapLocationUrl)
    if (seenItemUrls.has(itemUrl)) continue
    seenItemUrls.add(itemUrl)

    const artworkTitle = stripTags(firstMatch(anchorHtml, /<h3\b[^>]*>([\s\S]*?)<\/h3>/) ?? "")
    const stationLabel = stripTags(firstMatch(anchorHtml, /<section\b[^>]*>([\s\S]*?)<\/section>/) ?? "")
    const thumbnailUrl = absoluteUrl(firstMatch(anchorHtml, /<img\b[^>]*src="([^"]+)"/), mapLocationUrl)
    const station = parseStation(stationLabel)

    candidates.push({
      stationCode: station.stationCode,
      stationName: station.stationName,
      stationLabel: station.stationLabel,
      artworkTitle,
      itemUrl,
      mapLocationUrl,
      thumbnailUrl,
    })
  }

  return candidates
}

function parseSourceTitle(html) {
  return stripTags(firstMatch(html, /<title>([\s\S]*?)<\/title>/i) ?? "")
}

function parseArticle(html) {
  return firstMatch(html, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ?? ""
}

function parseArtist(articleHtml, stationLabel) {
  const sections = [...articleHtml.matchAll(/<section\b[^>]*class="[^"]*text-md[^"]*"[^>]*>([\s\S]*?)<\/section>/g)]
    .map(([, sectionHtml]) => stripTags(sectionHtml))
    .filter(Boolean)

  return sections.find((section) => section !== stationLabel) ?? null
}

function parseDescription(articleHtml) {
  const descriptionHtml = firstMatch(
    articleHtml,
    /<h4\b[^>]*>\s*DESCRIPTION\s*<\/h4>[\s\S]*?<div\b[^>]*class="[^"]*text-md[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i,
  )

  return descriptionHtml ? stripTags(descriptionHtml) : null
}

function parseImageUrls(html) {
  return unique(
    [...html.matchAll(/<img\b[^>]*src="(https:\/\/assets\.bloombergconnects\.org\/assets\/[^"]+)"/g)].map(([, src]) => src),
  )
}

function parseCaptions(html) {
  const captions = []

  for (const [, encodedHtml] of html.matchAll(/__html\\":\\"([\s\S]*?)\\"\}\}/g)) {
    const caption = stripTags(encodedHtml)
    if (caption && /photo|courtesy|work in progress|prototype|at work|participants/i.test(caption)) {
      captions.push(caption)
    }
  }

  return unique(captions)
}

function parseMapCoordinates(html) {
  const normalizedHtml = decodeEntities(html).replace(/[\\]+"/g, '"')
  const [, latitude, longitude] =
    normalizedHtml.match(
      /"mapMarkers"\s*:\s*\[\s*\{[\s\S]*?"position"\s*:\s*\{\s*"lat"\s*:\s*(-?\d+(?:\.\d+)?),\s*"lng"\s*:\s*(-?\d+(?:\.\d+)?)/,
    ) ?? []

  const parsedLatitude = Number.parseFloat(latitude)
  const parsedLongitude = Number.parseFloat(longitude)

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return {
      latitude: null,
      longitude: null,
    }
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  }
}

async function enrichArtwork(candidate) {
  await sleep(REQUEST_DELAY_MS)
  const html = await fetchHtml(candidate.itemUrl)
  const articleHtml = parseArticle(html)
  const mapUrl = mapUrlForItem(candidate.itemUrl)

  await sleep(REQUEST_DELAY_MS)
  const mapHtml = await fetchHtml(mapUrl)
  const coordinates = parseMapCoordinates(mapHtml)

  return {
    ...candidate,
    mapUrl,
    ...coordinates,
    artist: parseArtist(articleHtml, candidate.stationLabel),
    description: parseDescription(articleHtml),
    imageUrls: parseImageUrls(html),
    captions: parseCaptions(html),
    sourceTitle: parseSourceTitle(html),
  }
}

const indexHtml = await fetchHtml(SOURCE_URL)
const mapLocationUrls = parseMapLocationUrls(indexHtml)

if (mapLocationUrls.length === 0) {
  throw new Error("No map-location URLs were found. The page structure may have changed.")
}

const candidates = []
const seenItemUrls = new Set()

for (const candidate of parseArtworkCandidates(indexHtml, SOURCE_URL)) {
  if (seenItemUrls.has(candidate.itemUrl)) continue
  seenItemUrls.add(candidate.itemUrl)
  candidates.push(candidate)
}

for (const mapLocationUrl of mapLocationUrls) {
  await sleep(REQUEST_DELAY_MS)
  const html = await fetchHtml(mapLocationUrl)

  for (const candidate of parseArtworkCandidates(html, mapLocationUrl)) {
    if (seenItemUrls.has(candidate.itemUrl)) continue
    seenItemUrls.add(candidate.itemUrl)
    candidates.push(candidate)
  }
}

if (candidates.length === 0) {
  throw new Error("No artwork item URLs were found. The page structure may have changed.")
}

const artworks = []
for (const candidate of candidates) {
  artworks.push(await enrichArtwork(candidate))
  console.log(`Scraped ${artworks.length}/${candidates.length}: ${candidate.artworkTitle}`)
}

const missingDescriptions = artworks.filter((artwork) => !artwork.description).length
if (missingDescriptions > 0) {
  throw new Error(`${missingDescriptions} artwork(s) were missing descriptions.`)
}

const missingCoordinates = artworks.filter(
  (artwork) => !Number.isFinite(artwork.latitude) || !Number.isFinite(artwork.longitude),
)
if (missingCoordinates.length > 0) {
  const missingCoordinateList = missingCoordinates
    .map((artwork) => `- ${artwork.artworkTitle}: ${artwork.mapUrl}`)
    .join("\n")

  throw new Error(`${missingCoordinates.length} artwork(s) were missing coordinates:\n${missingCoordinateList}`)
}

await mkdir(new URL(".", OUTPUT_PATH), { recursive: true })
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      sourceUrl: SOURCE_URL,
      scrapedAt: new Date().toISOString(),
      count: artworks.length,
      artworks,
    },
    null,
    2,
  )}\n`,
)

console.log(`Scraped ${artworks.length} Bloomberg artwork rows into ${OUTPUT_PATH.pathname}`)
