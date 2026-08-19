import { rmSync, mkdirSync, cpSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, sep } from 'path';
import { execSync } from 'child_process';

const ROOT = '.';
const DIST = 'dist';
const MONACO = 'node_modules/monaco-editor/min';

// Code panels use Monaco as a tokenizer only — no editor instance, no workers. The CSS
// and its codicon font are still required: the AMD loader fetches editor.main.css
// alongside editor.main.js, and a 404 there fails the whole module load.
const MONACO_FILES = [
  'vs/loader.js',
  'vs/editor/editor.main.js',
  'vs/editor/editor.main.css',
  'vs/basic-languages/csharp/csharp.js',
  'vs/base/browser/ui/codicons/codicon/codicon.ttf',
];

// Slide code is embedded in the slides, so nothing needs copying — but the panels do
// print where each snippet came from. The deployed deck can't deep-link into a local
// checkout, so those links point at GitHub. Derived from the origin remote; CODE_REF
// overrides the branch.
function sourceConfig() {
  try {
    const url = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    const slug = url
      .replace(/^git@github\.com:/, '')
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
    if (!slug || !slug.includes('/')) return null;
    return {
      repo: `https://github.com/${slug}`,
      ref: process.env.CODE_REF || 'main',
      prefix: 'demos',
    };
  } catch {
    return null;
  }
}

// Mirror server.js slidesManifest() exactly: .html only, sorted, prefixed slides/
function slidesManifest() {
  return JSON.stringify(
    readdirSync(join(ROOT, 'slides'))
      .filter(f => f.endsWith('.html'))
      .sort()
      .map(f => `slides/${f}`)
  );
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// css/isks/ keeps the full-resolution pptx originals plus preview pages and
// extraction scripts for provenance. None of it is referenced at runtime
// (the CSS points at assets/web/), so it stays out of the deploy -- the
// originals alone are ~2.9 MB.
function shipped(src) {
  // cpSync hands us paths relative to ROOT, e.g. "css/isks/tools"
  const parts = src.split(sep).join('/').replace(/^\.\//, '').split('/');
  const i = parts.indexOf('isks');
  if (i < 1 || parts[i - 1] !== 'css') return true;
  const rest = parts.slice(i + 1);
  if (rest.length === 0) return true;
  if (rest[0] === 'tools') return false;
  if (/^(preview|preview-single|verify)\.html$/.test(rest[0])) return false;
  // keep assets/web/, drop the full-resolution originals beside it
  if (rest[0] === 'assets' && rest.length === 2) {
    return rest[1] === 'web' || rest[1].endsWith('.md');
  }
  return true;
}

for (const asset of ['index.html', 'css', 'js', 'slides']) {
  cpSync(join(ROOT, asset), join(DIST, asset), { recursive: true, filter: shipped });
}

writeFileSync(join(DIST, 'slides.json'), slidesManifest());

const sources = sourceConfig();
if (sources) {
  writeFileSync(join(DIST, 'code-root.json'), JSON.stringify(sources));
  console.log(`Code panels link to ${sources.repo}/blob/${sources.ref}/${sources.prefix}/…`);
} else {
  console.warn('Warning: no git remote found — code panels will show paths without links.');
}

if (existsSync(MONACO)) {
  for (const file of MONACO_FILES) {
    const out = join(DIST, 'vendor/monaco', file);
    mkdirSync(dirname(out), { recursive: true });
    cpSync(join(MONACO, file), out);
  }
  console.log(`Copied Monaco tokenizer to ${DIST}/vendor/monaco/`);
} else {
  console.warn('Warning: monaco-editor not installed — run `npm install`. Code panels fall back to plain text.');
}

console.log(`Built ${DIST}/`);
