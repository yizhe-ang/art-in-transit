import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const AboutDialog = () => {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="About this project"
            className="size-10 rounded-lg border border-lta-dark-green/22 bg-lta-yellow/92 text-lta-dark-green shadow-[0_10px_30px_rgba(0,72,81,0.16)] backdrop-blur-md hover:bg-lta-yellow focus-visible:ring-lta-dark-green/30"
          />
        }
      >
        <Info className="size-5 stroke-2.5" />
      </DialogTrigger>

      <DialogContent className="max-w-[calc(100%-2rem)] gap-5 rounded-lg border border-white/60 bg-white/95 p-5 text-lta-dark-green shadow-[0_22px_70px_rgba(0,72,81,0.22)] backdrop-blur-md sm:max-w-md">
        <div className="grid gap-2 pr-8">
          <DialogTitle className="text-2xl leading-none">About</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-lta-dark-green/75">
            An interactive transit-art map for moving through station geography,
            artwork imagery, and collection layouts in one shared view.
          </DialogDescription>
        </div>

        <div className="grid gap-3 text-sm leading-6 text-lta-dark-green/80">
          <p>
            The experience combines a rail network, public-art records, and
            switchable map, line, and time layouts so the collection can be read
            spatially and visually.
          </p>
          <p>
            This is placeholder About copy for now. Replace it with project
            notes, data details, or curatorial context when the final text is
            ready.
          </p>
        </div>

        <div className="grid gap-2 rounded-md border border-lta-light-green/45 bg-lta-light-green/12 p-3 text-sm text-lta-dark-green">
          <h2 className="font-heading text-base leading-none">Credits</h2>
          <p className="text-lta-dark-green/75">
            Artwork data, station context, and implementation credits can be
            added here.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AboutDialog
