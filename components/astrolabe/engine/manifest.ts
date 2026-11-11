// Le immagini, gli ornamenti e i video generati arriveranno in public/media/ ed elencati in
// public/media/manifest.json ({ files: [percorsi relativi] }). Senza manifesto tutto è procedurale.

export interface MediaManifest {
  files: Set<string>;
  has(path: string): boolean;
  url(path: string): string;
  /** Il primo dei percorsi che esiste, o null. */
  first(...paths: string[]): string | null;
}

const BASE = "/media/";
let cache: Promise<MediaManifest> | null = null;

function make(files: string[]): MediaManifest {
  const set = new Set(files.map((f) => f.replace(/^\.?\/*/, "").replace(/^media\//, "")));
  return {
    files: set,
    has: (p) => set.has(p),
    url: (p) => BASE + p,
    first: (...paths) => paths.find((p) => set.has(p)) ?? null,
  };
}

export const EMPTY_MANIFEST = make([]);

/** Legge il manifesto una volta sola; se manca o è rotto, nessun asset. */
export function loadManifest(): Promise<MediaManifest> {
  if (typeof window === "undefined") return Promise.resolve(EMPTY_MANIFEST);
  if (!cache) {
    cache = fetch(BASE + "manifest.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((j: unknown) => {
        const files = (j && typeof j === "object" && Array.isArray((j as { files?: unknown }).files)
          ? ((j as { files: unknown[] }).files.filter((f) => typeof f === "string") as string[])
          : []) as string[];
        return make(files);
      })
      .catch(() => EMPTY_MANIFEST);
  }
  return cache;
}

/** Carica un'immagine dal manifesto, o null se non c'è o non si carica. */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
