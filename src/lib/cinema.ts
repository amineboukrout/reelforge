// Cinema studio: a virtual camera rig translated into cinematographic prompt
// language. Muapi models don't expose physical camera parameters, so the rig
// is expressed the way directors of photography describe shots — which modern
// image/video models respond to well.

export interface CameraRig {
  body: string;
  lens: string;
  focal: number; // mm
  aperture: number; // f-number
  shot: string;
  angle: string;
  movement: string; // video only
  lighting: string;
  grade: string;
  aspect: string;
  grain: number; // 0..3
}

export const CAMERA_BODIES = [
  { id: 'none', label: 'Any camera', prompt: '' },
  { id: 'alexa35', label: 'ARRI Alexa 35', prompt: 'shot on ARRI Alexa 35, rich highlight roll-off' },
  { id: 'alexa65', label: 'ARRI Alexa 65', prompt: 'shot on ARRI Alexa 65 large format, immersive depth' },
  { id: 'venice', label: 'Sony Venice 2', prompt: 'shot on Sony Venice 2, clean full-frame image' },
  { id: 'red', label: 'RED V-Raptor', prompt: 'shot on RED V-Raptor 8K, crisp detail' },
  { id: 'imax', label: 'IMAX 70mm film', prompt: 'shot on IMAX 70mm film, monumental scale' },
  { id: '35film', label: '35mm film', prompt: 'shot on 35mm motion picture film' },
  { id: '16film', label: '16mm film', prompt: 'shot on 16mm film, organic texture' },
  { id: 'super8', label: 'Super 8', prompt: 'shot on Super 8 film, nostalgic home-movie look' },
  { id: 'vhs', label: 'VHS camcorder', prompt: '1990s VHS camcorder footage, scanlines, chroma bleed' },
  { id: 'iphone', label: 'Smartphone', prompt: 'shot on a modern smartphone, natural handheld realism' },
];

export const LENSES = [
  { id: 'spherical', label: 'Spherical prime', prompt: 'spherical prime lens' },
  { id: 'anamorphic', label: 'Anamorphic', prompt: 'anamorphic lens, oval bokeh, horizontal lens flares' },
  { id: 'vintage', label: 'Vintage glass', prompt: 'vintage cine lens, soft halation, gentle aberrations' },
  { id: 'macro', label: 'Macro', prompt: 'macro lens, extreme close detail' },
  { id: 'fisheye', label: 'Fisheye', prompt: 'fisheye lens, strong barrel distortion' },
  { id: 'tiltshift', label: 'Tilt-shift', prompt: 'tilt-shift lens, miniature effect, selective focus plane' },
  { id: 'zoom', label: 'Cine zoom', prompt: 'cinema zoom lens' },
];

