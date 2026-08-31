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
  assert.match(html, /An agent is only as reliable as the system beneath it/i);
  assert.doesNotMatch(html, /01 \/ Thesis|01 \/ Premise|02 \/ Foundation|04 \/ The lab/i);
  assert.doesNotMatch(html, /02 \/ Flagship product|The agent-native BI platform/i);
  assert.doesNotMatch(html, /03 \/ Field work|Selected field work keeps them honest/i);
  assert.doesNotMatch(html, /id="leapview"|id="field-work"/i);
  assert.doesNotMatch(html, /href="#leapview"|href="#field-work"/i);
  assert.match(html, /Jacob Østergaard/i);
  assert.match(html, /class="founder-portrait"/i);
  assert.doesNotMatch(html, /Ganesh Kambli|AI Engineer|Meet the team/i);
  assert.doesNotMatch(html, /production-ready backend and agentic AI systems/i);
  assert.doesNotMatch(html, /data-color-mode="light"/i);
  assert.doesNotMatch(html, /id="contact"|05 \/ Contact|Building something\s*<br>agents should operate/i);
  assert.match(
    html,
    /<img src="\/assets\/images\/jacob-oestergaard\.webp" alt="Jacob Østergaard, founder of Flid">/i,
  );
  assert.doesNotMatch(html, /ganesh-kambli\.webp/i);
  assert.doesNotMatch(html, /leapview-dashboard-dark\.png/i);
  assert.match(html, /hero-signal-waves\.webp/i);
  assert.match(html, /class="hero-wave-field"/i);
  assert.match(html, /data-hero-transition/i);
  assert.match(html, /<canvas[^>]+data-motion-sequence-canvas/i);
  assert.equal(
    (html.match(/<canvas\b/gi) || []).length,
    1,
    "the hero and story must share one continuous canvas",
  );
  assert.doesNotMatch(html, /data-hero-transition-canvas|data-story-canvas/i);
  assert.match(
    html,
    /href="mailto:jacob@flid\.ai"[^>]*>Get in touch\s*</i,
  );
  assert.match(html, /href="\/products\/"[^>]*>See our products\s*<span[^>]*>→<\/span>/i);
  assert.match(html, /href="\/products\/"[^>]*>Products\s*</i);
  assert.match(html, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Contact\s*</i);
  assert.match(html, /class="site-logo-wordmark"[^>]+lockup-primary-on-dark\.svg/);
  assert.match(html, /class="site-logo-mark"[^>]+mark-primary-on-dark\.svg/);
  assert.doesNotMatch(html, /data-signal-field|data-signal-canvas|hero-meta/i);
  assert.match(html, /data-signal-story/i);
  assert.doesNotMatch(html, /signal-story-static-mark/i);
  assert.match(html, /Build for agents from the ground up/i);
  assert.match(html, /governed data, explicit actions, and evidence/i);
  assert.doesNotMatch(html, /Every capability has a contract/i);
  assert.equal((html.match(/data-story-reveal/g) || []).length, 2);
  assert.doesNotMatch(html, /data-story-counter|signal-story-progress/i);
  assert.doesNotMatch(styles, /\.signal-story-progress/);
  assert.doesNotMatch(script, /data-story-counter|counter\.textContent/);
  assert.doesNotMatch(html, /signal-orbit|signal-node/);
  assert.match(html, /assets\/home\.js/i);
  assert.match(html, /mailto:jacob@flid\.ai/i);
  assert.match(html, /Start a conversation/i);
  assert.doesNotMatch(html, /Discuss a design partnership/i);
  assert.match(html, /Flid AI ApS/i);
  assert.match(html, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/i)?.[0] ?? "";
  assert.match(footer, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.doesNotMatch(footer, /flid\.ai|© 2026/i);
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
    /story\?\.dataset\.depthDemo\s*===\s*["']local["']\s*&&\s*!reducedMotion\.matches[\s\S]*?createSharedDepthSequence\(sequenceCanvas\)[\s\S]*?initDepthMotionSequence\(initialCanvas, depthSequence\)/,
  );
  assert.match(html, /data-depth-demo="local"/);
  await access(new URL("dist/assets/depth-reference/depth-story.mp4", root));
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
  assert.equal(
    (script.match(/new DepthVideoStory\(/g) || []).length,
    1,
    "the hero and story must share one video renderer",
  );
  assert.match(script, /function initDepthMotionSequence\(/);
  assert.doesNotMatch(script, /function initDepthHeroTransition\(/);
  assert.doesNotMatch(script, /function initDepthStory\(/);
  assert.match(script, /createMotionSequenceState\(/);
  assert.match(
    script,
    /if\s*\(!depthSequence\)\s*\{\s*if\s*\(!depthViewport\.matches\)\s*initMobileHeroTransition\(\);/,
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
  assert.match(
    styles,
    /\.about\s*\{(?=[^}]*position:\s*relative;)(?=[^}]*z-index:\s*3;)(?=[^}]*isolation:\s*isolate;)[^}]*\}/s,
  );
  assert.doesNotMatch(
    styles,
    /\.about\s*\{[^}]*border-top:/s,
    "the Independent by design section should not have a top divider",
  );
  assert.doesNotMatch(
    styles,
    /\.signal-story\s*\{[^}]*border-bottom:/s,
    "the preceding story should not recreate the same divider",
  );
  assert.match(styles, /\.signal-story-sticky/);
  assert.match(styles, /\.signal-story-subtitle/);
  assert.match(styles, /--copy-reveal/);
  assert.match(
    styles,
    /\.motion-sequence\s*\{[^}]*--motion-stage-height:\s*calc\(100svh \+ 80px\);/s,
  );
  assert.match(
    styles,
    /\.motion-sequence-stage\s*\{(?=[^}]*height:\s*var\(--motion-stage-height\);)(?![^}]*margin-bottom:)[^}]*\}/s,
    "the sticky stage needs a real layout height so it releases with its container",
  );
  assert.match(
    styles,
    /\.hero\s*\{[^}]*margin-top:\s*calc\(-1 \* var\(--motion-stage-height\) - 82px\);/s,
    "the hero should overlap the real sticky stage without collapsing its margin box",
  );
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

test("builds the products page as a standalone static route", async () => {
  const [html, styles] = await Promise.all([
    readBuiltPage("products/index.html"),
    readBuiltPage("assets/products.css"),
  ]);

  assert.match(html, /<title>Products — Flid<\/title>/i);
  assert.match(html, /Products where agents do real work/i);
  assert.match(html, /LeapView/i);
  assert.match(html, /href="https:\/\/leapview\.dev\/"[^>]*>Visit LeapView\s*</i);
  assert.match(html, /class="product-screenshot"/i);
  assert.match(
    html,
    /<img[^>]+src="\/assets\/images\/leapview-dashboard-dark\.png"[^>]+width="1440"[^>]+height="900"[^>]+alt="LeapView dashboard showing filters, governed KPIs, charts, and order data"/i,
  );
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Contact\s*</i);
  assert.match(html, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(html, /class="products-logo-wordmark"[^>]+lockup-primary-on-dark\.svg/);
  assert.match(html, /class="products-logo-mark"[^>]+mark-primary-on-dark\.svg/);
  const productsFooter = html.match(/<footer class="products-footer">[\s\S]*?<\/footer>/i)?.[0] ?? "";
  assert.match(productsFooter, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.doesNotMatch(productsFooter, /flid\.ai|© 2026/i);
  assert.match(styles, /\.products-page/);
  assert.doesNotMatch(html, /_next|react|__next|data-reactroot/i);
});

test("builds the About page as a dedicated team route", async () => {
  const [html, styles] = await Promise.all([
    readBuiltPage("about/index.html"),
    readBuiltPage("assets/about.css"),
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
  assert.match(html, /A Danish product lab building\s*<span>durable systems\.<\/span>/i);
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
    /href="https:\/\/www\.linkedin\.com\/in\/jacob-%C3%B8stergaard-nielsen-b39415183\/"[^>]*>Jacob Østergaard\s*<span[^>]*>↗<\/span>/i,
  );
  assert.match(
    html,
    /Jacob is the founder of Flid and product lead for LeapView\. Drawing on years of experience architecting enterprise data platforms and leading engineering teams, he designs the systems, interfaces, and governance that enable agents to participate reliably in real operational work\./i,
  );
  assert.match(html, /Ganesh Kambli/i);
  assert.match(html, /AI Engineer · Mumbai/i);
  assert.match(html, /The people building Flid\./i);
  assert.match(
    html,
    /Product direction and engineering stay closely connected—from first principles to production\./i,
  );
  assert.match(
    html,
    /Ganesh is an AI Engineer at Flid working on LeapView\. He builds product capabilities and the engineering foundations behind them, drawing on experience across backend systems, applied AI, cloud infrastructure, and security to create simple, reliable software for production\./i,
  );
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/ganeshkambli\/"/i);
  assert.match(html, /Anand Bora/i);
  assert.match(html, /AI Engineer · Pune/i);
  assert.match(
    html,
    /Anand is an AI Engineer at Flid working on LeapView\. He builds simple, accessible visual experiences for powerful systems, drawing on frontend architecture, product interfaces, and applied AI to create reliable software that connects intelligent technology with real-world workflows\./i,
  );
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/anand-bora\/"/i);
  assert.match(html, /jacob-oestergaard\.webp/i);
  assert.match(html, /ganesh-kambli\.webp/i);
  assert.match(html, /anand-bora\.webp/i);
  assert.match(html, /href="\/products\/"[^>]*>Products\s*</i);
  assert.match(html, /href="\/about\/"[^>]*>About\s*</i);
  assert.match(html, /href="mailto:jacob@flid\.ai"[^>]*>Contact\s*</i);
  assert.match(html, /Working on a hard agent-native problem\?/i);
  assert.doesNotMatch(html, /small team|small enough|Built across two places|Distributed between/i);
  assert.match(html, /Flid AI ApS · CVR 43463217 · Odense, Denmark/i);
  assert.match(styles, /\.about-page/);
  assert.match(styles, /\.about-team-grid/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.about-team-grid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(html, /_next|react|__next|data-reactroot/i);
});

test("uses a restrained shared type scale across About and Products", async () => {
  const [globals, about, products] = await Promise.all([
    readBuiltPage("assets/globals.css"),
    readBuiltPage("assets/about.css"),
    readBuiltPage("assets/products.css"),
  ]);

  assert.match(globals, /--font-size-page-title:\s*clamp\(3\.75rem, 6\.2vw, 6\.5rem\)/);
  assert.match(globals, /--font-size-section-title:\s*clamp\(2\.75rem, 4\.5vw, 4\.75rem\)/);
  assert.match(globals, /--font-size-feature-title:\s*clamp\(3rem, 5\.2vw, 5\.5rem\)/);
  assert.match(globals, /--font-size-lead:\s*clamp\(1\.25rem, 1\.6vw, 1\.625rem\)/);
  assert.match(globals, /--font-size-caption:\s*11px/);

  assert.match(about, /\.about-hero h1\s*{[\s\S]*?font-size:\s*var\(--font-size-page-title\)/);
  assert.match(about, /\.about-story h2\s*{[\s\S]*?font-size:\s*var\(--font-size-section-title\)/);
  assert.match(about, /\.about-story-copy \.about-story-lead\s*{[\s\S]*?font-size:\s*var\(--font-size-lead\)/);
  assert.match(about, /@media \(max-width: 900px\)[\s\S]*?\.about-story-grid\s*{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(about, /@media \(max-width: 720px\)[\s\S]*?\.about-hero h1\s*{[\s\S]*?font-size:\s*clamp\(2\.8rem, 12vw, 4rem\)/);

  assert.match(products, /\.products-hero h1\s*{[\s\S]*?font-size:\s*var\(--font-size-page-title\)/);
  assert.match(products, /\.product-card-body h2\s*{[\s\S]*?font-size:\s*var\(--font-size-feature-title\)/);
  assert.match(products, /\.product-card-summary\s*{[\s\S]*?font-size:\s*var\(--font-size-lead\)/);
  assert.match(products, /@media \(max-width: 720px\)[\s\S]*?\.products-hero h1\s*{[\s\S]*?font-size:\s*clamp\(2\.8rem, 12vw, 4rem\)/);
});

test("optimizes the founder portrait for the public site", async () => {
  const portrait = await stat(
    new URL("dist/assets/images/jacob-oestergaard.webp", root),
  );

  assert.ok(portrait.size < 250_000, "founder portrait should stay below 250 KB");
});

test("optimizes the AI engineer portrait for the public site", async () => {
  const portrait = await stat(
    new URL("dist/assets/images/ganesh-kambli.webp", root),
  );

  assert.ok(portrait.size < 250_000, "AI engineer portrait should stay below 250 KB");
});

test("optimizes Anand's portrait for the public site", async () => {
  const portrait = await stat(
    new URL("dist/assets/images/anand-bora.webp", root),
  );

  assert.ok(portrait.size < 250_000, "Anand's portrait should stay below 250 KB");
});

test("ships an optimized standalone hero wave field", async () => {
  const background = await stat(
    new URL("dist/assets/images/hero-signal-waves.webp", root),
  );

  assert.ok(background.size < 300_000, "hero wave field should stay below 300 KB");
});

test("ships an optimized LeapView product screenshot", async () => {
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
  assert.match(homeCss, /\.motion-sequence-stage/);
  assert.match(homeCss, /\.site-logo-mark\s*\{[\s\S]*?transition:\s*transform/);
  assert.match(homeCss, /\.site-logo:hover \.site-logo-mark[\s\S]*?transform:\s*rotate\(360deg\)/);
  assert.match(homeCss, /\.button:hover[\s\S]*?background:\s*var\(--bgColor-accent-emphasis\)/);
  assert.match(homeCss, /\.motion-sequence-canvas/);
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
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.motion-sequence\s*\{(?=[^}]*--motion-stage-height:\s*var\(--mobile-story-canvas-height\);)(?=[^}]*--mobile-story-canvas-top:)[^}]*\}/,
  );
  assert.match(
    homeCss,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.motion-sequence-stage\s*\{(?=[^}]*top:\s*var\(--mobile-story-canvas-top\);)(?![^}]*margin-bottom:)[^}]*\}/,
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
  assert.match(
    homeCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.motion-sequence-stage\s*\{[^}]*display:\s*none;/,
  );
  assert.match(
    homeCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.hero\s*\{(?=[^}]*height:\s*100svh;)(?=[^}]*margin-top:\s*-82px;)[^}]*\}/,
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
