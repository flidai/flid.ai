export const signalStoryScenes = Object.freeze([
  Object.freeze({ id: "unstructured", label: "Unstructured signals" }),
  Object.freeze({ id: "context", label: "Governed context" }),
  Object.freeze({ id: "capabilities", label: "Explicit capabilities" }),
  Object.freeze({ id: "foundation", label: "Agent-native foundation" }),
]);

export const signalStorySettings = Object.freeze({
  particleCount: 8_000,
  designWidth: 160,
  designHeight: 100,
});

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function mix(start, end, ratio) {
  return start + (end - start) * ratio;
}

function smootherstep(value) {
  const normalized = clamp(value);
  return normalized ** 3 * (normalized * (normalized * 6 - 15) + 10);
}

function hash(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function round(value) {
  return Number(value.toFixed(6));
}

function unstructuredTarget(index) {
  const x = -10 + hash(index, 1) * 180;
  const ridge =
    54 +
    Math.sin(x * 0.08 + 0.4) * 13 +
    Math.sin(x * 0.033 + 2.1) * 8;
  const depth = hash(index, 2);

  return {
    x,
    y: clamp(ridge + (depth - 0.5) * 44, 3, 97),
    opacity: 0.1 + depth * 0.58,
    size: 0.48 + hash(index, 3) * 0.72,
    accent: false,
  };
}

function contextTarget(index) {
  const band = index % 4;
  const localIndex = Math.floor(index / 4);
  const x = 2 + hash(localIndex, 20 + band) * 104;
  const depth = hash(localIndex, 24 + band);
  const center =
    19 +
    band * 20 +
    Math.sin(x * 0.08 + band * 1.2) * 5 +
    Math.sin(x * 0.027 + band * 0.8) * 3;
  const thickness = 13 + Math.sin(x * 0.045 + band) * 3;

  return {
    x,
    y: clamp(center + (depth - 0.5) * thickness, 3, 97),
    opacity: 0.14 + depth * 0.62,
    size: 0.46 + hash(index, 5) * 0.64,
    accent: false,
  };
}

function capabilitiesTarget(index) {
  const centers = [
    { x: 24, y: 29, radiusX: 16, radiusY: 15 },
    { x: 72, y: 49, radiusX: 17, radiusY: 17 },
    { x: 29, y: 73, radiusX: 15, radiusY: 16 },
  ];
  const cluster = index % centers.length;
  const localIndex = Math.floor(index / centers.length);
  const center = centers[cluster];
  const angle = hash(localIndex, 6 + cluster) * Math.PI * 2;
  const radius = Math.sqrt(hash(localIndex, 10 + cluster));
  const depth = hash(localIndex, 14 + cluster);
  const edge =
    1 +
    Math.sin(angle * 3 + cluster * 0.9) * 0.14 +
    Math.sin(angle * 7 - cluster) * 0.06;

  return {
    x: center.x + Math.cos(angle) * radius * center.radiusX * edge,
    y: center.y + Math.sin(angle) * radius * center.radiusY * edge,
    opacity: 0.14 + depth * 0.7,
    size: 0.5 + depth * 0.68,
    accent: false,
  };
}

function foundationTarget(index) {
  const vertical = 1 - hash(index, 30) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - vertical ** 2));
  const angle = hash(index, 31) * Math.PI * 2;
  const depth = radius * Math.sin(angle);
  const depthProgress = (depth + 1) / 2;

  return {
    x: 45 + radius * Math.cos(angle) * 35,
    y: 50 + vertical * 38,
    opacity: 0.14 + depthProgress * 0.76,
    size: 0.48 + depthProgress * 0.78,
    accent: false,
  };
}

const targetBuilders = [
  unstructuredTarget,
  contextTarget,
  capabilitiesTarget,
  foundationTarget,
];

const targets = Object.freeze(
  targetBuilders.map((buildTarget) =>
    Object.freeze(
      Array.from(
        { length: signalStorySettings.particleCount },
        (_, index) => Object.freeze(buildTarget(index)),
      ),
    ),
  ),
);

export function createSignalStoryState(progress = 0) {
  const normalizedProgress = clamp(progress);
  const scenePosition = normalizedProgress * (signalStoryScenes.length - 1);
  const sceneIndex = Math.min(
    signalStoryScenes.length - 1,
    Math.floor(scenePosition),
  );
  const nextScene = Math.min(signalStoryScenes.length - 1, sceneIndex + 1);
  const localProgress = nextScene === sceneIndex ? 0 : scenePosition - sceneIndex;
  const transition = smootherstep(localProgress);
  const weights = Array(signalStoryScenes.length).fill(0);

  if (sceneIndex === nextScene) {
    weights[sceneIndex] = 1;
  } else {
    weights[sceneIndex] = 1 - transition;
    weights[nextScene] = transition;
  }

  return {
    progress: round(normalizedProgress),
    scenePosition: round(scenePosition),
    sceneIndex,
    nextScene,
    localProgress: round(localProgress),
    transition: round(transition),
    activeScene: transition < 0.5 ? sceneIndex : nextScene,
    weights: weights.map(round),
  };
}

export function storySubtitleRevealProgress(
  scenePosition = 0,
  sceneIndex = 0,
  sceneCount = signalStoryScenes.length,
) {
  const count = Math.max(1, Math.floor(Number(sceneCount) || 1));
  const index = Math.min(
    count - 1,
    Math.max(0, Math.floor(Number(sceneIndex) || 0)),
  );
  const position = clamp(scenePosition, 0, count - 1);
  const entryPosition = index === 0 ? 0 : index - 0.5;
  const revealDuration = 0.42;
  return round(clamp((position - entryPosition) / revealDuration));
}

export function visitSignalStoryFrame(progress = 0, visitor) {
  if (typeof visitor !== "function") return;

  const state = createSignalStoryState(progress);
  const from = targets[state.sceneIndex];
  const to = targets[state.nextScene];
  const transition = state.transition;

  for (let index = 0; index < signalStorySettings.particleCount; index += 1) {
    const start = from[index];
    const end = to[index];
    visitor(
      round(mix(start.x, end.x, transition)),
      round(mix(start.y, end.y, transition)),
      round(mix(start.opacity, end.opacity, transition)),
      round(mix(start.size, end.size, transition)),
      transition < 0.5 ? start.accent : end.accent,
      index,
    );
  }
}

export function createSignalStoryFrame(progress = 0) {
  const frame = [];
  visitSignalStoryFrame(progress, (x, y, opacity, size, accent) => {
    frame.push({ x, y, opacity, size, accent });
  });
  return frame;
}
