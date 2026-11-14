/* macchina.js — lo stile 2: una macchina da scrivere portatile, nella stessa lingua di materiali (smalto crema, acciaio,
   gomma nera, tasti tondi). Ogni parte è un pezzo a sé, così la tavola dei pezzi la può stendere sul banco.
   Origine: il centro dell'impronta sul banco; x a destra, z verso chi scrive. */
import * as THREE from 'three';
import { loft, tornio, tinta, sposta, fondi, blocco, rettTondo, estruso, tubo, tela, trama, TAU, lerp, sat, smooth, seg, hash } from './forme.js';

export const MS = { W: 29.5, D: 30, cima: 4.2, passoCar: 0.72, margine: -8.2 };
const PP = { x: 0, y: 8.3, z: -10.0 }, SEG = { y: 3.3, z: -9.9, r: 3.6, L: 6.2, riposo: 0.35, batte: 2.19 };   /* il punto di battuta; l'arco dei perni */
const FILE = [
  { z: 4.9, y: 5.7, x0: -10.6, k: '1234567890-'.split('') }, { z: 6.95, y: 5.05, x0: -9.7, k: "qwertyuiop'".split('') },
  { z: 9.0, y: 4.4, x0: -9.2, k: 'asdfghjkl;:'.split('') }, { z: 11.05, y: 3.75, x0: -8.25, k: 'zxcvbnm,./'.split('') }
];
const pezzo = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };

