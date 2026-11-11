// Il tempo dell'astrolabio. La funzione reteAngle è incisa, così com'è, sul retro dello strumento:
// se la cambi, aggiorna anche RETE_SOURCE in engraving.ts (lo controlla lo script di verifica).
import { SiderealTime } from "file:///home/user/imad.chat/node_modules/astronomy-engine/astronomy.js";
/** Un giorno siderale: il tempo di un giro completo della rete, in millisecondi. */
export const SIDEREAL_DAY_MS = 86164090.5;
/** La rete gira con il cielo: questo è l'angolo, dal tempo siderale locale. */
export function reteAngle(date, lon) {
    const gast = SiderealTime(date); // ore
    const giri = (gast + lon / 15) / 24;
    return (giri % 1) * 2 * Math.PI;
}
/** Tempo siderale locale apparente, in ore (0..24). */
export function localSiderealHours(date, lon) {
    const h = (SiderealTime(date) + lon / 15) % 24;
    return h < 0 ? h + 24 : h;
}
/** Quanto tempo corrisponde a una rotazione della rete di `radians` (in senso orario), in ms. */
export function msForReteTurn(radians) {
    return (radians / (2 * Math.PI)) * SIDEREAL_DAY_MS;
}
/** Ora locale di una città, es. "21:07", nel suo fuso IANA. */
export function localTimeString(date, timeZone, withSeconds = false) {
    try {
        return new Intl.DateTimeFormat("it-IT", {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: withSeconds ? "2-digit" : undefined,
            hourCycle: "h23",
        }).format(date);
    }
    catch {
        return date.toISOString().slice(11, withSeconds ? 19 : 16);
    }
}
/** Data locale di una città, es. "11 novembre 2026". */
export function localDateString(date, timeZone) {
    try {
        return new Intl.DateTimeFormat("it-IT", { timeZone, day: "numeric", month: "long", year: "numeric" }).format(date);
    }
    catch {
        return date.toISOString().slice(0, 10);
    }
}
