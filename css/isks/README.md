# ISKS 2026 "Built to Last" -- style pack

Assets and styling extracted from `ISKS_sprekers_basisslides_z_animaties.pptx`
(the Info Support speaker base deck) and rebuilt for this presentation engine.

Same shape as the sibling [`../housestyle/`](../housestyle/) folder: docs plus
a token file plus assets. This one adds ready-to-use slide components, because
the ISKS layouts are specific enough to be worth reproducing exactly rather
than re-deriving per slide.

```
isks/
  isks-tokens.css      :root custom properties -- colours, type, geometry
  isks.css             slide components (imports the tokens)
  colors.md            every colour with its provenance
  assets/              originals straight out of the pptx
  assets/web/          optimised variants, the ones the CSS references
  assets/INDEX.md      asset inventory
  preview.html         all layouts side by side with the source artwork
  preview-single.html  one slide at full viewport; copy-paste template
  verify.html          CSS rebuild stacked against the original rasters
  tools/               re-extraction and measurement scripts
```

## Using it

Add the stylesheet in `index.html`, before `theme.css`:

```html
<link rel="stylesheet" href="css/isks/isks.css">
<link rel="stylesheet" href="css/theme.css">
```

Custom properties resolve at use time, so the order does not actually affect
whether `theme.css` can read the `--isks-*` tokens. It is first because that is
the readable order once `theme.css` starts referencing them.

`isks.css` `@import`s `isks-tokens.css`, so one link is enough. Everything is
namespaced `isks-`, so nothing collides with the existing theme, and adding the
link changes nothing until a slide opts in by using an `isks-` class.

Then a slide file becomes:

```html
<section data-id="why-build-it" data-title="Why build it yourself?">
  <div class="isks-canvas">
    <span class="isks-bullet"></span>
    <h2 class="isks-title">Why build it yourself?</h2>
    <div class="isks-body">
      <ul>
        <li>A transformer is roughly <strong>six operations</strong> in a loop.</li>
        <li>Every one of them fits on a slide.</li>
      </ul>
    </div>
    <div class="isks-bar">
      <span class="isks-halftone"></span>
      <img class="isks-bar__logo" src="css/isks/assets/web/infosupport-40jaar-logo-white.png" alt="Info Support, 40 jaar">
      <span class="isks-bar__rule"></span>
      <p class="isks-bar__event">ISKS<span>2026</span></p>
      <img class="isks-bar__lockup" src="css/isks/assets/web/isks-built-to-last-solid.png" alt="Built to Last">
    </div>
  </div>
</section>
```

`.isks-canvas` is `position: absolute; inset: 0`, which escapes the padding the
engine puts on `.slide`. That is deliberate -- it lets the pptx's percentage
geometry land unmodified. Fragments, `data-id`, overview mode and the rest of
the engine work as normal inside it.

**Asset paths.** The `--isks-asset-*` tokens are relative to `css/isks/`, so
they resolve correctly from the stylesheet. Paths written in slide HTML resolve
against `index.html`, so those need the `css/isks/` prefix, as above.

## Layouts

| pptx layout | Classes | Notes |
|---|---|---|
| 1 -- title slide | `.isks-hero`, `__title`, `__subtitle`, `__byline`, `__portrait` | Full-bleed photo; the headline sits in the artwork's empty left panel |
| 2 -- two column | `.isks-canvas` + `.isks-body--split` | 39.40% / 42.08% split, per the pptx |
| 3 -- title + body | `.isks-canvas` + `.isks-body` | The everyday content slide |
| 5 -- four cards | `.isks-cards` + `.isks-card` | Four gradient panels, 19.65% wide, 2.22% gutters |
| all content | `.isks-bar` | Footer bar, top edge at 90.08% |

Layouts 4 and 6 hold only background images and picture placeholders -- no text
styling to extract, so they have no component.

## What is CSS and what is a raster

