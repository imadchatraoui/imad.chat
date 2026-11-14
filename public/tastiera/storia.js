/* storia.js — la sequenza della tastiera: tutto è funzione di un solo tempo t (secondi). Nessuno stato: ogni fotogramma
   si può rifare uguale, e la sezione vera potrà legare t allo scorrere della pagina.
   Dodici battute; da «fuori» a «cavo» è il timelapse (Dot scatta di posa ogni decimo di secondo, i pezzi volano). */
import * as THREE from 'three';
import { lerp, sat, seg, eOut, eIO, eBack, smooth, hash, TAU } from './forme.js';
import * as PT from './parti.js';
import * as BN from './banco.js';
import { SCATOLA, ATT } from './scena.js';

export const T = { faccia: 0, piega: 1.0, salto: 2.3, fuori: 3.6, guscio: 5.9, scheda: 6.8, piastra: 8.2, sw: 9.3, tasti: 11.3, cavo: 13.9, contatto: 15.2, bottone: 18.2, fine: 21.4 };
export const BATTUTE = [
  ['faccia', 'La faccia di imad.chat, nove tasti.'], ['piega', 'Si piega: colonne, poi file. Diventa la scatola.'], ['salto', 'Dot arriva e salta dentro.'],
  ['fuori', 'Fuori tutto: attrezzi, cavo, switch, tasti. In ordine.'], ['guscio', 'Il guscio va al suo posto.'], ['scheda', 'La scheda entra. Le viti, una a una.'],
  ['piastra', 'Stabilizzatori, poi la piastra.'], ['sw', 'Gli switch, una fila alla volta.'], ['tasti', 'I tasti. Per ultimi quelli di imad.chat, e il punto d’oro.'],
  ['cavo', 'Il cavo, una scintilla. La luce respira.'], ['contatto', 'Contattami: scrivi, e i tasti scendono.'], ['bottone', 'L’ultima cosa dalla scatola: un bottone rosso.']
];
export const FATTORE = 8400;                                    /* 24 ore in 10,3 secondi */
const AX = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), lin = (u) => u;
const V = (x, y, z) => new THREE.Vector3(x, y, z), Q = (x = 0, y = 0, z = 0, ord = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, ord));

/* la via di un pezzo: tratti { t0, t1, da, a }; prima del primo tratto il pezzo non c'è (è ancora nella scatola) */
class Via {
  constructor(o) { this.o = o; this.s = []; }
  va(t0, t1, a, k = {}) {
    const prev = this.s[this.s.length - 1], da = k.da || (prev ? prev.a : a);
    this.s.push({ t0, t1, da, a, via: !!k.via, h: k.h || 0, giri: k.giri || 0, asse: k.asse || AX, molla: k.molla == null ? 0.1 : k.molla, e: k.e || lin, premi: k.premi || 0 }); return this;
  }
  fine() { return this.s[this.s.length - 1].a; }
  applica(t, tq, tv) {
    const o = this.o, s = this.s; if (!s.length || t < s[0].t0) { o.visible = false; return; }
    o.visible = true; let i = s.length - 1; while (i > 0 && s[i].t0 > t) i--; const g = s[i];
    if (t >= g.t1) {
      if (g.via) { o.visible = false; return; }
      o.position.copy(g.a.p); o.quaternion.copy(g.a.q); const tau = t - g.t1, S = g.a.s == null ? 1 : g.a.s; let k = 0;
      if (g.molla && tau < 0.24) k = g.molla * Math.exp(-tau / 0.05) * Math.cos(tau * 44);
      o.scale.set(S * (1 + k * 0.5), S * (1 - k), S * (1 + k * 0.5));
      if (g.premi && tau < 0.2) o.position.addScaledVector(tv.set(0, 1, 0).applyQuaternion(g.a.q), -g.premi * Math.exp(-tau / 0.03) * Math.cos(tau * 34));
    } else {
      const u = (t - g.t0) / (g.t1 - g.t0), e = g.e(u), S0 = g.da.s == null ? 1 : g.da.s, S1 = g.a.s == null ? 1 : g.a.s, S = lerp(S0, S1, Math.min(1, u * 1.6));
      o.position.lerpVectors(g.da.p, g.a.p, e); o.position.y += g.h * 4 * u * (1 - u); o.quaternion.slerpQuaternions(g.da.q, g.a.q, e);
      if (g.giri) o.quaternion.multiply(tq.setFromAxisAngle(g.asse, g.giri * TAU * (1 - e)));
      o.scale.setScalar(g.via ? lerp(S0, S1, Math.max(0, u * 2.2 - 1.2)) : S);
    }
  }
}

