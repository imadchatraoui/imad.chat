/*
 * hello, imad's world — intro engine (Canvas 2D, framework-free).
 *
 * Every frame is a pure function of t (seconds since mount), the layout and seeded parameters:
 * no particle state is integrated over time. That makes the animation resize-safe, lets skip
 * jump straight to the end, and lets captures seek to any instant.
 *
 * Sequence (script time s = t - T0, T0 ≈ 0.85 s once fonts are ready):
 *   the night deepens out of the page colour and stars fade in brightest-first, as at dusk →
 *   caret → "hello, world" typed with a human rhythm → a held breath (one caret blink) → "world"
 *   deleted letter by letter, each letter loosening into motes that rise and become new stars →
 *   "hello, " glides aside while light spirals out of the stars (the new ones from "world" among
 *   them) into "imad’s world", letter by letter; each gold glyph strikes with a brief warm breath →
 *   the astrolabe's limb scale, at its real radii, is engraved clockwise at an even pace, the
 *   zenith mark last.
 *
 * Layers, back to front (the engine adds them next to the canvas it is given):
 *   backdrop  the dithered radial night with the milky band baked in at the sky's resting angle:
 *             one static, opaque layer; nothing full-screen is drawn per frame;
 *   canvas    stars, motes and glows, redrawn every frame at DPR ≤ 2 (1.5, then 1.25, when the
 *             device cannot keep up);
 *   text      the typed line, the gold name and the limb, at DPR ≤ 3, sized to the limb's box,
 *             redrawn only while something in it changes.
 *
 * Mobile budget: glyph ink sampled once (bbox-cropped, no per-frame getImageData), typed arrays,
 * tiny motes batched as rect paths, startup work spread over frames, resize work deferred to one
 * application per frame, and the loop throttles and then stops once the sky has settled.
 * Failures hand over (onDone) instead of leaving a stuck overlay.
 */

export type IntroEventName = 'type' | 'backspace' | 'dissolve' | 'condense' | 'circle';

export interface IntroTargetRect {
  /** Centre of the limb circle, CSS px, relative to the canvas box. */
  cx: number;
  cy: number;
  /** Radius of the limb: the outer edge of the brass, CSS px (the astrolabe's getLimbScreenCircle()). */
  r: number;
}

export interface IntroEngineOptions {
  seed?: number;
  /** Static final frame, no motion at all; onDone fires as soon as it is drawn (600 ms at most). */
  reducedMotion?: boolean;
  /** Start directly in the final state (e.g. a returning visitor). */
  startFinal?: boolean;
  /** No rAF loop: the caller drives renderAt(t). For captures and tests. */
  manual?: boolean;
  onEvent?: (name: IntroEventName) => void;
  onDone?: () => void;
  getTarget?: (w: number, h: number) => IntroTargetRect | null | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const MONO_TEXT = 'hello, world';
const HELLO_N = 7; // 'hello, '
const WORLD = 'world';
const SERIF_TEXT = 'imad’s world';
const MONO_RATIO = 0.5; // mono size / serif size
const KERN = 0.15; // pulls the name towards 'hello,' (S units): the gap matches a serif word space
const T0_MIN = 0.85; // earliest script start (s since mount)
const T0_CUSHION = 0.45; // script start after the fonts are ready
const OMEGA = (0.3 * Math.PI) / 180; // sky rotation, rad/s — counter-clockwise, as facing north
const DECEL_TAU = 2.2; // after the intro the sky settles towards stillness
const IDLE_STOP = 3 * DECEL_TAU; // ... and then rendering stops
const IDLE_FRAME_MS = 32; // from onDone + 1 s until the stop: about 30 fps, by elapsed time
const MAX_DPR_SKY = 2;
const LOW_DPR_SKY = 1.5; // when the device cannot hold the frame rate ...
const LOWER_DPR_SKY = 1.25; // ... or is far from it
const MAX_DPR_TEXT = 3;
const MAX_TEXT_PX = 4.5e6; // backing-store cap of the text layer, device px
const SLOW_FRAME_MS = 21;
const VERY_SLOW_FRAME_MS = 30;
const NB = 16; // alpha buckets for batching
const SKY_SCALE = 1.18; // sky square side / max(w, h)
const BAND_ALPHA = 0.1; // the band, added onto the night
const SKIP_FADE = 0.4;
const FONT_TIMEOUT_MS = 3000;
const SKIP_FONT_WAIT_MS = 600; // after a skip, the fonts get at most this much longer
const REDUCED_HANDOVER_MS = 600;
const STABLE_FRAMES = 10;
const QUIET_A = 0.3; // a bright star that would sit behind the lockup at rest shines like a faint one
const RECT_DOT_DEV = 2.3; // motes below this radius (device px) are drawn as rects, not sprites
const RECT_SIZE = 1.1; // rect side / mote radius
const RECT_GAIN = 0.55; // rect alpha / sprite alpha, for the same amount of light
const FALLBACK_MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
const FALLBACK_SERIF = "'Cormorant Garamond', Georgia, serif";
// faces that are never late: the intro runs in these when the web fonts miss the timeout
const LOCAL_MONO = "ui-monospace, Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace";
const LOCAL_SERIF = "Georgia, 'Times New Roman', 'Liberation Serif', serif";

// The limb scale as fractions of the outer edge of the brass, taken from the astrolabe's own
// engraving (components/astrolabe/engine/paint.ts paintLimb, DIMS.mater = 1.27), so the 3D limb
// takes over line for line.
const LIMB_EDGE = 1.264 / 1.27; // R − 0.006
const LIMB_R1 = 1.252 / 1.27; // the tick circle (outer end of every tick)
const LIMB_T1 = 1.234 / 1.27; // inner end of the 1° ticks
const LIMB_T5 = 1.222 / 1.27; // inner end of the 5° ticks
const LIMB_R2 = 1.208 / 1.27; // inner end of the 10° ticks, inner circle

type RGB = readonly [number, number, number];
const STAR_COLS: readonly RGB[] = [
  [206, 218, 255], // blue-white
  [238, 240, 255], // white
  [255, 241, 222], // warm white
  [255, 214, 172], // orange
];
// particle palette: cream (ink), white (starlight), pale gold, gold
const PART_COLS: readonly RGB[] = [
  [239, 230, 210],
  [236, 240, 255],
  [246, 224, 168],
  [234, 186, 100],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function easeOutCubic(x: number) {
  x = clamp01(x);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}
function easeOutQuint(x: number) {
  x = clamp01(x);
  const y = 1 - x;
  return 1 - y * y * y * y * y;
}
function easeInOutCubic(x: number) {
  x = clamp01(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/** An ease integrated from a velocity profile v(u), as a lookup table. */
function makeVelEase(v: (u: number) => number) {
  const n = 512;
  const lut = new Float32Array(n + 1);
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    acc += v((i - 0.5) / n);
    lut[i] = acc;
  }
  for (let j = 1; j <= n; j++) lut[j] /= acc;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const f = x * n;
    const k = f | 0;
    return lut[k] + (lut[k + 1] - lut[k]) * (f - k);
  };
}
// soft departure, quint-like landing
const easeDissolve = makeVelEase((u) => Math.pow(u, 0.8) * Math.pow(1 - u, 2.6));
// the light leaves its star at once and still lands softly
const easeCondense = makeVelEase((u) => Math.pow(u, 0.8) * Math.pow(1 - u, 3.4));
// an engraver's even cut: short ramps, constant speed between (peak 1.25× the mean)
const easeLimb = makeVelEase((u) => smoothstep(0, 0.2, u) * (1 - smoothstep(0.8, 1, u)));

// unit vectors of the 360 limb ticks, 0° at the top, clockwise on screen
const TICK_COS = new Float64Array(360);
const TICK_SIN = new Float64Array(360);
for (let k = 0; k < 360; k++) {
  const a = -Math.PI / 2 + (k * TAU) / 360;
  TICK_COS[k] = Math.cos(a);
  TICK_SIN[k] = Math.sin(a);
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
function gauss(rng: Rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng());
}
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
/** iOS keeps canvas memory until the backing store is shrunk; do it explicitly. */
function release(c: HTMLCanvasElement | null | undefined) {
  if (c) {
    c.width = 0;
    c.height = 0;
  }
}
function ctx2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const g = c.getContext('2d', opts);
  if (!g) throw new Error('Canvas 2D unavailable');
  return g;
}
function rgba(c: RGB, a: number) {
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(4) + ')';
}
type Vec = [number, number];
function quad(a: Vec, c: Vec, b: Vec, t: number): Vec {
  const m = 1 - t;
  return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]];
}
const isNum = (x: number) => x === x; // not NaN
/** An error thrown by the page's callback must not stop the intro: report it on its own. */
function rethrowLater(e: unknown) {
  setTimeout(() => {
    throw e;
  }, 0);
}
function median(a: Float32Array, n: number) {
  const b = Array.from(a.subarray(0, n)).sort((x, y) => x - y);
  return b[b.length >> 1];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
/** Ink pixels (alpha ≥ 128) of one glyph rendered at R px, in its bbox-cropped canvas. */
interface GlyphInk {
  xs: Int16Array;
  ys: Int16Array;
  n: number;
  ox: number; // pen origin x
  by: number; // baseline y
  R: number;
}
interface GlyphSample {
  pts: Float32Array; // em units, relative to the letter origin on the baseline
  n: number;
  ink: number; // ink area, em²
  minY: number;
  maxY: number;
}
interface Metrics {
  adv: number;
  monoInkL: number;
  typedInkR: number;
  monoAsc: number;
  monoDesc: number;
  serifInkR: number;
  serifAsc: number;
  serifDesc: number;
  serifOff: number[];
  worldSamples: GlyphSample[];
  serifGlyphs: (GlyphInk | null)[];
  serifInk: number[];
  serifInkTotal: number;
}
interface Sky {
  L: number;
  Cx: number;
  Cy: number;
  Px: number;
  Py: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Layout {
  cx: number;
  cy: number;
  r: number;
  sky: Sky;
  S: number;
  M: number;
  xFinal: number;
  serifX: number;
  xTyped: number;
  baseline: number;
  adv: number;
  textCx: number;
  textCy: number;
  textW: number;
  monoFont: string;
  serifFont: string;
  gold: CanvasGradient | string;
  box: Box; // the text layer, CSS px
}
interface Timeline {
  type: number[];
  caretIn: number;
  del: number[]; // del[k] deletes MONO_TEXT index 11-k
  caretOut: [number, number];
  glide: [number, number];
  cond0: number;
  stagger: number;
  letterJitter: number;
  flight: [number, number];
  crisp: ([number, number] | null)[];
  circle0: number;
  circleDur: number;
  done: number;
  tickPass: Float32Array; // when the burin passes each degree (360)
}
interface Stars {
  n: number;
  u: Float32Array;
  v: Float32Array;
  I: Float32Array;
  a: Float32Array;
  sz: Float32Array;
  col: Uint8Array;
  spr: Uint8Array;
  sprR: Float32Array;
  tA: Float32Array;
  f1: Float32Array;
  f2: Float32Array;
  p1: Float32Array;
  p2: Float32Array;
  appear: Float32Array;
  born: Float32Array;
  dim: Float32Array;
  quiet: Uint8Array;
  x: Float32Array;
  y: Float32Array;
  al: Float32Array;
  key: Int16Array;
  order: Int32Array;
}
interface Dissolve {
  n: number;
  letter: Uint8Array;
  ex: Float32Array;
  ey: Float32Array;
  rel: Float32Array;
  dur: Float32Array;
  star: Int32Array;
  sway: Float32Array;
  ta: Float32Array;
  tf: Float32Array;
  tp: Float32Array;
  // random draws of the plume placement, kept so a new layout can place the stars again
  qy: Float32Array;
  qa: Float32Array;
  g1: Float32Array;
  g2: Float32Array;
  g3: Float32Array;
}
interface Condense {
  n: number;
  letter: Uint8Array;
  ex: Float32Array;
  ey: Float32Array;
  arr: Float32Array;
  dur: Float32Array;
  src: Int32Array;
  k: Float32Array;
  big: Uint8Array;
  spacingEm: number[];
}
interface Glow {
  cv: HTMLCanvasElement;
  ox: number;
  oy: number;
  w: number;
  h: number;
  S: number; // the size it was rasterised at (drawn scaled when the layout changes a little)
  dpr: number;
}
interface BandCurve {
  A: Vec;
  B: Vec;
  C: Vec;
  width: number;
  nx: (t: number) => Vec;
  tan: (t: number) => number;
}

function buildTimeline(): Timeline {
  // a human rhythm: slower on the same-finger 'll' and 'lo', a breath after the comma
  const gaps = [0, 0.088, 0.08, 0.135, 0.14, 0.105, 0.3, 0.085, 0.082, 0.078, 0.092, 0.11];
  const type: number[] = [];
  let s = 0;
  for (const g of gaps) {
    s += g;
    type.push(s);
  }
  // a held breath on "hello, world" (one caret blink), then backspace, speeding up slightly
  const del: number[] = [];
  for (const g of [0.85, 0.16, 0.14, 0.13, 0.12]) {
    s += g;
    del.push(s);
  }
  const lastDel = s;
  return {
    type,
    caretIn: -0.38,
    del,
    // the hand-offs overlap: the caret goes, "hello," glides and the light starts gathering at once
    caretOut: [lastDel + 0.05, lastDel + 0.25],
    glide: [lastDel + 0.1, lastDel + 0.95],
    cond0: lastDel + 0.3,
    stagger: 0.06,
    letterJitter: 0.16,
    flight: [0.8, 1.1],
    crisp: [],
    circle0: 0,
    circleDur: 1.7,
    done: 0,
    tickPass: new Float32Array(360),
  };
}

/** Rasterise one glyph into the (shared) scratch context, cropped to its ink box. */
function rasterGlyph(g: CanvasRenderingContext2D, ch: string, R: number): GlyphInk {
  const m = g.measureText(ch);
  const ox = Math.ceil(m.actualBoundingBoxLeft) + 2;
  const by = Math.ceil(m.actualBoundingBoxAscent) + 2;
  const W = Math.min(g.canvas.width, ox + Math.ceil(m.actualBoundingBoxRight) + 2);
  const H = Math.min(g.canvas.height, by + Math.ceil(m.actualBoundingBoxDescent) + 2);
  if (W < 1 || H < 1) return { xs: new Int16Array(0), ys: new Int16Array(0), n: 0, ox, by, R };
  g.clearRect(0, 0, W, H);
  g.fillText(ch, ox, by);
  const d = g.getImageData(0, 0, W, H).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] >= 128) n++;
  const xs = new Int16Array(n);
  const ys = new Int16Array(n);
  let k = 0;
  for (let y = 0, i = 3; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      if (d[i] >= 128) {
        xs[k] = x;
        ys[k] = y;
        k++;
      }
    }
  }
  return { xs, ys, n, ox, by, R };
}

