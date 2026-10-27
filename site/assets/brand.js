import { brandSystem } from "/lib/brand-system.mjs";

function findAsset(manifest, { type, master, theme = "on-dark" }) {
  return manifest.assets.find(
    (asset) =>
      asset.type === type &&
      asset.master === master &&
      asset.theme === theme,
  );
}

function renderScaleReferences(manifest) {
  document.querySelector("[data-brand-scale]").innerHTML =
    brandSystem.scaleReferences
      .map((reference) => {
        const master = "primary";
        const iconOnly = reference.role === "Small icon only";
        const asset = findAsset(manifest, {
          type: iconOnly ? "mark" : "lockup",
          master,
        });
        const className = iconOnly
          ? "reference-asset is-icon"
          : "reference-asset is-lockup";
        // Intrinsic size reserves the box before the lazy image arrives, so a deep link
        // never lands off target when it decodes.
        const { width, height } = asset.files.png[0];

        return `
          <article class="reference-scale-row">
            <header><strong>${reference.size}px</strong><span>${reference.label} · ${reference.layers}L</span></header>
            <div class="reference-lockup" style="--reference-size:${reference.size}px">
              <img class="${className}" src="${asset.path}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async">
            </div>
            <span>${reference.role}</span>
          </article>`;
      })
      .join("");
}

function renderAssetLibrary(manifest) {
  document.querySelector("[data-brand-assets]").innerHTML = manifest.assets
    .filter((asset) => asset.status === "approved")
    .map((asset) => {
      const surface =
        asset.theme === "on-light"
          ? "is-light"
          : asset.theme === "adaptive"
            ? "is-accent"
            : "is-dark";
      const label = asset.id
        .replaceAll("-", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
        .replace(/\bLinkedin\b/g, "LinkedIn");
      const downloads = [];
      if (asset.files?.svg) {
        downloads.push({ label: "SVG", path: asset.files.svg });
      }
      if (asset.files?.pdf) {
        downloads.push({ label: "PDF", path: asset.files.pdf });
      }
      if (asset.files?.ico) {
        downloads.push({ label: "ICO", path: asset.files.ico });
      }
      for (const png of asset.files?.png ?? []) {
        // Name the real pixel size so the right export is obvious before downloading.
        const pixels =
          png.width === png.height
            ? `${png.width}px`
            : `${png.width}×${png.height}`;
        downloads.push({
          label: png.scale ? `PNG ${png.scale}× · ${pixels}` : `PNG ${pixels}`,
          path: png.path,
        });
      }

      // Intrinsic size reserves the preview's box so lazy images never shift the page.
      const size = asset.files?.png?.[0];
      const dimensions = size
        ? ` width="${size.width}" height="${size.height}"`
        : "";

      return `
        <article class="asset-card">
          <div class="asset-preview ${surface}">
            <img src="${asset.path}" alt=""${dimensions} loading="lazy" decoding="async">
          </div>
          <footer>
            <strong>${label}</strong>
            <div class="asset-downloads">
              ${downloads
                .map(
                  ({ label: downloadLabel, path }) =>
                    `<a href="${path}" download aria-label="${label} — ${downloadLabel}">${downloadLabel} ↓</a>`,
                )
                .join("")}
            </div>
          </footer>
        </article>`;
    })
    .join("");
}

document.querySelector("[data-brand-colors]").innerHTML = Object.values(
  brandSystem.colors,
)
  .map(
    (color) => `
      <article class="color-card" style="--swatch:${color.hex}">
        <div></div>
        <footer><strong>${color.name}</strong><span>${color.token}<br>${color.hex}</span></footer>
      </article>`,
  )
  .join("");

// Sections above #assets are filled in after the manifest loads, so the browser's own
// hash and scroll restoration land far from the target. Restore both once the page has its
// height, and keep correcting while late layout (images, fonts) still moves the target.
const SCROLL_KEY = "flid-brand-scroll";
const SETTLE_WINDOW_MS = 2500;
let userScrolled = false;

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) {
  window.addEventListener(type, () => (userScrolled = true), {
    once: true,
    passive: true,
  });
}

function saveScroll() {
  try {
    sessionStorage.setItem(
      SCROLL_KEY,
      JSON.stringify({ href: location.href, y: Math.round(scrollY) }),
    );
  } catch {
    // Storage can be unavailable; losing the saved position is harmless.
  }
}

// Where this visit should land: the saved position on Back/Forward/reload, else the hash.
function restoreTarget() {
  const [navigation] = performance.getEntriesByType("navigation");
  if (navigation?.type === "back_forward" || navigation?.type === "reload") {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY));
      if (saved?.href === location.href) return { top: saved.y };
    } catch {
      // Fall through to the hash target.
    }
  }

  try {
    const id = decodeURIComponent(location.hash.slice(1));
    const element = id ? document.getElementById(id) : null;
    if (element) return { element };
  } catch {
    // A malformed hash has no target.
  }

  return null;
}

