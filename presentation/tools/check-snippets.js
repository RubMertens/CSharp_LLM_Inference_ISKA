// Verify the code slides before a talk.
//
//   npm run check:code            check every code window
//   npm run check:code -- --show  also print the embedded code, numbered
//
// Two things rot silently: the embedded code falls behind the demo project, and a
// walkthrough step points at lines that no longer say what its note claims. Both are
// only noticed on stage, so both are checked here. Fix drift with
// `npm run code:embed -- --write`.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { extractSnippet } from '../js/code-extract.js';
import { DEMOS, findWindows, reference, slideFiles, readSlide } from './slide-windows.js';

const show = process.argv.includes('--show');

// "3-5,9" → [3,4,5,9]
function parseLineSpec(spec) {
  const out = new Set();
  for (const part of String(spec ?? '').split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const from = Number(m[1]);
    for (let i = from; i <= (m[2] ? Number(m[2]) : from); i++) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

// Markers address lines by number (snippet-relative) or by content.
function resolveMarker(marker, codeLines, lineAttr) {
  const hits = new Set(parseLineSpec(marker[lineAttr]));
  const needle = marker['data-text'];
  if (needle) codeLines.forEach((l, i) => { if (l.includes(needle)) hits.add(i + 1); });
  return [...hits].sort((a, b) => a - b);
}

let checked = 0;
let failed = 0;

for (const file of slideFiles()) {
  const windows = findWindows(readSlide(file));
  if (windows.length === 0) continue;

  console.log(`\n${file}`);
  for (const win of windows) {
    checked++;
    const ref = reference(win.attrs);

    if (win.code === null) {
      failed++;
      console.log(`  ✗ ${ref?.src ?? 'window'} — no embedded code`
        + (ref ? ' (run: npm run code:embed -- --write)' : ''));
      continue;
    }

    const codeLines = win.code.split('\n');
    const start = Number(ref?.startLine ?? 1);
    console.log(`  ✓ ${ref ? `${ref.src} [${ref.label}]` : 'hand-written snippet'}`
      + ` lines ${start}-${start + codeLines.length - 1} (${codeLines.length} shown)`);
    if (show) console.log(codeLines.map((l, i) => `      ${String(i + 1).padStart(3)} ${l}`).join('\n'));

    // Has the demo project moved on?
    if (ref && existsSync(join(DEMOS, ref.src))) {
      try {
        const fresh = extractSnippet(readFileSync(join(DEMOS, ref.src), 'utf8'), ref);
        if (fresh.code.replace(/\s+$/, '') !== win.code.replace(/\s+$/, '')) {
          failed++;
          console.log('    ✗ embedded code differs from the demo source'
            + ' — npm run code:embed -- --write');
        } else if (String(fresh.startLine) !== String(start)) {
          failed++;
          console.log(`    ✗ data-start-line is ${start}, source starts at ${fresh.startLine}`
            + ' — npm run code:embed -- --write');
        }
      } catch (err) {
        failed++;
        console.log(`    ✗ reference no longer resolves: ${err.message}`);
      }
    } else if (ref) {
      console.log(`    · ${DEMOS} not available — skipped the drift check`);
    }

    // Do the walkthrough markers still land on real lines?
    const markers = [
      ...win.steps.map(m => ({ m, kind: 'step', attr: 'data-lines' })),
      ...win.inlines.map(m => ({ m, kind: 'inline', attr: 'data-line' })),
    ];
    markers.forEach(({ m, kind, attr }, i) => {
      const hits = resolveMarker(m, codeLines, attr);
      const outside = hits.filter(n => n < 1 || n > codeLines.length);
      if (hits.length === 0 || outside.length > 0) {
        failed++;
        console.log(`    ✗ ${kind} ${i}: ${JSON.stringify(m[attr] ?? m['data-text'])} → `
          + (hits.length === 0 ? 'no lines matched' : `outside the snippet (${outside.join(',')})`));
        return;
      }
      // inline values are keyed by line number too — those must be real lines as well
      const valueLines = parseLineSpec((m['data-values'] ?? '')
        .split('|').map(v => v.split(':')[0]).join(','));
      const badValues = valueLines.filter(n => n < 1 || n > codeLines.length);
      if (badValues.length) {
        failed++;
        console.log(`    ✗ ${kind} ${i}: data-values points outside the snippet (${badValues.join(',')})`);
        return;
      }
      const preview = hits.map(n => codeLines[n - 1].trim()).find(Boolean) ?? '';
      console.log(`    · ${kind} ${i} → lines ${hits[0]}-${hits[hits.length - 1]}: ${preview.slice(0, 68)}`);
    });
  }
}

console.log(`\n${checked} code window(s) checked, ${failed} problem(s)`);
process.exit(failed === 0 ? 0 : 1);
