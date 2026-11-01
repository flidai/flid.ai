// The core: metal plates fly in and lock into a sphere around a glowing heart while
// the visitor scrolls, then rings close around it. Rendered with three.js.
import * as THREE from "/assets/vendor/three.mjs";
import { SHELL_AXIS, buildShell } from "/assets/core-geometry.js";
import { clamp, createRenderer, runScene } from "/assets/stage.js";

const RADIUS = 1.45; // The model, rings included, fits inside this.

export function shellMaterial(uniforms) {
  const material = new THREE.MeshStandardMaterial({ color: 0x161c28, metalness: 0.9, roughness: 0.34 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        attribute vec3 aCenter;
        attribute vec3 aInfo;
        uniform float uBuild, uOpen;
        varying float vGlow, vFlash, vLift;
        float flyE;
        vec3 flyAxis;
        vec3 turned(vec3 v, float angle) {
          float c = cos(angle), s = sin(angle);
          return v * c + cross(flyAxis, v) * s + flyAxis * dot(flyAxis, v) * (1.0 - c);
        }`)
      .replace("#include <beginnormal_vertex>", `
        float flyStart = aInfo.x;
        float t = clamp((uBuild - flyStart) / 0.2, 0.0, 1.0);
        flyE = 1.0 - pow(1.0 - t, 3.0);
        flyAxis = normalize(vec3(sin(aInfo.y * 91.0), cos(aInfo.y * 47.0), sin(aInfo.y * 23.0) + 0.01));
        vec3 objectNormal = turned(normal, (1.0 - flyE) * 3.4);`)
      .replace("#include <begin_vertex>", `
        float away = 1.0 - flyE;
        vec3 flown = aCenter * (1.0 + away * (1.5 + aInfo.y * 2.4)) + flyAxis * away * 0.8;
        float swirl = away * 1.5;
        flown.xz = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl)) * flown.xz;
        vec3 splitAxis = vec3(${SHELL_AXIS.join(", ")});
        flown += splitAxis * sign(dot(aCenter, splitAxis)) * uOpen;
        vec3 transformed = flown + turned(position, away * 3.4) * smoothstep(0.0, 0.12, t);
        vGlow = aInfo.z;
        vFlash = smoothstep(0.55, 0.95, t) * (1.0 - smoothstep(0.97, 1.0, t)) + away * 0.35;
        vLift = aCenter.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform float uTime, uDim;
        varying float vGlow, vFlash, vLift;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float wave = 0.5 + 0.5 * sin(vLift * 3.2 - uTime * 0.7);
        vec3 seam = mix(vec3(0.16, 0.42, 1.0), vec3(1.0, 0.52, 0.2), smoothstep(0.1, 0.9, wave));
        totalEmissiveRadiance += seam * vGlow * (0.42 + wave * wave * 0.9 + vFlash * 2.4) * (1.0 - uDim);`);
  };
  return material;
}

export function heartMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vNormalView, vPos;
      void main() {
        vPos = position;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime, uHeart;
      varying vec3 vNormalView, vPos;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      float clouds(vec3 p) {
        return noise(p) * 0.55 + noise(p * 2.1 + 3.1) * 0.3 + noise(p * 4.3 + 7.7) * 0.15;
      }
      void main() {
        vec3 p = normalize(vPos) * 2.4;
        vec3 drift = vec3(uTime * 0.05, -uTime * 0.07, uTime * 0.04);
        float flow = clouds(p + drift + 1.5 * clouds(p * 0.8 - drift));
        float ridge = pow(1.0 - abs(flow * 2.0 - 1.0), 7.0);
        float face = clamp(vNormalView.z, 0.0, 1.0);
        vec3 color = mix(vec3(0.03, 0.1, 0.5), vec3(0.85, 0.32, 0.08), smoothstep(0.1, 0.95, face));
        color = mix(color, vec3(1.0, 0.66, 0.36), face * face * face * 0.4);
        color *= 0.38 + 0.5 * smoothstep(0.3, 0.7, flow);
        color += mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.72, 0.45), face) * ridge * 0.7;
        gl_FragColor = vec4(color * uHeart, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Fine dust gathers from far away into a slow disc around the sphere.
function dust(count, uniforms) {
  let state = 0x1f3d;
  const random = () => { state = (Math.imul(state, 48271) >>> 0) % 2147483647; return state / 2147483647; };
  const info = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    info.set([random() * Math.PI * 2, 1.12 + random() ** 1.6 * 0.5, random(), (random() - 0.5) * 0.06], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aDust", new THREE.BufferAttribute(info, 4));
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aDust;
      uniform float uTime, uBuild, uPx;
      varying vec3 vColor;
      void main() {
        float angle = aDust.x + uTime * 0.14 / aDust.y, seed = aDust.z;
        vec3 disc = vec3(cos(angle) * aDust.y, aDust.w, sin(angle) * aDust.y);
        float gather = 1.0 - smoothstep(seed * 0.2, 0.3 + seed * 0.3, uBuild);
        vec3 far = vec3(sin(seed * 411.0), cos(seed * 173.0), sin(seed * 57.0)) * (2.0 + seed * 2.0);
        vec4 view = modelViewMatrix * vec4(mix(disc, far, gather), 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = uPx * (0.9 + fract(seed * 19.0) * 1.3) * 3.6 / -view.z;
        float fade = 1.0 - smoothstep(1.2, 1.62, aDust.y);
        vColor = mix(vec3(1.0, 0.6, 0.32), vec3(0.45, 0.68, 1.0), fract(seed * 7.0)) * (0.2 + 0.8 * fade) * (0.08 + fract(seed * 29.0) * 0.2);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor * (1.0 - smoothstep(0.08, 0.5, length(gl_PointCoord - 0.5))), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

// A soft light around the heart, the cheap stand-in for a full-screen glow pass.
function halo(uniforms) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uHeart; varying vec2 vP;
      void main(){ float d = length(vP); vec3 c = mix(vec3(0.22, 0.42, 1.0), vec3(1.0, 0.56, 0.24), exp(-d * d * 1.5));
        gl_FragColor = vec4(c * exp(-d * d * 1.25) * 0.13 * uHeart, 1.0); }`,
  }));
  mesh.renderOrder = 30;
  return mesh;
}

