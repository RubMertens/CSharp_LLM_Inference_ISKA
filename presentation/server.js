import { createServer } from 'http';
import { readFileSync, readdirSync } from 'fs';
import { join, extname, normalize, resolve } from 'path';

const PORT = 8000;
const ROOT = '.';

// Code slides fetch the real demo sources; Monaco is served straight out of
// node_modules so nothing has to be copied during development.
const MOUNTS = [
  { prefix: '/code/', dir: resolve(ROOT, '../demos') },
  { prefix: '/vendor/monaco/', dir: resolve(ROOT, 'node_modules/monaco-editor/min') },
];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.cs': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function slidesManifest() {
  return JSON.stringify(
    readdirSync(join(ROOT, 'slides'))
      .filter(f => f.endsWith('.html'))
      .sort()
      .map(f => `slides/${f}`)
  );
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = url.pathname === '/' ? '/index.html' : url.pathname;

  if (path === '/slides.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(slidesManifest());
    return;
  }

  const mount = MOUNTS.find(m => path.startsWith(m.prefix));
  if (mount) {
    const rel = normalize(decodeURIComponent(path.slice(mount.prefix.length)));
    const target = resolve(mount.dir, rel);
    if (!target.startsWith(mount.dir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    try {
      const file = readFileSync(target);
      const mime = MIME[extname(target)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(file);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  try {
    const file = readFileSync(join(ROOT, path));
    const mime = MIME[extname(path)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
