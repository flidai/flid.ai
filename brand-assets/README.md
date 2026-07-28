# Flid brand assets

This directory is generated from the approved procedural identity in
`lib/brand-system.mjs`. Do not edit exported files manually.

## Formats

- **SVG** is the canonical digital source. Signal curves and the wordmark are
  expanded into filled vector outlines, so the complete identity scales
  proportionally in every standards-compliant renderer.
- **PNG** exports are transparent and supplied at 1x, 2x, and 4x.
- **PDF** exports remain vector for print and production workflows.
- **ICO and fixed-size PNG** files cover browser, app, and touch icons.
- **Social PNG** files provide 1024px profile images and 1200x630 share cards.
- **LinkedIn company-logo PNG** files are square, upload-ready, and include an
  opaque dark or light background. They retain the 12-layer geometry with
  documented optical compensation for LinkedIn's small rendered thumbnail.
- **LinkedIn SVG and PNG** files provide company and personal banners in dark
  and light modes.

## Production master

- **Primary / 12 layers:** the sole approved Flid identity at every size.
- **Essential / 8 layers** and **Full / 16 layers** are retained only as an
  archive of the design process. Do not use them in production.

Use `on-dark` artwork on dark surfaces and `on-light` artwork on light
surfaces. Preserve the 0.20D mark-to-word gap and 0.25D clear space encoded in
`manifest.json`. Standard exports must be scaled as complete artwork; never
resize paths independently or reapply a stroke. Optical compensation is
reserved for assets explicitly identified for small platform surfaces.

Regenerate everything with:

```sh
npm run assets
```

