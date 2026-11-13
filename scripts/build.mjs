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
  ["app/site.css", "assets/site.css"],
  ["app/globals.css", "assets/globals.css"],
  ["app/home/home.css", "assets/home.css"],
  ["app/products/products.css", "assets/products.css"],
  ["app/about/about.css", "assets/about.css"],
  ["app/showcase/showcase.css", "assets/showcase.css"],
  ["app/generator/generator.css", "assets/generator.css"],
  ["app/brand/brand.css", "assets/brand.css"],
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
    .replace(/url\(\/(?!\/)/g, `url(${normalized}/`);
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

// Header lockups: the approved primary lockup, rasterised small so the header
// does not carry the 180 KB vector master on every page.
export const headerLockupHeight = 64;

async function buildHeaderLockups(directory) {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    ["light", "dark"].map((mode) =>
      sharp(join(root, `brand-assets/png/lockup-primary-on-${mode}@4x.png`))
        .resize({ height: headerLockupHeight })
        .webp({ quality: 90, effort: 6 })
        .toFile(join(directory, `flid-lockup-${mode}.webp`)),
    ),
  );
}

// Product screenshots: PNG masters in product-screenshots/ become AVIF and
// WebP at two widths. Pages reference <name>-<width>.<format>.
export const screenshotWidths = [640, 1280];

async function buildScreenshots(directory) {
  await mkdir(directory, { recursive: true });
  const sources = (await readdir(join(root, "product-screenshots"))).filter(
    (name) => name.endsWith(".png"),
  );
  await Promise.all(
    sources.flatMap((name) =>
      screenshotWidths.flatMap((width) => {
        const base = join(directory, `${name.slice(0, -4)}-${width}`);
        const image = () =>
          sharp(join(root, "product-screenshots", name)).resize({
            width,
            withoutEnlargement: true,
          });
        return [
          image().avif({ quality: 60, effort: 6 }).toFile(`${base}.avif`),
          image().webp({ quality: 82, effort: 6 }).toFile(`${base}.webp`),
        ];
      }),
    ),
  );
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

  await buildHeaderLockups(join(outputDirectory, "assets/images"));
  await buildScreenshots(join(outputDirectory, "assets/screenshots"));
  await generateBrandAssets(join(outputDirectory, "brand-assets"));
  await applyBasePath(outputDirectory, basePath);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await buildSite({ basePath: process.env.SITE_BASE_PATH ?? "" });
  console.log("Built static site in dist/");
}
