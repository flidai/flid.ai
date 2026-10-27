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

test("touch targets and the label floor reach tablets and phone landscape", async () => {
  const [brand, showcase, generator] = await Promise.all([
    read("app/brand/brand.css"),
    read("app/showcase/showcase.css"),
    read("app/generator/generator.css"),
  ]);
  const touch = "(max-width: 1080px), (pointer: coarse)";

  assert.match(mediaBlock(brand, touch), /\.asset-downloads a \{[^}]*min-height:\s*44px/);
  assert.match(mediaBlock(showcase, touch), /\.showcase-header nav a/);
  assert.match(mediaBlock(generator, touch), /\.generator-header nav a/);
  for (const css of [brand, showcase, generator]) {
    assert.match(mediaBlock(css, "(max-width: 1080px)"), /font-size:\s*var\(--text-micro\)/);
  }
  // Keep the arrow with its text so it never wraps alone at 360px.
  assert.match(await read("site/showcase/index.html"), /brand guide&nbsp;↗/);
});

test("brand page restores hash and scroll positions after async sections render", async () => {
  const [script, html, css] = await Promise.all([
    read("site/assets/brand.js"),
    read("site/brand/index.html"),
    read("app/brand/brand.css"),
  ]);

  assert.match(script, /scrollRestoration = "manual"/);
  assert.match(script, /scrollIntoView\(\{ block: "start", behavior: "instant" \}\)/);
  assert.match(script, /\.finally\(\(\) => requestAnimationFrame\(restoreScroll\)\)/);
  assert.match(script, /new IntersectionObserver/);
  assert.match(script, /aria-current/);
  assert.match(script, /loading="lazy" decoding="async"/);
  // Previews are plain images; only the labelled links download.
  assert.doesNotMatch(script, /<a class="asset-preview/);
  assert.match(script, /aria-label="\$\{label\} — \$\{downloadLabel\}"/);
  for (const section of ["typography", "color", "usage", "generator"]) {
    assert.match(html, new RegExp(`class="guide-nav-more" href="#${section}"`));
  }
  assert.match(html, /<pre[^>]*tabindex="0"[^>]*role="region"/);
  assert.match(css, /@media \(hover: hover\) \{\s*\.guide-header a:hover/);
  assert.match(
    mediaBlock(css, "(max-width: 1080px) and (max-height: 500px)"),
    /\.guide-header \{\s*position:\s*static/,
  );
});

test("showcase and generator pages declare the shared icon set", async () => {
  for (const page of ["showcase", "generator", "brand"]) {
    const html = await read(`site/${page}/index.html`);

    assert.match(html, /<link rel="icon" href="\/brand-assets\/favicon\.svg"/, page);
    assert.match(html, /<link rel="apple-touch-icon"/, page);
    assert.match(html, /<link rel="manifest" href="\/brand-assets\/favicon\/site\.webmanifest">/, page);
  }
});
