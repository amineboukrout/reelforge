import { AlertTriangle, Download, Heart, Images, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadFile, downloadName } from '../lib/download';
import type { Generation, StudioId } from '../lib/types';
import { cx, isVideoUrl, timeAgo } from '../lib/util';
import { useApp } from '../store/app';

const STUDIO_NAMES: Record<StudioId, string> = { image: 'Image', video: 'Video', lipsync: 'Lip Sync', cinema: 'Cinema' };

function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor((Date.now() - since) / 1000);
  return <span className="elapsed">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

export function MediaEl({ url, kind, autoPlay, controls, className }: { url: string; kind: 'image' | 'video'; autoPlay?: boolean; controls?: boolean; className?: string }) {
  if (kind === 'video' || isVideoUrl(url)) {
    return (
      <video
        className={className}
        src={url}
        muted={!controls}
        loop
        playsInline
        controls={controls}
        autoPlay={autoPlay}
        preload="metadata"
        onMouseEnter={(e) => !controls && e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => !controls && !autoPlay && e.currentTarget.pause()}
      />
    );
  }
  return <img className={className} src={url} alt="" loading="lazy" decoding="async" />;
}

function Tile({ g }: { g: Generation }) {
  const openViewer = useApp((s) => s.openViewer);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const deleteGeneration = useApp((s) => s.deleteGeneration);
  const retry = useApp((s) => s.retry);
  const pending = g.status === 'submitting' || g.status === 'queued' || g.status === 'processing';
  const failed = g.status === 'failed' || g.status === 'cancelled';
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="tile"
      tabIndex={0}
      onClick={() => g.outputs.length && openViewer(g.id)}
      onKeyDown={(e) => e.key === 'Enter' && g.outputs.length && openViewer(g.id)}
    >
      <div className="media">
        {pending || failed || !g.outputs.length ? (
          <div className={cx('pending', g.kind === 'video' && 'video', failed && 'failed')}>
            {failed ? <AlertTriangle size={22} color="var(--err)" /> : <div className="spinner" />}
            <div style={{ fontWeight: 500 }}>
              {failed ? 'Failed' : g.status === 'submitting' ? 'Uploading & submitting…' : g.status === 'queued' ? 'In queue…' : 'Generating…'}
            </div>
            {failed ? <div className="err">{g.error}</div> : <Elapsed since={g.createdAt} />}
            {failed && (
              <button className="btn sm" onClick={stop(() => retry(g.id))}>
                <RefreshCw size={12} /> Retry
              </button>
            )}
          </div>
        ) : (
          <MediaEl url={g.outputs[0]} kind={g.kind} />
        )}
        {g.outputs.length > 1 && (
          <span className="count">
            <Images size={11} style={{ verticalAlign: -1 }} /> {g.outputs.length}
          </span>
        )}
        <div className="overlay">
          <div className="acts">
            {g.outputs.length > 0 && (
              <button
                aria-label="Download full resolution"
                title="Download full resolution"
                onClick={stop(() => g.outputs.forEach((u) => downloadFile(u, downloadName(g.prompt || g.modelName, u, g.kind))))}
              >
                <Download size={14} />
              </button>
            )}
            {!pending && (
              <button aria-label="Run again" title="Run again" onClick={stop(() => retry(g.id))}>
                <RefreshCw size={14} />
              </button>
            )}
            <button aria-label="Favorite" title="Favorite" onClick={stop(() => toggleFavorite(g.id))}>
              <Heart size={14} fill={g.favorite ? 'var(--accent-2)' : 'none'} color={g.favorite ? 'var(--accent-2)' : 'currentColor'} />
            </button>
            <button aria-label="Delete" title="Delete from history" onClick={stop(() => deleteGeneration(g.id))}>
              <Trash2 size={14} />
            </button>
          </div>
          {g.prompt && <div className="cap">{g.prompt}</div>}
        </div>
      </div>
      <div className="foot">
        <span className="m">{g.modelName}</span>
        <span>·</span>
        <span style={{ whiteSpace: 'nowrap' }}>{timeAgo(g.createdAt)}</span>
      </div>
    </div>
  );
}

export function Feed({ studio, empty }: { studio: StudioId; empty: React.ReactNode }) {
  const generations = useApp((s) => s.generations);
  const [scope, setScope] = useState<'studio' | 'all' | 'fav'>('studio');
  const clearHistory = useApp((s) => s.clearHistory);

  const list = generations.filter((g) => (scope === 'all' ? true : scope === 'fav' ? g.favorite : g.studio === studio));
  const active = generations.filter((g) => ['submitting', 'queued', 'processing'].includes(g.status)).length;

  return (
    <section className="feed" aria-label="Generations">
      <div className="feed-head">
        <div className="tabs" role="tablist">
          <button className={cx(scope === 'studio' && 'on')} onClick={() => setScope('studio')}>{STUDIO_NAMES[studio]}</button>
          <button className={cx(scope === 'all' && 'on')} onClick={() => setScope('all')}>All history</button>
          <button className={cx(scope === 'fav' && 'on')} onClick={() => setScope('fav')}>Favorites</button>
        </div>
        {active > 0 && (
          <span className="mode-badge media">
            <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> {active} running
          </span>
        )}
        <span className="grow" />
        {generations.length > 0 && scope === 'all' && (
          <button
            className="btn ghost sm"
            onClick={() => window.confirm('Clear generation history? Favorites are kept.') && clearHistory()}
          >
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>
      {list.length === 0 ? (
        scope === 'studio' ? empty : <div className="empty"><p>Nothing here yet.</p></div>
      ) : (
        <div className="grid">
          {list.map((g) => (
            <Tile key={g.id} g={g} />
          ))}
        </div>
      )}
    </section>
  );
}
