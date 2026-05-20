// https://tympanus.net/codrops/2026/03/23/building-a-dual-scene-fluid-x-ray-reveal-effect-in-three-js/

import * as THREE from "three/webgpu"

export default class MouseTrail {
  #createCanvas(width, height) {
    this.canvas = document.createElement("canvas")
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext("2d")
    this.lineWidth = Math.max(width * 0.2, 100)

    this.ctx.fillStyle = "white"
    this.ctx.fillRect(0, 0, width, height)
  }

  #createTexture() {
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
  }

  update(mouseX, mouseY) {
    const targetX = mouseX * this.canvas.width
    const targetY = mouseY * this.canvas.height

    if (this.currentX === null) {
      this.currentX = targetX
      this.currentY = targetY
      this.lastX = targetX
      this.lastY = targetY
      return
    }

    this.#lerp(targetX, targetY)
    this.#updateOpacity()
    this.#draw()

    this.lastX = this.currentX
    this.lastY = this.currentY
    this.texture.needsUpdate = true
  }

  #draw() {
    const { canvas, ctx, lineWidth } = this

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (this.opacity > 0.01) {
      ctx.beginPath()
      ctx.moveTo(this.lastX, this.lastY)
      ctx.lineTo(this.currentX, this.currentY)
      ctx.lineCap = "round"
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity})`
      ctx.stroke()
    }
  }
}
