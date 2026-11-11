// Le incisioni: ogni faccia dello strumento è un canvas dipinto come ottone inciso
// (linee scure nei solchi, patina, graffi) e usato come colore e come rilievo.
// Le sagome traforate (rete, trono, cavallo) sono dipinte in bianco su trasparente
// e poi tracciate in contorni da contours.ts.

import {
  clockAngle,
  DEG,
  eclipticCircle,
  eclipticPoint,
  OBLIQUITY,
  R_CANCER,
  R_EQ,
  radiusOfDec,
  type PlateCurve,
  type PlateGeometry,
  type ReteDesign,
  type AstroSection,
  type CityItem,
  ZODIAC_IT,
  plateGeometry,
  meridianLabelPoint,
  horizonPoint,
} from "@/lib/astro";
import { Burin, BRASS, engravePath, fillBrass, type Ctx2D } from "./canvas";
import type { EngraveFonts } from "./fonts";
import { motifFor, ringBand, ringBandImage, straightBand } from "./motifs";
import { DIMS } from "./dims";

// ---------- curve della piastra ----------

function curvePath(b: Burin, c: PlateCurve) {
  if (c.kind === "circle") b.circlePath(c.cx, c.cy, c.r);
  else {
    // una retta: la prolunghiamo ben oltre la piastra
    const dx = c.x2 - c.x1;
    const dy = c.y2 - c.y1;
    const l = Math.hypot(dx, dy) || 1;
    b.ctx.moveTo(b.X(c.x1 - (dx / l) * 4), b.Y(c.y1 - (dy / l) * 4));
    b.ctx.lineTo(b.X(c.x1 + (dx / l) * 4), b.Y(c.y1 + (dy / l) * 4));
  }
}

function clipCircle(b: Burin, r: number, cx = 0, cy = 0) {
  b.ctx.beginPath();
  b.circlePath(cx, cy, r);
  b.ctx.clip();
}

/** Ritaglia sul cielo visibile (sopra l'orizzonte) della piastra. */
function clipSky(b: Burin, plate: PlateGeometry) {
  const h = plate.horizon;
  const c = b.ctx;
  c.beginPath();
  if (h.kind === "circle") {
    if (plate.skyInside) b.circlePath(h.cx, h.cy, h.r);
    else {
      c.rect(0, 0, b.size, b.size);
      b.circlePath(h.cx, h.cy, h.r);
    }
  } else {
    c.rect(0, 0, b.size, b.Y(h.y1));
  }
  c.clip("evenodd");
}

export interface PlatePaintOptions {
  fonts: EngraveFonts;
  city?: CityItem | null;
  /** Fascia del bordo da immagine (band/<città>.png), se c'è. */
  bandImage?: HTMLImageElement | null;
  /** La piastra segreta: tutti gli orizzonti delle città. */
  horizonsOf?: CityItem[];
  seed?: number;
}

