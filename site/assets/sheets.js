// The three layers: real 3D sheets with their own objects, shown one at a time. As the visitor
// scrolls, the current sheet lifts away and the next rises into its place, its objects growing out of it.
import * as THREE from "/assets/vendor/three.mjs";
import { createPointer } from "/assets/motion.js";
import { clamp, createRenderer, runScene, smooth } from "/assets/stage.js";

const hash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

const SHEETS = [
  { id: "data", label: "GOVERNED DATA", tint: 0x4493f8 },
  { id: "actions", label: "EXPLICIT ACTIONS", tint: 0xeaa86e },
  { id: "evidence", label: "EVIDENCE", tint: 0x9fd2ff },
];
const RADIUS = 0.11, THICK = 0.022;

const sheetFragment = `
  uniform float uOn, uFade, uTime, uKind;
  uniform vec3 uTint;
  uniform vec2 uHit[3];
  varying vec2 vP;
  varying float vTop;
  float line(vec2 f) {
    vec2 w = fwidth(f), d = abs(fract(f - 0.5) - 0.5) / w;
    return 1.0 - min(min(d.x, d.y), 1.0);
  }
  float rand(float n) { return fract(sin(n * 91.7) * 4371.3); }
  void main() {
    vec2 q = abs(vP) - vec2(1.0 - ${RADIUS.toFixed(3)});
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${RADIUS.toFixed(3)};
    vec3 tint = uTint;
    if (vTop < 0.5) {
      // The polished edge of the sheet catches the light.
      gl_FragColor = vec4(tint * (0.14 + uOn * 1.5), uFade);
#include <tonemapping_fragment>
#include <colorspace_fragment>
      return;
    }
    vec2 f = (vP + 1.0) * 4.5;
    float grid = line(f);
    vec3 color = vec3(0.012, 0.02, 0.038) + tint * grid * (0.018 + uOn * 0.07);

    // A soft reflection that drifts across the surface, so it reads as a real material.
    float band = (vP.x + vP.y) * 0.7 - sin(uTime * 0.22) * 1.3;
    color += vec3(0.5, 0.65, 0.95) * exp(-band * band * 6.0) * (0.012 + uOn * 0.03);

    // Inner light gathered at the rim.
    color += tint * exp(d * 7.0) * (0.015 + uOn * (uKind > 1.5 ? 0.05 : 0.16));

    // The rim itself, with a point of light running around it.
    float rim = 1.0 - smoothstep(0.0, max(0.012, fwidth(d) * 1.6), abs(d));
    float around = atan(vP.y, vP.x) / 6.28318;
    float runner = pow(fract(around - uTime * 0.11), 16.0) + pow(fract(around - uTime * 0.11 + 0.5), 16.0);
    color += mix(vec3(0.3, 0.42, 0.6), tint, uOn) * rim * (0.22 + uOn * 1.1 + runner * uOn * 4.0);

    if (uKind < 0.5) {
      // Data: signals travelling along the grid lines.
      vec2 id = floor(f + 0.5);
      vec2 nearLine = abs(f - id) / fwidth(f);
      float across = pow(fract(vP.x * 0.5 + uTime * (0.12 + rand(id.y) * 0.2) + rand(id.y + 3.0)), 26.0) * (1.0 - min(nearLine.y, 1.0));
      float down = pow(fract(vP.y * 0.5 + uTime * (0.1 + rand(id.x + 9.0) * 0.2) + rand(id.x)), 26.0) * (1.0 - min(nearLine.x, 1.0));
      color += tint * (across + down) * uOn * 3.0;
    } else if (uKind > 1.5) {
      // Evidence: a line of light reads across the sheet.
      float scan = vP.y + 1.1 - fract(uTime * 0.16) * 2.2;
      color += tint * exp(-scan * scan * 90.0) * uOn * 0.5;
    }
    // Ripples where the agents touch down.
    for (int i = 0; i < 3; i++) {
      float age = fract(uTime * 0.42 + float(i) * 0.33);
      float ring = length(vP - uHit[i]) - age * 0.8;
      color += tint * exp(-ring * ring * 420.0) * (1.0 - age) * uOn * 0.45;
    }
    gl_FragColor = vec4(color, 0.9 * uFade);
#include <tonemapping_fragment>
#include <colorspace_fragment>
  }`;

