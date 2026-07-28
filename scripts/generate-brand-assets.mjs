import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import PDFDocument from "pdfkit";
import pngToIco from "png-to-ico";
import sharp from "sharp";
import SVGtoPDF from "svg-to-pdfkit";

import { brandSystem } from "../lib/brand-system.mjs";
import { generateLogoSvg } from "../lib/logo-generator.mjs";
import { primerColors } from "../lib/primer-colors.mjs";
import {
  generateGeistTextOutline,
  generateGeistWordmarkOutline,
  geistWordmark,
} from "../lib/wordmark-generator.mjs";

const PDF_DATE = new Date("2026-07-28T00:00:00.000Z");

const masters = Object.freeze({
  essential: Object.freeze({
    layers: 8,
    strokeWidth: 0.7,
    accents: 0,
    minimumSize: 16,
    pngBaseSize: 32,
    status: "reference",
    role: "Archived 8-layer exploration; not for production use",
  }),
  primary: Object.freeze({
    layers: 12,
    strokeWidth: 0.58,
    accents: 0,
    minimumSize: 64,
    pngBaseSize: 128,
    status: "approved",
    role: "The sole approved Flid identity mark",
  }),
  full: Object.freeze({
    layers: 16,
    strokeWidth: 0.42,
    accents: 3,
    minimumSize: 144,
    pngBaseSize: 256,
    status: "reference",
    role: "Archived 16-layer exploration; not for production use",
  }),
});

const themes = Object.freeze({
  "on-dark": Object.freeze({
    foreground: primerColors.dark.foreground,
    foregroundMuted: primerColors.dark.foregroundMuted,
    background: primerColors.dark.canvas,
    border: primerColors.dark.border,
    accent: primerColors.dark.accent,
  }),
  "on-light": Object.freeze({
    foreground: primerColors.light.foreground,
    foregroundMuted: primerColors.light.foregroundMuted,
    background: primerColors.light.canvas,
    border: primerColors.light.border,
    accent: primerColors.light.accent,
  }),
});

function assetPath(filename) {
  return `/brand-assets/${filename}`;
}

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

function createLockupSvg(markSvg, foreground, masterName, status) {
  const nestedMark = markSvg.replace(
    'role="img"',
    'x="0" y="0" width="100" height="100" aria-hidden="true" focusable="false"',
  );
  const wordmark = generateGeistWordmarkOutline({ fill: foreground });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wordmark.viewBoxWidth} 100" role="img" data-status="${status}" data-gap-ratio="${geistWordmark.gapRatio}" data-wordmark-typeface="${geistWordmark.family}" data-wordmark-weight="${geistWordmark.weight}">`,
    `<title>Flid ${masterName} horizontal lockup</title>`,
    `<desc>The ${status === "approved" ? "approved" : "archived"} procedural mark paired with the lowercase Flid wordmark set in ${geistWordmark.family} SemiBold and converted to vector outlines.</desc>`,
    nestedMark,
    `<path data-wordmark-outline="flid" fill="${wordmark.fill}" d="${wordmark.pathData}"/>`,
    "</svg>",
  ].join("");
}

function svgArtwork(svg) {
  return svg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")
    .replace(/<title>.*?<\/title>/, "")
    .replace(/<desc>.*?<\/desc>/, "");
}

function prepareSmallRasterMark(svg, minimumOpacity) {
  return svg
    .replaceAll(' vector-effect="non-scaling-stroke"', "")
    .replace(
      / opacity="([\d.]+)"/g,
      (match, opacity) =>
        ` opacity="${Math.max(Number(opacity), minimumOpacity)}"`,
    );
}

function outlinePath(outline, attributes = "") {
  return `<path ${attributes} fill="${outline.fill}" d="${outline.pathData}"/>`;
}

function generateCenteredTextOutline({
  text,
  fill,
  centerX,
  centerY,
  fontSize,
}) {
  const measured = generateGeistTextOutline({
    text,
    fill,
    centerY,
    fontSize,
  });
  const measuredCenter = (measured.bounds.x1 + measured.bounds.x2) / 2;

  return generateGeistTextOutline({
    text,
    fill,
    x: centerX - measuredCenter,
    centerY,
    fontSize,
  });
}

