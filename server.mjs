// Zero-dependency static server for `npm run preview` / `npm start`.
// Serves ./dist, falls back to index.html for extensionless routes.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url)); // works on Windows and POSIX
const PORT = Number(process.env.PORT) || 4180;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(ROOT, path);
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info) {
      if (extname(path)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
      file = join(ROOT, 'index.html');
    }
    let body = await readFile(file);
    const type = TYPES[extname(file)] || 'application/octet-stream';
    const headers = { 'content-type': type, 'x-content-type-options': 'nosniff',
      'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
    if (/text|javascript|json|xml|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = gzipSync(body); headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, headers); res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end('Server error');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Tierra Automation (Claude cinematic build) → http://localhost:${PORT}`));
