/* forme.js — gli attrezzi per modellare i pezzi: niente scatole né cilindri nudi.
   Tutto nasce da tre gesti: il «loft» (una pelle tesa tra anelli a rettangolo arrotondato: tasti, gusci, manici, cupole),
   l'estruso con smusso (lastre con i fori veri) e il tubo lungo una curva (fili, molle, cavo).
   Unità: centimetri. y in alto, z verso chi guarda. */
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const seg = (t, a, b) => sat((t - a) / (b - a));
export const eOut = (u) => 1 - Math.pow(1 - u, 3);
export const eIn = (u) => u * u * u;
export const eIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const eBack = (u, s = 1.6) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
export const smooth = (u) => u * u * (3 - 2 * u);
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/* i punti di un rettangolo arrotondato (w × d, raggio r) nel piano xz */
function anello(w, d, r, sg) {
  r = Math.max(0, Math.min(r, w / 2, d / 2));
  const cx = w / 2 - r, cz = d / 2 - r, C = [[cx, cz], [-cx, cz], [-cx, -cz], [cx, -cz]], pts = [];
  for (let c = 0; c < 4; c++) for (let i = 0; i <= sg; i++) {
    const a = (c + i / sg) * Math.PI / 2;
    pts.push([C[c][0] + r * Math.cos(a), C[c][1] + r * Math.sin(a)]);
  }
  return pts;
}

/* loft: una pelle tra sezioni successive. Ogni sezione: { y, w, d, r, x, z, tilt (attorno a x: positivo alza il dietro),
   sharp (spigolo vivo: l'anello è doppio), c / c2 (colore del vertice, e dopo lo spigolo), nouv }.
   Una sezione con w = d = 0 chiude la pelle in un punto. L'ordine delle sezioni decide il verso: salendo lungo una parete
   esterna la faccia guarda fuori; scendendo lungo una parete interna guarda dentro (così un guscio cavo è una pelle sola).
   o.seg = segmenti per angolo; o.uvW, o.uvD = il rettangolo della faccia alta che riceve la scritta (uv 0..1), il resto
   della pelle cade sul bordo bianco della casella. o.asse = "z" stende la pelle lungo z (sezioni nel piano xy). */
