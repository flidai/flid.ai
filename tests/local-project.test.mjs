import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses a framework-free static-site lifecycle", async () => {
  const [packageSource, taskfile, serverSource, goModule] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("Taskfile.yml", root), "utf8"),
    readFile(new URL("cmd/devserver/main.go", root), "utf8"),
    readFile(new URL("go.mod", root), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.scripts.dev, "task dev");
  assert.equal(packageJson.scripts.build, "node scripts/build.mjs");
  assert.equal(packageJson.scripts.start, "task dev");
  assert.equal(
    packageJson.scripts.test,
    "npm run build && node --test tests/*.test.mjs && go test ./...",
  );
  assert.match(taskfile, /dev:[\s\S]*deps:\s*\[build\][\s\S]*go run \.\/cmd\/devserver/i);
  assert.match(serverSource, /http\.Server|ListenAndServe/);
  assert.match(goModule, /module flid\.ai\/site/);
  await assert.rejects(access(new URL("scripts/server.mjs", root)));
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
  for (const page of [
    "site/index.html",
    "site/products/index.html",
    "site/products/leapview/index.html",
    "site/products/alloy-catalog/index.html",
    "site/services/index.html",
    "site/cases/index.html",
    "site/about/index.html",
    "site/contact/index.html",
    "site/404.html",
    "site/brand/index.html",
    "site/design-system/index.html",
  ]) {
    await access(new URL(page, root));
  }

  const brandPage = await readFile(new URL("site/brand/index.html", root), "utf8");
  assert.match(brandPage, /The source of truth for the Flid identity/i);
});

test("ships no scroll-driven hero, depth video or WebGL code", async () => {
  for (const path of [
    "site/assets/home.js",
    "site/assets/depth-reference/depth-story.mp4",
    "lib/depth-video-story.mjs",
    "lib/hero-scroll-transition.mjs",
    "lib/hero-signal-field.mjs",
    "lib/signal-scroll-story.mjs",
    "research/datacurve",
    "design-qa.md",
  ]) {
    await assert.rejects(access(new URL(path, root)), `${path} should be removed`);
  }
});
