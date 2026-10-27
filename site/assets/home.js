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
// Matches the compact story layout in home.css: narrow screens, portrait
// tablets, and every short landscape viewport (phones turned sideways can be
// wider than 900px).
const compactStory = matchMedia(
  "(max-width: 900px), (orientation: portrait) and (max-width: 1100px), " +
    "(max-height: 520px) and (orientation: landscape)",
);
const saveData = navigator.connection?.saveData === true;
const motionSequence = document.querySelector("[data-motion-sequence]");
let sequenceCanvas = motionSequence?.querySelector(
  "[data-motion-sequence-canvas]",
);
const hero = document.querySelector("[data-hero-transition]");
const heroSticky = hero?.querySelector(".hero-sticky");
const heroCopy = hero?.querySelector(".hero-copy");
const heroWaveField = motionSequence?.querySelector(".hero-wave-field");
const story = document.querySelector("[data-signal-story]");
const storySticky = story?.querySelector(".signal-story-sticky");
const fallbackStarters = [];
const mobileStoryContentLeft = -2;
const mobileStoryContentWidth = 112;

function setSequenceLive(live) {
  motionSequence?.classList.toggle("is-canvas-live", Boolean(live));
}

// Scroll ranges use the pinned element's own height. Layout is sized in svh,
// while innerHeight grows when the mobile toolbar collapses, which would make
// the animation jump mid-scroll.
function pinnedScrollRange(section, sticky) {
  return Math.max(1, section.offsetHeight - (sticky?.offsetHeight || innerHeight));
}

// A canvas that has handed out a WebGL context cannot return a 2D context, so
// the procedural fallback always draws into a fresh canvas.
function replaceSequenceCanvas() {
  if (!sequenceCanvas) return undefined;
  const replacement = sequenceCanvas.cloneNode(false);
  sequenceCanvas.replaceWith(replacement);
  sequenceCanvas = replacement;
  return replacement;
}

function startFallbackMotion() {
  setSequenceLive(false);
  story?.classList.remove("is-depth-live");
  const canvas = replaceSequenceCanvas();
  for (const start of fallbackStarters) start(canvas);
}

function afterPageLoad() {
  return new Promise((resolve) => {
    const idle = () => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => resolve(), { timeout: 600 });
      } else {
        setTimeout(resolve, 60);
      }
    };
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  });
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
    replaceSequenceCanvas();
    return undefined;
  }

  const sequence = {
    failed: false,
    ready: false,
    renderer,
    schedulers,
    readyPromise: undefined,
  };
  sequence.readyPromise = afterPageLoad().then(() => renderer.load()).then(
    () => {
      sequence.ready = true;
      for (const schedule of schedulers) schedule();
      return true;
    },
    (error) => {
      sequence.failed = true;
      renderer.destroy();
      console.warn("Depth video sequence unavailable.", error);
      startFallbackMotion();
      return false;
    },
  );
  window.__flidDepthSequence = renderer;
  return sequence;
}

const depthSequence =
  story?.dataset.depthDemo === "local" && !reducedMotion.matches && !saveData
    ? createSharedDepthSequence(sequenceCanvas)
    : undefined;

const colorCache = new Map();

