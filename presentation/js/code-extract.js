// Snippet extraction from C# source files.
//
// Pure string manipulation — no DOM, no fetch — so it runs in the browser and
// under node (see tools/check-snippets.js). Every function takes the full file
// text and returns { code, startLine, endLine } with 1-based line numbers from
// the original file, so gutters can show real line numbers.

// Walk the source once, recording which characters sit inside a string, a char
// literal or a comment. Brace matching and declaration lookup consult this mask
// so a `{` inside "text" or /* … */ never counts.
function codeMask(src) {
  const mask = new Uint8Array(src.length); // 1 = inside string/comment
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') mask[i++] = 1;
      continue;
    }
    if (c === '/' && next === '*') {
      mask[i++] = 1;
      mask[i++] = 1;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) mask[i++] = 1;
      if (i < n) { mask[i++] = 1; mask[i++] = 1; }
      continue;
    }
    if (c === '@' && next === '"') {
      mask[i++] = 1;
      mask[i++] = 1;
      while (i < n) {
        if (src[i] === '"' && src[i + 1] === '"') { mask[i++] = 1; mask[i++] = 1; continue; }
        if (src[i] === '"') { mask[i++] = 1; break; }
        mask[i++] = 1;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      mask[i++] = 1;
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\') { mask[i++] = 1; if (i < n) mask[i++] = 1; continue; }
        if (src[i] === quote) { mask[i++] = 1; break; }
        mask[i++] = 1;
      }
      continue;
    }
    i++;
  }
  return mask;
}

function lineStarts(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return starts;
}

function lineOf(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo + 1; // 1-based
}

// Remove the shared leading indentation so a nested method reads flush-left.
export function dedent(code) {
  const lines = code.split('\n');
  let min = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    min = Math.min(min, line.match(/^[ \t]*/)[0].length);
  }
  if (!isFinite(min) || min === 0) return code;
  return lines.map(l => (l.trim() ? l.slice(min) : l.trimEnd())).join('\n');
}

function slice(src, from, to) {
  const lines = src.split('\n');
  const start = Math.max(1, from);
  const end = Math.min(lines.length, to);
  return {
    code: dedent(lines.slice(start - 1, end).join('\n').replace(/\s+$/, '')),
    startLine: start,
    endLine: end,
  };
}

// "12-40" / "12" / "12-" → line range
export function extractLines(src, spec) {
  const m = String(spec).match(/^\s*(\d+)\s*(?:-\s*(\d+)?)?\s*$/);
  if (!m) throw new Error(`Bad data-lines "${spec}" (expected "12-40")`);
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : (m[0].includes('-') ? src.split('\n').length : from);
  return slice(src, from, to);
}

// #region Name … #endregion  (nesting aware, name match is case-insensitive)
export function extractRegion(src, name) {
  const lines = src.split('\n');
  const wanted = name.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^\s*#region\s+(.*)$/);
    if (!open || open[1].trim().toLowerCase() !== wanted) continue;
    let depth = 1;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*#region\b/.test(lines[j])) depth++;
      else if (/^\s*#endregion\b/.test(lines[j])) {
        if (--depth === 0) return slice(src, i + 2, j); // inside the markers
      }
    }
    throw new Error(`#region "${name}" never closed`);
  }
  throw new Error(`#region "${name}" not found`);
}

// Build a declaration matcher for a member name. Handles plain methods
// ("Forward"), generics ("Map<T>"), operators ("operator *"), properties
// ("Data") and types ("class Vector" / "Vector").
function declRegex(name) {
  const escaped = name.trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  // followed by: parameter list, generic parameter list, property body or =>
  return new RegExp(`(?:^|[\\s\\]>)*,])${escaped}\\s*(?:<[^=;{()]*>)?\\s*(?:\\(|\\{|=>|$)`);
}

// A declaration line, not a call: has a modifier/return type before the name,
// or is a type declaration. Rules out `result.Data[i] = …` and `Foo(x);`.
function looksLikeDeclaration(line) {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*')) return false;
  if (/^(public|private|protected|internal|static|sealed|abstract|virtual|override|partial|async|unsafe|extern|new|readonly|record|class|struct|interface|enum|void|delegate)\b/.test(t)) return true;
  // "float Dot(Vector a)" — return type then name then paren
  return /^[\w<>\[\],.?]+\s+[\w<>.*\s]+\s*\(/.test(t) && !t.endsWith(';');
}

// Extract a member (method / property / operator / type) by name, including any
// attached XML docs, attributes and comments directly above it.
export function extractMember(src, name, { raw = null, nth = 1 } = {}) {
  const mask = codeMask(src);
  const starts = lineStarts(src);
  const lines = src.split('\n');
  const re = raw ? new RegExp(raw) : declRegex(name);
  let seen = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineStart = starts[i];
    // ignore matches that fall inside a string or comment
    const idx = lines[i].search(re);
    if (idx < 0) continue;
    if (mask[lineStart + Math.max(idx, 0)]) continue;
    if (!raw && !looksLikeDeclaration(lines[i])) continue;
    if (++seen < nth) continue;   // data-nth picks between overloads

    // find the body: first unmasked '{' or '=>' from the declaration onwards
    let cursor = lineStart;
    let bodyStart = -1;
    let arrow = false;
    while (cursor < src.length) {
      if (!mask[cursor]) {
        if (src[cursor] === '{') { bodyStart = cursor; break; }
        if (src[cursor] === '=' && src[cursor + 1] === '>') { bodyStart = cursor; arrow = true; break; }
        if (src[cursor] === ';') { bodyStart = cursor; arrow = true; break; } // abstract / field
      }
      cursor++;
    }
    if (bodyStart < 0) throw new Error(`Member "${name}" has no body`);

    let endLine;
    if (arrow) {
      let k = bodyStart;
      while (k < src.length && !(src[k] === ';' && !mask[k])) k++;
      endLine = lineOf(starts, Math.min(k, src.length - 1));
    } else {
      let depth = 0;
      let k = bodyStart;
      for (; k < src.length; k++) {
        if (mask[k]) continue;
        if (src[k] === '{') depth++;
        else if (src[k] === '}' && --depth === 0) break;
      }
      endLine = lineOf(starts, Math.min(k, src.length - 1));
    }

    // pull in docs / attributes / comments sitting right above
    let startLine = i + 1;
    for (let j = i - 1; j >= 0; j--) {
      const t = lines[j].trim();
      if (t.startsWith('///') || t.startsWith('//') || /^\[.*\]$/.test(t)) startLine = j + 1;
      else break;
    }
    return slice(src, startLine, endLine);
  }
  throw new Error(`Member "${name}" not found`);
}

// Whole file, minus the trailing blank lines.
export function extractFile(src) {
  return slice(src, 1, src.split('\n').length);
}

// Single entry point used by the renderer. `opts` mirrors the slide attributes.
export function extractSnippet(src, { lines, region, member, match, nth } = {}) {
  if (lines) return extractLines(src, lines);
  if (region) return extractRegion(src, region);
  if (member || match) {
    return extractMember(src, member ?? match, {
      raw: match ?? null,
      nth: nth ? Number(nth) : 1,
    });
  }
  return extractFile(src);
}
