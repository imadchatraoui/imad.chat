/* parti.js — i pezzi della tastiera (65%, 68 tasti): guscio, scheda, piastra, viti, stabilizzatori, switch, tasti, cavo.
   Coordinate «del ponte»: origine al centro della tastiera sulla faccia alta della piastra, x a destra, z verso chi scrive. */
import * as THREE from 'three';
import { loft, tornio, tinta, sposta, fondi, blocco, rettTondo, estruso, tubo, molla, tela, trama, TAU, lerp, hash } from './forme.js';

export const U = 1.905;                       /* il passo di un tasto */
export const INCL = 0.105;                    /* l'inclinazione del ponte (6 gradi) */
export const CASSA = { W: 31.5, D: 10.55, R: 1.0, yb: -1.31, lip: 0.45, wall: 0.5, floor: -1.01 };
export const C = {
  crema: 0xf2ede2, cremaViva: 0xfffcf6, pietra: 0xd8cebb, grafite: 0x2c2d35, inchiostro: 0x1c1d26,
  oro: 0xe9a93c, oroChiaro: 0xfbe0a0, smalto: 0xebe4d6, notte: 0x141b40, acciaio: 0xd9dbe0, ottone: 0xd8b56c,
  swBase: 0x2e3038, swTop: 0x4b4e5a, stelo: 0xe3aa3e, gomma: 0x16171b, rosso: 0xd3261d
};

/* ------------------------------------------------------------------ i materiali (uno per sostanza) */
export function materiali() {
  const S = (o) => new THREE.MeshStandardMaterial(o), P = (o) => new THREE.MeshPhysicalMaterial(o);
  return {
    tasto: S({ color: C.crema, roughness: 0.5 }),                                   /* ceramica opaca, bianco caldo (i tasti del sito) */
    tastoVivo: S({ color: C.cremaViva, roughness: 0.42 }),
    pietra: S({ color: C.pietra, roughness: 0.52 }),
    grafite: S({ color: C.grafite, roughness: 0.46 }),
    smalto: P({ color: C.smalto, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22 }),   /* il guscio: smalto crema */
    scheda: S({ color: 0xffffff, roughness: 1, metalness: 1 }),                      /* la scheda: colore, ruvidità e metallo dalle trame */
    piastra: S({ color: 0xc8cad0, roughness: 0.36, metalness: 1 }),                  /* alluminio satinato */
    acciaio: S({ color: C.acciaio, roughness: 0.24, metalness: 1 }),
    acciaioCol: S({ color: 0xffffff, roughness: 0.3, metalness: 1, vertexColors: true }),
    ottone: S({ color: C.ottone, roughness: 0.3, metalness: 1 }),
    plastica: S({ color: 0xffffff, roughness: 0.5, vertexColors: true }),            /* switch, stabilizzatori: i colori stanno nei vertici */
    gomma: S({ color: C.gomma, roughness: 0.85 }),
    cavo: S({ color: 0xcfc5b2, roughness: 0.78 }),                                   /* la calza del cavo */
    oro: S({ color: C.oro, roughness: 0.28, emissive: 0xe9a93c, emissiveIntensity: 0.35 }),   /* il punto d'oro: l'unico oro */
    spia: S({ color: 0x3a3320, roughness: 0.3, emissive: 0xfbe0a0, emissiveIntensity: 0 }),
    carta: S({ color: 0xfbfaf4, roughness: 0.92, side: THREE.DoubleSide }),
    rosso: P({ color: C.rosso, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 }),
    vetroBicchiere: P({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.32, depthWrite: false }),
    te: S({ color: 0xc27a22, roughness: 0.12, transparent: true, opacity: 0.9 }),
    menta: S({ color: 0x4f9a4c, roughness: 0.6 })
  };
}