function formatLat(lat: number): string {
  const a = Math.abs(lat);
  const d = Math.floor(a);
  const m = Math.round((a - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′ ${lat >= 0 ? "N" : "S"}`;
}

function formatLon(lon: number): string {
  const a = Math.abs(lon);
  const d = Math.floor(a);
  const m = Math.round((a - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′ ${lon >= 0 ? "E" : "O"}`;
}

export { formatLat, formatLon };

/** La piastra di una città (o la piastra segreta degli orizzonti). Il canvas copre [-plate, plate]². */
export function paintPlate(b: Burin, opts: PlatePaintOptions) {
  const { fonts, city } = opts;
  const c = b.ctx;
  const S = b.size / 2048; // scala dei tratti rispetto alla risoluzione piena
  fillBrass(b, { seed: opts.seed ?? 3, patina: 0.9 });
  const thin = 0.0016;
  const mid = 0.0024;
  const bold = 0.0036;

  // fascia ornata fuori dal Capricorno
  c.save();
  clipCircle(b, DIMS.plate);
  c.strokeStyle = BRASS.engraveSoft;
  if (opts.bandImage) {
    ringBandImage(c, opts.bandImage, b.X(0), b.Y(0), b.L(1.004), b.L(DIMS.plate - 0.004));
  } else {
    const motif = opts.horizonsOf ? "oliva" : motifFor(city?.motif, city?.id);
    ringBand(c, motif, b.X(0), b.Y(0), b.L(1.006), b.L(DIMS.plate - 0.006), Math.max(1, 1.5 * S));
  }
  c.restore();
  b.stroke(BRASS.engrave, mid);
  b.circle(0, 0, DIMS.plate - 0.003);

  c.save();
  clipCircle(b, 1);
  c.lineCap = "round";

  if (opts.horizonsOf) {
    paintHorizonsPlate(b, opts.horizonsOf, fonts);
  } else if (city) {
    const plate = plateGeometry(city.lat, { altStep: 6, azStep: 15 });

    // linee d'azimut, solo nel cielo visibile
    c.save();
    clipSky(b, plate);
    c.strokeStyle = BRASS.engraveSoft;
    c.lineWidth = b.L(thin, 1);
    for (const a of plate.azimuths) {
      c.beginPath();
      curvePath(b, a.curve);
      c.stroke();
    }
    c.restore();

    // almucantarat
    c.strokeStyle = BRASS.engrave;
    plate.almucantars.forEach((a) => {
      c.lineWidth = b.L(a.alt % 30 === 0 ? mid : thin, 1);
      c.beginPath();
      curvePath(b, a.curve);
      c.stroke();
    });

    // crepuscolo: tratteggiato
    if (plate.twilight) {
      c.save();
      c.setLineDash([b.L(0.012), b.L(0.008)]);
      c.lineWidth = b.L(mid, 1);
      c.beginPath();
      curvePath(b, plate.twilight);
      c.stroke();
      c.restore();
    }

    // ore ineguali della notte, con i numeri vicino al Capricorno
    c.save();
    c.setLineDash([b.L(0.006), b.L(0.006)]);
    c.lineWidth = b.L(thin, 1);
    c.strokeStyle = BRASS.engraveSoft;
    for (const h of plate.hours) {
      c.beginPath();
      b.polyPath(h.points);
      c.stroke();
    }
    c.restore();
    c.fillStyle = BRASS.engrave;
    for (const h of plate.hours) {
      // il numero sta sulla linea, poco dentro il Capricorno
      const p = h.points[1] ?? h.points[0];
      b.text(String(h.n), p.x * 0.955, p.y * 0.955, 0.026, fonts.serif, 0, { style: "italic" });
    }

    // orizzonte, forte
    c.strokeStyle = BRASS.engrave;
    c.lineWidth = b.L(bold, 1.4);
    c.beginPath();
    curvePath(b, plate.horizon);
    c.stroke();

    // diametri: meridiano e linea est-ovest
    c.lineWidth = b.L(mid, 1);
    b.line(0, -1, 0, 1);
    b.line(-1, 0, 1, 0);

    // numeri delle altezze lungo il meridiano sud
    c.fillStyle = BRASS.engrave;
    for (const a of plate.almucantars) {
      if (a.alt % 12 !== 0) continue;
      const p = meridianLabelPoint(a.alt, plate.lat);
      if (Math.hypot(p.x, p.y) > 0.97) continue;
      b.text(String(a.alt), p.x + 0.028, p.y - 0.014, 0.024, fonts.mono, 0);
    }

    // oriente e occidente sull'orizzonte
    const e = horizonPoint(90, plate.lat);
    const w = horizonPoint(270, plate.lat);
    b.text("oriente", e.x - 0.085, e.y + 0.03, 0.03, fonts.serif, -0.05, { style: "italic" });
    b.text("occidente", w.x + 0.1, w.y + 0.03, 0.03, fonts.serif, 0.05, { style: "italic" });

    paintCartouche(b, plate, city, fonts, opts);
  }

  // tropici ed equatore
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(bold, 1.3);
  b.circle(0, 0, 1 - 0.0025);
  c.lineWidth = b.L(mid, 1);
  b.circle(0, 0, R_EQ);
  b.circle(0, 0, R_CANCER);
  c.restore();

  // la tacca in basso, dove entra il dente della madre
  c.fillStyle = "rgba(20, 12, 4, 0.9)";
  c.fillRect(b.X(-0.012), b.Y(-DIMS.plate + 0.024), b.L(0.024), b.L(0.03));
}

/** Il cartiglio in basso, sotto l'orizzonte: il nome della città, la latitudine, il suo motivo. */
function paintCartouche(b: Burin, plate: PlateGeometry, city: CityItem, fonts: EngraveFonts, opts: PlatePaintOptions) {
  const c = b.ctx;
  const top = plate.skyInside ? Math.min(plate.north.y, -0.1) : 0.0;
  const bottom = -R_CANCER;
  const cy = (top + bottom) / 2 - 0.004;
  const hh = Math.min(0.075, (top - bottom) / 2 - 0.012);
  const hw = 0.25;
  // cornice a lobi
  c.save();
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(0.0022, 1);
  const lobes = (inset: number) => {
    c.beginPath();
    const rx = hw - inset;
    const ry = hh - inset;
    c.moveTo(b.X(-rx + ry * 0.6), b.Y(cy + ry));
    c.lineTo(b.X(rx - ry * 0.6), b.Y(cy + ry));
    c.quadraticCurveTo(b.X(rx), b.Y(cy + ry), b.X(rx), b.Y(cy));
    c.quadraticCurveTo(b.X(rx), b.Y(cy - ry), b.X(rx - ry * 0.6), b.Y(cy - ry));
    c.lineTo(b.X(-rx + ry * 0.6), b.Y(cy - ry));
    c.quadraticCurveTo(b.X(-rx), b.Y(cy - ry), b.X(-rx), b.Y(cy));
    c.quadraticCurveTo(b.X(-rx), b.Y(cy + ry), b.X(-rx + ry * 0.6), b.Y(cy + ry));
    c.stroke();
  };
  lobes(0);
  c.lineWidth = b.L(0.0012, 1);
  lobes(0.012);
  c.restore();
  // il motivo della città ai lati del cartiglio
  const motif = motifFor(city.motif, city.id);
  c.save();
  c.strokeStyle = BRASS.engraveSoft;
  const bandH = b.L(Math.min(0.05, hh * 0.8));
  straightBand(c, motif, b.X(-hw - 0.135), b.Y(cy) - bandH / 2, b.L(0.12), bandH, Math.max(1, 1.4 * (b.size / 2048)));
  straightBand(c, motif, b.X(hw + 0.015), b.Y(cy) - bandH / 2, b.L(0.12), bandH, Math.max(1, 1.4 * (b.size / 2048)));
  c.restore();
  // il nome e le coordinate
  c.fillStyle = BRASS.engrave;
  const hasLocal = !!city.nameLocal && city.nameLocal !== city.name;
  const nameY = hasLocal ? cy + hh * 0.38 : cy + hh * 0.22;
  b.text(city.name, 0, nameY, Math.min(0.056, hh * 0.72), fonts.serif, 0, { style: "italic" });
  if (hasLocal) {
    const isArabic = /[؀-ۿ]/.test(city.nameLocal);
    b.text(city.nameLocal, 0, cy - hh * 0.12, Math.min(0.04, hh * 0.5), isArabic ? fonts.arabic : fonts.serif, 0);
  }
  b.text(`${formatLat(city.lat)}  ${formatLon(city.lon)}`, 0, cy - hh * 0.62, Math.min(0.022, hh * 0.3), fonts.mono, 0);
}

/** La piastra segreta: gli orizzonti di tutte le città su una sola piastra, come le antiche piastre degli orizzonti. */
function paintHorizonsPlate(b: Burin, cities: CityItem[], fonts: EngraveFonts) {
  const c = b.ctx;
  c.strokeStyle = BRASS.engrave;
  cities.forEach((city, i) => {
    const plate = plateGeometry(city.lat, { altStep: 30, azStep: 90 });
    c.lineWidth = b.L(0.0026, 1);
    c.beginPath();
    curvePath(b, plate.horizon);
    c.stroke();
    // il nome della città sull'orizzonte, dove incontra il meridiano nord (o sud)
    const p = plate.skyInside ? plate.north : { x: 0, y: plate.north.y };
    const y = Math.max(-0.95, Math.min(0.95, p.y - 0.022 - (i % 2) * 0.0));
    c.fillStyle = BRASS.engrave;
    b.text(city.name, 0.02 + 0.13 * ((i % 3) - 1), y, 0.026, fonts.serif, 0, { style: "italic" });
  });
  c.lineWidth = b.L(0.0016, 1);
  b.line(0, -1, 0, 1);
  b.line(-1, 0, 1, 0);
  // al centro una stella a otto punte e la scritta
  c.fillStyle = BRASS.engrave;
  b.text("tutti gli orizzonti", 0, -0.62, 0.042, fonts.serif, 0, { style: "italic" });
  b.text("una sola volta del cielo", 0, -0.69, 0.026, fonts.serif, 0, { style: "italic" });
  shamsa(b, 0, -0.34, 0.12);
}

/** Una shamsa: stella a otto punte intrecciata. */
export function shamsa(b: Burin, cx: number, cy: number, r: number) {
  const c = b.ctx;
  c.save();
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(0.002, 1);
  for (const rr of [r, r * 0.62]) {
    c.beginPath();
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i <= 4; i++) {
        const a = (i / 4) * Math.PI * 2 + (k * Math.PI) / 4;
        const x = b.X(cx + Math.cos(a) * rr);
        const y = b.Y(cy + Math.sin(a) * rr);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
    }
    c.stroke();
  }
  b.circle(cx, cy, r * 0.28);
  b.circle(cx, cy, r * 1.08);
  c.restore();
}

// ---------- il lembo (faccia anteriore della madre) ----------

export function paintLimb(b: Burin, sections: readonly AstroSection[], fonts: EngraveFonts) {
  const c = b.ctx;
  fillBrass(b, { seed: 11, patina: 1 });
  const R = DIMS.mater;
  const Ri = DIMS.limbIn;
  c.save();
  c.lineCap = "round";
  c.strokeStyle = BRASS.engrave;
  // cerchi della scala
  const r1 = R - 0.018; // bordo esterno delle tacche
  const r2 = R - 0.062; // fine delle tacche lunghe
  const r3 = R - 0.142; // fine dei numeri dei gradi
  const r4 = Ri + 0.012; // bordo interno
  c.lineWidth = b.L(0.003, 1);
  b.circle(0, 0, r1);
  c.lineWidth = b.L(0.002, 1);
  b.circle(0, 0, r2);
  b.circle(0, 0, r3);
  c.lineWidth = b.L(0.003, 1);
  b.circle(0, 0, r4);
  b.circle(0, 0, R - 0.006);

  // tacche dei gradi: 0 in alto, in senso orario
  for (let d = 0; d < 360; d++) {
    const a = d * DEG;
    const long = d % 10 === 0;
    const midT = d % 5 === 0;
    const inner = long ? r2 : midT ? r1 - 0.03 : r1 - 0.018;
    c.lineWidth = b.L(long ? 0.0028 : 0.0017, 1);
    b.line(Math.sin(a) * inner, Math.cos(a) * inner, Math.sin(a) * r1, Math.cos(a) * r1);
  }
  // numeri ogni 10 gradi
  c.fillStyle = BRASS.engrave;
  for (let d = 0; d < 360; d += 10) {
    const a = d * DEG;
    const rr = (r2 + r3) / 2 + 0.004;
    b.text(String(d), Math.sin(a) * rr, Math.cos(a) * rr, 0.046, fonts.serif, a, {});
  }
  // le ventiquattro ore, con mezzogiorno in alto: sotto la regola che segue il Sole si legge l'ora solare
  for (let h = 0; h < 24; h++) {
    const a = ((h - 12) * 15 * DEG + Math.PI * 4) % (Math.PI * 2);
    const rr = (r3 + r4) / 2;
    c.lineWidth = b.L(0.0016, 1);
    for (let q = 1; q < 4; q++) {
      const aq = a + q * 3.75 * DEG;
      b.line(Math.sin(aq) * (r4 + 0.004), Math.cos(aq) * (r4 + 0.004), Math.sin(aq) * (r4 + (q === 2 ? 0.026 : 0.016)), Math.cos(aq) * (r4 + (q === 2 ? 0.026 : 0.016)));
    }
    c.lineWidth = b.L(0.0024, 1);
    b.line(Math.sin(a) * r4, Math.cos(a) * r4, Math.sin(a) * r3, Math.cos(a) * r3);
    const label = String(h === 0 ? 24 : h);
    const at = a + 7.5 * DEG;
    b.text(label, Math.sin(at) * rr, Math.cos(at) * rr, 0.04, fonts.serif, at, { style: "italic" });
  }
  c.restore();

  // i segni delle sezioni: piccole stelle a otto punte incise sull'orlo, con il titolo
  for (const s of sections) paintSectionMark(b, s, fonts);
}

function paintSectionMark(b: Burin, s: AstroSection, fonts: EngraveFonts) {
  const c = b.ctx;
  const a = ((s.angle % 360) + 360) % 360 * DEG;
  const R = DIMS.mater;
  const rr = R - 0.04;
  const x = Math.sin(a) * rr;
  const y = Math.cos(a) * rr;
  c.save();
  // un tondo pulito che interrompe le tacche, con la stella dentro
  c.fillStyle = BRASS.base;
  b.fillCircle(x, y, 0.034);
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(0.0026, 1);
  b.circle(x, y, 0.034);
  c.beginPath();
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 4; i++) {
      const t = (i / 4) * Math.PI * 2 + (k * Math.PI) / 4 + a;
      const px = b.X(x + Math.cos(t) * 0.022);
      const py = b.Y(y + Math.sin(t) * 0.022);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
  }
  c.stroke();
  c.fillStyle = BRASS.engrave;
  b.fillCircle(x, y, 0.005);
  c.restore();
  void fonts;
}

