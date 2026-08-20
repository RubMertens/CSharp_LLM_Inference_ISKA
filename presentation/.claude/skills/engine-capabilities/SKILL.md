---
name: engine-capabilities
description: Use when building slides, modifying the presentation engine, or debugging slide behavior — reference for all PresentationEngine features, slide HTML format, CSS classes, and fragment system
---

# Presentation Engine Capabilities

Quick reference for everything the engine supports. Consult before creating/modifying slides.

## Architecture

```
slides.json (manifest)  →  loader.js (fetch + parse)  →  engine.js (render + navigate)
     ↓                          ↓                              ↓
  path array            { id, title, html }           DOM insertion + transitions
```

- **Manifest**: `slides.json` — ordered JSON array of file paths
- **Loader**: fetches each HTML file, parses `<section data-id>` wrapper, returns `{ id, title, html }`
- **Engine**: `PresentationEngine` class — manages navigation, fragments, transitions, overview

## Slide HTML Format

Every slide file must contain:

```html
<section data-id="kebab-id" data-title="Human Title">
  <!-- content here -->
</section>
```

| Attribute | Required | Used for |
|-----------|----------|----------|
| `data-id` | yes | URL hash navigation (`#kebab-id`), slide identity |
| `data-title` | no | Overview mode display (falls back to `data-id`) |

## Navigation

| Input | Action |
|-------|--------|
| `ArrowRight` / `ArrowDown` / `Space` | Next fragment or next slide |
| `ArrowLeft` / `ArrowUp` | Previous fragment or previous slide |
| `Escape` | Toggle overview grid |
| Mouse wheel | Next/prev (300ms cooldown) |
| URL hash `#slide-id` | Direct navigation |

Programmatic: `engine.next()`, `engine.prev()`, `engine.goTo(index)`, `engine.getCurrentSlide()`.

## Fragment System

Add `class="fragment"` to any element for progressive reveal.

### Basic fragments

```html
<p class="fragment">Revealed on first click</p>
<p class="fragment">Revealed on second click</p>
```

Fragments reveal top-to-bottom in DOM order.

### Indexed fragments (grouped reveal)

```html
<div class="fragment" data-fragment-index="0">These two</div>
<div class="fragment" data-fragment-index="0">reveal together</div>
<div class="fragment" data-fragment-index="1">This reveals next</div>
```

All fragments with the same `data-fragment-index` reveal simultaneously. Lower index reveals first.

### Current-visible fragments (show-then-hide)

```html
<div class="fragment current-visible" data-fragment-index="0">Visible only at step 0</div>
<div class="fragment current-visible" data-fragment-index="1">Replaces previous at step 1</div>
```

`current-visible` fragments auto-hide when the next index is revealed. Useful for swapping content in place.

### Fragment CSS states

| Class | Meaning |
|-------|---------|
| `fragment-hidden` | Not yet revealed (opacity 0, translateY 10px) |
| `fragment-visible` | Revealed (opacity 1, translateY 0) |

Transition: 0.35s ease on opacity + transform.

### Backward navigation

Going back hides the highest-index visible fragments first. When navigating to a previous slide, all fragments on that slide are pre-revealed.

## Slide Transitions

Directional slide-in/slide-out with 0.4s CSS transitions. Direction determined by navigation (forward = right, backward = left). Old slides removed after transition or 600ms timeout.

## UI Elements

| Element | Behavior |
|---------|----------|
| `#progress` | Top bar, width = percentage through deck |
| `#slide-counter` | Bottom-right, shows `N / total` |
| `.nav-hint` | Bottom-center keyboard hint (always visible) |
| `.speaker-notes` | Hidden on render (`hidden = true`) |

## Code Highlighting

Two options. Prefer **code panels** for anything from the demo project.

### Code panels

`js/vscode-code.js` turns any `<div class="vscode-window">` into a code panel:
syntax-highlighted C#, real file line numbers, and a walkthrough layer (line
highlights, fake debugger inline values, a stopped-line marker) driven by the
engine's fragments. No editor furniture and no narration text — the panel fills the
slide, and the speaker does the talking.

The code lives **in the slide**, written there by `npm run code:embed` from
`../demos`. So a deck is self-contained: nothing is fetched at render time, nothing
is copied into `dist`, and it works from a `file://` URL. Monaco is used as a
tokenizer only (no editor instance), the result is cached per snippet, and it
re-renders automatically for overview mode and every navigation.

```html
<div class="vscode-window"
     data-src="Runner.ConsoleApp/Math/Vector.cs"
     data-member="operator *"
     data-start-line="28">
  <pre class="vscode-source">
public static float operator *(Vector a, Vector b)
{
    ...
}
  </pre>
</div>
```

**Authoring flow.** Write the window with a reference (`data-src` plus one selector),
then let the tool fill in the code:

```bash
npm run code:embed -- --write   # extract from ../demos into the slides
npm run code:embed             # dry run: what is missing or has drifted
npm run check:code             # embedded code vs source, and every marker's lines
npm run check:code -- --show   # also print the embedded code, numbered
```

