// La geometria dell'astrolabio: proiezione stereografica dal polo sud celeste
// sul piano dell'equatore, vista dal davanti.
//
// Convenzioni (le stesse per la piastra, la rete, il 3D e il 2D):
// - unità: il tropico del Capricorno ha raggio 1;
// - il centro è il polo nord celeste, x verso destra, y verso l'alto (verso il trono);
// - in alto c'è il meridiano sud, a sinistra l'est (al-mashriq), a destra l'ovest;
// - l'angolo orario H (positivo verso ovest) si misura dall'alto in senso orario,
//   così una stella sorge a sinistra, culmina in alto e tramonta a destra:
//   col passare del tempo la rete gira in senso orario.
export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;
/** Obliquità media dell'eclittica nel 2026 (formula IAU 2006): 23°26′09″. */
export const OBLIQUITY = 23.4359;
/** Raggio dell'equatore celeste, se il tropico del Capricorno ha raggio 1. */
export const R_EQ = 1 / Math.tan(((90 + OBLIQUITY) / 2) * DEG);
/** Raggio del tropico del Cancro. */
export const R_CANCER = R_EQ * Math.tan(((90 - OBLIQUITY) / 2) * DEG);
/** Raggio del tropico del Capricorno: il bordo della piastra disegnata. */
export const R_CAPRICORN = 1;
/** Distanza dal centro (il polo nord celeste) di un punto a declinazione dec, in gradi. */
export function radiusOfDec(decDeg) {
    return R_EQ * Math.tan(((90 - decDeg) / 2) * DEG);
}
/** Declinazione (gradi) che cade a distanza r dal centro: l'inversa di radiusOfDec. */
export function decOfRadius(r) {
    return 90 - (2 * Math.atan(r / R_EQ)) / DEG;
}
/** Punto della piastra per angolo orario (radianti, positivo verso ovest) e declinazione (gradi). */
export function projectHourAngle(hourAngle, decDeg) {
    const r = radiusOfDec(decDeg);
    return { x: r * Math.sin(hourAngle), y: r * Math.cos(hourAngle) };
}
/** Punto della rete ferma, a tempo siderale zero: ra in ore, dec in gradi. */
export function projectOnRete(raHours, decDeg) {
    return projectHourAngle(-raHours * 15 * DEG, decDeg);
}
/** Ruota un punto attorno al centro, in senso orario, di `angle` radianti: è il moto della rete. */
export function rotateClockwise(p, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c };
}
/** Angolo in senso orario dall'alto (radianti, 0..2π) di un punto della piastra. */
export function clockAngle(p) {
    const a = Math.atan2(p.x, p.y);
    return a < 0 ? a + TAU : a;
}
/** Dalle coordinate orizzontali (gradi; azimut da nord verso est) ad angolo orario (rad) e declinazione (gradi). */
export function horizontalToEquatorial(altDeg, azDeg, latDeg) {
    const a = altDeg * DEG;
    const A = azDeg * DEG;
    const f = latDeg * DEG;
    const sinDec = Math.sin(f) * Math.sin(a) + Math.cos(f) * Math.cos(a) * Math.cos(A);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) / DEG;
    const hourAngle = Math.atan2(-Math.cos(a) * Math.sin(A), Math.cos(f) * Math.sin(a) - Math.sin(f) * Math.cos(a) * Math.cos(A));
    return { hourAngle, dec };
}
/** Dalle coordinate equatoriali (angolo orario in rad, dec in gradi) ad altezza e azimut (gradi). */
export function equatorialToHorizontal(hourAngle, decDeg, latDeg) {
    const d = decDeg * DEG;
    const f = latDeg * DEG;
    const east = -Math.cos(d) * Math.sin(hourAngle);
    const north = Math.cos(f) * Math.sin(d) - Math.sin(f) * Math.cos(d) * Math.cos(hourAngle);
    const up = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(hourAngle);
    const alt = Math.asin(Math.max(-1, Math.min(1, up))) / DEG;
    let az = Math.atan2(east, north) / DEG;
    if (az < 0)
        az += 360;
    return { alt, az, east, north, up };
}
/** Punto della piastra per altezza e azimut (gradi) a latitudine lat. */
export function projectHorizontal(altDeg, azDeg, latDeg) {
    const { hourAngle, dec } = horizontalToEquatorial(altDeg, azDeg, latDeg);
    return projectHourAngle(hourAngle, dec);
}
/** Da longitudine eclittica (gradi) a ascensione retta (ore) e declinazione (gradi). */
export function eclipticToEquatorial(lonDeg, latDeg = 0, obliquity = OBLIQUITY) {
    const l = lonDeg * DEG;
    const b = latDeg * DEG;
    const e = obliquity * DEG;
    const sinDec = Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l);
    const dec = Math.asin(sinDec) / DEG;
    let ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / DEG / 15;
    if (ra < 0)
        ra += 24;
    return { ra, dec };
}
/** Il cerchio dell'eclittica sulla rete ferma: tocca il Cancro a sinistra e il Capricorno a destra. */
export function eclipticCircle() {
    const left = projectOnRete(6, OBLIQUITY); // il solstizio d'estate
    const right = projectOnRete(18, -OBLIQUITY); // il solstizio d'inverno
    return { cx: (left.x + right.x) / 2, cy: 0, r: (right.x - left.x) / 2 };
}
/** Punto della rete ferma per una longitudine eclittica (gradi). */
export function eclipticPoint(lonDeg) {
    const { ra, dec } = eclipticToEquatorial(lonDeg);
    return projectOnRete(ra, dec);
}
/** Il cerchio per tre punti, o null se sono allineati. */
export function circleThrough(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-12)
        return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
    const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
    return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) };
}
