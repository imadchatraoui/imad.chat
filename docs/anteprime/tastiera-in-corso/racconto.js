/* racconto.js — la storia della macchina da scrivere: tutto è funzione di un solo tempo t (secondi). Nessuno stato nella
   storia: ogni fotogramma si può rifare uguale. Da «fuori» a «riordino» è il timelapse (Dot scatta di posa ogni decimo di
   secondo, il giorno passa sopra il banco). Meglio della tastiera: ogni pezzo prende la rincorsa, arriva sopra il suo posto,
   entra, va un filo oltre e si assesta; i pezzi pesanti cadono diversi da una molla; un martelletto pende dal suo perno,
   una vite gira mentre entra, il carrello scorre e si ferma con uno scatto, il rullo tira su il foglio riga per riga. */
import * as THREE from 'three';
import { lerp, sat, seg, eOut, eIn, eIO, eBack, smooth, hash, TAU } from './forme.js';
import * as BN from './banco.js';
import { MS, SEG, RULLO, AVVOLTO, MW } from './macchina.js';
import { SCALA_DOT } from './scena.js';

export const T = { faccia: 0, piega: 1.0, salto: 2.3, fuori: 3.6, base: 6.0, mecc: 7.95, leve: 10.2, tasti: 12.25, carrello: 14.8, rullo: 15.95, nastro: 17.2, cofano: 18.5, foglio: 19.95, riordino: 21.35, contatto: 22.55, bottone: 29.8, fine: 33.0 };
export const BATTUTE = [
  ['faccia', 'La faccia di imad.chat, nove tasti.'], ['piega', 'Si piega e diventa la scatola di Dot.'], ['salto', 'Dot arriva e salta dentro.'], ['fuori', 'Fuori tutto, in ordine: pezzi e attrezzi.'],
  ['base', 'La base, pesante. Poi il telaio e due viti.'], ['mecc', 'L’arco dei perni e le leve dei tasti.'], ['leve', 'I martelletti, uno dopo l’altro lungo il ventaglio.'], ['tasti', 'I tasti, fila per fila. Ultimi quelli di imad.chat, e il punto d’oro.'],
  ['carrello', 'Il carrello sulle rotaie: scorre e scatta.'], ['rullo', 'Il rullo, le manopole, la leva del ritorno.'], ['nastro', 'Le bobine, e il nastro infilato nella forcella.'], ['cofano', 'Il cofano, la targhetta, le viti.'],
  ['foglio', 'Il foglio, tirato su riga per riga.'], ['riordino', 'Gli attrezzi tornano nella scatola.'], ['contatto', 'Contattami: scrivi, e la macchina batte sul foglio.'], ['bottone', 'L’ultima cosa dalla scatola: un bottone rosso.']
];
export const FATTORE = 4900;                                    /* 24 ore in 17,75 secondi */
const UP = new THREE.Vector3(0, 1, 0), AX = UP, X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), lin = (u) => u;
const V = (x, y, z) => new THREE.Vector3(x, y, z), Q = (x = 0, y = 0, z = 0, ord = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, ord));
/* un pezzo che cade su un fermo e rimbalza due volte (1 = ancora alzato, 0 = fermo); un saltello che si spegne */
const cade = (tau, d = 0.13) => (tau < 0 ? 1 : tau < d ? 1 - (tau / d) * (tau / d) : tau < d + 0.09 ? 0.16 * Math.sin(Math.PI * (tau - d) / 0.09) : tau < d + 0.15 ? 0.05 * Math.sin(Math.PI * (tau - d - 0.09) / 0.06) : 0);
const rimbalzo = (tau, A, d) => (tau < 0 ? 0 : tau < d ? A * Math.sin(Math.PI * tau / d) : tau < d * 1.6 ? A * 0.3 * Math.sin(Math.PI * (tau - d) / (d * 0.6)) : 0);

/* la via di un pezzo: tratti { t0, t1, da, a }. Prima del primo tratto il pezzo non c'è (è ancora nella scatola).
   h = l'arco; ant = la rincorsa (cm indietro, all'inizio); sopra = arriva sopra il posto e poi entra lungo un asse; oltre = va un
   filo oltre e torna; dondola = pende e si ferma; salta = rimbalza sul banco; avvita = gira mentre scende; zampa = sta tra le zampe di Dot */
class Via {
  constructor(o) { this.o = o; this.s = []; }
  va(t0, t1, a, k = {}) { const prev = this.s[this.s.length - 1]; this.s.push(Object.assign({ t0, t1, da: k.da || (prev ? prev.a : a), a, h: 0, giri: 0, asse: AX, e: eIO, us: 0.72 }, k)); return this; }
  applica(t, C) {
    const o = this.o, s = this.s; if (!s.length || t < s[0].t0) { o.visible = false; return; }
    let i = s.length - 1; while (i > 0 && s[i].t0 > t) i--; const g = s[i], a = g.a, da = g.da;
    if ((a.zampa || da.zampa) && !C.mano) { o.visible = false; return; }
    const pa = a.zampa ? C.a.copy(C.mano).add(a.off || C.zero) : a.p, pda = da.zampa ? C.b.copy(C.mano).add(da.off || C.zero) : da.p, Sa = a.s == null ? 1 : a.s, Sd = da.s == null ? 1 : da.s;
    o.visible = true;
    if (t >= g.t1) {
      if (g.via) { o.visible = false; return; }
      const tau = t - g.t1; o.position.copy(pa); o.quaternion.copy(a.q); let k = 0;
      if (g.molla && tau < 0.3) k = g.molla * Math.exp(-tau / 0.05) * Math.cos(tau * 44);
      o.scale.set(Sa * (1 + k * 0.5), Sa * (1 - k), Sa * (1 + k * 0.5));
      if (g.salta) o.position.y += rimbalzo(tau, g.salta[0], g.salta[1]);
      if (g.oltre && tau < 0.4) o.position.addScaledVector(g.oltre.n, -g.oltre.A * Math.exp(-tau / (g.oltre.sm || 0.045)) * Math.sin(tau * (g.oltre.w || 42)));
      if (g.dondola) { const d = g.dondola, ang = d.f ? d.A * d.f(tau) : tau > d.sm * 7 ? 0 : d.A * Math.exp(-tau / d.sm) * Math.sin(tau * d.w); if (ang) o.quaternion.multiply(C.q.setFromAxisAngle(d.asse, ang)); }
      return;
    }
    const u = (t - g.t0) / (g.t1 - g.t0);
    if (g.avvita) { const w = 1 - (1 - u) * (1 - u); o.position.copy(pa).addScaledVector(C.v.set(0, 1, 0).applyQuaternion(a.q), g.avvita.prof * (1 - w)); o.quaternion.copy(a.q).multiply(C.q.setFromAxisAngle(AX, -g.avvita.giri * TAU * (1 - w))); o.scale.setScalar(Sa); return; }
    let e, uu = u;
    if (g.centro) C.c.copy(g.centro).multiplyScalar(Sa); else C.c.set(0, 0, 0);
    if (g.sopra) { if (u < g.us) { uu = u / g.us; e = g.e(uu); C.v.copy(pa).addScaledVector(g.sopra.n, g.sopra.d); o.position.lerpVectors(pda, C.v, e); } else { const w = (u - g.us) / (1 - g.us); e = 1; uu = 1; o.position.copy(pa).addScaledVector(g.sopra.n, g.sopra.d * (1 - w * w)); } }
    else { e = g.e(u); o.position.lerpVectors(pda, C.v.copy(pa).add(C.c), e); }
    if (g.ant && uu < 0.3) { C.v.subVectors(pa, pda); o.position.addScaledVector(C.v, -g.ant / (C.v.length() || 1) * Math.sin(Math.PI * uu / 0.3)); }
    o.position.y += g.h * 4 * uu * (1 - uu);
    o.quaternion.slerpQuaternions(da.q, a.q, e);
    if (g.giri) o.quaternion.multiply(C.q.setFromAxisAngle(g.asse, g.giri * TAU * (1 - e)));
    if (g.dondola && g.dondola.f) o.quaternion.multiply(C.q.setFromAxisAngle(g.dondola.asse, g.dondola.A * sat(uu * 2.5)));
    const S = g.via ? lerp(Sd, Sa, Math.max(0, u * 2.2 - 1.2)) : lerp(Sd, Sa, Math.min(1, u * 1.6)); o.scale.setScalar(S);
    if (g.centro) {                                                               /* il foglio: leggero, plana ondeggiando attorno al suo centro */
      const k = 1 - u; o.position.x += 3.4 * Math.sin(u * TAU * 1.5) * k; o.position.y += 1.2 * Math.sin(u * TAU * 3 + 1) * k;
      o.quaternion.multiply(C.q.setFromAxisAngle(Z, 0.5 * Math.sin(u * TAU * 1.5 + 1.2) * k)).multiply(C.q.setFromAxisAngle(X, 0.45 * Math.cos(u * TAU * 2) * k - 0.5 * k));
      o.position.sub(C.v.copy(g.centro).multiplyScalar(S).applyQuaternion(o.quaternion));
    }
  }
}

