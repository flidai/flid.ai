import assert from "node:assert/strict";
import test from "node:test";

import {
  createHeroParticle,
  createHeroTransitionState,
  createMotionSequenceState,
  heroTransitionSettings,
  shouldHeroOccludeStory,
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

test("keeps the hero renderer until the story canvas reaches the viewport top", () => {
  assert.equal(shouldHeroOccludeStory(115, false), true);
  assert.equal(shouldHeroOccludeStory(0, false), false);
  assert.equal(shouldHeroOccludeStory(-1, false), false);
  assert.equal(shouldHeroOccludeStory(115, true), false);
});

test("maps the hero morph and story video onto one continuous scroll state", () => {
  assert.deepEqual(createMotionSequenceState(0, 720, 6_480), {
    introProgress: 0,
    storyProgress: 0,
    storyActive: false,
  });
  assert.deepEqual(createMotionSequenceState(720, 720, 6_480), {
    introProgress: 1,
    storyProgress: 0,
    storyActive: true,
  });
  assert.deepEqual(createMotionSequenceState(3_960, 720, 6_480), {
    introProgress: 1,
    storyProgress: 0.5,
    storyActive: true,
  });
  assert.deepEqual(createMotionSequenceState(7_200, 720, 6_480), {
    introProgress: 1,
    storyProgress: 1,
    storyActive: true,
  });
});

test("keeps the video playhead continuous at the intro boundary", () => {
  const before = createMotionSequenceState(719.999, 720, 6_480);
  const boundary = createMotionSequenceState(720, 720, 6_480);
  const after = createMotionSequenceState(720.01, 720, 6_480);

  assert.equal(before.storyProgress, 0);
  assert.equal(boundary.storyProgress, 0);
  assert.ok(after.storyProgress > 0);
  assert.ok(after.storyProgress < 0.00001);
  assert.ok(before.introProgress < boundary.introProgress);
  assert.equal(boundary.introProgress, after.introProgress);
});
