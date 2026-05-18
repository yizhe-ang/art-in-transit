import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three/webgpu"
import { Fn, instanceIndex, uint, vec3 } from "three/tsl"

const PICK_ID_BYTE = 256

function decodePickId(pixel) {
  const pickId = pixel[0] + pixel[1] * PICK_ID_BYTE + pixel[2] * 65536
  return pickId === 0 ? null : pickId - 1
}

function copyCameraForPicking(source, target) {
  target.near = source.near
  target.far = source.far
  target.matrixAutoUpdate = false
  target.matrixWorldAutoUpdate = false
  target.matrix.copy(source.matrix)
  target.matrixWorld.copy(source.matrixWorld)
  target.matrixWorldInverse.copy(source.matrixWorldInverse)
  target.projectionMatrix.copy(source.projectionMatrix)
  target.projectionMatrixInverse.copy(source.projectionMatrixInverse)
  target.position.copy(source.position)
  target.quaternion.copy(source.quaternion)
  target.scale.copy(source.scale)
  target.up.copy(source.up)
  target.layers.mask = source.layers.mask
}

function cropCameraProjectionToPixel(
  camera,
  width,
  height,
  pixelX,
  pixelY,
  cropMatrix
) {
  cropMatrix.set(
    width,
    0,
    0,
    width - 2 * pixelX - 1,
    0,
    height,
    0,
    height - 2 * pixelY - 1,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  )

  camera.projectionMatrix.premultiply(cropMatrix)
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
}

function createPickingColorNode() {
  return Fn(() => {
    const pickId = instanceIndex.add(uint(1))
    const byte = uint(PICK_ID_BYTE)

    return vec3(
      pickId.mod(byte).toFloat().div(255),
      pickId.div(byte).mod(byte).toFloat().div(255),
      pickId.div(uint(65536)).mod(byte).toFloat().div(255)
    )
  })()
}

export function useArtworkGpuPicking({
  geometry,
  positionNode,
  vertexNode,
  count,
}) {
  const pickedIdRef = useRef()
  const pickingCameraRef = useRef(new THREE.PerspectiveCamera())
  const pickingCropMatrixRef = useRef(new THREE.Matrix4())

  const pickingScene = useMemo(() => new THREE.Scene(), [])
  const pickingTexture = useMemo(() => {
    const renderTarget = new THREE.RenderTarget(1, 1, {
      colorSpace: THREE.NoColorSpace,
      depthBuffer: true,
      format: THREE.RGBAFormat,
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      samples: 0,
      type: THREE.UnsignedByteType,
    })

    renderTarget.scissorTest = true
    return renderTarget
  }, [])

  const pickingMesh = useMemo(() => {
    const material = new THREE.MeshBasicNodeMaterial({
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
    })

    material.positionNode = positionNode
    material.vertexNode = vertexNode
    material.colorNode = createPickingColorNode()

    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false

    return mesh
  }, [count, geometry, positionNode, vertexNode])

  useEffect(() => {
    pickingScene.add(pickingMesh)

    return () => {
      pickingScene.remove(pickingMesh)
      pickingMesh.material.dispose()
    }
  }, [pickingMesh, pickingScene])

  useEffect(() => {
    return () => {
      pickingTexture.dispose()
    }
  }, [pickingTexture])

  useFrame(({ gl, camera, pointer }) => {
    const canvas = gl.domElement
    const width = canvas.width
    const height = canvas.height

    if (width === 0 || height === 0) return

    const pixelX = THREE.MathUtils.clamp(
      Math.floor(((pointer.x + 1) / 2) * width),
      0,
      width - 1
    )
    const pixelY = THREE.MathUtils.clamp(
      Math.floor(((pointer.y + 1) / 2) * height),
      0,
      height - 1
    )
    const pickingCamera = pickingCameraRef.current

    const currentRenderTarget = gl.getRenderTarget()
    const currentViewport = new THREE.Vector4()
    const currentScissor = new THREE.Vector4()
    const currentScissorTest = gl.getScissorTest()
    const currentClearColor = gl.getClearColor(new THREE.Color())
    const currentClearAlpha = gl.getClearAlpha()

    gl.getViewport(currentViewport)
    gl.getScissor(currentScissor)

    copyCameraForPicking(camera, pickingCamera)
    cropCameraProjectionToPixel(
      pickingCamera,
      width,
      height,
      pixelX,
      pixelY,
      pickingCropMatrixRef.current
    )

    try {
      gl.setRenderTarget(pickingTexture)
      gl.setViewport(0, 0, 1, 1)
      gl.setScissor(0, 0, 1, 1)
      gl.setScissorTest(true)
      gl.setClearColor(0x000000, 0)
      gl.clear(true, true, false)
      gl.render(pickingScene, pickingCamera)

      gl.readRenderTargetPixelsAsync(pickingTexture, 0, 0, 1, 1).then(
        (pixelBuffer) => {
          pickedIdRef.current = decodePickId(pixelBuffer)
        },
        (error) => {
          console.error("Artwork pick read failed", error)
        }
      )
    } catch (error) {
      console.error("Artwork picking failed", error)
    } finally {
      gl.setRenderTarget(currentRenderTarget)
      gl.setViewport(currentViewport)
      gl.setScissor(currentScissor)
      gl.setScissorTest(currentScissorTest)
      gl.setClearColor(currentClearColor, currentClearAlpha)
    }

    console.log(pickedIdRef.current)
  })

  return { pickedIdRef }
}
