# Project goal

HTML/JS/CSS presentation deck. No framework, no bundler. Slides are standalone HTML files in
`slides/`, loaded by the engine in `js/engine.js`, styled by `css/theme.css`.

# Execution

Do the work directly. Read files, edit them, verify. No mandatory agent delegation.

Spawn a subagent only when it earns its keep:
- broad fan-out search across many slides/files where only the conclusion matters (`Explore`)
- genuinely independent work that can run in parallel
- user asks for it

One-file, one-symbol, or already-located work: do it inline. Don't delegate then also do it yourself.

Skills to load first (don't guess at engine behavior):
- `engine-capabilities` — before touching the engine, slide HTML format, fragments, or CSS classes
- `new-slide` — adding a slide (also registers it in the manifest)

# Commands

```
npm start          # node server.js  → http://localhost:8000
npm run build      # → dist/ (mirrors slides manifest)
npm run resequence # renumber slide files
./deploy-gh-pages.sh
```

Sandbox blocks `listen` → `npm start` fails with `Error: listen EPERM ... 0.0.0.0:8000`.
Retry that command with the sandbox disabled; mention `/sandbox` to the user.

# Verify visually

Slides are visual. After a visual change, screenshot it — don't ship on reasoning alone.

```
node server.js &   # sandbox off
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=4000 \
      --window-size=1440,900 --screenshot="$TMPDIR/slide.png" http://localhost:8000/
```

Check phone width too (`--window-size=430,860`) and `--force-prefers-reduced-motion`.
Write screenshots to `$TMPDIR`, never `/tmp`.

# Slide animation budget

Deck gets opened on phones from the QR code. Effects stay loud, cost stays low.

Animate only `transform` and `opacity`. Never animate:
- SVG filter primitives (`feTurbulence`, `feDisplacementMap` via SMIL) — re-runs the filter graph on the CPU every frame
- `background-position`, `filter`, `box-shadow`, `width/height` on full-screen or repeated elements — full repaint per frame

Rules:
- pattern scroll: `translate3d()` by exactly one tile on an oversized child, not `background-position`
- cap layer size: `min(150vmax, 2000px)`, not `200vmax` (a 200vmax square is a ~46 MB texture on a phone)
- `will-change: transform` only, and only on the handful of elements that need it — not per-letter
- one filter pass per layer, computed once; keep `blur()` radii ≤ ~56px
- every slide with heavy motion needs a `@media (max-width: 820px)` block: thin particle counts, drop the most expensive layer

# Motion policy

Motion always runs. No still/calm variant, no toggle.

Never gate deck animation on `@media (prefers-reduced-motion: reduce)`. Presenter runs with the OS
"Reduce Motion" setting on, so that media query silently kills the whole deck. Don't add it back.

Verify with `--force-prefers-reduced-motion` + two screenshots at different
`--virtual-time-budget` values: differing frames = motion alive.

# Language

Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact. Code blocks unchanged. Errors quoted exact.

Pattern: `[thing] [action] [reason]. [next step].`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

## Auto-Clarity

Use full clear language for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, user asks to clarify or repeats question. Resume caveman after clear part done.

Example — destructive op:
> **Warning:** This will permanently delete all rows in the `users` table and cannot be undone.
> ```sql
> DROP TABLE users;
> ```
> Simple language. Verify backup exist first.

## Boundaries
Code/commits/PRs: write normal for any user facing output.
