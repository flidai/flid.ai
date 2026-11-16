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
    const expected = ["<script>", '<script type="module" src="/assets/theme.js">'];
    if (["/", "/products/", "/products/leapview/", "/products/alloy-catalog/", "/about/"].includes(path)) {
      expected.push('<script type="module" src="/assets/motion.js">');
    }
    assert.deepEqual(scripts, expected);
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
  assert.deepEqual(labels, ["LeapView", "Alloy Catalog", "Services", "Cases", "About"]);
  assert.match(header, /<a class="button button--primary" href="\/contact\/">Contact<\/a>/);
});

test("marks the current section in the navigation", async () => {
  for (const [path, file, section] of [
    ["/products/leapview/", "products/leapview/index.html", "/products/leapview/"],
    ["/products/alloy-catalog/", "products/alloy-catalog/index.html", "/products/alloy-catalog/"],
    ["/services/", "services/index.html", "/services/"],
    ["/cases/", "cases/index.html", "/cases/"],
    ["/about/", "about/index.html", "/about/"],
  ]) {
    const html = await built(file);
    const nav = region(html, /<nav class="site-nav"[\s\S]*?<\/nav>/);
    assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1, path);
    assert.match(nav, new RegExp(`href="${section}" aria-current="page"`), path);
  }
  for (const file of ["index.html", "products/index.html"]) {
    const nav = region(await built(file), /<nav class="site-nav"[\s\S]*?<\/nav>/);
    assert.doesNotMatch(nav, /aria-current/, file);
  }
  const contact = region(await built("contact/index.html"), /<header class="site-header">[\s\S]*?<\/header>/);
  assert.match(contact, /href="\/contact\/" aria-current="page">Contact</);
});

test("says what Flid sells and how to start on the home page", async () => {
  const html = await built("index.html");

  const main = region(html, /<main id="main">[\s\S]*?<\/main>/);

  const h1 = region(main, /<h1>[\s\S]*?<\/h1>/);
  // The heading says what Flid does without naming products, so it still
  // holds when another product is added.
  assert.equal(visibleText(h1).replace(/\s+/g, " ").trim(), "We turn your company’s data into tools people use.");
  assert.doesNotMatch(h1, /LeapView|Alloy/);
  assert.match(main, /<span class="pill"><strong>Products and consulting<\/strong> from Odense, Denmark<\/span>/);
  assert.match(main, /We build software products for analytics and engineering data/);
  assert.match(main, /class="button button--primary button--large" href="\/contact\/">Talk to us</);
  assert.match(main, /class="button button--secondary button--large" href="\/products\/">See all products</);
  assert.match(main, /href="\/products\/alloy-catalog\/"/);
  assert.match(main, /href="\/products\/leapview\/"/);
  assert.match(main, /href="mailto:hello@flid\.ai"/);
});

test("shows every product side by side under the hero, with nothing rotating", async () => {
  const html = await built("index.html");
  const main = region(html, /<main id="main">[\s\S]*?<\/main>/);
  const hero = region(main, /<section class="hero hero--home"[\s\S]*?\n {6}<\/section>/);
  const products = region(main, /<section class="section section--products" aria-label="Products">[\s\S]*?\n {6}<\/section>/);
  assert.ok(main.indexOf(products) > main.indexOf(hero), "the products follow the hero");
  const row = region(products, /<ul class="product-row" aria-label="Our products"[\s\S]*?\n {10}<\/ul>/);
  assert.ok(row, "the product section lists the products");
  const cards = [...row.matchAll(/<li class="product" style="--i:(\d);--side:([-\d.]+)">([\s\S]*?)<\/li>/g)];
  assert.deepEqual(cards.map(([, , , body]) => body.match(/<h2>([^<]+)<\/h2>/)[1]), ["LeapView", "Alloy Catalog"]);
  assert.deepEqual(cards.map(([, , side]) => side), ["-1", "1"]);
  for (const [, , , body] of cards) {
    // Name, status, one line, a real screenshot, facts and one link, all visible at once.
    assert.match(body, /<span class="tag">[^<]+<\/span>/);
    assert.match(body, /<figure class="window">/);
    assert.match(body, /<dl class="product-facts">/);
    assert.match(body, /<span class="card-link">See [^<]+<\/span>/);
    assert.doesNotMatch(body, /\shidden[\s>]/);
  }
  assert.match(cards[1][3], /alloy-catalog-part-light-1280\.webp/);
  // Only the first product screenshot asks for high priority.
  assert.equal((row.match(/fetchpriority="high"/g) ?? []).length, 1);

  // The hero stage is decoration: real product screenshots floating on both
  // sides of the centred copy and a turning badge, hidden from assistive
  // technology. The large Flid mark was taken out at the owner's request.
  const stage = region(hero, /<div class="hero-stage" aria-hidden="true">[\s\S]*?\n {10}<\/div>/);
  assert.ok(stage, "the hero has a stage");
  assert.doesNotMatch(hero, /hero-mark|flid-mark/);
  assert.match(stage, /<svg class="hero-badge"/);
  const floating = [...stage.matchAll(/<li class="hero-card[^"]*" style="[^"]*">[\s\S]*?<\/li>/g)].map(([card]) => card);
  assert.ok(floating.length >= 4);
  for (const card of floating) {
    assert.match(card, /\/assets\/screenshots\/(leapview|alloy-catalog)-[a-z-]+-light-1280\.webp/);
    assert.match(card, /alt=""/);
  }
  assert.match(hero, /<p class="hero-note">Real product screens, on public and made-up demo data\.<\/p>/);
  assert.match(hero, /class="word word--serif"[^>]*><span>tools<\/span>/);

  // The floating call button needs the script to know when to show itself.
  assert.match(main, /<a class="float-cta" href="\/contact\/" data-float-cta data-requires-js hidden>/);
  // No tabs, autoplay or carousel anywhere on the site.
  for (const [, file] of pages) {
    assert.doesNotMatch(await built(file), /data-tabs|data-autoplay|role="tablist"|carousel/, file);
  }
  await assert.rejects(readFile(new URL("site/assets/tabs.js", root)));

  // The Products page lists the same cards, with who each product is for.
  const productsPage = region(await built("products/index.html"), /<main id="main">[\s\S]*?<\/main>/);
  assert.equal((productsPage.match(/<li class="product" /g) ?? []).length, 2);
  assert.match(productsPage, /For data teams who want one definition of each metric/);
  assert.match(productsPage, /<dl class="fact-rows">/);
});

