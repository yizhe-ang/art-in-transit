import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useStore } from "@/store"

gsap.registerPlugin(useGSAP, ScrollTrigger)

const heroStats = ["112 Stations", "119 Artists", "> 500 Artworks"]

const HeroTitle = () => {
  const containerRef = useRef<HTMLElement>(null)
  const isInitialOverlayDismissing = useStore(
    (state) => state.isInitialOverlayDismissing
  )

  useGSAP(
    () => {
      const lines = gsap.utils.toArray<HTMLElement>(".hero-title-line")
      const stats = gsap.utils.toArray<HTMLElement>(".hero-stat-line")
      const media = gsap.matchMedia()

      if (!isInitialOverlayDismissing) {
        gsap.set(lines, {
          autoAlpha: 0,
          y: 28,
          filter: "blur(10px)",
        })

        return () => {
          media.revert()
        }
      }

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(lines, {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
        })

        const step = document.getElementById("step-1")

        if (!step || !containerRef.current) {
          return
        }

        const exitTween = gsap.to(containerRef.current, {
          autoAlpha: 0,
          ease: "none",
          scrollTrigger: {
            trigger: step,
            start: "top top",
            end: "+=85%",
            scrub: 0.8,
          },
        })

        return () => {
          exitTween.kill()
        }
      })

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const step = document.getElementById("step-1")
        const timeline = gsap.timeline({
          defaults: {
            duration: 0.74,
            ease: "power3.out",
          },
        })

        timeline
          .fromTo(
            ".hero-heading",
            {
              autoAlpha: 0,
              y: 28,
              filter: "blur(10px)",
            },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.9,
            }
          )
          .fromTo(
            stats,
            {
              autoAlpha: 0,
              y: 28,
              filter: "blur(10px)",
            },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              stagger: 0.12,
            },
            "-=0.36"
          )

        let exitTween: gsap.core.Tween | undefined

        if (step && containerRef.current) {
          exitTween = gsap.to(containerRef.current, {
            autoAlpha: 0,
            y: -48,
            filter: "blur(10px)",
            ease: "none",
            scrollTrigger: {
              trigger: step,
              start: "top top",
              end: "+=85%",
              scrub: 0.8,
            },
          })
        }

        return () => {
          timeline.kill()
          exitTween?.kill()
        }
      })

      return () => {
        media.revert()
      }
    },
    {
      dependencies: [isInitialOverlayDismissing],
      scope: containerRef,
      revertOnUpdate: true,
    }
  )

  return (
    <section
      ref={containerRef}
      className="pointer-events-none fixed inset-x-0 top-0 z-10 flex min-h-[100svh] items-start px-5 pt-[clamp(5rem,13vh,8rem)] sm:px-8 lg:px-12"
      aria-label="Art in Transit project statistics"
    >
      <div className="max-w-[min(36rem,calc(100vw-2.5rem))] text-lta-dark-green [-webkit-text-stroke:4px_rgba(255,255,255,0.92)] [paint-order:stroke_fill] [text-shadow:0_1px_0_rgba(255,255,255,0.82),0_18px_44px_rgba(0,72,81,0.24)]">
        <h1 className="hero-title-line hero-heading text-[clamp(4.2rem,11vw,9.6rem)] leading-[0.86] tracking-normal text-balance">
          Art in Transit
        </h1>

        <div className="mt-6 grid gap-1.5 text-[clamp(1.45rem,3.3vw,3.5rem)] leading-[0.96] tracking-normal sm:mt-7 sm:gap-2">
          {heroStats.map((stat) => (
            <p key={stat} className="hero-title-line hero-stat-line">
              {stat}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HeroTitle
