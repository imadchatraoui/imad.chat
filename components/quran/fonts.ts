// Il carattere del Corano: Amiri Quran (next/font/google, servito dal sito stesso).
// Niente preload: il libro nasce chiuso. Il file si scarica quando il browser è libero, o appena
// qualcuno si avvicina al libro (warmQuranFont). display "block": finché il carattere non c'è,
// l'arabo resta invisibile (al massimo ~3 s) invece di comparire in un carattere qualsiasi.

import { Amiri_Quran } from "next/font/google";

export const quranFont = Amiri_Quran({
  weight: "400",
  subsets: ["arabic"],
  display: "block",
  preload: false,
  adjustFontFallback: false,
  fallback: ["Amiri", "Scheherazade New", "Noto Naskh Arabic", "serif"],
  variable: "--q-font-quran",
});

let warming: Promise<unknown> | null = null;

/** Fa scaricare il carattere (una volta sola). sample: un po' del testo arabo vero, dai dati. */
export function warmQuranFont(sample: string): Promise<unknown> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  if (!warming) {
    warming = document.fonts.load(`400 32px ${quranFont.style.fontFamily}`, sample || "۝").catch(() => undefined);
  }
  return warming;
}
