// Code panels for slides: syntax-highlighted C#, real file line numbers, and a
// walkthrough layer (line highlights, fake debugger inline values, a stopped-line
// marker) driven by the engine's fragments.
//
// The code lives in the slide, inlined by `npm run code:embed` from ../demos. A deck
// is therefore self-contained: nothing is fetched at render time. The data-src /
// data-member / data-lines attributes stay as a reference — the embed tool re-extracts
// from them, `npm run check:code` reports drift, and the panel prints the file and line
// range with a link to it.
//
// Monaco is used as a tokenizer only (no editor instance): slides are recreated on
// every navigation and cloned wholesale into overview mode, so a static, cached DOM
// beats N live editors.
//
// Markup:
//
//   <div class="vscode-window" data-src="Runner.ConsoleApp/Math/Vector.cs"
//        data-member="operator *" data-start-line="28">
//     <pre class="vscode-source">
//   public static float operator *(Vector a, Vector b)
//   …
//     </pre>
//   </div>
//
// Attributes — content:
//   <pre class="vscode-source">…</pre>   the code (escape `<` as `&lt;`)
//   data-code="…"             inline code as an attribute instead
//   data-start-line="28"      first line number for the gutter (set by the embed tool)
//   data-lang="csharp"        Monaco language id
//
// Attributes — reference (no fetching; used for the source strip and the tooling):
//   data-src / data-member / data-region / data-lines / data-match / data-nth
//
// Attributes — presentation:
//   data-theme="light|dark"   VS Code Light Modern (default) or Dark Modern colours
//   data-numbers="file|snippet|off"   gutter numbering, default file
//   data-font-size="0.7rem"   maximum size; the fit pass shrinks it as needed
//   data-max-height="60vh"    ceiling for the code area
//   data-wrap="on|off"        soft-wrap long lines, default on
//   data-highlight="3-5,9"    always-on highlighted lines (snippet-relative)
//   data-highlight-text="sum +="   highlight every line containing this text
//   data-dim="on|off"         dim non-highlighted lines while a step is active
//   data-source-ref="on|off"  file:line-range strip under the code, default on with data-src
//
// Optional editor chrome, all off by default — the panel is about the code, not about
// looking like an editor:
//   data-chrome="none|minimal|full"   tab strip / title bar + tab strip
//   data-tab / data-tabs      tab labels, only shown when data-chrome is set
//   data-minimap="on|off"     fake minimap column
//   data-statusbar="on|off"   bottom status bar
//   data-breadcrumbs="on|off" path › member row
//
// Fragment-driven walkthrough — author markers as children; the engine reveals them
// like any other fragment and the panel follows:
//
//   <span class="vscode-step fragment current-visible" data-fragment-index="0"
//         data-lines="6-10" data-stopped="9"
//         data-values="6: sum = 0 | 9: 2×4 = 8, then 3×5 → sum = 23"
//         data-note="multiply pairs, accumulate"></span>
//   <span class="vscode-inline" data-line="1" data-value="a = [2, 3]   b = [4, 5]"></span>
//
//   data-lines / data-text    which lines the step covers (snippet-relative / by content)
//   data-values="9: sum = 23 | 11: returns 23"   fake debugger inline values
//   data-stopped[="9"]        amber stopped line + gutter arrow
//   data-note                 narration strip under the code
//   .vscode-inline            one standalone inline value (add .fragment to stage it)

const MONACO_BASE = 'vendor/monaco/vs';

// C# keywords VS Code paints purple (control flow) rather than blue.
const CONTROL_KEYWORDS = new Set([
  'if', 'else', 'switch', 'case', 'default', 'while', 'do', 'for', 'foreach', 'in',
  'break', 'continue', 'goto', 'return', 'throw', 'try', 'catch', 'finally',
  'yield', 'await', 'lock', 'when', 'using', 'new', 'checked', 'unchecked',
]);

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

