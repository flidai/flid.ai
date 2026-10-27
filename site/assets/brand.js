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

        return `
          <article class="reference-scale-row">
            <header><strong>${reference.size}px</strong><span>${reference.label} · ${reference.layers}L</span></header>
            <div class="reference-lockup" style="--reference-size:${reference.size}px">
              <img class="${className}" src="${asset.path}" alt="" loading="lazy" decoding="async">
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
      const label = asset.id.replaceAll("-", " ").replace(
        /\b\w/g,
        (character) => character.toUpperCase(),
      );
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
        const suffix = png.scale
          ? `${png.scale}×`
          : png.width === png.height
            ? `${png.width}`
            : "";
        downloads.push({
          label: `PNG${suffix ? ` ${suffix}` : ""}`,
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
// hash and scroll restoration land far from the target. Restore both once the page has its height.
const SCROLL_KEY = "flid-brand-scroll";
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

function restoreScroll() {
  if (userScrolled) return;

  const [navigation] = performance.getEntriesByType("navigation");
  if (navigation?.type === "back_forward" || navigation?.type === "reload") {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY));
      if (saved?.href === location.href) {
        scrollTo({ top: saved.y, behavior: "instant" });
        return;
      }
    } catch {
      // Fall through to the hash target.
    }
  }

  const target =
    location.hash.length > 1
      ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
      : null;
  // scrollIntoView honours each section's scroll-margin-top (the sticky header).
  target?.scrollIntoView({ block: "start", behavior: "instant" });
}

window.addEventListener("pagehide", saveScroll);

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
  .finally(() => requestAnimationFrame(restoreScroll));

// Mark the section being read in the chip row and keep its chip in view.
const chipRow = document.querySelector(".guide-header nav");
const chips = [...chipRow.querySelectorAll('a[href^="#"]')];
const readableSections = [...document.querySelectorAll(".guide-section[id]")];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let activeChip = null;

function revealChip(chip) {
  const row = chipRow.getBoundingClientRect();
  const box = chip.getBoundingClientRect();
  const inset = 32;
  // Scroll the row itself ("nearest"), never the page.
  if (box.left < row.left + inset) {
    chipRow.scrollBy({
      left: box.left - row.left - inset,
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  } else if (box.right > row.right - inset) {
    chipRow.scrollBy({
      left: box.right - row.right + inset,
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  }
}

function updateActiveChip() {
  // The section whose top has passed the line anchor links scroll to.
  const line = anchorLine();
  const current = readableSections.findLast(
    (section) => section.getBoundingClientRect().top <= line + 2,
  );
  const chip = chips.find((candidate) => candidate.hash === `#${current?.id}`) ?? null;
  if (chip === activeChip) return;

  activeChip?.removeAttribute("aria-current");
  activeChip = chip;
  if (chip) {
    chip.setAttribute("aria-current", "location");
    revealChip(chip);
  }
}

function anchorLine() {
  return parseFloat(getComputedStyle(readableSections[0]).scrollMarginTop) || 0;
}

// A thin band at the anchor line: sections crossing it change which chip is current.
let sectionObserver = null;

function observeSections() {
  const line = Math.round(anchorLine());
  const below = Math.max(0, innerHeight - line - 8);

  sectionObserver?.disconnect();
  sectionObserver = new IntersectionObserver(updateActiveChip, {
    rootMargin: `-${line}px 0px -${below}px 0px`,
  });
  for (const section of readableSections) sectionObserver.observe(section);
  updateActiveChip();
}

observeSections();
addEventListener("resize", observeSections);

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
