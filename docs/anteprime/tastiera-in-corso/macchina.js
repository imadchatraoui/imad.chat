/* macchina.js — la macchina da scrivere di Dot, pezzo per pezzo: ogni parte è un oggetto a sé (o un'istanza), così la
   storia (racconto.js) la può far volare dalla scatola, posare in ordine sul banco e montare al suo posto.
   Coordinate della macchina: origine al centro dell'impronta, x a destra, z verso chi scrive; nel mondo vale MS.s e sta
   a z = MS.z. Leggera: martelletti, leve, tasti, viti, manopole e bobine sono istanze (una chiamata di disegno a famiglia);
   i pezzi di più sostanze sono una geometria sola (forme.js matMisto). */
import * as THREE from 'three';
import { loft, tornio, sost, sposta, fondi, blocco, lamina, rettTondo, estruso, tubo, tela, trama, matMisto, TAU, lerp, sat, smooth, seg, hash } from './forme.js';

export const MS = { W: 29.5, D: 30, cima: 4.2, passo: 0.72, margine: 8.2, s: 0.9, z: 4.5, colonne: 24, campana: 19, linea: 1.25, L: 16, cima0: 2.2 };
export const SEG = { y: 3.3, z: -9.9, r: 3.6, L: 6.2, riposo: 0.35, batte: 2.19 };          /* l'arco dei perni; il martelletto a riposo e in battuta */
export const RULLO = { y: 7.6, z: -11.55, r: 1.652, f0: 0.276, f1: -Math.PI + 0.5 };        /* l'asse del rullo; dove il foglio si stacca (davanti, dietro) */
export const AVVOLTO = RULLO.r * (RULLO.f0 - RULLO.f1);                                     /* quanta carta sta attorno al rullo */
const RIGHE = [{ z: 4.9, y: 5.7, x0: -10.6, k: '1234567890-' }, { z: 6.95, y: 5.05, x0: -9.7, k: "qwertyuiop'" }, { z: 9.0, y: 4.4, x0: -9.2, k: 'asdfghjkl;:' }, { z: 11.05, y: 3.75, x0: -8.25, k: 'zxcvbnm,./' }];
const V = (x, y, z) => new THREE.Vector3(x, y, z), Q = (x = 0, y = 0, z = 0, o = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, o));
export const MW = (x, y, z, out = new THREE.Vector3()) => out.set(x * MS.s, y * MS.s, z * MS.s + MS.z);   /* dalla macchina al mondo */
const pezzo = (g, m, ombra = true) => { const o = new THREE.Mesh(g, m); o.castShadow = ombra; o.receiveShadow = true; return o; };

