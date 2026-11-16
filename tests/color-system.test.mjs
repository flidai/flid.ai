import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(pathname) {
  return readFile(new URL(pathname, root), "utf8");
}

test("vendors a documented Primer primitives color subset", async () => {
  const [tokens, globals] = await Promise.all([
    read("site/assets/primer-primitives.css"),
    read("app/globals.css"),
  ]);

  assert.match(tokens, /@primer\/primitives v11\.9\.0/);
  assert.match(tokens, /--bgColor-default:\s*#0d1117/);
  assert.match(tokens, /--fgColor-default:\s*#f0f6fc/);
  assert.match(tokens, /--fgColor-muted:\s*#9198a1/);
  assert.match(tokens, /--borderColor-default:\s*#3d444d/);
  assert.match(tokens, /--fgColor-accent:\s*#4493f8/);
  assert.match(tokens, /\[data-color-mode="light"\]/);

  assert.match(globals, /@import url\("\/assets\/primer-primitives\.css"\)/);
  assert.match(globals, /--ink:\s*var\(--bgColor-default\)/);
  assert.match(globals, /--paper:\s*var\(--fgColor-default\)/);
  assert.match(globals, /--accent:\s*var\(--fgColor-accent\)/);
});

test("keeps generator and brand metadata on the Primer palette", async () => {
  const [generator, brand, palette] = await Promise.all([
    read("lib/logo-generator.mjs"),
    read("lib/brand-system.mjs"),
    read("lib/primer-colors.mjs"),
  ]);

  assert.match(generator, /foreground:\s*primerColors\.dark\.foreground/);
  assert.match(generator, /accent:\s*primerColors\.dark\.accent/);
  assert.doesNotMatch(generator, /#f0f1e9|#44e3ff/i);

  assert.match(brand, /source:\s*"@primer\/primitives"/);
  assert.match(brand, /token:\s*"--bgColor-default"/);
  assert.match(brand, /token:\s*"--fgColor-accent"/);
  assert.doesNotMatch(brand, /#080b0c|#f0f1e9|#44e3ff/i);

  assert.match(palette, /canvas:\s*"#0d1117"/);
  assert.match(palette, /foreground:\s*"#f0f6fc"/);
  assert.match(palette, /accent:\s*"#4493f8"/);
  assert.match(palette, /foreground:\s*"#1f2328"/);
});

test("ships the shared Primer palette with the static build", async () => {
  const builtPalette = await read("dist/lib/primer-colors.mjs");

  assert.match(builtPalette, /export const primerColors/);
});

test("defines public site colours only as theme tokens", async () => {
  const site = await read("app/site.css");
  // Colours live in the light and dark theme blocks; components use tokens.
  const themeBlocks = [...site.matchAll(/(?::root,\n:root\[data-theme="light"\]|:root:not\(\[data-theme="light"\]\)|:root\[data-theme="dark"\]) \{[^}]*\}/g)]
    .map(([block]) => block);
  assert.equal(themeBlocks.length, 3);

  let outside = site;
  for (const block of themeBlocks) outside = outside.replace(block, "");
  assert.doesNotMatch(outside, /#[0-9a-f]{3,8}\b|rgb\(/i, "colour outside the theme blocks");

  const tokens = (block) => [...block.matchAll(/(--[a-z-]+):/g)].map(([, name]) => name).sort();
  assert.deepEqual(tokens(themeBlocks[1]), tokens(themeBlocks[0]), "dark defines every light token");
  assert.deepEqual(tokens(themeBlocks[2]), tokens(themeBlocks[0]), "chosen dark defines every light token");
  const body = (block) => block.replace(/^[^{]+/, "").replace(/\s+/g, " ");
  assert.equal(body(themeBlocks[1]), body(themeBlocks[2]), "system dark and chosen dark match");
});
