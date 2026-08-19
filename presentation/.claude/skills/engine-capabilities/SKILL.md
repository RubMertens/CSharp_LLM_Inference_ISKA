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

Two options. Prefer **code windows** for anything from the demo project.

### Code windows (VS Code look, snippets pulled from ../demos)

`js/vscode-code.js` turns any `<div class="vscode-window">` into a VS Code
"Dark Modern" window: title bar, tab strip, breadcrumbs, line number gutter,
minimap, status bar. Snippets are fetched from the real demo sources (`/code/*` →
`../demos`) and tokenized with Monaco's C# grammar, so slides can't drift from the
code being demoed. Rendering is static HTML (no editor instance), cached per
snippet, and re-runs automatically for overview mode and every navigation.

```html
<div class="vscode-window"
     data-src="Runner.ConsoleApp/Math/Vector.cs"
     data-member="operator *"></div>
```

**Source selection** (first match wins):

| Attribute | Meaning |
|-----------|---------|
| `data-lines="12-40"` | line range in the file |
| `data-region="Name"` | `#region Name` … `#endregion` |
| `data-member="Forward"` | method / property / operator / type by name, incl. its doc comments |
| `data-match="regex"` | raw declaration regex (escape hatch) |
| `data-nth="2"` | pick the 2nd match — for overloads |
| `data-code="…"` | inline code instead of `data-src` |
| `<pre class="vscode-source">…</pre>` child | inline code (escape `<` as `&lt;`) |

**Presentation:**

| Attribute | Default | Meaning |
|-----------|---------|---------|
| `data-lang` | `csharp` | Monaco language id |
| `data-tab` | file name | active tab label |
| `data-tabs="a.cs,b.cs"` | — | extra inactive tabs |
| `data-theme` | `dark` | `dark` (Dark Modern) or `light` (Light Modern) |
| `data-chrome` | `full` | `full` / `minimal` (tabs only) / `none` |
| `data-minimap` | `on` | fake minimap column |
| `data-statusbar` | `on` | bottom status bar |
| `data-breadcrumbs` | `on` with a path | path › member breadcrumb row |
| `data-numbers` | `file` | `file` (real line numbers) / `snippet` / `off` |
| `data-font-size` | auto by line count | e.g. `0.7rem` |
| `data-max-height` | `56vh` | code area height before it scrolls |
| `data-wrap` | `on` | soft-wrap long lines |
| `data-highlight="3-5,9"` | — | always-on highlighted lines (snippet-relative) |
| `data-highlight-text="sum +="` | — | highlight every line containing this text |
| `data-dim` | `on` | dim non-highlighted lines while a step is active |

The window auto-fits: if it would overrun the slide, the code area is clamped and
scrolls instead (step highlights scroll themselves into view).

### Fragment-driven code walkthrough

Add `.vscode-step` markers as children of the window. They're invisible; the engine
reveals them like any other fragment and the window follows — highlight the step's
lines, dim the rest, show `data-note` in a strip under the editor.

```html
<div class="code-split">
  <ol class="code-steps">
    <li class="fragment" data-fragment-index="0">Guard the lengths.</li>
    <li class="fragment" data-fragment-index="1">Multiply pairs, accumulate.</li>
  </ol>
  <div>
    <div class="vscode-window" data-src="Runner.ConsoleApp/Math/Vector.cs" data-member="operator *">
      <span class="vscode-step fragment current-visible" data-fragment-index="0"
            data-lines="3-4" data-note="equal length or nothing to pair up"></span>
      <span class="vscode-step fragment current-visible" data-fragment-index="1"
            data-text="sum +=" data-note="accumulate into sum"></span>
    </div>
    <p class="code-caption">Optional caption under the window</p>
  </div>
</div>
```

Rules:
- `data-lines` on a step is **snippet-relative** (1 = first shown line); `data-text`
  matches whole lines and survives edits to the demo code — prefer it.
- `current-visible` steps replace each other (one highlight at a time). Plain
  `.fragment` steps accumulate.
- Pair every step with a **persistent** fragment at the same `data-fragment-index`
  (a `.code-steps` bullet). The engine only advances on non-`current-visible`
  fragments, so a window whose only fragments are `current-visible` won't step.
- Captions belong inside the code column (`.code-split > div`), not as a sibling of
  `.code-split` — a stray third grid child lands in the wrong column.

Layout helpers: `.code-split` (prose | code grid), `.code-steps` (numbered
narration list), `.code-caption` (muted line under a window).

Verify snippets resolve after touching the demo code:

```bash
npm run check:code            # every window in slides/, plus each step's lines
npm run check:code -- --show  # print the extracted snippets, numbered
```

`preview-code.html` (dev server only) is a standalone harness for authoring windows;
`?step=N` jumps to a step.

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

`vscode-code.js` — code windows (see Code Highlighting). Also independent of the
engine: it watches `document.body` for added `.vscode-window` elements, so it works
for slide navigation, overview mode and standalone pages alike. `code-extract.js`
holds the snippet cutting logic and runs under node too.
