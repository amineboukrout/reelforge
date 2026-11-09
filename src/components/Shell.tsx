import { Aperture, Clapperboard, FolderOpen, Image as ImageIcon, KeyRound, Mic2, Settings as Cog, Video, Wallet } from 'lucide-react';
import type { StudioId } from '../lib/types';
import { cx } from '../lib/util';
import { useApp } from '../store/app';
import { useLibrary } from './UploadLibrary';

export const STUDIOS: { id: StudioId; label: string; icon: typeof ImageIcon; title: string }[] = [
  { id: 'image', label: 'Image', icon: ImageIcon, title: 'Image Studio' },
  { id: 'video', label: 'Video', icon: Video, title: 'Video Studio' },
  { id: 'lipsync', label: 'Lip Sync', icon: Mic2, title: 'Lip Sync Studio' },
  { id: 'cinema', label: 'Cinema', icon: Clapperboard, title: 'Cinema Studio' },
];

export function Rail() {
  const studio = useApp((s) => s.studio);
  const setStudio = useApp((s) => s.setStudio);
  const setSettings = useApp((s) => s.setSettingsOpen);
  const openLib = useLibrary((s) => s.open);
  return (
    <nav className="rail" aria-label="Studios">
      <div className="logo" title="Reelforge">
        <Aperture size={22} color="white" />
      </div>
      {STUDIOS.map((s) => (
        <button key={s.id} className={cx('rail-btn', studio === s.id && 'active')} onClick={() => setStudio(s.id)} aria-current={studio === s.id}>
          <s.icon size={20} />
          {s.label}
        </button>
      ))}
      <div className="rail-spacer" />
      <button className="rail-btn" onClick={() => openLib({ kinds: ['image', 'video', 'audio'], multi: false })}>
        <FolderOpen size={19} />
        Uploads
      </button>
      <button className="rail-btn" onClick={() => setSettings(true)}>
        <Cog size={19} />
        Settings
      </button>
    </nav>
  );
}

export function BottomNav() {
  const studio = useApp((s) => s.studio);
  const setStudio = useApp((s) => s.setStudio);
  const setSettings = useApp((s) => s.setSettingsOpen);
  return (
    <nav className="bottom-nav" aria-label="Studios">
      {STUDIOS.map((s) => (
        <button key={s.id} className={cx(studio === s.id && 'active')} onClick={() => (setStudio(s.id), window.scrollTo({ top: 0 }))}>
          <s.icon size={20} />
          {s.label}
        </button>
      ))}
      <button onClick={() => setSettings(true)}>
        <Cog size={20} />
        Settings
      </button>
    </nav>
  );
}

export function TopBar({ title, mode }: { title: string; mode?: { label: string; media: boolean } }) {
  const balance = useApp((s) => s.balance);
  const apiKey = useApp((s) => s.apiKey);
  const setSettings = useApp((s) => s.setSettingsOpen);
  const openLib = useLibrary((s) => s.open);
  return (
    <header className="topbar">
      <div className="logo mobile-only" style={{ width: 30, height: 30, borderRadius: 9, margin: 0 }}>
        <Aperture size={17} color="white" />
      </div>
      <h1>{title}</h1>
      {mode && (
        <span className={cx('mode-badge', mode.media && 'media')} key={mode.label}>
          {mode.label}
        </span>
      )}
      <span className="grow" />
      <button className="btn ghost sm icon mobile-only" onClick={() => openLib({ kinds: ['image', 'video', 'audio'], multi: false })} aria-label="Uploads">
        <FolderOpen size={16} />
      </button>
      {apiKey ? (
        balance !== null && (
          <span className="balance" title="Muapi balance">
            <Wallet size={13} /> {balance}
          </span>
        )
      ) : (
        <button className="btn sm primary" onClick={() => setSettings(true)}>
          <KeyRound size={13} /> <span className="desktop-only">Add API key</span><span className="mobile-only">Key</span>
        </button>
      )}
    </header>
  );
}
