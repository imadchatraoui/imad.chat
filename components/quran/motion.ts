// Il movimento delle pagine: solo transform e opacity, così corre sul compositore anche sui telefoni.
//
// Il libro è un mushaf: si apre da destra e si legge da destra a sinistra. Nella doppia pagina il
// foglio che gira è quello di sinistra, che passa sopra la piega e si posa a destra; sul telefono la
// pagina si solleva dal bordo sinistro e ruota sul dorso, che sta a destra.
//
// Ogni foglio che gira ha due facce, due elementi distinti sullo stesso piano: il fronte ruota di θ
// attorno alla piega, il retro di θ − 180°; backface-visibility nasconde quella girata dall'altra parte.
// Così le pagine restano gli stessi nodi del DOM prima, durante e dopo il giro (e il loro scroll).

export type Part = "front" | "back" | "under-in" | "under-out";

export type TurnGeo = { kind: "spread"; dir: 1 | -1 } | { kind: "single"; dir: 1 | -1 } | { kind: "fade" };

interface PartFrame {
  transform?: string;
  opacity?: number;
  /** l'ombra sulla faccia, da 0 a 1 */
  shade?: number;
}

type Frame = Partial<Record<Part, PartFrame>>;

const PARTS: readonly Part[] = ["front", "back", "under-in", "under-out"];

/** Quanto ruota la pagina sul telefono: un poco oltre il taglio, così sparisce del tutto. */
const SINGLE_MAX = 96;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Lo stato di ogni parte quando il giro è a p (0 = fermo prima, 1 = finito). */
export function frameAt(geo: TurnGeo, raw: number): Frame {
  const p = clamp01(raw);
  if (geo.kind === "spread") {
    const front = geo.dir === 1 ? 180 * p : -180 * p;
    const back = geo.dir === 1 ? 180 * p - 180 : 180 - 180 * p;
    return {
      front: { transform: `rotateY(${front.toFixed(3)}deg)`, shade: 0.32 * Math.min(1, p / 0.5) },
      back: { transform: `rotateY(${back.toFixed(3)}deg)`, shade: 0.32 * Math.min(1, (1 - p) / 0.5) },
      "under-in": { shade: 0.42 * Math.pow(1 - p, 1.5) },
      "under-out": { shade: 0.34 * p * p },
    };
  }
  if (geo.kind === "single") {
    const angle = geo.dir === 1 ? SINGLE_MAX * p : SINGLE_MAX * (1 - p);
    return {
      front: { transform: `rotateY(${angle.toFixed(3)}deg)`, shade: 0.3 * (angle / SINGLE_MAX) },
      "under-in": { shade: 0.38 * Math.pow(1 - p, 1.4) },
      "under-out": { shade: 0.32 * Math.pow(p, 1.6) },
    };
  }
  // movimento ridotto: una dissolvenza attraverso la carta bianca. Le pagine vecchie spariscono del
  // tutto prima che compaiano le nuove: due testi arabi non si sovrappongono mai, neanche per un attimo.
  return { front: { opacity: clamp01(1 - 2 * p) }, "under-in": { opacity: clamp01(2 * p - 1) } };
}

function partEls(book: HTMLElement, part: Part): HTMLElement[] {
  return Array.from(book.querySelectorAll<HTMLElement>(`[data-part="${part}"]`));
}

function shadeOf(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>(":scope > [data-shade]");
}

/** Mette subito le parti a p (per il trascinamento: niente animazioni, solo stili). */
export function applyFrame(book: HTMLElement, geo: TurnGeo, p: number): void {
  const f = frameAt(geo, p);
  for (const part of PARTS) {
    const v = f[part];
    if (!v) continue;
    for (const el of partEls(book, part)) {
      if (v.transform !== undefined) el.style.transform = v.transform;
      if (v.opacity !== undefined) el.style.opacity = String(v.opacity);
      const sh = shadeOf(el);
      if (sh && v.shade !== undefined) sh.style.opacity = v.shade.toFixed(3);
    }
  }
}

/** Toglie gli stili messi a mano da applyFrame (le animazioni si cancellano a parte). */
export function clearFrame(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-part]").forEach((el) => {
    el.style.transform = "";
    el.style.opacity = "";
    const sh = shadeOf(el);
    if (sh) sh.style.opacity = "";
  });
}

const STEPS = 12;

/**
 * Anima le parti lungo un percorso: path(t) dà il progresso p per t da 0 a 1.
 * I fotogrammi sono campionati, l'andamento nel tempo lo decide timing.easing.
 */
export function animatePath(book: HTMLElement, geo: TurnGeo, path: (t: number) => number, timing: KeyframeAnimationOptions): Animation[] {
  const frames = Array.from({ length: STEPS + 1 }, (_, k) => frameAt(geo, path(k / STEPS)));
  const anims: Animation[] = [];
  for (const part of PARTS) {
    const first = frames[0][part];
    if (!first) continue;
    for (const el of partEls(book, part)) {
      if (first.transform !== undefined) anims.push(el.animate(frames.map((f) => ({ transform: f[part]?.transform ?? "none" })), timing));
      if (first.opacity !== undefined) anims.push(el.animate(frames.map((f) => ({ opacity: f[part]?.opacity ?? 1 })), timing));
      const sh = shadeOf(el);
      if (sh && first.shade !== undefined) anims.push(sh.animate(frames.map((f) => ({ opacity: f[part]?.shade ?? 0 })), timing));
    }
  }
  return anims;
}

/** Da p0 a p1. */
export function animateFrames(book: HTMLElement, geo: TurnGeo, p0: number, p1: number, timing: KeyframeAnimationOptions): Animation[] {
  return animatePath(book, geo, (t) => p0 + (p1 - p0) * t, timing);
}

/**
 * Il volo del libro (FLIP): la trasformazione del contenitore `book` che porta il rettangolo `target`
 * (la copertina al suo posto nel libro aperto) sopra `dock` (la copertina del libro chiuso).
 */
export function flight(book: DOMRect, target: DOMRect, dock: DOMRect): { origin: string; transform: string } | null {
  if (!(target.width > 0 && target.height > 0 && dock.width > 0 && dock.height > 0)) return null;
  const ox = target.left - book.left;
  const oy = target.top - book.top;
  const sx = dock.width / target.width;
  const sy = dock.height / target.height;
  const dx = dock.left - target.left;
  const dy = dock.top - target.top;
  return {
    origin: `${ox.toFixed(2)}px ${oy.toFixed(2)}px`,
    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
  };
}

/** Tutte le animazioni finite (o annullate: in quel caso false). */
export function settled(anims: Animation[]): Promise<boolean> {
  return Promise.all(anims.map((a) => a.finished)).then(
    () => true,
    () => false,
  );
}

/** Quanto è girata la pagina per uno spostamento del dito di `d` px (sempre positivo). */
export function dragProgress(geo: TurnGeo, d: number, pageWidth: number): number {
  const w = Math.max(1, pageWidth);
  if (geo.kind === "spread") return clamp01(d / (1.25 * w));
  if (geo.kind === "single") {
    const x = Math.min(1, d / w);
    const max = (SINGLE_MAX * Math.PI) / 180;
    // il bordo della pagina segue il dito
    return geo.dir === 1 ? clamp01(Math.acos(1 - x) / max) : clamp01(1 - Math.acos(x) / max);
  }
  return clamp01(d / (0.8 * w));
}