Selectors (used by the tools, never at runtime): `data-member="Forward"` (method /
property / operator / type, brace matched, doc comments included),
`data-region="Name"`, `data-lines="12-40"`, `data-match="regex"`, `data-nth="2"` for
overloads. `data-start-line` is written by the tool and drives the gutter numbering.

Code can also be hand-written: drop the `data-src` reference and just write the
`<pre class="vscode-source">` (escape `<` as `&lt;`). Then there is nothing to check
and no source pointer.

**Presentation attributes:**

| Attribute | Default | Meaning |
|-----------|---------|---------|
| `data-theme` | `light` | `light` (Light Modern, matches the deck) or `dark` (Dark Modern) |
| `data-numbers` | `file` | `file` (real line numbers) / `snippet` / `off` |
| `data-font-size` | auto by line count | treated as a **maximum** — the fit pass shrinks it further if needed |
| `data-max-height` | `56vh` | ceiling for the code area |
| `data-wrap` | `on` | soft-wrap long lines |
| `data-highlight="3-5,9"` | — | always-on highlighted lines (snippet-relative) |
| `data-highlight-text="sum +="` | — | highlight every line containing this text |
| `data-dim` | `on` | dim non-highlighted lines while a step is active |
| `data-steps` | `replace` | one band at a time; `accumulate` keeps earlier bands lit |
| `data-notes` | `off` | render `data-note` under the code (a speaker cue, normally spoken) |
| `data-source-ref` | `on` with `data-src` | `path:line-range` strip under the code, linking to the file |

Editor chrome exists but is **off** by default: `data-chrome="minimal|full"` (tab strip
/ title bar + tabs, with `data-tab` / `data-tabs`), `data-minimap="on"`,
`data-statusbar="on"`, `data-breadcrumbs="on"`. Turn them on only if a slide is
specifically about the editor.

**Auto-fit.** After render, each panel is measured against the room actually left
below it *in its own column*, then the font is grown (up to 1.7rem) or shrunk (down to
0.42rem) so the snippet fills that space; only if the floor isn't enough is the code
area clamped and left to scroll, with step highlights scrolling themselves into view.
`data-font-size` is just the starting point — authoring one is rarely worth it.

Practical consequence: a short method renders huge, a 30+ line one renders small. If a
snippet is too long to read from the back row, cut it down (`data-lines`, or a tighter
`data-member`) or split it across two slides — anchor the steps with `data-text` so
they survive the re-cut.

**Pointing at the source.** A window with `data-src` prints
`demos/path/to/File.cs:from-to` under the code. It becomes a link when the deck knows
where the sources live — `code-root.json`, served by the dev server as the absolute
`../demos` path and written by the build as the GitHub repo URL. Locally it opens
`vscode://file/…:line`; deployed it opens the GitHub blob at `#L28-L39`. Pressing `o`
on a slide opens the first panel's source, which beats hunting for it mid-talk.

### Fragment-driven code walkthrough

Add `.vscode-step` markers as children. They're invisible plain fragments: the engine
reveals them in order, and the panel highlights the latest one's lines and dims the
rest. Nothing else is needed on the slide — no bullet list to drive the stepping.

```html
<div class="vscode-window" data-src="…" data-member="operator *" data-start-line="28">
  <pre class="vscode-source">…</pre>
  <span class="vscode-step fragment" data-fragment-index="0" data-lines="3-4"></span>
  <span class="vscode-step fragment" data-fragment-index="1" data-text="sum +="></span>
</div>
```

Rules:
- `data-lines` on a step is **snippet-relative** (1 = first shown line); `data-text`
  matches whole lines and survives edits to the demo code — prefer it.
- Steps are plain `.fragment` markers. (`current-visible` also works, but is no longer
  needed: the panel already shows one band at a time.)
- `data-steps="accumulate"` on the panel keeps earlier bands lit instead.

Two panels side by side: wrap them in `.two-column`. Each is fitted against its own
column, so they size independently.

Still available but unused by the deck: `.code-split` (prose | code grid),
`.code-steps` (numbered narration list), `.code-caption` (muted line under a panel).
The code slides deliberately carry none of that text — it is spoken.

### Diff transitions (one version becoming the next)

The demo project evolves by copying a transformer and adding one idea, so the most
useful thing a slide can show is the *difference*. A panel can hold both versions:

```html
<div class="vscode-window"
     data-src="Runner.ConsoleApp/2_WithRope/TransformerWithRope.cs"
     data-member="Forward"
     data-diff-from="Runner.ConsoleApp/1_SingleLayer/Transformer.cs"
     data-diff-ignore="case">
  <pre class="vscode-source">…unified listing, written by code:embed…</pre>
  <span class="vscode-step fragment" data-fragment-index="1" data-diff
        data-note="rotate Q and K — the whole of RoPE at this level"></span>
</div>
```

`npm run code:embed -- --write` extracts both sides, diffs them, and writes the unified
listing plus `data-added`, `data-removed` and `data-before-start-line`. Nothing diffs at
render time.

