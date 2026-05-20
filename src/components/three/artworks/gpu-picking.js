import { useCallback, useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useMap } from "react-three-map/maplibre"
import * as THREE from "three/webgpu"
import { Fn, instanceIndex, uint, vec3 } from "three/tsl"

const PICK_ID_BYTE = 256
const INITIAL_POINTER = {
  x: 0,
  y: 0,
  version: 0,
}

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

function getPointerFromEvent(event, canvas, version) {
  const rect = canvas.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)

  return { x, y, version }
}

function getPickingPixel(pointer, width, height) {
  return {
    x: THREE.MathUtils.clamp(
      Math.floor(((pointer.x + 1) / 2) * width),
      0,
      width - 1
    ),
    y: THREE.MathUtils.clamp(
      Math.floor(((pointer.y + 1) / 2) * height),
      0,
      height - 1
    ),
  }
}

function runPick({
  gl,
  camera,
  pointer,
  pickingCamera,
  pickingCropMatrix,
  pickingScene,
  pickingTexture,
}) {
  const canvas = gl.domElement
  const width = canvas.width
  const height = canvas.height

  if (width === 0 || height === 0) {
    return null
  }

  const pixel = getPickingPixel(pointer, width, height)

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
    pixel.x,
    pixel.y,
    pickingCropMatrix
  )

  try {
    gl.setRenderTarget(pickingTexture)
    gl.setViewport(0, 0, 1, 1)
    gl.setScissor(0, 0, 1, 1)
    gl.setScissorTest(true)
    gl.setClearColor(0x000000, 0)
    gl.clear(true, true, false)
    gl.render(pickingScene, pickingCamera)

    return gl.readRenderTargetPixelsAsync(pickingTexture, 0, 0, 1, 1)
  } finally {
    gl.setRenderTarget(currentRenderTarget)
    gl.setViewport(currentViewport)
    gl.setScissor(currentScissor)
    gl.setScissorTest(currentScissorTest)
    gl.setClearColor(currentClearColor, currentClearAlpha)
  }
}

