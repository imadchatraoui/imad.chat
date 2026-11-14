/* gatto.js — Dot nella scena 3D. Resta il gatto 2D del sito: lo scheletro (../gatto/dot-rig.js) e l'aspetto «Manifesto»
   (../gatto/look-manifesto.js) disegnano una posa su una tela; la tela è la trama di un piano in piedi nella scena, alla
   profondità giusta, girato verso la cinepresa. Così i pezzi 3D gli passano davanti e dietro, e ne tiene uno tra le zampe.
   Niente di ../gatto/ viene toccato: le pose in più (premere, alzare un tasto, asciugarsi la fronte) sono aggiunte qui,
   sul nostro scheletro, attraverso l'interfaccia pubblica (rig.poses + DOT.pose). */
import * as THREE from 'three';
import { tela } from './forme.js';

export const UN = 0.178;                                  /* centimetri per unità del modello: Dot seduto, col fez, è alto 8 cm */
const BOX = { x0: -46, x1: 46, y0: -16, y1: 60 };         /* il riquadro della tela, in unità del modello */
const BW = BOX.x1 - BOX.x0, BH = BOX.y1 - BOX.y0;

export function creaDot(scena) {
  const DOT = window.DOT, look = DOT.looks.manifesto, rig = DOT.makeRig(look.preset), P = rig.poses, pose = DOT.pose, Y = DOT.YAW;
  /* ---- le pose del cantiere (nostre) */
  P.premiA = pose({ hy: 8.2, cy: 12.2, cx: 3.4, dx: 2.4, dy: 8.2, f0x: 9, f0y: -6.5, fo0: 5.6, f1x: 5.2, f1y: 0, hp: -0.36, hr: 0.13, eye: 1.05 }, P.sit);
  P.premiB = pose({ hy: 8.2, cy: 12.2, cx: 3.4, dx: 2.4, dy: 8.2, f1x: 9, f1y: -6.5, fo1: 5.6, f0x: 5.2, f0y: 0, hp: -0.36, hr: -0.13, eye: 1.05 }, P.sit);
  P.premi2 = pose({ hy: 8.4, cy: 11.6, cx: 3.8, dx: 2.8, dy: 8, f0x: 8.8, f0y: -5.6, fo0: 3.6, f1x: 8.2, f1y: -5.6, fo1: 3.6, hp: -0.36, eye: 1.08 }, P.sit);
  P.alza = pose({ f0x: 8.4, f0y: 15.6, f1x: 7.6, f1y: 15.6, fs: 0.5, fo: 2.4, hp: -0.04, hr: 0.1, eye: 1.2, dx: 2.4, dy: 10.6 }, P.sit);
  P.tiene = pose({ f0x: 7.6, f0y: 11, f1x: 6.8, f1y: 11, fs: 0.2, fo: 1.2, hp: -0.1, dx: 2.8, dy: 10 }, P.sit);
  P.asciuga = pose({ f0x: 8.2, f0y: 22, fo0: -1.5, hp: 0.12, eye: 0.35, lid: 0.5, dx: 3, dy: 9.8 }, P.sit);
  P.soddisfatto = pose({ eye: 0.5, lid: 0.35, hp: 0.1, te: 0.2, tc: 0.5 }, P.sit);

  /* ---- gli strati: 0 = Dot, 1 e 2 = le due scie del timelapse */
  function strato(i) {
    const cv = document.createElement('canvas'), tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(BW, BH); geo.translate((BOX.x0 + BOX.x1) / 2, (BOX.y0 + BOX.y1) / 2, 0);   /* l'origine del piano è il punto d'appoggio del gatto */
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.004 }));
    m.visible = false; m.frustumCulled = false; scena.add(m);
    return { cv, c: cv.getContext('2d'), tex, m, key: '', px: 0, f: null };
  }
  const S = [strato(0), strato(1), strato(2)];
  /* chi fa l'ombra: un piano girato verso il sole, che scrive solo nella mappa delle ombre (la sagoma del gatto) */
  const ombra = new THREE.Mesh(S[0].m.geometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  ombra.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: S[0].tex, alphaTest: 0.5, side: THREE.DoubleSide });
  ombra.castShadow = true; ombra.frustumCulled = false; ombra.visible = false; scena.add(ombra);
  /* l'ombra di contatto: una macchia morbida sotto le zampe */
  const mt = tela(128, 128), g = mt.c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(0.45, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); mt.c.fillStyle = g; mt.c.fillRect(0, 0, 128, 128);
  const macchia = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mt.cv), transparent: true, depthWrite: false, toneMapped: false }));
  macchia.visible = false; macchia.renderOrder = -1; scena.add(macchia);

  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  function prepara(s) {
    rig.over = s.over || {}; rig.yawT = s.yaw == null ? Y.front : s.yaw; rig.headMax = null; rig.faceTurn = s.faceTurn == null ? null : s.faceTurn;
    rig.pitchT = s.pitch || 0; rig.rollT = s.roll || 0; rig.longT = s.long || 0; rig.fezOn = s.fez !== false; rig.grounded = s.grounded !== false;
    rig.autoBlink = false; rig.earTwitch = false; rig.blink = s.blink == null ? 1 : s.blink;
    const lk = s.look === 'v' || s.look == null ? [cl(wrap(-Math.PI / 2 - rig.yawT), -0.95, 0.95), 0.04] : s.look;
    rig.look.ty = lk[0]; rig.look.tp = lk[1];
    const gz = s.gaze || [0, 0]; rig.gazeT[0].x = rig.gazeT[1].x = gz[0]; rig.gazeT[0].y = rig.gazeT[1].y = gz[1]; rig.pupilT = s.pupil == null ? 0.8 : s.pupil;
    rig.walkT = s.walk == null ? 0 : 1; rig.speedU = s.walk == null ? 0 : (s.speed || 44) / 1.5; rig.tailSwish = s.swish || 0;
    let nome = s.pose || 'sit';
    if (Array.isArray(nome)) {                             /* [da, a, quanto]: una posa di mezzo, per i movimenti a tempo vero */
      const a = P[nome[0]] || P.sit, b = P[nome[1]] || P.sit, u = nome[2], mix = {}; for (const k in a) mix[k] = a[k] + (b[k] - a[k]) * u;
      P.__mix = mix; rig.poseAs = u < 0.5 ? nome[0] : nome[1]; nome = '__mix';
    } else rig.poseAs = null;
    rig.edge = s.edge || null;
    rig.snap(nome); if (s.walk != null) rig.gait = s.walk; rig.t = s.t == null ? 1.3 : s.t; rig._ws = Math.cos(rig.yaw) >= 0 ? 1 : -1; rig._tp = null; rig._ta = s.tassel || 0;
    return rig.frame();
  }
  function disegna(L, s, amb) {
    /* la tela segue la grandezza a schermo: circa un pixel e un quarto di tela per ogni pixel vero dello schermo */
    const px = cl(Math.ceil(amb.pxUnita * api.dpr * 1.25 * 2) / 2, 3, 22), w = Math.round(BW * px), h = Math.round(BH * px);
    const key = JSON.stringify(s, (k, v) => (k === 'x' || k === 'y' || k === 'z' || k === 'alpha' || k === 'ombra' ? undefined : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)) + px + amb.scuro;
    if (key === L.key) return;
    L.key = key;
    if (L.cv.width !== w || L.cv.height !== h) { L.cv.width = w; L.cv.height = h; L.tex.dispose(); }
    const c = L.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    const f = prepara(s); L.f = f;
    c.setTransform(px * (s.flip ? -1 : 1), 0, 0, -px, -BOX.x0 * px, BOX.y1 * px);
    try { look.draw(c, f, { dark: amb.scuro, rim: amb.rim, scale: amb.pxUnita, shadow: null, clipY: s.clipY == null ? null : s.clipY, pawsOnEdge: !!s.paws }); } catch (e) { console.error('dot', e); }
    if (s.fezGiu && look.drawFez) { c.save(); c.translate(s.fezGiu[0], s.fezGiu[1]); look.drawFez(c, { rBase: f.P.fez.rBase, rTop: f.P.fez.rTop, h: f.P.fez.h, ell: 0.22, top: true, tasselAng: 0.3 }, { dark: amb.scuro, scale: amb.pxUnita }); c.restore(); }
    L.tex.needsUpdate = true;
  }
  function metti(L, s, amb, alpha, dz) {
    const sc = (s.sc || 1) * UN;
    L.m.visible = true; L.m.position.set(s.x, s.y || 0, s.z + dz); L.m.scale.set(sc, sc * amb.stira, 1); L.m.rotation.y = amb.giro || 0; L.m.material.opacity = alpha;
  }
  const api = {
    rig, UN, dpr: 1,
    /* s = lo stato di adesso (o null); scie = [{ s, a }] le pose di prima, che svaniscono; amb = { pxUnita, stira, scuro, giro, sole } */
    mostra(s, scie, amb) {
      for (const L of S) L.m.visible = false; ombra.visible = false; macchia.visible = false;
      if (!s) return;
      (scie || []).forEach((q, i) => { if (i > 1 || q.a <= 0.01) return; const L = S[i + 1]; disegna(L, q.s, amb); metti(L, q.s, amb, q.a, -0.05 * (i + 1)); });
      disegna(S[0], s, amb); metti(S[0], s, amb, s.alpha == null ? 1 : s.alpha, 0);
      const sc = (s.sc || 1) * UN;
      if (s.ombra !== 0 && s.clipY == null) {
        ombra.visible = true; ombra.position.set(s.x, s.y || 0, s.z); ombra.scale.set(sc, sc, 1); ombra.rotation.y = amb.sole == null ? 0 : amb.sole;
        const k = s.ombra == null ? 1 : s.ombra; macchia.visible = k > 0.02; macchia.position.set(s.x - (s.flip ? -1 : 1) * 2 * sc, (s.suolo == null ? s.y || 0 : s.suolo) + 0.012, s.z + 0.25); macchia.scale.set(42 * sc, 1, 17 * sc); macchia.material.opacity = (amb.scuro ? 0.55 : 0.34) * k;
      }
    },
    /* un punto del gatto (unità del modello) nel mondo: per mettergli un pezzo 3D tra le zampe */
    punto(s, mx, my, amb, out = new THREE.Vector3()) { const sc = (s.sc || 1) * UN; return out.set(s.x + (s.flip ? -1 : 1) * mx * sc * Math.cos(amb.giro || 0), (s.y || 0) + my * sc * amb.stira, s.z + 0.32); },
    fotogramma() { return S[0].f; },
    /* per le prove: lo stesso stato, solo il fotogramma */
    calcola(s) { return prepara(s); }
  };
  return api;
}
