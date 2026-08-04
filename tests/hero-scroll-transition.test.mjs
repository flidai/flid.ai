import assert from "node:assert/strict";
import test from "node:test";

import {
  createHeroParticle,
  createHeroTransitionState,
  heroTransitionSettings,
} from "../lib/hero-scroll-transition.mjs";

test("matches the measured one-viewport hero transition", () => {
  assert.equal(heroTransitionSettings.scrollViewports, 1);

  const opening = createHeroTransitionState(0);
  const middle = createHeroTransitionState(0.5);
  const closing = createHeroTransitionState(1);

  assert.deepEqual(opening, {
    progress: 0,
    copyOpacity: 1,
    copyScale: 1,
    copyTranslateY: 0,
    waveOpacity: 1,
    waveWarp: 0,
    particleProgress: 0,
    stageOpacity: 1,
  });
  assert.equal(middle.copyScale, 0.96);
  assert.equal(middle.copyTranslateY, 10);
  assert.ok(middle.copyOpacity > 0.45 && middle.copyOpacity < 0.55);
  assert.ok(middle.waveOpacity < 0.5);
  assert.ok(middle.particleProgress > 0 && middle.particleProgress < 1);
  assert.deepEqual(closing, {
    progress: 1,
    copyOpacity: 0,
    copyScale: 0.92,
    copyTranslateY: 20,
    waveOpacity: 0,
    waveWarp: 1,
    particleProgress: 1,
    stageOpacity: 0,
  });
});

test("clamps invalid progress without introducing discontinuities", () => {
  assert.deepEqual(
    createHeroTransitionState(-1),
    createHeroTransitionState(0),
  );
  assert.deepEqual(
    createHeroTransitionState(Number.NaN),
    createHeroTransitionState(0),
  );
  assert.deepEqual(
    createHeroTransitionState(2),
    createHeroTransitionState(1),
  );
});

test("maps each story particle from a deterministic contour field", () => {
  const target = { x: 72, y: 34, opacity: 0.62, size: 0.8 };
  const opening = createHeroParticle(24, target, 0);
  const repeated = createHeroParticle(24, target, 0);
  const closing = createHeroParticle(24, target, 1);

  assert.deepEqual(opening, repeated);
  assert.notEqual(opening.x, target.x);
  assert.notEqual(opening.y, target.y);
  assert.equal(opening.opacity, 0);
  assert.deepEqual(closing, target);
});
