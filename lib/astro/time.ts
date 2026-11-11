// Il tempo dell'astrolabio. La funzione reteAngle è incisa, così com'è, sul retro dello strumento:
// se la cambi, aggiorna anche RETE_SOURCE in engraving.ts (lo controlla lo script di verifica).

import { SiderealTime } from "astronomy-engine";

/** Un giorno siderale: il tempo di un giro completo della rete, in millisecondi. */
export const SIDEREAL_DAY_MS = 86164090.5;

/** La rete gira con il cielo: questo è l'angolo, dal tempo siderale locale. */
export function reteAngle(date: Date, lon: number) {
  const gast = SiderealTime(date); // ore
  const giri = (gast + lon / 15) / 24;
  return (giri % 1) * 2 * Math.PI;
}

/** Tempo siderale locale apparente, in ore (0..24). */
export function localSiderealHours(date: Date, lon: number): number {
  const h = (SiderealTime(date) + lon / 15) % 24;
  return h < 0 ? h + 24 : h;
}

/** Quanto tempo corrisponde a una rotazione della rete di `radians` (in senso orario), in ms. */
export function msForReteTurn(radians: number): number {
  return (radians / (2 * Math.PI)) * SIDEREAL_DAY_MS;
}

/**
 * Il Marocco è a UTC+0 tutto l'anno dal 20 settembre 2026, alle 01:00 UTC (dati dei fusi IANA 2026c e seguenti):
 * quella notte le 02:00 sono tornate le 01:00, e l'ora non cambia più nemmeno per il Ramadan.
 * Un dispositivo con dati dei fusi più vecchi lo crede ancora a UTC+1 e metterebbe Casablanca un'ora avanti.
 */
export const MOROCCO_UTC_SINCE_MS = Date.UTC(2026, 8, 20, 1, 0, 0);

/**
 * Il fuso da passare a Intl per mostrare l'ora di una città in un certo istante: il suo fuso IANA, tranne che
 * per Africa/Casablanca da MOROCCO_UTC_SINCE_MS in poi, dove si usa UTC (giusto anche con dati dei fusi vecchi).
 * Chi formatta ore e date per conto suo passi di qui, invece di dare a Intl il fuso della città così com'è.
 */
export function displayTimeZone(timeZone: string, date: Date): string {
  return timeZone === "Africa/Casablanca" && date.getTime() >= MOROCCO_UTC_SINCE_MS ? "UTC" : timeZone;
}

/** Ora locale di una città, es. "21:07", nel suo fuso IANA. */
export function localTimeString(date: Date, timeZone: string, withSeconds = false): string {
  try {
    return new Intl.DateTimeFormat("it-IT", {
      timeZone: displayTimeZone(timeZone, date),
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toISOString().slice(11, withSeconds ? 19 : 16);
  }
}

/** Data locale di una città, es. "11 novembre 2026". */
export function localDateString(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("it-IT", { timeZone: displayTimeZone(timeZone, date), day: "numeric", month: "long", year: "numeric" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