// ---------- il fondo della madre: il gazzettiere delle città ----------

export function paintFloor(b: Burin, cities: readonly CityItem[], fonts: EngraveFonts) {
  const c = b.ctx;
  fillBrass(b, { seed: 21, patina: 1.3, scratches: 0.4 });
  c.save();
  c.strokeStyle = BRASS.engraveSoft;
  c.lineWidth = b.L(0.002, 1);
  b.circle(0, 0, 0.98);
  c.fillStyle = BRASS.engrave;
  b.text("le città delle piastre", 0, 0.62, 0.05, fonts.serif, 0, { style: "italic" });
  const rows = cities.slice(0, 10);
  const top = 0.48;
  const step = Math.min(0.11, 1.0 / Math.max(1, rows.length));
  rows.forEach((city, i) => {
    const y = top - i * step;
    b.text(city.name, -0.12, y, 0.042, fonts.serif, 0, { style: "italic", align: "right" });
    b.text(`${formatLat(city.lat)}  ${formatLon(city.lon)}`, -0.06, y, 0.03, fonts.mono, 0, { align: "left" });
  });
  c.restore();
}

// ---------- il retro ----------

export function paintBack(b: Burin, fonts: EngraveFonts, code: string, sunLongitudeOfDay: (day: number) => number) {
  const c = b.ctx;
  fillBrass(b, { seed: 31, patina: 1.1 });
  const R = DIMS.mater;
  c.save();
  c.lineCap = "round";
  c.strokeStyle = BRASS.engrave;
  c.fillStyle = BRASS.engrave;

  // scala delle altezze, nei due quadranti in alto: 0 all'orizzonte, 90 in alto
  const r1 = R - 0.02;
  const r2 = R - 0.065;
  const r3 = R - 0.13;
  c.lineWidth = b.L(0.003, 1);
  b.circle(0, 0, R - 0.008);
  b.circle(0, 0, r1);
  c.lineWidth = b.L(0.002, 1);
  b.circle(0, 0, r2);
  b.circle(0, 0, r3);
  for (let d = 0; d < 360; d++) {
    const a = d * DEG;
    const long = d % 10 === 0;
    const m = d % 5 === 0;
    c.lineWidth = b.L(long ? 0.0026 : 0.0016, 1);
    const inner = long ? r2 : m ? r1 - 0.028 : r1 - 0.016;
    b.line(Math.sin(a) * inner, Math.cos(a) * inner, Math.sin(a) * r1, Math.cos(a) * r1);
  }
  for (let d = 10; d <= 90; d += 10) {
    // altezza d: a sinistra e a destra, misurata dall'orizzontale verso l'alto
    for (const side of [-1, 1]) {
      const a = side * (90 - d) * DEG;
      const rr = (r2 + r3) / 2;
      b.text(String(d), Math.sin(a) * rr, Math.cos(a) * rr, 0.04, fonts.serif, a, {});
    }
  }

  // zodiaco e calendario: dove sta il Sole in ogni giorno dell'anno
  const z1 = r3;
  const z2 = r3 - 0.07;
  const z3 = z2 - 0.07;
  c.lineWidth = b.L(0.002, 1);
  b.circle(0, 0, z2);
  b.circle(0, 0, z3);
  // il cerchio dello zodiaco: l'Ariete comincia a sinistra, come sui retri tradizionali
  const lonToAngle = (lon: number) => (270 - lon) * DEG;
  for (let l = 0; l < 360; l += 2) {
    const a = lonToAngle(l);
    const long = l % 30 === 0;
    c.lineWidth = b.L(long ? 0.0024 : 0.0014, 1);
    b.line(Math.sin(a) * z1, Math.cos(a) * z1, Math.sin(a) * (long ? z2 : z1 - (l % 10 === 0 ? 0.03 : 0.016)), Math.cos(a) * (long ? z2 : z1 - (l % 10 === 0 ? 0.03 : 0.016)));
  }
  ZODIAC_IT.forEach((name, i) => {
    const a = lonToAngle(i * 30 + 15);
    const bottom = Math.cos(a) < -0.2;
    b.arcText(name, 0, 0, (z1 + z2) / 2 - 0.004 * (bottom ? -1 : 1) - 0.012, a, 0.032, fonts.serif, { style: "italic", flip: bottom });
  });
  // i mesi, allineati alla longitudine vera del Sole
  const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = 0;
  months.forEach((name, i) => {
    const a0 = lonToAngle(sunLongitudeOfDay(doy));
    c.lineWidth = b.L(0.0022, 1);
    b.line(Math.sin(a0) * z2, Math.cos(a0) * z2, Math.sin(a0) * z3, Math.cos(a0) * z3);
    for (let d = 5; d < days[i]; d += 5) {
      const ad = lonToAngle(sunLongitudeOfDay(doy + d));
      c.lineWidth = b.L(0.0013, 1);
      b.line(Math.sin(ad) * z2, Math.cos(ad) * z2, Math.sin(ad) * (z2 - 0.018), Math.cos(ad) * (z2 - 0.018));
    }
    const am = lonToAngle(sunLongitudeOfDay(doy + days[i] / 2));
    const bottom = Math.cos(am) < -0.2;
    b.arcText(name, 0, 0, (z2 + z3) / 2 - 0.012 * (bottom ? -1 : 1), am, 0.03, fonts.serif, { style: "italic", flip: bottom });
    doy += days[i];
  });

  // il quadrato delle ombre, in basso
  const sq = 0.5;
  const top = -0.1;
  c.lineWidth = b.L(0.0022, 1);
  c.strokeRect(b.X(-sq), b.Y(top), b.L(2 * sq), b.L(sq));
  for (let i = 1; i < 12; i++) {
    const t = (i / 12) * sq;
    c.lineWidth = b.L(i % 3 === 0 ? 0.0018 : 0.0012, 1);
    b.line(-sq + 0.035, top - t, -sq, top - t);
    b.line(sq - 0.035, top - t, sq, top - t);
    b.line(-sq + t, top - sq + 0.035, -sq + t, top - sq);
    b.line(sq - t, top - sq + 0.035, sq - t, top - sq);
  }
  b.line(-sq, top - sq, 0, top);
  b.line(sq, top - sq, 0, top);
  b.text("umbra recta", -sq * 0.55, top - sq + 0.07, 0.03, fonts.serif, 0, { style: "italic" });
  b.text("umbra versa", sq * 0.55, top - sq + 0.07, 0.03, fonts.serif, 0, { style: "italic" });
  // la firma
  b.text("hello, imad's world", 0, top - sq - 0.12, 0.046, fonts.serif, 0, { style: "italic" });

  // il codice inciso, in alto: la funzione vera che fa girare la rete
  const lines = code.split("\n");
  const maxLen = Math.max(...lines.map((l) => l.length));
  const width = 1.56;
  const size = (width / maxLen) * 1.62; // il monospazio è largo circa 0,6 em
  const lh = size * 1.42;
  const blockH = lh * lines.length;
  const cy = 0.43;
  const y0 = cy + blockH / 2 - lh / 2;
  c.lineWidth = b.L(0.002, 1);
  const pad = 0.045;
  const bx = width / 2 + pad;
  const by = blockH / 2 + pad;
  c.beginPath();
  c.roundRect(b.X(-bx), b.Y(cy + by), b.L(2 * bx), b.L(2 * by), b.L(0.03));
  c.stroke();
  c.lineWidth = b.L(0.0012, 1);
  c.beginPath();
  c.roundRect(b.X(-bx + 0.014), b.Y(cy + by - 0.014), b.L(2 * bx - 0.028), b.L(2 * by - 0.028), b.L(0.022));
  c.stroke();
  b.text("lib/astro/time.ts", 0, cy + by + 0.04, 0.03, fonts.mono, 0, {});
  lines.forEach((line, i) => {
    b.text(line, -width / 2, y0 - i * lh, size, fonts.mono, 0, { align: "left" });
  });
  c.restore();
  shamsa(b, 0, 0, 0.07);
}

