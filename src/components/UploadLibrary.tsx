import { Check, Music, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type { MediaKind, UploadRecord } from '../lib/types';
import { cx, formatBytes, timeAgo } from '../lib/util';
import { blobUrl, useApp } from '../store/app';

interface LibraryRequest {
  kinds: MediaKind[];
  multi: boolean;
  onPick?: (ids: string[]) => void;
}

export const useLibrary = create<{ req: LibraryRequest | null; open(r: LibraryRequest): void; close(): void }>((set) => ({
  req: null,
  open: (req) => set({ req }),
  close: () => set({ req: null }),
}));

export function UploadThumb({ u }: { u: UploadRecord }) {
  if (u.kind === 'image') return <img src={blobUrl(u)} alt={u.name} loading="lazy" />;
  if (u.kind === 'video') return <video src={blobUrl(u)} muted playsInline preload="metadata" />;
  return (
    <div className="audio">
      <Music size={22} />
      <span style={{ wordBreak: 'break-all' }}>{u.name.slice(0, 28)}</span>
    </div>
  );
}

export function UploadLibrary() {
  const req = useLibrary((s) => s.req);
  const close = useLibrary((s) => s.close);
  const uploads = useApp((s) => s.uploads);
  const addFiles = useApp((s) => s.addFiles);
  const deleteUpload = useApp((s) => s.deleteUpload);
  const clearUploads = useApp((s) => s.clearUploads);
  const [sel, setSel] = useState<string[]>([]);
  const [filter, setFilter] = useState<MediaKind | 'all'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSel([]);
    setFilter(req?.kinds.length === 1 ? req.kinds[0] : 'all');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, close]);

  if (!req) return null;
  const picking = !!req.onPick;
  const list = uploads.filter((u) => req.kinds.includes(u.kind) && (filter === 'all' || u.kind === filter));

  const toggle = (id: string) => {
    if (!picking) return;
    if (!req.multi) {
      req.onPick!([id]);
      close();
      return;
    }
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide" role="dialog" aria-label="Upload library">
        <div className="modal-head">
          <h3>{picking ? 'Choose from uploads' : 'Upload history'}</h3>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload
          </button>
          <button className="btn ghost icon sm" onClick={close} aria-label="Close">
            <X size={16} />
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept={req.kinds.map((k) => `${k}/*`).join(',')}
            onChange={async (e) => {
              const added = await addFiles(e.target.files || [], req.kinds);
              e.target.value = '';
              if (picking && req.multi) setSel((s) => [...s, ...added.map((a) => a.id)]);
            }}
          />
        </div>
        <div className="modal-body">
          {req.kinds.length > 1 && (
            <div className="tabs" style={{ alignSelf: 'flex-start' }}>
              {(['all', ...req.kinds] as const).map((k) => (
                <button key={k} className={cx(filter === k && 'on')} onClick={() => setFilter(k)}>
                  {k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1) + 's'}
                </button>
              ))}
            </div>
          )}
          {list.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: 40 }}>
              Nothing here yet. Files you upload are kept locally on this device so you can reuse them.
            </div>
          ) : (
            <div className="lib-grid">
              {list.map((u) => (
                <div
                  key={u.id}
                  className={cx('lib-item', sel.includes(u.id) && 'sel')}
                  onClick={() => toggle(u.id)}
                  title={`${u.name} · ${formatBytes(u.size)} · ${timeAgo(u.createdAt)}`}
                  style={{ cursor: picking ? 'pointer' : 'default' }}
                >
                  <UploadThumb u={u} />
                  {sel.includes(u.id) && (
                    <span className="chk">
                      <Check size={13} />
                    </span>
                  )}
                  <span className="badge">{u.width ? `${u.width}×${u.height}` : formatBytes(u.size)}</span>
                  <button
                    className="chip-btn del"
                    aria-label="Delete upload"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteUpload(u.id);
                      setSel((s) => s.filter((x) => x !== u.id));
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-foot">
          {!picking && uploads.length > 0 && (
            <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => confirmClear() && clearUploads()}>
              <Trash2 size={14} /> Clear all uploads
            </button>
          )}
          {picking && req.multi && (
            <>
              <span className="muted small" style={{ marginRight: 'auto', alignSelf: 'center' }}>{sel.length} selected</span>
              <button className="btn" onClick={close}>Cancel</button>
              <button
                className="btn primary"
                disabled={!sel.length}
                onClick={() => {
                  req.onPick!(sel);
                  close();
                }}
              >
                Add {sel.length || ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function confirmClear() {
  // window.confirm is fine here: it's a deliberate, destructive action.
  return window.confirm('Delete every upload stored on this device? Generation history is kept.');
}