function createLinkedInBannerSvg({ variant, themeName }) {
  const theme = themes[themeName];
  const dark = themeName === "on-dark";
  const company = variant === "company";
  const width = company ? 1128 : 1584;
  const height = company ? 191 : 396;
  const fieldDiameter = company ? 310 : 650;
  const fieldX = company ? 858 : 1090;
  const fieldY = company ? -60 : -127;
  const message = company
    ? "Products where agents do real work."
    : "Building agent-native products.";
  const statement = generateCenteredTextOutline({
    text: message,
    fill: theme.foreground,
    centerX: company ? 530 : 740,
    centerY: height / 2,
    fontSize: company ? 34 : 56,
  });
  const decorativeMark = generateLogoSvg({
    ...markOptions(masters.primary, theme.foreground, 0),
    accents: 0,
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" data-linkedin-banner="${variant}" data-color-mode="${dark ? "dark" : "light"}" data-message="${message}">`,
    `<title>Flid LinkedIn ${variant} banner - ${dark ? "dark" : "light"}</title>`,
    `<desc>The statement ${message} with the approved 12-layer Flid field enlarged and cropped on the right.</desc>`,
    `<rect width="${width}" height="${height}" fill="${theme.background}"/>`,
    `<g data-decorative-field="primary-12-layer" data-placement="right-crop" opacity="${dark ? "0.34" : "0.2"}" transform="translate(${fieldX} ${fieldY}) scale(${fieldDiameter / 100})">${svgArtwork(decorativeMark)}</g>`,
    `<g data-linkedin-safe-content="center">`,
    outlinePath(statement, 'data-positioning-outline="true"'),
    "</g>",
    "</svg>",
  ].join("");
}

function viewBoxDimensions(svg) {
  const match = svg.match(
    /viewBox="(?:-?[\d.]+\s+){2}([\d.]+)\s+([\d.]+)"/,
  );
  if (!match) throw new Error("SVG is missing a numeric viewBox.");
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function writeAsset(outputDirectory, filename, content) {
  const target = resolve(outputDirectory, filename);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(
    target,
    typeof content === "string" ? `${content}\n` : content,
  );
}

async function createPdf(svg, title) {
  const { width, height } = viewBoxDimensions(svg);

  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    const document = new PDFDocument({
      autoFirstPage: true,
      compress: true,
      margin: 0,
      size: [width, height],
      info: {
        Title: title,
        Author: "Flid AI ApS",
        Creator: "Flid brand asset generator",
        Producer: "PDFKit + SVG-to-PDFKit",
        CreationDate: PDF_DATE,
        ModDate: PDF_DATE,
      },
    });

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolvePromise(Buffer.concat(chunks)));
    document.on("error", reject);
    SVGtoPDF(document, svg, 0, 0, {
      width,
      height,
      preserveAspectRatio: "xMinYMin meet",
    });
    document.end();
  });
}

