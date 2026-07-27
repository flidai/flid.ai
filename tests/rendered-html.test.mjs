import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Flid landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Flid — Data &amp; AI<\/title>/i);
  assert.match(html, /Turn complex data into clear decisions/i);
  assert.match(html, /Data foundations/i);
  assert.match(html, /Applied AI/i);
  assert.match(html, /Decision systems/i);
  assert.match(html, /mailto:hello@flid\.ai/i);
  assert.match(html, /aria-label="Flid home"/i);
  assert.match(html, /aria-hidden="true"/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("uses the supplied logo and removes disposable starter UI", async () => {
  const [page, layout, css, packageJson, logo] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../logo.txt", import.meta.url), "utf8"),
  ]);

  assert.match(page, /logo\.txt\?raw/);
  assert.match(page, /dangerouslySetInnerHTML/);
  assert.match(layout, /Flid — Data & AI/);
  assert.match(layout, /Data systems and AI products built for real-world use/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(logo, /^<svg viewBox="0 0 100 100"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("../app/_sites-preview", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
});