/** Pick ~target ink pixels on a jittered grid (blue-noise-ish), in em units, sub-pixel jittered. */
function sampleInk(gi: GlyphInk, rng: Rng, target: number): GlyphSample {
  const n = gi.n;
  const R = gi.R;
  const res: GlyphSample = { pts: new Float32Array(0), n: 0, ink: n / (R * R), minY: 0, maxY: 0 };
  if (target <= 1 || n === 0) return res;
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const r = (rng() * (i + 1)) | 0;
    const tmp = idx[i];
    idx[i] = idx[r];
    idx[r] = tmp;
  }
  let cell = Math.sqrt(n / Math.max(1, target));
  const chosen: number[] = [];
  for (let iter = 0; iter < 10; iter++) {
    chosen.length = 0;
    const used = new Set<number>();
    for (let k = 0; k < n; k++) {
      const p = idx[k];
      const key = Math.floor(gi.xs[p] / cell) * 4096 + Math.floor(gi.ys[p] / cell);
      if (used.has(key)) continue;
      used.add(key);
      chosen.push(p);
    }
    if (chosen.length >= target || cell < 0.6) break;
    cell *= 0.9;
  }
  if (chosen.length > target) chosen.length = target;
  const pts = new Float32Array(chosen.length * 2);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let c = 0; c < chosen.length; c++) {
    const q = chosen[c];
    const py = (gi.ys[q] + rng() - gi.by) / R;
    pts[c * 2] = (gi.xs[q] + rng() - gi.ox) / R;
    pts[c * 2 + 1] = py;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  res.pts = pts;
  res.n = chosen.length;
  res.minY = minY;
  res.maxY = maxY;
  return res;
}

/** A family list the canvas actually accepts (an invalid font string is silently ignored). */
function usableFamily(family: string, style: string, fallback: string): string {
  if (!family) return fallback;
  const cv = makeCanvas(1, 1);
  try {
    const g = ctx2d(cv);
    g.font = style + ' 77px ' + family;
    return g.font.indexOf('77px') >= 0 ? family : fallback;
  } finally {
    release(cv);
  }
}

// ---------------------------------------------------------------------------
// Points grouped by key (sprite or colour × alpha bucket): one state change per group
// ---------------------------------------------------------------------------
class Bucketed {
  n = 0;
  readonly key: Int16Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly r: Float32Array;
  readonly order: Int32Array;
  readonly counts: Int32Array;
  private cursor: Int32Array;

  constructor(
    readonly nKeys: number,
    private cap: number,
  ) {
    this.key = new Int16Array(cap);
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.r = new Float32Array(cap);
    this.order = new Int32Array(cap);
    this.counts = new Int32Array(nKeys);
    this.cursor = new Int32Array(nKeys);
  }