async function createPng(svg, height) {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize({ height, fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

async function exportLogoFiles({
  outputDirectory,
  filenameBase,
  svg,
  pngBaseSize,
  title,
}) {
  const svgFilename = `${filenameBase}.svg`;
  const pdfFilename = `pdf/${filenameBase}.pdf`;
  await Promise.all([
    writeAsset(outputDirectory, svgFilename, svg),
    createPdf(svg, title).then((pdf) =>
      writeAsset(outputDirectory, pdfFilename, pdf),
    ),
  ]);

  const png = [];
  for (const scale of [1, 2, 4]) {
    const filename = `png/${filenameBase}@${scale}x.png`;
    const rendered = await createPng(svg, pngBaseSize * scale);
    await writeAsset(outputDirectory, filename, rendered.data);
    png.push({
      scale,
      width: rendered.width,
      height: rendered.height,
      path: assetPath(filename),
    });
  }

  return {
    svg: assetPath(svgFilename),
    pdf: assetPath(pdfFilename),
    png,
  };
}

async function createSurfacePng({
  svg,
  width,
  height,
  artworkHeight,
  background,
}) {
  const artwork = await createPng(svg, artworkHeight);
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: artwork.data,
        left: Math.round((width - artwork.width) / 2),
        top: Math.round((height - artwork.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function packageReadme() {
  return `# Flid brand assets

This directory is generated from the approved procedural identity in
\`lib/brand-system.mjs\`. Do not edit exported files manually.

## Formats

- **SVG** is the canonical digital source and uses vector wordmark outlines.
- **PNG** exports are transparent and supplied at 1x, 2x, and 4x.
- **PDF** exports remain vector for print and production workflows.
- **ICO and fixed-size PNG** files cover browser, app, and touch icons.
- **Social PNG** files provide 1024px profile images and 1200x630 share cards.
- **LinkedIn company-logo PNG** files are square, upload-ready, and include an
  opaque dark or light background. They retain the 12-layer geometry with
  documented optical compensation for LinkedIn's small rendered thumbnail.
- **LinkedIn SVG and PNG** files provide company and personal banners in dark
  and light modes.

## Production master

- **Primary / 12 layers:** the sole approved Flid identity at every size.
- **Essential / 8 layers** and **Full / 16 layers** are retained only as an
  archive of the design process. Do not use them in production.

Use \`on-dark\` artwork on dark surfaces and \`on-light\` artwork on light
surfaces. Preserve the 0.20D mark-to-word gap and 0.25D clear space encoded in
\`manifest.json\`.

Regenerate everything with:

\`\`\`sh
npm run assets
\`\`\`
`;
}

export async function generateBrandAssets(outputDirectory) {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const assets = [];
  const generated = new Map();

  for (const [masterName, master] of Object.entries(masters)) {
    for (const [themeName, theme] of Object.entries(themes)) {
      const markId = `mark-${masterName}-${themeName}`;
      const markSvg = generateLogoSvg(
        markOptions(master, theme.foreground, 0),
      );
      const markFiles = await exportLogoFiles({
        outputDirectory,
        filenameBase: markId,
        svg: markSvg,
        pngBaseSize: master.pngBaseSize,
        title: `Flid ${masterName} mark ${themeName}`,
      });
      generated.set(markId, markSvg);
      assets.push({
        id: markId,
        type: "mark",
        master: masterName,
        theme: themeName,
        status: master.status,
        path: markFiles.svg,
        files: markFiles,
        layers: master.layers,
        minimumSize: master.minimumSize,
        role: master.role,
        artworkBox: "tight",
      });

      const lockupId = `lockup-${masterName}-${themeName}`;
      const lockupSvg = createLockupSvg(
        markSvg,
        theme.foreground,
        masterName,
        master.status,
      );
      const lockupFiles = await exportLogoFiles({
        outputDirectory,
        filenameBase: lockupId,
        svg: lockupSvg,
        pngBaseSize: master.pngBaseSize,
        title: `Flid ${masterName} horizontal lockup ${themeName}`,
      });
      generated.set(lockupId, lockupSvg);
      assets.push({
        id: lockupId,
        type: "lockup",
        master: masterName,
        theme: themeName,
        status: master.status,
        path: lockupFiles.svg,
        files: lockupFiles,
        layers: master.layers,
        minimumSize: master.minimumSize,
        role: master.role,
        gapRatio: brandSystem.lockup.gapRatio,
        wordmarkStatus: brandSystem.lockup.wordmarkStatus,
        typeface: brandSystem.lockup.typeface,
      });
    }
  }

  const faviconSvg = generateLogoSvg(
    markOptions(masters.primary, primerColors.dark.accent, 8),
  );
  const faviconSvgFilename = "favicon.svg";
  await writeAsset(outputDirectory, faviconSvgFilename, faviconSvg);
  const faviconPng = [];
  const faviconBuffers = new Map();
  for (const [name, size] of [
    ["favicon/favicon-16.png", 16],
    ["favicon/favicon-32.png", 32],
    ["favicon/favicon-48.png", 48],
    ["favicon/apple-touch-icon.png", 180],
    ["favicon/icon-192.png", 192],
    ["favicon/icon-512.png", 512],
  ]) {
    const rendered = await createPng(faviconSvg, size);
    await writeAsset(outputDirectory, name, rendered.data);
    faviconBuffers.set(size, rendered.data);
    faviconPng.push({
      name: name.split("/").at(-1),
      width: size,
      height: size,
      path: assetPath(name),
    });
  }
  const icoFilename = "favicon/favicon.ico";
  const ico = await pngToIco(
    [16, 32, 48].map((size) => faviconBuffers.get(size)),
  );
  await writeAsset(outputDirectory, icoFilename, ico);
  const webmanifestFilename = "favicon/site.webmanifest";
  await writeAsset(
    outputDirectory,
    webmanifestFilename,
    JSON.stringify(
      {
        name: "Flid",
        short_name: "Flid",
        icons: [
          {
            src: "/brand-assets/favicon/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/brand-assets/favicon/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        theme_color: primerColors.dark.canvas,
        background_color: primerColors.dark.canvas,
        display: "standalone",
      },
      null,
      2,
    ),
  );
  assets.push({
    id: "favicon",
    type: "icon",
    master: "primary",
    theme: "adaptive",
    status: "approved",
    path: assetPath(faviconSvgFilename),
    files: {
      svg: assetPath(faviconSvgFilename),
      ico: assetPath(icoFilename),
      webmanifest: assetPath(webmanifestFilename),
      png: faviconPng,
    },
    layers: masters.primary.layers,
    minimumSize: 16,
    role: "Browser, app, and touch icon",
    exportSafetyPadding: 8,
  });

  for (const themeName of Object.keys(themes)) {
    const suffix = themeName.replace("on-", "");
    const theme = themes[themeName];
    const profileFilename = `social/profile-${suffix}-1024.png`;
    const profile = await createSurfacePng({
      svg: generated.get(`mark-primary-${themeName}`),
      width: 1024,
      height: 1024,
      artworkHeight: 650,
      background: theme.background,
    });
    await writeAsset(outputDirectory, profileFilename, profile);
    assets.push({
      id: `social-profile-${suffix}`,
      type: "social",
      master: "primary",
      theme: themeName,
      status: "approved",
      path: assetPath(profileFilename),
      files: {
        png: [{
          width: 1024,
          height: 1024,
          path: assetPath(profileFilename),
        }],
      },
      role: "Social profile image",
    });

    const linkedInLogoFilename =
      `social/linkedin-company-logo-${suffix}-1024.png`;
    const linkedInLogoForeground =
      themeName === "on-dark" ? "#ffffff" : "#000000";
    const linkedInLogoOpticalCompensation = {
      artworkRatio: 0.82,
      strokeWidth: 0.85,
      minimumOpacity: 0.7,
      foreground: linkedInLogoForeground,
    };
    const linkedInLogoSvg = prepareSmallRasterMark(
      generateLogoSvg(
        markOptions(
          {
            ...masters.primary,
            strokeWidth: linkedInLogoOpticalCompensation.strokeWidth,
          },
          linkedInLogoForeground,
          0,
        ),
      ),
      linkedInLogoOpticalCompensation.minimumOpacity,
    );
    const linkedInLogo = await createSurfacePng({
      svg: linkedInLogoSvg,
      width: 1024,
      height: 1024,
      artworkHeight: Math.round(
        1024 * linkedInLogoOpticalCompensation.artworkRatio,
      ),
      background: theme.background,
    });
    await writeAsset(outputDirectory, linkedInLogoFilename, linkedInLogo);
    assets.push({
      id: `linkedin-company-logo-${suffix}`,
      type: "linkedin-logo",
      master: "primary",
      theme: themeName,
      status: "approved",
      path: assetPath(linkedInLogoFilename),
      files: {
        png: [{
          width: 1024,
          height: 1024,
          path: assetPath(linkedInLogoFilename),
        }],
      },
      role: "Optically compensated LinkedIn company logo with opaque background",
      opticalCompensation: linkedInLogoOpticalCompensation,
    });

    const shareFilename = `social/share-${suffix}-1200x630.png`;
    const share = await createSurfacePng({
      svg: generated.get(`lockup-primary-${themeName}`),
      width: 1200,
      height: 630,
      artworkHeight: 220,
      background: theme.background,
    });
    await writeAsset(outputDirectory, shareFilename, share);
    assets.push({
      id: `social-share-${suffix}`,
      type: "social",
      master: "primary",
      theme: themeName,
      status: "approved",
      path: assetPath(shareFilename),
      files: {
        png: [{
          width: 1200,
          height: 630,
          path: assetPath(shareFilename),
        }],
      },
      role: "Open Graph and social sharing image",
    });
  }

  for (const variant of ["company", "personal"]) {
    for (const themeName of Object.keys(themes)) {
      const suffix = themeName.replace("on-", "");
      const width = variant === "company" ? 1128 : 1584;
      const height = variant === "company" ? 191 : 396;
      const id = `linkedin-${variant}-${suffix}`;
      const filenameBase = `social/${id}-${width}x${height}`;
      const svgFilename = `${filenameBase}.svg`;
      const pngFilename = `${filenameBase}.png`;
      const svg = createLinkedInBannerSvg({ variant, themeName });
      const png = await createPng(svg, height);
      await Promise.all([
        writeAsset(outputDirectory, svgFilename, svg),
        writeAsset(outputDirectory, pngFilename, png.data),
      ]);
      assets.push({
        id,
        type: "linkedin",
        master: "primary",
        theme: themeName,
        status: "approved",
        path: assetPath(pngFilename),
        files: {
          svg: assetPath(svgFilename),
          png: [{
            width,
            height,
            path: assetPath(pngFilename),
          }],
        },
        role: variant === "company"
          ? "LinkedIn company page banner"
          : "LinkedIn personal profile banner",
        safeContentArea: "Centered statement; keep the lower-left clear",
      });
    }
  }

  const manifest = {
    schemaVersion: 3,
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
    formats: {
      svg: "Canonical portable vector artwork",
      png: "Transparent 1x, 2x, and 4x raster exports",
      pdf: "Vector print and production artwork",
      ico: "Multi-resolution browser favicon",
    },
    assets,
  };

  await Promise.all([
    writeAsset(
      outputDirectory,
      "manifest.json",
      JSON.stringify(manifest, null, 2),
    ),
    writeAsset(outputDirectory, "README.md", packageReadme()),
  ]);

  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const outputDirectory = resolve(
    process.argv[2] ?? "brand-assets",
  );
  const manifest = await generateBrandAssets(outputDirectory);
  console.log(
    `Generated ${manifest.assets.length} brand asset families in ${outputDirectory}`,
  );
}
