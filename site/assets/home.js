import {
  buildLogoModel,
  generateLogoSvg,
} from "/lib/logo-generator.mjs";

const PRIMARY_MARK = Object.freeze({
  mode: "line",
  layers: 12,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.58,
  padding: 10,
  accents: 0,
});

const signal = document.querySelector("[data-signal-field]");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (signal && !reducedMotion.matches) {
  const canvas = signal.querySelector("[data-signal-canvas]");
  const hero = signal.closest(".hero");
  const { marks } = buildLogoModel(PRIMARY_MARK);

  canvas.innerHTML = generateLogoSvg(PRIMARY_MARK);

  const svg = canvas.querySelector("svg");
  const centerDot = svg.querySelector("circle");
  const groups = [...svg.querySelectorAll("g")];
  const animatedMarks = groups.map((group, index) => ({
    group,
    mark: marks[index + 1],
    progress: (index + 1) / groups.length,
  }));

  svg.setAttribute("aria-hidden", "true");
  svg.removeAttribute("role");

  function setCanonicalField() {
    for (const { group, mark } of animatedMarks) {
      group.setAttribute(
        "transform",
        `translate(${mark.x} ${mark.y}) rotate(${mark.rotation})`,
      );
    }

    canvas.style.setProperty("--field-x", "0px");
    canvas.style.setProperty("--field-y", "0px");
  }

  setCanonicalField();

  for (const { group } of animatedMarks) {
    group.style.opacity = "0";
  }
  centerDot.style.opacity = "0";
  signal.classList.add("is-live");

  requestAnimationFrame(() => {
    centerDot.animate(
      [
        { opacity: 0, transform: "scale(0.25)", transformOrigin: "center" },
        { opacity: 1, transform: "scale(1)", transformOrigin: "center" },
      ],
      {
        duration: 460,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );

    animatedMarks.forEach(({ group }, index) => {
      group.animate([{ opacity: 0 }, { opacity: 1 }], {
        delay: 90 + index * 6,
        duration: 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      });
    });
  });

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let isVisible = true;
  let frameId = 0;
  let previousFrameTime = 0;

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

  function animateField(time) {
    if (!isVisible || reducedMotion.matches) {
      frameId = 0;
      setCanonicalField();
      return;
    }

    if (time - previousFrameTime < 1000 / 30) {
      frameId = requestAnimationFrame(animateField);
      return;
    }
    previousFrameTime = time;

    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    const breath = Math.sin(time / 10_000 * Math.PI);

    for (const { group, mark, progress } of animatedMarks) {
      const depth = 0.2 + progress * 0.8;
      const fieldScale = 1 + breath * 0.006 * depth;
      const x =
        50 +
        (mark.x - 50) * fieldScale +
        pointer.x * 0.72 * depth;
      const y =
        50 +
        (mark.y - 50) * fieldScale +
        pointer.y * 0.72 * depth;
      const rotation =
        mark.rotation +
        breath * 0.7 * progress +
        pointer.x * 0.55 * progress;

      group.setAttribute(
        "transform",
        `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rotation.toFixed(3)})`,
      );
    }

    canvas.style.setProperty("--field-x", `${(pointer.x * 2.8).toFixed(2)}px`);
    canvas.style.setProperty("--field-y", `${(pointer.y * 2.8).toFixed(2)}px`);
    frameId = requestAnimationFrame(animateField);
  }

  function startField() {
    if (!frameId && !reducedMotion.matches) {
      frameId = requestAnimationFrame(animateField);
    }
  }

  hero.addEventListener("pointermove", updatePointer, { passive: true });
  hero.addEventListener("pointerleave", settlePointer);

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        startField();
      } else {
        settlePointer();
      }
    },
    { threshold: 0.04 },
  );

  visibilityObserver.observe(hero);

  reducedMotion.addEventListener("change", ({ matches }) => {
    if (matches) {
      svg.getAnimations({ subtree: true }).forEach((animation) => {
        animation.cancel();
      });
      for (const { group } of animatedMarks) {
        group.style.opacity = "1";
      }
      centerDot.style.opacity = "1";
      signal.classList.remove("is-live");
      setCanonicalField();
    } else {
      signal.classList.add("is-live");
      startField();
    }
  });

  startField();
}
