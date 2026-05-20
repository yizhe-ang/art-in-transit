import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useStore } from "@/store"

// TODO: Animate from three.js scene to dom
// TODO: Allow zoom controls

const ArtworkDialog = () => {
  const openArtworkDialog = useStore((state) => state.openArtworkDialog)
  const setOpenArtworkDialog = useStore((state) => state.setOpenArtworkDialog)

  return (
    <Dialog open={openArtworkDialog} onOpenChange={setOpenArtworkDialog}>
      <DialogContent>
        <div className="h-screen w-screen bg-red-400">
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkDialog
