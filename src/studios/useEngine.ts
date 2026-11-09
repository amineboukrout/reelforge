import { useEffect, useMemo, useState } from 'react';
import { modelsFor } from '../lib/catalog';
import type { Category, ModelDef, ParamDef, StudioId } from '../lib/types';
import { useApp, type Attachment } from '../store/app';

/**
 * Shared studio logic.
 *
 * - "text" mode when no visual input is attached, "media" mode otherwise. The
 *   model list switches automatically and the last choice per mode is kept.
 * - With 2+ images only multi-image models are offered.
 * - Parameter values are remembered per model.
 */
export interface EngineConfig {
  key: string; // persistence key, e.g. 'image' or 'cinema-motion'
  studio: StudioId;
  kind: 'image' | 'video';
  textCats: Category[];
  mediaCats: Category[];
}

interface Persisted {
  prompt: string;
  imageIds: string[];
  endImageId: string | null;
  modelByMode: { text?: string; media?: string };
  values: Record<string, Record<string, unknown>>;
}

const load = (key: string): Persisted => {
  const base: Persisted = { prompt: '', imageIds: [], endImageId: null, modelByMode: {}, values: {} };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(`reelforge.studio.${key}`) || '{}') };
  } catch {
    return base;
  }
};

export function defaultsFor(model: ModelDef): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const p of model.params) if (p.default !== undefined) v[p.key] = p.default;
  return v;
}

export function useEngine(cfg: EngineConfig) {
  const catalog = useApp((s) => s.catalog);
  const uploads = useApp((s) => s.uploads);
  const [state, setState] = useState<Persisted>(() => load(cfg.key));

  // Reload state when the persistence key changes (Cinema still ↔ motion).
  useEffect(() => setState(load(cfg.key)), [cfg.key]);
  useEffect(() => {
    localStorage.setItem(`reelforge.studio.${cfg.key}`, JSON.stringify(state));
  }, [cfg.key, state]);

  // Drop references to uploads that were deleted from the library.
  const uploadIds = useMemo(() => new Set(uploads.map((u) => u.id)), [uploads]);
  const imageIds = state.imageIds.filter((id) => uploadIds.has(id));
  const endImageId = state.endImageId && uploadIds.has(state.endImageId) ? state.endImageId : null;

  const mode: 'text' | 'media' = imageIds.length > 0 ? 'media' : 'text';

  const { candidates, hiddenCount } = useMemo(() => {
    if (mode === 'text') {
      return { candidates: modelsFor(catalog, cfg.textCats, (m) => !m.inputs.image?.required), hiddenCount: 0 };
    }
    const all = modelsFor(catalog, [...cfg.mediaCats, ...cfg.textCats], (m) => !!m.inputs.image);
    const n = imageIds.length;
    const ok = all.filter((m) => (n === 1 ? true : !!m.inputs.image?.multi && (!m.inputs.image.max || m.inputs.image.max >= n)));
    return { candidates: ok, hiddenCount: all.length - ok.length };
  }, [catalog, mode, imageIds.length, cfg.textCats, cfg.mediaCats]);

  const chosenId = state.modelByMode[mode];
  const model = candidates.find((m) => m.id === chosenId) ?? candidates[0];

  const values = useMemo(() => (model ? { ...defaultsFor(model), ...(state.values[model.id] || {}) } : {}), [model, state.values]);

  const set = (patch: Partial<Persisted>) => setState((s) => ({ ...s, ...patch }));

  const api = {
    mode,
    model,
    candidates,
    hiddenCount,
    prompt: state.prompt,
    imageIds,
    endImageId,
    values,
    setPrompt: (prompt: string) => set({ prompt }),
    setModel: (id: string) => setState((s) => ({ ...s, modelByMode: { ...s.modelByMode, [mode]: id } })),
    setValue: (key: string, value: unknown) =>
      model &&
      setState((s) => ({ ...s, values: { ...s.values, [model.id]: { ...(s.values[model.id] || {}), [key]: value } } })),
    resetValues: () => model && setState((s) => ({ ...s, values: { ...s.values, [model.id]: {} } })),
    addImages: (ids: string[]) => setState((s) => ({ ...s, imageIds: [...s.imageIds.filter((x) => uploadIds.has(x)), ...ids].slice(0, 14) })),
    removeImage: (id: string) => setState((s) => ({ ...s, imageIds: s.imageIds.filter((x) => x !== id) })),
    moveImage: (from: number, to: number) =>
      setState((s) => {
        const a = s.imageIds.filter((x) => uploadIds.has(x));
        const [it] = a.splice(from, 1);
        a.splice(to, 0, it);
        return { ...s, imageIds: a };
      }),
    clearImages: () => set({ imageIds: [], endImageId: null }),
    setEndImage: (id: string | null) => set({ endImageId: id }),
  };
  return api;
}

