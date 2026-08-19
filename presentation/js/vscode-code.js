// VS Code style code windows for slides.
//
// Markup on a slide:
//
//   <div class="vscode-window" data-src="Runner.ConsoleApp/Math/Vector.cs"
//        data-member="operator *"></div>
//
// The component fetches the real demo source (served at /code/… from ../demos),
// cuts out the requested snippet, tokenizes it with Monaco's C# grammar and
// renders VS Code "Dark Modern" chrome around it: tab strip, breadcrumbs, line
// number gutter, minimap, status bar.
//
// Monaco is used as tokenizer only — no editor instance. Slides are recreated on
// every navigation and cloned wholesale into overview mode, so a static DOM that
// can be cached and re-inserted beats N live editors.
//
// Attributes — source selection (first match wins):
//   data-lines="12-40"        line range in the file
//   data-region="Name"        #region Name … #endregion
//   data-member="Forward"     method / property / operator / type by name
//   data-match="regex"        raw declaration regex (escape hatch)
//   data-nth="2"              pick the 2nd match — for overloaded members
//   data-code="…"             inline code instead of data-src
//   <pre class="vscode-source">…</pre>   inline code as a child (also the no-JS fallback)
//
// Attributes — presentation:
//   data-lang="csharp"        Monaco language id
//   data-tab="Vector.cs"      active tab label (default: file name)
//   data-tabs="Program.cs,…"  extra inactive tabs, shown left of the active one
//   data-theme="dark|light"   VS Code Dark Modern (default) or Light Modern
//   data-chrome="full|minimal|none"   titlebar+tabs / tabs only / bare editor
//   data-minimap="on|off"     default on
//   data-statusbar="on|off"   default on
//   data-breadcrumbs="on|off" default on when a path is known
//   data-numbers="file|snippet|off"   gutter numbering, default file
//   data-font-size="0.7rem"   override the automatic size
//   data-max-height="60vh"    scroll container height
//   data-highlight="3-5,9"    always-on highlighted lines (snippet-relative)
//   data-highlight-text="sum +="   highlight every line containing this text
//   data-dim="on|off"         dim non-highlighted lines while a step is active
//   data-wrap="on|off"        soft-wrap long lines, default on
//
// Fragment-driven walkthrough — author step markers as children; the engine's
// fragment system reveals them, the window follows:
//
//   <div class="vscode-window" data-src="…" data-member="Forward">
//     <span class="vscode-step fragment current-visible" data-fragment-index="0"
//           data-lines="2-4" data-note="normalize the input"></span>
//     <span class="vscode-step fragment current-visible" data-fragment-index="1"
//           data-text="Softmax" data-note="attention weights"></span>
//   </div>

import { extractSnippet } from './code-extract.js';

const MONACO_BASE = 'vendor/monaco/vs';
const CODE_BASE = 'code';

// C# keywords VS Code paints purple (control flow) rather than blue.
const CONTROL_KEYWORDS = new Set([
  'if', 'else', 'switch', 'case', 'default', 'while', 'do', 'for', 'foreach', 'in',
  'break', 'continue', 'goto', 'return', 'throw', 'try', 'catch', 'finally',
  'yield', 'await', 'lock', 'when', 'using', 'new', 'checked', 'unchecked',
]);

const fileCache = new Map();   // path → Promise<string>
const renderCache = new Map(); // cache key → innerHTML

let monacoPromise = null;
let monacoInstance = null;   // set once the bundle is in — lets renders stay sync

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// Monaco ships as AMD; load the loader, then the editor bundle, then warm up the
// language so monaco.editor.tokenize() works synchronously afterwards.
function loadMonaco() {
  if (monacoPromise) return monacoPromise;
  monacoPromise = (async () => {
    await loadScript(`${MONACO_BASE}/loader.js`);
    window.require.config({ paths: { vs: MONACO_BASE } });
    await new Promise((resolve, reject) => {
      window.require(['vs/editor/editor.main'], resolve, reject);
    });
    // colorize() resolves once the language's tokenizer is registered
    await window.monaco.editor.colorize('', 'csharp', {});
    monacoInstance = window.monaco;
    return monacoInstance;
  })().catch(err => {
    console.warn('[vscode-code] Monaco unavailable, falling back to plain text:', err.message);
    return null;
  });
  return monacoPromise;
}

async function fetchSource(path) {
  if (!fileCache.has(path)) {
    fileCache.set(path, fetch(`${CODE_BASE}/${path}`).then(res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
      return res.text();
    }));
  }
  return fileCache.get(path);
}

const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// "3-5,9" → Set {3,4,5,9}
function parseLineSpec(spec, max) {
  const out = new Set();
  if (!spec) return out;
  for (const part of String(spec).split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    for (let i = from; i <= Math.min(to, max); i++) if (i >= 1) out.add(i);
  }
  return out;
}

function linesContaining(codeLines, needle) {
  const out = new Set();
  if (!needle) return out;
  codeLines.forEach((line, i) => {
    if (line.includes(needle)) out.add(i + 1);
  });
  return out;
}

// Map a Monaco token type + its text to a CSS class. Monarch's C# grammar knows
// keywords, strings, numbers and comments but calls every name "identifier", so
// types / methods / members are split apart here the way VS Code's semantic
// highlighting does.
function classifyIdentifier(text, before, after) {
  const next = after.match(/^\s*(.?)/)[1];
  const prevChar = before.trimEnd().slice(-1);
  if (next === '(' || next === '<') return 'tok-method';
  if (prevChar === '.') return /^[A-Z]/.test(text) ? 'tok-prop' : 'tok-var';
  if (/^[A-Z]/.test(text)) return 'tok-type';
  return 'tok-var';
}

function tokenClass(type, text, before, after, bracketDepth) {
  if (!type) return text.trim() ? 'tok-op' : null;
  if (type.startsWith('comment')) return 'tok-comment';
  if (type.startsWith('string')) return type.includes('escape') ? 'tok-str-escape' : 'tok-string';
  if (type.startsWith('number')) return 'tok-number';
  if (type.startsWith('namespace.cpp')) return 'tok-directive';   // #region, #if, …
  if (type.startsWith('namespace')) return 'tok-plain';
  if (type.startsWith('directive')) return 'tok-directive';
  if (type.startsWith('annotation')) return 'tok-attr';
  if (type.startsWith('keyword')) {
    const word = text.replace(/^@/, '');
    return CONTROL_KEYWORDS.has(word) ? 'tok-control' : 'tok-keyword';
  }
  if (/^delimiter\.(curly|square|parenthesis|angle)/.test(type)) {
    return `tok-bracket-${bracketDepth % 3}`;
  }
  if (type.startsWith('delimiter')) return 'tok-punct';
  if (type.startsWith('identifier')) return classifyIdentifier(text, before, after);
  return 'tok-plain';
}

// Tokenize with Monaco and return one HTML string per line.
function highlight(code, lang, monaco) {
  const lines = code.split('\n');
  if (!monaco) return lines.map(l => escapeHtml(l) || '&nbsp;');

  let tokenLines;
  try {
    tokenLines = monaco.editor.tokenize(code, lang);
  } catch (err) {
    console.warn('[vscode-code] tokenize failed:', err.message);
    return lines.map(l => escapeHtml(l) || '&nbsp;');
  }

  let depth = 0; // bracket nesting carries across lines

  return lines.map((line, i) => {
    const tokens = tokenLines[i] ?? [];
    if (tokens.length === 0) return escapeHtml(line) || '&nbsp;';

    let html = '';
    for (let t = 0; t < tokens.length; t++) {
      const start = tokens[t].offset;
      const end = t + 1 < tokens.length ? tokens[t + 1].offset : line.length;
      const text = line.slice(start, end);
      if (!text) continue;

      const type = tokens[t].type;
      const isOpen = /^delimiter\.(curly|square|parenthesis|angle)/.test(type) && /[[({<]/.test(text);
      const isClose = /^delimiter\.(curly|square|parenthesis|angle)/.test(type) && /[\])}>]/.test(text);
      if (isClose) depth = Math.max(0, depth - 1);

      const cls = tokenClass(type, text, line.slice(0, start), line.slice(end), depth);
      html += cls ? `<span class="${cls}">${escapeHtml(text)}</span>` : escapeHtml(text);

      if (isOpen) depth++;
    }
    return html || '&nbsp;';
  });
}

// Slides have a fixed height; shrink the font as the snippet gets longer.
function autoFontSize(lineCount) {
  if (lineCount <= 12) return '0.92rem';
  if (lineCount <= 18) return '0.78rem';
  if (lineCount <= 24) return '0.66rem';
  if (lineCount <= 32) return '0.56rem';
  return '0.48rem';
}

