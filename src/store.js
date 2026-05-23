import { create } from "zustand"

const clamp01 = (value) => Math.min(1, Math.max(0, value))

export const useStore = create((set) => ({
  artworkLayout: "map",
  setArtworkLayout: (artworkLayout) => set({ artworkLayout }),

  artworkLineProgress: 0,
  setArtworkLineProgress: (artworkLineProgress) =>
    set({ artworkLineProgress: clamp01(artworkLineProgress) }),

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
