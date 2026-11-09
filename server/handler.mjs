// Shared request handler: proxies Muapi API calls and full-resolution downloads.
// Used by the Vite dev server, the standalone Node server, and the Electron app.
//
// The API key is never stored here. The browser sends it per request in the
// `x-api-key` header and it is forwarded to Muapi as-is.

import { isIP } from 'node:net';

const MUAPI_ORIGIN = process.env.MUAPI_ORIGIN || 'https://api.muapi.ai';
const MAX_BODY = 80 * 1024 * 1024; // uploads are capped at 50MB by Muapi

const FORWARD_REQ_HEADERS = ['x-api-key', 'content-type', 'accept'];
const FORWARD_RES_HEADERS = ['content-type', 'content-length', 'cache-control'];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

async function pipeResponse(upstream, res, extraHeaders = {}) {
  res.statusCode = upstream.status;
  for (const h of FORWARD_RES_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  if (!upstream.body) return res.end();
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!res.write(value)) await new Promise((r) => res.once('drain', r));
  }
  res.end();
}

/** Reject obvious SSRF targets: non-http(s), localhost, private/link-local IPs. */
function isSafeRemoteUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (isIP(host)) {
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return false;
  }
  return true;
}

function safeFilename(name) {
  return String(name || 'download').replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'download';
}

export function createApiHandler() {
  /** Returns true if the request was handled. */
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://local');

    // --- Muapi API proxy: /muapi/api/v1/... -> https://api.muapi.ai/api/v1/...
    if (url.pathname.startsWith('/muapi/')) {
      try {
        const target = MUAPI_ORIGIN + url.pathname.slice('/muapi'.length) + url.search;
        const headers = {};
        for (const h of FORWARD_REQ_HEADERS) if (req.headers[h]) headers[h] = req.headers[h];
        const method = req.method || 'GET';
        const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
        const upstream = await fetch(target, { method, headers, body });
        await pipeResponse(upstream, res);
      } catch (err) {
        if (!res.headersSent) sendJson(res, err.status || 502, { detail: `Proxy error: ${err.message}` });
        else res.end();
      }
      return true;
    }

    // --- Full-resolution download proxy: /dl?url=...&name=...
    // Output CDNs usually don't send CORS headers, so the browser can't fetch
    // the blob directly. This streams the original file with attachment headers.
    if (url.pathname === '/dl') {
      const remote = url.searchParams.get('url');
      if (!remote || !isSafeRemoteUrl(remote)) {
        sendJson(res, 400, { detail: 'Invalid or disallowed url' });
        return true;
      }
      try {
        const upstream = await fetch(remote, { redirect: 'follow' });
        if (!upstream.ok) {
          sendJson(res, upstream.status, { detail: `Upstream returned ${upstream.status}` });
          return true;
        }
        const name = safeFilename(url.searchParams.get('name'));
        const disposition = url.searchParams.get('inline') ? 'inline' : `attachment; filename="${name}"`;
        await pipeResponse(upstream, res, { 'content-disposition': disposition });
      } catch (err) {
        if (!res.headersSent) sendJson(res, 502, { detail: `Download failed: ${err.message}` });
        else res.end();
      }
      return true;
    }

    if (url.pathname === '/healthz') {
      sendJson(res, 200, { ok: true });
      return true;
    }

    return false;
  };
}
