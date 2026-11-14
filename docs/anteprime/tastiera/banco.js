/* banco.js — il banco e ciò che non è la tastiera: la lastra di vetro, la scatola di Dot, le nove tessere di imad.chat,
   gli attrezzi, il piattino delle viti, il bicchiere di tè, il bottone rosso, la polvere e la scintilla. */
import * as THREE from 'three';
import { loft, tornio, tinta, sposta, fondi, blocco, tubo, tela, trama, TAU } from './forme.js';
import { C } from './parti.js';

/* ------------------------------------------------------------------ la lastra: un riquadro del sito, in vetro, sospeso nel cielo */
export const LASTRA = { W: 40, D: 60, z0: -40, th: 1.3, R: 3.4 };   /* x da -20 a 20, z da -40 a 20 */
export function lastra(W = LASTRA.W, D = LASTRA.D, th = LASTRA.th, R = LASTRA.R) {
  const s = [{ y: -th, w: 0, d: 0 }, { y: -th, w: W - 1.0, d: D - 1.0, r: R - 0.5 }];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; s.push({ y: -th + 0.5 - 0.5 * Math.cos(a), w: W - 1.0 + 1.0 * Math.sin(a), d: D - 1.0 + 1.0 * Math.sin(a), r: R - 0.5 + 0.5 * Math.sin(a) }); }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; s.push({ y: -0.22 + 0.22 * Math.sin(a), w: W - 0.44 + 0.44 * Math.cos(a), d: D - 0.44 + 0.44 * Math.cos(a), r: R - 0.22 + 0.22 * Math.cos(a) }); }
  s.push({ y: 0, w: 0, d: 0 });
  return loft(s, { seg: 14 });
}
export function matLastra(scuro) {
  return new THREE.MeshPhysicalMaterial(scuro
    ? { color: 0x24262e, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9 }
    : { color: 0xe6e7f1, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.16, envMapIntensity: 0.8 });
}

/* ------------------------------------------------------------------ la tessera: un tasto del sito (crema, fascia chiara, lettera incisa) */
export function geoTessera(W, h) {
  const R = W * 0.14;
  return loft([{ y: 0, w: 0, d: 0, c: 0xd9ceba }, { y: 0, w: W - 0.34, d: W - 0.34, r: R - 0.1, c: 0xd9ceba }, { y: 0.09, w: W, d: W, r: R, c: 0xe9e0cf }, { y: h - 0.16, w: W, d: W, r: R, c: 0xfffdf8 },
    { y: h - 0.04, w: W - 0.09, d: W - 0.09, r: R - 0.04, c: 0xfffdf8 }, { y: h, w: W - 0.3, d: W - 0.3, r: R - 0.13, c: 0xf6f1e6 }, { y: h, w: 0, d: 0, c: 0xf6f1e6 }], { seg: 7, uvW: W - 0.3, uvD: W - 0.3 });
}
export function geoPunto(r) { const p = []; for (let i = 0; i <= 7; i++) { const a = (i / 7) * Math.PI / 2; p.push([r * Math.cos(a), r * 0.5 * Math.sin(a)]); } return tornio([[0, 0], [r * 0.98, 0, 1], ...p.slice(0), [0, r * 0.5]], { seg: 8 }); }
export const TESS = { W: 4.2, h: 0.85, passo: 4.5 };
export function tessere(M) {
  const S = 256, { cv, c } = tela(3 * S, 3 * S), L = 'imad.chat', out = [], geo = geoTessera(TESS.W, TESS.h);
  c.fillStyle = '#fff'; c.fillRect(0, 0, 3 * S, 3 * S); c.textAlign = 'center'; c.fillStyle = '#1c1d26'; c.font = '800 ' + S * 0.5 + 'px Manrope, sans-serif';
  for (let i = 0; i < 9; i++) if (L[i] !== '.') c.fillText(L[i], (i % 3) * S + S / 2, Math.floor(i / 3) * S + S * 0.655);
  const base = trama(cv);
  for (let i = 0; i < 9; i++) {
    const t = base.clone(); t.repeat.set(1 / 3, 1 / 3); t.offset.set((i % 3) / 3, 1 - (Math.floor(i / 3) + 1) / 3); t.needsUpdate = true;
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, map: t, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3 }));
    m.castShadow = m.receiveShadow = true;
    if (L[i] === '.') { const p = new THREE.Mesh(geoPunto(0.52), M.oro); p.position.y = TESS.h - 0.01; m.add(p); }
    out.push(m);
  }
  return out;
}

