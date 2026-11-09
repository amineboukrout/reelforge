import { ChevronRight, RotateCcw } from 'lucide-react';
import type { ParamDef } from '../lib/types';
import { cx } from '../lib/util';

const short = (v: unknown) => String(v).length <= 8;

export function ParamControl({ p, value, onChange }: { p: ParamDef; value: unknown; onChange(v: unknown): void }) {
  const label = (
    <div className="fl">
      <span title={p.help}>{p.label}</span>
      {(p.type === 'int' || p.type === 'number') && value !== undefined && <span className="muted">{String(value)}</span>}
    </div>
  );

  switch (p.type) {
    case 'enum': {
      const useSeg = p.options.length <= 7 && p.options.every(short);
      return (
        <div className="field">
          {label}
          {useSeg ? (
            <div className="seg" role="radiogroup" aria-label={p.label}>
              {p.options.map((o) => (
                <button key={String(o)} role="radio" aria-checked={value === o} className={cx(value === o && 'on')} onClick={() => onChange(o)}>
                  {formatOption(p.key, o)}
                </button>
              ))}
            </div>
          ) : (
            <select
              className="select"
              value={value === undefined ? '' : String(value)}
              onChange={(e) => {
                const o = p.options.find((x) => String(x) === e.target.value);
                onChange(o ?? undefined);
              }}
            >
              {value === undefined && <option value="">Default</option>}
              {p.options.map((o) => (
                <option key={String(o)} value={String(o)}>
                  {formatOption(p.key, o)}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }
    case 'bool':
      return (
        <label className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} title={p.help}>
          <span className="small" style={{ color: 'var(--text-2)' }}>{p.label}</span>
          <button role="switch" aria-checked={!!value} className={cx('toggle', !!value && 'on')} onClick={() => onChange(!value)} />
        </label>
      );
    case 'int':
    case 'number': {
      const bounded = p.min !== undefined && p.max !== undefined && p.max - p.min <= 1000;
      const step = p.step ?? (p.type === 'int' ? 1 : (p.max! - p.min!) / 100 || 0.01);
      return (
        <div className="field">
          {label}
          {bounded ? (
            <input
              className="range"
              type="range"
              min={p.min}
              max={p.max}
              step={step}
              value={Number(value ?? p.default ?? p.min)}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          ) : (
            <input
              className="input"
              type="number"
              min={p.min}
              max={p.max}
              placeholder={p.default !== undefined ? String(p.default) : 'Default'}
              value={value === undefined ? '' : String(value)}
              onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
            />
          )}
        </div>
      );
    }
    case 'string':
      return (
        <div className="field">
          {label}
          {p.multiline || /negative|prompt/.test(p.key) ? (
            <textarea className="textarea" rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={p.help} />
          ) : (
            <input className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={p.help?.slice(0, 60)} />
          )}
        </div>
      );
  }
}

function formatOption(key: string, o: string | number) {
  if (key === 'duration' && typeof o === 'number') return `${o}s`;
  if (key === 'num_images') return `×${o}`;
  return String(o);
}

export function ParamGroup({
  primary,
  advanced,
  values,
  onChange,
  onReset,
  extraAdvanced,
}: {
  primary: ParamDef[];
  advanced: ParamDef[];
  values: Record<string, unknown>;
  onChange(k: string, v: unknown): void;
  onReset?(): void;
  extraAdvanced?: React.ReactNode;
}) {
  return (
    <>
      {primary.map((p) => (
        <ParamControl key={p.key} p={p} value={values[p.key]} onChange={(v) => onChange(p.key, v)} />
      ))}
      {(advanced.length > 0 || extraAdvanced) && (
        <details className="details">
          <summary>
            <ChevronRight size={14} /> Advanced settings <span className="muted">({advanced.length})</span>
            {onReset && (
              <button
                className="btn ghost sm"
                style={{ marginLeft: 'auto' }}
                onClick={(e) => {
                  e.preventDefault();
                  onReset();
                }}
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </summary>
          <div className="body">
            {extraAdvanced}
            {advanced.map((p) => (
              <ParamControl key={p.key} p={p} value={values[p.key]} onChange={(v) => onChange(p.key, v)} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
