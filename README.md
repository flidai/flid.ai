# Flid

Framework-free brand guide, logo showcase, and procedural signal-mark
generator for Flid.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open:

- Brand guide: `http://localhost:3000`
- Logo showcase: `http://localhost:3000/showcase`
- Logo generator: `http://localhost:3000/generator`

## Commands

- `npm run dev` builds and serves the static site locally.
- `npm run build` copies the deployable static site to `dist/`.
- `npm run assets` regenerates the canonical SVG library and manifest.
- `npm run start` builds and serves the static site locally.
- `npm test` builds the site and runs all tests.
- `npm run lint` syntax-checks the JavaScript modules.

## Architecture

The site uses plain HTML, CSS, and browser-native JavaScript modules. There is
no application framework or runtime dependency.

- `site/index.html` is the canonical brand guide.
- `site/showcase/` and `site/generator/` are supporting identity tools.
- `app/**/*.css` contains the page styles.
- `lib/brand-system.mjs` is the approved brand specification.
- `lib/logo-generator.mjs` is the deterministic SVG implementation.
- `scripts/generate-brand-assets.mjs` creates approved marks, Geist wordmark
  lockups, the favicon, and `brand-assets/manifest.json`.
- `scripts/build.mjs` creates `dist/`.
- `scripts/server.mjs` serves the built files with clean directory URLs.

## Logo system

The vanilla generator exposes controls for layers, curl, twist, line weight,
signal accents, and colors. Exported marks are standalone SVG files.

`logo.txt` is retained only as the original visual reference. The website uses
the independently generated procedural mark.

## Asset policy

Every build regenerates the brand assets from the approved parameters. The
guide references those files directly instead of redrawing the mark in browser
code.

- Mark-only SVGs are approved and use a tight `0 0 100 100` artwork box.
- Clear space belongs to the placement context, not the mark file.
- Horizontal lockups use Geist SemiBold at weight 600 with native kerning.
- Wordmarks are converted to vector outlines, so downloaded SVGs do not depend
  on a locally installed font.
- The pinned Geist source and SIL Open Font License live in `vendor/geist/`.
- `dist/brand-assets/manifest.json` records status, theme, master, minimum size,
  and intended role for every export.
