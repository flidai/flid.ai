import assert from "node:assert/strict";
import test from "node:test";

import {
  createSignalFieldFrame,
  signalFieldSettings,
} from "../lib/hero-signal-field.mjs";
import { buildLogoModel } from "../lib/logo-generator.mjs";

const primary = {
  mode: "line",
  layers: 12,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.58,
  padding: 0,
  accents: 0,
};

test("builds every animation frame from the canonical 12-layer model", () => {
  const canonical = buildLogoModel(primary).marks;
  const frame = createSignalFieldFrame({ timeSeconds: 8 });

  assert.equal(frame.length, 135);
  assert.deepEqual(
    frame.map(({ kind, width, height }) => ({ kind, width, height })),
    canonical.map(({ kind, width, height }) => ({ kind, width, height })),
  );
  assert.equal(signalFieldSettings.layers, 12);
});

test("uses the exact approved mark for reduced-motion rendering", () => {
  const canonical = buildLogoModel(primary).marks;
  const frame = createSignalFieldFrame({
    timeSeconds: 18,
    pointer: { x: 1, y: -1 },
    reducedMotion: true,
  });

  assert.deepEqual(
    frame.map(({ x, y, rotation, opacity, accent }) => ({
      x,
      y,
      rotation,
      opacity,
      accent,
    })),
    canonical.map(({ x, y, rotation, opacity }) => ({
      x,
      y,
      rotation,
      opacity,
      accent: false,
    })),
  );
});

test("converges from a flowing field without losing the logo", () => {
  const canonical = buildLogoModel(primary).marks;
  const opening = createSignalFieldFrame({ timeSeconds: 0 });
  const settled = createSignalFieldFrame({ timeSeconds: 4 });

  const openingDisplacement = opening.reduce(
    (total, mark, index) =>
      total + Math.hypot(mark.x - canonical[index].x, mark.y - canonical[index].y),
    0,
  );
  const settledDisplacement = settled.reduce(
    (total, mark, index) =>
      total + Math.hypot(mark.x - canonical[index].x, mark.y - canonical[index].y),
    0,
  );

  assert.ok(openingDisplacement > 4_000);
  assert.ok(settledDisplacement < openingDisplacement * 0.08);
  assert.ok(
    settled.every(
      (mark, index) =>
        Math.hypot(mark.x - canonical[index].x, mark.y - canonical[index].y) < 3,
    ),
  );
});

test("keeps pointer response bounded and uses accent only for the travelling pulse", () => {
  const canonical = buildLogoModel(primary).marks;
  const frame = createSignalFieldFrame({
    timeSeconds: 8,
    pointer: { x: 10, y: -10 },
  });
  const accentCount = frame.filter(({ accent }) => accent).length;

  assert.ok(accentCount > 0);
  assert.ok(accentCount < 24);
  assert.ok(
    frame.every(
      (mark, index) =>
        Math.hypot(mark.x - canonical[index].x, mark.y - canonical[index].y) < 4,
    ),
  );
});

test("is deterministic for identical inputs", () => {
  const input = {
    timeSeconds: 11.25,
    pointer: { x: 0.4, y: -0.2 },
  };

  assert.deepEqual(
    createSignalFieldFrame(input),
    createSignalFieldFrame(input),
  );
});