export function loft(sez, o = {}) {
  const sg = o.seg || 5, M = 4 * (sg + 1), pos = [], uv = [], col = [], idx = [], rings = [];
  const haveC = sez.some((s) => s.c != null), cc = new THREE.Color();
  function emit(s, c) {
    const pts = anello(s.w, s.d, s.r == null ? 0 : s.r, sg), base = pos.length / 3, ct = Math.cos(s.tilt || 0), st = Math.sin(s.tilt || 0);
    for (let k = 0; k < M; k++) {
      const px = pts[k][0], pz = pts[k][1];
      pos.push(px + (s.x || 0), s.y - pz * st, pz * ct + (s.z || 0));
      if (o.uvW) { if (s.nouv) uv.push(0.04, 0.04); else uv.push(sat(px / o.uvW + 0.5) * 0.92 + 0.04, sat(0.5 - pz / o.uvD) * 0.92 + 0.04); }
      if (haveC) { cc.set(c == null ? 0xffffff : c); col.push(cc.r, cc.g, cc.b); }
    }
    rings.push(base); return base;
  }
  let prev = null;
  for (const s of sez) {
    let b = emit(s, s.c);
    if (prev != null) for (let k = 0; k < M; k++) { const k1 = (k + 1) % M; idx.push(prev + k, b + k, prev + k1, prev + k1, b + k, b + k1); }
    if (s.sharp) b = emit(s, s.c2 == null ? s.c : s.c2);
    prev = b;
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (o.uvW) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (haveC) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  /* i vertici che coincidono lungo un anello (le giunte degli angoli, i poli) prendono la stessa normale */
  const P = g.attributes.position, N = g.attributes.normal, same = (a, b) => Math.abs(P.getX(a) - P.getX(b)) + Math.abs(P.getY(a) - P.getY(b)) + Math.abs(P.getZ(a) - P.getZ(b)) < 1e-5;
  for (const base of rings) {
    let start = 0; while (start < M && same(base + start, base + (start + M - 1) % M)) start++;
    if (start >= M) start = 0;
    let k = 0;
    while (k < M) {
      const run = [base + (start + k) % M]; let j = k + 1;
      while (j < M + 1 && run.length < M && same(base + (start + j) % M, run[0])) { run.push(base + (start + j) % M); j++; }
      if (run.length > 1) {
        let nx = 0, ny = 0, nz = 0; for (const v of run) { nx += N.getX(v); ny += N.getY(v); nz += N.getZ(v); }
        const l = Math.hypot(nx, ny, nz) || 1; for (const v of run) N.setXYZ(v, nx / l, ny / l, nz / l);
      }
      k = j;
    }
  }
  if (o.asse === 'z') g.rotateX(Math.PI / 2);
  return g;
}

/* un solido di rivoluzione: profilo = [[raggio, y], ...] dal basso in alto; { s: true } dopo un punto = spigolo vivo */
export function tornio(prof, o = {}) {
  const sez = [];
  for (const p of prof) sez.push({ y: p[1], w: p[0] * 2, d: p[0] * 2, r: p[0], sharp: !!p[2], c: p[3], c2: p[4] });
  return loft(sez, { seg: o.seg || 8 });
}

/* colore uguale su tutta la geometria (per fondere pezzi di colore diverso in una sola geometria) */
export function tinta(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
export function sposta(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}
/* fonde più geometrie in una sola (non indicizzata): chi non ha il colore lo prende bianco, chi non ha le uv cade sul bordo bianco */
export function fondi(list) {
  const hasC = list.some((g) => g.attributes.color), hasUv = list.some((g) => g.attributes.uv), hasS = list.some((g) => g.attributes.aSost), out = [];
  for (let g of list) {
    if (g.index) g = g.toNonIndexed();
    if (hasC && !g.attributes.color) tinta(g, 0xffffff);
    if (hasS && !g.attributes.aSost) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a[i * 3 + 1] = 0.5; g.setAttribute('aSost', new THREE.BufferAttribute(a, 3)); }
    if (hasUv && !g.attributes.uv) { const n = g.attributes.position.count, a = new Float32Array(n * 2).fill(0.04); g.setAttribute('uv', new THREE.BufferAttribute(a, 2)); }
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(k === 'color' && hasC) && !(k === 'uv' && hasUv) && !(k === 'aSost' && hasS)) g.deleteAttribute(k);
    out.push(g);
  }
  return mergeGeometries(out, false);
}

/* una scatola smussata come loft (spigoli morbidi di raggio b, angoli in pianta di raggio r) */
export function blocco(w, h, d, r = 0.1, b = 0.04, o = {}) {
  const n = o.n || 3, sez = [{ y: 0, w: 0, d: 0 }];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; sez.push({ y: b - b * Math.cos(a), w: w - 2 * b + 2 * b * Math.sin(a), d: d - 2 * b + 2 * b * Math.sin(a), r: Math.max(0.001, r - b + b * Math.sin(a)) }); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; sez.push({ y: h - b + b * Math.sin(a), w: w - 2 * b + 2 * b * Math.cos(a), d: d - 2 * b + 2 * b * Math.cos(a), r: Math.max(0.001, r - b + b * Math.cos(a)) }); }
  sez.push({ y: h, w: 0, d: 0 });
  return loft(sez, { seg: o.seg || 4 });
}

/* un rettangolo arrotondato in una Shape/Path (coordinate della forma: x, y) */
export function rettTondo(p, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}
/* estruso verso l'alto: la forma è disegnata vista dall'alto (x, -z); spessore h, smusso b */
export function estruso(shape, h, b = 0.02, o = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: o.bs || 2, curveSegments: o.cs || 10 });
  g.translate(0, 0, b); g.rotateX(-Math.PI / 2);   /* (x, y, z) → (x, z, -y): la forma sta nel piano del pavimento, lo spessore sale */
  return g;
}

