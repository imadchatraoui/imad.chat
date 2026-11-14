/* effetti.js — polvere, scintille, una goccia d'olio, polvere d'inchiostro, uno sbuffo, l'onda del campanello.
   Tutto è piccolo, locale e trasparente: niente copre mai il pezzo che si sta posando. Due sole chiamate di disegno:
   i «veli» (polvere, sbuffi, granelli: si mescolano al fondo) e le «luci» (scintille, bagliori: si sommano).
   Ogni effetto è funzione dell'età (secondi da quando è nato) e di un seme: lo stesso fotogramma si può rifare uguale. */
import * as THREE from 'three';
import { hash, sat, eOut, smooth, TAU } from './forme.js';

const VERT = 'attribute vec4 aCol; attribute vec4 aPar; varying vec4 vCol; varying vec4 vPar; varying vec2 vP; void main(){ vCol = aCol; vPar = aPar; vP = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 ); }';
/* aPar.x = che cosa: 0 anello sottile (y = spessore, z = sfumatura), 1 disco morbido (y = dove comincia a sfumare), 2 striscia (y = dove comincia ad assottigliarsi) */
const FRAG = 'varying vec4 vCol; varying vec4 vPar; varying vec2 vP; void main(){ float r = length( vP ), a; if ( vPar.x < 0.5 ) { a = smoothstep( 1.0 - vPar.y - vPar.z, 1.0 - vPar.y, r ) * ( 1.0 - smoothstep( 1.0 - vPar.z, 1.0, r ) ); } else if ( vPar.x < 1.5 ) { a = 1.0 - smoothstep( vPar.y, 1.0, r ); } else { a = ( 1.0 - smoothstep( 0.0, 1.0, abs( vP.y ) ) ) * ( 1.0 - smoothstep( vPar.y, 1.0, abs( vP.x ) ) ); } if ( a * vCol.a < 0.003 ) discard; gl_FragColor = vec4( vCol.rgb, vCol.a * a ); }';

