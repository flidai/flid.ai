import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = new URL("../", import.meta.url);
// FLID_DIST points the suite at a build in another directory (preview builds).
const dist = process.env.FLID_DIST
  ? pathToFileURL(`${process.env.FLID_DIST.replace(/\/$/, "")}/`)
  : new URL("dist/", root);
const built = (path) => new URL(path, dist);

test("ships lightweight header logos derived from the canonical lockup", async () => {
  const [wordmark, lockup, mark] = await Promise.all([
    readFile(built("assets/images/site-wordmark-on-dark.svg"), "utf8"),
    readFile(built("brand-assets/lockup-primary-on-dark.svg"), "utf8"),
    stat(built("assets/images/site-mark-on-dark.webp")),
  ]);
  const canonicalWordmark = lockup.match(/<path data-wordmark-outline="flid"[^>]*\/>/)?.[0];

  assert.ok(canonicalWordmark, "the lockup must contain the outlined wordmark");
  assert.ok(wordmark.includes(canonicalWordmark), "the header wordmark must be the canonical outline");
  assert.match(wordmark, /viewBox="0 0 232 100"/);
  assert.doesNotMatch(wordmark, /data-curve-outline/, "the header wordmark must not carry the mark outlines");
  assert.ok(wordmark.length < 8_000, `header wordmark is ${wordmark.length} bytes`);
  assert.ok(mark.size > 0 && mark.size < 40_000, `header mark is ${mark.size} bytes`);
});

test("does not load the full-outline brand SVGs in page headers", async () => {
  for (const page of ["index.html", "products/index.html", "about/index.html"]) {
    const html = await readFile(built(page), "utf8");
    const header = html.match(/<header class="[^"]*header[^"]*">[\s\S]*?<\/header>/)?.[0] ?? "";
    assert.ok(header, `${page} must have a site header`);
    assert.doesNotMatch(header, /brand-assets\/(?:lockup|mark)-primary-on-dark\.svg/, page);
  }
});

test("derives the footer lockup from the canonical outlines without the 134 hairline paths", async () => {
  const [footerLockup, lockup] = await Promise.all([
    readFile(built("assets/images/site-lockup-on-dark.svg"), "utf8"),
    readFile(built("brand-assets/lockup-primary-on-dark.svg"), "utf8"),
  ]);
  const canonicalWordmark = lockup.match(/<path data-wordmark-outline="flid"[^>]*\/>/)?.[0];

  assert.ok(footerLockup.includes(canonicalWordmark), "the footer wordmark must be the canonical outline");
  assert.match(footerLockup, /viewBox="0 0 232 100"/);
  assert.match(footerLockup, /<image href="data:image\/webp;base64,/);
  assert.doesNotMatch(footerLockup, /data-curve-outline/);
  assert.ok(footerLockup.length < 25_000, `footer lockup is ${footerLockup.length} bytes`);
  assert.ok(lockup.length > 100_000, "the canonical lockup stays untouched for downloads");
});

test("does not load the full-outline brand SVGs anywhere on the public pages", async () => {
  for (const page of ["index.html", "products/index.html", "about/index.html", "404.html"]) {
    const html = await readFile(built(page), "utf8");
    assert.doesNotMatch(html, /brand-assets\/(?:lockup|mark)-[a-z]+-on-(?:dark|light)\.svg/, page);
    assert.doesNotMatch(html, /brand-assets\/favicon/, page);
  }
});
