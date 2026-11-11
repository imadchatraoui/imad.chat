// La piastra (timpano) di una città: le linee incise per la sua latitudine, calcolate numericamente.
// Cerchi d'altezza (almucantarat), linee d'azimut, orizzonte, tropici, equatore, linea del crepuscolo
// e linee delle ore ineguali sotto l'orizzonte. La proiezione stereografica manda cerchi in cerchi,
// quindi quasi tutto si descrive con cerchi esatti; le ore ineguali sono polilinee.

import type { Pt } from "./types";
import {
  circleThrough,
  DEG,
  horizontalToEquatorial,
  OBLIQUITY,
  projectHorizontal,
  projectHourAngle,
  R_CANCER,
  R_CAPRICORN,
  R_EQ,
  type Circle,
} from "./projection";

export type PlateCurve =
  | ({ kind: "circle" } & Circle)
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number };

export interface PlateGeometry {
  lat: number;
  rEquator: number;
  rCancer: number;
  rCapricorn: number;
  /** Il cerchio dell'orizzonte (altezza 0). */
  horizon: PlateCurve;
  /** true se il cielo visibile sta dentro il cerchio dell'orizzonte (latitudini nord); false a sud. */
  skyInside: boolean;
  zenith: Pt;
  /** Cerchi d'altezza sopra l'orizzonte, ogni `altStep` gradi. */
  almucantars: { alt: number; curve: PlateCurve }[];
  /** La linea del crepuscolo astronomico, altezza -18°. */
  twilight: PlateCurve | null;
  /** Linee d'azimut (cerchi per lo zenit); ognuna porta l'azimut az e az+180. */
  azimuths: { az: number; curve: PlateCurve }[];
  /** Linee delle ore ineguali della notte, 1..11, tra i due tropici sotto l'orizzonte. */
  hours: { n: number; points: Pt[] }[];
  /** Punti cardinali sull'orizzonte. */
  east: Pt;
  west: Pt;
  north: Pt;
  south: Pt;
}

export interface PlateOptions {
  /** Passo dei cerchi d'altezza, in gradi (6 o 10 di solito). */
  altStep?: number;
  /** Passo delle linee d'azimut, in gradi. */
  azStep?: number;
}

const FAR = 1e5;

function finite(p: Pt): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Math.hypot(p.x, p.y) < FAR;
}

/** La curva per alcuni punti di un cerchio della sfera: un cerchio, o una retta se passa per il polo sud. */
function curveFrom(points: Pt[]): PlateCurve | null {
  const good = points.filter(finite).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  if (good.length < 2) return null;
  if (good.length >= 3) {
    const c = circleThrough(good[0], good[1], good[2]);
    if (c && c.r < FAR / 10) return { kind: "circle", ...c };
  }
  return { kind: "line", x1: good[0].x, y1: good[0].y, x2: good[1].x, y2: good[1].y };
}

/** Il cerchio d'altezza `alt` (gradi) per la latitudine lat. */
export function almucantar(alt: number, lat: number): PlateCurve | null {
  return curveFrom([0, 90, 180, 270].map((az) => projectHorizontal(alt, az, lat)));
}

/** Il punto dell'orizzonte (o di un'altra altezza) a un certo azimut, sulla piastra. */
export function horizonPoint(az: number, lat: number, alt = 0): Pt {
  return projectHorizontal(alt, az, lat);
}

/** La linea d'azimut az (e az+180): il cerchio per zenit, nadir e il punto dell'orizzonte. */
export function azimuthCurve(az: number, lat: number): PlateCurve | null {
  const z = projectHorizontal(90, 0, lat);
  const n = projectHorizontal(-90, 0, lat);
  const h1 = projectHorizontal(0, az, lat);
  const h2 = projectHorizontal(0, az + 180, lat);
  const c = circleThrough(z, h1, n) ?? circleThrough(z, h2, n);
  if (c && c.r < FAR / 10) return { kind: "circle", ...c };
  // il meridiano: una retta per lo zenit e il centro
  return { kind: "line", x1: 0, y1: -2, x2: 0, y2: 2 };
}

