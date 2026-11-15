// Page motion: product stories, counting facts, the pointer spotlight, the
// home hero's depth and the floating call button.
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

// The floating call button shows once the hero has scrolled away, and steps
// aside while the closing section or the footer is on screen, where a call to
// talk is already in view. It works with reduced motion too, without the fade.
const cta = document.querySelector("[data-float-cta]");
if (cta) {
  const covers = [document.querySelector("[data-hero]"), document.querySelector(".closing"), document.querySelector(".site-footer")].filter(Boolean);
  const visible = new Set();
  cta.hidden = false;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target);
    cta.classList.toggle("is-shown", visible.size === 0);
  });
  covers.forEach((el) => observer.observe(el));
}

// Home hero depth: the mark and the floating screenshots follow the pointer by
// different amounts. --px and --py ease towards the pointer, from -1 to 1.
const hero = document.querySelector("[data-hero]");
if (hero && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
  let tx = 0, ty = 0, x = 0, y = 0, frame = 0;
  const step = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    hero.style.setProperty("--px", x.toFixed(3));
    hero.style.setProperty("--py", y.toFixed(3));
    frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
  };
  const aim = (nx, ny) => {
    tx = nx;
    ty = ny;
    if (!frame) frame = requestAnimationFrame(step);
  };
  hero.addEventListener("pointermove", (event) => {
    const box = hero.getBoundingClientRect();
    aim(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1);
  });
  hero.addEventListener("pointerleave", () => aim(0, 0));
}
