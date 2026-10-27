import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { generateSiteIconSvg } from "../lib/site-icon.mjs";
import { generateBrandAssets } from "./generate-brand-assets.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const prefixableExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".webmanifest",
]);

const copiedFiles = [
  ["app/globals.css", "assets/globals.css"],
  ["app/home/home.css", "assets/home.css"],
  ["app/products/products.css", "assets/products.css"],
  ["app/about/about.css", "assets/about.css"],
  ["app/showcase/showcase.css", "assets/showcase.css"],
  ["app/generator/generator.css", "assets/generator.css"],
  ["app/brand/brand.css", "assets/brand.css"],
  ["app/identity/identity-header.css", "assets/identity-header.css"],
  ["lib/hero-signal-field.mjs", "lib/hero-signal-field.mjs"],
  ["lib/hero-scroll-transition.mjs", "lib/hero-scroll-transition.mjs"],
  ["lib/signal-scroll-story.mjs", "lib/signal-scroll-story.mjs"],
  ["lib/depth-video-story.mjs", "lib/depth-video-story.mjs"],
  ["lib/logo-generator.mjs", "lib/logo-generator.mjs"],
  ["lib/brand-system.mjs", "lib/brand-system.mjs"],
  ["lib/primer-colors.mjs", "lib/primer-colors.mjs"],
  ["lib/wordmark-generator.mjs", "lib/wordmark-generator.mjs"],
  ["vendor/geist/LICENSE.txt", "licenses/geist-OFL-1.1.txt"],
];

function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") return "";
  const normalized = `/${basePath}`.replace(/\/+/g, "/").replace(/\/$/, "");
  if (normalized.includes("..")) {
    throw new TypeError("SITE_BASE_PATH cannot contain parent traversal.");
  }
  return normalized;
}

