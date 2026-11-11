// Il cielo vero, con astronomy-engine: precessione delle stelle, Sole, Luna e sua fase.

import {
  Body,
  Equator,
  Illumination,
  MakeTime,
  MoonPhase,
  Observer as AeObserver,
  RotateVector,
  Rotation_EQJ_EQD,
  Vector,
} from "astronomy-engine";
import { BSC_COUNT, BSC_PACKED } from "./catalog";
import { DEG, equatorialToHorizontal } from "./projection";
import { localSiderealHours } from "./time";

export interface EqCoords {
  /** Ascensione retta, in ore. */
  ra: number;
  /** Declinazione, in gradi. */
  dec: number;
}

/** Porta coordinate J2000 all'equatore e all'equinozio veri della data (precessione e nutazione). */
export function toDateCoords(raHours: number, decDeg: number, date: Date): EqCoords {
  return toDateCoordsMany([{ ra: raHours, dec: decDeg }], date)[0];
}

/** Come toDateCoords, per molte stelle con una sola matrice di rotazione. */
export function toDateCoordsMany(list: readonly EqCoords[], date: Date): EqCoords[] {
  const time = MakeTime(date);
  const rot = Rotation_EQJ_EQD(time);
  return list.map(({ ra, dec }) => {
    const a = ra * 15 * DEG;
    const d = dec * DEG;
    const v = new Vector(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d), time);
    const w = RotateVector(rot, v);
    let r = Math.atan2(w.y, w.x) / DEG / 15;
    if (r < 0) r += 24;
    return { ra: r, dec: Math.asin(Math.max(-1, Math.min(1, w.z))) / DEG };
  });
}

/** Altezza e azimut (gradi) di un punto di coordinate della data, per un luogo e un istante. */
export function horizontalOf(eq: EqCoords, date: Date, lat: number, lon: number) {
  const lst = localSiderealHours(date, lon);
  return equatorialToHorizontal((lst - eq.ra) * 15 * DEG, eq.dec, lat);
}

/** Il Sole, in coordinate della data (geocentriche: la parallasse del Sole è trascurabile). */
export function sunEquatorial(date: Date): EqCoords {
  const eq = Equator(Body.Sun, date, new AeObserver(0, 0, 0), true, true);
  return { ra: eq.ra, dec: eq.dec };
}

/** La Luna, in coordinate topocentriche della data per un luogo (la parallasse lunare arriva a un grado). */
export function moonEquatorial(date: Date, lat: number, lon: number): EqCoords {
  const eq = Equator(Body.Moon, date, new AeObserver(lat, lon, 0), true, true);
  return { ra: eq.ra, dec: eq.dec };
}

/** Altezza del Sole (gradi) per un luogo e un istante. */
export function sunAltitude(date: Date, lat: number, lon: number): number {
  return horizontalOf(sunEquatorial(date), date, lat, lon).alt;
}

export type SkyPhase = "giorno" | "crepuscolo civile" | "crepuscolo nautico" | "crepuscolo astronomico" | "notte";

/** Che cielo c'è, dall'altezza del Sole. */
export function skyPhase(sunAlt: number): SkyPhase {
  if (sunAlt > -0.833) return "giorno";
  if (sunAlt > -6) return "crepuscolo civile";
  if (sunAlt > -12) return "crepuscolo nautico";
  if (sunAlt > -18) return "crepuscolo astronomico";
  return "notte";
}

export interface MoonInfo {
  /** Longitudine eclittica Luna meno Sole: 0 nuova, 90 primo quarto, 180 piena, 270 ultimo quarto. */
  elongation: number;
  /** Frazione del disco illuminata, 0..1. */
  illuminated: number;
  /** Angolo di fase Sole-Luna-Terra, in gradi (0 piena, 180 nuova). */
  phaseAngle: number;
  waxing: boolean;
  /** Nome italiano della fase. */
  name: string;
}

/** La fase della Luna: la stessa, nello stesso istante, da Torino e da Gaza. */
export function moonInfo(date: Date): MoonInfo {
  const elongation = MoonPhase(date);
  const ill = Illumination(Body.Moon, date);
  const e = elongation;
  let name: string;
  if (e < 6 || e >= 354) name = "luna nuova";
  else if (e < 84) name = "falce crescente";
  else if (e < 96) name = "primo quarto";
  else if (e < 174) name = "gibbosa crescente";
  else if (e < 186) name = "luna piena";
  else if (e < 264) name = "gibbosa calante";
  else if (e < 276) name = "ultimo quarto";
  else name = "falce calante";
  return {
    elongation,
    illuminated: ill.phase_fraction,
    phaseAngle: ill.phase_angle,
    waxing: elongation < 180,
    name,
  };
}

export interface CatalogStar extends EqCoords {
  mag: number;
  /** Indice di colore B-V. */
  bv: number;
}

let catalogCache: CatalogStar[] | null = null;

/** Le stelle del catalogo (J2000), dalla più luminosa. */
export function brightStars(maxMag = 5): CatalogStar[] {
  if (!catalogCache) {
    const out: CatalogStar[] = [];
    for (let i = 0; i < BSC_COUNT; i++) {
      const k = i * 4;
      out.push({
        ra: BSC_PACKED[k] / 1000,
        dec: BSC_PACKED[k + 1] / 100,
        mag: BSC_PACKED[k + 2] / 100,
        bv: BSC_PACKED[k + 3] / 100,
      });
    }
    catalogCache = out;
  }
  return maxMag >= 5 ? catalogCache : catalogCache.filter((s) => s.mag <= maxMag);
}

/** Colore approssimato di una stella dal suo indice B-V (sRGB, 0..1). */
export function starColor(bv: number): [number, number, number] {
  const t = Math.max(-0.4, Math.min(2, bv));
  // dal bianco-azzurro delle stelle calde all'arancio delle fredde
  if (t < 0.4) {
    const k = (t + 0.4) / 0.8;
    return [0.72 + 0.28 * k, 0.82 + 0.16 * k, 1.0];
  }
  const k = Math.min(1, (t - 0.4) / 1.4);
  return [1.0, 0.98 - 0.3 * k, 0.94 - 0.55 * k];
}