export function creaStoria(sc, opz = {}) {
  const { P, dot, alMondo, qK, ponte } = sc, Y = window.DOT.YAW, ora0 = opz.ora == null ? (sc.scuro ? 22.2 : 10.3) : opz.ora;
  const D = (x, y, z) => alMondo(x, y, z), bx = SCATOLA.x, bz = SCATOLA.z, H = BN.SCAT.H;
  const BOCCA = V(bx, H + 0.5, bz), vie = [], polveri = [], tq = new THREE.Quaternion(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  const via = (o) => { const v = new Via(o); vie.push(v); return v; };
  const posa = (v, t, r) => polveri.push({ t, x: v.x, z: v.z, y: v.y, r });
  const esce = (q) => ({ p: BOCCA.clone(), q: q || Q(), s: 0.3 });           /* un pezzo che esce dalla scatola: piccolo, poi cresce */
  P.scatola.position.set(bx, 0, bz);

  /* ================================================================ dove sta ogni cosa sul banco (la disposizione ordinata) */
  const GR_SW = (i) => V((i % 17 - 8) * 1.72, 0.5, -22.6 + Math.floor(i / 17) * 1.72);
  const ZC = -13.2, uni = PT.TASTI.filter((k) => k.w === 1), slotCap = {};
  uni.forEach((k, n) => { const r = Math.min(3, Math.floor(n / 16)), c = n < 48 ? n % 16 : n - 48; slotCap[k.id] = V((-8 + c + 0.5) * PT.U, 0, ZC + r * 1.95); });
  { const larghi = PT.TASTI.filter((k) => k.w !== 1).sort((a, b) => b.w - a.w), r3 = [], r4 = []; let s3 = 9, s4 = 0;
    for (const k of larghi) { if (k.w === 2.25 || (k.w === 1.25 && r3.length < 4)) r3.push(k); else r4.push(k); }
    for (const k of r3) { slotCap[k.id] = V((-8 + s3 + k.w / 2) * PT.U, 0, ZC + 3 * 1.95); s3 += k.w; }
    for (const k of r4) { slotCap[k.id] = V((-8 + s4 + k.w / 2) * PT.U, 0, ZC + 4 * 1.95); s4 += k.w; } }
  const slotStab = [V(-2.9, 0.5, -33.4), V(0.75, 0.5, -33.4), V(4.4, 0.5, -33.4), V(0.75, 0.5, -35.8)];
  const PIATTO = V(0.75, 0, -30.2), TE0 = V(-11.2, 0, -36.6), TE1 = V(15.6, 0, 2.3), BOTT = V(17.7, 0, 7.3);
  const nomiAtt = ['cacciavite', 'pinzette', 'estrattore', 'saldatore', 'pennello'], slotAtt = {};
  nomiAtt.forEach((n, i) => { slotAtt[n] = { p: V(9.2 + i * 2.15, P.att[n].userData.r0 * ATT, -28.2 - (n === 'estrattore' ? 1.2 : 0)), q: Q(-Math.PI / 2, (hash(i + 3) - 0.5) * 0.08, 0), s: ATT }; });
  const FIN = { p: ponte.position.clone(), q: qK.clone() };                       /* un pezzo modellato nelle coordinate del ponte, a posto */

  /* ================================================================ battute 1 e 2: la faccia, la piega, la scatola */
  const CF = V(0, 9.2, 5), AF = 0.67, hT = BN.TESS.h, pT = BN.TESS.passo, mF = new THREE.Matrix4(), mL = new THREE.Matrix4(), mT = new THREE.Matrix4(), e3 = new THREE.Euler();
  function tessereA(t) {
    const vola = eIO(seg(t, 2.0, 2.32)), o = tv.lerpVectors(CF, tv2.set(bx, H, bz), vola); o.y += 7 * 4 * vola * (1 - vola) * 0.5;
    const cresce = lerp(1, (BN.SCAT.W + 0.03) / BN.TESS.W, vola), schiaccia = lerp(1, 3.6 / (8 * hT), smooth(seg(t, 2.05, 2.32)));
    mF.makeRotationFromEuler(e3.set(AF * (1 - vola), 0, 0)).setPosition(o);
    const c1 = eIO(seg(t, T.piega, T.piega + 0.34)), c2 = eIO(seg(t, T.piega + 0.16, T.piega + 0.5)), r1 = eIO(seg(t, T.piega + 0.52, T.piega + 0.84)), r2 = eIO(seg(t, T.piega + 0.68, T.piega + 1.0));
    P.tessere.forEach((m, i) => {
      const c = i % 3 - 1, r = Math.floor(i / 3) - 1; m.visible = t < 2.32;
      mL.identity();
      /* le file: quella in alto gira dietro attorno al cardine a -2h, quella in basso attorno al cardine a -3,5h */
      if (r !== 0) { const yh = r < 0 ? -2 * hT : -3.5 * hT, zh = r * pT / 2, a = (r < 0 ? -1 : 1) * Math.PI * (r < 0 ? r1 : r2); mL.multiply(mT.makeTranslation(0, yh, zh)).multiply(mT.makeRotationX(a)).multiply(mT.makeTranslation(0, -yh, -zh)); }
      /* le colonne: quella di sinistra gira dietro la centrale, quella di destra dietro a tutte e due */
      if (c !== 0) { const a = (c < 0 ? 1 : -1) * Math.PI * (c < 0 ? c1 : c2), xh = c * pT / 2; mL.multiply(mT.makeTranslation(xh, c > 0 ? -hT * c2 : 0, 0)).multiply(mT.makeRotationZ(a)).multiply(mT.makeTranslation(-xh, 0, 0)); }
      mL.multiply(mT.makeTranslation(c * pT, 0, r * pT));
      /* in volo la pila si schiaccia (diventa il corpo della scatola) e si allarga un filo */
      m.matrix.copy(mF).multiply(mT.makeScale(cresce, 1, cresce)).multiply(mT.makeScale(1, i === 4 ? 1 : schiaccia, 1)).multiply(mL);
      m.matrixAutoUpdate = false; m.matrixWorldNeedsUpdate = true;
    });
    /* la scatola: nasce dove atterra la pila, con uno schiacciamento; poi dondola quando Dot fruga */
    const s = P.scatola; s.visible = t >= 2.32; if (!s.visible) return;
    const tau = t - 2.32, k = tau < 0.4 ? 0.16 * Math.exp(-tau / 0.07) * Math.cos(tau * 30) : 0; s.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5); s.rotation.z = 0; s.position.y = 0;
    const fruga = (a, b) => { const u = seg(t, a, b); if (u > 0 && u < 1) { s.rotation.z = 0.075 * Math.sin(u * TAU * 2.5) * Math.sin(Math.PI * u); s.scale.y *= 1 + 0.04 * Math.sin(u * TAU * 3); } };
    fruga(3.38, 3.62); fruga(18.98, 19.42);
    let lid = t < 2.86 ? 0 : 1.95 * eBack(seg(t, 2.86, 3.14), 2.2) * (1 - eIO(seg(t, 14.5, 14.72))) + (t > 14.72 ? 0.07 * Math.exp(-(t - 14.72) / 0.05) * Math.sin((t - 14.72) * 40) + 1.95 * eBack(seg(t, 18.72, 18.92), 2.2) : 0);
    if (t > T.fuori && t < T.guscio) lid += 0.06 * Math.sin(t * 31);         /* mentre i pezzi escono il coperchio trema */
    s.userData.apri(lid);
  }

  /* ================================================================ battuta 4: fuori tutto, in ordine */
  { /* il tè per primo (le priorità), poi gli attrezzi, gli stabilizzatori, il piattino e le viti, gli switch, i tasti */
    const te = via(P.bicchiere); te.va(3.64, 4.02, { p: TE0, q: Q() }, { da: esce(), h: 5, molla: 0.12 }); posa(TE0, 4.02, 0.5);
    te.va(6.0, 6.2, { p: TE1, q: Q() }, { h: 6, molla: 0.1 }); posa(TE1, 6.2, 0.5);
    nomiAtt.forEach((n, i) => { const t0 = 3.74 + i * 0.075, a = slotAtt[n]; via(P.att[n]).va(t0, t0 + 0.4, a, { da: esce(Q(-1.2, 1, 0.6)), h: 9, giri: 1.5, asse: X, molla: 0.07 }); posa(a.p.clone().setZ(a.p.z - 2.5), t0 + 0.4, 0.55); P.att[n].userData.via = vie[vie.length - 1]; });
    P.stab.forEach((s, i) => { const t0 = 4.14 + i * 0.06; s.userData.via = via(s).va(t0, t0 + 0.36, { p: slotStab[i], q: Q() }, { da: esce(), h: 7, giri: 1, asse: Z }); posa(slotStab[i], t0 + 0.36, i === 3 ? 1.1 : 0.8); });
    via(P.piattino).va(4.08, 4.42, { p: PIATTO, q: Q(), s: 0.8 }, { da: esce(), h: 6, giri: 1, asse: AX }); posa(PIATTO, 4.42, 1.3);
    P.viti.forEach((m, i) => { const a = i * TAU / 6 + 0.4, t0 = 4.44 + i * 0.05; m.userData.via = via(m).va(t0, t0 + 0.3, { p: V(PIATTO.x + 0.62 * Math.cos(a), 0.3, PIATTO.z + 0.62 * Math.sin(a)), q: Q(0, a * 2.3, Math.PI / 2) }, { da: esce(), h: 7, giri: 2, asse: X, molla: 0.2 }); });
    P.sw.forEach((m, i) => { const t0 = 4.42 + i * 0.0083, a = GR_SW(i), d = a.distanceTo(BOCCA); m.userData.via = via(m).va(t0, t0 + 0.34, { p: a, q: Q() }, { da: esce(), h: 3 + d * 0.2, giri: 1, asse: i % 2 ? X : Z, molla: 0.14 }); posa(a, t0 + 0.34, 0.9); });
    PT.TASTI.forEach((k, n) => { const m = P.caps[k.id], t0 = 5.0 + n * 0.0082, a = slotCap[k.id], d = a.distanceTo(BOCCA); m.userData.via = via(m).va(t0, t0 + 0.32, { p: a, q: Q() }, { da: esce(), h: 3 + d * 0.22, giri: 1, asse: n % 2 ? Z : X, molla: 0.16 }); if (k.w < 2) posa(a, t0 + 0.32, 1.05); });
  }
  /* ================================================================ battute 5, 6, 7: guscio, scheda e viti, stabilizzatori e piastra */
  const KP = ponte.position, sbieco = (dx, dz, a) => ({ p: V(KP.x + dx, KP.y, KP.z + dz), q: qK.clone().premultiply(Q(0, a, 0)) });
  const lungo = Q(0, 0, Math.PI / 2);                                             /* una lastra che esce dalla scatola: di taglio */
  via(P.guscio).va(5.94, 6.36, sbieco(1.5, -1.0, 0.085), { da: esce(lungo), h: 19, molla: 0.05 }).va(6.47, 6.53, sbieco(0.5, -0.35, 0.03), { e: eOut, molla: 0.03 }).va(6.6, 6.66, FIN, { e: eOut, molla: 0.03 });
  [[-15, 8], [15, 8], [-15, 17], [15, 17]].forEach((c) => posa(V(c[0], 0, c[1]), 6.36, 0.9));
  via(P.scheda).va(6.84, 7.22, { p: V(KP.x, KP.y + 0.7, KP.z - 0.2), q: qK.clone().multiply(Q(0.06, 0, 0.035)) }, { da: esce(lungo), h: 19, molla: 0.04 }).va(7.28, 7.34, FIN, { e: eOut, molla: 0.05, premi: 0.05 });
  const ordV = [0, 2, 4, 5, 3, 1], tVite = PT.VITI.map((v, i) => 7.38 + ordV.indexOf(i) * 0.093);   /* la fila dietro da sinistra a destra, poi quella davanti al ritorno */
  P.viti.forEach((m, i) => { const v = PT.VITI[i], su = { p: D(v[0], 0.0, v[1]), q: qK.clone() }, giu = { p: D(v[0], -0.5, v[1]), q: qK.clone() }; m.userData.via.va(tVite[i], tVite[i] + 0.15, su, { h: 5, giri: 1, asse: X, molla: 0 }).va(tVite[i] + 0.16, tVite[i] + 0.28, giu, { giri: 4, asse: AX, molla: 0 }); });
  const tStab = P.stab.map((s, i) => 8.22 + i * 0.1);
  P.stab.forEach((s, i) => { const k = s.userData.tasto; s.userData.via.va(tStab[i], tStab[i] + 0.2, { p: D(k.x, 0, k.z), q: qK.clone() }, { h: 6, molla: 0.06, premi: 0.08 }); });
  via(P.piastra).va(8.66, 9.04, { p: V(KP.x, KP.y + 0.5, KP.z), q: qK.clone().multiply(Q(-0.05, 0, 0)) }, { da: esce(lungo), h: 19, molla: 0.03 }).va(9.1, 9.16, FIN, { e: eOut, molla: 0.04, premi: 0.04 });
  /* ================================================================ battuta 8: gli switch, una fila alla volta (un'onda, avanti e indietro) */
  const file = [0, 1, 2, 3, 4].map((r) => PT.TASTI.filter((k) => k.row === r)), tSw = {}, tCap = {};
  file.forEach((f, r) => { const t0 = T.sw + 0.02 + r * 0.39; f.forEach((k, j) => { const jj = r % 2 ? f.length - 1 - j : j, tl = t0 + (jj / f.length) * 0.25; tSw[k.id] = tl + 0.15;
    P.sw[k.id].userData.via.va(tl, tl + 0.15, { p: D(k.x, 0, k.z), q: qK.clone() }, { h: 3.2, molla: 0.05, premi: 0.11 }); }); });
  /* ================================================================ battuta 9: i tasti; per ultimi le lettere di imad.chat, e il punto d'oro */
  const nome = PT.ORDINE_NOME, speciale = (k) => k.kind === 's' || k.kind === 'o';
  file.forEach((f, r) => { const t0 = T.tasti + 0.02 + r * 0.29; f.forEach((k, j) => { if (speciale(k)) return; const jj = r % 2 ? j : f.length - 1 - j, tl = t0 + (jj / f.length) * 0.19; tCap[k.id] = tl + 0.14;
    P.caps[k.id].userData.via.va(tl, tl + 0.14, { p: D(k.x, PT.ALTEZZA_TASTO, k.z), q: qK.clone() }, { h: 3.4, molla: 0.06, premi: 0.1 }); }); });
  nome.forEach((k, i) => { const tl = 12.84 + i * 0.085; tCap[k.id] = tl + 0.2; P.caps[k.id].userData.via.va(tl, tl + 0.2, { p: D(k.x, PT.ALTEZZA_TASTO, k.z), q: qK.clone() }, { h: 6.5, giri: 1, asse: X, molla: 0.1, premi: 0.14 }); });
  const kO = PT.PUNTO, T_PUNTO = { prende: 13.44, su: 13.52, giu: 13.72, posato: 13.86 }, finPunto = { p: D(kO.x, PT.ALTEZZA_TASTO, kO.z), q: qK.clone() };
  tCap[kO.id] = T_PUNTO.posato;

  /* ================================================================ Dot: le pose a scatti del timelapse, poi i movimenti a tempo vero */
  const K = [], k = (t, s) => { s.t = t; K.push(s); return s; };
  const suPonte = (x, ys, zd) => { const p = D(x, ys, zd); return { x: p.x, y: p.y, z: p.z }; };
  const cammino = 3.6;                                                           /* il corridoio dietro la tastiera */
  /* -- battuta 3: scende dai riquadri di sopra, guarda la scatola, salta dentro */
  k(2.3, { x: -7.4, y: 62, z: -31.6, pose: 'air', yaw: Y.left, pitch: -0.3, grounded: false, liscio: (u) => u * u, look: [0.3, -0.3] });
  k(2.74, { x: -8.6, y: 0, z: -31.6, pose: 'land', yaw: Y.left, liscio: eOut });
  k(2.84, { x: -8.6, y: 0, z: -31.6, pose: 'crouch', yaw: Y.left, liscio: eIO, look: [0.2, 0.1] });
  k(2.98, { x: -8.6, y: 0, z: -31.6, pose: 'wiggle', yaw: Y.left, pupil: 1, liscio: eIO, look: [0.1, 0.15], swish: 0.6 });
  k(3.12, { x: -8.6, y: 0, z: -31.6, pose: 'wiggle', yaw: Y.left, pupil: 1, liscio: lin, salto: 5.5, grounded: false });
  k(3.36, { x: bx, y: 4.4, z: bz - 0.2, pose: 'air', yaw: Y.left, pitch: 0.5, grounded: false, liscio: (u) => u * u, ombra: 0 });
  k(3.5, { x: bx, y: -9, z: bz - 0.2, pose: 'air', yaw: Y.left, pitch: 0.9, grounded: false, ombra: 0, via: true });
  /* -- battuta 4: dentro la scatola, le zampe sull'orlo: lancia */
  { const giro = ['peek', 'push', 'push-touch', 'push-sweep']; let n = 0;
    for (let t = T.fuori + 0.02; t < T.guscio - 0.04; t += 0.1 + 0.02 * (hash(n) - 0.5), n++) {
      const g = n % 8, f = g >= 4; k(t, { passo: 1, x: bx + (hash(n + 9) - 0.5) * 0.7, y: H, z: bz + BN.SCAT.W / 2 - 0.34, pose: giro[g % 4], flip: f, clipY: 0, paws: 1, edge: 'top', pupil: 1, look: [(f ? 1 : -1) * (0.25 + 0.5 * hash(n + 2)), 0.1 + 0.2 * hash(n + 5)], gaze: [(f ? -1 : 1) * 0.6, 0.3], tassel: (n % 2 ? 1 : -1) * 0.5, over: g % 4 === 0 ? { dy: 15.4 } : {} }); } }
  /* -- battuta 5: salta fuori, guarda il guscio arrivare, lo mette in squadra con due spinte */
  k(5.9, { passo: 1, x: -11.5, y: 6, z: -21, pose: 'air', yaw: Y.right, pitch: 0.2, grounded: false, ombra: 0.3, suolo: 0 });
  k(6.0, { passo: 1, x: -7.6, y: 4.5, z: -4, pose: 'air', yaw: Y.right, pitch: -0.25, grounded: false, ombra: 0.5, suolo: 0 });
  k(6.1, { passo: 1, x: -6, y: 0, z: 0.4, pose: 'land', yaw: Y.right });
  k(6.2, { passo: 1, x: -6, y: 0, z: 0.4, pose: 'sit', yaw: Y.viewRight, look: [-0.5, 0.5], gaze: [0.4, 0.8], pupil: 1 });
  k(6.32, { passo: 1, x: -6.4, y: 0, z: 0.4, pose: 'puddle', yaw: Y.right, look: [-0.3, 0.3], gaze: [0.2, 0.9], pupil: 0.5, over: { ear: 0.7, eye: 1.2, lid: 0 } });
  k(6.43, { passo: 1, x: -10, y: 0, z: 5.6, pose: 'premi2', gaze: [0, -0.8], tassel: 0.5 });
  k(6.56, { passo: 1, x: 9, y: 0, z: 5.6, pose: 'premi2', flip: true, gaze: [0, -0.8], tassel: -0.5 });
  k(6.7, { passo: 1, x: 2, y: 0, z: 0.4, pose: 'sit', yaw: Y.viewLeft, look: [0.6, 0.45], gaze: [-0.6, 0.6] });
  /* -- battuta 6: la scheda arriva, la preme; poi le viti, una a una, col cacciavite; due punti di saldatura */
  k(6.86, { passo: 1, x: 2, y: 0, z: 0.4, pose: 'sit', yaw: Y.viewLeft, look: [0.3, 0.6], gaze: [-0.3, 0.9], pupil: 1 });
  k(7.0, { passo: 1, x: 1.6, y: 0, z: 0.4, pose: 'crouch', yaw: Y.left, look: [0.1, 0.3] });
  k(7.14, { passo: 1, x: 0.5, y: 0, z: 0.6, pose: 'wiggle', yaw: Y.left, pupil: 1 });
  k(7.26, { passo: 1, ...suPonte(0, 0.2, -2.2), pose: 'premi2', gaze: [0, -0.9], tassel: 0.4 });
  ordV.forEach((i, n) => { const v = PT.VITI[i], f = n >= 3; k(tVite[i] - 0.02, { passo: 1, ...suPonte(v[0] + (f ? 1.3 : -1.3), -0.5, v[1] - 0.35), pose: 'tiene', flip: f, gaze: [0.3, -0.9], tassel: n % 2 ? 0.5 : -0.5, porta: { cosa: 'cacciavite', punta: D(v[0], -0.5 + (n % 2 ? 0.14 : 0.3), v[1]), gira: n * 1.7 }, over: n % 2 ? { f0y: 12.5, f1y: 10 } : {} }); });
  k(7.4 + 6 * 0.093, { passo: 1, ...suPonte(11.6, -0.5, 1.2), pose: 'sip', flip: true, porta: { cosa: 'bicchiere', bevi: 1 } });                  /* un sorso */
  const SALD = [D(-3.0, -0.5, 3.15), D(-1.4, -0.5, 3.15)];
  SALD.forEach((p, n) => k(8.02 + n * 0.09, { passo: 1, ...suPonte(-4.4 + n * 1.5, -0.5, 1.3), pose: n ? 'premiB' : 'premiA', gaze: [0.5, -0.9], pupil: 0.6, tassel: n ? 0.4 : -0.4, porta: { cosa: 'saldatore', punta: p, mano: [9, 6], luce: 1 } }));
  /* -- battuta 7: gli stabilizzatori con le pinzette, la piastra, due colpetti agli angoli, la fronte */
  P.stab.forEach((s, i) => { const q = s.userData.tasto, f = q.x > 0; k(tStab[i] + 0.04, { passo: 1, ...suPonte(q.x + (f ? 2.6 : -2.6), -0.5, Math.max(-3.4, q.z - 1.2)), pose: i % 2 ? 'premiA' : 'premiB', flip: f, gaze: [0.5, -0.8], tassel: i % 2 ? 0.5 : -0.5, porta: { cosa: 'pinzette', punta: D(q.x + (f ? 1 : -1) * 0.4, 0.5, q.z + 0.5), mano: [8, 4] } }); });
  k(8.66, { passo: 1, x: -4, y: 0, z: 0.4, pose: 'sit', yaw: Y.viewRight, look: [-0.5, 0.5], gaze: [0.5, 0.8], pupil: 1 });
  k(8.8, { passo: 1, x: -4, y: 0, z: 0.4, pose: 'yawn', yaw: Y.viewRight });                                                                 /* uno sbadiglio */
  k(8.94, { passo: 1, x: -3.6, y: 0, z: 0.4, pose: 'puddle', yaw: Y.right, look: [-0.3, 0.3], gaze: [0.2, 0.9], pupil: 0.6, over: { ear: 0.7, eye: 1.2, lid: 0 } });
  k(9.08, { passo: 1, ...suPonte(-12.4, 0.45, -5.0), pose: 'premiA', gaze: [0.3, -0.9] });
  k(9.17, { passo: 1, ...suPonte(12.4, 0.45, -5.0), pose: 'premiB', flip: true, gaze: [0.3, -0.9] });
  k(9.25, { passo: 1, x: 6, y: 0, z: cammino, pose: 'asciuga', yaw: Y.viewLeft });
  /* -- battute 8 e 9: segue l'onda; la zampa corre lungo la fila */
  function segui(t0, t1, r, ys, dir, seme) {
    const z = (r - 2) * PT.U, zd = Math.max(z - 1.55, -5.0), yy = zd < -4.6 ? 0.45 : ys; let n = 0;
    for (let t = t0; t < t1 - 0.05; t += 0.098 + 0.016 * (hash(n + seme) - 0.5), n++) {
      const u = sat((t + 0.07 - t0) / (t1 - t0)), x = lerp(-13.2, 13.2, dir > 0 ? u : 1 - u);
      k(t, { passo: 1, ...suPonte(x, yy, zd), pose: n % 2 ? 'premiA' : 'premiB', flip: dir < 0, gaze: [0.35, -0.9], tassel: n % 2 ? 0.55 : -0.55, over: n % 3 === 0 ? { hp: -0.42 } : {} });
    }
  }
  for (let r = 0; r < 5; r++) segui(T.sw + 0.02 + r * 0.39, T.sw + 0.02 + r * 0.39 + 0.38, r, 0.86, r % 2 ? -1 : 1, r * 7);
  for (let r = 0; r < 5; r++) segui(T.tasti + 0.02 + r * 0.29, T.tasti + 0.02 + r * 0.29 + 0.28, r, 1.5, r % 2 ? 1 : -1, r * 5 + 40);
  /* le piccole cose di un lavoro lungo: un sorso, un pisolino di un attimo, il fez che cade e torna su */
  const sost = (t, s) => { let b = 0; K.forEach((q, i) => { if (Math.abs(q.t - t) < Math.abs(K[b].t - t)) b = i; }); const q = K[b]; K[b] = Object.assign({ t: q.t, passo: 1, x: q.x, y: q.y, z: q.z }, s); };
  sost(10.06, { ...suPonte(12.6, 0.86, -1.6), pose: 'sip', flip: true, porta: { cosa: 'bicchiere', bevi: 1 } });
  sost(10.84, { pose: 'sleep', yaw: Y.viewRight });
  sost(11.9, { pose: 'premi2', fez: false, fezGiu: [13, 0], gaze: [0.8, -0.6], over: { ear: 0.5 } });
  sost(12.0, { pose: 'asciuga', yaw: Y.viewRight, over: { eye: 1, lid: 0, f0y: 27, hp: 0.05 } });
  sost(12.45, { ...suPonte(12.6, 1.5, -1.2), pose: 'sip', flip: true, porta: { cosa: 'bicchiere', bevi: 1 } });
  /* le lettere: una posa per ognuna, davanti al tasto */
  nome.forEach((q, i) => k(12.86 + i * 0.085, { passo: 1, ...suPonte(q.x + (i % 2 ? 1.6 : -1.6), 1.5, q.z - 1.6), pose: i % 2 ? 'premiA' : 'premiB', flip: !!(i % 2), gaze: [0.4, -0.9], pupil: 1, tassel: i % 2 ? 0.5 : -0.5 }));
  /* il punto d'oro: lo alza, lo guarda, lo posa. Qui il timelapse finisce: il tempo torna vero */
  const pp = suPonte(kO.x - 0.2, 1.5, kO.z - 1.7);
  k(T_PUNTO.prende, { ...pp, pose: 'tiene', gaze: [0, -0.6], pupil: 1, liscio: eOut });
  k(T_PUNTO.su, { ...pp, pose: 'alza', gaze: [0, -0.75], pupil: 1, liscio: eIO, over: {} });
  k(T_PUNTO.giu - 0.04, { ...pp, pose: 'alza', gaze: [0, -0.75], pupil: 1, liscio: eIO });
  k(T_PUNTO.posato, { ...pp, pose: 'premi2', gaze: [0, -0.9], pupil: 0.9, liscio: eIO });
  /* -- battuta 10: scende, va alla spina, la infila; una scintilla; si siede accanto alla tastiera */
  k(14.02, { ...pp, pose: 'crouch', yaw: Y.left, liscio: lin, salto: 3.2, grounded: false });
  k(14.24, { x: 0.5, y: 0, z: cammino, pose: 'land', yaw: Y.left, liscio: eOut });
  k(14.3, { x: 0.2, y: 0, z: cammino, pose: 'stand', yaw: Y.left, walk: 0, speed: 150, liscio: lin, look: [0.2, 0] });
  k(14.62, { x: -10.6, y: 0, z: cammino + 0.2, pose: 'stand', yaw: Y.left, walk: 2.2, speed: 150, liscio: eOut, look: [0.2, -0.1] });
  k(14.72, { x: -11.2, y: 0, z: 4.6, pose: 'wiggle', yaw: Y.left, liscio: eIO, gaze: [-0.8, -0.2], pupil: 1 });
  k(14.94, { x: -10.4, y: 0, z: 5.5, pose: 'stretch', yaw: Y.left, liscio: eIO, over: { eye: 1.1, hp: 0.05, te: 0.9 }, pupil: 1 });
  k(15.0, { x: -10.2, y: 0, z: 5.5, pose: 'startle', yaw: Y.left, liscio: eIO, pupil: 0.4 });
  k(15.16, { x: -8.4, y: 0, z: cammino, pose: 'sit', yaw: Y.viewRight, liscio: eIO });
  /* -- battuta 11: seduto, guarda i tasti che scendono (lo sguardo lo mette applica) */
  k(15.3, { x: -8.4, y: 0, z: cammino, pose: 'sit', yaw: Y.viewRight, guarda: true, liscio: lin });
  /* -- battuta 12: corre alla scatola, ci salta dentro, esce col bottone in bocca, lo posa accanto alla tastiera */
  k(18.2, { x: -8.4, y: 0, z: cammino, pose: 'sit', yaw: Y.viewRight, liscio: eIO });
  k(18.34, { x: -8.6, y: 0, z: cammino - 0.4, pose: 'stand', yaw: Y.backLeft, walk: 0, speed: 170, liscio: lin });
  k(18.78, { x: -10.6, y: 0, z: -29.6, pose: 'stand', yaw: Y.backLeft, walk: 3, speed: 170, liscio: eIO });
  k(18.84, { x: -10.8, y: 0, z: -30, pose: 'wiggle', yaw: Y.left, liscio: lin, salto: 5, grounded: false });
  k(19.04, { x: bx, y: 4.4, z: bz - 0.2, pose: 'air', yaw: Y.left, pitch: 0.5, grounded: false, liscio: (u) => u * u, ombra: 0 });
  k(19.14, { x: bx, y: -9, z: bz - 0.2, pose: 'air', yaw: Y.left, grounded: false, ombra: 0, via: true });
  k(19.44, { x: bx, y: H, z: bz + BN.SCAT.W / 2 - 0.34, pose: 'peek', clipY: 0, paws: 1, edge: 'top', pupil: 1, look: [-0.3, 0.1], bocca: true, liscio: lin, over: { dy: 15.4 } });
  k(19.6, { x: bx, y: H, z: bz + BN.SCAT.W / 2 - 0.34, pose: 'peek', clipY: 0, paws: 1, edge: 'top', pupil: 1, look: [-0.5, 0.2], bocca: true });
  k(19.62, { x: bx + 0.6, y: H + 0.4, z: bz + 1.2, pose: 'air', yaw: Y.right, pitch: 0.3, grounded: false, bocca: true, liscio: lin, salto: 4, ombra: 0.3, suolo: 0 });
  k(19.86, { x: -9.4, y: 0, z: -26.5, pose: 'land', yaw: Y.right, bocca: true, liscio: eOut });
  k(19.94, { x: -9, y: 0, z: -26, pose: 'stand', yaw: Y.right, walk: 0, speed: 190, bocca: true, liscio: lin });
  k(20.56, { x: 16.6, y: 0, z: 4.8, pose: 'stand', yaw: Y.right, walk: 4.6, speed: 190, bocca: true, liscio: eOut });
  k(20.66, { x: 17.1, y: 0, z: 5.6, pose: 'tiene', bocca: true, liscio: eIO, gaze: [0, -0.6] });
  k(20.84, { x: 17.1, y: 0, z: 5.6, pose: 'premi2', liscio: eIO, gaze: [0, -0.8], pupil: 1 });
  k(21.02, { x: 17.1, y: 0, z: 5.6, pose: 'premiB', liscio: eIO, gaze: [0, 0], pupil: 1, look: [0, 0.12], over: { hp: 0.0, hr: -0.2 } });
  k(21.2, { x: 17.1, y: 0, z: 5.6, pose: 'premiB', liscio: eIO, gaze: [0, 0], pupil: 1, look: [0, 0.12], over: { hp: 0.0, hr: -0.2 } });
  k(21.38, { x: 16.4, y: 0, z: 4.9, pose: 'sit', yaw: Y.viewLeft, pupil: 1 });
  K.sort((a, b) => a.t - b.t);

  /* gli attrezzi: dalla fila alla zampa e ritorno, con due archi veloci */
  const uso = {}; K.forEach((q) => { if (q.porta && P.att[q.porta.cosa]) { const u = uso[q.porta.cosa] || (uso[q.porta.cosa] = { t0: q.t, t1: q.t }); u.t1 = q.t + 0.1; } });

  /* -- il riordino: finito il lavoro, attrezzi, piattino e bicchiere rientrano nella scatola (poi il coperchio si chiude) */
  { const dentro = (q) => ({ p: BOCCA.clone(), q: q || Q(), s: 0.3 });
    nomiAtt.forEach((n, i) => P.att[n].userData.via.va(13.96 + i * 0.06, 14.3 + i * 0.06, dentro(Q(-1.2, 1, 0.6)), { h: 9, giri: 1.5, asse: X, via: true }));
    vie.find((v) => v.o === P.piattino).va(14.2, 14.5, dentro(), { h: 6, giri: 1, via: true }); vie.find((v) => v.o === P.bicchiere).va(14.26, 14.52, dentro(), { h: 7, via: true }); }
  /* ================================================================ il cavo */
  const yP = D(-12.5, -0.45, -PT.CASSA.D / 2).y;
  P.cavo = PT.cavo([[bx, 0.42, bz + 1.9], [bx, 0.3, bz + 3.1], [-16.4, 0.17, bz + 5.3], [-17.4, 0.17, bz + 7.9], [-17.4, 0.17, -16], [-17.4, 0.17, -4], [-17.4, 0.17, 0.4], [-16.9, 0.17, 1.3], [-15.6, 0.2, 2.1], [-13.7, 0.5, 2.7], [-12.75, 1.45, 3.4], [-12.5, yP, 4.2], [-12.5, yP, D(-12.5, -0.45, -PT.CASSA.D / 2).z + 0.02]], sc.M, { s1: 12, s2: 22.5, giri: 28, sBar: 8.6 });
  sc.scene.add(P.cavo);
  const U_FERMO = 0.83, cavoU = (t) => (t < 4.3 ? 0 : t < T_SPINA.a ? U_FERMO * eOut(seg(t, 4.3, 4.92)) : lerp(U_FERMO, 1, eIO(seg(t, T_SPINA.a, T_SPINA.b))));
  const PORTA = D(-12.5, -0.45, -PT.CASSA.D / 2);

  /* ================================================================ la cinepresa e la scrittura */
  const CAM = {
    faccia: { tx: 0, ty: 8.2, tz: 4.4, larg: 21.5, alt: 30, pitch: 0.9, su: 0 }, largo: { tx: 0, ty: 0, tz: -9.2, larg: 41.6, alt: 64, pitch: 0.96, su: 0 }, banco: { tx: 0, ty: 0, tz: -4.4, larg: 40.6, alt: 58, pitch: 0.96, su: 0 },
    cantiere: { tx: 0, ty: 0, tz: -8.4, larg: 36.8, alt: 60, pitch: 0.93, su: 0 }, finita: { tx: 0, ty: 1.2, tz: 8.5, larg: 33.5, alt: 32, pitch: 0.58, su: 0.09 }, contatto: { tx: 0, ty: 1.2, tz: 8.5, larg: 34.5, alt: 34, pitch: 0.6, su: 0.15 }, bottone: { tx: 16.3, ty: 3.1, tz: 6.6, larg: 11, alt: 12, pitch: 0.6, su: 0 }
  };
  const camK = [[0, 'faccia'], [1.9, 'faccia'], [2.5, 'largo'], [5.9, 'largo'], [7.0, 'cantiere'], [13.4, 'cantiere'], [15.1, 'finita'], [15.3, 'finita'], [16.0, 'contatto'], [18.2, 'contatto'], [18.8, 'largo'], [20.1, 'largo'], [20.8, 'bottone'], [99, 'bottone']];
  function camA(t) { let i = 0; while (i < camK.length - 2 && camK[i + 1][0] <= t) i++; const a = CAM[camK[i][1]], b = CAM[camK[i + 1][1]], u = eIO(seg(t, camK[i][0], camK[i + 1][0])), o = {}; for (const q in a) o[q] = lerp(a[q], b[q], u); o.dx = -0.07 * Math.min(seg(t, 15.1, 16), 1 - seg(t, 18.2, 18.8)); return o; }   /* dx: su uno schermo largo la scena si sposta a sinistra (dove stanno la scatola e Dot), il titolo sta a destra */
  const SCRIVE = 'ciao imad, ', battiti = []; { let t = 15.95; for (const ch of SCRIVE) { battiti.push({ t, ch, k: PT.tastoDi(ch === ' ' ? ' ' : ch) }); t += ch === ' ' ? 0.15 : 0.085 + 0.05 * hash(battiti.length); } }
  const vivi = {};                                                                /* i tasti premuti davvero (prova dal vivo): codice → momento */
  const giuDi = (dt) => (dt < 0 ? 0 : dt < 0.045 ? dt / 0.045 : dt < 0.11 ? 1 : dt < 0.27 ? 1 - eOut((dt - 0.11) / 0.16) : 0);

  /* ================================================================ lo stato di Dot al tempo t */
  const mix = (a, b, u) => (a == null && b == null ? undefined : lerp(a == null ? 0 : a, b == null ? 0 : b, u)), pair = (a, b, u) => [mix(a && a[0], b && b[0], u), mix(a && a[1], b && b[1], u)];
  function dotA(t) {
    if (t < K[0].t) return null;
    let i = K.length - 1; while (i > 0 && K[i].t > t) i--; const a = K[i], b = K[i + 1];
    if (a.via) return null;
    if (a.passo || !a.liscio || !b) {
      const s = Object.assign({}, a); const scie = [];
      if (a.passo) for (let j = 1; j <= 2; j++) { const q = K[i - j]; if (q && q.passo && !q.via) { const al = (j === 1 ? 0.36 : 0.17) * (1 - sat((t - a.t) / 0.19)); scie.push({ s: q, a: al }); } }
      if (!a.passo) s.t = t;
      return { s, scie };
    }
    const u = seg(t, a.t, b.t), e = a.liscio(u), s = Object.assign({}, u < 0.5 ? a : b);
    s.x = lerp(a.x, b.x, e); s.y = lerp(a.y, b.y, e) + (a.salto ? a.salto * 4 * u * (1 - u) : 0); s.z = lerp(a.z, b.z, e); s.t = t;
    s.pose = a.pose === b.pose ? a.pose : [a.pose, b.pose, e]; s.over = u < 0.5 ? a.over : b.over;
    let ya = a.yaw == null ? Y.front : a.yaw, yb = b.yaw == null ? Y.front : b.yaw; if (yb - ya > Math.PI) yb -= TAU; if (ya - yb > Math.PI) yb += TAU; s.yaw = lerp(ya, yb, e);
    s.pitch = mix(a.pitch, b.pitch, e) || 0; if (a.look && a.look !== 'v' && b.look && b.look !== 'v') s.look = pair(a.look, b.look, e); if (a.gaze || b.gaze) s.gaze = pair(a.gaze, b.gaze, e);
    s.pupil = mix(a.pupil == null ? 0.8 : a.pupil, b.pupil == null ? 0.8 : b.pupil, e); if (a.walk != null && b.walk != null) s.walk = lerp(a.walk, b.walk, u); else if (a.walk != null) s.walk = a.walk;
    s.ombra = mix(a.ombra == null ? 1 : a.ombra, b.ombra == null ? 1 : b.ombra, e); s.grounded = !(a.grounded === false || a.salto);
    if (a.clipY != null && b.clipY == null) { s.clipY = null; s.paws = 0; s.edge = null; }
    return { s, scie: [] };
  }

  /* ================================================================ tutto al tempo t */
  const T_SPINA_ = null; void T_SPINA_;
  function applica(t, vista = {}) {
    const info = { t, battuta: 0 }; for (let i = 0; i < BATTUTE.length; i++) if (t >= T[BATTUTE[i][0]]) info.battuta = i;
    /* l'ora: il timelapse fa un giorno intero e torna ad adesso */
    const uTl = smooth(seg(t, T.fuori, T.cavo)); info.ora = ora0 + 24 * uTl; info.timelapse = t >= T.fuori && t < T.cavo ? 1 : 0;
    const L = sc.illumina(info.ora, vista.cielo);
    const cam = vista.cam || camA(t), cc = sc.cinepresa(cam);
    tessereA(t);
    for (const v of vie) v.applica(t, tq, tv);
    /* il tè cala; il cavo esce; la spia respira; il punto d'oro si accende */
    P.bicchiere.userData.livello(t < 7.96 ? 1 : t < 10.06 ? 0.72 : t < 12.45 ? 0.45 : t < 13.3 ? 0.2 : 0);
    P.cavo.userData.esce(cavoU(t));
    const acc = seg(t, T_SPINA.b + 0.02, T_SPINA.b + 0.5); P.spia.material.emissiveIntensity = acc <= 0 ? 0 : 2.2 * eOut(acc) * (0.62 + 0.38 * Math.sin((t - T_SPINA.b) * 2.4 - 1.2));
    P.scintilla.position.copy(PORTA).add(tv.set(0, 0.1, -0.15)); P.scintilla.userData.a(seg(t, T_SPINA.b - 0.01, T_SPINA.b + 0.13));
    const posato = t >= T_PUNTO.posato; P.alone.visible = posato; if (posato) { const s = 1.5 + 2.2 * Math.exp(-(t - T_PUNTO.posato) / 0.25) + 0.12 * Math.sin(t * 2.1); P.alone.scale.set(s, s, 1); }
    sc.M.oro.emissiveIntensity = 0.35 + (posato ? 0.5 + 0.9 * Math.exp(-(t - T_PUNTO.posato) / 0.3) : 0);
    /* la polvere dove un pezzo si posa: un anello sottile che si allarga e sparisce */
    let n = 0; for (const a of P.anelli) a.visible = false;
    for (const e of polveri) { const d = t - e.t; if (d < 0 || d > 0.24 || n >= P.anelli.length) continue; const a = P.anelli[n++], u = d / 0.24; a.visible = true; a.position.set(e.x, 0.02, e.z); a.scale.setScalar(e.r * (0.92 + 0.38 * eOut(u))); a.material.opacity = (sc.scuro ? 0.2 : 0.26) * (1 - u) * (1 - u); }
    /* i tasti premuti: quelli della storia e quelli veri */
    info.testo = '';
    if (t >= T.contatto) for (const b of battiti) { if (t >= b.t + 0.03) info.testo += b.ch; const g = giuDi(t - b.t); if (g > 0 && b.k) { const m = P.caps[b.k.id]; m.position.addScaledVector(tv.set(0, 1, 0).applyQuaternion(qK), -PT.CORSA * g); } }
    if (vista.ora != null) for (const c in vivi) { const q = PT.tastoDi(c), g = vivi[c].su == null ? giuDi(Math.min(0.09, vista.ora - vivi[c].giu)) : giuDi(0.1 + vista.ora - vivi[c].su); if (q && g > 0) P.caps[q.id].position.addScaledVector(tv.set(0, 1, 0).applyQuaternion(qK), -PT.CORSA * g); }
    /* Dot */
    const d = dotA(t), amb = { pxUnita: cc.pxCm * sc.UN, stira: 1 / Math.cos(cam.pitch), scuro: sc.scuro, giro: cam.giro || 0, sole: L.az };
    let s = d && d.s;
    if (s && s.guarda) {                                                          /* guarda il tasto che scende, poi chi scrive */
      let ult = null; for (const b of battiti) if (t >= b.t - 0.05 && b.k) ult = b; s = Object.assign({}, s);
      if (ult && t - ult.t < 0.5) { s.look = [-0.55 - (ult.k.x + 8.4) * 0.012, -0.22]; s.gaze = [0.5, -0.7]; s.pupil = 1; } else { s.look = 'v'; s.gaze = [0, 0]; }
      s.over = { ear: 0 }; s.blink = Math.abs(((t * 0.37) % 1) - 0.5) < 0.012 ? 0 : 1;
    }
    dot.mostra(s, d && d.scie, amb);
    for (const nm of nomiAtt) if (uso[nm]) { const o = P.att[nm], u = uso[nm]; if (t >= u.t0 - 0.12 && t < u.t0) arco(o, slotAtt[nm], 1 - (u.t0 - t) / 0.12, s); else if (t >= u.t1 && t < u.t1 + 0.14) arco(o, slotAtt[nm], 1 - (t - u.t1) / 0.14, s, true); }
    P.lucina.visible = false; P.bottone.visible = t >= 19.44;
    if (s) {
      const f = dot.fotogramma();
      if (s.porta) {
        const o = s.porta.cosa === 'bicchiere' ? P.bicchiere : P.att[s.porta.cosa];
        if (s.porta.bevi) { dot.punto(s, f.hold.x, f.hold.y - 4.5, amb, o.position); o.quaternion.copy(Q(0.5, 0, (s.flip ? 1 : -1) * 0.5)); o.scale.setScalar(1); }
        else { const m = s.porta.mano, mano = m ? dot.punto(s, m[0], m[1], amb, tv2) : dot.punto(s, f.hold.x, f.hold.y + 3, amb, tv2); punta(o, s.porta.punta, mano, s.porta.gira || 0);
          if (s.porta.luce) { P.lucina.visible = true; P.lucina.position.copy(s.porta.punta); const z = 0.5 + 0.25 * hash(Math.floor(t * 60)); P.lucina.scale.set(z, z, 1); } }
      }
      if (s.bocca) { dot.punto(s, f.mouth.x, f.mouth.y - 5.2, amb, P.bottone.position); P.bottone.position.z += 0.2; P.bottone.quaternion.identity(); P.bottone.scale.setScalar(0.62); }
    }
    /* il punto d'oro tra le zampe, alzato */
    const cp = P.caps[kO.id];
    if (t >= T_PUNTO.prende - 0.1 && t < T_PUNTO.posato && s) {
      const f = dot.fotogramma(), m = dot.punto(s, f.hold.x, f.hold.y - 3.2, amb, tv2), a = eOut(seg(t, T_PUNTO.prende - 0.1, T_PUNTO.prende)), b = eIO(seg(t, T_PUNTO.giu, T_PUNTO.posato));
      cp.visible = true; cp.position.lerpVectors(slotCap[kO.id], m, a).lerp(finPunto.p, b); cp.position.y += 3 * 4 * a * (1 - a); cp.quaternion.copy(Q()).slerp(qK, b); cp.scale.setScalar(1);
    } else if (t >= T_PUNTO.posato) { cp.visible = true; cp.position.copy(finPunto.p); cp.quaternion.copy(qK); const tau = t - T_PUNTO.posato; cp.position.addScaledVector(tv.set(0, 1, 0).applyQuaternion(qK), -0.16 * Math.exp(-tau / 0.04) * Math.cos(tau * 30)); cp.scale.setScalar(1); }
    /* il bottone: in bocca, poi posato con un piccolo salto */
    if (t >= 20.84) { const tau = t - 20.84, q = 0.14 * Math.exp(-tau / 0.05) * Math.cos(tau * 40); P.bottone.visible = true; P.bottone.position.copy(BOTT); P.bottone.scale.set(0.8 * (1 + q * 0.5), 0.8 * (1 - q), 0.8 * (1 + q * 0.5)); P.bottone.quaternion.identity(); }
    else if (t >= 20.66 && s) { const f = dot.fotogramma(), a = eIO(seg(t, 20.66, 20.84)); dot.punto(s, f.mouth.x, f.mouth.y - 5.2, amb, tv2); tv2.z += 0.2; P.bottone.visible = true; P.bottone.position.lerpVectors(tv2, BOTT, a); P.bottone.position.y += 1.2 * 4 * a * (1 - a) * 0.5; P.bottone.quaternion.identity(); P.bottone.scale.setScalar(lerp(0.62, 0.8, a)); }
    else if (t >= 19.44 && !(s && s.bocca)) P.bottone.visible = false;
    info.luce = L; info.cam = cam; info.dot = s; return info;
  }
  /* un attrezzo: la punta sul lavoro, il manico verso la zampa */
  const qT = new THREE.Quaternion(), vT = new THREE.Vector3();
  function punta(o, p, mano, gira) { o.visible = true; o.position.copy(p); vT.subVectors(mano, p); if (vT.y < 0.4) vT.y = 0.4; vT.normalize(); o.quaternion.setFromUnitVectors(AX, vT).multiply(qT.setFromAxisAngle(AX, gira)); o.scale.setScalar(ATT); }
  function arco(o, slot, u, s, torna) { if (!s) return; const a = torna ? 1 - u : u; tv.copy(o.position); o.position.lerpVectors(slot.p, tv.set(s.x, s.y + 3, s.z + 0.4), a); o.position.y += 5 * 4 * a * (1 - a); o.quaternion.copy(slot.q).multiply(qT.setFromAxisAngle(X, a * TAU)); o.scale.setScalar(ATT); }
  return { applica, T, K, CAM, camA, premi(code, ora) { vivi[code] = { giu: ora, su: null }; }, lascia(code, ora) { if (vivi[code]) vivi[code].su = ora; }, tSw, tCap, slotCap, GR_SW, slotStab, slotAtt, FIN, D };
}
const T_SPINA = { a: 14.66, b: 14.95 };
void Z; void eBack;