const glowFragment = `
  uniform float uOn;
  uniform vec3 uTint;
  varying vec2 vP;
  void main() {
    vec2 q = abs(vP) - vec2(0.89);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.11;
    float halo = exp(-max(d, 0.0) * 7.0) * step(0.0, d + 0.02);
    gl_FragColor = vec4(uTint * halo * (uOn * 0.3), 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
  }`;

const planeVertex = `
  attribute float aTop;
  varying vec2 vP;
  varying float vTop;
  void main() {
    vP = position.xz;
    vTop = aTop;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

function slabGeometry() {
  const outline = [], half = 1 - RADIUS;
  for (let corner = 0; corner < 4; corner += 1) {
    const cx = corner === 0 || corner === 3 ? half : -half, cz = corner < 2 ? half : -half;
    for (let i = 0; i <= 8; i += 1) {
      const angle = (corner * Math.PI) / 2 + (i / 8) * (Math.PI / 2);
      outline.push([cx + Math.cos(angle) * RADIUS, cz + Math.sin(angle) * RADIUS]);
    }
  }
  const position = [], top = [];
  const push = (x, y, z, t) => { position.push(x, y, z); top.push(t); };
  outline.forEach(([x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    push(0, THICK, 0, 1); push(nx, THICK, nz, 1); push(x, THICK, z, 1);
    push(x, THICK, z, 0); push(nx, THICK, nz, 0); push(nx, -THICK, nz, 0);
    push(x, THICK, z, 0); push(nx, -THICK, nz, 0); push(x, -THICK, z, 0);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute("aTop", new THREE.BufferAttribute(new Float32Array(top), 1));
  return geometry;
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const MONO = 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace';

function labelMesh(text) {
  const texture = canvasTexture(1400, 140, (c, w, h) => {
    c.font = `600 96px ${MONO}`;
    c.textBaseline = "middle";
    c.fillStyle = "#fff";
    c.letterSpacing = "6px";
    c.fillText(text, 4, h / 2);
  });
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, color: 0xbfd8ff });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.32, 0.232), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(-0.86 + 1.16, THICK + 0.002, 0.82);
  return mesh;
}

// Data: columns of a live chart grow up out of the grid.
function dataObjects(tint) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x18263f, metalness: 0.7, roughness: 0.3, emissive: tint, emissiveIntensity: 0.17 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vHeight;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHeight = position.y + 0.5;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vHeight;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.15 + vHeight * vHeight * 5.0;");
  };
  const box = new THREE.BoxGeometry(1, 1, 1), bars = [];
  for (let x = 0; x < 6; x += 1) {
    for (let z = 0; z < 6; z += 1) {
      const seed = x * 7 + z * 13 + 1;
      const px = -0.62 + x * 0.25, pz = -0.72 + z * 0.25;
      if (hash(seed) < 0.3 || (pz > 0.5 && px < 0.2)) continue;
      const bar = new THREE.Mesh(box, material);
      bar.position.set(px, 0, pz);
      bar.scale.set(0.15, 0.001, 0.15);
      bar.userData = { height: 0.14 + hash(seed + 5) * 0.56, seed };
      group.add(bar);
      bars.push(bar);
    }
  }
  return {
    group,
    update(on, time) {
      group.visible = on > 0.01;
      for (const bar of bars) {
        const { height, seed } = bar.userData;
        const h = Math.max(0.001, on * height * (0.82 + 0.18 * Math.sin(time * 0.8 + seed)));
        bar.scale.y = h;
        bar.position.y = THICK + h / 2;
      }
    },
  };
}

// Actions: tiles rise and are approved one at a time. One is always refused.
function actionObjects() {
  const group = new THREE.Group();
  const icon = (draw) => canvasTexture(160, 160, (c) => {
    c.strokeStyle = "#fff"; c.lineWidth = 19; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); draw(c); c.stroke();
  });
  const allow = icon((c) => { c.moveTo(38, 84); c.lineTo(68, 114); c.lineTo(124, 50); });
  const deny = icon((c) => { c.moveTo(48, 48); c.lineTo(112, 112); c.moveTo(112, 48); c.lineTo(48, 112); });
  const box = new THREE.BoxGeometry(0.46, 0.06, 0.46), plane = new THREE.PlaneGeometry(0.3, 0.3);
  const tiles = [];
  for (let i = 0; i < 6; i += 1) {
    const refused = i === 4;
    const material = new THREE.MeshStandardMaterial({ color: 0x1c2638, metalness: 0.75, roughness: 0.28, emissive: refused ? 0xeaa86e : 0x35d48a, emissiveIntensity: 0 });
    const tile = new THREE.Mesh(box, material);
    tile.position.set(-0.56 + (i % 3) * 0.56, 0, -0.5 + Math.floor(i / 3) * 0.6);
    const mark = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: refused ? deny : allow, transparent: true, depthWrite: false, color: refused ? 0xeaa86e : 0x7ee2a8 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.032;
    tile.add(mark);
    tile.userData = { index: i, mark, refused };
    group.add(tile);
    tiles.push(tile);
  }
  return {
    group,
    tiles,
    lit: 0,
    update(on, time) {
      this.lit = Math.floor(time * 0.8) % 6;
      for (const tile of tiles) {
        const { index, mark } = tile.userData;
        const age = ((time * 0.8 - index) % 6 + 6) % 6;
        const flash = age < 1 ? 1 - age : 0, stay = smooth(0, 0.25, age) * (1 - smooth(4.6, 5.8, age));
        tile.position.y = THICK + 0.03 + on * (0.045 + index * 0.012 + flash * 0.09);
        tile.visible = on > 0.01;
        tile.material.emissiveIntensity = on * (0.04 + stay * 0.1 + flash * 0.9);
        mark.material.opacity = on * (0.22 + stay * 0.78);
        mark.material.color.set(tile.userData.refused ? 0xeaa86e : 0x7ee2a8).multiplyScalar(1 + flash * 2.4);
      }
    },
  };
}

// Evidence: source documents fold up from the sheet, each with the cited line marked.
function evidenceObjects() {
  const group = new THREE.Group();
  const names = ["orders.csv", "revenue.model", "report.md"];
  const docs = names.map((name, i) => {
    const texture = canvasTexture(420, 560, (c, w, h) => {
      c.fillStyle = "#101826";
      c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 28); c.fill();
      c.strokeStyle = "#9fd2ff"; c.lineWidth = 5; c.stroke();
      c.font = `600 44px ${MONO}`; c.fillStyle = "#9fd2ff"; c.fillText(name, 30, 72);
      for (let row = 0; row < 8; row += 1) {
        const y = 126 + row * 50, marked = row === 2 + i;
        c.fillStyle = marked ? "#eaa86e" : "#34445c";
        c.beginPath(); c.roundRect(34, y, (w - 68) * (marked ? 0.92 : 0.5 + hash(row * 5 + i * 11 + 2) * 0.45), marked ? 20 : 15, 8); c.fill();
      }
    });
    const hinge = new THREE.Group();
    hinge.position.set(-0.6 + i * 0.6, THICK, -0.34 + (i === 1 ? -0.2 : 0));
    hinge.rotation.y = (1 - i) * 0.22;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.747), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }));
    card.position.y = 0.3735;
    hinge.add(card);
    group.add(hinge);
    return { hinge, card, i };
  });
  return {
    group,
    update(on, time) {
      for (const { hinge, card, i } of docs) {
        const open = smooth(i * 0.14, 0.72 + i * 0.14, on);
        hinge.rotation.x = -Math.PI / 2 + open * (Math.PI / 2 - 0.08);
        hinge.position.y = THICK + 0.004 + open * (0.05 + Math.sin(time * 0.7 + i * 2) * 0.012);
        card.material.opacity = smooth(0, 0.2, on);
        hinge.visible = on > 0.01;
      }
    },
  };
}

export async function startSheets(canvas, rows, { still = false } = {}) {
  let renderer;
  try {
    renderer = createRenderer(canvas);
  } catch {
    canvas.remove();
    return;
  }
  const host = canvas.parentElement;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x1a2230, 1.6));
  const key = new THREE.DirectionalLight(0xcfe0ff, 2.4);
  key.position.set(-2, 5, 3);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.z = 1 / Math.tan((12 * Math.PI) / 180);

  const model = new THREE.Group();
  scene.add(model);
  const time = { value: 0 };
  const hits = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  const slab = slabGeometry();
  const glowPlane = new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2).scale(1, 1, 1);

  const makers = [() => dataObjects(0x4493f8), actionObjects, evidenceObjects];
  const sheets = SHEETS.map(({ label, tint }, i) => {
    const group = new THREE.Group();
    model.add(group);
    const uniforms = { uTime: time, uOn: { value: 0 }, uFade: { value: 1 }, uKind: { value: i }, uTint: { value: new THREE.Color(tint) }, uHit: { value: hits } };
    const order = (2 - i) * 10;
    const glow = new THREE.Mesh(glowPlane, new THREE.ShaderMaterial({ uniforms, vertexShader: planeVertex.replace("attribute float aTop;", "float aTop = 1.0;"), fragmentShader: glowFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.renderOrder = order;
    group.add(glow);
    const mesh = new THREE.Mesh(slab, new THREE.ShaderMaterial({ uniforms, vertexShader: planeVertex, fragmentShader: sheetFragment, transparent: true, depthWrite: false }));
    mesh.renderOrder = order + 1;
    group.add(mesh);
    const name = labelMesh(label);
    name.renderOrder = order + 2;
    group.add(name);
    const objects = makers[i]();
    group.add(objects.group);
    return { group, uniforms, name, objects };
  });

  // The agents: lights that come down on a beam and land on the active sheet.
  const agents = [[-0.42, -0.2], [0.34, 0.26], [0.1, -0.56]].map(([x, z], i) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.4, 6) }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fd2ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.renderOrder = 40;
    model.add(dot, beam);
    return { dot, beam, x, z, i };
  });


  const pointer = createPointer(still);
  const start = performance.now();
  let width = 1, height = 1, at = 0;

  // 0 at the first row, 1 at the second, 2 at the third, holding on each one.
  const target = () => {
    const box = rows.getBoundingClientRect();
    const place = clamp((innerHeight / 2 - box.top) / Math.max(1, box.height)) * 3 - 0.5;
    const step = Math.floor(place), part = place - step;
    return Math.min(2, Math.max(0, step + smooth(0.3, 0.7, part)));
  };

  const draw = (now, delta) => {
    const goal = target();
    at = still ? goal : at + (goal - at) * (1 - Math.exp(-delta / 190));
    const t = still ? 8 : (now - start) / 1000;
    time.value = t;
    pointer.ease(delta);

    const activeY = 0;
    sheets.forEach((sheet, i) => {
      // One sheet at a time: the last one lifts and turns away, the next rises and turns in.
      const gap = i - at, away = Math.abs(gap);
      const on = clamp(1 - away * 1.15), fade = smooth(0, 0.55, 1 - away);
      sheet.group.visible = fade > 0.005;
      if (!sheet.group.visible) return;
      sheet.group.position.y = -gap * 1.25 + Math.sin(t * 0.5 + i * 2) * 0.008;
      sheet.group.rotation.y = gap * 0.42;
      sheet.group.scale.setScalar(1 - away * 0.12);
      sheet.uniforms.uOn.value = on;
      sheet.uniforms.uFade.value = fade;
      sheet.name.material.opacity = fade;
      sheet.objects.update(on, t);
    });

    agents.forEach(({ dot, beam, x, z, i }) => {
      const lit = at > 0.5 && at < 1.5 ? sheets[1].objects.tiles[sheets[1].objects.lit] : null;
      const px = x + Math.sin(t * 0.3 + i * 2) * 0.05, pz = z + Math.cos(t * 0.26 + i) * 0.05;
      const landing = activeY + 0.2 + Math.sin(t * 0.9 + i * 2) * 0.03 + (i === 0 && lit ? 0.1 : 0);
      const ax = i === 0 && lit ? lit.position.x : px, az = i === 0 && lit ? lit.position.z : pz;
      dot.position.x += (ax - dot.position.x) * 0.1;
      dot.position.z += (az - dot.position.z) * 0.1;
      dot.position.y = landing;
      const top = activeY + 2.2;
      beam.position.set(dot.position.x, (landing + top) / 2, dot.position.z);
      beam.scale.y = top - landing;
      hits[i].set(dot.position.x, dot.position.z);
    });

    const aspect = width / height;
    const scale = Math.min(0.72, 0.64 * aspect);
    model.scale.setScalar(scale);
    model.position.y = -0.1;
    model.rotation.set(0.56 + pointer.y * 0.05 + at * 0.03, 0.73 - at * 0.11 + Math.sin(t * 0.14) * 0.03 + pointer.x * 0.12, 0, "XYZ");

    renderer.render(scene, camera);
  };

  // Prepare the shaders without blocking the page. The flat sheets show until this is ready.
  camera.updateProjectionMatrix();
  await renderer.compileAsync(scene, camera);
  host.classList.add("is-3d");
  runScene({
    canvas, renderer, still, draw,
    watch: rows.parentElement,
    onResize: (w, h) => {
      width = w; height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  });
}
