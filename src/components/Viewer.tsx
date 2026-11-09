import { ChevronLeft, ChevronRight, Copy, Download, ImageUp, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadFile, downloadName } from '../lib/download';
import { isVideoUrl, timeAgo } from '../lib/util';
import { useApp } from '../store/app';
import { MediaEl } from './Feed';

/** Fired to hand a generated output to the active studio as an input. */
export const USE_INPUT_EVENT = 'reelforge:use-input';
export interface UseInputDetail {
  uploadId: string;
  kind: 'image' | 'video';
}

export function Viewer() {
  const viewer = useApp((s) => s.viewer);
  const close = useApp((s) => s.closeViewer);
  const open = useApp((s) => s.openViewer);
  const gens = useApp((s) => s.generations);
  const retry = useApp((s) => s.retry);
  const del = useApp((s) => s.deleteGeneration);
  const addFiles = useApp((s) => s.addFiles);
  const toast = useApp((s) => s.toast);
  const [busy, setBusy] = useState(false);

  const done = gens.filter((g) => g.outputs.length);
  const gi = done.findIndex((g) => g.id === viewer?.genId);
  const g = done[gi];
  const idx = Math.min(viewer?.index ?? 0, (g?.outputs.length ?? 1) - 1);

  // Flatten (generation, output) pairs for arrow-key navigation.
  const flat = done.flatMap((x) => x.outputs.map((_, i) => [x.id, i] as const));
  const pos = flat.findIndex(([id, i]) => id === g?.id && i === idx);
  const go = (d: number) => {
    const n = flat[pos + d];
    if (n) open(n[0], n[1]);
  };

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!viewer || !g) return null;
  const url = g.outputs[idx];
  const kind = g.kind === 'video' || isVideoUrl(url) ? 'video' : 'image';

  const useAsInput = async () => {
    setBusy(true);
    try {
      const r = await fetch(`./dl?inline=1&url=${encodeURIComponent(url)}`);
      if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
      const blob = await r.blob();
      const name = downloadName(g.prompt || g.modelName, url, kind);
      const [rec] = await addFiles([new File([blob], name, { type: blob.type || (kind === 'video' ? 'video/mp4' : 'image/png') })]);
      if (rec) {
        window.dispatchEvent(new CustomEvent<UseInputDetail>(USE_INPUT_EVENT, { detail: { uploadId: rec.id, kind } }));
        toast('success', 'Added as input');
        close();
      }
    } catch (e) {
      toast('error', `Couldn't load output: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const params = Object.entries(g.payload).filter(([k, v]) => k !== 'prompt' && typeof v !== 'object' && !String(v).startsWith('http'));

  return (
    <div className="viewer" role="dialog" aria-label="Viewer">
      <div className="stage" onClick={(e) => e.target === e.currentTarget && close()}>
        <button className="btn icon close" onClick={close} aria-label="Close">
          <X size={18} />
        </button>
        {pos > 0 && (
          <button className="btn icon nav l" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
        )}
        {pos < flat.length - 1 && (
          <button className="btn icon nav r" onClick={() => go(1)} aria-label="Next">
            <ChevronRight size={18} />
          </button>
        )}
        <MediaEl key={url} url={url} kind={kind} controls autoPlay />
      </div>
      <aside className="side">
        <div className="row">
          <strong style={{ font: '600 15px var(--display)' }}>{g.modelName}</strong>
          <span className="grow" />
          <span className="muted small">{timeAgo(g.createdAt)}</span>
        </div>
        <button className="btn primary" onClick={() => downloadFile(url, downloadName(g.prompt || g.modelName, url, kind))}>
          <Download size={15} /> Download full resolution
        </button>
        <div className="row wrap">
          <button className="btn sm" onClick={useAsInput} disabled={busy}>
            <ImageUp size={13} /> {busy ? 'Loading…' : 'Use as input'}
          </button>
          <button className="btn sm" onClick={() => (retry(g.id), close())}>
            <RefreshCw size={13} /> Run again
          </button>
          <button
            className="btn sm"
            onClick={() => {
              navigator.clipboard.writeText(g.prompt);
              toast('info', 'Prompt copied');
            }}
          >
            <Copy size={13} /> Copy prompt
          </button>
          <button className="btn sm danger" onClick={() => del(g.id)}>
            <Trash2 size={13} />
          </button>
        </div>
        {g.outputs.length > 1 && (
          <div className="thumbs">
            {g.outputs.map((o, i) => (
              <button key={o} className="thumb" style={{ outline: i === idx ? '2px solid var(--accent)' : undefined }} onClick={() => open(g.id, i)}>
                <MediaEl url={o} kind={g.kind} />
              </button>
            ))}
          </div>
        )}
        {g.prompt && (
          <div className="section">
            <div className="label">Prompt</div>
            <div className="prompt-read">{g.prompt}</div>
          </div>
        )}
        {g.sentPrompt && g.sentPrompt !== g.prompt && (
          <div className="section">
            <div className="label">Sent to model</div>
            <div className="prompt-read small">{g.sentPrompt}</div>
          </div>
        )}
        <dl className="kv">
          <dt>Endpoint</dt>
          <dd>{g.modelId}</dd>
          {params.map(([k, v]) => (
            <FragmentKV key={k} k={k} v={String(v)} />
          ))}
          {g.cost !== undefined && (
            <>
              <dt>Cost</dt>
              <dd>${g.cost.toFixed(4)}</dd>
            </>
          )}
          {g.completedAt && (
            <>
              <dt>Took</dt>
              <dd>{Math.round((g.completedAt - g.createdAt) / 1000)}s</dd>
            </>
          )}
          {g.requestId && (
            <>
              <dt>Request</dt>
              <dd style={{ fontFamily: 'monospace', fontSize: 11 }}>{g.requestId}</dd>
            </>
          )}
        </dl>
      </aside>
    </div>
  );
}

function FragmentKV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k.replace(/_/g, ' ')}</dt>
      <dd>{v}</dd>
    </>
  );
}