function readColor(token, fallback) {
  if (!colorCache.has(token)) {
    colorCache.set(
      token,
      getComputedStyle(document.documentElement)
        .getPropertyValue(token)
        .trim() || fallback,
    );
  }
  return colorCache.get(token);
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

let appliedHeroState = "";

// Hero values go straight to the elements that use them. Writing custom
// properties on .motion-sequence invalidated the whole story subtree on every
// scroll frame; direct opacity/transform writes only touch the element itself.
// The bottom fade is a pseudo-element, so it reads --hero-wave-opacity from its
// owner, .hero-sticky, which only contains the hero.
const heroInertBelowOpacity = 0.3;

function applyHeroState(state) {
  const key = [
    state.copyOpacity,
    state.copyScale,
    state.copyTranslateY,
    state.waveOpacity,
    state.waveWarp,
  ].join();
  if (key === appliedHeroState) return;
  appliedHeroState = key;
  hero?.classList.add("is-transition-live");
  // The buttons must stop taking focus and taps well before the copy is fully
  // gone; at low opacity they still look dim but remain tappable "ghosts".
  if (hero) {
    const inert = state.copyOpacity < heroInertBelowOpacity;
    if (hero.inert !== inert) hero.inert = inert;
  }
  if (heroCopy) {
    heroCopy.style.opacity = state.copyOpacity;
    heroCopy.style.transform =
      `translateY(${state.copyTranslateY}px) scale(${state.copyScale})`;
  }
  if (heroWaveField) {
    heroWaveField.style.opacity = state.waveOpacity;
    heroWaveField.style.transform = `scale(${1 + state.waveWarp * 0.045})`;
  }
  heroSticky?.style.setProperty("--hero-wave-opacity", state.waveOpacity);
}

function resetHeroState() {
  appliedHeroState = "";
  if (hero) hero.inert = false;
  hero?.classList.remove("is-transition-live");
  heroCopy?.style.removeProperty("opacity");
  heroCopy?.style.removeProperty("transform");
  heroWaveField?.style.removeProperty("opacity");
  heroWaveField?.style.removeProperty("transform");
  heroSticky?.style.removeProperty("--hero-wave-opacity");
}

if (hero) {
  const sticky = heroSticky;

  function heroProgress() {
    const bounds = hero.getBoundingClientRect();
    const scrollRange = pinnedScrollRange(hero, sticky);
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

  function initProceduralHeroTransition(canvas) {
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

  function startHeroFallback(canvas) {
    if (compactStory.matches) initMobileHeroTransition();
    else initProceduralHeroTransition(canvas);
  }

  if (depthSequence) fallbackStarters.push(startHeroFallback);
  else startHeroFallback(sequenceCanvas);
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
  const copyElements = steps.map((step) =>
    step.querySelector(".signal-story-copy"));

  // Captions reveal word by word. A span per letter meant ~140 elements
  // restyled on every scroll frame; words keep the left-to-right reveal at
  // roughly a sixth of the cost.
  function prepareStorySubtitle(element) {
    const text = element.textContent.replace(/\s+/g, " ").trim();
    const words = text.split(" ");
    const revealSpan = 0.9;
    const wordWindow = Math.min(0.2, 2 / Math.max(1, words.length));
    element.textContent = "";
    element.setAttribute("aria-label", text);
    element.style.setProperty("--word-window", wordWindow.toFixed(6));

    words.forEach((word, index) => {
      const span = document.createElement("span");
      const start = words.length <= 1
        ? 0
        : index / (words.length - 1) * revealSpan;
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--word-start", start.toFixed(6));
      span.textContent = word;
      if (index > 0) element.append(" ");
      element.append(span);
    });
  }

  steps.forEach((step) => {
    const subtitle = step.querySelector("[data-story-reveal]");
    if (subtitle) prepareStorySubtitle(subtitle);
  });

  function storyProgress() {
    const bounds = story.getBoundingClientRect();
    const scrollRange = pinnedScrollRange(story, sticky);
    return Math.min(1, Math.max(0, -bounds.top / scrollRange));
  }

  // What renderStoryCopy last wrote, so unchanged values (the inactive steps
  // sit at a constant opacity and reveal) are not rewritten every frame.
  const appliedCopy = steps.map(() => ({}));
  function forgetAppliedCopy() {
    for (const applied of appliedCopy) {
      applied.opacity = applied.reveal = applied.hidden = applied.shift = undefined;
    }
  }

  function revealStaticStory() {
    forgetAppliedCopy();
    story.classList.remove("is-live", "is-depth-live");
    setSequenceLive(false);
    for (const step of steps) {
      step.removeAttribute("aria-hidden");
      step.style.removeProperty("opacity");
      step.style.setProperty("--copy-reveal", "1");
      step.querySelector(".signal-story-copy")?.style.removeProperty(
        "transform",
      );
    }
  }

  // Above the story the copy must stay hidden; otherwise scrolling back up
  // leaves the last rendered caption over the hero.
  function hideStoryCopy() {
    forgetAppliedCopy();
    for (const step of steps) {
      step.style.opacity = "0";
      step.setAttribute("aria-hidden", "true");
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
      const applied = appliedCopy[index];
      const opacity = String(copyOpacity);
      const revealValue = reveal.toFixed(6);
      const hidden = String(index !== activeScene);
      const shiftValue = `translateY(${shift.toFixed(2)}px)`;
      if (applied.opacity !== opacity) {
        step.style.opacity = applied.opacity = opacity;
      }
      if (applied.reveal !== revealValue) {
        step.style.setProperty("--copy-reveal", applied.reveal = revealValue);
      }
      if (applied.hidden !== hidden) {
        step.setAttribute("aria-hidden", applied.hidden = hidden);
      }
      if (applied.shift !== shiftValue) {
        // A direct transform; a custom property here would restyle every
        // word below the caption as well.
        if (copyElements[index]) {
          copyElements[index].style.transform = applied.shift = shiftValue;
        }
      }
    });

  }

  function initProceduralStory(canvas) {
    const context = canvas?.getContext("2d");
    if (!sticky || !canvas || !context || !steps.length) return;

    let animationFrame;
    let inViewport = false;

    function storyLayout(width, height) {
      // The scenes occupy the left two thirds of the design so desktop copy
      // can sit on the right. Phones stack the copy below the canvas, so fit
      // the occupied range to the full width instead of cropping it mid-screen.
      if (compactStory.matches) {
        const scale = width / mobileStoryContentWidth;
        return {
          scale,
          originX: -mobileStoryContentLeft * scale,
          originY: (height - signalStorySettings.designHeight * scale) / 2,
        };
      }
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
      if (heroOccludesStory()) {
        hideStoryCopy();
        return;
      }

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
      const introScrollRange = pinnedScrollRange(hero, heroSticky);
      const storyScrollRange = pinnedScrollRange(story, sticky);
      return createMotionSequenceState(
        scrollOffset,
        introScrollRange,
        storyScrollRange,
      );
    }

    function scheduleDepthSequence() {
      if (
        animationFrame ||
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
      if (sequence.failed || !inViewport || reducedMotion.matches) return;
      const motionState = readMotionState();
      const heroState = createHeroTransitionState(motionState.introProgress);
      applyHeroState(heroState);
      targetProgress = motionState.storyProgress;
      // The hero and captions follow the scroll while the video is still
      // loading; only the particles wait for it.
      if (!sequence.ready) {
        renderedProgress = targetProgress;
        lastRenderTimestamp = undefined;
        if (motionState.storyActive) {
          story.classList.add("is-live", "is-depth-live");
          renderStoryCopy(targetProgress);
        } else {
          hideStoryCopy();
        }
        return;
      }
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
      } else {
        hideStoryCopy();
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
      // Touch scrolling is not a hover; treating it as one makes the scene
      // lurch toward the finger and snap back on release.
      if (event.pointerType === "touch") return;
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
      if (!sequence.ready || sequence.failed) return;
      // Resizing clears the drawing buffer; redraw in the same frame so the
      // browser never presents an empty canvas.
      renderer.resize();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
      renderDepthSequence(performance.now());
    }).observe(canvas);
    addEventListener("scroll", scheduleDepthSequence, { passive: true });
    addEventListener("resize", scheduleDepthSequence, { passive: true });
    sticky.addEventListener("pointermove", updatePointer, { passive: true });
    sticky.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
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
      fallbackStarters.push(initProceduralStory);
    } else {
      initProceduralStory(initialCanvas);
    }
  }
}

// The logo links home; on the homepage itself, return to the top instead of
// reloading the page, which would restart the video and WebGL scene.
document.querySelector(".site-logo")?.addEventListener("click", (event) => {
  const link = event.currentTarget;
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    new URL(link.href).pathname !== location.pathname
  ) return;
  event.preventDefault();
  scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
});
