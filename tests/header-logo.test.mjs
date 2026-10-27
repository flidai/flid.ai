import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const built = (path) => new URL(`dist/${path}`, root);

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
