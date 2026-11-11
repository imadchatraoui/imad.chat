// Le pagine del mushaf: l'ordine, una riga italiana che lega il versetto al cielo (scritta qui, senza
// pretese: nessun «miracolo scientifico», solo il cielo che si vede) e il bottone per l'astrolabio.
// Funzioni pure: vanno bene sul server e nel browser.

import { splitAyahs } from "./arabic";
import type { QuranAction, Verse } from "./types";

export interface QuranPageMeta {
  /** Una riga, in italiano, dal versetto al cielo. */
  bridge: string;
  /** Il testo del bottone. */
  label: string;
  action: QuranAction;
}

/** L'ordine delle pagine nel libro. Le voci che non sono qui vanno in fondo, nell'ordine ricevuto. */
export const PAGE_ORDER: readonly string[] = ["86:1-3", "53:49", "16:16", "6:97", "67:5", "37:6", "10:5", "36:38-40", "55:5", "2:144"];

export const PAGE_META: Readonly<Record<string, QuranPageMeta>> = {
  "86:1-3": {
    bridge: "At-Tariq è chi bussa di notte: una stella che buca il buio con la sua luce.",
    label: "Guarda la stella che bussa",
    action: { type: "tariq" },
  },
  "53:49": {
    bridge: "Ash-Shi‘ra è Sirio, la stella più luminosa del cielo notturno, chiamata qui per nome.",
    label: "Trova Sirio nel cielo",
    action: { type: "star", id: "sirius" },
  },
  "16:16": {
    bridge: "Per secoli carovane e marinai hanno trovato la strada guardando le stelle.",
    label: "Orientati con le stelle",
    action: { type: "navigate" },
  },
  "6:97": {
    bridge: "Prima delle mappe e dei satelliti, di notte si viaggiava leggendo le stelle.",
    label: "Orientati con le stelle",
    action: { type: "navigate" },
  },
  "67:5": {
    bridge: "Le luminarie del cielo più vicino: le stelle che vediamo a occhio nudo, ogni notte.",
    label: "Accendi le stelle",
    action: { type: "stars" },
  },
  "37:6": {
    bridge: "Lo stesso cielo ornato di stelle si accende, ogni notte, sopra ognuna di queste città.",
    label: "Accendi le stelle",
    action: { type: "stars" },
  },
  "10:5": {
    bridge: "Le fasi della luna scandiscono i mesi del calendario islamico: guarda a che punto è stanotte.",
    label: "Guarda la luna di stanotte",
    action: { type: "moon" },
  },
  "36:38-40": {
    bridge: "Il sole e la luna seguono ciascuno la propria strada: ecco dove sono, in questo momento.",
    label: "Il sole e la luna, adesso",
    action: { type: "sun-moon" },
  },
  "55:5": {
    bridge: "Il moto del sole e della luna si può calcolare: è proprio il calcolo che fa questo astrolabio.",
    label: "Il cielo calcolato, adesso",
    action: { type: "now" },
  },
  "2:144": {
    bridge: "Ovunque ci si trovi, per pregare ci si volge verso la Ka‘ba: l’astrolabio ne indica la direzione.",
    label: "Verso la qibla",
    action: { type: "qibla" },
  },
};

export type ArabicSize = "s" | "m" | "l" | "xl";

export interface QuranPageData {
  verse: Verse;
  /** Posizione nel libro, da 0. */
  index: number;
  meta: QuranPageMeta | null;
  /** Il testo arabo diviso per versetto (null: il blocco si mostra intero, senza segni di fine). */
  ayahTexts: string[] | null;
  /** "86:1–3" */
  ref: string;
  /** "versetti 1–3", "versetto 49" */
  ayahLabel: string;
  /** La pagina del versetto su quran.com. */
  quranUrl: string;
  /** La fonte della traduzione, se non è quran.com (es. tanzil.net). */
  textSource: { url: string; host: string } | null;
  /** La traduzione pronta per la pagina (i puntini se è un frammento di frase). */
  italian: string;
  /** Quanto è lungo l'arabo: decide la grandezza del carattere. */
  size: ArabicSize;
}

function range(ayahs: number[], sep: string): string {
  if (ayahs.length === 0) return "";
  const first = ayahs[0];
  const last = ayahs[ayahs.length - 1];
  return first === last ? String(first) : `${first}${sep}${last}`;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** La traduzione come frammento: «…» davanti se comincia a metà frase, al posto di «,» o «;» in fondo. */
export function asFragment(it: string): string {
  let s = it.trim();
  if (/^\p{Ll}/u.test(s)) s = `…${s}`;
  if (/[,;:]$/.test(s)) s = `${s.slice(0, -1).trimEnd()}…`;
  return s;
}

function sizeOf(ar: string): ArabicSize {
  const n = ar.length;
  if (n <= 50) return "s";
  if (n <= 100) return "m";
  if (n <= 180) return "l";
  return "xl";
}

/** Le pagine del libro, nell'ordine giusto. */
export function buildPages(verses: Verse[]): QuranPageData[] {
  const rank = (key: string) => {
    const i = PAGE_ORDER.indexOf(key);
    return i === -1 ? PAGE_ORDER.length : i;
  };
  const ordered = verses
    .map((v, i) => ({ v, i }))
    .sort((a, b) => rank(a.v.key) - rank(b.v.key) || a.i - b.i)
    .map(({ v }) => v);

  return ordered.map((verse, index) => {
    const sourceHost = host(verse.source);
    const onQuranCom = sourceHost === "quran.com";
    const quranUrl = onQuranCom ? verse.source : `https://quran.com/${verse.surah}/${range(verse.ayahs, "-")}`;
    return {
      verse,
      index,
      meta: PAGE_META[verse.key] ?? null,
      ayahTexts: splitAyahs(verse),
      ref: `${verse.surah}:${range(verse.ayahs, "–")}`,
      ayahLabel: `${verse.ayahs.length > 1 ? "versetti" : "versetto"} ${range(verse.ayahs, "–")}`,
      quranUrl,
      textSource: !onQuranCom && sourceHost ? { url: verse.source, host: sourceHost } : null,
      italian: asFragment(verse.it),
      size: sizeOf(verse.ar),
    };
  });
}

/** L'indice della pagina con questa chiave (0 se non c'è). */
export function pageIndexOf(pages: QuranPageData[], key: string | undefined | null): number {
  if (!key) return 0;
  const i = pages.findIndex((p) => p.verse.key === key);
  return i === -1 ? 0 : i;
}
