import { folder, useControls } from "leva"

const PaperOverlay = () => {
  const { enabled, opacity, textureSize, blendMode, brightness, contrast } =
    useControls({
      "paper overlay": folder({
        enabled: true,
        opacity: {
          value: 0.5,
          min: 0,
          max: 0.5,
          step: 0.01,
        },
        textureSize: {
          value: 640,
          min: 160,
          max: 1400,
          step: 20,
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
      className="pointer-events-none absolute inset-0 bg-[url('/textures/paper.jpg')] bg-repeat"
      style={{
        display: enabled ? undefined : "none",
        opacity,
        backgroundSize: `${textureSize}px ${textureSize}px`,
        mixBlendMode: blendMode,
        filter: `brightness(${brightness}) contrast(${contrast})`,
      }}
    />
  )
}

export default PaperOverlay
