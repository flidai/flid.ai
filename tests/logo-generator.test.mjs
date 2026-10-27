import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildLogoDrawing,
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

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const pathData = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].map(([, d]) => d);
const numbers = (text) => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

test("keeps the canonical export bytes stable", () => {
  // Hashes of the exports before the preview rendering options existed. Changing the
  // default output changes every downloadable brand asset, so it must be deliberate.
  assert.equal(
    sha256(
      generateLogoSvg({
        mode: "line",
        layers: 12,
        curl: 0.88,
        twist: 0,
        strokeWidth: 0.58,
        padding: 10,
        accents: 0,
        foreground: "#f0f6fc",
      }),
    ),
    "e09c300c993624c659eca97aae60dae54c4ed8258736a5b9243505b4874b7d07",
  );
  assert.equal(
    sha256(generateLogoSvg({ layers: 16, twist: 7.5 })),
    "e2fe9512cfbdfaeefebf832e285f13fad60e7ffa4c6f9973ba858ada06f77e38",
  );
  assert.equal(
    sha256(
      generateLogoSvg({
        mode: "silhouette",
        layers: 8,
        strokeWidth: 0.9,
        padding: 8,
        foreground: "#1f2328",
      }),
    ),
    "a0926df6a6b11669e05b724a5a2eeee9aebb23d3f6f173bd5a36f7b337db8816",
  );
});

test("limits coordinate precision for previews without moving the geometry", () => {
  const exact = generateLogoSvg({ layers: 12, accents: 0 });
  const preview = generateLogoSvg({ layers: 12, accents: 0, precision: 2 });

  assert.ok(preview.length < exact.length * 0.9, "two decimals shrink the markup");
  assert.doesNotMatch(
    pathData(preview).join(" "),
    /\d\.\d{3,}/,
    "no path coordinate keeps a third decimal",
  );

  const [exactPath] = pathData(exact);
  const [previewPath] = pathData(preview);
  const before = numbers(exactPath);
  const after = numbers(previewPath);
  assert.equal(after.length, before.length);
  for (let index = 0; index < before.length; index += 1) {
    assert.ok(Math.abs(before[index] - after[index]) <= 0.0051, `coordinate ${index}`);
  }
});

test("compact output drops wrapper groups and path padding", () => {
  const exact = generateLogoSvg({ layers: 9 });
  const compact = generateLogoSvg({ layers: 9, compact: true });
  const [path] = pathData(compact);

  assert.equal((compact.match(/<g /g) ?? []).length, 0);
  assert.equal((compact.match(/<path /g) ?? []).length, getMarkCount(9) - 1);
  assert.match(path, /^M-?[\d.]+ -?[\d.]+L/);
  assert.match(path, /Z$/);
  assert.doesNotMatch(compact, /(?:\s|<)stroke=|(?:\s|<)stroke-width=|vector-effect=/);
  assert.ok(compact.length < exact.length);
  // Same outlines, so the same ink: only the syntax around the numbers differs.
  assert.deepEqual(numbers(pathData(compact)[0]), numbers(pathData(exact)[0]));
});

test("draft quality keeps every mark with far fewer outline vertices", () => {
  const full = generateLogoSvg({ layers: 12, compact: true, precision: 2 });
  const draft = generateLogoSvg({
    layers: 12,
    compact: true,
    precision: 2,
    quality: "draft",
  });
  const vertices = (svg) => numbers(pathData(svg)[0]).length / 2;

  assert.equal((draft.match(/<path /g) ?? []).length, (full.match(/<path /g) ?? []).length);
  assert.ok(vertices(draft) < vertices(full) * 0.5);
  assert.ok(draft.length < full.length * 0.6);
  assert.doesNotMatch(draft, /undefined|NaN/);
});

test("reuses outlines across twists and rebuilds them when weight changes", () => {
  const paths = (options) => pathData(generateLogoSvg({ layers: 10, ...options }));
  const straight = paths({ twist: 0 });
  const twisted = paths({ twist: 25 });

  // Twist only rotates marks, so each outline is identical (and may come from the cache).
  assert.deepEqual(twisted, straight);
  assert.notDeepEqual(paths({ strokeWidth: 0.9 }), straight);
  assert.notDeepEqual(paths({ curl: 1.3 }), straight);
  // Cached output must match a fresh computation of the same options.
  assert.deepEqual(paths({ twist: 25 }), twisted);
});

test("exposes the drawing pieces for pages that place marks themselves", () => {
  const silhouette = buildLogoDrawing({
    mode: "silhouette",
    layers: 8,
    padding: 8,
    compact: true,
    precision: 2,
  });
  const line = buildLogoDrawing({ layers: 8 });

  assert.equal(silhouette.viewBox, "-8 -8 116 116");
  assert.match(silhouette.maskId, /^flid-silhouette-8-60-[0-9a-f]{8}$/);
  assert.match(silhouette.defs, new RegExp(`<mask id="${silhouette.maskId}"`));
  assert.ok(silhouette.body.includes(`mask="url(#${silhouette.maskId})"`));
  assert.equal(line.defs, "");
  assert.equal(line.maskId, null);
  assert.equal(line.markCount, 60);
  assert.equal(
    generateLogoSvg({ layers: 8 }),
    [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${line.viewBox}" role="img" data-rendering="filled-outlines" data-stroke-width="0.42">`,
      "<title>Flid procedural signal mark</title>",
      `<desc>${line.description}</desc>`,
      line.body,
      "</svg>",
    ].join(""),
  );
});

test("stamps a natural size on standalone files only when asked", () => {
  const inline = generateLogoSvg({ layers: 8 });
  const file = generateLogoSvg({ layers: 8, size: 512.4 });

  assert.doesNotMatch(inline, /<svg[^>]* width=/);
  assert.match(file, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="512" height="512" viewBox=/);
  assert.match(file, /<title>Flid procedural signal mark<\/title>/);
  assert.match(generateLogoSvg({ size: 1 }), /width="16" height="16"/);
  assert.match(generateLogoSvg({ size: 99999 }), /width="4096"/);
  assert.doesNotMatch(generateLogoSvg({ size: "wide" }), /<svg[^>]* width=/);
});
