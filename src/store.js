import { create } from "zustand"

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const clampSigned01 = (value) => Math.min(1, Math.max(-1, value))
const ARTWORK_LINE_VELOCITY_SCALE = 2.5
const ARTWORK_LINE_VELOCITY_RESET_DELTA = 0.35
const ARTWORK_LINE_VELOCITY_RESET_SECONDS = 0.4

export const useStore = create((set) => ({
  map: null,
  setMap: (map) => set({ map }),

  artworkLayout: "map",
  setArtworkLayout: (artworkLayout) => set({ artworkLayout }),

  artworkLineProgress: 0,
  artworkLineVelocity: 0,
  artworkLineProgressUpdatedAt: null,
  setArtworkLineProgress: (artworkLineProgress) =>
    set((state) => {
      const nextProgress = clamp01(artworkLineProgress)
      const now = performance.now()
      const previousProgress = state.artworkLineProgress
      const previousTime = state.artworkLineProgressUpdatedAt ?? now
      const delta = nextProgress - previousProgress
      const seconds = (now - previousTime) / 1000
      const shouldResetVelocity =
        seconds <= 0 ||
        seconds > ARTWORK_LINE_VELOCITY_RESET_SECONDS ||
        Math.abs(delta) > ARTWORK_LINE_VELOCITY_RESET_DELTA
      const artworkLineVelocity = shouldResetVelocity
        ? 0
        : clampSigned01(delta / seconds / ARTWORK_LINE_VELOCITY_SCALE)

      return {
        artworkLineProgress: nextProgress,
        artworkLineVelocity,
        artworkLineProgressUpdatedAt: now,
      }
    }),

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
