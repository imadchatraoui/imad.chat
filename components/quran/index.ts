// Il mushaf interattivo di imad's world: dieci versetti sul cielo, ognuno con un gesto per l'astrolabio.
//
//   import { QuranBook, type QuranAction } from "@/components/quran";
//   import verses from "@/content/astro/verses.json";
//
//   <QuranBook verses={verses.items} onAction={(a: QuranAction) => astrolabio(a)} />
//
// QuranBook è un componente client; si può importare da un componente server e passargli i versetti.
// L'aspetto si cambia con le variabili --q-* (elenco in QuranBook.module.css).

export { default as QuranBook } from "./QuranBook";
export type { QuranAction, QuranBookProps, QuranEvent, Verse } from "./types";
export { PAGE_META, PAGE_ORDER, buildPages, type QuranPageData, type QuranPageMeta } from "./pages";
export { splitAyahs, ayahEndSign, arabicIndicDigits } from "./arabic";