export function creaMacchina(M) {
  const g = new THREE.Group(), R = {};
  const nero = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.62 }), ferro = new THREE.MeshStandardMaterial({ color: 0x7c808b, roughness: 0.36, metalness: 1 });
  /* ---- la base: una vasca smaltata con due pozzi veri (i tasti, il cesto dei martelletti); davanti scende */
  { const sh = new THREE.Shape(); rettTondo(sh, -MS.W / 2, -MS.D / 2, MS.W, MS.D, 3.4);
    const p1 = new THREE.Path(); rettTondo(p1, -12.8, -13.4, 25.6, 10, 1.5); const p2 = new THREE.Path(); rettTondo(p2, -10.3, -1.0, 20.6, 10.2, 1.2); sh.holes.push(p1, p2);
    const geo = estruso(sh, 3.7, 0.42, { bs: 5, cs: 14 }), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i); if (y > 1.4) P.setY(i, y - 1.25 * smooth(seg(z, 2.5, 15)) * sat((y - 1.4) / 1.6)); }
    geo.computeVertexNormals(); geo.translate(0, 0.5, 0);
    R.base = new THREE.Group(); R.base.add(pezzo(geo, M.smalto), pezzo(sposta(blocco(27.6, 0.4, 28, 2.6, 0.1), 0, 0.75, 0), nero));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) R.base.add(pezzo(sposta(tornio([[0, 0], [0.95, 0, 1], [1.1, 0.12], [1.1, 0.5, 1], [0, 0.5]], { seg: 6 }), sx * 11.2, 0, sz * 11.6), M.gomma));
    g.add(R.base); }
  /* ---- il cofano: una U attorno al cesto, due incavi tondi per le bobine; scende verso i tasti */
  { const sh = new THREE.Shape(), r = 2.3, X = 14.6, y0 = -2.6, y1 = 9.4;
    sh.moveTo(-X + r, y0); sh.lineTo(X - r, y0); sh.absarc(X - r, y0 + r, r, -Math.PI / 2, 0, false); sh.lineTo(X, y1 - 0.9); sh.absarc(X - 0.9, y1 - 0.9, 0.9, 0, Math.PI / 2, false);
    sh.lineTo(10.2, y1); sh.absarc(10.2, y1 - 0.6, 0.6, Math.PI / 2, Math.PI, false); sh.absarc(0, y1 - 0.6, 9.6, 0, Math.PI, true); sh.absarc(-10.2, y1 - 0.6, 0.6, 0, Math.PI / 2, false);
    sh.lineTo(-X + 0.9, y1); sh.absarc(-X + 0.9, y1 - 0.9, 0.9, Math.PI / 2, Math.PI, false); sh.lineTo(-X, y0 + r); sh.absarc(-X + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    for (const sx of [-1, 1]) { const p = new THREE.Path(); p.absarc(sx * 11.6, 3.9, 2.2, 0, TAU, false); sh.holes.push(p); }
    const geo = estruso(sh, 3.1, 0.3, { bs: 5, cs: 20 }), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i); if (y > 0.5) P.setY(i, y - 1.15 * smooth(seg(z, -5, 2.6)) * sat((y - 0.5) / 2.2)); }
    geo.computeVertexNormals();
    R.cofano = new THREE.Group(); R.cofano.add(pezzo(geo, M.smalto));
    /* la targhetta: il nome in piccolo, sull'orlo davanti */
    const t = tela(360, 64); t.c.fillStyle = 'rgba(28,29,38,.82)'; t.c.font = '600 30px "Geist Mono", monospace'; t.c.textAlign = 'center'; t.c.textBaseline = 'middle'; t.c.fillText('imad.chat', 180, 34);
    const targa = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.75), new THREE.MeshBasicMaterial({ map: trama(t.cv), transparent: true, depthWrite: false, toneMapped: false })); targa.rotation.x = -Math.PI / 2 + 0.38; targa.position.set(0, 2.02, 2.0); R.cofano.add(targa);
    for (const sx of [-1, 1]) R.cofano.add(pezzo(sposta(tornio([[2.18, 0.25], [2.18, 0.5, 1], [0, 0.5]], { seg: 9 }), sx * 11.6, 0.6, -3.9), nero));   /* il fondo degli incavi */
    R.cofano.position.y = MS.cima; g.add(R.cofano); }
  /* ---- il cesto: l'arco d'acciaio con i perni, e i martelletti a ventaglio */
  { const sh = new THREE.Shape(); sh.absarc(0, 0, SEG.r + 0.7, 0, Math.PI, false); sh.absarc(0, 0, SEG.r - 0.55, Math.PI, 0, true); sh.closePath();
    const arco = estruso(sh, 1.0, 0.08, { cs: 24 }); arco.rotateY(Math.PI);                    /* l'arco guarda in avanti */
    R.segmento = pezzo(arco, ferro); R.segmento.position.set(0, SEG.y - 0.75, SEG.z); g.add(R.segmento);
    const barra = fondi([sposta(blocco(0.12, 0.3, SEG.L, 0.03, 0.03), 0, -0.15, SEG.L / 2), sposta(blocco(0.3, 0.5, 0.28, 0.04, 0.03), 0, -0.14, SEG.L), sposta(tornio([[0, -0.08], [0.2, -0.08, 1], [0.2, 0.08, 1], [0, 0.08]], { seg: 4 }), 0, 0, 0, 0, 0, Math.PI / 2)]);
    R.leve = []; const N = 40;
    for (let i = 0; i < N; i++) { const a = (22 + i * 136 / (N - 1)) * Math.PI / 180, m = pezzo(barra, M.acciaio); m.position.set(SEG.r * Math.cos(a), SEG.y, SEG.z + SEG.r * Math.sin(a)); m.rotation.order = 'YXZ'; m.rotation.y = Math.PI / 2 - a; m.rotation.x = -SEG.riposo; m.userData.a = a; R.leve.push(m); g.add(m); } }
  /* ---- i tasti: tondi, su uno stelo e una leva d'acciaio. Scuri con la lettera chiara; quelli di imad.chat chiari; il punto è d'oro */
  { const S = 128, N = 8, at = tela(N * S, N * S), c = at.c, celle = {}; let n = 0; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const cella = (ch, viva) => { const id = (viva ? 'v' : 's') + ch; if (celle[id] != null) return celle[id]; const x = (n % N) * S, y = Math.floor(n / N) * S; c.fillStyle = viva ? '#fffcf6' : '#2c2d35'; c.fillRect(x, y, S, S);
      if (ch && ch !== '.') { c.fillStyle = viva ? '#1c1d26' : 'rgba(243,238,226,.92)'; c.font = (viva ? '800 ' : '700 ') + S * (viva ? 0.6 : 0.5) + 'px Manrope, sans-serif'; c.fillText(viva ? ch : ch.toUpperCase(), x + S / 2, y + S * (viva ? 0.68 : 0.67)); } return (celle[id] = n++); };
    const base = trama(at.cv), mat = {}, matDi = (ch, viva) => { const i = cella(ch, viva), id = i; if (mat[id]) return mat[id]; const t = base.clone(); t.repeat.set(1 / N, 1 / N); t.offset.set((i % N) / N, 1 - (Math.floor(i / N) + 1) / N); t.needsUpdate = true; return (mat[id] = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, roughness: 0.4 })); };
    const cima = (w) => loft([{ y: 0, w: 0, d: 0, nouv: 1 }, { y: 0, w: w - 0.34, d: 1.22, r: 0.61, nouv: 1 }, { y: 0.07, w: w - 0.1, d: 1.46, r: 0.73 }, { y: 0.2, w: w, d: 1.56, r: 0.78 }, { y: 0.36, w: w, d: 1.56, r: 0.78 }, { y: 0.44, w: w - 0.07, d: 1.49, r: 0.745 }, { y: 0.47, w: w - 0.2, d: 1.36, r: 0.68 },
      { y: 0.445, w: w - 0.3, d: 1.26, r: 0.63 }, { y: 0.41, w: (w - 0.3) * 0.6, d: 0.76, r: 0.38 }, { y: 0.4, w: 0, d: 0 }], { seg: 7, uvW: 1.3, uvD: 1.3 });
    const tondo = cima(1.56), ovale = cima(2.7), stelo = fondi([sposta(tornio([[0, -1.0], [0.085, -1.0, 1], [0.085, 0.02, 1], [0, 0.02]], { seg: 3 }), 0, 0, 0), sposta(blocco(0.13, 0.11, 3.2, 0.03, 0.03), 0, -1.06, -1.6)]);
    R.tasti = []; R.tastoDi = {};
    const metti = (ch, x, y, z, geo, viva, code) => { const t = new THREE.Group(), top = pezzo(geo, ch === '' ? M.grafite : matDi(ch, viva)); top.rotation.x = 0.2; t.add(top, pezzo(stelo, M.acciaio)); t.position.set(x, y - 0.45, z); t.userData = { x, y: y - 0.45, z, ch }; if (code) R.tastoDi[code] = t;
      if (ch === '.') { const p = pezzo(sposta(tornio([[0, 0], [0.3, 0, 1], [0.29, 0.06], [0.2, 0.13], [0, 0.16]], { seg: 6 }), 0, 0.4, 0), M.oro); p.rotation.x = 0.2; p.castShadow = false; t.add(p); } R.tasti.push(t); g.add(t); return t; };
    FILE.forEach((f) => f.k.forEach((ch, i) => metti(ch, f.x0 + i * 1.95, f.y, f.z, tondo, 'imadcht.'.indexOf(ch) >= 0, ch)));
    metti('', -10.75, 3.75, 11.05, ovale, false, 'shift'); metti('', 11.75, 3.75, 11.05, ovale, false, null);
    /* la barra */
    const barra = new THREE.Group(); barra.add(pezzo(loft([{ y: 0, w: 0, d: 0 }, { y: 0, w: 13.4, d: 1.1, r: 0.5 }, { y: 0.1, w: 13.7, d: 1.36, r: 0.66 }, { y: 0.34, w: 13.7, d: 1.36, r: 0.66 }, { y: 0.47, w: 13.5, d: 1.16, r: 0.56 }, { y: 0.5, w: 13.1, d: 0.8, r: 0.4 }, { y: 0.5, w: 0, d: 0 }], { seg: 6 }), M.smalto));
    for (const sx of [-1, 1]) barra.add(pezzo(sposta(stelo.clone(), sx * 5, 0, 0), M.acciaio)); barra.position.set(0.4, 3.3 - 0.5, 12.8); barra.userData = { x: 0.4, y: 2.8, z: 12.8 }; R.tastoDi[' '] = barra; R.tasti.push(barra); R.barra = barra; g.add(barra); }
  /* ---- il carrello: rullo di gomma, manopole, guida della carta, asta premicarta, leva del ritorno. Scorre a ogni lettera */
  { const car = new THREE.Group(); R.carrello = car;
    car.add(pezzo(sposta(blocco(30.6, 1.9, 4.9, 1.0, 0.3, { n: 4, seg: 6 }), 0, MS.cima, -12.2), M.smalto));
    for (const sx of [-1, 1]) car.add(pezzo(sposta(blocco(1.5, 3.5, 4.5, 0.7, 0.3, { n: 4, seg: 6 }), sx * 14.4, MS.cima + 1.2, -12.1), M.smalto));
    const rullo = tornio([[0, -11.7], [1.2, -11.7, 1], [1.55, -11.6, 1], [1.55, 11.6, 1], [1.2, 11.7, 1], [0, 11.7]], { seg: 10 }); car.add(pezzo(sposta(rullo, 0, 7.6, -11.55, 0, 0, Math.PI / 2), nero));
    const man = [[0, 0], [1.25, 0, 1], [1.5, 0.12]]; for (let i = 0; i < 6; i++) man.push([1.5, 0.2 + i * 0.16], [1.42, 0.24 + i * 0.16], [1.42, 0.3 + i * 0.16], [1.5, 0.34 + i * 0.16]); man.push([1.5, 1.2], [1.3, 1.34, 1], [0.5, 1.4], [0, 1.4]);
    for (const sx of [-1, 1]) car.add(pezzo(sposta(tornio(man, { seg: 10 }), sx * 15.3, 7.6, -11.55, 0, 0, -sx * Math.PI / 2), nero));
    car.add(pezzo(sposta(blocco(23.6, 0.12, 4.6, 0.4, 0.05), 0, 0, 0, 1.05), M.smalto)); car.children[car.children.length - 1].position.set(0, 9.4, -14.3);   /* dove si appoggia il foglio */
    car.add(pezzo(tubo([[-12.6, 6.6, -10.1], [-12.6, 10.7, -10.75], [12.6, 10.7, -10.75], [12.6, 6.6, -10.1]], 0.1, { dritto: true, raggio: 0.3, n: 60 }), M.acciaio));
    for (const sx of [-1, 1]) car.add(pezzo(sposta(tornio([[0, -0.4], [0.3, -0.4, 1], [0.42, -0.34], [0.42, 0.34], [0.3, 0.4, 1], [0, 0.4]], { seg: 6 }), sx * 5.2, 10.7, -10.75, 0, 0, Math.PI / 2), nero));
    car.add(pezzo(sposta(blocco(23.2, 0.07, 0.62, 0.05, 0.02), 0, 6.55, -9.72, 0.5), M.acciaio));                                  /* il righello davanti al rullo */
    car.add(pezzo(tubo([[-14.6, 7.0, -10.3], [-15.9, 7.5, -9.2], [-16.6, 7.8, -7.4], [-16.7, 7.9, -5.4]], 0.13, { n: 40 }), M.acciaio));
    car.add(pezzo(sposta(blocco(0.9, 0.12, 2.0, 0.4, 0.05), -16.7, 7.86, -4.6, 0.05), M.acciaio));                                  /* la paletta della leva */
    /* il foglio: esce dal rullo, sale e si appoggia all'indietro. La scritta è una tela */
    const tf = tela(1050, 800), tt = trama(tf.cv, { aniso: 16 }), L = 16, prof = [[-9.96, 8.05], [-10.25, 9.6], [-11.0, 11.9], [-12.4, 15.0], [-14.3, 18.2], [-16.6, 21.2]];
    const cur = new THREE.CatmullRomCurve3(prof.map((p) => new THREE.Vector3(0, p[1], p[0]))), fg = new THREE.PlaneGeometry(21, L, 24, 30), FP = fg.attributes.position, pt = new THREE.Vector3();
    for (let i = 0; i < FP.count; i++) { const x = FP.getX(i), v = FP.getY(i) / L + 0.5; cur.getPointAt(v, pt); FP.setXYZ(i, x, pt.y + 0.05 * v * Math.cos(x * 0.3), pt.z - 0.35 * v * v * (x / 10.5) * (x / 10.5)); }
    fg.computeVertexNormals(); R.foglio = pezzo(fg, new THREE.MeshStandardMaterial({ color: 0xffffff, map: tt, roughness: 0.9, side: THREE.DoubleSide })); car.add(R.foglio);
    R.scrivi = (righe, riga) => { const c = tf.c; c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, 1050, 800); c.font = '600 60px "Geist Mono", monospace'; c.textBaseline = 'alphabetic';
      const px = 1050 / 21, base = 800 - 0.5 * px; righe.concat([riga]).forEach((s, j, all) => { const y = base - (all.length - 1 - j) * 1.5 * px; for (let i = 0; i < s.length; i++) { c.fillStyle = 'rgba(28,29,38,' + (0.78 + 0.2 * hash(i * 7 + j * 31)).toFixed(2) + ')'; c.fillText(s[i], (10.5 + MS.margine + i * MS.passoCar) * px - 18, y + (hash(i * 3 + j) - 0.5) * 2.4); } }); tt.needsUpdate = true; };
    R.scrivi([], ''); g.add(car); }
  /* ---- le bobine e il nastro */
  { const bob = () => { const b = new THREE.Group(); b.add(pezzo(tornio([[0, 0], [2.0, 0, 1], [2.02, 0.05], [2.0, 0.1, 1], [1.5, 0.1, 1], [1.5, 1.1, 1], [2.0, 1.1, 1], [2.02, 1.15], [2.0, 1.2, 1], [0.7, 1.2, 1], [0.7, 1.32, 1], [0.24, 1.32, 1], [0.24, 1.44, 1], [0, 1.44]], { seg: 10 }), ferro), pezzo(tornio([[1.5, 0.1], [1.72, 0.12, 1], [1.72, 1.08, 1], [1.5, 1.1]], { seg: 10 }), nero)); return b; };
    R.bobine = [-1, 1].map((sx) => { const b = bob(); b.position.set(sx * 11.6, MS.cima + 1.05, -3.9); g.add(b); return b; });
    const via = new THREE.CatmullRomCurve3([[-10.3, 5.8, -5.5], [-7.4, 6.2, -7.7], [-3, 6.9, -9.3], [-0.8, 7.5, -9.74], [0.8, 7.5, -9.74], [3, 6.9, -9.3], [7.4, 6.2, -7.7], [10.3, 5.8, -5.5]].map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.3);
    const fr = new THREE.Shape(); fr.moveTo(-0.5, -0.02); fr.lineTo(0.5, -0.02); fr.lineTo(0.5, 0.02); fr.lineTo(-0.5, 0.02); fr.closePath();
    R.nastro = pezzo(new THREE.ExtrudeGeometry(fr, { steps: 60, extrudePath: via, bevelEnabled: false }), nero); g.add(R.nastro);
    R.forcella = pezzo(fondi([sposta(blocco(0.12, 1.5, 0.1, 0.03, 0.03), -0.75, 6.4, -9.74), sposta(blocco(0.12, 1.5, 0.1, 0.03, 0.03), 0.75, 6.4, -9.74), sposta(blocco(1.62, 0.14, 0.1, 0.03, 0.03), 0, 6.4, -9.74)]), M.acciaio); g.add(R.forcella); }
  g.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  /* ---- lo stato: quante lettere sono scritte (il carrello scorre), quale tasto è giù e di quanto (0..1) */
  const chiavi = Object.keys(R.tastoDi).filter((k) => k.length === 1 && k !== ' ').sort((a, b) => R.tastoDi[a].userData.x - R.tastoDi[b].userData.x);
  R.stato = (n, tasto, u) => {
    R.carrello.position.x = -MS.margine - n * MS.passoCar - 0.0;
    for (const t of R.tasti) t.position.y = t.userData.y;
    for (const m of R.leve) m.rotation.x = -SEG.riposo;
    const k = tasto != null && R.tastoDi[tasto]; if (!k || !u) return;
    k.position.y = k.userData.y - 0.75 * Math.min(1, u * 1.4);
    if (tasto !== ' ') { const i = Math.round(chiavi.indexOf(tasto) * (R.leve.length - 1) / (chiavi.length - 1)); if (R.leve[i]) R.leve[i].rotation.x = -lerp(SEG.riposo, SEG.batte, u * u); }
  };
  R.stato(Math.round(-MS.margine / MS.passoCar), null, 0);
  g.userData = R; void PP; void tinta;
  return g;
}