/** Linee delle ore ineguali della notte, dalla fine della prima alla fine dell'undicesima. */
function unequalHours(lat: number): { n: number; points: Pt[] }[] {
  const f = lat * DEG;
  const out: { n: number; points: Pt[] }[] = [];
  const steps = 32;
  for (let n = 1; n <= 11; n++) {
    const points: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const dec = -OBLIQUITY + (2 * OBLIQUITY * i) / steps;
      const c = -Math.tan(f) * Math.tan(dec * DEG);
      if (c <= -1 || c >= 1) continue; // il Sole non tramonta o non sorge: niente ore ineguali
      const h0 = Math.acos(c); // angolo orario del tramonto
      const h = h0 + (n * (2 * Math.PI - 2 * h0)) / 12;
      points.push(projectHourAngle(h, dec));
    }
    if (points.length > 1) out.push({ n, points });
  }
  return out;
}

/** Tutte le linee della piastra per una latitudine (gradi; negativa a sud). */
export function plateGeometry(lat: number, opts: PlateOptions = {}): PlateGeometry {
  const altStep = opts.altStep ?? 6;
  const azStep = opts.azStep ?? 15;
  const horizon = almucantar(0, lat) ?? { kind: "line", x1: -1, y1: 0, x2: 1, y2: 0 };
  const zenith = projectHorizontal(90, 0, lat);
  const skyInside =
    horizon.kind === "circle" ? Math.hypot(zenith.x - horizon.cx, zenith.y - horizon.cy) < horizon.r : zenith.y > 0;

  const almucantars: { alt: number; curve: PlateCurve }[] = [];
  for (let alt = altStep; alt < 90 - 1e-9; alt += altStep) {
    const curve = almucantar(alt, lat);
    if (curve) almucantars.push({ alt, curve });
  }

  const azimuths: { az: number; curve: PlateCurve }[] = [];
  for (let az = 0; az < 180 - 1e-9; az += azStep) {
    const curve = azimuthCurve(az, lat);
    if (curve) azimuths.push({ az, curve });
  }

  // i punti est e ovest stanno sull'equatore, ad angolo orario ∓6 ore
  const { hourAngle: hE, dec: dE } = horizontalToEquatorial(0, 90, lat);
  const { hourAngle: hW, dec: dW } = horizontalToEquatorial(0, 270, lat);

  return {
    lat,
    rEquator: R_EQ,
    rCancer: R_CANCER,
    rCapricorn: R_CAPRICORN,
    horizon,
    skyInside,
    zenith,
    almucantars,
    twilight: almucantar(-18, lat),
    azimuths,
    hours: unequalHours(lat),
    east: projectHourAngle(hE, dE),
    west: projectHourAngle(hW, dW),
    north: projectHorizontal(0, 0, lat),
    south: projectHorizontal(0, 180, lat),
  };
}

/** Se un punto della piastra sta nel cielo visibile (sopra l'orizzonte). */
export function isAboveHorizon(p: Pt, plate: PlateGeometry): boolean {
  const h = plate.horizon;
  if (h.kind === "line") return p.y > h.y1;
  const inside = Math.hypot(p.x - h.cx, p.y - h.cy) < h.r;
  return plate.skyInside ? inside : !inside;
}

/** Punti di una curva della piastra campionata, utile per disegnare archi o tagliarli. */
export function sampleCurve(curve: PlateCurve, n = 256): Pt[] {
  if (curve.kind === "line") {
    return [
      { x: curve.x1, y: curve.y1 },
      { x: curve.x2, y: curve.y2 },
    ];
  }
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ x: curve.cx + curve.r * Math.cos(t), y: curve.cy + curve.r * Math.sin(t) });
  }
  return pts;
}

/** Il punto dove il cerchio d'altezza alt incontra il meridiano sud (per le etichette). */
export function meridianLabelPoint(alt: number, lat: number): Pt {
  return projectHorizontal(alt, 180, lat);
}
