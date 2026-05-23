import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

gsap.registerPlugin(useGSAP)

const heroStats = ["112 Stations", "119 Artists", "more than 500 Artworks"]

const HeroTitle = () => {
  const containerRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const lines = gsap.utils.toArray<HTMLElement>(".hero-title-line")
      const stats = gsap.utils.toArray<HTMLElement>(".hero-stat-line")
      const media = gsap.matchMedia()

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(lines, {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
        })
      })

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({
          defaults: {
            duration: 0.74,
            ease: "power3.out",
          },
        })

        timeline
          .set(lines, {
            autoAlpha: 0,
            y: 28,
            filter: "blur(10px)",
          })
          .to(".hero-heading", {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
          })
          .to(
            stats,
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              stagger: 0.12,
            },
            "-=0.36"
          )

        return () => {
          timeline.kill()
        }
      })

      return () => {
        media.revert()
      }
    },
    { scope: containerRef }
  )

  return (
    <section
      ref={containerRef}
      className="pointer-events-none fixed inset-x-0 top-0 z-10 flex min-h-[100svh] items-start px-5 pt-[clamp(5rem,13vh,8rem)] sm:px-8 lg:px-12"
      aria-label="Art in Transit project statistics"
    >
      <div className="max-w-[min(36rem,calc(100vw-2.5rem))] text-lta-dark-green [text-shadow:0_1px_0_rgba(255,255,255,0.82),0_18px_44px_rgba(0,72,81,0.24)]">
        <h1 className="hero-title-line hero-heading text-[clamp(4.2rem,11vw,9.6rem)] leading-[0.78] tracking-normal text-balance">
          Art in Transit
        </h1>

        <div className="mt-6 grid gap-1.5 text-[clamp(1.45rem,3.3vw,3.5rem)] leading-[0.9] tracking-normal sm:mt-7 sm:gap-2">
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
