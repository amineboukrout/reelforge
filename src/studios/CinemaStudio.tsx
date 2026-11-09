import { Camera, Clapperboard, Film } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ImageTray } from '../components/Inputs';
import { ModelPicker } from '../components/ModelPicker';
import { ParamGroup } from '../components/ParamControls';
import {
  ANGLES, APERTURES, CAMERA_BODIES, CINE_ASPECTS, DEFAULT_RIG, FOCAL_STOPS, GRADES, LENSES, LIGHTING, MOVEMENTS, RIG_PRESETS, SHOTS,
  composeCinemaPrompt, modelAspectFor, rigToPrompt, type CameraRig,
} from '../lib/cinema';
import { cx } from '../lib/util';
import { PromptBox } from '../components/PromptBox';
import { useApp } from '../store/app';
import { EmptyState, GenerateBar, StudioLayout, useIncomingInput } from './common';
import { buildAttachments, cleanParams, splitParams, useEngine, validate, type EngineConfig } from './useEngine';

type Output = 'still' | 'motion';
const CFGS: Record<Output, EngineConfig> = {
  still: { key: 'cinema-still', studio: 'cinema', kind: 'image', textCats: ['t2i'], mediaCats: ['i2i'] },
  motion: { key: 'cinema-motion', studio: 'cinema', kind: 'video', textCats: ['t2v'], mediaCats: ['i2v'] },
};

const LS_RIG = 'reelforge.cinema.rig';
const LS_OUT = 'reelforge.cinema.output';

const loadRig = (): CameraRig => {
  try {
    return { ...DEFAULT_RIG, ...JSON.parse(localStorage.getItem(LS_RIG) || '{}') };
  } catch {
    return DEFAULT_RIG;
  }
};

/** Horizontal field of view for a full-frame (36mm) sensor. */
const fov = (mm: number) => Math.round((2 * Math.atan(36 / (2 * mm)) * 180) / Math.PI);

function LensViz({ focal, aperture }: { focal: number; aperture: number }) {
  // Wider aperture → bigger iris; longer lens → tighter ring stack.
  const iris = 18 + (1 - (Math.log(aperture) - Math.log(1.2)) / (Math.log(22) - Math.log(1.2))) * 52;
  const rings = [1, 2, 3, 4].map((i) => 30 + i * (14 + (300 - Math.min(focal, 300)) / 18));
  return (
    <div className="lens-viz" aria-hidden>
      {rings.map((r) => (
        <span key={r} className="ring" style={{ width: r, height: r }} />
      ))}
      <span className="iris" style={{ width: iris, height: iris }} />
      <span className="fl">{focal}mm · f/{aperture}</span>
      <span className="fov">{fov(focal)}° FOV</span>
    </div>
  );
}

