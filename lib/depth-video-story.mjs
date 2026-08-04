const sourceRoot = "/assets/depth-reference";

export const depthVideoStorySettings = Object.freeze({
  sources: Object.freeze(
    Array.from(
      { length: 8 },
      (_, index) =>
        `${sourceRoot}/depth-clip-${String(index + 1).padStart(2, "0")}.mp4`,
    ),
  ),
  densityScale: 1.55,
  desktopParticleBase: 100_000,
  desktopParticleCeiling: 200_000,
  tabletParticleBase: 72_000,
  tabletParticleCeiling: 150_000,
  compactParticleBase: 26_000,
  compactParticleCeiling: 55_000,
  retinaDensityMultiplier: 0.8,
  maximumPixelRatio: 1.35,
  holdWeight: 1,
  transitionWeight: 0.72,
  playheadResponseMs: 170,
  playheadSnapDistance: 0.00002,
  minimumSeekIntervalMs: 28,
  duplicateSeekDistance: 0.014,
  settledSeekDistance: 0.024,
  seekInFlightTimeoutMs: 180,
  spatialJitter: 1.6,
});

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function mix(start, end, ratio) {
  return start + (end - start) * ratio;
}

function smoothstep(value) {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
}

export function advanceDepthPlayhead(current, target, deltaMs = 1000 / 60) {
  const from = clamp(current);
  const to = clamp(target);
  const distance = to - from;
  if (Math.abs(distance) <= depthVideoStorySettings.playheadSnapDistance) {
    return to;
  }

  const elapsed = Math.max(0, Math.min(50, Number(deltaMs) || 0));
  const response = 1 - Math.exp(
    -elapsed / depthVideoStorySettings.playheadResponseMs,
  );
  const next = from + distance * response;
  return Math.abs(to - next) <= depthVideoStorySettings.playheadSnapDistance
    ? to
    : next;
}

export function shouldSeekDepthVideo(record, desiredTime, now = performance.now()) {
  if (!record || record.readyState < 1) return false;
  const recentInFlight =
    (record.seeking || record.seekInFlight) &&
    now - record.lastSeekAt < depthVideoStorySettings.seekInFlightTimeoutMs;
  if (recentInFlight) return false;
  if (
    Math.abs(record.currentTime - desiredTime) <
    depthVideoStorySettings.settledSeekDistance
  ) {
    return false;
  }
  if (
    Math.abs(record.lastSeekTime - desiredTime) <
    depthVideoStorySettings.duplicateSeekDistance
  ) {
    return false;
  }
  return (
    now - record.lastSeekAt >= depthVideoStorySettings.minimumSeekIntervalMs
  );
}

function hash(column, row = 0) {
  const value =
    Math.sin((column + 1) * 12.9898 + (row + 1) * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

export function depthParticleTarget(
  width,
  hardwareConcurrency = 4,
  pixelRatio = 1,
) {
  const cssWidth = Math.max(1, Number(width) || 1);
  const cores = Math.max(1, Number(hardwareConcurrency) || 1);
  const densityMultiplier =
    Number(pixelRatio) >= 2
      ? depthVideoStorySettings.retinaDensityMultiplier
      : 1;
  const compact = cssWidth < 640 || cores < 4;
  const tablet = !compact && cssWidth < 1024;
  const base = compact
    ? depthVideoStorySettings.compactParticleBase
    : tablet
      ? depthVideoStorySettings.tabletParticleBase
      : depthVideoStorySettings.desktopParticleBase;
  const ceiling = compact
    ? depthVideoStorySettings.compactParticleCeiling
    : tablet
      ? depthVideoStorySettings.tabletParticleCeiling
      : depthVideoStorySettings.desktopParticleCeiling;

  return Math.min(
    ceiling,
    Math.round(base * depthVideoStorySettings.densityScale * densityMultiplier),
  );
}

function copyState(clipPosition, clipCount) {
  const copyPosition = clamp(clipPosition / Math.max(1, clipCount - 1)) * 3;
  const from = Math.min(3, Math.floor(copyPosition));
  const to = Math.min(3, from + 1);
  const transition = smoothstep(copyPosition - from);
  const copyWeights = [0, 0, 0, 0];

  copyWeights[from] = 1 - transition;
  copyWeights[to] += transition;

  return {
    copyIndex: Math.min(3, Math.round(copyPosition)),
    copyPosition,
    copyWeights,
  };
}

export function createDepthStoryState(
  progress = 0,
  clipCount = depthVideoStorySettings.sources.length,
) {
  const count = Math.max(1, Math.floor(Number(clipCount) || 1));
  const normalizedProgress = clamp(progress);

  if (count === 1 || normalizedProgress >= 1) {
    const source = count - 1;
    return {
      progress: normalizedProgress,
      phase: "hold",
      sourceA: source,
      sourceB: source,
      sampleA: normalizedProgress >= 1 ? 1 : normalizedProgress,
      sampleB: normalizedProgress >= 1 ? 1 : normalizedProgress,
      morph: 0,
      clipPosition: source,
      ...copyState(source, count),
    };
  }

  const totalWeight =
    count * depthVideoStorySettings.holdWeight +
    (count - 1) * depthVideoStorySettings.transitionWeight;
  let cursor = normalizedProgress * totalWeight;

  for (let source = 0; source < count; source += 1) {
    const holdWeight = depthVideoStorySettings.holdWeight;
    if (cursor <= holdWeight || source === count - 1) {
      const local = clamp(cursor / holdWeight);
      return {
        progress: normalizedProgress,
        phase: "hold",
        sourceA: source,
        sourceB: source,
        sampleA: local,
        sampleB: local,
        morph: 0,
        clipPosition: source,
        ...copyState(source, count),
      };
    }
    cursor -= holdWeight;

    const transitionWeight = depthVideoStorySettings.transitionWeight;
    if (cursor <= transitionWeight) {
      const local = clamp(cursor / transitionWeight);
      const morph = smoothstep(local);
      const clipPosition = source + morph;
      return {
        progress: normalizedProgress,
        phase: "transition",
        sourceA: source,
        sourceB: source + 1,
        sampleA: mix(0.82, 1, morph),
        sampleB: mix(0, 0.18, morph),
        morph,
        clipPosition,
        ...copyState(clipPosition, count),
      };
    }
    cursor -= transitionWeight;
  }

  return createDepthStoryState(1, count);
}

export function createDepthParticleGrid(
  particleTarget = depthParticleTarget(1440, 8, 1),
  aspect = 16 / 9,
) {
  const target = Math.max(256, Math.round(Number(particleTarget) || 256));
  const normalizedAspect = Math.max(0.25, Math.min(4, Number(aspect) || 1));
  const columns = Math.max(16, Math.round(Math.sqrt(target * normalizedAspect)));
  const rows = Math.max(16, Math.round(target / columns));
  const count = columns * rows;
  const vertices = new Float32Array(count * 5);
  let offset = 0;

  for (let row = 0; row < rows; row += 1) {
    const v = rows === 1 ? 0.5 : row / (rows - 1);
    for (let column = 0; column < columns; column += 1) {
      const u = columns === 1 ? 0.5 : column / (columns - 1);
      const seed = hash(column, row);
      const secondSeed = hash(column + 17.17, row + 5.31);

      vertices[offset] =
        u - 0.5 +
        (seed - 0.5) *
          (depthVideoStorySettings.spatialJitter / Math.max(1, columns - 1));
      vertices[offset + 1] =
        0.5 - v +
        (secondSeed - 0.5) *
          (depthVideoStorySettings.spatialJitter / Math.max(1, rows - 1));
      vertices[offset + 2] = u;
      vertices[offset + 3] = v;
      vertices[offset + 4] = seed;
      offset += 5;
    }
  }

  return { columns, rows, count, vertices };
}

export const depthVertexShader = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUv;
in float aSeed;

uniform sampler2D uDepthA;
uniform sampler2D uDepthB;
uniform vec2 uTexelA;
uniform vec2 uTexelB;
uniform vec2 uPlaneScale;
uniform vec2 uViewport;
uniform vec2 uPointer;
uniform vec4 uAvoidRect;
uniform vec3 uColor;
uniform float uMorph;
uniform float uDepthGammaA;
uniform float uDepthGammaB;
uniform float uPointScale;
uniform float uPixelRatio;
uniform float uTime;
uniform float uReducedMotion;

out vec3 vColor;
out float vAlpha;

float hash11(float value) {
  return fract(sin(value * 127.1) * 43758.5453123);
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float sourceValue(sampler2D source, vec2 uv) {
  float value = luma(texture(source, uv).rgb);
  return pow(clamp((value - 0.012) * 1.1, 0.0, 1.0), 0.9);
}

float sobelEdge(sampler2D source, vec2 uv, vec2 texel) {
  float center = sourceValue(source, uv);
  float left = sourceValue(source, clamp(uv - vec2(texel.x, 0.0), vec2(0.0), vec2(1.0)));
  float right = sourceValue(source, clamp(uv + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0)));
  float top = sourceValue(source, clamp(uv - vec2(0.0, texel.y), vec2(0.0), vec2(1.0)));
  float bottom = sourceValue(source, clamp(uv + vec2(0.0, texel.y), vec2(0.0), vec2(1.0)));
  float gradient = length(vec2(right - left, bottom - top));
  float laplacian = abs(4.0 * center - left - right - top - bottom);
  return smoothstep(0.035, 0.5, pow(gradient * 0.9 + laplacian * 0.45, 0.58));
}

float rectangleInfluence(vec2 point, vec4 rectangle) {
  vec2 closest = clamp(point, rectangle.xy, rectangle.zw);
  float distanceToRectangle = length(point - closest);
  float inside =
    step(rectangle.x, point.x) * step(point.x, rectangle.z) *
    step(rectangle.y, point.y) * step(point.y, rectangle.w);
  return max(inside, 1.0 - smoothstep(0.0, 0.065, distanceToRectangle));
}

void main() {
  vec2 uv = vec2(aUv.x, 1.0 - aUv.y);
  float rawMorph = clamp(uMorph, 0.0, 1.0);
  float morph = smoothstep(0.0, 1.0, rawMorph);
  float value = pow(sourceValue(uDepthA, uv), uDepthGammaA);
  float edge = sobelEdge(uDepthA, uv, uTexelA);
  if (rawMorph > 0.001) {
    float valueB = pow(sourceValue(uDepthB, uv), uDepthGammaB);
    float edgeB = sobelEdge(uDepthB, uv, uTexelB);
    value = mix(value, valueB, morph);
    edge = mix(edge, edgeB, morph);
  }
  float clarity = smoothstep(0.035, 0.92, value);
  float presence = max(smoothstep(0.07, 0.22, value), edge * 1.2);

  vec2 world = aPosition * uPlaneScale;
  float transition = sin(rawMorph * 3.14159265) * (1.0 - uReducedMotion);
  float angle = hash11(aSeed * 31.7 + 4.0) * 6.2831853;
  vec2 direction = vec2(cos(angle), sin(angle));
  float strand = sin(aUv.y * 21.0 + aSeed * 13.0 + uTime * 0.24);
  float turbulence = sin(aUv.x * 17.0 - aUv.y * 11.0 + aSeed * 29.0);
  float travel = min(uPlaneScale.x, uPlaneScale.y) * transition;
  world += direction * travel * (0.035 + hash11(aSeed * 73.0) * 0.105);
  world += vec2(strand, turbulence) * travel * 0.022;

  float depth = (value - 0.5) * 0.92 + edge * 0.075;
  world += uPointer * depth * 0.075 * (1.0 - uReducedMotion);

  const float cameraZ = 2.55;
  const float focalLength = 2.90421088;
  float viewDepth = max(1.25, cameraZ - depth);
  float viewportAspect = max(0.25, uViewport.x / max(1.0, uViewport.y));
  vec2 projected = vec2(
    world.x * focalLength / (viewDepth * viewportAspect),
    world.y * focalLength / viewDepth
  );
  gl_Position = vec4(projected, depth / 10.0, 1.0);

  vec2 screen = vec2(projected.x * 0.5 + 0.5, 0.5 - projected.y * 0.5);
  float avoid = rectangleInfluence(screen, uAvoidRect);
  float depthNear = smoothstep(3.08, 1.96, viewDepth);
  float depthSize = mix(0.62, 1.2, depthNear);
  float grain = mix(0.46, 1.35, hash11(aSeed * 17.31 + 5.0));
  // Point-size perspective is intentionally narrower than the 2.55 camera
  // distance. Using cameraZ here makes each dot 28.8% wider on screen.
  float perspective = 1.98 / viewDepth;
  float pointDetail =
    0.34 + clarity * 0.88 + depthNear * 0.12 + edge * 0.22 +
    transition * 0.26;
  gl_PointSize = uPointScale * uPixelRatio * perspective * grain *
    pointDetail * depthSize * mix(0.34, 1.0, presence) *
    mix(0.7, 1.0, 1.0 - avoid);

  vec3 farColor = uColor * 0.34;
  vColor = mix(farColor, uColor, depthNear * 0.82 + edge * 0.18);
  float transitionDust = transition * (0.035 + hash11(aSeed * 101.0) * 0.12);
  float imageAlpha =
    presence * (0.14 + clarity * 0.78 + edge * 0.55) *
    mix(0.58, 1.08, depthNear);
  float particleOccupancy = smoothstep(
    0.055,
    0.22,
    hash11(aSeed * 211.0 + 9.0)
  );
  vAlpha = max(imageAlpha, transitionDust) * particleOccupancy;
  vAlpha *= mix(1.0, 0.12, avoid);
}
`;

export const depthFragmentShader = `#version 300 es
precision highp float;

in vec3 vColor;
in float vAlpha;
out vec4 outputColor;

void main() {
  vec2 coordinate = gl_PointCoord - vec2(0.5);
  float radiusSquared = dot(coordinate, coordinate);
  float core = exp(-radiusSquared * 26.0);
  float halo = exp(-radiusSquared * 7.5) * 0.34;
  float alpha = (core + halo) * vAlpha;
  if (alpha < 0.007) discard;
  outputColor = vec4(vColor, min(1.0, alpha));
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, depthVertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, depthFragmentShader);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function parseColor(value) {
  const match = String(value).trim().match(/^#([\da-f]{6})$/i);
  if (!match) return [0.941, 0.965, 0.988];
  const number = Number.parseInt(match[1], 16);
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255,
  ];
}

function createTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );
  return texture;
}

