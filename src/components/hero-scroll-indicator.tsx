import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ChevronDown } from "lucide-react"
import { useStore } from "@/store"

gsap.registerPlugin(useGSAP, ScrollTrigger)

const HeroScrollIndicator = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const motionRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const isInitialOverlayDismissing = useStore(
    (state) => state.isInitialOverlayDismissing
  )
  const isMapInteractionUnlocked = useStore(
    (state) => state.isMapInteractionUnlocked
  )

  useGSAP(
    () => {
      const container = containerRef.current
      const motion = motionRef.current
      const ring = ringRef.current
      const media = gsap.matchMedia()

      if (!container || !motion || !ring) {
        return () => {
          media.revert()
        }
      }

      gsap.set(container, {
        autoAlpha: 0,
      })

      if (!isInitialOverlayDismissing || isMapInteractionUnlocked) {
        return () => {
          media.revert()
        }
      }

      const step = document.getElementById("step-1")

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(container, {
          autoAlpha: 1,
          y: 0,
        })
        gsap.set(motion, {
          y: 0,
          filter: "blur(0px)",
        })
        gsap.set(ring, {
          autoAlpha: 0.38,
          scale: 1,
        })

        let exitTween: gsap.core.Tween | undefined

        if (step) {
          exitTween = gsap.to(container, {
            autoAlpha: 0,
            ease: "none",
            scrollTrigger: {
              trigger: step,
              start: "top top",
              end: "+=42%",
              scrub: 0.6,
            },
          })
        }

        return () => {
          exitTween?.kill()
        }
      })

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(container, {
          autoAlpha: 1,
          y: 0,
        })
        const floatTween = gsap.fromTo(
          motion,
          {
            y: 8,
            filter: "blur(6px)",
          },
          {
            y: -4,
            filter: "blur(0px)",
            duration: 1.0,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          }
        )
        const pulseTween = gsap.fromTo(
          ring,
          {
            autoAlpha: 0.42,
            scale: 0.92,
          },
          {
            autoAlpha: 0,
            scale: 1.28,
            duration: 1.25,
            repeat: -1,
            ease: "power2.out",
          }
        )
        let exitTween: gsap.core.Tween | undefined

        if (step) {
          exitTween = gsap.to(container, {
            autoAlpha: 0,
            y: -16,
            ease: "none",
            scrollTrigger: {
              trigger: step,
              start: "top top",
              end: "+=42%",
              scrub: 0.6,
            },
          })
        }

        return () => {
          floatTween.kill()
          pulseTween.kill()
          exitTween?.kill()
        }
      })

      return () => {
        media.revert()
      }
    },
    {
      dependencies: [isInitialOverlayDismissing, isMapInteractionUnlocked],
      scope: containerRef,
      revertOnUpdate: true,
    }
  )

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed bottom-[18vh] left-1/2 z-20 flex -translate-x-1/2 justify-center px-4"
      aria-hidden="true"
    >
      <div
        ref={motionRef}
        className="relative flex items-center gap-3 rounded-full border border-white/75 bg-white/68 px-4 py-2.5 text-lta-dark-green shadow-[0_18px_48px_rgba(0,72,81,0.2)] backdrop-blur-md [text-shadow:0_1px_0_rgba(255,255,255,0.9)] sm:px-5 sm:py-3"
      >
        <div
          ref={ringRef}
          className="absolute inset-0 rounded-full border border-lta-dark-green/35"
        />
        <span className="relative whitespace-nowrap text-sm font-semibold uppercase tracking-[0.18em] sm:text-base">
          Scroll to begin
        </span>
        <ChevronDown
          className="relative size-6 stroke-[2.6] sm:size-7"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default HeroScrollIndicator