export type Engine = ReturnType<typeof useEngine>;

/** Splits params into the few shown as quick chips and the rest. */
const PRIMARY = ['aspect_ratio', 'resolution', 'duration', 'num_images', 'quality', 'image_size', 'size'];
export function splitParams(params: ParamDef[]) {
  const primary = params.filter((p) => PRIMARY.includes(p.key)).sort((a, b) => PRIMARY.indexOf(a.key) - PRIMARY.indexOf(b.key));
  const advanced = params.filter((p) => !PRIMARY.includes(p.key));
  return { primary, advanced };
}

export function cleanParams(model: ModelDef, values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const p of model.params) {
    const v = values[p.key];
    if (v === undefined || v === null || v === '') continue;
    if ((p.type === 'int' || p.type === 'number') && typeof v === 'string') {
      const n = Number(v);
      if (!Number.isNaN(n)) out[p.key] = p.type === 'int' ? Math.round(n) : n;
      continue;
    }
    out[p.key] = v;
  }
  return out;
}

/** Returns a human-readable reason the request can't be sent, or null. */
export function validate(
  model: ModelDef | undefined,
  opts: { prompt: string; images: number; endImage?: boolean; audio?: boolean; video?: boolean; values: Record<string, unknown> },
): string | null {
  if (!model) return 'No compatible model';
  const i = model.inputs;
  if (i.prompt?.required && !opts.prompt.trim()) return 'Write a prompt';
  if (i.image?.required && opts.images === 0) return 'Add an image';
  if (i.image?.min && opts.images < i.image.min) return `Add at least ${i.image.min} images`;
  if (i.endImage?.required && !opts.endImage) return 'Add an end frame';
  if (i.audio?.required && !opts.audio) return 'Add audio';
  if (i.video?.required && !opts.video) return 'Add a video';
  if (!i.prompt && !i.image && !i.audio && !i.video) return null;
  for (const p of model.params) {
    if (p.required && (opts.values[p.key] === undefined || opts.values[p.key] === '')) return `Set ${p.label}`;
  }
  return null;
}

/** Builds attachments in canonical order: image, endImage, audio, video (retry relies on it). */
export function buildAttachments(
  model: ModelDef,
  ids: { images?: string[]; endImage?: string | null; audio?: string | null; video?: string | null },
): Attachment[] {
  const a: Attachment[] = [];
  const i = model.inputs;
  if (i.image && ids.images?.length) {
    a.push({ field: i.image.field, uploadIds: i.image.multi ? ids.images.slice(0, i.image.max || 14) : ids.images.slice(0, 1), multi: !!i.image.multi });
  }
  if (i.endImage && ids.endImage) a.push({ field: i.endImage.field, uploadIds: [ids.endImage], multi: false });
  if (i.audio && ids.audio) a.push({ field: i.audio.field, uploadIds: [ids.audio], multi: false });
  if (i.video && ids.video) a.push({ field: i.video.field, uploadIds: [ids.video], multi: false });
  return a;
}
