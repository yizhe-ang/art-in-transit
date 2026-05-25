import {
  ArrowLeft,
  ArrowRight,
  ExternalLinkIcon,
  RotateCcwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import data from "@/data/bloomberg-art-in-transit-gallery.json"
import {
  LINE_ORDER,
  getArtworkStationCode,
  getLineNameForStationCode,
} from "@/components/three/rail-routes"
import { useStore } from "@/store"
import { TransitBadge } from "@/components/ui/transit-badge"

// TODO: The image in three.js should animate to the dialog position (like a layout animation)

// TODO: Add google maps location?

// TODO: Going to next / previous image should also animate the camera to location in map

const artworkImageVariants = {
  enter: ({ direction, shouldReduceMotion }) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : direction > 0 ? 56 : -56,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: ({ direction, shouldReduceMotion }) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : direction > 0 ? -56 : 56,
  }),
}

const artworkDetailsVariants = {
  enter: ({ direction, shouldReduceMotion }) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : direction > 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: ({ direction, shouldReduceMotion }) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : direction > 0 ? -24 : 24,
  }),
}

const LOADING_OVERLAY_DELAY_MS = 180
const PRELOAD_ARTWORK_OFFSETS = [0, -1, 1, -2, 2]
const preloadedArtworkImages = new Map()

function getArtworkImageUrl(artwork) {
  return artwork?.imageUrls?.[0] ?? artwork?.thumbnailUrl
}

function preloadArtworkImages(urls) {
  if (typeof window === "undefined") {
    return
  }

  urls.forEach((url) => {
    if (!url || preloadedArtworkImages.has(url)) {
      return
    }

    const image = new window.Image()
    const preload = { image, status: "loading" }

    preloadedArtworkImages.set(url, preload)

    image.decoding = "async"
    image.onload = () => {
      preload.status = "loaded"
    }
    image.onerror = () => {
      preload.status = "error"
    }
    image.src = url

    if (typeof image.decode === "function") {
      image
        .decode()
        .then(() => {
          preload.status = "loaded"
        })
        .catch(() => {
          if (preload.status === "loading") {
            preload.status = "error"
          }
        })
    }
  })
}