// Where the demo sources actually live, so a window can point at the real file:
// served by the dev server (absolute path → vscode:// link) and written into dist
// by the build (repo URL → GitHub blob link for the deployed deck).
let sourceConfig = null;

async function loadSourceConfig() {
  try {
    const res = await fetch('code-root.json');
    if (!res.ok) return null;
    sourceConfig = await res.json();
    return sourceConfig;
  } catch {
    return null;
  }
}

const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

function sourceHref(path, from, to) {
  if (!sourceConfig || !path) return null;
  const { root, repo, ref = 'main', prefix = '' } = sourceConfig;
  if (root && isLocalHost()) return `vscode://file${root}/${path}:${from}`;
  if (repo) return `${repo}/blob/${ref}/${prefix ? `${prefix}/` : ''}${path}#L${from}-L${to}`;
  if (root) return `vscode://file${root}/${path}:${from}`;
  return null;
}

// Refs render without an href; they become links once the config is in.
function linkSources(root = document) {
  root.querySelectorAll('.vscode-source-link:not([href])').forEach(a => {
    const href = sourceHref(a.dataset.path, a.dataset.from, a.dataset.to);
    if (!href) return;
    a.href = href;
    if (href.startsWith('vscode:')) {
      a.title = 'Open in VS Code';
    } else {
      a.title = 'Open on GitHub';
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });
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

// "9: sum = 23 | 11: returns 23" → Map { 9 => "sum = 23", 11 => "returns 23" }
function parseValueSpec(spec) {
  const out = new Map();
  if (!spec) return out;
  for (const part of String(spec).split('|')) {
    const m = part.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
    if (m) out.set(Number(m[1]), m[2]);
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

function buildWindow(el, { code, startLine, endLine }, monaco) {
  const lang = el.dataset.lang ?? 'csharp';
  const path = el.dataset.src ?? '';
  const fileName = path ? path.split('/').pop() : (el.dataset.tab ?? 'snippet.cs');
  const tabLabel = el.dataset.tab ?? fileName;
  const chrome = el.dataset.chrome ?? 'none';
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

  const showCrumbs = (el.dataset.breadcrumbs ?? 'off') === 'on';
  const crumbs = showCrumbs
    ? `<div class="vscode-breadcrumbs">${breadcrumbHtml(path, el.dataset.member ?? '')}</div>`
    : '';

  const showMinimap = (el.dataset.minimap ?? 'off') === 'on';
  const minimap = showMinimap ? `<div class="vscode-minimap" aria-hidden="true">${minimapHtml(codeLines)}</div>` : '';

  const showStatus = (el.dataset.statusbar ?? 'off') === 'on';
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

  // Pointer back to the real file — the thing you point at when someone asks
  // "where is this in the repo?".
  const showRef = (el.dataset.sourceRef ?? (path ? 'on' : 'off')) === 'on';
  const prefix = sourceConfig?.prefix ? `${sourceConfig.prefix}/` : '';
  const range = endLine > startLine ? `${startLine}-${endLine}` : `${startLine}`;
  const sourceRef = showRef ? `
    <div class="vscode-source-ref">
      <a class="vscode-source-link" data-path="${escapeHtml(path)}"
         data-from="${startLine}" data-to="${endLine}">${escapeHtml(prefix + path)}:${range}</a>
      <span class="vscode-source-hint">press <kbd>o</kbd> to open</span>
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
    <div class="vscode-note" hidden></div>
    ${sourceRef}`;
}

// Slides don't scroll, so a window taller than the space left below the title would
// push its own status bar off screen. Rather than chasing the slide's overflow (which
// over-shrinks, because a stretched flex item hides where the slack actually is), the
// room for each code area is computed directly: from its top edge down to the slide's
// bottom, minus whatever sits below it.
const FIT_RESERVE = 24;    // room for the nav hint / slide counter
const FIT_MIN_FONT = 0.42; // rem — smaller than this is unreadable on a projector

// Lowest content edge on the slide, ignoring rows inside a code area (those are
// clipped by their own scroll container and would report past its bottom).
function contentBottom(slide) {
  let bottom = 0;
  for (const el of slide.querySelectorAll('*')) {
    if (el.closest('.vscode-code')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > bottom) bottom = rect.bottom;
  }
  return bottom;
}

function fitSlide(slide) {
  if (!slide) return;
  const boxes = [...slide.querySelectorAll('.vscode-window[data-vs-state="ready"] .vscode-code')];
  if (boxes.length === 0) return;

  // Reset to the authored size first, so repeated fits can't ratchet the font down.
  for (const box of boxes) {
    const win = box.closest('.vscode-window');
    if (win.dataset.vsFontBase) win.style.setProperty('--vs-font-size', win.dataset.vsFontBase);
    else win.dataset.vsFontBase = win.style.getPropertyValue('--vs-font-size');
    box.style.maxHeight = '';
  }

  const room = (box) => {
    const rect = box.getBoundingClientRect();
    const tail = Math.max(0, contentBottom(slide) - rect.bottom);   // captions, lists, notes below
    return slide.getBoundingClientRect().bottom - FIT_RESERVE - rect.top - tail;
  };

  // Tallest first: shrinking it can give the others their room back.
  const ordered = [...boxes].sort((a, b) => b.scrollHeight - a.scrollHeight);

  for (const box of ordered) {
    const win = box.closest('.vscode-window');

    // Prefer shrinking the font — a snippet you can read in full beats one that
    // scrolls. The authored size is treated as a maximum, not a fixed value.
    for (let pass = 0; pass < 10; pass++) {
      const available = room(box);
      if (box.scrollHeight <= available + 1) break;
      const current = parseFloat(win.style.getPropertyValue('--vs-font-size'));
      const next = current * 0.93;
      if (!(next >= FIT_MIN_FONT)) break;
      win.style.setProperty('--vs-font-size', `${next.toFixed(3)}rem`);
    }

    // Floor reached and still too tall: clamp and let it scroll.
    const available = room(box);
    if (box.scrollHeight > available + 1 && available >= 120) {
      box.style.maxHeight = `${Math.round(available)}px`;
    }
  }
}

function fitToSlide(el) {
  fitSlide(el.closest('.slide'));
}

// Markers the engine currently has revealed. A marker without .fragment is always
// on; a .fragment marker counts only once the engine marks it visible.
function visibleMarkers(el, selector) {
  return [...el.querySelectorAll(selector)].filter(m =>
    !m.classList.contains('fragment-hidden')
    && (m.classList.contains('fragment-visible') || !m.classList.contains('fragment')));
}

// VS Code's debugger prints variable values at the end of the line it's stopped on.
// Same idea, hand-written: the value is authored on the slide, not computed.
function setInlineValue(row, value) {
  let chip = row.querySelector('.vscode-inline-value');
  if (!value) {
    chip?.remove();
    return;
  }
  if (!chip) {
    chip = document.createElement('span');
    chip.className = 'vscode-inline-value';
    row.querySelector('.vscode-text').appendChild(chip);
  }
  if (chip.textContent !== value) chip.textContent = value;
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

  const active = visibleMarkers(el, '.vscode-step');

  const wanted = new Set();
  const stopped = new Set();
  const values = new Map();   // line → inline value text
  let note = '';

  // static highlights always apply
  for (const n of parseLineSpec(el.dataset.highlight, total)) wanted.add(n);
  for (const n of linesContaining(codeLines, el.dataset.highlightText)) wanted.add(n);
  const staticCount = wanted.size;

  for (const step of active) {
    const lines = new Set([
      ...parseLineSpec(step.dataset.lines, total),
      ...linesContaining(codeLines, step.dataset.text),
    ]);
    for (const n of lines) wanted.add(n);
    // data-stopped alone marks the whole band; data-stopped="9" marks one line.
    const stopSpec = step.dataset.stopped;
    if (stopSpec !== undefined) {
      const target = stopSpec.trim() ? parseLineSpec(stopSpec, total) : lines;
      for (const n of target) stopped.add(n);
    }
    for (const [line, value] of parseValueSpec(step.dataset.values)) values.set(line, value);
    if (step.dataset.note) note = step.dataset.note;
  }

  // standalone inline-value markers (fragment-driven or always on)
  for (const marker of visibleMarkers(el, '.vscode-inline')) {
    const lines = marker.dataset.line
      ? parseLineSpec(marker.dataset.line, total)
      : linesContaining(codeLines, marker.dataset.text);
    for (const n of lines) values.set(n, marker.dataset.value ?? '');
  }

  const stepping = active.length > 0 || staticCount > 0;
  const dim = stepping && (el.dataset.dim ?? 'on') === 'on';

  rows.forEach((row, i) => {
    const line = i + 1;
    const hit = wanted.has(line);
    row.classList.toggle('hl', hit);
    row.classList.toggle('stopped', stopped.has(line));
    row.classList.toggle('dim', dim && !hit);
    setInlineValue(row, values.get(line));
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
  const markers = [...el.querySelectorAll('.vscode-step, .vscode-inline')];
  if (markers.length === 0) return;
  const observer = new MutationObserver(() => applyHighlights(el));
  for (const marker of markers) observer.observe(marker, { attributes: true, attributeFilter: ['class'] });
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
  return JSON.stringify([d.src, d.startLine, d.lang, d.tab, d.tabs, d.chrome, d.numbers,
    d.minimap, d.statusbar, d.breadcrumbs, d.sourceRef, el.querySelector('pre.vscode-source')?.textContent?.length,
    d.code?.slice(0, 64)]);
}

// Replace the generated chrome while leaving the authored .vscode-step markers in
// the DOM — the engine tracks them as fragments and must never lose them.
function paint(el, html) {
  for (const child of [...el.children]) {
    const authored = child.classList.contains('vscode-step') || child.classList.contains('vscode-inline');
    if (!authored) child.remove();
  }
  const staging = document.createElement('div');
  staging.innerHTML = html;
  el.prepend(...staging.childNodes);
}

async function renderWindow(el) {
  if (el.dataset.vsState) return;
  el.dataset.vsState = 'pending';

  // keep authored step / inline-value markers; everything else is generated
  const steps = [...el.querySelectorAll('.vscode-step, .vscode-inline')];
  const theme = el.dataset.theme ?? 'light';
  el.classList.add('vscode-window');
  el.dataset.theme = theme;

  try {
    const inline = inlineSource(el);
    if (inline === null) {
      throw new Error(el.dataset.src
        ? `no code embedded for ${el.dataset.src} — run: npm run code:embed -- --write`
        : 'needs a <pre class="vscode-source"> child or data-code');
    }
    const startLine = Number(el.dataset.startLine ?? 1);
    const snippet = {
      code: inline,
      startLine,
      endLine: startLine + inline.split('\n').length - 1,
    };
    if (el.dataset.numbers === undefined && !el.dataset.startLine) el.dataset.numbers = 'snippet';

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
    linkSources(el);
    requestAnimationFrame(() => fitToSlide(el));

    if (cached === undefined && !monacoInstance) {
      loadMonaco().then(monaco => {
        if (!monaco || !el.isConnected) return;
        const coloured = buildWindow(el, snippet, monaco);
        renderCache.set(key, coloured);
        paint(el, coloured);
        applyHighlights(el);
        linkSources(el);
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

  loadSourceConfig().then(cfg => { if (cfg) linkSources(); });

  // `o` opens the source of the current slide's first code window — jumping to the
  // real file mid-talk beats scrolling for it.
  addEventListener('keydown', (e) => {
    if (e.key !== 'o' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const slide = document.querySelector('.slide.active') ?? document;
    const link = slide.querySelector('.vscode-source-link[href]');
    if (!link) return;
    e.preventDefault();
    link.click();
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