test("walks through each product in a story of real screens that works without JavaScript", async () => {
  const story = async (file) => {
    const main = region(await built(file), /<main id="main">[\s\S]*?<\/main>/);
    return [...main.matchAll(/<section class="section story" aria-labelledby="([a-z-]+)">([\s\S]*?)\n {6}<\/section>/g)];
  };
  const stories = [...(await story("products/leapview/index.html")), ...(await story("products/alloy-catalog/index.html"))];
  assert.deepEqual(stories.map(([, id]) => id), ["leapview-story", "alloy-story"]);
  // The home page stays short: products are cards that link to these pages.
  assert.deepEqual(await story("index.html"), []);

  for (const [, id, body] of stories) {
    const steps = [...body.matchAll(/<li class="story-step" data-frame="([a-z]+)"/g)].map(([, f]) => f);
    assert.equal(steps.length, 4, id);
    const frames = [...body.matchAll(/data-frame-key="([a-z]+)"/g)].map(([, f]) => f);
    assert.deepEqual([...new Set(steps)], frames, `${id}: every frame belongs to a step`);
    // Without the script the sticky screen stays hidden and each frame shows
    // under the first step that uses it.
    assert.match(body, /<div class="story-media" data-requires-js hidden>/);
    assert.equal((body.match(/<div class="story-inline">/g) ?? []).length, frames.length, id);
    for (const [, alt] of body.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)) assert.ok(alt.length > 20, `${id} alt text`);
  }

  const alloy = stories[1][2];
  for (const name of ["search", "part", "quality", "assistant"]) {
    assert.match(alloy, new RegExp(`alloy-catalog-${name}-light-1280\\.webp`));
  }
  assert.match(alloy, /made-up demo catalog/);
  assert.match(stories[0][2], /semantic-models\/sales\.yaml/);
});

test("puts LeapView before Alloy Catalog wherever both appear", async () => {
  const pages = await Promise.all(["index.html", "products/index.html", "cases/index.html"].map(built));
  for (const html of pages) {
    const main = region(html, /<main id="main">[\s\S]*?<\/main>/);
    const leapview = main.indexOf("LeapView");
    assert.ok(leapview >= 0, "LeapView is named");
    assert.ok(leapview < main.indexOf("Alloy Catalog"), "LeapView comes first");
  }
  const footer = region(pages[0], /<footer[\s\S]*?<\/footer>/);
  assert.ok(footer.indexOf("/products/leapview/") < footer.indexOf("/products/alloy-catalog/"));
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

test("shows real Alloy Catalog screens on its page", async () => {
  const main = region(await built("products/alloy-catalog/index.html"), /<main id="main">[\s\S]*?<\/main>/);
  assert.match(main, /alloy-catalog-part-light-1280\.webp/);
  assert.match(main, /made-up demo catalog/);
  for (const name of ["search", "quality", "assistant"]) {
    assert.match(main, new RegExp(`alloy-catalog-${name}-dark-1280\\.avif`));
  }
  // Every screenshot has alt text.
  assert.doesNotMatch(main, /alloy-catalog-[a-z]+-light-1280\.webp"[^>]*alt=""/);
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
    // A screenshot used twice (a story's inline and sticky copies) loads once.
    const sources = new Set([...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(([, src]) => src));
    for (const src of sources) {
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

test("keeps every animation and transition behind the reduced-motion setting", async () => {
  const css = await readFile(new URL("app/site.css", root), "utf8");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {");
  assert.ok(start > 0);

  // Find the end of the motion block by matching braces.
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  const outside = (css.slice(0, start) + css.slice(end))
    .replace(/@keyframes [\w-]+ \{[\s\S]*?\n\}/g, "")
    .replace(/::view-transition-(old|new)\(root\)[\s\S]*?\}/g, "");

  assert.doesNotMatch(outside, /^\s*(animation|transition)(-[a-z-]+)?\s*:/m);
  assert.equal((css.match(/prefers-reduced-motion: no-preference/g) ?? []).length, 1);
});

test("says who stands behind Flid, and keeps its no-cookies promise", async () => {
  const [html, about, contact] = await Promise.all(["index.html", "about/index.html", "contact/index.html"].map(built));
  assert.match(about, /<h2 id="trust">Danish, and your data stays yours\.<\/h2>/);
  assert.match(region(about, /<main id="main">[\s\S]*?<\/main>/), /CVR 43463217/);
  assert.equal((contact.match(/<li class="person-row">/g) ?? []).length, 3);
  assert.match(contact, /<h2 id="engagement">How an engagement starts\.<\/h2>/);

  // The footer says the site sets no cookies and runs no analytics; no script may.
  assert.match(html, /This site sets no cookies and runs no analytics\./);
  const assets = new URL("site/assets/", root);
  for (const name of await readdir(assets)) {
    if (!name.endsWith(".js")) continue;
    const source = await readFile(new URL(name, assets), "utf8");
    assert.doesNotMatch(source, /document\.cookie|sendBeacon|gtag|googletagmanager|plausible|analytics/i, name);
  }
});
