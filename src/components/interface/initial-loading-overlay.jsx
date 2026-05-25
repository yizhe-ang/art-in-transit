import { useEffect, useRef, useState } from "react"
import { useStore } from "@/store"

const MIN_VISIBLE_MS = 520
const FADE_MS = 460

const InitialLoadingOverlay = () => {
  const isInitialLoading = useStore((state) => state.isInitialLoading)
  const mapImagesReady = useStore((state) => state.mapImagesReady)
  const threeSceneReady = useStore((state) => state.threeSceneReady)
  const setInitialOverlayDismissing = useStore(
    (state) => state.setInitialOverlayDismissing
  )
  const readiness = [
    { key: "map", label: "Map", ready: mapImagesReady },
    { key: "art", label: "Art", ready: threeSceneReady },
  ]
  const shownAtRef = useRef(0)
  const [isVisible, setIsVisible] = useState(true)
  const [shouldRender, setShouldRender] = useState(true)

  useEffect(() => {
    if (isInitialLoading) {
      shownAtRef.current = Date.now()
      setInitialOverlayDismissing(false)

      const frame = requestAnimationFrame(() => {
        setShouldRender(true)
        setIsVisible(true)
      })

      return () => {
        cancelAnimationFrame(frame)
      }
    }

    const elapsed = Date.now() - shownAtRef.current
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    let removeTimer

    const fadeTimer = setTimeout(() => {
      setInitialOverlayDismissing(true)
      setIsVisible(false)
      removeTimer = setTimeout(() => {
        setShouldRender(false)
      }, FADE_MS)
    }, remaining)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [isInitialLoading, setInitialOverlayDismissing])

  useEffect(() => {
    if (!shouldRender) {
      return
    }

    const root = document.documentElement
    const body = document.body
    const previousStyles = {
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    }

    root.style.overflow = "hidden"
    root.style.overscrollBehavior = "none"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"

    return () => {
      root.style.overflow = previousStyles.rootOverflow
      root.style.overscrollBehavior = previousStyles.rootOverscrollBehavior
      body.style.overflow = previousStyles.bodyOverflow
      body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior
    }
  }, [shouldRender])

  if (!shouldRender) {
    return null
  }

  return (
    <div
      className={`initial-loading-overlay fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#f8f4e8] text-lta-dark-green transition-opacity duration-500 ease-out ${
        isVisible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading Art in Transit"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(254,209,65,0.38),transparent_31%),radial-gradient(circle_at_82%_74%,rgba(154,190,170,0.36),transparent_34%),linear-gradient(135deg,rgba(0,72,81,0.08),transparent_42%)]" />
      <div className="initial-loading-grid absolute inset-0 opacity-[0.18]" />

      <div className="relative flex w-[min(28rem,calc(100vw-2.5rem))] flex-col items-center text-center">
        <div
          className="initial-route mb-7 h-16 w-full max-w-80"
          aria-hidden="true"
        >
          <span className="initial-route-track" />
          <span className="initial-route-progress" />
          <span className="initial-route-stop initial-route-stop-a" />
          <span className="initial-route-stop initial-route-stop-b" />
          <span className="initial-route-stop initial-route-stop-c" />
          <span className="initial-route-train" />
        </div>

        <p className="font-heading text-[clamp(2.4rem,9vw,5.6rem)] leading-[1] tracking-normal text-balance drop-shadow-[0_1px_0_rgba(255,255,255,0.72)]">
          Loading Art in Transit
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {readiness.map((item) => (
            <span
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 font-heading text-sm leading-none transition-colors ${
                item.ready
                  ? "border-lta-dark-green/25 bg-lta-light-green/25 text-lta-dark-green"
                  : "border-lta-dark-green/18 bg-white/30 text-lta-dark-green/62"
              }`}
              key={item.key}
            >
              <span
                className={`size-2 rounded-full ${
                  item.ready ? "bg-lta-dark-green" : "bg-lta-yellow"
                }`}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default InitialLoadingOverlay
