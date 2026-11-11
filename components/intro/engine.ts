/*
 * hello, imad's world — intro engine (Canvas 2D, framework-free).
 *
 * Every frame is a pure function of t (seconds since mount), the layout and seeded parameters:
 * no particle state is integrated over time. That makes the animation resize-safe, lets skip
 * jump straight to the end, and lets captures seek to any instant.
 *
 * Sequence (script time s = t - T0, T0 ≈ 0.85 s once fonts are ready):
 *   stars fade in brightest-first, as at dusk → caret → "hello, world" typed with a human rhythm →
 *   "world" deleted letter by letter, each letter loosening into motes that drift up and become
 *   stars → "hello, " glides aside → light spirals out of nearby stars into "imad’s world",
 *   letter by letter, then the crisp gold glyph ignites with a brief glow → a fine engraved limb
 *   circle (ticks every 5°, longer every 30°) is drawn clockwise around it.
 *
 * Mobile budget: DPR capped at 2, glyph samples taken once on offscreen canvases (no per-frame
 * getImageData), typed arrays, ≤ ~1400 particles, stars and motes batched by alpha bucket,
 * pre-rendered background / band / glows, first-use draw paths warmed up invisibly.
 */

export type IntroEventName = 'type' | 'backspace' | 'dissolve' | 'condense' | 'circle';

export interface IntroTargetRect {
  /** Centre of the limb circle, CSS px, relative to the canvas box. */
  cx: number;
  cy: number;
  /** Radius of the limb circle, CSS px. */
  r: number;
}

export interface IntroEngineOptions {
  seed?: number;
  /** Static final frame, no motion at all. */
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
const T0_MIN = 0.85; // earliest script start (s since mount)
const OMEGA = (0.3 * Math.PI) / 180; // sky rotation, rad/s — counter-clockwise, as facing north
const DECEL_TAU = 2.2; // after the intro the sky settles towards stillness
const MAX_DPR = 2;
const NB = 16; // alpha buckets for batching
const SKY_SCALE = 1.18; // sky square side / max(w, h)
const BAND_ALPHA = 0.1;
const SKIP_FADE = 0.4;
const FALLBACK_MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
const FALLBACK_SERIF = "'Cormorant Garamond', 'Newsreader', Georgia, serif";

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
function easeInOutQuint(x: number) {
  x = clamp01(x);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}
function easeInOutCubic(x: number) {
  x = clamp01(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/** Ease from a velocity profile u^a (1-u)^b: soft departure, quint-like landing. */
function makeBetaEase(a: number, b: number) {
  const n = 512;
  const lut = new Float32Array(n + 1);
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n;
    acc += Math.pow(u, a) * Math.pow(1 - u, b);
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
const easeDissolve = makeBetaEase(0.8, 2.6);
const easeCondense = makeBetaEase(1.35, 3.6);

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
  tickPass: Float32Array;
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
  const gaps = [0, 0.095, 0.082, 0.112, 0.094, 0.118, 0.285, 0.098, 0.088, 0.104, 0.083, 0.116];
  const type: number[] = [];
  let s = 0;
  for (const g of gaps) {
    s += g;
    type.push(s);
  }
  const del: number[] = [];
  for (const g of [0.5, 0.12, 0.11, 0.11, 0.11]) {
    s += g;
    del.push(s);
  }
  const lastDel = s;
  return {
    type,
    caretIn: -0.38,
    del,
    caretOut: [lastDel + 0.12, lastDel + 0.35],
    glide: [lastDel + 0.4, lastDel + 1.45],
    cond0: lastDel + 0.7,
    stagger: 0.055,
    letterJitter: 0.26,
    flight: [1.0, 1.4],
    crisp: [],
    circle0: 0,
    circleDur: 1.4,
    done: 0,
    tickPass: new Float32Array(72),
  };
}

/** Sample ink pixels of one glyph with a jittered grid (blue-noise-ish), in em units. */
function sampleGlyph(font: string, ch: string, R: number, rng: Rng, target: number): GlyphSample {
  const pad = Math.ceil(R * 0.6);
  const cv = makeCanvas(R * 2 + pad * 2, R * 2.2);
  const g = ctx2d(cv, { willReadFrequently: true });
  g.font = font;
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  const by = Math.round(R * 1.5);
  g.fillText(ch, pad, by);
  const data = g.getImageData(0, 0, cv.width, cv.height).data;
  const W = cv.width;
  const H = cv.height;
  release(cv);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] >= 128) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const n = xs.length;
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
      const key = Math.floor(xs[p] / cell) * 4096 + Math.floor(ys[p] / cell);
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
    const py = (ys[q] + 0.5 - by) / R;
    pts[c * 2] = (xs[q] + 0.5 - pad) / R;
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
  const g = ctx2d(cv);
  g.font = style + ' 77px ' + family;
  const ok = g.font.indexOf('77px') >= 0;
  release(cv);
  return ok ? family : fallback;
}

// ---------------------------------------------------------------------------
// Batched soft-dot renderer: one globalAlpha change per (sprite, alpha bucket)
// ---------------------------------------------------------------------------
class DotBatch {
  private nKeys: number;
  private n = 0;
  private key: Int16Array;
  private x: Float32Array;
  private y: Float32Array;
  private r: Float32Array;
  private order: Int32Array;
  private counts: Int32Array;
  private cursor: Int32Array;

  constructor(
    nSprites: number,
    private cap: number,
  ) {
    this.nKeys = nSprites * NB;
    this.key = new Int16Array(cap);
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.r = new Float32Array(cap);
    this.order = new Int32Array(cap);
    this.counts = new Int32Array(this.nKeys);
    this.cursor = new Int32Array(this.nKeys);
  }

