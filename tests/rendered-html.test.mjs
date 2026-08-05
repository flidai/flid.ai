import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readBuiltPage(pathname) {
  return readFile(new URL(`dist/${pathname}`, root), "utf8");
}

test("builds the Flid public site at the root as plain HTML", async () => {
  const [html, script, styles, signalField, signalStory, heroTransition] = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("assets/home.js"),
    readBuiltPage("assets/home.css"),
    readBuiltPage("lib/hero-signal-field.mjs"),
    readBuiltPage("lib/signal-scroll-story.mjs"),
    readBuiltPage("lib/hero-scroll-transition.mjs"),
  ]);

  assert.match(html, /<title>Flid — Agent-native product lab<\/title>/i);
  assert.match(html, /We build products where agents do real work/i);
  assert.match(html, /Software was built for people/i);
  assert.doesNotMatch(html, /01 \/ Thesis|01 \/ Premise|02 \/ Foundation|04 \/ The lab/i);
  assert.match(html, /LeapView/i);
  assert.doesNotMatch(html, /02 \/ Flagship product|The agent-native BI platform/i);
  assert.doesNotMatch(html, /03 \/ Field work|Selected field work keeps them honest/i);
  assert.doesNotMatch(html, /id="leapview"|id="field-work"/i);
  assert.doesNotMatch(html, /href="#leapview"|href="#field-work"/i);
  assert.match(html, /Jacob Østergaard/i);
  assert.doesNotMatch(html, /data-color-mode="light"/i);
  assert.doesNotMatch(html, /id="contact"|05 \/ Contact|Building something\s*<br>agents should operate/i);
  assert.match(html, /jacob-oestergaard\.webp/i);
  assert.doesNotMatch(html, /leapview-dashboard-dark\.png/i);
  assert.match(html, /hero-signal-waves\.webp/i);
  assert.match(html, /class="hero-wave-field"/i);
  assert.match(html, /data-hero-transition/i);
  assert.match(html, /<canvas[^>]+data-hero-transition-canvas/i);
  assert.match(
    html,
    /href="https:\/\/leapview\.dev\/"[^>]*>See our products\s*</i,
  );
  assert.doesNotMatch(html, /data-signal-field|data-signal-canvas|hero-meta/i);
  assert.match(html, /data-signal-story/i);
  assert.match(html, /<canvas[^>]+data-story-canvas/i);
  assert.doesNotMatch(html, /signal-story-static-mark/i);
  assert.match(html, /governed context, explicit capabilities/i);
  assert.match(html, /designed into the foundation/i);
  assert.doesNotMatch(html, /Every capability has a contract/i);
  assert.equal((html.match(/data-story-reveal/g) || []).length, 2);
  assert.doesNotMatch(html, /data-story-counter|signal-story-progress/i);
  assert.doesNotMatch(styles, /\.signal-story-progress/);
  assert.doesNotMatch(script, /data-story-counter|counter\.textContent/);
  assert.doesNotMatch(html, /signal-orbit|signal-node/);
  assert.match(html, /assets\/home\.js/i);
  assert.match(html, /mailto:hello@flid\.ai/i);
  assert.match(html, /Flid AI ApS/i);
  assert.match(html, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.match(html, /Odense(?: ·|,) Denmark/i);
  assert.match(
    html,
    /Flid is Danish for diligence—the care, persistence, and attention behind work made to last\./i,
  );
  assert.doesNotMatch(html, /Copenhagen/i);
  assert.doesNotMatch(script, /hero-signal-field\.mjs/);
  assert.match(script, /signal-scroll-story\.mjs/);
  assert.match(script, /hero-scroll-transition\.mjs/);
  assert.match(script, /depth-video-story\.mjs/);
  assert.match(script, /min-width:\s*901px/);
  assert.equal(
    (script.match(/matchMedia\(["']\(min-width:\s*901px\)["']\)/g) || []).length,
    1,
    "only the hero transition should restrict depth media to desktop",
  );
  assert.match(
    script,
    /story\.dataset\.depthDemo\s*===\s*["']local["']\s*&&\s*!reducedMotion\.matches[\s\S]*?initDepthStory\(initialCanvas\)/,
  );
  assert.match(html, /data-depth-demo="disabled"/);
  await assert.rejects(
    access(new URL("dist/assets/depth-reference", root)),
    /ENOENT/,
  );
  assert.match(script, /visitSignalStoryFrame/);
  assert.match(script, /getContext\(["']2d["']\)/);
  assert.match(script, /devicePixelRatio/);
  assert.match(script, /matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\)/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /requestAnimationFrame/);
  assert.match(script, /storySubtitleRevealProgress/);
  assert.match(script, /prepareStorySubtitle/);
  assert.match(script, /function renderStoryCopy\(progress\)/);
  assert.match(script, /function heroOccludesStory\(\)/);
  assert.match(script, /function initMobileHeroTransition\(\)/);
  assert.match(
    script,
    /if\s*\(!depthViewport\.matches\)\s*\{\s*initMobileHeroTransition\(\);/,
  );
  assert.match(script, /aria-label/);
  assert.match(script, /addEventListener\(["']scroll["']/);
  assert.match(styles, /\.hero-wave-field/);
  assert.match(styles, /\.hero-sticky/);
  assert.match(styles, /--hero-copy-opacity/);
  assert.match(styles, /\.hero-sticky::after/);
  assert.match(styles, /linear-gradient\(to bottom, transparent/);
  assert.match(styles, /\.hero-copy\s*\{[^}]*text-align:\s*center;/s);
  assert.doesNotMatch(styles, /\.signal-field-canvas|\.signal-static-mark/);
  assert.doesNotMatch(styles, /\.product(?:\b|-)|\.field-work|\.agent-proof/);
  assert.doesNotMatch(styles, /\.contact(?:\b|\s|:)/);
  assert.match(styles, /\.about\s*\{[^}]*background:\s*var\(--bgColor-default\);/s);
  assert.match(styles, /\.signal-story-sticky/);
  assert.match(styles, /\.signal-story-subtitle/);
  assert.match(styles, /--copy-reveal/);
  assert.match(
    styles,
    /\.signal-story\[data-depth-demo="local"\]\s*\{\s*height:\s*1000svh;/,
  );
  assert.match(
    styles,
    /\.signal-story-copy\s*\{[^}]*z-index:\s*3;[^}]*background:\s*none;/s,
  );
  assert.doesNotMatch(
    styles,
    /\.signal-story-step-intro \.signal-story-copy\s*\{[^}]*radial-gradient/s,
  );
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /mask-image:/);
  assert.match(signalField, /layers:\s*12/);
  assert.match(signalField, /pulseDuration:\s*14/);
  assert.match(signalStory, /"unstructured"/);
  assert.match(signalStory, /"foundation"/);
  assert.match(signalStory, /particleCount:\s*8_000/);
  assert.match(heroTransition, /scrollViewports:\s*1/);
  assert.doesNotMatch(signalStory, /logo-generator|brand-system/);
  assert.doesNotMatch(
    html,
    /Data foundations|Decision systems|Small team\.<br>Direct collaboration/i,
  );
  assert.doesNotMatch(html, /_next|react|__next|data-reactroot/i);
});

test("optimizes the founder portrait for the public site", async () => {
  const portrait = await stat(
    new URL("dist/assets/images/jacob-oestergaard.webp", root),
  );

  assert.ok(portrait.size < 250_000, "founder portrait should stay below 250 KB");
});

test("ships an optimized standalone hero wave field", async () => {
  const background = await stat(
    new URL("dist/assets/images/hero-signal-waves.webp", root),
  );

  assert.ok(background.size < 300_000, "hero wave field should stay below 300 KB");
});

test("does not ship the removed LeapView product proof", async () => {
  await assert.rejects(
    access(new URL("dist/assets/images/leapview-dashboard-dark.png", root)),
    /ENOENT/,
  );
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
    readBuiltPage("assets/showcase.js"),
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
  const [globalCss, homeCss, showcaseCss, generatorCss, brandCss] = await Promise.all([
    readBuiltPage("assets/globals.css"),
    readBuiltPage("assets/home.css"),
    readBuiltPage("assets/showcase.css"),
    readBuiltPage("assets/generator.css"),
    readBuiltPage("assets/brand.css"),
  ]);

  for (const css of [globalCss, homeCss, showcaseCss, generatorCss, brandCss]) {
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
  }
  assert.match(homeCss, /@media\s*\(max-width:\s*720px\)/);
  assert.match(homeCss, /@media\s*\(max-width:\s*900px\)/);
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.hero-transition-canvas\s*\{[^}]*display:\s*none;/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story\s*\{[^}]*height:\s*340svh;[^}]*margin-top:\s*-100svh;/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story\[data-depth-demo="local"\]\s*\{\s*height:\s*340svh;/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story-sticky\s*\{[^}]*position:\s*sticky;[^}]*height:\s*100svh;/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story-canvas\s*\{(?=[^}]*display:\s*block;)(?=[^}]*top:\s*var\(--mobile-story-canvas-top\);)(?=[^}]*height:\s*var\(--mobile-story-canvas-height\);)[^}]*\}/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story-step,\s*\.signal-story-step:first-child\s*\{[^}]*padding-top:\s*calc\([^}]*--mobile-story-canvas-height[^}]*24px[^}]*\);/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story-copy,\s*\.signal-story-step-intro \.signal-story-copy\s*\{[^}]*width:\s*min\(calc\(100vw - 48px\), 420px\);/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story\.is-depth-live \.signal-story-copy,[\s\S]*?width:\s*min\(calc\(100vw - 48px\), 420px\);/,
  );
  assert.match(
    homeCss,
    /\.signal-story\[data-depth-demo="local"\]\s*\{\s*height:\s*1000svh;/,
  );
  assert.match(
    homeCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.signal-story\[data-depth-demo="local"\]\s*\{\s*height:\s*auto;/,
  );
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