export function prefixSitePaths(content, basePath) {
  const normalized = normalizeBasePath(basePath);
  if (!normalized) return content;

  return content
    .replace(/(["'])\/(?!\/)/g, `$1${normalized}/`)
    .replace(/url\(\/(?!\/)/g, `url(${normalized}/`)
    .replace(/\bsrcset=(["'])([^"']*)\1/g, (_, quote, value) => {
      // Only the first candidate follows a quote; prefix the rest as well.
      const candidates = value.split(",").map((candidate) => {
        const trimmed = candidate.trim();
        return trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith(`${normalized}/`)
          ? `${normalized}${trimmed}`
          : trimmed;
      });
      return `srcset=${quote}${candidates.join(", ")}${quote}`;
    });
}

async function applyBasePath(directory, basePath) {
  if (!normalizeBasePath(basePath)) return;

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const pathname = join(directory, entry.name);
    if (entry.isDirectory()) {
      await applyBasePath(pathname, basePath);
    } else if (prefixableExtensions.has(extname(entry.name))) {
      const source = await readFile(pathname, "utf8");
      await writeFile(pathname, prefixSitePaths(source, basePath), "utf8");
    }
  }
}

export async function buildSite({
  outputDirectory = output,
  basePath = "",
} = {}) {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(join(root, "site"), outputDirectory, { recursive: true });

  for (const [source, destination] of copiedFiles) {
    const target = join(outputDirectory, destination);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, source), target);
  }

  const portraits = [
    ["Jacob Østergaard 1.png", "jacob-oestergaard.webp"],
    ["Ganesh Kambli.png", "ganesh-kambli.webp"],
    ["Anand Bora.png", "anand-bora.webp"],
  ];
  const portraitDirectory = join(outputDirectory, "assets/images");
  await mkdir(portraitDirectory, { recursive: true });
  await Promise.all(
    portraits.map(([source, destination]) =>
      sharp(join(root, source))
        .resize(960, 960, { fit: "cover", position: "center" })
        .webp({ quality: 82, effort: 4 })
        .toFile(join(portraitDirectory, destination)),
    ),
  );

  await generateBrandAssets(join(outputDirectory, "brand-assets"));
  await buildHeaderLogoAssets(outputDirectory);
  await buildShowcase(outputDirectory);
  await buildFooterLockup(outputDirectory);
  await buildSiteIcons(outputDirectory);
  await inlineGlobalStyles(outputDirectory);
  await applyBasePath(outputDirectory, basePath);
}

// The canonical lockup and mark SVGs outline all 134 signal curves (~180 KB
// each). The site header only needs the wordmark and a 48 px mark, so derive
// lightweight copies from the generated brand assets instead of shipping the
// full outlines on every first page load.
export async function buildHeaderLogoAssets(outputDirectory) {
  const brandDirectory = join(outputDirectory, "brand-assets");
  const imageDirectory = join(outputDirectory, "assets/images");
  await mkdir(imageDirectory, { recursive: true });

  const lockup = await readFile(
    join(brandDirectory, "lockup-primary-on-dark.svg"),
    "utf8",
  );
  const viewBox = lockup.match(/^<svg[^>]*\sviewBox="([^"]+)"/)?.[1];
  const wordmark = lockup.match(/<path data-wordmark-outline="flid"[^>]*\/>/)?.[0];
  if (!viewBox || !wordmark) {
    throw new Error("The primary lockup no longer contains an outlined wordmark.");
  }
  await writeFile(
    join(imageDirectory, "site-wordmark-on-dark.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${wordmark}</svg>\n`,
    "utf8",
  );

  await sharp(join(brandDirectory, "mark-primary-on-dark.svg"), { density: 288 })
    .resize(192, 192)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(join(imageDirectory, "site-mark-on-dark.webp"));
}

// The footer shows the full lockup at ~92 px. The canonical lockup SVG outlines
// every signal curve (~180 KB), so ship a single-file derivative instead: the
// canonical wordmark outline beside a small raster of the approved mark. It
// stays one <img>, so pages keep their existing footer markup and alt text.
export async function buildFooterLockup(outputDirectory) {
  const brandDirectory = join(outputDirectory, "brand-assets");
  const lockup = await readFile(
    join(brandDirectory, "lockup-primary-on-dark.svg"),
    "utf8",
  );
  const viewBox = lockup.match(/^<svg[^>]*\sviewBox="([^"]+)"/)?.[1];
  const wordmark = lockup.match(/<path data-wordmark-outline="flid"[^>]*\/>/)?.[0];
  if (!viewBox || !wordmark) {
    throw new Error("The primary lockup no longer contains an outlined wordmark.");
  }

  const mark = await sharp(join(brandDirectory, "mark-primary-on-dark.svg"), {
    density: 288,
  })
    .resize(144, 144)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  await writeFile(
    join(outputDirectory, "assets/images/site-lockup-on-dark.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Flid"><image href="data:image/webp;base64,${mark.toString("base64")}" x="0" y="0" width="100" height="100"/>${wordmark}</svg>\n`,
    "utf8",
  );
}

// ICO container with PNG-compressed entries (supported since Windows Vista and
// by every browser). Bitmap-based ICOs are ~4x larger for the same artwork.
export function encodePngIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // image type: icon
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(([size, png], index) => {
    const entry = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...images.map(([, png]) => png)]);
}

// Page icons are derived at build time from the approved mark's geometry with
// fewer, bolder strokes (see lib/site-icon.mjs). The canonical favicon and
// brand-assets downloads stay untouched; pages link these small variants.
export async function buildSiteIcons(outputDirectory) {
  const imageDirectory = join(outputDirectory, "assets/images");
  await mkdir(imageDirectory, { recursive: true });

  const favicon = generateSiteIconSvg({ preset: "favicon" });
  const touch = generateSiteIconSvg({ preset: "touch" });
  const render = (svg, size, opaque) => {
    const image = sharp(Buffer.from(svg), {
      density: Math.ceil((72 * size) / 100) * 2,
    }).resize(size, size);
    // Touch icons must be fully opaque: iOS fills transparency with black.
    return (opaque ? image.flatten({ background: "#0d1117" }) : image)
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  };

  const [icon16, icon32, icon48] = await Promise.all(
    [16, 32, 48].map((size) => render(favicon, size)),
  );
  const ico = encodePngIco([
    [16, icon16],
    [32, icon32],
    [48, icon48],
  ]);

  await Promise.all([
    writeFile(join(imageDirectory, "site-icon.svg"), `${favicon}\n`, "utf8"),
    writeFile(join(imageDirectory, "site-icon-32.png"), icon32),
    writeFile(join(imageDirectory, "site-icon.ico"), ico),
    // Browsers still probe /favicon.ico when a page declares no icon.
    writeFile(join(outputDirectory, "favicon.ico"), ico),
    ...[
      ["site-apple-touch-icon.png", 180],
      ["site-icon-192.png", 192],
      ["site-icon-512.png", 512],
    ].map(async ([name, size]) =>
      writeFile(join(imageDirectory, name), await render(touch, size, true)),
    ),
  ]);
}

// globals.css imports the Primer color primitives so authored source reads
// well, but a CSS @import serializes a second request behind the first
// stylesheet. Inline it in the build output.
export async function inlineGlobalStyles(outputDirectory) {
  const target = join(outputDirectory, "assets/globals.css");
  const importPattern = /@import\s+url\(["']?\/assets\/primer-primitives\.css["']?\);?\s*/;
  const [globals, primitives] = await Promise.all([
    readFile(target, "utf8"),
    readFile(join(outputDirectory, "assets/primer-primitives.css"), "utf8"),
  ]);
  if (!importPattern.test(globals)) {
    throw new Error("globals.css no longer imports primer-primitives.css.");
  }
  await writeFile(
    target,
    globals.replace(importPattern, () => `${primitives.trimEnd()}\n\n`),
    "utf8",
  );
}

// The logo showcase is rendered here instead of in the browser: each distinct mark is
// written once as a cacheable SVG file and the lockup markup is inlined into the page,
// so the page has content with the HTML and runs no script. Rendering lives in
// lib/showcase-markup.mjs.
export async function buildShowcase(outputDirectory) {
  const { injectShowcase, renderShowcase } = await import(
    "../lib/showcase-markup.mjs"
  );
  const { slots, files } = renderShowcase();
  const page = join(outputDirectory, "showcase/index.html");

  await writeFile(page, injectShowcase(await readFile(page, "utf8"), slots), "utf8");
  await Promise.all(
    [...files].map(async ([path, svg]) => {
      const target = join(outputDirectory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, svg, "utf8");
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await buildSite({ basePath: process.env.SITE_BASE_PATH ?? "" });
  console.log("Built static site in dist/");
}
