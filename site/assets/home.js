import {
  signalStorySettings,
  storySubtitleRevealProgress,
  visitSignalStoryFrame,
} from "/lib/signal-scroll-story.mjs";
import {
  advanceDepthPlayhead,
  DepthVideoStory,
} from "/lib/depth-video-story.mjs";
import {
  createHeroParticle,
  createHeroTransitionState,
  createMotionSequenceState,
  shouldHeroOccludeStory,
} from "/lib/hero-scroll-transition.mjs";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const depthViewport = matchMedia("(min-width: 901px)");
const motionSequence = document.querySelector("[data-motion-sequence]");
const sequenceCanvas = motionSequence?.querySelector(
  "[data-motion-sequence-canvas]",
);
const hero = document.querySelector("[data-hero-transition]");
const story = document.querySelector("[data-signal-story]");
const storySticky = story?.querySelector(".signal-story-sticky");

function setSequenceLive(live) {
  motionSequence?.classList.toggle("is-canvas-live", Boolean(live));
}

function createSharedDepthSequence(canvas) {
  if (!canvas) return undefined;
  const schedulers = new Set();
  let renderer;

  try {
    renderer = new DepthVideoStory(canvas, {
      requestFrame() {
        for (const schedule of schedulers) schedule();
      },
    });
  } catch (error) {
    console.warn("Depth video sequence unavailable.", error);
    return undefined;
  }

  const sequence = {
    failed: false,
    ready: false,
    renderer,
    schedulers,
    readyPromise: undefined,
  };
  sequence.readyPromise = renderer.load().then(
    () => {
      sequence.ready = true;
      for (const schedule of schedulers) schedule();
      return true;
    },
    (error) => {
      sequence.failed = true;
      renderer.destroy();
      setSequenceLive(false);
      console.warn("Depth video sequence unavailable.", error);
      return false;
    },
  );
  window.__flidDepthSequence = renderer;
  return sequence;
}

const depthSequence =
  story?.dataset.depthDemo === "local" && !reducedMotion.matches
    ? createSharedDepthSequence(sequenceCanvas)
    : undefined;

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

function applyHeroState(state) {
  hero?.classList.add("is-transition-live");
  motionSequence?.style.setProperty("--hero-copy-opacity", state.copyOpacity);
  motionSequence?.style.setProperty("--hero-copy-scale", state.copyScale);
  motionSequence?.style.setProperty(
    "--hero-copy-translate-y",
    `${state.copyTranslateY}px`,
  );
  motionSequence?.style.setProperty("--hero-wave-opacity", state.waveOpacity);
  motionSequence?.style.setProperty("--hero-wave-warp", state.waveWarp);
}

function resetHeroState() {
  hero?.classList.remove("is-transition-live");
  motionSequence?.style.removeProperty("--hero-copy-opacity");
  motionSequence?.style.removeProperty("--hero-copy-scale");
  motionSequence?.style.removeProperty("--hero-copy-translate-y");
  motionSequence?.style.removeProperty("--hero-wave-opacity");
  motionSequence?.style.removeProperty("--hero-wave-warp");
}

if (hero) {
  const canvas = sequenceCanvas;
  const sticky = hero.querySelector(".hero-sticky");

  function heroProgress() {
    const bounds = hero.getBoundingClientRect();
    const scrollRange = Math.max(1, hero.offsetHeight - innerHeight);
    return Math.min(1, Math.max(0, -bounds.top / scrollRange));
  }

  function installHeroTransition({ draw, clear, resize }) {
    let animationFrame;
    let inViewport = false;

    function renderHeroTransition(timestamp) {
      animationFrame = undefined;
      if (!inViewport || reducedMotion.matches) return;
      const state = createHeroTransitionState(heroProgress());
      applyHeroState(state);
      draw(state, timestamp);
    }

    function scheduleHeroTransition() {
      if (!animationFrame && inViewport && !reducedMotion.matches) {
        animationFrame = requestAnimationFrame(renderHeroTransition);
      }
    }

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? false;
        if (inViewport) scheduleHeroTransition();
      },
      { rootMargin: "10% 0px", threshold: 0 },
    );
    visibilityObserver.observe(hero);
    new ResizeObserver(() => {
      resize?.();
      scheduleHeroTransition();
    }).observe(sticky);
    addEventListener("scroll", scheduleHeroTransition, { passive: true });
    addEventListener("resize", scheduleHeroTransition, { passive: true });
    reducedMotion.addEventListener("change", ({ matches }) => {
      if (matches) {
        resetHeroState();
        clear?.();
      } else {
        scheduleHeroTransition();
      }
    });
    return scheduleHeroTransition;
  }

  function initProceduralHeroTransition() {
    const context = canvas?.getContext("2d");
    if (!canvas || !sticky || !context) return;
    const particles = [];
    visitSignalStoryFrame(0, (x, y, opacity, size, _accent, index) => {
      particles.push({ x, y, opacity, size, index });
    });

    installHeroTransition({
      draw(state) {
        if (!heroOccludesStory()) return;
        setSequenceLive(state.particleProgress > 0);
        const surface = prepareCanvas(canvas, context);
        if (!surface || state.particleProgress <= 0) return;
        const scale = Math.max(
          surface.width / signalStorySettings.designWidth,
          surface.height / signalStorySettings.designHeight,
        );
        const originX = (surface.width - signalStorySettings.designWidth * scale) / 2;
        const originY = (surface.height - signalStorySettings.designHeight * scale) / 2;
        const stride = surface.width < 720 ? 2 : 1;
        context.fillStyle = readColor("--fgColor-default", "#f0f6fc");

        for (let offset = 0; offset < particles.length; offset += stride) {
          const target = particles[offset];
          const particle = createHeroParticle(
            target.index,
            target,
            state.particleProgress,
          );
          const size = Math.max(0.45, particle.size * scale * 0.3);
          context.globalAlpha = particle.opacity * 0.68;
          context.fillRect(
            originX + particle.x * scale - size / 2,
            originY + particle.y * scale - size / 2,
            size,
            size,
          );
        }
        context.globalAlpha = 1;
      },
      clear() {
        setSequenceLive(false);
        context.clearRect(0, 0, canvas.width, canvas.height);
      },
    });
  }

  function initMobileHeroTransition() {
    installHeroTransition({
      draw() {},
      clear() {},
    });
  }

  if (!depthSequence) {
    if (!depthViewport.matches) initMobileHeroTransition();
    else initProceduralHeroTransition();
  }
}

