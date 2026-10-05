# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Viewers: people who open the site to watch and take in the experience. Their job is to scroll through and be immersed, not to buy, sign up or complete a task. Other audiences (clients, recruiters) are not confirmed.

## Product Purpose
A portfolio / demo piece showcasing a scroll-driven image-sequence experience: a full-screen background assembled from 300 pre-rendered frames that plays forward and backward as the visitor scrolls, with editorial content layered on top. Success means the scroll-to-frame motion feels smooth, immediate and cinematic on desktop and mobile, and the viewer stays to the end.

The "SOMA // PROJECT — interactive documentary on human perception" framing is placeholder narrative that dresses the demo; it is not a real documentary or organization.

## Positioning
Undecided. The demo's distinguishing mechanism is the frame-accurate scroll-scrubbed canvas sequence; no further positioning claim has been confirmed.

## Operating Context
- Viewed in a browser, desktop and mobile, by scrolling top to bottom.
- Frames load progressively, nearest to the current scroll position first (8 parallel requests); the experience must remain usable while frames are still downloading.

## Capabilities and Constraints
- Stack: React 19 + Vite, GSAP ScrollTrigger drives frame progress; frames drawn to a `<canvas>` with cover-fit (`src/components/CanvasAnimation.jsx`).
- Frame sequence: 300 frames built from lossless PNGs in `temp_png/` by `scripts/build_sequence.cjs` into two sets: `public/sequence/desktop/` (1280x720 AVIF, ~7.6 MB) and `public/sequence/mobile/` (centre 405x720 strip, JPEG, ~5.4 MB) for portrait screens (aspect ≤ 0.6). Old ezgif frames are archived in `archive/sequence_legacy/`.
- Section content is anchored to frame ranges (e.g. 01 ≈ frames 86–165, 02 ≈ 166–235, 03 ≈ 236–300); changing the sequence length or page height shifts those alignments.
- Built with `base: './'` so the build can be served from any subpath.
- Undecided: the real subject/brand of the site, the author credit, and any call to action.

## Brand Commitments
None confirmed. The name "SOMA // PROJECT" and its copy are placeholders and can be replaced.

## Evidence on Hand
- Real: the 300-frame background sequence (source PNGs in `temp_png/`, built sets in `public/sequence/`).
- Placeholder, must not be presented as fact: all section copy, the "SOMA" name, `ACCESS@SOMA-DOCUMENTARY.COM`, Credits / Press kit / Screenings links (they point to non-existent anchors), telemetry labels, chapter names, and `public/projects/*` preview images.
- Absent: testimonials, press, screenings, real contact details. Do not fabricate them.

## Product Principles
1. The moving background is the product: nothing may compromise scroll-to-frame smoothness or responsiveness.
2. Content serves the sequence, not the other way around; overlays must keep the frames visible and readable.
3. Degrade gracefully: a partially loaded sequence or a slow device still gets a coherent experience.
4. Placeholder content stays clearly replaceable; never invent facts to fill it.