const ArtworkImageViewer = ({ imageAlt, imageUrl, stopPointerPropagation }) => {
  const imageRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const [isImageLoading, setIsImageLoading] = useState(true)
  const [hasImageError, setHasImageError] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  const handleImageLoad = () => {
    setIsImageLoading(false)
    setHasImageError(false)
    setShowLoadingOverlay(false)
  }

  const handleImageError = () => {
    setIsImageLoading(false)
    setHasImageError(true)
    setShowLoadingOverlay(true)
  }

  useEffect(() => {
    if (!isImageLoading || hasImageError) {
      return
    }

    const overlayDelay = window.setTimeout(() => {
      setShowLoadingOverlay(true)
    }, LOADING_OVERLAY_DELAY_MS)

    return () => {
      window.clearTimeout(overlayDelay)
    }
  }, [hasImageError, isImageLoading, imageUrl])

  const handleViewerPointerDown = (event) => {
    const imageBounds = imageRef.current?.getBoundingClientRect()

    if (!imageBounds) {
      return
    }

    const isPointerInsideImage =
      event.clientX >= imageBounds.left &&
      event.clientX <= imageBounds.right &&
      event.clientY >= imageBounds.top &&
      event.clientY <= imageBounds.bottom

    if (isPointerInsideImage) {
      stopPointerPropagation(event)
    }
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-visible"
      onPointerDown={handleViewerPointerDown}
    >
      <TransformWrapper
        key={imageUrl}
        initialScale={1}
        minScale={1}
        maxScale={4}
        centerOnInit
        centerZoomedOut
        limitToBounds={false}
        wheel={{ step: 0.12, excluded: ["artwork-zoom-controls"] }}
        pinch={{ step: 8, excluded: ["artwork-zoom-controls"] }}
        panning={{
          velocityDisabled: true,
          excluded: ["artwork-zoom-controls"],
        }}
        doubleClick={{
          mode: "toggle",
          step: 1.6,
          excluded: ["artwork-zoom-controls"],
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div
              className="artwork-zoom-controls absolute top-3 right-3 z-10 flex gap-2"
              onPointerDown={stopPointerPropagation}
            >
              <div className="flex gap-1 rounded-lg bg-background/80 p-1 shadow-sm ring-1 ring-foreground/10 backdrop-blur">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom in"
                  onClick={() => zoomIn()}
                >
                  <ZoomInIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom out"
                  onClick={() => zoomOut()}
                >
                  <ZoomOutIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Reset zoom"
                  onClick={() => resetTransform()}
                >
                  <RotateCcwIcon />
                </Button>
              </div>

              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="Close artwork"
                    className="bg-lta-yellow shadow ring-1 ring-foreground/10 backdrop-blur hover:bg-destructive/10 hover:text-destructive hover:[&_svg]:stroke-white"
                  />
                }
              >
                <XIcon className="stroke-black stroke-6" />
              </DialogClose>
            </div>

            <AnimatePresence>
              {(showLoadingOverlay || hasImageError) && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/55 backdrop-blur-[1px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.06, ease: "linear" }
                      : { duration: 0.16, ease: "easeOut" }
                  }
                >
                  <div className="flex min-w-56 items-center justify-center gap-4 rounded-lg bg-background px-5 py-4 text-base font-medium text-foreground shadow-xl ring-1 ring-white/30">
                    {isImageLoading ? (
                      <>
                        <span
                          className="size-7 animate-spin rounded-full border-3 border-foreground/20 border-t-lta-yellow"
                          aria-hidden="true"
                        />
                        <span role="status" aria-live="polite">
                          Loading artwork image
                        </span>
                      </>
                    ) : (
                      <span role="status" aria-live="polite">
                        Artwork image could not be loaded
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <TransformComponent
              wrapperClass="size-full cursor-grab active:cursor-grabbing"
              wrapperStyle={{
                overflow: "visible",
              }}
              contentClass="flex size-full items-center justify-center"
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt={imageAlt}
                className={`max-h-full max-w-full touch-none object-contain transition-opacity duration-300 select-none ${
                  isImageLoading || hasImageError ? "opacity-0" : "opacity-100"
                }`}
                draggable={false}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}

function getArtworkKey(artwork) {
  return artwork?.itemUrl ?? artwork?.sourceTitle ?? artwork?.artworkTitle
}

function getArtworkIndex(artworkSequence, artwork) {
  const artworkKey = getArtworkKey(artwork)

  if (!artworkKey) {
    return -1
  }

  return artworkSequence.findIndex((sequenceArtwork) => {
    return getArtworkKey(sequenceArtwork) === artworkKey
  })
}

function normalizeArtworkStation(artwork) {
  if (!artwork) {
    return null
  }

  return {
    ...artwork,
    stationCode: artwork.stationCode ?? getArtworkStationCode(artwork),
    stationName: artwork.stationName,
  }
}

function getArtworkLineName(artwork) {
  return getLineNameForStationCode(getArtworkStationCode(artwork))
}

function getArtworkYear(artwork) {
  return (
    artwork?.year ?? artwork?.description?.match(/\bYear:\s*(\d{4})\b/)?.[1]
  )
}

function getStationCodeParts(artwork) {
  const stationCode = getArtworkStationCode(artwork)
  const match = stationCode?.match(/^([A-Z]+)(\d+)([A-Z]?)$/)

  if (!match) {
    return null
  }

  return {
    prefix: match[1],
    number: Number(match[2]),
    suffix: match[3],
  }
}

const STATION_PREFIX_NAVIGATION_ORDER = {
  CE: 0,
  CC: 1,
}

function getStationPrefixNavigationOrder(prefix) {
  return STATION_PREFIX_NAVIGATION_ORDER[prefix] ?? Number.MAX_SAFE_INTEGER
}

function compareArtworkStationCodes(a, b) {
  const aParts = getStationCodeParts(a)
  const bParts = getStationCodeParts(b)

  if (!aParts || !bParts) {
    return aParts ? -1 : bParts ? 1 : 0
  }

  if (aParts.prefix !== bParts.prefix) {
    const prefixOrderDifference =
      getStationPrefixNavigationOrder(aParts.prefix) -
      getStationPrefixNavigationOrder(bParts.prefix)

    if (prefixOrderDifference !== 0) {
      return prefixOrderDifference
    }

    return aParts.prefix.localeCompare(bParts.prefix)
  }

  if (aParts.number !== bParts.number) {
    return aParts.number - bParts.number
  }

  return aParts.suffix.localeCompare(bParts.suffix)
}

function getLineArtworkSequence() {
  const artworksByLine = LINE_ORDER.reduce((groups, lineName) => {
    groups.set(lineName, [])
    return groups
  }, new Map())

  data.artworks.forEach((artwork) => {
    const lineName = getArtworkLineName(artwork)
    const lineArtworks = artworksByLine.get(lineName)

    if (lineArtworks) {
      lineArtworks.push(normalizeArtworkStation(artwork))
    }
  })

  return LINE_ORDER.flatMap((lineName) => {
    return [...(artworksByLine.get(lineName) ?? [])].sort(
      compareArtworkStationCodes
    )
  })
}

const ArtworkDialog = () => {
  const openArtworkDialog = useStore((state) => state.openArtworkDialog)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const storedSelectedArtwork = useStore((state) => state.selectedArtwork)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)
  const requestArtworkCameraFocus = useStore(
    (state) => state.requestArtworkCameraFocus
  )
  const clearArtworkCameraFocusRequest = useStore(
    (state) => state.clearArtworkCameraFocusRequest
  )
  const shouldReduceMotion = useReducedMotion()
  const [navigationDirection, setNavigationDirection] = useState(1)
  const [displayedArtwork, setDisplayedArtwork] = useState(null)
  const artworkSequence = useMemo(() => getLineArtworkSequence(), [])
  const selectedArtwork = normalizeArtworkStation(storedSelectedArtwork)
  const visibleArtwork = normalizeArtworkStation(
    selectedArtwork ?? displayedArtwork
  )

  const selectedArtworkKey = getArtworkKey(visibleArtwork)
  const imageUrl = getArtworkImageUrl(visibleArtwork)
  const visibleArtworkIndex = getArtworkIndex(artworkSequence, visibleArtwork)
  const title = visibleArtwork?.artworkTitle
  const artist = visibleArtwork?.artist
  const year = getArtworkYear(visibleArtwork)
  const stationCode = visibleArtwork?.stationCode
  const stationName = visibleArtwork?.stationName
  const readMoreUrl = visibleArtwork?.itemUrl
  const credits = visibleArtwork?.credits

  useEffect(() => {
    if (
      !openArtworkDialog ||
      !imageUrl ||
      visibleArtworkIndex === -1 ||
      artworkSequence.length === 0
    ) {
      return
    }

    const preloadUrls = PRELOAD_ARTWORK_OFFSETS.map((offset) => {
      const artworkIndex =
        (visibleArtworkIndex + offset + artworkSequence.length) %
        artworkSequence.length

      return getArtworkImageUrl(artworkSequence[artworkIndex])
    }).filter(Boolean)

    preloadArtworkImages([...new Set(preloadUrls)])
  }, [artworkSequence, imageUrl, openArtworkDialog, visibleArtworkIndex])

  const handleOpenChange = (open) => {
    setOpenArtworkDialog(open)

    if (!open) {
      setDisplayedArtwork(visibleArtwork)
      setSelectedArtwork(null)
      clearArtworkCameraFocusRequest()
    }
  }

  const handleBackgroundPointerDown = () => {
    handleOpenChange(false)
  }

  const handleDialogAnimationEnd = () => {
    if (!openArtworkDialog) {
      setDisplayedArtwork(null)
    }
  }

  const stopPointerPropagation = (event) => {
    event.stopPropagation()
  }

  const handleNavigateArtwork = (direction) => {
    if (!selectedArtwork || artworkSequence.length === 0) {
      return
    }

    const selectedIndex = getArtworkIndex(artworkSequence, selectedArtwork)
    const currentIndex = selectedIndex === -1 ? 0 : selectedIndex
    const nextIndex =
      (currentIndex + direction + artworkSequence.length) %
      artworkSequence.length
    const nextArtwork = artworkSequence[nextIndex]

    setNavigationDirection(direction)
    setSelectedArtwork(nextArtwork)
    requestArtworkCameraFocus(nextArtwork)
  }

  const handlePreviousArtworkPointerDown = (event) => {
    stopPointerPropagation(event)
    handleNavigateArtwork(-1)
  }

  const handleNextArtworkPointerDown = (event) => {
    stopPointerPropagation(event)
    handleNavigateArtwork(1)
  }

  const animationCustom = {
    direction: navigationDirection,
    shouldReduceMotion,
  }
  const imageTransition = shouldReduceMotion
    ? { duration: 0.12, ease: "easeOut" }
    : { type: "spring", visualDuration: 0.34, bounce: 0.18 }
  const detailsTransition = shouldReduceMotion
    ? { duration: 0.12, ease: "easeOut" }
    : { type: "spring", visualDuration: 0.3, bounce: 0.12, delay: 0.04 }

  return (
    <Dialog open={openArtworkDialog} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-visible rounded-lg bg-transparent p-0 sm:max-w-[calc(100vw-2rem)]"
        onAnimationEnd={handleDialogAnimationEnd}
      >
        {visibleArtwork && (
          <div
            className="flex min-h-0 flex-1 flex-col"
            onPointerDown={handleBackgroundPointerDown}
          >
            {imageUrl && (
              <div className="relative flex min-h-0 flex-1 overflow-visible">
                <AnimatePresence
                  custom={animationCustom}
                  initial={false}
                  mode="popLayout"
                >
                  <motion.div
                    key={selectedArtworkKey}
                    custom={animationCustom}
                    variants={artworkImageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={imageTransition}
                    className="absolute inset-0 flex min-h-0"
                    style={{ willChange: "transform, opacity" }}
                  >
                    <ArtworkImageViewer
                      key={imageUrl}
                      imageAlt={visibleArtwork.imageAlt ?? title ?? "Artwork"}
                      imageUrl={imageUrl}
                      stopPointerPropagation={stopPointerPropagation}
                    />
                  </motion.div>
                </AnimatePresence>

                {artworkSequence.length > 1 && (
                  <div
                    className="pointer-events-none absolute inset-x-3 inset-y-0 z-10 sm:inset-x-5"
                    aria-label="Artwork navigation"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-lg"
                      aria-label="Previous artwork"
                      className="pointer-events-auto absolute top-1/2 left-0 size-12 -translate-y-1/2 rounded-full bg-background/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur active:!translate-y-[calc(-50%+0.5px)]"
                      onPointerDown={handlePreviousArtworkPointerDown}
                    >
                      <ArrowLeft className="size-7 stroke-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-lg"
                      aria-label="Next artwork"
                      className="pointer-events-auto absolute top-1/2 right-0 size-12 -translate-y-1/2 rounded-full bg-background/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur active:!translate-y-[calc(-50%+0.5px)]"
                      onPointerDown={handleNextArtworkPointerDown}
                    >
                      <ArrowRight className="size-7 stroke-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex shrink-0 justify-center overflow-hidden">
              <AnimatePresence
                custom={animationCustom}
                initial={false}
                mode="popLayout"
              >
                <motion.div
                  key={selectedArtworkKey}
                  custom={animationCustom}
                  variants={artworkDetailsVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={detailsTransition}
                  className="grid w-[min(calc(100vw-2rem),32rem)] max-w-[calc(100vw-2rem)] gap-5 rounded bg-muted px-7 py-3"
                  style={{ willChange: "transform, opacity" }}
                  onPointerDown={stopPointerPropagation}
                >
                  <div className="grid gap-1 pr-0">
                    {/* {station && (
                      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                        {station}
                      </p>
                    )} */}
                    <div className="flex items-center gap-2 justify-self-center">
                      <TransitBadge stationCode={stationCode} size="sm" />
                      <div className="text-muted-foreground">{stationName}</div>
                    </div>

                    <DialogTitle className="mt-1 text-xl leading-tight">
                      {title}
                    </DialogTitle>

                    {artist && (
                      <p className="text-base text-muted-foreground">
                        {artist}
                      </p>
                    )}

                    {year && (
                      <p className="text-base text-muted-foreground">{year}</p>
                    )}

                    {credits && (
                      <p className="text-right text-xs whitespace-pre-line text-muted-foreground">
                        {credits}
                      </p>
                    )}
                  </div>

                  {/* <div className="grid gap-3 text-sm">
                    {artist && (
                      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                        <span className="text-muted-foreground">Artist</span>
                        <span>{artist}</span>
                      </div>
                    )}

                    {station && (
                      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                        <span className="text-muted-foreground">Station</span>
                        <span>{station}</span>
                      </div>
                    )}
                  </div> */}

                  {readMoreUrl && (
                    <a
                      href={readMoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        className:
                          "-mt-3 w-fit justify-self-end bg-lta-yellow!",
                      })}
                    >
                      Read more
                      <ExternalLinkIcon data-icon="inline-end" />
                    </a>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkDialog
