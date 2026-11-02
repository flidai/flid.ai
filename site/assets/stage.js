// Shared by the 3D scenes: a fast renderer, and a loop that gives up resolution before it gives up smoothness.
import * as THREE from "/assets/vendor/three.mjs";
import { createResolution, worthResizing } from "/assets/motion.js";

export const clamp = (value) => Math.min(1, Math.max(0, value));
export const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };

// Hands the main thread back between the steps of building a scene, so no single step can freeze the page.
export const breathe = () => new Promise((done) => {
  if ("requestIdleCallback" in window) requestIdleCallback(done, { timeout: 150 });
  else setTimeout(done);
});

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x06080d, 1);
  return renderer;
}

// Runs `draw(now, delta)` while `watch` is on screen. `onResize(width, height)` follows the canvas.
export function runScene({ canvas, renderer, watch, still, draw, onResize, shouldDraw = () => true }) {
  let frame = 0, active = false, last = 0;

  let lastWidth = 0, lastHeight = 0;
  const resize = (force = true) => {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, box.width), height = Math.max(1, box.height);
    if (!force && !worthResizing(width, height, lastWidth, lastHeight)) return;
    lastWidth = width; lastHeight = height;
    // One call, so the canvas is only reallocated once.
    renderer.setDrawingBufferSize(width, height, resolution.value);
    onResize(width, height);
  };
  const resolution = createResolution({ start: Math.min(devicePixelRatio || 1, 1.5), min: 0.7, onChange: () => resize() });
  const loop = (now) => {
    frame = 0;
    if (!active || document.hidden) return;
    const delta = last ? Math.min(now - last, 100) : 16;
    last = now;
    if (shouldDraw()) {
      resolution.frame(delta);
      draw(now, delta);
    }
    if (!still) frame = requestAnimationFrame(loop);
  };
  const wake = () => { if (!frame && active) frame = requestAnimationFrame(loop); };

  resize();
  // One render ahead of time uploads everything to the GPU, so the first visible frame has no hitch.
  draw(performance.now(), 16);
  addEventListener("resize", () => { resize(false); if (still) wake(); });
  addEventListener("scroll", () => { if (still) wake(); }, { passive: true });
  document.addEventListener("visibilitychange", () => { last = 0; wake(); });
  canvas.addEventListener("webglcontextrestored", () => { resize(); wake(); });
  new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) { last = 0; wake(); }
  }, { rootMargin: "60px" }).observe(watch);
}
