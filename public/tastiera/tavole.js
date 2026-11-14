/* tavole.js — le viste ferme dell'anteprima: i due stili insieme, i pezzi stesi in ordine, la zona contatto della
   macchina da scrivere, la versione «riduci movimento». Tutto parte dalla storia (la tastiera finita) e sposta i pezzi. */
import * as THREE from 'three';
import * as PT from './parti.js';
import * as BN from './banco.js';
import { creaMacchina, MS } from './macchina.js';
import { T } from './storia.js';
import { ATT } from './scena.js';
import { hash } from './forme.js';

const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
export function creaTavole(sc, st, { stile, vista, q }) {
  const { P, dot, ponte, qK } = sc, Y = window.DOT.YAW, strato = document.createElement('div'); strato.id = 'etichette'; document.body.appendChild(strato);
  const css = document.createElement('style'); css.textContent = '#etichette i { position: fixed; font: 500 9.5px/14px var(--font-mono); letter-spacing: .07em; text-transform: uppercase; font-style: normal; color: var(--ink-meta); white-space: nowrap; transform: translate(-50%, 0); } #etichette i.s { transform: none; } #etichette i b { font-weight: 500; color: var(--accent); } :root[data-tema="chiaro"] #etichette i b { color: #7f5810; }'; document.head.appendChild(css);
  let mac = null; const macchina = () => { if (!mac) { mac = creaMacchina(sc.M); mac.scale.setScalar(0.9); sc.scene.add(mac); } return mac; };
  const v = new THREE.Vector3();
  function etichette(list) { strato.innerHTML = ''; if (q.get('nudo')) return; const w = sc.renderer.domElement.clientWidth, h = sc.renderer.domElement.clientHeight;
    for (const e of list) { v.set(e.x, e.y || 0, e.z).project(sc.camera); const el = document.createElement('i'); if (e.s) el.className = 's'; el.innerHTML = e.t; el.style.left = ((v.x * 0.5 + 0.5) * w + (e.dx || 0)).toFixed(1) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * h + (e.dy || 0)).toFixed(1) + 'px'; strato.appendChild(el); } }
  const lastra = (D, zc) => { P.lastra.geometry.dispose(); P.lastra.geometry = BN.lastra(BN.LASTRA.W, D); P.lastra.position.set(0, 0, zc); };
  const metti = (o, x, y, z, qq, s) => { o.visible = true; o.matrixAutoUpdate = true; o.position.set(x, y, z); o.quaternion.copy(qq || Q()); o.scale.setScalar(s == null ? 1 : s); };
  const amb = (cam, cc, L) => ({ pxUnita: cc.pxCm * sc.UN, stira: 1 / Math.cos(cam.pitch), scuro: sc.scuro, giro: 0, sole: L.az });
  const oraDi = () => (q.get('ora') ? +q.get('ora') : sc.scuro ? 22.2 : 10.3);

  /* ---------------------------------------------------------------- i due stili: la tastiera davanti, la macchina dietro */
  function due() {
    const cam = { tx: 0, ty: 2, tz: -7.6, larg: 45.5, alt: 62, pitch: 0.95, su: 0 }, info = st.applica(15.62, { cielo: document.documentElement, cam });
    P.scatola.visible = false; P.cavo.visible = false; const m = macchina(); m.position.set(0, 0, -15.5);
    const s = { x: 15.2, y: 0, z: 3.3, pose: 'sit', yaw: Y.viewLeft, look: 'v', t: 2 }; dot.mostra(s, [], amb(cam, sc.cinepresa(cam), info.luce));
    etichette([{ t: '<b>1</b> · tastiera', x: 0, z: 18.6, dy: 4 }, { t: '<b>2</b> · macchina da scrivere', x: 0, z: 0.4, dy: 2 }]);
    info.fermo = false; info.t = 0; info.testo = ''; return info;
  }
  /* ---------------------------------------------------------------- i pezzi della tastiera, stesi in ordine */
  let cavo2 = null, smontato = null;
  function pezziTastiera() {
    const cam = { tx: 0, ty: 0, tz: 0.4, larg: 44.5, alt: 104, pitch: 1.1, su: 0 }, info = st.applica(5.96, { cielo: document.documentElement, cam });
    sc.illumina(oraDi(), document.documentElement); lastra(88.6, 0); P.cavo.visible = false; for (const a of P.anelli) a.visible = false;
    /* fila A: la scatola, il tè, gli attrezzi, il piattino con le viti, il bottone */
    metti(P.scatola, -15.4, 0, -39.4); P.scatola.userData.apri(1.95); metti(P.bicchiere, -11.2, 0, -41.3);
    ['cacciavite', 'pinzette', 'estrattore', 'saldatore', 'pennello'].forEach((n, i) => metti(P.att[n], -7.4 + i * 2.5, P.att[n].userData.r0 * ATT, -35 - (n === 'estrattore' ? 1.4 : 0), Q(-Math.PI / 2, 0, 0), ATT));
    metti(P.piattino, 6.6, 0, -37.4, null, 0.8); P.viti.forEach((m, i) => metti(m, 9.7 + i * 1.05, 0.2, -37.0, Q(Math.PI / 2, 0, 0)));
    metti(P.bottone, 17.1, 0, -38.2, null, 0.8);
    /* file B, C, D: guscio, scheda, piastra */
    metti(P.guscio, 0, ponte.position.y, -24.8, qK); metti(P.scheda, 0, 0.66, -11.2); metti(P.piastra, 0, 0.15, 1.5);
    /* fila E: stabilizzatori, cavo */
    [[-14.3, 13.6], [-9.6, 13.6], [-4.9, 13.6], [-9.6, 10.7]].forEach((p, i) => metti(P.stab[i], p[0], 0.5, p[1]));
    if (!cavo2) { cavo2 = PT.cavo([[1.2, 0.17, 14], [2.6, 0.17, 14], [14.4, 0.17, 14], [16.5, 0.17, 13], [16.5, 0.17, 11.5], [14.4, 0.17, 10.5], [7, 0.17, 10.5], [3.4, 0.17, 10.5]], sc.M, { s1: 2, s2: 11.5, giri: 26, sBar: 21.5 }); sc.scene.add(cavo2); cavo2.userData.esce(1); }
    /* fila F: gli switch (uno è smontato, accanto a Dot) */
    P.sw.forEach((m, i) => { if (i === 67) { m.visible = false; return; } metti(m, -17.6 + (i % 12) * 1.72, 0.5, 19.4 + Math.floor(i / 12) * 1.72); });
    if (!smontato) { smontato = PT.switchSmontato(sc.M); sc.scene.add(smontato); const u = smontato.userData; u.base.position.set(3.9, 0.83, 22.9); u.molla.position.set(6.0, 0.02, 22.9); u.stelo.position.set(8.0, 0.0, 22.9); u.coperchio.position.set(10.2, -0.115, 22.9); }
    /* fila G: i tasti, com'erano sul banco; uno è girato, per vedere il perno */
    const z0 = 34.6 - (-13.2); PT.TASTI.forEach((k) => { const s = st.slotCap[k.id]; metti(P.caps[k.id], s.x, 0, s.z + z0); });
    const gir = P.caps[PT.TASTI.filter((k) => k.w === 1.25)[2].id]; gir.position.y = 0.9; gir.quaternion.copy(Q(0, 0, Math.PI));
    /* Dot, col punto d'oro tra le zampe */
    const s = { x: 15.4, y: 0, z: 24.6, pose: 'tiene', yaw: Y.front, look: [0, 0.05], gaze: [0, -0.35], pupil: 1, t: 2 }, a = amb(cam, sc.cinepresa(cam), info.luce); dot.mostra(s, [], a);
    const f = dot.fotogramma(), cp = P.caps[PT.PUNTO.id]; dot.punto(s, f.hold.x, f.hold.y - 3.4, a, cp.position); cp.quaternion.copy(Q(0.5, 0, 0)); P.alone.visible = true; P.alone.scale.set(1.5, 1.5, 1);
    etichette([{ t: 'la scatola', x: -15.2, z: -36.4, dy: 4 }, { t: 'attrezzi', x: -2.4, z: -33.9 }, { t: 'viti <b>×6</b>', x: 10.4, z: -35.6 }, { t: 'guscio', x: 0, z: -18.9 }, { t: 'scheda', x: 0, z: -6.1 }, { t: 'piastra', x: 0, z: 6.6 },
      { t: 'stabilizzatori <b>×4</b>', x: -9.6, z: 15 }, { t: 'cavo', x: 9, z: 15.2 }, { t: 'switch <b>×68</b>', x: -8.1, z: 28.9 }, { t: 'uno, smontato', x: 7, z: 24.3 }, { t: 'tasti <b>×68</b>', x: 0, z: 44.6 }]);
    info.t = 0; info.testo = ''; return info;
  }
  /* ---------------------------------------------------------------- i pezzi della macchina da scrivere (coordinate della macchina: a schermo valgono 0,9) */
  function pezziMacchina() {
    const cam = { tx: 0, ty: 0, tz: 0.4, larg: 44.5, alt: 100, pitch: 1.1, su: 0 }, info = st.applica(0.0, { cielo: document.documentElement, cam });
    const L = sc.illumina(oraDi(), document.documentElement); lastra(80, 0); for (const t of P.tessere) t.visible = false; P.scatola.visible = false;
    const m = macchina(), R = m.userData; m.position.set(0, 0, 0); R.stato(20, null, 0);
    R.carrello.position.set(1.2, -MS.cima, -25.6);                                    /* il carrello col rullo, in fondo */
    R.cofano.position.set(0, 0, -21);                                                  /* il cofano */
    R.base.position.set(0, 0, -0.5);                                                   /* la base */
    /* il cesto: l'arco e i quaranta martelletti stesi a pettine; le due bobine */
    R.segmento.position.set(-13.4, 0.02, 19.6); R.leve.forEach((b, i) => { b.rotation.set(0, 0, 0); b.position.set(-7.6 + i * 0.44, 0.16, 18.6); });
    R.bobine[0].position.set(13.2, 0, 19.4); R.bobine[1].position.set(17.4, 0, 22.6); R.nastro.visible = false; R.forcella.visible = false;
    /* i tasti nelle loro quattro file, e la barra */
    R.tasti.forEach((t) => { const u = t.userData; if (t === R.barra) t.position.set(-5.4, 1.14, 41.2); else t.position.set(u.x * 0.9 - 5.6, 1.14, 29 + (u.z - 4.9) * 1.36); });
    /* il foglio: un mezzo foglio, piano, con Dot seduto sopra */
    if (!R.piano) { R.piano = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 14.8).rotateX(-Math.PI / 2), sc.M.carta); R.piano.receiveShadow = true; sc.scene.add(R.piano); } R.piano.position.set(12.7, 0.02, 31.4); R.piano.rotation.y = -0.07; R.foglio.visible = false;
    const s = { x: 12.9, y: 0, z: 30.2, pose: 'sit', yaw: Y.viewLeft, look: 'v', t: 2 }; dot.mostra(s, [], amb(cam, sc.cinepresa(cam), L));
    etichette([{ t: 'carrello e rullo', x: 0, z: -30.2 }, { t: 'cofano', x: 0, z: -16.3, dy: -3 }, { t: 'base', x: 0, z: 13.9 }, { t: 'martelletti <b>×40</b>', x: 0.6, z: 23 }, { t: 'bobine', x: 14, z: 15.4, dy: -8 }, { t: 'tasti <b>×46</b>', x: -5, z: 38.6 }, { t: 'il foglio', x: 12.7, z: 39.6 }]);
    info.t = 0; info.testo = ''; return info;
  }
  /* ---------------------------------------------------------------- la zona contatto della macchina: il foglio è il campo */
  function contattoMacchina(t) {
    const cam = { tx: 1.4, ty: 5, tz: -3.5, larg: 41, alt: 46, pitch: 0.78, su: 0.085 }, info = st.applica(0.0, { cielo: document.documentElement, cam });
    const L = sc.illumina(oraDi(), document.documentElement); for (const x of P.tessere) x.visible = false; P.scatola.visible = false;
    const m = macchina(), R = m.userData; m.position.set(0, 0, 3);
    /* ciò che è scritto fin qui, e il tasto che sta scendendo */
    const frase = 'ciao imad, ', dur = 0.19, i = Math.max(0, Math.min(frase.length - 1, Math.floor((t - T.contatto - 0.75) / dur))), u = ((t - T.contatto - 0.75) / dur) % 1, giu = u < 0.32 ? u / 0.32 : u < 0.5 ? 1 : Math.max(0, 1 - (u - 0.5) / 0.3);
    const fatto = frase.slice(0, i + (u > 0.36 ? 1 : 0)); R.scrivi([], fatto); R.stato(fatto.length, frase[i], giu);
    const s = { x: 16.8, y: 0, z: 12.4, pose: 'sit', yaw: Y.viewLeft, look: [0.62, 0.3], gaze: [-0.5, 0.5], pupil: 1, t: 2 }; dot.mostra(s, [], amb(cam, sc.cinepresa(cam), L));
    etichette([]); info.fermo = true; info.macchina = true; info.t = t; info.testo = ''; return info;
  }
  /* ---------------------------------------------------------------- per le prove: le pose del cantiere, tre alla volta (?vista=pose&n=0..3) */
  function pose() {
    const cam = { tx: 0, ty: 4, tz: 0, larg: 30, alt: 0, pitch: 0.9, su: 0 }, info = st.applica(0.0, { cielo: document.documentElement, cam }); for (const x of P.tessere) x.visible = false;
    const L = sc.illumina(oraDi(), document.documentElement), a = amb(cam, sc.cinepresa(cam), L), n = +(q.get('n') || 0);
    const TUTTE = [{ pose: 'premiA' }, { pose: 'premiB' }, { pose: 'premi2' }, { pose: 'alza' }, { pose: 'tiene' }, { pose: 'asciuga', yaw: Y.viewRight }, { pose: 'premi2', fez: false, fezGiu: [13, 0] }, { pose: 'sip', yaw: Y.viewRight }, { pose: 'type' }, { pose: 'peek', clipY: 0, paws: 1, edge: 'top', y: 3 }, { pose: 'push-touch', clipY: 0, paws: 1, edge: 'top', y: 3 }, { pose: 'soddisfatto', yaw: Y.viewRight }];
    const tre = TUTTE.slice(n * 3, n * 3 + 3).map((s, i) => Object.assign({ x: -9 + i * 9, y: 0, z: 0, t: 2, gaze: [0, -0.6] }, s));
    dot.mostra(tre[0], tre.slice(1).map((s) => ({ s, a: 1 })), a); etichette(tre.map((s) => ({ t: s.pose, x: s.x, z: 2.4 }))); info.t = 0; info.testo = ''; return info;
  }
  /* ---------------------------------------------------------------- «riduci movimento»: la tastiera finita e la zona contatto, ferme */
  function fermo() { const info = st.applica(15.6, { cielo: document.documentElement, cam: st.CAM.contatto }); etichette([]); info.fermo = true; info.testo = ''; return info; }

  const libera = (info) => { if (q.get('camq')) { const n = q.get('camq').split(',').map(Number); sc.cinepresa({ tx: n[0], ty: n[1], tz: n[2], larg: n[3], alt: 0, pitch: n[4] == null ? 0.9 : n[4], su: 0 }); strato.innerHTML = ''; } return info; };   /* per guardare da vicino */
  return { applica(t) { void hash; return libera(vista === 'pose' ? pose() : vista === 'due' ? due() : vista === 'pezzi' ? (stile === 'macchina' ? pezziMacchina() : pezziTastiera()) : vista === 'contatto' && stile === 'macchina' ? contattoMacchina(t) : vista === 'fermo' ? fermo() : st.applica(t, { cielo: document.documentElement })); } };
}
