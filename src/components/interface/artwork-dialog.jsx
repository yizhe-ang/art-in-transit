import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
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
import manifest from "@/data/artwork-texture-manifest.json"
import { useStore } from "@/store"

// TODO: Include photo credits too? To give proper credits to people involved.

// TODO: The image in three.js should animate to the dialog position (like a layout animation)

function getContainedImageRect(containerRect, aspectRatio) {
  const containerAspectRatio = containerRect.width / containerRect.height

  if (containerAspectRatio > aspectRatio) {
    const width = containerRect.height * aspectRatio

    return {
      left: containerRect.left + (containerRect.width - width) / 2,
      top: containerRect.top,
      width,
      height: containerRect.height,
    }
  }

  const height = containerRect.width / aspectRatio

  return {
    left: containerRect.left,
    top: containerRect.top + (containerRect.height - height) / 2,
    width: containerRect.width,
    height,
  }
}

function isArtworkTransitionActive(transition) {
  return (
    transition?.phase === "measuring" ||
    transition?.phase === "animating" ||
    transition?.phase === "holding"
  )
}

function areRectsEqual(rectA, rectB, tolerance = 0.5) {
  if (rectA === rectB) return true
  if (!rectA || !rectB) return false

  return (
    Math.abs(rectA.left - rectB.left) <= tolerance &&
    Math.abs(rectA.top - rectB.top) <= tolerance &&
    Math.abs(rectA.width - rectB.width) <= tolerance &&
    Math.abs(rectA.height - rectB.height) <= tolerance
  )
}

const ArtworkImageViewer = ({
  hideImage,
  imageAlt,
  imageUrl,
  onImageLoad,
  onTransitionTargetRect,
  stopPointerPropagation,
  transitionAspectRatio,
  transitionActive,
}) => {
  const imageRef = useRef(null)
  const viewerRef = useRef(null)
  const reportedLoadedUrlRef = useRef(null)

  const reportImageLoad = useCallback(() => {
    if (reportedLoadedUrlRef.current === imageUrl) {
      return
    }

    reportedLoadedUrlRef.current = imageUrl
    onImageLoad()
  }, [imageUrl, onImageLoad])

  const measureTransitionTarget = useCallback(() => {
    const viewerBounds = viewerRef.current?.getBoundingClientRect()

    if (!viewerBounds || viewerBounds.width === 0 || viewerBounds.height === 0) {
      return
    }

    onTransitionTargetRect(
      getContainedImageRect(viewerBounds, transitionAspectRatio)
    )
  }, [onTransitionTargetRect, transitionAspectRatio])

  useLayoutEffect(() => {
    if (!transitionActive) {
      return
    }

    const frame = requestAnimationFrame(measureTransitionTarget)
    const resizeObserver = new ResizeObserver(measureTransitionTarget)

    if (viewerRef.current) {
      resizeObserver.observe(viewerRef.current)
    }

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  }, [measureTransitionTarget, transitionActive])

  useEffect(() => {
    if (imageRef.current?.complete) {
      reportImageLoad()
    }
  }, [imageUrl, reportImageLoad])

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
      ref={viewerRef}
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
                    className="bg-background/90 shadow-sm ring-1 ring-foreground/10 backdrop-blur hover:bg-destructive/10 hover:text-destructive"
                  />
                }
              >
                <XIcon />
              </DialogClose>
            </div>

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
                className="max-h-full max-w-full touch-none object-contain select-none transition-opacity duration-150"
                style={{ opacity: hideImage ? 0 : 1 }}
                draggable={false}
                onLoad={reportImageLoad}
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
      lineArtworks.push(artwork)
    }
  })

  return LINE_ORDER.flatMap((lineName) => artworksByLine.get(lineName) ?? [])
}

