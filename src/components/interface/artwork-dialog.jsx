import {
  ExternalLinkIcon,
  RotateCcwIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { useRef } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useStore } from "@/store"

// TODO: Include photo credits too? To give proper credits to people involved.

// TODO: The image in three.js should animate to the dialog position (like a layout animation)

const ArtworkImageViewer = ({
  imageAlt,
  imageUrl,
  stopPointerPropagation,
}) => {
  const imageRef = useRef(null)

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
              className="artwork-zoom-controls absolute top-3 right-3 z-10 flex gap-1 rounded-lg bg-background/80 p-1 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
              onPointerDown={stopPointerPropagation}
            >
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
                className="max-h-full max-w-full touch-none object-contain select-none"
                draggable={false}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}

const ArtworkDialog = () => {
  const openArtworkDialog = useStore((state) => state.openArtworkDialog)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)
  const selectedArtwork = useStore((state) => state.selectedArtwork)
  const setSelectedArtwork = useStore((state) => state.setSelectedArtwork)

  const imageUrl =
    selectedArtwork?.imageUrls?.[0] ?? selectedArtwork?.thumbnailUrl
  const title = selectedArtwork?.artworkTitle
  const artist = selectedArtwork?.artist
  const station =
    selectedArtwork?.stationLabel ?? selectedArtwork?.stationName
  const readMoreUrl = selectedArtwork?.itemUrl

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

  return (
    <Dialog open={openArtworkDialog} onOpenChange={handleOpenChange}>
      <DialogContent className="h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-visible rounded-lg p-0 sm:max-w-[calc(100vw-2rem)] bg-transparent">
        {selectedArtwork && (
          <div
            className="flex min-h-0 flex-1 flex-col"
            onPointerDown={handleBackgroundPointerDown}
          >
            {imageUrl && (
              <ArtworkImageViewer
                key={imageUrl}
                imageAlt={selectedArtwork.imageAlt ?? title ?? "Artwork"}
                imageUrl={imageUrl}
                stopPointerPropagation={stopPointerPropagation}
              />
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
