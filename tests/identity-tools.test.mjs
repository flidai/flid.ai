import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Source-level contracts for the brand, showcase, and generator pages. They read the
// authored files directly so they never depend on a stale dist/ build.
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function mediaBlock(css, query) {
  const start = css.indexOf(`@media ${query} {`);
  assert.notEqual(start, -1, `missing @media ${query}`);
  let depth = 0;
  for (let index = css.indexOf("{", start); index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}" && (depth -= 1) === 0) {
      return css.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated @media ${query}`);
}

test("generator sliders have stable accessible names and value text", async () => {
  const html = await read("site/generator/index.html");
  const sliders = [...html.matchAll(/<input id="generator-(\w+)"[^>]*type="range"[^>]*>/g)];

  assert.equal(sliders.length, 5);
  for (const [tag, name] of sliders) {
    assert.match(tag, new RegExp(`aria-labelledby="generator-${name}-label"`));
    assert.match(tag, /aria-valuetext="[^"]+"/);
    assert.match(tag, /autocomplete="off"/);
    // The label name must exclude the changing <output> so it is not re-announced per step.
    assert.match(html, new RegExp(`<span id="generator-${name}-label">[^<]+</span>`));
    assert.match(
      html,
      new RegExp(`<output for="generator-${name}" data-output="${name}" aria-hidden="true">`),
    );
  }
  assert.equal((html.match(/data-color="\w+"[^>]*autocomplete="off"/g) ?? []).length, 2);
  assert.equal((html.match(/data-(?:preset|mode)="\w+"[^>]*aria-pressed="(?:true|false)"/g) ?? []).length, 5);
});

test("generator coalesces renders, derives presets, and exports safely", async () => {
  const script = await read("site/assets/generator.js");

  assert.match(script, /requestAnimationFrame/);
  assert.match(script, /function activePreset/);
  assert.match(script, /aria-pressed/);
  assert.match(script, /aria-valuetext/);
  assert.match(script, /addEventListener\("pageshow"/);
  assert.match(script, /EXPORT_DEBOUNCE_MS = 600/);
  assert.match(script, /flid-signal-\$\{options\.mode\}-\$\{options\.layers\}l-\$\{hashOptions\(\)\}\.svg/);
  assert.match(script, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 1000\)/);
  assert.doesNotMatch(script, /link\.remove\(\);\s*URL\.revokeObjectURL/);
  // Slider drags schedule one frame; they must not render synchronously.
  assert.match(
    script,
    /addEventListener\("input", \(\) => \{[\s\S]*?scheduleRender\(\);/,
  );
  // Drags draw a light draft at reduced precision; release and idle settle on full quality.
  assert.match(script, /full: \{ compact: true \}/);
  assert.match(script, /draft: \{ compact: true, precision: 2, quality: "draft" \}/);
  assert.match(script, /render\("draft"\)/);
  assert.match(script, /SETTLE_DELAY_MS/);
  assert.match(script, /addEventListener\("change", renderNow\)/);
  // Exports stay canonical: no preview options reach the downloaded SVG.
  assert.match(script, /const svg = generateLogoSvg\(\{ \.\.\.options, size: EXPORT_SIZE_PX \}\);/);
  assert.doesNotMatch(script.slice(script.indexOf("function downloadSvg")), /PREVIEW_RENDERING/);
});

test("generator preview paints on its own layer", async () => {
  const css = await read("app/generator/generator.css");
  const preview = css.match(/\.generator-preview \{[^}]*\}/)?.[0] ?? "";

  assert.match(preview, /contain:\s*layout paint style/);
  assert.match(preview, /will-change:\s*transform/);
});

test("generator touch controls have 44px hit areas without growing the layout", async () => {
  const css = await read("app/generator/generator.css");
  const touch = mediaBlock(css, "(max-width: 1080px), (pointer: coarse)");

  assert.match(touch, /input\[type="range"\] \{[^}]*height:\s*44px[^}]*margin-block:/);
  assert.match(touch, /\.generator-color-row input \{[^}]*width:\s*44px[^}]*height:\s*44px/);
  assert.match(touch, /\.generator-mode button \{[^}]*min-height:\s*44px/);
});

test("generator layout keeps the preview in view without dead space", async () => {
  const css = await read("app/generator/generator.css");
  const stage = css.match(/\.generator-stage \{[^}]*\}/)?.[0] ?? "";
  const narrow = mediaBlock(css, "(max-width: 960px)");
  const landscape = mediaBlock(
    css,
    "(max-width: 960px) and (max-height: 520px) and (orientation: landscape)",
  );

  assert.match(stage, /position:\s*sticky/);
  assert.match(stage, /height:\s*100svh/);
  assert.doesNotMatch(css, /margin-bottom:\s*max\(240px/);
  assert.match(narrow, /scroll-padding-top:/);
  assert.match(narrow, /scroll-padding-bottom:/);
  assert.match(narrow, /min-height:\s*var\(--generator-stage-height\)/);
  assert.match(landscape, /grid-template-columns:/);
  assert.match(landscape, /\.generator-actions \{[^}]*position:\s*static/);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("touch targets reach tablets and phone landscape", async () => {
  const [brand, showcase, generator, header] = await Promise.all([
    read("app/brand/brand.css"),
    read("app/showcase/showcase.css"),
    read("app/generator/generator.css"),
    read("app/identity/identity-header.css"),
  ]);
  const touch = "(max-width: 1080px), (pointer: coarse)";

  assert.match(mediaBlock(brand, touch), /\.asset-downloads a \{[^}]*min-height:\s*44px/);
  // Text links are themselves 44px tall; a pseudo-element hit area does not count.
  assert.match(
    mediaBlock(brand, touch),
    /\.asset-manifest-link a \{[^}]*min-height:\s*44px/,
  );
  assert.doesNotMatch(brand, /a::after \{[^}]*inset:\s*-14px/);
  assert.match(mediaBlock(showcase, touch), /\.showcase-footer a/);
  assert.match(generator, /\.generator-mode button/);
  assert.match(header, /\.tool-header-nav a \{[^}]*min-height:\s*44px/);
  assert.match(header, /\.tool-site-link \{[^}]*min-height:\s*44px/);
  // Keep the arrow with its text so it never wraps alone at 360px.
  assert.match(await read("site/showcase/index.html"), /Brand guide&nbsp;↗/);
});

test("labels never drop below 11px and scale up on large screens", async () => {
  const sheets = await Promise.all(
    ["app/brand/brand.css", "app/showcase/showcase.css", "app/generator/generator.css"].map(
      async (path) => [path, await read(path)],
    ),
  );

  for (const [path, css] of sheets) {
    assert.match(
      css,
      /--text-micro:\s*clamp\(0\.6875rem,[^;]+,\s*0\.9375rem\)/,
      `${path} defines the 11px floor with a large-screen ramp`,
    );
    for (const [, value] of css.matchAll(/font-size:\s*([^;]+);/g)) {
      const literal = value.match(/^([\d.]+)(rem|px)$/);
      if (!literal) continue;
      const pixels = Number(literal[1]) * (literal[2] === "rem" ? 16 : 1);
      assert.ok(pixels >= 11, `${path}: font-size ${value} is below 11px`);
    }
    // The floor is global now; it must not be limited to small viewports again.
    assert.doesNotMatch(css, /11px floor for labels/, path);
  }
});

test("download links only change colour on hover for hover-capable pointers", async () => {
  const css = await read("app/brand/brand.css");
  const unguarded = css.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}\n/g, "");

  assert.doesNotMatch(unguarded, /\.asset-downloads a:hover/);
  assert.doesNotMatch(css, /\.asset-card:focus-within footer/);
  assert.match(css, /@media \(hover: hover\) \{\s*\.asset-downloads a:hover/);
  assert.match(css, /\.asset-downloads a:focus-visible/);
  // Desktop links meet the 24px target size without the touch media query.
  assert.match(css, /\.asset-downloads a \{\s*min-height:\s*24px/);
});

test("brand source panel never traps a short landscape viewport", async () => {
  const css = await read("app/brand/brand.css");

  assert.match(css, /\.guide-code-source pre \{[^}]*max-height:\s*min\(720px,\s*70svh\)/);
  assert.match(css, /overscroll-behavior-x:\s*contain/);
  assert.doesNotMatch(css, /max-height:\s*720px/);
});

test("brand scale references reserve their size before the image loads", async () => {
  const [script, css] = await Promise.all([
    read("site/assets/brand.js"),
    read("app/brand/brand.css"),
  ]);

  assert.match(script, /width="\$\{width\}" height="\$\{height\}" loading="lazy"/);
  assert.match(css, /\.reference-asset\.is-lockup \{[^}]*aspect-ratio:\s*297 \/ 128/);
});

test("brand downloads name their pixel size and spell LinkedIn correctly", async () => {
  const script = await read("site/assets/brand.js");

  assert.match(script, /`PNG \$\{png\.scale\}× · \$\{pixels\}`/);
  assert.match(script, /\$\{png\.width\}×\$\{png\.height\}/);
  assert.match(script, /replace\(\/\\bLinkedin\\b\/g, "LinkedIn"\)/);
});

test("all three tools share the public site header and a skip link", async () => {
  const pages = {
    brand: await read("site/brand/index.html"),
    showcase: await read("site/showcase/index.html"),
    generator: await read("site/generator/index.html"),
  };

  for (const [name, html] of Object.entries(pages)) {
    const header = html.match(/<header class="[^"]*tool-header[^"]*">[\s\S]*?<\/header>/)?.[0];

    assert.ok(header, `${name} uses the shared tool header`);
    assert.match(header, /<a class="tool-logo" href="\/" aria-label="Flid home">/, name);
    assert.match(header, /src="\/assets\/images\/site-wordmark-on-dark\.svg"/, name);
    assert.match(header, /src="\/assets\/images\/site-mark-on-dark\.webp"/, name);
    assert.match(header, /<a class="tool-site-link" href="\/">Public site(?:&nbsp;| )↗<\/a>/, name);
    assert.doesNotMatch(header, /IDENTITY LAB<|SIGNAL LAB<|brand-assets\/lockup/, name);
    assert.match(html, /href="\/assets\/identity-header\.css"/, name);
    assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/, name);
    assert.match(html, /<main class="[^"]+" id="main" tabindex="-1">/, name);
    // The skip link is the first focusable element.
    assert.ok(html.indexOf('class="skip-link"') < html.indexOf("<header"), name);
  }
  // Each tool still has its own navigation.
  assert.match(pages.brand, /<nav aria-label="Brand guide navigation">/);
  assert.match(pages.showcase, /<nav class="tool-header-nav" aria-label="Logo showcase navigation">/);
  assert.match(pages.generator, /<nav class="tool-header-nav" aria-label="Signal lab navigation">/);
  assert.match(pages.generator, /Brand guide&nbsp;↗/);
});

test("brand page restores hash and scroll positions after async sections render", async () => {
  const [script, html, css] = await Promise.all([
    read("site/assets/brand.js"),
    read("site/brand/index.html"),
    read("app/brand/brand.css"),
  ]);

  assert.match(script, /scrollRestoration = "manual"/);
  assert.match(script, /scrollIntoView\(\{ block: "start", behavior: "instant" \}\)/);
  assert.match(script, /\.finally\(scheduleRestore\)/);
  assert.match(script, /loading="lazy" decoding="async"/);
  // Previews are plain images; only the labelled links download.
  assert.doesNotMatch(script, /<a class="asset-preview/);
  assert.match(script, /aria-label="\$\{label\} — \$\{downloadLabel\}"/);
  for (const section of ["typography", "color", "usage", "generator"]) {
    assert.match(html, new RegExp(`class="guide-nav-more" href="#${section}"`));
  }
  assert.match(html, /<pre[^>]*tabindex="0"[^>]*role="region"/);
  assert.match(
    css,
    /@media \(hover: hover\) \{\s*\.guide-header nav a:hover,\s*\.guide-header-actions a:hover/,
  );
  assert.match(
    mediaBlock(css, "(max-width: 1080px) and (max-height: 500px)"),
    /\.guide-header \{\s*position:\s*static/,
  );
  // Every section is in the desktop header once there is room for it.
  assert.match(
    mediaBlock(css, "(min-width: 1280px)"),
    /\.guide-nav-more \{\s*display:\s*inline-flex/,
  );
});

test("brand restore does not depend on a single animation frame", async () => {
  const script = await read("site/assets/brand.js");

  // requestAnimationFrame is paused in hidden pages, so a timer and pageshow back it up.
  assert.match(script, /requestAnimationFrame\(restoreScroll\);\s*setTimeout\(restoreScroll, \d+\)/);
  assert.match(script, /addEventListener\("pageshow"/);
  // Late layout above the target (images, fonts) re-applies it until the reader scrolls.
  assert.match(script, /new ResizeObserver/);
  assert.match(script, /userScrolled/);
  assert.match(script, /SETTLE_WINDOW_MS/);
});

test("brand chips follow taps first and scrolling after", async () => {
  const script = await read("site/assets/brand.js");

  // Tapping a chip marks it at once instead of waiting for the scroll to pass a band.
  assert.match(script, /chip\.addEventListener\("click", \(\) => \{\s*setActiveChip\(chip\);/);
  assert.match(script, /addEventListener\("scrollend"/);
  assert.match(script, /requestAnimationFrame\(\(\) => \{\s*scrollFrame = 0;\s*updateActiveChip\(\);/);
  assert.match(script, /aria-current/);
  // The chip row scrolls on its own; scrollIntoView could move the page too.
  assert.match(script, /chipRow\.scrollBy/);
  assert.doesNotMatch(script, /chip\.scrollIntoView/);
  assert.doesNotMatch(script, /new IntersectionObserver/);
});

test("showcase and generator pages declare the shared icon set", async () => {
  for (const page of ["showcase", "generator", "brand"]) {
    const html = await read(`site/${page}/index.html`);

    assert.match(html, /<link rel="icon" href="[^"]+\.svg" type="image\/svg\+xml">/, page);
    assert.match(html, /<link rel="apple-touch-icon"/, page);
    assert.match(html, /<link rel="manifest" href="[^"]+">/, page);
  }
});

test("the showcase is prerendered at build time with one shared file per mark", async () => {
  const { injectShowcase, renderShowcase } = await import(
    new URL("lib/showcase-markup.mjs", root)
  );
  const source = await read("site/showcase/index.html");
  const { slots, files } = renderShowcase();
  const page = injectShowcase(source, slots);

  // No script is needed to see the page, and every slot was filled.
  assert.doesNotMatch(source, /<script/);
  assert.doesNotMatch(page, /<script/);
  assert.equal(Object.keys(slots).length, 7);
  for (const attribute of Object.keys(slots)) {
    assert.doesNotMatch(page, new RegExp(`${attribute}></`), attribute);
  }
  assert.equal((page.match(/class="showcase-mark"/g) ?? []).length, 27);
  assert.doesNotMatch(page, /<svg|<mask|<path/, "marks are image files, never inline markup");

  // Equal marks share one file, and every referenced file exists with its own mask.
  const referenced = new Set([...page.matchAll(/src="(\/showcase\/marks\/[^"]+\.svg)"/g)].map((m) => m[1]));
  assert.deepEqual([...referenced].sort(), [...files.keys()].sort());
  assert.ok(files.size < 27 && files.size >= 10, `${files.size} distinct marks`);
  const maskIds = [];
  for (const svg of files.values()) {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
    assert.doesNotMatch(svg, /undefined|NaN/);
    maskIds.push(...[...svg.matchAll(/<mask id="([^"]+)"/g)].map((m) => m[1]));
  }
  assert.ok(maskIds.length >= 5, "silhouette marks keep their masks inside their own file");
  // Only the hero mark loads eagerly, at high priority; the rest must not compete with it.
  assert.equal((page.match(/loading="eager" fetchpriority="high"/g) ?? []).length, 1);
  assert.equal((page.match(/loading="lazy"/g) ?? []).length, 26);
  // Shared files keep the whole showcase well below the 4.6 MB of inline SVG it replaced.
  const bytes = [...files.values()].reduce((sum, svg) => sum + svg.length, 0);
  assert.ok(bytes < 2_200_000, `marks total ${bytes} bytes`);
});

test("the showcase injector refuses a page that lost a slot", async () => {
  const { injectShowcase, renderShowcase } = await import(
    new URL("lib/showcase-markup.mjs", root)
  );
  const { slots } = renderShowcase();
  const source = (await read("site/showcase/index.html")).replace(" data-scale-board", "");

  assert.throws(() => injectShowcase(source, slots), /data-scale-board/);
});

test("the showcase heading stays inside a 320px column at larger text sizes", async () => {
  const css = await read("app/showcase/showcase.css");

  assert.match(css, /\.matrix-variation h2 \{\s*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.matrix-variation h2 \{\s*(?:\/\*[^*]*\*\/\s*)?font-size:\s*clamp\(1\.75rem,\s*7vw,\s*2\.5rem\)/);
  assert.doesNotMatch(css, /\.showcase-mark svg/);
});

test("the showcase loads archive fonts without blocking first paint", async () => {
  const html = await read("site/showcase/index.html");
  const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g) ?? [];

  assert.equal(fonts.length, 2);
  assert.match(fonts[0], /media="print" onload="this\.media='all'"/);
  assert.match(html, /<noscript><link href="https:\/\/fonts\.googleapis\.com/);
});
