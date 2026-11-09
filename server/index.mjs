// Standalone self-hosted server: serves the built app from ./dist and proxies
// Muapi requests. Zero runtime dependencies (Node 18+).
//
//   HOST=0.0.0.0 PORT=8080 node server/index.mjs

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './handler.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

export function startServer({ port = 8080, host = '127.0.0.1', distDir } = {}) {
  const root = resolve(distDir || join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist'));
  const api = createApiHandler();

  async function serveStatic(req, res) {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, 'index.html'); // SPA fallback
    }
    try {
      const data = await readFile(file);
      res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream');
      if (file.includes(`${sep}assets${sep}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found. Did you run `npm run build`?');
    }
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    if (await api(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      return res.end();
    }
    await serveStatic(req, res);
  });

  return new Promise((resolveP, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolveP(server));
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '127.0.0.1';
  startServer({ port, host }).then((s) => {
    const addr = s.address();
    console.log(`Reelforge running at http://${host === '0.0.0.0' ? 'localhost' : host}:${addr.port}`);
  });
}
