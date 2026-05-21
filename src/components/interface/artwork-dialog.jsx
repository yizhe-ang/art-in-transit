import {
  ArrowLeft,
  ArrowRight,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useMemo, useRef, useState } from "react"
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

const ArtworkImageViewer = ({ imageAlt, imageUrl, stopPointerPropagation }) => {
  const imageRef = useRef(null)
  const [isImageLoading, setIsImageLoading] = useState(true)
  const [hasImageError, setHasImageError] = useState(false)

  const handleImageLoad = () => {
    setIsImageLoading(false)
    setHasImageError(false)
  }

  const handleImageError = () => {
    setIsImageLoading(false)
    setHasImageError(true)
  }

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
                    className="bg-lta-yellow shadow ring-1 ring-foreground/10 backdrop-blur hover:bg-destructive/10 hover:text-destructive"
                  />
                }
              >
                <XIcon className="stroke-black stroke-6" />
              </DialogClose>
            </div>

            {(isImageLoading || hasImageError) && (
              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-lg bg-background/85 px-4 py-3 text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur">
                  {isImageLoading ? (
                    <>
                      <span
                        className="size-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground"
                        aria-hidden="true"
                      />
                      <span role="status" aria-live="polite">
                        Loading artwork
                      </span>
                    </>
                  ) : (
                    <span role="status" aria-live="polite">
                      Artwork image could not be loaded
                    </span>
                  )}
                </div>
              </div>
            )}

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

  return LINE_ORDER.flatMap((lineName) => artworksByLine.get(lineName) ?? [])
}

const ArtworkDialog = () => {
  const openArtworkDialog = useStore((state) => state.openArtworkDialog)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const storedSelectedArtwork = useStore((state) => state.selectedArtwork)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)
  const shouldReduceMotion = useReducedMotion()
  const [navigationDirection, setNavigationDirection] = useState(1)
  const artworkSequence = useMemo(() => getLineArtworkSequence(), [])
  const selectedArtwork = normalizeArtworkStation(storedSelectedArtwork)

  const selectedArtworkKey = getArtworkKey(selectedArtwork)
  const imageUrl =
    selectedArtwork?.imageUrls?.[0] ?? selectedArtwork?.thumbnailUrl
  const title = selectedArtwork?.artworkTitle
  const artist = selectedArtwork?.artist
  const stationCode = selectedArtwork?.stationCode
  const stationName = selectedArtwork?.stationName
  const readMoreUrl = selectedArtwork?.itemUrl
  const credits = selectedArtwork?.credits

  const handleOpenChange = (open) => {
    setOpenArtworkDialog(open)

    if (!open) {
      setSelectedArtwork(null)
    }
  }

  const handleBackgroundPointerDown = () => {
    handleOpenChange(false)
  }

  const stopPointerPropagation = (event) => {
    event.stopPropagation()
  }

  const handleNavigateArtwork = (direction) => {
    if (!selectedArtwork || artworkSequence.length === 0) {
      return
    }

    const selectedArtworkKey = getArtworkKey(selectedArtwork)
    const selectedIndex = artworkSequence.findIndex((artwork) => {
      return getArtworkKey(artwork) === selectedArtworkKey
    })
    const currentIndex = selectedIndex === -1 ? 0 : selectedIndex
    const nextIndex =
      (currentIndex + direction + artworkSequence.length) %
      artworkSequence.length

    setNavigationDirection(direction)
    setSelectedArtwork(artworkSequence[nextIndex])
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
      >
        {selectedArtwork && (
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
                      imageAlt={selectedArtwork.imageAlt ?? title ?? "Artwork"}
                      imageUrl={imageUrl}
                      stopPointerPropagation={stopPointerPropagation}
                    />
                  </motion.div>
                </AnimatePresence>

                {artworkSequence.length > 1 && (
                  <div
                    className="pointer-events-none absolute inset-x-3 top-1/2 z-10 flex -translate-y-1/2 justify-between sm:inset-x-5"
                    aria-label="Artwork navigation"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Previous artwork"
                      className="pointer-events-auto size-12 rounded-full bg-background/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
                      onPointerDown={handlePreviousArtworkPointerDown}
                    >
                      <ArrowLeft className="size-7 stroke-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Next artwork"
                      className="pointer-events-auto size-12 rounded-full bg-background/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
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
                <div
                  key={selectedArtworkKey}
                  custom={animationCustom}
                  variants={artworkDetailsVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={detailsTransition}
                  className="grid w-fit max-w-[calc(100vw-2rem)] gap-5 rounded bg-muted px-5 py-3"
                  style={{ willChange: "transform, opacity" }}
                  onPointerDown={stopPointerPropagation}
                >
                  <div className="grid gap-1 pr-8">
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

                    {credits && (
                      <p className="text-sm whitespace-pre-line text-muted-foreground">
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
                        className: "w-fit justify-self-end bg-lta-yellow!",
                      })}
                    >
                      Read more
                      <ExternalLinkIcon data-icon="inline-end" />
                    </a>
                  )}
                </div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkDialog
