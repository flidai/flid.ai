import { buildLogoDrawing } from "./logo-generator.mjs";
import { primerColors } from "./primer-colors.mjs";

// The showcase is static: the build renders every tile once, writes each distinct mark
// to its own SVG file, and inlines the lockup markup into /showcase/. Nothing runs in
// the browser, so content appears with the HTML and equal marks share one cached file.

const primary = {
  mode: "line",
  layers: 12,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.58,
  padding: 10,
  accents: 0,
};

export const logoVariations = [
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

// Compact syntax shrinks the files without changing a pixel. Full precision stays: rounding
// to two decimals shifts edges enough to show on 3x displays.
const FILE_RENDERING = { compact: true };

function stripHash(color) {
  return color.replace("#", "").toLowerCase();
}

/** Collects the distinct mark files a page needs and the markup that references them. */
export function createMarkRegistry() {
  const files = new Map();

  function mark(options = {}, { eager = false } = {}) {
    const input = { ...primary, ...options };
    const drawing = buildLogoDrawing({ ...input, ...FILE_RENDERING });
    const foreground = drawing.options.foreground;
    const name = [
      drawing.options.mode,
      `${drawing.options.layers}l`,
      `sw${String(drawing.options.strokeWidth).replace(".", "")}`,
      `a${drawing.options.accents}`,
      `p${drawing.options.padding}`,
      stripHash(foreground),
    ].join("-");
    const path = `/showcase/marks/${name}.svg`;

    if (!files.has(path)) {
      files.set(
        path,
        [
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${drawing.viewBox}" data-rendering="filled-outlines" data-stroke-width="${drawing.options.strokeWidth}">`,
          "<title>Flid procedural signal mark</title>",
          `<desc>${drawing.description}</desc>`,
          drawing.defs,
          drawing.body,
          "</svg>\n",
        ].join(""),
      );
    }

    // Only the hero mark is on the first screen. Everything else loads lazily so it cannot
    // compete with the hero for bandwidth; the CSS aspect ratio reserves each box.
    const loading = eager
      ? 'loading="eager" fetchpriority="high"'
      : 'loading="lazy"';

    return `<span class="showcase-mark" aria-hidden="true"><img src="${path}" alt="" width="100" height="100" ${loading} decoding="async"></span>`;
  }

  return { files, mark };
}

function wordmark({ inverse = false, typeface = "geist", extraClass = "" } = {}) {
  return `<span class="showcase-wordmark wordmark-type-${typeface}${inverse ? " is-inverse" : ""} ${extraClass}">flid</span>`;
}

function lockup(registry, construction, variation) {
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
        ${registry.mark(
          {
            ...variation.options,
            mode: silhouette ? "silhouette" : "line",
            padding: silhouette ? 8 : 10,
            foreground,
          },
        )}
        ${wordmark({ inverse: !silhouette || reversed })}
      </div>
      <footer><span>${label}</span><span>${variation.range}</span></footer>
    </article>`;
}

/** Renders each dynamic region of the showcase page as an HTML string, keyed by slot. */
export function renderShowcase() {
  const registry = createMarkRegistry();
  const { mark } = registry;

  const slots = {
    "data-primary-lockup": `${mark({ foreground: primerColors.dark.canvas }, { eager: true })}${wordmark({ extraClass: "on-accent" })}`,

    "data-logo-matrix": logoVariations
      .map(
        (variation, index) => `
      <div class="showcase-matrix-row">
        <header class="matrix-variation">
          <span>0${index + 1}</span>
          <h2>${variation.name}</h2>
          <p>${variation.detail}</p>
          <p>${variation.use}</p>
        </header>
        ${lockup(registry, "field", variation)}
        ${lockup(registry, "silhouette", variation)}
        ${lockup(registry, "silhouette-reversed", variation)}
      </div>`,
      )
      .join(""),

    "data-type-studies": typeStudies
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
      .join(""),

    "data-applications": `
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
  </article>`,

    "data-reverse-studies": reverseStudies
      .map(
        (study, index) => `
      <article class="reverse-study-card ${study.className}">
        <div class="reverse-study-lockup">${mark(study.options)}${wordmark({ inverse: true })}</div>
        <footer><strong>0${index + 1} / ${study.title}</strong><span>${study.detail}</span></footer>
      </article>`,
      )
      .join(""),

    "data-scale-board": scaleSteps
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
      .join(""),

    "data-footer-lockup": `${mark()}${wordmark({ inverse: true })}`,
  };

  return { slots, files: registry.files };
}

/** Fills each `data-*` placeholder element in the authored showcase page. */
export function injectShowcase(html, slots) {
  let result = html;

  for (const [attribute, markup] of Object.entries(slots)) {
    const placeholder = new RegExp(
      `(<([a-z]+)\\b[^>]*\\s${attribute}(?:\\s[^>]*)?>)</\\2>`,
    );
    if (!placeholder.test(result)) {
      throw new Error(`The showcase page has no empty ${attribute} element.`);
    }
    result = result.replace(placeholder, (_, open, tag) => `${open}${markup}</${tag}>`);
  }

  return result;
}
