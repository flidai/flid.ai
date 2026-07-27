import { fileURLToPath } from "node:url";

import opentype from "opentype.js";

const typeface = Object.freeze({
  family: "Geist",
  weight: 600,
  version: "1.7.2",
  source: "vercel/geist-font",
  license: "SIL Open Font License 1.1",
});

const fontPath = fileURLToPath(
  new URL("../vendor/geist/Geist-SemiBold.ttf", import.meta.url),
);
const font = opentype.loadSync(fontPath);

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export const geistWordmark = Object.freeze({
  ...typeface,
  text: "flid",
  fontSize: 76,
  markDiameter: 100,
  gapRatio: 0.2,
});

export function generateGeistWordmarkOutline({
  fill,
  x = 116,
  centerY = 50,
  fontSize = geistWordmark.fontSize,
} = {}) {
  if (!fill) throw new TypeError("A fill color is required.");

  const unpositionedPath = font.getPath(
    geistWordmark.text,
    0,
    0,
    fontSize,
    { kerning: true },
  );
  const unpositionedBounds = unpositionedPath.getBoundingBox();
  const baseline =
    centerY - (unpositionedBounds.y1 + unpositionedBounds.y2) / 2;
  const path = font.getPath(
    geistWordmark.text,
    x,
    baseline,
    fontSize,
    { kerning: true },
  );
  const bounds = path.getBoundingBox();

  return Object.freeze({
    pathData: path.toPathData(3),
    fill,
    bounds: Object.freeze({
      x1: round(bounds.x1),
      y1: round(bounds.y1),
      x2: round(bounds.x2),
      y2: round(bounds.y2),
    }),
    viewBoxWidth: Math.ceil(bounds.x2 + 1),
  });
}
