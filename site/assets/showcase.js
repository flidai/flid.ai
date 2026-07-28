import { generateLogoSvg } from "/lib/logo-generator.mjs";
import { primerColors } from "/lib/primer-colors.mjs";

const primary = {
  mode: "line",
  layers: 12,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.58,
  padding: 10,
  accents: 0,
};

const logoVariations = [
  {
    id: "full",
    name: "Full study",
    detail: "16 layers · 240 marks",
    range: "Archived exploration",
    use: "Reference only · not for production",
    options: { layers: 16, strokeWidth: 0.42, accents: 3 },
  },
  {
    id: "reduced",
    name: "Primary",
    detail: "12 layers · 135 marks",
    range: "All production sizes",
    use: "Approved · all brand applications",
    options: { layers: 12, strokeWidth: 0.58, accents: 0 },
  },
  {
    id: "essential",
    name: "Essential study",
    detail: "8 layers · 60 marks",
    range: "Archived exploration",
    use: "Reference only · not for production",
    options: { layers: 8, strokeWidth: 0.7, accents: 0 },
  },
];

const scaleSteps = [
  { size: 24, wordmarkSize: 17, variation: logoVariations[1] },
  { size: 40, wordmarkSize: 26, variation: logoVariations[1] },
  { size: 64, wordmarkSize: 38, variation: logoVariations[1] },
  { size: 96, wordmarkSize: 54, variation: logoVariations[1] },
  { size: 144, wordmarkSize: 76, variation: logoVariations[1] },
];

function mark(options = {}, className = "") {
  return `<span class="showcase-mark ${className}" aria-hidden="true">${generateLogoSvg({
    ...primary,
    ...options,
  })}</span>`;
}

function wordmark({ inverse = false, typeface = "geist", extraClass = "" } = {}) {
  return `<span class="showcase-wordmark wordmark-type-${typeface}${inverse ? " is-inverse" : ""} ${extraClass}">flid</span>`;
}

function lockup(construction, variation) {
  const silhouette = construction !== "field";
  const reversed = construction === "silhouette-reversed";
  const label = reversed
    ? "Reversed silhouette / dark"
    : silhouette
      ? "Contained silhouette / light"
      : "Open field";
  const foreground = reversed
    ? primerColors.dark.foreground
    : silhouette
      ? primerColors.light.foreground
      : primerColors.dark.foreground;

  return `
    <article class="lockup-sample lockup-sample-${construction} lockup-variation-${variation.id}"${construction === "silhouette" ? ' data-color-mode="light"' : ""}>
      <div class="lockup-sample-logo">
        ${mark({
          ...variation.options,
          mode: silhouette ? "silhouette" : "line",
          padding: silhouette ? 8 : 10,
          foreground,
        })}
        ${wordmark({ inverse: !silhouette || reversed })}
      </div>
      <footer><span>${label}</span><span>${variation.range}</span></footer>
    </article>`;
}

document.querySelector("[data-primary-lockup]").innerHTML =
  `${mark({ foreground: primerColors.dark.canvas })}${wordmark({ extraClass: "on-accent" })}`;

document.querySelector("[data-logo-matrix]").innerHTML = logoVariations
  .map(
    (variation, index) => `
      <div class="showcase-matrix-row">
        <header class="matrix-variation">
          <span>0${index + 1}</span>
          <h2>${variation.name}</h2>
          <p>${variation.detail}</p>
          <p>${variation.use}</p>
        </header>
        ${lockup("field", variation)}
        ${lockup("silhouette", variation)}
        ${lockup("silhouette-reversed", variation)}
      </div>`,
  )
  .join("");