/* ------------------------------------------------------------------ la scatola di Dot: ceramica crema, dentro buio, il coperchio è il tasto col punto */
export const SCAT = { W: 4.6, H: 3.6 };
export function scatola(M) {
  const { W, H } = SCAT, g = new THREE.Group();
  const corpo = new THREE.Mesh(loft([{ y: 0, w: 0, d: 0, c: 0xd3c8b3 }, { y: 0, w: W - 0.6, d: W - 0.6, r: 0.4, c: 0xd3c8b3 }, { y: 0.1, w: W - 0.1, d: W - 0.1, r: 0.58, c: 0xdfd6c4 }, { y: 0.32, w: W, d: W, r: 0.62, c: 0xe4dbc9 },
    { y: H - 0.62, w: W, d: W, r: 0.62, c: 0xf8f4eb }, { y: H - 0.55, w: W + 0.03, d: W + 0.03, r: 0.63, c: 0xfffdf8 }, { y: H - 0.08, w: W + 0.03, d: W + 0.03, r: 0.63, c: 0xfffdf8 }, { y: H, w: W - 0.08, d: W - 0.08, r: 0.58, c: 0xfbf6ec },
    { y: H, w: W - 0.5, d: W - 0.5, r: 0.4, c: 0xf1e9da, sharp: 1, c2: 0x1d1916 }, { y: 0.3, w: W - 0.6, d: W - 0.6, r: 0.36, c: 0x060507, sharp: 1 }, { y: 0.3, w: 0, d: 0, c: 0x060507 }], { seg: 7 }),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3 }));
  const presa = new THREE.Mesh(sposta(tornio([[0.2, 0], [0.34, 0], [0.36, 0.04], [0.3, 0.07, 1], [0.2, 0.05, 1], [0.2, 0]], { seg: 6 }), 0, 0, 0, Math.PI / 2), M.grafite); presa.position.set(0, 0.42, W / 2 - 0.01); presa.name = 'presa';
  const cardine = new THREE.Group(); cardine.position.set(0, H, -W / 2 + 0.1);
  const lid = new THREE.Mesh(geoTessera(W + 0.03, 0.7), corpo.material.clone()); lid.material.map = null; lid.position.set(0, 0, W / 2 - 0.1);
  const punto = new THREE.Mesh(geoPunto(0.5), M.oro); punto.position.y = 0.69; lid.add(punto);
  cardine.add(lid); g.add(corpo, presa, cardine);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { corpo, cardine, lid, apri(b) { cardine.rotation.x = -b; } };
  return g;
}

