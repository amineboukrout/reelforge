import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../store/app';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon size={17} style={{ flex: 'none', marginTop: 1 }} />
            <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="muted">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
