import { startBloom } from "/assets/bloom.js";

const root = document.documentElement;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (value) => Math.min(1, Math.max(0, value));
if (!still) root.classList.add("motion");

// Floating header gains its glass once the page moves.
const onHeader = () => root.classList.toggle("is-scrolled", scrollY > 24);

// Scroll-reveal for everything below the fold.
const reveals = document.querySelectorAll(".reveal");
if (!still && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("is-in"));
}

// Thesis: split each sentence into words that light up with scroll progress.
const thesis = document.querySelector("[data-thesis]");
const sentences = thesis && !still ? [...thesis.querySelectorAll("p")].map((sentence) => {
  const text = sentence.textContent.trim();
  sentence.textContent = "";
  const words = text.split(/\s+/).map((word, index, all) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = word;
    sentence.append(span, index < all.length - 1 ? " " : "");
    return span;
  });
  return { sentence, words };
}) : [];

const thesisProgress = () => {
  if (!thesis) return 0;
  const box = thesis.getBoundingClientRect();
  return clamp(-box.top / Math.max(1, box.height - innerHeight));
};

const paintThesis = () => {
  if (!sentences.length) return;
  const progress = thesisProgress();
  const slice = 1 / sentences.length;
  sentences.forEach(({ sentence, words }, index) => {
    const local = clamp((progress - slice * index) / (slice * 0.8));
    const gap = 0.05; // Neither sentence shows while the core crosses the screen.
    const showing = progress >= slice * index + (index ? gap : 0) && (progress < slice * (index + 1) - gap || index === sentences.length - 1);
    sentence.toggleAttribute("data-off", !showing);
    words.forEach((word, position) => {
      const lit = clamp(local * (words.length + 3) - position);
      word.style.setProperty("--w", String(0.14 + lit * 0.86));
    });
  });
};

// Product screens settle flat as they reach the middle of the screen.
const tilted = [...document.querySelectorAll("[data-tilt]")];
const paintTilt = () => {
  for (const element of tilted) {
    const box = element.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    element.style.setProperty("--t", clamp((middle - innerHeight * 0.48) / (innerHeight * 0.6)).toFixed(3));
  }
};

// Products: the screen turns toward the visitor and its real parts lift out as the section scrolls.
const shows = [...document.querySelectorAll("[data-show]")];
for (const show of shows) {
  const picture = show.querySelector(".main picture");
  for (const lift of show.querySelectorAll(".lift")) {
    const copy = picture.cloneNode(true);
    copy.querySelector("img").alt = "";
    lift.append(copy);
  }
  if (still) {
    show.style.setProperty("--p", "1");
    show.style.setProperty("--e", "1");
  } else if (matchMedia("(hover: hover)").matches) {
    show.addEventListener("pointermove", (event) => {
      show.style.setProperty("--mx", ((event.clientX / innerWidth) * 2 - 1).toFixed(3));
      show.style.setProperty("--my", ((event.clientY / innerHeight) * 2 - 1).toFixed(3));
    }, { passive: true });
  }
}
const paintShows = () => {
  for (const show of shows) {
    const box = show.getBoundingClientRect();
    if (box.bottom < -innerHeight || box.top > innerHeight * 2) continue;
    // Pinned on large screens: progress through the pin. Otherwise: progress across the screen.
    const pinned = box.height > innerHeight * 1.3;
    const place = pinned ? -box.top / (box.height - innerHeight) : (innerHeight * 0.75 - box.top) / (box.height * 0.7);
    show.style.setProperty("--p", clamp(place / 0.85).toFixed(3));
    show.style.setProperty("--e", clamp((innerHeight * 1.05 - box.top) / innerHeight).toFixed(3));
  }
};

let queued = false;
const bloomStage = document.querySelector("[data-bloom]");
const paint = () => {
  queued = false;
  onHeader();
  if (thesis && bloomStage) bloomStage.style.setProperty("--core", clamp((scrollY - thesis.offsetTop * 0.2) / (thesis.offsetTop * 0.7)).toFixed(3));
  paintThesis();
  if (!still) { paintTilt(); paintShows(); }
};
const request = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(paint);
};
addEventListener("scroll", request, { passive: true });
addEventListener("resize", request);
paint();

// Signal wave: one canvas per page, paused whenever its zone is off screen.
const bloomHost = document.querySelector("[data-bloom]");
if (bloomHost) {
  const bloom = startBloom(bloomHost, {
    getFade: () => (thesis ? 1 - clamp(scrollY / (thesis.offsetTop * 0.8)) : 1),
  });
  const zone = document.querySelector("[data-bloom-zone]") ?? bloomHost;
  if (bloom && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => bloom.setActive(entry.isIntersecting), { rootMargin: "120px" }).observe(zone);
  }
}

// The 3D scenes load one at a time: the core at once, the others when the browser is idle,
// so none of them can freeze the page in the middle of a scroll.
const idle = () => new Promise((done) => {
  if ("requestIdleCallback" in window) requestIdleCallback(done, { timeout: 1200 });
  else setTimeout(done, 200);
});
const coreCanvas = document.querySelector("[data-core]");
const sheetsCanvas = document.querySelector("[data-sheets]");
const wordHost = document.querySelector("[data-word]");
(async () => {
  try {
    if (coreCanvas && thesis) {
      const { startCore } = await import("/assets/core.js");
      await startCore(coreCanvas, thesis, { still });
    }
    if (sheetsCanvas) {
      await idle();
      const { startSheets } = await import("/assets/sheets.js");
      await startSheets(sheetsCanvas, document.querySelector(".layer-rows"), { still });
    }
    if (wordHost) {
      await idle();
      const { startWord } = await import("/assets/word.js");
      await startWord(wordHost.querySelector("canvas"), wordHost, { still });
    }
  } catch (error) {
    // The flat versions stay on the page.
    console.warn(error);
  }
})();

// Foundations: the plane for the row in the middle of the screen lifts.
const rows = [...document.querySelectorAll("[data-layer]")];
if (rows.length) {
  const planes = document.querySelectorAll("[data-plane]");
  const activate = (id) => {
    rows.forEach((row) => row.classList.toggle("is-on", row.dataset.layer === id));
    planes.forEach((plane) => plane.classList.toggle("is-on", plane.dataset.plane === id));
  };
  activate(rows[0].dataset.layer);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) activate(entry.target.dataset.layer);
    }, { rootMargin: "-48% 0px -48% 0px" });
    rows.forEach((row) => observer.observe(row));
  }
}

// Cards follow the cursor with a soft light.
if (matchMedia("(hover: hover)").matches) {
  for (const element of document.querySelectorAll(".spot")) {
    element.addEventListener("pointermove", (event) => {
      const box = element.getBoundingClientRect();
      element.style.setProperty("--mx", `${event.clientX - box.left}px`);
      element.style.setProperty("--my", `${event.clientY - box.top}px`);
    }, { passive: true });
  }
}
