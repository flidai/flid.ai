# Design QA — homepage hero

## Reference and implementation

- Selected reference: `/Users/yacobolo/.codex/generated_images/019fa2f5-314f-7232-a382-d1136b4e2240/exec-86fab27c-b21a-4772-ad70-bea8516c7d2c.png`
- Implemented page: `http://localhost:3000/`
- Primary comparison viewport: desktop hero at approximately 1440 × 1000 CSS pixels. The portrait reference was normalized to its top 864 × 600 hero crop before comparison.
- Additional checks: 768 × 1024 tablet, 390 × 844 mobile, hero-to-story handoff, CTA destination, console errors, and the existing `Independent by design.` section.

## Comparison history

### Pass 1

- Typography, hierarchy, center alignment, three-line wrapping, restrained blue accent, header proportions, CTA treatment, and concentric wave composition matched the selected direction.
- The project-bound WebP background remained sharp and legible at desktop, tablet, and mobile sizes without horizontal overflow.
- P2 — The bottom edge of the raster wave field made the transition into the scroll story feel like a hard horizontal cut. Added a token-colored bottom fade on `.hero::after` so the particles dissolve into the existing story background.

### Pass 2

- Rechecked the desktop hero and the partially scrolled hero-to-story handoff. The hard edge is gone and the two sections now read as one continuous dark field.
- Rechecked tablet and mobile layouts: no overlap, clipped copy, awkward wrapping, or unusable controls.
- Verified `See our products` resolves uniquely and opens `https://leapview.dev/`.
- Verified the browser console contains no errors.
- Verified the light `Independent by design.` section, its portrait, copy, and CTA remain unchanged.
- No open P1 or P2 findings.

### Pass 3

- Removed the former sections 02 and 03 together with their internal navigation links and unused responsive styles.
- Verified the page now flows from the thesis story directly into the unchanged `Independent by design.` section.
- Verified the removed LeapView screenshot is no longer copied into the public build.

### Pass 4 — hero-to-story warp

- Captured the live Datacurve hero at the top, midpoint, late transition, and first fully rendered scene at a 1440 × 1000 viewport. The measured transition spans approximately one viewport of scrolling.
- Matched the reference copy behavior: the hero copy fades on a smooth curve while scaling from 1 to 0.92 and moving down by 20px.
- Added a project-bound contour-to-particle warp. The wave field softens and enlarges while a deliberately noisy dot field converges into the first thesis depth frame.
- The hero and thesis now overlap for one viewport and crossfade between matching first frames, avoiding the earlier split-screen jump at the section boundary.
- Reduced duplicate work by preventing the underlying thesis renderer from drawing while the opaque hero still covers it. Both renderers remain event-driven rather than continuously animating.
- Compared `/tmp/datacurve-transition-600.jpg` and `/tmp/flid-hero-transition-mid-final.jpg` side by side at the same dimensions. The transition timing, copy recession, dispersed particle density, and viewport coverage are visually aligned while retaining Flid's dark palette and content.
- Verified the 390 × 844 fallback uses the same copy and wave timing with a lighter procedural particle pass, without requiring WebGL depth media.
- Verified reduced motion keeps a static one-viewport hero and disables transition canvases.

### Pass 5 — mobile thesis composition

- Captured the live Datacurve story at 390 × 844 and measured its mobile composition: the canvas occupies 30% of the viewport and the active subtitle begins approximately 24px below it.
- Replaced the former mobile card fallback with the same scroll-driven depth-video renderer used on desktop. The visual now remains sticky in the top portion of the viewport while each highlighted subtitle sits immediately beneath it.
- Matched the reference text measure at 342px on a 390px viewport, leaving 24px clear space on each side.
- Verified the local depth media is selected at every viewport width; the procedural renderer remains only as the unavailable-media fallback, and reduced-motion users continue to receive the static two-card presentation.
- Compared `/tmp/datacurve-mobile-reference.png` and `/tmp/flid-mobile-final.png` side by side at the same viewport. Visual height, text gap, text measure, and reading order are aligned while retaining Flid's dark palette and particle scenes.
- Verified both subtitle states become active in sequence and the animation remains bounded inside the sticky viewport without horizontal overflow.

### Pass 6 — single mobile renderer handoff

- Reproduced the reported duplicate at 604 × 1280: the departing hero canvas occupied the top of the viewport while the thesis video canvas entered at the bottom.
- Mobile now keeps the hero copy and wave-field fade but does not render a second particle canvas.
- Moved the thesis story forward by one viewport so the single depth-video renderer takes over directly at the hero boundary.
- Verified the hero canvas is `display: none` below 901px while the thesis canvas remains active, sticky, and paired with the subtitle beneath it.
- Rechecked the full handoff and later cathedral frame at 604 × 1280; only one animated particle scene is visible at every point.

final result: passed
