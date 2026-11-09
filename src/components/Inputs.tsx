import { FolderOpen, ImagePlus, Mic, Music, Plus, Square, Upload, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MediaKind, UploadRecord } from '../lib/types';
import { cx, formatBytes } from '../lib/util';
import { blobUrl, useApp } from '../store/app';
import { useLibrary } from './UploadLibrary';

function useDrop(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

/**
 * Multi-image tray. Adding an image flips the studio into upload mode.
 * Supports drag-and-drop, paste (Ctrl/⌘+V), library picking and reordering.
 */
export function ImageTray({
  ids,
  max,
  onAdd,
  onRemove,
  onMove,
  title = 'Reference images',
  hint,
  pasteTarget = true,
}: {
  ids: string[];
  max: number;
  onAdd(ids: string[]): void;
  onRemove(id: string): void;
  onMove?(from: number, to: number): void;
  title?: string;
  hint?: string;
  pasteTarget?: boolean;
}) {
  const uploads = useApp((s) => s.uploads);
  const addFiles = useApp((s) => s.addFiles);
  const openLib = useLibrary((s) => s.open);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const items = ids.map((id) => uploads.find((u) => u.id === id)).filter(Boolean) as UploadRecord[];

  const handleFiles = async (files: File[]) => {
    const added = await addFiles(files, ['image']);
    if (added.length) onAdd(added.map((a) => a.id));
  };
  const drop = useDrop(handleFiles);

  useEffect(() => {
    if (!pasteTarget) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        handleFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const input = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        handleFiles(Array.from(e.target.files || []));
        e.target.value = '';
      }}
    />
  );

  return (
    <div className="section">
      <div className="label">
        {title}
        <span className="row" style={{ gap: 2 }}>
          {items.length > 0 && <span className="hint">{items.length}{max > 1 ? ` / ${max}` : ''}</span>}
          <button className="btn ghost sm" onClick={() => openLib({ kinds: ['image'], multi: true, onPick: onAdd })}>
            <FolderOpen size={13} /> Library
          </button>
        </span>
      </div>
      {input}
      {items.length === 0 ? (
        <button className={cx('drop', drop.over && 'over')} onClick={() => fileRef.current?.click()} {...drop.props}>
          <ImagePlus size={20} />
          <span className="t">Drop, paste or browse images</span>
          <span className="s">{hint ?? 'Optional — adding an image switches to image-input models'}</span>
        </button>
      ) : (
        <div className="thumbs" {...drop.props}>
          {items.map((u, i) => (
            <div
              key={u.id}
              className="thumb"
              draggable={!!onMove}
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                if (dragIdx !== null && onMove && !e.dataTransfer.files.length) {
                  e.stopPropagation();
                  onMove(dragIdx, i);
                }
                setDragIdx(null);
              }}
            >
              <img src={blobUrl(u)} alt={u.name} />
              {items.length > 1 && <span className="n">@{i + 1}</span>}
              <button className="x" onClick={() => onRemove(u.id)} aria-label="Remove image">
                <X size={12} />
              </button>
            </div>
          ))}
          {items.length < max && (
            <button className={cx('thumb add', drop.over && 'over')} onClick={() => fileRef.current?.click()} aria-label="Add image">
              <Plus size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const ICON = { image: ImagePlus, video: Video, audio: Music } as const;

/** A single-file slot (portrait, driving video, audio track, end frame). */
export function MediaSlot({
  title,
  kinds,
  id,
  onChange,
  hint,
  recordable,
  optional,
}: {
  title: string;
  kinds: MediaKind[];
  id: string | null;
  onChange(id: string | null): void;
  hint?: string;
  recordable?: boolean;
  optional?: boolean;
}) {
  const uploads = useApp((s) => s.uploads);
  const addFiles = useApp((s) => s.addFiles);
  const toast = useApp((s) => s.toast);
  const openLib = useLibrary((s) => s.open);
  const fileRef = useRef<HTMLInputElement>(null);
  const u = id ? uploads.find((x) => x.id === id) : undefined;
  const handle = async (files: File[]) => {
    const [a] = await addFiles(files.slice(0, 1), kinds);
    if (a) onChange(a.id);
  };
  const drop = useDrop(handle);
  const Icon = ICON[kinds[0]];

  // --- microphone recording
  const [rec, setRec] = useState<{ mr: MediaRecorder; started: number } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [rec]);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        await handle([new File(chunks, `recording-${Date.now()}.${ext}`, { type })]);
      };
      mr.start();
      setRec({ mr, started: Date.now() });
    } catch {
      toast('error', 'Microphone access was denied.');
    }
  };
  const stopRec = () => {
    rec?.mr.stop();
    setRec(null);
  };

  return (
    <div className="section">
      <div className="label">
        {title} {optional && <span className="hint">optional</span>}
        <button className="btn ghost sm" onClick={() => openLib({ kinds, multi: false, onPick: ([x]) => onChange(x) })}>
          <FolderOpen size={13} /> Library
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={kinds.map((k) => `${k}/*`).join(',')}
        onChange={(e) => {
          handle(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
      {u ? (
        u.kind === 'audio' ? (
          <div className="file-chip">
            <Music size={18} className="muted" />
            <div className="meta">
              <div className="name">{u.name}</div>
              <audio src={blobUrl(u)} controls preload="metadata" />
            </div>
            <button className="btn ghost icon sm" onClick={() => onChange(null)} aria-label="Remove">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="file-chip" style={{ padding: 8 }}>
            <div style={{ width: 84, height: 84, borderRadius: 9, overflow: 'hidden', flex: 'none', background: 'var(--surface-2)' }}>
              {u.kind === 'image' ? (
                <img src={blobUrl(u)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={blobUrl(u)} muted playsInline autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div className="meta">
              <div className="name">{u.name}</div>
              <div className="small muted">
                {u.kind} · {u.width ? `${u.width}×${u.height} · ` : ''}
                {formatBytes(u.size)}
              </div>
            </div>
            <button className="btn ghost icon sm" onClick={() => onChange(null)} aria-label="Remove">
              <X size={14} />
            </button>
          </div>
        )
      ) : rec ? (
        <button className="drop over" onClick={stopRec}>
          <Square size={18} color="var(--err)" fill="var(--err)" />
          <span className="t">Recording… {((Date.now() - rec.started) / 1000).toFixed(1)}s</span>
          <span className="s">Tap to stop</span>
        </button>
      ) : (
        <div className="row" style={{ alignItems: 'stretch' }}>
          <button className={cx('drop', drop.over && 'over')} onClick={() => fileRef.current?.click()} {...drop.props}>
            {kinds.length > 1 ? <Upload size={20} /> : <Icon size={20} />}
            <span className="t">Drop or browse {kinds.join(' / ')}</span>
            {hint && <span className="s">{hint}</span>}
          </button>
          {recordable && (
            <button className="drop" style={{ width: 92, flex: 'none' }} onClick={startRec} title="Record from microphone">
              <Mic size={20} />
              <span className="t">Record</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
