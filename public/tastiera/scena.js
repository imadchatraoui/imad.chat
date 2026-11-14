/* scena.js — la scena: il cielo della pagina, un sole solo, la lastra di vetro, tutti i pezzi (costruiti una volta),
   la cinepresa. Chi muove i pezzi nel tempo è storia.js; chi li dispone per le tavole è tavole.js. */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { lerp, sat, seg, smooth, eIO } from './forme.js';
import * as PT from './parti.js';
import * as BN from './banco.js';
import { creaDot, UN } from './gatto.js';

export const KB = { x: 0, z: 12 };                              /* dove si monta la tastiera (centro, sul banco) */
export const SCATOLA = { x: -15.2, z: -33.6 };                  /* dove sta la scatola di Dot */
export const ATT = 0.62;                                        /* gli attrezzi sono della misura di Dot */

export function creaScena(canvas, o) {
  const scuro = o.tema !== 'chiaro', dpr = o.dpr || Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = o.toni === 'aces' ? THREE.ACESFilmicToneMapping : o.toni === 'agx' ? THREE.AgXToneMapping : THREE.NeutralToneMapping; renderer.toneMappingExposure = 1; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(20, 1, 20, 600);
  /* un sole solo (fa le ombre), e il cielo che riempie le ombre */
  const sole = new THREE.DirectionalLight(0xffffff, 2.4); sole.castShadow = true; sole.shadow.mapSize.set(o.ombre || 2048, o.ombre || 2048);
  sole.shadow.camera.near = 20; sole.shadow.camera.far = 260; sole.shadow.bias = -0.0006; sole.shadow.normalBias = 0.035; sole.shadow.radius = 3.2;
  Object.assign(sole.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34 }); sole.shadow.camera.updateProjectionMatrix();
  const volta = new THREE.HemisphereLight(0xffffff, 0x8088a0, 0.5);
  scene.add(sole, sole.target, volta);

  const M = PT.materiali(), P = {};
  const ombre = (m) => { m.traverse((q) => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; } }); return m; };
  /* ---- il banco */
  P.lastra = new THREE.Mesh(BN.lastra(), BN.matLastra(scuro)); P.lastra.position.set(0, 0, BN.LASTRA.z0 + BN.LASTRA.D / 2); P.lastra.receiveShadow = true; scene.add(P.lastra);
  /* ---- la scatola e le nove tessere */
  P.scatola = BN.scatola(M); scene.add(P.scatola);
  P.tessere = BN.tessere(M); P.tessere.forEach((t) => scene.add(t));
  /* ---- la tastiera: ogni pezzo sta nel mondo; il «ponte» dice dove va a finire */
  const ponte = new THREE.Object3D(); ponte.rotation.x = PT.INCL;
  ponte.position.set(KB.x, 0.05 - PT.CASSA.yb * Math.cos(PT.INCL) + (PT.CASSA.D / 2) * Math.sin(PT.INCL), KB.z); ponte.updateMatrixWorld(true);
  const tast = new THREE.Group(); scene.add(tast);                                  /* tutto ciò che è tastiera */
  P.guscio = ombre(new THREE.Group()); { const g = new THREE.Mesh(PT.geoGuscio(), M.smalto), c = new THREE.Mesh(PT.geoColonnine(), M.ottone);
    P.spia = new THREE.Mesh(PT.geoSpia(), M.spia.clone()); P.spia.position.set(12.4, -0.42, PT.CASSA.D / 2 - 0.035); P.guscio.add(g, c, P.spia); ombre(P.guscio); P.spia.castShadow = false; }
  { const tr = PT.schedaTrame(); M.scheda.map = tr.colore; M.scheda.roughnessMap = tr.orm; M.scheda.metalnessMap = tr.orm;
    P.scheda = ombre(new THREE.Group()); P.scheda.add(new THREE.Mesh(PT.geoScheda(), M.scheda), new THREE.Mesh(PT.geoComponenti(), M.plastica)); ombre(P.scheda); }
  P.viti = PT.VITI.map(() => ombre(new THREE.Mesh(PT.geoVite(), M.acciaioCol)));
  P.stab = PT.TASTI.filter((k) => k.stab).map((k) => { const s = PT.stabilizzatore(k.stab, M); s.userData.tasto = k; return s; });
  P.piastra = ombre(new THREE.Mesh(PT.geoPiastra(), M.piastra));
  P.sw = PT.TASTI.map((k) => { const m = ombre(new THREE.Mesh(PT.geoSwitch(), M.plastica)); m.userData.tasto = k; return m; });
  const atl = PT.atlante(), matLeg = {};
  P.caps = PT.TASTI.map((k) => {
    let mat = k.kind === 'x' ? M.grafite : k.kind === 'm' ? M.pietra : k.kind === 's' || k.kind === 'o' ? M.tastoVivo : M.tasto;
    const t = atl.cella(k); if (t) { const id = k.kind + k.leg; mat = matLeg[id] || (matLeg[id] = Object.assign(mat.clone(), { map: t })); }
    const m = ombre(new THREE.Mesh(PT.geoTasto(k.w, k.row, k.kind), mat)); m.userData.tasto = k;
    if (k.kind === 'o') { P.punto = new THREE.Mesh(BN.geoPunto(0.34), M.oro); P.punto.position.set(0, 0.86, -0.06); P.punto.rotation.x = -0.09; m.add(P.punto); P.alone = BN.luce([[0, 'rgba(255,226,150,.85)'], [0.3, 'rgba(243,200,110,.35)'], [1, 'rgba(233,169,60,0)']]); P.alone.position.set(0, 1.0, -0.06); m.add(P.alone); }
    return m;
  });
  [P.guscio, P.scheda, ...P.viti, ...P.stab, P.piastra, ...P.sw, ...P.caps].forEach((q) => tast.add(q));
  /* ---- gli attrezzi, il piattino, il tè, il bottone */
  P.att = BN.attrezzi(M); for (const k in P.att) { P.att[k].scale.setScalar(ATT); scene.add(P.att[k]); }
  P.piattino = BN.piattino(M); P.piattino.scale.setScalar(0.8); scene.add(P.piattino);
  P.bicchiere = BN.bicchiere(M); scene.add(P.bicchiere);
  P.bottone = BN.bottone(M); P.bottone.scale.setScalar(0.62); scene.add(P.bottone);
  /* ---- polvere, scintilla, punto di luce del saldatore */
  P.anelli = BN.anelliPolvere(48, scuro); P.anelli.forEach((a) => scene.add(a));
  P.scintilla = BN.scintilla(); scene.add(P.scintilla);
  P.lucina = BN.luce([[0, 'rgba(255,250,235,1)'], [0.2, 'rgba(255,200,120,.8)'], [1, 'rgba(255,140,40,0)']]); scene.add(P.lucina);
  /* ---- Dot */
  const dot = creaDot(scene); dot.dpr = dpr;

  /* ---- dal ponte al mondo */
  const v3 = new THREE.Vector3(), qK = new THREE.Quaternion().setFromEuler(ponte.rotation);
  const alMondo = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(ponte.matrixWorld);

  /* ---- la cinepresa: guarda un punto del banco da davanti e dall'alto. larg = centimetri di banco che entrano in larghezza */
  const cam = { tx: 0, ty: 0, tz: -6, larg: 44, alt: 0, pitch: 0.9, giro: 0, su: 0, dx: 0 };
  function cinepresa(c) {
    cam.dx = 0; Object.assign(cam, c); const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height, asp = w / h;
    camera.aspect = asp;
    /* la lente è lunga (calma): la distanza la decide l'apertura; larg è la larghezza vista alla distanza del punto guardato */
    const fovV = (asp < 1 ? 15 : 13) * Math.PI / 180, largV = cam.alt ? Math.max(cam.larg, cam.alt * asp) : cam.larg, dist = (largV / asp / 2) / Math.tan(fovV / 2);
    camera.fov = fovV * 180 / Math.PI; camera.near = Math.max(5, dist - 80); camera.far = dist + 140;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.tx + dist * cp * Math.sin(cam.giro), cam.ty + dist * sp, cam.tz + dist * cp * Math.cos(cam.giro));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    const dx = asp > 1.15 ? cam.dx || 0 : 0; if (cam.su || dx) camera.setViewOffset(w, h, -dx * w, -(cam.su || 0) * h, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return { pxCm: w / largV, dist };
  }

  /* ---- il cielo e il sole a una certa ora (0..24). Il sito usa il cielo vero di Torino: qui una sua copia semplice */
  const SOLE_NOTTE = new THREE.Vector3(-0.5, 0.78, 0.4).normalize(), tmpA = new THREE.Vector3(), colA = new THREE.Color(), colB = new THREE.Color();
  function luceOra(ora) {
    ora = ((ora % 24) + 24) % 24;
    const f = (ora - 7.2) / 9.8, alt = Math.sin(Math.PI * f), su = f > -0.08 && f < 1.08 ? alt : -1;      /* alba 7:12, tramonto 17:00 (novembre) */
    const giorno = smooth(sat((su + 0.05) / 0.3)), crepuscolo = sat(1 - Math.abs(su) / 0.3) * (f > -0.2 && f < 1.2 ? 1 : 0), notte = 1 - Math.max(giorno, crepuscolo * 0.7);
    /* il sole gira da est (destra) a sud (dietro la cinepresa) a ovest (sinistra); di notte la luce sta in alto a sinistra */
    const az = Math.PI * sat(f), el = (22 + 30 * Math.max(0, alt)) * Math.PI / 180;
    tmpA.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el) * 0.9 + 0.12).normalize();
    const dir = SOLE_NOTTE.clone().lerp(tmpA, smooth(sat((su + 0.12) / 0.3))).normalize();
    colA.set(0xfff3e4); colB.set(0xfff6ea); const col = colA.clone().lerp(colB, giorno); if (crepuscolo > 0) col.lerp(colA.set(0xffb27a), crepuscolo * 0.6 * (1 - notte));
    return { ora, giorno, crepuscolo, notte, dir, col, az: Math.atan2(dir.x, dir.z) };
  }
  function cieloCSS(L) {
    const d = L.giorno, k = L.crepuscolo, f = (n) => n.toFixed(4);
    if (scuro) return { alto: `oklch(${f(0.13 + 0.12 * d)} ${f(0.022 + 0.055 * d)} 268)`, mezzo: `oklch(${f(0.15 + 0.12 * d + 0.025 * k)} ${f(0.026 + 0.045 * d + 0.015 * k)} ${f(lerp(272, 300, k))})`, basso: `oklch(${f(0.175 + 0.06 * k + 0.11 * d)} ${f(0.03 + 0.05 * k + 0.02 * d)} ${f(lerp(275, 395, k))})`, bagliore: `rgba(255,170,110,${f(0.04 + 0.3 * k * (1 - 0.6 * d))})` };
    return { alto: `oklch(0.962 ${f(0.016 + 0.012 * d)} 275)`, mezzo: `oklch(0.948 ${f(0.022 + 0.01 * d + 0.008 * k)} ${f(lerp(282, 320, k))})`, basso: `oklch(${f(0.93 - 0.006 * k)} ${f(0.03 + 0.03 * k)} ${f(lerp(300, 410, k))})`, bagliore: `rgba(255,170,110,${f(0.06 + 0.34 * k)})` };
  }
  function illumina(ora, el) {
    const L = luceOra(ora), c = cieloCSS(L);
    sole.position.copy(L.dir).multiplyScalar(120).add(v3.set(0, 0, -4)); sole.target.position.set(0, 0, -4); sole.target.updateMatrixWorld();
    sole.color.copy(L.col);
    if (scuro) { sole.intensity = 2.0 + 1.9 * L.giorno; volta.intensity = 0.22 + 0.16 * L.giorno; scene.environmentIntensity = 0.3 + 0.3 * L.giorno; renderer.toneMappingExposure = 1.02; volta.color.set(0xbfc8ff); volta.groundColor.set(0x1a1c26); }
    else { sole.intensity = 1.9 + 0.5 * L.giorno - 0.25 * L.notte; volta.intensity = 0.42; scene.environmentIntensity = 0.5; renderer.toneMappingExposure = 0.94; volta.color.set(0xf4f2ff); volta.groundColor.set(0xb9bcd4); }
    if (el) { el.style.setProperty('--cielo-alto', c.alto); el.style.setProperty('--cielo-mezzo', c.mezzo); el.style.setProperty('--cielo-basso', c.basso); el.style.setProperty('--cielo-bagliore', c.bagliore); el.style.setProperty('--cielo-gx', (50 - 42 * Math.sin(L.az)).toFixed(1) + '%'); }
    return L;
  }
  /* ---- il riflesso sulla lastra: la scena vista da sotto il vetro, a mezza grandezza, sommata piano alla faccia alta */
  const rifl = { rt: new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), cam: new THREE.PerspectiveCamera(), m: new THREE.Matrix4(), k: { value: 0 }, acceso: o.riflesso !== false };
  P.lastra.material.onBeforeCompile = (sh) => {
    sh.uniforms.tRifl = { value: rifl.rt.texture }; sh.uniforms.mRifl = { value: rifl.m }; sh.uniforms.kRifl = rifl.k;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 mRifl; varying vec4 vRifl; varying float vSu;').replace('#include <project_vertex>', '#include <project_vertex>\nvRifl = mRifl * modelMatrix * vec4( transformed, 1.0 ); vSu = normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRifl; uniform float kRifl; varying vec4 vRifl; varying float vSu;').replace('#include <opaque_fragment>', 'outgoingLight += texture2DProj( tRifl, vRifl ).rgb * kRifl * smoothstep( 0.985, 1.0, vSu );\n#include <opaque_fragment>');
  };
  const nascosti = [];
  function riflesso() {
    if (!rifl.acceso) { rifl.k.value = 0; return; }
    const c = rifl.cam, t = v3.set(cam.tx, -cam.ty, cam.tz);
    c.position.set(camera.position.x, -camera.position.y, camera.position.z); c.up.set(0, -1, 0); c.lookAt(t); c.updateMatrixWorld(true); c.projectionMatrix.copy(camera.projectionMatrix); c.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    rifl.m.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
    nascosti.length = 0; for (const q of [P.lastra, ...P.anelli]) if (q.visible) { nascosti.push(q); q.visible = false; }
    scene.traverse((q) => { if (q.renderOrder === -1 && q.visible) { nascosti.push(q); q.visible = false; } });
    const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rifl.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, c); renderer.setRenderTarget(null); renderer.toneMapping = tm;
    for (const q of nascosti) q.visible = true;
    rifl.k.value = (scuro ? 0.25 : 0.06) * (1.75 - cam.pitch);
  }
  function misura() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); const k = renderer.getPixelRatio() * 0.5; if (rifl.rt.width !== Math.round(w * k) || rifl.rt.height !== Math.round(h * k)) rifl.rt.setSize(Math.round(w * k), Math.round(h * k)); }
  misura();
  return { THREE, renderer, scene, camera, sole, M, P, dot, ponte, qK, alMondo, tast, cinepresa, illumina, luceOra, misura, scuro, cam, UN, disegna() { riflesso(); renderer.render(scene, camera); } };
}
void seg; void eIO;
