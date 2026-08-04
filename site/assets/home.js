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
} from "/lib/hero-scroll-transition.mjs";

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

const hero = document.querySelector("[data-hero-transition]");

if (hero) {
  const canvas = hero.querySelector("[data-hero-transition-canvas]");
  const sticky = hero.querySelector(".hero-sticky");
  const depthStory = document.querySelector("[data-signal-story]");

  function heroProgress() {
    const bounds = hero.getBoundingClientRect();
    const scrollRange = Math.max(1, hero.offsetHeight - innerHeight);
    return Math.min(1, Math.max(0, -bounds.top / scrollRange));
  }

  function applyHeroState(state) {
    hero.classList.add("is-transition-live");
    hero.style.setProperty("--hero-copy-opacity", state.copyOpacity);
    hero.style.setProperty("--hero-copy-scale", state.copyScale);
    hero.style.setProperty(
      "--hero-copy-translate-y",
      `${state.copyTranslateY}px`,
    );
    hero.style.setProperty("--hero-wave-opacity", state.waveOpacity);
    hero.style.setProperty("--hero-wave-warp", state.waveWarp);
    hero.style.setProperty("--hero-stage-opacity", state.stageOpacity);
  }

  function resetHeroState() {
    hero.classList.remove("is-transition-live");
    hero.style.removeProperty("--hero-copy-opacity");
    hero.style.removeProperty("--hero-copy-scale");
    hero.style.removeProperty("--hero-copy-translate-y");
    hero.style.removeProperty("--hero-wave-opacity");
    hero.style.removeProperty("--hero-wave-warp");
    hero.style.removeProperty("--hero-stage-opacity");
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
        context.clearRect(0, 0, canvas.width, canvas.height);
      },
    });
  }

  function initDepthHeroTransition() {
    if (!canvas || !sticky) return;
    let ready = false;
    let failed = false;
    let schedule = () => {};
    let renderer;

    try {
      renderer = new DepthVideoStory(canvas, {
        particleScale: 0.72,
        requestFrame: () => schedule(),
      });
      renderer.setProgress(0);
      renderer.setEntrance(0);
      window.__flidHeroDepthTransition = renderer;
    } catch (error) {
      console.warn("Hero depth transition unavailable.", error);
      return;
    }

    schedule = installHeroTransition({
      draw(state, timestamp) {
        if (!ready || failed) return;
        renderer.setProgress(0);
        renderer.setEntrance(state.particleProgress);
        renderer.setColor(readColor("--fgColor-default", "#f0f6fc"));
        renderer.render(timestamp);
      },
      clear() {
        renderer.setEntrance(0);
      },
      resize() {
        if (ready) renderer.resize();
      },
    });

    renderer.load().then(
      () => {
        ready = true;
        schedule();
      },
      (error) => {
        failed = true;
        renderer.destroy();
        console.warn("Hero depth transition unavailable.", error);
      },
    );
  }

  const depthViewport = matchMedia("(min-width: 901px)");
  if (
    depthStory?.dataset.depthDemo === "local" &&
    depthViewport.matches &&
    !reducedMotion.matches
  ) {
    initDepthHeroTransition();
  } else {
    initProceduralHeroTransition();
  }
}

function heroOccludesStory() {
  if (!hero || reducedMotion.matches) return false;
  const bounds = hero.getBoundingClientRect();
  const scrollRange = Math.max(1, hero.offsetHeight - innerHeight);
  const progress = Math.min(1, Math.max(0, -bounds.top / scrollRange));
  return progress < 0.84;
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
      if (heroOccludesStory()) return;

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
      if (heroOccludesStory()) return;
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
