import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { Feed } from '../components/Feed';
import { TopBar } from '../components/Shell';
import { USE_INPUT_EVENT, type UseInputDetail } from '../components/Viewer';
import type { ModelDef, StudioId } from '../lib/types';
import { useApp } from '../store/app';

export function StudioLayout({
  studio,
  title,
  mode,
  panel,
  empty,
}: {
  studio: StudioId;
  title: string;
  mode?: { label: string; media: boolean };
  panel: React.ReactNode;
  empty: React.ReactNode;
}) {
  return (
    <div className="main">
      <TopBar title={title} mode={mode} />
      <div className="workspace">
        <aside className="panel" aria-label="Controls">
          {panel}
        </aside>
        <Feed studio={studio} empty={empty} />
      </div>
    </div>
  );
}

export function GenerateBar({ onClick, reason, model, label = 'Generate' }: { onClick(): void; reason: string | null; model?: ModelDef; label?: string }) {
  const apiKey = useApp((s) => s.apiKey);
  const setSettings = useApp((s) => s.setSettingsOpen);
  const blocked = !apiKey ? 'Add your Muapi API key to start' : reason;
  return (
    <div className="generate">
      <button className="generate-btn" onClick={!apiKey ? () => setSettings(true) : onClick} disabled={!!apiKey && !!reason}>
        <Sparkles size={17} /> {!apiKey ? 'Connect Muapi' : label}
      </button>
      <div className="generate-sub">{blocked ?? (model ? `${model.name}${model.tier ? ` · ${model.tier}` : ''}` : '')}</div>
    </div>
  );
}

export function EmptyState({ icon, title, text, ideas, onIdea }: { icon: React.ReactNode; title: string; text: string; ideas?: string[]; onIdea?(s: string): void }) {
  return (
    <div className="empty">
      <div className="art">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {ideas && (
        <div className="ideas">
          {ideas.map((i) => (
            <button key={i} onClick={() => onIdea?.(i)}>
              {i.length > 48 ? `${i.slice(0, 46)}…` : i}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Receive outputs sent from the viewer's "Use as input". */
export function useIncomingInput(handler: (d: UseInputDetail) => void) {
  useEffect(() => {
    const fn = (e: Event) => handler((e as CustomEvent<UseInputDetail>).detail);
    window.addEventListener(USE_INPUT_EVENT, fn);
    return () => window.removeEventListener(USE_INPUT_EVENT, fn);
  });
}

export const IMAGE_ENHANCERS = ['highly detailed, sharp focus', 'soft natural lighting', 'award-winning photography', 'rich color, high dynamic range'];
export const VIDEO_ENHANCERS = ['smooth cinematic motion', 'natural physics, consistent subject', 'dynamic camera movement', 'high detail, 24fps film look'];
