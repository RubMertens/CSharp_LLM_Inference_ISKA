// Drives print-frame.html: render one slide, fully revealed, then tell print.html
// when it has settled. Navigation still works in here (the engine is the real one),
// but nothing ever calls it -- the frame shows a single fixed slide.
import './interactive-slides.js';
import { engine } from './engine.js';

const params = new URLSearchParams(location.search);
const seq = params.get('i') ?? '0';
// A code walkthrough gets one frame per step (print.js decides); step 1 is the first
// highlighted band. Without a step, the slide renders fully revealed.
const step = Number(params.get('step') || 0);

// The engine already navigated to the hash slide during init; re-enter the same index,
// either with every fragment revealed (the way overview mode shows a slide) or walked
// forward to one step, so the panel lights that band and scrolls it into view.
async function navigate() {
  const { index } = engine.getCurrentSlide();
  if (step < 1) {
    engine.goTo(index, { revealFragments: true });
    return;
  }
  engine.goTo(index);                    // nothing revealed yet
  // goTo only marks the new slide .active on the next frame, and next() looks for
  // .active to find the fragments. Stepping in the same tick finds no slide, reads it
  // as "no fragments left" and walks on to the following slide.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let n = 0; n < step; n++) {
    engine.next();
    // Belt and braces: if the step count were ever wrong, next() would carry on into
    // the next slide. Fall back to the fully revealed slide rather than print a stray.
    if (engine.getCurrentSlide().index !== index) {
      engine.goTo(index, { revealFragments: true });
      break;
    }
  }
}

// A link is useless on paper unless the URL is readable. Most deck links already spell
// theirs out, so only add the tail where the text doesn't already carry it.
function showLinkUrls(root) {
  for (const a of root.querySelectorAll('a[href^="http"]')) {
    if (a.closest('.vscode-source-ref')) continue;   // already prints path:lines
    const bare = a.href.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const shown = a.textContent.replace(/\s+/g, '').toLowerCase();
    if (shown.includes(bare) || bare.startsWith(shown) && shown.length > 12) continue;
    const tag = document.createElement('span');
    tag.className = 'print-url';
    tag.textContent = bare;
    a.after(tag);
  }
}

// highlight.js is only worth loading for the odd slide with a plain <pre><code> block,
// so it is fetched per frame, on demand, rather than by every frame up front.
const HLJS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1';

