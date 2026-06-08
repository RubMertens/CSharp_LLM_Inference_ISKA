# Info Support -- Imagery & Visual Style (Enhanced)

> Source: Chapters 7 (Stijlelementen), 8 (Schrijfwijze), and 9 (Fotografie), pages 37-63.
> Extracted assets are in `assets/` -- see `assets/INDEX.md` for the full inventory.

---

## 1. Graphic Style Elements (Stijlelementen)

All style elements derive from the brand promise "Vooruit" -- a forward motion at 45 degrees.

### 1.1 Triangles (Driehoeken)

The **primary graphic motif** of the brand. Three fill variants exist:

1. **Solid fill** -- a flat-colour triangle
2. **Diagonal-line fill** -- triangle filled with parallel diagonal lines (hatching)
3. **Small-triangle-pattern fill** -- triangle filled with a repeating mini-triangle mosaic

These three variants are visible on the cover page of the brand guide itself (page 1) and demonstrated in detail on pages 39-42.

**Visual reference:** See the brochure cover mockups for each audience, which show all three fill types in action:
- `assets/p14-business-brochure-graphic-cover.jpg` -- Business audience (navy/cyan/lime, no overlap)
- `assets/p16-intern-brochure-graphic-cover.jpg` -- Intern audience (cyan/red, overlapping allowed)
- `assets/p18-arbeidsmarkt-brochure-graphic-cover.jpg` -- Arbeidsmarkt audience (multi-colour on cyan bg, free overlap)

