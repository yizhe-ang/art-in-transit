import graphData from "@/data/graphData";
// import forceGraphData from "@/data/forceGraphData.json";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import ThreeForceGraph from "three-forcegraph";
import {
  attribute,
  color,
  float,
  Fn,
  hash,
  hue,
  instancedArray,
  instancedBufferAttribute,
  instanceIndex,
  length,
  mix,
  mx_fractal_noise_float,
  positionLocal,
  range,
  smoothstep,
  step,
  storage,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { Hud, PerspectiveCamera, useTexture } from "@react-three/drei";
import { useControls } from "leva";
import { damp } from "maath/easing";
import gsap from "gsap";
import { useForcegraphTooltipStore, useStore } from "@/lib/stores";
import createLinksMesh from "./createLinksMesh";
import authorsStats from "@/data/authors_stats.csv";
import { extent, max } from "d3-array";
import Texts from "./Texts";
import { float32ToFloat16 } from "@/lib/utils";

const authorsStatsMap = new Map(
  authorsStats.map((d) => [d["id_author_oa"], d]),
);

// const hIndexExtent = extent(authorsStats, (d) => +d["h_index"]);
const hIndexMax = max(authorsStats, (d) => +d["h_index"]);

const randValue = /*#__PURE__*/ Fn(({ min, max, seed = 42 }) => {
  return hash(instanceIndex.add(seed)).mul(max.sub(min)).add(min);
});

const colorDummy = new THREE.Color();

function downloadObjectAsJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ForceGraph = () => {
  // HACK: COMPUTE GRAPH #######################################################
  // const graph = useMemo(() => {
  //   const graph = new ThreeForceGraph()
  //     .graphData(graphData)
  //     .numDimensions(3)
  //     .nodeOpacity(0.4)
  //     .linkOpacity(0.05)
  //     .onEngineStop(() => {
  //       const nodes = graphData.nodes.map((d) => ({
  //         id: d.id,
  //         index: d.index,
  //         // NOTE: Quantize positions
  //         // x: float32ToFloat16(d.x),
  //         // y: float32ToFloat16(d.y),
  //         // z: float32ToFloat16(d.z),
  //         x: d.x,
  //         y: d.y,
  //         z: d.z,
  //       }));

  //       const links = graphData.links.map((d) => ({
  //         index: d.index,
  //         source: d.source.index,
  //         target: d.target.index,
  //         // source: {
  //         //   // id: d.source.id,
  //         //   index: d.source.index,
  //         //   // x: d.source.x,
  //         //   // y: d.source.y,
  //         //   // z: d.source.z,
  //         // },
  //         // target: {
  //         //   // id: d.target.id,
  //         //   index: d.target.index,
  //         //   // x: d.target.x,
  //         //   // y: d.target.y,
  //         //   // z: d.target.z,
  //         // },
  //       }));

  //       // TODO: How to compress
  //       downloadObjectAsJson({ nodes, links }, "graphData");
  //     });

  //   graph.scale.setScalar(0.5);

  //   return graph;
  // }, []);

  // useFrame(() => {
  //   graph.tickFrame();
  // });

  // ###########################################################################

  const forceGraphData = useStore((state) => state.forceGraphData);
  const nbParticles = forceGraphData.nodes.length;

  console.log(forceGraphData);

  const graphNodesMap = useStore((state) => state.graphNodesMap);

  const renderer = useThree((state) => state.gl);
  const setTooltipPosition = useForcegraphTooltipStore(
    (state) => state.setPosition,
  );
  const setTooltipData = useForcegraphTooltipStore((state) => state.setData);

  const results = useStore((state) => state.results);
  const setSelectedData = useStore((state) => state.setSelectedData);

  const pickedId = useRef(0);
  const prevPickedId = useRef(0);

  // RENDERING
  const POSITIONS_SCALE = 0.001;

  const sharedU = useMemo(() => {
    return {
      highlightTransition: uniform(0),
    };
  }, []);

  const {
    particleMesh,
    particlePickingMesh,
    particleHighlightAttribute,
    particleHighlightAttributeTo,
    particleResultsAttribute,
    particleUpdate,
    pickingTexture,
    pickingScene,
    uniforms,
    testMesh,
  } = useMemo(() => {
    const PARTICLE_QUAD_SIZE = 0.005;

    // PARTICLES ###############################################################

    // Uniforms
    const uniforms = {
      particleSize: uniform(1),
      particleOpacity: uniform(1),
      selectedId: uniform(0),
      hoveredId: uniform(0),
      // highlightTransition: uniform(0),
      ...sharedU,
    };

    // Storage buffers

    // TODO: Combine some of these buffers together
    const particlePositionsArray = [];
    const particlePickingColorsArray = [];
    const particleIdsArray = [];
    const particleHighlightArray = [];
    const particleSizesArray = [];
    const particleResultsArray = [];

    for (let i = 0; i < nbParticles; i++) {
      // Set positions
      const n = forceGraphData.nodes[i];

      particlePositionsArray.push(
        n.x * POSITIONS_SCALE,
        n.y * POSITIONS_SCALE,
        n.z * POSITIONS_SCALE,
        -1, // Life?
      );

      // Set picking data
      const id = i + 1;
      particleIdsArray.push(id);

      colorDummy.setHex(id, THREE.NoColorSpace);
      particlePickingColorsArray.push(colorDummy.r, colorDummy.g, colorDummy.b);

      particleHighlightArray.push(Math.random() > 0.5 ? 1 : 0);

      particleSizesArray.push(
        +authorsStatsMap.get(n.id)["h_index"] / hIndexMax,
      );

      particleResultsArray.push(0);
    }

    const particlePositions = storage(
      new THREE.StorageInstancedBufferAttribute(
        new Float32Array(particlePositionsArray),
        4,
      ),
      "vec4",
      nbParticles,
    );

    const particleHighlightAttribute =
      new THREE.StorageInstancedBufferAttribute(
        new Float32Array(particleHighlightArray),
        1,
      );
    const particleHighlight = storage(
      particleHighlightAttribute,
      "float",
      nbParticles,
    ).element(instanceIndex);

    const particleHighlightAttributeTo =
      new THREE.StorageInstancedBufferAttribute(
        new Float32Array(particleHighlightArray),
        1,
      );
    particleHighlightAttributeTo.setUsage(THREE.DynamicDrawUsage);
    const particleHighlightTo = storage(
      particleHighlightAttributeTo,
      "float",
      nbParticles,
    )
      .setPBO(true)
      .element(instanceIndex);

    const particleResultsAttribute = new THREE.StorageInstancedBufferAttribute(
      new Float32Array(particleResultsArray),
      1,
    );
    particleResultsAttribute.setUsage(THREE.DynamicDrawUsage);
    const particleResults = storage(
      particleResultsAttribute,
      "float",
      nbParticles,
    )
      .setPBO(true)
      .element(instanceIndex);

    // TODO: What's the difference between storage or nay?
    const particlePickingColor = instancedBufferAttribute(
      new THREE.InstancedBufferAttribute(
        new Float32Array(particlePickingColorsArray),
        3,
      ),
    );
    const particleId = instancedBufferAttribute(
      new THREE.InstancedBufferAttribute(new Float32Array(particleIdsArray), 1),
    );

    const particleSize = instancedBufferAttribute(
      new THREE.InstancedBufferAttribute(
        new Float32Array(particleSizesArray),
        1,
      ),
    );

    // renderer.computeAsync(
    //   Fn(() => {
    //     const r = randValue({ min: 0, max: 1, seed: 0 });
    //     particleHighlight.assign(step(0.9, r));
    //   })().compute(nbParticles)
    // );

    // TODO: How to dynamically update buffers or attributes?

    // Particles output
    const particleGeom = new THREE.PlaneGeometry(
      PARTICLE_QUAD_SIZE,
      PARTICLE_QUAD_SIZE,
    );
    // const particleGeom = new THREE.IcosahedronGeometry(PARTICLE_QUAD_SIZE);
    // TODO: Make it resemble the platonic shapes / building blocks of the universe

    // TODO: Could just use a mesh instead too?
    const particleMaterial = new THREE.SpriteNodeMaterial();

    // const particleMaterial = new THREE.MeshStandardNodeMaterial({});
    // const particleMaterial = new THREE.MeshBasicNodeMaterial({});

    // TODO: Switch between additive and depth; see simondev
    // particleMaterial.blending = THREE.AdditiveBlending;
    // particleMaterial.blending = THREE.NormalBlending;
    // particleMaterial.depthWrite = true;
    // particleMaterial.depthTest = true;

    particleMaterial.positionNode = particlePositions.toAttribute();

    // SIZE
    particleMaterial.scaleNode = Fn(() => {
      const startingSize = uniforms.particleSize;

      const finalSize = vec2(
        mix(startingSize, startingSize.add(5.0), particleSize),
      );

      finalSize.assign(mix(finalSize, finalSize.add(2), particleResults));

      return finalSize;
    })();

    const defaultColor = color("white");
    const resultsColor = color("#ffd230");

    // TODO: How to give the particles some depth to the colors; see simon
    // Or just change to mesh?
    const finalColor = Fn(() => {
      const isPicked = uniforms.selectedId.equal(particleId);

      // return mix(color("white"), color("red"), isPicked);

      const colorOffset = float(0);
      const colorVariance = 2;

      // const outputColor = hue(
      //   color(0x0000ff),
      //   colorOffset.add(
      //     mx_fractal_noise_float(
      //       instanceIndex.toFloat().mul(0.1),
      //       2,
      //       2.0,
      //       0.5,
      //       colorVariance
      //     )
      //   )
      // );

      const outputColor = defaultColor;

      const highlightColor = mix(
        outputColor.mul(0.05),
        outputColor,
        particleHighlight,
      );

      const finalColor = mix(
        outputColor,
        highlightColor,
        uniforms.highlightTransition,
      );

      finalColor.assign(mix(finalColor, resultsColor, particleResults));

      return finalColor;
    })();

    particleMaterial.colorNode = finalColor;
    // particleMaterial.colorNode = color("white");

    // TODO: Change emissive according to highlight
    // particleMaterial.emissiveNode = finalColor;
    // particleMaterial.emissiveNode = Fn(() => {
    //   const outputColor = mix(defaultColor, resultsColor, particleResults);

    //   const defaultEmissive = 3.0;
    //   const highlightEmissive = mix(-0.9, 10.0, particleHighlight);

    //   return mix(
    //     outputColor.add(defaultEmissive),
    //     outputColor.add(highlightEmissive),
    //     uniforms.highlightTransition
    //   );
    // })();
    particleMaterial.emissiveNode = Fn(() => {
      const outputColor = defaultColor;

      const defaultEmissive = 1.5;
      const highlightEmissive = mix(0.1, 10.0, particleHighlight);

      const finalEmissive = mix(
        outputColor.mul(defaultEmissive),
        outputColor.mul(highlightEmissive),
        uniforms.highlightTransition,
      );

      // Results emissive is always the same
      finalEmissive.assign(
        mix(finalEmissive, resultsColor.mul(100), particleResults),
      );

      return finalEmissive;
    })();

    // TODO: More glowy
    particleMaterial.opacityNode = Fn(() => {
      const dist = uv().xy.sub(0.5).length();
      const circle = smoothstep(0.5, 0.3, dist);
      const life = particlePositions.toAttribute().w;

      // TODO: Don't deal with any alpha values other than 0

      // const defaultOpacity = uniforms.particleOpacity;

      // const highlightOpacity = mix(0.2, 1, particleHighlight);

      // return mix(
      //   defaultOpacity,
      //   highlightOpacity,
      //   uniforms.highlightTransition
      // ).mul(circle);

      return circle;
    })();

    const particleMesh = new THREE.InstancedMesh(
      particleGeom,
      particleMaterial,
      nbParticles,
    );
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;

    // Picking mesh
    const particlePickingMesh = particleMesh.clone();

    particlePickingMesh.material = particlePickingMesh.material.clone();
    particlePickingMesh.material.blending = THREE.NormalBlending;
    particlePickingMesh.material.depthWrite = true;
    particlePickingMesh.material.colorNode = particlePickingColor;

    particlePickingMesh.material.opacityNode = float(1);

    // GPGPU
    const particleUpdate = Fn(() => {
      particleHighlight.assign(
        // TODO: Scale by delta?
        mix(particleHighlight, particleHighlightTo, 0.1),
      );
    })().compute(nbParticles);

    // GPU PICKING ###########################################################
    const pickingScene = new THREE.Scene();

    const pickingTexture = new THREE.RenderTarget(1, 1);

    pickingScene.add(particlePickingMesh);

    return {
      particleMesh,
      particlePickingMesh,
      particleHighlightAttribute,
      particleHighlightAttributeTo,
      particleResultsAttribute,
      particleUpdate,
      pickingScene,
      pickingTexture,
      uniforms,
    };
  }, []);

  const { linksMesh, nbVertices, linksHighlightSBA, updateLinks, nbLinks } =
    useMemo(() => {
      const output = createLinksMesh(forceGraphData, POSITIONS_SCALE, sharedU);

      return output;
    }, []);

  // FUNCTIONS ##################################################################
  const highlightGraph = useCallback((idxs) => {
    // Update attributes
    const newParticleHighlightArray = new Float32Array(nbParticles);
    // const newLinksHighlightArray = new Float32Array(nbVertices);
    const newLinksHighlightArray = new Float32Array(nbLinks);

    idxs.forEach((idx) => {
      newParticleHighlightArray[idx] = 1;
    });

    const idxsSet = new Set(idxs);

    // TODO: Build a hash map for this?
    // Grab neighbouring nodes
    forceGraphData.links.forEach((l, linkIdx) => {
      // Highlight nodes
      if (idxsSet.has(l.source.index)) {
        newParticleHighlightArray[l.target.index] = 1;
      } else if (idxsSet.has(l.target.index)) {
        newParticleHighlightArray[l.source.index] = 1;
      }

      // Highlight links
      if (idxsSet.has(l.source.index) || idxsSet.has(l.target.index)) {
        // newLinksHighlightArray[linkIdx * 4] = 1;
        // newLinksHighlightArray[linkIdx * 4 + 1] = 1;
        // newLinksHighlightArray[linkIdx * 4 + 2] = 1;
        // newLinksHighlightArray[linkIdx * 4 + 3] = 1;

        newLinksHighlightArray[linkIdx] = 1;
      }
    });

    // TODO: Is this efficient?
    particleHighlightAttributeTo.copyArray(newParticleHighlightArray);
    particleHighlightAttributeTo.needsUpdate = true;

    linksHighlightSBA.copyArray(newLinksHighlightArray);
    linksHighlightSBA.needsUpdate = true;

    // TODO: Use gpu compute for all the transitions?
    gsap.to(sharedU.highlightTransition, {
      value: 1,
      duration: 0.8,
      ease: "power3.out",
      overwrite: true,
    });
  }, []);

  // CONTROLS ##################################################################
  const particleControls = useControls("Particles", {
    highlightTransition: { value: 0, min: 0, max: 1, step: 0.01 },
  });

  useEffect(() => {
    uniforms.highlightTransition.value = particleControls.highlightTransition;
  }, [particleControls]);

  // INTERACTIONS ##############################################################
  useEffect(() => {
    let drag = false;

    const mouseDown = () => {
      drag = false;
    };
    const mouseMove = (e) => {
      drag = true;

      if (pickedId.current > 0) {
        setTooltipPosition({
          x: e.clientX,
          y: e.clientY,
        });
      }

      // NOTE: Only run when picking up a different id
      if (pickedId.current !== prevPickedId.current) {
        // If hovering over a particle
        if (pickedId.current > 0) {
          document.body.style.cursor = "pointer";

          // Set tooltip information
          setTooltipData({
            id: forceGraphData.nodes[pickedId.current - 1].id,
          });
        } else {
          document.body.style.cursor = "auto";

          setTooltipData(null);
        }

        prevPickedId.current = pickedId.current;
      }
    };

    const mouseUp = () => {
      if (drag) return;

      // TODO: How to differentiate this from drag and other controls?

      uniforms.selectedId.value = pickedId.current;

      // If pickedId changes, update
      // if (pickedId.current !== prevPickedId.current) {
      if (pickedId.current === 0) {
        gsap.to(uniforms.highlightTransition, {
          value: 0,
          duration: 0.5,
          ease: "power3.in",
          overwrite: true,
        });

        setSelectedData(null);
      } else {
        const idx = pickedId.current - 1;

        highlightGraph([idx]);

        setSelectedData({
          id: forceGraphData.nodes[idx].id,
        });
      }
    };

    const mouseOut = () => {
      setTooltipData(null);
    };

    const canvasEl = document.querySelector("canvas");

    canvasEl.addEventListener("mousedown", mouseDown);
    canvasEl.addEventListener("mousemove", mouseMove);
    canvasEl.addEventListener("mouseup", mouseUp);
    canvasEl.addEventListener("mouseout", mouseOut);

    return () => {
      canvasEl.removeEventListener("mousedown", mouseDown);
      canvasEl.removeEventListener("mousemove", mouseMove);
      canvasEl.removeEventListener("mouseup", mouseUp);
      canvasEl.removeEventListener("mouseout", mouseOut);
    };
  }, []);

  // CONTROLS ##################################################################

  // ON RESULTS CHANGE
  useEffect(() => {
    const newParticleResultsArray = new Float32Array(nbParticles);

    // Highlight result nodes
    const resultsIdxs = Object.values(results.names).map((d) => {
      if (d.is_in_aps === "false") return;

      const id = (+d.id_author_oa).toString();

      const node = graphNodesMap.get(id);
      if (!node) return;

      const idx = node.index;

      newParticleResultsArray[idx] = 1;

      return idx;
    });

    particleResultsAttribute.copyArray(newParticleResultsArray);
    particleResultsAttribute.needsUpdate = true;

    highlightGraph(resultsIdxs);
  }, [results]);

  // RENDER LOOP ###############################################################
  useFrame(({ gl = renderer, pointer, camera, size, scene }, delta) => {
    // TODO: Should I be running this every frame?
    // COMPUTES ################################################################
    renderer.compute(particleUpdate);
    renderer.compute(updateLinks);

    const mouseX = ((pointer.x + 1) / 2) * size.width;
    const mouseY = ((1 - pointer.y) / 2) * size.height;

    // GPU PICKING #############################################################
    const pixelRatio = renderer.getPixelRatio();

    camera.setViewOffset(
      renderer.domElement.width, // full width
      renderer.domElement.height, // full top
      Math.floor(mouseX * pixelRatio), // rect x
      Math.floor(mouseY * pixelRatio), // rect y
      1, // rect width
      1, // rect height
    );

    renderer.setRenderTarget(pickingTexture);

    renderer.render(pickingScene, camera);

    // Restore active render target to canvas
    renderer.setRenderTarget(null);

    // Clear the view offset so rendering returns to normal
    camera.clearViewOffset();

    renderer
      .readRenderTargetPixelsAsync(pickingTexture, 0, 0, 1, 1, 0)
      .then((pixelBuffer) => {
        pickedId.current =
          (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | pixelBuffer[2];
      });

    // TRANSITIONS #############################################################
    // TODO: How about just using gsap?
    // if (isHighlight.current) {
    //   damp(uniforms.highlightTransition, "value", 1, 0.25, delta);
    // } else {
    //   damp(uniforms.highlightTransition, "value", 0, 0.25, delta);
    // }
  });

  return (
    <>
      {/* <primitive object={graph} /> */}

      <primitive object={linksMesh} />

      <primitive object={particleMesh} renderOrder={1} />

      {/* <primitive object={particlePickingMesh} renderOrder={1} /> */}

      <Texts positionsScale={POSITIONS_SCALE} />
    </>
  );
};

export default ForceGraph;
