// La rete: la mappa delle stelle traforata nell'ottone. Anello del Capricorno, anello eccentrico
// dell'eclittica, arco dell'equatore, barre, mozzo, volute ornamentali e puntatori a fiamma
// la cui punta cade esattamente sulla stella. Tutto in coordinate della rete ferma
// (tempo siderale zero), con il tropico del Capricorno di raggio 1: il 3D e il 2D disegnano
// la stessa rete partendo da qui.

import type { Pt } from "./types";
import {
  eclipticCircle,
  eclipticPoint,
  projectOnRete,
  R_CANCER,
  R_EQ,
  type Circle,
} from "./projection";

export interface ReteStarInput {
  id: string;
  /** Ascensione retta della data, in ore. */
  ra: number;
  /** Declinazione della data, in gradi. */
  dec: number;
  mag: number;
  /** Stella con un riferimento coranico: il suo puntatore ha una rosetta alla base. */
  special?: boolean;
}

export interface RetePointer {
  id: string;
  /** La punta: esattamente la posizione della stella. */
  tip: Pt;
  /** "flame": puntatore a fiamma; "hole": la stella cade sull'ottone ed è segnata da un foro. */
  kind: "flame" | "hole";
  /** Contorno chiuso della fiamma (vuoto per "hole"). */
  outline: Pt[];
  /** Contorno chiuso del gambo che la collega alla struttura, se serve. */
  stem: Pt[] | null;
  /** Dove la fiamma si attacca. */
  base: Pt;
  /** Direzione base→punta, in radianti (convenzione matematica). */
  axis: number;
  special: boolean;
  /** Per le stelle con un riferimento coranico: una piccola rosetta traforata alla base. */
  rosette: (Circle & { hole: number }) | null;
}

export interface ReteDesign {
  /** Anello del Capricorno. */
  ring: { inner: number; outer: number };
  /** Anello dell'eclittica: il cerchio è l'eclittica, la fascia sta all'interno, larga `width`. */
  ecliptic: Circle & { width: number };
  /** Arco dell'equatore, dove esce dall'eclittica (lato del solstizio d'estate). */
  equator: { r: number; width: number; from: number; to: number };
  bars: { a: Pt; b: Pt; width: number }[];
  hub: { r: number; hole: number };
  /** Volute ornamentali, come contorni chiusi già pieni. */
  ornaments: Pt[][];
  /** Piccoli fori decorativi (cerchi) dentro le volute. */
  piercings: Circle[];
  pointers: RetePointer[];
}

const RING_W = 0.058;
const ECL_W = 0.046;
const EQ_W = 0.024;
const BAR_W = 0.03;
const HUB_R = 0.1;
const HOLE_R = 0.028;

// ---------- piccola geometria ----------

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt): number => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x });

function closestOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
  return add(a, mul(ab, t));
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Un nastro che si assottiglia lungo una curva: contorno chiuso. */
export function taperedStroke(path: Pt[], w0: number, w1: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(n - 1, i + 1)];
    const t = n > 1 ? i / (n - 1) : 0;
    const w = (w0 + (w1 - w0) * t) / 2;
    const nrm = perp(norm(sub(next, prev)));
    left.push(add(path[i], mul(nrm, w)));
    right.push(sub(path[i], mul(nrm, w)));
  }
  // punta arrotondata alla fine
  const end = path[n - 1];
  const dir = norm(sub(end, path[Math.max(0, n - 2)]));
  const cap: Pt[] = [];
  const r = w1 / 2;
  for (let k = 1; k < 6; k++) {
    const a = -Math.PI / 2 + (k / 6) * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // ruota da -90° a +90° attorno alla direzione di marcia
    cap.push(add(end, add(mul(dir, c * r), mul(perp(dir), -s * r))));
  }
  return [...left, ...cap, ...right.reverse()];
}

/** Una voluta: una curva la cui curvatura cresce verso la fine, come un ricciolo. */
function scrollPath(start: Pt, heading: number, length: number, k0: number, k1: number, steps = 48): Pt[] {
  const pts: Pt[] = [start];
  let th = heading;
  let p = start;
  const ds = length / steps;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const k = k0 + (k1 - k0) * t * t;
    th += k * ds;
    p = { x: p.x + Math.cos(th) * ds, y: p.y + Math.sin(th) * ds };
    pts.push(p);
  }
  return pts;
}

// ---------- la struttura ----------

interface Attach {
  /** Distanza dalla superficie dell'elemento (negativa se dentro l'ottone). */
  dist: number;
  /** Punto del bordo più vicino. */
  edge: Pt;
}

type Element = (p: Pt) => Attach;

function ringElement(cx: number, cy: number, inner: number, outer: number, arc?: [number, number]): Element {
  return (p: Pt) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (arc) {
      const a = Math.atan2(p.y - cy, p.x - cx);
      const [from, to] = arc;
      const inArc = from <= to ? a >= from && a <= to : a >= from || a <= to;
      if (!inArc) return { dist: Infinity, edge: p };
    }
    const dir = norm({ x: p.x - cx, y: p.y - cy });
    if (d > outer) return { dist: d - outer, edge: { x: cx + dir.x * outer, y: cy + dir.y * outer } };
    if (d < inner) return { dist: inner - d, edge: { x: cx + dir.x * inner, y: cy + dir.y * inner } };
    return { dist: -Math.min(d - inner, outer - d), edge: p };
  };
}