export async function startCore(canvas, thesis, { still = false } = {}) {
  let renderer;
  try {
    renderer = createRenderer(canvas);
  } catch {
    canvas.remove();
    return;
  }
  const host = canvas.parentElement;
  const phone = Math.min(innerWidth, innerHeight) < 600;
  const uniforms = { uTime: { value: 0 }, uBuild: { value: 0 }, uHeart: { value: 0 }, uPx: { value: 2 } };

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xbfd8ff, 2.2);
  key.position.set(2.5, 3, 4);
  const warm = new THREE.DirectionalLight(0xff9a55, 1.5);
  warm.position.set(-4, -2, 2);
  scene.add(key, warm);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  camera.position.z = 1 / Math.tan((14 * Math.PI) / 180);

  const model = new THREE.Group();
  scene.add(model);
  const spin = new THREE.Group();
  model.add(spin);
  spin.quaternion.setFromUnitVectors(new THREE.Vector3(...SHELL_AXIS), new THREE.Vector3(0.22, 0.95, 0.18).normalize());
  const turning = new THREE.Group();
  spin.add(turning);

  const { data, stride } = buildShell(phone ? 5 : 7);
  const geometry = new THREE.BufferGeometry();
  const buffer = (offset, size) => {
    const values = new Float32Array((data.length / stride) * size);
    for (let i = 0, j = offset; i < values.length; i += size, j += stride) {
      for (let n = 0; n < size; n += 1) values[i + n] = data[j + n];
    }
    return new THREE.BufferAttribute(values, size);
  };
  geometry.setAttribute("position", buffer(0, 3));
  geometry.setAttribute("normal", buffer(3, 3));
  geometry.setAttribute("aCenter", buffer(6, 3));
  geometry.setAttribute("aInfo", buffer(9, 3));
  const shell = new THREE.Mesh(geometry, shellMaterial(uniforms));
  shell.frustumCulled = false;
  turning.add(shell);

  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.66, 40, 28), heartMaterial(uniforms));
  turning.add(heart);
  const disc = dust(phone ? 1800 : 4000, uniforms);
  disc.rotation.x = 0.34;
  spin.add(disc);
  model.add(halo(uniforms));

  // Three thin rings that swing in and close around the finished sphere.
  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x8ea3bd, metalness: 1, roughness: 0.24, emissive: 0x4d82ff, emissiveIntensity: 0.28 });
  const rings = [[1.2, 0.009, 1.1, 0.3], [1.3, 0.006, -0.7, 1.2], [1.41, 0.011, 0.36, 2.1]].map(([radius, tube, tilt, turn]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 160), ringMaterial);
    ring.userData = { tilt, turn };
    model.add(ring);
    return ring;
  });

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const start = performance.now();
  let width = 1, height = 1, wide = true, build = 0;
  const shown = () => clamp((scrollY - thesis.offsetTop * 0.2) / (thesis.offsetTop * 0.7));
  const progress = () => clamp((scrollY - thesis.offsetTop) / Math.max(1, thesis.offsetHeight - innerHeight));

  const draw = (now, delta) => {
    const place = progress();
    // Whole before the second sentence ends, then it holds and turns.
    const target = still ? 1.2 : clamp(place / 0.82) * 1.2;
    build = still ? 1.2 : build + (target - build) * (1 - Math.exp(-delta / 170));
    if (Math.abs(target - build) < 0.0005) build = target;
    const time = still ? 12 : (now - start) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    uniforms.uTime.value = time;
    uniforms.uBuild.value = build;
    uniforms.uHeart.value = 0.6 + 0.4 * clamp(build / 0.2);

    // The model crosses the screen only while both sentences are hidden.
    const aspect = width / height;
    const cross = still ? 1 : clamp((place - 0.44) / 0.12);
    const shift = (cross * cross * (3 - 2 * cross) * 2 - 1) * 0.5;
    const scale = wide ? Math.min(0.74, 0.45 * aspect) : height > width ? Math.min(0.46, 0.86 * aspect) : 0.34;
    const lower = wide ? Math.min(-0.03, 1 - 150 / height - scale - 0.01) : height > width ? 0.26 : 0.18;
    model.scale.setScalar(scale / RADIUS);
    model.position.set((wide ? shift : 0) * aspect, lower, 0);

    turning.rotation.y = 0.4 + place * 2.4 + time * 0.05;
    spin.rotation.z = pointer.x * -0.05;
    model.rotation.set(0.18 + pointer.y * 0.06, pointer.x * 0.14, 0);

    rings.forEach((ring, i) => {
      const e = clamp((build - 0.92 - i * 0.05) / 0.14), settle = 1 - (1 - e) ** 3;
      ring.visible = e > 0;
      ring.scale.setScalar(1 + (1 - settle) * 0.16);
      ring.rotation.set(Math.PI / 2 + ring.userData.tilt + time * 0.045 * (i + 1) * (i % 2 ? -1 : 1), ring.userData.turn + time * 0.03, (1 - settle) * 2.4);
    });
    renderer.render(scene, camera);
  };

  // Prepare the shaders without blocking the page, then start.
  camera.updateProjectionMatrix();
  await renderer.compileAsync(scene, camera);
  runScene({
    canvas, renderer, still, draw,
    watch: document.querySelector("[data-bloom-zone]") ?? thesis,
    // Nothing is drawn until the canvas can be seen.
    shouldDraw: () => shown() > 0,
    onResize: (w, h) => {
      width = w; height = h;
      wide = w > 720 && w > h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      uniforms.uPx.value = Math.max(1.6, 1.3 * renderer.getPixelRatio()) * (phone ? 1 : 1.15);
    },
  });
  host.classList.add("core-ready");
  if (!still) addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointer.tx = (event.clientX / innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}
