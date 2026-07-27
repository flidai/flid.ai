import {
  copyFile,
  cp,
  mkdir,
  rm,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateBrandAssets } from "./generate-brand-assets.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");

const copiedFiles = [
  ["app/globals.css", "assets/globals.css"],
  ["app/showcase/showcase.css", "assets/showcase.css"],
  ["app/generator/generator.css", "assets/generator.css"],
  ["app/brand/brand.css", "assets/brand.css"],
  ["lib/logo-generator.mjs", "lib/logo-generator.mjs"],
  ["lib/brand-system.mjs", "lib/brand-system.mjs"],
  ["lib/primer-colors.mjs", "lib/primer-colors.mjs"],
  ["lib/wordmark-generator.mjs", "lib/wordmark-generator.mjs"],
  ["vendor/geist/LICENSE.txt", "licenses/geist-OFL-1.1.txt"],
];

export async function buildSite() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(join(root, "site"), output, { recursive: true });

  for (const [source, destination] of copiedFiles) {
    const target = join(output, destination);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, source), target);
  }

  await generateBrandAssets(join(output, "brand-assets"));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await buildSite();
  console.log("Built static site in dist/");
}
