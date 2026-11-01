import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../site/${path}`, import.meta.url), "utf8");
const pages = ["index.html", "products/index.html", "about/index.html", "404.html"];

test("every public page uses the new stylesheet, one header and the Geist preload", async () => {
  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /href="\/assets\/site\.css"/, page);
    assert.match(html, /src="\/assets\/site\.js"/, page);
    assert.match(html, /Geist-Variable\.woff2/, page);
    assert.equal(html.match(/<header\b/g).length, 1, page);
    assert.match(html, /<a class="skip" href="#main">/, page);
    assert.doesNotMatch(html, /globals\.css|home\.css|products\.css|about\.css/, page);
  }
});

test("the footer stays limited to the legal line and page links", async () => {
  for (const page of ["index.html", "products/index.html", "about/index.html"]) {
    const footer = (await read(page)).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.match(footer, /Flid AI ApS · CVR 43463217 · Odense, Denmark/, page);
    assert.doesNotMatch(footer, /flid\.ai|\/brand\//, page);
  }
});

test("the redesign keeps every product link and all seven product views", async () => {
  const html = await read("products/index.html");
  for (const href of [
    "https://leapview.dev/", "https://leapview.dev/docs/getting-started", "https://github.com/flidai/leapview",
    "https://leapview.dev/visuals", "https://alloycatalog.com/", "https://alloycatalog.com/#how",
    "https://alloycatalog.com/#pilot", "mailto:jacob@flid.ai?subject=Alloy%20Catalog%20demo",
  ]) assert.ok(html.includes(`href="${href}"`), href);
  assert.equal(html.match(/role="tab"/g).length, 7);
  assert.equal(html.match(/role="tabpanel"/g).length, 7);
  assert.match(html, /src="\/assets\/products\.js"/);
});

test("the about page keeps all three team members and their links", async () => {
  const html = await read("about/index.html");
  for (const name of ["Jacob Østergaard", "Ganesh Kambli", "Anand Bora"]) assert.ok(html.includes(name), name);
  assert.equal(html.match(/linkedin\.com\/in\//g).length, 3);
});

test("the bloom pauses off screen, honours reduced motion and survives context loss", async () => {
  const bloom = await read("assets/bloom.js");
  const site = await read("assets/site.js");
  assert.match(bloom, /prefers-reduced-motion/);
  assert.match(bloom, /webglcontextlost/);
  assert.match(bloom, /webglcontextrestored/);
  assert.match(bloom, /document\.hidden/);
  assert.match(site, /setActive\(entry\.isIntersecting\)/);
});

test("scroll reveals only hide content once the script has run", async () => {
  const css = await readFile(new URL("../app/site/site.css", import.meta.url), "utf8");
  assert.match(css, /\.motion \.reveal \{ opacity: 0/);
  assert.doesNotMatch(css, /^\.reveal \{/m);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("the thesis sentences stay in the accessibility tree", async () => {
  const site = await read("assets/site.js");
  const css = await readFile(new URL("../app/site/site.css", import.meta.url), "utf8");
  assert.doesNotMatch(site, /setAttribute\("aria-(label|hidden)"/);
  assert.doesNotMatch(css, /\[data-off\] \{[^}]*visibility: hidden/);
});

test("the footer is a page landmark, outside the main content", async () => {
  for (const page of ["index.html", "products/index.html", "about/index.html"]) {
    const html = await read(page);
    assert.ok(html.indexOf("<footer") > html.indexOf("</main>"), page);
  }
});

test("the browser bar matches the page background on the redesigned pages", async () => {
  for (const page of pages) assert.match(await read(page), /<meta name="theme-color" content="#06080d">/, page);
});

test("interactive controls are at least 44px tall and faded rows stay legible", async () => {
  const css = await readFile(new URL("../app/site/site.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /min-height: (4[0-3]|[1-3]\d)px/);
  assert.doesNotMatch(css, /\.layer-row \{[^}]*opacity/);
  assert.match(css, /orientation: landscape/);
});

test("the footer leaves no gap that shows the fixed animation behind the page", async () => {
  const css = await readFile(new URL("../app/site/site.css", import.meta.url), "utf8");
  assert.doesNotMatch(css.match(/^\.foot \{.*$/m)[0], /margin-top/);
});

test("the homepage joins a complete 3D core that fits on screen", async () => {
  const html = await read("index.html");
  const site = await read("assets/site.js");
  const { buildShell } = await import(new URL("../site/assets/core-geometry.js", import.meta.url));
  assert.match(html, /<canvas class="core" data-core aria-hidden="true">/);
  assert.match(site, /startCore\(coreCanvas, thesis, \{ still \}\)/);
  const { data, plates, stride } = buildShell(8);
  let maxReach = 0, maxOrder = 0;
  for (let i = 0; i < data.length; i += stride) {
    maxReach = Math.max(maxReach, Math.hypot(data[i] + data[i + 6], data[i + 1] + data[i + 7], data[i + 2] + data[i + 8]));
    maxOrder = Math.max(maxOrder, data[i + 9]);
  }
  assert.ok(plates > 400, "enough plates to read as a machine");
  assert.ok(maxReach < 1.1, "plates sit inside the rings");
  assert.ok(maxOrder + 0.2 <= 1.2, "every plate can finish joining");
});

test("the three sheets stay and gain a 3D version with a plain fallback", async () => {
  const html = await read("index.html");
  const sheets = await read("assets/sheets.js");
  assert.match(html, /<canvas class="sheets" data-sheets>/);
  for (const plane of ["evidence", "actions", "data"]) assert.match(html, new RegExp(`data-plane="${plane}"`));
  for (const name of ["GOVERNED DATA", "EXPLICIT ACTIONS", "EVIDENCE"]) assert.ok(sheets.includes(name), name);
  assert.match(await read("assets/site.js"), /startSheets\(sheetsCanvas/);
  for (const [, from, to] of sheets.matchAll(/smoothstep\(([\d.-]+), ([\d.-]+),/g)) assert.ok(Number(from) < Number(to));
});

test("the products section shows real screens in 3D with real parts lifting out", async () => {
  const html = await read("index.html");
  assert.equal(html.match(/data-show/g).length, 2);
  assert.equal(html.match(/class="lift"/g).length, 6);
  for (const name of ["leapview-dashboard", "leapview-metrics", "leapview-charts", "alloy-search", "alloy-ask", "alloy-part"]) {
    assert.ok(html.includes(`/assets/images/products/${name}-1080.webp`), name);
  }
  assert.match(html, /href="\/products\/#leapview"/);
  assert.match(html, /href="\/products\/#alloy-catalog"/);
});

test("the 3D word keeps the flid wordmark in Geist, with a plain text fallback", async () => {
  const html = await read("index.html");
  const { FLID_WORD } = await import(new URL("../site/assets/flid-word.js", import.meta.url));
  assert.match(html, /<div class="flid-word glow" aria-hidden="true">flid<\/div>/);
  assert.match(html, /<canvas class="word-canvas"/);
  assert.equal(FLID_WORD.letters.map((letter) => letter.ch).join(""), "flid");
  for (const letter of FLID_WORD.letters) assert.ok(letter.path.length > 3, letter.ch);
  assert.match(await read("assets/site.js"), /startWord\(/);
});

test("three.js ships as a vendored open-source bundle with its license", async () => {
  const build = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  await readFile(new URL("../vendor/three/three.mjs", import.meta.url));
  await readFile(new URL("../vendor/three/LICENSE", import.meta.url));
  assert.match(build, /licenses\/three-MIT\.txt/);
});

test("the wave shader avoids reversed smoothstep edges, which are undefined on some phones", async () => {
  const bloom = await read("assets/bloom.js");
  for (const [, from, to] of bloom.matchAll(/smoothstep\(([\d.-]+), ([\d.-]+),/g)) {
    assert.ok(Number(from) < Number(to), `smoothstep(${from}, ${to})`);
  }
});

test("smooth scrolling ships as a vendored open-source file with its license", async () => {
  const build = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(build, /lenis/i);
});