const CSHARP_ICON = `<svg class="vscode-tab-icon" viewBox="0 0 16 16" aria-hidden="true">
  <path d="M8 1 14.5 4.6v6.8L8 15 1.5 11.4V4.6z" fill="#8A2BE2" opacity="0.85"/>
  <text x="8" y="11" text-anchor="middle" font-size="7.5" font-family="sans-serif" font-weight="700" fill="#fff">C#</text>
</svg>`;

const BRANCH_ICON = `<svg viewBox="0 0 16 16" class="vscode-status-icon" aria-hidden="true">
  <path d="M4 3.5a1.5 1.5 0 1 1 1 2.8V9a2 2 0 0 0 2 2h1.3a1.5 1.5 0 1 1 0 1H7a3 3 0 0 1-3-3V6.3A1.5 1.5 0 0 1 4 3.5z"
        fill="currentColor"/>
</svg>`;

function breadcrumbHtml(path, member) {
  const parts = path ? path.split('/') : [];
  const crumbs = [...parts];
  if (member) crumbs.push(member);
  return crumbs
    .map((c, i) => `<span class="vscode-crumb${i === crumbs.length - 1 ? ' current' : ''}">${escapeHtml(c)}</span>`)
    .join('<span class="vscode-crumb-sep">›</span>');
}

function minimapHtml(codeLines) {
  const longest = Math.max(1, ...codeLines.map(l => l.length));
  return codeLines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<i></i>';
    const indent = line.length - line.trimStart().length;
    const left = (indent / longest) * 100;
    const width = (trimmed.length / longest) * 100;
    return `<i style="margin-left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></i>`;
  }).join('');
}

function buildWindow(el, { code, startLine }, monaco) {
  const lang = el.dataset.lang ?? 'csharp';
  const path = el.dataset.src ?? '';
  const fileName = path ? path.split('/').pop() : (el.dataset.tab ?? 'snippet.cs');
  const tabLabel = el.dataset.tab ?? fileName;
  const chrome = el.dataset.chrome ?? 'full';
  const numbers = el.dataset.numbers ?? 'file';
  const codeLines = code.split('\n');
  const html = highlight(code, lang, monaco);
  const firstNumber = numbers === 'snippet' ? 1 : startLine;
  const lastNumber = firstNumber + codeLines.length - 1;
  const gutterWidth = `${String(lastNumber).length + 1}ch`;

  const rows = html.map((lineHtml, i) => {
    const num = numbers === 'off' ? '' : String(firstNumber + i);
    return `<div class="vscode-line" data-line="${i + 1}">`
      + `<span class="vscode-ln" aria-hidden="true">${num}</span>`
      + `<span class="vscode-text">${lineHtml}</span>`
      + `</div>`;
  }).join('');

  const extraTabs = (el.dataset.tabs ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => `<span class="vscode-tab">${CSHARP_ICON}<span>${escapeHtml(t)}</span></span>`)
    .join('');

  const titleBar = chrome === 'full' ? `
    <div class="vscode-titlebar">
      <span class="vscode-lights"><i class="red"></i><i class="yellow"></i><i class="green"></i></span>
      <span class="vscode-title">${escapeHtml(fileName)}${path ? ` — ${escapeHtml(path.split('/')[0])}` : ''}</span>
    </div>` : '';

  const tabBar = chrome !== 'none' ? `
    <div class="vscode-tabs">
      ${extraTabs}
      <span class="vscode-tab active">${CSHARP_ICON}<span>${escapeHtml(tabLabel)}</span><i class="vscode-tab-close">×</i></span>
    </div>` : '';

  const showCrumbs = (el.dataset.breadcrumbs ?? (path ? 'on' : 'off')) === 'on';
  const crumbs = showCrumbs
    ? `<div class="vscode-breadcrumbs">${breadcrumbHtml(path, el.dataset.member ?? '')}</div>`
    : '';

  const showMinimap = (el.dataset.minimap ?? 'on') === 'on';
  const minimap = showMinimap ? `<div class="vscode-minimap" aria-hidden="true">${minimapHtml(codeLines)}</div>` : '';

  const showStatus = (el.dataset.statusbar ?? 'on') === 'on';
  const statusBar = showStatus ? `
    <div class="vscode-statusbar">
      <span class="vscode-status-left">${BRANCH_ICON}<span>main</span></span>
      <span class="vscode-status-right">
        <span>Ln ${firstNumber}, Col 1</span>
        <span>Spaces: 4</span>
        <span>UTF-8</span>
        <span>C#</span>
      </span>
    </div>` : '';

  return `
    ${titleBar}
    ${tabBar}
    ${crumbs}
    <div class="vscode-body">
      <pre class="vscode-code" tabindex="0"><code>${rows}</code></pre>
      ${minimap}
    </div>
    ${statusBar}
    <div class="vscode-note" hidden></div>`;
}

