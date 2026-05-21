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
  sm: "h-6 min-w-12 px-2.5 text-[13px] ring-[2px]",
  md: "h-9 min-w-18 px-4 text-xl ring-[3px]",
  lg: "h-12 min-w-24 px-5 text-3xl ring-[4px]",
}

function getStationPrefix(code: string) {
  return code.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ""
}

function getLineStyle(code: string) {
  return lineStyles[getStationPrefix(code)] ?? fallbackLineStyle
}

function formatStationCode(code: string) {
  return code
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]+)\s*(\d+[A-Z]?)$/, "$1 $2")
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
        "inline-flex items-center gap-1.5 whitespace-nowrap",
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
              "inline-flex shrink-0 items-center justify-center rounded-[0.48em] bg-clip-padding font-heading font-bold leading-none tracking-[0.015em] text-white ring-white/95 select-none",
              "shadow-[0_0_0_1px_rgba(34,34,34,0.62),0_2px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]",
              sizeClasses[size]
            )}
            style={{
              backgroundColor: lineStyle.backgroundColor,
              color: lineStyle.textColor,
              textShadow:
                lineStyle.textColor === "#000"
                  ? "0 1px rgba(255, 255, 255, 0.45)"
                  : "0 1px 1px rgba(0, 0, 0, 0.28)",
            }}
          >
            {formatStationCode(segment)}
          </span>
        )
      })}
    </div>
  )
}

export { TransitBadge }
export type { TransitBadgeProps, TransitBadgeSize }
