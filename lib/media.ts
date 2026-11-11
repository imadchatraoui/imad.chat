// Gli asset generati (texture, ornamenti, città, suoni, video) arrivano in public/media/ e sono
// elencati in public/media/manifest.json: { "files": ["city/gaza-night-v.jpg", "sfx/S01.mp3", …] },
// percorsi relativi a /media/. Il manifesto si legge una volta sola. Finché non è arrivato, o se manca,
// has() risponde false e chi usa gli asset ripiega sulla sua versione procedurale.

import { useEffect, useSyncExternalStore } from "react";

export type SkyState = "giorno" | "crepuscolo" | "notte";
/** v = verticale (telefono), h = orizzontale (desktop). */
export type Orientation = "v" | "h";
export type SfxId = "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S07" | "S08" | "S09" | "S10" | "S11";

export interface CityMedia {
  /** Loop video muto, o null. */
  video: string | null;
  /** L'immagine corrispondente: poster del video, oppure sfondo da sola. */
  image: string | null;
  variant: "night" | "day";
  orientation: Orientation;
}

export interface MediaIndex {
  /** true quando il manifesto è stato letto (anche se vuoto o assente). */
  ready: boolean;
  files: ReadonlySet<string>;
  has(path: string): boolean;
  url(path: string): string;
}

const BASE = "/media/";

function normalize(p: string): string {
  return p.trim().replace(/^\.?\/+/, "").replace(/^media\//, "");
}

function makeIndex(list: readonly string[], ready: boolean): MediaIndex {
  const files = new Set(list.map(normalize));
  return {
    ready,
    files,
    has: (p) => files.has(normalize(p)),
    url: (p) => BASE + normalize(p),
  };
}

const EMPTY = makeIndex([], false);
let current: MediaIndex = EMPTY;
let pending: Promise<MediaIndex> | null = null;
const listeners = new Set<() => void>();

function publish(next: MediaIndex) {
  current = next;
  for (const l of listeners) l();
}

/** Legge /media/manifest.json una volta sola. Non fallisce mai: senza manifesto, nessun asset. */
export function loadMedia(): Promise<MediaIndex> {
  if (typeof window === "undefined") return Promise.resolve(EMPTY);
  if (!pending) {
    pending = fetch(BASE + "manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const raw = j && typeof j === "object" ? (j as { files?: unknown }).files : null;
        const list = Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string") : [];
        return makeIndex(list, true);
      })
      .catch(() => makeIndex([], true))
      .then((index) => {
        publish(index);
        return index;
      });
  }
  return pending;
}

/** Il manifesto come è adesso (vuoto finché non arriva). */
export function media(): MediaIndex {
  return current;
}

export function has(path: string): boolean {
  return current.has(path);
}

export function mediaUrl(path: string): string {
  return BASE + normalize(path);
}

/** Lo sfondo di una città: video e immagine per il cielo e l'orientamento, o null se non ci sono. */
export function cityMedia(id: string, sky: SkyState, orientation: Orientation, index: MediaIndex = current): CityMedia | null {
  // il crepuscolo è l'ora blu: le foto notturne, con le luci accese e il cielo ancora blu, gli somigliano
  const variant = sky === "giorno" ? "day" : "night";
  const order: Orientation[] = orientation === "v" ? ["v", "h"] : ["h", "v"];
  for (const o of order) {
    const base = `city/${id}-${variant}-${o}`;
    const video = index.has(`${base}.mp4`) ? index.url(`${base}.mp4`) : null;
    const image = index.has(`${base}.jpg`) ? index.url(`${base}.jpg`) : null;
    if (video || image) return { video, image, variant, orientation: o };
  }
  return null;
}

/** Un effetto sonoro (S01…S11) se il manifesto lo elenca. */
export function sfx(id: SfxId | string, index: MediaIndex = current): string | null {
  const path = `sfx/${id}.mp3`;
  return index.has(path) ? index.url(path) : null;
}

/** L'ambiente sonoro di un luogo (torino, al-quds, gaza, battir, notte, …) se il manifesto lo elenca. */
export function amb(id: string, index: MediaIndex = current): string | null {
  const path = `amb/${id}.mp3`;
  return index.has(path) ? index.url(path) : null;
}

/** Una texture (T01…T06) se il manifesto la elenca. */
export function texture(id: string, index: MediaIndex = current): string | null {
  const path = `tex/${id}.jpg`;
  return index.has(path) ? index.url(path) : null;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getServerSnapshot = () => EMPTY;
const getSnapshot = () => current;

/** Hook: il manifesto, che si aggiorna quando arriva. Chiede il caricamento al primo uso. */
export function useMedia(): MediaIndex {
  const index = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void loadMedia();
  }, []);
  return index;
}