/* ------------------------------------------------------------------ gli attrezzi. Ognuno è modellato lungo il suo asse y, la punta in basso (y = 0). */
function pezzo(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; }
export function attrezzi(M) {
  const A = {};
  /* il cacciavite di precisione: gambo d'acciaio, manico zigrinato, cappuccio che gira */
  { const g = new THREE.Group(), gambo = [[0, 0], [0.03, 0, 1], [0.065, 0.22], [0.105, 0.5], [0.105, 4.3, 1], [0.19, 4.3, 1], [0.23, 4.36], [0.23, 4.62], [0.19, 4.7, 1], [0, 4.7]];
    const man = [[0, 4.66], [0.3, 4.66, 1], [0.5, 4.95], [0.55, 5.25]]; for (let i = 0; i < 9; i++) { man.push([0.55, 5.3 + i * 0.3], [0.55, 5.46 + i * 0.3], [0.5, 5.5 + i * 0.3], [0.5, 5.56 + i * 0.3]); }
    man.push([0.55, 8.05], [0.58, 8.5], [0.58, 9.75], [0.55, 9.86, 1], [0.44, 9.9], [0.44, 10.02, 1], [0, 10.02]);
    const capp = [[0, 10], [0.44, 10, 1], [0.56, 10.06], [0.57, 10.5], [0.52, 10.72], [0.36, 10.84], [0, 10.86]];
    g.add(pezzo(tornio(gambo, { seg: 5 }), M.acciaio), pezzo(tornio(man, { seg: 8 }), M.grafite), pezzo(tornio(capp, { seg: 8 }), M.smalto)); g.userData = { r0: 0.58, len: 10.86 }; A.cacciavite = g; }
  /* le pinzette: due lame d'acciaio che si aprono */
  { const g = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(-0.3, 0); sh.quadraticCurveTo(-0.46, 0.05, -0.46, 0.5); sh.lineTo(-0.42, 3.2); sh.lineTo(-0.2, 7.4); sh.lineTo(-0.045, 11.2); sh.lineTo(0.045, 11.2); sh.lineTo(0.2, 7.4); sh.lineTo(0.42, 3.2); sh.lineTo(0.46, 0.5); sh.quadraticCurveTo(0.46, 0.05, 0.3, 0); sh.closePath();
    const lama = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 2, curveSegments: 6 }); lama.translate(0, 0, -0.025);
    for (const s of [-1, 1]) { const l = pezzo(lama, M.acciaio); l.rotation.x = s * 0.028; l.position.z = s * 0.045; g.add(l); }
    const inn = new THREE.Group(); inn.add(...g.children.slice()); inn.rotation.z = Math.PI; inn.position.y = 11.2; g.add(inn); g.userData = { r0: 0.3, len: 11.2, piatto: true }; A.pinzette = g; }
  /* l'estrattore dei tasti: manico e due fili d'acciaio con l'uncino */
  { const g = new THREE.Group(); g.add(pezzo(sposta(blocco(2.0, 1.25, 0.8, 0.38, 0.14, { n: 4, seg: 6 }), 0, 5.6, 0), M.grafite), pezzo(sposta(blocco(1.1, 0.34, 0.5, 0.2, 0.06), 0, 5.34, 0), M.smalto));
    for (const s of [-1, 1]) g.add(pezzo(tubo([[s * 0.42, 5.5, 0], [s * 0.5, 4.4, 0], [s * 0.95, 1.2, 0], [s * 0.93, 0.3, 0], [s * 0.72, 0.06, 0], [s * 0.38, 0.1, 0]], 0.06, { n: 60, tens: 0.4 }), M.acciaio));
    g.userData = { r0: 0.4, len: 6.85, piatto: true }; A.estrattore = g; }
  /* il saldatore a penna: punta, canna, ghiera, manico, e il filo che se ne va */
  { const g = new THREE.Group();
    g.add(pezzo(tornio([[0, 0], [0.03, 0.01], [0.12, 1.05, 1], [0, 1.05]], { seg: 4 }), new THREE.MeshStandardMaterial({ color: 0x8a6a4c, metalness: 1, roughness: 0.42 })));
    g.add(pezzo(tornio([[0, 1.0], [0.135, 1.0, 1], [0.15, 1.06], [0.15, 3.5, 1], [0.21, 3.5, 1], [0.21, 3.72, 1], [0, 3.72]], { seg: 5 }), M.acciaio));
    g.add(pezzo(tornio([[0, 3.7], [0.26, 3.7, 1], [0.34, 3.8], [0.36, 4.15], [0.3, 4.3, 1], [0, 4.3]], { seg: 7 }), M.grafite));
    const man = [[0, 4.28], [0.3, 4.28, 1], [0.44, 4.5], [0.5, 5.0]]; for (let i = 0; i < 5; i++) man.push([0.5, 5.1 + i * 0.36], [0.5, 5.3 + i * 0.36], [0.46, 5.34 + i * 0.36], [0.46, 5.42 + i * 0.36]);
    man.push([0.5, 6.95], [0.47, 8.4], [0.43, 10.4], [0.45, 11.6], [0.42, 12.1], [0.3, 12.5], [0.22, 12.62, 1], [0, 12.62]);
    g.add(pezzo(tornio(man, { seg: 8 }), M.smalto));
    g.add(pezzo(tornio([[0, 12.6], [0.2, 12.6, 1], [0.2, 13.2], [0.15, 13.5, 1], [0, 13.5]], { seg: 5 }), M.gomma));
    g.add(pezzo(tubo([[0, 13.4, 0], [0, 14.4, 0], [0.5, 15.6, 0.1], [1.9, 16.2, 0.2], [3.4, 15.9, 0.1], [4.3, 16.6, 0]], 0.1, { n: 50 }), M.gomma));
    g.userData = { r0: 0.5, len: 13.5 }; A.saldatore = g; }
  /* il pennello: setole, ghiera d'acciaio, manico */
  { const g = new THREE.Group();
    g.add(pezzo(loft([{ y: 0, w: 0, d: 0 }, { y: 0.02, w: 1.14, d: 0.2, r: 0.1 }, { y: 0.5, w: 1.22, d: 0.32, r: 0.14 }, { y: 2.2, w: 0.98, d: 0.36, r: 0.16, sharp: 1 }, { y: 2.2, w: 0, d: 0 }], { seg: 4 }), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 })));
    g.add(pezzo(loft([{ y: 2.1, w: 0, d: 0 }, { y: 2.1, w: 1.02, d: 0.4, r: 0.18, sharp: 1 }, { y: 2.16, w: 1.06, d: 0.44, r: 0.2 }, { y: 2.45, w: 1.06, d: 0.44, r: 0.2 }, { y: 2.5, w: 1.02, d: 0.42, r: 0.2 }, { y: 2.56, w: 1.06, d: 0.44, r: 0.2 }, { y: 3.2, w: 0.98, d: 0.42, r: 0.2 }, { y: 3.26, w: 0.9, d: 0.36, r: 0.17, sharp: 1 }, { y: 3.26, w: 0, d: 0 }], { seg: 5 }), M.acciaio));
    g.add(pezzo(loft([{ y: 3.2, w: 0, d: 0 }, { y: 3.2, w: 0.88, d: 0.34, r: 0.16, sharp: 1 }, { y: 3.6, w: 0.86, d: 0.36, r: 0.17 }, { y: 5.2, w: 0.6, d: 0.44, r: 0.21 }, { y: 7.4, w: 0.5, d: 0.46, r: 0.23 }, { y: 9.9, w: 0.56, d: 0.5, r: 0.25 }, { y: 10.5, w: 0.48, d: 0.44, r: 0.22 }, { y: 10.72, w: 0.26, d: 0.24, r: 0.12 }, { y: 10.78, w: 0, d: 0 }], { seg: 6 }), M.smalto));
    g.userData = { r0: 0.23, len: 10.78, piatto: true }; A.pennello = g; }
  return A;
}
/* il piattino delle viti */
export function piattino(M) {
  return pezzo(tornio([[0, 0], [1.1, 0, 1], [1.5, 0.08], [1.72, 0.3], [1.78, 0.46], [1.72, 0.5, 1], [1.62, 0.44], [1.46, 0.24], [1.15, 0.14], [0, 0.12]], { seg: 10 }), M.grafite);
}
/* il bicchiere di tè alla menta (piccolo: è di Dot). livello 0..1 */
export function bicchiere(M) {
  const g = new THREE.Group(), H = 1.75;
  const prof = [[0, 0], [0.34, 0, 1], [0.36, 0.03], [0.36, 0.2], [0.4, 0.6], [0.5, H - 0.03], [0.5, H, 1], [0.465, H, 1], [0.37, 0.62], [0.32, 0.26], [0.3, 0.2, 1], [0, 0.2]];
  const v = new THREE.Mesh(tornio(prof, { seg: 9 }), M.vetroBicchiere); v.renderOrder = 6;
  const te = new THREE.Mesh(tornio([[0, 0], [0.29, 0, 1], [0.315, 0.06], [0.36, 0.42], [0.44, 1.0, 1], [0, 1.0]], { seg: 9 }), M.te); te.position.y = 0.2; te.renderOrder = 5;
  const filo = pezzo(tornio([[0.488, H - 0.34], [0.5, H - 0.335], [0.512, H - 0.27], [0.507, H - 0.265, 1], [0.495, H - 0.27], [0.488, H - 0.34]], { seg: 9 }), M.ottone); filo.castShadow = false;
  const menta = new THREE.Group(); for (let i = 0; i < 3; i++) { const f = pezzo(loft([{ y: 0, w: 0, d: 0 }, { y: 0.02, w: 0.1, d: 0.05, r: 0.025 }, { y: 0.2, w: 0.3, d: 0.07, r: 0.035 }, { y: 0.42, w: 0.16, d: 0.05, r: 0.025 }, { y: 0.5, w: 0, d: 0 }], { seg: 3 }), M.menta); f.rotation.set(0.5 - i * 0.2, i * 2.2, 0.35 * (i - 1)); f.position.set(0.12 * Math.cos(i * 2.2), 1.1, 0.12 * Math.sin(i * 2.2)); menta.add(f); }
  g.add(te, menta, filo, v); v.castShadow = true;
  g.userData = { H, livello(q) { const s = Math.max(0.03, q); te.scale.set(0.82 + 0.18 * s, s, 0.82 + 0.18 * s); te.visible = q > 0.02; menta.position.y = -1.0 * (1 - s) * 0.92; } };
  return g;
}
/* il bottone rosso, piccolo, con la sua base e la scritta */
export function bottone(M) {
  const g = new THREE.Group();
  g.add(pezzo(blocco(2.5, 0.72, 2.5, 0.5, 0.12, { n: 4, seg: 7 }), M.grafite));
  g.add(pezzo(sposta(tornio([[0.62, 0.7], [0.84, 0.7, 1], [0.9, 0.74], [0.9, 0.86], [0.86, 0.9, 1], [0.74, 0.9], [0.7, 0.86, 1], [0.7, 0.7]], { seg: 10 }), 0, 0, -0.32), M.acciaio));
  const p = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; p.push([0.66 * Math.cos(a), 0.16 + 0.42 * Math.sin(a)]); }
  const cup = pezzo(tornio([[0, 0], [0.66, 0, 1], ...p, [0, 0.58]], { seg: 10 }), M.rosso); cup.position.set(0, 0.74, -0.32); cup.name = 'cupola'; g.add(cup);
  /* il cartellino: una targhetta appoggiata davanti alla base, inclinata verso chi guarda */
  const { cv, c } = tela(640, 150); c.fillStyle = 'rgba(244,245,250,.95)'; c.font = '600 62px "Geist Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const txt = 'DO NOT PRESS'; let x = 320 - (txt.length - 1) * 22.5; for (const ch of txt) { c.fillText(ch, x, 80); x += 45; }
  const targa = new THREE.Group(); targa.add(pezzo(sposta(blocco(2.5, 0.09, 0.74, 0.1, 0.03), 0, 0, 0.37), M.grafite));
  const t = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 0.525), new THREE.MeshBasicMaterial({ map: trama(cv), transparent: true, depthWrite: false, toneMapped: false })); t.rotation.x = -Math.PI / 2; t.position.set(0, 0.096, 0.37); targa.add(t);
  targa.position.set(0, 0.6, 1.2); targa.rotation.x = 0.9; g.add(targa);
  g.userData = { cupola: cup }; return g;
}

