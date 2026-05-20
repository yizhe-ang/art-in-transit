import { ExternalLinkIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useStore } from "@/store"

// TODO: Include photo credits too? To give proper credits to people involved.

// TODO: The image in three.js should animate to the dialog position (like a layout animation)

// TODO: Allow zoom controls

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

  return (
    <Dialog open={openArtworkDialog} onOpenChange={handleOpenChange}>
      <DialogContent className="h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[calc(100vw-2rem)] bg-transparent">
        {selectedArtwork && (
          <div className="flex min-h-0 flex-1 flex-col">
            {imageUrl && (
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <img
                  src={imageUrl}
                  alt={selectedArtwork.imageAlt ?? title ?? "Artwork"}
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            <div className="grid shrink-0 gap-5 p-5 bg-muted">
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
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkDialog
