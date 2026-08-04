import {
  createSignalFieldFrame,
  signalFieldSettings,
} from "/lib/hero-signal-field.mjs";
import {
  signalStorySettings,
  storySubtitleRevealProgress,
  visitSignalStoryFrame,
} from "/lib/signal-scroll-story.mjs";
import {
  advanceDepthPlayhead,
  DepthVideoStory,
} from "/lib/depth-video-story.mjs";

const signal = document.querySelector("[data-signal-field]");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function readColor(token, fallback) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim() || fallback;
}

function prepareCanvas(canvas, context) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return undefined;

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  return { width, height };
}

function traceCurve(context, mark, scale) {
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

function drawSignalMark(
  context,
  mark,
  { x, y, scale, strokeWidth, foreground, accent, alpha = 0.9 },
) {
  const markScale = scale * (mark.scale ?? 1);

  context.save();
  context.translate(x, y);
  context.rotate(mark.rotation * Math.PI / 180);
  context.globalAlpha = mark.opacity * alpha;
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
      Math.max(1.1, strokeWidth * 0.9 * markScale),
      0,
      Math.PI * 2,
    );
    context.fill();
  } else {
    context.strokeStyle = mark.accent ? accent : foreground;
    context.lineWidth = strokeWidth * markScale * (mark.accent ? 1.18 : 1);
    context.shadowColor = mark.accent ? accent : "transparent";
    context.shadowBlur = mark.accent ? 12 : 0;
    traceCurve(context, mark, markScale);
  }

  context.restore();
}

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
    let heroActivityDeadline = 0;
    const heroIdleDuration = 280;
    const heroEntranceDuration = Math.ceil(
      (signalFieldSettings.entranceDuration +
        signalFieldSettings.entranceDelay +
        0.15) *
        1000,
    );

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

    function drawMark(mark, layout, foreground, accent) {
      const x = layout.originX + mark.x * layout.scale;
      const y = layout.originY + mark.y * layout.scale;

      drawSignalMark(context, mark, {
        x,
        y,
        scale: layout.scale,
        strokeWidth: signalFieldSettings.strokeWidth,
        foreground,
        accent,
      });
    }

    function draw(timeSeconds) {
      if (!prepareCanvas(canvas, context)) return;

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
      wakeHero(heroEntranceDuration);
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
      const pointerIsSettling =
        Math.abs(target.x - pointer.x) > 0.002 ||
        Math.abs(target.y - pointer.y) > 0.002;
      if (
        !animationFrame &&
        (performance.now() < heroActivityDeadline || pointerIsSettling)
      ) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    function wakeHero(duration = heroIdleDuration) {
      heroActivityDeadline = Math.max(
        heroActivityDeadline,
        performance.now() + duration,
      );
      syncAnimation();
    }

    function animate(timestamp) {
      if (previousTimestamp !== undefined) {
        elapsedSeconds += Math.min(timestamp - previousTimestamp, 50) / 1000;
      }
      previousTimestamp = timestamp;

      pointer.x += (target.x - pointer.x) * 0.055;
      pointer.y += (target.y - pointer.y) * 0.055;
      draw(elapsedSeconds);
      animationFrame = undefined;
      syncAnimation();
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
      wakeHero();
    }

    function settlePointer() {
      target.x = 0;
      target.y = 0;
      wakeHero(heroIdleDuration * 2);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(signal);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? true;
        if (!inViewport) settlePointer();
        else wakeHero(heroIdleDuration);
      },
      { rootMargin: "10% 0px", threshold: 0.02 },
    );
    visibilityObserver.observe(hero);

    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", settlePointer);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) syncAnimation();
      else wakeHero(heroIdleDuration);
    });
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

const story = document.querySelector("[data-signal-story]");

