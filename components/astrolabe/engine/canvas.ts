// Strumenti per incidere su canvas: un "bulino" che lavora in unità di piastra
// (y verso l'alto) e le converte in pixel.

export type Ctx2D = CanvasRenderingContext2D;

export function makeCanvas(w: number, h = w): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Un canvas che copre il quadrato [-half, half]² in unità di piastra. */
export class Burin {
  readonly ctx: Ctx2D;
  readonly size: number;
  readonly half: number;
  /** pixel per unità */
  readonly k: number;

  readonly cx: number;
  readonly cy: number;
  /** Metà dell'altezza coperta, in unità (uguale a half per un canvas quadrato). */
  readonly halfY: number;

  constructor(
    readonly canvas: HTMLCanvasElement,
    half: number,
    cx = 0,
    cy = 0,
  ) {
    this.ctx = canvas.getContext("2d", { willReadFrequently: false })!;
    this.size = canvas.width;
    this.half = half;
    this.cx = cx;
    this.cy = cy;
    this.k = canvas.width / (2 * half);
    this.halfY = canvas.height / (2 * this.k);
  }

  X = (x: number) => (x - this.cx + this.half) * this.k;
  Y = (y: number) => (this.cy + this.halfY - y) * this.k;
  /** Lunghezza in unità → pixel, mai sotto `min` pixel. */
  L = (u: number, min = 0) => Math.max(min, u * this.k);

  /** Imposta il tratto. w in unità (minimo 1 px). */
  stroke(color: string, w: number) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.L(w, 1);
  }

  circlePath(cx: number, cy: number, r: number) {
    this.ctx.moveTo(this.X(cx + r), this.Y(cy));
    this.ctx.arc(this.X(cx), this.Y(cy), Math.max(0, r * this.k), 0, Math.PI * 2);
  }

  circle(cx: number, cy: number, r: number) {
    this.ctx.beginPath();
    this.circlePath(cx, cy, r);
    this.ctx.stroke();
  }

  fillCircle(cx: number, cy: number, r: number) {
    this.ctx.beginPath();
    this.circlePath(cx, cy, r);
    this.ctx.fill();
  }

  /** Arco da a0 ad a1, angoli matematici (radianti, antiorari da +x) nel sistema con y in su. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number) {
    this.ctx.beginPath();
    // in canvas y è in giù: gli angoli si invertono
    this.ctx.arc(this.X(cx), this.Y(cy), Math.max(0, r * this.k), -a0, -a1, a1 > a0);
    this.ctx.stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(this.X(x1), this.Y(y1));
    this.ctx.lineTo(this.X(x2), this.Y(y2));
    this.ctx.stroke();
  }

  polyPath(pts: { x: number; y: number }[], close = false) {
    if (!pts.length) return;
    this.ctx.moveTo(this.X(pts[0].x), this.Y(pts[0].y));
    for (let i = 1; i < pts.length; i++) this.ctx.lineTo(this.X(pts[i].x), this.Y(pts[i].y));
    if (close) this.ctx.closePath();
  }

  poly(pts: { x: number; y: number }[], close = false) {
    this.ctx.beginPath();
    this.polyPath(pts, close);
    this.ctx.stroke();
  }

  fillPoly(pts: { x: number; y: number }[]) {
    this.ctx.beginPath();
    this.polyPath(pts, true);
    this.ctx.fill();
  }

  /** Testo centrato in (x, y), ruotato di `rot` radianti in senso orario. size in unità. */
  text(str: string, x: number, y: number, size: number, font: string, rot = 0, opts: { align?: CanvasTextAlign; style?: string; weight?: string } = {}) {
    const c = this.ctx;
    c.save();
    c.translate(this.X(x), this.Y(y));
    if (rot) c.rotate(rot);
    c.font = `${opts.style ?? ""} ${opts.weight ?? ""} ${Math.max(1, size * this.k).toFixed(2)}px ${font}`.trim();
    c.textAlign = opts.align ?? "center";
    c.textBaseline = "middle";
    c.fillText(str, 0, 0);
    c.restore();
  }

  /**
   * Testo lungo un cerchio, centrato all'angolo `at` (radianti, in senso orario dall'alto).
   * outward=true: si legge dal centro verso fuori (lettere con la base verso il centro).
   */
  arcText(str: string, cx: number, cy: number, r: number, at: number, size: number, font: string, opts: { style?: string; spacing?: number; flip?: boolean } = {}) {
    const c = this.ctx;
    c.save();
    c.font = `${opts.style ?? ""} ${Math.max(1, size * this.k).toFixed(2)}px ${font}`.trim();
    c.textAlign = "center";
    c.textBaseline = "middle";
    const spacing = (opts.spacing ?? 0) * this.k;
    const widths = [...str].map((ch) => c.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0) - spacing;
    const rp = r * this.k;
    const flip = !!opts.flip; // in basso le lettere si girano per restare dritte
    let a = at + (flip ? 1 : -1) * (total / 2 / rp);
    const chars = [...str];
    for (let i = 0; i < chars.length; i++) {
      const w = widths[i];
      const mid = a + (flip ? -1 : 1) * ((w - spacing) / 2 / rp);
      const px = this.X(cx) + Math.sin(mid) * rp;
      const py = this.Y(cy) - Math.cos(mid) * rp;
      c.save();
      c.translate(px, py);
      c.rotate(flip ? mid + Math.PI : mid);
      c.fillText(chars[i], 0, 0);
      c.restore();
      a += (flip ? -1 : 1) * (w / rp);
    }
    c.restore();
  }
}

