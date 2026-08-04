# DataCurve dot-morph findings

Captured from the public DataCurve home page on 2026-08-04 at a 1440 x 900
viewport. These notes describe behavior and architecture; they intentionally do
not reproduce the upstream shader source.

## What the effect actually is

The animation is a dense, video-driven 3D point field rendered with Three.js on
a WebGL2 canvas. It is not an SVG morph and it does not construct one point per
object feature.

The renderer creates a regular UV grid. Every point samples the same position
from the current video frame:

- UV determines the point's base X/Y position.
- Frame luminance becomes a height/depth value.
- Dark pixels become distant, faint, or absent points.
- Bright pixels become nearer, larger, more opaque points.
- The result is projected through a perspective camera.

This means any moving image can become a relief sculpture. Most source clips
are grayscale depth-like footage. A few contain visible color, but the renderer
still reduces them to luminance before constructing the surface.

## Source assets

| Clip | Dimensions | FPS | Frames | Duration | Size |
| --- | ---: | ---: | ---: | ---: | ---: |
| 01 | 640 x 360 | 15 | 60 | 4.00 s | 103 KiB |
| 02 | 640 x 360 | 15 | 60 | 4.00 s | 52 KiB |
| 03 | 640 x 360 | 15 | 61 | 4.07 s | 61 KiB |
| 04 | 640 x 354 | 15 | 91 | 6.07 s | 161 KiB |
| 05 | 640 x 360 | 15 | 60 | 4.00 s | 89 KiB |
| 06 | 640 x 360 | 15 | 61 | 4.07 s | 98 KiB |
| 07 | 688 x 464 | 24 | 145 | 6.04 s | 728 KiB |
| 08 | 752 x 416 | 24 | 145 | 6.04 s | 229 KiB |

All clips use H.264 with YUV 4:2:0 pixels. The complete set is only about
1.5 MiB, so video is being used as a compact animated data texture rather than
as visible full-screen footage.

The public scene configuration sets density to 1.55 and transition speed to
0.03. Individual clips can tune depth gamma, hold duration, text reveal speed,
entry direction, exit direction, playback range, and vertical orientation.

## Rendering model

- WebGL2 through Three.js.
- Perspective camera: 38 degree field of view, near 0.1, far 10, Z 2.55.
- Approximately 154,875 points at 1440 px width in the inspected session.
- The desktop budget can reach 200,000 points.
- Device pixel ratio is capped at 1.35.
- Render width is capped at 1,600 CSS pixels and height at 1,000 CSS pixels.
- Antialiasing is disabled; dots are drawn analytically in the fragment shader.
- Each dot is a Gaussian-like core with a soft halo, not a hard circle sprite.
- Depth controls position, size, opacity, and neutral gray shading.
- Mouse position gently rotates the complete point field to reveal parallax.

The grid is lightly jittered, but particles retain stable UV identities. That
stability is why motion feels coherent even when the source image changes.

## Detail recovery

The shader performs edge detection on the depth frame. On larger screens it
uses a full local Sobel neighborhood; lower quality mode drops the corner
samples. Edge strength increases particle presence, size, depth, and contrast.

This is important: video luminance provides the volume, while edge detection
recovers small features such as fingers, folds, object boundaries, and distant
geometry. The combination is what makes the surface read as an object instead
of an undifferentiated height field.

## Scroll and playback

- The scene section is 2,450 viewport-heights tall.
- A viewport-sized canvas stays sticky while the document scrolls beneath it.
- Scroll progress is converted into alternating play and transition phases.
- Video playback is deterministic scrubbing: application code seeks each video
  to the time corresponding to scroll progress.
- The videos do not autoplay or loop.
- Transitions preserve each particle's UV identity and route particles through
  a procedurally generated stream before they settle into the next relief.
- Transition routes use seeded noise, strands, turbulence, cloud breakup, and
  staggered arrival rather than a simple linear crossfade.
- Scene text is synchronized to the same timeline.

The inspected document was about 23,371 px tall. The long duration gives each
object time to become legible before particles leave it.

## Composition and text interaction

The page sends up to four normalized text rectangles to the shader. Particles
inside or near those rectangles are sparsified, faded, and slightly reduced in
size so copy remains legible. During energetic transitions the avoidance effect
is relaxed, allowing streams to cross the composition.

## Performance behavior

- Rendering stops after roughly 260 ms without scroll, pointer, or seek changes.
- Frames are throttled to no faster than about 13.7 ms apart.
- The WebGL context requests high-performance power on desktop.
- Particle density and edge sampling are reduced on compact or weaker devices.
- The animation pauses when hidden, blurred, or outside the viewport.
- Reduced-motion mode renders a static state and disables transition routing.

## Measured rendering ratios

These values were measured from the public runtime and confirmed against live
WebGL draw calls at a 1,440 px desktop viewport. They are more useful than a
visual estimate of dot density because most grid points become sub-pixel or are
discarded when the sampled depth is weak.

| Parameter | Reference value |
| --- | ---: |
| Scene density multiplier | 1.55 |
| Desktop base / ceiling | 100,000 / 200,000 points |
| Tablet base / ceiling | 72,000 / 150,000 points |
| Compact base / ceiling | 26,000 / 55,000 points |
| Retina density multiplier | 0.80 |
| 1,440 px, DPR 1 target | 155,000 points |
| 1,440 px, DPR 1 actual grid | 525 × 295 = 154,875 points |
| 1,440 px, DPR 2 target | 124,000 points |
| Maximum render DPR | 1.35 |
| Desktop point scale | 1.90 |
| Point-size perspective numerator | 1.98 (camera position remains 2.55) |
| Plane occupancy multiplier | 0.84 |
| Weak-sample point-size multiplier | 0.34 |
| Strong-sample point-size multiplier | 1.00 |
| Fragment alpha discard | 0.007 |

Immediate framebuffer reads taken after live draw calls showed non-transparent
pixel coverage ranging from 5.10% during a sparse transition to 18.12% in a
detailed hold. The key distinction is therefore visible-particle suppression,
not a small source grid: weak samples are roughly one third size, fade heavily,
and are discarded before they can turn the relief into a continuous surface.

## What to reproduce for Flid

The transferable system is:

1. Original Flid depth or luminance clips.
2. A stable UV particle grid.
3. Video textures sampled in a vertex shader.
4. Perspective depth, depth-aware point size, and soft point rendering.
5. Local edge recovery.
6. Scroll-scrubbed clips with long hold phases.
7. Procedural but deterministic transition routing.
8. Text avoidance and deliberate mobile/reduced-motion fallbacks.

The upstream media and runtime files under `upstream/` are study material only.
The Flid implementation should be clean-room code with original source clips,
different choreography, and a visual story tied to agent-native products.