**Rules:**
- The longest edge (hypotenuse) **must always point to the upper right** (page 37 shows Do's and Don'ts with green/red check marks).
- Triangles can be positioned in 2 orientations (both pointing upper-right): hypotenuse top-right or bottom-right.
- Triangles are placed on an **8-column grid** based on document width (page 43).
- Allowed sizes: 1x grid-unit width, or 2x grid-unit width.
- Triangles may slope on all sides.
- Triangles used as text frames may be placed at 1/16 or 1/32 of the grid.
- Combining multiple triangles into a rectangle is only allowed if a photo background is visible through them (page 37 Don'ts).

**Per audience:**
| Audience | Overlap allowed? | Fill variants available | Notes |
|---|---|---|---|
| Handelsdrukwerk en signing | No -- must never overlap | Solid, hatched, mosaic | Most calm and business-like appearance |
| Business | No overlap | Solid, hatched, mosaic + code snippet | Adds code-snippet style element |
| Intern | Yes -- may overlap for depth | Solid, hatched, mosaic + code snippet | More playful combinations |
| Arbeidsmarkt | Yes -- free overlap | Solid, hatched, mosaic + code snippet | Same as Intern but with full colour freedom |

**Reproducible CSS -- Solid-fill right-triangle:**

```css
/* Solid-fill right-triangle pointing upper-right */
.triangle-solid {
  width: 0;
  height: 0;
  border-left: 200px solid var(--is-cyan, #009FE3);
  border-top: 200px solid transparent;
}
/* Alternate orientation (hypotenuse at top) */
.triangle-solid-alt {
  width: 0;
  height: 0;
  border-bottom: 200px solid var(--is-cyan, #009FE3);
  border-right: 200px solid transparent;
}
```

**Reproducible SVG -- All three fill variants:**

```svg
<!-- 1. Solid fill triangle -->
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <polygon points="0,200 200,0 200,200" fill="#009FE3"/>
</svg>

<!-- 2. Diagonal-line (hatched) fill triangle -->
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse"
             patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#009FE3" stroke-width="3"/>
    </pattern>
    <clipPath id="tri-clip">
      <polygon points="0,200 200,0 200,200"/>
    </clipPath>
  </defs>
  <rect width="200" height="200" fill="url(#hatch)" clip-path="url(#tri-clip)"/>
</svg>

<!-- 3. Small-triangle-mosaic fill -->
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="mini-tri" width="12" height="12" patternUnits="userSpaceOnUse">
      <polygon points="0,12 6,0 12,12" fill="#009FE3"/>
    </pattern>
    <clipPath id="tri-clip2">
      <polygon points="0,200 200,0 200,200"/>
    </clipPath>
  </defs>
  <rect width="200" height="200" fill="url(#mini-tri)" clip-path="url(#tri-clip2)"/>
</svg>
```

**Don'ts:**
- Triangles pointing the wrong way (long edge to the left or down-left).
- Combined triangles forming a rectangle are only allowed if a photo (background) is visible through them; otherwise not permitted.

### 1.2 Small Triangle (Klein driehoekje)

Page 45 shows the small triangle accent in Do/Don't format.

- A miniature triangle used as a free-standing graphic accent.
- Always in **Navy** colour (`#1C3348`).
- May only point upper-left or lower-left (two forward-facing orientations).
- Sized relative to the document grid (1/16th or 1/32nd).
- Do: place on grid intersections. Don't: place off-grid or pointing backward (right).

**Reproducible CSS:**

```css
.small-triangle-accent {
  width: 0;
  height: 0;
  border-right: 12px solid var(--is-navy, #1C3348);
  border-bottom: 12px solid transparent;
}
```

### 1.3 Fast Forward Arrows (Pijltjes / >>)

**Visual reference:** `assets/p46-fast-forward-pagination.png` -- shows the >> arrows in pagination context.

- The >> icon (two chevrons), also called "Fast Forward".
- Used for two purposes:
  1. Free-standing graphic accent / style element
  2. Pagination accent (appears near page numbers)
- Comes in three visual weights (thin, medium, thick/filled).
- **Do:** point right/forward (>>). **Don't:** point left/backward (<<).

The pagination example on page 46 shows the >> placed in the lower-right corner of a page layout grid, beside the page number.

**Reproducible SVG -- Fast-forward arrows (three weights):**

```svg
<!-- Thin weight -->
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <polyline points="4,4 12,12 4,20" fill="none" stroke="#1C3348" stroke-width="1.5"/>
  <polyline points="12,4 20,12 12,20" fill="none" stroke="#1C3348" stroke-width="1.5"/>
</svg>

<!-- Medium weight -->
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <polyline points="4,4 12,12 4,20" fill="none" stroke="#1C3348" stroke-width="2.5"/>
  <polyline points="12,4 20,12 12,20" fill="none" stroke="#1C3348" stroke-width="2.5"/>
</svg>

<!-- Thick / filled weight -->
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <polygon points="2,2 12,12 2,22" fill="#1C3348"/>
  <polygon points="12,2 22,12 12,22" fill="#1C3348"/>
</svg>
```

### 1.4 Code Snippet Overlay

- Used in Business, Intern, and Arbeidsmarkt materials.
- A rotated block of source code (placed at a 45-degree angle within a triangle) subtly communicates Info Support's tech DNA.
- Not used in Handelsdrukwerk en signing.
- Visible in the brochure mockups: `assets/p14-business-brochure-photo-cover.jpg`, `assets/p16-intern-brochure-photo-cover.jpg`, `assets/p18-arbeidsmarkt-brochure-photo-cover.jpg`.

**Visual description:** The code snippet is rendered in a monospaced font at reduced opacity, rotated approx. 45 degrees counter-clockwise, and clipped inside a triangle shape. The text appears to be a FizzBuzz-style algorithm in a C-like syntax. The colour is typically white or light-cyan against a darker triangle fill.

**Reproducible CSS approach:**

```css
.code-snippet-overlay {
  position: absolute;
  font-family: 'Courier New', monospace;
  font-size: 8px;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.4);
  transform: rotate(-45deg);
  white-space: pre;
  overflow: hidden;
  clip-path: polygon(0% 100%, 100% 0%, 100% 100%);
}
```

---

## 2. Grid & Layout System

### Margins (Vrije marge)
- Document width is divided into **16 equal columns**.
- **1 column width = the margin** on all four sides.
- Nothing may extend beyond these margins except images and triangle style elements.

### Triangle Positioning Grid (pages 43-44)
- Document width divided into **8 equal parts** for placing triangles.
- The height (y-axis) uses the same unit but may vary.
- Origin point (nul punt) is at the **bottom-left corner**.
- For landscape documents, the grid is based on document width, not spread width.

**Visual description (page 43):** A full-page diagram shows the 8-column grid with x-axis and y-axis labels, "nul punt" (origin) at bottom-left, "bovenzijde document" (top of document) marked with a green line, and "breedte document" (document width) spanning the full width. Two semi-transparent grey triangles demonstrate placement on this grid.

**Visual description (page 44):** A second example shows a landscape-orientation grid with two overlapping triangles at the bottom, and an inset showing how for spreads, the grid is still based on single-page width (not the spread).

---

## 3. Stationery & Collateral Overview

**Visual reference:** `assets/p12-stationery-overview.jpg`

Page 12 shows the complete "Basiselementen" (base elements) suite photographed isometrically on a light-grey surface. Items visible:
- A4 letterhead (white, logo bottom-right, minimal triangle accents)
- Compliment slip (white, small triangle accent)
- A4 and A5 brochure covers (with triangle compositions)
- DL envelope (small triangle in corner)
- Business cards (front and back, with triangle and logo)
- Presentation folder
- Name badge

All items share the consistent bottom-right logo placement, navy/cyan colour palette, and right-pointing triangle motifs.

---

## 4. Brochure Cover Compositions Per Audience

Each audience has two canonical cover designs: one photo-led, one graphic-only.

### 4.1 Business (pages 13-14)

**Spec page (p13):** Logo positioned bottom-right. Primary colours: white, cyan, navy. Secondary colours (max 2): lime, yellow, pink. Style elements: solid, hatched, mosaic triangles. No overlap allowed. Grid built from bottom-left. Photo backgrounds permitted with cyan/navy overlay + max 2 secondary colours.

**Photo cover:** `assets/p14-business-brochure-photo-cover.jpg`
- Mature man (grey hair, hand on chin) as subject -- professional, confident
- Navy blue photo tint / overlay
- Title "Dolarsamit" in white Titillium Web
- Bottom-right: cyan and navy triangles (solid + hatched), diagonal code snippet overlay
- URL along right edge vertically
- Logo bottom-right

**Graphic cover:** `assets/p14-business-brochure-graphic-cover.jpg`
- White background
- Title "Lorem & Dolarsamit" in cyan
- Navy, cyan, and lime triangles arranged in lower-right cluster
- Code snippet overlay in one triangle
- Fast-forward arrows (>>) as accents
- Logo bottom-right

### 4.2 Intern (pages 15-16)

**Spec page (p15):** Same structure as Business but secondary colours: lime + red. Triangles may overlap. For text-only materials (e-mails, letters), Arial in black is also acceptable.

**Photo cover:** `assets/p16-intern-brochure-photo-cover.jpg`
- Young man (dark hair) as subject -- focused, contemporary
- Blue-tinted photo overlay
- Bottom area: cyan, red triangles -- overlapping
- Code snippet overlay visible

**Graphic cover:** `assets/p16-intern-brochure-graphic-cover.jpg`
- White background
- Cyan, red, and navy triangles -- more dynamic composition with overlaps
- Code snippet in corner triangle
- Fast-forward arrows

### 4.3 Arbeidsmarkt (pages 17-18)

**Spec page (p17):** Full secondary palette available (red, purple, pink, lime, yellow). All five secondary colours may appear. Triangles overlap freely.

**Photo cover:** `assets/p18-arbeidsmarkt-brochure-photo-cover.jpg`
- Casual young man in denim jacket and red beanie -- approachable, youthful
- Grey-toned photo
- Bottom: red, yellow, white triangles in a vibrant, overlapping composition
- Code overlay present

**Graphic cover:** `assets/p18-arbeidsmarkt-brochure-graphic-cover.jpg`
- Cyan/light-blue background
- Full multi-colour triangle explosion: navy, white, red, yellow, lime
- Multiple fill types overlapping freely
- Most expressive and colourful of all audiences
- Code snippet, fast-forward arrows present

---

## 5. Logo Usage Examples

**Visual references:** `assets/p21-logo-on-white.jpg`, `assets/p21-logo-on-cyan.jpg`, `assets/p21-logo-on-navy.jpg`, `assets/p21-logo-on-white-alt.jpg`, `assets/p21-logo-on-photo-do.jpg`, `assets/p21-logo-on-photo-dont.jpg`

Page 21 demonstrates logo placement Do's and Don'ts:

| Example | File | Rule |
|---|---|---|
| Logo on white background | `p21-logo-on-white.jpg` | DO -- blue logo on white/light |
| Logo on cyan background | `p21-logo-on-cyan.jpg` | DO -- blue logo on brand cyan |
| Logo on navy background | `p21-logo-on-navy.jpg` | DO -- white logo reversed on dark navy |
| White logo on dark | `p21-logo-on-white-alt.jpg` | DO -- white reversed variant |
| Logo on calm photo | `p21-logo-on-photo-do.jpg` | DO -- sufficient contrast area |
| Logo on busy photo | `p21-logo-on-photo-dont.jpg` | DON'T -- insufficient contrast, logo lost in detail |

**Key rules from page 19-21:**
- The logo is only used in blue (as shown) or in white.
- "Solid Innovator" tagline is never separated from the wordmark.
- The logo must be scaled proportionally as a single unit.
- Whitespace zone ("vrije marge") around logo = 1/16th of document width (page 20).
- Logo may span 3 or 4 grid columns depending on visibility needs.

---

## 6. Photography (Fotografie)

### 6.1 Visual Language (Beeldtaal) -- page 49

The brand communicates as a **"Specialistische Leider"** (Specialist Leader):
- Focused on the leader/individual
- Result-oriented
- Shot from below (low angle)
- Dynamic
- Leading / walking ahead
- Confident before the camera

### 6.2 Image Guidelines (Beeldrichtlijnen) -- page 50

**Appropriate (Passend):** Winning, Active, Focus, Perspective, Individual, Bright colours, Contemporary, Formal/business-like, Stylistic, Authentic, Sharp/high quality, Action-oriented

**Not appropriate (Niet passend):** Cosy, Timid, Passive, Complete/full, Together/group, Warm colours, Old-fashioned/dated, Informal, Spontaneous, Fake/staged, Blurry main subject, Poor quality material, Sketch-like

### 6.3 Composition -- Rule of Thirds (pages 51-54)

Four photography examples demonstrate the Rule of Thirds with green grid overlay lines:

| Composition | File | Description |
|---|---|---|
| Landscape, right-oriented | `assets/p51-photo-rule-of-thirds-landscape-right.jpg` | Young man in blue button-down shirt looking right, placed on left third-line intersection. Modern office with glass facade in background. Natural daylight, cool tones. |
| Landscape, left-oriented | `assets/p52-photo-rule-of-thirds-landscape-left.jpg` | Older man with glasses in white shirt at laptop, placed on right third-line. Modern open-plan office. Eye-level shot. |
| Portrait, right-oriented | `assets/p53-photo-rule-of-thirds-portrait-right.jpg` | Young man at desk with pen, face at upper-right third intersection. Shallow depth of field, blurred background. |
| Portrait, left-oriented | `assets/p54-photo-rule-of-thirds-portrait-left.jpg` | Older man in check suit standing, face at upper-left third intersection. Modern architectural space. Confident posture. |

**Common traits across all examples:**
- Cool colour temperature (blues, greys, whites)
- Clean, modern office/architectural environments
- Professional attire (business casual to formal)
- Single subject, no groups
- Sharp focus on subject, clean or blurred background

### 6.4 Composition -- Centred Image (pages 55-58)

Four examples of centred composition:

| Format | File | Description |
|---|---|---|
| Landscape | `assets/p55-photo-centred-landscape.jpg` | Young man standing centred in frame, outdoors with modern building facade. Blue shirt, holding document/tablet. Looking slightly upward -- optimistic. |
| Portrait | `assets/p56-photo-centred-portrait.jpg` | Older man in check suit, close-cropped portrait, centred. Glasses, grey hair, direct gaze. Indoor setting with glass reflections. |
| Square (casual) | `assets/p57-photo-centred-square-casual.jpg` | Young man in blue shirt, standing outside, holding something. Centred composition, bright daylight, modern building behind. |
| Square (formal) | `assets/p58-photo-centred-square-formal.jpg` | Older man in check suit with tablet device, looking down at it. Centred, indoor office with colourful signage visible in background. |

### 6.5 Perspective and Lines (pages 59-60)

**Vertical lines:** `assets/p59-photo-perspective-vertical-lines.jpg`
- Older man standing beside a wooden fence/wall with prominent vertical slats
- Green lines overlay showing how the environmental verticals create rhythm and direct attention
- Subject placed at right third

**Diagonal lines:** `assets/p60-photo-perspective-diagonal-lines.jpg`
- Young man sitting on wooden bench/bleachers with strong diagonal lines
- Laptop on lap, casual pose
- Green lines overlay showing how the bench slats create diagonal leading lines across the frame
- The original PDF included 19 small thumbnail crops breaking down the line analysis; these were removed as redundant with the parent image above

**Key principle:** Seek leading lines (vertical, horizontal, or diagonal) in the environment. Lines create calm and direct attention to the subject.

### 6.6 Art of Omission (Kunst van het weglaten) -- page 61

**Visual reference:** `assets/p61-photo-art-of-omission.jpg`

- Older man in grey check suit, standing confidently
- Background is **extremely clean**: green trees and a glass/steel structure, softly out of focus
- Subject is the unmistakable focal point
- Demonstrates the principle: keep backgrounds simple, subject always central against a clean backdrop

### 6.7 Camera Perspective (Beeldperspectief) -- pages 62-63

Two allowed perspectives:

**Low angle (Van onderaf):** `assets/p62-photo-low-angle-perspective.jpg`
- Older man shot from below, looking slightly down
- Glass ceiling/structure visible above
- Conveys authority, leadership, expertise
- Arms crossed -- confident body language

**Eye level (Op ooghoogte):** `assets/p63-photo-eye-level-perspective.jpg`
- Same man, shot straight on at eye level
- Indoor setting, natural light from windows
- Conveys equality, connection, approachability
- Direct gaze at camera

---

## 7. Recurring Visual Patterns and Motifs (Summary)

### 7.1 The 45-degree diagonal

The single most pervasive visual element. It appears as:
- Triangle hypotenuses (always pointing upper-right)
- Code snippet rotation angle
- Implied motion direction in photography compositions
- Hatching pattern angle in triangle fills

### 7.2 Navy + Cyan as anchors

Every audience palette starts from white + cyan (`#009FE3`) + navy (`#1C3348`). Secondary colours are layered on top but the navy/cyan foundation is constant.

### 7.3 Professional single-subject photography

All photography examples share: one person, professional setting, cool/neutral colour temperature, clean backgrounds, high sharpness. Two recurring models are used throughout (a younger man in blue shirt, an older man in check suit with glasses).

### 7.4 Grid discipline

Every element -- triangles, logos, margins, even photo compositions -- is tied to a mathematical grid (8-column for elements, 16-column for margins, thirds for photos). This consistency is fundamental to the brand's "solid" feel.

### 7.5 Code as texture

The rotated code snippet (visible in Business, Intern, Arbeidsmarkt covers) functions as a texture/pattern rather than readable content. It signals "technology" without being literal about it.

---

## 8. Important Vector Elements NOT Extracted as Raster

The following elements exist in the PDF as vector drawings and could not be extracted by `pdfimages`. They are described here for reproduction:

1. **Logo wordmark** (page 19) -- "infoSupport" in a custom script-like typeface with "Solid Innovator" tagline below in bold italic. The dot before the "i" is a distinctive square element. Available only as vector in the PDF.

2. **Triangle fill patterns** (pages 39-42) -- The three triangle variants (solid, hatched, mosaic) are drawn as vector paths. See SVG reproductions in section 1.1 above.

3. **Small triangle accent** (page 45) -- Four orientations shown as Do/Don't. Solid navy fill, vector.

4. **Fast-forward arrows** (page 46) -- Three weight variants shown as Do/Don't. Vector paths.

5. **Grid diagrams** (pages 20, 43-44) -- The positioning grids with measurements are vector illustrations. Described in section 2.

6. **Rule-of-thirds grid overlays** (pages 51-60) -- Green grid lines overlaid on photos are vector; the underlying photos ARE extracted.

---

## 9. Writing Style (Schrijfwijze)

- "Info Support" is always written as **two separate words**, both with capital letters.
- Correct: "Info Support"
- Incorrect: "InfoSupport", "info support", "Infosupport", "infosupport"

---

## 10. Materials (Materialen) -- Print Only

- **Paper types:** Olin Absolute White (uncoated) and Silk Mc (coated)
- Both are FSC certified.
- Olin Absolute White: for trade printing and items that go through a printer (name badges, certificates).
- Silk Mc: for all other printed items (magazines get a matte finish on the cover).
- Colour values differ between coated and uncoated stock (see colors.md).

> **Note:** The guide does not provide specific guidance on table styling, button design, digital UI components, or animation. These would need to be designed in keeping with the colour palette, typography, and triangle motifs documented here.
