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
  assert.equal(opening.sampleA, 0);
  assert.equal(opening.sampleB, 0);
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
  assert.match(depthVertexShader, /sourceContentMask/);
  assert.match(
    depthVertexShader,
    /1\.0\s*-\s*smoothstep\(0\.11,\s*0\.30,\s*uv\.y\)/,
    "the source mask must cover the full embedded demo watermark",
  );
  assert.match(
    depthVertexShader,
    /smoothstep\(0\.48,\s*0\.64,\s*uv\.x\)/,
    "the watermark mask must stay fully opaque from x = 0.64 and feather outward",
  );
  assert.match(
    depthVertexShader,
    /smoothstep\(0\.0,\s*0\.09,\s*edgeDistance\.y\)/,
    "the bright top and bottom source rows must feather out instead of forming a seam",
  );
  assert.doesNotMatch(depthVertexShader, /uAvoidRect|rectangleInfluence/);
  assert.doesNotMatch(
    depthVertexShader,
    /transitionDust|strand|turbulence|float transition\s*=/,
  );
  assert.match(depthVertexShader, /gl_PointSize/);
  assert.match(depthVertexShader, /uPointer/);
  assert.match(depthVertexShader, /uniform float uEntrance/);
  assert.match(depthVertexShader, /mix\(contourWorld, imageWorld, entrance\)/);
  assert.match(depthVertexShader, /mix\(0\.34, 1\.0, presence\)/);
  assert.match(depthVertexShader, /smoothstep\(0\.035, 0\.92, value\)/);
  assert.match(depthVertexShader, /mix\(0\.46, 1\.35/);
  assert.match(depthVertexShader, /float perspective = 1\.98 \/ viewDepth;/);
  assert.doesNotMatch(depthVertexShader, /cameraZ \/ viewDepth/);
  assert.match(depthFragmentShader, /gl_PointCoord/);
  assert.match(depthFragmentShader, /alpha < 0\.007/);
});

test("can morph the opening video frame out of the hero contour field", () => {
  assert.match(DepthVideoStory.prototype.setEntrance.toString(), /this\.entrance/);
  assert.match(DepthVideoStory.toString(), /this\.entrance\s*=\s*1/);
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

test("displays a decoded frame before a continuing scroll starts the next seek", () => {
  const record = {
    width: 640, height: 360, seekInFlight: false,
    needsTextureUpdate: true, uploadedTime: 0, decodedTime: 1,
  };
  const gl = new Proxy({}, { get: () => () => {} });
  const renderer = {
    disposed: false, vertexCount: 100, progress: 0.5, records: [record],
    gl, uniforms: {}, canvas: { clientWidth: 390, clientHeight: 456 },
    pointer: { x: 0, y: 0 }, color: "#f0f6fc", entrance: 1,
    planeScale: () => [1, 1],
    uploadRecord(frame) {
      if (frame.needsTextureUpdate && !frame.seekInFlight) {
        frame.uploadedTime = frame.decodedTime;
        frame.needsTextureUpdate = false;
      }
    },
    seekRecord(frame) { frame.seekInFlight = true; },
  };
  const originalDpr = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1;
  try {
    DepthVideoStory.prototype.render.call(renderer, 100);
    assert.equal(record.uploadedTime, 1, "the completed frame must reach the GPU");
    assert.equal(record.seekInFlight, true, "scrubbing must continue to the next frame");
  } finally {
    if (originalDpr === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = originalDpr;
  }
});

test("renders from the cached canvas size without forcing layout", () => {
  const record = {
    width: 640, height: 360, seekInFlight: false,
    needsTextureUpdate: false, uploadedTime: 0, decodedTime: 0,
  };
  const viewport = [];
  const gl = new Proxy({}, {
    get: (_, name) => (...args) => {
      if (name === "uniform2f" && args[0] === "uViewport") viewport.push(args.slice(1));
    },
  });
  const canvas = {};
  for (const name of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(canvas, name, {
      get() { throw new Error(`render must not read canvas.${name}`); },
    });
  }
  const renderer = {
    disposed: false, contextLost: false, vertexCount: 100, progress: 0.5,
    records: [record], gl, uniforms: { uViewport: "uViewport" }, canvas,
    cssWidth: 390, cssHeight: 456,
    pointer: { x: 0, y: 0 }, color: "#f0f6fc", entrance: 1,
    planeScale: DepthVideoStory.prototype.planeScale,
    uploadRecord() {},
    seekRecord() {},
  };
  const originalDpr = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 3;
  try {
    DepthVideoStory.prototype.render.call(renderer, 100);
    assert.deepEqual(viewport, [[390, 456]]);

    viewport.length = 0;
    renderer.contextLost = true;
    assert.equal(DepthVideoStory.prototype.render.call(renderer, 116), undefined);
    assert.deepEqual(viewport, [], "a lost WebGL context must not receive draws");
  } finally {
    if (originalDpr === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = originalDpr;
  }
});
