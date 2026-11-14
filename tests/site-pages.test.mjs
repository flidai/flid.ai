import assert from "node:assert/strict";
import { access, readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const origin = "https://flid.ai";
const contactAddress = "hello@flid.ai";

// Public pages: in navigation and the sitemap.
const pages = [
  ["/", "index.html"],
  ["/products/", "products/index.html"],
  ["/products/alloy-catalog/", "products/alloy-catalog/index.html"],
  ["/products/leapview/", "products/leapview/index.html"],
  ["/services/", "services/index.html"],
  ["/cases/", "cases/index.html"],
  ["/about/", "about/index.html"],
  ["/contact/", "contact/index.html"],
];
const allPages = [...pages, ["/404.html", "404.html"]];

const banned = [
  /!/,
  /\bseamless/i,
  /\bpowerful/i,
  /cutting-edge/i,
  /world-class/i,
  /best-in-class/i,
  /revolutionary/i,
  /agent-native/i,
  /\binsights?\b/i,
  /learn more/i,
  /click here/i,
];

async function built(file) {
  return readFile(new URL(file, dist), "utf8");
}

function region(html, pattern) {
  return html.match(pattern)?.[0] ?? "";
}

function visibleText(html) {
  return html
    .replace(/<!doctype[^>]*>/i, "")
    .replace(/<head>[\s\S]*?<\/head>/i, "")
    .replace(/<(script|style|pre)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
}

function meta(html, attribute, name) {
  const pattern = new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`);
  return html.match(pattern)?.[1];
}

for (const [path, file] of allPages) {
  test(`${path} has the shared head, landmarks and one h1`, async () => {
    const html = await built(file);

    assert.match(html, /^<!doctype html>\n<html lang="en">/);
    assert.match(html, /<title>[^<]+ — Flid<\/title>|<title>Flid — [^<]+<\/title>/);
    const description = meta(html, "name", "description");
    assert.ok(description && description.length >= 50 && description.length <= 170, `description length on ${path}`);
    if (path !== "/404.html") {
      assert.match(html, new RegExp(`<link rel="canonical" href="${origin}${path}">`));
    }
    assert.equal(meta(html, "property", "og:url"), `${origin}${path}`);
    assert.equal(meta(html, "property", "og:title"), html.match(/<title>([^<]+)<\/title>/)[1]);
    assert.equal(meta(html, "property", "og:description"), description);
    assert.equal(meta(html, "property", "og:image"), `${origin}/brand-assets/social/share-light-1200x630.png`);
    assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
    assert.equal(meta(html, "name", "twitter:image"), `${origin}/brand-assets/social/share-light-1200x630.png`);
    assert.match(html, /<link rel="manifest" href="\/brand-assets\/favicon\/site\.webmanifest">/);
    assert.match(html, /<link rel="preload" href="\/assets\/fonts\/Geist-Variable\.woff2" as="font" type="font\/woff2" crossorigin>/);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/site\.css">/);
    assert.equal((html.match(/<link rel="stylesheet"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /favicon\.svg|lockup-primary-on-(dark|light)\.svg|mark-primary/);

    // The only scripts: the theme initialiser in <head> and the theme module.
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    assert.deepEqual(scripts, ["<script>", '<script type="module" src="/assets/theme.js">']);
    assert.match(html, /<script>try\{var t=localStorage\.getItem\("theme"\);[^<]{0,160}<\/script>/);
    assert.doesNotMatch(html, /<script[^>]+src="https?:/);
    assert.match(html, /<button class="theme-switch" type="button" data-theme-switch data-requires-js hidden aria-label="Switch theme">/);
    assert.doesNotMatch(html, /<iframe\b|<canvas\b|<video\b/i);

    assert.match(html, /<body>\n {4}<a class="skip-link" href="#main">Skip to content<\/a>/);
    assert.equal((html.match(/<main id="main">/g) ?? []).length, 1);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /<nav class="site-nav" aria-label="Main">/);
    assert.match(html, /<nav class="footer-nav" aria-label="Footer">/);
    assert.match(html, /Flid AI ApS · CVR 43463217 · Odense, Denmark/);
  });

  test(`${path} uses plain words and one contact address`, async () => {
    const html = await built(file);
    const text = visibleText(html);

    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${pattern} on ${path}`);
    }
    const addresses = new Set(html.match(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/gi) ?? []);
    for (const address of addresses) {
      assert.equal(address, contactAddress, `unexpected address on ${path}`);
    }
    assert.doesNotMatch(html, /autodesk[- ]supported|certified/i);
    assert.doesNotMatch(html, /\b(kr|DKK|EUR|USD|€|\$)\s?\d/);
  });

  test(`${path} images have size, alt text and built sources`, async () => {
    const html = await built(file);
    const images = html.match(/<img\b[^>]*>/g) ?? [];

    for (const image of images) {
      assert.match(image, /\bwidth="\d+"/, image);
      assert.match(image, /\bheight="\d+"/, image);
      // Decorative images (the footer logo, card screenshots beside their
      // own description) have empty alt text; the rest describe themselves.
      assert.match(image, /\balt="([^"]{5,})?"/, image);
    }
    const sources = new Set(
      [...html.matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap(([, value]) =>
        value.split(",").map((entry) => entry.trim().split(/\s+/)[0]),
      ),
    );
    for (const source of sources) {
      if (source.startsWith("/")) {
        await access(new URL(`.${source}`, dist));
      }
    }
  });
}