/* ------------------------------------------------------------------ la disposizione: 5 file, 16 unità, 68 tasti */
const riga = (s) => s.split('').map((ch) => [ch, 1, 'a']);
const SPECIALI = 'IMADCHT';
const FILE = [
  [['', 1, 'x'], ...riga('1234567890-='), ['', 2, 'm'], ['', 1, 'm']],
  [['', 1.5, 'm'], ...riga('QWERTYUIOP[]'), ['\\', 1.5, 'a'], ['', 1, 'm']],
  [['', 1.75, 'm'], ...riga("ASDFGHJKL;'"), ['', 2.25, 'x'], ['', 1, 'm']],
  [['', 2.25, 'm'], ...riga('ZXCVBNM,./'), ['', 1.75, 'm'], ['', 1, 'm'], ['', 1, 'm']],
  [['', 1.25, 'm'], ['', 1.25, 'm'], ['', 1.25, 'm'], ['', 6.25, 'sp'], ['', 1, 'm'], ['', 1, 'm'], ['', 1, 'm'], ['', 1, 'm'], ['', 1, 'm'], ['', 1, 'm']]
];
export const TASTI = [];
FILE.forEach((f, r) => {
  let cum = 0;
  f.forEach((k, i) => {
    let kind = k[2], leg = k[0];
    if (kind === 'a' && SPECIALI.indexOf(leg) >= 0) { kind = 's'; leg = leg.toLowerCase(); }
    if (leg === '.') kind = 'o';
    const code = kind === 'sp' ? ' ' : k[0] ? k[0].toLowerCase() : (r === 2 && k[1] === 2.25 ? 'enter' : r === 0 && k[1] === 2 ? 'backspace' : null);
    TASTI.push({ id: TASTI.length, row: r, col: i, n: f.length, w: k[1], kind, leg, code, x: (-8 + cum + k[1] / 2) * U, z: (r - 2) * U, stab: k[1] >= 6 ? 5.0 : k[1] >= 2 ? 1.19 : 0 });
    cum += k[1];
  });
});
export const tastoDi = (code) => TASTI.find((k) => k.code === code);
/* le otto lettere di imad.chat nell'ordine in cui vanno su (la «a» è una sola: si scrive due volte), il punto per ultimo */
export const ORDINE_NOME = ['i', 'm', 'a', 'd', 'c', 'h', 't'].map(tastoDi);
export const PUNTO = TASTI.find((k) => k.kind === 'o');
export const VITI = [-9.5, 0, 9.5].flatMap((x) => [[x, -1.5 * U], [x, 1.5 * U]]);   /* dove la scheda si avvita al guscio */

/* ------------------------------------------------------------------ le scritte dei tasti: un atlante solo */
export function atlante() {
  const N = 8, S = 160, { cv, c } = tela(N * S, N * S), celle = {};
  c.fillStyle = '#fff'; c.fillRect(0, 0, N * S, N * S); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  let n = 1;
  for (const k of TASTI) {
    if (!k.leg || k.kind === 'o') continue;
    const key = k.kind + k.leg; if (celle[key] != null) continue;
    const cx = (n % N) * S + S / 2, cy = Math.floor(n / N) * S + S / 2; celle[key] = n++;
    if (k.kind === 's') { c.font = '800 ' + S * 0.66 + 'px Manrope, sans-serif'; c.fillStyle = '#1c1d26'; c.fillText(k.leg, cx, cy + S * 0.2); }
    else { c.font = '700 ' + S * 0.44 + 'px Manrope, sans-serif'; c.fillStyle = 'rgba(28,29,38,.6)'; c.fillText(k.leg, cx, cy + S * 0.155); }
  }
  const base = trama(cv);
  return { base, cella(k) { const i = celle[k.kind + k.leg]; if (i == null) return null; const t = base.clone(); t.repeat.set(1 / N, 1 / N); t.offset.set((i % N) / N, 1 - (Math.floor(i / N) + 1) / N); t.needsUpdate = true; return t; } };
}

