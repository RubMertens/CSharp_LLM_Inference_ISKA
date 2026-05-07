---
name: new-slide
description: Create a new presentation slide HTML file and register it in the manifest
---

**REQUIRED BACKGROUND:** Before creating a slide, load the engine-capabilities skill via `ToolSearch` (query: `select:engine-capabilities`) for full reference on slide format, CSS classes, fragment system, and engine features.

# New Slide

Create a new slide for the presentation. The user provides a topic/title as arguments.

**Arguments:** `$ARGUMENTS` — the slide title or topic description.

## Steps

1. **Read the manifest** at `slides.json` to determine the next slide number and current slide list.

2. **Determine the slide filename.** Use the pattern `{NN}-{kebab-case-id}.html` where NN is the next number (zero-padded to 2 digits). Derive the kebab-case id from the title.

3. **Create the slide HTML file** at `slides/{filename}`. Use this exact format:

```html
<section data-id="{kebab-case-id}" data-title="{Title}">
  <div class="slide-content">
    <!-- slide content here -->
  </div>
</section>
```

### Slide authoring rules
- Target audience: software engineers who don't know much math
- Keep text concise — no walls of text
- Use these CSS classes from the theme:
  - `.slide-title` — for title/statement slides (centered, large text)
  - `.slide-content` — for content slides (max-width container)
  - `.two-column` — CSS grid, two equal columns
  - `.three-column` — CSS grid, three columns
  - `.code-block` with `.code-header` — styled code container
  - `.highlight` — accent-colored text emphasis
  - `.fragment` — elements revealed one at a time on click/spacebar
  - `.big-text` — large statement text
  - `.icon-list` — list with emoji icons
  - `.pipeline` with `.stage` and `.arrow` — horizontal flow diagrams
  - `.center` — centered flex column
- For C# code blocks, use `<pre><code class="language-csharp">...</code></pre>` (highlight.js is loaded)
- Use `.fragment` class on elements to reveal them progressively
- Use `var(--color-text-muted)` for secondary text, `var(--color-accent)` for emphasis
- Use `var(--color-bg-subtle)` and `var(--color-border)` for card-style containers

4. **Update `slides.json`** — add the new slide path to the array. Ask the user where in the order it should go if not obvious, otherwise append before the last slide (questions).

5. **Report** — show the user the file created and its position in the manifest.
