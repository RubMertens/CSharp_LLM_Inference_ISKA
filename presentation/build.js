import { rmSync, mkdirSync, cpSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

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

for (const asset of ['index.html', 'css', 'js', 'slides']) {
  cpSync(join(ROOT, asset), join(DIST, asset), { recursive: true });
}

writeFileSync(join(DIST, 'slides.json'), slidesManifest());

console.log(`Built ${DIST}/`);