  push(sprite: number, a: number, x: number, y: number, r: number) {
    if (this.n >= this.cap || a <= 0.004) return;
    let b = (a * NB) | 0;
    if (b >= NB) b = NB - 1;
    const i = this.n++;
    const k = sprite * NB + b;
    this.key[i] = k;
    this.x[i] = x;
    this.y[i] = y;
    this.r[i] = r;
    this.counts[k]++;
  }

  flush(ctx: CanvasRenderingContext2D, sprites: HTMLCanvasElement[]) {
    let acc = 0;
    for (let k = 0; k < this.nKeys; k++) {
      this.cursor[k] = acc;
      acc += this.counts[k];
    }
    for (let i = 0; i < this.n; i++) this.order[this.cursor[this.key[i]]++] = i;
    let start = 0;
    for (let k = 0; k < this.nKeys; k++) {
      const c = this.counts[k];
      if (!c) continue;
      const img = sprites[(k / NB) | 0];
      ctx.globalAlpha = ((k % NB) + 0.5) / NB;
      for (let j = start; j < start + c; j++) {
        const id = this.order[j];
        const r = this.r[id];
        ctx.drawImage(img, this.x[id] - r, this.y[id] - r, r * 2, r * 2);
      }
      start += c;
    }
    ctx.globalAlpha = 1;
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
  ready = false;
  private doneFired = false;
  private pendingSkip = false;
  private skipAt = -1;
  private snap: HTMLCanvasElement | null = null;
  private evIdx = 0;
  private events: [number, IntroEventName][] = [];
  private disposed = false;
  private raf = 0;
  private lastNow = 0;
  private frames = 0;
  private idleToggle = false;
  private warmed = false;
  private layerTimer = 0;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private L: Layout | null = null;
  private fonts: { mono: string; serif: string };
  private metrics: Metrics | null = null;
  private timeline: Timeline = buildTimeline();
  private stars: Stars | null = null;
  private D: Dissolve | null = null;
  private C: Condense | null = null;
  private dots = new DotBatch(4, 8192);

  private bg: HTMLCanvasElement | null = null;
  private band: HTMLCanvasElement | null = null;
  private sprites: HTMLCanvasElement[] = [];
  private pSprites: HTMLCanvasElement[] = [];
  private spark: HTMLCanvasElement | null = null;
  private glows: (Glow | null)[] = [];
  private starBucketStyles: string[] = [];
  private starCounts = new Int32Array(4 * NB);
  private starCursor = new Int32Array(4 * NB);
  private sprIdx = new Int32Array(512);
  private pos: Vec = [0, 0];

  constructor(canvas: HTMLCanvasElement, opts: IntroEngineOptions = {}) {
    this.canvas = canvas;
    this.ctx = ctx2d(canvas, { alpha: false });
    this.seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
    this.reduced = !!opts.reducedMotion;
    this.manual = !!opts.manual;
    this.pendingSkip = !!opts.startFinal;
    this.onEvent = opts.onEvent || (() => {});
    this.onDone = opts.onDone || (() => {});
    this.getTarget = opts.getTarget;
    for (let c = 0; c < 4; c++)
      for (let b = 0; b < NB; b++) this.starBucketStyles.push(rgba(STAR_COLS[c], (b + 0.5) / NB));
    const cs = getComputedStyle(canvas);
    this.fonts = {
      mono: cs.getPropertyValue('--font-mono-intro').trim(),
      serif: cs.getPropertyValue('--font-serif-intro').trim(),
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  start() {
    this.fonts = {
      mono: usableFamily(this.fonts.mono, '400', FALLBACK_MONO),
      serif: usableFamily(this.fonts.serif, 'italic 500', FALLBACK_SERIF),
    };
    this.canvas.addEventListener('contextrestored', this.onRestore);
    this.resize();
    this.loadFonts().then(() => {
      if (this.disposed) return;
      this.prepare(this.manual ? T0_MIN : Math.max(T0_MIN, this.t + 0.45));
      if (this.reduced || this.pendingSkip) this.enterFinal(false);
      if (this.reduced) this.render(this.t);
    });
    if (!this.manual && !this.reduced) {
      this.lastNow = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  dispose() {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.layerTimer) clearTimeout(this.layerTimer);
    this.canvas.removeEventListener('contextrestored', this.onRestore);
    release(this.bg);
    release(this.band);
    release(this.snap);
    release(this.spark);
    this.sprites.forEach(release);
    this.pSprites.forEach(release);
    this.glows.forEach((g) => release(g && g.cv));
    this.bg = this.band = this.snap = this.spark = null;
    this.sprites = [];
    this.pSprites = [];
    this.glows = [];
  }

  /** Jump to the final state with a 400 ms crossfade (no-op once done). */
  skip() {
    if (this.disposed || this.doneFired || this.skipAt >= 0 || this.reduced) return;
    if (!this.ready) {
      this.pendingSkip = true;
      return;
    }
    this.enterFinal(true);
  }

  /** The target rect changed: lay out again without restarting. */
  relayout() {
    if (!this.L) return;
    this.layout(false);
    if (this.metrics) this.layoutText();
    this.render(this.t);
  }

  /** Deterministic render at time t (manual mode, captures, tests). */
  renderAt(t: number) {
    if (t < this.t) this.evIdx = 0;
    this.t = t;
    this.render(t);
  }

  private enterFinal(crossfade: boolean) {
    if (crossfade) {
      const snap = makeCanvas(this.canvas.width, this.canvas.height);
      ctx2d(snap).drawImage(this.canvas, 0, 0);
      this.snap = snap;
      this.skipAt = this.t;
      this.tDone = this.t + SKIP_FADE;
    } else {
      this.skipAt = this.t - SKIP_FADE;
      this.tDone = this.t;
    }
    this.pendingSkip = false;
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1; // a hidden tab or a hitch never skips the story ahead
    this.t += dt;
    if (++this.frames % 30 === 0 && Math.min(MAX_DPR, window.devicePixelRatio || 1) !== this.dpr) this.resize();
    if (this.doneFired && this.t > this.tDone + 3) {
      // the sky keeps breathing at half rate once the intro is over
      this.idleToggle = !this.idleToggle;
      if (this.idleToggle) return;
    }
    this.render(this.t);
  };

  private onRestore = () => {
    // the browser dropped the GPU context: every pre-rendered layer must be rebuilt
    this.sprites.forEach(release);
    this.sprites = [];
    this.L = null;
    this.resize();
  };

  private loadFonts(): Promise<unknown> {
    const fs = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fs || !fs.load) return Promise.resolve();
    const f = this.fonts;
    const all = Promise.all([
      fs.load('400 40px ' + f.mono, MONO_TEXT).catch(() => []),
      fs.load('italic 500 40px ' + f.serif, SERIF_TEXT).catch(() => []),
    ]);
    const timeout = new Promise((res) => setTimeout(res, 3000));
    return Promise.race([all, timeout]);
  }

  // -------------------------------------------------------------------------
  // Sizing / layout
  // -------------------------------------------------------------------------
  resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const changed = w !== this.w || h !== this.h || dpr !== this.dpr;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    if (!this.L) this.layout(true);
    else if (changed) this.layout(false);
    if (this.metrics) this.layoutText();
    // resizing clears the canvas: paint now, before the browser presents a blank frame
    this.render(this.t);
  }

  private layout(full: boolean) {
    const w = this.w;
    const h = this.h;
    const tg = this.getTarget ? this.getTarget(w, h) : null;
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
    };
    if (!this.stars) this.makeStars();
    this.makeSprites();
    this.recomputeStarSizes();
    if (full || !this.bg || !this.band) {
      this.rebuildLayers();
    } else {
      // background and band are costly: rebuild once the resize settles, stretch the old ones until then
      if (this.layerTimer) clearTimeout(this.layerTimer);
      this.layerTimer = window.setTimeout(() => {
        this.layerTimer = 0;
        if (this.disposed) return;
        this.rebuildLayers();
        if (this.manual || this.reduced || this.doneFired) this.render(this.t);
      }, 150);
    }
  }

  private rebuildLayers() {
    const oldBg = this.bg;
    const oldBand = this.band;
    this.bg = this.makeBackground();
    this.band = this.makeBand();
    release(oldBg);
    release(oldBand);
  }

  private layoutText() {
    const M = this.metrics;
    const L = this.L;
    if (!M || !L) return;
    const w = this.w;
    const helloAdv = HELLO_N * M.adv * MONO_RATIO; // in S units
    const inkL = MONO_RATIO * M.monoInkL;
    const inkR = helloAdv + M.serifInkR;
    const inkW = inkR - inkL;
    const gutter = Math.max(18, w * 0.06);
    const maxW = Math.max(40, Math.min(w - 2 * gutter, 1.62 * L.r));
    const S = Math.max(8, Math.min(maxW / inkW, 0.27 * L.r, 112));
    const Mz = S * MONO_RATIO;
    L.S = S;
    L.M = Mz;
    L.xFinal = L.cx - ((inkL + inkR) / 2) * S;
    L.serifX = L.xFinal + helloAdv * S;
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
    const gr = this.ctx.createLinearGradient(0, L.baseline - M.serifAsc * S, 0, L.baseline + 0.04 * S);
    gr.addColorStop(0, '#ead6a0');
    gr.addColorStop(1, '#c9a25b');
    L.gold = gr;
    this.makeGlows();
  }

  private recomputeStarSizes() {
    const st = this.stars;
    if (!st) return;
    const base = Math.max(1.2 / this.dpr, 0.55);
    for (let i = 0; i < st.n; i++) {
      const I = st.I[i];
      st.sz[i] = base * (I < 2.6 ? 1 : 1 + 0.2 * (I - 2.6));
    }
  }

  // -------------------------------------------------------------------------
  // Fonts → metrics and glyph samples (once)
  // -------------------------------------------------------------------------
  private measure() {
    const R = 120;
    const g = ctx2d(makeCanvas(8, 8));
    const f = this.fonts;
    const monoFont = '400 ' + R + 'px ' + f.mono;
    const serifFont = 'italic 500 ' + R + 'px ' + f.serif;
    g.font = monoFont;
    const adv = g.measureText('0').width / R;
    const mt = g.measureText(MONO_TEXT);
    const mh = g.measureText('hello,');
    g.font = serifFont;
    const st = g.measureText(SERIF_TEXT);
    const serifOff: number[] = [];
    for (let i = 0; i < SERIF_TEXT.length; i++) {
      const pre = g.measureText(SERIF_TEXT.slice(0, i + 1)).width;
      const one = g.measureText(SERIF_TEXT[i]).width;
      serifOff.push((pre - one) / R); // includes kerning with the previous letter
    }
    const rng = mulberry32(this.seed ^ 0x51ed);
    const inks = WORLD.split('').map((ch) => sampleGlyph(monoFont, ch, R, rng, 1).ink);
    const maxInk = Math.max(...inks);
    const worldSamples = WORLD.split('').map((ch, j) =>
      sampleGlyph(monoFont, ch, R, rng, Math.round(46 + 34 * (inks[j] / maxInk))),
    );
    const serifInk = SERIF_TEXT.split('').map((ch) => (ch === ' ' ? 0 : sampleGlyph(serifFont, ch, R, rng, 1).ink));
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
      serifInk,
      serifInkTotal: serifInk.reduce((a, b) => a + b, 0),
    };
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
      x: new Float32Array(cap),
      y: new Float32Array(cap),
      al: new Float32Array(cap),
      key: new Int16Array(cap),
      order: new Int32Array(cap),
    };
    this.stars = st;
    const band = this.bandCurve();
    const mags = new Float32Array(nBase);
    // N(<m) ∝ 10^(0.47 m), m from −1.2 to 6.6: a natural, faint-heavy magnitude distribution
    const lo = Math.pow(10, 0.47 * -1.2);
    const hi = Math.pow(10, 0.47 * 6.6);
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
      mags[i] = m;
      const cr = rng();
      this.setStarLook(i, m, rng, cr < 0.22 ? 0 : cr < 0.67 ? 1 : cr < 0.9 ? 2 : 3);
      st.born[i] = NaN;
      st.dim[i] = NaN;
    }
    // brightest first, as at dusk
    const order = Array.from({ length: nBase }, (_, k) => k).sort((p, q) => mags[p] - mags[q]);
    for (let r = 0; r < nBase; r++) st.appear[order[r]] = 0.06 + 1.0 * Math.pow(r / nBase, 0.8) + rng() * 0.1;
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
        const l = Math.hypot(tx, ty) || 1;
        return [-ty / l, tx / l];
      },
      tan: (t) => {
        const [tx, ty] = tangent(t);
        return Math.atan2(ty, tx);
      },
    };
  }

  private skyToScreen(u: number, v: number, th: number, out: Vec) {
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
  /** Radial night (#0b1230 → #070a14), dithered so the gradient never bands. */
  private makeBackground() {
    const L = this.L!;
    const w = this.w;
    const h = this.h;
    const sc = Math.min(1, 900 / Math.max(w, h));
    const bw = Math.max(2, Math.round(w * sc));
    const bh = Math.max(2, Math.round(h * sc));
    const cv = makeCanvas(bw, bh);
    const g = ctx2d(cv);
    const img = g.createImageData(bw, bh);
    const d = img.data;
    const cx = L.cx * sc;
    const cy = (L.cy - 0.05 * L.r) * sc;
    const R = 0.62 * Math.hypot(bw, bh);
    const c0 = [11, 18, 48];
    const c1 = [7, 10, 20];
    const rng = mulberry32(this.seed ^ 0xb6);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let t = Math.hypot(x - cx, (y - cy) * 1.08) / R;
        if (t > 1) t = 1;
        const k = Math.pow(t * t * (3 - 2 * t), 0.8);
        const o = (y * bw + x) * 4;
        const n = rng() + rng() - 1; // triangular dither, ±1 LSB
        d[o] = c0[0] + (c1[0] - c0[0]) * k + n;
        d[o + 1] = c0[1] + (c1[1] - c0[1]) * k + n;
        d[o + 2] = c0[2] + (c1[2] - c0[2]) * k + n;
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /**
   * The band is painted at full intensity into a half-res texture and composited at low alpha,
   * so 8-bit quantisation never shows. Irregular width, meandering spine, patchy dust lanes.
   */
  private makeBand() {
    const Ls = this.L!.sky.L;
    const N = Math.max(128, Math.min(1024, Math.ceil(Ls * 0.5)));
    const cv = makeCanvas(N, N);
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
    return cv;
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

  /** A warm glow per serif letter (shadowBlur once, here; never per frame). */
  private makeGlows() {
    const L = this.L!;
    const dpr = this.dpr;
    const S = L.S;
    this.glows.forEach((g) => release(g && g.cv));
    const g0 = ctx2d(makeCanvas(4, 4));
    g0.font = L.serifFont;
    const blurA = Math.max(2, 0.06 * S);
    const blurB = Math.max(5, 0.2 * S);
    const pad = blurB * 2.2;
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
      g.font = 'italic 500 ' + (S * dpr).toFixed(2) + 'px ' + this.fonts.serif;
      g.fillStyle = 'rgba(234,214,160,1)';
      g.shadowColor = 'rgba(234,200,140,0.9)';
      g.shadowBlur = blurB * dpr;
      g.fillText(ch, left * dpr, top * dpr);
      g.shadowColor = 'rgba(250,230,180,1)';
      g.shadowBlur = blurA * dpr;
      g.fillText(ch, left * dpr, top * dpr);
      return { cv, ox: left, oy: top, w: cv.width / dpr, h: cv.height / dpr };
    });
  }

  // -------------------------------------------------------------------------
  // Particles (generated once fonts are known; positions are pure functions of t)
  // -------------------------------------------------------------------------
  private prepare(T0: number) {
    this.measure();
    this.layoutText();
    this.T0 = T0;
    const tl = this.timeline;
    this.makeDissolve();
    this.makeCondense();
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
    this.evIdx = 0;
    this.tDone = T0 + tl.done;
    this.ready = true;
  }

  /** "world" → motes that drift up in a widening plume and become stars that stay. */
  private makeDissolve() {
    const rng = mulberry32(this.seed ^ 0xd155);
    const M = this.metrics!;
    const L = this.L!;
    const tl = this.timeline;
    const st = this.stars!;
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
    };
    const tmp: Vec = [0, 0];
    const h = this.h;
    let p = 0;
    for (let j = 0; j < WORLD.length; j++) {
      const sm = M.worldSamples[j];
      const del = tl.del[WORLD.length - 1 - j];
      const lx = L.xTyped + (HELLO_N + j) * L.adv;
      const span = Math.max(1e-3, sm.maxY - sm.minY);
      for (let k = 0; k < sm.n; k++) {
        const ex = sm.pts[k * 2];
        const ey = sm.pts[k * 2 + 1];
        D.letter[p] = j;
        D.ex[p] = ex;
        D.ey[p] = ey;
        const ny = (sm.maxY - ey) / span; // 0 bottom … 1 top: the top of the letter lifts first
        D.rel[p] = del + 0.05 + 0.16 * (1 - ny) + rng() * 0.08;
        D.dur[p] = 2.0 + rng() * 1.3;
        D.sway[p] = (rng() - 0.5) * 0.3;
        D.ta[p] = (3 + rng() * 7) * (L.M / 20);
        D.tf[p] = 2 + rng() * 4;
        D.tp[p] = TAU * rng();
        const sx = lx + ex * L.M;
        const sy = L.baseline + ey * L.M;
        // rise into the room actually available above the word: never pile up against the edge
        const avail = Math.max(20, sy - h * 0.05);
        let dy = (0.08 + 0.44 * Math.pow(rng(), 0.8)) * h;
        if (dy > avail) dy = avail * (0.55 + 0.45 * rng());
        let x = sx + gauss(rng) * (14 + 0.46 * dy);
        for (let tries = 0; tries < 3 && (x < this.w * 0.04 || x > this.w * 0.96); tries++) {
          x = sx + gauss(rng) * (14 + 0.46 * dy);
        }
        x = Math.min(this.w * 0.96, Math.max(this.w * 0.04, x));
        const y = sy - dy;
        const landS = D.rel[p] + D.dur[p];
        this.screenToSky(x, y, this.theta(this.T0 + landS), tmp);
        const si = st.n++;
        st.u[si] = tmp[0];
        st.v[si] = tmp[1];
        const mag = rng() < 0.05 ? 2.7 + rng() * 1.0 : 4.4 + 2.2 * Math.pow(rng(), 0.55);
        this.setStarLook(si, mag, rng, 1);
        st.born[si] = landS;
        st.dim[si] = NaN;
        st.appear[si] = 0;
        D.star[p] = si;
        p++;
      }
    }
    this.recomputeStarSizes();
    this.D = D;
  }

  /** "imad’s world" ← light spiralling out of nearby stars, letter by letter. */
  private makeCondense() {
    const rng = mulberry32(this.seed ^ 0xc0de);
    const L = this.L!;
    const M = this.metrics!;
    const tl = this.timeline;
    const st = this.stars!;
    const R = 120;
    const font = 'italic 500 ' + R + 'px ' + this.fonts.serif;
    // count from the ink area, so the stardust reads the same on every screen
    const inkPx = M.serifInkTotal * L.S * L.S;
    const spacing = Math.max(1.45, 0.028 * L.S);
    const target = Math.max(380, Math.min(900, Math.round(inkPx / (spacing * spacing))));
    const letters: ((GlyphSample & { spacingEm: number }) | null)[] = [];
    let total = 0;
    for (let i = 0; i < SERIF_TEXT.length; i++) {
      if (!M.serifInk[i]) {
        letters.push(null);
        continue;
      }
      const want = Math.max(14, Math.round((target * M.serifInk[i]) / M.serifInkTotal));
      const sm = sampleGlyph(font, SERIF_TEXT[i], R, rng, want);
      letters.push({ ...sm, spacingEm: Math.sqrt(M.serifInk[i] / Math.max(1, sm.n)) });
      total += sm.n;
    }
    // source stars: weighted by brightness and nearness, at most two motes each
    const th = this.theta(this.T0 + tl.cond0);
    const pos: Vec = [0, 0];
    const keys: [number, number][] = [];
    const span = 0.24 * Math.max(this.w, this.h);
    const maxD = 0.62 * Math.max(this.w, this.h);
    for (let s = 0; s < st.n; s++) {
      const bs = st.born[s];
      if (isNum(bs) && bs > tl.cond0) continue; // settled dust from "world" may give light too
      this.skyToScreen(st.u[s], st.v[s], th, pos);
      if (pos[0] < 2 || pos[1] < 2 || pos[0] > this.w - 2 || pos[1] > this.h - 2) continue;
      const dx = (pos[0] - L.textCx) / (L.textW * 0.62);
      const dy = (pos[1] - L.textCy) / L.S;
      if (dx * dx + dy * dy < 1) continue;
      const d = Math.hypot(pos[0] - L.textCx, pos[1] - L.textCy);
      if (d > maxD) continue;
      const wgt = (0.3 + st.a[s]) * Math.exp(-d / span) * (pos[1] < L.textCy ? 1.35 : 1);
      keys.push([Math.pow(rng(), 1 / wgt), s]);
      keys.push([Math.pow(rng(), 1 / wgt) * 0.92, s]);
    }
    keys.sort((a, b) => b[0] - a[0]);
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
      spacingEm: letters.map((l) => (l ? l.spacingEm : 0)),
    };
    const arrs: number[][] = [];
    let p = 0;
    let order = 0;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      const sm = letters[li];
      arrs.push([]);
      if (!sm) continue;
      for (let k = 0; k < sm.n; k++) {
        C.letter[p] = li;
        C.ex[p] = sm.pts[k * 2];
        C.ey[p] = sm.pts[k * 2 + 1];
        const dur = lerp(tl.flight[0], tl.flight[1], rng());
        const arr = tl.cond0 + dur + order * tl.stagger + rng() * tl.letterJitter;
        C.arr[p] = arr;
        C.dur[p] = dur;
        arrs[li].push(arr);
        const src = keys.length ? keys[p % keys.length][1] : 0;
        C.src[p] = src;
        if (!isNum(st.dim[src]) || arr - dur < st.dim[src]) st.dim[src] = arr - dur;
        C.k[p] = 0.55 + 0.45 * rng();
        C.big[p] = rng() < 0.2 ? 1 : 0;
        p++;
      }
      order++;
    }
    this.C = C;
    // each letter turns crisp once ~72 % of its motes have landed
    tl.crisp = [];
    let lastEnd = 0;
    for (const A of arrs) {
      if (!A.length) {
        tl.crisp.push(null);
        continue;
      }
      A.sort((a, b) => a - b);
      const a0 = A[Math.floor(A.length * 0.72)];
      const a1 = A[A.length - 1] + 0.24;
      tl.crisp.push([a0, a1]);
      if (a1 > lastEnd) lastEnd = a1;
    }
    tl.circle0 = lastEnd - 0.5;
    tl.done = tl.circle0 + tl.circleDur + 0.2;
    for (let tk = 0; tk < 72; tk++) {
      const target2 = tk / 72;
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 30; it++) {
        const m = (lo + hi) / 2;
        if (easeInOutCubic(m) < target2) lo = m;
        else hi = m;
      }
      tl.tickPass[tk] = tl.circle0 + lo * tl.circleDur;
    }
    tl.tickPass[0] = tl.circle0 + tl.circleDur - 0.02; // the zenith mark is engraved last, closing the ring
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  private render(t: number) {
    const L = this.L;
    if (this.disposed || !L || !this.bg || !this.band) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const w = this.w;
    const h = this.h;
    const final = this.skipAt >= 0;
    const skipK = final ? clamp01((t - this.skipAt) / SKIP_FADE) : 0;
    let s = this.ready ? t - this.T0 : -Infinity;
    if (final || this.reduced) s = Math.max(s, this.timeline.done + 1);

    if (this.ready && !final && !this.reduced) {
      while (this.evIdx < this.events.length && this.events[this.evIdx][0] <= s) {
        const name = this.events[this.evIdx][1];
        this.evIdx++;
        this.onEvent(name);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0, w, h);

    const th = this.theta(t);
    const fade = this.reduced || final ? 1 : smoothstep(0.1, 1.8, t);
    const sky = L.sky;
    ctx.save();
    ctx.translate(sky.Px, sky.Py);
    ctx.rotate(th);
    ctx.translate(sky.Cx - sky.Px, sky.Cy - sky.Py);
    ctx.globalAlpha = BAND_ALPHA * fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.band, -sky.L / 2, -sky.L / 2, sky.L, sky.L);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    this.drawStars(ctx, t, s, th, final);
    if (this.ready) {
      if (!this.warmed) this.warmUp(ctx);
      if (!final) {
        ctx.globalCompositeOperation = 'lighter';
        this.pushDissolve(s, th);
        this.pushCondense(s, th);
        this.dots.flush(ctx, this.pSprites);
        ctx.globalCompositeOperation = 'source-over';
      }
      this.drawText(ctx, s);
      this.drawCircle(ctx, s);
    }

    if (this.snap) {
      if (skipK < 1) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - easeOutCubic(skipK);
        ctx.drawImage(this.snap, 0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 1;
      } else {
        release(this.snap);
        this.snap = null;
      }
    }

    if (this.ready && !this.doneFired && t >= this.tDone) {
      this.doneFired = true;
      this.onDone();
    }
  }

  /**
   * First use of a canvas path (text at a size, additive blending, a sprite) can stall while the
   * browser builds glyph caches and GPU pipelines. Do it once, below half an 8-bit step of alpha,
   * while only the stars are moving.
   */
  private warmUp(ctx: CanvasRenderingContext2D) {
    this.warmed = true;
    const L = this.L!;
    const M = this.metrics!;
    const x = this.w * 0.5;
    const y = this.h * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.002;
    ctx.fillStyle = '#efe6d2';
    ctx.font = L.monoFont;
    ctx.fillText(MONO_TEXT, L.xTyped, L.baseline);
    ctx.font = L.serifFont;
    ctx.fillStyle = L.gold;
    ctx.fillText(SERIF_TEXT, L.serifX, L.baseline);
    ctx.globalCompositeOperation = 'lighter';
    this.pSprites.forEach((sp, i) => ctx.drawImage(sp, x + i * 6, y, 4, 4));
    this.glows.forEach((g, j) => {
      if (g) ctx.drawImage(g.cv, L.serifX + M.serifOff[j] * L.S - g.ox, L.baseline - g.oy, g.w, g.h);
    });
    if (this.spark) ctx.drawImage(this.spark, x, y, 6, 6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(201,162,91,1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, L.r, 0, 0.5);
    ctx.stroke();
    ctx.restore();
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
    counts.fill(0);
    let sprN = 0;
    for (let i = 0; i < n; i++) {
      st.key[i] = -1;
      let a = st.a[i];
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
      if (st.spr[i]) {
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
        const z = st.sz[id];
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

  private pushDissolve(s: number, th: number) {
    const D = this.D;
    if (!D) return;
    const tl = this.timeline;
    const L = this.L!;
    const st = this.stars!;
    const Mw = this.metrics!.worldSamples;
    const pos = this.pos;
    const dt = 1 / 70;
    for (let p = 0; p < D.n; p++) {
      const j = D.letter[p];
      const del = tl.del[WORLD.length - 1 - j];
      if (s < del) continue;
      if (s >= D.rel[p] + D.dur[p]) continue;
      const rad = Math.max(0.8, 0.62 * Math.sqrt(Mw[j].ink / Math.max(1, Mw[j].n)) * L.M);
      const lx = L.xTyped + (HELLO_N + j) * L.adv;
      const sx = lx + D.ex[p] * L.M;
      const sy = L.baseline + D.ey[p] * L.M;
      const si = D.star[p];
      this.dissolvePos(p, s, th, sx, sy, si, pos);
      const x = pos[0];
      const y = pos[1];
      this.dissolvePos(p, s - dt, th, sx, sy, si, pos);
      const u = clamp01((s - D.rel[p]) / D.dur[p]);
      // ink-bright at first, cooling to a dim mote, igniting as it becomes a star
      let a = lerp(0.95, 0.55, smoothstep(0, 0.25, u));
      a = lerp(a, st.a[si], smoothstep(0.35, 0.92, u)) * (1 + 0.8 * smoothstep(0.86, 1, u));
      a *= smoothstep(del, del + 0.06, s);
      if (a > 1) a = 1;
      const col = u < 0.3 ? 0 : 1;
      const r = lerp(rad, Math.max(0.9, st.sz[si] * 1.7), smoothstep(0.1, 0.9, u));
      this.dots.push(col, a, x, y, r);
      if (Math.abs(x - pos[0]) + Math.abs(y - pos[1]) > 1.4) this.dots.push(col, a * 0.35, pos[0], pos[1], r * 0.75);
    }
  }

  private dissolvePos(p: number, s: number, th: number, sx: number, sy: number, si: number, out: Vec) {
    const D = this.D!;
    const st = this.stars!;
    const rel = D.rel[p];
    if (s <= rel) {
      // held in the glyph, trembling as it loosens
      const k = clamp01((s - (rel - 0.16)) / 0.16);
      out[0] = sx + Math.sin(D.tp[p] + s * 26) * 0.3 * k;
      out[1] = sy - 0.8 * k * k;
      return;
    }
    const u = clamp01((s - rel) / D.dur[p]);
    const e = easeDissolve(u);
    this.skyToScreen(st.u[si], st.v[si], th, out);
    const dx = out[0] - sx;
    const dy = out[1] - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const sway = D.sway[p] * dist * Math.sin(Math.PI * e);
    const tb = D.ta[p] * Math.pow(1 - u, 1.4) * Math.min(1, u * 4);
    const ph = D.tf[p] * e * TAU * 0.5 + D.tp[p];
    out[0] = sx + dx * e + nx * sway + Math.sin(ph) * tb;
    out[1] = sy + dy * e + ny * sway + Math.cos(ph * 0.7) * tb * 0.35;
  }

  private pushCondense(s: number, th: number) {
    const C = this.C;
    if (!C) return;
    const tl = this.timeline;
    const L = this.L!;
    const M = this.metrics!;
    const st = this.stars!;
    const pos = this.pos;
    const dt = 1 / 55;
    for (let p = 0; p < C.n; p++) {
      const dep = C.arr[p] - C.dur[p];
      if (s < dep) continue;
      const li = C.letter[p];
      const cr = tl.crisp[li];
      const crisp = cr ? smoothstep(cr[0], cr[1], s) : 0;
      if (crisp >= 0.999) continue;
      const spc = C.spacingEm[li] * L.S;
      const tx = L.serifX + M.serifOff[li] * L.S + C.ex[p] * L.S;
      const ty = L.baseline + C.ey[p] * L.S;
      const u = clamp01((s - dep) / C.dur[p]);
      this.condensePos(p, u, th, tx, ty, pos);
      const x = pos[0];
      const y = pos[1];
      // light gathers: faint as it leaves its star, bright as it condenses
      let a = u < 1 ? lerp(Math.max(0.42, Math.min(0.75, st.a[C.src[p]])), 0.95, smoothstep(0.1, 0.7, u)) : 0.9;
      a *= 1 - crisp;
      const g = smoothstep(0.3, 0.95, u);
      const col = g < 0.3 ? 1 : g < 0.7 ? 2 : 3;
      const r = (C.big[p] ? Math.max(1.15, 0.88 * spc) : Math.max(0.85, 0.62 * spc)) * lerp(1.25, 1, smoothstep(0.4, 1, u));
      this.dots.push(col, a, x, y, r);
      if (u < 0.97) {
        this.condensePos(p, clamp01((s - dt - dep) / C.dur[p]), th, tx, ty, pos);
        if (Math.abs(x - pos[0]) + Math.abs(y - pos[1]) > 1.6) this.dots.push(col, a * 0.34, pos[0], pos[1], r * 0.8);
      }
    }
  }

  /**
   * Spiral in: the radius shrinks with the ease while the angle turns counter-clockwise, like the
   * sky, and straightens at the end, so every mote lands head-on.
   */
  private condensePos(p: number, u: number, th: number, tx: number, ty: number, out: Vec) {
    if (u >= 1) {
      out[0] = tx;
      out[1] = ty;
      return;
    }
    const C = this.C!;
    const st = this.stars!;
    const si = C.src[p];
    this.skyToScreen(st.u[si], st.v[si], th, out);
    const dx = out[0] - tx;
    const dy = out[1] - ty;
    const r0 = Math.hypot(dx, dy);
    const phi0 = Math.atan2(dy, dx);
    const e = easeCondense(u);
    const r = r0 * (1 - e);
    const phi = phi0 - C.k[p] * e * (2 - e);
    out[0] = tx + r * Math.cos(phi);
    out[1] = ty + r * Math.sin(phi);
  }

  private drawText(ctx: CanvasRenderingContext2D, s: number) {
    const L = this.L!;
    const tl = this.timeline;
    const M = this.metrics!;
    if (s < tl.caretIn) return;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // ---- the monospace line: typed, then "world" deleted, then "hello, " glides aside
    const xh = lerp(L.xTyped, L.xFinal, easeInOutQuint((s - tl.glide[0]) / (tl.glide[1] - tl.glide[0])));
    ctx.font = L.monoFont;
    ctx.fillStyle = '#efe6d2';
    const helloA = 0.94 - 0.12 * smoothstep(tl.cond0 + 1.2, tl.circle0 + 0.4, s);
    let nTyped = 0;
    let lastKey = tl.caretIn;
    for (let i = 0; i < MONO_TEXT.length; i++) {
      const ts = tl.type[i];
      if (s < ts) break;
      nTyped = i + 1;
      lastKey = ts;
      let a = smoothstep(ts, ts + 0.04, s);
      if (i >= HELLO_N) {
        const del = tl.del[MONO_TEXT.length - 1 - i];
        a *= 1 - smoothstep(del, del + 0.07, s);
      }
      const ch = MONO_TEXT[i];
      if (a <= 0 || ch === ' ') continue;
      ctx.globalAlpha = a * helloA;
      ctx.fillText(ch, xh + i * L.adv, L.baseline);
    }
    let nVis = nTyped;
    for (let k = 0; k < tl.del.length; k++) {
      if (s >= tl.del[k]) {
        nVis = Math.min(nVis, MONO_TEXT.length - 1 - k);
        lastKey = Math.max(lastKey, tl.del[k]);
      }
    }
    // ---- caret: solid while keys are pressed, a soft blink otherwise
    let ca = smoothstep(tl.caretIn, tl.caretIn + 0.2, s) * (1 - smoothstep(tl.caretOut[0], tl.caretOut[1], s));
    if (ca > 0) {
      const since = s - lastKey;
      if (since > 0.5) {
        const ph = (since - 0.5) % 1.0;
        ca *= ph < 0.5 ? 1 - smoothstep(0.38, 0.46, ph) : smoothstep(0.88, 0.96, ph);
      }
      if (ca > 0.001) {
        ctx.globalAlpha = ca * 0.92;
        ctx.fillRect(
          xh + nVis * L.adv + 0.04 * L.M,
          L.baseline - M.monoAsc * L.M - 0.06 * L.M,
          Math.max(1.5, 0.075 * L.M),
          (M.monoAsc + 0.3) * L.M,
        );
      }
    }
    // ---- the gold serif, letter by letter: a brief warm glow, then a faint residual halo
    ctx.font = L.serifFont;
    for (let li = 0; li < SERIF_TEXT.length; li++) {
      const cr = tl.crisp[li];
      if (!cr) continue;
      const gx = L.serifX + M.serifOff[li] * L.S;
      const gk = s - cr[0];
      const glow =
        gk > 0
          ? 0.85 * Math.min(1, gk / 0.3) * Math.exp(-Math.max(0, gk - 0.3) / 0.6) + 0.14 * smoothstep(0, 0.7, gk)
          : 0;
      const gw = this.glows[li];
      if (glow > 0.003 && gw) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, glow);
        ctx.drawImage(gw.cv, gx - gw.ox, L.baseline - gw.oy, gw.w, gw.h);
        ctx.globalCompositeOperation = 'source-over';
      }
      const a = easeInOutCubic((s - cr[0]) / (cr[1] - cr[0]));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = L.gold;
      ctx.fillText(SERIF_TEXT[li], gx, L.baseline);
    }
    ctx.globalAlpha = 1;
  }

  /** The limb: double outer ring, inner ring, ticks every 5° (longer every 30°), drawn clockwise. */
  private drawCircle(ctx: CanvasRenderingContext2D, s: number) {
    const tl = this.timeline;
    if (s < tl.circle0) return;
    const L = this.L!;
    const u = clamp01((s - tl.circle0) / tl.circleDur);
    const a0 = -Math.PI / 2;
    const a1 = a0 + TAU * easeInOutCubic(u);
    const r = L.r;
    const band = Math.max(9, Math.min(22, 0.065 * r));
    const hair = this.dpr >= 2 ? 0.7 : 1;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(201,162,91,0.9)';
    ctx.lineWidth = hair * 1.15;
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, r, a0, a1, false);
    ctx.stroke();
    const pOut = easeInOutCubic(u - 0.04);
    if (pOut > 0) {
      ctx.strokeStyle = 'rgba(201,162,91,0.45)';
      ctx.lineWidth = hair;
      ctx.beginPath();
      ctx.arc(L.cx, L.cy, r + 2.6, a0, a0 + TAU * pOut, false);
      ctx.stroke();
    }
    const pIn = easeInOutCubic((s - tl.circle0 - 0.12) / tl.circleDur);
    if (pIn > 0) {
      ctx.strokeStyle = 'rgba(201,162,91,0.5)';
      ctx.lineWidth = hair;
      ctx.beginPath();
      ctx.arc(L.cx, L.cy, r - band, a0, a0 + TAU * pIn, false);
      ctx.stroke();
    }
    // minor ticks in brass, majors in cream
    ctx.beginPath();
    let anyMajor = false;
    for (let k = 0; k < 72; k++) {
      if (k % 6 === 0) continue;
      const g = easeOutQuint((s - tl.tickPass[k] - 0.02) / 0.3);
      if (g <= 0) continue;
      const ang = a0 + (k * TAU) / 72;
      const len = band * 0.42 * g;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      ctx.moveTo(L.cx + cs * r, L.cy + sn * r);
      ctx.lineTo(L.cx + cs * (r - len), L.cy + sn * (r - len));
    }
    ctx.strokeStyle = 'rgba(201,162,91,0.75)';
    ctx.lineWidth = hair;
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 72; k += 6) {
      const g = easeOutQuint((s - tl.tickPass[k] - 0.02) / 0.3);
      if (g <= 0) continue;
      anyMajor = true;
      const ang = a0 + (k * TAU) / 72;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const rOut = r + 2.6;
      const rIn = rOut - (band + 2.6) * g;
      ctx.moveTo(L.cx + cs * rOut, L.cy + sn * rOut);
      ctx.lineTo(L.cx + cs * rIn, L.cy + sn * rIn);
    }
    if (anyMajor) {
      ctx.strokeStyle = 'rgba(239,230,210,0.85)';
      ctx.lineWidth = hair * 1.15;
      ctx.stroke();
    }
    // the burin's spark at the head
    const sparkA = Math.sin(Math.PI * clamp01(u * 1.02)) * (1 - smoothstep(0.92, 1, u));
    if (sparkA > 0.01 && this.spark) {
      const R = Math.max(7, 0.045 * r);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sparkA;
      ctx.drawImage(this.spark, L.cx + Math.cos(a1) * r - R, L.cy + Math.sin(a1) * r - R, R * 2, R * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
