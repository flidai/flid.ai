import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { productScreenshots } from "../scripts/build.mjs";

const root = new URL("../", import.meta.url);
// FLID_DIST points the suite at a build in another directory (preview builds).
const dist = process.env.FLID_DIST
  ? pathToFileURL(`${process.env.FLID_DIST.replace(/\/$/, "")}/`)
  : new URL("dist/", root);

async function readBuiltPage(pathname) {
  return readFile(new URL(pathname, dist), "utf8");
}

test("builds the Flid public site at the root as plain HTML", async () => {
  const [html, script, styles] = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("assets/site.js"),
    readBuiltPage("assets/site.css"),
  ]);

  assert.match(html, /<title>Flid — Agent-native product lab<\/title>/i);
  assert.match(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), /We build products where agents do real work/i);
  assert.match(html, /An agent is only as reliable as the system beneath it/i);
  assert.match(html, /Build for agents from the ground up/i);
  assert.match(html, /governed data, explicit actions, and evidence/i);
  assert.match(html, /Jacob Østergaard/i);
  assert.match(html, /href="\/products\/"[^>]*>Products\s*</i);
  assert.match(html, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Contact\s*</i);
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Get in touch\s*</i);
  assert.match(html, /Start a conversation/i);
  assert.match(html, /<script type="module" src="\/assets\/site\.js"><\/script>/);
  assert.doesNotMatch(html, /href="\/brand\/?"/);
  assert.doesNotMatch(html, /id="contact"|data-color-mode="light"/i);
  assert.doesNotMatch(html, /Copenhagen/i);
  const footer = html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] ?? "";
  assert.match(footer, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.doesNotMatch(footer, /flid\.ai|© 2026/i);
  assert.match(script, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(styles, /\.thesis/);
  assert.doesNotMatch(html, /_next|data-reactroot/i);
});

test("builds the products page as a standalone static route", async () => {
  const html = await readBuiltPage("products/index.html");

  assert.match(html, /<title>Products — Flid<\/title>/i);
  assert.match(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), /Products where agents do real work/i);
  assert.match(html, /href="https:\/\/leapview\.dev\/"[^>]*>Visit LeapView\s*</i);
  assert.match(html, /href="https:\/\/alloycatalog\.com\/"[^>]*>Visit Alloy Catalog\s*</i);
  assert.match(html, /<script type="module" src="\/assets\/site\.js"><\/script>/);
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Contact\s*</i);
  assert.match(html, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(html, /class="top-logo"[\s\S]{0,80}site-lockup-on-dark\.svg/);
  const footer = html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] ?? "";
  assert.match(footer, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.doesNotMatch(footer, /flid\.ai|© 2026/i);
  assert.doesNotMatch(html, /_next|data-reactroot/i);
});

