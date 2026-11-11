// Tipi dei contenuti in content/astro/*.json e delle strutture condivise
// tra l'astrolabio 3D e la sua versione 2D.

/** Una fonte: un titolo, un link, o entrambi. */
export type AstroSource = string | { title?: string; url?: string; [key: string]: unknown };

export interface StarItem {
  id: string;
  /** Nome italiano. */
  name: string;
  latin: string;
  /** Nome arabo, da fonte verificata (può essere vuoto). */
  ar: string;
  translit: string;
  meaning: string;
  /** Ascensione retta J2000, in ore. */
  ra: number;
  /** Declinazione J2000, in gradi. */
  dec: number;
  mag: number;
  constellation: string;
  /** Se ha un puntatore sulla rete. */
  pointer: boolean;
  /** Riferimento coranico, es. "53:49", oppure null. */
  quran: string | null;
  note: string;
  sources: AstroSource[];
}

export interface CityItem {
  id: string;
  name: string;
  nameLocal: string;
  country: string;
  lat: number;
  lon: number;
  /** Fuso IANA, es. "Europe/Rome". */
  tz: string;
  /** Motivo ornamentale della piastra, es. "tatreez". */
  motif: string;
  blurb: string;
  facts: unknown[];
  sources: AstroSource[];
}

export interface VerseItem {
  key: string;
  surah: number;
  surahName: string;
  ayahs: number[];
  ar: string;
  it: string;
  translator: string;
  source: string;
}

export interface CuriosityItem {
  id: string;
  title: string;
  text: string;
  tags: string[];
  sources: AstroSource[];
}

export interface AstroFile<T> {
  placeholder?: boolean;
  items: T[];
}

/** Una sezione del sito, incisa come segno sul lembo graduato. */
export interface AstroSection {
  id: string;
  title: string;
  /** Gradi sul lembo, da 0 in alto (sotto il trono) in senso orario. */
  angle: number;
}

export interface Observer {
  lat: number;
  lon: number;
}

/** Punto nel piano dell'astrolabio. Unità: il tropico del Capricorno ha raggio 1; y verso l'alto (il trono). */
export interface Pt {
  x: number;
  y: number;
}
