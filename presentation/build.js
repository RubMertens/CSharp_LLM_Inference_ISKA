import { rmSync, mkdirSync, cpSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

const ROOT = '.';
const DIST = 'dist';
const MONACO = 'node_modules/monaco-editor/min';

// Only the tokenizer is used at runtime — no editor instance, no workers. The CSS
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

for (const asset of ['index.html', 'css', 'js', 'slides']) {
  cpSync(join(ROOT, asset), join(DIST, asset), { recursive: true });
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
  console.warn('Warning: monaco-editor not installed — run `npm install`. Code slides fall back to plain text.');
}

console.log(`Built ${DIST}/`);
