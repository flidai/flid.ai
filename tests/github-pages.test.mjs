import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildSite, encodePngIco, prefixSitePaths } from "../scripts/build.mjs";

const root = new URL("../", import.meta.url);

test("prefixes root-relative static URLs for project Pages deployments", () => {
  const basePath = "/flid";

  assert.equal(
    prefixSitePaths('<link href="/assets/site.css"><a href="/showcase">', basePath),
    '<link href="/flid/assets/site.css"><a href="/flid/showcase">',
  );
  assert.equal(
    prefixSitePaths('background:url("/brand-assets/mark.svg")', basePath),
    'background:url("/flid/brand-assets/mark.svg")',
  );
  assert.equal(
    prefixSitePaths('fetch("/brand-assets/manifest.json")', basePath),
    'fetch("/flid/brand-assets/manifest.json")',
  );
  assert.equal(
    prefixSitePaths('{"path":"/brand-assets/mark.svg"}', basePath),
    '{"path":"/flid/brand-assets/mark.svg"}',
  );
  assert.equal(
    prefixSitePaths('<img src="/a/one.webp" srcset="/a/one.webp 800w, /a/two.webp 1440w" sizes="100vw">', basePath),
    '<img src="/flid/a/one.webp" srcset="/flid/a/one.webp 800w, /flid/a/two.webp 1440w" sizes="100vw">',
  );
  assert.equal(prefixSitePaths('href="/assets/site.css"', ""), 'href="/assets/site.css"');
});

test("provides an official artifact-based GitHub Pages workflow", async () => {
  const workflow = await readFile(
    new URL(".github/workflows/pages.yml", root),
    "utf8",
  );

  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /enablement:\s*true/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.doesNotMatch(workflow, /SITE_BASE_PATH/);
  assert.match(workflow, /run:\s*npm run build/);
  assert.match(workflow, /path:\s*dist/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
});

test("builds 404, robots, sitemap, manifest, and icons for a project Pages base path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flid-pages-"));
  try {
    await buildSite({ outputDirectory: directory, basePath: "/flid" });
    const read = (path) => readFile(join(directory, path), "utf8");
    const [notFound, products, manifest, robots, sitemap, globals] = await Promise.all([
      read("404.html"),
      read("products/index.html"),
      read("site.webmanifest"),
      read("robots.txt"),
      read("sitemap.xml"),
      read("assets/globals.css"),
    ]);

    assert.match(notFound, /<link rel="stylesheet" href="\/flid\/assets\/globals\.css">/);
    assert.match(notFound, /class="product-link" href="\/flid\/products\/"/);
    assert.match(notFound, /<link rel="icon" href="\/flid\/assets\/images\/site-icon\.svg"/);
    assert.match(notFound, /<link rel="preload" href="\/flid\/assets\/fonts\/Geist-Variable\.woff2"/);
    assert.match(products, /<a class="skip-link" href="#main">/, "the skip link stays a fragment link");

    const parsed = JSON.parse(manifest);
    assert.equal(parsed.id, "/flid/");
    assert.equal(parsed.start_url, "/flid/");
    assert.equal(parsed.scope, "/flid/");
    assert.ok(parsed.icons.every((icon) => icon.src.startsWith("/flid/assets/images/")));

    assert.match(robots, /Sitemap: https:\/\/flid\.ai\/sitemap\.xml/, "absolute URLs are never prefixed");
    assert.match(sitemap, /<loc>https:\/\/flid\.ai\/about\/<\/loc>/);
    assert.doesNotMatch(globals, /@import/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("encodes PNG-compressed ICO files browsers can read", () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const ico = encodePngIco([
    [16, png],
    [256, png],
  ]);

  assert.deepEqual([...ico.subarray(0, 6)], [0, 0, 1, 0, 2, 0]);
  assert.equal(ico[6], 16, "16px entry width");
  assert.equal(ico[22], 0, "256px entries encode their size as 0");
  assert.equal(ico.readUInt32LE(14), png.length);
  assert.equal(ico.readUInt32LE(18), 38, "first image follows the header and two directory entries");
  assert.equal(ico.length, 38 + png.length * 2);
});