/* ------------------------------------------------------------------ le piccole cose: polvere dove un pezzo si posa, una scintilla, un punto di luce */
export function anelliPolvere(n, scuro) {
  const geo = new THREE.RingGeometry(1, 1.13, 40); geo.rotateX(-Math.PI / 2); const out = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: scuro ? 0xfff0dc : 0x5c5248, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.visible = false; m.renderOrder = 2; out.push(m); }
  return out;
}
export function luce(colori, k = 64) {
  const { cv, c } = tela(k, k), g = c.createRadialGradient(k / 2, k / 2, 0, k / 2, k / 2, k / 2); colori.forEach((q, i) => g.addColorStop(q[0], q[1])); c.fillStyle = g; c.fillRect(0, 0, k, k);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: trama(cv), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.visible = false; s.renderOrder = 30; return s;
}
export function scintilla() {
  const g = new THREE.Group(), n = 7, pos = new Float32Array(n * 6);
  const linee = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: 0xfff1c9, transparent: true, depthTest: false, toneMapped: false })); linee.renderOrder = 31; linee.frustumCulled = false;
  const alone = luce([[0, 'rgba(255,244,214,1)'], [0.25, 'rgba(255,214,130,.55)'], [1, 'rgba(255,190,90,0)']]);
  g.add(linee, alone); g.visible = false;
  /* u da 0 a 1: sette trattini che partono e si spengono */
  g.userData.a = (u) => { g.visible = u > 0 && u < 1; if (!g.visible) return; alone.visible = true; const s = 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.6)); alone.scale.set(s, s, 1); linee.material.opacity = 1 - u;
    for (let i = 0; i < n; i++) { const a = i * 2.39996 + 0.4, el = 0.5 + 0.9 * ((i * 0.618) % 1), d0 = 0.12 + u * 0.75, d1 = d0 + 0.22 * (1 - u), dx = Math.cos(a) * Math.cos(el), dy = Math.sin(el) - u * u * 0.5, dz = Math.sin(a) * Math.cos(el);
      pos.set([dx * d0, dy * d0, dz * d0, dx * d1, dy * d1, dz * d1], i * 6); }
    linee.geometry.attributes.position.needsUpdate = true; };
  return g;
}
void tinta; void fondi; void C; void TAU;
