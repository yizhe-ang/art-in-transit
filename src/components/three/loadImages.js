import stationsSprite from "@/data/stations.json"

export default function loadImages(map) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  })
  map.loadImage("/images/stations.png", (e, img) => {
    if (!img) return
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)

    stationsSprite.forEach((s) => {
      const [code, ...args] = s
      const imageData = ctx.getImageData(...args)
      map.addImage(code, imageData)
    })
  })
}
