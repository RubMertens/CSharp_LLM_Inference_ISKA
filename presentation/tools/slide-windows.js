// Shared slide parsing for the code tools (embed-snippets, check-snippets).
//
// Deliberately regex-and-scan rather than a DOM library: the repo has no build step
// and one dependency (Monaco) is enough. Only what the tools need is parsed — window
// tags, their attributes, the embedded <pre>, and the marker spans that follow.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export const SLIDES = 'slides';
export const DEMOS = '../demos';

export const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const unescapeHtml = (s) => s
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

// Walk from "<" to the tag's closing ">", honouring quoted attribute values —
// data-note and data-values legitimately contain ">".
export function tagEnd(html, start) {
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

export function parseAttrs(text) {
  const attrs = {};
  const attr = /([a-zA-Z-]+)="([^"]*)"/g;
  let m;
  while ((m = attr.exec(text))) attrs[m[1]] = m[2];
  return attrs;
}

export const SOURCE_RE = /^\s*<pre class="vscode-source">\n?([\s\S]*?)\n?\s*<\/pre>/;

// Every .vscode-window in the file, with its attributes, embedded code and the
// marker spans that follow it (up to the next window).
export function findWindows(html) {
  const hits = [];
  const open = /<div(?=[\s>])/g;
  let m;
  while ((m = open.exec(html))) {
    const end = tagEnd(html, m.index);
    if (end < 0) continue;
    const tag = html.slice(m.index, end + 1);
    if (!/\bclass="[^"]*\bvscode-window\b/.test(tag)) continue;
    hits.push({ tagStart: m.index, tagEnd: end, tag, attrs: parseAttrs(tag) });
  }

  return hits.map((hit, i) => {
    const body = html.slice(hit.tagEnd + 1, i + 1 < hits.length ? hits[i + 1].tagStart : html.length);
    const embedded = body.match(SOURCE_RE);
    const markers = (selector) => [...body.matchAll(
      new RegExp(`<span([^>]*\\bclass="[^"]*\\b${selector}\\b[^"]*"[^>]*)>`, 'g'))]
      .map(s => parseAttrs(s[1]));
    return {
      ...hit,
      body,
      code: embedded ? unescapeHtml(embedded[1]) : null,
      embedded,
      steps: markers('vscode-step'),
      inlines: markers('vscode-inline'),
    };
  });
}

export function slideFiles() {
  return readdirSync(SLIDES).filter(f => f.endsWith('.html')).sort();
}

export function readSlide(file) {
  return readFileSync(join(SLIDES, file), 'utf8');
}

// Reference back to the demo source, if the window carries one.
export function reference(attrs) {
  if (!attrs['data-src']) return null;
  return {
    src: attrs['data-src'],
    lines: attrs['data-lines'],
    region: attrs['data-region'],
    member: attrs['data-member'],
    match: attrs['data-match'],
    nth: attrs['data-nth'],
    startLine: attrs['data-start-line'],
    label: attrs['data-lines'] ?? attrs['data-member'] ?? attrs['data-region'] ?? 'whole file',
  };
}
