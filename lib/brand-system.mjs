import { primerColors } from "./primer-colors.mjs";

export const brandSystem = Object.freeze({
  identity: Object.freeze({
    wordmark: "flid",
    spokenName: "Flid",
    companyName: "Flid AI",
    legalName: "Flid AI ApS",
    domain: "flid.ai",
    casingRule: "Lowercase in the wordmark; title case in prose.",
  }),
  primaryMark: Object.freeze({
    name: "12-layer open field",
    mode: "line",
    layers: 12,
    marks: 135,
    curl: 0.88,
    twist: 0,
    strokeWidth: 0.58,
    padding: 10,
    accents: 0,
    minimumDigitalSize: 64,
    minimumPrintSizeMm: 16,
  }),
  lockup: Object.freeze({
    gapRatio: 0.2,
    clearSpaceRatio: 0.25,
    wordmarkStatus: "Approved",
    typeface: Object.freeze({
      family: "Geist",
      weight: 600,
      version: "1.7.2",
      tracking: 0,
      format: "vector outlines",
    }),
  }),
  colorSource: Object.freeze({
    source: "@primer/primitives",
    version: "11.9.0",
  }),
  scaleReferences: Object.freeze([
    Object.freeze({ size: 24, layers: 8, label: "Essential", role: "Small icon only" }),
    Object.freeze({ size: 40, layers: 8, label: "Essential", role: "Compact navigation" }),
    Object.freeze({ size: 64, layers: 12, label: "Primary", role: "Minimum primary lockup" }),
    Object.freeze({ size: 96, layers: 12, label: "Primary", role: "Default digital lockup" }),
    Object.freeze({ size: 144, layers: 16, label: "Full", role: "Display and editorial" }),
  ]),
  colors: Object.freeze({
    ink: Object.freeze({
      name: "Canvas",
      token: "--bgColor-default",
      hex: primerColors.dark.canvas.toUpperCase(),
    }),
    paper: Object.freeze({
      name: "Foreground",
      token: "--fgColor-default",
      hex: primerColors.dark.foreground.toUpperCase(),
    }),
    muted: Object.freeze({
      name: "Muted foreground",
      token: "--fgColor-muted",
      hex: primerColors.dark.foregroundMuted.toUpperCase(),
    }),
    border: Object.freeze({
      name: "Border",
      token: "--borderColor-default",
      hex: primerColors.dark.border.toUpperCase(),
    }),
    accent: Object.freeze({
      name: "Accent",
      token: "--fgColor-accent",
      hex: primerColors.dark.accent.toUpperCase(),
    }),
  }),
});