/* una famiglia di pezzi uguali: una sola chiamata di disegno; ogni pezzo ha posizione, giro, scala come un oggetto vero */
export class Istanze {
  constructor(geo, mat, n, ombra) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; this.mesh.castShadow = !!ombra; this.mesh.receiveShadow = true; this.px = []; this.m = new THREE.Matrix4(); this.v = new THREE.Vector3();
    for (let i = 0; i < n; i++) this.px.push({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), forma: new THREE.Vector3(1, 1, 1), visible: false, i });
  }
  scrivi() {
    for (const p of this.px) { if (p.visible) this.m.compose(p.position, p.quaternion, this.v.copy(p.scale).multiply(p.forma)); else this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(p.i, this.m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ il carattere della macchina: disegnato a tratti, col codice.
   Una cella è larga 10 unità; la riga di base è y = 0, l'occhio medio 7, le aste 10,5, le code -3,5. Tratto unico, punte tonde,
   grazie a lastra come nelle macchine vere. M = vai, L = linea, Q = curva (controllo, arrivo), E = ellisse, D = punto. */
const GL = {
  a: 'M2.4 5.5Q3 7 5 7Q7.2 7 7.2 4.8L7.2 0L8.8 0M7.2 3.9Q4.6 4.3 3 3.6Q1.6 3 1.6 1.9Q1.6 0 3.9 0Q6 0 7.2 1.6', b: 'M1 10.5L2.6 10.5L2.6 0M1 0L2.6 0M2.6 4.8Q3.6 7 5.4 7Q8.5 7 8.5 3.5Q8.5 0 5.4 0Q3.6 0 2.6 2.2',
  c: 'M8.2 6.4L8.2 5.2Q7.4 7 5.2 7Q1.8 7 1.8 3.5Q1.8 0 5.2 0Q7.4 0 8.4 1.7', d: 'M5.8 10.5L7.4 10.5L7.4 0L9 0M7.4 4.8Q6.4 7 4.6 7Q1.5 7 1.5 3.5Q1.5 0 4.6 0Q6.4 0 7.4 2.2',
  e: 'M1.9 3.7L8.2 3.7Q8.2 7 5.1 7Q1.8 7 1.8 3.5Q1.8 0 5.2 0Q7.4 0 8.3 1.6', f: 'M2 0L6.6 0M3.9 0L3.9 8.2Q3.9 10.5 6.2 10.5Q7.6 10.5 8.3 9.7M1.8 7L7.4 7',
  g: 'M8.9 7L7.4 7L7.4 -1.2Q7.4 -3.5 4.9 -3.5Q3.4 -3.5 2.4 -2.9M7.4 4.8Q6.4 7 4.6 7Q1.5 7 1.5 3.6Q1.5 0.3 4.6 0.3Q6.4 0.3 7.4 2.4', h: 'M1 10.5L2.6 10.5L2.6 0M1.2 0L4 0M2.6 4.6Q3.8 7 5.6 7Q7.6 7 7.6 4.6L7.6 0M6.2 0L9 0',
  i: 'M3 7L5.2 7L5.2 0M2.2 0L8.2 0D5 10 0.95', j: 'M3.2 7L6.2 7L6.2 -1.2Q6.2 -3.5 3.9 -3.5Q2.6 -3.5 1.9 -2.8D6 10 0.95', k: 'M1 10.5L2.6 10.5L2.6 0M1.2 0L3.9 0M6.2 7L8.8 7M7.6 7L2.6 2.6M4.4 4.2L8 0M6.6 0L9 0',
  l: 'M3 10.5L5.2 10.5L5.2 0M2.2 0L8.2 0', m: 'M0.5 7L1.7 7L1.7 0M0.5 0L2.8 0M1.7 5.4Q2.4 7 3.6 7Q5 7 5 5.2L5 0M4.2 0L5.8 0M5 5.4Q5.7 7 6.9 7Q8.3 7 8.3 5.2L8.3 0M7.4 0L9.5 0',
  n: 'M1.2 7L2.6 7L2.6 0M1.2 0L4 0M2.6 4.6Q3.8 7 5.6 7Q7.6 7 7.6 4.6L7.6 0M6.2 0L9 0', o: 'E5 3.5 3.4 3.5', p: 'M1 7L2.6 7L2.6 -3.5M1 -3.5L4.4 -3.5M2.6 4.8Q3.6 7 5.4 7Q8.5 7 8.5 3.5Q8.5 0 5.4 0Q3.6 0 2.6 2.2',
  q: 'M9 7L7.4 7L7.4 -3.5M5.6 -3.5L9 -3.5M7.4 4.8Q6.4 7 4.6 7Q1.5 7 1.5 3.5Q1.5 0 4.6 0Q6.4 0 7.4 2.2', r: 'M2 7L3.8 7L3.8 0M2 0L6.6 0M3.8 4.4Q4.8 7 7 7Q8.2 7 8.6 6',
  s: 'M7.9 6.6L7.9 5.4Q7.4 7 5 7Q2.3 7 2.3 5.2Q2.3 3.9 5 3.5Q8 3.1 8 1.8Q8 0 5 0Q2.4 0 1.9 1.7L1.9 0.4', t: 'M3.6 9.6L3.6 1.8Q3.6 0 5.6 0Q7.4 0 8.4 1.2M1.6 7L7.6 7',
  u: 'M1 7L2.6 7L2.6 2.4Q2.6 0 4.6 0Q6.4 0 7.4 2.2M5.8 7L7.4 7L7.4 0L9 0', v: 'M0.8 7L3.4 7M6.6 7L9.2 7M1.9 7L5 0L8.1 7', w: 'M0.3 7L2.4 7M7.6 7L9.7 7M1.2 7L3 0L5 5L7 0L8.8 7',
  x: 'M1 7L3.4 7M6.6 7L9 7M1 0L3.4 0M6.6 0L9 0M2 7L8 0M8 7L2 0', y: 'M0.8 7L3.4 7M6.6 7L9.2 7M1.9 7L5.1 0.2M8.1 7L4.4 -1.6Q3.6 -3.5 2.2 -3.5L1.4 -3.5', z: 'M2.2 5.6L2.2 7L7.8 7L2 0L8 0L8 1.5',
  0: 'E5 5 3.1 5', 1: 'M2.6 8L5.2 10L5.2 0M2.2 0L8.2 0', 2: 'M2 7.6Q2.2 10 5 10Q7.9 10 7.9 7.4Q7.9 5.6 5.6 3.8L1.9 0.4L1.9 0L8.1 0L8.1 1.2', 3: 'M2.1 8.4Q2.8 10 5 10Q7.7 10 7.7 7.6Q7.7 5.4 4.6 5.4Q8.1 5.4 8.1 2.7Q8.1 0 5 0Q2.6 0 1.8 1.8',
  4: 'M4.8 0L8.3 0M6.6 0L6.6 10L1.6 3.2L8.6 3.2', 5: 'M7.6 10L2.8 10L2.5 5.6Q3.6 6.6 5.2 6.6Q8.1 6.6 8.1 3.3Q8.1 0 5 0Q2.7 0 1.8 1.7', 6: 'M7.6 9.4Q6.6 10 5.6 10Q2 10 2 4.4Q2 0 5.1 0Q8.1 0 8.1 3.1Q8.1 6 5.2 6Q3 6 2 4.2',
  7: 'M1.9 8.6L1.9 10L8 10L4.6 0', 8: 'E5 7.6 2.6 2.4E5 2.7 3.1 2.7', 9: 'M2.4 0.6Q3.4 0 4.4 0Q8 0 8 5.6Q8 10 4.9 10Q1.9 10 1.9 6.9Q1.9 4 4.8 4Q7 4 8 5.8',
  '.': 'D5 0.95 1.05', ',': 'D5 0.95 1.05M5.7 0.6Q5.7 -1.4 4.1 -2.2', ';': 'D5 5.6 1.05D5 0.95 1.05M5.7 0.6Q5.7 -1.4 4.1 -2.2', ':': 'D5 5.6 1.05D5 0.95 1.05', "'": 'M5 10.5L5 7.6', '-': 'M2.4 3.9L7.6 3.9', '/': 'M8 11L2 -1.5',
  S: 'M7.9 9.4L7.9 7.9Q7.4 10 5 10Q2.1 10 2.1 7.6Q2.1 5.7 5 5.1Q8.1 4.5 8.1 2.5Q8.1 0 5 0Q2.3 0 1.8 2.2L1.8 0.6'
};
const GLP = {};
function glifo(c, ch, x0, y0, k) {
  let p = GLP[ch]; if (!p) { const s = GL[ch]; if (!s) return; p = GLP[ch] = s.match(/[MLQED][^MLQED]*/g).map((q) => [q[0], ...q.slice(1).trim().split(/\s+/).map(Number)]); }
  const X = (x) => x0 + x * k, Y = (y) => y0 - y * k; c.beginPath();
  for (const q of p) {
    if (q[0] === 'M') c.moveTo(X(q[1]), Y(q[2])); else if (q[0] === 'L') c.lineTo(X(q[1]), Y(q[2])); else if (q[0] === 'Q') c.quadraticCurveTo(X(q[1]), Y(q[2]), X(q[3]), Y(q[4]));
    else if (q[0] === 'E') { c.moveTo(X(q[1] + q[3]), Y(q[2])); c.ellipse(X(q[1]), Y(q[2]), q[3] * k, q[4] * k, 0, 0, TAU); }
    else { c.stroke(); c.beginPath(); c.arc(X(q[1]), Y(q[2]), q[3] * k, 0, TAU); c.fill(); c.beginPath(); }
  }
  c.stroke();
}
export const haGlifo = (ch) => !!GL[ch];

/* ------------------------------------------------------------------ tutti i pezzi */
export function creaMacchina(M) {
  const R = {}, misto = matMisto(), S = (g, n) => sost(g, n);
  const ferro = new THREE.MeshStandardMaterial({ color: 0x8a8e99, roughness: 0.34, metalness: 1 });
  /* ---- i tasti: dove stanno (44 con la lettera, 2 ovali, la barra a parte) */
  const T = []; RIGHE.forEach((f, r) => f.k.split('').forEach((ch, i) => T.push({ ch, x: f.x0 + i * 1.95, y: f.y - 0.45, z: f.z, riga: r, viva: 'imadcht.'.indexOf(ch) >= 0 })));
  T.slice().sort((a, b) => a.x - b.x).forEach((k, i) => { k.mart = i; });
  T.push({ ch: '', x: -10.75, y: 3.3, z: 11.05, riga: 3, largo: 1 }, { ch: '', x: 11.75, y: 3.3, z: 11.05, riga: 3, largo: 1 }); T.forEach((k, i) => { k.i = i; });
  R.tasti = T; R.tastoDi = {}; T.forEach((k) => { if (k.ch) R.tastoDi[k.ch] = k; }); R.BARRA = { x: 0.4, y: 2.8, z: 12.8 };
  /* ---- la base: una vasca smaltata con due pozzi veri (i tasti, il cesto); davanti scende. Sotto: fondo scuro, piedini, i due perni delle bobine */
  { const sh = new THREE.Shape(); rettTondo(sh, -MS.W / 2, -MS.D / 2, MS.W, MS.D, 3.4);
    const p1 = new THREE.Path(); rettTondo(p1, -12.8, -13.4, 25.6, 10, 1.5); const p2 = new THREE.Path(); rettTondo(p2, -10.3, -1.0, 20.6, 10.2, 1.2); sh.holes.push(p1, p2);
    const geo = estruso(sh, 3.7, 0.42, { bs: 3, cs: 7 }), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i); if (y > 1.4) P.setY(i, y - 1.25 * smooth(seg(z, 2.5, 15)) * sat((y - 1.4) / 1.6)); }
    geo.computeVertexNormals(); geo.translate(0, 0.5, 0); R.base = pezzo(geo, M.smalto);
    const sotto = [S(sposta(blocco(27.6, 0.4, 28, 2.6, 0.1, { n: 2, seg: 3 }), 0, 0.75, 0), 'nero')];
    for (const sx of [-1, 1]) { for (const sz of [-1, 1]) sotto.push(S(sposta(tornio([[0, 0], [0.95, 0, 1], [1.1, 0.12], [1.1, 0.5, 1], [0, 0.5]], { seg: 3 }), sx * 11.2, 0, sz * 11.6), 'gomma'));
      sotto.push(S(sposta(tornio([[0, 0], [1.7, 0, 1], [1.7, 0.75], [1.5, 0.95, 1], [0.34, 0.95, 1], [0.34, 2.0], [0.2, 2.2], [0, 2.2]], { seg: 4 }), sx * 11.6, MS.cima - 0.02, -3.9), 'ferro')); }
    R.base.add(pezzo(fondi(sotto), misto)); }
  /* ---- il telaio: due rotaie per il carrello, il pettine delle leve nel pozzo dei tasti, il letto dell'arco, il cuscino dove riposano i martelletti */
  { const arco = (r0, r1, a0, a1, h, y, cs) => { const sh = new THREE.Shape(); sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true); sh.closePath(); const g = estruso(sh, h, 0.06, { bs: 1, cs }); g.rotateY(Math.PI); g.translate(0, y, SEG.z); return g; };
    const p = [S(sposta(blocco(27.4, 0.34, 0.46, 0.1, 0.05, { n: 1, seg: 2 }), 0, MS.cima, -10.95), 'acciaio'), S(sposta(blocco(27.4, 0.34, 0.46, 0.1, 0.05, { n: 1, seg: 2 }), 0, MS.cima, -13.45), 'acciaio')];
    for (const sx of [-1, 1]) p.push(S(sposta(blocco(0.5, 0.5, 9.4, 0.12, 0.05, { n: 1, seg: 2 }), sx * 12.2, 1.15, 8.4), 'ferro'));
    p.push(S(sposta(blocco(24.8, 1.6, 0.34, 0.1, 0.05, { n: 1, seg: 2 }), 0, 1.15, 3.95), 'ferro'), S(sposta(blocco(24.8, 0.7, 0.34, 0.1, 0.05, { n: 1, seg: 2 }), 0, 1.15, 12.95), 'ferro'));
    p.push(S(arco(2.5, 4.7, 0, Math.PI, 1.25, 1.15, 12), 'ferro'), S(arco(8.6, 9.5, 0.2, Math.PI - 0.2, 2.8, 1.15, 14), 'ferro'), S(arco(8.55, 9.55, 0.2, Math.PI - 0.2, 0.42, 3.95, 14), 'gomma'));
    R.telaio = pezzo(fondi(p), misto); }
  /* ---- l'arco d'acciaio coi perni (il filo su cui stanno appesi i martelletti) */
  { const sh = new THREE.Shape(); sh.absarc(0, 0, SEG.r + 0.7, 0, Math.PI, false); sh.absarc(0, 0, SEG.r - 0.55, Math.PI, 0, true); sh.closePath();
    const a = estruso(sh, 1.0, 0.08, { bs: 2, cs: 14 }); a.rotateY(Math.PI); a.translate(0, -0.75, 0); a.deleteAttribute('uv');
    const filo = []; for (let i = 0; i <= 12; i++) { const an = (16 + i * 148 / 12) * Math.PI / 180; filo.push([SEG.r * Math.cos(an), 0, SEG.r * Math.sin(an)]); }
    R.segmento = pezzo(fondi([a, tubo(filo, 0.07, { n: 26, rs: 5 })]), ferro); R.segmentoP = V(0, SEG.y, SEG.z); }
  /* ---- le leve dei tasti: lamine d'acciaio stampate, lo stelo in su e il braccio che va indietro sotto il ponte (lungo 1: lo allunga la scala) */
  { const n = T.length + 2; R.leve = new Istanze(fondi([lamina(0.1, 1.05, 0.05, 0, -0.475, 0), lamina(0.1, 0.24, 1, 0, -0.94, -0.5)]), M.acciaio, n, false);
    R.leve.posto = []; T.forEach((k) => { R.leve.posto.push({ p: V(k.x, k.y, k.z), L: k.z - 3.5 }); }); for (const sx of [-1, 1]) R.leve.posto.push({ p: V(R.BARRA.x + sx * 5, R.BARRA.y, R.BARRA.z), L: R.BARRA.z - 3.5 });
    R.leve.px.forEach((p, i) => p.forma.set(1, 1, R.leve.posto[i].L)); }
  /* ---- i martelletti: una lama che s'inarca, l'occhio del perno, il blocchetto del carattere in punta. Origine: il perno; lunga verso +z */
  { const g = loft([{ y: -0.24, w: 0, d: 0 }, { y: -0.24, w: 0.17, d: 0.4, r: 0.1 }, { y: 0.22, w: 0.17, d: 0.4, r: 0.1 }, { y: 0.55, w: 0.1, d: 0.24, r: 0.04 }, { y: 3.0, w: 0.1, d: 0.22, r: 0.04, z: -0.16 }, { y: 5.45, w: 0.1, d: 0.24, r: 0.04 },
      { y: 5.6, w: 0.28, d: 0.52, r: 0.07, z: -0.1 }, { y: 6.2, w: 0.28, d: 0.52, r: 0.07, z: -0.1 }, { y: 6.2, w: 0, d: 0 }], { seg: 1, asse: 'z' });
    R.mart = new Istanze(g, M.acciaio, 44, false); R.mart.ang = (i) => (22 + i * 136 / 43) * Math.PI / 180;
    R.mart.perno = (i, out = new THREE.Vector3()) => { const a = R.mart.ang(i); return out.set(SEG.r * Math.cos(a), SEG.y, SEG.z + SEG.r * Math.sin(a)); };
    R.mart.giro = (i, alza, out = new THREE.Quaternion()) => out.setFromEuler(E.set(-alza, Math.PI / 2 - R.mart.ang(i), 0, 'YXZ')); }
  /* ---- le cime dei tasti: tonde, col bordo e la faccia a conca; la lettera viene da un atlante (una casella a tasto: scura con la lettera
          chiara, chiara con la lettera scura per quelli di imad.chat). Una sola chiamata di disegno. */
  { const SZ = 128, N = 8, at = tela(N * SZ, N * SZ), c = at.c, celle = {}; let n = 0; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const cella = (ch, viva) => { const id = (viva ? 'v' : 's') + ch; if (celle[id] != null) return celle[id]; const x = (n % N) * SZ, y = Math.floor(n / N) * SZ; c.fillStyle = viva ? '#fffcf6' : '#2c2d35'; c.fillRect(x, y, SZ, SZ);
      if (ch && ch !== '.') { c.fillStyle = viva ? '#1c1d26' : 'rgba(243,238,226,.92)'; c.font = (viva ? '800 ' : '700 ') + SZ * (viva ? 0.6 : 0.5) + 'px Manrope, sans-serif'; c.fillText(viva ? ch : ch.toUpperCase(), x + SZ / 2, y + SZ * (viva ? 0.68 : 0.67)); } return (celle[id] = n++); };
    const w = 1.56, geo = loft([{ y: 0, w: 0, d: 0, nouv: 1 }, { y: 0, w: w - 0.34, d: 1.22, r: 0.61, nouv: 1 }, { y: 0.07, w: w - 0.1, d: 1.46, r: 0.73 }, { y: 0.2, w: w, d: 1.56, r: 0.78 }, { y: 0.36, w: w, d: 1.56, r: 0.78 }, { y: 0.45, w: w - 0.08, d: 1.48, r: 0.74 },
      { y: 0.47, w: w - 0.22, d: 1.34, r: 0.67 }, { y: 0.43, w: w - 0.34, d: 1.22, r: 0.61 }, { y: 0.4, w: 0, d: 0 }], { seg: 4, uvW: 1.3, uvD: 1.3 });
    const ce = new Float32Array(T.length * 2); T.forEach((k, i) => { const q = cella(k.ch, k.viva); ce[i * 2] = (q % N) / N; ce[i * 2 + 1] = 1 - (Math.floor(q / N) + 1) / N; });
    geo.setAttribute('aCella', new THREE.InstancedBufferAttribute(ce, 2));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: trama(at.cv), roughness: 0.4 });
    mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCella;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vMapUv / ' + N + '.0 + aCella;'); };
    R.cime = new Istanze(geo, mat, T.length, true); R.cime.giro = Q(0.2, 0, 0); R.cime.px.forEach((p, i) => { if (T[i].largo) p.forma.set(1.73, 1, 1); });
    R.punto = pezzo(tornio([[0, 0], [0.3, 0, 1], [0.29, 0.06], [0.2, 0.13], [0, 0.16]], { seg: 3 }), M.oro, false);                 /* il punto d'oro sta sul tasto del punto */
    R.barra = pezzo(loft([{ y: 0, w: 0, d: 0 }, { y: 0, w: 13.4, d: 1.1, r: 0.5 }, { y: 0.1, w: 13.7, d: 1.36, r: 0.66 }, { y: 0.34, w: 13.7, d: 1.36, r: 0.66 }, { y: 0.47, w: 13.5, d: 1.16, r: 0.56 }, { y: 0.5, w: 13.1, d: 0.8, r: 0.4 }, { y: 0.5, w: 0, d: 0 }], { seg: 4 }), M.smalto); }
  /* ---- il carrello: corpo, fianchi, la tavola dove si appoggia il foglio, l'asta premicarta coi rullini, il righello */
  { const p = [S(sposta(blocco(30.6, 1.9, 4.9, 1.0, 0.3, { n: 2, seg: 4 }), 0, MS.cima + 0.3, -12.2), 'smalto')];
    for (const sx of [-1, 1]) p.push(S(sposta(blocco(1.5, 3.5, 4.5, 0.7, 0.3, { n: 2, seg: 4 }), sx * 14.4, MS.cima + 1.5, -12.1), 'smalto'), S(sposta(tornio([[0, -0.4], [0.3, -0.4, 1], [0.42, -0.34], [0.42, 0.34], [0.3, 0.4, 1], [0, 0.4]], { seg: 3 }), sx * 5.2, 10.7, -10.75, 0, 0, Math.PI / 2), 'gomma'));
    const tav = blocco(23.6, 0.12, 4.6, 0.4, 0.05, { n: 1, seg: 3 }); tav.rotateX(1.05); tav.translate(0, 9.4, -14.3); p.push(S(tav, 'smalto'));
    p.push(S(tubo([[-12.6, 6.6, -10.1], [-12.6, 10.7, -10.75], [12.6, 10.7, -10.75], [12.6, 6.6, -10.1]], 0.1, { dritto: true, raggio: 0.3, n: 36, rs: 5 }), 'acciaio'));
    const rig = blocco(23.2, 0.07, 0.62, 0.05, 0.02, { n: 1, seg: 1 }); rig.rotateX(0.5); rig.translate(0, 6.55, -9.72); p.push(S(rig, 'acciaio'));
    R.carrello = pezzo(fondi(p), misto); }
  /* ---- il rullo di gomma (gira sul suo asse: l'origine è l'asse) e le due manopole zigrinate, con un punto chiaro che fa vedere il giro */
  { R.rullo = pezzo(fondi([S(sposta(tornio([[0, -11.7], [1.2, -11.7, 1], [1.55, -11.6, 1], [1.55, 11.6, 1], [1.2, 11.7, 1], [0, 11.7]], { seg: 6 }), 0, 0, 0, 0, 0, Math.PI / 2), 'nero'),
      S(sposta(tornio([[0, -13.4], [0.3, -13.4, 1], [0.3, 13.4, 1], [0, 13.4]], { seg: 2 }), 0, 0, 0, 0, 0, Math.PI / 2), 'acciaio')]), misto); R.rulloP = V(0, RULLO.y, RULLO.z);
    const man = [[0, 0], [1.25, 0, 1], [1.5, 0.12]]; for (let i = 0; i < 4; i++) man.push([1.5, 0.2 + i * 0.25], [1.4, 0.26 + i * 0.25], [1.4, 0.34 + i * 0.25], [1.5, 0.4 + i * 0.25]); man.push([1.5, 1.2], [1.3, 1.34, 1], [0.5, 1.4], [0, 1.4]);
    const g = fondi([S(tornio(man, { seg: 5 }), 'nero'), S(sposta(tornio([[0, 0], [0.24, 0, 1], [0.2, 0.06], [0, 0.07]], { seg: 2 }), 0.86, 1.36, 0), 'crema')]); g.rotateZ(-Math.PI / 2);      /* l'asse lungo +x: la faccia guarda fuori */
    R.manopole = new Istanze(g, misto, 2, true); R.manopole.posto = [V(-15.3, RULLO.y, RULLO.z), V(15.3, RULLO.y, RULLO.z)]; R.manopole.giro = (i, a, out = new THREE.Quaternion()) => out.setFromEuler(E.set(a, i ? 0 : Math.PI, 0, 'YXZ')); }
  /* ---- la leva del ritorno: un tondino piegato e la paletta. Origine: il suo perno, sul fianco sinistro del carrello */
  { R.levaRit = pezzo(fondi([S(tubo([[0, 0, 0], [-1.3, 0.5, 1.1], [-2.0, 0.8, 2.9], [-2.1, 0.9, 4.9]], 0.13, { n: 22, rs: 5 }), 'acciaio'), S(sposta(blocco(0.9, 0.12, 2.0, 0.4, 0.05, { n: 1, seg: 3 }), -2.1, 0.86, 5.7, 0.05), 'acciaio'),
      S(sposta(tornio([[0, -0.25], [0.3, -0.25, 1], [0.3, 0.25, 1], [0, 0.25]], { seg: 3 }), 0, 0, 0), 'ferro')]), misto); R.levaRitP = V(-14.6, 7.0, -10.3); }
  /* ---- il campanello: una calotta d'acciaio sul bordo sinistro, col suo battente */
  { const p = []; for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; p.push([0.85 * Math.cos(a), 0.12 + 0.62 * Math.sin(a)]); }
    R.campana = pezzo(fondi([S(tornio([[0, 0], [0.5, 0, 1], [0.5, 0.1, 1], [0.8, 0.1, 1], ...p, [0.1, 0.78, 1], [0.1, 0.9], [0, 0.92]], { seg: 4 }), 'acciaio'), S(sposta(tornio([[0, 0], [0.16, 0.04], [0.2, 0.2], [0.14, 0.36], [0, 0.4]], { seg: 2 }), 1.05, 0.2, 0.2), 'nero')]), misto); R.campanaP = V(-13.75, 4.03, 5.0); }
  /* ---- le bobine (tre fori nel disco di sopra: si vede che girano), il nastro, la forcella che lo alza a ogni battuta */
  { const g = [S(tornio([[0, 0], [2.0, 0, 1], [2.02, 0.05], [2.0, 0.1, 1], [1.5, 0.1, 1], [1.5, 1.1, 1], [2.0, 1.1, 1], [2.02, 1.15], [2.0, 1.2, 1], [0.7, 1.2, 1], [0.7, 1.32, 1], [0.24, 1.32, 1], [0.24, 1.44, 1], [0, 1.44]], { seg: 5 }), 'ferro'),
      S(tornio([[1.5, 0.1], [1.72, 0.12, 1], [1.72, 1.08, 1], [1.5, 1.1]], { seg: 5 }), 'nero')];
    for (let i = 0; i < 3; i++) g.push(S(sposta(tornio([[0, 0], [0.3, 0, 1], [0.3, 0.02], [0, 0.02]], { seg: 2 }), 1.25 * Math.cos(i * TAU / 3), 1.205, 1.25 * Math.sin(i * TAU / 3)), 'nero'));
    R.bobine = new Istanze(fondi(g), misto, 2, true); R.bobine.posto = [V(-11.6, MS.cima + 1.05, -3.9), V(11.6, MS.cima + 1.05, -3.9)];
    const via = new THREE.CatmullRomCurve3([[-10.3, 5.8, -5.5], [-7.4, 6.2, -7.7], [-3, 6.9, -9.3], [-0.8, 7.5, -9.74], [0.8, 7.5, -9.74], [3, 6.9, -9.3], [7.4, 6.2, -7.7], [10.3, 5.8, -5.5]].map((p) => V(p[0], p[1], p[2])), false, 'catmullrom', 0.3);
    const NN = 44, pos = new Float32Array((NN + 1) * 6), idx = [], pt = V(0, 0, 0), b0 = [];
    for (let i = 0; i <= NN; i++) { via.getPointAt(i / NN, pt); pos.set([pt.x, pt.y - 0.5, pt.z, pt.x, pt.y + 0.5, pt.z], i * 6); b0.push(pt.x, pt.y); if (i < NN) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ng.setIndex(idx); ng.computeVertexNormals();
    R.nastro = pezzo(ng, new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.7, side: THREE.DoubleSide }), false); R.nastro.frustumCulled = false;
    /* u = quanto nastro è steso (0..1, dalla bobina di sinistra); su = di quanto è alzato al punto di battuta (cm) */
    R.nastro.stendi = (u, su) => { ng.setDrawRange(0, Math.round(sat(u) * NN) * 6); for (let i = 0; i <= NN; i++) { const d = su * smooth(sat(1 - Math.abs(b0[i * 2]) / 2.6)); pos[i * 6 + 1] = b0[i * 2 + 1] - 0.5 + d; pos[i * 6 + 4] = b0[i * 2 + 1] + 0.5 + d; } ng.attributes.position.needsUpdate = true; };
    R.nastro.punto = (u, out) => via.getPointAt(sat(u), out);
    R.forcella = pezzo(fondi([lamina(0.12, 1.6, 0.1, -0.75, 7.1, -9.74), lamina(0.12, 1.6, 0.1, 0.75, 7.1, -9.74), lamina(1.62, 0.14, 0.1, 0, 6.36, -9.74), lamina(0.14, 1.5, 0.1, 0, 5.6, -9.74)]), M.acciaio, false); }
  /* ---- il cofano: una U attorno al cesto con i due fori delle bobine; scende verso i tasti. La targhetta è un pezzo a sé */
  { const sh = new THREE.Shape(), r = 2.3, X = 14.6, y0 = -2.6, y1 = 9.4;
    sh.moveTo(-X + r, y0); sh.lineTo(X - r, y0); sh.absarc(X - r, y0 + r, r, -Math.PI / 2, 0, false); sh.lineTo(X, y1 - 0.9); sh.absarc(X - 0.9, y1 - 0.9, 0.9, 0, Math.PI / 2, false);
    sh.lineTo(10.2, y1); sh.absarc(10.2, y1 - 0.6, 0.6, Math.PI / 2, Math.PI, false); sh.absarc(0, y1 - 0.6, 9.6, 0, Math.PI, true); sh.absarc(-10.2, y1 - 0.6, 0.6, 0, Math.PI / 2, false);
    sh.lineTo(-X + 0.9, y1); sh.absarc(-X + 0.9, y1 - 0.9, 0.9, Math.PI / 2, Math.PI, false); sh.lineTo(-X, y0 + r); sh.absarc(-X + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    for (const sx of [-1, 1]) { const p = new THREE.Path(); p.absarc(sx * 11.6, 3.9, 2.2, 0, TAU, false); sh.holes.push(p); }
    const geo = estruso(sh, 3.1, 0.3, { bs: 3, cs: 12 }), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i); if (y > 0.5) P.setY(i, y - 1.15 * smooth(seg(z, -5, 2.6)) * sat((y - 0.5) / 2.2)); }
    geo.computeVertexNormals(); geo.translate(0, MS.cima, 0); R.cofano = pezzo(geo, M.smalto);
    const t = tela(420, 76); t.c.fillStyle = '#f6f1e6'; t.c.beginPath(); t.c.roundRect(2, 2, 416, 72, 18); t.c.fill(); t.c.strokeStyle = 'rgba(28,29,38,.34)'; t.c.lineWidth = 3; t.c.stroke();
    t.c.fillStyle = 'rgba(28,29,38,.86)'; t.c.font = '600 34px "Geist Mono", monospace'; t.c.textAlign = 'center'; t.c.textBaseline = 'middle'; t.c.fillText('imad.chat', 210, 40);
    R.targa = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.76).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: trama(t.cv), transparent: true, roughness: 0.45, alphaTest: 0.5 })); R.targa.receiveShadow = true;
    R.targaP = { p: V(0, MS.cima + 2.03, 2.0), q: Q(0.38, 0, 0) }; }
  /* ---- le viti: testa bombata col taglio (si vede che girano), gambo */
  { const g = fondi([S(tornio([[0, -0.9], [0.07, -0.9, 1], [0.1, -0.8], [0.1, -0.02, 1], [0.27, -0.02, 1], [0.31, 0.03], [0.27, 0.13], [0.13, 0.19], [0, 0.2]], { seg: 2 }), 'acciaio'), S(lamina(0.5, 0.05, 0.08, 0, 0.19, 0), 'nero')]);
    R.viti = new Istanze(g, misto, 9, false);
    R.viti.posto = [V(-12.9, MS.cima + 0.36, -10.95), V(12.9, MS.cima + 0.36, -13.45), V(-3.7, 3.57, -9.55), V(3.7, 3.57, -9.55), V(13.3, MS.cima + 0.36, -10.95), V(-12.6, 6.22, 1.4), V(12.6, 6.22, 1.4), V(13.3, 7.32, -8.3), V(-13.3, 7.32, -8.3)]; }
  /* ---- il foglio: una striscia che segue la sua via (su dietro al rullo, attorno al rullo, su davanti). fuori = centimetri usciti davanti */
  { const NX = 8, NY = 44, L = MS.L, fg = new THREE.PlaneGeometry(21, L, NX, NY), FP = fg.attributes.position, c0 = V(0, 0, 0), tg = V(0, 0, 0);
    const cur = new THREE.CatmullRomCurve3([[-9.96, 8.05], [-10.25, 9.6], [-11.0, 11.9], [-12.4, 15.0], [-14.3, 18.2], [-16.6, 21.2]].map((p) => V(0, p[1], p[0]))), lun = cur.getLength();
    const sB = Math.sin(RULLO.f1), cB = Math.cos(RULLO.f1), by = RULLO.y + RULLO.r * sB, bz = RULLO.z + RULLO.r * cB;
    const tf = tela(1024, 780), tt = trama(tf.cv, { aniso: 16 }); R.cartaPx = 1024 / 21;
    R.foglio = pezzo(fg, new THREE.MeshStandardMaterial({ color: 0xffffff, map: tt, roughness: 0.9, side: THREE.DoubleSide })); R.foglio.frustumCulled = false; let ult = null;
    R.foglio.posa = (fuori) => { if (fuori === ult) return; ult = fuori;
      for (let j = 0; j <= NY; j++) { const s = fuori - (j / NY) * L; let y, z;
        if (s >= 0) { if (s <= lun) cur.getPointAt(s / lun, c0); else { cur.getPointAt(1, c0); cur.getTangentAt(1, tg); c0.addScaledVector(tg, s - lun); } y = c0.y; z = c0.z; }
        else if (s > -AVVOLTO) { const f = RULLO.f0 + s / RULLO.r; y = RULLO.y + RULLO.r * Math.sin(f); z = RULLO.z + RULLO.r * Math.cos(f); }
        else { const d = -s - AVVOLTO; y = by - d * cB; z = bz + d * sB; }
        for (let i = 0; i <= NX; i++) { const n = j * (NX + 1) + i, x = FP.getX(n); FP.setXYZ(n, x, y, z - 0.12 * (x / 10.5) * (x / 10.5) * sat((s + AVVOLTO + 2) / 6)); } }
      FP.needsUpdate = true; fg.computeVertexNormals(); };
    /* la scritta: righe = le righe battute fin qui; fantasma = la riga nostra, più chiara, finché nessuno scrive */
    let chiave = null;
    R.scrivi = (righe, fantasma) => { const k = righe.join('\n') + '|' + (fantasma || ''); if (k === chiave) return; chiave = k;
      const c = tf.c, px = R.cartaPx, ku = MS.passo * px / 10; c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, 1024, 780);
      for (let i = 0; i < 260; i++) { c.fillStyle = 'rgba(120,110,90,' + (0.02 + 0.03 * hash(i * 3.1)).toFixed(3) + ')'; c.fillRect(hash(i) * 1024, hash(i + 500) * 780, 1 + 3 * hash(i + 90), 1); }       /* le fibre della carta */
      c.lineCap = 'round'; c.lineJoin = 'round';
      const riga = (s, j, alfa) => { for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === ' ') continue; const h1 = hash(i * 7.3 + j * 31.7), h2 = hash(i * 3.9 + j * 17.1 + 5), a = alfa * (0.74 + 0.24 * h1);
        const x = (10.5 - MS.margine + (i - 0.5) * MS.passo) * px + (h2 - 0.5) * 1.6, y = (MS.cima0 + j * MS.linea) * px + (h1 - 0.5) * 2.2;
        c.strokeStyle = c.fillStyle = 'rgba(26,27,38,' + a.toFixed(2) + ')'; c.lineWidth = ku * (1.25 + 0.3 * h2); glifo(c, ch, x, y, ku);
        c.strokeStyle = 'rgba(26,27,38,' + (a * 0.22).toFixed(2) + ')'; c.lineWidth = ku * 2.1; glifo(c, ch, x + 0.4, y + 0.3, ku); } };       /* l'inchiostro sbava un filo */
      if (fantasma) riga(fantasma, 0, 0.36); righe.forEach((s, j) => riga(s, j, 1)); tt.needsUpdate = true; };
    R.foglio.posa(MS.cima0); R.scrivi([], ''); }
  /* ---- gli attrezzi di Dot, ognuno un pezzo solo; modellati lungo y con la punta in basso (y = 0), tranne il martello */
  { const A = {};
    A.cacciavite = pezzo(fondi([S(tornio([[0, 0], [0.03, 0, 1], [0.07, 0.2], [0.1, 0.5], [0.1, 3.2, 1], [0.2, 3.2, 1], [0.24, 3.3], [0.24, 3.5], [0, 3.5]], { seg: 3 }), 'acciaio'),
      S(tornio([[0, 3.45], [0.3, 3.45, 1], [0.5, 3.7], [0.56, 4.0], [0.56, 4.5], [0.5, 4.56], [0.5, 4.7], [0.56, 4.76], [0.56, 5.3], [0.5, 5.36], [0.5, 5.5], [0.56, 5.56], [0.58, 6.6], [0.54, 6.76, 1], [0, 6.78]], { seg: 4 }), 'grafite'),
      S(tornio([[0, 6.76], [0.44, 6.76, 1], [0.56, 6.84], [0.57, 7.14], [0.5, 7.36], [0.3, 7.48], [0, 7.5]], { seg: 4 }), 'smalto')]), misto); A.cacciavite.userData = { r0: 0.58, len: 7.5 };
    /* il martello: la faccia che batte è l'origine e guarda -x; la testa va verso +x, il manico sale lungo +y dal mezzo della testa */
    A.martello = pezzo(fondi([S(sposta(tornio([[0, 0], [0.5, 0, 1], [0.58, 0.08], [0.58, 0.62], [0.46, 0.76], [0.46, 1.5], [0.56, 1.62], [0.56, 1.9], [0.34, 2.36], [0.14, 2.42, 1], [0, 2.42]], { seg: 4 }), 0, 0, 0, 0, 0, -Math.PI / 2), 'acciaio'),
      S(sposta(tornio([[0, 0.3], [0.2, 0.3, 1], [0.2, 2.4], [0.24, 2.6, 1], [0, 2.6]], { seg: 3 }), 1.12, 0, 0), 'ferro'),
      S(sposta(tornio([[0, 2.55], [0.26, 2.55, 1], [0.3, 2.7], [0.27, 4.2], [0.3, 5.6], [0.36, 6.2], [0.37, 6.8], [0.3, 7.02, 1], [0, 7.04]], { seg: 4 }), 1.12, 0, 0), 'smalto')]), misto); A.martello.userData = { r0: 0.58, len: 7.04, testa: 1.12 };
    A.oliatore = pezzo(fondi([S(tornio([[0, 0], [0.035, 0, 1], [0.05, 0.1], [0.1, 2.3], [0.17, 2.5, 1], [0, 2.5]], { seg: 3 }), 'acciaio'),
      S(tornio([[0, 2.45], [0.2, 2.45, 1], [0.52, 2.9], [0.64, 3.4], [0.64, 4.9], [0.58, 5.08, 1], [0, 5.1]], { seg: 5 }), 'smalto'), S(tornio([[0, 5.06], [0.32, 5.06, 1], [0.32, 5.36, 1], [0.4, 5.42], [0.4, 5.8], [0.3, 5.9], [0, 5.92]], { seg: 4 }), 'grafite')]), misto); A.oliatore.userData = { r0: 0.64, len: 5.92 };
    { const sh = new THREE.Shape(); sh.moveTo(-0.2, 0); sh.quadraticCurveTo(-0.32, 0.04, -0.32, 0.35); sh.lineTo(-0.29, 2.2); sh.lineTo(-0.14, 5.2); sh.lineTo(-0.03, 7.8); sh.lineTo(0.03, 7.8); sh.lineTo(0.14, 5.2); sh.lineTo(0.29, 2.2); sh.lineTo(0.32, 0.35); sh.quadraticCurveTo(0.32, 0.04, 0.2, 0); sh.closePath();
      const lama = () => { const l = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 3 }); l.deleteAttribute('uv'); l.translate(0, 0, -0.02); return l; };
      const a = lama(), b = lama(); a.rotateX(0.03); a.translate(0, 0, 0.05); b.rotateX(-0.03); b.translate(0, 0, -0.05); const g = fondi([S(a, 'acciaio'), S(b, 'acciaio')]); g.rotateZ(Math.PI); g.translate(0, 7.8, 0);
      A.pinzette = pezzo(g, misto); A.pinzette.userData = { r0: 0.1, len: 7.8, piatto: true }; }
    A.pennello = pezzo(fondi([S(loft([{ y: 0, w: 0, d: 0 }, { y: 0.02, w: 0.9, d: 0.16, r: 0.08 }, { y: 0.4, w: 0.96, d: 0.26, r: 0.11 }, { y: 1.7, w: 0.78, d: 0.3, r: 0.13, sharp: 1 }, { y: 1.7, w: 0, d: 0 }], { seg: 2 }), 'setola'),
      S(loft([{ y: 1.62, w: 0, d: 0 }, { y: 1.62, w: 0.82, d: 0.34, r: 0.15, sharp: 1 }, { y: 1.9, w: 0.85, d: 0.36, r: 0.16 }, { y: 2.5, w: 0.78, d: 0.34, r: 0.16, sharp: 1 }, { y: 2.5, w: 0, d: 0 }], { seg: 2 }), 'acciaio'),
      S(loft([{ y: 2.46, w: 0, d: 0 }, { y: 2.46, w: 0.7, d: 0.28, r: 0.13, sharp: 1 }, { y: 4.0, w: 0.48, d: 0.36, r: 0.17 }, { y: 5.8, w: 0.4, d: 0.38, r: 0.19 }, { y: 7.4, w: 0.46, d: 0.42, r: 0.2 }, { y: 7.8, w: 0.3, d: 0.28, r: 0.13 }, { y: 7.86, w: 0, d: 0 }], { seg: 3 }), 'smalto')]), misto); A.pennello.userData = { r0: 0.19, len: 7.86, piatto: true };
    R.att = A; }
  /* ---- il bicchiere di tè (tre chiamate invece di sei) e il piattino delle viti */
  { const g = new THREE.Group(), H = 1.75, fo = [S(tornio([[0.488, H - 0.34], [0.5, H - 0.335], [0.512, H - 0.27], [0.507, H - 0.265, 1], [0.495, H - 0.27], [0.488, H - 0.34]], { seg: 4 }), 'ottone')];
    const v = new THREE.Mesh(tornio([[0, 0], [0.34, 0, 1], [0.36, 0.03], [0.36, 0.2], [0.4, 0.6], [0.5, H - 0.03], [0.5, H, 1], [0.465, H, 1], [0.37, 0.62], [0.32, 0.26], [0.3, 0.2, 1], [0, 0.2]], { seg: 5 }), M.vetroBicchiere); v.renderOrder = 6; v.castShadow = true;
    const te = new THREE.Mesh(tornio([[0, 0], [0.29, 0, 1], [0.315, 0.06], [0.36, 0.42], [0.44, 1.0, 1], [0, 1.0]], { seg: 5 }), M.te); te.position.y = 0.2; te.renderOrder = 5;
    for (let i = 0; i < 3; i++) { const f = loft([{ y: 0, w: 0, d: 0 }, { y: 0.02, w: 0.1, d: 0.05, r: 0.025 }, { y: 0.2, w: 0.3, d: 0.07, r: 0.035 }, { y: 0.42, w: 0.16, d: 0.05, r: 0.025 }, { y: 0.5, w: 0, d: 0 }], { seg: 1 }); f.rotateX(0.5 - i * 0.2); f.rotateY(i * 2.2); f.translate(0.12 * Math.cos(i * 2.2), 1.1, 0.12 * Math.sin(i * 2.2)); fo.push(S(f, 'menta')); }
    const foglie = pezzo(fondi(fo), misto, false); g.add(te, foglie, v);
    g.userData = { H, livello(q) { const s = Math.max(0.03, q); te.scale.set(0.82 + 0.18 * s, s, 0.82 + 0.18 * s); te.visible = q > 0.02; } }; R.bicchiere = g;
    R.piattino = pezzo(tornio([[0, 0], [1.1, 0, 1], [1.5, 0.08], [1.72, 0.3], [1.78, 0.46], [1.72, 0.5, 1], [1.62, 0.44], [1.46, 0.24], [1.15, 0.14], [0, 0.12]], { seg: 5 }), M.grafite); }
  R.tutti = () => [R.base, R.telaio, R.segmento, R.leve.mesh, R.mart.mesh, R.cime.mesh, R.punto, R.barra, R.carrello, R.rullo, R.manopole.mesh, R.levaRit, R.campana, R.bobine.mesh, R.nastro, R.forcella, R.cofano, R.targa, R.viti.mesh, R.foglio, R.bicchiere, R.piattino, ...Object.values(R.att)];
  R.famiglie = [R.leve, R.mart, R.cime, R.manopole, R.bobine, R.viti];
  return R;
}
const E = new THREE.Euler();
void lerp;
