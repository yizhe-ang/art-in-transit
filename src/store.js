import { create } from "zustand"

export const useStore = create((set) => ({
  artworkLayout: "map",
  setArtworkLayout: (artworkLayout) => set({ artworkLayout }),

  openArtworkDialog: false,
  setOpenArtworkDialog: (openArtworkDialog) => set({ openArtworkDialog }),

  selectedArtwork: null,
  setSelectedArtwork: (selectedArtwork) => set({ selectedArtwork }),

  artworkCameraFocusRequest: null,
  requestArtworkCameraFocus: (artwork) =>
    set((state) => ({
      artworkCameraFocusRequest: {
        artwork,
        id: (state.artworkCameraFocusRequest?.id ?? 0) + 1,
      },
    })),
}))