// Slides don't scroll, so a window taller than the space left below the title would
// push its own status bar off screen. Fitting is per *slide*, not per window: reset
// every window, then repeatedly clamp the tallest code area until the slide fits.
// Coordinated this way it stays idempotent — two windows on one slide can't each
// subtract the full overflow, and a recolour repaint lands on the same result.
const FIT_RESERVE = 24;   // room for the nav hint / slide counter

function fitSlide(slide) {
  if (!slide) return;
  const boxes = [...slide.querySelectorAll('.vscode-window[data-vs-state="ready"] .vscode-code')];
  if (boxes.length === 0) return;

  for (const box of boxes) box.style.maxHeight = '';

  for (let pass = 0; pass < 6; pass++) {
    // Usable height stops short of the bottom so the nav hint and slide counter
    // never sit on top of a window.
    const overflow = slide.scrollHeight - (slide.clientHeight - FIT_RESERVE);
    if (overflow <= 1) break;
    const tallest = boxes.reduce((a, b) =>
      (b.getBoundingClientRect().height > a.getBoundingClientRect().height ? b : a));
    const height = tallest.getBoundingClientRect().height;
    const next = Math.max(120, height - overflow);
    if (next >= height) break;
    tallest.style.maxHeight = `${next}px`;
  }
}

function fitToSlide(el) {
  fitSlide(el.closest('.slide'));
}

// Highlight bands follow the visible step markers. The engine owns the markers
// (they are ordinary fragments), so backward navigation and overview mode work
// without the engine knowing this component exists.
function applyHighlights(el) {
  const codeEl = el.querySelector('.vscode-code');
  if (!codeEl) return;
  const rows = [...codeEl.querySelectorAll('.vscode-line')];
  const total = rows.length;
  const codeLines = rows.map(r => r.querySelector('.vscode-text').textContent);

  const steps = [...el.querySelectorAll('.vscode-step')];
  const active = steps.filter(s => !s.classList.contains('fragment-hidden')
    && (s.classList.contains('fragment-visible') || !s.classList.contains('fragment')));

  const wanted = new Set();
  let note = '';

  // static highlights always apply
  for (const n of parseLineSpec(el.dataset.highlight, total)) wanted.add(n);
  for (const n of linesContaining(codeLines, el.dataset.highlightText)) wanted.add(n);
  const staticCount = wanted.size;

  for (const step of active) {
    for (const n of parseLineSpec(step.dataset.lines, total)) wanted.add(n);
    for (const n of linesContaining(codeLines, step.dataset.text)) wanted.add(n);
    if (step.dataset.note) note = step.dataset.note;
  }

  const stepping = active.length > 0 || staticCount > 0;
  const dim = stepping && (el.dataset.dim ?? 'on') === 'on';

  rows.forEach((row, i) => {
    const hit = wanted.has(i + 1);
    row.classList.toggle('hl', hit);
    row.classList.toggle('dim', dim && !hit);
  });

  const noteEl = el.querySelector('.vscode-note');
  if (noteEl) {
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }

  // Scroll a clamped window only when the active band is actually out of view —
  // otherwise the signature above it would slide away for no reason.
  if (active.length > 0 && wanted.size > 0) {
    const codeBox = el.querySelector('.vscode-code');
    const first = rows[Math.min(...wanted) - 1];
    const last = rows[Math.max(...wanted) - 1];
    if (first && last && codeBox.scrollHeight > codeBox.clientHeight + 4) {
      // Rect maths, not offsetTop: the code box isn't a positioned ancestor, so
      // offsetTop is measured against the slide and would scroll to the wrong place.
      const boxTop = codeBox.getBoundingClientRect().top - codeBox.scrollTop;
      const bandTop = first.getBoundingClientRect().top - boxTop;
      const bandBottom = last.getBoundingClientRect().bottom - boxTop;
      const viewTop = codeBox.scrollTop;
      const viewBottom = viewTop + codeBox.clientHeight;
      // Top-align when the band isn't fully visible; bottom-aligning can push the
      // first highlighted line out of view when lines wrap.
      if (bandTop < viewTop || bandBottom > viewBottom) {
        codeBox.scrollTo({ top: Math.max(0, bandTop - 8), behavior: 'smooth' });
      }
    }
  }
}

