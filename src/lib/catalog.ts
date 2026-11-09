// Model catalog = generated Muapi models + user custom models.
//
// Custom models can come from:
//   1. public/models.custom.json (self-hosters: edit, no rebuild needed)
//   2. Settings → Custom models (stored in localStorage)
// A custom model with the same id as a generated one overrides it.

import generated from '../catalog/models.generated.json';
import type { Category, ModelDef } from './types';

const LS_CUSTOM = 'reelforge.customModels';

/** Ordering hints: models matching earlier patterns float to the top and become defaults. */
const FEATURED: Record<Category, string[]> = {
  t2i: ['nano-banana-pro', 'gpt-image-2-text', 'seedream-5.0-pro', 'flux-2-pro', 'midjourney-v8', 'ideogram-v4', 'google-imagen4-ultra', 'qwen-image-2.0-pro', 'reve-text', 'flux-dev-image'],
  i2i: ['nano-banana-pro-edit', 'gpt-image-2-image-to-image', 'seedream-5.0-pro-edit', 'flux-kontext-max-i2i', 'flux-2-pro-edit', 'qwen-image-edit-plus', 'nano-banana-edit', 'reve-image-edit'],
  t2v: ['veo3.1-text-to-video', 'kling-v3.0-pro-text-to-video', 'seedance-2.5-text-to-video', 'openai-sora-2-pro-text-to-video', 'wan3.0-text-to-video', 'minimax-hailuo-2.3-pro-t2v', 'veo3.1-fast-text-to-video', 'ltx-2.5-text-to-video'],
  i2v: ['veo3.1-image-to-video', 'kling-v3.0-pro-image-to-video', 'seedance-2.5-image-to-video', 'openai-sora-2-pro-image-to-video', 'wan3.0-image-to-video', 'minimax-hailuo-2.3-pro-i2v', 'veo3.1-fast-image-to-video', 'vidu-q3-pro-image-to-video'],
  avatar: ['omnihuman-2-0', 'kling-v2-avatar-pro', 'omnihuman-1-5', 'infinitetalk-image-to-video', 'ltx-2.3-lipsync'],
  lipsync: ['sync-lipsync', 'latentsync-video', 'infinitetalk-video-to-video', 'creatify-lipsync'],
  enhance: ['topaz-image-upscale', 'seedvr2-image-upscale', 'ai-image-upscale', 'ai-background-remover'],
};

export function loadLocalCustomModels(): ModelDef[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_CUSTOM) || '[]');
    return Array.isArray(raw) ? raw.map((m) => ({ ...m, custom: true })) : [];
  } catch {
    return [];
  }
}

export function saveLocalCustomModels(models: ModelDef[]) {
  localStorage.setItem(LS_CUSTOM, JSON.stringify(models.map(({ custom: _c, ...m }) => m)));
}

export async function loadFileCustomModels(): Promise<ModelDef[]> {
  try {
    const r = await fetch('./models.custom.json', { cache: 'no-store' });
    if (!r.ok) return [];
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.models;
    return Array.isArray(list) ? list.filter(isValidModel).map((m: ModelDef) => ({ ...m, custom: true })) : [];
  } catch {
    return [];
  }
}

const CATEGORIES: Category[] = ['t2i', 'i2i', 't2v', 'i2v', 'avatar', 'lipsync', 'enhance'];

export function isValidModel(m: any): m is ModelDef {
  return (
    m && typeof m.id === 'string' && /^[\w.\-/]+$/.test(m.id) && typeof m.name === 'string' &&
    CATEGORIES.includes(m.category) && typeof m.inputs === 'object' && Array.isArray(m.params ?? [])
  );
}

export function validateModelJson(text: string): { ok: true; models: ModelDef[] } | { ok: false; error: string } {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const list = Array.isArray(data) ? data : [data];
  for (const m of list) {
    m.params ??= [];
    m.inputs ??= {};
    if (!isValidModel(m)) {
      return { ok: false, error: `Model "${m?.id ?? '?'}" needs id, name, category (${CATEGORIES.join(', ')}), inputs and params.` };
    }
  }
  return { ok: true, models: list };
}

export function buildCatalog(custom: ModelDef[]): ModelDef[] {
  const byId = new Map<string, ModelDef>();
  for (const m of (generated as { models: ModelDef[] }).models) byId.set(m.id, m);
  for (const m of custom) byId.set(m.id, { ...m, params: m.params ?? [], custom: true });
  return [...byId.values()];
}

function rank(m: ModelDef): number {
  const list = FEATURED[m.category] || [];
  const i = list.findIndex((p) => m.id === p || m.id.startsWith(p));
  return i === -1 ? 1000 : i;
}

export function modelsFor(catalog: ModelDef[], cats: Category[], filter?: (m: ModelDef) => boolean): ModelDef[] {
  return catalog
    .filter((m) => cats.includes(m.category) && (!filter || filter(m)))
    .sort(
      (a, b) =>
        Number(!!b.custom) - Number(!!a.custom) ||
        cats.indexOf(a.category) - cats.indexOf(b.category) ||
        rank(a) - rank(b) ||
        a.name.localeCompare(b.name),
    );
}

export const isFeatured = (m: ModelDef) => rank(m) < 1000;

export const generatedAt = (generated as { generatedAt: string }).generatedAt;
export const generatedCount = (generated as { models: ModelDef[] }).models.length;

/** Template shown in Settings when adding a custom model. */
export const CUSTOM_MODEL_TEMPLATE = JSON.stringify(
  {
    id: 'my-new-model-endpoint',
    name: 'My New Model',
    category: 'i2v',
    tier: 'best',
    inputs: {
      prompt: { field: 'prompt', required: true },
      image: { field: 'images_list', multi: true, max: 4, required: true },
    },
    params: [
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'enum', options: ['16:9', '9:16', '1:1'], default: '16:9' },
      { key: 'duration', label: 'Duration', type: 'enum', options: [5, 10], default: 5 },
      { key: 'seed', label: 'Seed', type: 'int', min: -1, default: -1 },
    ],
  },
  null,
  2,
);
