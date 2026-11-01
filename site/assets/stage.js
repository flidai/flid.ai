// Shared by the 3D scenes: a fast renderer, and a loop that gives up resolution before it gives up smoothness.
import * as THREE from "/assets/vendor/three.mjs";

export const clamp = (value) => Math.min(1, Math.max(0, value));
export const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x06080d, 1);
  return renderer;
}

// Runs `draw(now, delta)` while `watch` is on screen. `onResize(width, height)` follows the canvas.
export function runScene({ canvas, renderer, watch, still, draw, onResize, shouldDraw = () => true }) {
  let dpr = Math.min(devicePixelRatio || 1, 1.5);
  let frame = 0, active = false, last = 0, total = 0, frames = 0;

  let lastWidth = 0, lastHeight = 0;
  const resize = (force = true) => {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, box.width), height = Math.max(1, box.height);
    // A phone's address bar sliding away is not worth reallocating the canvas.
    if (!force && width === lastWidth && Math.abs(height - lastHeight) < 120) return;
    lastWidth = width; lastHeight = height;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    onResize(width, height);
  };
  const loop = (now) => {
    frame = 0;
    if (!active || document.hidden) return;
    const delta = last ? Math.min(now - last, 100) : 16;
    last = now;
    if (shouldDraw()) {
      // Averaged over half a second: slower than about 40 frames a second lowers the resolution.
      total += delta; frames += 1;
      if (frames === 30) {
        if (total / frames > 25 && dpr > 0.7) { dpr = Math.max(0.7, dpr * 0.8); resize(); }
        total = 0; frames = 0;
      }
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