function load(tag, attrs) {
  return new Promise((resolve, reject) => {
    const el = Object.assign(document.createElement(tag), attrs);
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

async function highlightPlainCode(root) {
  // `pre:not(.vscode-code)`: a code panel is also a <pre><code>, and highlight.js
  // rewrites innerHTML -- run it over a panel and every .vscode-line collapses into
  // one unwrapped blob, taking the gutter, the step bands and most of the snippet
  // with it. The deck only escapes this because its hljs pass runs before the panel
  // paints. Plain blocks are the ones no panel owns.
  const blocks = [...root.querySelectorAll('pre:not(.vscode-code) code')];
  if (blocks.length === 0) return;
  try {
    await load('link', { rel: 'stylesheet', href: `${HLJS}/styles/atom-one-light.min.css` });
    await load('script', { src: `${HLJS}/highlight.min.js` });
    await load('script', { src: `${HLJS}/languages/csharp.min.js` });
    blocks.forEach(b => window.hljs?.highlightElement(b));
  } catch {
    // Offline, or the CDN is blocked: the block still prints, just unhighlighted.
  }
}

// Code panels render asynchronously (Monaco tokenizes, then a fit pass sizes the font),
// so "loaded" is not "ready". Wait for every window to have laid out lines.
function panelsRendered(root) {
  return [...root.querySelectorAll('.vscode-window')]
    .every(w => w.querySelector('.vscode-code .vscode-line'));
}

// On stage a long method is allowed to scroll: the panel keeps a readable font and
// the steps scroll themselves into view. Paper has no scrollbar, so whatever the box
// is clipped to is all the reader ever gets -- on the self-attention slide that was
// the first nine lines of a thirty-two line method. Shrink instead of clipping: the
// deck's fit pass stops at a floor tuned for the back row of a room, and a page held
// at arm's length can go well below it. The result is the whole snippet on every
// page, with the step's band lit on top of it.
function fitWholeSnippet(root) {
  for (const win of root.querySelectorAll('.vscode-window')) {
    const box = win.querySelector('.vscode-code');
    if (!box) continue;
    const start = parseFloat(win.style.getPropertyValue('--vs-font-size'));
    if (!start) continue;
    // The deck writes max-height only on a panel it had to clamp, and the value is the
    // room it measured below the title. That is the budget to fit inside.
    const room = parseFloat(box.style.maxHeight) || box.clientHeight;
    let size = start;
    const set = (rem) => win.style.setProperty('--vs-font-size', `${rem.toFixed(3)}rem`);

    // Re-measured each pass: a smaller font also wraps fewer lines, and a line that
    // stops wrapping gives back two lines at once -- which is why this overshoots.
    for (let pass = 0; pass < 40 && box.scrollHeight > room + 1; pass++) {
      if (size * 0.94 < 0.12) break;
      size *= 0.94;
      set(size);
    }
    // So grow back into whatever the last step gave away, never past the authored size.
    // Enough passes to undo several shrinks: a snippet that unwrapped late can end up
    // using barely half the panel otherwise.
    for (let pass = 0; pass < 30 && size < start; pass++) {
      const before = size;
      size = Math.min(size * 1.02, start);
      set(size);
      if (box.scrollHeight > room + 1) { size = before; set(size); break; }
    }
    box.scrollTop = 0;   // nothing left to scroll to, and a stale offset would clip
  }
}

// Paper is a still medium, and this deck's motion never stops: the wave background,
// the title slide and the questions slide all run infinite keyframes.
//
// Two things go wrong if that motion reaches the print pipeline. Every animated layer
// is composited, and a composited layer in a printed page becomes a full-slide bitmap
// in the PDF -- the title slide alone serialised ~25 of them, 1.2 MB for one slide.
// Past a few dozen the renderer gives up: "Printing failed", no PDF at all. The title
// slide crossed that line, and hiding *either* of its two emoji fields brought it
// back, which is the signature of a total-cost ceiling rather than one bad element.
//
// So: freeze what stays, shed what is only there to move. A layer counts as pure
// motion when it runs an endless animation inside an aria-hidden container -- marked
// as decoration by its own markup, and on paper a frozen frame of it is just confetti
// stopped mid-fall. Everything else (content, one-shot entrances) is paused where it
// stands. Paused rather than cleared: `animation: none` drops elements back to their
// base style, which for the flying-emoji layers would stack them all in one corner.
function freezeMotion() {
  const shed = new Set();
  for (const a of document.getAnimations()) {
    const target = a.effect?.target;
    if (target instanceof Element && a.effect.getTiming().iterations === Infinity) {
      const layer = target.closest('[aria-hidden="true"]');
      if (layer) shed.add(layer);
    }
    try { a.pause(); } catch { /* already finished or detached */ }
  }
  for (const layer of shed) {
    // Skip layers already covered by an outer one that is going too.
    if ([...shed].some(other => other !== layer && other.contains(layer))) continue;
    layer.dataset.printShed = '1';
  }
  // Covers anything that starts after this point (see print-frame.css).
  document.documentElement.dataset.printFrozen = '1';
}

const RENDER_TIMEOUT = 15000;
// A stepped frame scrolls its code panel to the active band, and that scroll is
// smooth, so it needs longer to come to rest than a static slide does.
const SETTLE = step > 0 ? 700 : 250;

async function ready() {
  const slide = () => document.querySelector('.slide.active');
  const start = Date.now();
  while (Date.now() - start < RENDER_TIMEOUT) {
    const el = slide();
    if (el && panelsRendered(el)) break;
    await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, SETTLE));

  const el = slide();
  if (el) {
    fitWholeSnippet(el);
    await highlightPlainCode(el);
    showLinkUrls(el);
  }

  freezeMotion();

  // Both signals: postMessage for the queue, an attribute for headless screenshotting.
  document.documentElement.dataset.printReady = '1';
  parent?.postMessage({ type: 'slide-ready', seq, id: el?.dataset.id ?? '' }, '*');
}

await navigate();
ready();
