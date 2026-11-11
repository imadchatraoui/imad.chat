// Numeri e date in italiano, per i dati veri (in monospace). Funzioni pure: vanno bene sul server e nel browser.

const MINUS = "−";

/** Un numero con la virgola decimale e il segno meno tipografico: −1,44. */
export function num(n: number, digits = 2): string {
  const s = Math.abs(n).toFixed(digits).replace(".", ",");
  return (n < 0 && Number(s.replace(",", ".")) !== 0 ? MINUS : "") + s;
}

/** Ascensione retta da ore decimali: 6h 45m 09s. */
export function formatRA(hours: number): string {
  let total = Math.round((((hours % 24) + 24) % 24) * 3600);
  if (total >= 86400) total -= 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/** Declinazione da gradi decimali: −16° 42′ 58″. */
export function formatDec(deg: number): string {
  const sign = deg < 0 ? MINUS : "+";
  let total = Math.round(Math.abs(deg) * 3600);
  const d = Math.floor(total / 3600);
  total -= d * 3600;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${sign}${d}° ${String(m).padStart(2, "0")}′ ${String(s).padStart(2, "0")}″`;
}

/** Latitudine e longitudine: 45,08° N e 7,68° E. */
export function formatLat(lat: number, digits = 2): string {
  return `${num(Math.abs(lat), digits)}° ${lat >= 0 ? "N" : "S"}`;
}
export function formatLon(lon: number, digits = 2): string {
  return `${num(Math.abs(lon), digits)}° ${lon >= 0 ? "E" : "O"}`;
}

const WINDS = [
  "nord",
  "nord-nordest",
  "nordest",
  "est-nordest",
  "est",
  "est-sudest",
  "sudest",
  "sud-sudest",
  "sud",
  "sud-sudovest",
  "sudovest",
  "ovest-sudovest",
  "ovest",
  "ovest-nordovest",
  "nordovest",
  "nord-nordovest",
];

/** La rosa dei venti a sedici punte, in italiano: 121° → est-sudest. */
export function compass(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return WINDS[i];
}

/** Migliaia col punto: 3.904. */
export function grouped(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Il Marocco sta a UTC+0 tutto l'anno dal 20 settembre 2026, 01:00 UTC (tzdata 2026c e seguenti):
 * i telefoni con dati dei fusi più vecchi metterebbero Fès un'ora avanti. Da lì in poi si usa UTC.
 */
const MOROCCO_UTC_FROM = Date.UTC(2026, 8, 20, 1, 0, 0);

function zoneFor(timeZone: string, date: Date): string {
  return timeZone === "Africa/Casablanca" && date.getTime() >= MOROCCO_UTC_FROM ? "UTC" : timeZone;
}

function fmt(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("it-IT", { timeZone: zoneFor(timeZone, date), ...opts }).format(date);
  } catch {
    return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", ...opts }).format(date);
  }
}

/** Ora locale: 21:07 oppure 21:07:32. */
export function formatClock(date: Date, timeZone: string, seconds = false): string {
  return fmt(date, timeZone, { hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined, hourCycle: "h23" });
}

/** Data locale lunga: mercoledì 11 novembre 2026. */
export function formatDateLong(date: Date, timeZone: string): string {
  return fmt(date, timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Data locale breve: mer 11 nov 2026, oppure mer 11 nov se l'anno è quello di `sameYearAs`. */
export function formatDateShort(date: Date, timeZone: string, sameYearAs?: Date): string {
  const year = (d: Date) => fmt(d, timeZone, { year: "numeric" });
  const omitYear = !!sameYearAs && year(date) === year(sameYearAs);
  return fmt(date, timeZone, { weekday: "short", day: "numeric", month: "short", year: omitYear ? undefined : "numeric" }).replace(/\./g, "");
}

/** Lo scarto di un istante da adesso: +3 h 20 min, −2 g 4 h, +45 min. */
export function formatOffset(ms: number): string {
  const sign = ms < 0 ? MINUS : "+";
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 1) return `${sign}0 min`;
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d >= 1) return h ? `${sign}${d} g ${h} h` : `${sign}${d} g`;
  if (h >= 1) return m ? `${sign}${h} h ${m} min` : `${sign}${h} h`;
  return `${sign}${m} min`;
}

/** «a» davanti a un luogo, con la d eufonica davanti alla a: a Torino, ad Al-Quds. */
export function aPlace(name: string): string {
  return /^[aàAÀ]/.test(name) ? `ad ${name}` : `a ${name}`;
}

/** Una lista all'italiana: «su A, su B e su C». */
export function listWith(prep: string, items: readonly string[]): string {
  const parts = items.map((s) => `${prep} ${s}`);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/** La prima lettera maiuscola. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("it-IT") + s.slice(1) : s;
}

/** Riferimento a una sura: 86:1–3, 53:49. */
export function ayahRef(surah: number, ayahs: readonly number[]): string {
  if (!ayahs.length) return String(surah);
  const a = Math.min(...ayahs);
  const b = Math.max(...ayahs);
  return a === b ? `${surah}:${a}` : `${surah}:${a}–${b}`;
}

/** Il link a quran.com per una sura e i suoi versetti: https://quran.com/86/1-3. */
export function quranUrl(surah: number, ayahs: readonly number[]): string {
  if (!ayahs.length) return `https://quran.com/${surah}`;
  const a = Math.min(...ayahs);
  const b = Math.max(...ayahs);
  return a === b ? `https://quran.com/${surah}/${a}` : `https://quran.com/${surah}/${a}-${b}`;
}