The gradient and halftone background is **rebuilt in CSS**, not shipped as the
505 KB PNG. `verify.html` stacks the two, and
`tools/compare-halftone.py` measures them: dot energy tracks the original to a
mean absolute error of **0.52** on a peak of 8.7 (~6%) across the visible field.

The footer bar is **composed from live parts** rather than used as a raster, so
the wordmarks stay crisp at any size and "ISKS / 2026" stays selectable text.
Every child position is measured off the bar artwork, so it is interchangeable
with the raster -- `.isks-bar--image` swaps the original back in if you ever
want pixel identity.

The title slide **is** a raster: it is a photograph. No point pretending otherwise.

## Phone

The deck gets opened on phones from a QR code, so:

- Every type size is `clamp()`ed with a rem floor. A raw `vw` size faithful to
  the pptx collapses to unreadable at 400px wide.
- Below 820px the absolute pptx geometry switches to a stacked flow, the
  halftone drops from two dot layers to one, and cards go from a row to a column.
- The footer bar switches from percentage placement to a flex row. Its child
  positions are percentages of the bar box, which only hold while the bar keeps
  the source artwork's very wide, short aspect; at phone width the bar is
  proportionally far taller and those percentages collide.
- The title slide drops the photo entirely and uses the brand gradient. Cropped
  to portrait the photo puts its artwork behind the headline, and skipping it
  saves ~300 KB on the first slide every phone visitor loads.

Nothing in `isks.css` animates. Backgrounds are static paints -- no SVG filter
primitives, no animated `background-position`, per the deck's animation budget.

## Regenerating

```
# re-extract assets after a deck update (idempotent, needs Pillow)
python3 css/isks/tools/extract-assets.py /path/to/ISKS_....pptx

# print the measurements the tokens are derived from
python3 css/isks/tools/measure-artwork.py
```

The pptx is gitignored, so it lives in a working checkout rather than in the
repo -- `extract-assets.py` searches upward for `ISKS*.pptx` and otherwise wants
the path passed in.

## Gotchas found while extracting

Recorded because each one is a trap someone would otherwise hit again:

- **The pptx theme is stock Office.** `theme1.xml` carries `accent1 #156082`,
  `accent2 #E97132` and friends. None of those are ISKS colours. The event
  palette is applied as explicit `srgbClr` overrides on the layouts. Reading the
  theme block gets you an entirely wrong deck.
- **Two ambers, both real.** `#F0A413` on shapes, `#F0A314` on title-slide text.
  One unit apart in G and B; looks like a hand-typed hex that drifted.
- **The lockup ships only in its outlined cut.** `image5` is hollow strokes. The
  filled version the footer bar uses exists nowhere as a standalone file, so it
  is keyed out of the bar artwork -- see `tools/extract-assets.py`.
- **The lockup's "shadow" is a colour, not a darkening.** `#DD4111` red-orange,
  offset. Flattening it to one tone loses the mark's depth.
- **The title-slide stripes are the corporate red.** `#F04E23`, the house
  *Rood* from `../housestyle/colors.md`.
- **The background and the bar use different halftone grids.** 1.5125% pitch
  with 0.72-of-pitch dots on the background; 1.2045% with 0.48 on the bar. One
  pitch for both looks visibly wrong.
- **A CSS `mask` clips the element's own pseudo-elements.** The halftone needs
  two dot sizes on `::before` and `::after`; masking the container collapsed
  them into one and produced a hard edge instead of a falloff. Every mask lives
  on a leaf layer.
- **The card icons need recolouring.** The deck's own speaker note says icons
  come in black by default and must be set to white or the title triangle's
  amber. See `assets/INDEX.md`.


## How this deck uses the pack

`index.html` links `css/isks/isks.css` before `css/theme.css` and carries one
page-level footer bar (`#isks-bar`). Beyond that, the deck opts in through
three mechanisms:

