import { createServer } from 'http';
import { readFileSync, readdirSync } from 'fs';
import { join, extname, normalize, resolve } from 'path';

// Port from `PORT=8011 npm start`, `node server.js 8011`, or `npm start -- 8011`.
const PORT = Number(process.env.PORT ?? process.argv[2] ?? 8000);
const ROOT = '.';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Bad port: ${process.env.PORT ?? process.argv[2]}`);
  process.exit(1);
}

// Monaco is served straight out of node_modules, so nothing has to be copied during
// development. Slide code is embedded in the slides themselves (npm run code:embed),
// so there is no source mount.
const MOUNTS = [
  { prefix: '/vendor/monaco/', dir: resolve(ROOT, 'node_modules/monaco-editor/min') },
];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
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

  // Lets a code panel deep-link into the file it is showing (vscode://file/… on this
  // machine). The panel only needs the path — it never fetches the file.
  if (path === '/code-root.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ root: resolve(ROOT, '../demos'), prefix: 'demos' }));
    return;
  }

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
})
  .on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use. Try: npm start -- ${PORT + 1}`);
      process.exit(1);
    }
    throw err;
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
