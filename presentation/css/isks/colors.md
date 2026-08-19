# ISKS 2026 -- Colours

> Source: `ISKS_sprekers_basisslides_z_animaties.pptx` (Info Support speaker base deck).
> Every value is either verbatim from the pptx XML or measured off the artwork
> embedded in it. The provenance column says which.
>
> The deck's *theme* (`ppt/theme/theme1.xml`) is stock Microsoft Office --
> `accent1 #156082`, `accent2 #E97132`, and so on. **None of those are ISKS
> colours.** The event palette is applied as explicit `srgbClr` overrides on
> the layouts, which is what this file records. Do not read the theme block.

## Primary

### Teal -- the signature colour

Titles and body copy on the white content layouts.

| | |
|---|---|
| **HEX** | `#066F6B` |
| **RGB** | 6 / 111 / 107 |
| **Token** | `--isks-teal`, aliased as `--isks-heading` / `--isks-body` |
| **Provenance** | verbatim, `slideLayout2/3/5` -- every text placeholder's `solidFill` |

### Amber -- the accent

Triangle bullet, the vertical rule in the footer bar, title-slide subtitles.

| | |
|---|---|
| **HEX** | `#F0A413` (shapes and rules) |
| **RGB** | 240 / 164 / 19 |
| **Token** | `--isks-amber` |
| **Provenance** | verbatim, `slideLayout2/3/5` -- triangle `solidFill` |

| | |
|---|---|
| **HEX** | `#F0A314` (subtitle *text* on the title slide) |
| **RGB** | 240 / 163 / 20 |
| **Token** | `--isks-amber-text` |
| **Provenance** | verbatim, `slideLayout1` -- subtitle placeholder `defRPr` |

The two differ by one unit in G and B. Both are genuinely in the file; it looks
like a hand-typed hex that drifted. Use `--isks-amber` unless you are
specifically matching title-slide text.

### White

| | |
|---|---|
| **HEX** | `#FFFFFF` |
| **Token** | `--isks-white`, aliased as `--isks-bg` |
| **Provenance** | verbatim, `slideMaster1` background is `bg1` |

## The gradient ramp

One ramp, used two ways: horizontally for full-bleed backgrounds, vertically
for card fills.

| Stop | HEX | RGB | Token |
|---|---|---|---|
| 0% | `#003760` | 0 / 55 / 96 | `--isks-navy` |
| 50% | `#005C75` | 0 / 92 / 117 | `--isks-mid` |
| 100% | `#1C8680` | 28 / 134 / 128 | `--isks-teal-bright` |

**Provenance:** verbatim, `slideLayout5` card `gradFill` `gsLst`. Confirmed
against the embedded 8000x4500 background asset, sampled along the centre row:

| x | measured |
|---|---|
| 0% | `#003660` |
| 25% | `#00496B` |
| 50% | `#005D75` |
| 75% | `#00727C` |
| 100% | `#1C8680` |

Direction: the card fill declares `<a:lin ang="5400000">`, which is 90 degrees
in OOXML -- top to bottom. The full-bleed background runs left to right.

- `--isks-gradient-h` -- `linear-gradient(90deg, navy, mid 50%, teal-bright)`
- `--isks-gradient-v` -- `linear-gradient(180deg, navy, mid 50%, teal-bright)`

## Secondary

### Red-orange -- stripe motif

The diagonal stripe block at the lower right of the title slide.

| | |
|---|---|
| **HEX** | `#F04E23` |
| **Token** | `--isks-orange` |
| **Provenance** | measured, title-slide artwork; sampled `#F04F23` (JPEG drift) |

This is the Info Support house **Rood** from
[`../housestyle/colors.md`](../housestyle/colors.md) -- the event artwork
reuses the corporate red rather than inventing one.

### Lockup shadow

The offset shadow behind the "Built to Last" lockup, a deeper cut of the same hue.

| | |
|---|---|
| **HEX** | `#DD4111` |
| **Token** | `--isks-lockup-shadow` |
| **Provenance** | measured, footer-bar artwork (23583 amber px vs 3539 of this) |

You rarely set this by hand -- it is baked into
`assets/web/isks-built-to-last-solid.png`. The token exists so a CSS-drawn
version of the mark can match.

### Band teal

The lighter teal band across the lower left of the title slide.

| | |
|---|---|
| **HEX** | `#29AC8D` at its left edge, fading to transparent by ~34% of the width |
| **Used by** | `.isks-band` |
| **Provenance** | measured, title-slide artwork, rows 73.5%-88.5% |

## Halftone dots

Not a flat colour -- a field whose dot size and alpha both fall off to the right.

| | |
|---|---|
| **Dot colour** | `#1C8680` at **40%** alpha over the gradient |
| **Grid** | square, pitch 121px of 8000 = **1.5125%** of slide width |
| **Dot diameter** | 0.72 x pitch at x=0, 0.51 at 24%, 0.42 at 36%, 0 at 54% |
| **Alpha** | holds 0.40 to x=27%, then ramps to 0 by x=54% |
| **Tokens** | `--isks-dot-color`, `--isks-dot-pitch`, `--isks-dot-radius` |
| **Provenance** | measured; run `tools/measure-artwork.py` for the full table |

The measured alpha is 0.404 / 0.405 / 0.407 / 0.411 / 0.392 / 0.402 across the
first six sample bands -- flat 0.40 within noise, which is what makes a single
`rgba()` token correct here.

The footer bar ships as separate artwork with its own, finer grid:

| | |
|---|---|
| **Grid** | pitch 53px of 4400 = **1.2045%** of width |
| **Dot diameter** | ~0.48 x pitch, tapering to ~0.28 by x=28% |
| **Dot colour** | same `#1C8680` @ 40% (measured 0.389-0.415) |
| **Tokens** | `--isks-bar-dot-pitch`, `--isks-bar-dot-radius`, `--isks-bar-dot-fade` |

## Typography

Arial throughout -- declared explicitly on every text placeholder in
`slideLayout2/3/5` and on the master, not inherited from the theme (whose
`majorFont`/`minorFont` are Aptos Display / Aptos and unused). Line spacing is
**90%** on both the title and body styles.

| Role | pptx size | % of 960pt slide width | Token |
|---|---|---|---|
| Title-slide headline | 55pt bold, white | 5.729vw | `--isks-fs-hero` |
| Section title | 40pt bold, teal | 4.167vw | `--isks-fs-title` |
| Subtitle | 24pt, amber | 2.500vw | `--isks-fs-subtitle` |
| Body | 20pt, teal | 2.083vw | `--isks-fs-body` |
| Dense body | 18pt, teal | 1.875vw | `--isks-fs-body-sm` |
| Footer / meta | 12pt | 1.250vw | `--isks-fs-footer` |
| Bar "ISKS / 2026" | derived, ~19pt bold | 2.007vw | `--isks-fs-bar` |

The bar size is derived rather than declared: its cap height measures 25% of
the bar height, and Arial's cap height is 0.716em, so the font size is
0.25 / 0.716 x 5.749% = 2.007% of slide width.

Every size is wrapped in `clamp()` with a rem floor. The deck is opened on
phones from a QR code, where a raw `vw` size would collapse to unreadable.
