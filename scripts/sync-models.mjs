#!/usr/bin/env node
// Regenerates src/catalog/models.generated.json from Muapi's live OpenAPI spec.
//
//   npm run sync-models                # fetch https://api.muapi.ai/openapi.json
//   npm run sync-models -- ./spec.json # use a local copy
//
// Each Muapi media endpoint becomes a ModelDef (see src/lib/types.ts). The UI
// renders controls straight from these definitions, so new Muapi models show
// up after a re-sync with no code changes.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_URL = 'https://api.muapi.ai/openapi.json';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/catalog/models.generated.json');

const TAGS = {
  'Image: Text-to-Image': 'image',
  'Image: Edit & Reference': 'image-edit',
  'Image: Enhance': 'enhance',
  'Video: Text-to-Video': 'video',
  'Video: Image-to-Video': 'video-i2v',
  'Video: Lipsync': 'lipsync',
  'Video: Avatars': 'lipsync',
  'Video: Edit & Effects': 'video-edit',
};

const IMAGE_FIELDS = ['images_list', 'image_urls', 'image_url', 'first_frame_url', 'reference_images', 'image'];
const END_IMAGE_FIELDS = ['last_image', 'end_image_url', 'last_frame_url', 'last_image_url'];
const AUDIO_FIELDS = ['audio_url', 'audio'];
const VIDEO_FIELDS = ['video_url'];
// Internal / unsupported fields that should never become UI controls.
const SKIP = new Set([
  'webhook_url', 'webhook', 'sync', 'model_id', 'draft_request_id', 'draft', 'loras', 'lora_list', 'lora_url',
  'mask_url', 'mask_image_url', 'images_data_url', 'team_id',
]);

const arg = process.argv[2];
const spec = arg
  ? JSON.parse(await readFile(arg, 'utf8'))
  : await fetch(SPEC_URL).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch spec: ${r.status}`);
      return r.json();
    });

const schemas = spec.components?.schemas ?? {};
const deref = (s) => (s && s.$ref ? schemas[s.$ref.split('/').pop()] ?? {} : s ?? {});

/** Collapse `anyOf: [{type:X}, {type:null}]` into a single schema. */
function flatten(raw) {
  const s = deref(raw);
  if (s.anyOf) {
    const nonNull = s.anyOf.map(deref).filter((x) => x.type !== 'null');
    if (nonNull.length >= 1) return { ...nonNull[0], ...s, anyOf: undefined, type: nonNull[0].type, nullable: true };
  }
  return s;
}

const titleCase = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function toParam(key, s) {
  const base = { key, label: s.title || titleCase(key) };
  if (s.description) base.help = String(s.description).slice(0, 200);
  if (s.default !== undefined && s.default !== null) base.default = s.default;
  if (Array.isArray(s.enum) && s.enum.length) return { ...base, type: 'enum', options: s.enum };
  if (s.type === 'boolean') return { ...base, type: 'bool' };
  if (s.type === 'integer' || s.type === 'number') {
    const p = { ...base, type: s.type === 'integer' ? 'int' : 'number' };
    if (s.minimum !== undefined) p.min = s.minimum;
    if (s.maximum !== undefined) p.max = s.maximum;
    return p;
  }
  if (s.type === 'string' && s.format !== 'uri' && !/_url$/.test(key)) {
    const p = { ...base, type: 'string' };
    if (s.maxLength && s.maxLength > 300) p.multiline = true;
    return p;
  }
  return null; // arrays / objects / urls we don't know how to render
}

const models = [];
for (const [path, item] of Object.entries(spec.paths)) {
  const op = item.post;
  if (!op || !path.startsWith('/api/v1/')) continue;
  const group = (op.tags || []).map((t) => TAGS[t]).find(Boolean);
  if (!group) continue;
  const body = deref(op.requestBody?.content?.['application/json']?.schema);
  const props = body.properties ?? {};
  const required = new Set(body.required ?? []);
  const keys = Object.keys(props);

  const pick = (list) => list.find((k) => k in props);
  const imageKey = pick(IMAGE_FIELDS);
  const endKey = pick(END_IMAGE_FIELDS);
  const audioKey = pick(AUDIO_FIELDS);
  const videoKey = pick(VIDEO_FIELDS);

  const inputs = {};
  if ('prompt' in props) inputs.prompt = { field: 'prompt', required: required.has('prompt') };
  if (imageKey) {
    const s = flatten(props[imageKey]);
    inputs.image = { field: imageKey, multi: s.type === 'array', required: required.has(imageKey) };
    if (s.type === 'array' && s.maxItems) inputs.image.max = s.maxItems;
    if (s.type === 'array' && s.minItems) inputs.image.min = s.minItems;
  }
  if (endKey) inputs.endImage = { field: endKey, required: required.has(endKey) };
  if (audioKey) inputs.audio = { field: audioKey, required: required.has(audioKey) };
  if (videoKey) inputs.video = { field: videoKey, required: required.has(videoKey) };

  // ---- Categorise into the studio buckets the UI understands.
  let category = null;
  const needsVideo = inputs.video?.required;
  const needsAudio = inputs.audio?.required;
  const needsImage = inputs.image?.required;
  if (group === 'lipsync' || ((group === 'video-i2v' || group === 'video-edit') && needsAudio)) {
    if (!inputs.audio) continue; // e.g. video translation
    category = needsVideo || (inputs.video && !inputs.image) ? 'lipsync' : 'avatar';
  } else if (group === 'video-edit') {
    continue;
  } else if (group === 'image') {
    category = needsImage ? 'i2i' : 't2i';
  } else if (group === 'image-edit') {
    if (!inputs.image) continue;
    category = 'i2i';
  } else if (group === 'video') {
    category = needsImage ? 'i2v' : 't2v';
  } else if (group === 'video-i2v') {
    if (needsVideo || !inputs.image) continue; // video-to-video lives elsewhere
    category = 'i2v';
  } else if (group === 'enhance') {
    if (!inputs.image?.required || needsVideo) continue;
    category = 'enhance';
  }
  if (!category) continue;

  const used = new Set(['prompt', imageKey, endKey, audioKey, videoKey].filter(Boolean));
  const params = [];
  for (const k of keys) {
    if (used.has(k) || SKIP.has(k)) continue;
    const p = toParam(k, flatten(props[k]));
    if (p) {
      if (required.has(k)) p.required = true;
      params.push(p);
    }
  }

  const summary = op.summary || path;
  const m = /^(.*?)\s*\((fast|balanced|best)\)\s*$/.exec(summary);
  const id = path.slice('/api/v1/'.length);
  if (id.includes('{') || /trainer|ocr-|watermark|photo-pack/.test(id)) continue;
  models.push({
    id,
    name: prettyName(m ? m[1] : summary),
    ...(m ? { tier: m[2] } : {}),
    category,
    ...(op.description ? { description: String(op.description).split('\n')[0].slice(0, 220) } : {}),
    inputs,
    params,
  });
}

function prettyName(s) {
  return s
    .replace(/-/g, ' ')
    .replace(/\b(t2v|i2v|t2i|i2i)\b/gi, (x) => x.toUpperCase())
    .replace(/\bv(\d)/g, 'V$1')
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bGpt/g, 'GPT')
    .trim();
}

models.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: SPEC_URL, models }));

const counts = models.reduce((acc, m) => ((acc[m.category] = (acc[m.category] || 0) + 1), acc), {});
console.log(`Wrote ${models.length} models to ${OUT}`);
console.log(counts);
