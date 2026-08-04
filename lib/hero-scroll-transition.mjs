export const heroTransitionSettings = Object.freeze({
  scrollViewports: 1,
  copyScaleLoss: 0.08,
  copyTranslateY: 20,
  particleStart: 0.18,
  particleEnd: 0.92,
  contourBands: 18,
});

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function mix(start, end, ratio) {
  return start + (end - start) * ratio;
}

function smoothstep(value) {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
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

export function createHeroTransitionState(progress = 0) {
  const normalized = clamp(progress);
  const copyEase = smootherstep(normalized);
  const waveEase = smoothstep(normalized / 0.72);
  const particleProgress = smootherstep(
    (normalized - heroTransitionSettings.particleStart) /
      (heroTransitionSettings.particleEnd - heroTransitionSettings.particleStart),
  );
  const stageOpacity = 1 - smoothstep((normalized - 0.9) / 0.1);

  return {
    progress: round(normalized),
    copyOpacity: round(1 - copyEase),
    copyScale: round(1 - normalized * heroTransitionSettings.copyScaleLoss),
    copyTranslateY: round(normalized * heroTransitionSettings.copyTranslateY),
    waveOpacity: round(1 - waveEase),
    waveWarp: round(smootherstep(normalized)),
    particleProgress: round(particleProgress),
    stageOpacity: round(stageOpacity),
  };
}

export function createHeroParticle(index, target, progress = 0) {
  const normalized = clamp(progress);
  if (normalized >= 1) return { ...target };

  const transition = smootherstep(normalized);
  const centerX = 80;
  const centerY = 50;
  const targetX = Number(target?.x) || 0;
  const targetY = Number(target?.y) || 0;
  const targetOpacity = clamp(target?.opacity);
  const targetSize = Math.max(0, Number(target?.size) || 0);
  const angle = Math.atan2(targetY - centerY, targetX - centerX);
  const targetRadius = Math.hypot(targetX - centerX, targetY - centerY);
  const bandSize = 55 / heroTransitionSettings.contourBands;
  const snappedRadius = Math.round(targetRadius / bandSize) * bandSize;
  const contourNoise = (hash(index, 41) - 0.5) * bandSize * 0.72;
  const contourRadius = snappedRadius + contourNoise;
  const sourceX = centerX + Math.cos(angle) * contourRadius * 1.34;
  const sourceY = centerY + Math.sin(angle) * contourRadius * 0.78;
  const stagger = smoothstep(
    (normalized - hash(index, 42) * 0.22) / 0.78,
  );

  return {
    x: round(mix(sourceX, targetX, transition)),
    y: round(mix(sourceY, targetY, transition)),
    opacity: round(targetOpacity * stagger),
    size: round(mix(targetSize * 0.55, targetSize, transition)),
  };
}