function segmentElement(a: Pt, b: Pt, width: number): Element {
  return (p: Pt) => {
    const c = closestOnSegment(p, a, b);
    const d = len(sub(p, c));
    const dir = norm(sub(p, c));
    return { dist: d - width / 2, edge: add(c, mul(dir, width / 2)) };
  };
}

function polylineElement(path: Pt[], width: number): Element {
  return (p: Pt) => {
    let best: Attach = { dist: Infinity, edge: p };
    for (let i = 0; i < path.length - 1; i++) {
      const r = segmentElement(path[i], path[i + 1], width)(p);
      if (r.dist < best.dist) best = r;
    }
    return best;
  };
}

/** Il contorno di un puntatore a fiamma da `base` a `tip`. */
function flameOutline(base: Pt, tip: Pt, variant: number, special: boolean): Pt[] {
  const axis = sub(tip, base);
  const L = len(axis);
  const d = norm(axis);
  const n = perp(d);
  const w = Math.max(0.03, Math.min(0.066, 0.4 * L)) * (special ? 1.12 : 1);
  const side = variant % 2 === 0 ? 1 : -1;
  const bend = side * 0.1 * L;
  const back = 0.03; // la base affonda nella struttura
  const local = (u: number, v: number): Pt => {
    const b = bend * Math.sin(Math.PI * Math.max(0, Math.min(1, u / L)));
    return add(base, add(mul(d, u), mul(n, side * v + b)));
  };
  const pts: Pt[] = [];
  // lato convesso, dalla base alla punta
  const e1 = cubic({ x: -back, y: w / 2 }, { x: 0.3 * L, y: w * 0.78 }, { x: 0.72 * L, y: w * 0.3 }, { x: L, y: 0 }, 18);
  // lato con l'uncino, dalla punta alla base
  const e2 = cubic({ x: L, y: 0 }, { x: 0.7 * L, y: -w * 0.06 }, { x: 0.42 * L, y: -w * 0.5 }, { x: 0.2 * L, y: -w * 0.56 }, 14);
  for (const p of e1) pts.push(local(p.x, p.y));
  for (const p of e2.slice(1)) pts.push(local(p.x, p.y));
  if (variant % 3 !== 2) {
    // l'uncino: una piccola voluta che si stacca e rientra, come nelle reti islamiche
    const hook = cubic(
      { x: 0.2 * L, y: -w * 0.56 },
      { x: 0.1 * L, y: -w * 0.62 },
      { x: 0.02 * L, y: -w * 1.25 },
      { x: 0.13 * L, y: -w * 1.12 },
      8,
    );
    for (const p of hook.slice(1)) pts.push(local(p.x, p.y));
    const ret = cubic(
      { x: 0.13 * L, y: -w * 1.12 },
      { x: 0.04 * L, y: -w * 0.9 },
      { x: 0.0, y: -w * 0.62 },
      { x: -back, y: -w / 2 },
      8,
    );
    for (const p of ret.slice(1)) pts.push(local(p.x, p.y));
  } else {
    const ret = cubic({ x: 0.2 * L, y: -w * 0.56 }, { x: 0.08 * L, y: -w * 0.56 }, { x: 0, y: -w * 0.5 }, { x: -back, y: -w / 2 }, 6);
    for (const p of ret.slice(1)) pts.push(local(p.x, p.y));
  }
  return pts;
}

/** Un gambo leggermente ondulato dalla struttura verso la stella. */
function stemOutline(from: Pt, to: Pt, variant: number): Pt[] {
  const d = sub(to, from);
  const L = len(d);
  const n = perp(norm(d));
  const s = variant % 2 === 0 ? 1 : -1;
  const path = cubic(from, add(add(from, mul(d, 0.33)), mul(n, s * 0.12 * L)), add(add(from, mul(d, 0.66)), mul(n, -s * 0.1 * L)), to, 20);
  return taperedStroke(path, 0.032, 0.022);
}

export interface ReteOptions {
  /** Oltre questo raggio una stella non entra nella rete (il lembo la coprirebbe). */
  maxRadius?: number;
}