export function creaRacconto(sc, opz = {}) {
  const { P, R, dot, fx } = sc, Y = window.DOT.YAW, ora0 = opz.ora == null ? (sc.scuro ? 22.2 : 10.3) : opz.ora, S = MS.s, SC = SCALA_DOT, TK = R.tasti;
  const BX = -14.6, BZ = -46.5, H = BN.SCAT.H * SC, WB = BN.SCAT.W * SC, BOCCA = V(BX, H + 0.6, BZ), W = (x, y, z) => MW(x, y, z, new THREE.Vector3()), WV = (v) => W(v.x, v.y, v.z);
  const vie = [], EV = [], C = { q: new THREE.Quaternion(), v: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), zero: new THREE.Vector3(), mano: null };
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion();
  const via = (o) => { const v = new Via(o); vie.push(v); o.via = v; return v; };
  const ev = (t, tipo, p, o) => { EV.push(Object.assign({ t, tipo, p: p.clone(), seme: EV.length * 7.31 + 1.7 }, o)); };
  /* le scintille (e la loro luce calda) non sono mai più vicine di 0,34 s l'una all'altra: meno di tre lampi al secondo */
  const lampi = []; const scintilla = (t, p, n = 9, f = 1) => { if (lampi.some((q) => Math.abs(q - t) < 0.34)) { ev(t, 'tic', p, { r: 0.5 }); return; } lampi.push(t); ev(t, 'scintille', p, { n, f }); };
  const esce = (q, s) => ({ p: BOCCA.clone(), q: q || Q(), s: (s == null ? 1 : s) * 0.3 }), lungo = Q(0, 0, Math.PI / 2);
  const FIN = { p: V(0, 0, MS.z), q: Q(), s: S }, sbieco = (dx, dz, a) => ({ p: V(dx, 0, MS.z + dz), q: Q(0, a, 0), s: S });
  P.scatola.position.set(BX, 0, BZ);

  /* ================================================================ dove sta ogni cosa sul banco (la disposizione ordinata) */
  const nomiAtt = ['martello', 'cacciavite', 'oliatore', 'pinzette', 'pennello'], slotAtt = {};
  nomiAtt.forEach((n, i) => { slotAtt[n] = { p: V(-7.4 + i * 2.3, R.att[n].userData.r0, -43.4), q: Q(-Math.PI / 2, (hash(i + 3) - 0.5) * 0.08, 0), s: 1 }; });
  const PIATTO = V(5.6, 0, -44.6), TE0 = V(5.6, 0, -49.3), TE1 = V(16.6, 0, -12.6), BOTT = V(-16.4, 0, 15.2), sPia = { p: PIATTO, q: Q(), s: 1.25 }, sTe0 = { p: TE0, q: Q(), s: 1.6 }, sTe1 = { p: TE1, q: Q(), s: 1.6 };
  const ordL = R.leve.posto.map((q, i) => i).sort((a, b) => R.leve.posto[a].L - R.leve.posto[b].L || a - b);
  const slotLeva = (i) => ({ p: V(-9.2 + ordL.indexOf(i) * 0.39, 0.955, -30.4), q: Q(), s: S }), slotMart = (i) => ({ p: V(-9.03 + (43 - i) * 0.42, 0.22, -17.2), q: Q(), s: S });
  const speciali = 'imad.cht', slotCima = (k) => { const j = speciali.indexOf(k.ch); if (k.ch && j >= 0) return { p: V(12.6 + (j % 4) * 1.72, 0, -25.4 + Math.floor(j / 4) * 1.72), q: Q(), s: S };
    const riga = TK.filter((q) => q.riga === k.riga && q.ch), c = riga.indexOf(k); return { p: V(k.largo ? (k.x < 0 ? -10.5 : 10.5) : (c - (riga.length - 1) / 2) * 1.72, 0, -26.4 + k.riga * 1.72), q: Q(), s: S }; };
  const sBarra = { p: V(0, 0, -19.3), q: Q(), s: S }, sRullo = { p: V(-2.5, 1.42, -40.6), q: Q(), s: S }, sMan = [{ p: V(11.6, 0, -40.6), q: Q(0, 0, Math.PI / 2), s: S }, { p: V(15.0, 0, -40.6), q: Q(0, 0, Math.PI / 2), s: S }];
  const sSeg = { p: V(14.6, 0.68, -33), q: Q(), s: S }, sBob = [{ p: V(10.4, 0, -44.6), q: Q(), s: S }, { p: V(15.2, 0, -44.6), q: Q(), s: S }], sCamp = { p: V(10.4, 0, -49.4), q: Q(), s: S }, sLev = { p: V(15.8, 0.2, -49.8), q: Q(0, 0.5, 0), s: S }, sTarga = { p: V(15.2, 0.03, -21.2), q: Q(), s: S };
  const slotVite = (i) => { const a = i * TAU / 9 + 0.4; return { p: V(PIATTO.x + 0.8 * Math.cos(a), 0.42, PIATTO.z + 0.8 * Math.sin(a)), q: Q(0, a * 2.3, Math.PI / 2), s: S }; };

  /* ================================================================ battute 1 e 2: la faccia, la piega, la scatola (come nella tastiera; qui la scatola è più grande) */
  const CF = V(0, 9.2, 5), AF = 0.67, hT = BN.TESS.h, pT = BN.TESS.passo, mF = new THREE.Matrix4(), mL = new THREE.Matrix4(), mT = new THREE.Matrix4(), e3 = new THREE.Euler();
  const fruga = [[3.38, 3.62], [T.base + 0.0, T.base + 0.12], [T.base + 0.98, T.base + 1.1], [T.carrello + 0.0, T.carrello + 0.12], [T.cofano + 0.0, T.cofano + 0.12], [T.foglio + 0.0, T.foglio + 0.1], [T.bottone + 0.78, T.bottone + 1.22]];
  function tessereA(t) {
    const vola = eIO(seg(t, 2.0, 2.32)), o = tv.lerpVectors(CF, tv2.set(BX, H, BZ), vola); o.y += 9 * 4 * vola * (1 - vola) * 0.5;
    const cresce = lerp(1, (WB + 0.05) / BN.TESS.W, vola), schiaccia = lerp(1, H / (8 * hT), smooth(seg(t, 2.05, 2.32)));
    mF.makeRotationFromEuler(e3.set(AF * (1 - vola), 0, 0)).setPosition(o);
    const c1 = eIO(seg(t, T.piega, T.piega + 0.34)), c2 = eIO(seg(t, T.piega + 0.16, T.piega + 0.5)), r1 = eIO(seg(t, T.piega + 0.52, T.piega + 0.84)), r2 = eIO(seg(t, T.piega + 0.68, T.piega + 1.0));
    P.tessere.forEach((m, i) => {
      const c = i % 3 - 1, r = Math.floor(i / 3) - 1; m.visible = t < 2.32; mL.identity();
      if (r !== 0) { const yh = r < 0 ? -2 * hT : -3.5 * hT, zh = r * pT / 2, a = (r < 0 ? -1 : 1) * Math.PI * (r < 0 ? r1 : r2); mL.multiply(mT.makeTranslation(0, yh, zh)).multiply(mT.makeRotationX(a)).multiply(mT.makeTranslation(0, -yh, -zh)); }
      if (c !== 0) { const a = (c < 0 ? 1 : -1) * Math.PI * (c < 0 ? c1 : c2), xh = c * pT / 2; mL.multiply(mT.makeTranslation(xh, c > 0 ? -hT * c2 : 0, 0)).multiply(mT.makeRotationZ(a)).multiply(mT.makeTranslation(-xh, 0, 0)); }
      mL.multiply(mT.makeTranslation(c * pT, 0, r * pT));
      m.matrix.copy(mF).multiply(mT.makeScale(cresce, 1, cresce)).multiply(mT.makeScale(1, i === 4 ? lerp(1, SC * 0.8, vola) : schiaccia, 1)).multiply(mL); m.matrixAutoUpdate = false; m.matrixWorldNeedsUpdate = true;
    });
    const s = P.scatola; s.visible = t >= 2.32; if (!s.visible) return;
    const tau = t - 2.32, k = tau < 0.4 ? 0.16 * Math.exp(-tau / 0.07) * Math.cos(tau * 30) : 0; s.scale.set(SC * (1 + k * 0.5), SC * (1 - k), SC * (1 + k * 0.5)); s.rotation.z = 0; s.position.y = 0;
    for (const f of fruga) { const u = seg(t, f[0], f[1]); if (u > 0 && u < 1) { s.rotation.z = 0.075 * Math.sin(u * TAU * 2.5) * Math.sin(Math.PI * u); s.scale.y *= 1 + 0.04 * Math.sin(u * TAU * 3); } }
    let lid = t < 2.86 ? 0 : 1.95 * eBack(seg(t, 2.86, 3.14), 2.2) * (1 - eIO(seg(t, T.riordino + 0.66, T.riordino + 0.88)));
    if (t > T.riordino + 0.88) lid += 0.07 * Math.exp(-(t - T.riordino - 0.88) / 0.05) * Math.sin((t - T.riordino - 0.88) * 40) + 1.95 * eBack(seg(t, T.bottone + 0.52, T.bottone + 0.72), 2.2);
    if (t > T.fuori && t < T.base) lid += 0.06 * Math.sin(t * 31);
    s.userData.apri(lid);
  }

  /* ================================================================ battuta «fuori»: tutto esce dalla scatola e si posa in ordine */
  const volo = (o, t0, slot, k = {}) => { const d = k.dur || 0.34; via(o).va(t0, t0 + d, slot, Object.assign({ da: esce(k.qe, slot.s), h: 6, e: lin, salta: [0.45, 0.085] }, k)); return o.via; };
  { const f = T.fuori;
    volo(R.bicchiere, f + 0.04, sTe0, { h: 5, dur: 0.38, molla: 0.1, salta: null }); ev(f + 0.42, 'tic', TE0, { r: 0.8 });
    nomiAtt.forEach((n, i) => { const t0 = f + 0.12 + i * 0.07; volo(R.att[n], t0, slotAtt[n], { qe: Q(-1.2, 1, 0.6), h: 10, giri: 1.5, asse: X, dur: 0.4, salta: [0.5, 0.09] }); ev(t0 + 0.4, 'tic', slotAtt[n].p.clone().setZ(slotAtt[n].p.z - 3.4), { r: 0.9 }); });
    volo(R.piattino, f + 0.46, sPia, { h: 6, giri: 1, salta: null, molla: 0.08 }); ev(f + 0.8, 'tic', PIATTO, { r: 2 });
    R.viti.px.forEach((p, i) => volo(p, f + 0.62 + i * 0.035, slotVite(i), { h: 7, giri: 2, asse: X, dur: 0.3, salta: [0.3, 0.07] }));
    R.bobine.px.forEach((p, i) => { volo(p, f + 0.82 + i * 0.06, sBob[i], { h: 6, giri: 1, asse: X }); ev(f + 1.16 + i * 0.06, 'tic', sBob[i].p, { r: 1.9 }); });
    volo(R.campana, f + 0.94, sCamp, { h: 5, giri: 1, asse: Z }); volo(R.levaRit, f + 1.0, sLev, { h: 6, giri: 1, asse: X });
    R.manopole.px.forEach((p, i) => { volo(p, f + 1.06 + i * 0.06, sMan[i], { h: 7, giri: 1, asse: Z }); ev(f + 1.4 + i * 0.06, 'tic', sMan[i].p, { r: 1.4 }); });
    volo(R.rullo, f + 1.18, sRullo, { qe: Q(0, Math.PI / 2, 0), h: 11, dur: 0.42, giri: 1, asse: X, salta: [0.35, 0.1] }); ev(f + 1.6, 'tonfo', V(-2.5, 0, -40.6), { r: 2.2, f: 0.35 });
    volo(R.segmento, f + 1.26, sSeg, { h: 8, giri: 1, asse: Z, dur: 0.38 }); ev(f + 1.64, 'tic', sSeg.p.clone().setY(0), { r: 3 });
    volo(R.targa, f + 1.3, sTarga, { h: 7, giri: 1, asse: X });
    R.leve.px.forEach((p, i) => { const j = ordL.indexOf(i), t0 = f + 1.32 + j * 0.0075, a = slotLeva(i); volo(p, t0, a, { h: 5 + a.p.distanceTo(BOCCA) * 0.2, giri: 1, asse: j % 2 ? X : Z, salta: [0.35, 0.07] }); if (j % 6 === 0) ev(t0 + 0.34, 'tic', a.p.clone().setY(0).setZ(a.p.z - 1.5), { r: 0.7 }); });
    R.mart.px.forEach((p, i) => { const n = 43 - i, t0 = f + 1.46 + n * 0.008, a = slotMart(i); volo(p, t0, a, { h: 5 + a.p.distanceTo(BOCCA) * 0.22, giri: 1, asse: n % 2 ? X : Z, dur: 0.33, salta: [0.3, 0.07] }); if (n % 6 === 0) ev(t0 + 0.33, 'tic', a.p.clone().setY(0).setZ(a.p.z + 2.6), { r: 0.8 }); });
    const ordC = TK.slice().sort((a, b) => (speciali.indexOf(a.ch) >= 0 && a.ch ? 1 : 0) - (speciali.indexOf(b.ch) >= 0 && b.ch ? 1 : 0) || a.i - b.i);
    ordC.forEach((k, n) => { const t0 = f + 1.62 + n * 0.009, a = slotCima(k); volo(R.cime.px[k.i], t0, a, { h: 5 + a.p.distanceTo(BOCCA) * 0.22, giri: 1, asse: n % 2 ? Z : X, dur: 0.32, salta: [0.5, 0.085] }); if (n % 3 === 0) ev(t0 + 0.32, 'tic', a.p, { r: 0.85 }); });
    volo(R.barra, f + 2.04, sBarra, { qe: Q(0, Math.PI / 2, 0), h: 12, giri: 1, asse: X, dur: 0.34, salta: [0.4, 0.09] }); ev(f + 2.38, 'tic', sBarra.p, { r: 3.2 });
  }
  /* ================================================================ la base, il telaio, due viti */
  const vite = (i, t, sp) => { const a = { p: WV(R.viti.posto[i]), q: Q(), s: S }; R.viti.px[i].via.va(t, t + 0.14, { p: a.p.clone().addScaledVector(UP, 1.0), q: Q(), s: S }, { h: 5, giri: 1, asse: X, e: eOut }).va(t + 0.15, t + 0.29, a, { avvita: { giri: 3.5, prof: 0.75 } });
    if (sp) scintilla(t + 0.27, a.p.clone().setY(a.p.y + 0.15)); else ev(t + 0.29, 'tic', a.p, { r: 0.45 }); return a.p; };
  { const b = T.base;
    via(R.base).va(b + 0.02, b + 0.5, sbieco(-1.8, 0, -0.1), { da: esce(lungo), h: 22, e: lin, molla: 0.045 }).va(b + 0.66, b + 0.78, sbieco(-0.6, 0, -0.035), { e: eOut, ant: 0.18, oltre: { n: X, A: -0.1, sm: 0.04, w: 40 } }).va(b + 0.86, b + 0.96, FIN, { e: eOut, ant: 0.12, oltre: { n: X, A: -0.07, sm: 0.04, w: 40 } });
    ev(b + 0.5, 'tonfo', V(-1.8, 0, MS.z), { r: 15.5, f: 1 }); ev(b + 0.5, 'scossa', V(0, 0, 0), { A: 0.5 }); ev(b + 0.78, 'tic', V(11.5, 0, 16), { r: 1.2 }); ev(b + 0.96, 'tic', V(12.6, 0, -6), { r: 1.2 });
    via(R.telaio).va(b + 1.0, b + 1.44, FIN, { da: esce(lungo), h: 20, e: eOut, sopra: { n: UP, d: 1.8 }, us: 0.8, oltre: { n: UP, A: 0.1, sm: 0.04, w: 46 } }); ev(b + 1.44, 'scossa', V(0, 0, 0), { A: 0.16 }); ev(b + 1.44, 'tic', W(0, 4.2, -12.2), { r: 2 });
    vite(0, b + 1.48, true); vite(1, b + 1.66, false);
  }
  /* ================================================================ l'arco dei perni (lo porta Dot), le sue viti, le leve dei tasti in quattro file, due colpi di martello */
  const tLeva = {}, COLPI = [T.mecc + 1.69, T.mecc + 2.05];
  { const m = T.mecc, zampa = { zampa: true, q: Q(0.25, 0, 0), s: S, off: V(0, -0.3, 0.2) };
    R.segmento.via.va(m + 0.05, m + 0.13, zampa, { h: 2, e: eOut }).va(m + 0.13, m + 0.29, zampa, {}).va(m + 0.29, m + 0.41, { p: WV(R.segmentoP), q: Q(), s: S }, { e: eOut, sopra: { n: UP, d: 0.9 }, oltre: { n: UP, A: 0.09, sm: 0.04, w: 46 } }); ev(m + 0.41, 'tic', WV(R.segmentoP), { r: 3.6 });
    vite(2, m + 0.45, true); vite(3, m + 0.61, false);
    const file = [0, 1, 2, 3].map((r) => TK.filter((k) => k.riga === r)); file.push([{ i: TK.length }, { i: TK.length + 1 }]);
    file.forEach((f, r) => { const t0 = m + 0.95 + r * 0.15; f.forEach((k, j) => { const jj = r % 2 ? f.length - 1 - j : j, tl = t0 + (jj / f.length) * 0.13, a = { p: WV(R.leve.posto[k.i].p), q: Q(), s: S }; tLeva[k.i] = tl + 0.17;
      R.leve.px[k.i].via.va(tl, tl + 0.17, a, { h: 4.5, e: eOut, ant: 0.5, sopra: { n: UP, d: 1.1 }, us: 0.7, oltre: { n: UP, A: 0.13, sm: 0.04, w: 44 }, dondola: { asse: X, A: 0.16, sm: 0.06, w: 30 } }); }); });
    COLPI.forEach((t, n) => { const p = W(n ? -4 : 4, 2.75, 3.95); scintilla(t, p, 8, 0.8); ev(t, 'scossa', p, { A: 0.08 }); });
  }
  /* ================================================================ i martelletti: una goccia d'olio sul perno, poi uno dopo l'altro lungo il ventaglio; ognuno si aggancia alzato e cade sul cuscino */
  const tMart = {}, GOCCIA = { t: T.leve + 0.14, a: W(0, SEG.y + 0.1, SEG.z + SEG.r), da: W(0, SEG.y + 2.6, SEG.z + SEG.r + 0.4) }, ONDA = [T.leve + 1.74, 0.0058];
  { const l = T.leve; ev(GOCCIA.t, 'goccia', GOCCIA.a, { da: GOCCIA.da });
    R.mart.px.forEach((p, i) => { const n = 43 - i, tl = l + 0.32 + n * 0.026; tMart[i] = tl + 0.2;
      p.via.va(tl, tl + 0.2, { p: WV(R.mart.perno(i)), q: R.mart.giro(i, SEG.riposo), s: S }, { h: 5.5, e: eOut, ant: 0.6, dondola: { asse: X, A: -1.05, f: cade } }); }); }
  /* ================================================================ i tasti: fila per fila (un'onda), ognuno a pressione sul suo stelo; la barra la porta Dot; poi le lettere di imad.chat e il punto d'oro */
  const tCima = {}, UPK = V(0, 1, 0).applyQuaternion(R.cime.giro), postoCima = (k) => ({ p: W(k.x, k.y, k.z), q: R.cime.giro, s: S }), nome = 'imadcht'.split('').map((ch) => R.tastoDi[ch]), kO = R.tastoDi['.'];
  const T_PUNTO = { prende: T.tasti + 2.13, su: T.tasti + 2.2, giu: T.tasti + 2.36, posato: T.tasti + 2.48 };
  { const k0 = T.tasti;
    [0, 1, 2, 3].forEach((r) => { const f = TK.filter((k) => k.riga === r && !(k.ch && speciali.indexOf(k.ch) >= 0)).sort((a, b) => a.x - b.x), t0 = k0 + 0.02 + r * 0.32;
      f.forEach((k, j) => { const jj = r % 2 ? f.length - 1 - j : j, tl = t0 + (jj / f.length) * 0.2; tCima[k.i] = tl + 0.15;
        R.cime.px[k.i].via.va(tl, tl + 0.15, postoCima(k), { h: 3.4, e: eOut, ant: 0.4, sopra: { n: UPK, d: 0.6 }, us: 0.7, oltre: { n: UPK, A: 0.2, sm: 0.045, w: 42 } }); if (j % 2 === 0) ev(tl + 0.15, 'tic', W(k.x, k.y + 0.5, k.z), { r: 0.75 }); }); });
    const zb = { zampa: true, q: Q(), s: S, off: V(0, -0.2, 0.3) };
    R.barra.via.va(k0 + 1.3, k0 + 1.36, zb, { h: 2, e: eOut }).va(k0 + 1.36, k0 + 1.42, zb, {}).va(k0 + 1.42, k0 + 1.54, { p: WV(R.BARRA), q: Q(0.12, 0, 0), s: S }, { e: eOut, sopra: { n: UP, d: 0.7 }, oltre: { n: UP, A: 0.16, sm: 0.045, w: 40 } }); ev(k0 + 1.54, 'tic', WV(R.BARRA), { r: 5 });
    nome.forEach((k, i) => { const tl = k0 + 1.55 + i * 0.08; tCima[k.i] = tl + 0.2; R.cime.px[k.i].via.va(tl, tl + 0.2, postoCima(k), { h: 6.5, giri: 1, asse: X, e: eOut, ant: 0.4, sopra: { n: UPK, d: 0.6 }, us: 0.76, oltre: { n: UPK, A: 0.24, sm: 0.05, w: 40 } }); ev(tl + 0.2, 'tic', W(k.x, k.y + 0.5, k.z), { r: 0.85 }); });
    const zo = { zampa: true, q: Q(0.5, 0, 0), s: S, off: V(0, -0.9, 0.2) };
    R.cime.px[kO.i].via.va(T_PUNTO.prende - 0.1, T_PUNTO.prende, zo, { h: 4, e: eOut }).va(T_PUNTO.prende, T_PUNTO.giu, zo, {}).va(T_PUNTO.giu, T_PUNTO.posato, postoCima(kO), { e: eIO, sopra: { n: UPK, d: 0.5 }, oltre: { n: UPK, A: 0.26, sm: 0.05, w: 34 } }); tCima[kO.i] = T_PUNTO.posato;
  }
  /* ================================================================ il carrello (cade sulle rotaie, Dot lo tira a posto: scatta), la vite del fermo; il rullo (entra di lato, rotolando), le manopole (si avvitano), la leva */
  const CAR0 = 10, carB = (t) => { const c = T.carrello; return t < c + 0.54 ? CAR0 : t < c + 0.74 ? lerp(CAR0, 4.6, eOut(seg(t, c + 0.54, c + 0.66))) + 0.2 * Math.sin(Math.PI * seg(t, c + 0.54, c + 0.6)) : lerp(4.6, 0, eOut(seg(t, c + 0.74, c + 0.9))) + (t > c + 0.9 ? -0.34 * Math.exp(-(t - c - 0.9) / 0.045) * Math.sin((t - c - 0.9) * 46) : 0.16 * Math.sin(Math.PI * seg(t, c + 0.74, c + 0.8))); };
  { const c = T.carrello, r = T.rullo;
    via(R.carrello).va(c + 0.04, c + 0.44, FIN, { da: esce(Q(0, Math.PI / 2, 0)), h: 20, e: lin, molla: 0.035 }); ev(c + 0.44, 'tonfo', W(CAR0 + 6, MS.cima + 0.3, -12.2), { r: 3, f: 0.5 }); ev(c + 0.44, 'scossa', V(0, 0, 0), { A: 0.28 });
    ev(c + 0.9, 'tic', W(-13.6, MS.cima + 0.3, -9.9), { r: 0.9 }); ev(c + 0.9, 'scossa', V(0, 0, 0), { A: 0.1 }); vite(4, c + 0.92, true);
    const zr = { zampa: true, q: Q(), s: S, off: V(0, 1.2, 0.2) }, posto = { p: WV(R.rulloP), q: Q(), s: S };
    R.rullo.via.va(r + 0.02, r + 0.08, zr, { h: 2, e: eOut }).va(r + 0.08, r + 0.24, zr, {}).va(r + 0.24, r + 0.5, posto, { e: eIO, sopra: { n: X, d: 15 }, us: 0.36, giri: 1.5, asse: X, oltre: { n: X, A: 0.22, sm: 0.04, w: 46 } }); ev(r + 0.5, 'tic', W(14.6, RULLO.y, RULLO.z), { r: 1.2 });
    [1, 0].forEach((i, n) => { const t0 = r + 0.52 + n * 0.1, sx = i ? 1 : -1, a = { p: WV(R.manopole.posto[i]), q: R.manopole.giro(i, 0), s: S };
      R.manopole.px[i].via.va(t0, t0 + 0.18, { p: a.p.clone().addScaledVector(X, sx * 1.6), q: R.manopole.giro(i, 0.6), s: S }, { h: 6, e: eOut, ant: 0.5 }).va(t0 + 0.18, t0 + 0.38, a, { e: eOut, giri: 2.5, asse: X }); ev(t0 + 0.38, 'tic', a.p, { r: 1.5 }); });
    R.levaRit.via.va(r + 0.8, r + 0.98, { p: WV(R.levaRitP), q: Q(), s: S }, { h: 6, e: eOut, ant: 0.5, sopra: { n: UP, d: 0.8 }, oltre: { n: UP, A: 0.1, sm: 0.04, w: 44 }, dondola: { asse: AX, A: 0.3, sm: 0.07, w: 26 } }); ev(r + 0.98, 'tic', WV(R.levaRitP), { r: 0.7 });
  }
  const PROVA = { t: T.rullo + 1.04, k: R.tastoDi['3'] };                          /* Dot prova un tasto: il martelletto batte sul rullo nudo, e lui salta */
  ev(PROVA.t + 0.075, 'tic', W(0, 7.6, -9.9), { r: 0.9 });
  /* ================================================================ le bobine (cadono sui perni e girano fino a fermarsi), il nastro infilato nella forcella, la polvere d'inchiostro */
  const nastroU = (t) => { const n = T.nastro; return t < n + 0.42 ? 0 : t < n + 0.76 ? 0.5 * eIO(seg(t, n + 0.42, n + 0.62)) : lerp(0.5, 1, eIO(seg(t, n + 0.76, n + 0.98))); };
  { const n = T.nastro;
    R.bobine.px.forEach((p, i) => { const t0 = n + 0.03 + i * 0.1, a = { p: WV(R.bobine.posto[i]), q: Q(), s: S }; p.via.va(t0, t0 + 0.22, a, { h: 8, e: eOut, ant: 0.5, sopra: { n: UP, d: 1.4 }, us: 0.75, oltre: { n: UP, A: 0.1, sm: 0.04, w: 44 } }); ev(t0 + 0.22, 'tic', a.p, { r: 2 }); });
    via(R.nastro).va(n + 0.4, n + 0.41, FIN, {}); via(R.forcella).va(T.mecc + 0.41, T.mecc + 0.42, FIN, {});
    ev(n + 0.64, 'inchiostro', W(0, 7.4, -9.6), {}); ev(n + 1.0, 'inchiostro', W(10.3, 6.1, -5.4), {});
  }
  /* ================================================================ il cofano (pesante: sbuffa ai lati), le quattro viti, la targhetta, un soffio */
  const SOFFIO = { t: T.cofano + 1.26, p: V(-5.6, 7.6, 1.4) };
  { const c = T.cofano;
    via(R.cofano).va(c + 0.03, c + 0.52, FIN, { da: esce(lungo), h: 21, e: eOut, sopra: { n: UP, d: 2.2 }, us: 0.8, oltre: { n: UP, A: 0.08, sm: 0.04, w: 40 } }); ev(c + 0.52, 'scossa', V(0, 0, 0), { A: 0.3 });
    ev(c + 0.52, 'sbuffo', W(-14.4, 4.6, -2), { dir: V(-1, 0.15, 0) }); ev(c + 0.52, 'sbuffo', W(14.4, 4.6, -2), { dir: V(1, 0.15, 0) });
    [5, 6, 7, 8].forEach((i, n) => vite(i, c + 0.58 + n * 0.14, n === 0 || n === 3));
    R.targa.via.va(c + 1.0, c + 1.2, { p: WV(R.targaP.p), q: R.targaP.q, s: S }, { h: 7, e: eOut, ant: 0.4, sopra: { n: V(0, 1, 0).applyQuaternion(R.targaP.q), d: 0.6 }, us: 0.74, oltre: { n: UP, A: 0.05, sm: 0.03, w: 50 } }); ev(c + 1.2, 'luccica', WV(R.targaP.p), {});
    ev(SOFFIO.t, 'sbuffo', SOFFIO.p, { dir: V(1, 0.05, 0.1) });
  }
  /* ================================================================ il foglio: plana dalla scatola, entra dietro al rullo, e la manopola lo tira su una riga alla volta; il campanello */
  const F_DIETRO = -AVVOLTO - 0.5, GIRI = [0, 1, 2, 3, 4, 5].map((k) => T.foglio + 0.56 + k * 0.115), DING = T.foglio + 1.3;
  const fuoriB = (t) => { let f = F_DIETRO; for (const g of GIRI) f += (MS.cima0 - F_DIETRO) / 6 * eBack(seg(t, g, g + 0.085), 1.4); return f; };
  { const f = T.foglio; via(R.foglio).va(f + 0.03, f + 0.5, FIN, { da: esce(Q(-0.9, 0.6, 0.3)), h: 9, e: eIO, centro: V(0, 14.2, -17.4) }); GIRI.forEach((g) => ev(g + 0.07, 'tic', W(16.6, RULLO.y, RULLO.z), { r: 0.6 })); ev(DING, 'onda', WV(R.campanaP).setY(R.campanaP.y * S + 0.7), {}); }
  via(R.campana).s = R.campana.via.s; R.campana.via.va(T.mecc + 0.86, T.mecc + 1.02, { p: WV(R.campanaP), q: Q(), s: S }, { h: 6, e: eOut, sopra: { n: UP, d: 0.7 }, oltre: { n: UP, A: 0.07, sm: 0.035, w: 50 } });
  /* ================================================================ il riordino: finito il lavoro, attrezzi, piattino e bicchiere rientrano nella scatola (il coperchio si chiude) */
  { const r = T.riordino, dentro = (q, s) => ({ p: BOCCA.clone(), q: q || Q(), s: 0.3 * (s || 1) });
    nomiAtt.forEach((n, i) => R.att[n].via.va(r + 0.06 + i * 0.06, r + 0.4 + i * 0.06, dentro(Q(-1.2, 1, 0.6)), { h: 10, giri: 1.5, asse: X, via: true, ant: 0.4 }));
    R.piattino.via.va(r + 0.3, r + 0.6, dentro(null, 1.25), { h: 7, giri: 1, via: true, ant: 0.3 }); R.bicchiere.via.va(6.2, 6.42, sTe1, { h: 8, molla: 0.1 }).va(r + 0.36, r + 0.64, dentro(null, 1.6), { h: 8, via: true, ant: 0.3 }); ev(6.42, 'tic', TE1, { r: 0.8 }); }

  /* ================================================================ Dot: le pose a scatti del timelapse, poi i movimenti a tempo vero */
  const K = [], k = (t, s) => { s.t = t; s.sc = SC; K.push(s); return s; }, kp = (t, s) => k(t, Object.assign({ passo: 1 }, s));
  const RETRO = { y: MS.cima * S, z: -7.4 }, PONTE = { y: MS.cima * S, z: 6.3 }, COFANO = { y: 6.4 }, TRESPOLO = { y: 8.3, z: -6.9 };
  /* -- scende dai riquadri di sopra, guarda la scatola, salta dentro */
  k(2.3, { x: -4.6, y: 74, z: -43.6, pose: 'air', yaw: Y.left, pitch: -0.3, grounded: false, liscio: (u) => u * u, look: [0.3, -0.3] });
  k(2.74, { x: -6.4, y: 0, z: -43.6, pose: 'land', yaw: Y.left, liscio: eOut }); k(2.84, { x: -6.4, y: 0, z: -43.6, pose: 'crouch', yaw: Y.left, liscio: eIO, look: [0.2, 0.1] });
  k(2.98, { x: -6.4, y: 0, z: -43.6, pose: 'wiggle', yaw: Y.left, pupil: 1, liscio: eIO, look: [0.1, 0.15], swish: 0.6 }); k(3.12, { x: -6.4, y: 0, z: -43.6, pose: 'wiggle', yaw: Y.left, pupil: 1, liscio: lin, salto: 8, grounded: false });
  k(3.36, { x: BX, y: H + 1.4, z: BZ - 0.3, pose: 'air', yaw: Y.left, pitch: 0.5, grounded: false, liscio: (u) => u * u, ombra: 0 }); k(3.5, { x: BX, y: -16, z: BZ - 0.3, pose: 'air', yaw: Y.left, pitch: 0.9, grounded: false, ombra: 0, via: true });
  /* -- dentro la scatola, le zampe sull'orlo: lancia */
  const orlo = (t, n, extra) => kp(t, Object.assign({ x: BX + (hash(n + 9) - 0.5) * 1.1, y: H, z: BZ + WB / 2 - 0.58, pose: ['peek', 'push', 'push-touch', 'push-sweep'][n % 4], flip: n % 8 >= 4, clipY: 0, paws: 1, edge: 'top', pupil: 1, look: [(n % 8 >= 4 ? 1 : -1) * (0.25 + 0.5 * hash(n + 2)), 0.1 + 0.2 * hash(n + 5)], gaze: [(n % 8 >= 4 ? -1 : 1) * 0.6, 0.3], tassel: (n % 2 ? 1 : -1) * 0.5, over: n % 4 === 0 ? { dy: 15.4 } : {} }, extra));
  { let n = 0; for (let t = T.fuori + 0.02; t < T.base - 0.06; t += 0.1 + 0.02 * (hash(n) - 0.5), n++) orlo(t, n); }
  /* -- la base: resta nella scatola a spingerla fuori, poi salta giù, si scansa, la mette in squadra con due spinte */
  { const b = T.base; orlo(b + 0.0, 2); orlo(b + 0.1, 1);
    kp(b + 0.2, { x: -12, y: 8, z: -30, pose: 'air', yaw: Y.right, pitch: 0.2, grounded: false, ombra: 0.3, suolo: 0 }); kp(b + 0.3, { x: -17, y: 0, z: -13, pose: 'land', yaw: Y.right });
    kp(b + 0.4, { x: -17.2, y: 0, z: -13, pose: 'puddle', yaw: Y.right, look: [-0.3, 0.3], gaze: [0.4, 0.9], pupil: 0.5, over: { ear: 0.7, eye: 1.2, lid: 0 } });
    kp(b + 0.52, { x: -17.4, y: 2.2, z: -13.4, pose: 'startle', yaw: Y.right, grounded: false, pupil: 0.4, suolo: 0 });
    kp(b + 0.63, { x: -18.6, y: 0, z: 13.5, pose: 'spinge', yaw: Y.right, tassel: 0.5 }); kp(b + 0.72, { x: -17.6, y: 0, z: 13.5, pose: 'spinge', yaw: Y.right, tassel: -0.5, over: { cx: 6.4, hp: -0.3 } });
    kp(b + 0.83, { x: -18.4, y: 0, z: -5, pose: 'spinge', yaw: Y.right, tassel: 0.5 }); kp(b + 0.92, { x: -17.4, y: 0, z: -5, pose: 'spinge', yaw: Y.right, tassel: -0.5, over: { cx: 6.4, hp: -0.3 } });
    kp(b + 1.02, { x: -5.6, y: RETRO.y, z: RETRO.z, pose: 'ritto', yaw: Y.viewRight, look: [-0.5, 0.6], gaze: [0.3, 0.9], pupil: 1 }); kp(b + 1.14, { x: -3, y: RETRO.y, z: RETRO.z, pose: 'portaSu', yaw: Y.viewRight, gaze: [0.2, 0.9], tassel: 0.5 });
    kp(b + 1.26, { x: -1.5, y: RETRO.y, z: RETRO.z, pose: 'portaSu', yaw: Y.front, gaze: [0, 0.8], tassel: -0.5, over: { f0y: 24, f1y: 24 } }); kp(b + 1.36, { x: 0, y: RETRO.y, z: RETRO.z, pose: 'porta', yaw: Y.front, gaze: [0, -0.6] }); kp(b + 1.45, { x: 0, y: RETRO.y, z: RETRO.z, pose: 'premi2', gaze: [0, -0.9], tassel: 0.4 });
  }
  /* una vite: Dot a un passo, chino sul cacciavite, e le zampe che si scambiano (gira) */
  const avvita = (i, t, y, lato) => { const p = WV(R.viti.posto[i]), d = lato || (p.x < 0 ? 1 : -1); [0.13, 0.22].forEach((dt, n) => kp(t + dt, { x: p.x + d * 8.2, y, z: p.z - 0.5, pose: n ? 'avvitaB' : 'avvitaA', yaw: d > 0 ? Y.left : Y.right, gaze: [0.4, -0.8], tassel: n ? 0.5 : -0.5, porta: { cosa: 'cacciavite', punta: p.clone().setY(p.y + 0.2 - 0.12 * n), gira: n * 2.2 + i } })); };
  avvita(0, T.base + 1.48, RETRO.y); avvita(1, T.base + 1.66, RETRO.y);
  /* -- l'arco dei perni: lo va a prendere, lo porta con due zampe, lo posa; due viti; le leve (la zampa corre con l'onda); due colpi di martello */
  { const m = T.mecc;
    kp(m + 0.03, { x: 11.8, y: 0, z: -32.2, pose: 'porta', yaw: Y.right, gaze: [0.3, -0.5] }); kp(m + 0.14, { x: 6, y: 0, z: -22, pose: 'porta', yaw: Y.viewLeft, gaze: [-0.2, -0.3], walk: 1.2, tassel: 0.5 });
    kp(m + 0.24, { x: 0.4, y: RETRO.y, z: RETRO.z, pose: 'porta', yaw: Y.front, gaze: [0, -0.7], tassel: -0.5 }); kp(m + 0.33, { x: 0.2, y: RETRO.y, z: RETRO.z, pose: 'premi2', gaze: [0, -0.9] });
    avvita(2, m + 0.45, RETRO.y, 1); avvita(3, m + 0.61, RETRO.y, -1);
    kp(m + 0.9, { x: -7.5, y: PONTE.y, z: PONTE.z, pose: 'sip', yaw: Y.viewRight, porta: { cosa: 'bicchiere', bevi: 1 } });
    for (let r = 0; r < 5; r++) for (let n = 0; n < 2; n++) { const u = (n + 0.5) / 2, dir = r % 2 ? -1 : 1; kp(m + 0.98 + r * 0.15 + n * 0.075, { x: dir * lerp(-8.5, 8.5, u), y: PONTE.y, z: PONTE.z, pose: n % 2 ? 'premiA' : 'premiB', flip: dir < 0, gaze: [0.35, -0.9], tassel: n % 2 ? 0.55 : -0.55 }); }
    COLPI.forEach((t, n) => { const d = n ? -1 : 1, p = W(n ? -4 : 4, 2.75, 3.95); kp(t - 0.1, { x: p.x - d * 7.4, y: PONTE.y, z: PONTE.z - 0.4, pose: 'martSu', yaw: d > 0 ? Y.right : Y.left, gaze: [0.5, -0.6], pupil: 1, porta: { cosa: 'martello', colpo: p, alzato: 1, d } });
      kp(t - 0.012, { x: p.x - d * 7.4, y: PONTE.y, z: PONTE.z - 0.4, pose: 'martGiu', yaw: d > 0 ? Y.right : Y.left, gaze: [0.5, -0.8], tassel: d * 0.6, porta: { cosa: 'martello', colpo: p, alzato: 0, d } });
      kp(t + 0.1, { x: p.x - d * 7.4, y: PONTE.y, z: PONTE.z - 0.4, pose: 'martSu', yaw: d > 0 ? Y.right : Y.left, gaze: [0.5, -0.6], porta: { cosa: 'martello', colpo: p, alzato: 0.55, d }, over: { f0y: 22 } }); });
    kp(m + 2.17, { x: 3, y: PONTE.y, z: PONTE.z, pose: 'asciuga', yaw: Y.viewLeft });
  }
  /* -- i martelletti: una goccia d'olio; poi segue l'onda da dietro il cesto, una zampa per volta; passa la zampa sul ventaglio; un sorso */
  { const l = T.leve; kp(l + 0.03, { x: -2.6, y: RETRO.y, z: RETRO.z, pose: 'olia', yaw: Y.viewRight, gaze: [0.5, -0.8], pupil: 1, porta: { cosa: 'oliatore', punta: GOCCIA.da, mano: [9, 7] } });
    kp(l + 0.2, { x: -2.6, y: RETRO.y, z: RETRO.z, pose: 'olia', yaw: Y.viewRight, gaze: [0.5, -0.9], pupil: 1, over: { hr: 0.24 }, porta: { cosa: 'oliatore', punta: GOCCIA.da.clone().setY(GOCCIA.da.y - 0.3), mano: [9, 7] } });
    let n = 0; for (let t = l + 0.34; t < l + 1.66; t += 0.098 + 0.016 * (hash(n + 3) - 0.5), n++) { const u = sat((t - l - 0.3) / 1.3); kp(t, { x: lerp(-5.2, 5.2, u), y: RETRO.y, z: RETRO.z, pose: n % 2 ? 'premiA' : 'premiB', flip: u > 0.5, gaze: [0.3, -0.9], tassel: n % 2 ? 0.55 : -0.55, over: n % 3 === 0 ? { hp: -0.46 } : {} }); }
    kp(l + 1.7, { x: -3.4, y: RETRO.y, z: RETRO.z, pose: 'tocca', gaze: [0.6, -0.8], pupil: 1 }); kp(l + 1.8, { x: 0, y: RETRO.y, z: RETRO.z, pose: 'tocca', gaze: [0.2, -0.9], pupil: 1, over: { fo0: 0.5 } }); kp(l + 1.9, { x: 3.4, y: RETRO.y, z: RETRO.z, pose: 'tocca', flip: true, gaze: [0.6, -0.8], pupil: 1 });
    kp(l + 1.98, { x: 5, y: RETRO.y, z: RETRO.z, pose: 'soddisfatto', yaw: Y.viewLeft });
  }
  /* -- i tasti: sta dietro la fila che monta (sul ponte, poi sui tasti già messi); il fez cade e torna su; la barra tra le zampe; le lettere; il punto d'oro */
  { const k0 = T.tasti, dove = [[PONTE.y, PONTE.z], [PONTE.y, PONTE.z + 1.2], [4.9, 9.9], [4.3, 11.8]];
    for (let r = 0; r < 4; r++) for (let n = 0; n < 3; n++) { const u = (n + 0.4) / 2.8, dir = r % 2 ? -1 : 1; kp(k0 + 0.03 + r * 0.32 + n * 0.1, { x: dir * lerp(-9, 9, u), y: dove[r][0], z: dove[r][1], pose: n % 2 ? 'premiA' : 'premiB', flip: dir < 0, gaze: [0.35, -0.9], tassel: n % 2 ? 0.55 : -0.55, over: n === 1 ? { hp: -0.44 } : {} }); }
    const sost = (t, s) => { let b = 0; K.forEach((q, i) => { if (Math.abs(q.t - t) < Math.abs(K[b].t - t)) b = i; }); const q = K[b]; K[b] = Object.assign({ t: q.t, passo: 1, sc: SC, x: q.x, y: q.y, z: q.z }, s); };
    sost(k0 + 0.76, { pose: 'premi2', fez: false, fezGiu: [13, 0], gaze: [0.8, -0.6], over: { ear: 0.5 } }); sost(k0 + 0.86, { pose: 'asciuga', yaw: Y.viewRight, over: { eye: 1, lid: 0, f0y: 27, hp: 0.05 } });
    kp(k0 + 1.3, { x: 0.4, y: 0, z: -17.6, pose: 'porta', yaw: Y.front, gaze: [0, -0.6] }); kp(k0 + 1.38, { x: 0.4, y: 3.9, z: 13.2, pose: 'porta', yaw: Y.front, gaze: [0, -0.7], tassel: 0.5 }); kp(k0 + 1.48, { x: 0.4, y: 3.9, z: 13.2, pose: 'premi2', gaze: [0, -0.9], tassel: -0.5 });
    nome.forEach((q, i) => { const p = W(q.x, q.y, q.z); kp(k0 + 1.57 + i * 0.08, { x: p.x + (i % 2 ? 2.2 : -2.2), y: q.riga > 1 ? 4.4 : PONTE.y, z: q.riga > 1 ? p.z - 2.9 : PONTE.z, pose: i % 2 ? 'premiA' : 'premiB', flip: !!(i % 2), gaze: [0.4, -0.9], pupil: 1, tassel: i % 2 ? 0.5 : -0.5 }); });
    const po = W(kO.x, kO.y, kO.z), pp = { x: po.x - 0.2, y: 4.3, z: po.z - 2.9 };
    k(T_PUNTO.prende, Object.assign({ pose: 'tiene', gaze: [0, -0.6], pupil: 1, liscio: eOut }, pp)); k(T_PUNTO.su, Object.assign({ pose: 'alza', gaze: [0, -0.75], pupil: 1, liscio: eIO, over: {} }, pp));
    k(T_PUNTO.giu - 0.04, Object.assign({ pose: 'alza', gaze: [0, -0.75], pupil: 1, liscio: eIO }, pp)); k(T_PUNTO.posato, Object.assign({ pose: 'premi2', gaze: [0, -0.9], pupil: 0.9 }, pp));
  }
  /* -- il carrello: lo guarda arrivare, lo tira a posto in due strappi (scatta), la vite del fermo */
  { const c = T.carrello; kp(c + 0.02, { x: 6.4, y: RETRO.y, z: -2.4, pose: 'sit', yaw: Y.viewLeft, look: [0.6, 0.6], gaze: [-0.4, 0.9], pupil: 1 }); kp(c + 0.3, { x: 6.4, y: RETRO.y, z: -2.4, pose: 'puddle', yaw: Y.viewLeft, pupil: 0.5, over: { ear: 0.7, eye: 1.2, lid: 0 } });
    kp(c + 0.46, { x: 7.6, y: RETRO.y, z: -2.2, pose: 'ritto', yaw: Y.right, gaze: [0.6, 0.2], pupil: 1 }); kp(c + 0.55, { x: 7.2, y: RETRO.y, z: -2.2, pose: 'tira', yaw: Y.right, tassel: 0.6 }); kp(c + 0.66, { x: 4.6, y: RETRO.y, z: -2.2, pose: 'ritto', yaw: Y.right, tassel: -0.4 });
    kp(c + 0.75, { x: 4.2, y: RETRO.y, z: -2.2, pose: 'tira', yaw: Y.right, tassel: 0.6 }); kp(c + 0.88, { x: 0.6, y: RETRO.y, z: -2.2, pose: 'startle', yaw: Y.right, pupil: 0.5, over: { arch: 2, puff: 0.4 } }); avvita(4, c + 0.92, RETRO.y, -1); }
  /* -- il rullo sopra la testa, poi dentro di lato; le manopole (di spalle); la leva; prova un tasto e salta allo schiocco */
  { const r = T.rullo; kp(r + 0.0, { x: -2.5, y: 0, z: -38.6, pose: 'portaSu', yaw: Y.front, gaze: [0, 0.6] }); kp(r + 0.1, { x: 9, y: 0, z: -22, pose: 'portaSu', yaw: Y.viewRight, walk: 1, tassel: 0.5 }); kp(r + 0.19, { x: 17.4, y: 0, z: -8, pose: 'portaSu', yaw: Y.left, tassel: -0.5 });
    kp(r + 0.27, { x: 17.6, y: 0, z: -6.6, pose: 'gira', yaw: Y.left, gaze: [0.6, 0.3], tassel: 0.5 }); kp(r + 0.38, { x: 17.2, y: 0, z: -6.6, pose: 'spinge', yaw: Y.left, over: { f0y: 17, f1y: 16, cy: 15 } }); kp(r + 0.48, { x: 17.4, y: 0, z: -6.6, pose: 'ritto', yaw: Y.left });
    kp(r + 0.56, { x: 18.2, y: 0, z: -3.4, pose: 'gira', yaw: Y.backLeft, tassel: 0.5 }); kp(r + 0.66, { x: 18.2, y: 0, z: -3.4, pose: 'gira2', yaw: Y.backLeft, tassel: -0.5 }); kp(r + 0.74, { x: -18.2, y: 0, z: -3.4, pose: 'gira', yaw: Y.backRight, tassel: 0.5 }); kp(r + 0.84, { x: -18.2, y: 0, z: -3.4, pose: 'gira2', yaw: Y.backRight, tassel: -0.5 });
    kp(r + 0.93, { x: -18, y: 0, z: -1, pose: 'porta', yaw: Y.right, gaze: [0.5, 0.4] }); kp(PROVA.t - 0.04, { x: -5.2, y: PONTE.y, z: PONTE.z, pose: 'tocca', gaze: [0.2, -0.9], pupil: 1 });
    kp(PROVA.t + 0.08, { x: -5.4, y: PONTE.y + 2.4, z: PONTE.z, pose: 'startle', yaw: Y.viewRight, grounded: false, pupil: 0.35, suolo: PONTE.y }); kp(PROVA.t + 0.17, { x: -5.6, y: PONTE.y, z: PONTE.z, pose: 'crouch', yaw: Y.viewRight, pupil: 0.5, over: { ear: 0.6, eye: 1.25 } }); }
  /* -- le bobine; il nastro con le pinzette (dal fianco, poi appollaiato sul carrello, poi dall'altro fianco); scuote la zampa sporca */
  const PINZA = (t) => { const u = nastroU(t); return R.nastro.punto(Math.max(0.02, u), tv2).multiplyScalar(S).setZ(tv2.z + MS.z).clone(); };
  { const n = T.nastro; kp(n + 0.04, { x: -17.6, y: 0, z: 2.4, pose: 'ritto', yaw: Y.right, look: [-0.4, 0.5], gaze: [0.5, 0.8], pupil: 1 }); kp(n + 0.24, { x: -17.2, y: 0, z: 2.4, pose: 'premi2', yaw: Y.right, gaze: [0.6, -0.4], over: { f0y: 12, f1y: 12 } }); kp(n + 0.33, { x: 17.4, y: 0, z: 2.4, pose: 'ritto', yaw: Y.left, gaze: [0.6, 0.2] });
    [0.44, 0.53].forEach((dt, i) => kp(n + dt, { x: -17.2 + i * 1.2, y: 0, z: -1.4, pose: i ? 'tira' : 'porta', yaw: Y.right, gaze: [0.6, 0.1], pupil: 1, tassel: i ? 0.5 : -0.5, porta: { cosa: 'pinzette', segue: 1, mano: [9, 13] } }));
    [0.63, 0.72].forEach((dt, i) => kp(n + dt, { x: 1.2, y: TRESPOLO.y, z: TRESPOLO.z, pose: i ? 'premiB' : 'premiA', gaze: [0.2, -0.9], pupil: 1, tassel: i ? 0.5 : -0.5, porta: { cosa: 'pinzette', segue: 1, mano: [8, 2] } }));
    [0.8, 0.9].forEach((dt, i) => kp(n + dt, { x: 17.4 - i * 0.6, y: 0, z: -1.4, pose: i ? 'tira' : 'porta', yaw: Y.left, gaze: [0.6, 0.1], pupil: 1, tassel: i ? 0.5 : -0.5, porta: { cosa: 'pinzette', segue: 1, mano: [9, 13] } }));
    kp(n + 1.02, { x: 17.2, y: 0, z: 0, pose: 'scuote', yaw: Y.viewLeft, tassel: 0.6 }); kp(n + 1.12, { x: 17.2, y: 0, z: 0, pose: 'scuote', yaw: Y.viewLeft, tassel: -0.6, over: { f0x: 12, f0y: 14, hr: -0.05 } }); kp(n + 1.21, { x: 17, y: 0, z: 0, pose: 'sip', yaw: Y.viewLeft, porta: { cosa: 'bicchiere', bevi: 1 } }); }
  /* -- il cofano: lo aspetta appollaiato sul carrello, lo accompagna giù; le quattro viti (in piedi sul cofano); la targhetta; soffia via la polvere; la fronte */
  { const c = T.cofano; kp(c + 0.04, { x: 0, y: TRESPOLO.y, z: TRESPOLO.z, pose: 'sit', yaw: Y.viewLeft, look: [0.5, 0.6], gaze: [-0.4, 0.9], pupil: 1 }); kp(c + 0.3, { x: 0, y: TRESPOLO.y, z: TRESPOLO.z, pose: 'portaSu', yaw: Y.front, gaze: [0, 0.8], over: { f0y: 22, f1y: 22 } }); kp(c + 0.42, { x: 0, y: TRESPOLO.y, z: TRESPOLO.z, pose: 'premi2', gaze: [0, -0.9], tassel: 0.5 });
    [5, 6, 7, 8].forEach((i, n) => avvita(i, c + 0.58 + n * 0.14 - 0.03, COFANO.y - (n < 2 ? 0.7 : 0), n % 2 ? -1 : 1));
    kp(c + 1.14, { x: 0.3, y: 5.9, z: 3.4, pose: 'premiA', gaze: [0.1, -0.9], pupil: 1 }); kp(SOFFIO.t - 0.02, { x: -8.4, y: COFANO.y, z: 1.4, pose: 'soffia', yaw: Y.right, tassel: 0.5 }); kp(SOFFIO.t + 0.1, { x: -8.6, y: COFANO.y, z: 1.4, pose: 'soffia', yaw: Y.right, tassel: -0.5, over: { mouth: 0.3, cx: 6.4 } }); kp(c + 1.38, { x: -8, y: COFANO.y, z: 1.2, pose: 'asciuga', yaw: Y.viewRight }); }
  /* -- il foglio: lo guarda planare, poi gira la manopola (di spalle), un colpetto al campanello, contento */
  { const f = T.foglio; kp(f + 0.04, { x: 17.6, y: 0, z: -2.6, pose: 'sit', yaw: Y.viewLeft, look: [0.7, 0.7], gaze: [-0.5, 0.9], pupil: 1 }); kp(f + 0.3, { x: 17.6, y: 0, z: -2.6, pose: 'ritto', yaw: Y.backLeft, gaze: [0.4, 0.8] });
    GIRI.forEach((g, i) => kp(g - 0.02, { x: 18.2, y: 0, z: -3.4, pose: i % 2 ? 'gira2' : 'gira', yaw: Y.backLeft, tassel: i % 2 ? 0.5 : -0.5 }));
    kp(DING - 0.1, { x: -17.6, y: 0, z: 8.6, pose: 'bat', yaw: Y.right, gaze: [0.6, -0.2], pupil: 1 }); kp(DING + 0.02, { x: -17.4, y: 0, z: 8.6, pose: 'bat', yaw: Y.right, gaze: [0.6, -0.4], pupil: 1, over: { f0x: 14.5, f0y: 12.5 }, tassel: 0.5 });
    k(DING + 0.13, { x: -17.2, y: 0, z: 9.6, pose: 'soddisfatto', yaw: Y.viewRight, liscio: lin }); }
  /* -- il riordino e la zona contatto (a tempo vero): seduto accanto alla macchina; poi fa il giro, dà un colpo alla leva del ritorno e si affaccia da dietro il carrello */
  { const r = T.riordino, c = T.contatto; k(r + 0.3, { x: -17.2, y: 0, z: 9.6, pose: 'sit', yaw: Y.viewRight, liscio: lin, look: 'v' }); k(c + 0.02, { x: -17.2, y: 0, z: 9.6, pose: 'stand', yaw: Y.backRight, walk: 0, speed: 150, liscio: lin });
    k(c + 0.34, { x: -17.6, y: 0, z: 1.2, pose: 'stand', yaw: Y.backRight, walk: 1.8, speed: 150, liscio: eIO }); k(c + 0.42, { x: -17.6, y: 0, z: 0.6, pose: 'bat', yaw: Y.right, liscio: eIO, over: { f0y: 19 } }); k(c + 0.52, { x: -17.6, y: 0, z: 0.6, pose: 'bat', yaw: Y.right, liscio: eIO, over: { f0x: 15, f0y: 21 } });
    k(c + 0.62, { x: -17.6, y: 0, z: 0, pose: 'stand', yaw: Y.backRight, walk: 0, speed: 160, liscio: lin }); k(c + 0.95, { x: -15.6, y: 0, z: -11.6, pose: 'stand', yaw: Y.right, walk: 2, speed: 160, liscio: eOut }); k(c + 1.1, { x: -9.6, y: 0, z: -11.6, sbircia: true, pose: 'sit', liscio: lin });
    /* -- il bottone: corre alla scatola, ci salta dentro, esce col bottone in bocca, lo posa davanti a sinistra */
    const b = T.bottone; k(b, { x: -9.6, y: 0, z: -11.6, pose: 'sit', yaw: Y.viewLeft, liscio: eIO }); k(b + 0.14, { x: -10.2, y: 0, z: -12.4, pose: 'stand', yaw: Y.backLeft, walk: 0, speed: 170, liscio: lin }); k(b + 0.58, { x: -8.4, y: 0, z: -41.4, pose: 'stand', yaw: Y.backLeft, walk: 3, speed: 170, liscio: eIO });
    k(b + 0.64, { x: -8.2, y: 0, z: -42.2, pose: 'wiggle', yaw: Y.left, liscio: lin, salto: 8, grounded: false }); k(b + 0.84, { x: BX, y: H + 1.4, z: BZ - 0.3, pose: 'air', yaw: Y.left, pitch: 0.5, grounded: false, liscio: (u) => u * u, ombra: 0 }); k(b + 0.94, { x: BX, y: -16, z: BZ - 0.3, pose: 'air', yaw: Y.left, grounded: false, ombra: 0, via: true });
    const sull = { x: BX, y: H, z: BZ + WB / 2 - 0.58, pose: 'peek', clipY: 0, paws: 1, edge: 'top', pupil: 1, bocca: true, over: { dy: 15.4 } }; k(b + 1.24, Object.assign({ look: [-0.3, 0.1], liscio: lin }, sull)); k(b + 1.4, Object.assign({ look: [0.5, 0.2] }, sull));
    k(b + 1.42, { x: BX + 1, y: H + 0.6, z: BZ + 2, pose: 'air', yaw: Y.right, pitch: 0.3, grounded: false, bocca: true, liscio: lin, salto: 6, ombra: 0.3, suolo: 0 }); k(b + 1.66, { x: -16.6, y: 0, z: -36, pose: 'land', yaw: Y.right, bocca: true, liscio: eOut });
    k(b + 1.74, { x: -16.8, y: 0, z: -35, pose: 'stand', yaw: Y.viewRight, walk: 0, speed: 190, bocca: true, liscio: lin }); k(b + 2.36, { x: -16.8, y: 0, z: 9.4, pose: 'stand', yaw: Y.viewRight, walk: 4.8, speed: 190, bocca: true, liscio: eOut });
    k(b + 2.46, { x: -16.6, y: 0, z: 10.4, pose: 'tiene', bocca: true, liscio: eIO, gaze: [0, -0.6] }); k(b + 2.64, { x: -16.6, y: 0, z: 10.4, pose: 'premi2', liscio: eIO, gaze: [0, -0.8], pupil: 1 });
    k(b + 2.82, { x: -16.6, y: 0, z: 10.4, pose: 'premiB', liscio: eIO, gaze: [0, 0], pupil: 1, look: [0, 0.12], over: { hp: 0, hr: -0.2 } }); k(b + 3.0, { x: -16.6, y: 0, z: 10.4, pose: 'premiB', liscio: eIO, gaze: [0, 0], pupil: 1, look: [0, 0.12], over: { hp: 0, hr: -0.2 } }); k(b + 3.18, { x: -16.6, y: 0, z: 9.6, pose: 'sit', yaw: Y.viewRight, pupil: 1 });
  }
  K.sort((a, b) => a.t - b.t);
  const T_BOTT = { fuori: T.bottone + 1.24, giu: T.bottone + 2.46, posato: T.bottone + 2.64 };
  /* gli attrezzi: dalla fila alla zampa e ritorno, con due archi veloci (ogni volta che servono) */
  const uso = {}; K.forEach((q) => { const n = q.porta && q.porta.cosa; if (!n || !R.att[n]) return; const l = uso[n] || (uso[n] = []), u = l[l.length - 1]; if (u && q.t - u.t1 < 0.3) u.t1 = q.t + 0.1; else l.push({ t0: q.t, t1: q.t + 0.1 }); });

  /* ================================================================ la cinepresa: più vicina di prima, segue il lavoro con planate calme */
  const CAM = {
    faccia: { tx: 0, ty: 8.2, tz: 4.4, larg: 21.5, alt: 30, pitch: 0.9, su: 0 }, largo: { tx: 0, ty: 0, tz: -17, larg: 41.5, alt: 78, pitch: 0.97, su: 0 }, cantiere: { tx: 0, ty: 1, tz: -15, larg: 30, alt: 66, pitch: 0.9, su: 0 },
    cesto: { tx: 0, ty: 2.6, tz: -7, larg: 22.5, alt: 46, pitch: 0.86, su: 0 }, tasti: { tx: 0, ty: 3, tz: -5.5, larg: 23.5, alt: 52, pitch: 0.84, su: 0 }, sopra: { tx: 0, ty: 5, tz: -2, larg: 27.5, alt: 46, pitch: 0.8, su: 0 },
    foglio: { tx: 0, ty: 8, tz: -5, larg: 30, alt: 50, pitch: 0.74, su: 0 }, finita: { tx: -1.6, ty: 6, tz: 2, larg: 38, alt: 40, pitch: 0.64, su: 0.02 }, contatto: { tx: 0, ty: 5.3, tz: 4.6, larg: 23.6, alt: 31, pitch: 0.74, su: 0.11 },
    bottone: { tx: -15, ty: 3, tz: 12.6, larg: 14, alt: 15, pitch: 0.62, su: 0 }
  };
  const camK = [[0, 'faccia'], [1.9, 'faccia'], [2.6, 'largo'], [5.5, 'largo'], [6.3, 'cantiere'], [T.leve - 0.1, 'cantiere'], [T.leve + 0.55, 'cesto'], [T.tasti - 0.05, 'cesto'], [T.tasti + 0.45, 'tasti'], [T.carrello - 0.15, 'tasti'], [T.carrello + 0.4, 'cantiere'], [T.nastro + 0.3, 'cantiere'],
    [T.nastro + 0.75, 'sopra'], [T.cofano - 0.1, 'sopra'], [T.cofano + 0.3, 'cantiere'], [T.cofano + 0.5, 'cantiere'], [T.cofano + 0.95, 'sopra'], [T.foglio - 0.05, 'sopra'], [T.foglio + 0.5, 'foglio'], [T.riordino, 'foglio'], [T.riordino + 0.7, 'finita'], [T.contatto + 0.05, 'finita'],
    [T.contatto + 0.85, 'contatto'], [T.bottone, 'contatto'], [T.bottone + 0.6, 'cantiere'], [T.bottone + 1.9, 'cantiere'], [T.bottone + 2.6, 'bottone'], [99, 'bottone']];
  function camA(t) { let i = 0; while (i < camK.length - 2 && camK[i + 1][0] <= t) i++; const a = CAM[camK[i][1]], b = CAM[camK[i + 1][1]], u = eIO(seg(t, camK[i][0], camK[i + 1][0])), o = {}; for (const q in a) o[q] = lerp(a[q], b[q], u);
    o.dx = -0.07 * Math.min(seg(t, T.contatto + 0.05, T.contatto + 0.85), 1 - seg(t, T.bottone, T.bottone + 0.6)); return o; }

  /* ================================================================ scrivere: un nastro di battute { t, k: 'ch' | 'ret' | 'bs', ch }. Da qui escono, a ogni istante, il foglio, il carrello,
     il tasto che scende, il martelletto che sale e batte, il nastro che si alza, il campanello vicino alla fine della riga. */
  const BAT = 0.075, MAXR = 9, giuDi = (dt) => (dt < 0 ? 0 : dt < 0.045 ? dt / 0.045 : dt < 0.11 ? 1 : dt < 0.27 ? 1 - eOut((dt - 0.11) / 0.16) : 0);
  function leggi(N, t) {
    const o = { righe: [''], col: 0, colE: 0, righeE: 0, tasti: [], mart: [], su: 0, leva: 0, ding: -9, ult: -9, ultK: null, lato: -1, tLato: -9 }; let lato = -1;
    for (const e of N.ev) { if (e.t > t) break; const dt = t - e.t, r = o.righe.length - 1;
      if (e.k === 'ch') { const ts = e.t + BAT, key = e.ch === ' ' ? null : R.tastoDi[e.ch]; o.ult = e.t; o.ultK = key;
        if (dt < 0.3) { o.tasti.push({ k: key, g: giuDi(dt) }); if (key) { const u = (dt - 0.01) / (BAT - 0.01), tau = t - ts; o.mart.push({ i: key.mart, a: tau < 0 ? lerp(SEG.riposo, SEG.batte, sat(u) * sat(u)) : lerp(SEG.batte, SEG.riposo, eOut(sat(tau / 0.14))) + (tau > 0.14 ? 0.1 * Math.exp(-(tau - 0.14) / 0.04) * Math.sin((tau - 0.14) * 50) : 0) }); o.su = Math.max(o.su, Math.min(seg(dt, 0.015, BAT - 0.01), 1 - seg(dt, BAT + 0.03, BAT + 0.14))); } }
        if (t >= ts) { o.righe[r] += e.ch; o.col++; const u = sat((t - ts) / 0.07); o.colE += eOut(u) + 0.14 * Math.sin(Math.PI * u) * (1 - u); if (o.col === MS.campana) o.ding = ts; } }
      else if (e.k === 'bs') { if (o.col > 0) { o.righe[r] = o.righe[r].slice(0, -1); o.col--; o.colE -= eOut(sat(dt / 0.07)); } if (dt < 0.3) o.tasti.push({ k: null, g: 0 }); }
      else { const w = eIO(seg(dt, 0.04, 0.4)), tau = dt - 0.4; o.colE -= o.col * w - (tau > 0 ? 0.32 * Math.exp(-tau / 0.045) * Math.sin(tau * 46) : 0); o.col = 0; o.righe.push(''); o.righeE += eBack(seg(dt, 0.02, 0.16), 1.3); o.leva = Math.max(o.leva, Math.sin(Math.PI * sat(dt / 0.34))); o.ult = e.t; o.ultK = null; }
      const nl = o.col >= 13 ? 1 : o.col <= 8 ? -1 : lato; if (nl !== lato) { lato = nl; o.tLato = e.t; } }
    o.lato = lato; return o;
  }
  const SCR = { ev: [] }; { let t = T.contatto + 1.3; const batti = (s) => { for (const ch of s) { SCR.ev.push({ t, k: 'ch', ch }); t += ch === ' ' ? 0.17 : 0.118 + 0.05 * hash(SCR.ev.length * 3.3); } };
    batti('ciao imad, che bel sito.'); t += 0.12; SCR.ev.push({ t, k: 'ret' }); t += 0.62; batti('a presto'); }
  const VIVO = { ev: [], manopola: 0, dotT: -9, tenuto: null };
  const pulito = (ch) => { ch = ch.toLowerCase(); const i = 'àáâäèéêëìíîïòóôöùúûü’`'.indexOf(ch); return i < 0 ? ch : 'aaaaeeeeiiiioooouuuu\'\''[i]; };

  /* ================================================================ lo stato di Dot al tempo t */
  const mix = (a, b, u) => (a == null && b == null ? undefined : lerp(a == null ? 0 : a, b == null ? 0 : b, u)), pair = (a, b, u) => [mix(a && a[0], b && b[0], u), mix(a && a[1], b && b[1], u)];
  function dotA(t) {
    if (t < K[0].t) return null;
    let i = K.length - 1; while (i > 0 && K[i].t > t) i--; const a = K[i], b = K[i + 1];
    if (a.via) return null;
    if (a.passo || !a.liscio || !b) {
      const s = Object.assign({}, a), scie = [];
      if (a.passo) for (let j = 1; j <= 2; j++) { const q = K[i - j]; if (q && q.passo && !q.via) scie.push({ s: q, a: (j === 1 ? 0.36 : 0.17) * (1 - sat((t - a.t) / 0.19)) }); }
      if (!a.passo) s.t = t; return { s, scie };
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
  const mB = new THREE.Matrix4(), vX = new THREE.Vector3(), vY = new THREE.Vector3(), vZ = new THREE.Vector3(), carrellati = [R.rullo, R.levaRit, R.foglio, R.manopole.px[0], R.manopole.px[1]];
  function applica(t, vista = {}) {
    const info = { t, battuta: 0, macchina: true, testo: '' }; for (let i = 0; i < BATTUTE.length; i++) if (t >= T[BATTUTE[i][0]]) info.battuta = i;
    const uTl = smooth(seg(t, T.fuori, T.riordino)); info.ora = ora0 + 24 * uTl; info.timelapse = t >= T.fuori && t < T.riordino ? 1 : 0;
    const L = sc.illumina(info.ora, vista.cielo), cam = Object.assign({}, vista.cam || camA(t));
    if (!vista.fermo) for (const e of EV) if (e.tipo === 'scossa') { const tau = t - e.t; if (tau > 0 && tau < 0.5) { const q = e.A * Math.exp(-tau / 0.085) * Math.sin(tau * 68); cam.ty += q; cam.tx += q * 0.45; } }
    const cc = sc.cinepresa(cam), amb = { pxUnita: cc.pxCm * sc.UN * SC, stira: 1 / Math.cos(cam.pitch), scuro: sc.scuro, giro: cam.giro || 0, sole: L.az };
    tessereA(t);
    /* ---- chi scrive: la storia (da sola) o chi guarda (dal vivo) */
    const vivo = !!vista.vivo && t >= T.contatto + 0.9, inC = t >= T.contatto, N = inC ? leggi(vivo ? VIVO : SCR, vivo ? vista.ora : t) : null;
    const rit = eIO(seg(t, T.contatto + 0.5, T.contatto + 0.88)), ritT = t - T.contatto - 0.88;
    const car = !inC ? carB(t) : lerp(0, MS.margine, rit) + (ritT > 0 && ritT < 0.4 ? 0.3 * Math.exp(-ritT / 0.045) * Math.sin(ritT * 46) : 0) - (N.colE) * MS.passo;
    const fuori = (t < T.contatto ? fuoriB(t) : MS.cima0 + N.righeE * MS.linea) + (vivo ? VIVO.manopola : 0), girato = (fuori - F_DIETRO) / RULLO.r;
    /* ---- Dot */
    const d = dotA(t); let s = d && d.s;
    if (s && s.sbircia) {                                                         /* dietro il carrello, dal lato dove il foglio non c'è; guarda la battuta, poi chi scrive */
      s = Object.assign({}, s); const tc = vivo ? vista.ora : t, dl = tc - N.tLato, lato = N.lato, giu = dl < 0.36 ? Math.sin(Math.PI * sat(dl / 0.36)) : 0, lx = dl < 0.18 ? -lato : lato;
      s.x = lx * 9.8; s.y = -10.5 * giu; s.yaw = lx < 0 ? Y.viewRight : Y.viewLeft; s.t = tc; s.ombra = 0;
      if (tc - N.ult < 0.7) { s.look = [-lx * 0.5, -0.3]; s.gaze = [-lx * 0.5, -0.6]; s.pupil = 1; } else { s.look = 'v'; s.gaze = [0, 0]; }
      s.over = { ear: tc - N.ding < 0.5 && tc >= N.ding ? -0.2 : 0, eye: tc - N.ding < 0.5 && tc >= N.ding ? 1.3 : 1 }; s.blink = Math.abs(((tc * 0.31) % 1) - 0.5) < 0.012 ? 0 : 1;
    }
    if (s && vista.ora != null && vista.ora - VIVO.dotT < 1.1 && !info.timelapse && !s.bocca) {   /* toccato: un sobbalzo, poi guarda chi l'ha toccato con la testa piegata */
      const q = vista.ora - VIVO.dotT; s = Object.assign({}, s); if (q < 0.22) { s.pose = 'startle'; s.y = (s.y || 0) + 1.6 * Math.sin(Math.PI * q / 0.22); s.pupil = 0.4; } else { s.look = 'v'; s.gaze = [0, 0]; s.over = Object.assign({}, s.over, { hr: 0.26, eye: 1.2 }); s.pupil = 1; } }
    dot.mostra(s, d && d.scie, amb); info.dot = s;
    C.mano = null; if (s) { const f = dot.fotogramma(); C.mano = dot.punto(s, f.hold.x, f.hold.y, amb, new THREE.Vector3()); }
    /* ---- i pezzi lungo le loro vie */
    for (const v of vie) v.applica(t, C);
    /* ---- il carrello e ciò che porta */
    if (R.carrello.visible) R.carrello.position.x += car * S * seg(t, T.carrello + 0.04, T.carrello + 0.44);
    for (const q of carrellati) if (q.visible && t >= T.carrello + 0.9) { const via0 = q.via.s[q.via.s.length - 1]; if (t >= via0.t1 - 0.02) q.position.x += car * S; }
    if (t >= T.rullo + 0.5) { R.rullo.quaternion.setFromAxisAngle(X, -girato); for (let i = 0; i < 2; i++) if (t >= R.manopole.px[i].via.s[1].t1) R.manopole.giro(i, -girato * (i ? 1 : -1), R.manopole.px[i].quaternion); }
    R.foglio.posa(t < T.foglio + 0.5 ? F_DIETRO : fuori); R.scrivi(N ? N.righe : [], inC && t >= T.contatto + 0.6 && !vivo && N.righe.length === 1 && !N.righe[0] && t < SCR.ev[0].t + BAT ? 'Scrivi qui.' : vivo && !VIVO.ev.length ? 'Scrivi qui.' : '');
    const lv = !inC ? 0 : Math.max(N.leva, Math.sin(Math.PI * seg(t, T.contatto + 0.44, T.contatto + 0.8))); if (R.levaRit.visible && t >= T.rullo + 1.2) R.levaRit.quaternion.setFromAxisAngle(AX, 0.42 * lv);
    /* ---- i martelletti: l'onda di prova, la battuta di prova, chi scrive; i tasti che scendono; il nastro che si alza */
    if (t >= ONDA[0] && t < ONDA[0] + 0.6) R.mart.px.forEach((p, i) => { const u = (t - ONDA[0] - (43 - i) * ONDA[1]) / 0.11; if (u > 0 && u < 1 && t > tMart[i] + 0.4) R.mart.giro(i, SEG.riposo + 0.5 * Math.sin(Math.PI * u) * Math.sin(Math.PI * u), p.quaternion); });
    const batt = N ? N.mart.slice() : [], giu = N ? N.tasti.slice() : []; let su = N ? N.su : 0;
    { const dt = t - PROVA.t; if (dt > 0 && dt < 0.4) { const tau = dt - BAT; batt.push({ i: PROVA.k.mart, a: tau < 0 ? lerp(SEG.riposo, SEG.batte, sat(dt / BAT) * sat(dt / BAT)) : lerp(SEG.batte, SEG.riposo, eOut(sat(tau / 0.14))) }); giu.push({ k: PROVA.k, g: giuDi(dt) }); } }
    for (const b of batt) R.mart.giro(b.i, b.a, R.mart.px[b.i].quaternion);
    if (vivo && VIVO.tenuto) giu.push({ k: VIVO.tenuto === ' ' ? null : R.tastoDi[VIVO.tenuto], g: 1 });
    for (const g of giu) { if (g.k) { R.cime.px[g.k.i].position.y -= 0.62 * S * g.g; R.leve.px[g.k.i].position.y -= 0.62 * S * g.g; } else if (g.g) { R.barra.position.y -= 0.5 * S * g.g; R.leve.px[TK.length].position.y -= 0.5 * S * g.g; R.leve.px[TK.length + 1].position.y -= 0.5 * S * g.g; } }
    for (const tc of COLPI) { const tau = t - tc; if (tau > 0 && tau < 0.3) R.leve.px.forEach((p, i) => { if (p.visible) p.position.y += 0.1 * Math.exp(-tau / 0.05) * Math.sin(tau * 44 + i * 0.7); }); }
    const nu = t >= T.nastro + 0.4 ? nastroU(t) : 0; R.nastro.stendi(nu, su * 0.5 + 0.5 * Math.sin(Math.PI * seg(t, T.nastro + 0.6, T.nastro + 0.78))); R.nastro.visible = nu > 0; if (R.forcella.visible) R.forcella.position.y += (su * 0.5 + 0.5 * Math.sin(Math.PI * seg(t, T.nastro + 0.6, T.nastro + 0.78))) * S;
    if (nu > 0) for (let i = 0; i < 2; i++) R.bobine.px[i].quaternion.setFromAxisAngle(AX, (i ? -1 : 1) * nu * 5 + (N ? N.colE * 0.12 : 0));
    else for (let i = 0; i < 2; i++) { const a = R.bobine.px[i].via.s[1], tau = t - a.t1; if (tau > 0 && tau < 0.5) R.bobine.px[i].quaternion.setFromAxisAngle(AX, 5 * (1 - Math.exp(-tau / 0.14))); }
    /* ---- il punto d'oro sta sul suo tasto; si accende quando è posato */
    { const p = R.cime.px[kO.i]; R.punto.visible = p.visible; R.punto.quaternion.copy(p.quaternion); R.punto.scale.copy(p.scale); R.punto.position.copy(p.position).addScaledVector(tv.set(0, 0.4, 0).applyQuaternion(p.quaternion), p.scale.y);
      const posato = t >= T_PUNTO.posato; sc.M.oro.emissiveIntensity = 0.35 + (posato ? 0.45 + 0.9 * Math.exp(-(t - T_PUNTO.posato) / 0.3) : 0); info.punto = posato ? p.position : null; }
    { const tau = (inC && N.ding > 0 ? (vivo ? vista.ora : t) - N.ding : t - DING); if (R.campana.visible && tau > 0 && tau < 0.5) R.campana.position.x += 0.05 * Math.exp(-tau / 0.12) * Math.sin(tau * 110); }
    R.bicchiere.userData.livello(t < T.mecc + 0.9 ? 1 : t < T.leve + 1.98 ? 0.7 : t < T.nastro + 1.21 ? 0.4 : 0.12);
    /* ---- gli attrezzi in zampa, il bicchiere, il bottone */
    for (const nm of nomiAtt) for (const u of uso[nm] || []) { const o = R.att[nm]; if (t >= u.t0 - 0.12 && t < u.t0) arco(o, slotAtt[nm], 1 - (u.t0 - t) / 0.12, s); else if (t >= u.t1 && t < u.t1 + 0.14) arco(o, slotAtt[nm], 1 - (t - u.t1) / 0.14, s, true); }
    P.bottone.visible = false;
    if (s) { const f = dot.fotogramma();
      if (s.porta) { const q = s.porta, o = q.cosa === 'bicchiere' ? R.bicchiere : R.att[q.cosa];
        if (q.bevi) { dot.punto(s, f.hold.x, f.hold.y - 4.2, amb, o.position); o.quaternion.copy(Q(0.5, 0, (Math.cos(s.yaw == null ? 0 : s.yaw) < 0 ? 1 : -1) * 0.5)); o.scale.setScalar(1.6); o.visible = true; }
        else if (q.colpo) martella(o, q.colpo, q.d, q.alzato);
        else { const m = q.mano, mano = m ? dot.punto(s, (Math.cos(s.yaw == null ? -Math.PI / 2 : s.yaw) < -0.3 ? -1 : 1) * m[0], m[1], amb, tv2) : dot.punto(s, f.hold.x, f.hold.y + 1.5, amb, tv2); punta(o, q.segue ? PINZA(t) : q.punta, mano, q.gira || 0); } }
      if (s.bocca) { dot.punto(s, f.mouth.x, f.mouth.y - 4.6, amb, P.bottone.position); P.bottone.position.z += 0.3; P.bottone.quaternion.identity(); P.bottone.scale.setScalar(0.8); P.bottone.visible = t >= T_BOTT.fuori; } }
    if (t >= T_BOTT.posato) { const tau = t - T_BOTT.posato, q = 0.14 * Math.exp(-tau / 0.05) * Math.cos(tau * 40); P.bottone.visible = true; P.bottone.position.copy(BOTT); P.bottone.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.5); P.bottone.quaternion.identity(); }
    else if (t >= T_BOTT.giu && s) { const f = dot.fotogramma(), a = eIO(seg(t, T_BOTT.giu, T_BOTT.posato)); dot.punto(s, f.mouth.x, f.mouth.y - 4.6, amb, tv2); tv2.z += 0.3; P.bottone.visible = true; P.bottone.position.lerpVectors(tv2, BOTT, a); P.bottone.position.y += 1.6 * 4 * a * (1 - a) * 0.5; P.bottone.quaternion.identity(); P.bottone.scale.setScalar(lerp(0.8, 1, a)); }
    for (const f of R.famiglie) f.scrivi();
    /* ---- gli effetti: piccoli, locali, trasparenti */
    fx.inizio(sc.camera);
    if (!vista.fermo) { for (const e of EV) { const eta = t - e.t; if (eta < 0 || eta > 0.6) continue;
        if (e.tipo === 'tonfo') fx.tonfo(e.p, e.r, e.f, eta, e.seme); else if (e.tipo === 'tic') fx.tic(e.p, e.r, eta); else if (e.tipo === 'scintille') fx.scintille(e.p, e.n, eta, e.seme, e.f); else if (e.tipo === 'sbuffo') fx.sbuffo(e.p, e.dir, eta, e.seme);
        else if (e.tipo === 'inchiostro') fx.inchiostro(e.p, eta, e.seme); else if (e.tipo === 'goccia') fx.goccia(e.da, e.p, eta); else if (e.tipo === 'onda') fx.onda(e.p, eta); else if (e.tipo === 'luccica') fx.bagliore(e.p, 1 + 3 * eta, 0.7 * sat(1 - eta / 0.3), [1, 0.95, 0.8]); }
      if (N && N.ding > 0) fx.onda(tv.copy(R.campana.position).setY(R.campana.position.y + 0.7), (vivo ? vista.ora : t) - N.ding); }
    if (info.punto) { const tau = t - T_PUNTO.posato, z = 1.5 + 2.4 * Math.exp(-tau / 0.25) + (vista.fermo ? 0 : 0.12 * Math.sin(t * 2.1)); fx.bagliore(tv.copy(info.punto).setY(info.punto.y + 0.6), z, 0.55, [0.96, 0.72, 0.3]); }
    fx.fine();
    info.luce = L; info.cam = cam; info.N = N; info.vivo = vivo; return info;
  }
  /* un attrezzo: la punta sul lavoro, il manico verso la zampa */
  const qT = new THREE.Quaternion(), vT = new THREE.Vector3();
  function punta(o, p, mano, gira) { o.visible = true; o.position.copy(p); vT.subVectors(mano, p); if (vT.y < 0.5) vT.y = 0.5; vT.normalize(); o.quaternion.setFromUnitVectors(AX, vT).multiply(qT.setFromAxisAngle(AX, gira)); o.scale.setScalar(1); }
  /* il martello: la faccia sul punto del colpo; alzato = 1 la testa è su (gira attorno alla zampa); d = da che parte sta Dot */
  function martella(o, p, d, alzato) { const th = alzato * 1.0, brac = 5.2, testa = R.att.martello.userData.testa;
    vY.set(-d * Math.cos(th), -Math.sin(th), 0); vX.set(-d * Math.sin(th), Math.cos(th), 0); vZ.crossVectors(vX, vY); mB.makeBasis(vX, vY, vZ); o.quaternion.setFromRotationMatrix(mB);
    tv.set(p.x - d * brac, p.y + testa, p.z); o.position.copy(tv).addScaledVector(vY, -brac).addScaledVector(vX, -testa).addScaledVector(vY, -0.0); o.position.addScaledVector(vY, 0); o.visible = true; o.scale.setScalar(1); }
  function arco(o, slot, u, s, torna) { if (!s) return; const a = torna ? 1 - u : u; tv.copy(o.position); o.position.lerpVectors(slot.p, tv.set(s.x, (s.y || 0) + 4, s.z + 0.4), a); o.position.y += 6 * 4 * a * (1 - a); o.quaternion.copy(slot.q).multiply(qT.setFromAxisAngle(X, a * TAU)); o.scale.setScalar(1); o.visible = true; }

  /* ================================================================ dal vivo: chi guarda scrive, spinge la leva, gira la manopola, tocca Dot (tocco.js) */
  const futuro = () => leggi(VIVO, 1e9);
  const st = { applica, T, K, CAM, camA, BATTUTE, TL: [T.fuori, T.riordino], SOSTA: T.contatto + 1.12, POSATO: T_BOTT.posato + 0.1, macchina: true,
    /* una lettera: vero se la macchina ha quel tasto. A fine riga torna a capo da sola */
    batti(ch, ora) { ch = pulito(ch); if (ch === '\n') return st.ritorno(ora); if (ch !== ' ' && !R.tastoDi[ch]) return false; const f = futuro(), ult = VIVO.ev.length ? VIVO.ev[VIVO.ev.length - 1].t : -9; let t = Math.max(ora, ult + 0.03);
      if (f.col >= MS.colonne) { if (f.righe.length >= MAXR) return false; VIVO.ev.push({ t, k: 'ret' }); t += 0.46; } VIVO.ev.push({ t, k: 'ch', ch }); return true; },
    ritorno(ora) { const f = futuro(); if (f.righe.length >= MAXR) return false; const ult = VIVO.ev.length ? VIVO.ev[VIVO.ev.length - 1].t : -9; VIVO.ev.push({ t: Math.max(ora, ult + 0.03), k: 'ret' }); return true; },
    cancella(ora) { const f = futuro(); if (f.col <= 0) return false; const ult = VIVO.ev.length ? VIVO.ev[VIVO.ev.length - 1].t : -9; VIVO.ev.push({ t: Math.max(ora, ult + 0.03), k: 'bs' }); return true; },
    testo() { return futuro().righe.join('\n'); }, azzera() { VIVO.ev.length = 0; VIVO.manopola = 0; VIVO.tenuto = null; }, tieni(ch) { VIVO.tenuto = ch; },
    manopola(cm) { VIVO.manopola = Math.max(-1.2, Math.min(7, VIVO.manopola + cm)); return VIVO.manopola; }, toccaDot(ora) { VIVO.dotT = ora; },
    /* dove stanno le cose che si toccano, nel mondo (per trovare che cosa c'è sotto il dito) */
    tasti() { const o = TK.filter((k) => k.ch).map((k) => ({ ch: k.ch, p: R.cime.px[k.i].position })); o.push({ ch: ' ', p: R.barra.position }); return o; },
    leva(out) { return out.copy(R.levaRit.position).add(tv.set(-2.1 * S, 0.9 * S, 5.4 * S)); }, manopole() { return R.manopole.px.map((p) => p.position); },
    testaDot(info, out) { const s = info && info.dot; return s && s.clipY == null ? out.set(s.x, (s.y || 0) + 9 * sc.UN * SC, s.z) : null; }
  };
  return st;
}
void eIn; void tq; void tq2;
