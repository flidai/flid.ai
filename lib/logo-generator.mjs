import { primerColors } from "./primer-colors.mjs";

const GOLDEN_ANGLE = 137.507764;
const MARKS_PER_LAYER_SQUARED = 15 / 16;
const SILHOUETTE_RADIUS = 45.5;
const SILHOUETTE_FIELD_SCALE = 0.82;
const DEFAULT_PRECISION = 3;
const CURVE_CONTROL_X = 0.52;
const CURVE_BASELINE = 0.42;
const OUTLINE_CACHE_LIMIT = 1024;

// "full" is the exported geometry. "draft" keeps the same silhouette with roughly
// 2.5x fewer vertices, for previews that rebuild on every slider step.
const QUALITY_PROFILES = Object.freeze({
  full: Object.freeze({ samples: 32, caps: 8 }),
  draft: Object.freeze({ samples: 12, caps: 3 }),
});

export const DEFAULT_LOGO_OPTIONS = Object.freeze({
  mode: "line",
  layers: 16,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.42,
  padding: 0,
  accents: 3,
  foreground: primerColors.dark.foreground,
  accent: primerColors.dark.accent,
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

// Same text as Number(value.toFixed(precision)).toString(), without the string round
// trip: away from a rounding tie the scaled integer is unambiguous.
function createFormatter(precision) {
  const scale = 10 ** precision;

  return (value) => {
    const scaled = value * scale;
    const fraction = scaled - Math.floor(scaled);

    if (Math.abs(fraction - 0.5) > 1e-6 && Math.abs(scaled) < 1e9) {
      return (Math.round(scaled) / scale).toString();
    }

    return Number(value.toFixed(precision)).toString();
  };
}

const format = createFormatter(DEFAULT_PRECISION);

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
    mode: input.mode === "silhouette" ? "silhouette" : "line",
    layers: Math.round(clamp(input.layers ?? DEFAULT_LOGO_OPTIONS.layers, 4, 20)),
    curl: clamp(input.curl ?? DEFAULT_LOGO_OPTIONS.curl, 0.55, 1.55),
    twist: clamp(input.twist ?? DEFAULT_LOGO_OPTIONS.twist, -35, 35),
    strokeWidth: clamp(
      input.strokeWidth ?? DEFAULT_LOGO_OPTIONS.strokeWidth,
      0.22,
      1.2,
    ),
    padding: clamp(input.padding ?? DEFAULT_LOGO_OPTIONS.padding, 0, 20),
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
      kind: index === 0 ? "dot" : "curve",
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

// Every mark is the same cubic scaled by its width and height, so the sampled
// points and tangents are computed once per sample count.
const unitCurves = new Map();

function getUnitCurve(samples) {
  const cached = unitCurves.get(samples);
  if (cached) return cached;

  const curve = {
    x: new Float64Array(samples + 1),
    y: new Float64Array(samples + 1),
    tx: new Float64Array(samples + 1),
    ty: new Float64Array(samples + 1),
  };

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const inverse = 1 - progress;
    const startWeight = inverse ** 3;
    const controlAWeight = 3 * inverse ** 2 * progress;
    const controlBWeight = 3 * inverse * progress ** 2;
    const endWeight = progress ** 3;

    curve.x[index] =
      -startWeight -
      CURVE_CONTROL_X * controlAWeight +
      CURVE_CONTROL_X * controlBWeight +
      endWeight;
    curve.y[index] =
      CURVE_BASELINE * startWeight -
      controlAWeight -
      controlBWeight +
      CURVE_BASELINE * endWeight;
    curve.tx[index] =
      3 * inverse ** 2 * (1 - CURVE_CONTROL_X) +
      6 * inverse * progress * (2 * CURVE_CONTROL_X) +
      3 * progress ** 2 * (1 - CURVE_CONTROL_X);
    curve.ty[index] =
      3 * inverse ** 2 * (-1 - CURVE_BASELINE) +
      3 * progress ** 2 * (CURVE_BASELINE + 1);
  }

  unitCurves.set(samples, curve);
  return curve;
}

// Output controls that never affect the model: number precision, path syntax,
// and outline sampling density. Defaults reproduce the canonical export bytes.
function resolveRendering(input) {
  const precision = Math.round(
    clamp(input.precision ?? DEFAULT_PRECISION, 1, 4),
  );
  const quality = input.quality === "draft" ? "draft" : "full";
  const compact = input.compact === true;

  return {
    precision,
    quality,
    compact,
    profile: QUALITY_PROFILES[quality],
    format: createFormatter(precision),
    cacheKey: `${quality}|${precision}|${compact}`,
  };
}

function createCurveOutlinePath(mark, strokeWidth, rendering) {
  const { samples, caps } = rendering.profile;
  const unit = getUnitCurve(samples);
  const radius = strokeWidth / 2;
  const left = [];
  const right = [];

  for (let index = 0; index <= samples; index += 1) {
    const x = mark.width * unit.x[index];
    const y = mark.height * unit.y[index];
    const tangentX = mark.width * unit.tx[index];
    const tangentY = mark.height * unit.ty[index];
    const length = Math.hypot(tangentX, tangentY);
    const offsetX = (-tangentY / length) * radius;
    const offsetY = (tangentX / length) * radius;

    left.push(x + offsetX, y + offsetY);
    right.push(x - offsetX, y - offsetY);
  }

  const outline = left.slice();
  const endX = mark.width * unit.x[samples];
  const endY = mark.height * unit.y[samples];
  const endAngle = Math.atan2(
    mark.height * unit.ty[samples],
    mark.width * unit.tx[samples],
  );

  for (let index = 1; index <= caps; index += 1) {
    const angle = endAngle + Math.PI / 2 - (Math.PI * index) / caps;
    outline.push(
      endX + Math.cos(angle) * radius,
      endY + Math.sin(angle) * radius,
    );
  }

  for (let index = samples - 1; index >= 0; index -= 1) {
    outline.push(right[index * 2], right[index * 2 + 1]);
  }

  const startX = mark.width * unit.x[0];
  const startY = mark.height * unit.y[0];
  const startAngle = Math.atan2(
    mark.height * unit.ty[0],
    mark.width * unit.tx[0],
  );

  for (let index = 1; index <= caps; index += 1) {
    const angle = startAngle - Math.PI / 2 - (Math.PI * index) / caps;
    outline.push(
      startX + Math.cos(angle) * radius,
      startY + Math.sin(angle) * radius,
    );
  }

  const { format: formatNumber, compact } = rendering;
  const moveTo = compact ? "M" : "M ";
  const lineTo = compact ? "L" : " L ";
  let path = `${moveTo}${formatNumber(outline[0])} ${formatNumber(outline[1])}`;
  for (let index = 2; index < outline.length; index += 2) {
    path += `${lineTo}${formatNumber(outline[index])} ${formatNumber(outline[index + 1])}`;
  }

  return compact ? `${path}Z` : `${path} Z`;
}

// Outlines depend only on size and weight, so a twist drag reuses every path.
const outlineCaches = new Map();

function getCurveOutlinePath(mark, strokeWidth, rendering) {
  let cache = outlineCaches.get(rendering.cacheKey);
  if (!cache) {
    cache = new Map();
    outlineCaches.set(rendering.cacheKey, cache);
  }

  const key = `${mark.width}|${mark.height}|${strokeWidth}`;
  let path = cache.get(key);
  if (path === undefined) {
    if (cache.size >= OUTLINE_CACHE_LIMIT) cache.clear();
    path = createCurveOutlinePath(mark, strokeWidth, rendering);
    cache.set(key, path);
  }

  return path;
}

function createTransformedPath(mark, path, attributes, rendering) {
  const x = rendering.format(mark.x);
  const y = rendering.format(mark.y);
  const rotation = rendering.format(mark.rotation);

  if (rendering.compact) {
    return `<path transform="translate(${x} ${y}) rotate(${rotation})" d="${path}" ${attributes}/>`;
  }

  return `<g transform="translate(${x} ${y}) rotate(${rotation})"><path data-curve-outline="true" d="${path}" ${attributes}/></g>`;
}

function createLineDrawing(options, marks, rendering) {
  return marks
    .map((mark) => {
      if (mark.kind === "dot") {
        const radius = Math.min(0.7, Math.max(0.38, options.strokeWidth * 0.9));

        return `<circle cx="${rendering.format(mark.x)}" cy="${rendering.format(mark.y)}" r="${rendering.format(radius)}" fill="${options.foreground}"/>`;
      }

      const stroke = mark.accent ? options.accent : options.foreground;
      const strokeWidth = mark.accent
        ? options.strokeWidth * 1.28
        : options.strokeWidth;
      const path = getCurveOutlinePath(mark, strokeWidth, rendering);

      return createTransformedPath(
        mark,
        path,
        `fill="${stroke}" opacity="${mark.accent ? 1 : rendering.format(mark.opacity)}"`,
        rendering,
      );
    })
    .join("");
}

// Short stable FNV-1a hash so ids track geometry without bloating the markup.
function hashGeometry(content) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createSilhouetteDrawing(options, marks, rendering) {
  const centerRadius = Math.min(
    0.82,
    Math.max(0.46, options.strokeWidth * 1.05),
  );
  const cutWidth = options.strokeWidth;
  const cuts = marks
    .slice(1)
    .map((mark) =>
      createTransformedPath(
        mark,
        getCurveOutlinePath(mark, cutWidth, rendering),
        'fill="#000"',
        rendering,
      ),
    )
    .join("");
  // Inline SVGs share one document id space: equal geometry shares an id (harmless
  // and deterministic) while tiles with different cuts can never reference each other's mask.
  const maskId = `flid-silhouette-${options.layers}-${marks.length}-${hashGeometry(`${centerRadius}|${cuts}`)}`;

  return {
    maskId,
    defs: [
      `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">`,
      '<rect width="100" height="100" fill="#000"/>',
      `<circle cx="50" cy="50" r="${format(SILHOUETTE_RADIUS)}" fill="#fff"/>`,
      `<circle cx="50" cy="50" r="${format(centerRadius)}" fill="#000"/>`,
      `<g transform="translate(50 50) scale(${format(SILHOUETTE_FIELD_SCALE)}) translate(-50 -50)">`,
      cuts,
      "</g>",
      "</mask></defs>",
    ].join(""),
    body: `<circle cx="50" cy="50" r="${format(SILHOUETTE_RADIUS)}" fill="${options.foreground}" mask="url(#${maskId})"/>`,
  };
}

/**
 * Builds the pieces of a mark so callers can place them in their own document.
 *
 * Besides the model options, `input` accepts rendering controls that never change
 * the design: `precision` (decimals per coordinate, default 3), `compact` (terse
 * path syntax and no wrapper groups), and `quality` ("full" or "draft" sampling).
 * The defaults reproduce the canonical export byte for byte. `generateLogoSvg` also
 * accepts `size` (pixels) to stamp width and height on a standalone file.
 */
export function buildLogoDrawing(input = {}) {
  const { options, marks } = buildLogoModel(input);
  const rendering = resolveRendering(input);
  const viewBoxOrigin = -options.padding;
  const viewBoxSize = 100 + options.padding * 2;
  const silhouette =
    options.mode === "silhouette"
      ? createSilhouetteDrawing(options, marks, rendering)
      : null;

  return {
    options,
    markCount: marks.length,
    viewBox: `${format(viewBoxOrigin)} ${format(viewBoxOrigin)} ${format(viewBoxSize)} ${format(viewBoxSize)}`,
    description: silhouette
      ? `A circular ${options.layers}-layer signal silhouette with a center aperture.`
      : `A ${options.layers}-layer radial field with one center dot and ${marks.length - 1} curved signal marks.`,
    maskId: silhouette?.maskId ?? null,
    defs: silhouette?.defs ?? "",
    body: silhouette?.body ?? createLineDrawing(options, marks, rendering),
  };
}

export function generateLogoSvg(input = {}) {
  const drawing = buildLogoDrawing(input);
  // Without `size` the SVG scales to whatever box holds it, which suits inline use.
  // Standalone files want a natural size so viewers do not open them at 0 or full-window.
  const size = Number(input.size);
  const dimensions =
    Number.isFinite(size) && size > 0
      ? ` width="${Math.round(clamp(size, 16, 4096))}" height="${Math.round(clamp(size, 16, 4096))}"`
      : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"${dimensions} viewBox="${drawing.viewBox}" role="img" data-rendering="filled-outlines" data-stroke-width="${format(drawing.options.strokeWidth)}">`,
    "<title>Flid procedural signal mark</title>",
    `<desc>${drawing.description}</desc>`,
    drawing.defs,
    drawing.body,
    "</svg>",
  ].join("");
}
