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

A panel can also hold two versions of the same code — `data-diff-from` plus a step with
`data-diff` turns "1_SingleLayer becomes 2_WithRope" into a transition: the additions
arrive in green, and the gutter and file name switch with them. The diff is computed by
`code:embed`, never at render time.

Each panel prints the file and line range its code came from, and links to it — the
local file in VS Code (`vscode://`) while presenting, the GitHub blob once deployed.
Press `o` on a slide to open the source of its first panel.

Two dev-only pages (not copied to `dist/`):

- `preview-code.html` — authoring harness for code panels; `?step=N` jumps to a step.
- `probe-slide.html?slide=<data-id>&steps=N` — loads one slide through the real engine
  and advances N fragments, so a headless screenshot can show a mid-walkthrough state.
  Add `&debug=1` for layout measurements.

See the `engine-capabilities` skill for the full attribute reference.

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
