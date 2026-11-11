// Il codice inciso sul retro dell'astrolabio: è, parola per parola, la funzione reteAngle di time.ts
// (lo script di verifica controlla che coincidano).
export const RETE_SOURCE = `export function reteAngle(date: Date, lon: number) {
  const gast = SiderealTime(date); // ore
  const giri = (gast + lon / 15) / 24;
  return (giri % 1) * 2 * Math.PI;
}`;
/** Il file da cui viene il codice inciso. */
export const RETE_SOURCE_FILE = "lib/astro/time.ts";
