// Dove cade il lembo dell'astrolabio sullo schermo, prima ancora che lo strumento sia pronto.
// È la stessa inquadratura del motore 3D (components/astrolabe/engine/engine.ts, applyCamera) e della
// versione 2D (AstrolabeFallback): l'intro incide il suo cerchio graduato proprio lì, così quando
// l'ottone compare il lembo è già al suo posto. Appena lo strumento è pronto, la sua misura vera
// (getLimbScreenCircle) prende il posto di questa stima.

import { BOUNDS, DIMS } from "@/components/astrolabe/engine/dims";

export interface Framing {
  top: number;
  bottom: number;
  side: number;
}

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

/** Il campo visivo verticale della camera (AstrolabeScene). */
const FOV_DEG = 30;
/** Il riquadro della versione 2D, in unità di piastra (AstrolabeFallback: VB e TOP). */
const VB_2D = 1.32;
const TOP_2D = 2.12;

/** Il lembo dello strumento 3D montato, in px CSS dal bordo del contenitore. */
export function predictLimb3d(w: number, h: number, f: Framing): Circle {
  const tanV = Math.tan((FOV_DEG * Math.PI) / 360);
  const availW = w * (1 - 2 * f.side);
  const availH = h * (1 - f.top - f.bottom);
  const boxW = BOUNDS.maxX - BOUNDS.minX + 0.12;
  const boxH = BOUNDS.maxY - BOUNDS.minY + 0.12;
  const distH = boxH / 2 / (tanV * (availH / h));
  const distW = boxW / 2 / (tanV * (w / h) * (availW / w));
  const dist = Math.max(distH, distW);
  const boxCy = (BOUNDS.maxY + BOUNDS.minY) / 2;
  const worldPerPx = (2 * dist * tanV) / h;
  const camY = boxCy - ((f.bottom - f.top) * h * worldPerPx) / 2;
  // il piano del lembo è parallelo allo schermo: il cerchio resta un cerchio
  const pxPerUnit = h / (2 * (dist - DIMS.limbTop) * tanV);
  return { cx: w / 2, cy: h / 2 + camY * pxPerUnit, r: DIMS.mater * pxPerUnit };
}

/** Il lembo della versione 2D (SVG con preserveAspectRatio "xMidYMid meet"). */
export function predictLimb2d(w: number, h: number, f: Framing): Circle {
  const left = f.side * w;
  const top = f.top * h;
  const boxW = w * (1 - 2 * f.side);
  const boxH = h * (1 - f.top - f.bottom);
  const vbW = 2 * VB_2D;
  const vbH = VB_2D + TOP_2D;
  const scale = Math.min(boxW / vbW, boxH / vbH);
  const offX = left + (boxW - vbW * scale) / 2;
  const offY = top + (boxH - vbH * scale) / 2;
  return { cx: offX + VB_2D * scale, cy: offY + TOP_2D * scale, r: DIMS.mater * scale };
}

/** Due cerchi praticamente uguali (meno di mezzo pixel): niente nuovo disegno dell'intro. */
export function sameCircle(a: Circle | null | undefined, b: Circle | null | undefined): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5 && Math.abs(a.r - b.r) < 0.5;
}