function loadVideo(source, requestFrame, stage) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = source;
  stage.append(video);

  const record = {
    video,
    duration: 1,
    width: 640,
    height: 360,
    texture: undefined,
    desiredTime: 0,
    uploadedTime: -1,
    decodedTime: -1,
    lastSeekAt: 0,
    lastSeekTime: -1,
    needsTextureUpdate: true,
    seekInFlight: false,
    videoFrameCallback: 0,
  };

  const markFrameReady = (decodedTime = video.currentTime) => {
    record.decodedTime = Number.isFinite(decodedTime)
      ? decodedTime
      : video.currentTime;
    record.needsTextureUpdate = true;
    requestFrame();
  };

  if ("requestVideoFrameCallback" in video) {
    const receiveVideoFrame = (_, metadata) => {
      markFrameReady(metadata.mediaTime);
      record.videoFrameCallback = video.requestVideoFrameCallback(
        receiveVideoFrame,
      );
    };
    record.videoFrameCallback = video.requestVideoFrameCallback(
      receiveVideoFrame,
    );
  }

  record.ready = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(`Timed out loading ${source}`)),
      8_000,
    );
    const complete = () => {
      window.clearTimeout(timeout);
      record.duration = Number.isFinite(video.duration) ? video.duration : 1;
      record.width = video.videoWidth || 640;
      record.height = video.videoHeight || 360;
      resolve(record);
    };
    video.addEventListener("loadeddata", complete, { once: true });
    video.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error(`Unable to load ${source}`));
      },
      { once: true },
    );
    video.addEventListener("loadeddata", () => markFrameReady());
    video.addEventListener("seeking", () => {
      record.seekInFlight = true;
    });
    video.addEventListener("seeked", () => {
      record.seekInFlight = false;
      markFrameReady();
    });
  });
  video.load();
  return record;
}

