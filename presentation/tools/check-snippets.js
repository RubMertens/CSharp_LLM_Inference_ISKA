// Verify every code window in slides/ resolves to a real snippet.
//
//   npm run check:code            report all windows
//   npm run check:code -- --show  also print the extracted code
//
// Catches renamed methods and moved files before a talk, which is the failure
// mode of pulling snippets out of a live codebase.

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { extractSnippet } from '../js/code-extract.js';

const SLIDES = 'slides';
const DEMOS = '../demos';
const show = process.argv.includes('--show');

function parseAttrs(text) {
  const attrs = {};
  const attr = /([a-zA-Z-]+)="([^"]*)"/g;
  let a;
  while ((a = attr.exec(text))) attrs[a[1]] = a[2];
  return attrs;
}

// Pull attributes off every element carrying class="… vscode-window …", plus the
// .vscode-step markers that follow it (up to the next window).
function findWindows(html) {
  const out = [];
  const tag = /<(\w+)([^>]*\bclass="[^"]*\bvscode-window\b[^"]*"[^>]*)>/g;
  const hits = [];
  let m;
  while ((m = tag.exec(html))) hits.push({ attrs: parseAttrs(m[2]), from: tag.lastIndex });

  hits.forEach((hit, i) => {
    const body = html.slice(hit.from, i + 1 < hits.length ? hits[i + 1].from : html.length);
    const steps = [...body.matchAll(/<span([^>]*\bclass="[^"]*\bvscode-step\b[^"]*"[^>]*)>/g)]
      .map(s => parseAttrs(s[1]));
    out.push({ ...hit.attrs, steps });
  });
  return out;
}

// Resolve one step marker against the snippet: data-lines is snippet-relative,
// data-text matches whole lines.
function resolveStep(step, codeLines) {
  const hits = new Set();
  const spec = step['data-lines'];
  if (spec) {
    for (const part of spec.split(',')) {
      const r = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!r) continue;
      const from = Number(r[1]);
      const to = r[2] ? Number(r[2]) : from;
      for (let i = from; i <= to; i++) hits.add(i);
    }
  }
  const needle = step['data-text'];
  if (needle) codeLines.forEach((l, i) => { if (l.includes(needle)) hits.add(i + 1); });
  return [...hits].sort((a, b) => a - b);
}

const dataset = (attrs) => ({
  src: attrs['data-src'],
  lines: attrs['data-lines'],
  region: attrs['data-region'],
  member: attrs['data-member'],
  match: attrs['data-match'],
  nth: attrs['data-nth'],
});

let checked = 0;
let failed = 0;

for (const file of readdirSync(SLIDES).filter(f => f.endsWith('.html')).sort()) {
  const html = readFileSync(join(SLIDES, file), 'utf8');
  const windows = findWindows(html);
  if (windows.length === 0) continue;

  console.log(`\n${file}`);
  for (const attrs of windows) {
    const opts = dataset(attrs);
    if (!opts.src) {
      console.log('  · inline snippet (no data-src) — skipped');
      continue;
    }
    checked++;
    const path = join(DEMOS, opts.src);
    if (!existsSync(path)) {
      failed++;
      console.log(`  ✗ ${opts.src} — file not found`);
      continue;
    }
    try {
      const { code, startLine, endLine } = extractSnippet(readFileSync(path, 'utf8'), opts);
      const codeLines = code.split('\n');
      const label = opts.lines ?? opts.member ?? opts.region ?? 'whole file';
      console.log(`  ✓ ${opts.src} [${label}] lines ${startLine}-${endLine} (${codeLines.length} shown)`);
      if (show) console.log(codeLines.map((l, i) => `      ${String(i + 1).padStart(3)} ${l}`).join('\n'));

      // A step that resolves to nothing, or points past the snippet, highlights
      // nothing on the slide — that is a broken walkthrough, so fail on it.
      attrs.steps.forEach((step, i) => {
        const hits = resolveStep(step, codeLines);
        const outOfRange = hits.filter(n => n < 1 || n > codeLines.length);
        if (hits.length === 0 || outOfRange.length > 0) {
          failed++;
          console.log(`    ✗ step ${i}: ${JSON.stringify(step['data-lines'] ?? step['data-text'])} → ${hits.length === 0 ? 'no lines matched' : `outside snippet (${outOfRange.join(',')})`}`);
          return;
        }
        const preview = hits.map(n => codeLines[n - 1].trim()).filter(Boolean)[0] ?? '';
        console.log(`    · step ${i} → lines ${hits[0]}-${hits[hits.length - 1]}: ${preview.slice(0, 72)}`);
      });
    } catch (err) {
      failed++;
      console.log(`  ✗ ${opts.src} [${opts.member ?? opts.region ?? opts.lines}] — ${err.message}`);
    }
  }
}

console.log(`\n${checked} snippet(s) checked, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
