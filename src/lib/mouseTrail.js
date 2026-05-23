import * as THREE from "three"

const DEFAULT_TRAIL_SIZE = 0.2
const DEFAULT_MIN_TRAIL_SIZE = 100
const DEFAULT_LERP_SPEED = 0.075
const DEFAULT_FADE_IN_SPEED = 0.1
const DEFAULT_FADE_OUT_SPEED = 0.1
const DEFAULT_MOVE_THRESHOLD = 0.5
const DEFAULT_PERSIST_INACTIVE_TRAIL = true

export default class MouseTrail {
  constructor(width, height) {
    this.currentX = null
    this.currentY = null
    this.lastX = null
    this.lastY = null
    this.opacity = 0
    this.trailSize = DEFAULT_TRAIL_SIZE
    this.minTrailSize = DEFAULT_MIN_TRAIL_SIZE
    this.lerpSpeed = DEFAULT_LERP_SPEED
    this.fadeInSpeed = DEFAULT_FADE_IN_SPEED
    this.fadeOutSpeed = DEFAULT_FADE_OUT_SPEED
    this.moveThreshold = DEFAULT_MOVE_THRESHOLD
    this.persistInactiveTrail = DEFAULT_PERSIST_INACTIVE_TRAIL

    this.#createCanvas(width, height)
    this.#createTexture()
  }

  #createCanvas(width, height) {
    this.canvas = document.createElement("canvas")
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext("2d")
    this.#updateLineWidth()

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
    const targetY = (1 - mouseY) * this.canvas.height

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

  reset() {
    this.currentX = null
    this.currentY = null
    this.lastX = null
    this.lastY = null
    this.opacity = 0
    this.#clear()
    this.texture.needsUpdate = true
  }

  resize(width, height) {
    if (this.canvas.width === width && this.canvas.height === height) {
      return
    }

    this.canvas.width = width
    this.canvas.height = height
    this.#updateLineWidth()
    this.reset()
  }

  setOptions({
    trailSize,
    minTrailSize,
    lerpSpeed,
    fadeInSpeed,
    fadeOutSpeed,
    moveThreshold,
    persistInactiveTrail,
  }) {
    if (trailSize !== undefined) {
      this.trailSize = trailSize
    }

    if (minTrailSize !== undefined) {
      this.minTrailSize = minTrailSize
    }

    if (lerpSpeed !== undefined) {
      this.lerpSpeed = lerpSpeed
    }

    if (fadeInSpeed !== undefined) {
      this.fadeInSpeed = fadeInSpeed
    }

    if (fadeOutSpeed !== undefined) {
      this.fadeOutSpeed = fadeOutSpeed
    }

    if (moveThreshold !== undefined) {
      this.moveThreshold = moveThreshold
    }

    if (persistInactiveTrail !== undefined) {
      this.persistInactiveTrail = persistInactiveTrail
    }

    this.#updateLineWidth()
  }

  #updateLineWidth() {
    this.lineWidth = Math.max(
      this.canvas.width * this.trailSize,
      this.minTrailSize
    )
  }

  #lerp(targetX, targetY) {
    this.currentX += (targetX - this.currentX) * this.lerpSpeed
    this.currentY += (targetY - this.currentY) * this.lerpSpeed
  }

  #updateOpacity() {
    const dx = this.currentX - this.lastX
    const dy = this.currentY - this.lastY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > this.moveThreshold) {
      this.opacity = Math.min(1, this.opacity + this.fadeInSpeed)
    } else if (!this.persistInactiveTrail) {
      this.opacity = Math.max(0, this.opacity - this.fadeOutSpeed)
    }
  }

  #draw() {
    const { ctx, lineWidth } = this

    this.#clear()

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

  #clear() {
    const { canvas, ctx } = this

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  dispose() {
    this.texture.dispose()
  }
}
