# Flid

Framework-free website and complete identity repository for Flid, an
independent product lab building agent-native software.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open:

- Public site: `http://localhost:3000`
- Brand guide: `http://localhost:3000/brand/`
- Logo showcase: `http://localhost:3000/showcase`
- Logo generator: `http://localhost:3000/generator`

## Commands

- `npm run dev` builds and serves the static site locally.
- `npm run build` copies the deployable static site to `dist/`.
- `npm run assets` regenerates the complete committed brand package.
- `npm run start` builds and serves the static site locally.
- `npm test` builds the site and runs all tests.
- `npm run lint` syntax-checks the JavaScript modules.

## Architecture

The site uses plain HTML, CSS, and browser-native JavaScript modules. There is
no application framework or runtime dependency.

- `site/index.html` is the public one-page product-lab site. It presents the
  agent-native thesis, LeapView flagship product, selective field work, and
  founder.
- `site/assets/home.js` progressively enhances the hero with the canonical
  12-layer signal model. The approved static mark remains the no-script and
  reduced-motion fallback.
- `site/brand/` is the canonical brand guide and asset reference.
- `site/showcase/` and `site/generator/` are supporting identity tools.
- `site/assets/images/leapview-dashboard-dark.png` is the committed LeapView
  product proof shown on the public site.
- `app/**/*.css` contains the page styles.
- `Jacob Østergaard 1.png` is the source portrait used to generate an optimized
  WebP during the static build.
- `lib/brand-system.mjs` is the approved brand specification.
- `lib/logo-generator.mjs` is the deterministic SVG implementation.
- `scripts/generate-brand-assets.mjs` creates approved marks, Geist wordmark
  lockups, raster exports, print PDFs, favicons, social images, and
  `brand-assets/manifest.json`.
- `scripts/build.mjs` creates `dist/`.
- `scripts/server.mjs` serves the built files with clean directory URLs.

The public website and identity reference are separate experiences with
separate HTML and CSS entry points. The public site does not link to the brand
guide; they share only the canonical generated assets, font, and Primer color
tokens.

## Logo system

The vanilla generator exposes controls for layers, curl, twist, line weight,
signal accents, and colors. Exported marks are standalone SVG files.

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
- Horizontal lockups use Geist SemiBold at weight 600 with native kerning.
- Wordmarks are converted to vector outlines, so downloaded SVGs do not depend
  on a locally installed font.
- The approved production family includes SVG, vector PDF, and transparent PNG
  exports at 1x, 2x, and 4x.
- Browser, app, touch, profile, and 1200x630 sharing assets are included.
- LinkedIn company (1128x191) and personal (1584x396) banners are included in
  dark and light modes, with editable SVG sources and upload-ready PNG files.
- Square LinkedIn company-logo PNGs are included with opaque dark and light
  backgrounds so social platforms cannot replace the intended canvas.
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
