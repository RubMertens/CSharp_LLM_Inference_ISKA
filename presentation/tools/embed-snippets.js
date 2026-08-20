// Embed demo code into the slides.
//
//   npm run code:embed              report windows that are missing code or have drifted
//   npm run code:embed -- --write   write the code into the slides
//
// A panel with data-diff-from gets the unified diff of the two versions embedded, plus
// data-added / data-removed line lists — the diff is computed here, once, not at render
// time.
//
// Slides carry their code inline (`<pre class="vscode-source">`), so a deck is
// self-contained: nothing is fetched at render time, nothing is copied into dist, and
// it works from a file:// URL. The data-src / data-member / data-lines attributes stay
// on the window as a reference — this tool re-extracts from them, and check-snippets.js
// reports when the demo code has moved on.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { extractSnippet } from '../js/code-extract.js';
import { unifiedSnippet } from '../js/code-diff.js';
import {
  SLIDES, DEMOS, escapeHtml, findWindows, reference, diffReference, slideFiles, readSlide,
} from './slide-windows.js';

const write = process.argv.includes('--write');

function setAttr(tag, name, value, indent) {
  const re = new RegExp(`\\s${name}="[^"]*"`);
  if (re.test(tag)) return tag.replace(re, ` ${name}="${value}"`);
  return `${tag.slice(0, -1).trimEnd()}\n${indent}${name}="${value}">`;
}

let added = 0;
let drifted = 0;
let inlineOnly = 0;
let failed = 0;

for (const file of slideFiles()) {
  let html = readSlide(file);
  const windows = findWindows(html);
  if (windows.length === 0) continue;

  const notes = [];
  let touched = false;

  // Back to front, so patching one window can't shift the offsets of the others.
  for (const win of [...windows].reverse()) {
    const ref = reference(win.attrs);
    if (!ref) {
      inlineOnly++;
      notes.push('  · no data-src — hand-written snippet, left alone');
      continue;
    }

    const source = join(DEMOS, ref.src);
    if (!existsSync(source)) {
      failed++;
      notes.push(`  ✗ ${ref.src} — file not found`);
      continue;
    }

    let snippet;
    try {
      snippet = extractSnippet(readFileSync(source, 'utf8'), ref);
    } catch (err) {
      failed++;
      notes.push(`  ✗ ${ref.src} [${ref.label}] — ${err.message}`);
      continue;
    }

    // Transition panel: embed the unified diff instead of the plain snippet.
    const diffRef = diffReference(win.attrs);
    let diff = null;
    if (diffRef) {
      const beforeFile = join(DEMOS, diffRef.src);
      if (!existsSync(beforeFile)) {
        failed++;
        notes.push(`  ✗ ${diffRef.src} — data-diff-from file not found`);
        continue;
      }
      try {
        const before = extractSnippet(readFileSync(beforeFile, 'utf8'), diffRef);
        diff = unifiedSnippet(before.code, snippet.code, { ignore: diffRef.ignore });
        diff.beforeStartLine = before.startLine;
        snippet = { ...snippet, code: diff.code };
      } catch (err) {
        failed++;
        notes.push(`  ✗ ${diffRef.src} [diff] — ${err.message}`);
        continue;
      }
    }

    const same = win.code !== null && win.code.replace(/\s+$/, '') === snippet.code.replace(/\s+$/, '');
    const marksMatch = !diff
      || ((win.attrs['data-added'] ?? '') === diff.added
        && (win.attrs['data-removed'] ?? '') === diff.removed
        && win.attrs['data-before-start-line'] === String(diff.beforeStartLine));
    if (same && String(snippet.startLine) === ref.startLine && marksMatch) {
      notes.push(`  ✓ ${ref.src} [${ref.label}] up to date`);
      continue;
    }

    if (win.code === null) added++; else drifted++;
    notes.push(`  ${win.code === null ? '+' : '~'} ${ref.src} [${ref.label}]`
      + ` lines ${snippet.startLine}-${snippet.endLine}`
      + (diff ? ` (diff vs ${diffRef.src}: +${diff.added || 'none'} / -${diff.removed || 'none'})` : '')
      + (win.code === null ? ' — no code embedded' : ' — differs from the demo source'));

    if (!write) continue;

    const tagIndent = html.slice(0, win.tagStart).match(/\n( *)$/)?.[1] ?? '      ';
    const attrIndent = win.tag.match(/\n( *)data-/)?.[1] ?? `${tagIndent}     `;
    const bodyIndent = `${tagIndent}  `;
    let tag = setAttr(win.tag, 'data-start-line', String(snippet.startLine), attrIndent);
    if (diff) {
      // Only the side that actually changed gets an attribute.
      if (diff.added) tag = setAttr(tag, 'data-added', diff.added, attrIndent);
      if (diff.removed) tag = setAttr(tag, 'data-removed', diff.removed, attrIndent);
      // So the panel can number and name the before version while it shows it.
      tag = setAttr(tag, 'data-before-start-line', String(diff.beforeStartLine), attrIndent);
    }
    const block = `\n${bodyIndent}<pre class="vscode-source">\n${escapeHtml(snippet.code)}\n${bodyIndent}</pre>`;
    const after = win.embedded
      ? win.body.slice(win.embedded[0].length)
      : win.body;

    html = html.slice(0, win.tagStart) + tag + block + after + html.slice(win.tagEnd + 1 + win.body.length);
    touched = true;
  }

  if (touched) writeFileSync(join(SLIDES, file), html);
  console.log(`\n${file}${touched ? '  (written)' : ''}`);
  console.log(notes.join('\n'));
}

console.log(`\n${added} embedded, ${drifted} drifted, ${inlineOnly} hand-written, ${failed} failed`);
if (!write && (added || drifted)) console.log('Run with --write to update the slides.');
process.exit(failed === 0 ? 0 : 1);
