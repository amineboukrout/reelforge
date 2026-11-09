import { Mic2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MediaSlot } from '../components/Inputs';
import { ModelPicker } from '../components/ModelPicker';
import { ParamGroup } from '../components/ParamControls';
import { PromptBox } from '../components/PromptBox';
import { modelsFor } from '../lib/catalog';
import { cx } from '../lib/util';
import { useApp } from '../store/app';
import { EmptyState, GenerateBar, StudioLayout, useIncomingInput } from './common';
import { buildAttachments, cleanParams, defaultsFor, splitParams, validate } from './useEngine';

type Mode = 'avatar' | 'lipsync';
interface State {
  mode: Mode;
  visualId: string | null;
  audioId: string | null;
  prompt: string;
  modelByMode: Partial<Record<Mode, string>>;
  values: Record<string, Record<string, unknown>>;
}
const LS = 'reelforge.studio.lipsync';
const load = (): State => {
  const base: State = { mode: 'avatar', visualId: null, audioId: null, prompt: '', modelByMode: {}, values: {} };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(LS) || '{}') };
  } catch {
    return base;
  }
};

export function LipSyncStudio() {
  const catalog = useApp((s) => s.catalog);
  const uploads = useApp((s) => s.uploads);
  const generate = useApp((s) => s.generate);
  const [st, setSt] = useState<State>(load);
  useEffect(() => localStorage.setItem(LS, JSON.stringify(st)), [st]);

  const visual = uploads.find((u) => u.id === st.visualId);
  const audio = uploads.find((u) => u.id === st.audioId);
  // The visual input decides the mode: a still portrait → talking portrait, a clip → lip-sync.
  const mode: Mode = visual ? (visual.kind === 'video' ? 'lipsync' : 'avatar') : st.mode;

  const candidates = useMemo(
    () => modelsFor(catalog, [mode], (m) => (mode === 'avatar' ? !!m.inputs.image || !m.inputs.video : !!m.inputs.video)),
    [catalog, mode],
  );
  const model = candidates.find((m) => m.id === st.modelByMode[mode]) ?? candidates[0];
  const values = model ? { ...defaultsFor(model), ...(st.values[model.id] || {}) } : {};
  const { primary, advanced } = model ? splitParams(model.params) : { primary: [], advanced: [] };

  useIncomingInput((d) => setSt((s) => ({ ...s, visualId: d.uploadId })));

  const reason = (() => {
    if (!visual && (mode === 'lipsync' || model?.inputs.image?.required)) return mode === 'avatar' ? 'Add a portrait image' : 'Add a video';
    if (!audio) return 'Add an audio track';
    return validate(model, { prompt: st.prompt, images: visual?.kind === 'image' ? 1 : 0, audio: !!audio, video: visual?.kind === 'video', values });
  })();

  const submit = () => {
    if (reason || !model) return;
    generate({
      studio: 'lipsync',
      model,
      kind: 'video',
      prompt: st.prompt,
      params: cleanParams(model, values),
      attachments: buildAttachments(model, {
        images: visual?.kind === 'image' ? [visual.id] : [],
        audio: audio?.id,
        video: visual?.kind === 'video' ? visual.id : null,
      }),
    });
  };

  const setMode = (m: Mode) => setSt((s) => ({ ...s, mode: m, visualId: visual && (visual.kind === 'video') !== (m === 'lipsync') ? null : s.visualId }));

  return (
    <StudioLayout
      studio="lipsync"
      title="Lip Sync Studio"
      mode={{ label: mode === 'avatar' ? 'Talking portrait' : 'Lip-sync video', media: !!visual }}
      panel={
        <>
          <div className="tabs" style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button className={cx(mode === 'avatar' && 'on')} onClick={() => setMode('avatar')}>Talking portrait</button>
            <button className={cx(mode === 'lipsync' && 'on')} onClick={() => setMode('lipsync')}>Lip-sync a video</button>
          </div>
          <MediaSlot
            title={mode === 'avatar' ? 'Portrait' : 'Video'}
            kinds={['image', 'video']}
            id={st.visualId}
            onChange={(id) => setSt((s) => ({ ...s, visualId: id }))}
            hint={mode === 'avatar' ? 'A clear, front-facing face works best. Drop a video to switch to lip-sync.' : 'A clip with a visible face, up to 50 MB'}
          />
          <MediaSlot
            title="Voice / audio"
            kinds={['audio']}
            id={st.audioId}
            onChange={(id) => setSt((s) => ({ ...s, audioId: id }))}
            hint="mp3, wav, m4a… speech or singing"
            recordable
          />
          {model?.inputs.prompt && (
            <PromptBox
              value={st.prompt}
              onChange={(prompt) => setSt((s) => ({ ...s, prompt }))}
              onSubmit={submit}
              optional={!model.inputs.prompt.required}
              placeholder="Optional direction: emotion, gestures, setting… e.g. “smiles warmly, subtle head nods”"
            />
          )}
          <div className="section">
            <div className="label">Model</div>
            <ModelPicker
              models={candidates}
              value={model}
              onChange={(id) => setSt((s) => ({ ...s, modelByMode: { ...s.modelByMode, [mode]: id } }))}
              modeLabel={mode === 'avatar' ? 'portrait' : 'video'}
            />
          </div>
          {model && (
            <ParamGroup
              primary={primary}
              advanced={advanced}
              values={values}
              onChange={(k, v) => setSt((s) => ({ ...s, values: { ...s.values, [model.id]: { ...(s.values[model.id] || {}), [k]: v } } }))}
              onReset={() => setSt((s) => ({ ...s, values: { ...s.values, [model.id]: {} } }))}
            />
          )}
          <GenerateBar onClick={submit} reason={reason} model={model} label={mode === 'avatar' ? 'Animate portrait' : 'Sync lips'} />
        </>
      }
      empty={
        <EmptyState
          icon={<Mic2 size={32} color="white" />}
          title="Make it talk"
          text="Add a portrait and a voice track to create a talking head, or a video plus new audio to re-sync the lips. You can record audio right here."
        />
      }
    />
  );
}
