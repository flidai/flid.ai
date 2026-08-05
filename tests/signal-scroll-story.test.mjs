import assert from "node:assert/strict";
import test from "node:test";

import {
  createSignalStoryFrame,
  createSignalStoryState,
  signalStoryScenes,
  signalStorySettings,
  storySubtitleRevealProgress,
  visitSignalStoryFrame,
} from "../lib/signal-scroll-story.mjs";

test("defines the four Flid thesis scenes in narrative order", () => {
  assert.deepEqual(
    signalStoryScenes.map(({ id }) => id),
    ["unstructured", "context", "capabilities", "foundation"],
  );
});

test("maps scroll progress to normalized adjacent scene weights", () => {
  const opening = createSignalStoryState(-2);
  const middle = createSignalStoryState(0.5);
  const closing = createSignalStoryState(4);

  assert.equal(opening.progress, 0);
  assert.equal(opening.activeScene, 0);
  assert.deepEqual(opening.weights, [1, 0, 0, 0]);
  assert.equal(closing.progress, 1);
  assert.equal(closing.activeScene, 3);
  assert.deepEqual(closing.weights, [0, 0, 0, 1]);
  assert.ok(Math.abs(middle.weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-9);
  assert.equal(middle.weights.filter((weight) => weight > 0).length, 2);
});

test("reveals each subtitle once as its scene enters", () => {
  assert.equal(storySubtitleRevealProgress(0, 0), 0);
  assert.ok(storySubtitleRevealProgress(0.2, 0) > 0);
  assert.equal(storySubtitleRevealProgress(0.5, 0), 1);

  assert.equal(storySubtitleRevealProgress(0.49, 1), 0);
  assert.ok(storySubtitleRevealProgress(0.7, 1) > 0);
  assert.equal(storySubtitleRevealProgress(1, 1), 1);
  assert.equal(storySubtitleRevealProgress(1.45, 1), 1);

  assert.equal(storySubtitleRevealProgress(2.49, 3), 0);
  assert.equal(storySubtitleRevealProgress(3, 3), 1);
});

test("uses a dense dot field throughout every frame", () => {
  for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
    const frame = createSignalStoryFrame(progress);

    assert.equal(frame.length, signalStorySettings.particleCount);
    assert.ok(frame.every(({ size }) => size > 0 && size <= 1.6));
    assert.ok(frame.every((particle) => !("kind" in particle)));
    assert.ok(frame.every((particle) => !("rotation" in particle)));
  }
});

test("resolves to a coherent foundation sphere instead of the logo", () => {
  const frame = createSignalStoryFrame(1);

  assert.ok(
    frame.every(({ x, y }) =>
      ((x - 45) / 35) ** 2 + ((y - 50) / 38) ** 2 <= 1.00001,
    ),
  );
  assert.ok(frame.some(({ opacity }) => opacity > 0.8));
  assert.equal(frame.filter(({ accent }) => accent).length, 0);
});

test("keeps the scroll field bounded and deterministic", () => {
  for (const progress of [0, 0.17, 0.33, 0.51, 0.72, 1]) {
    const first = createSignalStoryFrame(progress);
    const second = createSignalStoryFrame(progress);

    assert.deepEqual(first, second);
    assert.ok(first.every(({ x }) => x >= -14 && x <= 174));
    assert.ok(first.every(({ y }) => y >= 2 && y <= 98));
    assert.equal(first.filter(({ accent }) => accent).length, 0);
  }
});

test("streams the same deterministic particles without allocating a frame", () => {
  const streamed = [];
  visitSignalStoryFrame(0.62, (x, y, opacity, size, accent) => {
    streamed.push({ x, y, opacity, size, accent });
  });

  assert.deepEqual(streamed, createSignalStoryFrame(0.62));
});
