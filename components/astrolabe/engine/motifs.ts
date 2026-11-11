// Motivi ornamentali delle città, incisi in fasce: il tatreez di Al-Quds, il Liberty di Torino,
// le onde del mare di Gaza, lo zellige di Fes, i tulipani di Iznik, il girih di Samarcanda,
// il seigaiha di Kyoto, le greche a gradini delle Ande, l'ulivo. Ogni motivo disegna una
// ripetizione in un riquadro locale (u lungo la fascia, v di traverso, in pixel).

import type { Ctx2D } from "./canvas";

export type MotifTile = (c: Ctx2D, w: number, h: number) => void;

const TATREEZ_STAR = [
  "...x...",
  ".x.x.x.",
  "..xxx..",
  "xxx.xxx",
  "..xxx..",
  ".x.x.x.",
  "...x...",
];

/** Punto croce: ogni "x" del disegno è una crocetta su una griglia quadrata. */
function crossStitch(c: Ctx2D, pattern: string[], x0: number, y0: number, cell: number) {
  c.beginPath();
  pattern.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== "x") return;
      const x = x0 + i * cell;
      const y = y0 + j * cell;
      const m = cell * 0.18;
      c.moveTo(x + m, y + m);
      c.lineTo(x + cell - m, y + cell - m);
      c.moveTo(x + cell - m, y + m);
      c.lineTo(x + m, y + cell - m);
    });
  });
  c.stroke();
}

const tatreez: MotifTile = (c, w, h) => {
  const cell = h / 9;
  crossStitch(c, TATREEZ_STAR, (w - 7 * cell) / 2, cell, cell);
  // chevron tra una stella e l'altra
  const pat = ["x...", ".x..", "..x.", ".x..", "x..."];
  crossStitch(c, pat, w - cell * 1.5, cell * 2, cell);
};

const liberty: MotifTile = (c, w, h) => {
  // colpo di frusta: una S lunga con un bocciolo di giglio
  c.beginPath();
  c.moveTo(0, h * 0.7);
  c.bezierCurveTo(w * 0.3, h * 0.05, w * 0.55, h * 1.0, w, h * 0.3);
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.42, h * 0.5);
  c.bezierCurveTo(w * 0.45, h * 0.2, w * 0.6, h * 0.12, w * 0.62, h * 0.32);
  c.bezierCurveTo(w * 0.56, h * 0.3, w * 0.5, h * 0.4, w * 0.42, h * 0.5);
  c.stroke();
  c.beginPath();
  c.arc(w * 0.18, h * 0.62, h * 0.07, 0, Math.PI * 2);
  c.stroke();
};

const waves: MotifTile = (c, w, h) => {
  // onda corrente (il "cane che corre"): un'onda che si arriccia
  c.beginPath();
  c.moveTo(0, h * 0.8);
  c.bezierCurveTo(w * 0.25, h * 0.8, w * 0.35, h * 0.15, w * 0.62, h * 0.2);
  c.bezierCurveTo(w * 0.85, h * 0.25, w * 0.8, h * 0.6, w * 0.62, h * 0.58);
  c.bezierCurveTo(w * 0.5, h * 0.56, w * 0.52, h * 0.4, w * 0.62, h * 0.42);
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.62, h * 0.2);
  c.bezierCurveTo(w * 0.9, h * 0.2, w * 0.95, h * 0.8, w, h * 0.8);
  c.stroke();
};

function star8(c: Ctx2D, cx: number, cy: number, r: number) {
  // due quadrati sovrapposti: la stella a otto punte (khatam)
  c.beginPath();
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * Math.PI * 2 + (k * Math.PI) / 4;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
  }
  c.stroke();
}

const zellige: MotifTile = (c, w, h) => {
  star8(c, w / 2, h / 2, h * 0.36);
  c.beginPath();
  c.arc(w / 2, h / 2, h * 0.12, 0, Math.PI * 2);
  c.stroke();
  // croce tra le stelle
  c.beginPath();
  c.moveTo(0, h * 0.5);
  c.lineTo(w * 0.08, h * 0.35);
  c.lineTo(w * 0.08, h * 0.65);
  c.closePath();
  c.stroke();
};

