import { Eraser, Wand2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function PromptBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  enhancers,
  children,
  optional,
}: {
  value: string;
  onChange(v: string): void;
  onSubmit?(): void;
  placeholder: string;
  enhancers?: string[];
  children?: React.ReactNode;
  optional?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(260, Math.max(96, el.scrollHeight))}px`;
  }, [value]);

  const addEnhancer = () => {
    if (!enhancers?.length) return;
    const pick = enhancers.find((e) => !value.includes(e)) ?? enhancers[0];
    onChange(value.trim() ? `${value.trim().replace(/[,.]$/, '')}, ${pick}` : pick);
  };

  return (
    <div className="section">
      <div className="label">
        Prompt {optional && <span className="hint">optional</span>}
        <span className="hint">⌘/Ctrl + Enter to generate</span>
      </div>
      <div className="prompt-box">
        <textarea
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit?.();
            }
          }}
        />
        {children}
        <div className="prompt-foot">
          {enhancers && (
            <button className="btn ghost sm" onClick={addEnhancer} title="Append a quality booster">
              <Wand2 size={13} /> Enhance
            </button>
          )}
          {value && (
            <button className="btn ghost sm" onClick={() => onChange('')} title="Clear prompt">
              <Eraser size={13} />
            </button>
          )}
          <span className="counter">{value.length}</span>
        </div>
      </div>
    </div>
  );
}
