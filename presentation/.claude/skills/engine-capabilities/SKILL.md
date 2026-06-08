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

highlight.js runs on every `pre code` element after slide render. Use language classes:

```html
<pre><code class="language-csharp">var x = 42;</code></pre>
```

Loaded languages: C# (`csharp`). Theme: Atom One Dark.

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
