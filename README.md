# Flid

Framework-free website and complete identity repository for Flid, an
independent product lab building agent-native software.

## Run locally

Requirements: Node.js 22.13 or newer, Go 1.22 or newer, and Task 3.

```bash
npm install
task dev
```

Open:

- Public site: `http://localhost:3000`
- Brand guide: `http://localhost:3000/brand/`
- Logo showcase: `http://localhost:3000/showcase`
- Logo generator: `http://localhost:3000/generator`

## Commands

- `task dev` builds the site and serves it locally with the Go development server.
- `npm run build` copies the deployable static site to `dist/`.
- `npm run assets` regenerates the complete committed brand package.
- `npm run dev` and `npm run start` are aliases for `task dev`.
- `npm test` builds the site and runs the JavaScript and Go tests.
- `npm run lint` syntax-checks the JavaScript modules.

## Architecture

The site uses plain HTML, CSS, and browser-native JavaScript modules. There is
no application framework or runtime dependency.

- `site/index.html` is the public product-lab homepage. It presents the
  agent-native thesis and team.
- `site/products/` is the public product index. It presents LeapView with a
  current product screenshot and links to the product site.
- `site/about/` is the public company and team page. The homepage keeps its
  founder-led company introduction while the full team lives on this route.
- `site/assets/home.js` progressively enhances the hero and desktop thesis
  story with the canonical 12-layer signal model. The thesis morph is driven
  by scroll position; tablets, phones, and reduced-motion users receive the
  complete static narrative instead.
- `site/brand/` is the canonical brand guide and asset reference.
- `site/showcase/` and `site/generator/` are supporting identity tools.
- `site/assets/images/leapview-dashboard-dark.png` is the committed LeapView
  product proof shown on the products page.
- `app/**/*.css` contains the page styles.
- `Jacob Østergaard 1.png` and `Ganesh Kambli.png` are the source portraits
  used to generate optimized WebP images during the static build.
- `lib/brand-system.mjs` is the approved brand specification.
- `lib/logo-generator.mjs` is the deterministic SVG implementation.
- `lib/signal-scroll-story.mjs` maps thesis scroll progress to a deterministic
  particle field. It remains deliberately separate from the production logo.
- `scripts/generate-brand-assets.mjs` creates approved marks, Geist wordmark
  lockups, raster exports, print PDFs, favicons, social images, and
  `brand-assets/manifest.json`.
- `scripts/build.mjs` creates `dist/`.
- `cmd/devserver/` contains the Go development server used by `task dev`.

The public website and identity reference are separate experiences with
separate HTML and CSS entry points. The public site does not link to the brand
guide; they share only the canonical generated assets, font, and Primer color
tokens.

## Logo system

The vanilla generator exposes controls for layers, curl, twist, line weight,
signal accents, and colors. It expands each constructed curve into a closed,
filled vector outline when exporting SVG, rather than relying on renderer-
dependent strokes.

`logo.txt` is retained only as the original visual reference. The website uses
the independently generated procedural mark.

## Asset policy

The committed `brand-assets/` directory is the distributable brand package.
Run `npm run assets` whenever the brand specification or generator changes.
Every site build independently regenerates the same package in
`dist/brand-assets/`; tests reject drift between the two manifests.

- The 12-layer open-field mark is the sole approved production identity at
  every size and on every platform.
- The 8- and 16-layer variants remain in the package as archived explorations
  only; they must not substitute for the production mark.
- The approved mark-only SVG uses a tight `0 0 100 100` artwork box.
- Clear space belongs to the placement context, not the mark file.
- Signal curves are expanded to filled outlines. Standard assets scale as
  complete artwork, so the mark geometry and apparent weight stay in proportion.
- Do not resize paths independently or add strokes to exported artwork.
- Horizontal lockups use Geist SemiBold at weight 600 with native kerning.
- Wordmarks are converted to vector outlines, so downloaded SVGs do not depend
  on a locally installed font.
- The approved production family includes SVG, vector PDF, and transparent PNG
  exports at 1x, 2x, and 4x.
- Browser, app, touch, profile, and 1200x630 sharing assets are included.
- LinkedIn company (1128x191) and personal (1584x396) banners are included in
  dark and light modes, with editable SVG sources and upload-ready PNG files.
- Square LinkedIn company-logo PNGs are included with opaque dark and light
  backgrounds and documented small-format optical compensation, so the
  12-layer geometry remains legible after platform scaling.
- Optical compensation is reserved for explicitly named small-platform
  exports; it never replaces or modifies the canonical vector master.
- The pinned Geist source and SIL Open Font License live in `vendor/geist/`.
- `dist/brand-assets/manifest.json` records status, theme, master, minimum size,
  and intended role for every export.

## GitHub Pages

`.github/workflows/pages.yml` tests, builds, and deploys `dist/` whenever
`main` is pushed. The deployment builds with root-relative URLs for the
configured `flid.ai` custom domain.

Before the first deployment:

1. In the GitHub repository, open **Settings → Pages** and choose
   **GitHub Actions** as the source.
2. Add `flid.ai` under **Custom domain** after verifying domain ownership.
3. Configure the apex and `www` DNS records using GitHub's current Pages
   instructions, then enable HTTPS.

Custom-workflow deployments configure the domain in repository settings; they
do not rely on a committed `CNAME` file.
