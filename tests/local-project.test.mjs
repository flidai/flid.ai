import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses a framework-free static-site lifecycle", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );

  assert.equal(packageJson.scripts.dev, "node scripts/server.mjs");
  assert.equal(packageJson.scripts.build, "node scripts/build.mjs");
  assert.equal(packageJson.scripts.start, "node scripts/server.mjs");
  assert.equal(
    packageJson.scripts.test,
    "npm run build && node --test tests/*.test.mjs",
  );
  assert.deepEqual(packageJson.dependencies, {});
  assert.equal(packageJson.devDependencies["opentype.js"], "1.3.4");
  assert.doesNotMatch(
    JSON.stringify(packageJson),
    /next|react|vite|tailwind|cloudflare|drizzle/i,
  );
});

test("contains no framework or hosted-site integration", async () => {
  const removedPaths = [
    ".openai/hosting.json",
    ".next",
    "next.config.ts",
    "next-env.d.ts",
    "postcss.config.mjs",
    "app/layout.tsx",
    "app/page.tsx",
    "app/showcase/page.tsx",
    "app/brand/page.tsx",
    "app/generator/page.tsx",
    "app/generator/LogoGenerator.tsx",
  ];

  for (const path of removedPaths) {
    await assert.rejects(access(new URL(path, root)));
  }
});

test("keeps the procedural identity independent and shared", async () => {
  const [showcase, brand, generator] = await Promise.all([
    readFile(new URL("site/assets/showcase.js", root), "utf8"),
    readFile(new URL("site/assets/brand.js", root), "utf8"),
    readFile(new URL("site/assets/generator.js", root), "utf8"),
  ]);

  for (const source of [showcase, generator]) {
    assert.match(source, /logo-generator\.mjs/);
    assert.doesNotMatch(source, /React|Next|jsx|tsx/);
  }
  assert.match(brand, /brand-assets\/manifest\.json/);
  assert.doesNotMatch(brand, /generateLogoSvg|React|Next|jsx|tsx/);
});

test("keeps the public site at the root and the brand guide as a reference", async () => {
  await access(new URL("site/brand/index.html", root));
  await access(new URL("site/assets/home.js", root));

  const [rootPage, homeScript] = await Promise.all([
    readFile(new URL("site/index.html", root), "utf8"),
    readFile(new URL("site/assets/home.js", root), "utf8"),
  ]);
  const brandPage = await readFile(
    new URL("site/brand/index.html", root),
    "utf8",
  );

  assert.match(rootPage, /We build products where agents do real work/i);
  assert.doesNotMatch(rootPage, /href="\/brand\/?"/);
  assert.doesNotMatch(rootPage, /id="leapview"|id="field-work"/i);
  assert.doesNotMatch(rootPage, /href="#leapview"|href="#field-work"/i);
  assert.doesNotMatch(homeScript, /hero-signal-field\.mjs/);
  assert.match(homeScript, /hero-scroll-transition\.mjs/);
  assert.match(homeScript, /signal-scroll-story\.mjs/);
  assert.doesNotMatch(homeScript, /React|Next|jsx|tsx/);
  assert.match(brandPage, /The source of truth for the Flid identity/i);
});
