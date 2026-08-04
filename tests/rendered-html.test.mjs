import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readBuiltPage(pathname) {
  return readFile(new URL(`dist/${pathname}`, root), "utf8");
}

test("builds the Flid public site at the root as plain HTML", async () => {
  const [html, script, styles, signalField, signalStory] = await Promise.all([
    readBuiltPage("index.html"),
    readBuiltPage("assets/home.js"),
    readBuiltPage("assets/home.css"),
    readBuiltPage("lib/hero-signal-field.mjs"),
    readBuiltPage("lib/signal-scroll-story.mjs"),
  ]);

  assert.match(html, /<title>Flid — Agent-native product lab<\/title>/i);
  assert.match(html, /We build products where agents do real work/i);
  assert.match(html, /Software was built for people/i);
  assert.match(html, /The agent-native BI platform/i);
  assert.match(html, /LeapView/i);
  assert.match(html, /Selected field work keeps them honest/i);
  assert.match(html, /data platform agent-native/i);
  assert.match(html, /Jacob Østergaard/i);
  assert.match(html, /jacob-oestergaard\.webp/i);
  assert.match(html, /leapview-dashboard-dark\.png/i);
  assert.match(html, /data-signal-field/i);
  assert.match(html, /<canvas[^>]+data-signal-canvas/i);
  assert.match(html, /data-signal-story/i);
  assert.match(html, /<canvas[^>]+data-story-canvas/i);
  assert.doesNotMatch(html, /signal-story-static-mark/i);
  assert.match(html, /governed context, shared definitions/i);
  assert.match(html, /Every capability has a contract/i);
  assert.match(html, /That is what agent-native means/i);
  assert.equal((html.match(/data-story-reveal/g) || []).length, 4);
  assert.doesNotMatch(html, /signal-orbit|signal-node/);
  assert.match(html, /assets\/home\.js/i);
  assert.match(html, /mailto:hello@flid\.ai/i);
  assert.match(html, /Flid AI ApS/i);
  assert.match(html, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.match(html, /Odense · Denmark/i);
  assert.match(
    html,
    /Flid is Danish for diligence—the care, persistence, and attention behind work made to last\./i,
  );
  assert.doesNotMatch(html, /Copenhagen/i);
  assert.match(script, /hero-signal-field\.mjs/);
  assert.match(script, /signal-scroll-story\.mjs/);
  assert.match(script, /depth-video-story\.mjs/);
  assert.match(script, /min-width:\s*901px/);
  assert.match(html, /data-depth-demo="disabled"/);
  await assert.rejects(
    access(new URL("dist/assets/depth-reference", root)),
    /ENOENT/,
  );
  assert.match(script, /visitSignalStoryFrame/);
  assert.match(script, /getContext\(["']2d["']\)/);
  assert.match(script, /devicePixelRatio/);
  assert.match(script, /document\.hidden/);
  assert.match(script, /matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\)/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /requestAnimationFrame/);
  assert.match(script, /hasRenderableSurface/);
  assert.match(script, /heroActivityDeadline/);
  assert.match(script, /heroIdleDuration/);
  assert.match(script, /storySubtitleRevealProgress/);
  assert.match(script, /prepareStorySubtitle/);
  assert.match(script, /aria-label/);
  assert.match(script, /performance\.now\(\) < heroActivityDeadline/);
  assert.doesNotMatch(
    script,
    /draw\(elapsedSeconds\);\s*animationFrame = requestAnimationFrame\(animate\);/,
  );
  assert.match(script, /addEventListener\(["']scroll["']/);
  assert.match(styles, /\.signal-field-canvas/);
  assert.match(styles, /\.signal-story-sticky/);
  assert.match(styles, /\.signal-story-subtitle/);
  assert.match(styles, /--copy-reveal/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /mask-image:/);
  assert.match(signalField, /layers:\s*12/);
  assert.match(signalField, /pulseDuration:\s*14/);
  assert.match(signalStory, /"unstructured"/);
  assert.match(signalStory, /"foundation"/);
  assert.match(signalStory, /particleCount:\s*8_000/);
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

test("ships the LeapView product proof with the public site", async () => {
  const screenshot = await stat(
    new URL("dist/assets/images/leapview-dashboard-dark.png", root),
  );

  assert.ok(screenshot.size < 250_000, "LeapView screenshot should stay below 250 KB");
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
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.signal-story\[data-depth-demo="local"\]\s*\{\s*height:\s*auto;/,
  );
  assert.match(
    homeCss,
    /\.signal-story\[data-depth-demo="local"\]\s*\{\s*height:\s*2000svh;/,
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