test("every page shares one header and footer", async () => {
  const strip = (html) => html.replace(/ aria-current="page"/g, "");
  const [first, ...rest] = await Promise.all(allPages.map(([, file]) => built(file)));
  const header = region(strip(first), /<header class="site-header">[\s\S]*?<\/header>/);
  const footer = region(first, /<footer class="site-footer">[\s\S]*?<\/footer>/);

  assert.ok(header && footer);
  for (const html of rest) {
    assert.equal(region(strip(html), /<header class="site-header">[\s\S]*?<\/header>/), header);
    assert.equal(region(html, /<footer class="site-footer">[\s\S]*?<\/footer>/), footer);
  }
  const labels = [...header.matchAll(/<li><a href="[^"]+">([^<]+)<\/a><\/li>/g)].map(([, label]) => label);
  assert.deepEqual(labels, ["Products", "Services", "Cases", "About"]);
  assert.match(header, /<a class="button button--primary" href="\/contact\/">Contact<\/a>/);
});

test("marks the current section in the navigation", async () => {
  for (const [path, file, section] of [
    ["/products/", "products/index.html", "/products/"],
    ["/products/leapview/", "products/leapview/index.html", "/products/"],
    ["/products/alloy-catalog/", "products/alloy-catalog/index.html", "/products/"],
    ["/services/", "services/index.html", "/services/"],
    ["/cases/", "cases/index.html", "/cases/"],
    ["/about/", "about/index.html", "/about/"],
  ]) {
    const html = await built(file);
    const nav = region(html, /<nav class="site-nav"[\s\S]*?<\/nav>/);
    assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1, path);
    assert.match(nav, new RegExp(`href="${section}" aria-current="page"`), path);
  }
  const home = region(await built("index.html"), /<nav class="site-nav"[\s\S]*?<\/nav>/);
  assert.doesNotMatch(home, /aria-current/);
  const contact = region(await built("contact/index.html"), /<header class="site-header">[\s\S]*?<\/header>/);
  assert.match(contact, /href="\/contact\/" aria-current="page">Contact</);
});

test("says what Flid sells and how to start on the home page", async () => {
  const html = await built("index.html");

  const main = region(html, /<main id="main">[\s\S]*?<\/main>/);

  assert.match(main, /<h1>Software for engineering <span>and analytics data\.<\/span><\/h1>/);
  assert.match(main, /Flid builds products for engineering and analytics data, and consults on the systems behind them\./);
  assert.match(main, /href="\/products\/alloy-catalog\/"/);
  assert.match(main, /href="\/products\/leapview\/"/);
  assert.match(main, /four-week Alloy Catalog pilot/);
  assert.match(main, /class="button button--primary button--large" href="mailto:hello@flid\.ai"/);
});

