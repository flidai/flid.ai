import {
  createSignalFieldFrame,
  signalFieldSettings,
} from "/lib/hero-signal-field.mjs";

const signal = document.querySelector("[data-signal-field]");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (signal) {
  const canvas = signal.querySelector("[data-signal-canvas]");
  const hero = signal.closest(".hero");
  const context = canvas?.getContext("2d");

  if (canvas && context && hero) {
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let animationFrame;
    let previousTimestamp;
    let elapsedSeconds = 0;
    let inViewport = true;

    function readColor(token, fallback) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(token)
        .trim() || fallback;
    }

    function canvasLayout() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const diameter = Math.min(width * 0.46, height * 0.74, 620);
      const scale = diameter / 100;
      const centerX = width * 0.79;
      const centerY = height * 0.56;

      return {
        scale,
        originX: centerX - 50 * scale,
        originY: centerY - 50 * scale,
      };
    }

    function traceCurve(mark, scale) {
      const width = mark.width * scale;
      const height = mark.height * scale;
      const baseline = height * 0.42;
      const controlX = width * 0.52;

      context.beginPath();
      context.moveTo(-width, baseline);
      context.bezierCurveTo(
        -controlX,
        -height,
        controlX,
        -height,
        width,
        baseline,
      );
      context.stroke();
    }

    function drawMark(mark, layout, foreground, accent) {
      const x = layout.originX + mark.x * layout.scale;
      const y = layout.originY + mark.y * layout.scale;

      context.save();
      context.translate(x, y);
      context.rotate(mark.rotation * Math.PI / 180);
      context.globalAlpha = mark.opacity * 0.9;
      context.lineCap = "round";
      context.lineJoin = "round";

      if (mark.kind === "dot") {
        context.fillStyle = mark.accent ? accent : foreground;
        context.shadowColor = mark.accent ? accent : "transparent";
        context.shadowBlur = mark.accent ? 14 : 0;
        context.beginPath();
        context.arc(
          0,
          0,
          Math.max(1.1, signalFieldSettings.strokeWidth * 0.9 * layout.scale),
          0,
          Math.PI * 2,
        );
        context.fill();
      } else {
        context.strokeStyle = mark.accent ? accent : foreground;
        context.lineWidth =
          signalFieldSettings.strokeWidth *
          layout.scale *
          (mark.accent ? 1.18 : 1);
        context.shadowColor = mark.accent ? accent : "transparent";
        context.shadowBlur = mark.accent ? 12 : 0;
        traceCurve(mark, layout.scale);
      }

      context.restore();
    }

    function draw(timeSeconds) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const dpr = Math.min(devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const foreground = readColor("--fgColor-default", "#f0f6fc");
      const accent = readColor("--fgColor-accent", "#4493f8");
      const frame = createSignalFieldFrame({
        timeSeconds,
        pointer,
      });
      const layout = canvasLayout();

      for (const mark of frame) {
        drawMark(mark, layout, foreground, accent);
      }
    }

    function hasRenderableSurface() {
      return canvas.clientWidth > 0 && canvas.clientHeight > 0;
    }

    function resize() {
      if (reducedMotion.matches) return;
      if (!hasRenderableSurface()) {
        stopAnimation();
        return;
      }

      draw(elapsedSeconds);
      syncAnimation();
    }

    function stopAnimation() {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
      previousTimestamp = undefined;
    }

    function syncAnimation() {
      if (
        reducedMotion.matches ||
        document.hidden ||
        !inViewport ||
        !hasRenderableSurface()
      ) {
        stopAnimation();
        return;
      }

      signal.classList.add("is-live");
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    function animate(timestamp) {
      if (previousTimestamp !== undefined) {
        elapsedSeconds += Math.min(timestamp - previousTimestamp, 50) / 1000;
      }
      previousTimestamp = timestamp;

      pointer.x += (target.x - pointer.x) * 0.055;
      pointer.y += (target.y - pointer.y) * 0.055;
      draw(elapsedSeconds);
      animationFrame = requestAnimationFrame(animate);
    }

    function updatePointer(event) {
      const bounds = hero.getBoundingClientRect();
      target.x = Math.max(
        -1,
        Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1),
      );
      target.y = Math.max(
        -1,
        Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1),
      );
    }

    function settlePointer() {
      target.x = 0;
      target.y = 0;
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(signal);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? true;
        if (!inViewport) settlePointer();
        syncAnimation();
      },
      { rootMargin: "10% 0px", threshold: 0.02 },
    );
    visibilityObserver.observe(hero);

    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", settlePointer);
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", ({ matches }) => {
      if (matches) {
        stopAnimation();
        signal.classList.remove("is-live");
        context.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        resize();
        syncAnimation();
      }
    });

    resize();
    syncAnimation();
  }
}