const ArtworkDialog = () => {
  const openArtworkDialog = useStore((state) => state.openArtworkDialog)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const selectedArtwork = useStore((state) => state.selectedArtwork)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)
  const artworkImageTransition = useStore(
    (state) => state.artworkImageTransition
  )
  const updateArtworkImageTransition = useStore(
    (state) => state.updateArtworkImageTransition
  )
  const clearArtworkImageTransition = useStore(
    (state) => state.clearArtworkImageTransition
  )
  const artworkSequence = useMemo(() => getLineArtworkSequence(), [])

  const imageUrl =
    selectedArtwork?.imageUrls?.[0] ?? selectedArtwork?.thumbnailUrl
  const title = selectedArtwork?.artworkTitle
  const artist = selectedArtwork?.artist
  const station = selectedArtwork?.stationLabel ?? selectedArtwork?.stationName
  const readMoreUrl = selectedArtwork?.itemUrl
  const selectedArtworkKey = getArtworkKey(selectedArtwork)
  const transitionArtworkKey = getArtworkKey(artworkImageTransition?.artwork)
  const transitionMatchesSelectedArtwork =
    selectedArtworkKey && selectedArtworkKey === transitionArtworkKey
  const transitionActiveForSelectedArtwork =
    transitionMatchesSelectedArtwork &&
    isArtworkTransitionActive(artworkImageTransition)
  const transitionImageLoaded = artworkImageTransition?.imageLoaded ?? false
  const transitionPhase = artworkImageTransition?.phase
  const transitionToRect = artworkImageTransition?.toRect
  const transitionAspectRatio =
    manifest.entries[artworkImageTransition?.artworkId]?.aspectRatio ?? 1

  const handleOpenChange = (open) => {
    setOpenArtworkDialog(open)

    if (!open) {
      clearArtworkImageTransition()
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

    setSelectedArtwork(artworkSequence[nextIndex])
    clearArtworkImageTransition()
  }

  const handleTransitionTargetRect = useCallback(
    (toRect) => {
      if (
        !transitionMatchesSelectedArtwork ||
        !isArtworkTransitionActive({ phase: transitionPhase })
      ) {
        return
      }

      if (areRectsEqual(transitionToRect, toRect)) {
        return
      }

      updateArtworkImageTransition({ toRect })
    },
    [
      transitionPhase,
      transitionMatchesSelectedArtwork,
      transitionToRect,
      updateArtworkImageTransition,
    ]
  )

  const handleImageLoad = useCallback(() => {
    if (
      !transitionMatchesSelectedArtwork ||
      !transitionPhase ||
      transitionImageLoaded
    ) {
      return
    }

    updateArtworkImageTransition({ imageLoaded: true })
  }, [
    transitionPhase,
    transitionImageLoaded,
    transitionMatchesSelectedArtwork,
    updateArtworkImageTransition,
  ])

  const handlePreviousArtworkPointerDown = (event) => {
    stopPointerPropagation(event)
    handleNavigateArtwork(-1)
  }

  const handleNextArtworkPointerDown = (event) => {
    stopPointerPropagation(event)
    handleNavigateArtwork(1)
  }

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
              <div className="relative flex min-h-0 flex-1">
                <ArtworkImageViewer
                  key={imageUrl}
                  hideImage={transitionActiveForSelectedArtwork}
                  imageAlt={selectedArtwork.imageAlt ?? title ?? "Artwork"}
                  imageUrl={imageUrl}
                  onImageLoad={handleImageLoad}
                  onTransitionTargetRect={handleTransitionTargetRect}
                  stopPointerPropagation={stopPointerPropagation}
                  transitionActive={transitionActiveForSelectedArtwork}
                  transitionAspectRatio={transitionAspectRatio}
                />

                {artworkSequence.length > 1 && (
                  <div
                    className="pointer-events-none absolute inset-x-3 top-1/2 z-10 flex -translate-y-1/2 justify-between sm:inset-x-5"
                    aria-label="Artwork navigation"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Previous artwork"
                      className="pointer-events-auto rounded-full bg-background/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
                      onPointerDown={handlePreviousArtworkPointerDown}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Next artwork"
                      className="pointer-events-auto rounded-full bg-background/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
                      onPointerDown={handleNextArtworkPointerDown}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex shrink-0 justify-center">
              <div
                className="grid w-fit max-w-[calc(100vw-2rem)] gap-5 bg-muted p-5"
                onPointerDown={stopPointerPropagation}
              >
                <div className="grid gap-2 pr-8">
                  {station && (
                    <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {station}
                    </p>
                  )}

                  <DialogTitle className="text-xl leading-tight">
                    {title}
                  </DialogTitle>

                  {artist && (
                    <p className="text-sm text-muted-foreground">{artist}</p>
                  )}
                </div>

                <div className="grid gap-3 text-sm">
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
                </div>

                {readMoreUrl && (
                  <a
                    href={readMoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      className: "w-fit",
                    })}
                  >
                    Read more
                    <ExternalLinkIcon data-icon="inline-end" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkDialog
