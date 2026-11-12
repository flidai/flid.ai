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
  await access(new URL("site/brand/index.html", root));
  await access(new URL("site/products/index.html", root));
  await access(new URL("site/about/index.html", root));
  await access(new URL("site/assets/home.js", root));

  const [rootPage, homeScript, productsPage, aboutPage] = await Promise.all([
    readFile(new URL("site/index.html", root), "utf8"),
    readFile(new URL("site/assets/home.js", root), "utf8"),
    readFile(new URL("site/products/index.html", root), "utf8"),
    readFile(new URL("site/about/index.html", root), "utf8"),
  ]);
  const brandPage = await readFile(
    new URL("site/brand/index.html", root),
    "utf8",
  );

  assert.match(rootPage, /We build products where agents do real work/i);
  assert.doesNotMatch(rootPage, /01 \/ Thesis|01 \/ Premise|02 \/ Foundation|04 \/ The lab/i);
  assert.doesNotMatch(rootPage, /data-story-counter|signal-story-progress/i);
  assert.doesNotMatch(rootPage, /data-color-mode="light"|id="contact"|05 \/ Contact/i);
  assert.doesNotMatch(rootPage, /href="\/brand\/?"/);
  assert.match(rootPage, /href="\/products\/"[^>]*>Products\s*</i);
  assert.match(rootPage, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(rootPage, /mailto:jacob@flid\.ai/);
  assert.match(rootPage, /Start a conversation/);
  assert.match(rootPage, /Jacob Østergaard/);
  assert.doesNotMatch(rootPage, /Ganesh Kambli|Meet the team/);
  assert.match(productsPage, /LeapView/);
  assert.match(productsPage, /href="\/products\/"[^>]*>Products\s*</i);
  assert.match(productsPage, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(aboutPage, /A Danish product lab building\s*<span>durable systems\.<\/span>/i);
  assert.match(aboutPage, /Ganesh Kambli/);
  assert.match(aboutPage, /Anand Bora/);
  assert.match(aboutPage, /AI Engineer/);
  assert.doesNotMatch(rootPage, /id="leapview"|id="field-work"/i);
  assert.doesNotMatch(rootPage, /href="#leapview"|href="#field-work"/i);
  assert.doesNotMatch(homeScript, /hero-signal-field\.mjs/);
  assert.match(homeScript, /hero-scroll-transition\.mjs/);
  assert.match(homeScript, /signal-scroll-story\.mjs/);
  assert.doesNotMatch(homeScript, /React|Next|jsx|tsx/);
  assert.match(brandPage, /The source of truth for the Flid identity/i);
});
