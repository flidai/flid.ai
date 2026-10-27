import { brandSystem } from "/lib/brand-system.mjs";
import {
  DEFAULT_LOGO_OPTIONS,
  generateLogoSvg,
  getMarkCount,
} from "/lib/logo-generator.mjs";

const primaryOptions = {
  mode: brandSystem.primaryMark.mode,
  layers: brandSystem.primaryMark.layers,
  curl: brandSystem.primaryMark.curl,
  twist: brandSystem.primaryMark.twist,
  strokeWidth: brandSystem.primaryMark.strokeWidth,
  padding: brandSystem.primaryMark.padding,
  accents: brandSystem.primaryMark.accents,
};

const presets = {
  full: {
    mode: "line",
    layers: 16,
    curl: 0.88,
    twist: 0,
    strokeWidth: 0.42,
    padding: 8,
    accents: 3,
  },
  primary: primaryOptions,
  essential: {
    mode: "line",
    layers: 8,
    curl: 0.88,
    twist: 0,
    strokeWidth: 0.7,
    padding: 8,
    accents: 0,
  },
};

let options = { ...DEFAULT_LOGO_OPTIONS, ...primaryOptions };

const preview = document.querySelector("[data-preview]");
const meta = document.querySelector("[data-mark-meta]");
const controls = [...document.querySelectorAll("[data-control]")];
const colorControls = [...document.querySelectorAll("[data-color]")];
const presetButtons = [...document.querySelectorAll("[data-preset]")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const exportButton = document.querySelector("[data-export]");

function formatValue(name, value) {
  if (name === "curl" || name === "strokeWidth") return Number(value).toFixed(2);
  if (name === "twist") return `${value}°`;
  return `${value}`;
}

function formatNumber(value) {
  return Number(value.toFixed(2)).toString();
}

// A preset is active only while every parameter it owns still matches it.
function activePreset() {
  return Object.keys(presets).find((name) =>
    Object.entries(presets[name]).every(
      ([key, value]) =>
        typeof value === "number"
          ? Math.abs(options[key] - value) < 1e-9
          : options[key] === value,
    ),
  );
}

function syncControls() {
  for (const control of controls) {
    const name = control.dataset.control;
    const text = formatValue(name, options[name]);
    control.value = options[name];
    control.setAttribute("aria-valuetext", text);
    document.querySelector(`[data-output="${name}"]`).textContent = text;
  }

  for (const control of colorControls) {
    control.value = options[control.dataset.color];
  }

  const silhouette = options.mode === "silhouette";
  const accents = document.querySelector('[data-control="accents"]');
  accents.disabled = silhouette;
  accents.closest(".generator-control").classList.toggle("is-disabled", silhouette);
  document.querySelector('[data-color="accent"]').disabled = silhouette;
  document
    .querySelector('[data-color="accent"]')
    .closest("label")
    .classList.toggle("is-disabled", silhouette);

  for (const button of modeButtons) {
    const active = button.dataset.mode === options.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  const preset = activePreset();
  for (const button of presetButtons) {
    const active = button.dataset.preset === preset;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

// Compact markup roughly halves the preview's DOM without changing a pixel. While a slider
// is moving, a draft drops to two decimals and far fewer outline vertices; the settled
// preview is the full-precision geometry. Downloads below use the canonical output.
const PREVIEW_RENDERING = {
  full: { compact: true },
  draft: { compact: true, precision: 2, quality: "draft" },
};

function render(quality = "full") {
  preview.innerHTML = generateLogoSvg({
    ...options,
    ...PREVIEW_RENDERING[quality],
  });
  preview.style.setProperty("--preview-accent", options.accent);
  meta.textContent = `${getMarkCount(options.layers)} MARKS · ${options.mode.toUpperCase()}`;
  syncControls();
}

// The SVG is 175-490 KB of path data. Input events coalesce to one render per frame, and
// that render is a lighter draft; the full-quality mark follows as soon as the drag settles.
const SETTLE_DELAY_MS = 160;
let pendingFrame = 0;
let settleTimer = 0;

function scheduleRender() {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(renderNow, SETTLE_DELAY_MS);
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    render("draft");
  });
}

function renderNow() {
  cancelAnimationFrame(pendingFrame);
  clearTimeout(settleTimer);
  pendingFrame = 0;
  settleTimer = 0;
  render();
}

// Short stable FNV-1a hash so exports of different settings never share a filename.
function hashOptions() {
  const key = [
    options.mode,
    options.layers,
    formatNumber(options.curl),
    options.twist,
    formatNumber(options.strokeWidth),
    options.padding,
    options.accents,
    options.foreground,
    options.accent,
  ].join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

const EXPORT_DEBOUNCE_MS = 600;
const EXPORT_SIZE_PX = 512;
let lastExport = -Infinity;

function downloadSvg() {
  // One tap, one file: ignore repeat taps while the browser is still saving.
  if (performance.now() - lastExport < EXPORT_DEBOUNCE_MS) return;
  lastExport = performance.now();

  renderNow();
  // A natural size stops viewers opening the file at a collapsed or window-filling scale.
  const svg = generateLogoSvg({ ...options, size: EXPORT_SIZE_PX });
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flid-signal-${options.mode}-${options.layers}l-${hashOptions()}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Back/forward and form restore can leave the controls at values the preview never saw: adopt them.
function adoptControlValues() {
  const next = { ...options };
  for (const control of controls) {
    next[control.dataset.control] = Number(control.value);
  }
  for (const control of colorControls) {
    next[control.dataset.color] = control.value;
  }
  const changed = Object.keys(next).some((key) => next[key] !== options[key]);
  options = next;

  return changed;
}

for (const control of controls) {
  control.addEventListener("input", () => {
    options = { ...options, [control.dataset.control]: Number(control.value) };
    scheduleRender();
  });
  // Releasing the thumb (or any committed keyboard step) finishes at full quality at once.
  control.addEventListener("change", renderNow);
}

for (const control of colorControls) {
  control.addEventListener("input", () => {
    options = { ...options, [control.dataset.color]: control.value };
    scheduleRender();
  });
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    options = { ...options, mode: button.dataset.mode };
    renderNow();
  });
}

for (const button of presetButtons) {
  button.addEventListener("click", () => {
    options = { ...options, ...presets[button.dataset.preset] };
    renderNow();
  });
}

exportButton.addEventListener("click", downloadSvg);
document.querySelector("[data-reset]").addEventListener("click", () => {
  options = { ...DEFAULT_LOGO_OPTIONS, ...primaryOptions };
  renderNow();
});

// Restored pages (bfcache, form restore) re-sync so controls, preview and export agree.
window.addEventListener("pageshow", () => {
  if (adoptControlValues()) renderNow();
});

render();