export const FOCAL_STOPS = [8, 14, 18, 24, 28, 35, 40, 50, 65, 85, 100, 135, 200, 300];
export const APERTURES = [1.2, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

export const SHOTS = [
  { id: 'none', label: 'Auto', prompt: '' },
  { id: 'ecu', label: 'Extreme close-up', prompt: 'extreme close-up shot' },
  { id: 'cu', label: 'Close-up', prompt: 'close-up shot' },
  { id: 'mcu', label: 'Medium close-up', prompt: 'medium close-up shot' },
  { id: 'ms', label: 'Medium', prompt: 'medium shot' },
  { id: 'cowboy', label: 'Cowboy', prompt: 'cowboy shot framed from mid-thigh up' },
  { id: 'ws', label: 'Wide', prompt: 'wide shot' },
  { id: 'ews', label: 'Extreme wide', prompt: 'extreme wide establishing shot' },
  { id: 'ots', label: 'Over-the-shoulder', prompt: 'over-the-shoulder shot' },
  { id: 'pov', label: 'POV', prompt: 'first-person POV shot' },
];

export const ANGLES = [
  { id: 'none', label: 'Eye level', prompt: '' },
  { id: 'low', label: 'Low angle', prompt: 'low angle, looking up' },
  { id: 'high', label: 'High angle', prompt: 'high angle, looking down' },
  { id: 'dutch', label: 'Dutch tilt', prompt: 'dutch angle, tilted horizon' },
  { id: 'top', label: "Bird's eye", prompt: "top-down bird's-eye view" },
  { id: 'worm', label: "Worm's eye", prompt: "extreme worm's-eye view from the ground" },
];

export const MOVEMENTS = [
  { id: 'static', label: 'Locked off', prompt: 'static locked-off camera on a tripod' },
  { id: 'dolly-in', label: 'Dolly in', prompt: 'slow dolly in towards the subject' },
  { id: 'dolly-out', label: 'Dolly out', prompt: 'slow dolly out revealing the scene' },
  { id: 'truck', label: 'Truck', prompt: 'lateral tracking shot, camera trucks alongside the subject' },
  { id: 'orbit', label: 'Orbit', prompt: '180-degree orbit around the subject' },
  { id: 'crane-up', label: 'Crane up', prompt: 'crane shot rising upward' },
  { id: 'crane-down', label: 'Crane down', prompt: 'crane shot descending' },
  { id: 'pan', label: 'Pan', prompt: 'smooth horizontal pan' },
  { id: 'tilt', label: 'Tilt', prompt: 'slow vertical tilt' },
  { id: 'handheld', label: 'Handheld', prompt: 'handheld camera, subtle organic shake' },
  { id: 'steadicam', label: 'Steadicam', prompt: 'gliding steadicam follow shot' },
  { id: 'fpv', label: 'FPV drone', prompt: 'fast FPV drone flythrough' },
  { id: 'aerial', label: 'Aerial', prompt: 'sweeping aerial drone shot' },
  { id: 'zoom', label: 'Crash zoom', prompt: 'sudden crash zoom' },
  { id: 'vertigo', label: 'Dolly zoom', prompt: 'vertigo dolly zoom effect' },
  { id: 'bullet', label: 'Bullet time', prompt: 'bullet-time frozen moment, camera sweeps around' },
];

export const LIGHTING = [
  { id: 'none', label: 'Natural', prompt: '' },
  { id: 'golden', label: 'Golden hour', prompt: 'warm golden-hour sunlight' },
  { id: 'blue', label: 'Blue hour', prompt: 'cool blue-hour ambience' },
  { id: 'noir', label: 'Low-key noir', prompt: 'low-key noir lighting, hard shadows' },
  { id: 'rembrandt', label: 'Rembrandt', prompt: 'Rembrandt lighting with a triangle of light on the cheek' },
  { id: 'neon', label: 'Neon', prompt: 'neon practical lighting, magenta and cyan' },
  { id: 'volumetric', label: 'Volumetric', prompt: 'volumetric light shafts through haze' },
  { id: 'softbox', label: 'Studio soft', prompt: 'soft diffused studio key light' },
  { id: 'backlit', label: 'Backlit', prompt: 'strong backlight, glowing rim light' },
  { id: 'candle', label: 'Candlelight', prompt: 'flickering candlelight' },
  { id: 'overcast', label: 'Overcast', prompt: 'soft overcast daylight' },
];

export const GRADES = [
  { id: 'none', label: 'Neutral', prompt: '' },
  { id: 'teal-orange', label: 'Teal & orange', prompt: 'teal and orange blockbuster color grade' },
  { id: 'bleach', label: 'Bleach bypass', prompt: 'bleach bypass, desaturated high contrast' },
  { id: 'kodak', label: 'Kodak 2383', prompt: 'Kodak 2383 print film emulation' },
  { id: 'portra', label: 'Portra 400', prompt: 'Kodak Portra 400 film colors' },
  { id: 'cinestill', label: 'CineStill 800T', prompt: 'CineStill 800T tungsten film, red halation' },
  { id: 'mono', label: 'Black & white', prompt: 'black and white, rich silver tones' },
  { id: 'pastel', label: 'Pastel', prompt: 'soft pastel palette' },
  { id: 'matrix', label: 'Green tint', prompt: 'sickly green digital tint' },
  { id: 'technicolor', label: 'Technicolor', prompt: 'vivid three-strip Technicolor' },
];

export const CINE_ASPECTS = [
  { id: '16:9', label: '16:9', prompt: '' },
  { id: '2.39:1', label: '2.39:1 Scope', prompt: 'ultra-wide 2.39:1 cinemascope framing' },
  { id: '1.85:1', label: '1.85:1 Flat', prompt: '1.85:1 theatrical framing' },
  { id: '4:3', label: '4:3 Academy', prompt: 'classic 4:3 academy ratio framing' },
  { id: '9:16', label: '9:16 Vertical', prompt: '' },
  { id: '1:1', label: '1:1', prompt: '' },
];

/** Closest aspect ratio a model supports for a cinematic aspect id. */
export function modelAspectFor(cineAspect: string, options: (string | number)[]): string | undefined {
  const opts = options.map(String);
  const want: Record<string, string[]> = {
    '16:9': ['16:9'],
    '2.39:1': ['21:9', '16:9'],
    '1.85:1': ['16:9'],
    '4:3': ['4:3'],
    '9:16': ['9:16'],
    '1:1': ['1:1'],
  };
  return (want[cineAspect] || []).find((a) => opts.includes(a));
}

export const DEFAULT_RIG: CameraRig = {
  body: 'alexa35',
  lens: 'spherical',
  focal: 35,
  aperture: 2.8,
  shot: 'ms',
  angle: 'none',
  movement: 'dolly-in',
  lighting: 'none',
  grade: 'none',
  aspect: '16:9',
  grain: 1,
};

export const RIG_PRESETS: { id: string; label: string; rig: Partial<CameraRig> }[] = [
  { id: 'blockbuster', label: 'Blockbuster', rig: { body: 'imax', lens: 'spherical', focal: 24, aperture: 4, shot: 'ws', movement: 'crane-up', grade: 'teal-orange', aspect: '2.39:1' } },
  { id: 'intimate', label: 'Intimate portrait', rig: { body: 'alexa35', lens: 'vintage', focal: 85, aperture: 1.4, shot: 'cu', movement: 'dolly-in', lighting: 'rembrandt', grade: 'kodak' } },
  { id: 'noir', label: 'Neo-noir', rig: { body: '35film', lens: 'anamorphic', focal: 40, aperture: 2, shot: 'mcu', angle: 'low', movement: 'truck', lighting: 'neon', grade: 'cinestill', aspect: '2.39:1' } },
  { id: 'documentary', label: 'Documentary', rig: { body: '16film', lens: 'zoom', focal: 50, aperture: 4, shot: 'ms', movement: 'handheld', lighting: 'overcast', grade: 'none', grain: 2 } },
  { id: 'epic', label: 'Epic landscape', rig: { body: 'alexa65', lens: 'spherical', focal: 14, aperture: 8, shot: 'ews', movement: 'aerial', lighting: 'golden', aspect: '2.39:1' } },
  { id: 'product', label: 'Product macro', rig: { body: 'red', lens: 'macro', focal: 100, aperture: 5.6, shot: 'ecu', movement: 'orbit', lighting: 'softbox', grade: 'none', grain: 0 } },
];

function focalLanguage(mm: number): string {
  if (mm <= 16) return `${mm}mm ultra-wide lens, expansive perspective with dramatic depth`;
  if (mm <= 28) return `${mm}mm wide-angle lens, environmental framing`;
  if (mm <= 45) return `${mm}mm lens, natural perspective`;
  if (mm <= 70) return `${mm}mm lens, true-to-eye perspective`;
  if (mm <= 135) return `${mm}mm telephoto portrait lens, flattering compression`;
  return `${mm}mm long telephoto lens, heavily compressed background`;
}

function apertureLanguage(f: number): string {
  if (f <= 1.4) return `f/${f} wide open, razor-thin depth of field, creamy bokeh`;
  if (f <= 2.8) return `f/${f}, shallow depth of field, soft background separation`;
  if (f <= 5.6) return `f/${f}, moderate depth of field`;
  return `f/${f}, deep focus, sharp from foreground to background`;
}

const GRAIN = ['', 'subtle film grain', 'visible film grain', 'heavy gritty grain'];

const find = (list: { id: string; prompt: string }[], id: string) => list.find((x) => x.id === id)?.prompt || '';

export function rigToPrompt(rig: CameraRig, motion: boolean): string {
  const parts = [
    find(SHOTS, rig.shot),
    find(ANGLES, rig.angle),
    motion ? find(MOVEMENTS, rig.movement) : '',
    find(CAMERA_BODIES, rig.body),
    `${find(LENSES, rig.lens)}, ${focalLanguage(rig.focal)}`,
    apertureLanguage(rig.aperture),
    find(LIGHTING, rig.lighting),
    find(GRADES, rig.grade),
    find(CINE_ASPECTS, rig.aspect),
    GRAIN[rig.grain] || '',
    'cinematic composition, professional cinematography',
  ];
  return parts.filter(Boolean).join(', ');
}

export function composeCinemaPrompt(scene: string, rig: CameraRig, motion: boolean): string {
  const s = scene.trim().replace(/[.\s]+$/, '');
  return `${s}. ${rigToPrompt(rig, motion)}.`;
}