| Attribute | On | Meaning |
|-----------|----|---------|
| `data-diff-from` | window | the "before" file; the selector defaults to the same member/region/lines as the after side |
| `data-diff-member` / `-region` / `-lines` / `-match` / `-nth` | window | override the selector for the before side |
| `data-diff-ignore="case,exact-whitespace"` | window | what counts as noise when matching lines up |
| `data-diff` | `.vscode-step` | the step where the code changes |
| `data-diff="on"` | window | show the diff from the outset, no step |

**Both states are truthful.** Before the step the panel *is* the old version: additions
are out of the flow, the gutter counts the before file, and the source strip names it.
On the step the additions arrive in green with `+`, removals go red with `−`, and the
gutter and source strip switch to the after file. So you can point at either version and
the line numbers are real.

**`data-diff-ignore="case"` is usually needed** for this deck. `1_SingleLayer` uses
`weights` and `2_WithRope` renamed it to `Weights`, so a raw comparison marks nearly
every line changed and buries the two that matter. Case-insensitive matching reduces it
to the real change. Lines match on their whitespace-collapsed form by default; add
`exact-whitespace` if indentation *is* the point.

`npm run check:code` re-extracts both sides and fails if the embedded listing or the
`data-added` / `data-removed` marks have drifted.

Example: `slides/21c-rope-diff.html`.

### Fake debugger inline values

The values VS Code prints at the end of a line while paused, written by hand on the
slide. Nothing is executed.

```html
<!-- always on: the example inputs, like a watch window -->
<span class="vscode-inline" data-line="1" data-value="a = [2, 3]   b = [4, 5]"></span>

<span class="vscode-step fragment current-visible" data-fragment-index="1"
      data-lines="6-10" data-stopped="9"
      data-values="6: sum = 0 | 7: i = 0, 1 | 9: 2×4 = 8, then 3×5 → sum = 23"
      data-note="Multiply pairs, accumulate into sum"></span>
```

| Attribute | On | Meaning |
|-----------|----|---------|
| `data-values="9: sum = 23 \| 11: returns 23"` | `.vscode-step` | inline values shown while that step is active; `line: text`, `\|`-separated |
| `data-stopped` / `data-stopped="9"` | `.vscode-step` | render the band (or just line 9) as the debugger's stopped line — amber + gutter arrow |
| `data-line`/`data-text` + `data-value` | `.vscode-inline` | one inline value, always on, or fragment-driven if it also has `.fragment` |

Values are plain text (escape `<` as `&lt;`). Keep the numbers consistent with the
interactive slides — the RMSNorm code slide reuses `[2, 3, 1, 4]`, so Σ = 30 and
rms = 2.74 match the diagram the audience just dragged. `npm run check:code` verifies
every marker and every value line still exists in the snippet.

`preview-code.html` (dev only) is a standalone harness for authoring panels; `?step=N`
jumps to a step. `probe-slide.html?slide=<data-id>&steps=N&debug=1` loads one slide
through the real engine, advances N fragments and prints layout measurements — that's
how to screenshot a mid-walkthrough state or debug the fit.

### highlight.js (plain code blocks)

highlight.js runs on every `pre code` element after slide render. Use language classes:

```html
<pre><code class="language-csharp">var x = 42;</code></pre>
```

Loaded languages: C# (`csharp`). Theme: Atom One Light.

## CSS Layout Classes

| Class | Description |
|-------|-------------|
| `.slide-title` | Centered title slide (gradient h1) |
| `.slide-content` | Content container (max-width 95%) |
| `.two-column` | CSS grid, 2 equal columns |
| `.three-column` | CSS grid, 3 columns |
| `.code-block` + `.code-header` | Styled code container with filename header |
| `.highlight` | Accent-colored bold text |
| `.big-text` | Large centered statement (max-width 18ch) |
| `.icon-list` | List with custom icons (no bullets) |
| `.pipeline` + `.stage` + `.arrow` | Horizontal flow diagram |
| `.center` | Centered flex column |

## CSS Custom Properties

```
--color-bg          #0a0e17    --color-accent       #38bdf8
--color-bg-subtle   #111827    --color-accent-glow  rgba(56,189,248,0.15)
--color-text        #e2e8f0    --color-code-bg      #1e293b
--color-text-muted  #94a3b8    --color-code-text    #e2e8f0
--color-heading     #f1f5f9    --color-border       #1e293b
--font-sans         system     --font-mono          SF Mono/Cascadia/Fira
```

## Responsive

- Mobile (`<768px`): columns collapse to single column, pipeline goes vertical
- Print: all slides visible, fragments revealed, white background, no UI chrome

## Overview Mode

Escape toggles a 4-column grid overlay. Each slide shown as button with title. Current slide highlighted. Click to navigate.

## Additional Scripts

`rotation-interact.js` — standalone drag-to-rotate SVG interaction for the RoPE rotation slide. Not part of the engine; loads independently.

`vscode-code.js` — code panels (see Code Highlighting). Also independent of the
engine: it watches `document.body` for added `.vscode-window` elements, so it works
for slide navigation, overview mode and standalone pages alike. `code-extract.js` and
`tools/slide-windows.js` are node-only — they back `code:embed` and `check:code`, and
never ship to the browser.
