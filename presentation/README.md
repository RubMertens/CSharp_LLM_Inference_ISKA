# Inference Runner — Presentation

HTML/JS/CSS presentation on C# LLM inference.

**Live:** https://RubMertens.github.io/CSharp_LLM_Inference_ISKA/

## Develop

```bash
npm install     # once — pulls Monaco, used to tokenize C# in code slides
npm run start   # local server on :8000
```

The dev server mounts two extra paths: `/code/*` serves `../demos` (code slides read
the real demo sources) and `/vendor/monaco/*` serves Monaco out of `node_modules`.

## Code slides

Snippets are pulled live from `../demos`, so slides can never drift from the code
you demo. Verify every snippet still resolves before a talk:

```bash
npm run check:code           # all code windows in slides/
npm run check:code -- --show # print the extracted snippets
```

Two dev-only pages (not copied to `dist/`):

- `preview-code.html` — authoring harness for code windows; `?step=N` jumps to a step.
- `probe-slide.html?slide=<data-id>&steps=N` — loads one slide through the real engine
  and advances N fragments, so a headless screenshot can show a mid-walkthrough state.

See the `engine-capabilities` skill for the full attribute reference.

## Build

```bash
npm run build   # static site -> ./dist
```

The build copies the demo `.cs` sources to `dist/code/` and the Monaco tokenizer to
`dist/vendor/monaco/`, so the deployed deck is self-contained (no CDN, works offline).

## Deploy

```bash
./deploy.sh            # Azure Static Web Apps
./deploy-gh-pages.sh   # GitHub Pages (gh-pages branch)
```

GitHub Pages, one-time: Settings -> Pages -> Deploy from branch `gh-pages` /(root).