export function useArtworkGpuPicking({
  geometry,
  positionNode,
  vertexNode,
  count,
  enabled = true,
  onHoverChange,
  onClick,
}) {
  const gl = useThree((state) => state.gl)
  const map = useMap()
  const hoveredIdRef = useRef(null)
  const enabledRef = useRef(enabled)
  const onHoverChangeRef = useRef(onHoverChange)
  const onClickRef = useRef(onClick)
  const pointerRef = useRef(INITIAL_POINTER)
  const pointerVersionRef = useRef(0)
  const hoverDirtyRef = useRef(false)
  const clickPointerRef = useRef(null)
  const pickInFlightRef = useRef(false)
  const pickRequestIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const pickingCameraRef = useRef(new THREE.PerspectiveCamera())
  const pickingCropMatrixRef = useRef(new THREE.Matrix4())
  const cursorTargetRef = useRef(null)
  const previousCursorRef = useRef(null)

  const restoreCursor = useCallback(() => {
    const target = cursorTargetRef.current
    if (!target) return

    target.style.cursor = previousCursorRef.current ?? ""
    cursorTargetRef.current = null
    previousCursorRef.current = null
  }, [])

  const setPointerCursor = useCallback(
    (target) => {
      if (cursorTargetRef.current !== target) {
        restoreCursor()
        cursorTargetRef.current = target
        previousCursorRef.current = target.style.cursor
      }

      target.style.cursor = "pointer"
    },
    [restoreCursor]
  )

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
      isMountedRef.current = false
      restoreCursor()
      pickingTexture.dispose()
    }
  }, [pickingTexture, restoreCursor])

  useEffect(() => {
    isMountedRef.current = true
  }, [])

  useEffect(() => {
    onHoverChangeRef.current = onHoverChange
  }, [onHoverChange])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    onClickRef.current = onClick
  }, [onClick])

  useEffect(() => {
    const canvas = map?.getCanvas?.() ?? gl.domElement
    const eventTarget = canvas.parentElement ?? gl.domElement

    const clearHover = () => {
      pointerVersionRef.current += 1
      pointerRef.current = {
        ...pointerRef.current,
        version: pointerVersionRef.current,
      }
      hoverDirtyRef.current = false
      clickPointerRef.current = null
      restoreCursor()

      if (hoveredIdRef.current === null) return

      const previousId = hoveredIdRef.current
      hoveredIdRef.current = null
      onHoverChangeRef.current?.(null, previousId)
    }

    const handlePointerMove = (event) => {
      if (!enabled) return

      pointerVersionRef.current += 1
      pointerRef.current = getPointerFromEvent(
        event,
        canvas,
        pointerVersionRef.current
      )
      hoverDirtyRef.current = true
    }

    const handlePointerLeave = () => {
      clearHover()
    }

    const handleClick = (event) => {
      if (!enabled) return

      pointerVersionRef.current += 1
      pointerRef.current = getPointerFromEvent(
        event,
        canvas,
        pointerVersionRef.current
      )
      clickPointerRef.current = pointerRef.current
    }

    if (!enabled) {
      pickRequestIdRef.current += 1
      pickInFlightRef.current = false
      clearHover()
      return undefined
    }

    eventTarget.addEventListener("pointermove", handlePointerMove)
    eventTarget.addEventListener("pointerleave", handlePointerLeave)
    eventTarget.addEventListener("click", handleClick)

    return () => {
      eventTarget.removeEventListener("pointermove", handlePointerMove)
      eventTarget.removeEventListener("pointerleave", handlePointerLeave)
      eventTarget.removeEventListener("click", handleClick)
      restoreCursor()
    }
  }, [enabled, gl, map, restoreCursor])

  useFrame(({ gl, camera }) => {
    if (!enabled || pickInFlightRef.current) return

    const clickPointer = clickPointerRef.current
    const shouldPickClick = clickPointer !== null
    const shouldPickHover = hoverDirtyRef.current

    if (!shouldPickClick && !shouldPickHover) return

    const kind = shouldPickClick ? "click" : "hover"
    const pointer = shouldPickClick ? clickPointer : pointerRef.current
    const requestId = pickRequestIdRef.current + 1

    pickRequestIdRef.current = requestId
    pickInFlightRef.current = true

    if (shouldPickClick) {
      clickPointerRef.current = null
    } else {
      hoverDirtyRef.current = false
    }

    let pixelRead

    try {
      pixelRead = runPick({
        gl,
        camera,
        pointer,
        pickingCamera: pickingCameraRef.current,
        pickingCropMatrix: pickingCropMatrixRef.current,
        pickingScene,
        pickingTexture,
      })
    } catch (error) {
      pickInFlightRef.current = false
      console.error("Artwork picking failed", error)
      return
    }

    if (pixelRead === null) {
      pickInFlightRef.current = false
      return
    }

    pixelRead.then(
      (pixelBuffer) => {
        if (
          !enabledRef.current ||
          !isMountedRef.current ||
          pickRequestIdRef.current !== requestId
        ) {
          return
        }

        const pickedId = decodePickId(pixelBuffer)

        if (kind === "click") {
          onClickRef.current?.(pickedId)
          return
        }

        if (pointer.version !== pointerRef.current.version) {
          return
        }

        if (pickedId === hoveredIdRef.current) return

        const previousId = hoveredIdRef.current
        hoveredIdRef.current = pickedId

        if (pickedId === null) {
          restoreCursor()
        } else {
          const canvas = map?.getCanvas?.() ?? gl.domElement
          setPointerCursor(canvas.parentElement ?? gl.domElement)
        }

        onHoverChangeRef.current?.(pickedId, previousId)
      },
      (error) => {
        if (
          !enabledRef.current ||
          !isMountedRef.current ||
          pickRequestIdRef.current !== requestId
        ) {
          return
        }

        console.error("Artwork pick read failed", error)
      }
    ).finally(() => {
      if (!isMountedRef.current || pickRequestIdRef.current !== requestId) {
        return
      }

      pickInFlightRef.current = false
    })
  })

  return { hoveredIdRef }
}