const typeStudies = [
  {
    label: "Geist / APPROVED",
    typeface: "geist",
    description: "Quiet and precise. The approved Flid wordmark face.",
    specification: "GEIST · 600 · NATIVE KERNING",
  },
  {
    label: "Inter / PRODUCT NEUTRAL",
    typeface: "inter",
    description: "Open and dependable, but still vertically assertive in flid.",
    specification: "INTER · 620 · −6%",
  },
  {
    label: "DM Sans / WIDE NEUTRAL",
    typeface: "dm-sans",
    description: "Broader and calmer. A useful new candidate for the short wordmark.",
    specification: "DM SANS · 620 · −5%",
  },
  {
    label: "Space Grotesk / TECHNICAL",
    typeface: "space-grotesk",
    description: "Distinctive and engineered, though more active beside the field.",
    specification: "SPACE GROTESK · 600 · −5.5%",
  },
];

document.querySelector("[data-type-studies]").innerHTML = typeStudies
  .map(
    (study, index) => `
      <article class="type-study-card">
        <header><span>0${index + 1} / ${study.label}</span></header>
        <div class="type-study-lockup">${mark()}${wordmark({
          inverse: true,
          typeface: study.typeface,
        })}</div>
        <footer><p>${study.description}</p><span>${study.specification}</span></footer>
      </article>`,
  )
  .join("");

document.querySelector("[data-applications]").innerHTML = `
  <article class="application-card application-card-dark">
    <div class="application-lockup">${mark()}${wordmark({ inverse: true })}</div>
    <span>PRIMARY OPEN FIELD / DARK</span>
  </article>
  <article class="application-card application-card-accent">
    <div class="application-lockup">${mark({ foreground: primerColors.dark.canvas })}${wordmark()}</div>
    <span>PRIMARY OPEN FIELD / ACCENT</span>
  </article>
  <article class="application-card application-card-reversed">
    <div class="application-lockup">${mark()}${wordmark({ inverse: true })}</div>
    <span>PRIMARY OPEN FIELD / REVERSED</span>
  </article>`;

const reverseStudies = [
  {
    className: "reverse-study-current",
    title: "CURRENT WHITE DISC",
    detail: "Reduced · 12L · contained",
    options: {
      mode: "silhouette",
      padding: 8,
      foreground: primerColors.dark.foreground,
    },
  },
  {
    className: "reverse-study-open is-recommended",
    title: "APPROVED OPEN FIELD",
    detail: "Primary · 12L · no disc",
    options: {},
  },
  {
    className: "reverse-study-compensated",
    title: "OPTICALLY COMPENSATED",
    detail: "Essential · 8L · 1.05 cut",
    options: {
      mode: "silhouette",
      layers: 8,
      strokeWidth: 1.05,
      padding: 8,
      foreground: primerColors.dark.foreground,
    },
  },
  {
    className: "reverse-study-accent",
    title: "ACCENT ESSENTIAL BADGE",
    detail: "Essential · 8L · brand color",
    options: {
      mode: "silhouette",
      layers: 8,
      strokeWidth: 0.9,
      padding: 8,
      foreground: primerColors.dark.accent,
    },
  },
];

document.querySelector("[data-reverse-studies]").innerHTML = reverseStudies
  .map(
    (study, index) => `
      <article class="reverse-study-card ${study.className}">
        <div class="reverse-study-lockup">${mark(study.options)}${wordmark({ inverse: true })}</div>
        <footer><strong>0${index + 1} / ${study.title}</strong><span>${study.detail}</span></footer>
      </article>`,
  )
  .join("");

document.querySelector("[data-scale-board]").innerHTML = scaleSteps
  .map(
    ({ size, wordmarkSize, variation }) => `
      <article class="scale-sample">
        <header><strong>${size}px</strong><span>${variation.name} · ${variation.options.layers}L</span></header>
        <div class="scale-lockup" style="--scale-mark-size:${size}px;--scale-wordmark-size:${wordmarkSize}px">
          ${mark({ ...variation.options, padding: 10 })}
          ${wordmark({ inverse: true })}
        </div>
        <span>${variation.range}</span>
      </article>`,
  )
  .join("");

document.querySelector("[data-footer-lockup]").innerHTML =
  `${mark()}${wordmark({ inverse: true })}`;
