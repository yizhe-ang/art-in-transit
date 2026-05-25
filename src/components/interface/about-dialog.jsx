import { ExternalLinkIcon, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const LTA_ART_IN_TRANSIT_URL =
  "https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/a_better_public_transport_experience/art_in_public_transport/art_in_transit.html"

const AboutLink = ({ children, href }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline font-medium text-lta-dark-green underline decoration-lta-yellow decoration-2 underline-offset-3 transition-colors hover:text-lta-dark-green/78 hover:decoration-lta-dark-green focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-lta-dark-green/25 focus-visible:outline-none"
    >
      {children}
      <ExternalLinkIcon className="mb-0.5 ml-0.5 inline size-3.5" />
    </a>
  )
}

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
        <Info className="size-5 stroke-3" />
      </DialogTrigger>

      <DialogContent className="max-w-[calc(100%-2rem)] gap-5 rounded-lg border border-white/60 bg-white/95 p-5 font-inter text-lta-dark-green shadow-[0_22px_70px_rgba(0,72,81,0.22)] backdrop-blur-md sm:max-w-lg lg:max-w-2xl">
        <div className="grid gap-2 pr-8">
          <DialogTitle className="text-2xl leading-none">About</DialogTitle>
          {/* <DialogDescription className="text-sm leading-6 text-lta-dark-green/75">
            An interactive transit-art map for moving through station geography,
            artwork imagery, and collection layouts in one shared view.
          </DialogDescription> */}
        </div>

        <div className="grid gap-3 text-sm leading-normal text-lta-dark-green/80 sm:text-base sm:leading-relaxed">
          <p>
            This is a personal and unofficial project showcasing Singapore's{" "}
            <span className="font-bold">Land Transport Authority's</span> (LTA){" "}
            <span className="font-bold">Art in Transit</span> (AIT) programme in
            a more exploratory, interactive and visual manner.
          </p>
          <p>
            Do visit the{" "}
            <AboutLink href={LTA_ART_IN_TRANSIT_URL}>
              Official LTA Art in Transit
            </AboutLink>{" "}
            page for more information!
          </p>
          <p>
            The images and information about the artworks are scraped from the{" "}
            <AboutLink
              href={
                "https://guides.bloombergconnects.org/en-US/guide/artInTransit"
              }
            >
              Bloomberg Connects
            </AboutLink>{" "}
            page about the programme.
          </p>
          <p>
            <AboutLink
              href={
                "https://www.artoutreachsingapore.org/art-in-transit-virtual-tour"
              }
            >
              Art Outreach
            </AboutLink>{" "}
            also has a set of virtual tours where you can learn more about the
            stories and artists behind these artworks.
          </p>

          <hr className="border-0 border-t border-lta-dark-green/15" />
          <p>
            Made by{" "}
            <AboutLink href={"https://yizhe-ang.github.io/"}>
              Yi Zhe Ang
            </AboutLink>
            .
          </p>

          <p className="mt-4">
            Many thanks to these projects in which this site is built upon:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Chee Aun's{" "}
              <AboutLink href={"https://github.com/cheeaun/railrouter-sg"}>
                RailRouter SG
              </AboutLink>
              , for its Singapore's rail data and map layers.
            </li>
            <li>
              Reconstruction of the{" "}
              <AboutLink href="https://github.com/jglim/IdentityFont">
                LTAIdentity font
              </AboutLink>{" "}
              by JinGen Lim.
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AboutDialog
