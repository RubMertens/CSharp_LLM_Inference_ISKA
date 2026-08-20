// Line diff for code panels: turns "before" and "after" snippets into one unified
// listing plus the line numbers that were added and removed.
//
// Pure string work, no DOM — it runs under node for `npm run code:embed`, which bakes
// the result into the slide. Nothing diffs at render time.
//
// Why a normalizer: the demo project renames as it evolves (weights → Weights between
// 1_SingleLayer and 2_WithRope), and a raw line comparison then marks nearly every line
// changed, burying the two lines that actually matter. `ignore` says what counts as
// noise for the purpose of matching lines up; the text shown is always verbatim.

const norm = (line, { ignoreCase, ignoreWhitespace }) => {
  let s = line;
  if (ignoreWhitespace) s = s.trim().replace(/\s+/g, ' ');
  if (ignoreCase) s = s.toLowerCase();
  return s;
};

// Longest common subsequence over normalized lines. Snippets are a few dozen lines, so
// the O(n·m) table is nothing; the cap is only there to refuse a whole-file diff.
function lcs(a, b) {
  const LIMIT = 600;
  if (a.length > LIMIT || b.length > LIMIT) {
    throw new Error(`diff too large (${a.length} vs ${b.length} lines) — narrow the snippet`);
  }
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

// → [{ kind: 'context' | 'del' | 'add', text }]
// Removals come before the additions that replace them, as in a unified diff.
export function diffLines(before, after, { ignore = [] } = {}) {
  const opts = {
    ignoreCase: ignore.includes('case'),
    // Indentation shifts are never the point of a slide, so lines match on their
    // collapsed form unless a panel asks for exact whitespace.
    ignoreWhitespace: !ignore.includes('exact-whitespace'),
  };
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const a = beforeLines.map(l => norm(l, opts));
  const b = afterLines.map(l => norm(l, opts));

  const table = lcs(a, b);
  const out = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'context', text: afterLines[j] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ kind: 'del', text: beforeLines[i] });
      i++;
    } else {
      out.push({ kind: 'add', text: afterLines[j] });
      j++;
    }
  }
  while (i < a.length) out.push({ kind: 'del', text: beforeLines[i++] });
  while (j < b.length) out.push({ kind: 'add', text: afterLines[j++] });

  return out;
}

// "3-4,9" from a list of line numbers
export function toSpec(numbers) {
  const sorted = [...numbers].sort((x, y) => x - y);
  const runs = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  return runs.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(',');
}

// The unified listing as it will be embedded, plus the 1-based line numbers of the
// added and removed lines within it.
export function unifiedSnippet(before, after, options) {
  const rows = diffLines(before, after, options);
  const added = [];
  const removed = [];
  rows.forEach((row, index) => {
    if (row.kind === 'add') added.push(index + 1);
    if (row.kind === 'del') removed.push(index + 1);
  });
  return {
    code: rows.map(r => r.text).join('\n'),
    added: toSpec(added),
    removed: toSpec(removed),
    rows,
  };
}