function watchSteps(el) {
  const steps = [...el.querySelectorAll('.vscode-step')];
  if (steps.length === 0) return;
  const observer = new MutationObserver(() => applyHighlights(el));
  for (const step of steps) observer.observe(step, { attributes: true, attributeFilter: ['class'] });
}

function inlineSource(el) {
  if (el.dataset.code !== undefined) return el.dataset.code;
  const pre = el.querySelector('pre.vscode-source, script.vscode-source');
  if (pre) {
    const text = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    pre.remove();
    return text;
  }
  return null;
}

function cacheKey(el) {
  const d = el.dataset;
  return JSON.stringify([d.src, d.lines, d.region, d.member, d.match, d.nth, d.lang, d.tab, d.tabs,
    d.chrome, d.numbers, d.minimap, d.statusbar, d.breadcrumbs, d.code?.slice(0, 64)]);
}

// Replace the generated chrome while leaving the authored .vscode-step markers in
// the DOM — the engine tracks them as fragments and must never lose them.
function paint(el, html) {
  for (const child of [...el.children]) {
    if (!child.classList.contains('vscode-step')) child.remove();
  }
  const staging = document.createElement('div');
  staging.innerHTML = html;
  el.prepend(...staging.childNodes);
}

async function renderWindow(el) {
  if (el.dataset.vsState) return;
  el.dataset.vsState = 'pending';

  // keep authored step markers; everything else in the window is generated
  const steps = [...el.querySelectorAll('.vscode-step')];
  const theme = el.dataset.theme ?? 'dark';
  el.classList.add('vscode-window');
  el.dataset.theme = theme;

  try {
    let snippet;
    const inline = inlineSource(el);
    if (inline !== null) {
      snippet = { code: inline, startLine: 1, endLine: inline.split('\n').length };
      if (el.dataset.numbers === undefined) el.dataset.numbers = 'snippet';
    } else if (el.dataset.src) {
      const src = await fetchSource(el.dataset.src);
      snippet = extractSnippet(src, el.dataset);
    } else {
      throw new Error('needs data-src, data-code or a <pre class="vscode-source"> child');
    }

    const lineCount = snippet.code.split('\n').length;
    el.style.setProperty('--vs-font-size', el.dataset.fontSize ?? autoFontSize(lineCount));
    if (el.dataset.maxHeight) el.style.setProperty('--vs-max-height', el.dataset.maxHeight);

    const key = cacheKey(el);
    const cached = renderCache.get(key);

    // Show the window straight away. Monaco is 3.6 MB; if it hasn't arrived yet the
    // first paint is uncoloured and gets recoloured in place a moment later, rather
    // than leaving an empty box on screen.
    const first = cached ?? buildWindow(el, snippet, monacoInstance);
    if (cached === undefined && monacoInstance) renderCache.set(key, first);
    paint(el, first);

    el.dataset.vsState = 'ready';
    applyHighlights(el);
    watchSteps(el);
    requestAnimationFrame(() => fitToSlide(el));

    if (cached === undefined && !monacoInstance) {
      loadMonaco().then(monaco => {
        if (!monaco || !el.isConnected) return;
        const coloured = buildWindow(el, snippet, monaco);
        renderCache.set(key, coloured);
        paint(el, coloured);
        applyHighlights(el);
        requestAnimationFrame(() => fitToSlide(el));
      });
    }
  } catch (err) {
    el.dataset.vsState = 'error';
    el.innerHTML = `<div class="vscode-tabs"><span class="vscode-tab active">${CSHARP_ICON}<span>error</span></span></div>
      <div class="vscode-body"><pre class="vscode-code"><code><div class="vscode-line"><span class="vscode-ln"></span><span class="vscode-text vscode-error">${escapeHtml(err.message)}</span></div></code></pre></div>`;
    console.warn('[vscode-code]', err);
  }
}

function scan(root = document) {
  root.querySelectorAll('.vscode-window:not([data-vs-state])').forEach(renderWindow);
}

// Slides are recreated on navigation and cloned into overview mode; watch the
// whole body so both paths get rendered. Warm Monaco up front so the first code
// slide appears instantly.
function start() {
  scan();
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList?.contains('vscode-window')) renderWindow(node);
        else scan(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  let resizeTimer = null;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.slide').forEach(fitSlide);
    }, 150);
  });

  if ('requestIdleCallback' in window) requestIdleCallback(() => loadMonaco());
  else setTimeout(() => loadMonaco(), 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

export { renderWindow, loadMonaco };
