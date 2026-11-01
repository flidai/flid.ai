// The signal wave: a calm, flowing field of points along the bottom of the hero.
// It is deliberately slow and soft; the castle story takes over as you scroll.
const vertex = `#version 300 es
in vec2 a;
uniform float uTime, uAspect, uPx, uFade, uHot;
uniform vec2 uPointer;
out vec4 vColor;
float wave(vec2 p, float t) {
  return sin(p.x * 1.5 + t * 0.26) * 0.34
    + sin(p.x * 3.1 - p.y * 1.7 + t * 0.2) * 0.17
    + sin(p.x * 0.8 + p.y * 2.6 - t * 0.16) * 0.26;
}
void main() {
  vec2 ground = vec2((a.x - 0.5) * 7.0, a.y * 5.0);
  float height = wave(ground, uTime);
  float depth = 1.0 / (1.15 + a.y * 3.1);
  vec2 clip = vec2(ground.x * depth / max(uAspect, 0.85) * 1.15, -0.9 + (height * 0.22 + 0.62 - depth * 0.62) * 1.5 + a.y * 0.16);
  vec2 toP = (clip - uPointer) * vec2(uAspect, 1.0);
  float near = exp(-dot(toP, toP) * 4.0) * uHot;
  clip.y += near * 0.05 * depth * 2.0;
  gl_Position = vec4(clip, 0.0, 1.0);
  float crest = smoothstep(-0.55, 0.65, height);
  float far = (1.0 - smoothstep(0.5, 1.0, a.y)) * smoothstep(0.0, 0.05, a.y);
  float side = smoothstep(0.0, 0.12, a.x) * (1.0 - smoothstep(0.88, 1.0, a.x));
  vec3 tint = mix(vec3(0.09, 0.3, 0.86), vec3(0.62, 0.86, 1.0), crest + near * 0.4);
  float glow = (0.42 + 1.05 * crest * crest + near * 0.5) * far * side * uFade;
  gl_PointSize = uPx * depth * (1.5 + crest * 1.1);
  vColor = vec4(tint * glow, glow);
}`;

const fragment = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 color;
void main() {
  color = vColor * (1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5)));
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function gridData(columns, rows) {
  const data = new Float32Array(columns * rows * 2);
  let at = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      data[at++] = x / (columns - 1);
      data[at++] = y / (rows - 1);
    }
  }
  return data;
}

export function startBloom(host, { getFade = () => 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, powerPreference: "default" });
  if (!gl) return;
  host.prepend(canvas);

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let uniforms, count, active = true, frame = 0, width = 0, height = 0;
  const target = { x: 2, y: 2, hot: 0 }, pointer = { x: 2, y: 2, hot: 0 };
  const start = performance.now();
  let dpr = Math.min(devicePixelRatio || 1, 1.5);
  let slow = 0, last = 0;

  const build = () => {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    gl.useProgram(program);
    const small = Math.min(innerWidth, innerHeight) < 600;
    const data = small ? gridData(110, 60) : gridData(200, 84);
    count = data.length / 2;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    uniforms = Object.fromEntries(
      ["uTime", "uAspect", "uPx", "uFade", "uHot", "uPointer"].map((name) => [name, gl.getUniformLocation(program, name)]),
    );
  };

  const resize = () => {
    const box = host.getBoundingClientRect();
    width = box.width; height = box.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (now) => {
    const time = still.matches ? 30 : (now - start) / 1000;
    pointer.x += (target.x - pointer.x) * 0.05;
    pointer.y += (target.y - pointer.y) * 0.05;
    pointer.hot += (target.hot - pointer.hot) * 0.04;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uAspect, width / height);
    gl.uniform1f(uniforms.uPx, Math.max(1.9, 1.4 * dpr));
    gl.uniform1f(uniforms.uFade, getFade());
    gl.uniform1f(uniforms.uHot, pointer.hot);
    gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
    gl.drawArrays(gl.POINTS, 0, count);
  };

  const loop = (now) => {
    frame = 0;
    if (!active || document.hidden || gl.isContextLost()) return;
    if (last && now - last > 45 && dpr > 1) {
      slow += 1;
      if (slow > 30) { dpr = 1; slow = 0; resize(); }
    }
    last = now;
    draw(now);
    if (!still.matches) frame = requestAnimationFrame(loop);
  };
  const wake = () => { if (!frame && active) frame = requestAnimationFrame(loop); };

  build();
  resize();
  draw(performance.now());
  host.classList.add("is-live");
  wake();

  addEventListener("resize", () => { resize(); if (still.matches) draw(performance.now()); });
  document.addEventListener("visibilitychange", () => { last = 0; wake(); });
  addEventListener("scroll", () => { if (still.matches) draw(performance.now()); }, { passive: true });
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    addEventListener("pointermove", (event) => {
      const box = host.getBoundingClientRect();
      target.x = ((event.clientX - box.left) / box.width) * 2 - 1;
      target.y = 1 - ((event.clientY - box.top) / box.height) * 2;
      target.hot = 1;
      if (pointer.hot === 0) { pointer.x = target.x; pointer.y = target.y; }
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { target.hot = 0; });
  }
  canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => { build(); resize(); wake(); });

  return {
    setActive(next) {
      active = next;
      if (active) { last = 0; wake(); }
    },
  };
}
