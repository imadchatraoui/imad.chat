// I tipi del mushaf interattivo. Verse è la forma delle voci di content/astro/verses.json.

/** Un versetto (o un gruppo di versetti consecutivi) come sta in content/astro/verses.json. */
export interface Verse {
  /** "86:1-3", "53:49"… */
  key: string;
  surah: number;
  /** Il nome della sura traslitterato, es. "At-Tariq". */
  surahName: string;
  /** I numeri dei versetti, in ordine. */
  ayahs: number[];
  /** Il testo arabo: i versetti uniti da uno spazio. Si mostra così com'è, mai riscritto. */
  ar: string;
  /** La traduzione italiana. */
  it: string;
  /** Chi ha tradotto (Hamza Roberto Piccardo). */
  translator: string;
  /** La pagina della fonte (quran.com o tanzil.net). */
  source: string;
}

/** Quello che un versetto chiede all'astrolabio. */
export type QuranAction =
  | { type: "tariq" }
  | { type: "star"; id: string }
  | { type: "navigate" }
  | { type: "stars" }
  | { type: "moon" }
  | { type: "sun-moon" }
  | { type: "now" }
  | { type: "qibla" };

/** Eventi per i suoni facoltativi: il libro si apre, si chiude, una pagina gira. */
export type QuranEvent = "open" | "close" | "turn";

export interface QuranBookProps {
  /** I versetti di content/astro/verses.json (le pagine seguono l'ordine del libro, vedi pages.ts). */
  verses: Verse[];
  /** Il bottone in fondo alla pagina: si chiama con l'azione, poi il libro si chiude da solo. */
  onAction?: (action: QuranAction) => void;
  /** Aperto o chiuso, se lo decide chi lo usa (componente controllato). */
  open?: boolean;
  /** Chi legge chiede di aprire o chiudere (tocco sul libro, «Chiudi», Esc, un'azione). */
  onOpenChange?: (open: boolean) => void;
  /** La pagina da cui partire, es. "53:49". Se cambia, il libro va a quella pagina. */
  initialKey?: string;
  /** Classe sulla radice: è il posto giusto per le variabili --q-*. */
  className?: string;
  /** Facoltativo: per i suoni. */
  onEvent?: (event: QuranEvent) => void;
}
