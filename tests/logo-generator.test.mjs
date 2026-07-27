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
  assert.match(svg, /<path d="M [^"]+ C [^"]+"/);
  assert.match(svg, /stroke="#44e3ff"/);
  assert.equal((svg.match(/<g transform=/g) ?? []).length, getMarkCount(9));
  assert.doesNotMatch(svg, /\bQ\b/);
  assert.doesNotMatch(svg, /undefined|NaN/);
});

test("clamps unsafe or out-of-range inputs", () => {
  const model = buildLogoModel({
    layers: 200,
    curl: -4,
    twist: 500,
    strokeWidth: 20,
    accents: 99,
  });

  assert.equal(model.options.layers, 20);
  assert.equal(model.options.curl, 0.55);
  assert.equal(model.options.twist, 35);
  assert.equal(model.options.strokeWidth, 1.2);
  assert.equal(model.options.accents, 8);
});
