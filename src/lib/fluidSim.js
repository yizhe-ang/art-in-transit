// https://tympanus.net/codrops/2026/03/23/building-a-dual-scene-fluid-x-ray-reveal-effect-in-three-js/

import { texture, vec2, Fn, uv, mul, float } from "three/tsl"
import * as THREE from "three/webgpu"

export default class FluidSim {
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

    const material = new THREE.MeshBasicNodeMaterial()
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

  #createFluidShader() {
    const aspect = this.height / this.width
    const aspectVec =
      this.width < this.height ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0)


    return Fn(() => {
      const uvCoord = uv()
      const disp = mul(mul(fbm(mul(uvCoord, 20.0), float(4)), aspectVec), 0.01)
    })
  }
}