/* ------------------------------------------------------------------ il tasto: profilo scolpito per fila, faccia incavata, cavo sotto */
const PROFILO = [{ h: 1.0, t: 0.13 }, { h: 0.9, t: 0.06 }, { h: 0.84, t: -0.015 }, { h: 0.87, t: -0.09 }, { h: 0.89, t: -0.11 }];
const cacheCap = {};
export function geoTasto(wu, row, kind) {
  const key = wu + ':' + row + ':' + (kind === 'sp' ? 'sp' : '');
  if (cacheCap[key]) return cacheCap[key];
  const W = U * wu - 0.09, D = U - 0.09, h = PROFILO[row].h, tl = PROFILO[row].t, Wt = W - 0.58, Dt = D - 0.44, zt = -0.06;
  const dish = kind === 'sp' ? -0.06 : 0.06, tw = Wt - 0.12, td = Dt - 0.12, s = [];
  s.push({ y: h - 0.2, w: 0, d: 0, z: zt, nouv: 1 });
  s.push({ y: h - 0.2, w: Wt - 0.26, d: Dt - 0.26, r: 0.1, z: zt, nouv: 1, sharp: 1 });
  s.push({ y: 0, w: W - 0.3, d: D - 0.3, r: 0.1, nouv: 1, sharp: 1 });
  s.push({ y: 0, w: W - 0.07, d: D - 0.07, r: 0.15 });
  s.push({ y: 0.045, w: W, d: D, r: 0.18 });
  for (const u of [0.3, 0.62, 0.86]) s.push({ y: lerp(0.045, h - 0.1, u), w: lerp(W, Wt + 0.07, u) + 0.03 * Math.sin(u * Math.PI), d: lerp(D, Dt + 0.07, u) + 0.03 * Math.sin(u * Math.PI), r: lerp(0.18, 0.27, u), z: zt * u, tilt: tl * u });
  s.push({ y: h - 0.1, w: Wt + 0.07, d: Dt + 0.07, r: 0.27, z: zt, tilt: tl });
  s.push({ y: h - 0.035, w: Wt - 0.01, d: Dt - 0.01, r: 0.25, z: zt, tilt: tl });
  s.push({ y: h, w: tw, d: td, r: 0.21, z: zt, tilt: tl });
  for (const q of [0.78, 0.52, 0.26]) s.push({ y: h - dish * (1 - q * q), w: tw * q, d: td * q, r: 0.21 * q, z: zt, tilt: tl });
  s.push({ y: h - dish, w: 0, d: 0, z: zt, tilt: tl });
  const pelle = loft(s, { seg: 5, uvW: tw, uvD: td });
  /* sotto: il perno con la croce che entra nello stelo dello switch */
  const perno = tornio([[0, 0.14], [0.23, 0.14, 1], [0.27, 0.18], [0.27, h - 0.2, 1], [0, h - 0.2]]);
  return (cacheCap[key] = fondi([pelle, perno]));
}
export const ALTEZZA_TASTO = 0.66;            /* quanto sta il bordo basso del tasto sopra la piastra */
export const CORSA = 0.36;                    /* di quanto scende un tasto premuto */