test("builds the About page as a dedicated team route", async () => {
  const [html, styles] = await Promise.all([
    readBuiltPage("about/index.html"),
    readBuiltPage("assets/site.css"),
  ]);

  assert.match(html, /<title>About — Flid<\/title>/i);
  assert.match(
    html,
    /<meta name="description" content="About Flid, an independent Danish product lab building durable agent-native systems\.">/i,
  );
  assert.match(
    html,
    /<meta property="og:description" content="An independent Danish product lab building durable agent-native systems\.">/i,
  );
  assert.match(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), /A Danish product lab building durable systems\./i);
  assert.match(
    html,
    /Founded in Odense, Flid builds software where people and agents work through the same governed data, capabilities, and evidence\./i,
  );
  assert.match(html, /Independent by design/i);
  assert.match(
    html,
    /Flid is Danish for diligence—the care, persistence, and attention behind work made to last\./i,
  );
  assert.match(html, /Jacob Østergaard/i);
  assert.match(html, /Founder/i);
  assert.match(
    html,
    /href="https:\/\/www\.linkedin\.com\/in\/jacob-%C3%B8stergaard-nielsen-b39415183\/"[^>]*>Jacob Østergaard\s*<span[^>]*>(?:&nbsp;|\s)*↗<\/span>/i,
  );
  assert.match(
    html,
    /Jacob is the founder of Flid and leads product\. Drawing on years of experience architecting enterprise data platforms and leading engineering teams, he designs the systems, interfaces, and governance that enable agents to participate reliably in real operational work\./i,
  );
  assert.match(html, /Ganesh Kambli/i);
  assert.match(html, /Platform Engineer · Mumbai/i);
  // Bios describe experience and work areas: no project names, internal tools, or tech stacks.
  const bios = [...html.matchAll(/<article class="member [\s\S]*?<\/article>/g)].map(([bio]) => bio.replace(/<[^>]+>/g, " "));
  assert.equal(bios.length, 3);
  for (const bio of bios) assert.doesNotMatch(bio, /LeapView|Alloy Catalog|Pulse|Rust|TypeScript|Python|NixOS|\bGo\b/);
  assert.match(html, /The people building Flid\./i);
  assert.match(
    html,
    /Product direction and engineering stay closely connected—from first principles to production\./i,
  );
  assert.match(
    html,
    /Ganesh is a Platform Engineer at Flid\. His experience spans backend systems, cloud infrastructure, security, and applied AI\. He owns how software reaches production, from delivery pipelines and zero-downtime releases to AI-assisted engineering workflows, so the team can ship reliably\./i,
  );
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/ganeshkambli\/"/i);
  assert.match(html, /Anand Bora/i);
  assert.match(html, /Full-Stack Developer · Pune/i);
  assert.match(
    html,
    /Anand is a Full-Stack Developer at Flid\. His experience spans product interfaces, frontend architecture, backend systems, and applied AI\. He takes features from first idea to production, pairing careful UI and UX design with the services behind them, so powerful systems stay simple to use\./i,
  );
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/anand-bora\/"/i);
  assert.match(html, /jacob-oestergaard\.webp/i);
  assert.match(html, /ganesh-kambli\.webp/i);
  assert.match(html, /anand-bora\.webp/i);
  assert.match(html, /href="\/products\/"[^>]*>Products\s*</i);
  assert.match(html, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Contact\s*</i);
  assert.match(html, /Working on a hard <span class="nb">agent-native<\/span> problem\?/i);
  assert.doesNotMatch(html, /small team|small enough|Built across two places|Distributed between/i);
  assert.match(html, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.match(styles, /\.team\s*\{/);
  assert.equal(html.match(/<article class="member /g)?.length, 3);
  assert.doesNotMatch(html, /_next|react|__next|data-reactroot/i);
});

test("optimizes the founder portrait for the public site", async () => {
  const portrait = await stat(
    new URL("assets/images/jacob-oestergaard.webp", dist),
  );

  assert.ok(portrait.size < 250_000, "founder portrait should stay below 250 KB");
});

test("optimizes the AI engineer portrait for the public site", async () => {
  const portrait = await stat(
    new URL("assets/images/ganesh-kambli.webp", dist),
  );

  assert.ok(portrait.size < 250_000, "AI engineer portrait should stay below 250 KB");
});

test("optimizes Anand's portrait for the public site", async () => {
  const portrait = await stat(
    new URL("assets/images/anand-bora.webp", dist),
  );

  assert.ok(portrait.size < 250_000, "Anand's portrait should stay below 250 KB");
});

test("ships every product view as size-budgeted responsive images", async () => {
  const html = await readBuiltPage("products/index.html");
  for (const { name, widths } of productScreenshots) {
    assert.match(html, new RegExp(`/assets/images/products/${name}-${widths.at(-1)}\\.avif ${widths.at(-1)}w`), `${name} is on the page`);
    for (const width of widths) {
      for (const format of ["avif", "webp"]) {
        const screenshot = await stat(
          new URL(`assets/images/products/${name}-${width}.${format}`, dist),
        );
        const budget = width <= 1080 ? 60_000 : 150_000;

        assert.ok(
          screenshot.size < budget,
          `${name}-${width}.${format} should stay below ${budget / 1000} KB`,
        );
      }
    }
  }
});

test("gives both products the same chapter: status, links, and a view gallery", async () => {
  const html = await readBuiltPage("products/index.html");
  for (const [id, views] of [["leapview", 3], ["alloy-catalog", 4]]) {
    const chapter = html.match(new RegExp(`<article class="chapter[^"]*" id="${id}"[\\s\\S]*?</article>`))?.[0] ?? "";
    assert.ok(chapter, `${id} chapter exists`);
    assert.match(chapter, /<ul class="tags"[^>]*>[\s\S]*?In development<\/li>/);
    assert.match(chapter, /class="chapter-links"/);
    assert.equal(chapter.match(/role="tab" /g)?.length, views, `${id} tab count`);
    assert.equal(chapter.match(/role="tabpanel"/g)?.length, views, `${id} panel count`);
    assert.equal(chapter.match(/aria-selected="true"/g)?.length, 1, `${id} selects one tab`);
    for (const [, controls] of chapter.matchAll(/aria-controls="([^"]+)"/g)) {
      assert.match(chapter, new RegExp(`id="${controls}"`), `${controls} panel exists`);
    }
  }
  // Status labels must not look or behave like links.
  assert.doesNotMatch(html, /<a[^>]*>\s*(?:Open source|In development)\s*</i);
});

test("switches product views with an accessible tab script", async () => {
  const script = await readBuiltPage("assets/products.js");
  assert.match(script, /setAttribute\("aria-selected"/);
  assert.match(script, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/);
  assert.match(script, /\.hidden = !selected/);
});

test("builds the interactive generator as plain HTML and JavaScript", async () => {
  const [html, script] = await Promise.all([
    readBuiltPage("generator/index.html"),
    readBuiltPage("assets/generator.js"),
  ]);

  assert.match(html, /<title>Signal Mark Generator — Flid<\/title>/i);
  assert.match(html, /Shape the signal/i);
  assert.match(html, /Full/);
  assert.match(html, /Primary/);
  assert.match(html, /Essential/);
  assert.match(html, /Export SVG/);
  assert.match(html, /135 MARKS/);
  assert.match(html, /Silhouette/);
  assert.match(script, /addEventListener/);
  assert.match(script, /generateLogoSvg/);
  assert.match(script, /downloadSvg/);
});

test("builds the logo showcase without an application framework", async () => {
  const [html, script] = await Promise.all([
    readBuiltPage("showcase/index.html"),
    // The showcase is prerendered by the build from this module; no script ships with the page.
    readFile(new URL("lib/showcase-markup.mjs", root), "utf8"),
  ]);

  assert.match(html, /<title>Logo Showcase — Flid<\/title>/i);
  assert.match(html, /One identity\. Its design history/i);
  assert.match(html, /sole approved signature/i);
  assert.match(html, /WORDMARK STUDIES/i);
  assert.match(html, /REVERSE STUDIES/i);
  assert.match(html, /LOCKUP SCALE LADDER/i);
  assert.match(html, /Procedural signal identity · Odense/i);
  assert.doesNotMatch(html, /Copenhagen/i);
  assert.match(script, /logoVariations/);
  assert.match(script, /mode:\s*"line"/);
  assert.match(script, /layers:\s*12/);
  assert.match(script, /strokeWidth:\s*0\.58/);
  assert.match(script, /padding:\s*10/);
  assert.doesNotMatch(`${html}${script}`, /Next|React|jsx|tsx/);
});

test("builds a normative static brand guide with generator source", async () => {
  const [html, script, brandSystem] = await Promise.all([
    readBuiltPage("brand/index.html"),
    readBuiltPage("assets/brand.js"),
    readBuiltPage("lib/brand-system.mjs"),
  ]);

  assert.match(html, /<title>Brand Guide — Flid<\/title>/i);
  assert.match(html, /The source of truth for the Flid identity/i);
  assert.match(html, /APPROVED PRIMARY LOCKUP/i);
  assert.match(html, /RECOMMENDED MINIMUM/i);
  assert.match(html, /Never substitute another layer count/i);
  assert.match(html, /Flid AI ApS/i);
  assert.match(html, /Geist/i);
  assert.match(html, /Typeface approved/i);
  assert.match(html, /View full generator source/i);
  assert.match(script, /fetch\(["']\/lib\/logo-generator\.mjs["']\)/);
  assert.match(brandSystem, /legalName:\s*"Flid AI ApS"/);
  assert.match(brandSystem, /wordmark:\s*"flid"/);
  assert.match(brandSystem, /minimumDigitalSize:\s*64/);
});

test("keeps the public site and brand reference as distinct routes", async () => {
  const pages = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("brand/index.html"),
    readBuiltPage("showcase/index.html"),
    readBuiltPage("generator/index.html"),
  ]);

  assert.doesNotMatch(pages[0], /href="\/brand\/?"/);
  assert.match(pages[1], /Brand Guide — Flid/);
  assert.match(pages[2], /href="\/brand\/?"/);
  assert.match(pages[3], /href="\/brand\/?"/);
});

test("retains responsive and reduced-motion styling", async () => {
  const [globalCss, siteCss, showcaseCss, generatorCss, brandCss] = await Promise.all([
    readBuiltPage("assets/globals.css"),
    readBuiltPage("assets/site.css"),
    readBuiltPage("assets/showcase.css"),
    readBuiltPage("assets/generator.css"),
    readBuiltPage("assets/brand.css"),
  ]);

  for (const css of [globalCss, siteCss, showcaseCss, generatorCss, brandCss]) {
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
  }
  assert.match(showcaseCss, /--lockup-mark-size:/);
  assert.match(generatorCss, /@media\s*\(max-width:\s*680px\)/);
});

test("keeps .ai out of visual wordmarks while preserving the domain", async () => {
  const pages = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("brand/index.html"),
    readBuiltPage("showcase/index.html"),
  ]);
  const combined = pages.join("\n");

  assert.doesNotMatch(combined, /class="[^"]*wordmark[^"]*"[^>]*>\\s*flid\\.ai/i);
  assert.match(combined, /flid\.ai/);
  assert.match(combined, /Flid AI ApS/);
});

const publicPages = [
  ["index.html", "/"],
  ["products/index.html", "/products/"],
  ["about/index.html", "/about/"],
  ["404.html", null],
];
const allPages = [
  ...publicPages.map(([file]) => file),
  "brand/index.html",
  "showcase/index.html",
  "generator/index.html",
];

test("gives every owned page header, main, and footer landmarks plus a skip link", async () => {
  for (const [file] of publicPages) {
    const html = await readBuiltPage(file);
    const mainOpen = html.search(/<main\b/);
    const mainClose = html.indexOf("</main>");
    assert.ok(mainOpen > 0 && mainClose > mainOpen, `${file} needs a <main>`);
    assert.equal((html.match(/<main\b/g) || []).length, 1, `${file} has one <main>`);
    assert.match(html, /<main id="main" tabindex="-1"[^>]*>/, file);
    const main = html.slice(mainOpen, mainClose);
    assert.doesNotMatch(main, /<header\b|<footer\b/, `${file}: header/footer must not be inside <main>`);
    assert.ok(html.search(/<header\b/) > 0 && html.search(/<header\b/) < mainOpen, `${file}: <header> precedes <main>`);
    assert.ok(html.search(/<footer\b/) > mainClose, `${file}: <footer> follows <main>`);
    assert.match(
      html,
      /<body>\s*<a class="skip" href="#main">Skip to content<\/a>/,
      `${file}: the skip link must be the first element in <body>`,
    );
  }
  assert.match(await readBuiltPage("assets/site.css"), /\.skip:focus\s*\{/);
});

test("preloads the Geist font on every page and avoids the stylesheet @import chain", async () => {
  const preload =
    '<link rel="preload" href="/assets/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>';
  for (const file of allPages) {
    const html = await readBuiltPage(file);
    assert.equal(html.split(preload).length - 1, 1, `${file} needs exactly one font preload`);
    assert.ok(
      html.indexOf(preload) < html.indexOf('rel="stylesheet"'),
      `${file}: the preload must precede the stylesheets`,
    );
  }

  const globals = await readBuiltPage("assets/globals.css");
  assert.doesNotMatch(globals, /@import/, "built globals.css must not chain a second request");
  assert.match(globals, /--bgColor-default:\s*#0d1117/, "Primer tokens are inlined");
  assert.match(globals, /font-family:\s*"Geist Fallback"[^}]*size-adjust:[^}]*ascent-override:/s);
  assert.match(globals, /--font-geist-sans:\s*"Geist",\s*"Geist Fallback"/);
});

test("keeps headings balanced, body copy pretty, and compound words whole", async () => {
  const globals = await readBuiltPage("assets/globals.css");
  assert.match(globals, /:where\(h1, h2, h3\)\s*\{[^}]*text-wrap:\s*balance/s);
  assert.match(globals, /:where\(h1, h2, h3\)\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(globals, /:where\(p, li, figcaption\)\s*\{[^}]*text-wrap:\s*pretty/s);
  assert.match(globals, /\.nb\s*\{[^}]*display:\s*inline-block;[^}]*max-width:\s*100%/s);
  for (const file of ["products/index.html", "about/index.html"]) {
    const html = await readBuiltPage(file);
    const bare = html
      .replace(/<span class="nb">agent-native<\/span>/g, "")
      .replace(/<(meta|title)[^>]*>[^<]*/g, "");
    assert.doesNotMatch(bare, /agent-native/, `${file}: visible "agent-native" must be wrapped in .nb`);
  }
});

test("does not force a 320px minimum width that scrolls sideways on narrow screens", async () => {
  const [site, globals] = await Promise.all([
    readBuiltPage("assets/site.css"),
    readBuiltPage("assets/globals.css"),
  ]);
  assert.doesNotMatch(site, /min-width:\s*320px/);
  assert.match(globals, /body \.home-page\s*\{\s*min-width:\s*0/);
});

test("lets headers wrap and keeps nav targets at least 44px wide", async () => {
  const globals = await readBuiltPage("assets/globals.css");
  assert.match(globals, /\.site-header nav a\s*\{[^}]*min-width:\s*44px/s);
  assert.match(globals, /body \.header-inner\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test("keeps header logos light and footers free of the full brand lockup", async () => {
  for (const [file] of publicPages) {
    const html = await readBuiltPage(file);
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    assert.match(header, /src="\/assets\/images\/site-lockup-on-dark\.svg"/, file);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
    assert.doesNotMatch(footer, /brand-assets\/lockup-primary-on-dark\.svg/, file);
    assert.match(footer, /class="foot-word"/, file);
  }
  const lockup = await stat(new URL("assets/images/site-lockup-on-dark.svg", dist));
  assert.ok(lockup.size < 25_000, `header lockup is ${lockup.size} bytes`);
});

test("keeps the logo visible when forced colors repaint the page", async () => {
  const globals = await readBuiltPage("assets/globals.css");
  const block = globals.match(/@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const selector of [".site-logo", ".products-logo", ".about-logo", ".site-footer img", ".products-footer img", ".about-footer img"]) {
    assert.ok(block.includes(selector), `${selector} needs a forced-colors plate`);
  }
  assert.match(block, /forced-color-adjust:\s*none/);
  assert.match(block, /background:\s*#0d1117/);
});

test("ships small, legible site icons and a complete web manifest", async () => {
  const [svg, icon32, ico, touch, icon192, icon512, manifestSource] = await Promise.all([
    stat(new URL("assets/images/site-icon.svg", dist)),
    stat(new URL("assets/images/site-icon-32.png", dist)),
    stat(new URL("assets/images/site-icon.ico", dist)),
    readFile(new URL("assets/images/site-apple-touch-icon.png", dist)),
    stat(new URL("assets/images/site-icon-192.png", dist)),
    stat(new URL("assets/images/site-icon-512.png", dist)),
    readBuiltPage("site.webmanifest"),
  ]);
  assert.ok(svg.size <= 5_000, `favicon SVG is ${svg.size} bytes`);
  assert.ok(icon32.size <= 5_000, `32px favicon is ${icon32.size} bytes`);
  assert.ok(ico.size <= 8_000, `favicon.ico is ${ico.size} bytes`);
  assert.ok(icon192.size > 0 && icon512.size > 0);

  const { default: sharp } = await import("sharp");
  const meta = await sharp(touch).metadata();
  assert.equal(meta.width, 180);
  assert.equal(meta.height, 180);
  const { channels } = await sharp(touch).stats();
  assert.ok(channels[0].mean > 10 && channels[0].mean < 120, "touch icon is a dark plate with a bright mark");
  assert.equal(meta.hasAlpha, false, "touch icon must be fully opaque (iOS fills transparency black)");

  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  for (const icon of manifest.icons) {
    await access(new URL(icon.src.slice(1), dist));
  }

  for (const file of allPages) {
    const html = await readBuiltPage(file);
    assert.match(html, /<link rel="icon" href="\/assets\/images\/site-icon\.svg" type="image\/svg\+xml">/, file);
    assert.match(html, /<link rel="icon" href="\/assets\/images\/site-icon-32\.png" type="image\/png" sizes="32x32">/, file);
    assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/images\/site-apple-touch-icon\.png">/, file);
    assert.match(html, /<link rel="manifest" href="\/site\.webmanifest">/, file);
    assert.doesNotMatch(html, /brand-assets\/favicon/, `${file} must not load the 178 KB brand favicon`);
  }
});

test("declares complete social metadata on the public pages", async () => {
  for (const [file] of publicPages) {
    const html = await readBuiltPage(file);
    assert.match(html, /<meta property="og:site_name" content="Flid">/, file);
    assert.match(html, /<meta property="og:image:width" content="1200">/, file);
    assert.match(html, /<meta property="og:image:height" content="630">/, file);
    assert.match(html, /<meta property="og:image:alt" content="[^"]+">/, file);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/flid\.ai\/brand-assets\/social\/share-dark-1200x630\.png">/, file);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, file);
    assert.match(html, /<meta property="og:image" content="https:\/\/flid\.ai\//, file);
    assert.match(html, /<meta name="theme-color" content="#06080d">/, file);
  }
});

test("builds a branded 404 page, robots.txt, and sitemap.xml", async () => {
  const [notFound, robots, sitemap] = await Promise.all([
    readBuiltPage("404.html"),
    readBuiltPage("robots.txt"),
    readBuiltPage("sitemap.xml"),
  ]);
  assert.match(notFound, /<title>Page not found — Flid<\/title>/);
  assert.match(notFound, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(notFound, /rel="canonical"/);
  assert.match(notFound, /<h1\b[^>]*>[\s\S]*This page[\s\S]*<\/h1>/);
  for (const href of ["/", "/products/", "/about/"]) {
    assert.match(notFound, new RegExp(`class="btn[^"]*" href="${href}"`));
  }
  assert.match(notFound, /class="top-logo"[\s\S]{0,80}site-lockup-on-dark\.svg/);
  assert.match(notFound, /Flid AI ApS · CVR 43463217 · Odense, Denmark/);

  assert.match(robots, /^User-agent: \*\nAllow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/flid\.ai\/sitemap\.xml$/m);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(urls, [
    "https://flid.ai/",
    "https://flid.ai/products/",
    "https://flid.ai/about/",
  ]);
});
