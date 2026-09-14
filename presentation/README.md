# Inference Runner — Presentation

HTML/JS/CSS presentation on C# LLM inference.

**Live:** https://RubMertens.github.io/CSharp_LLM_Inference_ISKA/

## Develop

```bash
npm install     # once — pulls Monaco, used to tokenize C# in code slides
npm run start   # local server on :8000
```

The dev server serves Monaco out of `node_modules` at `/vendor/monaco/*`; everything
else is a plain static file.

## Code slides

Code slides are code and nothing else: the panel fills the slide, steps highlight one
band at a time, and the narration is spoken rather than printed. The code itself is
inline, extracted from `../demos` by a tool, so the deck is self-contained and drift is
caught by a check rather than hoped away:

```bash
npm run code:embed -- --write # write/refresh the code in the slides
npm run code:embed            # dry run: what is missing or has drifted
npm run check:code            # embedded code vs source, and every walkthrough marker
npm run check:code -- --show  # also print the embedded code, numbered
```

Each panel prints the file and line range its code came from, and links to it — the
local file in VS Code (`vscode://`) while presenting, the GitHub blob once deployed.
Press `o` on a slide to open the source of its first panel.

Two dev-only pages (not copied to `dist/`):

- `preview-code.html` — authoring harness for code panels; `?step=N` jumps to a step.
- `probe-slide.html?slide=<data-id>&steps=N` — loads one slide through the real engine
  and advances N fragments, so a headless screenshot can show a mid-walkthrough state.
  Add `&debug=1` for layout measurements.

See the `engine-capabilities` skill for the full attribute reference.

## Print / PDF

Press `p` in the deck, or open `print.html`. It lays the deck out as a handout — two
slides per A4 page by default — and then it is an ordinary browser print: `⌘P` →
*Save as PDF*.

```
print.html?per=2&paper=a4    # defaults: 2 slides per A4 portrait page
print.html?per=1             # 1 slide per page, A4 landscape
print.html?paper=letter      # Letter instead of A4
print.html?numbers=0         # drop the number + title caption under each slide
print.html?steps=0           # one page per code slide instead of one per step
print.html?from=12&to=20     # reprint one section (1-based, inclusive)
print.html?auto=1            # open the print dialog as soon as rendering finishes
```

Leave the dialog's scale on **Default** and the paper matching the option above — the
page size comes from the document. Backgrounds print without ticking *Background
graphics*.

Every slide renders in its own 1280x720 iframe, which is then scaled onto the page.
That indirection is the whole trick: printing resolves `vh`/`vw`/`vmin` against the
*page box*, so slides laid out directly on A4 would reflow — and most of this deck
sizes itself off the viewport. A fixed-size frame keeps each slide pixel-identical to
what the room sees. Links stay clickable in the PDF, and a link whose text doesn't
already spell out its URL gets the URL appended.

Fragments are all revealed, as in overview mode, so each slide prints in its end
state — except code walkthroughs, which print **one page per step**, the same path the
room saw. The panel is also re-fitted for paper: on stage a long method keeps a
back-row font and scrolls, which on paper would print the first few lines and silently
drop the rest, so the font shrinks until the whole snippet fits and the step's band is
lit on top of it. `?steps=0` collapses a walkthrough back to one page. The deck's 59
slides come out as 78 pages with steps, 30 without.

Motion is frozen once a frame has settled, and the layers that exist only to move
(confetti, the drifting emoji fields, the wave background — anything running an endless
animation inside an `aria-hidden` container) are dropped. That is not only about taste
on paper: each animated layer prints as a full-slide bitmap, and past a few dozen of
them Chrome abandons the print outright with "Printing failed" and no PDF. The title
slide used to do exactly that.

Rendering all slides takes a few seconds (the status line counts them off); wait for
*ready to print* before opening the dialog.

## Build

```bash
npm run build   # static site -> ./dist
```

The build copies the Monaco tokenizer to `dist/vendor/monaco/`, so the deployed deck is
self-contained (no CDN, works offline). Demo sources are not copied — the code is
already in the slides.

## Deploy

```bash
./deploy.sh            # Azure Static Web Apps
./deploy-gh-pages.sh   # GitHub Pages (gh-pages branch)
```

GitHub Pages, one-time: Settings -> Pages -> Deploy from branch `gh-pages` /(root).
