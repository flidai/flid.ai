// The word "flid" as real 3D letters in Geist. They rise out of the floor one at a time as the
// section scrolls in, stand on their own reflection, and a slow band of light crosses them.
import * as THREE from "/assets/vendor/three.mjs";
import { FLID_WORD } from "/assets/flid-word.js";
import { createPointer } from "/assets/motion.js";
import { breathe, clamp, createRenderer, runScene, smooth } from "/assets/stage.js";

const DEPTH = 0.13;

function letterGeometry({ path }) {
  const shapes = new THREE.ShapePath();
  const calls = { moveTo: "moveTo", lineTo: "lineTo", quadraticCurveTo: "quadraticCurveTo", bezierCurveTo: "bezierCurveTo" };
  for (const [command, ...args] of path) {
    if (calls[command]) shapes[command](...args);
  }
  const geometry = new THREE.ExtrudeGeometry(shapes.toShapes(false), {
    depth: DEPTH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12,
  });
  geometry.computeBoundingBox();
  return geometry;
}

function letterMaterial(shared, mirror) {
  const material = new THREE.MeshStandardMaterial({ color: 0x151d2c, metalness: 0.92, roughness: 0.26, transparent: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uOffset;\nvarying vec3 vWord;\nvarying float vFront;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vWord = vec3(position.x + uOffset, position.y, position.z);
        vFront = smoothstep(0.55, 0.95, normal.z);`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform float uTime, uSweep, uWidth;
        varying vec3 vWord;
        varying float vFront;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float along = clamp(vWord.x / uWidth, 0.0, 1.0);
        // The same white-to-blue as the flat wordmark, so the brand stays the same.
        vec3 face = mix(vec3(0.95, 0.98, 1.0), vec3(0.36, 0.7, 1.0), smoothstep(0.02, 0.5, along));
        face = mix(face, vec3(0.06, 0.32, 1.0), smoothstep(0.5, 1.0, along));
        float band = along + vWord.y * 0.28 - uSweep;
        float light = exp(-band * band * 70.0);
        float rim = 1.0 - vFront;
        totalEmissiveRadiance += face * vFront * (1.02 + light * 0.75);
        totalEmissiveRadiance += face * rim * (0.03 + light * 0.6);
        ${mirror ? "totalEmissiveRadiance *= 0.5;" : ""}`)
      .replace("#include <opaque_fragment>", `outgoingLight = mix(outgoingLight, totalEmissiveRadiance, vFront * 0.92);\n#include <opaque_fragment>`)
      .replace("#include <opaque_fragment>", `${mirror ? "diffuseColor.a *= 0.5 * (1.0 - smoothstep(0.0, 0.34, vWord.y));" : ""}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => (mirror ? "word-mirror" : "word");
  return material;
}

export async function startWord(canvas, host, { still = false } = {}) {
  let renderer;
  try {
    renderer = createRenderer(canvas);
  } catch {
    canvas.remove();
    return;
  }
  await breathe();

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x161c28, 1.8));
  const key = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  key.position.set(-2, 3, 4);
  const warm = new THREE.DirectionalLight(0xff9a55, 1.3);
  warm.position.set(4, -1, 2);
  scene.add(key, warm);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.z = 1 / Math.tan((12 * Math.PI) / 180);

  const model = new THREE.Group();
  scene.add(model);
  const word = new THREE.Group();
  model.add(word);
  const time = { value: 0 }, sweep = { value: 0 }, wordWidth = { value: FLID_WORD.width };

  const letters = [];
  for (const [i, letter] of FLID_WORD.letters.entries()) {
    const geometry = letterGeometry(letter);
    const box = geometry.boundingBox;
    const middle = (box.min.x + box.max.x) / 2;
    geometry.translate(-middle, 0, -DEPTH / 2);
    const shared = { uTime: time, uSweep: sweep, uWidth: wordWidth, uOffset: { value: letter.x + middle } };
    const upright = new THREE.Mesh(geometry, letterMaterial(shared, false));
    const mirrored = new THREE.Mesh(geometry, letterMaterial(shared, true));
    mirrored.scale.y = -1;
    upright.renderOrder = 2;
    mirrored.renderOrder = 1;
    word.add(mirrored, upright);
    letters.push({ upright, mirrored, x: letter.x + middle - FLID_WORD.width / 2, i });
    await breathe();
  }

  // A pool of light on the floor under the word.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vP; void main(){ vP = position.xz * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uGlow; varying vec2 vP;
      void main(){ float d = length(vP); gl_FragColor = vec4(mix(vec3(0.2, 0.45, 1.0), vec3(0.75, 0.88, 1.0), exp(-d * d * 6.0)) * exp(-d * d * 3.4) * uGlow, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`,
  }));
  floor.scale.set(FLID_WORD.width * 1.7, 1, 1.5);
  floor.renderOrder = 0;
  word.add(floor);


  const pointer = createPointer(still);
  const start = performance.now();
  let width = 1, height = 1, shown = still ? 1 : 0;

  const target = () => {
    const box = host.getBoundingClientRect();
    return clamp((innerHeight * 0.96 - box.top) / (innerHeight * 0.72));
  };
  const draw = (now, delta) => {
    shown = still ? 1 : shown + (target() - shown) * (1 - Math.exp(-delta / 170));
    const t = still ? 6 : (now - start) / 1000;
    time.value = t;
    sweep.value = still ? 0.45 : ((t * 0.11) % 1) * 1.8 - 0.3;
    pointer.ease(delta);

    for (const { upright, mirrored, x, i } of letters) {
      // Each letter climbs out of the floor and turns to face the visitor.
      const on = smooth(i * 0.13, 0.52 + i * 0.13, shown), away = 1 - on;
      const side = i % 2 ? 1 : -1;
      const lift = -0.82 * away, turnY = side * away * 1.15, turnX = away * 0.5;
      upright.position.set(x, lift, away * -0.4);
      upright.rotation.set(turnX, turnY, 0);
      mirrored.position.set(x, -lift, away * -0.4);
      mirrored.rotation.set(-turnX, turnY, 0);
      upright.material.opacity = smooth(0, 0.3, on);
      mirrored.material.opacity = smooth(0.2, 0.7, on);
    }
    floor.material.uniforms.uGlow.value = shown * 0.3;

    const aspect = width / height;
    // Fits the whole word inside the soft edge of the canvas.
    const scale = (1.29 * aspect) / FLID_WORD.width;
    model.scale.setScalar(scale);
    word.position.y = -0.02;
    model.position.y = -0.3;
    model.rotation.set(0.17 + pointer.y * 0.04, -0.2 + Math.sin(t * 0.22) * 0.1 + pointer.x * 0.14, 0);

    renderer.render(scene, camera);
  };

  // Prepare the shaders without blocking the page. The flat word shows until this is ready.
  camera.updateProjectionMatrix();
  await renderer.compileAsync(scene, camera);
  host.classList.add("is-3d");
  runScene({
    canvas, renderer, still, draw,
    watch: host,
    onResize: (w, h) => {
      width = w; height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  });
}