  push(k: number, x: number, y: number, r: number) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.key[i] = k;
    this.x[i] = x;
    this.y[i] = y;
    this.r[i] = r;
    this.counts[k]++;
  }

  /** Fill `order` with the point indices grouped by key. */
  sort() {
    let acc = 0;
    for (let k = 0; k < this.nKeys; k++) {
      this.cursor[k] = acc;
      acc += this.counts[k];
    }
    for (let i = 0; i < this.n; i++) this.order[this.cursor[this.key[i]]++] = i;
  }

  reset() {
    this.n = 0;
    this.counts.fill(0);
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export class IntroEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private seed: number;
  private reduced: boolean;
  private manual: boolean;
  private onEvent: (name: IntroEventName) => void;
  private onDone: () => void;
  private getTarget: IntroEngineOptions['getTarget'];

  /** Seconds since start (story time: frozen while the tab is hidden). */
  t = 0;
  /** Script start, known once fonts are ready. */
  T0 = Infinity;
  /** When onDone fires (absolute t). */
  tDone = Infinity;
  /** Particles and timeline prepared: the script can play. */
  ready = false;
  private doneFired = false;
  private failed = false;
  private halted = false; // stopped for good (abort or failure): nothing may wake the loop
  private started = false;
  private disposed = false;
  private skipMode = 0; // a skip waiting for ready: 1 crossfade, 2 instant
  private skipAt = -1;
  private final = false; // in the final state (skip, startFinal, reduced motion)
  private fadeAtSkip = 1;
  private snapMain: HTMLCanvasElement | null = null;
  private snapText: HTMLCanvasElement | null = null;
  private snapTextAt = 0;
  private evIdx = 0;
  private events: [number, IntroEventName][] = [];
  private looping = false;
  private sleeping = false;
  private hidden = false;
  private raf = 0;
  private kickRaf = 0;
  private lastNow = 0;
  private lastRenderNow = 0;
  private frames = 0;
  private warmed = false;
  private timers: number[] = [];

  // fonts and the staged preparation (one stage per frame: 1 measure, 2 dissolve, 3 condense, 4 glows)
  private fonts: { mono: string; serif: string };
  private altSerif = '';
  private webFonts: { mono: string; serif: string } | null = null; // set while local stand-ins are drawn
  private hurryFonts: ((ms: number) => void) | null = null;
  private swapFontsAtDone = false;
  private stage = 0;

  // sizes and deferred work
  private w = 0;
  private h = 0;
  private dpr = 1;
  private refDpr = 1; // the density the look is designed for: min(device DPR, 2), even when the sky is drawn lower
  private dprText = 1;
  private dprTextEff = 1;
  private maxSkyDpr = MAX_DPR_SKY;
  private maxTextDpr = MAX_DPR_TEXT;
  private pendingResize = false;
  private pendingLayout = false;
  private stableFrames = 0;
  private layersStale = false;
  private glowsStale = false;
  private condenseStale = false;
  private textDirty = true;
  private textPhase = -1;
  private frameMs = new Float32Array(16);
  private frameN = 0;
  private dprSteps = 0;

  private L: Layout | null = null;
  private metrics: Metrics | null = null;
  private timeline: Timeline = buildTimeline();
  private stars: Stars | null = null;
  private nBase = 0;
  private starBase = 0.6;
  private D: Dissolve | null = null;
  private C: Condense | null = null;
  private rectDots = new Bucketed(4 * NB, 4096);
  private spriteDots = new Bucketed(4 * NB, 4096);
  private radL = new Float64Array(WORLD.length);
  private crispL = new Float64Array(SERIF_TEXT.length);
  private gxL = new Float64Array(SERIF_TEXT.length);
  private spcL = new Float64Array(SERIF_TEXT.length);

  // layers
  private backdrop: HTMLDivElement | null = null;
  private bg: HTMLCanvasElement | null = null;
  private band: HTMLCanvasElement | null = null;
  private textCv: HTMLCanvasElement | null = null;
  private tctx: CanvasRenderingContext2D | null = null;
  private bandN = 0;
  private bgDithered = false;
  private bakedTheta = NaN; // the sky angle the band was baked at
  private lastBgA = -1;
  private sprites: HTMLCanvasElement[] = [];
  private pSprites: HTMLCanvasElement[] = [];
  private spark: HTMLCanvasElement | null = null;
  private glows: (Glow | null)[] = [];
  private starBucketStyles: string[] = [];
  private rectStyles: string[] = [];
  private starCounts = new Int32Array(4 * NB);
  private starCursor = new Int32Array(4 * NB);
  private sprIdx = new Int32Array(512);

  constructor(canvas: HTMLCanvasElement, opts: IntroEngineOptions = {}) {
    this.canvas = canvas;
    this.ctx = ctx2d(canvas, { alpha: true });
    this.seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
    this.reduced = !!opts.reducedMotion;
    this.manual = !!opts.manual;
    if (opts.startFinal) this.skipMode = 2;
    this.onEvent = opts.onEvent || (() => {});
    this.onDone = opts.onDone || (() => {});
    this.getTarget = opts.getTarget;
    for (let c = 0; c < 4; c++) {
      for (let b = 0; b < NB; b++) {
        this.starBucketStyles.push(rgba(STAR_COLS[c], (b + 0.5) / NB));
        const p = PART_COLS[c];
        const hot: RGB = [Math.min(255, p[0] + 12), Math.min(255, p[1] + 12), Math.min(255, p[2] + 12)];
        this.rectStyles.push(rgba(hot, ((b + 0.5) / NB) * RECT_GAIN));
      }
    }
    const cs = getComputedStyle(canvas);
    this.fonts = {
      mono: cs.getPropertyValue('--font-mono-intro').trim(),
      serif: cs.getPropertyValue('--font-serif-intro').trim(),
    };
    this.altSerif = cs.getPropertyValue('--font-newsreader').trim();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    const alt = this.altSerif ? usableFamily(this.altSerif + ', Georgia, serif', 'italic 500', '') : '';
    this.fonts = {
      mono: usableFamily(this.fonts.mono, '400', FALLBACK_MONO),
      serif: usableFamily(this.fonts.serif, 'italic 500', alt || FALLBACK_SERIF),
    };
    this.createLayers();
    this.applyResize();
    if (this.manual || this.reduced) {
      this.makeBand(); // otherwise on the first frames, while the night is still fading in
      this.makeBackground();
    }
    this.render(this.t); // the night, before anything else
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    if (this.reduced) this.later(() => this.fireDone(), REDUCED_HANDOVER_MS);
    this.loadFonts();
    if (this.skipMode && this.hurryFonts) this.hurryFonts(SKIP_FONT_WAIT_MS);
    if (!this.manual && !this.reduced && !this.disposed && !this.failed) {
      this.looping = true;
      this.lastNow = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    this.hurryFonts = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    for (const cv of [this.canvas, this.bg, this.textCv]) cv?.removeEventListener('contextrestored', this.onRestore);
    release(this.snapMain);
    release(this.snapText);
    release(this.spark);
    this.sprites.forEach(release);
    this.pSprites.forEach(release);
    this.glows.forEach((g) => release(g && g.cv));
    release(this.bg);
    release(this.band);
    release(this.textCv);
    this.backdrop?.remove();
    this.textCv?.remove();
    this.snapMain = this.snapText = this.spark = this.bg = this.band = this.textCv = null;
    this.backdrop = null;
    this.tctx = null;
    this.sprites = [];
    this.pSprites = [];
    this.glows = [];
  }

  /** Jump to the final state with a 400 ms crossfade (no-op once done). */
  skip() {
    if (this.disposed || this.halted || this.doneFired || this.final || this.reduced) return;
    if (!this.ready) {
      if (!this.skipMode) this.skipMode = 1;
      if (this.stage > 0) this.guard(() => this.runStages()); // the fonts are in: finish preparing now
      else if (this.hurryFonts) this.hurryFonts(SKIP_FONT_WAIT_MS);
      return;
    }
    this.enterFinal(true);
  }

  /** Stop animating and hand over now (the page's last-resort watchdog). */
  abort() {
    if (this.disposed) return;
    this.halted = true;
    this.stopLoop();
    this.fireDone();
  }

  /** The canvas box or the device pixel ratio changed: applied once, on the next frame. */
  resize() {
    if (this.disposed) return;
    this.pendingResize = true;
    this.kick();
  }

  /** The target rect changed: lay out again without restarting (applied on the next frame). */
  relayout() {
    if (this.disposed) return;
    this.pendingLayout = true;
    this.kick();
  }

  /** Deterministic render at time t (manual mode, captures, tests). */
  renderAt(t: number) {
    if (t < this.t) this.evIdx = 0;
    this.t = t;
    this.render(t);
  }

  private enterFinal(crossfade: boolean) {
    this.skipMode = 0;
    this.final = true;
    if (crossfade) {
      this.snapMain = this.snapshot(this.canvas);
      this.snapText = this.textPhase > 0 ? this.snapshot(this.textCv) : null;
      this.snapTextAt = this.t;
      this.fadeAtSkip = this.bgAlpha(this.t);
      this.skipAt = this.t;
      this.tDone = this.t + SKIP_FADE;
    } else {
      this.skipAt = this.t - SKIP_FADE;
      this.tDone = this.t;
    }
    this.textDirty = true;
  }

  private snapshot(cv: HTMLCanvasElement | null): HTMLCanvasElement | null {
    if (!cv || cv.width < 2 || cv.height < 2) return null;
    const c = makeCanvas(cv.width, cv.height);
    ctx2d(c).drawImage(cv, 0, 0);
    return c;
  }

  private fireDone() {
    if (this.doneFired || this.disposed) return;
    this.doneFired = true;
    if (!(this.tDone <= this.t)) this.tDone = this.t;
    try {
      this.onDone();
    } catch (e) {
      rethrowLater(e);
    }
    if (this.swapFontsAtDone && this.webFonts && !this.failed) {
      this.swapFontsAtDone = false;
      this.swapFontsFinal();
    }
  }

  private emit(name: IntroEventName) {
    try {
      this.onEvent(name);
    } catch (e) {
      rethrowLater(e);
    }
  }

  /** Something broke: stop where we are and hand over, rather than leave a stuck overlay. */
  private failOpen(err: unknown) {
    if (this.failed || this.disposed) return;
    this.failed = true;
    this.halted = true;
    this.stopLoop();
    try {
      console.warn('[intro] stopped after an error, handing over:', err);
    } catch {
      /* no console */
    }
    this.fireDone();
  }

  private guard(fn: () => void) {
    if (this.disposed || this.failed) return;
    try {
      fn();
    } catch (e) {
      this.failOpen(e);
    }
  }

  private later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => this.guard(fn), ms);
    this.timers.push(id);
    return id;
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.kickRaf) cancelAnimationFrame(this.kickRaf);
    this.raf = this.kickRaf = 0;
    this.sleeping = true;
  }

  /** Render once soon when the loop is not running (manual, reduced, asleep, hidden). */
  private kick() {
    if (this.disposed || this.halted || !this.started) return;
    if (this.looping) {
      if (this.sleeping) this.wake();
      return; // the loop applies pending work
    }
    if (this.kickRaf) return;
    this.kickRaf = requestAnimationFrame(() => {
      this.kickRaf = 0;
      this.guard(() => this.render(this.t));
    });
  }

  private wake() {
    if (!this.looping || !this.sleeping || this.disposed || this.halted) return;
    this.sleeping = false;
    this.lastNow = performance.now();
    if (!this.raf && !this.hidden) this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.halted || this.hidden || this.sleeping) return;
    try {
      let dt = (now - this.lastNow) / 1000;
      this.lastNow = now;
      if (!(dt > 0)) dt = 0;
      if (dt > 0 && this.frameN < 1e9) this.frameMs[this.frameN++ % this.frameMs.length] = dt * 1000;
      if (dt > 0.1) dt = 0.1; // a hidden tab or a hitch never skips the story ahead
      this.t += dt;
      if (++this.frames % 30 === 0) this.checkDevicePixelRatio();
      // startup work, one piece per frame
      if (!this.bandN) this.makeBand();
      else if (!this.bgDithered) this.makeBackground();
      else if (this.stage > 0 && this.stage < 5) this.runStage();
      this.maintain();
      if (this.doneFired) {
        const since = this.t - this.tDone;
        const busy = this.busy();
        if (since > IDLE_STOP && !busy) {
          // the sky has settled: one last frame, then nothing until something changes
          this.render(this.t);
          this.sleeping = true;
          return;
        }
        if (since > 1 && !busy && now - this.lastRenderNow < IDLE_FRAME_MS) {
          this.raf = requestAnimationFrame(this.loop);
          return;
        }
      }
      this.lastRenderNow = now;
      this.render(this.t);
      if (!this.disposed && !this.halted && !this.sleeping) this.raf = requestAnimationFrame(this.loop);
    } catch (e) {
      this.failOpen(e);
    }
  };

  private busy() {
    return !!(this.snapMain || this.snapText || this.pendingResize || this.pendingLayout || this.layersStale || this.glowsStale);
  }

  private onVisibility = () => {
    if (this.disposed) return;
    const hidden = document.visibilityState === 'hidden';
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (this.looping && !this.sleeping && !this.halted && !this.raf) {
      this.lastNow = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private onRestore = () => {
    // the browser dropped a canvas backing store: every pre-rendered layer must be rebuilt
    this.guard(() => {
      this.sprites.forEach(release);
      this.sprites = [];
      this.makeSprites();
      this.makeBand();
      this.makeBackground();
      if (this.stage >= 5) this.makeGlows();
      this.textDirty = true;
      this.lastBgA = -1;
      this.kick();
    });
  };

  // -------------------------------------------------------------------------
  // Fonts and the staged preparation
  // -------------------------------------------------------------------------
  private loadFonts() {
    const fs = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fs || typeof fs.load !== 'function') {
      this.guard(() => this.fontsReady(true));
      return;
    }
    const f = this.fonts;
    let settled = false;
    let timer = 0;
    let deadline = performance.now() + FONT_TIMEOUT_MS;
    const settle = (inTime: boolean) => {
      if (settled || this.disposed) return;
      settled = true;
      clearTimeout(timer);
      this.hurryFonts = null;
      this.guard(() => this.fontsReady(inTime));
    };
    timer = this.later(() => settle(false), FONT_TIMEOUT_MS);
    this.hurryFonts = (ms: number) => {
      const d = performance.now() + ms;
      if (d >= deadline) return;
      deadline = d;
      clearTimeout(timer);
      timer = this.later(() => settle(false), ms);
    };
    const ok = (p: Promise<unknown>) => p.then(
      () => true,
      () => false,
    );
    Promise.all([ok(fs.load('400 40px ' + f.mono, MONO_TEXT)), ok(fs.load('italic 500 40px ' + f.serif, SERIF_TEXT))]).then(
      ([okMono, okSerif]) => {
        if (this.disposed) return;
        if (!settled) settle(true);
        else if (this.webFonts) {
          // late: swap them in when safe; if they failed for good, the stand-ins stay
          if (okMono || okSerif) this.guard(() => this.lateFontsArrived());
          else this.webFonts = null;
        }
      },
    );
  }

  private fontsReady(inTime: boolean) {
    if (!inTime) {
      // the web fonts are late: the whole intro is drawn in faces that cannot change under it,
      // and the real ones are swapped in when it is safe (before typing, or after onDone)
      this.webFonts = this.fonts;
      this.fonts = { mono: LOCAL_MONO, serif: LOCAL_SERIF };
    }
    this.stage = 1;
    if (!this.looping || this.skipMode) this.runStages(); // otherwise one stage per frame
  }

  private runStages() {
    while (this.stage > 0 && this.stage < 5) this.runStage();
    if (!this.looping) this.render(this.t);
  }

  private runStage() {
    switch (this.stage) {
      case 1:
        this.prepare();
        break;
      case 2:
        this.makeDissolve();
        break;
      case 3:
        this.makeCondense();
        this.ready = true;
        if (this.reduced) this.enterFinal(false);
        else if (this.skipMode) this.enterFinal(this.skipMode === 1);
        // the script's real start moves the resting angle a little: bake the band there again
        if (Math.abs(this.restTheta() - this.bakedTheta) > 0.004) {
          if (this.looping) this.layersStale = true;
          else this.makeBackground();
        }
        break;
      case 4:
        this.makeGlows();
        break;
    }
    this.stage++;
  }

  /** Stage 1: metrics and glyph ink, the script's start, the text layout. */
  private prepare() {
    this.measure();
    if (!isFinite(this.T0)) this.T0 = this.manual ? T0_MIN : Math.max(T0_MIN, this.t + T0_CUSHION);
    this.layoutText();
  }

  private lateFontsArrived() {
    if (!this.webFonts || this.disposed || this.failed) return;
    const s = this.t - this.T0;
    if (!this.final && (!this.ready || !(s >= this.timeline.type[0] - 0.05))) {
      // nothing typed yet: prepare again in the real faces, the script keeps its start
      this.fonts = this.webFonts;
      this.webFonts = null;
      const st = this.stars;
      if (st) {
        st.n = this.nBase;
        for (let i = 0; i < st.n; i++) st.dim[i] = NaN;
      }
      this.D = null;
      this.C = null;
      this.ready = false;
      this.warmed = false;
      this.events = [];
      this.evIdx = 0;
      this.tDone = Infinity;
      this.stage = 1;
      if (!this.looping || this.skipMode) this.runStages();
    } else if (this.doneFired) {
      this.swapFontsFinal();
    } else {
      this.swapFontsAtDone = true;
    }
  }

  /** After onDone: the real faces replace the stand-ins, crossfading the static lockup. */
  private swapFontsFinal() {
    const web = this.webFonts;
    if (!web) return;
    this.webFonts = null;
    this.fonts = web;
    const snap = this.reduced || this.textPhase <= 0 ? null : this.snapshot(this.textCv);
    this.measure();
    this.layoutText();
    this.makeGlows();
    if (snap) {
      release(this.snapText);
      this.snapText = snap;
      this.snapTextAt = this.t;
    }
    this.textDirty = true;
    this.kick();
  }

  // -------------------------------------------------------------------------
  // Layers
  // -------------------------------------------------------------------------
  private createLayers() {
    const cv = this.canvas;
    const parent = cv.parentElement;
    if (!parent) throw new Error('The intro canvas must be in the document');
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    if (getComputedStyle(cv).position === 'static') cv.style.position = 'relative';
    const back = document.createElement('div');
    back.setAttribute('aria-hidden', 'true');
    Object.assign(back.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    const bg = document.createElement('canvas');
    Object.assign(bg.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      opacity: '0',
    });
    back.append(bg);
    parent.insertBefore(back, cv);
    const text = document.createElement('canvas');
    text.setAttribute('aria-hidden', 'true');
    Object.assign(text.style, { position: 'absolute', left: '0', top: '0', display: 'block', pointerEvents: 'none' });
    parent.insertBefore(text, cv.nextSibling);
    this.backdrop = back;
    this.bg = bg;
    this.band = document.createElement('canvas'); // offscreen: painted once, baked into the night
    this.textCv = text;
    this.tctx = ctx2d(text, { alpha: true });
    for (const c of [cv, bg, text]) c.addEventListener('contextrestored', this.onRestore);
  }

  private bgAlpha(t: number) {
    return this.reduced ? 1 : smoothstep(0, 0.9, t);
  }

  /** The backdrop costs no drawing per frame: only its opacity, while the night fades in. */
  private updateBackdrop(t: number, final: boolean, skipK: number) {
    const bg = this.bg;
    if (!bg) return;
    let a = this.bgAlpha(t);
    if (final) a = Math.max(a, lerp(this.fadeAtSkip, 1, easeOutCubic(skipK)));
    if (Math.abs(a - this.lastBgA) > 0.002 || (a === 1 && this.lastBgA !== 1)) {
      this.lastBgA = a;
      bg.style.opacity = a >= 1 ? '1' : a.toFixed(4);
    }
  }

  /** The sky's angle once it has settled after the intro: the band is baked into the night there. */
  private restTheta() {
    if (this.reduced) return 0;
    const tRest = isFinite(this.tDone) ? this.tDone : (isFinite(this.T0) ? this.T0 : T0_MIN) + (this.timeline.done || 6.4);
    return -OMEGA * (tRest + DECEL_TAU);
  }

  // -------------------------------------------------------------------------
  // Sizing / layout (applied on a frame, never from the resize callback itself)
  // -------------------------------------------------------------------------
  private checkDevicePixelRatio() {
    const dev = window.devicePixelRatio || 1;
    if (Math.min(this.maxSkyDpr, dev) !== this.dpr || Math.min(this.maxTextDpr, dev) !== this.dprText) this.pendingResize = true;
  }

  private applyPending() {
    if (this.pendingResize) {
      this.pendingResize = false;
      this.applyResize();
    }
    if (this.pendingLayout) {
      this.pendingLayout = false;
      if (this.L) this.layout(false);
    }
  }

  private applyResize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dev = window.devicePixelRatio || 1;
    const dpr = Math.min(this.maxSkyDpr, dev);
    const dprT = Math.min(this.maxTextDpr, dev);
    if (this.L && w === this.w && h === this.h && dpr === this.dpr && dprT === this.dprText) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.refDpr = Math.min(MAX_DPR_SKY, dev);
    this.dprText = dprT;
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.layout(!this.L);
  }

  private layout(full: boolean) {
    const w = this.w;
    const h = this.h;
    let tg: IntroTargetRect | null | undefined = null;
    try {
      tg = this.getTarget ? this.getTarget(w, h) : null;
    } catch {
      tg = null;
    }
    const prev = this.L;
    this.L = {
      cx: tg && isFinite(tg.cx) ? tg.cx : w / 2,
      cy: tg && isFinite(tg.cy) ? tg.cy : h / 2,
      r: tg && isFinite(tg.r) && tg.r > 0 ? tg.r : Math.min(w, h) * 0.42,
      sky: { L: SKY_SCALE * Math.max(w, h), Cx: w / 2, Cy: h / 2, Px: w * 0.44, Py: -0.2 * h },
      S: prev ? prev.S : 0,
      M: prev ? prev.M : 0,
      xFinal: 0,
      serifX: 0,
      xTyped: 0,
      baseline: 0,
      adv: 0,
      textCx: 0,
      textCy: 0,
      textW: 0,
      monoFont: '',
      serifFont: '',
      gold: '#c9a25b',
      box: { x: 0, y: 0, w: 1, h: 1 },
    };
    if (!this.stars) this.makeStars();
    this.makeSprites();
    this.recomputeStarSizes();
    this.placeTextLayer();
    // the background is stretched by CSS until the size has settled, then painted again
    if (full) this.makeBackground(true);
    else if (!this.looping) this.rebuildLayers();
    else this.layersStale = true;
    this.stableFrames = 0;
    if (this.metrics) this.layoutText();
  }

  /** Deferred, cheap upkeep: layers, glows and the gathering re-planned once the layout is stable. */
  private maintain() {
    this.stableFrames++;
    const tl = this.timeline;
    const s = this.t - this.T0;
    if (this.layersStale && this.stableFrames >= STABLE_FRAMES) {
      this.layersStale = false;
      this.rebuildLayers();
    }
    if (this.condenseStale && this.ready && (this.stableFrames >= STABLE_FRAMES || s > tl.cond0 - 0.3)) {
      this.condenseStale = false;
      if (s < tl.cond0 - 0.02) this.assignCondense();
    }
    if (this.glowsStale && this.stage >= 5) {
      const gw = this.glows.find((g) => g);
      const off = gw && this.L ? Math.abs(this.L.S / gw.S - 1) : 1;
      if (this.stableFrames >= 3 || off > 0.25) this.makeGlows();
    }
    this.adaptDpr(s);
  }

  /**
   * A rolling check (median of the last 16 frames) from just before typing until the limb closes:
   * if frames are slow the sky is drawn at DPR 1.5, then 1.25 (straight to 1.25 if far too slow
   * before typing, while the stars are still fading in). Two steps at most, never back up. The
   * text layer keeps DPR 2, so the name stays sharp.
   */
  private adaptDpr(s: number) {
    if (this.manual || this.dprSteps >= 2 || !this.ready || this.final || this.doneFired) return;
    if (!(s >= -0.12) || s > this.timeline.done) return;
    if (this.frameN < 16 || this.frameN % 8 !== 0) return;
    const med = median(this.frameMs, 16);
    let cap = this.maxSkyDpr;
    if (this.dprSteps === 0 && s < 0 && med > VERY_SLOW_FRAME_MS) cap = LOWER_DPR_SKY;
    else if (med > SLOW_FRAME_MS) cap = cap > LOW_DPR_SKY ? LOW_DPR_SKY : LOWER_DPR_SKY;
    if (cap < this.maxSkyDpr && this.dpr > cap) {
      this.maxSkyDpr = cap;
      this.maxTextDpr = 2;
      this.pendingResize = true;
      this.dprSteps++;
      this.frameN = 0; // judge the new resolution on its own frames
    }
  }

  private rebuildLayers() {
    const L = this.L;
    if (L && this.bandN) {
      const N = Math.max(128, Math.min(1024, Math.ceil(L.sky.L * 0.5)));
      if (Math.abs(N - this.bandN) > 0.25 * this.bandN) this.makeBand();
    }
    this.makeBackground();
  }

  /** The text layer covers the limb's box (on a 16 px grid, inside the viewport). */
  private placeTextLayer() {
    const L = this.L;
    const cv = this.textCv;
    if (!L || !cv) return;
    const m = Math.max(12, 0.06 * L.r);
    const G = 16;
    let x0 = Math.max(0, Math.floor((L.cx - L.r - m) / G) * G);
    let y0 = Math.max(0, Math.floor((L.cy - L.r - m) / G) * G);
    let x1 = Math.min(this.w, Math.ceil((L.cx + L.r + m) / G) * G);
    let y1 = Math.min(this.h, Math.ceil((L.cy + L.r + m) / G) * G);
    if (x1 - x0 < 1 || y1 - y0 < 1) {
      x0 = y0 = 0;
      x1 = y1 = 1;
    }
    const bw = x1 - x0;
    const bh = y1 - y0;
    let k = this.dprText;
    if (bw * bh * k * k > MAX_TEXT_PX) k = Math.max(1, Math.sqrt(MAX_TEXT_PX / (bw * bh)));
    const cw = Math.max(1, Math.round(bw * k));
    const ch = Math.max(1, Math.round(bh * k));
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    this.dprTextEff = k;
    const s = cv.style;
    s.left = x0 + 'px';
    s.top = y0 + 'px';
    s.width = cw / k + 'px';
    s.height = ch / k + 'px';
    L.box = { x: x0, y: y0, w: bw, h: bh };
    this.textDirty = true;
  }

  private layoutText() {
    const M = this.metrics;
    const L = this.L;
    if (!M || !L) return;
    const w = this.w;
    const helloAdv = HELLO_N * M.adv * MONO_RATIO; // in S units
    const inkL = MONO_RATIO * M.monoInkL;
    const inkR = helloAdv - KERN + M.serifInkR;
    const inkW = inkR - inkL;
    const gutter = Math.max(18, w * 0.06);
    const maxW = Math.max(40, Math.min(w - 2 * gutter, 1.62 * L.r));
    const S = Math.max(8, Math.min(maxW / inkW, 0.27 * L.r, 112));
    const Mz = S * MONO_RATIO;
    L.S = S;
    L.M = Mz;
    L.xFinal = L.cx - ((inkL + inkR) / 2) * S;
    L.serifX = L.xFinal + (helloAdv - KERN) * S;
    L.xTyped = L.cx - ((M.monoInkL + M.typedInkR) / 2) * Mz;
    const top = Math.max(M.serifAsc * S, M.monoAsc * Mz);
    const bot = Math.max(M.serifDesc * S, M.monoDesc * Mz);
    L.baseline = L.cy - 0.06 * L.r + (top - bot) / 2; // the line sits slightly above centre
    L.adv = M.adv * Mz;
    L.textCx = L.cx;
    L.textCy = L.baseline - 0.3 * S;
    L.textW = inkW * S;
    L.monoFont = '400 ' + Mz.toFixed(2) + 'px ' + this.fonts.mono;
    L.serifFont = 'italic 500 ' + S.toFixed(2) + 'px ' + this.fonts.serif;
    if (this.tctx) {
      const gr = this.tctx.createLinearGradient(0, L.baseline - M.serifAsc * S, 0, L.baseline + 0.04 * S);
      gr.addColorStop(0, '#ead6a0');
      gr.addColorStop(1, '#c9a25b');
      L.gold = gr;
    }
    this.textDirty = true;
    // glows: drawn scaled until the size settles, then rasterised again
    const gw = this.glows.find((g) => g);
    if (gw && (gw.dpr !== this.dpr || Math.abs(S / gw.S - 1) > 0.02)) this.glowsStale = true;
    if (this.glowsStale && !this.looping && this.stage >= 5) this.makeGlows();
    // the plume stars that have not landed yet are placed again around the word
    if (this.D) this.placePlume(false);
    this.markQuiet();
    // the gathering is planned again (sources, timings) if it has not begun
    if (this.C && this.ready && this.t - this.T0 < this.timeline.cond0 - 0.05) {
      if (this.looping) this.condenseStale = true;
      else this.assignCondense();
    }
  }

  private recomputeStarSizes() {
    const st = this.stars;
    if (!st) return;
    // stars keep their size on screen when a slow device draws the sky at a lower DPR
    const base = Math.max(1.2 / this.refDpr, 0.55);
    this.starBase = base;
    for (let i = 0; i < st.n; i++) {
      const I = st.I[i];
      st.sz[i] = base * (I < 2.6 ? 1 : 1 + 0.2 * (I - 2.6));
    }
  }

  // -------------------------------------------------------------------------
  // Fonts → metrics and glyph ink (once per face)
  // -------------------------------------------------------------------------
  private measure() {
    const R = 120;
    const f = this.fonts;
    const monoFont = '400 ' + R + 'px ' + f.mono;
    const serifFont = 'italic 500 ' + R + 'px ' + f.serif;
    const cv = makeCanvas(2 * R, 2 * R);
    try {
      const g = ctx2d(cv, { willReadFrequently: true });
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      g.fillStyle = '#fff';
      g.font = monoFont;
      const adv = g.measureText('0').width / R;
      const mt = g.measureText(MONO_TEXT);
      const mh = g.measureText('hello,');
      const worldInk = WORLD.split('').map((ch) => rasterGlyph(g, ch, R));
      g.font = serifFont;
      const st = g.measureText(SERIF_TEXT);
      const serifOff: number[] = [];
      for (let i = 0; i < SERIF_TEXT.length; i++) {
        const pre = g.measureText(SERIF_TEXT.slice(0, i + 1)).width;
        const one = g.measureText(SERIF_TEXT[i]).width;
        serifOff.push((pre - one) / R); // includes kerning with the previous letter
      }
      const serifGlyphs = SERIF_TEXT.split('').map((ch) => (ch === ' ' ? null : rasterGlyph(g, ch, R)));
      const rng = mulberry32(this.seed ^ 0x51ed);
      const inks = worldInk.map((gi) => gi.n / (R * R));
      const maxInk = Math.max(1e-6, ...inks);
      const worldSamples = worldInk.map((gi, j) => sampleInk(gi, rng, Math.round(46 + 34 * (inks[j] / maxInk))));
      const serifInk = serifGlyphs.map((gi) => (gi ? gi.n / (R * R) : 0));
      this.metrics = {
        adv,
        monoInkL: -mt.actualBoundingBoxLeft / R,
        typedInkR: mt.actualBoundingBoxRight / R,
        monoAsc: mh.actualBoundingBoxAscent / R,
        monoDesc: mh.actualBoundingBoxDescent / R,
        serifInkR: st.actualBoundingBoxRight / R,
        serifAsc: st.actualBoundingBoxAscent / R,
        serifDesc: st.actualBoundingBoxDescent / R,
        serifOff,
        worldSamples,
        serifGlyphs,
        serifInk,
        serifInkTotal: serifInk.reduce((a, b) => a + b, 0),
      };
    } finally {
      release(cv);
    }
  }

  // -------------------------------------------------------------------------
  // Stars
  // -------------------------------------------------------------------------
  private makeStars() {
    const L = this.L!;
    const rng = mulberry32(this.seed ^ 0xa11ce);
    const w = this.w;
    const h = this.h;
    const Ls = L.sky.L;
    const visTarget = Math.min(1300, Math.max(380, (w * h) / 430));
    const nBase = Math.min(2800, Math.round(visTarget * ((Ls * Ls) / (w * h))));
    const cap = nBase + 420;
    const st: Stars = {
      n: nBase,
      u: new Float32Array(cap),
      v: new Float32Array(cap),
      I: new Float32Array(cap),
      a: new Float32Array(cap),
      sz: new Float32Array(cap),
      col: new Uint8Array(cap),
      spr: new Uint8Array(cap),
      sprR: new Float32Array(cap),
      tA: new Float32Array(cap),
      f1: new Float32Array(cap),
      f2: new Float32Array(cap),
      p1: new Float32Array(cap),
      p2: new Float32Array(cap),
      appear: new Float32Array(cap),
      born: new Float32Array(cap),
      dim: new Float32Array(cap),
      quiet: new Uint8Array(cap),
      x: new Float32Array(cap),
      y: new Float32Array(cap),
      al: new Float32Array(cap),
      key: new Int16Array(cap),
      order: new Int32Array(cap),
    };
    this.stars = st;
    this.nBase = nBase;
    const band = this.bandCurve();
    // N(<m) ∝ 10^(0.47 m), m from −1.2 to 6.6: a natural, faint-heavy magnitude distribution
    const lo = Math.pow(10, 0.47 * -1.2);
    const hi = Math.pow(10, 0.47 * 6.6);
    const NBIN = 1024;
    const bin = new Int32Array(nBase);
    const cnt = new Int32Array(NBIN + 1);
    for (let i = 0; i < nBase; i++) {
      let m: number;
      if (rng() < 0.3) {
        // dust of the milky band
        const a = rng();
        const p = quad(band.A, band.C, band.B, a);
        const nx = band.nx(a);
        const off = gauss(rng) * band.width * 0.32;
        st.u[i] = p[0] + nx[0] * off;
        st.v[i] = p[1] + nx[1] * off;
        m = 4.7 + 1.9 * Math.pow(rng(), 0.6);
      } else {
        st.u[i] = rng() - 0.5;
        st.v[i] = rng() - 0.5;
        m = Math.log(lo + rng() * (hi - lo)) / (0.47 * Math.LN10);
      }
      const cr = rng();
      this.setStarLook(i, m, rng, cr < 0.22 ? 0 : cr < 0.67 ? 1 : cr < 0.9 ? 2 : 3);
      st.born[i] = NaN;
      st.dim[i] = NaN;
      const b = Math.min(NBIN - 1, Math.max(0, Math.floor(((m + 1.2) / 7.8) * NBIN)));
      bin[i] = b;
      cnt[b + 1]++;
    }
    // brightest first, as at dusk (a counting sort on magnitude)
    for (let b = 0; b < NBIN; b++) cnt[b + 1] += cnt[b];
    for (let i = 0; i < nBase; i++) {
      const rank = cnt[bin[i]]++;
      st.appear[i] = 0.06 + 1.0 * Math.pow(rank / nBase, 0.8) + rng() * 0.1;
    }
  }

  private setStarLook(i: number, m: number, rng: Rng, col: number) {
    const st = this.stars!;
    const I = Math.pow(10, -0.2 * (m - 6.6));
    st.I[i] = I;
    st.a[i] = Math.min(1, 0.24 + 0.135 * (I - 1));
    st.col[i] = col;
    st.spr[i] = I > 6.2 ? 1 : 0;
    st.sprR[i] = 2.8 + 0.45 * (I - 6.2);
    st.tA[i] = 0.1 + 0.28 * rng();
    const f = TAU * (0.2 + 0.7 * rng());
    st.f1[i] = f;
    st.f2[i] = f * (2.1 + 0.6 * rng());
    st.p1[i] = TAU * rng();
    st.p2[i] = TAU * rng();
  }

  /** Bright stars (the new ones from "world" too) that would rest behind the lockup shine like faint ones instead. */
  private markQuiet() {
    const st = this.stars;
    const L = this.L;
    if (!st || !L || !L.S) return;
    const T0 = isFinite(this.T0) ? this.T0 : T0_MIN;
    const th = this.reduced ? 0 : -OMEGA * (T0 + (this.timeline.done || 6.4) + DECEL_TAU);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const sky = L.sky;
    const ax = L.textW / 2 + 0.6 * L.S;
    const ay = 1.1 * L.S;
    for (let i = 0; i < st.n; i++) {
      st.quiet[i] = 0;
      if (!(st.spr[i] || st.a[i] > 0.45)) continue;
      const bx = sky.Cx + st.u[i] * sky.L - sky.Px;
      const by = sky.Cy + st.v[i] * sky.L - sky.Py;
      const qx = (sky.Px + bx * c - by * sn - L.textCx) / ax;
      const qy = (sky.Py + bx * sn + by * c - L.textCy) / ay;
      if (qx * qx + qy * qy < 1) st.quiet[i] = 1;
    }
  }

  /** Milky band: a steep diagonal from lower left to upper right, passing just right of the text. */
  private bandCurve(): BandCurve {
    const cxu = 0.07;
    const cyv = -0.06;
    const ang = (-65 * Math.PI) / 180;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const A: Vec = [cxu - 0.85 * dx, cyv - 0.85 * dy];
    const B: Vec = [cxu + 0.85 * dx, cyv + 0.85 * dy];
    const C: Vec = [cxu - 0.06 * dy, cyv + 0.06 * dx];
    const tangent = (t: number): Vec => [
      2 * (1 - t) * (C[0] - A[0]) + 2 * t * (B[0] - C[0]),
      2 * (1 - t) * (C[1] - A[1]) + 2 * t * (B[1] - C[1]),
    ];
    return {
      A,
      B,
      C,
      width: 0.13,
      nx: (t) => {
        const [tx, ty] = tangent(t);
        const l = Math.sqrt(tx * tx + ty * ty) || 1;
        return [-ty / l, tx / l];
      },
      tan: (t) => {
        const [tx, ty] = tangent(t);
        return Math.atan2(ty, tx);
      },
    };
  }

  /** Screen position of a sky point (u, v) at rotation th (captures and tests). */
  skyToScreen(u: number, v: number, th: number, out: Vec) {
    const s = this.L!.sky;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const bx = s.Cx + u * s.L - s.Px;
    const by = s.Cy + v * s.L - s.Py;
    out[0] = s.Px + bx * c - by * sn;
    out[1] = s.Py + bx * sn + by * c;
    return out;
  }

  private screenToSky(x: number, y: number, th: number, out: Vec) {
    const s = this.L!.sky;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const bx = x - s.Px;
    const by = y - s.Py;
    out[0] = (bx * c + by * sn + s.Px - s.Cx) / s.L;
    out[1] = (-bx * sn + by * c + s.Py - s.Cy) / s.L;
    return out;
  }

  /** Sky rotation about a pole above the top edge; it eases to stillness after the intro. */
  private theta(t: number) {
    if (this.reduced) return 0;
    if (t <= this.tDone) return -OMEGA * t;
    const d = t - this.tDone;
    return -(OMEGA * this.tDone + OMEGA * DECEL_TAU * (1 - Math.exp(-d / DECEL_TAU)));
  }

  // -------------------------------------------------------------------------
  // Pre-rendered layers
  // -------------------------------------------------------------------------
  /**
   * Radial night (#0b1230 → #070a14), dithered so the gradient never bands. `quick`: a plain
   * gradient for the first frames (the night is then still fading in from the page colour); the
   * dithered one follows on a frame of its own.
   */
  private makeBackground(quick = false) {
    const L = this.L;
    const cv = this.bg;
    if (!L || !cv) return;
    const w = this.w;
    const h = this.h;
    const sc = Math.min(1, 720 / Math.max(w, h));
    const bw = Math.max(2, Math.round(w * sc));
    const bh = Math.max(2, Math.round(h * sc));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const g = ctx2d(cv, { alpha: false });
    if (quick) {
      const cx = L.cx * sc;
      const cy = (L.cy - 0.05 * L.r) * sc;
      const R = 0.62 * Math.sqrt(bw * bw + bh * bh);
      g.setTransform(1, 0, 0, 1 / 1.08, 0, cy - cy / 1.08);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const k = Math.pow(t * t * (3 - 2 * t), 0.8);
        gr.addColorStop(t, 'rgb(' + Math.round(11 - 4 * k) + ',' + Math.round(18 - 8 * k) + ',' + Math.round(48 - 28 * k) + ')');
      }
      g.fillStyle = gr;
      const v0 = cy - cy * 1.08; // user-space rows that map onto device rows 0 … bh
      const v1 = cy + (bh - cy) * 1.08;
      g.fillRect(0, v0 - 2, bw, v1 - v0 + 4);
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.bgDithered = false;
      return;
    }
    this.bgDithered = true;
    const img = g.createImageData(bw, bh);
    const px = new Uint32Array(img.data.buffer);
    const cx = L.cx * sc;
    const cy = (L.cy - 0.05 * L.r) * sc;
    const R = 0.62 * Math.sqrt(bw * bw + bh * bh);
    const inv = 1 / (R * R);
    // k(t) = smoothstep(t)^0.8, tabulated over t² (no sqrt or pow per pixel)
    const NL = 2048;
    const lut = new Float32Array(NL + 2);
    for (let i = 0; i <= NL + 1; i++) {
      const t = Math.sqrt(Math.min(1, i / NL));
      lut[i] = Math.pow(t * t * (3 - 2 * t), 0.8);
    }
    // triangular dither, ±1 LSB, from a table indexed by a pixel hash
    const rng = mulberry32(this.seed ^ 0xb6);
    const noise = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) noise[i] = rng() + rng() - 1 + 0.5;
    const r0 = 11;
    const g0 = 18;
    const b0 = 48;
    const dr = 7 - r0;
    const dg = 10 - g0;
    const db = 20 - b0;
    let o = 0;
    for (let y = 0; y < bh; y++) {
      const dy = (y - cy) * 1.08;
      const dy2 = dy * dy;
      for (let x = 0; x < bw; x++, o++) {
        const dx = x - cx;
        let q = (dx * dx + dy2) * inv;
        if (q > 1) q = 1;
        const k = lut[(q * NL) | 0];
        // murmur3 finaliser of the pixel index: no visible structure in the dither
        let hh = Math.imul(o ^ (o >>> 16), 0x85ebca6b);
        hh = Math.imul(hh ^ (hh >>> 13), 0xc2b2ae35);
        const n = noise[(hh ^ (hh >>> 16)) >>> 20];
        px[o] =
          0xff000000 |
          (((b0 + db * k + n) | 0) << 16) |
          (((g0 + dg * k + n) | 0) << 8) |
          ((r0 + dr * k + n) | 0);
      }
    }
    g.putImageData(img, 0, 0);
    // the milky band, added at the angle the sky comes to rest at (the frame that stays, and the
    // one the astrolabe takes over from); during the intro the stars drift past it by a few pixels
    const band = this.band;
    if (band && this.bandN) {
      const sky = L.sky;
      g.save();
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.translate(sky.Px, sky.Py);
      this.bakedTheta = this.restTheta();
      g.rotate(this.bakedTheta);
      g.translate(sky.Cx - sky.Px, sky.Cy - sky.Py);
      g.globalAlpha = BAND_ALPHA;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(band, -sky.L / 2, -sky.L / 2, sky.L, sky.L);
      g.restore();
    }
  }

  /**
   * The band is painted at full intensity into a half-res texture and composited at low opacity,
   * so 8-bit quantisation never shows. Irregular width, meandering spine, patchy dust lanes.
   */
  private makeBand() {
    const L = this.L;
    const cv = this.band;
    if (!L || !cv) return;
    const N = Math.max(128, Math.min(1024, Math.ceil(L.sky.L * 0.5)));
    cv.width = N; // also clears it
    cv.height = N;
    this.bandN = N;
    const g = ctx2d(cv);
    const rng = mulberry32(this.seed ^ 0xbadd);
    const band = this.bandCurve();
    const W = band.width * N;
    const blob = (x: number, y: number, ang: number, rMinor: number, elong: number, col: RGB, al: number) => {
      g.save();
      g.translate(x, y);
      g.rotate(ang);
      g.scale(elong, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rMinor);
      gr.addColorStop(0, rgba(col, al));
      gr.addColorStop(0.5, rgba(col, al * 0.42));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(-rMinor, -rMinor, rMinor * 2, rMinor * 2);
      g.restore();
    };
    const meander = (a: number) => 0.32 * Math.sin(a * 5.1 + 1.3) + 0.2 * Math.sin(a * 11.7 + 0.4);
    const widthMod = (a: number) => 0.78 + 0.22 * Math.sin(a * 7.3 + 2.0) + 0.12 * Math.sin(a * 17.1 + 0.3);
    const at = (a: number, lateral: number): Vec => {
      const p = quad(band.A, band.C, band.B, a);
      const n = band.nx(a);
      const off = (meander(a) + lateral) * band.width;
      return [(p[0] + n[0] * off + 0.5) * N, (p[1] + n[1] * off + 0.5) * N];
    };
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const a = i / 45;
      const q = at(a, 0);
      blob(q[0], q[1], band.tan(a), W * 0.85 * widthMod(a), 1.5, [118, 134, 190], 0.075);
    }
    for (let j = 0; j < 420; j++) {
      const a = rng();
      const wm = widthMod(a);
      const q = at(a, gauss(rng) * 0.2 * wm);
      const clump = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(a * 13.0 + 0.7) * Math.sin(a * 5.3 + 2.1)), 0.7);
      const warm = rng() < 0.16;
      blob(
        q[0],
        q[1],
        band.tan(a) + gauss(rng) * 0.5,
        W * (0.05 + 0.17 * rng()) * wm,
        1.1 + 0.7 * rng(),
        warm ? [224, 208, 186] : [170, 184, 230],
        0.085 * clump,
      );
    }
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 34; k++) {
      const a = 0.15 + 0.7 * rng();
      const q = at(a, 0.08 + gauss(rng) * 0.05);
      blob(q[0], q[1], band.tan(a) + gauss(rng) * 0.3, W * (0.05 + 0.08 * rng()), 1.4 + rng(), [0, 0, 0], 0.3);
    }
    g.globalCompositeOperation = 'source-over';
  }

  private makeSprites() {
    const dpr = this.dpr;
    const S = Math.ceil(28 * dpr);
    if (this.sprites.length && this.sprites[0].width === S * 2) return;
    this.sprites.forEach(release);
    this.pSprites.forEach(release);
    release(this.spark);
    this.sprites = STAR_COLS.map((c) => {
      const cv = makeCanvas(S * 2, S * 2);
      const g = ctx2d(cv);
      const gr = g.createRadialGradient(S, S, 0, S, S, S);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.07, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.16, rgba(c, 0.42));
      gr.addColorStop(0.38, rgba(c, 0.1));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, S * 2, S * 2);
      return cv;
    });
    // luminous motes for the particles: hot core, soft halo
    const P = Math.ceil(10 * dpr);
    this.pSprites = PART_COLS.map((c) => {
      const cv = makeCanvas(P * 2, P * 2);
      const g = ctx2d(cv);
      const gr = g.createRadialGradient(P, P, 0, P, P, P);
      const hot: RGB = [Math.min(255, c[0] + 12), Math.min(255, c[1] + 12), Math.min(255, c[2] + 12)];
      gr.addColorStop(0, rgba(hot, 1));
      gr.addColorStop(0.2, rgba(c, 0.92));
      gr.addColorStop(0.42, rgba(c, 0.32));
      gr.addColorStop(0.7, rgba(c, 0.08));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, P * 2, P * 2);
      return cv;
    });
    // the burin's spark at the head of the limb circle
    const sp = makeCanvas(S * 2, S * 2);
    const g2 = ctx2d(sp);
    const gr2 = g2.createRadialGradient(S, S, 0, S, S, S);
    gr2.addColorStop(0, 'rgba(255,248,230,1)');
    gr2.addColorStop(0.1, 'rgba(250,236,200,0.85)');
    gr2.addColorStop(0.35, 'rgba(234,214,160,0.22)');
    gr2.addColorStop(1, 'rgba(234,214,160,0)');
    g2.fillStyle = gr2;
    g2.fillRect(0, 0, S * 2, S * 2);
    this.spark = sp;
  }

  /**
   * A warm halo per serif letter (shadowBlur once, here; never per frame). Halo only: the glyph is
   * drawn off the canvas and only its shadow lands here, so the glow can never wash out the gold.
   */
  private makeGlows() {
    const L = this.L;
    if (!L || !L.S) return;
    const dpr = this.dpr;
    const S = L.S;
    this.glows.forEach((g) => release(g && g.cv));
    this.glows = [];
    this.glowsStale = false;
    const probe = makeCanvas(4, 4);
    try {
      const g0 = ctx2d(probe);
      g0.font = L.serifFont;
      const blurA = Math.max(1.5, 0.035 * S);
      const blurB = Math.max(4, 0.12 * S);
      const pad = blurB * 2.2;
      const font = 'italic 500 ' + (S * dpr).toFixed(2) + 'px ' + this.fonts.serif;
      this.glows = SERIF_TEXT.split('').map((ch) => {
        if (ch === ' ') return null;
        const m = g0.measureText(ch);
        const left = m.actualBoundingBoxLeft + pad;
        const top = m.actualBoundingBoxAscent + pad;
        const cv = makeCanvas(
          (m.actualBoundingBoxLeft + m.actualBoundingBoxRight + 2 * pad) * dpr,
          (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 2 * pad) * dpr,
        );
        const g = ctx2d(cv);
        g.font = font;
        g.fillStyle = '#ead6a0';
        const off = cv.width + Math.ceil(4 * blurB * dpr) + 16;
        g.shadowOffsetX = off;
        g.shadowColor = 'rgba(234,200,140,0.9)';
        g.shadowBlur = blurB * dpr;
        g.fillText(ch, left * dpr - off, top * dpr);
        g.shadowColor = 'rgba(250,230,180,1)';
        g.shadowBlur = blurA * dpr;
        g.fillText(ch, left * dpr - off, top * dpr);
        return { cv, ox: left, oy: top, w: cv.width / dpr, h: cv.height / dpr, S, dpr };
      });
    } finally {
      release(probe);
    }
  }

  // -------------------------------------------------------------------------
  // Particles (generated once fonts are known; positions are pure functions of t)
  // -------------------------------------------------------------------------
  /** "world" → motes that rise in a plume and become stars that stay. */
  private makeDissolve() {
    const rng = mulberry32(this.seed ^ 0xd155);
    const M = this.metrics!;
    const L = this.L!;
    const tl = this.timeline;
    const st = this.stars!;
    st.n = this.nBase;
    const total = M.worldSamples.reduce((a, s) => a + s.n, 0);
    const D: Dissolve = {
      n: total,
      letter: new Uint8Array(total),
      ex: new Float32Array(total),
      ey: new Float32Array(total),
      rel: new Float32Array(total),
      dur: new Float32Array(total),
      star: new Int32Array(total),
      sway: new Float32Array(total),
      ta: new Float32Array(total),
      tf: new Float32Array(total),
      tp: new Float32Array(total),
      qy: new Float32Array(total),
      qa: new Float32Array(total),
      g1: new Float32Array(total),
      g2: new Float32Array(total),
      g3: new Float32Array(total),
    };
    let p = 0;
    for (let j = 0; j < WORLD.length; j++) {
      const sm = M.worldSamples[j];
      const del = tl.del[WORLD.length - 1 - j];
      const span = Math.max(1e-3, sm.maxY - sm.minY);
      for (let k = 0; k < sm.n; k++) {
        const ex = sm.pts[k * 2];
        const ey = sm.pts[k * 2 + 1];
        D.letter[p] = j;
        D.ex[p] = ex;
        D.ey[p] = ey;
        const ny = (sm.maxY - ey) / span; // 0 bottom … 1 top: the top of the letter lifts first
        // released within ~120 ms of the keypress, so the caret always closes on what is left
        D.rel[p] = del + 0.02 + 0.06 * (1 - ny) + rng() * 0.04;
        D.dur[p] = 1.1 + rng() * 0.6;
        D.sway[p] = (rng() - 0.5) * 0.3;
        D.ta[p] = (3 + rng() * 7) * (L.M / 20);
        D.tf[p] = 2 + rng() * 4;
        D.tp[p] = TAU * rng();
        D.qy[p] = rng();
        D.qa[p] = rng();
        D.g1[p] = gauss(rng);
        D.g2[p] = gauss(rng);
        D.g3[p] = gauss(rng);
        const si = st.n++;
        // a few become visibly new stars, the rest join the faint ones
        const mag = rng() < 0.15 ? 2.6 + rng() : 4.2 + 1.8 * Math.pow(rng(), 0.55);
        this.setStarLook(si, mag, rng, 1);
        st.born[si] = D.rel[p] + D.dur[p];
        st.dim[si] = NaN;
        st.appear[si] = 0;
        st.quiet[si] = 0;
        D.star[p] = si;
        p++;
      }
    }
    this.D = D;
    this.placePlume(true);
    this.recomputeStarSizes();
    this.markQuiet();
  }

  /**
   * Where each mote of "world" becomes a star: above the word, in the room the layout gives it.
   * Only stars not yet born move when the layout changes (a rotated phone keeps its plume on screen).
   */
  private placePlume(all: boolean) {
    const D = this.D;
    const L = this.L;
    const st = this.stars;
    if (!D || !L || !st || !isFinite(this.T0)) return;
    const w = this.w;
    const h = this.h;
    const s = this.t - this.T0;
    const out: Vec = [0, 0];
    for (let p = 0; p < D.n; p++) {
      const land = D.rel[p] + D.dur[p];
      if (!all && s >= land) continue;
      const j = D.letter[p];
      const sx = L.xTyped + (HELLO_N + j) * L.adv + D.ex[p] * L.M;
      const sy = L.baseline + D.ey[p] * L.M;
      // a low plume: the new stars land inside the instrument, just before the gold arrives
      const avail = Math.max(20, sy - h * 0.05);
      let dy = (0.05 + 0.24 * Math.pow(D.qy[p], 0.8)) * h;
      if (dy > avail) dy = avail * (0.55 + 0.45 * D.qa[p]);
      const spread = 14 + 0.46 * dy;
      let x = sx + D.g1[p] * spread;
      if (x < w * 0.04 || x > w * 0.96) x = sx + D.g2[p] * spread;
      if (x < w * 0.04 || x > w * 0.96) x = sx + D.g3[p] * spread;
      x = Math.min(w * 0.96, Math.max(w * 0.04, x));
      this.screenToSky(x, sy - dy, this.theta(this.T0 + land), out);
      const si = D.star[p];
      st.u[si] = out[0];
      st.v[si] = out[1];
    }
  }

  /** "imad’s world" ← light spiralling out of the stars, letter by letter: the glyph samples. */
  private makeCondense() {
    const rng = mulberry32(this.seed ^ 0xc0de);
    const L = this.L!;
    const M = this.metrics!;
    // count from the ink area, so the stardust reads the same on every screen
    const inkPx = M.serifInkTotal * L.S * L.S;
    const spacing = Math.max(1.45, 0.028 * L.S);
    const target = Math.max(380, Math.min(900, Math.round(inkPx / (spacing * spacing))));
    const letters: (GlyphSample | null)[] = [];
    let total = 0;
    for (let i = 0; i < SERIF_TEXT.length; i++) {
      const gi = M.serifGlyphs[i];
      if (!gi || !M.serifInk[i]) {
        letters.push(null);
        continue;
      }
      const sm = sampleInk(gi, rng, Math.max(14, Math.round((target * M.serifInk[i]) / M.serifInkTotal)));
      letters.push(sm);
      total += sm.n;
    }
    const C: Condense = {
      n: total,
      letter: new Uint8Array(total),
      ex: new Float32Array(total),
      ey: new Float32Array(total),
      arr: new Float32Array(total),
      dur: new Float32Array(total),
      src: new Int32Array(total),
      k: new Float32Array(total),
      big: new Uint8Array(total),
      spacingEm: letters.map((l, i) => (l && l.n ? Math.sqrt(M.serifInk[i] / l.n) : 0)),
    };
    let p = 0;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      const sm = letters[li];
      if (!sm) continue;
      for (let k = 0; k < sm.n; k++) {
        C.letter[p] = li;
        C.ex[p] = sm.pts[k * 2];
        C.ey[p] = sm.pts[k * 2 + 1];
        C.k[p] = 0.55 + 0.45 * rng();
        C.big[p] = rng() < 0.2 ? 1 : 0;
        p++;
      }
    }
    this.C = C;
    this.assignCondense();
  }

  /**
   * Which star gives each mote its light, and when it flies (weighted by brightness and nearness,
   * at most two motes per star, the new stars of "world" favoured); then the timeline that follows
   * from it: each letter's resolve, the limb, the hand-off and the events.
   */
  private assignCondense() {
    const C = this.C;
    const L = this.L;
    const st = this.stars;
    if (!C || !L || !st) return;
    const tl = this.timeline;
    const rng = mulberry32(this.seed ^ 0x5eed);
    const w = this.w;
    const h = this.h;
    for (let i = 0; i < st.n; i++) st.dim[i] = NaN;
    const th = this.theta(this.T0 + tl.cond0);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const sky = L.sky;
    const span = 0.24 * Math.max(w, h);
    const maxD = 0.62 * Math.max(w, h);
    const ex = L.textW * 0.62;
    const ey = L.S;
    // weighted sampling (key = u^(1/w)); key and star index packed in one double, natively sorted
    const keys = new Float64Array(st.n * 2);
    let nk = 0;
    for (let i = 0; i < st.n; i++) {
      const born = st.born[i];
      const fromWorld = isNum(born);
      if ((fromWorld && born > tl.cond0 + 0.9) || st.quiet[i]) continue;
      const bx = sky.Cx + st.u[i] * sky.L - sky.Px;
      const by = sky.Cy + st.v[i] * sky.L - sky.Py;
      const x = sky.Px + bx * c - by * sn;
      const y = sky.Py + bx * sn + by * c;
      if (x < 2 || y < 2 || x > w - 2 || y > h - 2) continue;
      const qx = x - L.textCx;
      const qy = y - L.textCy;
      if ((qx * qx) / (ex * ex) + (qy * qy) / (ey * ey) < 1) continue;
      const d = Math.sqrt(qx * qx + qy * qy);
      if (d > maxD) continue;
      const wgt = (0.3 + st.a[i]) * Math.exp(-d / span) * (qy < 0 ? 1.35 : 1) * (fromWorld ? 2.5 : 1);
      keys[nk++] = Math.floor(Math.pow(rng(), 1 / wgt) * 2147483648) * 8192 + i;
      keys[nk++] = Math.floor(Math.pow(rng(), 1 / wgt) * 0.92 * 2147483648) * 8192 + i;
    }
    const sorted = keys.subarray(0, nk).sort();
    const arrs: number[][] = [];
    let p = 0;
    let order = 0;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      arrs.push([]);
      if (!C.spacingEm[li]) continue;
      for (; p < C.n && C.letter[p] === li; p++) {
        let dur = lerp(tl.flight[0], tl.flight[1], rng());
        let arr = tl.cond0 + dur + order * tl.stagger + rng() * tl.letterJitter;
        const src = nk ? sorted[nk - 1 - (p % nk)] % 8192 : 0;
        const born = st.born[src];
        // light from a star of "world" leaves only once that star exists
        if (isNum(born) && arr - dur < born + 0.15) {
          dur = Math.max(0.55, arr - born - 0.15);
          arr = born + 0.15 + dur;
        }
        C.src[p] = src;
        C.arr[p] = arr;
        C.dur[p] = dur;
        if (!isNum(st.dim[src]) || arr - dur < st.dim[src]) st.dim[src] = arr - dur;
        arrs[li].push(arr);
      }
      order++;
    }
    // each letter resolves once nearly all its light has landed, and quickly
    tl.crisp = [];
    let lastEnd = 0;
    for (const A of arrs) {
      if (!A.length) {
        tl.crisp.push(null);
        continue;
      }
      A.sort((a, b) => a - b);
      const a0 = A[Math.floor(A.length * 0.88)];
      const a1 = Math.max(a0 + 0.2, A[A.length - 1] + 0.03);
      tl.crisp.push([a0, a1]);
      if (a1 > lastEnd) lastEnd = a1;
    }
    tl.circleDur = L.r >= 300 ? 2.0 : 1.7;
    tl.circle0 = lastEnd - 0.5;
    tl.done = tl.circle0 + tl.circleDur + 0.2;
    for (let k = 0; k < 360; k++) {
      const target = k / 360;
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 24; it++) {
        const m = (lo + hi) / 2;
        if (easeLimb(m) < target) lo = m;
        else hi = m;
      }
      tl.tickPass[k] = tl.circle0 + lo * tl.circleDur;
    }
    tl.tickPass[0] = tl.circle0 + tl.circleDur - 0.02; // the zenith mark is engraved last, closing the ring
    this.buildEvents();
  }

  private buildEvents() {
    const tl = this.timeline;
    const ev: [number, IntroEventName][] = [];
    for (const s of tl.type) ev.push([s, 'type']);
    for (const s of tl.del) {
      ev.push([s, 'backspace']);
      ev.push([s + 0.001, 'dissolve']);
    }
    ev.push([tl.cond0, 'condense']);
    ev.push([tl.circle0, 'circle']);
    ev.sort((a, b) => a[0] - b[0]);
    this.events = ev;
    const s = this.t - this.T0;
    let i = 0;
    if (this.ready) while (i < ev.length && ev[i][0] <= s) i++;
    this.evIdx = i;
    if (!this.final) this.tDone = this.T0 + tl.done;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  private render(t: number) {
    if (this.disposed) return;
    this.applyPending();
    const L = this.L;
    if (!L) return;
    const tl = this.timeline;
    const ready = this.ready;
    const final = this.final;
    const skipK = final ? clamp01((t - this.skipAt) / SKIP_FADE) : 1;
    let s = ready ? t - this.T0 : -Infinity;
    if (ready && (final || this.reduced)) s = Math.max(s, tl.done + 1);

    if (ready && !final && !this.reduced) {
      while (this.evIdx < this.events.length && this.events[this.evIdx][0] <= s) this.emit(this.events[this.evIdx++][1]);
    }

    const th = this.theta(t);
    this.updateBackdrop(t, final, skipK);

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawStars(ctx, t, s, th, final);
    if (ready) {
      ctx.globalCompositeOperation = 'lighter';
      if (!final) {
        this.pushDissolve(s, th);
        this.pushCondense(s, th);
        this.flushDots(ctx);
      }
      this.drawGlows(ctx, s);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.snapMain) {
      if (skipK < 1) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - easeOutCubic(skipK);
        ctx.drawImage(this.snapMain, 0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 1;
      } else {
        release(this.snapMain);
        this.snapMain = null;
      }
    }
    this.renderText(s, t);
    if (ready && !this.warmed && this.stage >= 5) this.warmUp();

    if (ready && !this.doneFired && t >= this.tDone) this.fireDone();
  }

  /** The text layer: cleared and drawn only while its content changes. */
  private renderText(s: number, t: number) {
    const g = this.tctx;
    const cv = this.textCv;
    const L = this.L;
    if (!g || !cv || !L) return;
    const tl = this.timeline;
    const snap = this.snapText;
    const phase = !this.ready || s < tl.caretIn ? 0 : s > tl.done + 0.6 && !snap ? 2 : 1;
    if (phase !== 1 && phase === this.textPhase && !this.textDirty) return;
    const k = this.dprTextEff;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (phase === 1 && this.textPhase === 1 && !this.textDirty && !snap && s < tl.circle0 - 0.05) {
      // until the limb begins only the line of text changes: clear and draw that strip alone
      const M = this.metrics!;
      const x0 = Math.max(L.box.x, Math.min(L.xTyped, L.xFinal) - 0.3 * L.S);
      const x1 = Math.min(L.box.x + L.box.w, Math.max(L.xTyped + 12.5 * L.adv, L.serifX + (M.serifInkR + 0.25) * L.S));
      const y0 = Math.max(L.box.y, L.baseline - 1.3 * L.S);
      const y1 = Math.min(L.box.y + L.box.h, L.baseline + 0.55 * L.S);
      if (x1 <= x0 || y1 <= y0) return;
      const px0 = Math.floor((x0 - L.box.x) * k);
      const py0 = Math.floor((y0 - L.box.y) * k);
      const px1 = Math.ceil((x1 - L.box.x) * k);
      const py1 = Math.ceil((y1 - L.box.y) * k);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(px0, py0, px1 - px0, py1 - py0);
      g.save();
      g.beginPath();
      g.rect(px0, py0, px1 - px0, py1 - py0);
      g.clip();
      g.setTransform(k, 0, 0, k, -L.box.x * k, -L.box.y * k);
      this.drawText(g, s);
      g.restore();
      return;
    }
    this.textPhase = phase;
    this.textDirty = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    if (phase !== 0) {
      g.setTransform(k, 0, 0, k, -L.box.x * k, -L.box.y * k);
      this.drawText(g, s);
      this.drawCircle(g, s);
    }
    if (snap) {
      const sk = clamp01((t - this.snapTextAt) / SKIP_FADE);
      if (sk < 1) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1 - easeOutCubic(sk);
        g.drawImage(snap, 0, 0, cv.width, cv.height);
        g.globalAlpha = 1;
      } else {
        release(snap);
        this.snapText = null;
      }
    }
  }

  /**
   * First use of a canvas path (text at a size, additive blending, a sprite) can stall while the
   * browser builds glyph caches and GPU pipelines. Do it once, at alpha 0.002, while only the stars
   * are moving; the next frame clears it.
   */
  private warmUp() {
    this.warmed = true;
    const L = this.L!;
    const M = this.metrics!;
    const ctx = this.ctx;
    const x = this.w * 0.5;
    const y = this.h * 0.12;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 0.002;
    ctx.globalCompositeOperation = 'lighter';
    this.pSprites.forEach((sp, i) => ctx.drawImage(sp, x + i * 6, y, 4, 4));
    ctx.fillStyle = this.rectStyles[NB - 1];
    ctx.fillRect(x, y + 8, 2, 2);
    this.glows.forEach((g, j) => {
      if (g) ctx.drawImage(g.cv, L.serifX + M.serifOff[j] * L.S - g.ox, L.baseline - g.oy, g.w, g.h);
    });
    ctx.restore();
    const g = this.tctx;
    if (!g) return;
    const k = this.dprTextEff;
    g.save();
    g.setTransform(k, 0, 0, k, -L.box.x * k, -L.box.y * k);
    g.globalAlpha = 0.002;
    g.fillStyle = '#efe6d2';
    g.font = L.monoFont;
    g.fillText(MONO_TEXT, L.xTyped, L.baseline);
    g.font = L.serifFont;
    g.fillStyle = L.gold;
    g.fillText(SERIF_TEXT, L.serifX, L.baseline);
    g.strokeStyle = 'rgba(201,162,91,1)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(L.cx, L.cy, L.r * LIMB_R1, 0, 0.5);
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    if (this.spark) g.drawImage(this.spark, L.cx, L.cy, 6, 6);
    g.restore();
    this.textDirty = true;
  }

  private drawStars(ctx: CanvasRenderingContext2D, t: number, s: number, th: number, final: boolean) {
    const st = this.stars!;
    const n = st.n;
    const sky = this.L!.sky;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const w = this.w;
    const h = this.h;
    const reduced = this.reduced;
    const counts = this.starCounts;
    const cursor = this.starCursor;
    const spr = this.sprIdx;
    const base = this.starBase;
    counts.fill(0);
    let sprN = 0;
    for (let i = 0; i < n; i++) {
      st.key[i] = -1;
      const quiet = st.quiet[i] === 1;
      let a = quiet ? Math.min(st.a[i], QUIET_A) : st.a[i];
      const born = st.born[i];
      if (isNum(born)) {
        if (!final && s < born) continue;
        if (!final) a *= 1 + 0.8 * Math.exp(-(s - born) / 0.4); // a new star ignites, then settles
      } else if (!final && !reduced) {
        const ap = st.appear[i];
        if (t < ap) continue;
        a *= easeOutCubic((t - ap) / 0.6);
      }
      const bx = sky.Cx + st.u[i] * sky.L - sky.Px;
      const by = sky.Cy + st.v[i] * sky.L - sky.Py;
      const x = sky.Px + bx * c - by * sn;
      const y = sky.Py + bx * sn + by * c;
      if (x < -16 || y < -16 || x > w + 16 || y > h + 16) continue;
      if (!reduced) {
        const tw = 0.62 * Math.sin(st.f1[i] * t + st.p1[i]) + 0.38 * Math.sin(st.f2[i] * t + st.p2[i]);
        a *= 1 - st.tA[i] * (0.5 + 0.5 * tw);
      }
      const dm = st.dim[i];
      if (isNum(dm) && !final) {
        const k = s - dm;
        // a star that gives light to the word dims a little, then recovers
        if (k > 0) a *= 1 - 0.4 * Math.min(1, k / 0.3) * Math.exp(-Math.max(0, k - 0.3) / 1.2);
      }
      if (a <= 0.004) continue;
      if (a > 1) a = 1;
      st.x[i] = x;
      st.y[i] = y;
      st.al[i] = a;
      if (st.spr[i] && !quiet) {
        if (sprN < spr.length) spr[sprN++] = i;
        continue;
      }
      let b = (a * NB) | 0;
      if (b >= NB) b = NB - 1;
      const key = st.col[i] * NB + b;
      st.key[i] = key;
      counts[key]++;
    }
    let acc = 0;
    for (let k = 0; k < counts.length; k++) {
      cursor[k] = acc;
      acc += counts[k];
    }
    for (let i = 0; i < n; i++) {
      const kk = st.key[i];
      if (kk >= 0) st.order[cursor[kk]++] = i;
    }
    let start = 0;
    for (let k = 0; k < counts.length; k++) {
      const cnt = counts[k];
      if (!cnt) continue;
      ctx.fillStyle = this.starBucketStyles[k];
      ctx.beginPath();
      for (let j = start; j < start + cnt; j++) {
        const id = st.order[j];
        const z = st.quiet[id] ? base : st.sz[id];
        ctx.rect(st.x[id] - z / 2, st.y[id] - z / 2, z, z);
      }
      ctx.fill();
      start += cnt;
    }
    for (let q = 0; q < sprN; q++) {
      const id = spr[q];
      const R = st.sprR[id];
      ctx.globalAlpha = st.al[id];
      ctx.drawImage(this.sprites[st.col[id]], st.x[id] - R, st.y[id] - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1;
  }

  private pushDot(col: number, a: number, x: number, y: number, r: number, rectR: number) {
    if (a <= 0.004) return;
    let b = (a * NB) | 0;
    if (b >= NB) b = NB - 1;
    if (r < rectR) this.rectDots.push(col * NB + b, x, y, r);
    else this.spriteDots.push(col * NB + b, x, y, r);
  }

  /** Radius (CSS px) below which a mote is drawn as a rect: on dense screens, where a sprite that small has no visible falloff. */
  private rectRadius() {
    return this.refDpr >= 1.5 ? RECT_DOT_DEV / this.refDpr : 0;
  }

  private pushDissolve(s: number, th: number) {
    const D = this.D;
    if (!D) return;
    const tl = this.timeline;
    const L = this.L!;
    const st = this.stars!;
    const Mw = this.metrics!.worldSamples;
    const sky = L.sky;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const lift = 0.14 * L.M;
    const dt = 1 / 70;
    const rectR = this.rectRadius();
    const radL = this.radL;
    for (let j = 0; j < WORLD.length; j++) radL[j] = Math.max(0.8, 0.62 * Math.sqrt(Mw[j].ink / Math.max(1, Mw[j].n)) * L.M);
    for (let p = 0; p < D.n; p++) {
      const j = D.letter[p];
      const del = tl.del[WORLD.length - 1 - j];
      if (s < del) continue;
      const rel = D.rel[p];
      const dur = D.dur[p];
      if (s >= rel + dur) continue;
      const sx = L.xTyped + (HELLO_N + j) * L.adv + D.ex[p] * L.M;
      const sy = L.baseline + D.ey[p] * L.M;
      const si = D.star[p];
      // the star this mote becomes, where the sky has carried it
      const bx = sky.Cx + st.u[si] * sky.L - sky.Px;
      const by = sky.Cy + st.v[si] * sky.L - sky.Py;
      const dx = sky.Px + bx * c - by * sn - sx;
      const dy = sky.Py + bx * sn + by * c - (sy - lift);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      let hx = 0;
      let hy = 0;
      let qx = 0;
      let qy = 0;
      for (let pass = 0; pass < 2; pass++) {
        const ss = pass === 0 ? s : s - dt;
        let x: number;
        let y: number;
        if (ss <= rel) {
          // held in the glyph, trembling and lifting off the baseline as it loosens
          const k = clamp01((ss - (rel - 0.16)) / 0.16);
          x = sx + Math.sin(D.tp[p] + ss * 26) * 0.3 * k;
          y = sy - lift * k * k;
        } else {
          const u = clamp01((ss - rel) / dur);
          const e = easeDissolve(u);
          const sway = D.sway[p] * dist * Math.sin(Math.PI * e);
          const tb = D.ta[p] * Math.pow(1 - u, 1.4) * Math.min(1, u * 4);
          const ph = D.tf[p] * e * Math.PI + D.tp[p];
          x = sx + dx * e + nx * sway + Math.sin(ph) * tb;
          y = sy - lift + dy * e + ny * sway + Math.cos(ph * 0.7) * tb * 0.35;
        }
        if (pass === 0) {
          hx = x;
          hy = y;
        } else {
          qx = x;
          qy = y;
        }
      }
      const u = clamp01((s - rel) / dur);
      // a little dimmer than the ink at first, cooling to a dim mote, igniting as it becomes a star
      let a = lerp(0.75, 0.55, smoothstep(0, 0.25, u));
      a = lerp(a, st.a[si], smoothstep(0.35, 0.92, u)) * (1 + 0.8 * smoothstep(0.86, 1, u));
      a *= smoothstep(del, del + 0.06, s);
      if (a > 1) a = 1;
      const col = u < 0.3 ? 0 : 1;
      const r = lerp(radL[j], Math.max(0.9, st.sz[si] * 1.7), smoothstep(0.1, 0.9, u));
      this.pushDot(col, a, hx, hy, r, rectR);
      const mx = hx - qx;
      const my = hy - qy;
      if (mx * mx + my * my > 9) this.pushDot(col, a * 0.35, qx, qy, r * 0.75, rectR);
    }
  }

  /**
   * Spiral in: the radius shrinks with the ease while the angle turns counter-clockwise, like the
   * sky, and straightens at the end, so every mote lands head-on.
   */
  private pushCondense(s: number, th: number) {
    const C = this.C;
    if (!C) return;
    const tl = this.timeline;
    const L = this.L!;
    const M = this.metrics!;
    const st = this.stars!;
    const sky = L.sky;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const dt = 1 / 55;
    const rectR = this.rectRadius();
    const crispL = this.crispL;
    const gxL = this.gxL;
    const spcL = this.spcL;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      const cr = tl.crisp[li];
      crispL[li] = cr ? smoothstep(cr[0], cr[1], s) : 0;
      gxL[li] = L.serifX + M.serifOff[li] * L.S;
      spcL[li] = C.spacingEm[li] * L.S;
    }
    for (let p = 0; p < C.n; p++) {
      const dur = C.dur[p];
      const dep = C.arr[p] - dur;
      if (s < dep) continue;
      const li = C.letter[p];
      const crisp = crispL[li];
      if (crisp >= 0.999) continue;
      const tx = gxL[li] + C.ex[p] * L.S;
      const ty = L.baseline + C.ey[p] * L.S;
      const u = clamp01((s - dep) / dur);
      const si = C.src[p];
      let x = tx;
      let y = ty;
      let r0 = 0;
      let phi0 = 0;
      const kk = C.k[p];
      if (u < 1) {
        // where the source star is now
        const bx = sky.Cx + st.u[si] * sky.L - sky.Px;
        const by = sky.Cy + st.v[si] * sky.L - sky.Py;
        const qx = sky.Px + bx * c - by * sn - tx;
        const qy = sky.Py + bx * sn + by * c - ty;
        r0 = Math.sqrt(qx * qx + qy * qy);
        phi0 = Math.atan2(qy, qx);
        const e = easeCondense(u);
        const rr = r0 * (1 - e);
        const phi = phi0 - kk * e * (2 - e);
        x = tx + rr * Math.cos(phi);
        y = ty + rr * Math.sin(phi);
      }
      // light gathers: faint as it leaves its star, bright as it condenses; it stays lit until
      // the glyph has mostly come in, so the dots seem to light it
      let a = u < 1 ? lerp(Math.max(0.42, Math.min(0.75, st.a[si])), 0.95, smoothstep(0.1, 0.7, u)) : 0.9;
      a *= 1 - smoothstep(0.35, 1, crisp);
      const gg = smoothstep(0.3, 0.95, u);
      const col = gg < 0.3 ? 1 : gg < 0.7 ? 2 : 3;
      const spc = spcL[li];
      const r = (C.big[p] ? Math.max(1.15, 0.88 * spc) : Math.max(0.85, 0.62 * spc)) * lerp(1.25, 1, smoothstep(0.4, 1, u));
      this.pushDot(col, a, x, y, r, rectR);
      if (u < 0.97) {
        const e2 = easeCondense(clamp01((s - dt - dep) / dur));
        const rr2 = r0 * (1 - e2);
        const phi2 = phi0 - kk * e2 * (2 - e2);
        const x2 = tx + rr2 * Math.cos(phi2);
        const y2 = ty + rr2 * Math.sin(phi2);
        const mx = x - x2;
        const my = y - y2;
        if (mx * mx + my * my > 9) this.pushDot(col, a * 0.34, x2, y2, r * 0.8, rectR);
      }
    }
  }

  /** Tiny motes as rect paths (one fill per colour × alpha), the rest as soft sprites. */
  private flushDots(ctx: CanvasRenderingContext2D) {
    const R = this.rectDots;
    if (R.n) {
      R.sort();
      let start = 0;
      for (let k = 0; k < R.nKeys; k++) {
        const cnt = R.counts[k];
        if (!cnt) continue;
        ctx.fillStyle = this.rectStyles[k];
        ctx.beginPath();
        for (let j = start; j < start + cnt; j++) {
          const id = R.order[j];
          const z = R.r[id] * RECT_SIZE;
          ctx.rect(R.x[id] - z * 0.5, R.y[id] - z * 0.5, z, z);
        }
        ctx.fill();
        start += cnt;
      }
      R.reset();
    }
    const B = this.spriteDots;
    if (B.n) {
      B.sort();
      let start = 0;
      for (let k = 0; k < B.nKeys; k++) {
        const cnt = B.counts[k];
        if (!cnt) continue;
        const img = this.pSprites[(k / NB) | 0];
        ctx.globalAlpha = ((k % NB) + 0.5) / NB;
        for (let j = start; j < start + cnt; j++) {
          const id = B.order[j];
          const r = B.r[id];
          ctx.drawImage(img, B.x[id] - r, B.y[id] - r, r * 2, r * 2);
        }
        start += cnt;
      }
      ctx.globalAlpha = 1;
      B.reset();
    }
  }

  /** Each gold letter strikes with a short warm breath (120 ms), gone within ~0.6 s; 4 % stays. */
  private drawGlows(ctx: CanvasRenderingContext2D, s: number) {
    const L = this.L!;
    const tl = this.timeline;
    const M = this.metrics!;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      const cr = tl.crisp[li];
      const gw = this.glows[li];
      if (!cr || !gw) continue;
      const gk = s - cr[0];
      if (gk <= 0) continue;
      const glow = 0.5 * Math.min(1, gk / 0.12) * Math.exp(-Math.max(0, gk - 0.12) / 0.35) + 0.04 * smoothstep(0, 0.5, gk);
      if (glow <= 0.003) continue;
      const f = L.S / gw.S;
      const gx = L.serifX + M.serifOff[li] * L.S;
      ctx.globalAlpha = Math.min(1, glow);
      ctx.drawImage(gw.cv, gx - gw.ox * f, L.baseline - gw.oy * f, gw.w * f, gw.h * f);
    }
    ctx.globalAlpha = 1;
  }

  private drawText(g: CanvasRenderingContext2D, s: number) {
    const L = this.L!;
    const tl = this.timeline;
    const M = this.metrics!;
    if (s < tl.caretIn) return;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    // ---- the monospace line: typed, then "world" deleted, then "hello, " glides aside
    const xh = lerp(L.xTyped, L.xFinal, easeInOutCubic((s - tl.glide[0]) / (tl.glide[1] - tl.glide[0])));
    g.font = L.monoFont;
    g.fillStyle = '#efe6d2';
    const helloA = 0.94 - 0.12 * smoothstep(tl.cond0 + 1.2, tl.circle0 + 0.4, s);
    let nTyped = 0;
    let lastKey = tl.caretIn;
    for (let i = 0; i < MONO_TEXT.length; i++) {
      const ts = tl.type[i];
      if (s < ts) break;
      nTyped = i + 1;
      lastKey = ts;
      // a terminal prints the glyph the instant the key lands
      let a = 1;
      if (i >= HELLO_N) {
        const del = tl.del[MONO_TEXT.length - 1 - i];
        a = 1 - smoothstep(del, del + 0.07, s);
      }
      const ch = MONO_TEXT[i];
      if (a <= 0 || ch === ' ') continue;
      g.globalAlpha = a * helloA;
      g.fillText(ch, xh + i * L.adv, L.baseline);
    }
    let nVis = nTyped;
    for (let k = 0; k < tl.del.length; k++) {
      if (s >= tl.del[k]) {
        nVis = Math.min(nVis, MONO_TEXT.length - 1 - k);
        lastKey = Math.max(lastKey, tl.del[k]);
      }
    }
    // ---- caret: solid while keys are pressed; in the held breath it blinks once
    let ca = smoothstep(tl.caretIn, tl.caretIn + 0.2, s) * (1 - smoothstep(tl.caretOut[0], tl.caretOut[1], s));
    if (ca > 0) {
      const since = s - lastKey;
      if (since > 0.42) {
        const ph = (since - 0.42) % 1.06;
        ca *= 1 - (smoothstep(0, 0.05, ph) - smoothstep(0.3, 0.35, ph));
      }
      if (ca > 0.001) {
        g.globalAlpha = ca * 0.92;
        g.fillRect(
          xh + nVis * L.adv + 0.04 * L.M,
          L.baseline - M.monoAsc * L.M - 0.06 * L.M,
          Math.max(1.5, 0.075 * L.M),
          (M.monoAsc + 0.3) * L.M,
        );
      }
    }
    // ---- the gold serif, letter by letter (its warm breath is on the sky layer, underneath)
    g.font = L.serifFont;
    g.fillStyle = L.gold;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      const cr = tl.crisp[li];
      if (!cr) continue;
      const a = easeOutCubic((s - cr[0]) / (cr[1] - cr[0]));
      if (a <= 0) continue;
      g.globalAlpha = a;
      g.fillText(SERIF_TEXT[li], L.serifX + M.serifOff[li] * L.S, L.baseline);
    }
    g.globalAlpha = 1;
  }

  /**
   * The limb scale at the astrolabe's radii: edge and tick circles cut by one burin at an even
   * pace, the inner circle a breath behind, ticks struck just behind the head (10° long in
   * brass-light, 5° in brass, 1° on large limbs), the zenith mark last.
   */
  private drawCircle(g: CanvasRenderingContext2D, s: number) {
    const tl = this.timeline;
    if (s < tl.circle0) return;
    const L = this.L!;
    const u = clamp01((s - tl.circle0) / tl.circleDur);
    const a0 = -Math.PI / 2;
    const a1 = a0 + TAU * easeLimb(u);
    const r = L.r;
    const cx = L.cx;
    const cy = L.cy;
    const r1 = r * LIMB_R1;
    const hair = this.dprTextEff >= 2 ? 0.7 : 1;
    g.lineCap = 'butt';
    g.strokeStyle = 'rgba(201,162,91,0.9)';
    g.lineWidth = hair * 1.15;
    g.beginPath();
    g.arc(cx, cy, r1, a0, a1, false);
    g.stroke();
    g.strokeStyle = 'rgba(201,162,91,0.55)';
    g.lineWidth = hair;
    g.beginPath();
    g.arc(cx, cy, r * LIMB_EDGE, a0, a1, false);
    g.stroke();
    const pIn = easeLimb((s - tl.circle0 - 0.05) / tl.circleDur);
    if (pIn > 0) {
      g.strokeStyle = 'rgba(201,162,91,0.6)';
      g.beginPath();
      g.arc(cx, cy, r * LIMB_R2, a0, a0 + TAU * pIn, false);
      g.stroke();
    }
    const fine = r >= 300;
    for (let cls = 0; cls < 3; cls++) {
      if (cls === 2 && !fine) break;
      const rEnd = r * (cls === 0 ? LIMB_R2 : cls === 1 ? LIMB_T5 : LIMB_T1);
      g.beginPath();
      let any = false;
      for (let k = 0; k < 360; k++) {
        const kc = k % 10 === 0 ? 0 : k % 5 === 0 ? 1 : 2;
        if (kc !== cls) continue;
        const gr = easeOutQuint((s - tl.tickPass[k] - 0.02) / 0.3);
        if (gr <= 0) continue;
        any = true;
        const rin = r1 - (r1 - rEnd) * gr;
        g.moveTo(cx + TICK_COS[k] * r1, cy + TICK_SIN[k] * r1);
        g.lineTo(cx + TICK_COS[k] * rin, cy + TICK_SIN[k] * rin);
      }
      if (!any) continue;
      if (cls === 0) {
        g.strokeStyle = 'rgba(234,214,160,0.92)';
        g.lineWidth = hair * 1.3;
      } else if (cls === 1) {
        g.strokeStyle = 'rgba(201,162,91,0.8)';
        g.lineWidth = hair;
      } else {
        g.strokeStyle = 'rgba(201,162,91,0.55)';
        g.lineWidth = hair * 0.85;
      }
      g.stroke();
    }
    // the burin's spark at the head
    const sparkA = 0.85 * smoothstep(0, 0.06, u) * (1 - smoothstep(0.9, 1, u));
    if (sparkA > 0.01 && this.spark) {
      const R = Math.max(6, 0.036 * r);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = sparkA;
      g.drawImage(this.spark, cx + Math.cos(a1) * r1 - R, cy + Math.sin(a1) * r1 - R, R * 2, R * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }
}
