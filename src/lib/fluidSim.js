import * as THREE from "three/webgpu"
import { MeshBasicNodeMaterial } from "three/webgpu"
import {
  vec2,
  vec3,
  float,
  sub,
  mul,
  add,
  min,
  uv,
  texture,
  uniform,
  Fn,
} from "three/tsl"
import { fbm } from "@/lib/fbm"

const DEFAULT_NOISE_SCALE = 20
const DEFAULT_DISPLACEMENT_STRENGTH = 0.01
const DEFAULT_FADE_AMOUNT = 0.015

function getAspectVector(width, height) {
  const aspect = height / width

  return width < height
    ? new THREE.Vector2(1.0, 1.0 / aspect)
    : new THREE.Vector2(aspect, 1.0)
}

export default class FluidSim {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.aspectVecNode = uniform(getAspectVector(width, height))
    this.noiseScaleUniform = uniform(DEFAULT_NOISE_SCALE)
    this.displacementStrengthUniform = uniform(DEFAULT_DISPLACEMENT_STRENGTH)
    this.fadeAmountUniform = uniform(DEFAULT_FADE_AMOUNT)

    this.#createRenderTargets()
    this.#createFBOScene()
  }

  #createRenderTargets() {
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.targetA = new THREE.RenderTarget(this.width, this.height, opts)
    this.targetB = new THREE.RenderTarget(this.width, this.height, opts)

    this.prevNode = texture(this.targetA.texture)
    this.maskNode = texture(this.targetA.texture)
  }

  #createFBOScene() {
    this.fboScene = new THREE.Scene()
    this.fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)

    this.inputNode = texture(new THREE.Texture())

    const material = new MeshBasicNodeMaterial()
    material.colorNode = this.#createFluidShader()

    const geo = new THREE.PlaneGeometry(2, 2)
    // Flip geometry UVs Y so render target read-back is self-consistent in WebGPU
    const uvAttr = geo.attributes.uv
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setY(i, 1.0 - uvAttr.getY(i))
    }
    this.fboQuad = new THREE.Mesh(geo, material)
    this.fboScene.add(this.fboQuad)
  }

  #createFluidShader() {
    const blendDarken = Fn(([base, blend]) => min(blend, base))

    return Fn(() => {
      const uvCoord = uv()
      const disp = mul(
        mul(fbm(mul(uvCoord, this.noiseScaleUniform)), this.aspectVecNode),
        this.displacementStrengthUniform
      )

      // Sample previous frame with noise displacement (fluid spreading)
      const texel = this.prevNode.sample(uvCoord)
      const texel2 = this.prevNode.sample(
        vec2(add(uvCoord.x, disp.x), uvCoord.y)
      )
      const texel3 = this.prevNode.sample(
        vec2(sub(uvCoord.x, disp.x), uvCoord.y)
      )
      const texel4 = this.prevNode.sample(
        vec2(uvCoord.x, add(uvCoord.y, disp.y))
      )
      const texel5 = this.prevNode.sample(
        vec2(uvCoord.x, sub(uvCoord.y, disp.y))
      )

      // Take darkest of neighborhood
      const floodcolor = texel.rgb.toVar()
      floodcolor.assign(blendDarken(floodcolor, texel2.rgb))
      floodcolor.assign(blendDarken(floodcolor, texel3.rgb))
      floodcolor.assign(blendDarken(floodcolor, texel4.rgb))
      floodcolor.assign(blendDarken(floodcolor, texel5.rgb))

      // Blend with new trail input (flip Y — canvas texture has opposite Y to render targets in WebGPU)
      const flippedUV = vec2(uvCoord.x, sub(float(1.0), uvCoord.y))
      const input = this.inputNode.sample(flippedUV)
      const combined = blendDarken(floodcolor, input.rgb)

      // Fade back to white
      return min(vec3(1.0), add(combined, vec3(this.fadeAmountUniform)))
    })()
  }

  get texture() {
    return this.maskNode
  }

  update(renderer, trailTexture) {
    this.prevNode.value = this.targetA.texture
    this.inputNode.value = trailTexture

    renderer.setRenderTarget(this.targetB)
    renderer.render(this.fboScene, this.fboCamera)
    renderer.setRenderTarget(null)

    // Update mask to read from the just-rendered target
    this.maskNode.value = this.targetB.texture

    // Swap
    const temp = this.targetA
    this.targetA = this.targetB
    this.targetB = temp
  }

  onResize(width, height) {
    this.width = width
    this.height = height
    this.aspectVecNode.value.copy(getAspectVector(width, height))
    this.targetA.setSize(width, height)
    this.targetB.setSize(width, height)
  }

  setOptions({ noiseScale, displacementStrength, fadeAmount }) {
    if (noiseScale !== undefined) {
      this.noiseScaleUniform.value = noiseScale
    }

    if (displacementStrength !== undefined) {
      this.displacementStrengthUniform.value = displacementStrength
    }

    if (fadeAmount !== undefined) {
      this.fadeAmountUniform.value = fadeAmount
    }
  }

  dispose() {
    this.targetA.dispose()
    this.targetB.dispose()
    this.fboQuad.material.dispose()
    this.fboQuad.geometry.dispose()
  }
}