export class DepthVideoStory {
  constructor(
    canvas,
    {
      sources = depthVideoStorySettings.sources,
      requestFrame = () => {},
    } = {},
  ) {
    this.canvas = canvas;
    this.sources = [...sources];
    this.requestFrame = requestFrame;
    this.progress = 0;
    this.pointer = { x: 0, y: 0 };
    this.avoidRect = [0, 0, 0, 0];
    this.color = "#f0f6fc";
    this.reducedMotion = false;
    this.records = [];
    this.vertexCount = 0;
    this.particleTarget = 0;
    this.disposed = false;

    this.gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!this.gl) throw new Error("WebGL2 is not available");

    const gl = this.gl;
    this.program = createProgram(gl);
    this.vertexArray = gl.createVertexArray();
    this.vertexBuffer = gl.createBuffer();
    this.uniforms = Object.fromEntries(
      [
        "uDepthA",
        "uDepthB",
        "uTexelA",
        "uTexelB",
        "uPlaneScale",
        "uViewport",
        "uPointer",
        "uAvoidRect",
        "uColor",
        "uMorph",
        "uDepthGammaA",
        "uDepthGammaB",
        "uPointScale",
        "uPixelRatio",
        "uTime",
        "uReducedMotion",
      ].map((name) => [name, gl.getUniformLocation(this.program, name)]),
    );