/* un tubo lungo una lista di punti (curva morbida) */
export function tubo(pts, r, o = {}) {
  const v = pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  const c = o.dritto ? polilinea(v, o.raggio || r * 3) : new THREE.CatmullRomCurve3(v, false, 'catmullrom', o.tens == null ? 0.5 : o.tens);
  const g = new THREE.TubeGeometry(c, o.n || Math.max(8, v.length * 10), r, o.rs || 8, false);
  if (o.tappi !== false) {   /* due calotte: un tubo aperto non è un pezzo finito */
    const a = c.getPointAt(0), b = c.getPointAt(1), ta = c.getTangentAt(0), tb = c.getTangentAt(1);
    const s0 = new THREE.SphereGeometry(r, o.rs || 8, 6); s0.translate(a.x, a.y, a.z); const s1 = new THREE.SphereGeometry(r, o.rs || 8, 6); s1.translate(b.x, b.y, b.z);
    void ta; void tb; return mergeGeometries([g.toNonIndexed(), s0.toNonIndexed(), s1.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; }), false);
  }
  return g;
}
/* una spezzata con i gomiti arrotondati */
export function polilinea(v, rag) {
  const path = new THREE.CurvePath();
  let a = v[0].clone();
  for (let i = 1; i < v.length; i++) {
    const p = v[i], last = i === v.length - 1;
    if (last) { path.add(new THREE.LineCurve3(a, p.clone())); break; }
    const d1 = p.clone().sub(a), d2 = v[i + 1].clone().sub(p), k = Math.min(rag, d1.length() * 0.45, d2.length() * 0.45);
    const e = p.clone().sub(d1.clone().normalize().multiplyScalar(k)), f = p.clone().add(d2.clone().normalize().multiplyScalar(k));
    path.add(new THREE.LineCurve3(a, e)); path.add(new THREE.QuadraticBezierCurve3(e, p.clone(), f)); a = f;
  }
  return path;
}
/* una molla: elica di raggio R, filo r, alta h, con giri */
export function molla(R, r, h, giri, o = {}) {
  class Elica extends THREE.Curve { getPoint(t, out = new THREE.Vector3()) { const a = t * giri * TAU; return out.set(R * Math.cos(a), t * h, R * Math.sin(a)); } }
  return new THREE.TubeGeometry(new Elica(), o.n || giri * 18, r, o.rs || 6, false);
}

/* una tela con il suo contesto, a densità k */
export function tela(w, h, k = 1) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); return { cv, c };
}
export function trama(cv, o = {}) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = o.lineare ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = o.aniso || 8; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; return t;
}

/* ------------------------------------------------------------------ più sostanze in un pezzo solo (una sola chiamata di disegno):
   il colore sta nei vertici, e con lui quanto è metallo, quanto è ruvido e quanto smalto ha sopra (aSost = metallo, ruvido, smalto). */
export const SOST = { smalto: [0xebe4d6, 0, 0.34, 0.55], acciaio: [0xd9dbe0, 1, 0.26, 0], ferro: [0x7c808b, 1, 0.38, 0], nero: [0x15161a, 0, 0.62, 0], gomma: [0x16171b, 0, 0.85, 0], grafite: [0x2c2d35, 0, 0.46, 0.15],
  ottone: [0xd8b56c, 1, 0.3, 0], crema: [0xf8f4eb, 0, 0.42, 0.3], inchiostro: [0x1c1d26, 0, 0.5, 0], rame: [0x8a6a4c, 1, 0.42, 0], setola: [0x2a2622, 0, 0.9, 0], menta: [0x4f9a4c, 0, 0.6, 0], rosso: [0xa8261d, 0, 0.5, 0.2] };
export function sost(g, nome) {
  const q = typeof nome === 'string' ? SOST[nome] : nome, n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = q[1]; a[i * 3 + 1] = q[2]; a[i * 3 + 2] = q[3]; }
  g.setAttribute('aSost', new THREE.BufferAttribute(a, 3)); return tinta(g, q[0]);
}
export function matMisto(o = {}) {
  const m = new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.22 }, o));
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aSost; varying vec3 vSost;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSost = aSost;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSost;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vSost.y;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vSost.x;').replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= vSost.z;');
  };
  return m;
}
/* una scatola leggera (12 triangoli): solo per lamine di un millimetro, dove uno smusso non si vedrebbe */
export function lamina(w, h, d, x = 0, y = 0, z = 0) { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.translate(x, y, z); return g; }
/* una molla che si spegne: per l'assestamento di un pezzo appena posato (tau = secondi da quando è arrivato) */
export const spegne = (tau, A, smorza, omega) => (tau < 0 || tau > smorza * 7 ? 0 : A * Math.exp(-tau / smorza) * Math.cos(tau * omega));