const tulip: MotifTile = (c, w, h) => {
  const x = w * 0.5;
  c.beginPath();
  c.moveTo(x, h * 0.92);
  c.bezierCurveTo(x - w * 0.05, h * 0.7, x + w * 0.04, h * 0.6, x, h * 0.48);
  c.stroke();
  // corolla a tre petali
  c.beginPath();
  c.moveTo(x, h * 0.48);
  c.bezierCurveTo(x - w * 0.22, h * 0.45, x - w * 0.2, h * 0.12, x - w * 0.08, h * 0.08);
  c.bezierCurveTo(x - w * 0.06, h * 0.22, x - w * 0.02, h * 0.3, x, h * 0.32);
  c.bezierCurveTo(x + w * 0.02, h * 0.3, x + w * 0.06, h * 0.22, x + w * 0.08, h * 0.08);
  c.bezierCurveTo(x + w * 0.2, h * 0.12, x + w * 0.22, h * 0.45, x, h * 0.48);
  c.stroke();
  // foglia saz
  c.beginPath();
  c.moveTo(w * 0.05, h * 0.85);
  c.bezierCurveTo(w * 0.15, h * 0.4, w * 0.3, h * 0.55, w * 0.38, h * 0.75);
  c.bezierCurveTo(w * 0.25, h * 0.7, w * 0.15, h * 0.75, w * 0.05, h * 0.85);
  c.stroke();
};

const girih: MotifTile = (c, w, h) => {
  // nastro intrecciato a zig-zag con stelline: la geometria timuride
  c.beginPath();
  c.moveTo(0, h * 0.15);
  c.lineTo(w * 0.5, h * 0.85);
  c.lineTo(w, h * 0.15);
  c.moveTo(0, h * 0.85);
  c.lineTo(w * 0.5, h * 0.15);
  c.lineTo(w, h * 0.85);
  c.stroke();
  star8(c, w * 0.5, h * 0.5, h * 0.16);
};

const seigaiha: MotifTile = (c, w, h) => {
  // onde del mare a semicerchi concentrici
  for (const [cx, cy] of [
    [w * 0.25, h],
    [w * 0.75, h],
    [w * 0.5, h * 0.55],
    [0, h * 0.55],
    [w, h * 0.55],
  ]) {
    for (let k = 1; k <= 3; k++) {
      c.beginPath();
      c.arc(cx, cy, (h * 0.42 * k) / 3, Math.PI, 0);
      c.stroke();
    }
  }
};

const tocapu: MotifTile = (c, w, h) => {
  // greca a gradini (escalonada) e un quadratino tocapu
  const s = h / 6;
  c.beginPath();
  c.moveTo(0, h - s);
  for (let i = 0; i < 3; i++) {
    c.lineTo(i * s * 1.2 + s * 1.2, h - s - i * s);
    c.lineTo(i * s * 1.2 + s * 1.2, h - 2 * s - i * s);
  }
  c.lineTo(w * 0.5, s);
  for (let i = 2; i >= 0; i--) {
    c.lineTo(w - (i * s * 1.2 + s * 1.2), h - 2 * s - i * s);
    c.lineTo(w - (i * s * 1.2 + s * 1.2), h - s - i * s);
  }
  c.lineTo(w, h - s);
  c.stroke();
  c.strokeRect(w * 0.5 - s * 0.7, h * 0.55 - s * 0.7, s * 1.4, s * 1.4);
};

const oliva: MotifTile = (c, w, h) => {
  // ramo d'ulivo: stelo ondulato, foglie lanceolate a coppie, olive
  c.beginPath();
  c.moveTo(0, h * 0.55);
  c.bezierCurveTo(w * 0.3, h * 0.35, w * 0.7, h * 0.75, w, h * 0.55);
  c.stroke();
  const leaf = (x: number, y: number, a: number, l: number) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(l * 0.5, -l * 0.22, l, 0);
    c.quadraticCurveTo(l * 0.5, l * 0.22, 0, 0);
    c.stroke();
    c.restore();
  };
  leaf(w * 0.2, h * 0.47, -0.9, h * 0.42);
  leaf(w * 0.32, h * 0.47, 0.8, h * 0.4);
  leaf(w * 0.62, h * 0.6, -1.0, h * 0.4);
  leaf(w * 0.74, h * 0.6, 0.9, h * 0.42);
  c.beginPath();
  c.ellipse(w * 0.47, h * 0.3, h * 0.07, h * 0.09, 0.3, 0, Math.PI * 2);
  c.stroke();
};

const guilloche: MotifTile = (c, w, h) => {
  for (const ph of [0, Math.PI]) {
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) * w;
      const v = h / 2 + Math.sin((i / 24) * Math.PI * 2 + ph) * h * 0.32;
      if (i === 0) c.moveTo(u, v);
      else c.lineTo(u, v);
    }
    c.stroke();
  }
};