    this.stage = document.createElement("div");
    this.stage.setAttribute("aria-hidden", "true");
    Object.assign(this.stage.style, {
      position: "fixed",
      left: "-9999px",
      top: "-9999px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      pointerEvents: "none",
    });
    document.body.append(this.stage);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
  }

  async load() {
    this.records = this.sources.map((source) =>
      loadVideo(source, () => this.requestFrame(), this.stage),
    );
    await Promise.all(this.records.map(({ ready }) => ready));
    for (const record of this.records) {
      record.texture = createTexture(this.gl);
    }
    this.resize();
  }

  setProgress(progress) {
    this.progress = clamp(progress);
  }

  setPointer(x, y) {
    this.pointer.x = clamp(x, -1, 1);
    this.pointer.y = clamp(y, -1, 1);
  }

  setAvoidRect(rectangle = {}) {
    this.avoidRect = [
      clamp(rectangle.x0),
      clamp(rectangle.y0),
      clamp(rectangle.x1),
      clamp(rectangle.y1),
    ];
  }

  setColor(value) {
    this.color = value;
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
  }

  targetForWidth(width) {
    return depthParticleTarget(
      width,
      navigator.hardwareConcurrency || 4,
      devicePixelRatio || 1,
    );
  }

  rebuildGeometry(target, aspect) {
    const gl = this.gl;
    const grid = createDepthParticleGrid(target, aspect);
    this.vertexCount = grid.count;
    this.particleTarget = target;

    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, grid.vertices, gl.STATIC_DRAW);

    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(this.program, "aPosition");
    const uv = gl.getAttribLocation(this.program, "aUv");
    const seed = gl.getAttribLocation(this.program, "aSeed");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(
      uv,
      2,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.enableVertexAttribArray(seed);
    gl.vertexAttribPointer(
      seed,
      1,
      gl.FLOAT,
      false,
      stride,
      4 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.bindVertexArray(null);
  }

  resize() {
    if (this.disposed) return;
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const pixelRatio = Math.min(
      devicePixelRatio || 1,
      depthVideoStorySettings.maximumPixelRatio,
    );
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);

    const target = this.targetForWidth(width);
    const aspect = this.records[0]?.width / this.records[0]?.height || 16 / 9;
    if (!this.vertexCount || Math.abs(target - this.particleTarget) > target * 0.2) {
      this.rebuildGeometry(target, aspect);
    }
  }

  seekRecord(record, progress) {
    const duration = Math.max(0.001, record.duration - 0.04);
    const desiredTime = clamp(progress) * duration;
    record.desiredTime = desiredTime;
    const now = performance.now();
    if (!shouldSeekDepthVideo({
      readyState: record.video.readyState,
      currentTime: record.video.currentTime,
      seeking: record.video.seeking,
      seekInFlight: record.seekInFlight,
      lastSeekAt: record.lastSeekAt,
      lastSeekTime: record.lastSeekTime,
    }, desiredTime, now)) return false;

    try {
      record.lastSeekAt = now;
      record.lastSeekTime = desiredTime;
      record.seekInFlight = true;
      record.video.currentTime = desiredTime;
      return true;
    } catch {
      record.seekInFlight = false;
      return false;
    }
  }

  uploadRecord(record, textureUnit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, record.texture);
    if (
      record.video.readyState >= 2 &&
      record.needsTextureUpdate &&
      !record.video.seeking &&
      !record.seekInFlight
    ) {
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          record.video,
        );
        record.uploadedTime = record.decodedTime >= 0
          ? record.decodedTime
          : record.video.currentTime;
        record.needsTextureUpdate = false;
      } catch {
        // Keep the previous complete frame while a seek is still decoding.
      }
    }
  }

  planeScale(sourceAspect) {
    const viewportAspect = Math.max(
      0.25,
      this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight),
    );
    const visibleHeight = 1.756071;
    const visibleWidth = visibleHeight * viewportAspect;
    if (viewportAspect > sourceAspect) {
      const height = visibleHeight * 0.84;
      return [height * sourceAspect, height];
    }
    const width = visibleWidth * 0.84;
    return [width, width / sourceAspect];
  }

  render(time = performance.now()) {
    if (this.disposed || !this.records.length || !this.vertexCount) return;
    const gl = this.gl;
    const state = createDepthStoryState(this.progress, this.records.length);
    const recordA = this.records[state.sourceA];
    const recordB = this.records[state.sourceB] || recordA;
    this.seekRecord(recordA, state.sampleA);
    if (recordB !== recordA) this.seekRecord(recordB, state.sampleB);
    this.uploadRecord(recordA, 0);
    this.uploadRecord(recordB, 1);

    const sourceAspect = mix(
      recordA.width / recordA.height,
      recordB.width / recordB.height,
      state.morph,
    );
    const [planeWidth, planeHeight] = this.planeScale(sourceAspect);
    const pixelRatio = Math.min(
      devicePixelRatio || 1,
      depthVideoStorySettings.maximumPixelRatio,
    );

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.uniform1i(this.uniforms.uDepthA, 0);
    gl.uniform1i(this.uniforms.uDepthB, 1);
    gl.uniform2f(this.uniforms.uTexelA, 1 / recordA.width, 1 / recordA.height);
    gl.uniform2f(this.uniforms.uTexelB, 1 / recordB.width, 1 / recordB.height);
    gl.uniform2f(this.uniforms.uPlaneScale, planeWidth, planeHeight);
    gl.uniform2f(
      this.uniforms.uViewport,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    );
    gl.uniform2f(this.uniforms.uPointer, this.pointer.x, -this.pointer.y);
    gl.uniform4f(this.uniforms.uAvoidRect, ...this.avoidRect);
    gl.uniform3f(this.uniforms.uColor, ...parseColor(this.color));
    gl.uniform1f(this.uniforms.uMorph, state.morph);
    gl.uniform1f(this.uniforms.uDepthGammaA, state.sourceA >= 5 ? 0.55 : 0.9);
    gl.uniform1f(this.uniforms.uDepthGammaB, state.sourceB >= 5 ? 0.55 : 0.9);
    gl.uniform1f(this.uniforms.uPointScale, this.canvas.clientWidth < 720 ? 1.66 : 1.9);
    gl.uniform1f(this.uniforms.uPixelRatio, pixelRatio);
    gl.uniform1f(this.uniforms.uTime, time / 1000);
    gl.uniform1f(this.uniforms.uReducedMotion, Number(this.reducedMotion));
    gl.drawArrays(gl.POINTS, 0, this.vertexCount);
    gl.bindVertexArray(null);
    return state;
  }

  destroy() {
    this.disposed = true;
    for (const record of this.records) {
      if (
        record.videoFrameCallback &&
        "cancelVideoFrameCallback" in record.video
      ) {
        record.video.cancelVideoFrameCallback(record.videoFrameCallback);
      }
      record.video.pause();
      record.video.removeAttribute("src");
      record.video.load();
      if (record.texture) this.gl.deleteTexture(record.texture);
    }
    this.records = [];
    this.stage.remove();
    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}
