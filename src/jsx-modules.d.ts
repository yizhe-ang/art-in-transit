declare module "@/components/interface/artwork-dialog" {
  const ArtworkDialog: () => import("react").JSX.Element
  export default ArtworkDialog
}

declare module "@/components/interface/about-dialog" {
  const AboutDialog: () => import("react").JSX.Element
  export default AboutDialog
}

declare module "@/components/interface/layout-controls" {
  const LayoutControls: () => import("react").JSX.Element
  export default LayoutControls
}

declare module "@/components/interface/initial-loading-overlay" {
  const InitialLoadingOverlay: () => import("react").JSX.Element
  export default InitialLoadingOverlay
}

declare module "@/components/map/map" {
  const Map: () => import("react").JSX.Element
  export default Map
}

declare module "@/components/steps" {
  const Steps: () => import("react").JSX.Element
  export default Steps
}

declare module "@/components/scrolly-intro" {
  const ScrollyIntro: () => import("react").JSX.Element
  export default ScrollyIntro
}

declare module "@/store" {
  type AppStoreState = {
    isInitialOverlayDismissing: boolean
    [key: string]: unknown
  }

  export const useStore: <T>(selector: (state: AppStoreState) => T) => T
}
