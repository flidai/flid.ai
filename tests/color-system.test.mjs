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

test("uses only Primer colours in the public site stylesheet", async () => {
  const [site, palette, primitives] = await Promise.all([
    read("app/site.css"),
    read("lib/primer-colors.mjs"),
    read("site/assets/primer-primitives.css"),
  ]);
  // Primer 11.9.0 values the site adds to the brand subset: text on the
  // emphasis background, and the hover shade of the primary button.
  const additions = ["#ffffff", "#0550ae", "#1158c7"];
  const allowed = new Set(
    [...`${palette}${primitives}`.matchAll(/#[0-9a-f]{6}\b/gi)]
      .map(([hex]) => hex.toLowerCase())
      .concat(additions),
  );

  const used = [...site.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([hex]) => hex.toLowerCase());
  assert.ok(used.length > 0);
  for (const hex of used) {
    assert.ok(allowed.has(hex), `${hex} is not a Primer colour`);
  }
  assert.match(site, /@media \(prefers-color-scheme: dark\)/);
  for (const token of [
    "--bgColor-default",
    "--fgColor-default",
    "--fgColor-muted",
    "--fgColor-accent",
    "--borderColor-default",
    "--bgColor-accent-emphasis",
    "--focus-outlineColor",
  ]) {
    assert.match(site, new RegExp(`var\\(${token}\\)`));
  }
});
