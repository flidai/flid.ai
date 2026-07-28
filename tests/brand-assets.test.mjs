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

  assert.equal(manifest.schemaVersion, 3);
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
  const [mark, lockup, archivedLockup] = await Promise.all([
    readBuilt("brand-assets/mark-primary-on-dark.svg"),
    readBuilt("brand-assets/lockup-primary-on-dark.svg"),
    readBuilt("brand-assets/lockup-essential-on-dark.svg"),
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
  assert.match(archivedLockup, /data-status="reference"/);
  assert.doesNotMatch(archivedLockup, /data-status="approved"/);
});

test("makes the guide consume generated assets instead of regenerating marks", async () => {
  const [html, script, home, brandSystemSource] = await Promise.all([
    readBuilt("brand/index.html"),
    readBuilt("assets/brand.js"),
    readBuilt("index.html"),
    readBuilt("lib/brand-system.mjs"),
  ]);

  assert.match(
    html,
    /src="\/brand-assets\/lockup-primary-on-dark\.svg"/,
  );
  assert.match(
    html,
    /src="\/brand-assets\/lockup-primary-on-light\.svg"/,
  );
  assert.doesNotMatch(html, /lockup-(?:essential|full)-on-/);
  assert.doesNotMatch(home, /lockup-(?:essential|full)-on-/);
  assert.match(html, /CANONICAL ASSET LIBRARY/);
  assert.match(html, /Never substitute another layer count/i);
  assert.doesNotMatch(html, /Switch to Essential/i);
  assert.match(script, /fetch\(["']\/brand-assets\/manifest\.json["']\)/);
  assert.match(script, /asset\.status === "approved"/);
  assert.doesNotMatch(script, /generateLogoSvg|data-brand-mark/);
  assert.doesNotMatch(brandSystemSource, /layers:\s*(?:8|16)/);
});

test("uses the 12-layer primary mark for every production asset", async () => {
  const manifest = JSON.parse(
    await readBuilt("brand-assets/manifest.json"),
  );
  const logoAssets = manifest.assets.filter(
    (asset) => asset.type === "mark" || asset.type === "lockup",
  );
  const approvedLogoAssets = logoAssets.filter(
    (asset) => asset.status === "approved",
  );
  const referenceLogoAssets = logoAssets.filter(
    (asset) => asset.status === "reference",
  );

  assert.ok(approvedLogoAssets.length > 0);
  assert.ok(referenceLogoAssets.length > 0);
  assert.deepEqual(
    new Set(approvedLogoAssets.map((asset) => asset.master)),
    new Set(["primary"]),
  );
  assert.ok(
    referenceLogoAssets.every(
      (asset) => asset.master === "essential" || asset.master === "full",
    ),
  );

  for (const type of ["icon", "social", "linkedin", "linkedin-logo"]) {
    const productionAssets = manifest.assets.filter((asset) => asset.type === type);
    assert.ok(productionAssets.length > 0, `manifest is missing ${type} assets`);
    assert.ok(
      productionAssets.every((asset) => asset.master === "primary"),
      `${type} assets must use the primary master`,
    );
  }
});
