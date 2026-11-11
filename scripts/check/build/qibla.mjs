// La qibla: la direzione della Kaʿba lungo il cerchio massimo, come la calcolavano gli astronomi
// con la trigonometria sferica.
import { DEG } from "./projection.mjs";
/** La Kaʿba, alla Mecca. */
export const KAABA = { lat: 21.4225, lon: 39.8262 };
/** Azimut iniziale (gradi da nord, in senso orario) del cerchio massimo da un luogo alla Kaʿba. */
export function qiblaBearing(lat, lon) {
    const f1 = lat * DEG;
    const f2 = KAABA.lat * DEG;
    const dl = (KAABA.lon - lon) * DEG;
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    const b = Math.atan2(y, x) / DEG;
    return (b + 360) % 360;
}
/** Distanza lungo il cerchio massimo, in km (Terra sferica di raggio medio 6371 km). */
export function greatCircleKm(lat1, lon1, lat2, lon2) {
    const f1 = lat1 * DEG;
    const f2 = lat2 * DEG;
    const df = f2 - f1;
    const dl = (lon2 - lon1) * DEG;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Distanza dalla Kaʿba, in km. */
export function kaabaDistanceKm(lat, lon) {
    return greatCircleKm(lat, lon, KAABA.lat, KAABA.lon);
}
