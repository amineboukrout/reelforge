import { create } from 'zustand';
import { buildCatalog, loadFileCustomModels, loadLocalCustomModels, saveLocalCustomModels } from '../lib/catalog';
import { db } from '../lib/db';
import { keystore } from '../lib/keystore';
import { muapi, normalizeOutputs, readBalance, waitForResult } from '../lib/muapi';
import type { Generation, MediaKind, ModelDef, StudioId, UploadRecord } from '../lib/types';
import { kindOfFile, uid, uploadLimitError } from '../lib/util';

// Presigned upload URLs expire after ~1h; re-upload the local blob after 50 min.
const REMOTE_TTL = 50 * 60 * 1000;

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'error';
  text: string;
}

/** An input slot in a request body, resolved from local uploads at submit time. */
export interface Attachment {
  field: string;
  uploadIds: string[];
  multi: boolean;
}

export interface GenerateRequest {
  studio: StudioId;
  model: ModelDef;
  kind: 'image' | 'video';
  prompt: string;
  sentPrompt?: string;
  params: Record<string, unknown>;
  attachments: Attachment[];
}

interface AppState {
  ready: boolean;
  apiKey: string;
  balance: string | null;
  studio: StudioId;
  catalog: ModelDef[];
  localCustom: ModelDef[];
  fileCustom: ModelDef[];
  generations: Generation[];
  uploads: UploadRecord[];
  toasts: Toast[];
  settingsOpen: boolean;
  historyOpen: boolean; // mobile drawer
  viewer: { genId: string; index: number } | null;

  init(): Promise<void>;
  setStudio(s: StudioId): void;
  setApiKey(k: string): Promise<void>;
  refreshBalance(): Promise<void>;
  setSettingsOpen(v: boolean): void;
  setHistoryOpen(v: boolean): void;
  openViewer(genId: string, index?: number): void;
  closeViewer(): void;
  toast(kind: Toast['kind'], text: string): void;
  dismissToast(id: string): void;

  addCustomModels(models: ModelDef[]): void;
  removeCustomModel(id: string): void;

  addFiles(files: File[] | FileList, only?: MediaKind[]): Promise<UploadRecord[]>;
  deleteUpload(id: string): Promise<void>;
  clearUploads(): Promise<void>;

  generate(req: GenerateRequest): Promise<void>;
  retry(genId: string): Promise<void>;
  deleteGeneration(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  clearHistory(): Promise<void>;
}

const STUDIO_KEY = 'reelforge.studio';
const STUDIOS: StudioId[] = ['image', 'video', 'lipsync', 'cinema'];

function initialStudio(): StudioId {
  const fromHash = location.hash.replace('#/', '') as StudioId;
  if (STUDIOS.includes(fromHash)) return fromHash;
  const saved = localStorage.getItem(STUDIO_KEY) as StudioId;
  return STUDIOS.includes(saved) ? saved : 'image';
}

// Object URLs for local blobs, created lazily and kept for the session.
const objectUrls = new Map<string, string>();
export function blobUrl(u: UploadRecord): string {
  let url = objectUrls.get(u.id);
  if (!url) {
    url = URL.createObjectURL(u.blob);
    objectUrls.set(u.id, url);
  }
  return url;
}

const polling = new Set<string>();

async function readImageSize(blob: Blob): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(blob);
    const r = { width: bmp.width, height: bmp.height };
    bmp.close();
    return r;
  } catch {
    return {};
  }
}