function heroOccludesStory() {
  if (!hero || !storySticky) return false;
  return shouldHeroOccludeStory(
    storySticky.getBoundingClientRect().top,
    reducedMotion.matches,
  );
}

if (story) {
  const sticky = storySticky;
  const initialCanvas = sequenceCanvas;
  const steps = [...story.querySelectorAll("[data-story-step]")];

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
    setSequenceLive(false);
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
      if (heroOccludesStory()) return;

      const progress = storyProgress();
      story.classList.add("is-live");
      setSequenceLive(true);
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

  function initDepthMotionSequence(canvas, sequence) {
    if (
      !motionSequence ||
      !hero ||
      !sticky ||
      !canvas ||
      !steps.length ||
      !sequence
    ) return;
    const { renderer } = sequence;
    let animationFrame;
    let inViewport = false;
    let targetProgress = 0;
    let renderedProgress = 0;
    let lastRenderTimestamp;
    const pointer = { x: 0, y: 0 };

    function readMotionState() {
      const scrollOffset = -hero.getBoundingClientRect().top;
      const introScrollRange = Math.max(1, hero.offsetHeight - innerHeight);
      const storyScrollRange = Math.max(1, story.offsetHeight - innerHeight);
      return createMotionSequenceState(
        scrollOffset,
        introScrollRange,
        storyScrollRange,
      );
    }

    function scheduleDepthSequence() {
      if (
        animationFrame ||
        !sequence.ready ||
        sequence.failed ||
        !inViewport ||
        reducedMotion.matches
      ) {
        return;
      }
      animationFrame = requestAnimationFrame(renderDepthSequence);
    }

    function renderDepthSequence(timestamp) {
      animationFrame = undefined;
      if (
        !sequence.ready ||
        sequence.failed ||
        !inViewport ||
        reducedMotion.matches
      ) return;
      const motionState = readMotionState();
      const heroState = createHeroTransitionState(motionState.introProgress);
      applyHeroState(heroState);
      targetProgress = motionState.storyProgress;
      const deltaMs = lastRenderTimestamp === undefined
        ? 1000 / 60
        : timestamp - lastRenderTimestamp;
      lastRenderTimestamp = timestamp;
      renderedProgress = advanceDepthPlayhead(
        renderedProgress,
        targetProgress,
        deltaMs,
      );
      if (motionState.storyActive) {
        story.classList.add("is-live", "is-depth-live");
        renderStoryCopy(renderedProgress);
      }
      setSequenceLive(heroState.particleProgress > 0);

      renderer.setProgress(renderedProgress);
      renderer.setEntrance(heroState.particleProgress);
      renderer.setPointer(pointer.x, pointer.y);
      renderer.setColor(readColor("--fgColor-default", "#f0f6fc"));
      renderer.render(timestamp);

      if (renderedProgress !== targetProgress) scheduleDepthSequence();
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
      scheduleDepthSequence();
    }

    sequence.schedulers.add(scheduleDepthSequence);
    window.__flidHeroDepthTransition = renderer;
    window.__flidDepthStory = renderer;
    sequence.readyPromise.then((ready) => {
      if (ready) {
        const motionState = readMotionState();
        targetProgress = motionState.storyProgress;
        renderedProgress = targetProgress;
        lastRenderTimestamp = undefined;
        renderer.setReducedMotion(reducedMotion.matches);
        scheduleDepthSequence();
      }
    });

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? false;
        if (inViewport) scheduleDepthSequence();
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    visibilityObserver.observe(motionSequence);
    new ResizeObserver(() => {
      if (sequence.ready) renderer.resize();
      scheduleDepthSequence();
    }).observe(canvas);
    addEventListener("scroll", scheduleDepthSequence, { passive: true });
    addEventListener("resize", scheduleDepthSequence, { passive: true });
    sticky.addEventListener("pointermove", updatePointer, { passive: true });
    sticky.addEventListener("pointerleave", () => {
      pointer.x = 0;
      pointer.y = 0;
      scheduleDepthSequence();
    });
    reducedMotion.addEventListener("change", ({ matches }) => {
      renderer.setReducedMotion(matches);
      if (matches) {
        resetHeroState();
        revealStaticStory();
      } else {
        scheduleDepthSequence();
      }
    });
  }

  if (sticky && initialCanvas && steps.length) {
    if (depthSequence) {
      initDepthMotionSequence(initialCanvas, depthSequence);
    } else {
      initProceduralStory(initialCanvas);
    }
  }
}
