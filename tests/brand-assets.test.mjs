import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readBuilt(pathname) {
  return readFile(new URL(`dist/${pathname}`, root), "utf8");
}

test("builds a versioned canonical brand asset library", async () => {
  const manifest = JSON.parse(
    await readBuilt("brand-assets/manifest.json"),
  );

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.brand, "Flid");
  assert.equal(manifest.source.generator, "/lib/logo-generator.mjs");
  assert.equal(manifest.source.specification, "/lib/brand-system.mjs");
  assert.equal(manifest.lockup.wordmarkStatus, "approved");
  assert.equal(manifest.lockup.typeface.family, "Geist");
  assert.equal(manifest.lockup.typeface.weight, 600);
  assert.equal(manifest.lockup.typeface.version, "1.7.2");
  assert.equal(manifest.lockup.typeface.format, "vector outlines");
  assert.equal(manifest.lockup.gapRatio, 0.2);

  const paths = new Set(manifest.assets.map((asset) => asset.path));
  for (const path of [
    "/brand-assets/mark-essential-on-dark.svg",
    "/brand-assets/mark-primary-on-dark.svg",
    "/brand-assets/mark-primary-on-light.svg",
    "/brand-assets/mark-full-on-dark.svg",
    "/brand-assets/lockup-essential-on-dark.svg",
    "/brand-assets/lockup-primary-on-dark.svg",
    "/brand-assets/lockup-primary-on-light.svg",
    "/brand-assets/favicon.svg",
  ]) {
    assert.ok(paths.has(path), `manifest is missing ${path}`);
    assert.match(await readBuilt(path.slice(1)), /^<svg/);
  }
});

test("exports approved Geist lockups as portable vector outlines", async () => {
  const [mark, lockup] = await Promise.all([
    readBuilt("brand-assets/mark-primary-on-dark.svg"),
    readBuilt("brand-assets/lockup-primary-on-dark.svg"),
  ]);

  assert.match(mark, /viewBox="0 0 100 100"/);
  assert.match(mark, /135|134 curved signal marks/);
  assert.doesNotMatch(mark, /<text|font-family/);

  assert.match(lockup, /data-status="approved"/);
  assert.match(lockup, /data-gap-ratio="0\.2"/);
  assert.match(lockup, /data-wordmark-typeface="Geist"/);
  assert.match(lockup, /data-wordmark-weight="600"/);
  assert.match(lockup, /<path[^>]+data-wordmark-outline/);
  assert.doesNotMatch(lockup, /<text|font-family|textLength/);
});

test("makes the guide consume generated assets instead of regenerating marks", async () => {
  const [html, script] = await Promise.all([
    readBuilt("index.html"),
    readBuilt("assets/brand.js"),
  ]);

  assert.match(
    html,
    /src="\/brand-assets\/lockup-primary-on-dark\.svg"/,
  );
  assert.match(
    html,
    /src="\/brand-assets\/lockup-primary-on-light\.svg"/,
  );
  assert.match(
    html,
    /src="\/brand-assets\/lockup-essential-on-dark\.svg"/,
  );
  assert.match(html, /CANONICAL ASSET LIBRARY/);
  assert.match(script, /fetch\(["']\/brand-assets\/manifest\.json["']\)/);
  assert.doesNotMatch(script, /generateLogoSvg|data-brand-mark/);
});