function Picker<T extends { id: string; label: string }>({ items, value, onChange }: { items: T[]; value: string; onChange(id: string): void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

export function CinemaStudio() {
  const [output, setOutput] = useState<Output>(() => (localStorage.getItem(LS_OUT) as Output) || 'motion');
  const [rig, setRigState] = useState<CameraRig>(loadRig);
  useEffect(() => localStorage.setItem(LS_RIG, JSON.stringify(rig)), [rig]);
  useEffect(() => localStorage.setItem(LS_OUT, output), [output]);
  const setRig = (p: Partial<CameraRig>) => setRigState((r) => ({ ...r, ...p }));

  const cfg = CFGS[output];
  const e = useEngine(cfg);
  const generate = useApp((s) => s.generate);
  useIncomingInput((d) => d.kind === 'image' && e.addImages([d.uploadId]));
  const motion = output === 'motion';

  // Map the cinematic aspect onto the model's own aspect_ratio option, if any.
  const aspectParam = e.model?.params.find((p) => p.key === 'aspect_ratio');
  const mappedAspect = aspectParam?.type === 'enum' ? modelAspectFor(rig.aspect, aspectParam.options) : undefined;
  const values = mappedAspect ? { ...e.values, aspect_ratio: mappedAspect } : e.values;

  const reason = validate(e.model, { prompt: e.prompt, images: e.imageIds.length, values });
  const { primary, advanced } = e.model ? splitParams(e.model.params.filter((p) => !(mappedAspect && p.key === 'aspect_ratio'))) : { primary: [], advanced: [] };

  const submit = () => {
    if (reason || !e.model) return;
    generate({
      studio: 'cinema',
      model: e.model,
      kind: cfg.kind,
      prompt: e.prompt,
      sentPrompt: composeCinemaPrompt(e.prompt || 'A cinematic scene', rig, motion),
      params: cleanParams(e.model, values),
      attachments: buildAttachments(e.model, { images: e.imageIds }),
    });
  };

  return (
    <StudioLayout
      studio="cinema"
      title="Cinema Studio"
      mode={{ label: `${motion ? 'Motion' : 'Still'} · ${e.mode === 'media' ? 'from image' : 'from text'}`, media: e.mode === 'media' }}
      panel={
        <>
          <div className="tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button className={cx(output === 'still' && 'on')} onClick={() => setOutput('still')}>
              <Camera size={13} style={{ verticalAlign: -2 }} /> Still frame
            </button>
            <button className={cx(output === 'motion' && 'on')} onClick={() => setOutput('motion')}>
              <Film size={13} style={{ verticalAlign: -2 }} /> Motion shot
            </button>
          </div>

          <PromptBox value={e.prompt} onChange={e.setPrompt} onSubmit={submit} placeholder="Describe the scene and the action. The camera rig below adds the cinematography." />

          <div className="section">
            <div className="label">Look presets</div>
            <div className="preset-row">
              {RIG_PRESETS.map((p) => (
                <button key={p.id} onClick={() => setRig({ ...DEFAULT_RIG, ...p.rig })}>{p.label}</button>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="label">Camera &amp; lens</div>
            <Picker items={CAMERA_BODIES} value={rig.body} onChange={(body) => setRig({ body })} />
            <div className="seg">
              {LENSES.map((l) => (
                <button key={l.id} className={cx(rig.lens === l.id && 'on')} onClick={() => setRig({ lens: l.id })}>{l.label}</button>
              ))}
            </div>
            <LensViz focal={rig.focal} aperture={rig.aperture} />
          </div>

          <div className="section">
            <div className="label">Focal length <span className="hint">{fov(rig.focal)}° horizontal</span></div>
            <div className="dial" role="radiogroup" aria-label="Focal length">
              {FOCAL_STOPS.map((f) => (
                <button key={f} role="radio" aria-checked={rig.focal === f} className={cx(rig.focal === f && 'on')} onClick={() => setRig({ focal: f })}>
                  {f}<small>MM</small>
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="label">Aperture <span className="hint">{rig.aperture <= 2.8 ? 'shallow focus' : rig.aperture >= 8 ? 'deep focus' : 'balanced'}</span></div>
            <div className="dial" role="radiogroup" aria-label="Aperture">
              {APERTURES.map((a) => (
                <button key={a} role="radio" aria-checked={rig.aperture === a} className={cx(rig.aperture === a && 'on')} onClick={() => setRig({ aperture: a })}>
                  {a}<small>F/</small>
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="label">Framing</div>
            <div className="row">
              <div className="grow"><Picker items={SHOTS} value={rig.shot} onChange={(shot) => setRig({ shot })} /></div>
              <div className="grow"><Picker items={ANGLES} value={rig.angle} onChange={(angle) => setRig({ angle })} /></div>
            </div>
            <div className="seg">
              {CINE_ASPECTS.map((a) => (
                <button key={a.id} className={cx(rig.aspect === a.id && 'on')} onClick={() => setRig({ aspect: a.id })}>{a.label}</button>
              ))}
            </div>
          </div>

          {motion && (
            <div className="section">
              <div className="label">Camera movement</div>
              <div className="seg">
                {MOVEMENTS.map((m) => (
                  <button key={m.id} className={cx(rig.movement === m.id && 'on')} onClick={() => setRig({ movement: m.id })}>{m.label}</button>
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <div className="label">Light &amp; color</div>
            <div className="row">
              <div className="grow"><Picker items={LIGHTING} value={rig.lighting} onChange={(lighting) => setRig({ lighting })} /></div>
              <div className="grow"><Picker items={GRADES} value={rig.grade} onChange={(grade) => setRig({ grade })} /></div>
            </div>
            <div className="field">
              <div className="fl"><span>Film grain</span><span className="muted">{['None', 'Subtle', 'Visible', 'Heavy'][rig.grain]}</span></div>
              <input className="range" type="range" min={0} max={3} step={1} value={rig.grain} onChange={(ev) => setRig({ grain: Number(ev.target.value) })} />
            </div>
          </div>

          <div className="rig-preview">
            <b>Camera language:</b> {rigToPrompt(rig, motion)}
          </div>

          <ImageTray ids={e.imageIds} max={14} onAdd={e.addImages} onRemove={e.removeImage} onMove={e.moveImage} title={motion ? 'Start frame' : 'Reference images'} />

          <div className="section">
            <div className="label">Model</div>
            <ModelPicker models={e.candidates} value={e.model} onChange={e.setModel} hiddenCount={e.hiddenCount} />
          </div>
          {e.model && <ParamGroup primary={primary} advanced={advanced} values={values} onChange={e.setValue} onReset={e.resetValues} />}
          <GenerateBar onClick={submit} reason={reason} model={e.model} label={motion ? 'Roll camera' : 'Capture still'} />
        </>
      }
      empty={
        <EmptyState
          icon={<Clapperboard size={32} color="white" />}
          title="Direct the shot"
          text="Pick a camera, lens, focal length and aperture like on set. Reelforge turns your rig into cinematographic direction for the model."
          ideas={['A detective lights a cigarette in a rain-soaked alley', 'A lone rider crosses a salt flat at dawn', 'Two strangers lock eyes across a crowded night market']}
          onIdea={e.setPrompt}
        />
      }
    />
  );
}