test("states each product's status next to it", async () => {
  const [leapview, alloy] = await Promise.all([
    built("products/leapview/index.html"),
    built("products/alloy-catalog/index.html"),
  ]);

  assert.match(leapview, /<span class="pill">Open source, Apache-2\.0 · Alpha v0\.4\.0-alpha\.1, for controlled evaluation<\/span>/);
  assert.match(leapview, /26 visual types/);
  assert.match(alloy, /<span class="pill">Available as a pilot<\/span>/);
  assert.match(alloy, /does not change them/);
});

test("keeps reference pages out of navigation and the sitemap", async () => {
  const [sitemap, robots, designSystem] = await Promise.all([
    built("sitemap.xml"),
    built("robots.txt"),
    built("design-system/index.html"),
  ]);

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  assert.deepEqual(locations, pages.map(([path]) => `${origin}${path}`));
  assert.match(robots, /Sitemap: https:\/\/flid\.ai\/sitemap\.xml/);
  assert.match(designSystem, /<meta name="robots" content="noindex">/);

  for (const [, file] of allPages) {
    const html = await built(file);
    assert.doesNotMatch(html, /href="\/(design-system|brand|showcase|generator)\/"/);
  }
});

test("builds screenshots as AVIF and WebP at two widths", async () => {
  const masters = (await readdir(new URL("product-screenshots/", root))).filter((name) => name.endsWith(".png"));

  assert.ok(masters.length >= 2);
  for (const master of masters) {
    for (const width of [640, 1280]) {
      for (const format of ["avif", "webp"]) {
        const file = `assets/screenshots/${master.slice(0, -4)}-${width}.${format}`;
        assert.ok((await stat(new URL(file, dist))).size < 120_000, file);
      }
    }
  }
});

test("keeps the header lockup small", async () => {
  for (const mode of ["light", "dark"]) {
    const { size } = await stat(new URL(`assets/images/flid-lockup-${mode}.webp`, dist));
    assert.ok(size < 20_000, `${mode} lockup is ${size} bytes`);
  }
});

// Static estimate of a first load: HTML, the stylesheet, the font, one header
// lockup, and for every <img> the larger of its AVIF sources (1280 px). It does
// not add the dark lockup or dark screenshots, which replace the light ones.
// Transfer sizes are measured separately in a browser before release.
test("stays under 300 KB per page with every image loaded", async () => {
  const shared =
    (await stat(new URL("assets/site.css", dist))).size +
    (await stat(new URL("assets/fonts/Geist-Variable.woff2", dist))).size +
    (await stat(new URL("assets/images/flid-lockup-light.webp", dist))).size;

  for (const [path, file] of allPages) {
    const html = await built(file);
    let total = shared + Buffer.byteLength(html);
    for (const [, src] of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
      if (src.includes("flid-lockup")) continue;
      // Worst case: the larger AVIF a wide screen picks, or the WebP fallback.
      const avif = src.includes("/screenshots/") ? src.replace(/-\d+\.webp$/, "-1280.avif") : src;
      const candidate = avif !== src ? avif : src;
      total += (await stat(new URL(`.${candidate}`, dist))).size;
    }
    assert.ok(total < 300_000, `${path} is ${total} bytes`);
  }
});

test("gives navigation, buttons and standalone links a 44 px target", async () => {
  const css = await readFile(new URL("app/site.css", root), "utf8");

  assert.match(css, /--target:\s*44px/);
  for (const selector of [".site-nav a", ".footer-nav a", ".button", ".contact-address", "a.card-link"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = css.match(new RegExp(`(^|\\n)${escaped} \\{[^}]*\\}`))?.[0] ?? "";
    assert.match(rule, /min-height: var\(--target\)/, selector);
  }
});
