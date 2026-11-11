// Dal disegno alla forma: una sagoma dipinta su un canvas (rete traforata, trono, cavallo)
// diventa contorni chiusi con i loro fori, pronti per essere estrusi in ottone.
// Marching squares con interpolazione sul canale alfa, semplificazione Douglas-Peucker
// e annidamento contorno/fori per parità.

export type Loop = [number, number][];

export interface ShapeLoops {
  outer: Loop;
  holes: Loop[];
}

/** Traccia i contorni della zona con alfa >= soglia. Coordinate in pixel (y verso il basso). */
export function traceAlpha(alpha: Uint8Array, w: number, h: number, threshold = 128): Loop[] {
  const W = w + 2; // griglia con un bordo di zeri
  const H = h + 2;
  const pad = new Uint8Array(W * H);
  for (let j = 0; j < h; j++) pad.set(alpha.subarray(j * w, j * w + w), (j + 1) * W + 1);
  // bit "dentro" per ogni campione: così il caso di ogni cella si calcola senza rami
  const bit = new Uint8Array(W * H);
  for (let k = 0; k < pad.length; k++) bit[k] = pad[k] >= threshold ? 1 : 0;
  const points = new Map<number, [number, number]>();
  const links = new Map<number, number[]>();
  // i, j sono coordinate della griglia imbottita; il campione (i, j) è il pixel (i-1, j-1)
  const hKey = (i: number, j: number) => (j * W + i) * 2;
  const vKey = (i: number, j: number) => (j * W + i) * 2 + 1;
  const interp = (a: number, b: number) => (a === b ? 0.5 : (threshold - a) / (b - a));
  const pointH = (i: number, j: number, a: number, b: number) => {
    const k = hKey(i, j);
    if (!points.has(k)) points.set(k, [i - 0.5 + interp(a, b), j - 0.5]);
    return k;
  };
  const pointV = (i: number, j: number, a: number, b: number) => {
    const k = vKey(i, j);
    if (!points.has(k)) points.set(k, [i - 0.5, j - 0.5 + interp(a, b)]);
    return k;
  };
  const link = (k1: number, k2: number) => {
    const l1 = links.get(k1);
    if (l1) l1.push(k2);
    else links.set(k1, [k2]);
    const l2 = links.get(k2);
    if (l2) l2.push(k1);
    else links.set(k2, [k1]);
  };

  for (let j = 0; j < H - 1; j++) {
    const row = j * W;
    const next = row + W;
    for (let i = 0; i < W - 1; i++) {
      const code = (bit[row + i] << 3) | (bit[row + i + 1] << 2) | (bit[next + i + 1] << 1) | bit[next + i];
      if (code === 0 || code === 15) continue;
      const a = pad[row + i]; // in alto a sinistra
      const b = pad[row + i + 1]; // in alto a destra
      const c = pad[next + i + 1]; // in basso a destra
      const d = pad[next + i]; // in basso a sinistra
      const T = () => pointH(i, j, a, b);
      const B = () => pointH(i, j + 1, d, c);
      const L = () => pointV(i, j, a, d);
      const R = () => pointV(i + 1, j, b, c);
      switch (code) {
        case 1:
        case 14:
          link(L(), B());
          break;
        case 2:
        case 13:
          link(B(), R());
          break;
        case 3:
        case 12:
          link(L(), R());
          break;
        case 4:
        case 11:
          link(T(), R());
          break;
        case 6:
        case 9:
          link(T(), B());
          break;
        case 7:
        case 8:
          link(T(), L());
          break;
        case 5: {
          const center = (a + b + c + d) / 4 >= threshold;
          if (center) {
            link(T(), L());
            link(B(), R());
          } else {
            link(T(), R());
            link(L(), B());
          }
          break;
        }
        case 10: {
          const center = (a + b + c + d) / 4 >= threshold;
          if (center) {
            link(T(), R());
            link(L(), B());
          } else {
            link(T(), L());
            link(B(), R());
          }
          break;
        }
      }
    }
  }

  const loops: Loop[] = [];
  const visited = new Set<number>();
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const loop: Loop = [];
    let prev = -1;
    let cur = start;
    while (!visited.has(cur)) {
      visited.add(cur);
      loop.push(points.get(cur)!);
      const nb = links.get(cur)!;
      const next = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur;
      if (next === undefined) break;
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  const tt = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + tt * dx), p[1] - (a[1] + tt * dy));
}

function rdp(points: Loop, eps: number): Loop {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Semplifica un contorno chiuso. */
export function simplifyLoop(loop: Loop, eps: number): Loop {
  if (loop.length < 8) return loop;
  // spezza il contorno nei due punti più lontani tra loro (approssimati)
  let far = 0;
  let best = 0;
  for (let i = 0; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = rdp(loop.slice(0, far + 1), eps);
  const b = rdp([...loop.slice(far), loop[0]], eps);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  return out.length >= 3 ? out : loop;
}

export function signedArea(loop: Loop): number {
  let s = 0;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) s += (loop[j][0] - loop[i][0]) * (loop[j][1] + loop[i][1]);
  return s / 2;
}

function pointInLoop(p: [number, number], loop: Loop): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const xi = loop[i][0];
    const yi = loop[i][1];
    const xj = loop[j][0];
    const yj = loop[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Raggruppa i contorni in forme piene con i loro fori, per parità di annidamento. */
export function nestLoops(loops: Loop[], minArea = 4): ShapeLoops[] {
  const items = loops
    .map((l) => ({ loop: l, area: Math.abs(signedArea(l)) }))
    .filter((x) => x.area >= minArea)
    .sort((a, b) => b.area - a.area);
  const parent: number[] = items.map(() => -1);
  const depth: number[] = items.map(() => 0);
  for (let i = 0; i < items.length; i++) {
    const probe = items[i].loop[0];
    // il genitore è il più piccolo tra i più grandi che lo contiene
    for (let j = i - 1; j >= 0; j--) {
      if (pointInLoop(probe, items[j].loop)) {
        parent[i] = j;
        depth[i] = depth[j] + 1;
        break;
      }
    }
  }
  const shapes: ShapeLoops[] = [];
  const index = new Map<number, ShapeLoops>();
  items.forEach((it, i) => {
    if (depth[i] % 2 === 0) {
      const s = { outer: it.loop, holes: [] as Loop[] };
      index.set(i, s);
      shapes.push(s);
    }
  });
  items.forEach((it, i) => {
    if (depth[i] % 2 === 1 && parent[i] >= 0) index.get(parent[i])?.holes.push(it.loop);
  });
  return shapes;
}

/** Legge il canale alfa di un canvas. */
export function alphaOf(canvas: HTMLCanvasElement | OffscreenCanvas): { data: Uint8Array; w: number; h: number } {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h);
  for (let i = 0, k = 3; i < data.length; i++, k += 4) data[i] = img[k];
  return { data, w, h };
}

/** Dalla sagoma dipinta alle forme: contorni semplificati in unità del mondo. */
export function silhouetteToLoops(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  toWorld: (px: number, py: number) => [number, number],
  eps = 0.45,
): ShapeLoops[] {
  const { data, w, h } = alphaOf(canvas);
  const loops = traceAlpha(data, w, h).map((l) => simplifyLoop(l, eps));
  return nestLoops(loops).map((s) => ({
    outer: s.outer.map(([x, y]) => toWorld(x, y)),
    holes: s.holes.map((hl) => hl.map(([x, y]) => toWorld(x, y))),
  }));
}
