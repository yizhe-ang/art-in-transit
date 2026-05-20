import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useStore } from "@/store"

// TODO: Include photo credits too? To give proper credits to people involved.

// TODO: Animate from three.js scene to dom
// TODO: Allow zoom controls

const ArtworkDialog = () => {
  const openArtworkDialog = useStore((state) => state.openArtworkDialog)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)

  return (
    <Dialog open={openArtworkDialog} onOpenChange={setOpenArtworkDialog}>
      <DialogContent>
        <div className="">
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkDialog
