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
  ["app/globals.css", "assets/globals.css"],
  ["app/home/home.css", "assets/home.css"],
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

const omittedSiteFiles = [
  "assets/images/leapview-dashboard-dark.png",
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

export async function buildSite({
  outputDirectory = output,
  basePath = "",
  depthMediaDirectory,
} = {}) {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(join(root, "site"), outputDirectory, { recursive: true });
  await Promise.all(
    omittedSiteFiles.map((pathname) =>
      rm(join(outputDirectory, pathname), { force: true })
    ),
  );

  const homePage = join(outputDirectory, "index.html");
  if (depthMediaDirectory) {
    const depthOutput = join(outputDirectory, "assets/depth-reference");
    await mkdir(depthOutput, { recursive: true });
    const filename = "depth-story.mp4";
    await copyFile(
      join(depthMediaDirectory, filename),
      join(depthOutput, filename),
    );
    const html = await readFile(homePage, "utf8");
    await writeFile(
      homePage,
      html.replace('data-depth-demo="disabled"', 'data-depth-demo="local"'),
      "utf8",
    );
  }

  for (const [source, destination] of copiedFiles) {
    const target = join(outputDirectory, destination);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, source), target);
  }

  const portraitTarget = join(
    outputDirectory,
    "assets/images/jacob-oestergaard.webp",
  );
  await mkdir(dirname(portraitTarget), { recursive: true });
  await sharp(join(root, "Jacob Østergaard 1.png"))
    .resize(960, 960, { fit: "cover", position: "center" })
    .webp({ quality: 82, effort: 4 })
    .toFile(portraitTarget);

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
