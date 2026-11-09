// ----------------------------------------------------------------------------
// Model definitions. Generated from Muapi's OpenAPI spec (scripts/sync-models.mjs)
// and extendable via public/models.custom.json or Settings → Custom models.
// ----------------------------------------------------------------------------

export type Category =
  | 't2i' // text → image
  | 'i2i' // image(s) → image (edit / reference)
  | 't2v' // text → video
  | 'i2v' // image(s) → video
  | 'avatar' // portrait image + audio → talking video
  | 'lipsync' // video + audio → lip-synced video
  | 'enhance'; // image → image utility (upscale, bg removal …)

export interface InputField {
  /** Request body key, e.g. `image_url` or `images_list`. */
  field: string;
  required?: boolean;
}

export interface ImageInput extends InputField {
  /** True when the field is an array (multi-image / reference models). */
  multi?: boolean;
  max?: number;
  min?: number;
}

export type ParamDef =
  | (ParamBase & { type: 'enum'; options: (string | number)[] })
  | (ParamBase & { type: 'int' | 'number'; min?: number; max?: number; step?: number })
  | (ParamBase & { type: 'bool' })
  | (ParamBase & { type: 'string'; multiline?: boolean });

interface ParamBase {
  key: string;
  label: string;
  help?: string;
  default?: unknown;
  required?: boolean;
}

export interface ModelDef {
  /** Muapi endpoint, POSTed to /api/v1/{id}. */
  id: string;
  name: string;
  tier?: 'fast' | 'balanced' | 'best';
  category: Category;
  description?: string;
  inputs: {
    prompt?: InputField;
    image?: ImageInput;
    endImage?: InputField;
    audio?: InputField;
    video?: InputField;
  };
  params: ParamDef[];
  /** Set for models added by the user. */
  custom?: boolean;
}

// ----------------------------------------------------------------------------
// Persisted records
// ----------------------------------------------------------------------------

export type StudioId = 'image' | 'video' | 'lipsync' | 'cinema';
export type MediaKind = 'image' | 'video' | 'audio';

export type JobStatus = 'submitting' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Generation {
  id: string; // local id
  requestId?: string; // Muapi request id
  studio: StudioId;
  modelId: string;
  modelName: string;
  kind: 'image' | 'video';
  prompt: string;
  /** The final prompt sent (Cinema appends camera language). */
  sentPrompt?: string;
  payload: Record<string, unknown>;
  /** Local upload ids used as inputs, for "reuse inputs". */
  inputUploadIds?: string[];
  status: JobStatus;
  error?: string;
  outputs: string[];
  createdAt: number;
  completedAt?: number;
  cost?: number;
  favorite?: boolean;
}

export interface UploadRecord {
  id: string;
  kind: MediaKind;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  /** Muapi-hosted URL. Presigned — expires ~1h after upload. */
  remoteUrl?: string;
  remoteAt?: number;
  createdAt: number;
  width?: number;
  height?: number;
}