/* ------------------------------------------------------------------ lo switch (intero) e lo switch smontato */
function croce(y) { return [sposta(blocco(0.41, 0.37, 0.117, 0.02, 0.018), 0, y, 0), sposta(blocco(0.117, 0.37, 0.41, 0.02, 0.018), 0, y, 0)]; }
function geoSwBase() {
  return loft([{ y: -0.5, w: 0, d: 0 }, { y: -0.5, w: 1.2, d: 1.2, r: 0.07, sharp: 1 }, { y: -0.43, w: 1.32, d: 1.32, r: 0.09 }, { y: -0.03, w: 1.38, d: 1.38, r: 0.09 }, { y: 0, w: 1.38, d: 1.38, r: 0.09, sharp: 1 },
    { y: 0, w: 1.56, d: 1.56, r: 0.07, sharp: 1 }, { y: 0.085, w: 1.56, d: 1.56, r: 0.07 }, { y: 0.115, w: 1.5, d: 1.5, r: 0.09, sharp: 1 }, { y: 0.115, w: 0, d: 0 }], { seg: 3 });
}
function geoSwTop() {
  const g = [loft([{ y: 0.115, w: 0, d: 0 }, { y: 0.115, w: 1.47, d: 1.47, r: 0.1, sharp: 1 }, { y: 0.2, w: 1.45, d: 1.45, r: 0.12 }, { y: 0.54, w: 1.12, d: 1.22, r: 0.15, z: -0.02 }, { y: 0.6, w: 1.04, d: 1.14, r: 0.13, z: -0.02 }, { y: 0.615, w: 0.94, d: 1.04, r: 0.1, z: -0.02, sharp: 1 }, { y: 0.615, w: 0, d: 0, z: -0.02 }], { seg: 4 })];
  g.push(sposta(blocco(0.8, 0.1, 0.64, 0.07, 0.025), 0, 0.59, -0.02));                     /* il camino dello stelo */
  for (const sx of [-1, 1]) g.push(sposta(blocco(0.16, 0.2, 0.5, 0.03, 0.02), sx * 0.72, 0.1, 0));   /* le due alette che agganciano la base */
  g.push(sposta(blocco(0.46, 0.05, 0.12, 0.03, 0.015), 0, 0.3, 0.66, -0.75));              /* la finestra della luce, davanti */
  return fondi(g);
}
function geoStelo(lungo) {
  const g = [sposta(blocco(0.7, lungo ? 0.42 : 0.1, 0.54, 0.06, 0.02), 0, lungo ? 0.28 : 0.6, -0.02), ...croce(0.69)];
  if (lungo) { g.push(sposta(tornio([[0, 0], [0.085, 0, 1], [0.1, 0.04], [0.1, 0.3, 1], [0, 0.3]], { seg: 4 }), 0, 0, -0.02)); for (const sx of [-1, 1]) g.push(sposta(blocco(0.1, 0.2, 0.3, 0.02, 0.015), sx * 0.4, 0.2, -0.02)); }
  return fondi(g);
}
let _sw = null;
export function geoSwitch() {
  if (_sw) return _sw;
  return (_sw = fondi([tinta(geoSwBase(), C.swBase), tinta(geoSwTop(), C.swTop), tinta(geoStelo(false), C.stelo)]));
}
/* lo switch smontato: base con i piedini, molla, stelo, coperchio (per la tavola dei pezzi) */
export function switchSmontato(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(tinta(geoSwBase(), C.swBase), M.plastica);
  const metallo = fondi([sposta(blocco(0.13, 0.33, 0.035, 0.01, 0.01), -0.381, -0.83, -0.254), sposta(blocco(0.13, 0.33, 0.035, 0.01, 0.01), 0.254, -0.83, -0.508),
    sposta(blocco(0.5, 0.36, 0.03, 0.01, 0.01), -0.3, 0.1, -0.4), sposta(blocco(0.36, 0.3, 0.03, 0.01, 0.01), 0.3, 0.1, -0.45)]);
  const piedi = fondi([sposta(tornio([[0, -0.82], [0.17, -0.82, 1], [0.2, -0.78], [0.2, -0.5, 1], [0, -0.5]], { seg: 5 }), 0, 0, 0), ...[-1, 1].map((sx) => sposta(tornio([[0, -0.66], [0.07, -0.66, 1], [0.085, -0.63], [0.085, -0.5, 1], [0, -0.5]], { seg: 3 }), sx * 0.508, 0, 0))]);
  const a = new THREE.Group(); a.add(base, new THREE.Mesh(metallo, M.ottone), new THREE.Mesh(tinta(piedi, C.swBase), M.plastica)); a.name = 'base';
  const m = new THREE.Mesh(molla(0.19, 0.022, 1.15, 10), M.ottone); m.name = 'molla';
  const s = new THREE.Mesh(tinta(geoStelo(true), C.stelo), M.plastica); s.name = 'stelo';
  const t = new THREE.Mesh(tinta(geoSwTop(), C.swTop), M.plastica); t.name = 'coperchio';
  g.add(a, m, s, t); g.userData = { base: a, molla: m, stelo: s, coperchio: t };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ------------------------------------------------------------------ la piastra: alluminio, 68 finestre vere */
export function geoPiastra() {
  const sh = new THREE.Shape(); rettTondo(sh, -15.12, -4.66, 30.24, 9.32, 0.28);
  const buco = (x, z, w, d, r) => { const p = new THREE.Path(); rettTondo(p, x - w / 2, -z - d / 2, w, d, r); sh.holes.push(p); };
  for (const k of TASTI) { buco(k.x, k.z, 1.4, 1.4, 0.05); if (k.stab) for (const sx of [-1, 1]) buco(k.x + sx * k.stab, k.z + 0.1, 0.68, 1.34, 0.06); }
  for (const v of VITI) { const p = new THREE.Path(); p.absarc(v[0], -v[1], 0.215, 0, TAU, false); sh.holes.push(p); }
  return sposta(estruso(sh, 0.15, 0.022, { cs: 5 }), 0, -0.15, 0);
}

/* ------------------------------------------------------------------ la scheda: blu notte, piazzole d'oro, piste, serigrafia */
export function schedaTrame() {
  const W = 2048, H = 640, a = tela(W, H), b = tela(W, H), c = a.c, m = b.c, sx = 0.92 * W / 30.3, sy = 0.92 * H / 9.4;
  c.fillStyle = '#121a3e'; c.fillRect(0, 0, W, H); m.fillStyle = 'rgb(0,128,0)'; m.fillRect(0, 0, W, H);   /* G = ruvidità, B = metallo */
  for (const q of [c, m]) { q.translate(W / 2, H / 2); q.scale(sx, sy); q.lineCap = 'round'; q.lineJoin = 'round'; }
  const scritta = (txt, x, z, cm, font) => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = font.replace('#', (cm * sx).toFixed(1) + 'px'); c.textAlign = 'left'; c.fillStyle = seta; c.fillText(txt, W / 2 + x * sx, H / 2 + z * sy); c.restore(); };
  const oro = '#e3b458', pista = '#1c2a66', seta = 'rgba(238,232,214,.82)';
  const pad = (x, z, r, foro) => { c.fillStyle = oro; c.beginPath(); c.arc(x, z, r, 0, TAU); c.fill(); m.fillStyle = 'rgb(0,70,255)'; m.beginPath(); m.arc(x, z, r, 0, TAU); m.fill();
    if (foro) { c.fillStyle = '#05060d'; c.beginPath(); c.arc(x, z, foro, 0, TAU); c.fill(); m.fillStyle = 'rgb(0,200,0)'; m.beginPath(); m.arc(x, z, foro, 0, TAU); m.fill(); } };
  const rpad = (x, z, w, d) => { c.fillStyle = oro; c.fillRect(x - w / 2, z - d / 2, w, d); m.fillStyle = 'rgb(0,70,255)'; m.fillRect(x - w / 2, z - d / 2, w, d); };
  /* le piste: una per fila (i diodi), una per colonna (i piedini), un fascio verso il processore */
  c.strokeStyle = pista; c.lineWidth = 0.05;
  for (let r = 0; r < 5; r++) { const ks = TASTI.filter((k) => k.row === r); c.beginPath(); ks.forEach((k, i) => { const x = k.x + 0.62, z = k.z + 0.6; if (!i) c.moveTo(x, z); else { c.lineTo(x - 0.5, z); c.lineTo(x, z); } }); c.stroke(); }
  for (const k of TASTI) { if (k.row === 4) continue; const giu = TASTI.filter((q) => q.row === k.row + 1).sort((p, q) => Math.abs(p.x - k.x) - Math.abs(q.x - k.x))[0]; if (!giu) continue;
    const x0 = k.x - 0.381, z0 = k.z - 0.254, x1 = giu.x - 0.381, z1 = giu.z - 0.254, zm = k.z + 0.98; c.beginPath(); c.moveTo(x0, z0); c.lineTo(x0 - 0.42, z0 + 0.42); c.lineTo(x0 - 0.42, zm - Math.abs(x1 - x0) * 0.5); c.lineTo(x1 - 0.42, zm + 0.1); c.lineTo(x1 - 0.42, z1 - 0.42); c.lineTo(x1, z1); c.stroke(); }
  for (let i = 0; i < 14; i++) { const z = 3.02 + i * 0.075; c.beginPath(); c.moveTo(-9.6 + i * 0.09, z < 3.4 ? 2.75 : 2.9); c.lineTo(-9.6 + i * 0.09, z); c.lineTo(-4.4 + (i - 7) * 0.07, z); c.lineTo(-3.75, 3.4 + (i - 7) * 0.045); c.stroke(); }
  for (const k of TASTI) {
    c.fillStyle = '#05060d'; c.beginPath(); c.arc(k.x, k.z, 0.2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(120,140,220,.35)'; c.lineWidth = 0.025; c.stroke();
    pad(k.x - 0.381, k.z - 0.254, 0.125, 0.065); pad(k.x + 0.254, k.z - 0.508, 0.125, 0.065);
    for (const s of [-1, 1]) { c.fillStyle = '#05060d'; c.beginPath(); c.arc(k.x + s * 0.508, k.z, 0.088, 0, TAU); c.fill(); }
    rpad(k.x + 0.5, k.z + 0.6, 0.1, 0.085); rpad(k.x + 0.74, k.z + 0.6, 0.1, 0.085);                                  /* il diodo */
    c.strokeStyle = seta; c.lineWidth = 0.018; c.strokeRect(k.x + 0.41, k.z + 0.52, 0.42, 0.16);
    rpad(k.x - 0.13, k.z + 0.5, 0.07, 0.11); rpad(k.x + 0.13, k.z + 0.5, 0.07, 0.11);                                  /* la luce sotto il tasto */
    scritta('K' + (k.id + 1), k.x - 0.82, k.z + 0.84, 0.15, '500 # "Geist Mono", monospace');
    if (k.stab) for (const s of [-1, 1]) { c.fillStyle = '#05060d'; c.beginPath(); c.arc(k.x + s * k.stab, k.z - 0.66, 0.15, 0, TAU); c.fill(); c.beginPath(); c.arc(k.x + s * k.stab, k.z + 0.86, 0.2, 0, TAU); c.fill(); }
  }
  for (const v of VITI) pad(v[0], v[1], 0.27, 0.115);
  /* il processore e i suoi vicini, sotto la barra */
  c.strokeStyle = seta; c.lineWidth = 0.02; c.strokeRect(-3.75, 3.02, 0.8, 0.8);
  for (let i = 0; i < 9; i++) { rpad(-3.71 + i * 0.09, 2.97, 0.045, 0.1); rpad(-3.71 + i * 0.09, 3.87, 0.045, 0.1); rpad(-3.8, 3.06 + i * 0.09, 0.1, 0.045); rpad(-2.9, 3.06 + i * 0.09, 0.1, 0.045); }
  for (let i = 0; i < 5; i++) { rpad(-2.3 + i * 0.42, 3.15, 0.1, 0.12); rpad(-2.12 + i * 0.42, 3.15, 0.1, 0.12); }
  rpad(-12.5, -4.3, 0.9, 0.22);                                                                                      /* la presa del cavo */
  scritta('imad.chat', 4.6, 3.56, 0.36, '700 # Manrope, sans-serif');
  scritta('65% · 68 TASTI · FATTA DA DOT', 4.62, 3.9, 0.17, '500 # "Geist Mono", monospace');
  return { colore: trama(a.cv, { aniso: 16 }), orm: trama(b.cv, { lineare: true, aniso: 16 }) };
}
export function geoScheda() {
  const W = 30.3, D = 9.4, s = [{ y: 0, w: 0, d: 0 }, { y: 0, w: W - 0.04, d: D - 0.04, r: 0.3, sharp: 1 }, { y: 0.02, w: W, d: D, r: 0.32 }, { y: 0.14, w: W, d: D, r: 0.32 }, { y: 0.16, w: W - 0.03, d: D - 0.03, r: 0.3, sharp: 1 }, { y: 0.16, w: 0, d: 0 }];
  return sposta(loft(s, { seg: 4, uvW: W - 0.03, uvD: D - 0.03 }), 0, -0.66, 0);
}
/* i piccoli componenti in rilievo sulla scheda */
export function geoComponenti() {
  const g = [sposta(blocco(0.7, 0.09, 0.7, 0.03, 0.02), -3.35, -0.5, 3.42)];
  for (let i = 0; i < 5; i++) g.push(sposta(blocco(0.26, 0.07, 0.13, 0.02, 0.015), -2.21 + i * 0.42, -0.5, 3.15));
  return tinta(fondi(g), 0x15161b);
}

/* ------------------------------------------------------------------ il guscio: una vasca a cuneo, smaltata */
export function geoGuscio() {
  const { W, D, R, yb, lip, wall, floor } = CASSA, Wi = W - 2 * wall, Di = D - 2 * wall, ri = R - wall + 0.12;
  const g = loft([{ y: yb, w: 0, d: 0 }, { y: yb, w: W - 0.6, d: D - 0.6, r: R - 0.3 }, { y: yb + 0.07, w: W - 0.16, d: D - 0.16, r: R - 0.08 }, { y: yb + 0.26, w: W, d: D, r: R },
    { y: lip - 0.14, w: W, d: D, r: R }, { y: lip - 0.04, w: W - 0.05, d: D - 0.05, r: R - 0.025 }, { y: lip, w: W - 0.18, d: D - 0.18, r: R - 0.09 },
    { y: lip, w: Wi + 0.14, d: Di + 0.14, r: ri + 0.07 }, { y: lip - 0.05, w: Wi + 0.02, d: Di + 0.02, r: ri + 0.01 }, { y: lip - 0.12, w: Wi, d: Di, r: ri }, { y: floor, w: Wi, d: Di, r: ri, sharp: 1 }, { y: floor, w: 0, d: 0 }], { seg: 7 });
  /* il cuneo: il fondo scende verso il dietro, così sul banco il fondo è piano e i tasti stanno inclinati */
  const P = g.attributes.position, t = Math.tan(INCL);
  for (let i = 0; i < P.count; i++) if (P.getY(i) < yb + 0.1) P.setY(i, P.getY(i) - (D / 2 - P.getZ(i)) * t);
  P.needsUpdate = true; g.computeVertexNormals(); return g;
}
export function geoColonnine() {
  return fondi(VITI.map((v) => sposta(tornio([[0.22, CASSA.floor - 0.01], [0.22, -0.7], [0.19, -0.66, 1], [0.08, -0.66, 1], [0.08, -0.9, 1], [0, -0.9]], { seg: 4 }), v[0], 0, v[1])));
}
/* la spia sul bordo davanti: una pillola di luce */
export function geoSpia() { return sposta(blocco(0.8, 0.18, 0.07, 0.085, 0.02), 0, -0.09, 0); }
/* la vite: testa bombata con la croce, gambo filettato. Origine sotto la testa. */
let _vite = null;
export function geoVite() {
  if (_vite) return _vite;
  const prof = [[0, -0.52], [0.045, -0.52, 1]]; for (let i = 0; i < 8; i++) { prof.push([0.075, -0.49 + i * 0.058]); prof.push([0.052, -0.46 + i * 0.058]); }
  prof.push([0.075, -0.02], [0.075, 0, 1], [0.185, 0, 1], [0.2, 0.03], [0.19, 0.075], [0.14, 0.105], [0.06, 0.115], [0, 0.117]);
  const g = [tinta(tornio(prof, { seg: 5 }), 0xffffff)];
  g.push(tinta(sposta(blocco(0.25, 0.03, 0.045, 0.01, 0.01), 0, 0.094, 0), 0x1a1b20), tinta(sposta(blocco(0.045, 0.03, 0.25, 0.01, 0.01), 0, 0.094, 0), 0x1a1b20));
  return (_vite = fondi(g));
}

/* ------------------------------------------------------------------ lo stabilizzatore: due guide, due steli, il filo d'acciaio */
export function stabilizzatore(off, M) {
  const g = new THREE.Group(), corpi = [], steli = [];
  for (const sx of [-1, 1]) {
    corpi.push(sposta(loft([{ y: -0.5, w: 0, d: 0 }, { y: -0.5, w: 0.6, d: 1.24, r: 0.05, sharp: 1 }, { y: -0.44, w: 0.66, d: 1.3, r: 0.07 }, { y: 0.36, w: 0.66, d: 1.3, r: 0.07 }, { y: 0.42, w: 0.6, d: 1.24, r: 0.06, sharp: 1 }, { y: 0.42, w: 0, d: 0 }], { seg: 3 }), sx * off, 0, 0.1));
    corpi.push(sposta(blocco(0.5, 0.12, 0.5, 0.05, 0.02), sx * off, 0.4, 0));
    steli.push(sposta(blocco(0.44, 0.2, 0.44, 0.05, 0.02), sx * off, 0.5, 0)); for (const q of croce(0.69)) steli.push(sposta(q, sx * off, 0, 0));
  }
  const corpo = new THREE.Mesh(fondi([tinta(fondi(corpi), C.swTop), tinta(fondi(steli), C.stelo)]), M.plastica);
  const filo = new THREE.Mesh(tubo([[-off, -0.3, 0.2], [-off, -0.3, 0.86], [off, -0.3, 0.86], [off, -0.3, 0.2]], 0.075, { dritto: true, raggio: 0.14, n: 40 }), M.acciaio);
  g.add(corpo, filo); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}

/* ------------------------------------------------------------------ il cavo: dalla scatola alla presa, con la spirale e la spina */
export function cavo(punti, M, o = {}) {
  const v = punti.map((p) => new THREE.Vector3(p[0], p[1], p[2])), base = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  const L = base.getLength(), s1 = o.s1 / L, s2 = o.s2 / L, giri = o.giri || 24, R = 0.5, r = 0.165, up = new THREE.Vector3(0, 1, 0);
  class Corda extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
      const p = base.getPointAt(Math.min(1, Math.max(0, t)));
      if (t > s1 && t < s2) {
        const q = (t - s1) / (s2 - s1), env = Math.min(1, q * 14, (1 - q) * 14), tg = base.getTangentAt(t), n = new THREE.Vector3().crossVectors(up, tg).normalize(), b = new THREE.Vector3().crossVectors(tg, n), a = q * giri * TAU;
        p.addScaledVector(n, R * env * Math.cos(a)).addScaledVector(b, R * env * (Math.sin(a) + 1));   /* la spirale sta appoggiata al banco */
      }
      return out.copy(p);
    }
    getPointAt(u, out) { return this.getPoint(u, out); }
    getTangentAt(u, out) { return this.getTangent(u, out); }
  }
  const N = 2400, geo = new THREE.TubeGeometry(new Corda(), N, r, 7, false), filo = new THREE.Mesh(geo, M.cavo);
  /* la spina: guscio, punta di metallo, pressacavo. Asse lungo -z locale = verso la presa (lookAt lungo la tangente) */
  const spina = new THREE.Group();
  const guscio = new THREE.Mesh(sposta(loft([{ y: 0, w: 0, d: 0 }, { y: 0, w: 0.9, d: 0.42, r: 0.2, sharp: 1 }, { y: 0.08, w: 1.08, d: 0.58, r: 0.28 }, { y: 1.5, w: 1.08, d: 0.58, r: 0.28 }, { y: 1.72, w: 0.8, d: 0.5, r: 0.24 }, { y: 2.3, w: 0.44, d: 0.44, r: 0.22 }, { y: 2.36, w: 0.36, d: 0.36, r: 0.18, sharp: 1 }, { y: 2.36, w: 0, d: 0 }], { seg: 5 }), 0, 0, 0, Math.PI / 2), M.smalto);
  const punta = new THREE.Mesh(sposta(loft([{ y: -0.62, w: 0, d: 0 }, { y: -0.62, w: 0.74, d: 0.18, r: 0.09, sharp: 1 }, { y: -0.58, w: 0.82, d: 0.25, r: 0.125 }, { y: 0.02, w: 0.82, d: 0.25, r: 0.125, sharp: 1 }, { y: 0.02, w: 0, d: 0 }], { seg: 4 }), 0, 0, 0, Math.PI / 2), M.acciaio);
  spina.add(guscio, punta);
  /* il connettore a metà cavo: un barilotto tornito */
  const bar = new THREE.Mesh(sposta(tornio([[0, 0], [0.2, 0, 1], [0.27, 0.06], [0.27, 0.5, 1], [0.33, 0.52], [0.33, 0.62], [0.36, 0.64], [0.36, 1.1], [0.33, 1.12], [0.33, 1.22], [0.27, 1.24, 1], [0.27, 1.7], [0.2, 1.76, 1], [0, 1.76]], { seg: 7 }), 0, -0.88, 0, Math.PI / 2), M.acciaio);
  const g = new THREE.Group(); g.add(filo, spina, bar);
  g.traverse((q) => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; } });
  const curva = new Corda(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), sb = o.sBar / L;
  /* quanto cavo è uscito: u da 0 a 1 (la testa con la spina sta a u) */
  g.userData.esce = (u) => {
    u = Math.max(0.0001, Math.min(1, u)); geo.setDrawRange(0, Math.floor(u * N) * 7 * 6);
    base.getPointAt(u, tmp); base.getTangentAt(u, tmp2); spina.position.copy(tmp); spina.lookAt(tmp.clone().sub(tmp2)); spina.visible = filo.visible = u > 0.002;
    bar.visible = u > sb + 0.03; base.getPointAt(sb, tmp); base.getTangentAt(sb, tmp2); bar.position.copy(tmp); bar.lookAt(tmp.clone().add(tmp2));
  };
  g.userData.testa = (u, out) => base.getPointAt(Math.max(0, Math.min(1, u)), out); g.userData.L = L; void curva; void hash;
  return g;
}
