import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLogoModel,
  generateLogoSvg,
  getMarkCount,
} from "../lib/logo-generator.mjs";

test("maps visual layers to a predictable mark count", () => {
  assert.equal(getMarkCount(16), 240);
  assert.equal(getMarkCount(12), 135);
  assert.equal(getMarkCount(8), 60);
  assert.equal(getMarkCount(6), 34);
});

test("builds a deterministic phyllotaxis model", () => {
  const first = buildLogoModel({ layers: 16 });
  const second = buildLogoModel({ layers: 16 });

  assert.deepEqual(first, second);
  assert.equal(first.marks.length, 240);
  assert.deepEqual(
    { x: first.marks[0].x, y: first.marks[0].y },
    { x: 50, y: 50 },
  );
  assert.equal(first.marks[0].kind, "dot");
  assert.ok(first.marks.slice(1).every((mark) => mark.kind === "curve"));
  assert.ok(Math.abs(first.marks[1].angle - 137.507764) < 0.000001);
  assert.equal(first.marks.filter((mark) => mark.accent).length, 3);
});

test("creates an independent, portable SVG with cubic signal marks", () => {
  const svg = generateLogoSvg({
    layers: 9,
    foreground: "#f0f1e9",
    accent: "#44e3ff",
  });

  assert.match(svg, /^<svg[^>]+viewBox="0 0 100 100"/);
  assert.match(svg, /<title>Flid procedural signal mark<\/title>/);
  assert.match(
    svg,
    /<circle cx="50" cy="50" r="[^"]+" fill="#f0f1e9"\/>/,
  );
  assert.match(svg, /data-rendering="filled-outlines"/);
  assert.match(svg, /data-stroke-width="0\.42"/);
  assert.match(svg, /<path data-curve-outline="true" d="M [^"]+ Z" fill="#44e3ff"/);
  assert.doesNotMatch(svg, /(?:\s|<)stroke=|(?:\s|<)stroke-width=|vector-effect=/);
  assert.equal(
    (svg.match(/<g transform=/g) ?? []).length,
    getMarkCount(9) - 1,
  );
  assert.doesNotMatch(svg, /\bQ\b/);
  assert.doesNotMatch(svg, /undefined|NaN/);
});

test("creates a monochrome signal pattern cut from a circular silhouette", () => {
  const svg = generateLogoSvg({
    mode: "silhouette",
    layers: 8,
    foreground: "#f0f1e9",
    accent: "#44e3ff",
  });

  const maskId = svg.match(/<mask id="(flid-silhouette-8-60-[0-9a-f]{8})"/)?.[1];

  assert.ok(maskId, "mask id carries a geometry hash");
  assert.match(svg, /<circle cx="50" cy="50" r="45\.5" fill="#fff"\/>/);
  assert.match(svg, /<circle cx="50" cy="50" r="[^"]+" fill="#000"\/>/);
  assert.ok(
    svg.includes(`<circle cx="50" cy="50" r="45.5" fill="#f0f1e9" mask="url(#${maskId})"/>`),
  );
  assert.match(svg, /<path data-curve-outline="true"[^>]+fill="#000"/);
  assert.doesNotMatch(svg, /(?:\s|<)stroke=|(?:\s|<)stroke-width=|vector-effect=/);
  assert.doesNotMatch(svg, /#44e3ff/);
});

test("gives silhouettes with different geometry different mask ids", () => {
  const maskId = (options) =>
    generateLogoSvg({ mode: "silhouette", layers: 8, ...options }).match(
      /<mask id="([^"]+)"/,
    )[1];

  // Same layer and mark counts, different cut geometry: ids must not collide in one document.
  assert.notEqual(maskId({ strokeWidth: 0.7 }), maskId({ strokeWidth: 1.05 }));
  assert.notEqual(maskId({ curl: 0.88 }), maskId({ curl: 1.2 }));
  assert.notEqual(maskId({ twist: 0 }), maskId({ twist: 12 }));
  // Identical geometry stays deterministic, and padding/colour never affect the mask.
  assert.equal(
    maskId({ strokeWidth: 0.7 }),
    maskId({ strokeWidth: 0.7, padding: 12, foreground: "#123456" }),
  );
});

test("scales the complete silhouette pattern inward without clipping marks", () => {
  const svg = generateLogoSvg({
    mode: "silhouette",
    layers: 12,
    strokeWidth: 0.58,
  });

  assert.doesNotMatch(svg, /<clipPath|clip-path=/);
  assert.match(
    svg,
    /<g transform="translate\(50 50\) scale\(0\.82\) translate\(-50 -50\)">.+<\/g><\/mask>/,
  );
});

test("reuses the primary field weight when expanding silhouette cuts", () => {
  const reducedField = generateLogoSvg({
    mode: "line",
    layers: 12,
    strokeWidth: 0.58,
  });
  const silhouette = generateLogoSvg({
    mode: "silhouette",
    layers: 12,
    strokeWidth: 0.58,
  });

  assert.match(reducedField, /data-stroke-width="0\.58"/);
  assert.match(silhouette, /data-stroke-width="0\.58"/);
  assert.doesNotMatch(reducedField, /(?:\s|<)stroke=|(?:\s|<)stroke-width=|vector-effect=/);
  assert.doesNotMatch(silhouette, /(?:\s|<)stroke=|(?:\s|<)stroke-width=|vector-effect=/);
});

test("adds clear space through the viewBox without changing silhouette geometry", () => {
  const svg = generateLogoSvg({
    mode: "silhouette",
    layers: 12,
    strokeWidth: 0.58,
    padding: 8,
  });

  assert.match(svg, /viewBox="-8 -8 116 116"/);
  assert.match(svg, /<circle cx="50" cy="50" r="45\.5" fill="#fff"\/>/);
  assert.match(svg, /data-stroke-width="0\.58"/);
  assert.doesNotMatch(svg, /(?:\s|<)stroke=|(?:\s|<)stroke-width=|vector-effect=/);
});

test("clamps unsafe or out-of-range inputs", () => {
  const model = buildLogoModel({
    mode: "unknown",
    layers: 200,
    curl: -4,
    twist: 500,
    strokeWidth: 20,
    padding: 200,
    accents: 99,
  });

  assert.equal(model.options.mode, "line");
  assert.equal(model.options.layers, 20);
  assert.equal(model.options.curl, 0.55);
  assert.equal(model.options.twist, 35);
  assert.equal(model.options.strokeWidth, 1.2);
  assert.equal(model.options.padding, 20);
  assert.equal(model.options.accents, 8);
});
