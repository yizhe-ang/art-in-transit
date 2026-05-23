import { folder, useControls } from "leva"
import { publicUrl } from "@/lib/public-url"

const PaperOverlay = () => {
  const { enabled, opacity, blendMode, brightness, contrast } = useControls({
    "paper overlay": folder({
      enabled: true,
      opacity: {
        value: 0.5,
        min: 0,
        max: 0.5,
        step: 0.01,
      },
      blendMode: {
        value: "multiply",
        options: ["multiply", "overlay", "soft-light", "color-burn", "normal"],
      },
      brightness: {
        value: 1,
        min: 0.5,
        max: 1.5,
        step: 0.01,
      },
      contrast: {
        value: 1,
        min: 0.5,
        max: 2,
        step: 0.01,
      },
    }),
  })

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url("${publicUrl("/textures/paper.webp")}")`,
        display: enabled ? undefined : "none",
        opacity,
        mixBlendMode: blendMode,
        filter: `brightness(${brightness}) contrast(${contrast})`,
      }}
    />
  )
}

export default PaperOverlay