if (story) {
  const sticky = story.querySelector(".signal-story-sticky");
  const initialCanvas = story.querySelector("[data-story-canvas]");
  const steps = [...story.querySelectorAll("[data-story-step]")];
  const counter = story.querySelector("[data-story-counter]");

  function prepareStorySubtitle(element) {
    const text = element.textContent.replace(/\s+/g, " ").trim();
    const characters = [...text];
    const revealSpan = 0.9;
    const characterWindow = Math.min(0.12, 5 / Math.max(1, characters.length));
    element.textContent = "";
    element.setAttribute("aria-label", text);
    element.style.setProperty("--character-window", characterWindow.toFixed(6));

    characters.forEach((character, index) => {
      const span = document.createElement("span");
      const start = characters.length <= 1
        ? 0
        : index / (characters.length - 1) * revealSpan;
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--character-start", start.toFixed(6));
      span.textContent = character;
      element.append(span);
    });
  }

  steps.forEach((step) => {
    const subtitle = step.querySelector("[data-story-reveal]");
    if (subtitle) prepareStorySubtitle(subtitle);
  });

  function storyProgress() {
    const bounds = story.getBoundingClientRect();
    const scrollRange = Math.max(1, story.offsetHeight - innerHeight);
    return Math.min(1, Math.max(0, -bounds.top / scrollRange));
  }

  function revealStaticStory() {
    story.classList.remove("is-live", "is-depth-live");
    for (const step of steps) {
      step.removeAttribute("aria-hidden");
      step.style.removeProperty("opacity");
      step.style.setProperty("--copy-reveal", "1");
      step.querySelector(".signal-story-copy")?.style.removeProperty(
        "--story-step-shift",
      );
    }
  }

  function renderStoryCopy(progress) {
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    const position = normalizedProgress * Math.max(0, steps.length - 1);
    const from = Math.min(steps.length - 1, Math.floor(position));
    const to = Math.min(steps.length - 1, from + 1);
    const rawTransition = position - from;
    const transition = rawTransition * rawTransition * (3 - 2 * rawTransition);
    const weights = Array.from({ length: steps.length }, () => 0);
    weights[from] = 1 - transition;
    weights[to] += transition;
    const activeScene = Math.min(steps.length - 1, Math.round(position));

    steps.forEach((step, index) => {
      const weight = weights[index] ?? 0;
      const opacityProgress = Math.max(0, Math.min(1, (weight - 0.48) / 0.14));
      const copyOpacity = opacityProgress * opacityProgress * (3 - 2 * opacityProgress);
      const shift = (index - position) * 42;
      const reveal = storySubtitleRevealProgress(
        position,
        index,
        steps.length,
      );
      step.style.opacity = String(copyOpacity);
      step.style.setProperty("--copy-reveal", reveal.toFixed(6));
      step.setAttribute("aria-hidden", String(index !== activeScene));
      step
        .querySelector(".signal-story-copy")
        ?.style.setProperty("--story-step-shift", `${shift.toFixed(2)}px`);
    });

    if (counter) {
      counter.textContent = `${String(activeScene + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
    }
  }

  function initProceduralStory(canvas) {
    const context = canvas?.getContext("2d");
    if (!sticky || !canvas || !context || !steps.length) return;

    let animationFrame;
    let inViewport = false;

    function storyLayout(width, height) {
      const scale = Math.max(
        width / signalStorySettings.designWidth,
        height / signalStorySettings.designHeight,
      );
      return {
        scale,
        originX: (width - signalStorySettings.designWidth * scale) / 2,
        originY: (height - signalStorySettings.designHeight * scale) / 2,
      };
    }

    function drawStoryCanvas(progress) {
      const surface = prepareCanvas(canvas, context);
      if (!surface) return;
      const foreground = readColor("--fgColor-default", "#f0f6fc");
      const layout = storyLayout(surface.width, surface.height);

      context.fillStyle = foreground;
      visitSignalStoryFrame(progress, (x, y, opacity, size) => {
        const particleX = layout.originX + x * layout.scale;
        const particleY = layout.originY + y * layout.scale;
        context.globalAlpha = opacity * 0.84;
        context.fillRect(
          particleX - size / 2,
          particleY - size / 2,
          size,
          size,
        );
      });
      context.globalAlpha = 1;
    }

    function renderStory() {
      animationFrame = undefined;
      if (
        reducedMotion.matches ||
        !inViewport ||
        !canvas.clientWidth ||
        !canvas.clientHeight
      ) {
        revealStaticStory();
        return;
      }

      const progress = storyProgress();
      story.classList.add("is-live");
      story.style.setProperty("--story-progress", progress.toFixed(6));
      renderStoryCopy(progress);
      drawStoryCanvas(progress);
    }

    function scheduleStory() {
      if (reducedMotion.matches || !canvas.clientWidth || !canvas.clientHeight) {
        revealStaticStory();
        return;
      }
      if (!animationFrame && inViewport) {
        animationFrame = requestAnimationFrame(renderStory);
      }
    }

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? false;
        if (inViewport) scheduleStory();
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    visibilityObserver.observe(story);
    new ResizeObserver(scheduleStory).observe(sticky);
    addEventListener("scroll", scheduleStory, { passive: true });
    addEventListener("resize", scheduleStory, { passive: true });
    reducedMotion.addEventListener("change", scheduleStory);
  }

  function initDepthStory(canvas) {
    if (!sticky || !canvas || !steps.length) return;
    let renderer;
    let animationFrame;
    let inViewport = false;
    let ready = false;
    let failed = false;
    let targetProgress = 0;
    let renderedProgress = 0;
    let lastRenderTimestamp;
    const pointer = { x: 0, y: 0 };

    function scheduleDepthStory() {
      if (
        animationFrame ||
        !ready ||
        failed ||
        !inViewport ||
        reducedMotion.matches
      ) {
        return;
      }
      animationFrame = requestAnimationFrame(renderDepthStory);
    }

    function renderDepthStory(timestamp) {
      animationFrame = undefined;
      if (!ready || failed || !inViewport || reducedMotion.matches) return;
      targetProgress = storyProgress();
      const deltaMs = lastRenderTimestamp === undefined
        ? 1000 / 60
        : timestamp - lastRenderTimestamp;
      lastRenderTimestamp = timestamp;
      renderedProgress = advanceDepthPlayhead(
        renderedProgress,
        targetProgress,
        deltaMs,
      );
      story.classList.add("is-live", "is-depth-live");
      story.style.setProperty("--story-progress", renderedProgress.toFixed(6));
      renderStoryCopy(renderedProgress);

      renderer.setProgress(renderedProgress);
      renderer.setPointer(pointer.x, pointer.y);
      renderer.setColor(readColor("--fgColor-default", "#f0f6fc"));
      renderer.render(timestamp);

      if (renderedProgress !== targetProgress) scheduleDepthStory();
    }

    function updatePointer(event) {
      const bounds = sticky.getBoundingClientRect();
      pointer.x = Math.max(
        -1,
        Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1),
      );
      pointer.y = Math.max(
        -1,
        Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1),
      );
      scheduleDepthStory();
    }

    function failToProcedural(error) {
      failed = true;
      renderer?.destroy();
      console.warn("Depth video story unavailable; using procedural fallback.", error);
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      initProceduralStory(replacement);
    }

    try {
      renderer = new DepthVideoStory(canvas, {
        requestFrame: scheduleDepthStory,
      });
      window.__flidDepthStory = renderer;
    } catch (error) {
      failToProcedural(error);
      return;
    }

    renderer.load().then(
      () => {
        ready = true;
        targetProgress = storyProgress();
        renderedProgress = targetProgress;
        lastRenderTimestamp = undefined;
        renderer.setReducedMotion(reducedMotion.matches);
        scheduleDepthStory();
      },
      failToProcedural,
    );

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? false;
        if (inViewport) scheduleDepthStory();
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    visibilityObserver.observe(story);
    new ResizeObserver(() => {
      if (ready) renderer.resize();
      scheduleDepthStory();
    }).observe(sticky);
    addEventListener("scroll", scheduleDepthStory, { passive: true });
    addEventListener("resize", scheduleDepthStory, { passive: true });
    sticky.addEventListener("pointermove", updatePointer, { passive: true });
    sticky.addEventListener("pointerleave", () => {
      pointer.x = 0;
      pointer.y = 0;
      scheduleDepthStory();
    });
    reducedMotion.addEventListener("change", ({ matches }) => {
      renderer.setReducedMotion(matches);
      if (matches) revealStaticStory();
      else scheduleDepthStory();
    });
  }

  if (sticky && initialCanvas && steps.length) {
    const depthViewport = matchMedia("(min-width: 901px)");
    if (
      story.dataset.depthDemo === "local" &&
      !reducedMotion.matches &&
      depthViewport.matches
    ) {
      initDepthStory(initialCanvas);
    } else {
      initProceduralStory(initialCanvas);
    }
  }
}
