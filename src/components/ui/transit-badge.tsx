import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type TransitBadgeSize = "sm" | "md" | "lg"

type TransitBadgeProps = HTMLAttributes<HTMLDivElement> & {
  stationCode: string
  size?: TransitBadgeSize
}

type LineStyle = {
  backgroundColor: string
  textColor: string
}

const fallbackLineStyle: LineStyle = {
  backgroundColor: "#748477",
  textColor: "#fff",
}

const lineStyles: Record<string, LineStyle> = {
  NS: { backgroundColor: "#d42e12", textColor: "#fff" },
  EW: { backgroundColor: "#009645", textColor: "#fff" },
  CG: { backgroundColor: "#009645", textColor: "#fff" },
  CC: { backgroundColor: "#fa9e0d", textColor: "#000" },
  CE: { backgroundColor: "#fa9e0d", textColor: "#000" },
  NE: { backgroundColor: "#9900aa", textColor: "#fff" },
  DT: { backgroundColor: "#005ec4", textColor: "#fff" },
  TE: { backgroundColor: "#9d5b25", textColor: "#fff" },
  BP: fallbackLineStyle,
  PE: fallbackLineStyle,
  PW: fallbackLineStyle,
  SE: fallbackLineStyle,
  SW: fallbackLineStyle,
  PTC: fallbackLineStyle,
  STC: fallbackLineStyle,
}

const sizeClasses: Record<TransitBadgeSize, string> = {
  sm: "min-h-5 text-[11px]",
  md: "min-h-8 text-base",
  lg: "min-h-11 text-2xl",
}

const segmentSizeClasses: Record<TransitBadgeSize, string> = {
  sm: "px-1.5 py-1",
  md: "px-2.5 py-1.5",
  lg: "px-3.5 py-2",
}

function getStationPrefix(code: string) {
  return code.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ""
}

function getLineStyle(code: string) {
  return lineStyles[getStationPrefix(code)] ?? fallbackLineStyle
}

function TransitBadge({
  stationCode,
  size = "md",
  className,
  ...props
}: TransitBadgeProps) {
  const segments = stationCode
    .split("-")
    .map((segment) => segment.trim())
    .filter(Boolean)

  return (
    <div
      data-slot="transit-badge"
      className={cn(
        "inline-flex overflow-hidden rounded-[0.45em] bg-clip-padding font-heading font-bold leading-none whitespace-nowrap shadow-[0_0_0_1px_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.2)]",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {segments.map((segment) => {
        const lineStyle = getLineStyle(segment)

        return (
          <span
            key={segment}
            className={cn(
              "flex items-center justify-center bg-linear-to-b from-white/25 via-transparent to-black/10",
              segmentSizeClasses[size]
            )}
            style={{
              backgroundColor: lineStyle.backgroundColor,
              color: lineStyle.textColor,
              textShadow:
                lineStyle.textColor === "#000"
                  ? "0 -1px rgba(255, 255, 255, 0.5)"
                  : "0 -1px rgba(0, 0, 0, 0.25)",
            }}
          >
            {segment}
          </span>
        )
      })}
    </div>
  )
}

export { TransitBadge }
export type { TransitBadgeProps, TransitBadgeSize }
