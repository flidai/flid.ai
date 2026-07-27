const GOLDEN_ANGLE = 137.507764;
const MARKS_PER_LAYER_SQUARED = 15 / 16;

export const DEFAULT_LOGO_OPTIONS = Object.freeze({
  layers: 16,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.42,
  accents: 3,
  foreground: "#f0f1e9",
  accent: "#44e3ff",
});

function clamp(value, minimum, maximum) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, numericValue));
}

function sanitizeColor(value, fallback) {
  return typeof value === "string" &&
    /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function format(value) {
  return Number(value.toFixed(3)).toString();
}

function normalizeAngle(value) {
  const angle = value % 360;
  return angle > 180 ? angle - 360 : angle;
}

export function getMarkCount(layers) {
  const normalizedLayers = Math.round(clamp(layers, 4, 20));
  return Math.round(
    normalizedLayers * normalizedLayers * MARKS_PER_LAYER_SQUARED,
  );
}

export function buildLogoModel(input = {}) {
  const options = {
    layers: Math.round(clamp(input.layers ?? DEFAULT_LOGO_OPTIONS.layers, 4, 20)),
    curl: clamp(input.curl ?? DEFAULT_LOGO_OPTIONS.curl, 0.55, 1.55),
    twist: clamp(input.twist ?? DEFAULT_LOGO_OPTIONS.twist, -35, 35),
    strokeWidth: clamp(
      input.strokeWidth ?? DEFAULT_LOGO_OPTIONS.strokeWidth,
      0.22,
      1.2,
    ),
    accents: Math.round(
      clamp(input.accents ?? DEFAULT_LOGO_OPTIONS.accents, 0, 8),
    ),
    foreground: sanitizeColor(
      input.foreground,
      DEFAULT_LOGO_OPTIONS.foreground,
    ),
    accent: sanitizeColor(input.accent, DEFAULT_LOGO_OPTIONS.accent),
  };
  const markCount = getMarkCount(options.layers);
  const accentIndices = new Set();
  const layerScale = Math.min(1.7, Math.sqrt(16 / options.layers));

  for (let index = 0; index < options.accents; index += 1) {
    const position = 0.58 + ((index + 1) / (options.accents + 1)) * 0.34;
    accentIndices.add(Math.min(markCount - 1, Math.round(position * markCount)));
  }

  const marks = Array.from({ length: markCount }, (_, index) => {
    const progress = markCount === 1 ? 0 : index / (markCount - 1);
    const angle = index * GOLDEN_ANGLE;
    const radians = (angle * Math.PI) / 180;
    const radius = 45.5 * Math.sqrt(progress);
    const width = (1.08 + 2.62 * progress) * layerScale;
    const height = width * options.curl;

    return {
      x: Number((50 + Math.cos(radians) * radius).toFixed(6)),
      y: Number((50 + Math.sin(radians) * radius).toFixed(6)),
      angle: Number(angle.toFixed(6)),
      rotation: Number(
        normalizeAngle(angle + 90 + options.twist * progress).toFixed(6),
      ),
      width: Number(width.toFixed(6)),
      height: Number(height.toFixed(6)),
      opacity: Number(
        Math.min(0.98, 0.3 + 0.68 * progress ** 0.72).toFixed(6),
      ),
      accent: accentIndices.has(index),
    };
  });

  return { options, marks };
}

export function generateLogoSvg(input = {}) {
  const { options, marks } = buildLogoModel(input);
  const paths = marks
    .map((mark) => {
      const baseline = mark.height * 0.42;
      const controlX = mark.width * 0.52;
      const path = [
        `M -${format(mark.width)} ${format(baseline)}`,
        `C -${format(controlX)} -${format(mark.height)}`,
        `${format(controlX)} -${format(mark.height)}`,
        `${format(mark.width)} ${format(baseline)}`,
      ].join(" ");
      const stroke = mark.accent ? options.accent : options.foreground;
      const strokeWidth = mark.accent
        ? options.strokeWidth * 1.28
        : options.strokeWidth;

      return [
        `<g transform="translate(${format(mark.x)} ${format(mark.y)}) rotate(${format(mark.rotation)})">`,
        `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${format(strokeWidth)}" stroke-linecap="round" opacity="${mark.accent ? 1 : format(mark.opacity)}" vector-effect="non-scaling-stroke"/>`,
        "</g>",
      ].join("");
    })
    .join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img">',
    "<title>Flid procedural signal mark</title>",
    `<desc>A ${options.layers}-layer radial field built from ${marks.length} curved signal marks.</desc>`,
    paths,
    "</svg>",
  ].join("");
}
