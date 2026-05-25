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
  sm: "h-5 min-w-12 px-1.5 text-[13px] ring-[1px]",
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
      className={cn("inline-flex items-center whitespace-nowrap", className)}
      {...props}
    >
      {segments.map((segment, index) => {
        const lineStyle = getLineStyle(segment)
        const isFirst = index === 0
        const isLast = index === segments.length - 1

        return (
          <span
            key={segment}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-[0.48em] bg-clip-padding font-heading leading-none font-bold tracking-[0.015em] text-white ring-white/95 select-none",
              sizeClasses[size],
              !isFirst && "rounded-l-none",
              !isLast && "rounded-r-none"
            )}
            style={{
              backgroundColor: lineStyle.backgroundColor,
              color: lineStyle.textColor,
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
