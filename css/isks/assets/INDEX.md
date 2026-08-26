# ISKS 2026 -- Asset Inventory

Extracted from `ISKS_sprekers_basisslides_z_animaties.pptx`. Regenerate with:

```
python3 css/isks/tools/extract-assets.py [path/to/ISKS_....pptx]
```

The tool is idempotent -- re-running reproduces these files byte for byte.

## `assets/` -- originals

Straight out of the pptx, renamed only. Keep these for print, re-export, or
re-deriving the web variants. **Do not reference them from a slide** -- the
title background alone is 1.9 MB.

| File | pptx member | Size | Dimensions | What it is |
|---|---|---|---|---|
| `isks-title-background.jpg` | `image1.jpeg` | 1970 KB | 4400x2475 | Full title-slide artwork: navy-to-teal halftone panel at left, amber diagonal, teal band, retro-electronics photo at right with the "Built to Last" circuit board. The left panel is deliberately empty -- that is where the headline goes. |
| `isks-bar.png` | `image2.png` | 197 KB | 4400x252 | The footer bar: gradient, halftone, Info Support logo, amber rule, "ISKS / 2026", solid "Built to Last" lockup. Sits on every content layout. |
| `isks-gradient-halftone-background.png` | `image3.png` | 505 KB | 8000x4500 | The signature full-bleed background: horizontal navy-to-teal gradient with the halftone dot field. `isks.css` rebuilds this in CSS; the file is kept as the reference the rebuild is measured against. |
| `infosupport-40jaar-logo-white.png` | `image4.png` | 86 KB | 3305x1251 | Info Support wordmark, "40 JAAR" and the "Solid Innovator" tagline. White on transparent. |
| `isks-built-to-last-white.png` | `image5.png` | 66 KB | 2362x1890 | "BUILT TO LAST" lockup, **outlined** cut. White strokes on transparent, hollow letterforms. Higher resolution than the solid cut -- use it when the mark is displayed large. |
| `isks-slide1-thumbnail.jpg` | `docProps/thumbnail.jpeg` | 13 KB | 256x144 | The deck's own preview thumbnail. Reference only. |

## `assets/web/` -- what the CSS references

Downscaled and optimised. `--isks-asset-*` in `isks-tokens.css` points here.

| File | Size | Dimensions | Notes |
|---|---|---|---|
| `isks-title-background.jpg` | 299 KB | 1920x1080 | Title slide. The one heavy asset in the pack; the phone breakpoint drops it and uses the gradient instead. |
| `isks-bar.jpg` | 20 KB | 1920x110 | Raster footer bar, for `.isks-bar--image`. Only needed if you want the bar pixel-identical rather than composed; the composed bar keeps its wordmarks crisp at any size. |
| `infosupport-40jaar-logo-white.png` | 56 KB | 900x341 | For dark backgrounds -- the bar, the title slide. |
| `infosupport-40jaar-logo-teal.png` | 54 KB | 900x341 | Recoloured to `#066F6B`, for white content slides. |
| `infosupport-40jaar-logo-navy.png` | 54 KB | 900x341 | Recoloured to `#003760`. |
| `isks-built-to-last-solid.png` | 58 KB | 400x335 | **The cut used in the footer bar.** Filled two-tone mark: amber glyphs with the `#DD4111` offset shadow. Keyed out of the bar artwork, since the pptx only ships the outlined version as a standalone file. Source ink is 236px wide, so do not display this much above ~400px. |
| `isks-built-to-last-white.png` | 29 KB | 560x448 | Outlined cut, white. |
| `isks-built-to-last-amber.png` | 27 KB | 560x448 | Outlined cut, `#F0A413`. |
| `isks-built-to-last-teal.png` | 27 KB | 560x448 | Outlined cut, `#066F6B`, for white backgrounds. |

## Solid vs outlined lockup

Worth being explicit, because picking the wrong one is the easiest mistake here:

- **Solid** (`isks-built-to-last-solid.png`) -- filled letterforms, two-tone with
  the red-orange offset shadow. This is what the footer bar and the title-slide
  circuit board use. Small, so keep it small.
- **Outlined** (`isks-built-to-last-white/amber/teal.png`) -- hollow letterforms,
  single colour, drawn as strokes. This is `image5` from the pptx, at much
  higher resolution. Use it for large display treatments.

They are not interchangeable: the outlined cut on a small footer bar reads as
noise, and the solid cut blown up goes soft.

## Not extracted

The pptx's six slides are empty layout instances -- no text, no images, no
colour overrides of their own. Everything visual lives in `slideLayout1`-`6`
and the master, which is why the tokens cite layouts rather than slides.

The two `notesSlides` are short but do carry design instructions, so they are
recorded here rather than dropped:

- **notesSlide1** (title slide) -- `Titel | Ondertitel | Foto van de spreker(s)
  + namen`. Confirms the title layout's three text blocks and that the amber
  ellipse is a speaker portrait, not decoration.
- **notesSlide2** (card layout) -- *"Hier kun je in de vakjes iconen toevoegen
  via pictogrammen. Standaard komen ze er in het zwart in te staan: zet ze nog
  even om naar wit of dezelfde oranje kleur als het driehoekje voor de titel."*
  Icons go inside the gradient cards, and must be recoloured from the default
  black to **white** or to **the same amber as the title triangle**
  (`--isks-amber`). `.isks-card__icon` follows this.
