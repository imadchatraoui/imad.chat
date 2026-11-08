import { site } from "@/site.config";

/**
 * Tutte le date passano da una chiave "YYYY-MM-DD" nel fuso del diario.
 * Così server e client producono le stesse stringhe, senza sorprese di timezone.
 */

const HIJRI_MONTHS = [
  "Muharram",
  "Safar",
  "Rabiʿ al-Awwal",
  "Rabiʿ al-Thani",
  "Jumada al-Ula",
  "Jumada al-Akhira",
  "Rajab",
  "Shaʿban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qaʿda",
  "Dhu al-Hijja",
];

/** Oggi, come "YYYY-MM-DD", nel fuso orario del diario. */
export function todayKey(timeZone: string = site.timeZone): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Da "YYYY-MM-DD" a una Date stabile (mezzogiorno UTC), da formattare con timeZone UTC. */
export function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function formatLong(key: string, opts: { weekday?: boolean } = {}): string {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: "UTC",
    weekday: opts.weekday ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(keyToDate(key));
}

/** "8 nov" */
export function formatShort(key: string): string {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
    .format(keyToDate(key))
    .replace(/\.$/, "");
}

export function hijriParts(key: string): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(keyToDate(key));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** "28 Jumada al-Ula 1448" */
export function formatHijri(key: string): string {
  const h = hijriParts(key);
  return `${h.day} ${HIJRI_MONTHS[h.month - 1] ?? ""} ${h.year}`.trim();
}

/** 0 = domenica … 6 = sabato */
export function weekday(key: string): number {
  return keyToDate(key).getUTCDay();
}

/**
 * La parola con cui si apre la home. Sa che giorno è.
 * Il calendario è l'Umm al-Qura: nei giorni di festa può scostarsi di un giorno dall'avvistamento locale.
 */
export function greetingFor(key: string): string {
  const h = hijriParts(key);
  if (h.month === 10 && h.day <= 3) return "Eid mubarak.";
  if (h.month === 12 && h.day >= 10 && h.day <= 13) return "Eid mubarak.";
  if (h.month === 9) return "Ramadan mubarak.";
  if (weekday(key) === 5) return "Jumuʿah mubarak.";
  return "Salam.";
}
