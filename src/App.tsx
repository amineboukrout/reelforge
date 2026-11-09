import { useEffect } from 'react';
import { Settings } from './components/Settings';
import { BottomNav, Rail } from './components/Shell';
import { Toasts } from './components/Toasts';
import { UploadLibrary } from './components/UploadLibrary';
import { Viewer } from './components/Viewer';
import { useApp } from './store/app';
import { CinemaStudio } from './studios/CinemaStudio';
import { ImageStudio } from './studios/ImageStudio';
import { LipSyncStudio } from './studios/LipSyncStudio';
import { VideoStudio } from './studios/VideoStudio';

export function App() {
  const ready = useApp((s) => s.ready);
  const studio = useApp((s) => s.studio);
  const init = useApp((s) => s.init);
  const setStudio = useApp((s) => s.setStudio);

  useEffect(() => {
    init();
    const onHash = () => {
      const id = location.hash.replace('#/', '');
      if (['image', 'video', 'lipsync', 'cinema'].includes(id)) setStudio(id as never);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [init, setStudio]);

  if (!ready) return null;

  return (
    <div className="shell">
      <Rail />
      {studio === 'image' && <ImageStudio />}
      {studio === 'video' && <VideoStudio />}
      {studio === 'lipsync' && <LipSyncStudio />}
      {studio === 'cinema' && <CinemaStudio />}
      <BottomNav />
      <Viewer />
      <UploadLibrary />
      <Settings />
      <Toasts />
    </div>
  );
}