// ---------- la rete: incisioni e sagoma ----------

export const RETE_HALF = 1.02;

/** Riempie la sagoma della rete (bianco pieno, fori trasparenti). Serve per estrudere la geometria. */
export function paintReteSilhouette(b: Burin, d: ReteDesign) {
  const c = b.ctx;
  c.clearRect(0, 0, b.size, b.size);
  c.save();
  c.fillStyle = "#fff";
  c.strokeStyle = "#fff";
  c.lineCap = "round";
  // anello del Capricorno
  c.beginPath();
  b.circlePath(0, 0, d.ring.outer);
  b.circlePath(0, 0, d.ring.inner);
  c.fill("evenodd");
  // eclittica
  const e = d.ecliptic;
  c.beginPath();
  b.circlePath(e.cx, e.cy, e.r);
  b.circlePath(e.cx, e.cy, e.r - e.width);
  c.fill("evenodd");
  // arco dell'equatore (metà sinistra)
  c.lineWidth = b.L(d.equator.width);
  c.lineCap = "butt";
  b.arc(0, 0, d.equator.r, Math.PI / 2, (3 * Math.PI) / 2);
  c.lineCap = "round";
  // barre
  for (const bar of d.bars) {
    c.lineWidth = b.L(bar.width);
    b.line(bar.a.x, bar.a.y, bar.b.x, bar.b.y);
  }
  // decori sulle barre: piccole losanghe
  for (const bar of d.bars) {
    const mx = (bar.a.x + bar.b.x) / 2;
    const my = (bar.a.y + bar.b.y) / 2;
    const ang = Math.atan2(bar.b.y - bar.a.y, bar.b.x - bar.a.x);
    const L = 0.05;
    const W = 0.032;
    const pts = [
      { x: mx + Math.cos(ang) * L, y: my + Math.sin(ang) * L },
      { x: mx - Math.sin(ang) * W, y: my + Math.cos(ang) * W },
      { x: mx - Math.cos(ang) * L, y: my - Math.sin(ang) * L },
      { x: mx + Math.sin(ang) * W, y: my - Math.cos(ang) * W },
    ];
    b.fillPoly(pts);
  }
  // mozzo
  b.fillCircle(0, 0, d.hub.r);
  // volute, gambi, fiamme, rosette
  for (const o of d.ornaments) b.fillPoly(o);
  for (const p of d.pointers) {
    if (p.stem) b.fillPoly(p.stem);
    if (p.kind === "flame") b.fillPoly(p.outline);
    if (p.rosette) b.fillCircle(p.rosette.cx, p.rosette.cy, p.rosette.r);
  }
  // fori
  c.globalCompositeOperation = "destination-out";
  b.fillCircle(0, 0, d.hub.hole);
  for (const bar of d.bars) {
    const mx = (bar.a.x + bar.b.x) / 2;
    const my = (bar.a.y + bar.b.y) / 2;
    b.fillCircle(mx, my, 0.011);
  }
  for (const p of d.pointers) {
    if (p.kind === "hole") b.fillCircle(p.tip.x, p.tip.y, 0.0085);
    if (p.rosette) b.fillCircle(p.rosette.cx, p.rosette.cy, p.rosette.hole);
  }
  for (const h of d.piercings) b.fillCircle(h.cx, h.cy, h.r);
  c.restore();
}