export function creaEffetti(scene, scuro) {
  function strato(n, somma) {
    const b = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(); g.index = b.index; g.setAttribute('position', b.attributes.position); g.setAttribute('uv', b.attributes.uv);
    const col = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), par = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); g.setAttribute('aCol', col); g.setAttribute('aPar', par);
    const m = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: somma ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }), n);
    m.frustumCulled = false; m.renderOrder = somma ? 31 : 3; m.count = 0; scene.add(m); return { m, col, par, n: 0, max: n };
  }
  const veli = strato(160, false), luci = strato(96, true);
  /* una luce calda e breve sui pezzi vicini a una scintilla: sempre nella scena (spenta), così accenderla non costa niente */
  const lampo = new THREE.PointLight(0xffb060, 0, 16, 2); scene.add(lampo); let lampoI = 0;
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), qS = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), sc = new THREE.Vector3(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), cx = new THREE.Vector3(), cy = new THREE.Vector3();
  let cam = null;
  /* un pezzetto: dove = 's' steso sul piano, 'c' girato verso la cinepresa, numero = girato verso la cinepresa e ruotato di quell'angolo */
  function metti(L, tipo, p, sx, sy, c, a, p1, p2, dove) {
    if (L.n >= L.max || a <= 0.004) return; const i = L.n++;
    if (dove === 's') q.copy(qS); else { q.copy(cam.quaternion); if (typeof dove === 'number') q.multiply(qz.setFromAxisAngle(Z, dove)); }
    L.m.setMatrixAt(i, M4.compose(p, q, sc.set(sx, sy, 1))); L.col.setXYZW(i, c[0], c[1], c[2], a); L.par.setXYZW(i, tipo, p1 || 0, p2 || 0, 0);
  }
  const POLV = scuro ? [1, 0.94, 0.86] : [0.36, 0.32, 0.28], kP = scuro ? 1 : 1.25, INK = [0.07, 0.075, 0.13], ORO = scuro ? [0.953, 0.875, 0.659] : [0.725, 0.541, 0.18];
  const api = {
    inizio(camera) { cam = camera; veli.n = 0; luci.n = 0; lampoI = 0; cx.set(1, 0, 0).applyQuaternion(cam.quaternion); cy.set(0, 1, 0).applyQuaternion(cam.quaternion); },
    fine() { for (const L of [veli, luci]) { L.m.count = L.n; L.m.instanceMatrix.needsUpdate = true; L.col.needsUpdate = true; L.par.needsUpdate = true; } lampo.intensity = lampoI; },
    /* un pezzo pesante tocca il banco: un anello sottile che si allarga e qualche granello che salta. r = raggio dell'impronta, f = forza 0..1 */
    tonfo(p, r, f, eta, seme) {
      const u = eta / 0.42; if (u < 0 || u > 1) return;
      metti(veli, 0, v.set(p.x, p.y + 0.03, p.z), 2 * r * (0.94 + 0.5 * eOut(u)), 2 * r * (0.94 + 0.5 * eOut(u)), POLV, 0.3 * kP * f * (1 - u) * (1 - u), 0.035 / (0.94 + 0.5 * eOut(u)), 0.05, 's');
      const n = Math.round(5 + 9 * f);
      for (let i = 0; i < n; i++) { const a = hash(seme + i * 1.7) * TAU, sp = 5 + 9 * hash(seme + i * 2.3), up = 9 + 14 * hash(seme + i * 3.1) * f, d = r * 0.96 + sp * eta * (1 - 0.6 * u), h = up * eta - 42 * eta * eta;
        if (h < 0) continue; metti(veli, 1, v.set(p.x + Math.cos(a) * d, p.y + 0.05 + h, p.z + Math.sin(a) * d), 0.13 + 0.1 * hash(seme + i), 0.13 + 0.1 * hash(seme + i), POLV, 0.62 * kP * (1 - u), 0.3, 0, 'c'); }
    },
    /* un pezzo leggero si posa: solo un anellino */
    tic(p, r, eta) { const u = eta / 0.2; if (u < 0 || u > 1) return; metti(veli, 0, v.set(p.x, p.y + 0.03, p.z), 2 * r * (1 + 0.45 * eOut(u)), 2 * r * (1 + 0.45 * eOut(u)), POLV, 0.26 * kP * (1 - u) * (1 - u), 0.06, 0.07, 's'); },
    /* scintille di metallo: trattini caldi che partono, cadono e si spengono; un bagliore al centro e la luce sui pezzi vicini */
    scintille(p, n, eta, seme, forza) {
      const D = 0.34; if (eta < 0 || eta > D) return; const f = forza || 1;
      for (let i = 0; i < n; i++) { const vita = D * (0.45 + 0.55 * hash(seme + i * 5.1)), u = eta / vita; if (u > 1) continue;
        const a = hash(seme + i * 1.3) * TAU, el = 0.35 + 1.0 * hash(seme + i * 2.9), sp = (16 + 26 * hash(seme + i * 4.7)) * f, vx = Math.cos(a) * Math.cos(el) * sp, vz = Math.sin(a) * Math.cos(el) * sp, vy = Math.sin(el) * sp;
        v.set(p.x + vx * eta, p.y + vy * eta - 55 * eta * eta, p.z + vz * eta); v2.set(vx, vy - 110 * eta, vz);
        const ang = Math.atan2(v2.dot(cy), v2.dot(cx)), lun = (0.5 + 0.035 * v2.length()) * (1 - 0.5 * u);
        metti(luci, 2, v, lun, 0.085, [1, 0.93 - 0.4 * u, 0.74 - 0.6 * u], 0.95 * (1 - u * u), 0.1, 0, ang); }
      const b = sat(1 - eta / 0.12); if (b > 0) { metti(luci, 1, v.set(p.x, p.y + 0.1, p.z), 1.6 * f, 1.6 * f, [1, 0.82, 0.52], 0.75 * b, 0.05, 0, 'c'); }
      const li = 60 * f * smooth(sat(1 - eta / 0.3)); if (li > lampoI) { lampoI = li; lampo.position.set(p.x, p.y + 0.9, p.z + 0.6); }
    },
    /* uno sbuffo: tre veli morbidi che si allontanano dalla bocca e si allargano, con un po' di granelli */
    sbuffo(p, dir, eta, seme) {
      const u = eta / 0.5; if (u < 0 || u > 1) return;
      for (let i = 0; i < 3; i++) { const k = 0.6 + 0.3 * i, d = (3 + 5 * i) * eOut(u) * k, s = 0.8 + (1.6 + 0.6 * i) * eOut(u); metti(veli, 1, v.copy(p).addScaledVector(dir, d).setY(p.y + 0.25 * i * u), s, s, POLV, 0.2 * kP * (1 - u) * (1 - 0.2 * i), 0.1, 0, 'c'); }
      for (let i = 0; i < 9; i++) { const d = (5 + 9 * hash(seme + i)) * eOut(u), s = 0.1 + 0.08 * hash(seme + i * 3); metti(veli, 1, v.copy(p).addScaledVector(dir, d).add(v2.set((hash(seme + i * 7) - 0.5) * 2.4 * u, (hash(seme + i * 9) - 0.3) * 1.8 * u, (hash(seme + i * 11) - 0.5) * 2.4 * u)), s, s, POLV, 0.6 * kP * (1 - u), 0.3, 0, 'c'); }
    },
    /* polvere d'inchiostro: granelli scuri e un velo appena */
    inchiostro(p, eta, seme) {
      const u = eta / 0.46; if (u < 0 || u > 1) return; const s = 0.7 + 1.5 * eOut(u); metti(veli, 1, v.set(p.x, p.y + 0.5 * u, p.z), s, s, INK, 0.22 * (1 - u), 0.1, 0, 'c');
      for (let i = 0; i < 12; i++) { const a = hash(seme + i * 1.9) * TAU, sp = 2.5 + 5 * hash(seme + i * 2.7), g = 0.07 + 0.07 * hash(seme + i * 3.3);
        metti(veli, 1, v.set(p.x + Math.cos(a) * sp * eta * 1.4, p.y + (5 + 7 * hash(seme + i)) * eta - 22 * eta * eta, p.z + Math.sin(a) * sp * eta * 1.4 + 0.2), g, g, INK, 0.8 * (1 - u * u), 0.4, 0, 'c'); }
    },
    /* una goccia d'olio: cade dal beccuccio al perno e luccica */
    goccia(da, a, eta) {
      const D = 0.2; if (eta < 0 || eta > D + 0.22) return;
      if (eta < D) { const u = eta / D; v.lerpVectors(da, a, u * u); metti(veli, 1, v, 0.16, 0.24, [0.82, 0.56, 0.16], 0.92, 0.55, 0, 'c'); metti(luci, 1, v2.copy(v).addScaledVector(cy, 0.05), 0.1, 0.1, [1, 0.96, 0.8], 0.9, 0.2, 0, 'c'); }
      else { const u = (eta - D) / 0.22; metti(luci, 1, v.copy(a).addScaledVector(cy, 0.06), 0.5 + 0.5 * u, 0.5 + 0.5 * u, [1, 0.9, 0.62], 0.8 * (1 - u), 0.05, 0, 'c'); metti(veli, 1, a, 0.22, 0.16, [0.82, 0.56, 0.16], 0.7 * (1 - u), 0.5, 0, 'c'); }
    },
    /* il campanello: due onde sottili che si allargano */
    onda(p, eta) { for (let i = 0; i < 2; i++) { const u = (eta - i * 0.11) / 0.5; if (u < 0 || u > 1) continue; const s = 2 * (0.9 + 2.3 * eOut(u)); metti(veli, 0, p, s, s, ORO, 0.85 * (1 - u) * (1 - u), 0.05 / (0.9 + 2.3 * eOut(u)) * 1.6, 0.03, 'c'); } },
    /* un bagliore d'oro o caldo, fermo (il punto d'oro che si accende) */
    bagliore(p, s, a, c) { metti(luci, 1, p, s, s, c || [1, 0.8, 0.42], a, 0.02, 0, 'c'); },
    conta: () => veli.n + luci.n
  };
  return api;
}
