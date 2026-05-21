import { create } from "zustand"

function areRectValuesEqual(rectA, rectB) {
  if (rectA === rectB) return true
  if (!rectA || !rectB) return false

  return (
    rectA.left === rectB.left &&
    rectA.top === rectB.top &&
    rectA.width === rectB.width &&
    rectA.height === rectB.height
  )
}

function areTransitionValuesEqual(valueA, valueB) {
  if (valueA === valueB) return true

  if (
    (valueA?.left !== undefined || valueB?.left !== undefined) &&
    (valueA?.top !== undefined || valueB?.top !== undefined)
  ) {
    return areRectValuesEqual(valueA, valueB)
  }

  return false
}

export const useStore = create((set) => ({
  openArtworkDialog: false,
  setOpenArtworkDialog: (openArtworkDialog) => set({ openArtworkDialog }),

  selectedArtwork: null,
  setSelectedArtwork: (selectedArtwork) => set({ selectedArtwork }),

  artworkImageTransition: null,
  openArtworkDialogWithTransition: ({ artwork, artworkImageTransition }) =>
    set({
      artworkImageTransition,
      openArtworkDialog: true,
      selectedArtwork: artwork,
    }),
  setArtworkImageTransition: (artworkImageTransition) =>
    set({ artworkImageTransition }),
  updateArtworkImageTransition: (artworkImageTransition) =>
    set((state) => {
      if (!state.artworkImageTransition) {
        return { artworkImageTransition: null }
      }

      const hasChanges = Object.entries(artworkImageTransition).some(
        ([key, value]) => {
          return !areTransitionValuesEqual(
            state.artworkImageTransition[key],
            value
          )
        }
      )

      if (!hasChanges) {
        return state
      }

      return {
        artworkImageTransition: {
          ...state.artworkImageTransition,
          ...artworkImageTransition,
        },
      }
    }),
  clearArtworkImageTransition: () => set({ artworkImageTransition: null }),
}))
