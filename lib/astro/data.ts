// I contenuti verificati di content/astro, tipizzati. Le voci ancora vuote restano utilizzabili:
// chi le mostra controlla i campi che gli servono.

import starsJson from "@/content/astro/stars.json";
import citiesJson from "@/content/astro/cities.json";
import versesJson from "@/content/astro/verses.json";
import curiositiesJson from "@/content/astro/curiosities.json";
import type { AstroFile, CityItem, CuriosityItem, StarItem, VerseItem } from "./types";

const starsFile = starsJson as unknown as AstroFile<StarItem>;
const citiesFile = citiesJson as unknown as AstroFile<CityItem>;
const versesFile = versesJson as unknown as AstroFile<VerseItem>;
const curiositiesFile = curiositiesJson as unknown as AstroFile<CuriosityItem>;

function validStar(s: StarItem): boolean {
  return !!s && typeof s.id === "string" && Number.isFinite(s.ra) && Number.isFinite(s.dec);
}

function validCity(c: CityItem): boolean {
  return !!c && typeof c.id === "string" && Number.isFinite(c.lat) && Number.isFinite(c.lon);
}

export const STARS: readonly StarItem[] = (starsFile.items ?? []).filter(validStar);
export const CITIES: readonly CityItem[] = (citiesFile.items ?? []).filter(validCity);
export const VERSES: readonly VerseItem[] = versesFile.items ?? [];
export const CURIOSITIES: readonly CuriosityItem[] = curiositiesFile.items ?? [];

/** true finché un file è ancora un segnaposto. */
export const PLACEHOLDERS = {
  stars: !!starsFile.placeholder,
  cities: !!citiesFile.placeholder,
  verses: !!versesFile.placeholder,
  curiosities: !!curiositiesFile.placeholder,
} as const;

/** L'ordine delle piastre richiesto da Imad; le città che il JSON non ha ancora restano fuori. */
export const CITY_ORDER = ["torino", "al-quds", "gaza", "fes", "istanbul", "samarcanda", "kyoto", "cusco"] as const;

export function getCity(id: string | undefined | null): CityItem | undefined {
  if (!id) return undefined;
  return CITIES.find((c) => c.id === id);
}

export function getStar(id: string | undefined | null): StarItem | undefined {
  if (!id) return undefined;
  return STARS.find((s) => s.id === id);
}

/** Le città nell'ordine delle piastre (prima quelle note, poi le altre del JSON). */
export function citiesInOrder(): CityItem[] {
  const known = CITY_ORDER.map((id) => getCity(id)).filter((c): c is CityItem => !!c);
  const rest = CITIES.filter((c) => !CITY_ORDER.includes(c.id as (typeof CITY_ORDER)[number]));
  return [...known, ...rest];
}

/** Le stelle che hanno un puntatore sulla rete. */
export function pointerStars(): StarItem[] {
  return STARS.filter((s) => s.pointer);
}