/** Le incisioni sulla faccia della rete: scala dello zodiaco, nomi dei segni, filetti. */
export function paintReteTexture(b: Burin, d: ReteDesign, fonts: EngraveFonts, names: Map<string, string>) {
  const c = b.ctx;
  fillBrass(b, { seed: 41, patina: 0.8 });
  c.save();
  c.lineCap = "round";
  c.strokeStyle = BRASS.engrave;
  c.fillStyle = BRASS.engrave;
  // filetti sull'anello esterno
  c.lineWidth = b.L(0.0018, 1);
  b.circle(0, 0, d.ring.outer - 0.008);
  b.circle(0, 0, d.ring.inner + 0.008);
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const r = (d.ring.outer + d.ring.inner) / 2;
    b.fillCircle(Math.sin(a) * r, Math.cos(a) * r, 0.0035);
  }
  // scala dello zodiaco sull'eclittica: tacche verso il centro del suo cerchio
  const e = eclipticCircle();
  const w = d.ecliptic.width;
  c.lineWidth = b.L(0.0016, 1);
  b.circle(e.cx, e.cy, e.r - 0.006);
  b.circle(e.cx, e.cy, e.r - w * 0.42);
  for (let l = 0; l < 360; l += 2) {
    const p = eclipticPoint(l);
    const dx = e.cx - p.x;
    const dy = e.cy - p.y;
    const n = Math.hypot(dx, dy);
    const len = l % 30 === 0 ? w - 0.004 : l % 10 === 0 ? w * 0.42 : w * 0.26;
    c.lineWidth = b.L(l % 30 === 0 ? 0.0024 : 0.0014, 1);
    b.line(p.x + (dx / n) * 0.006, p.y + (dy / n) * 0.006, p.x + (dx / n) * len, p.y + (dy / n) * len);
  }
  // nomi dei segni, lungo la fascia
  ZODIAC_IT.forEach((name, i) => {
    const p = eclipticPoint(i * 30 + 15);
    // angolo del punto attorno al centro dell'eclittica, in senso orario dall'alto
    const a = clockAngle({ x: p.x - e.cx, y: p.y - e.cy });
    const bottom = Math.cos(a) < -0.15;
    b.arcText(name, e.cx, e.cy, e.r - w * 0.72, a, 0.022, fonts.serif, { style: "italic", flip: bottom });
  });
  // l'equatore e le barre: una linea al centro
  c.lineWidth = b.L(0.0014, 1);
  b.arc(0, 0, d.equator.r, Math.PI / 2 + 0.05, (3 * Math.PI) / 2 - 0.05);
  for (const bar of d.bars) b.line(bar.a.x, bar.a.y, bar.b.x, bar.b.y);
  // mozzo: cerchi e petali
  b.circle(0, 0, d.hub.r - 0.01);
  b.circle(0, 0, d.hub.hole + 0.012);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.line(Math.cos(a) * (d.hub.hole + 0.016), Math.sin(a) * (d.hub.hole + 0.016), Math.cos(a) * (d.hub.r - 0.016), Math.sin(a) * (d.hub.r - 0.016));
  }
  // fiamme: una nervatura e il nome della stella vicino alla base
  for (const p of d.pointers) {
    if (p.kind !== "flame") continue;
    const L = Math.hypot(p.tip.x - p.base.x, p.tip.y - p.base.y);
    const ux = (p.tip.x - p.base.x) / L;
    const uy = (p.tip.y - p.base.y) / L;
    c.lineWidth = b.L(0.0012, 1);
    b.line(p.base.x + ux * 0.01, p.base.y + uy * 0.01, p.base.x + ux * L * 0.72, p.base.y + uy * L * 0.72);
    const label = names.get(p.id);
    if (label && L > 0.07) {
      const mx = p.base.x + ux * L * 0.36;
      const my = p.base.y + uy * L * 0.36;
      let rot = -Math.atan2(uy, ux);
      if (Math.cos(rot) < 0) rot += Math.PI;
      b.text(label, mx, my, 0.0125, fonts.serif, rot, { style: "italic" });
    }
    if (p.rosette) {
      c.lineWidth = b.L(0.0012, 1);
      b.circle(p.rosette.cx, p.rosette.cy, p.rosette.r - 0.006);
    }
  }
  c.restore();
}

