import { rmSync, mkdirSync, cpSync, writeFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';

const ROOT = '.';
const DIST = 'dist';

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

console.log(`Built ${DIST}/`);
