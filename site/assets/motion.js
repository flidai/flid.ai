// Page motion: product stories, counting facts and the pointer spotlight.
//
// Stories: a sticky screen beside numbered steps. As a step reaches the middle
// of the viewport the screen switches to that step's screenshot, or zooms into
// part of it. Without this script, and on narrow screens, every step shows its
// own screenshot under its text instead. Stories work with reduced motion too;
// the CSS then swaps screens without transitions.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wide = window.matchMedia("(min-width: 56rem)");

for (const story of document.querySelectorAll("[data-story]")) {
  const steps = [...story.querySelectorAll(".story-step")];
  const media = story.querySelector(".story-media");
  const frames = new Map([...story.querySelectorAll("[data-frame-key]")].map((f) => [f.dataset.frameKey, f]));
  const index = story.querySelector("[data-story-index]");
  if (!steps.length || !media) continue;

  media.hidden = false;
  story.classList.add("is-live");

  function activate(step) {
    const at = steps.indexOf(step);
    steps.forEach((s, i) => s.classList.toggle("is-active", i === at));
    const frame = frames.get(step.dataset.frame);
    for (const f of frames.values()) f.classList.toggle("is-active", f === frame);
    if (frame) {
      const [x = "50%", y = "50%", scale = "1"] = (step.dataset.zoom ?? "").split(" ").filter(Boolean);
      frame.style.setProperty("--zx", x);
      frame.style.setProperty("--zy", y);
      frame.style.setProperty("--zs", scale);
    }
    if (index) index.textContent = String(at + 1).padStart(2, "0");
  }

  activate(steps[0]);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) activate(entry.target);
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  steps.forEach((step) => observer.observe(step));

  // Progress along the steps, drawn as a rail beside them.
  let queued = false;
  function progress() {
    queued = false;
    if (!wide.matches) return;
    const box = story.querySelector(".story-steps").getBoundingClientRect();
    const middle = innerHeight / 2;
    const done = Math.min(1, Math.max(0, (middle - box.top) / box.height));
    story.style.setProperty("--progress", done.toFixed(3));
  }
  addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(progress);
      }
    },
    { passive: true },
  );
  progress();
}

if (!reduceMotion) {
  // Numbers count up the first time they come into view.
  const counter = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      counter.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.count);
      const start = performance.now();
      const duration = 1400;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 4))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => counter.observe(el));

  // A soft light follows the pointer over the hero grid, the product cards and the service cards.
  if (window.matchMedia("(pointer: fine)").matches) {
    const track = (surface, target) => {
      surface.addEventListener("pointermove", (event) => {
        const el = target(event);
        if (!el) return;
        const box = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${event.clientX - box.left}px`);
        el.style.setProperty("--my", `${event.clientY - box.top}px`);
      });
    };
    document.querySelectorAll("[data-spotlight]").forEach((el) => track(el, () => el));
    document.querySelectorAll("[data-spotlight-group]").forEach((group) =>
      track(group, (event) => event.target.closest(".feature, .product-link")),
    );
  }
}
