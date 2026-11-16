import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readBuiltPage(pathname) {
  return readFile(new URL(`dist/${pathname}`, root), "utf8");
}

test("builds the interactive generator as plain HTML and JavaScript", async () => {
  const [html, script] = await Promise.all([
    readBuiltPage("generator/index.html"),
    readBuiltPage("assets/generator.js"),
  ]);

  assert.match(html, /<title>Signal Mark Generator — Flid<\/title>/i);
  assert.match(html, /Shape the signal/i);
  assert.match(html, /Full/);
  assert.match(html, /Primary/);
  assert.match(html, /Essential/);
  assert.match(html, /Export SVG/);
  assert.match(html, /135 MARKS/);
  assert.match(html, /Silhouette/);
  assert.match(script, /addEventListener/);
  assert.match(script, /generateLogoSvg/);
  assert.match(script, /downloadSvg/);
});

test("builds the logo showcase without an application framework", async () => {
  const [html, script] = await Promise.all([
    readBuiltPage("showcase/index.html"),
    readBuiltPage("assets/showcase.js"),
  ]);

  assert.match(html, /<title>Logo Showcase — Flid<\/title>/i);
  assert.match(html, /One identity\. Its design history/i);
  assert.match(html, /sole approved signature/i);
  assert.match(html, /WORDMARK STUDIES/i);
  assert.match(html, /REVERSE STUDIES/i);
  assert.match(html, /LOCKUP SCALE LADDER/i);
  assert.match(html, /Procedural signal identity · Odense/i);
  assert.doesNotMatch(html, /Copenhagen/i);
  assert.match(script, /logoVariations/);
  assert.match(script, /mode:\s*"line"/);
  assert.match(script, /layers:\s*12/);
  assert.match(script, /strokeWidth:\s*0\.58/);
  assert.match(script, /padding:\s*10/);
  assert.doesNotMatch(`${html}${script}`, /Next|React|jsx|tsx/);
});

test("builds a normative static brand guide with generator source", async () => {
  const [html, script, brandSystem] = await Promise.all([
    readBuiltPage("brand/index.html"),
    readBuiltPage("assets/brand.js"),
    readBuiltPage("lib/brand-system.mjs"),
  ]);

  assert.match(html, /<title>Brand Guide — Flid<\/title>/i);
  assert.match(html, /The source of truth for the Flid identity/i);
  assert.match(html, /APPROVED PRIMARY LOCKUP/i);
  assert.match(html, /RECOMMENDED MINIMUM/i);
  assert.match(html, /Never substitute another layer count/i);
  assert.match(html, /Flid AI ApS/i);
  assert.match(html, /Geist/i);
  assert.match(html, /Typeface approved/i);
  assert.match(html, /View full generator source/i);
  assert.match(script, /fetch\(["']\/lib\/logo-generator\.mjs["']\)/);
  assert.match(brandSystem, /legalName:\s*"Flid AI ApS"/);
  assert.match(brandSystem, /wordmark:\s*"flid"/);
  assert.match(brandSystem, /minimumDigitalSize:\s*64/);
});

test("keeps the public site and brand reference as distinct routes", async () => {
  const pages = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("brand/index.html"),
    readBuiltPage("showcase/index.html"),
    readBuiltPage("generator/index.html"),
  ]);

  assert.doesNotMatch(pages[0], /href="\/brand\/?"/);
  assert.match(pages[1], /Brand Guide — Flid/);
  assert.match(pages[2], /href="\/brand\/?"/);
  assert.match(pages[3], /href="\/brand\/?"/);
});

test("keeps responsive and reduced-motion styling on the identity tools", async () => {
  const [globalCss, showcaseCss, generatorCss, brandCss] = await Promise.all([
    readBuiltPage("assets/globals.css"),
    readBuiltPage("assets/showcase.css"),
    readBuiltPage("assets/generator.css"),
    readBuiltPage("assets/brand.css"),
  ]);

  for (const css of [globalCss, showcaseCss, generatorCss, brandCss]) {
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
  }
  assert.match(showcaseCss, /--lockup-mark-size:/);
  assert.match(generatorCss, /@media\s*\(max-width:\s*680px\)/);
});

test("keeps .ai out of visual wordmarks while preserving the domain", async () => {
  const pages = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("brand/index.html"),
    readBuiltPage("showcase/index.html"),
  ]);
  const combined = pages.join("\n");

  assert.doesNotMatch(combined, /class="[^"]*wordmark[^"]*"[^>]*>\s*flid\.ai/i);
  assert.match(combined, /flid\.ai/);
  assert.match(combined, /Flid AI ApS/);
});
