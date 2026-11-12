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

function formatValue(name, value) {
  if (name === "curl" || name === "strokeWidth") return Number(value).toFixed(2);
  if (name === "twist") return `${value}°`;
  return `${value}`;
}

function syncControls() {
  for (const control of controls) {
    const name = control.dataset.control;
    control.value = options[name];
    document.querySelector(`[data-output="${name}"]`).textContent = formatValue(
      name,
      options[name],
    );
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

  for (const button of document.querySelectorAll("[data-mode]")) {
    button.classList.toggle("is-active", button.dataset.mode === options.mode);
  }
}

function render() {
  preview.innerHTML = generateLogoSvg(options);
  preview.style.setProperty("--preview-accent", options.accent);
  meta.textContent = `${getMarkCount(options.layers)} MARKS · ${options.mode.toUpperCase()}`;
  syncControls();
}

function downloadSvg() {
  const svg = generateLogoSvg(options);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flid-signal-${options.layers}-layers.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

for (const control of controls) {
  control.addEventListener("input", () => {
    options = { ...options, [control.dataset.control]: Number(control.value) };
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.classList.remove("is-active");
    });
    render();
  });
}

for (const control of colorControls) {
  control.addEventListener("input", () => {
    options = { ...options, [control.dataset.color]: control.value };
    render();
  });
}

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    options = { ...options, mode: button.dataset.mode };
    render();
  });
}

for (const button of document.querySelectorAll("[data-preset]")) {
  button.addEventListener("click", () => {
    options = { ...options, ...presets[button.dataset.preset] };
    document.querySelectorAll("[data-preset]").forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate === button);
    });
    render();
  });
}

document.querySelector("[data-export]").addEventListener("click", downloadSvg);
document.querySelector("[data-reset]").addEventListener("click", () => {
  options = { ...DEFAULT_LOGO_OPTIONS, ...primaryOptions };
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === "primary");
  });
  render();
});

render();
