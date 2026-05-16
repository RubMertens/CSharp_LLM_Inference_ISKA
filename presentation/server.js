import { createServer } from 'http';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const PORT = 8000;
const ROOT = '.';

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

  if (path === '/slides.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(slidesManifest());
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