/** Disegna la rete per un elenco di stelle (coordinate della data). */
export function reteDesign(stars: readonly ReteStarInput[], opts: ReteOptions = {}): ReteDesign {
  const maxRadius = opts.maxRadius ?? 1.06;
  const ecl = eclipticCircle();
  const ring = { inner: 1 - RING_W, outer: 1 };
  const equator = { r: R_EQ, width: EQ_W, from: Math.PI / 2, to: -Math.PI / 2 };

  const bars: ReteDesign["bars"] = [
    // il coluro solstiziale (orizzontale) e quello equinoziale (verticale)
    { a: { x: -ring.inner - 0.01, y: 0 }, b: { x: -HUB_R + 0.01, y: 0 }, width: BAR_W },
    { a: { x: HUB_R - 0.01, y: 0 }, b: { x: ecl.cx + ecl.r - ECL_W + 0.01, y: 0 }, width: BAR_W * 0.9 },
    { a: { x: 0, y: HUB_R - 0.01 }, b: { x: 0, y: ring.inner + 0.01 }, width: BAR_W },
    { a: { x: 0, y: -HUB_R + 0.01 }, b: { x: 0, y: -ring.inner - 0.01 }, width: BAR_W },
  ];

  // volute: riempiono i vuoti grandi dentro l'eclittica e la mezzaluna a sinistra
  const starPts = stars.map((s) => projectOnRete(s.ra, s.dec));
  const ornamentPaths: { path: Pt[]; w0: number; w1: number }[] = [];
  const addScroll = (start: Pt, heading: number, length: number, k0: number, k1: number, w0 = 0.026, w1 = 0.012) => {
    const path = scrollPath(start, heading, length, k0, k1);
    // una voluta non deve coprire una stella: si ferma prima
    let cut = path.length;
    for (let i = 0; i < path.length && cut === path.length; i++) {
      for (const sp of starPts) {
        if (Math.hypot(path[i].x - sp.x, path[i].y - sp.y) < 0.06) {
          cut = Math.max(0, i - 3);
          break;
        }
      }
    }
    if (cut >= 14) ornamentPaths.push({ path: path.slice(0, cut), w0, w1: cut === path.length ? w1 : (w0 + w1) / 2 });
  };
  const ornaments = ornamentPaths.map((o) => taperedStroke(o.path, o.w0, o.w1));
  const piercings: Circle[] = [];

  const elements: Element[] = [
    ringElement(0, 0, ring.inner, ring.outer),
    ringElement(ecl.cx, ecl.cy, ecl.r - ECL_W, ecl.r),
    ringElement(0, 0, equator.r - EQ_W / 2, equator.r + EQ_W / 2, [Math.PI / 2, -Math.PI / 2]),
    ringElement(0, 0, HOLE_R, HUB_R),
    ...bars.map((b) => segmentElement(b.a, b.b, b.width)),
    ...ornamentPaths.map((o) => polylineElement(o.path, (o.w0 + o.w1) / 2)),
  ];

  const pointers: RetePointer[] = [];
  let variant = 0;
  for (const s of stars) {
    const tip = projectOnRete(s.ra, s.dec);
    const r = len(tip);
    if (r > maxRadius || r < HUB_R + 0.02) continue;
    let best: Attach = { dist: Infinity, edge: tip };
    for (const el of elements) {
      const a = el(tip);
      if (a.dist < best.dist) best = a;
    }
    const special = !!s.special;
    if (best.dist < 0.006) {
      // la stella cade sull'ottone: un foro la segna
      pointers.push({ id: s.id, tip, kind: "hole", outline: [], stem: null, base: tip, axis: 0, special, rosette: null });
      continue;
    }
    const v = variant++;
    let base = best.edge;
    let stem: Pt[] | null = null;
    const toTip = sub(tip, base);
    if (len(toTip) > 0.2) {
      // troppo lontana: un gambo ondulato porta la fiamma vicino alla stella
      const flameLen = 0.12;
      const mid = sub(tip, mul(norm(toTip), flameLen));
      stem = stemOutline(sub(base, mul(norm(toTip), 0.015)), mid, v);
      base = mid;
    } else if (len(toTip) < 0.07) {
      // troppo vicina: la fiamma parte da dentro l'ottone, così resta visibile
      base = sub(tip, mul(norm(toTip), 0.07));
    }
    const outline = flameOutline(base, tip, v, special);
    const axis = Math.atan2(tip.y - base.y, tip.x - base.x);
    const rosette = special ? { cx: base.x, cy: base.y, r: 0.026, hole: 0.0105 } : null;
    pointers.push({ id: s.id, tip, kind: "flame", outline, stem, base, axis, special, rosette });
  }

  return {
    ring,
    ecliptic: { ...ecl, width: ECL_W },
    equator,
    bars,
    hub: { r: HUB_R, hole: HOLE_R },
    ornaments,
    piercings,
    pointers,
  };
}

/** Punto dell'anello dell'eclittica per una longitudine eclittica (gradi), sulla rete ferma. */
export function zodiacPoint(lonDeg: number): Pt {
  return eclipticPoint(lonDeg);
}

/** I dodici segni, dall'Ariete: nomi italiani incisi sull'anello dell'eclittica. */
export const ZODIAC_IT = [
  "Ariete",
  "Toro",
  "Gemelli",
  "Cancro",
  "Leone",
  "Vergine",
  "Bilancia",
  "Scorpione",
  "Sagittario",
  "Capricorno",
  "Acquario",
  "Pesci",
] as const;

/** Raggio del tropico del Cancro, per comodità di chi disegna. */
export const RETE_R_CANCER = R_CANCER;
