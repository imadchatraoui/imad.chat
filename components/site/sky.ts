// Il cielo di una città in un istante, con astronomy-engine: il Sole (giorno, crepuscolo, notte)
// e la Luna (fase, frazione illuminata e da che parte è accesa, vista da lì).

import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MakeTime,
  MoonPhase,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  Vector,
} from "astronomy-engine";
import type { SkyState } from "@/lib/media";

export type { SkyState };

const DEG = Math.PI / 180;

function horizontal(body: Body, date: Date, lat: number, lon: number) {
  const obs = new Observer(lat, lon, 0);
  const eq = Equator(body, date, obs, true, true);
  return Horizon(date, obs, eq.ra, eq.dec);
}

/** Altezza del Sole sull'orizzonte, in gradi. */
export function sunAltitude(date: Date, lat: number, lon: number): number {
  return horizontal(Body.Sun, date, lat, lon).altitude;
}

/**
 * Giorno finché il bordo del Sole è sopra l'orizzonte (−0,833° con la rifrazione), crepuscolo fino
 * a −12° (civile e nautico: il cielo ha ancora colore), poi notte.
 */
export function skyState(sunAlt: number): SkyState {
  if (sunAlt > -0.833) return "giorno";
  if (sunAlt > -12) return "crepuscolo";
  return "notte";
}

export function skyStateAt(date: Date, lat: number, lon: number): SkyState {
  return skyState(sunAltitude(date, lat, lon));
}

export interface MoonState {
  /** Nome italiano della fase, es. "gibbosa calante". */
  name: string;
  /** Frazione del disco illuminata, 0…1. */
  illuminated: number;
  waxing: boolean;
  /** Elongazione eclittica Luna − Sole, 0…360 (0 nuova, 180 piena). */
  elongation: number;
  /**
   * Dove punta il lembo illuminato, per chi la guarda da quel luogo: gradi dall'alto (lo zenit),
   * in senso orario. È la direzione del Sole vista dalla Luna, sulla volta celeste.
   */
  brightLimb: number;
  /** Altezza della Luna sull'orizzonte, in gradi. */
  altitude: number;
}

/**
 * Altezza e azimut (gradi) di una stella del catalogo (coordinate J2000) per un luogo e un istante:
 * prima la precessione e la nutazione fino alla data, poi l'orizzonte locale con la rifrazione.
 */
export function starAltAz(date: Date, lat: number, lon: number, raHours: number, decDeg: number) {
  const time = MakeTime(date);
  const a = raHours * 15 * DEG;
  const d = decDeg * DEG;
  const v = RotateVector(Rotation_EQJ_EQD(time), new Vector(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d), time));
  let ra = Math.atan2(v.y, v.x) / DEG / 15;
  if (ra < 0) ra += 24;
  const dec = Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG;
  const hor = Horizon(time, new Observer(lat, lon, 0), ra, dec, "normal");
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

/** Il nome della fase dall'elongazione: gli stessi confini usati dall'astrolabio. */
export function moonPhaseName(e: number): string {
  if (e < 6 || e >= 354) return "luna nuova";
  if (e < 84) return "falce crescente";
  if (e < 96) return "primo quarto";
  if (e < 174) return "gibbosa crescente";
  if (e < 186) return "luna piena";
  if (e < 264) return "gibbosa calante";
  if (e < 276) return "ultimo quarto";
  return "falce calante";
}

export function moonState(date: Date, lat: number, lon: number): MoonState {
  const elongation = MoonPhase(date);
  const illuminated = Illumination(Body.Moon, date).phase_fraction;
  const moon = horizontal(Body.Moon, date, lat, lon);
  const sun = horizontal(Body.Sun, date, lat, lon);
  // angolo di posizione del Sole rispetto alla Luna nel sistema altazimutale:
  // misurato dallo zenit verso gli azimut crescenti, cioè in senso orario per chi guarda il cielo
  const a1 = moon.altitude * DEG;
  const a2 = sun.altitude * DEG;
  const dAz = (sun.azimuth - moon.azimuth) * DEG;
  const pa = Math.atan2(Math.sin(dAz) * Math.cos(a2), Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dAz));
  return {
    name: moonPhaseName(elongation),
    illuminated,
    waxing: elongation < 180,
    elongation,
    brightLimb: ((pa / DEG) % 360 + 360) % 360,
    altitude: moon.altitude,
  };
}
