import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { prefixSitePaths } from "../scripts/build.mjs";

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
  assert.equal(prefixSitePaths('href="/assets/site.css"', ""), 'href="/assets/site.css"');
});

test("provides an official artifact-based GitHub Pages workflow", async () => {
  const workflow = await readFile(
    new URL(".github/workflows/pages.yml", root),
    "utf8",
  );

  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /SITE_BASE_PATH:.*base_path/);
  assert.match(workflow, /path:\s*dist/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
});