export const MOTIFS: Record<string, { tile: MotifTile; aspect: number }> = {
  tatreez: { tile: tatreez, aspect: 1.25 },
  liberty: { tile: liberty, aspect: 2.2 },
  waves: { tile: waves, aspect: 1.5 },
  zellige: { tile: zellige, aspect: 1.15 },
  tulip: { tile: tulip, aspect: 1.1 },
  girih: { tile: girih, aspect: 1.4 },
  seigaiha: { tile: seigaiha, aspect: 1.0 },
  tocapu: { tile: tocapu, aspect: 1.6 },
  oliva: { tile: oliva, aspect: 1.8 },
  guilloche: { tile: guilloche, aspect: 1.6 },
};

const SYNONYMS: Record<string, string> = {
  "art nouveau": "liberty",
  floreale: "liberty",
  mare: "waves",
  sea: "waves",
  onde: "waves",
  wave: "waves",
  zellij: "zellige",
  iznik: "tulip",
  tulipani: "tulip",
  tulipano: "tulip",
  timuride: "girih",
  "seigaiha-ume": "seigaiha",
  ume: "seigaiha",
  andino: "tocapu",
  andean: "tocapu",
  greca: "tocapu",
  chakana: "tocapu",
  inca: "tocapu",
  inka: "tocapu",
  olive: "oliva",
  ulivo: "oliva",
  olivo: "oliva",
};

const BY_CITY: Record<string, string> = {
  torino: "liberty",
  "al-quds": "tatreez",
  gaza: "waves",
  fes: "zellige",
  istanbul: "tulip",
  samarcanda: "girih",
  kyoto: "seigaiha",
  cusco: "tocapu",
};

/** Il motivo di una città: dal campo `motif` del JSON, o dalla città, o una guilloche. */
export function motifFor(motif: string | undefined, cityId: string | undefined): string {
  const m = (motif ?? "").toLowerCase().trim();
  if (MOTIFS[m]) return m;
  for (const key of Object.keys(SYNONYMS)) if (m.includes(key)) return SYNONYMS[key];
  for (const key of Object.keys(MOTIFS)) if (m.includes(key)) return key;
  return BY_CITY[cityId ?? ""] ?? "guilloche";
}

/** Una fascia circolare del motivo, tra r0 e r1 (pixel), attorno a (cx, cy) in pixel. */
export function ringBand(c: Ctx2D, motif: string, cx: number, cy: number, r0: number, r1: number, lineW: number) {
  const m = MOTIFS[motif] ?? MOTIFS.guilloche;
  const h = r1 - r0;
  const rm = (r0 + r1) / 2;
  const n = Math.max(8, Math.round((2 * Math.PI * rm) / (h * m.aspect)));
  const w = (2 * Math.PI * rm) / n;
  c.save();
  c.lineWidth = lineW;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    c.save();
    c.translate(cx + Math.sin(a) * rm, cy - Math.cos(a) * rm);
    c.rotate(a);
    c.translate(-w / 2, -h / 2);
    m.tile(c, w, h);
    c.restore();
  }
  c.restore();
}

/** Una fascia diritta del motivo in un rettangolo (pixel). */
export function straightBand(c: Ctx2D, motif: string, x: number, y: number, width: number, h: number, lineW: number) {
  const m = MOTIFS[motif] ?? MOTIFS.guilloche;
  const n = Math.max(1, Math.round(width / (h * m.aspect)));
  const w = width / n;
  c.save();
  c.lineWidth = lineW;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    c.save();
    c.translate(x + i * w, y);
    m.tile(c, w, h);
    c.restore();
  }
  c.restore();
}

/** Una fascia circolare da un'immagine 8:1 nero su bianco (band/<città>.png): moltiplicata sull'ottone. */
export function ringBandImage(c: Ctx2D, img: HTMLImageElement, cx: number, cy: number, r0: number, r1: number) {
  const h = r1 - r0;
  const rm = (r0 + r1) / 2;
  const tileW = h * (img.width / img.height);
  const n = Math.max(6, Math.round((2 * Math.PI * rm) / tileW));
  const slices = n * 24;
  c.save();
  c.globalCompositeOperation = "multiply";
  for (let i = 0; i < slices; i++) {
    const a = (i / slices) * Math.PI * 2;
    const da = (Math.PI * 2) / slices;
    const sx = ((i % 24) / 24) * img.width;
    const sw = img.width / 24;
    c.save();
    c.translate(cx + Math.sin(a + da / 2) * rm, cy - Math.cos(a + da / 2) * rm);
    c.rotate(a + da / 2);
    const segW = rm * da * 1.04;
    c.drawImage(img, sx, 0, sw, img.height, -segW / 2, -h / 2, segW, h);
    c.restore();
  }
  c.restore();
}
