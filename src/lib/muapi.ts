// Muapi client. Docs: https://muapi.ai/docs/api-reference
//   POST /api/v1/{endpoint}                → { request_id, status, cost }
//   GET  /api/v1/predictions/{id}/result   → { id, status, outputs[], error? }
//   POST /api/v1/upload_file (multipart)   → { url }
// Calls go through the local proxy at /muapi because Muapi blocks browser CORS.

const BASE = './muapi/api/v1';

export class MuapiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

function describeError(status: number, body: any): string {
  const d = body?.detail ?? body?.error ?? body?.message;
  if (Array.isArray(d)) {
    // FastAPI validation errors
    return d.map((e: any) => `${(e.loc || []).slice(1).join('.') || 'request'}: ${e.msg}`).join('; ');
  }
  if (typeof d === 'string') return d;
  if (status === 401 || status === 403) return 'Invalid or missing API key. Check Settings.';
  if (status === 402) return 'Not enough Muapi credits.';
  if (status === 429) return 'Rate limited by Muapi. Try again shortly.';
  return `Request failed (${status})`;
}

async function request<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  if (!apiKey) throw new MuapiError('Add your Muapi API key in Settings first.', 401);
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { 'x-api-key': apiKey, ...(init.headers || {}) },
  });
  let body: any = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { detail: text.slice(0, 300) };
  }
  if (!res.ok) throw new MuapiError(describeError(res.status, body), res.status);
  return body as T;
}

export interface SubmitResult {
  request_id: string;
  status?: string;
  cost?: { amount_usd?: number; amount_credits?: number };
}

export interface PredictionResult {
  id: string;
  status: 'queued' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | string;
  outputs?: (string | { url?: string })[];
  error?: string | null;
  cost?: { amount_usd?: number };
}

export const muapi = {
  submit(apiKey: string, endpoint: string, payload: Record<string, unknown>) {
    return request<SubmitResult>(apiKey, encodeURI(endpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  result(apiKey: string, requestId: string) {
    return request<PredictionResult>(apiKey, `predictions/${encodeURIComponent(requestId)}/result`);
  },

  async upload(apiKey: string, file: Blob, name: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file, name);
    const r = await request<{ url?: string; file_url?: string }>(apiKey, 'upload_file', { method: 'POST', body: fd });
    const url = r.url || r.file_url;
    if (!url) throw new MuapiError('Upload succeeded but no URL was returned.');
    return url;
  },

  balance(apiKey: string) {
    return request<Record<string, unknown>>(apiKey, 'account/balance');
  },
};

export function normalizeOutputs(outputs: PredictionResult['outputs']): string[] {
  return (outputs || [])
    .map((o) => (typeof o === 'string' ? o : o?.url))
    .filter((u): u is string => typeof u === 'string' && /^https?:/.test(u));
}

/** Poll until terminal. Interval backs off from 2s to 6s. */
export async function waitForResult(
  apiKey: string,
  requestId: string,
  opts: { signal?: AbortSignal; onStatus?: (s: string) => void; timeoutMs?: number } = {},
): Promise<PredictionResult> {
  const started = Date.now();
  const timeout = opts.timeoutMs ?? 30 * 60 * 1000;
  let delay = 2000;
  let transientFailures = 0;
  for (;;) {
    if (opts.signal?.aborted) throw new MuapiError('Cancelled');
    let r: PredictionResult;
    try {
      r = await muapi.result(apiKey, requestId);
      transientFailures = 0;
    } catch (e) {
      // Network blips or 5xx while polling shouldn't kill a long video job.
      const status = (e as MuapiError).status;
      if ((status === undefined || status >= 500) && ++transientFailures < 8) {
        await sleep(delay, opts.signal);
        continue;
      }
      throw e;
    }
    opts.onStatus?.(r.status);
    if (r.status === 'completed' || r.status === 'failed' || r.status === 'cancelled') return r;
    if (Date.now() - started > timeout) throw new MuapiError('Timed out waiting for result');
    await sleep(delay, opts.signal);
    delay = Math.min(6000, delay + 500);
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** Best-effort extraction of a credit balance from the balance response. */
export function readBalance(r: Record<string, unknown> | null): string | null {
  if (!r) return null;
  const pick = (o: any): number | undefined => {
    for (const k of ['balance', 'credits', 'credit_balance', 'amount', 'balance_usd', 'total']) {
      if (typeof o?.[k] === 'number') return o[k];
      if (typeof o?.[k] === 'string' && !isNaN(+o[k])) return +o[k];
    }
    return undefined;
  };
  const v = pick(r) ?? pick((r as any).data) ?? pick((r as any).wallet);
  if (v === undefined) return null;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
