// Un versetto del Corano: l'arabo in Amiri, da destra a sinistra, la traduzione italiana e la fonte.
// Il testo arriva così com'è da content/astro/verses.json (verificato su quran.com): qui non si tocca.
// Nessun hook: si può rendere sul server o nel browser.

import type { VerseItem } from "@/lib/astro/types";
import { ayahRef, quranUrl } from "./format";
import p from "./Panels.module.css";

export interface VerseBlockProps {
  verse: VerseItem;
  className?: string;
}

export default function VerseBlock({ verse, className }: VerseBlockProps) {
  const ref = ayahRef(verse.surah, verse.ayahs);
  const url = quranUrl(verse.surah, verse.ayahs);
  return (
    <figure className={`${p.verse} ${className ?? ""}`}>
      <blockquote cite={url}>
        <p className={p.verseAr} lang="ar" dir="rtl">
          {verse.ar}
        </p>
        <span className={p.verseRule} aria-hidden="true" />
        <p className={p.verseIt} lang="it">
          {verse.it}
        </p>
      </blockquote>
      <figcaption className={p.verseCite}>
        Corano, sura <span className={p.surah}>{verse.surahName}</span>, {ref}.
        <br />
        Traduzione di {verse.translator}.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer">
          Leggi su quran.com
        </a>
      </figcaption>
    </figure>
  );
}
