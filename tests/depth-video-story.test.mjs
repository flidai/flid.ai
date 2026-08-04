import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDepthPlayhead,
  createDepthParticleGrid,
  createDepthStoryState,
  depthParticleTarget,
  DepthVideoStory,
  depthFragmentShader,
  shouldSeekDepthVideo,
  depthVideoStorySettings,
  depthVertexShader,
} from "../lib/depth-video-story.mjs";

test("defines one continuous local depth story without external runtime URLs", () => {
  assert.deepEqual(depthVideoStorySettings.sources, [
    "/assets/depth-reference/depth-story.mp4",
  ]);
  assert.doesNotMatch(
    JSON.stringify(depthVideoStorySettings.sources),
    /https?:|datacurve/i,
  );
  assert.equal(depthVideoStorySettings.densityScale, 1.55);
  assert.equal(depthVideoStorySettings.maximumPixelRatio, 1.35);
  assert.equal(depthVideoStorySettings.playheadResponseMs, 170);
});

test("matches the measured adaptive point-density ratios", () => {
  assert.equal(depthParticleTarget(1440, 8, 1), 155_000);
  assert.equal(depthParticleTarget(1440, 8, 2), 124_000);
  assert.equal(depthParticleTarget(900, 8, 1), 111_600);
  assert.equal(depthParticleTarget(900, 8, 2), 89_280);
  assert.equal(depthParticleTarget(600, 8, 1), 40_300);
  assert.equal(depthParticleTarget(1440, 2, 1), 40_300);
});

test("maps the entire scroll range monotonically across one source", () => {
  const progressSamples = Array.from({ length: 101 }, (_, index) => index / 100);
  const states = progressSamples.map((progress) =>
    createDepthStoryState(progress),
  );
  const opening = states[0];
  const middle = states[50];
  const closing = states[100];

  assert.deepEqual(
    {
      sourceA: opening.sourceA,
      sourceB: opening.sourceB,
      morph: opening.morph,
      copyIndex: opening.copyIndex,
    },
    { sourceA: 0, sourceB: 0, morph: 0, copyIndex: 0 },
  );
  assert.equal(middle.sourceA, 0);
  assert.equal(middle.sourceB, 0);
  assert.equal(middle.sampleA, 0.5);
  assert.equal(middle.sampleB, 0.5);
  assert.equal(middle.morph, 0);
  assert.equal(closing.sourceA, 0);
  assert.equal(closing.sourceB, 0);
  assert.equal(closing.copyIndex, 0);
  assert.equal(closing.sampleA, 1);
  assert.ok(
    states.every(
      (state, index) => index === 0 || state.sampleA >= states[index - 1].sampleA,
    ),
  );
  assert.deepEqual(middle, createDepthStoryState(0.5));
});

test("builds a stable UV particle grid close to the requested density", () => {
  const first = createDepthParticleGrid(10_000, 16 / 9);
  const second = createDepthParticleGrid(10_000, 16 / 9);

  assert.ok(first.count >= 9_500 && first.count <= 10_500);
  assert.equal(first.vertices.length, first.count * 5);
  assert.deepEqual(first, second);

  for (let index = 0; index < first.vertices.length; index += 5) {
    assert.ok(first.vertices[index + 2] >= 0 && first.vertices[index + 2] <= 1);
    assert.ok(first.vertices[index + 3] >= 0 && first.vertices[index + 3] <= 1);
    assert.ok(first.vertices[index + 4] >= 0 && first.vertices[index + 4] <= 1);
  }
});

test("breaks the visible lattice with deterministic sub-cell scatter", () => {
  const grid = createDepthParticleGrid(10_000, 16 / 9);
  let normalizedDisplacement = 0;

  for (let index = 0; index < grid.vertices.length; index += 5) {
    const positionX = grid.vertices[index];
    const positionY = grid.vertices[index + 1];
    const u = grid.vertices[index + 2];
    const v = grid.vertices[index + 3];
    const xOffsetInCells = Math.abs(positionX - (u - 0.5)) * (grid.columns - 1);
    const yOffsetInCells = Math.abs(positionY - (0.5 - v)) * (grid.rows - 1);
    normalizedDisplacement += (xOffsetInCells + yOffsetInCells) / 2;
  }

  const meanDisplacement = normalizedDisplacement / grid.count;
  assert.ok(meanDisplacement > 0.34 && meanDisplacement < 0.46);
  assert.match(depthVertexShader, /particleOccupancy/);
});

