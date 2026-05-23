import stationsSprite from "@/data/stations.json"
import { publicUrl } from "@/lib/public-url"

export default async function loadImages(map) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  })

  const image = await map.loadImage(publicUrl("/images/stations.png"))
  const img = image.data

  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)

  stationsSprite.forEach((s) => {
    const [code, ...args] = s

    if (map.hasImage(code)) return

    const imageData = ctx.getImageData(...args)
    map.addImage(code, imageData)
  })
}
