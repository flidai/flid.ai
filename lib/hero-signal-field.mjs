import { buildLogoModel } from "./logo-generator.mjs";

const PRIMARY_MARK = Object.freeze({
  mode: "line",
  layers: 12,
  curl: 0.88,
  twist: 0,
  strokeWidth: 0.58,
  padding: 0,
  accents: 0,
});

export const signalFieldSettings = Object.freeze({
  ...PRIMARY_MARK,
  entranceDuration: 2.2,
  entranceDelay: 0.75,
  pulseDuration: 14,
  pulseDisplacement: 1.65,
  pointerDisplacementX: 0.65,
  pointerDisplacementY: 0.45,
});

const canonicalMarks = Object.freeze(
  buildLogoModel(PRIMARY_MARK).marks.map((mark) => Object.freeze(mark)),
);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function mix(start, end, ratio) {
  return start + (end - start) * ratio;
}

function smoothstep(value) {
  const normalized = clamp(value, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hash(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function round(value) {
  return Number(value.toFixed(6));
}

export function createSignalFieldFrame({
  timeSeconds = 0,
  pointer = { x: 0, y: 0 },
  reducedMotion = false,
} = {}) {
  if (reducedMotion) {
    return canonicalMarks.map((mark) => ({
      ...mark,
      accent: false,
    }));
  }

  const time = Math.max(0, Number(timeSeconds) || 0);
  const pointerX = clamp(pointer?.x, -1, 1);
  const pointerY = clamp(pointer?.y, -1, 1);
  const pulsePhase = modulo(
    (time - 5) / signalFieldSettings.pulseDuration,
    1,
  );
  const pulsePosition = pulsePhase * 1.3 - 0.15;

  return canonicalMarks.map((mark, index) => {
    const progress = index / Math.max(1, canonicalMarks.length - 1);
    const radialX = mark.x - 50;
    const radialY = mark.y - 50;
    const radius = Math.hypot(radialX, radialY);
    const radialProgress = radius / 45.5;
    const directionX = radius ? radialX / radius : 0;
    const directionY = radius ? radialY / radius : 0;
    const seed = hash(index, 1);
    const secondarySeed = hash(index, 2);
    const flowX =
      -78 +
      progress * 218 +
      Math.sin(progress * Math.PI * 9 + seed * 4) * 13;
    const flowY =
      50 +
      (seed - 0.5) * 92 +
      Math.sin(progress * Math.PI * 5 + secondarySeed * 5) * 16;
    const flowRotation = -28 + (secondarySeed - 0.5) * 88;
    const entrance = smoothstep(
      (time - 0.12 - progress * signalFieldSettings.entranceDelay) /
        signalFieldSettings.entranceDuration,
    );
    const pulseDistance = (radialProgress - pulsePosition) / 0.085;
    const pulse = Math.exp(-(pulseDistance ** 2));
    const breath = Math.sin(time * 0.34 + radialProgress * 1.8) * 0.24;
    const depth = 0.2 + progress * 0.8;
    const displacement =
      pulse * signalFieldSettings.pulseDisplacement + breath;
    const x =
      mix(flowX, mark.x, entrance) +
      directionX * displacement * entrance +
      pointerX * signalFieldSettings.pointerDisplacementX * depth * entrance;
    const y =
      mix(flowY, mark.y, entrance) +
      directionY * displacement * entrance +
      pointerY * signalFieldSettings.pointerDisplacementY * depth * entrance;
    const rotation =
      mix(flowRotation, mark.rotation, entrance) +
      pulse * (secondarySeed - 0.5) * 5;
    const openingOpacity = 0.1 + mark.opacity * 0.42;
    const opacity = mix(openingOpacity, mark.opacity, entrance);
    const accent =
      pulse > 0.5 &&
      (mark.kind === "dot" || (index + Math.round(time)) % 3 === 0);

    return {
      ...mark,
      x: round(x),
      y: round(y),
      rotation: round(rotation),
      opacity: round(opacity),
      accent,
      convergence: round(entrance),
      pulse: round(pulse),
    };
  });
}