// ---------- il trono (kursi) ----------

/** Centro e mezzo lato del quadrato che contiene il trono, in unità di piastra. */
export const KURSI_FRAME = { cx: 0, cy: 1.36, half: 0.8 } as const;

/** Il contorno del trono: un arco a lobi con volute ai lati, ispirato ai troni yemeniti e safavidi. */
export function kursiOutline(b: Burin) {
  const c = b.ctx;
  const P = (x: number, y: number): [number, number] => [b.X(x), b.Y(y)];
  const half = (s: number) => {
    // s = +1 lato destro, -1 sinistro; si parte dal fondo (dentro la madre) e si sale fino alla punta
    const pts: [string, ...number[]][] = [
      ["M", 0, 0.9],
      ["L", 0.62 * s, 0.9],
      ["L", 0.74 * s, 1.0],
      // voluta del piede
      ["C", 0.8 * s, 1.03, 0.86 * s, 1.08, 0.83 * s, 1.14],
      ["C", 0.8 * s, 1.2, 0.71 * s, 1.18, 0.71 * s, 1.12],
      ["C", 0.71 * s, 1.08, 0.76 * s, 1.08, 0.765 * s, 1.11],
      // fianco concavo
      ["C", 0.66 * s, 1.12, 0.6 * s, 1.22, 0.53 * s, 1.29],
      // spalla a lobo
      ["C", 0.55 * s, 1.35, 0.47 * s, 1.41, 0.41 * s, 1.37],
      // collo
      ["C", 0.36 * s, 1.4, 0.31 * s, 1.42, 0.27 * s, 1.44],
      // secondo lobo
      ["C", 0.29 * s, 1.5, 0.23 * s, 1.55, 0.18 * s, 1.52],
      // l'arco che sale alla punta
      ["C", 0.16 * s, 1.58, 0.1 * s, 1.62, 0.055 * s, 1.645],
      ["C", 0.04 * s, 1.67, 0.03 * s, 1.69, 0, DIMS.kursiTop],
    ];
    return pts;
  };
  const drawHalf = (s: number, reverse: boolean) => {
    const segs = half(s);
    if (!reverse) {
      for (const [cmd, ...v] of segs) {
        if (cmd === "M") c.moveTo(...P(v[0], v[1]));
        else if (cmd === "L") c.lineTo(...P(v[0], v[1]));
        else c.bezierCurveTo(...P(v[0], v[1]), ...P(v[2], v[3]), ...P(v[4], v[5]));
      }
    } else {
      // percorre la metà al contrario: dalla punta al fondo
      const pts: { cmd: string; v: number[] }[] = segs.map(([cmd, ...v]) => ({ cmd, v }));
      for (let i = pts.length - 1; i >= 1; i--) {
        const cur = pts[i];
        const prevEnd = pts[i - 1].v.slice(-2);
        if (cur.cmd === "C") c.bezierCurveTo(...P(cur.v[2], cur.v[3]), ...P(cur.v[0], cur.v[1]), ...P(prevEnd[0], prevEnd[1]));
        else c.lineTo(...P(prevEnd[0], prevEnd[1]));
      }
    }
  };
  c.beginPath();
  drawHalf(1, false);
  drawHalf(-1, true);
  c.closePath();
}

