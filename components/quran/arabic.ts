// Il testo arabo si mostra esattamente com'è in content/astro/verses.json: qui non si scrive né si
// riscrive una lettera. Si decide solo dove mettere il segno di fine versetto e dove non andare a capo.
//
// - Il campo `ar` unisce i versetti con un solo spazio. Per i gruppi di più versetti la divisione
//   viene da una tabella verificata: quante parole (separate da spazi) ha ogni versetto, contate sul
//   testo uthmani di quran.com (api.quran.com, novembre 2026), più l'impronta FNV-1a del testo intero.
//   Se il testo cambia, o i conti non tornano, il blocco si mostra intero, senza segni.
// - Il segno di fine versetto (U+06DD) seguito dal numero in cifre arabo-indiane non fa parte del testo: è un
//   elemento a parte, accanto all'ultima parola del versetto.
// - I segni di pausa (waqf, U+06D6–U+06DC) nel testo stanno dopo uno spazio: per non lasciarli soli
//   all'inizio di una riga, la parola che li precede, lo spazio e il segno stanno in un gruppo che
//   non si spezza (white-space: nowrap). Lo spazio resta quello originale.

import type { Verse } from "./types";

/** ARABIC END OF AYAH. */
export const END_OF_AYAH = "\u06DD";

/** Le cifre arabo-indiane (U+0660–U+0669) di un numero: 144 → U+0661 U+0664 U+0664. */
export function arabicIndicDigits(n: number): string {
  return String(Math.trunc(Math.abs(n))).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}

/** Il segno di fine versetto con il suo numero. */
export function ayahEndSign(ayah: number): string {
  return END_OF_AYAH + arabicIndicDigits(ayah);
}

/** FNV-1a a 32 bit sulle unità UTF-16: l'impronta del testo verificato. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Quante parole ha ciascun versetto dei gruppi, contate sul testo di quran.com
 * (86:1, 86:2, 86:3 e 36:38, 36:39, 36:40, uniti da uno spazio danno esattamente il campo `ar`).
 */
const VERIFIED_SPLITS: Record<string, { hash: number; words: readonly number[] }> = {
  "86:1-3": { hash: 0x404d33a0, words: [2, 4, 2] },
  "36:38-40": { hash: 0x72129af4, words: [9, 7, 16] },
};

const ONLY_MARKS = /^\p{M}+$/u;

/**
 * Il testo diviso per versetto, oppure null se non si può fare con sicurezza.
 * Garanzia: quando non è null, `parti.join(" ") === verse.ar`.
 */
export function splitAyahs(verse: Verse): string[] | null {
  const { ar, ayahs } = verse;
  if (!ar || ayahs.length === 0) return null;
  if (ayahs.length === 1) return [ar];
  const known = VERIFIED_SPLITS[verse.key];
  if (!known || known.words.length !== ayahs.length || fnv1a(ar) !== known.hash) return null;
  const words = ar.split(" ");
  if (words.some((w) => w === "")) return null;
  if (known.words.reduce((a, b) => a + b, 0) !== words.length) return null;
  const parts: string[] = [];
  let at = 0;
  for (const n of known.words) {
    parts.push(words.slice(at, at + n).join(" "));
    at += n;
  }
  // un versetto non comincia con un segno di pausa, e i pezzi rifanno il testo identico
  if (parts.some((p) => ONLY_MARKS.test(p.split(" ")[0] ?? ""))) return null;
  if (parts.join(" ") !== ar) return null;
  return parts;
}

/**
 * Il testo in gruppi da tenere sulla stessa riga: di solito una parola; una parola seguita da un
 * segno di pausa diventa "parola segno" (con lo spazio originale in mezzo).
 * Garanzia: `gruppi.join(" ") === testo`.
 */
export function keepTogether(text: string): string[] {
  const words = text.split(" ");
  const groups: string[] = [];
  for (const w of words) {
    if (groups.length > 0 && w !== "" && ONLY_MARKS.test(w)) groups[groups.length - 1] += ` ${w}`;
    else groups.push(w);
  }
  return groups;
}

/** C'è almeno una lettera araba? (per i controlli: nessun arabo fuori dai blocchi del Corano). */
export const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