export const useApp = create<AppState>((set, get) => {
  const patchGen = async (id: string, patch: Partial<Generation>) => {
    let updated: Generation | undefined;
    set((s) => ({
      generations: s.generations.map((g) => (g.id === id ? (updated = { ...g, ...patch }) : g)),
    }));
    if (updated) await db.generations.put(updated);
  };

  const ensureRemote = async (uploadId: string): Promise<string> => {
    const u = get().uploads.find((x) => x.id === uploadId) ?? (await db.uploads.get(uploadId));
    if (!u) throw new Error('An input file is missing from upload history.');
    if (u.remoteUrl && u.remoteAt && Date.now() - u.remoteAt < REMOTE_TTL) return u.remoteUrl;
    const url = await muapi.upload(get().apiKey, u.blob, u.name);
    const next = { ...u, remoteUrl: url, remoteAt: Date.now() };
    await db.uploads.put(next);
    set((s) => ({ uploads: s.uploads.map((x) => (x.id === u.id ? next : x)) }));
    return url;
  };

  const track = async (gen: Generation) => {
    if (!gen.requestId || polling.has(gen.id)) return;
    polling.add(gen.id);
    try {
      const r = await waitForResult(get().apiKey, gen.requestId, {
        onStatus: (st) => {
          const status = st === 'processing' ? 'processing' : 'queued';
          const cur = get().generations.find((g) => g.id === gen.id);
          if (cur && cur.status !== status) patchGen(gen.id, { status });
        },
      });
      if (r.status === 'completed') {
        const outputs = normalizeOutputs(r.outputs);
        await patchGen(gen.id, {
          status: outputs.length ? 'completed' : 'failed',
          outputs,
          error: outputs.length ? undefined : 'Completed without outputs',
          completedAt: Date.now(),
          cost: r.cost?.amount_usd ?? gen.cost,
        });
        if (outputs.length) get().toast('success', `${gen.modelName} finished`);
        get().refreshBalance();
      } else {
        await patchGen(gen.id, { status: r.status === 'cancelled' ? 'cancelled' : 'failed', error: r.error || 'Generation failed', completedAt: Date.now() });
        get().toast('error', `${gen.modelName}: ${r.error || 'generation failed'}`);
      }
    } catch (e) {
      await patchGen(gen.id, { status: 'failed', error: (e as Error).message, completedAt: Date.now() });
    } finally {
      polling.delete(gen.id);
    }
  };

  return {
    ready: false,
    apiKey: '',
    balance: null,
    studio: initialStudio(),
    catalog: buildCatalog(loadLocalCustomModels()),
    localCustom: loadLocalCustomModels(),
    fileCustom: [],
    generations: [],
    uploads: [],
    toasts: [],
    settingsOpen: false,
    historyOpen: false,
    viewer: null,

    async init() {
      const [apiKey, generations, uploads, fileCustom] = await Promise.all([
        keystore.get(),
        db.generations.all().catch(() => []),
        db.uploads.all().catch(() => []),
        loadFileCustomModels(),
      ]);
      const localCustom = get().localCustom;
      set({ apiKey, generations, uploads, fileCustom, catalog: buildCatalog([...fileCustom, ...localCustom]), ready: true });
      if (!apiKey) set({ settingsOpen: true });
      else {
        get().refreshBalance();
        // Resume polling jobs interrupted by a reload.
        for (const g of generations) {
          if (g.requestId && (g.status === 'queued' || g.status === 'processing')) track(g);
          else if (g.status === 'submitting') patchGen(g.id, { status: 'failed', error: 'Interrupted before submission' });
        }
      }
    },

    setStudio(studio) {
      localStorage.setItem(STUDIO_KEY, studio);
      history.replaceState(null, '', `#/${studio}`);
      set({ studio });
    },

    async setApiKey(k) {
      const key = k.trim();
      if (key) await keystore.set(key);
      else await keystore.clear();
      set({ apiKey: key, balance: null });
      if (key) {
        get().refreshBalance();
        for (const g of get().generations) if (g.requestId && (g.status === 'queued' || g.status === 'processing')) track(g);
      }
    },

    async refreshBalance() {
      if (!get().apiKey) return;
      try {
        set({ balance: readBalance(await muapi.balance(get().apiKey)) });
      } catch {
        set({ balance: null });
      }
    },

    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setHistoryOpen: (historyOpen) => set({ historyOpen }),
    openViewer: (genId, index = 0) => set({ viewer: { genId, index } }),
    closeViewer: () => set({ viewer: null }),

    toast(kind, text) {
      const id = uid();
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
      setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    addCustomModels(models) {
      const byId = new Map(get().localCustom.map((m) => [m.id, m]));
      for (const m of models) byId.set(m.id, { ...m, custom: true });
      const localCustom = [...byId.values()];
      saveLocalCustomModels(localCustom);
      set({ localCustom, catalog: buildCatalog([...get().fileCustom, ...localCustom]) });
    },
    removeCustomModel(id) {
      const localCustom = get().localCustom.filter((m) => m.id !== id);
      saveLocalCustomModels(localCustom);
      set({ localCustom, catalog: buildCatalog([...get().fileCustom, ...localCustom]) });
    },

    async addFiles(files, only) {
      const added: UploadRecord[] = [];
      for (const f of Array.from(files)) {
        const kind = kindOfFile(f);
        if (!kind || (only && !only.includes(kind))) {
          get().toast('error', `${f.name}: unsupported file type here`);
          continue;
        }
        const tooBig = uploadLimitError(kind, f.size);
        if (tooBig) {
          get().toast('error', tooBig);
          continue;
        }
        const rec: UploadRecord = {
          id: uid(),
          kind,
          name: f.name || `${kind}-${Date.now()}`,
          mime: f.type,
          size: f.size,
          blob: f,
          createdAt: Date.now(),
          ...(kind === 'image' ? await readImageSize(f) : {}),
        };
        await db.uploads.put(rec);
        added.push(rec);
      }
      if (added.length) set((s) => ({ uploads: [...added.reverse(), ...s.uploads] }));
      return added.reverse();
    },

    async deleteUpload(id) {
      await db.uploads.delete(id);
      const url = objectUrls.get(id);
      if (url) URL.revokeObjectURL(url), objectUrls.delete(id);
      set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) }));
    },

    async clearUploads() {
      await db.uploads.clear();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      objectUrls.clear();
      set({ uploads: [] });
    },

    async generate(req) {
      const { apiKey } = get();
      if (!apiKey) {
        get().toast('error', 'Add your Muapi API key first.');
        set({ settingsOpen: true });
        return;
      }
      const gen: Generation = {
        id: uid(),
        studio: req.studio,
        modelId: req.model.id,
        modelName: req.model.name,
        kind: req.kind,
        prompt: req.prompt,
        sentPrompt: req.sentPrompt,
        payload: {},
        inputUploadIds: req.attachments.flatMap((a) => a.uploadIds),
        status: 'submitting',
        outputs: [],
        createdAt: Date.now(),
      };
      set((s) => ({ generations: [gen, ...s.generations] }));
      await db.generations.put(gen);

      try {
        const payload: Record<string, unknown> = { ...req.params };
        const promptField = req.model.inputs.prompt?.field;
        const finalPrompt = (req.sentPrompt ?? req.prompt).trim();
        if (promptField && finalPrompt) payload[promptField] = finalPrompt;
        for (const a of req.attachments) {
          if (!a.uploadIds.length) continue;
          const urls = await Promise.all(a.uploadIds.map(ensureRemote));
          payload[a.field] = a.multi ? urls : urls[0];
        }
        const r = await muapi.submit(apiKey, req.model.id, payload);
        if (!r.request_id) throw new Error('Muapi did not return a request id');
        const next: Partial<Generation> = { requestId: r.request_id, status: 'queued', payload, cost: r.cost?.amount_usd };
        await patchGen(gen.id, next);
        track({ ...gen, ...next } as Generation);
      } catch (e) {
        await patchGen(gen.id, { status: 'failed', error: (e as Error).message, completedAt: Date.now() });
        get().toast('error', (e as Error).message);
      }
    },

    async retry(genId) {
      const g = get().generations.find((x) => x.id === genId);
      if (!g) return;
      const model = get().catalog.find((m) => m.id === g.modelId);
      if (!model) return get().toast('error', 'That model is no longer in the catalog.');
      // Rebuild attachments from the original payload so presigned URLs are refreshed.
      const attachments: Attachment[] = [];
      const params: Record<string, unknown> = { ...g.payload };
      const fields = [model.inputs.image, model.inputs.endImage, model.inputs.audio, model.inputs.video].filter(Boolean);
      const ids = [...(g.inputUploadIds || [])];
      for (const f of fields) {
        const v = params[f!.field];
        if (v === undefined) continue;
        delete params[f!.field];
        const n = Array.isArray(v) ? v.length : 1;
        attachments.push({ field: f!.field, uploadIds: ids.splice(0, n), multi: Array.isArray(v) });
      }
      if (model.inputs.prompt) delete params[model.inputs.prompt.field];
      await get().generate({ studio: g.studio, model, kind: g.kind, prompt: g.prompt, sentPrompt: g.sentPrompt, params, attachments });
    },

    async deleteGeneration(id) {
      await db.generations.delete(id);
      set((s) => ({ generations: s.generations.filter((g) => g.id !== id), viewer: s.viewer?.genId === id ? null : s.viewer }));
    },

    async toggleFavorite(id) {
      const g = get().generations.find((x) => x.id === id);
      if (g) await patchGen(id, { favorite: !g.favorite });
    },

    async clearHistory() {
      const keep = get().generations.filter((g) => g.favorite);
      await db.generations.clear();
      await Promise.all(keep.map((g) => db.generations.put(g)));
      set({ generations: keep });
    },
  };
});