/** I trafori del trono: arco centrale trilobato, gocce, occhi delle volute. */
export function kursiHoles(b: Burin) {
  const c = b.ctx;
  const P = (x: number, y: number): [number, number] => [b.X(x), b.Y(y)];
  // arco trilobato al centro
  c.beginPath();
  c.moveTo(...P(-0.075, 1.2));
  c.lineTo(...P(-0.075, 1.31));
  c.bezierCurveTo(...P(-0.11, 1.33), ...P(-0.1, 1.39), ...P(-0.055, 1.385));
  c.bezierCurveTo(...P(-0.06, 1.43), ...P(-0.02, 1.45), ...P(0, 1.47));
  c.bezierCurveTo(...P(0.02, 1.45), ...P(0.06, 1.43), ...P(0.055, 1.385));
  c.bezierCurveTo(...P(0.1, 1.39), ...P(0.11, 1.33), ...P(0.075, 1.31));
  c.lineTo(...P(0.075, 1.2));
  c.closePath();
  c.fill();
  for (const s of [-1, 1]) {
    // goccia inclinata
    c.save();
    c.translate(...P(0.33 * s, 1.21));
    c.rotate(s * 0.7);
    c.beginPath();
    const k = b.k;
    c.moveTo(0, -0.07 * k);
    c.bezierCurveTo(0.045 * k, -0.01 * k, 0.035 * k, 0.04 * k, 0, 0.042 * k);
    c.bezierCurveTo(-0.035 * k, 0.04 * k, -0.045 * k, -0.01 * k, 0, -0.07 * k);
    c.fill();
    c.restore();
    // occhio della voluta
    c.beginPath();
    c.arc(...P(0.792 * s, 1.135), 0.017 * b.k, 0, Math.PI * 2);
    c.fill();
    // forellini in alto
    c.beginPath();
    c.arc(...P(0.155 * s, 1.47), 0.022 * b.k, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(...P(0.46 * s, 1.335), 0.016 * b.k, 0, Math.PI * 2);
    c.fill();
    // mezzaluna sotto la spalla
    c.beginPath();
    c.arc(...P(0.55 * s, 1.18), 0.04 * b.k, 0, Math.PI * 2);
    c.arc(...P(0.565 * s, 1.195), 0.034 * b.k, 0, Math.PI * 2, true);
    c.fill();
  }
  // il foro del perno della maniglia
  c.beginPath();
  c.arc(...P(0, 1.6), 0.016 * b.k, 0, Math.PI * 2);
  c.fill();
}

export function paintKursiSilhouette(b: Burin) {
  const c = b.ctx;
  c.clearRect(0, 0, b.size, b.size);
  c.fillStyle = "#fff";
  kursiOutline(b);
  c.fill();
  c.globalCompositeOperation = "destination-out";
  kursiHoles(b);
  c.globalCompositeOperation = "source-over";
}

/** L'incisione sul trono: un filetto che segue il contorno all'interno e qualche viticcio. */
export function paintKursiTexture(b: Burin) {
  const c = b.ctx;
  fillBrass(b, { seed: 51, patina: 1.1 });
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  // il filetto: tracciato spesso scuro, poi ottone sopra, resta una linea a distanza fissa dal bordo
  kursiOutline(b);
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(0.05);
  c.stroke();
  c.strokeStyle = BRASS.base;
  c.lineWidth = b.L(0.05 - 0.007);
  c.stroke();
  // la parte che cade dentro la madre resta liscia: la copre il lembo
  // viticci
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(0.0035, 1);
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(b.X(0.12 * s), b.Y(1.12));
    c.bezierCurveTo(b.X(0.2 * s), b.Y(1.3), b.X(0.36 * s), b.Y(1.36), b.X(0.42 * s), b.Y(1.25));
    c.bezierCurveTo(b.X(0.45 * s), b.Y(1.19), b.X(0.4 * s), b.Y(1.15), b.X(0.37 * s), b.Y(1.18));
    c.stroke();
    c.beginPath();
    c.moveTo(b.X(0.09 * s), b.Y(1.5));
    c.bezierCurveTo(b.X(0.12 * s), b.Y(1.58), b.X(0.2 * s), b.Y(1.56), b.X(0.22 * s), b.Y(1.5));
    c.stroke();
  }
  c.restore();
}

