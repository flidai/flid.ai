# DataCurve particle study

This directory documents a clean-room study of the public scroll animation at
<https://datacurve.ai/>. It exists to understand the rendering mechanism before
we build original Flid visuals.

## Third-party reference material

The `upstream/` directory contains local copies of public runtime files used for
technical inspection. It is intentionally ignored by Git and must not be copied
into the Flid site, production build, or distributable brand assets. The source
material remains the property of its respective owner.

Run `./fetch-reference.sh` from this directory to refresh the local research
copy. The script only requests URLs already loaded by the public page.

## Confirmed architecture

- One full-viewport WebGL2 canvas renders the particle field.
- Eight off-screen MP4 elements provide animation data.
- The media endpoints are named `depth-clip-01.mp4` through
  `depth-clip-08.mp4`.
- Clips are muted, non-autoplaying, non-looping, and controlled by application
  code.
- The document is approximately 23,371 px tall at a 1440 x 900 viewport, while
  the particle canvas remains viewport-sized.

Further shader, media, scroll mapping, and performance findings belong in
`findings.md`.