function applyTarget(target) {
  if (target.element) {
    // scrollIntoView honours each section's scroll-margin-top (the sticky header).
    target.element.scrollIntoView({ block: "start", behavior: "instant" });
  } else {
    scrollTo({ top: target.top, behavior: "instant" });
  }
}

let stopSettling = () => {};

function restoreScroll() {
  stopSettling();
  if (userScrolled) return;

  const target = restoreTarget();
  if (!target) return;

  applyTarget(target);

  // Images and fonts above the target settle after the first restore and shift it.
  // Re-apply on each layout change until the page is still or the reader takes over.
  const observer = new ResizeObserver(() => {
    if (!userScrolled) applyTarget(target);
  });
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const type of takeover) window.removeEventListener(type, stop);
  };
  const timer = setTimeout(stop, SETTLE_WINDOW_MS);
  const takeover = ["wheel", "touchstart", "keydown", "pointerdown"];
  observer.observe(document.body);
  for (const type of takeover) {
    window.addEventListener(type, stop, { once: true, passive: true });
  }
  stopSettling = stop;
}

// requestAnimationFrame never fires in a hidden or prerendered page, so a timer backs it up.
function scheduleRestore() {
  requestAnimationFrame(restoreScroll);
  setTimeout(restoreScroll, 300);
}

window.addEventListener("pagehide", saveScroll);
// A page restored from the back/forward cache keeps its position; anything else reloads it.
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) scheduleRestore();
});

fetch("/brand-assets/manifest.json")
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load brand assets");
    return response.json();
  })
  .then((manifest) => {
    renderScaleReferences(manifest);
    renderAssetLibrary(manifest);
  })
  .catch(() => {
    document.querySelector("[data-brand-scale]").textContent =
      "Scale references could not be loaded.";
    document.querySelector("[data-brand-assets]").textContent =
      "Brand assets could not be loaded.";
  })
  .finally(scheduleRestore);

// Mark the section being read in the chip row and keep its chip in view.
const chipRow = document.querySelector(".guide-header nav");
const chips = [...chipRow.querySelectorAll('a[href^="#"]')];
const readableSections = [...document.querySelectorAll(".guide-section[id]")];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let activeChip = null;

// Scroll the chip row itself, never the page, so the active chip is fully visible.
function revealChip(chip) {
  const row = chipRow.getBoundingClientRect();
  const box = chip.getBoundingClientRect();
  const inset = 40;
  let delta = 0;

  if (box.left < row.left + inset) delta = box.left - row.left - inset;
  else if (box.right > row.right - inset) delta = box.right - row.right + inset;

  if (delta) {
    chipRow.scrollBy({
      left: delta,
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  }
}

function setActiveChip(chip) {
  if (chip !== activeChip) {
    activeChip?.removeAttribute("aria-current");
    activeChip = chip;
    chip?.setAttribute("aria-current", "location");
  }
  if (chip) revealChip(chip);
}

function anchorLine() {
  return parseFloat(getComputedStyle(readableSections[0]).scrollMarginTop) || 0;
}

// The section whose top has passed the line chip links scroll to (with room for rounding).
const ANCHOR_TOLERANCE = 40;

function currentSection() {
  const line = anchorLine() + ANCHOR_TOLERANCE;
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  if (atEnd) return readableSections.at(-1);

  return readableSections.findLast(
    (section) => section.getBoundingClientRect().top <= line,
  );
}

function updateActiveChip() {
  const current = currentSection();
  const chip = chips.find((candidate) => candidate.hash === `#${current?.id}`) ?? null;
  if (chip !== activeChip) setActiveChip(chip);
}

// After a chip tap the page scrolls (often smoothly) to its section. The tapped chip is
// the answer, so scroll updates wait until the scrolling stops, then re-check.
const SCROLL_IDLE_MS = 160;
let tapped = false;
let idleTimer = 0;
let scrollFrame = 0;

function settleAfterScroll() {
  tapped = false;
  updateActiveChip();
}

function onScroll() {
  if (tapped) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(settleAfterScroll, SCROLL_IDLE_MS);
    return;
  }
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateActiveChip();
  });
}

for (const chip of chips) {
  chip.addEventListener("click", () => {
    setActiveChip(chip);
    tapped = true;
    // If the page is already at the target no scroll event follows.
    clearTimeout(idleTimer);
    idleTimer = setTimeout(settleAfterScroll, 400);
  });
}

addEventListener("scroll", onScroll, { passive: true });
addEventListener("scrollend", () => {
  clearTimeout(idleTimer);
  settleAfterScroll();
});
addEventListener("resize", updateActiveChip);
updateActiveChip();

const sourceElement = document.querySelector("[data-generator-source]");
fetch("/lib/logo-generator.mjs")
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load source");
    return response.text();
  })
  .then((source) => {
    sourceElement.textContent = source;
  })
  .catch(() => {
    sourceElement.textContent = "Generator source could not be loaded.";
  });
