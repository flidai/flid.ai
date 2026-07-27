import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { brandSystem } from "../lib/brand-system.mjs";
import { generateLogoSvg } from "../lib/logo-generator.mjs";
import { primerColors } from "../lib/primer-colors.mjs";
import {
  generateGeistWordmarkOutline,
  geistWordmark,
} from "../lib/wordmark-generator.mjs";

const masters = Object.freeze({
  essential: Object.freeze({
    layers: 8,
    strokeWidth: 0.7,
    accents: 0,
    minimumSize: 16,
    role: "Small icons and navigation below 64px",
  }),
  primary: Object.freeze({
    layers: 12,
    strokeWidth: 0.58,
    accents: 0,
    minimumSize: 64,
    role: "Default identity mark",
  }),
  full: Object.freeze({
    layers: 16,
    strokeWidth: 0.42,
    accents: 3,
    minimumSize: 144,
    role: "Display and editorial use",
  }),
});

const themes = Object.freeze({
  "on-dark": Object.freeze({
    foreground: primerColors.dark.foreground,
    background: primerColors.dark.canvas,
  }),
  "on-light": Object.freeze({
    foreground: primerColors.light.foreground,
    background: primerColors.light.canvas,
  }),
});

function markOptions(master, foreground, padding = 0) {
  return {
    mode: "line",
    layers: master.layers,
    curl: brandSystem.primaryMark.curl,
    twist: brandSystem.primaryMark.twist,
    strokeWidth: master.strokeWidth,
    padding,
    accents: master.accents,
    foreground,
    accent: primerColors.dark.accent,
  };
}

function createLockupSvg(markSvg, foreground, masterName) {
  const nestedMark = markSvg.replace(
    'role="img"',
    'x="0" y="0" width="100" height="100" aria-hidden="true" focusable="false"',
  );
  const wordmark = generateGeistWordmarkOutline({ fill: foreground });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wordmark.viewBoxWidth} 100" role="img" data-status="approved" data-gap-ratio="${geistWordmark.gapRatio}" data-wordmark-typeface="${geistWordmark.family}" data-wordmark-weight="${geistWordmark.weight}">`,
    `<title>Flid ${masterName} horizontal lockup</title>`,
    `<desc>The approved procedural mark paired with the lowercase Flid wordmark set in ${geistWordmark.family} SemiBold and converted to vector outlines.</desc>`,
    nestedMark,
    `<path data-wordmark-outline="flid" fill="${wordmark.fill}" d="${wordmark.pathData}"/>`,
    "</svg>",
  ].join("");
}

async function writeAsset(outputDirectory, filename, content) {
  await writeFile(resolve(outputDirectory, filename), `${content}\n`, "utf8");
}

export async function generateBrandAssets(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const assets = [];

  for (const [masterName, master] of Object.entries(masters)) {
    for (const [themeName, theme] of Object.entries(themes)) {
      const markFilename = `mark-${masterName}-${themeName}.svg`;
      const markSvg = generateLogoSvg(
        markOptions(master, theme.foreground, 0),
      );
      await writeAsset(outputDirectory, markFilename, markSvg);
      assets.push({
        id: `mark-${masterName}-${themeName}`,
        type: "mark",
        master: masterName,
        theme: themeName,
        status: "approved",
        path: `/brand-assets/${markFilename}`,
        layers: master.layers,
        minimumSize: master.minimumSize,
        role: master.role,
        artworkBox: "tight",
      });

      const lockupFilename = `lockup-${masterName}-${themeName}.svg`;
      const lockupSvg = createLockupSvg(
        markSvg,
        theme.foreground,
        masterName,
      );
      await writeAsset(outputDirectory, lockupFilename, lockupSvg);
      assets.push({
        id: `lockup-${masterName}-${themeName}`,
        type: "lockup",
        master: masterName,
        theme: themeName,
        status: "approved",
        path: `/brand-assets/${lockupFilename}`,
        layers: master.layers,
        minimumSize: master.minimumSize,
        role: master.role,
        gapRatio: brandSystem.lockup.gapRatio,
        wordmarkStatus: brandSystem.lockup.wordmarkStatus,
        typeface: brandSystem.lockup.typeface,
      });
    }
  }

  const faviconFilename = "favicon.svg";
  const faviconSvg = generateLogoSvg(
    markOptions(masters.essential, primerColors.dark.accent, 8),
  );
  await writeAsset(outputDirectory, faviconFilename, faviconSvg);
  assets.push({
    id: "favicon",
    type: "icon",
    master: "essential",
    theme: "adaptive",
    status: "approved",
    path: `/brand-assets/${faviconFilename}`,
    layers: masters.essential.layers,
    minimumSize: 16,
    role: "Browser favicon",
    exportSafetyPadding: 8,
  });

  const manifest = {
    schemaVersion: 2,
    brand: brandSystem.identity.spokenName,
    source: {
      generator: "/lib/logo-generator.mjs",
      wordmarkGenerator: "/lib/wordmark-generator.mjs",
      specification: "/lib/brand-system.mjs",
      colorPrimitives: `@primer/primitives@${brandSystem.colorSource.version}`,
    },
    geometry: {
      curl: brandSystem.primaryMark.curl,
      twist: brandSystem.primaryMark.twist,
      artworkBox: "0 0 100 100",
      exportSafetyPadding: brandSystem.primaryMark.padding,
    },
    lockup: {
      gapRatio: brandSystem.lockup.gapRatio,
      clearSpaceRatio: brandSystem.lockup.clearSpaceRatio,
      wordmarkStatus: "approved",
      typeface: brandSystem.lockup.typeface,
      note: "Geist SemiBold is converted to vector outlines in every lockup export.",
    },
    assets,
  };

  await writeFile(
    resolve(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const outputDirectory = resolve(
    process.argv[2] ?? "dist/brand-assets",
  );
  const manifest = await generateBrandAssets(outputDirectory);
  console.log(
    `Generated ${manifest.assets.length} brand assets in ${outputDirectory}`,
  );
}