**1. Role mapping in `theme.css`.** The pack defines colours; `theme.css`
assigns them to the deck's existing roles (`--color-text`, `--color-accent`,
...), so every slide inherited the palette without being touched. Two calls
worth knowing:

- `--color-accent` is teal-bright, **not** amber. Amber is a shape colour in
  this identity; at 2.2:1 on white it fails even large-text AA, so it draws
  rules and bullets but never carries text on a light slide.
- `.highlight` is navy (12.5:1). On the dark canvases it flips to amber, which
  is exactly how the pptx sets its subtitles.

**2. `data-layout` on the slide's `<section>`.** `loader.js` carries the
wrapper's `data-layout` and `class` across (only `innerHTML` is rendered), and
`engine.js` copies them onto the `.slide` element and mirrors them onto
`<body data-slide|data-layout>` so page-level chrome can react.

| value | effect |
|---|---|
| `isks-dark` | navy-to-teal wash, white headings, amber subtitle; add a `<span class="isks-halftone">` for the dot field |
| `isks-bare` | hides the footer bar and drops the bar clearance |

The section dividers (`06-section-wiskunde`, `11-section-transformer`) use
`isks-dark`. The hero and outro are matched by `data-slide` directly.

**3. Bar clearance.** `.slide` reserves `--isks-bar-clearance` at the bottom.
Anything `position: fixed` inside a slide escapes that and must inset itself
(see `02b-meme.html`), and viewport-unit heights ignore it entirely -- which is
what the layout fixes below were about.

### Palette migration

The deck previously used the Info Support corporate palette plus a neon set on
the hero and outro. Mapping applied:

| was | now | why |
|---|---|---|
| `#00A3E0` Info Support blue | `#1C8680` teal-bright | primary cool accent |
| `#6ECFF6` felblauw | `#29AC8D` band teal | secondary cool |
| `#4A6A8A` slate | `#4A8480` muted teal | muted text, 4.6:1 |
| `#C8D8E8` / `#F0F4F8` | `#BFDAD8` / `#EFF6F5` | borders and panels |
| `#38bdf8` / `#4ade80` / `#fbbf24` | `#003760` / `#1C8680` / `#F0A413` | the three-series charts, pushed apart so they stay tellable |
| `#ff4d9d` `#a855f7` `#ffe24d` `#4dff9d` `#ff8a3d` | amber, teal-bright, amber tint, teal tint, house red | hero and outro neons |

`svg.css` already referenced tokens with the old hexes only as fallbacks, so
the diagrams followed automatically; the stale fallbacks were updated to match.

### Two things that had to change, not just recolour

- **Hue rotation.** The hero and outro animated `filter: hue-rotate()` through
  360deg, which sweeps any palette through the whole colour wheel -- the one
  thing a brand palette cannot survive. Both now pulse saturation and
  brightness instead. The motion is unchanged.
- **Additive mixing.** Their conic washes screen a full-spectrum gradient over
  the backdrop. Screening amber against teal yields olive, which turned both
  slides to mush. The washes are now confined to the teal half of the palette
  and amber lives in the headline. Layer sizes were also capped to
  `min(150vmax, 2000px)` per the deck's animation budget.

### Layout fixes the bar forced

Three slides sized content against the viewport, which ignores the bar's
clearance, so their bottom rows ended up underneath it:

- `26-scale` -- `height: 62vh` on the chart row, plus SVGs that kept their
  aspect-derived height and overflowed. Now `flex: 1; min-height: 0` on the
  row and `height: 0` on the SVGs, so flex does the sizing.
- `18-causal-masking` -- `height: 100%` on the two-column, same fix.
- `02b-meme` -- a `position: fixed; inset: 0` image, now inset to
  `0 0 var(--isks-bar-h) 0`.

### Known caveat

The hero and outro are built from emoji (unicorns, diamonds, rockets). Emoji
render with their own fixed colours and cannot be brought into the palette.
They are the slides' personality, so they were left alone -- but they are the
one genuinely off-brand element left in the deck.
