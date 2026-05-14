import { mkdir, writeFile } from "node:fs/promises"

const SOURCE_URL =
  "https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/a_better_public_transport_experience/art_in_public_transport/art_in_transit.html"
const OUTPUT_PATH = new URL("../src/data/art-in-transit-gallery.json", import.meta.url)

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

function stripTags(value) {
  return decodeEntities(
    value
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

function absoluteUrl(value) {
  if (!value) return null
  return new URL(value, SOURCE_URL).href
}

function firstMatch(value, pattern) {
  return value.match(pattern)?.[1] ?? null
}

function parseArtworkText(cardHtml) {
  const paragraphHtml = cardHtml.match(/<h5 class="mt-3">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1]
  if (!paragraphHtml) {
    return { artworkTitle: null, artist: null, description: null }
  }

  const lines = stripTags(paragraphHtml)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const artworkTitle = lines.shift() ?? null
  const artistLine = lines[0]?.match(/^by\s+(.+)$/i)
  const artist = artistLine ? artistLine[1].trim() : null
  if (artistLine) lines.shift()

  return {
    artworkTitle,
    artist,
    description: lines.join("\n\n") || null,
  }
}

function parseStation(stationLabel) {
  const [, code, name] = stationLabel.match(/^([^:]+):\s*(.+)$/) ?? []
  return {
    stationCode: code?.trim() ?? null,
    stationName: name?.trim() ?? stationLabel,
  }
}

function parseGallery(html) {
  const tabs = [...html.matchAll(/<a class="nav-link[\s\S]*?href="#([^"]+)"[\s\S]*?<h5>([\s\S]*?)<\/h5>[\s\S]*?<\/a>/g)]
  const artworks = []

  for (const [, tabId, lineHtml] of tabs) {
    const line = stripTags(lineHtml)
    const tabStart = html.indexOf(`<div id="${tabId}"`)
    if (tabStart === -1) continue

    const nextTabStart = html.indexOf('<div class="tab-yellow-new section">', tabStart + 1)
    const tabHtml = html.slice(tabStart, nextTabStart === -1 ? undefined : nextTabStart)
    const cardHtmls = tabHtml.split('<div class="gallery-card section">').slice(1)

    for (const cardHtml of cardHtmls) {
      const stationLabel = stripTags(firstMatch(cardHtml, /<h5 class="mt-3">([\s\S]*?)<\/h5>/) ?? "")
      const imagePath = firstMatch(cardHtml, /<img class="rounded" src="([^"]*)"/)
      const imageAlt = firstMatch(cardHtml, /<img class="rounded" src="[^"]*" alt="([^"]*)"/)
      const readMorePath = firstMatch(cardHtml, /<a href="([^"]+)"[^>]*>\s*(?:<b>)?Read more about this artwork\.?/i)
      const { stationCode, stationName } = parseStation(stationLabel)

      artworks.push({
        line,
        stationCode,
        stationName,
        stationLabel,
        ...parseArtworkText(cardHtml),
        imageUrl: absoluteUrl(imagePath),
        imageAlt: imageAlt ? stripTags(imageAlt) : null,
        readMoreUrl: absoluteUrl(readMorePath),
        sourceUrl: SOURCE_URL,
      })
    }
  }

  return artworks
}

const response = await fetch(SOURCE_URL)
if (!response.ok) {
  throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`)
}

const html = await response.text()
const artworks = parseGallery(html)

if (artworks.length === 0) {
  throw new Error("No gallery artworks were found. The page structure may have changed.")
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

const missingReadMore = artworks.filter((artwork) => !artwork.readMoreUrl).length
console.log(`Scraped ${artworks.length} gallery artworks into ${OUTPUT_PATH.pathname}`)
if (missingReadMore) {
  console.log(`${missingReadMore} artwork(s) did not include a read-more URL.`)
}
