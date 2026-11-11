// Un versetto del Corano: l'arabo in Amiri, da destra a sinistra, la traduzione italiana e la fonte.
// Il testo arriva così com'è da content/astro/verses.json (verificato su quran.com e tanzil.net): qui
// non si tocca. Solo la presentazione: se la traduzione è un frammento di una frase più lunga, i
// puntini lo dicono (… all'inizio se comincia in minuscolo, al posto della virgola o del punto e
// virgola finali). Nessun hook: si può rendere sul server o nel browser.

import type { VerseItem } from "@/lib/astro/types";
import { ayahRef, quranUrl } from "./format";
import p from "./Panels.module.css";

export interface VerseBlockProps {
  verse: VerseItem;
  className?: string;
}

/**
 * I segni di pausa (waqf, U+06D6–U+06DC) stanno sopra la fine della parola che li precede: lo spazio
 * prima di loro diventa indivisibile, così l'a capo non li lascia soli all'inizio della riga.
 * Si toccano solo gli spazi, mai le lettere.
 */
function bindWaqf(ar: string): string {
  return ar.replace(/ (?=[\u06D6-\u06DC])/g, "\u00A0");
}

/** La traduzione come frammento: «…» davanti se comincia a metà frase, al posto di «,» o «;» in fondo. */
function asFragment(it: string): string {
  let s = it.trim();
  if (/^\p{Ll}/u.test(s)) s = `…${s}`;
  if (/[,;]$/.test(s)) s = `${s.slice(0, -1).trimEnd()}…`;
  return s;
}

/** Il nome del sito della fonte, per il link: quran.com, tanzil.net… */
function sourceSite(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "quran.com";
  }
}

export default function VerseBlock({ verse, className }: VerseBlockProps) {
  const ref = ayahRef(verse.surah, verse.ayahs);
  const url = verse.source || quranUrl(verse.surah, verse.ayahs);
  return (
    <figure className={`${p.verse} ${className ?? ""}`}>
      <blockquote cite={url}>
        <p className={p.verseAr} lang="ar" dir="rtl">
          {bindWaqf(verse.ar)}
        </p>
        <span className={p.verseRule} aria-hidden="true" />
        <p className={p.verseIt} lang="it">
          {asFragment(verse.it)}
        </p>
      </blockquote>
      <figcaption className={p.verseCite}>
        Corano, sura <span className={p.surah}>{verse.surahName}</span>, {ref}.
        <br />
        Traduzione di {verse.translator}.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer">
          Leggi su {sourceSite(url)}
        </a>
      </figcaption>
    </figure>
  );
}
