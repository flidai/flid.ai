import { buildLogoModel } from "./logo-generator.mjs";
import { primerColors } from "./primer-colors.mjs";

/**
 * Small-size rendering of the Flid signal mark for favicons and touch icons.
 *
 * The approved mark outlines 134 hairline curves (~180 KB), which turns into a
 * pale wash at 16-32 px and cannot be shipped as a favicon. This helper reuses
 * the approved geometry model (same golden-angle placement and curl) with fewer
 * layers and bold round-capped strokes emitted as plain stroked Béziers, so the
 * icon stays legible and a few kilobytes. It never replaces the official logo
 * files that are offered as downloads in brand-assets/.
 */
export const siteIconPresets = Object.freeze({
  // Browser tabs: the fewest rings that still read as the mark, on a rounded
  // plate so it stays visible on both light and dark tab strips.
  favicon: Object.freeze({ layers: 5, strokeWidth: 4.4, padding: 8, plate: true, radius: 22 }),
  // Home-screen and install icons: solid plate, the same mark with safe padding.
  touch: Object.freeze({ layers: 6, strokeWidth: 3.8, padding: 12, plate: true }),
});

const round = (value) => Number(value.toFixed(1));

function curvePath(mark) {
  const baseline = mark.height * 0.42;
  const controlX = mark.width * 0.52;
  const local = [
    [-mark.width, baseline],
    [-controlX, -mark.height],
    [controlX, -mark.height],
    [mark.width, baseline],
  ];
  const radians = (mark.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [start, ...controls] = local.map(([x, y]) => [
    round(mark.x + x * cos - y * sin),
    round(mark.y + x * sin + y * cos),
  ]);

  return `M${start.join(" ")}C${controls.map((point) => point.join(" ")).join(" ")}`;
}

export function generateSiteIconSvg({
  preset = "favicon",
  foreground = primerColors.dark.foreground,
  background = primerColors.dark.canvas,
} = {}) {
  const options = siteIconPresets[preset];
  if (!options) throw new TypeError(`Unknown site icon preset: ${preset}`);

  const { marks } = buildLogoModel({
    layers: options.layers,
    strokeWidth: 0.58,
    accents: 0,
    foreground,
  });
  const inset = options.padding;
  const scale = (100 - inset * 2) / 100;
  const curves = marks
    .filter((mark) => mark.kind === "curve")
    .map((mark) => `<path d="${curvePath(mark)}"/>`)
    .join("");
  const dot = marks.find((mark) => mark.kind === "dot");
  const plate = options.plate
    ? `<rect width="100" height="100"${options.radius ? ` rx="${options.radius}"` : ""} fill="${background}"/>`
    : "";

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    plate,
    `<g transform="translate(${inset} ${inset}) scale(${round(scale)})" fill="none" stroke="${foreground}" stroke-width="${options.strokeWidth}" stroke-linecap="round">`,
    curves,
    "</g>",
    `<circle cx="${round(dot.x * scale + inset)}" cy="${round(dot.y * scale + inset)}" r="3.4" fill="${foreground}"/>`,
    "</svg>",
  ].join("");
}