test("uses video depth, edge recovery, and point perspective without transition noise", () => {
  assert.match(depthVertexShader, /uniform sampler2D uDepthA/);
  assert.match(depthVertexShader, /uniform sampler2D uDepthB/);
  assert.match(depthVertexShader, /sobelEdge/);
  assert.doesNotMatch(depthVertexShader, /uAvoidRect|rectangleInfluence/);
  assert.doesNotMatch(
    depthVertexShader,
    /transitionDust|strand|turbulence|float transition\s*=/,
  );
  assert.match(depthVertexShader, /gl_PointSize/);
  assert.match(depthVertexShader, /uPointer/);
  assert.match(depthVertexShader, /mix\(0\.34, 1\.0, presence\)/);
  assert.match(depthVertexShader, /smoothstep\(0\.035, 0\.92, value\)/);
  assert.match(depthVertexShader, /mix\(0\.46, 1\.35/);
  assert.match(depthVertexShader, /float perspective = 1\.98 \/ viewDepth;/);
  assert.doesNotMatch(depthVertexShader, /cameraZ \/ viewDepth/);
  assert.match(depthFragmentShader, /gl_PointCoord/);
  assert.match(depthFragmentShader, /alpha < 0\.007/);
});

test("skips duplicate texture work and the second depth sample during holds", () => {
  assert.match(depthVertexShader, /if \(rawMorph > 0\.001\)/);

  const uploadSource = DepthVideoStory.prototype.uploadRecord.toString();
  assert.match(uploadSource, /needsTextureUpdate/);
  assert.match(uploadSource, /seekInFlight/);
  assert.doesNotMatch(uploadSource, /frameChanged/);
});

test("smooths the rendered playhead independently of display refresh rate", () => {
  const simulate = (framesPerSecond) => {
    let playhead = 0;
    const frameDuration = 1_000 / framesPerSecond;
    for (let frame = 0; frame < framesPerSecond; frame += 1) {
      playhead = advanceDepthPlayhead(playhead, 1, frameDuration);
    }
    return playhead;
  };

  const atSixtyHertz = simulate(60);
  const atOneTwentyHertz = simulate(120);
  assert.ok(atSixtyHertz > 0.99 && atSixtyHertz <= 1);
  assert.ok(Math.abs(atSixtyHertz - atOneTwentyHertz) < 0.0001);
  assert.equal(advanceDepthPlayhead(0.99999, 1, 16.67), 1);
});

test("paces video seeking instead of chasing every scroll event", () => {
  const base = {
    readyState: 4,
    currentTime: 1,
    seeking: false,
    seekInFlight: false,
    lastSeekAt: 20,
    lastSeekTime: 1,
  };

  assert.equal(shouldSeekDepthVideo(base, 1.2, 100), true);
  assert.equal(
    shouldSeekDepthVideo({ ...base, readyState: 0 }, 1.2, 100),
    false,
  );
  assert.equal(
    shouldSeekDepthVideo({ ...base, seeking: true, lastSeekAt: 80 }, 1.2, 100),
    false,
  );
  assert.equal(shouldSeekDepthVideo(base, 1.01, 100), false);
  assert.equal(
    shouldSeekDepthVideo({ ...base, lastSeekTime: 1.195 }, 1.2, 100),
    false,
  );
  assert.equal(
    shouldSeekDepthVideo({ ...base, lastSeekAt: 80 }, 1.2, 100),
    false,
  );

  assert.doesNotMatch(
    DepthVideoStory.prototype.seekRecord.toString(),
    /fastSeek/,
  );
});