// ---------- il cavallo ----------

export const HORSE_FRAME = { cx: 0, cy: 0, half: 0.2 } as const;

/** Il cavallo: il cuneo che blocca il perno, con la testa stilizzata. Lungo l'asse x, testa a destra. */
export function paintHorseSilhouette(b: Burin) {
  const c = b.ctx;
  c.clearRect(0, 0, b.size, b.size);
  c.fillStyle = "#fff";
  const P = (x: number, y: number): [number, number] => [b.X(x), b.Y(y)];
  c.beginPath();
  c.moveTo(...P(-0.19, 0.012));
  c.lineTo(...P(0.06, 0.024));
  // collo e testa
  c.bezierCurveTo(...P(0.09, 0.03), ...P(0.1, 0.06), ...P(0.12, 0.075));
  c.lineTo(...P(0.128, 0.098)); // orecchio
  c.lineTo(...P(0.14, 0.072));
  c.bezierCurveTo(...P(0.17, 0.06), ...P(0.19, 0.03), ...P(0.192, 0.01));
  c.bezierCurveTo(...P(0.18, 0.0), ...P(0.16, 0.012), ...P(0.15, 0.02));
  c.bezierCurveTo(...P(0.13, 0.005), ...P(0.11, -0.02), ...P(0.085, -0.024));
  c.lineTo(...P(-0.19, -0.012));
  c.closePath();
  c.fill();
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.arc(...P(0.145, 0.045), 0.0085 * b.k, 0, Math.PI * 2); // l'occhio
  c.fill();
  c.beginPath();
  c.arc(...P(-0.15, 0), 0.007 * b.k, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
}

// ---------- regola e alidada ----------

/** La regola: scala delle declinazioni lungo il filo, numeri ogni 10 gradi. Canvas in coordinate locali [-half, half]. */
export function paintRule(b: Burin, fonts: EngraveFonts) {
  const c = b.ctx;
  fillBrass(b, { seed: 61, patina: 0.7 });
  c.save();
  c.strokeStyle = BRASS.engrave;
  c.fillStyle = BRASS.engrave;
  c.lineCap = "round";
  c.lineWidth = b.L(0.0018, 1);
  b.line(-1.12, 0, 1.12, 0);
  // declinazioni da -23 a 80 gradi, su entrambi i bracci
  for (const s of [-1, 1]) {
    for (let dec = -20; dec <= 80; dec += 5) {
      const r = radiusOfDec(dec);
      const l = dec % 10 === 0 ? 0.022 : 0.012;
      c.lineWidth = b.L(dec % 10 === 0 ? 0.0018 : 0.0012, 1);
      b.line(s * r, 0, s * r, l);
      if (dec % 20 === 0 && r > 0.15) b.text(String(dec), s * r, -0.016, 0.017, fonts.mono, 0);
    }
    const rt = radiusOfDec(-OBLIQUITY);
    c.lineWidth = b.L(0.0022, 1);
    b.line(s * rt, -0.02, s * rt, 0.02);
  }
  c.restore();
}

export function paintAlidade(b: Burin, fonts: EngraveFonts) {
  const c = b.ctx;
  fillBrass(b, { seed: 71, patina: 0.9 });
  c.save();
  c.strokeStyle = BRASS.engrave;
  c.lineWidth = b.L(0.0018, 1);
  b.line(-1.2, 0, 1.2, 0);
  for (let i = 1; i <= 10; i++) {
    const x = 0.12 + i * 0.07;
    b.line(x, 0.012, x, -0.012);
    b.line(-x, 0.012, -x, -0.012);
  }
  c.restore();
  void fonts;
}

/** Per i pezzi senza incisioni particolari: solo ottone. */
export function paintPlainBrass(b: Burin, seed = 81) {
  fillBrass(b, { seed, patina: 1 });
}

export type { Ctx2D };