// ---------- rumore e materia ----------

function hash(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

/** Rumore di valore a più ottave, in scala di grigi, periodico (si ripete senza giunte). */
export function noiseCanvas(size: number, seed = 1, octaves = 5, base = 4): HTMLCanvasElement {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const acc = new Float32Array(size * size);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const step = size / cells;
    for (let j = 0; j < size; j++) {
      const gy = j / step;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let i = 0; i < size; i++) {
        const gx = i / step;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % cells;
        const y1 = (y0 + 1) % cells;
        const v00 = hash(x0 % cells, y0 % cells, seed + o);
        const v10 = hash(x1, y0 % cells, seed + o);
        const v01 = hash(x0 % cells, y1, seed + o);
        const v11 = hash(x1, y1, seed + o);
        acc[j * size + i] += amp * ((v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy);
      }
    }
    norm += amp;
    amp *= 0.5;
  }
  for (let k = 0; k < acc.length; k++) {
    const v = Math.round((acc[k] / norm) * 255);
    img.data[k * 4] = v;
    img.data[k * 4 + 1] = v;
    img.data[k * 4 + 2] = v;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

let sharedNoise: HTMLCanvasElement | null = null;
export function getNoise(): HTMLCanvasElement {
  if (!sharedNoise) sharedNoise = noiseCanvas(256, 7, 5, 4);
  return sharedNoise;
}

export const BRASS = {
  base: "#cfa962",
  /** la piastra: più vecchia e più scura della rete */
  plate: "#b88f4f",
  /** la rete: lucidata dalle mani */
  rete: "#dcb96f",
  light: "#e6c983",
  dark: "#8a6630",
  /** colore delle linee incise (scure, riempite di patina) */
  engrave: "rgba(44, 28, 10, 0.92)",
  engraveSoft: "rgba(52, 34, 14, 0.62)",
  /** riflesso sottile sul bordo dell'incisione */
  lip: "rgba(255, 236, 190, 0.35)",
};

/** Riempie con l'ottone: tinta di base, patina a macchie, graffi sottili. */
export function fillBrass(b: Burin, opts: { seed?: number; patina?: number; scratches?: number; tint?: string } = {}) {
  const { ctx } = b;
  const size = b.canvas.width;
  const height = b.canvas.height;
  const seed = opts.seed ?? 1;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = opts.tint ?? BRASS.base;
  ctx.fillRect(0, 0, size, height);
  // patina a grandi macchie (moltiplica) e lucentezza (schiarisce)
  const n = getNoise();
  ctx.globalAlpha = 0.22 * (opts.patina ?? 1);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(n, 0, 0, size, height);
  ctx.globalAlpha = 0.12 * (opts.patina ?? 1);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(seed * 1.7);
  ctx.scale(2.2, 2.2);
  ctx.drawImage(n, -size / 2, -size / 2, size, size);
  ctx.restore();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.08;
  ctx.drawImage(n, 0, 0, size / 3, size / 3, 0, 0, size, height);
  // graffi sottili, come su un oggetto usato per secoli
  ctx.globalCompositeOperation = "source-over";
  const count = Math.round((opts.scratches ?? 1) * 220 * (size / 1024));
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * height;
    const a = rnd() * Math.PI;
    const l = (0.01 + rnd() * 0.05) * size;
    ctx.globalAlpha = 0.05 + rnd() * 0.08;
    ctx.strokeStyle = rnd() > 0.5 ? "#fff3cf" : "#5a3d17";
    ctx.lineWidth = Math.max(0.6, size / 2048);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Passa un tracciato come un'incisione: solco scuro e un filo di luce sul labbro. */
export function engravePath(b: Burin, draw: () => void, w: number, color = BRASS.engrave) {
  const c = b.ctx;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = color;
  c.lineWidth = b.L(w, 1);
  c.beginPath();
  draw();
  c.stroke();
  c.restore();
}
