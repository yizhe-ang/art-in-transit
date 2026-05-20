import { create } from "zustand"

export const useStore = create((set) => ({
  openArtworkDialog: true,
  setOpenArtworkDialog: (openArtworkDialog) => set({ openArtworkDialog }),

  selectedArtwork: null,
  setSelectedArtwork: (selectedArtwork) => set({ selectedArtwork }),
}))
