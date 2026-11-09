import { AudioLines, Check, ChevronDown, Film, Images, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isFeatured } from '../lib/catalog';
import type { ModelDef } from '../lib/types';
import { cx } from '../lib/util';

const vendor = (m: ModelDef) => m.id.split(/[-_.]/)[0];

export function ModelAvatar({ model, size = 36 }: { model: ModelDef; size?: number }) {
  const v = vendor(model);
  let h = 0;
  for (const c of v) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className="model-avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 50) % 360} 75% 45%))`,
        fontSize: size * 0.36,
      }}
    >
      {model.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
    </span>
  );
}

function Caps({ m }: { m: ModelDef }) {
  return (
    <span className="caps">
      {m.custom && <span className="tag">custom</span>}
      {m.inputs.image?.multi && (
        <span className="tag" title={`Up to ${m.inputs.image.max ?? 'many'} images`}>
          <Images size={10} style={{ verticalAlign: -1 }} /> {m.inputs.image.max ?? '∞'}
        </span>
      )}
      {m.inputs.endImage && <span className="tag" title="Start & end frame">end frame</span>}
      {m.params.some((p) => p.key === 'generate_audio' || p.key === 'enable_audio') && (
        <span className="tag" title="Can generate audio">
          <AudioLines size={10} style={{ verticalAlign: -1 }} />
        </span>
      )}
      {m.tier && <span className={cx('tier', m.tier)}>{m.tier}</span>}
    </span>
  );
}

export function ModelPicker({
  models,
  value,
  onChange,
  hiddenCount = 0,
  modeLabel,
}: {
  models: ModelDef[];
  value?: ModelDef;
  onChange: (id: string) => void;
  hiddenCount?: number;
  modeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="model-chip" onClick={() => setOpen(true)} disabled={!models.length}>
        {value ? <ModelAvatar model={value} /> : <span className="model-avatar" style={{ background: 'var(--surface-3)' }}><Film size={16} /></span>}
        <span style={{ minWidth: 0, flex: 1 }}>
          <div className="nm">{value?.name ?? 'No compatible model'}</div>
          <div className="sub">
            {value?.tier && <span className={cx('tier', value.tier)}>{value.tier}</span>}
            <span>{models.length} models{modeLabel ? ` · ${modeLabel}` : ''}</span>
          </div>
        </span>
        <ChevronDown size={16} className="muted" />
      </button>
      {hiddenCount > 0 && (
        <div className="small muted">{hiddenCount} single-image models hidden because you added several images.</div>
      )}
      {open && <PickerModal models={models} value={value} onClose={() => setOpen(false)} onPick={(id) => (onChange(id), setOpen(false))} />}
    </>
  );
}

function PickerModal({ models, value, onClose, onPick }: { models: ModelDef[]; value?: ModelDef; onClose(): void; onPick(id: string): void }) {
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return models.filter(
      (m) =>
        (tier === 'all' || m.tier === tier) &&
        terms.every((t) => `${m.name} ${m.id} ${m.description ?? ''}`.toLowerCase().includes(t)),
    );
  }, [models, q, tier]);

  const featured = !q && tier === 'all' ? filtered.filter((m) => isFeatured(m) || m.custom) : [];
  const rest = filtered.filter((m) => !featured.includes(m));

  const row = (m: ModelDef) => (
    <button key={m.id} className={cx('model-row', value?.id === m.id && 'on')} onClick={() => onPick(m.id)}>
      <ModelAvatar model={m} size={32} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <div className="nm">{m.name}</div>
        <div className="d">{m.description || m.id}</div>
      </span>
      <Caps m={m} />
      {value?.id === m.id && <Check size={16} color="var(--accent)" />}
    </button>
  );

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Choose a model">
        <div className="modal-head">
          <h3>Choose a model</h3>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ gap: 10 }}>
          <div className="search">
            <Search size={15} />
            <input ref={inputRef} className="input" placeholder={`Search ${models.length} models…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg">
            {['all', 'fast', 'balanced', 'best'].map((t) => (
              <button key={t} className={cx(tier === t && 'on')} onClick={() => setTier(t)}>
                {t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="model-list">
            {featured.length > 0 && (
              <>
                <div className="group-title">
                  <Sparkles size={11} style={{ verticalAlign: -1 }} /> Featured
                </div>
                {featured.map(row)}
                <div className="group-title">All models</div>
              </>
            )}
            {rest.map(row)}
            {!filtered.length && <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>No models match “{q}”.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
