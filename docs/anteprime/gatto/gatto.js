/* BOZZA, NON ONLINE. L'aspetto di questa prima versione (gatto fatto di sfere e cilindri in three.js) è stato scartato da Imad
   il 2026-11-12: va rifatto in 2D con profondità. Si tiene per il movimento, che gli è piaciuto: pose, zampe a due segmenti,
   passo senza scivolare, stati, sguardo, presa e rilascio, i tempi dell'apertura. Vedi CLAUDE.md. */
/* Dot, la mascotte di imad.chat (anteprima da sola).
   I nove tasti di imad.chat si piegano uno sull'altro finché resta il tasto del punto; il tasto diventa una scatola;
   dalla scatola esce un gatto («chat» in francese è gatto) che poi vive sui bordi dei riquadri: cammina, salta, si siede,
   dorme, guarda il dito, si fa prendere e spostare.
   Tutto è disegnato a codice con three.js: forme morbide e semplici, un colore solo. Le coordinate del mondo sono i pixel
   della pagina (x a destra, y in giù → nel mondo 3D y = -pagina), così il gatto resta attaccato ai riquadri mentre si scorre. */
import * as THREE from "three";

const doc = document, $ = (s) => doc.querySelector(s);
const calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const lerp = (a, b, t) => a + (b - a) * t, sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x), seg = (t, a, b) => sat((t - a) / (b - a)), clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const eIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), eOut = (u) => 1 - Math.pow(1 - u, 3);
const eBack = (u, s = 1.7) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const K = 1.5;                                   /* grandezza del gatto: unità del modello → pixel */

/* ------------------------------------------------------------------ scena */
const cv = $("#gl"), grab = $("#grab"), fum = $("#fum");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { cv.style.display = "none"; grab.style.display = "none"; throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(0, 1, 0, -1, -800, 800);
scene.add(new THREE.HemisphereLight(0xffffff, 0x30345e, 1.25));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.0); sun.position.set(-0.55, 1, 0.9); scene.add(sun);
const rim = new THREE.DirectionalLight(0x9db4ff, 1.0); rim.position.set(0.9, 0.35, -0.7); scene.add(rim);
let W = 0, H = 0;
function resize() { W = window.innerWidth; H = window.innerHeight; renderer.setSize(W, H, false); cam.left = 0; cam.right = W; readPlats(); }
function setCam() { const sy = window.scrollY || 0; cam.top = -sy; cam.bottom = -sy - H; cam.updateProjectionMatrix(); }

/* i bordi su cui il gatto può stare: il lato alto di ogni riquadro */
let plats = [];
function readPlats() {
  const sx = window.scrollX || 0, sy = window.scrollY || 0;
  plats = Array.prototype.map.call(doc.querySelectorAll(".t"), (el) => { const r = el.getBoundingClientRect(); return { x0: r.left + sx + 30, x1: r.right + sx - 30, y: r.top + sy }; }).filter((p) => p.x1 - p.x0 > 40);
}

/* ------------------------------------------------------------------ materiali e pezzi */
const mBody = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.8 });
const mKey = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.62 });
const mInk = new THREE.MeshStandardMaterial({ color: 0x1b1c25, roughness: 0.45 });
const mNose = new THREE.MeshStandardMaterial({ color: 0xd9a9a0, roughness: 0.7 });
const gSph = new THREE.SphereGeometry(1, 30, 22), gCyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), gCone = new THREE.ConeGeometry(1, 1, 20);
const Y = new THREE.Vector3(0, 1, 0), v0 = new THREE.Vector3();
function link(m, ax, ay, az, bx, by, bz, r) {       /* un cilindro tra due punti */
  v0.set(bx - ax, by - ay, bz - az); const len = v0.length() || 0.001;
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.quaternion.setFromUnitVectors(Y, v0.multiplyScalar(1 / len)); m.scale.set(r, len, r);
}
const mesh = (g, m, parent) => { const o = new THREE.Mesh(g, m); parent.add(o); return o; };

/* ------------------------------------------------------------------ il gatto */
const POSE = {
  stand:   { hx: -9, hy: 16.5, cx: 9, cy: 17, dx: 7.5, dy: 8.5, f0x: 10.5, f0y: 0, f1x: 9.5, f1y: 0, f2x: -9.5, f2y: 0, f3x: -10.5, f3y: 0, tuck: 0, tby: 2.5, te: 0.55, tc: 0.95, tw: 0, eye: 1, hp: 0, br: 0.3 },
  sit:     { hx: -4, hy: 10, cx: 5, cy: 19.5, dx: 3.5, dy: 9.6, f0x: 8.5, f0y: 0, f1x: 7, f1y: 0, f2x: 2.5, f2y: 0, f3x: 1, f3y: 0, tuck: 0, tby: -5.5, te: -0.15, tc: 0.15, tw: 1, eye: 1, hp: 0, br: 0.6 },
  loaf:    { hx: -7, hy: 8.8, cx: 7, cy: 9.4, dx: 8, dy: 4.6, f0x: 9, f0y: 1, f1x: 9, f1y: 1, f2x: -7, f2y: 1, f3x: -7, f3y: 1, tuck: 1, tby: -4, te: -0.2, tc: 0.2, tw: 1.12, eye: 1, hp: -0.05, br: 0.8 },
  sleep:   { hx: -7, hy: 8.6, cx: 7, cy: 9, dx: 8.2, dy: 2.6, f0x: 9, f0y: 1, f1x: 9, f1y: 1, f2x: -7, f2y: 1, f3x: -7, f3y: 1, tuck: 1, tby: -4, te: -0.2, tc: 0.2, tw: 1.2, eye: 0, hp: -0.22, br: 1 },
  stretch: { hx: -9, hy: 19.5, cx: 8, cy: 9.2, dx: 8.5, dy: 4.6, f0x: 24, f0y: 0, f1x: 22, f1y: 0, f2x: -9.5, f2y: 0, f3x: -10.5, f3y: 0, tuck: 0, tby: 2.5, te: 1.3, tc: 0.25, tw: 0, eye: 0.2, hp: 0.32, br: 0.2 },
  crouch:  { hx: -8, hy: 10.5, cx: 8, cy: 11.5, dx: 8, dy: 6.5, f0x: 11, f0y: 0, f1x: 10, f1y: 0, f2x: -8, f2y: 0, f3x: -9, f3y: 0, tuck: 0, tby: 2, te: 0.1, tc: 0.5, tw: 0, eye: 1, hp: 0.1, br: 0.2 },
  air:     { hx: -10, hy: 16, cx: 10, cy: 17, dx: 8, dy: 7.5, f0x: 24, f0y: 12, f1x: 22, f1y: 11, f2x: -22, f2y: 11, f3x: -24, f3y: 12, tuck: 0, tby: 2.5, te: 0.15, tc: 0.12, tw: 0, eye: 1, hp: 0.05, br: 0.2 },
  held:    { hx: -1, hy: 3, cx: 1.5, cy: 20, dx: 4, dy: 8.6, f0x: 8.5, f0y: 8, f1x: 6.5, f1y: 9, f2x: 4.5, f2y: -10, f3x: 2.5, f3y: -9, tuck: 0, tby: -4, te: -1.3, tc: 0.45, tw: 0, eye: 1, hp: 0.1, br: 0.2 },
};
const KEYS = Object.keys(POSE.stand);
const root = new THREE.Group(), yawG = new THREE.Group(), rig = new THREE.Group();
root.add(yawG); yawG.add(rig); root.rotation.x = 0.13; scene.add(root);
const hips = mesh(gSph, mBody, rig), chest = mesh(gSph, mBody, rig), belly = mesh(gSph, mBody, rig);
const head = new THREE.Group(); rig.add(head);
const skull = mesh(gSph, mBody, head); skull.scale.set(8.5, 7.8, 8.4);
const muzzle = mesh(gSph, mBody, head); muzzle.position.set(6.1, -2, 0); muzzle.scale.set(3.6, 2.8, 4.2);
const nose = mesh(gSph, mNose, head); nose.position.set(9.25, -1.15, 0); nose.scale.set(0.95, 0.8, 1.25);
const ears = [1, -1].map((s) => { const e = mesh(gCone, mBody, head); e.position.set(-0.6, 7.6, s * 4.7); e.scale.set(3.5, 7.4, 3.5); e.rotation.x = s * 0.34; e.userData.s = s; return e; });
const eyes = [1, -1].map((s) => { const e = mesh(gSph, mInk, head); e.position.set(7.15, 1.0, s * 3.45); e.userData.s = s; return e; });
const tail = []; for (let i = 0; i < 26; i++) tail.push(mesh(gSph, mBody, rig));
const legs = []; for (let i = 0; i < 4; i++) legs.push({ up: mesh(gCyl, mBody, rig), low: mesh(gCyl, mBody, rig), knee: mesh(gSph, mBody, rig), paw: mesh(gSph, mBody, rig) });

/* l'ombra di contatto sul bordo del riquadro */
const shCv = doc.createElement("canvas"); shCv.width = shCv.height = 64;
{ const c = shCv.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(0,0,10,.62)"); g.addColorStop(0.55, "rgba(0,0,10,.22)"); g.addColorStop(1, "rgba(0,0,10,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCv), transparent: true, depthWrite: false })); scene.add(shadow);

const A = Object.assign({}, POSE.sit, { walk: 0, pitch: 0, roll: 0 });         /* la posa di adesso (insegue quella voluta) */
const look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
const cat = { x: 0, y: 0, gy: null, dir: 1, face: "view", yaw: -Math.PI / 2, s: 1, vis: false, state: "script", st: 0, pose: "sit", rate: 12, walkT: 0, pitchT: 0, rollT: 0, gait: 0, plat: null, dur: 0, lift: 0, eyeT: null };
let blinkAt = 2, blink = 1, earAt = 3, earT = -9, glanceAt = 0, glance = 0, tapAt = -9;
const ptr = { x: 0, y: 0, t: -9 };
const DUTY = 0.62, GT = 0.56, PH = [0, 0.5, 0.55, 0.05], LL = [8.7, 8.7, 8.3, 8.3];

function drawCat(t) {
  const sc = K * cat.s; root.visible = cat.vis; if (!cat.vis) { shadow.visible = false; return; }
  root.position.set(cat.x, -(cat.y - cat.lift), 0); root.scale.setScalar(sc); yawG.rotation.y = cat.yaw; rig.rotation.z = A.pitch; rig.rotation.x = A.roll;
  const bob = A.walk * Math.sin(cat.gait * Math.PI * 4) * 0.55, br = 1 + A.br * 0.04 * Math.sin(t * 1.9);
  const hx = A.hx, hy = A.hy + bob, cx = A.cx, cy = A.cy - bob * 0.6;
  hips.position.set(hx, hy, 0); hips.scale.set(10, 10 * br, 9.3);
  chest.position.set(cx, cy, 0); chest.scale.set(9.3, 9.3 * br, 8.7);
  const ddx = cx - hx, ddy = cy - hy, d = Math.hypot(ddx, ddy);
  belly.position.set((hx + cx) / 2, (hy + cy) / 2, 0); belly.rotation.z = Math.atan2(ddy, ddx); belly.scale.set(d / 2 + 8.2, 9.55 * br, 8.9);
  head.position.set(cx + A.dx, cy + A.dy + bob * 0.5, 0); head.rotation.set(0, look.yaw, A.hp + look.pitch, "YZX");
  const eo = Math.max(0.1, A.eye * blink);
  for (const e of eyes) e.scale.set(0.75, 1.3 * eo, 1.18);
  const tw = Math.max(0, 1 - Math.abs(t - earT) / 0.16);
  for (const e of ears) e.rotation.set(e.userData.s * (0.34 + 0.3 * tw * (e.userData.s > 0 ? 1 : 0.3)), 0, -0.1 * tw);
  /* zampe: due segmenti, il ginocchio piega all'indietro */
  const L = (cat.speedL || 0) * GT * DUTY;
  for (let i = 0; i < 4; i++) {
    const front = i < 2, jz = (i % 2 ? -1 : 1) * (front ? 4.3 : 5), jx = front ? cx + 1.5 : hx - 1, jy = (front ? cy : hy) - 3.5, lg = legs[i];
    let fx = A["f" + i + "x"], fy = A["f" + i + "y"];
    if (A.walk > 0.01) { const ph = (cat.gait + PH[i]) % 1; let ox, oy = 0; if (ph < DUTY) ox = L * (0.5 - ph / DUTY); else { const u = (ph - DUTY) / (1 - DUTY); ox = L * (-0.5 + eIO(u)); oy = Math.sin(Math.PI * u) * 4.8; } fx += A.walk * ox; fy += A.walk * oy; }
    fx = lerp(fx, jx + (front ? 3 : -1), A.tuck); fy = lerp(fy, jy - 2.5, A.tuck);
    const l = LL[i], rs = 1 - 0.8 * A.tuck; let ex = fx - jx, ey = fy - jy, dd = Math.hypot(ex, ey);
    if (dd > 2 * l - 0.05) { const k = (2 * l - 0.05) / dd; ex *= k; ey *= k; dd = 2 * l - 0.05; fx = jx + ex; fy = jy + ey; }
    const base = Math.atan2(ey, ex), a = Math.acos(clamp(dd / (2 * l), -1, 1)), kx = jx + l * Math.cos(base - a), ky = jy + l * Math.sin(base - a);
    link(lg.up, jx, jy, jz, kx, ky, jz, 3.0 * rs); link(lg.low, kx, ky, jz, fx, fy + 1.6, jz, 2.5 * rs);
    lg.knee.position.set(kx, ky, jz); lg.knee.scale.setScalar(2.95 * rs);
    lg.paw.position.set(fx + 0.9, fy + 1.9, jz); lg.paw.scale.set(3.5 * rs, 2.2 * rs, 2.9 * rs);
  }
  /* coda: una catena di sfere lungo una curva; può avvolgersi attorno al corpo */
  let px = hx - 8.4, py = hy + A.tby, pz = 0; const n = tail.length, sl = 33 / (n - 1);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), sway = (0.16 + 0.3 * A.walk) * Math.sin(t * (1.5 + 3.5 * A.walk) - s * 2.4) * s;
    const e = A.te + A.tc * s * 1.7 + sway * (1 - 0.6 * sat(A.tw)), h = Math.PI - A.tw * 2.55 * s + (A.tw > 0.2 ? sway * 0.5 : 0);
    tail[i].position.set(px, Math.max(2.5, py), pz); tail[i].scale.setScalar(lerp(3.05, 2.25, s));
    px += sl * Math.cos(e) * Math.cos(h); py += sl * Math.sin(e); pz += sl * Math.cos(e) * Math.sin(h);
  }
  /* ombra */
  if (cat.gy == null) shadow.visible = false;
  else { const hgt = Math.max(0, cat.gy - cat.y + cat.lift), f = 1 - 0.5 * sat(hgt / 90); shadow.visible = true; shadow.position.set(cat.x, -cat.gy - 1, -40); shadow.scale.set(34 * sc * f, 7 * sc * f, 1); shadow.material.opacity = 0.8 * (1 - sat(hgt / 150)); }
}

function set(state, o) { cat.state = state; cat.st = 0; cat.eyeT = null; if (o) Object.assign(cat, o); }
const yawFor = () => (cat.face === "view" ? -Math.PI / 2 + cat.dir * 0.46 : cat.dir > 0 ? -0.36 : -Math.PI + 0.36);
function below(x, y) { let b = null; for (const p of plats) if (x >= p.x0 - 16 && x <= p.x1 + 16 && p.y >= y - 8 && (!b || p.y < b.y)) b = p; return b; }
function visible() { const sy = window.scrollY || 0; return plats.filter((p) => p.y > sy + 78 && p.y < sy + H - 16); }
function jumpTo(p, tx) { cat.to = { p, x: clamp(tx, p.x0, p.x1), y: p.y }; cat.dir = cat.to.x >= cat.x ? 1 : -1; set("crouch", { pose: "crouch", face: "side" }); }
function decide() {
  const vis = visible(), sy = window.scrollY || 0, on = cat.plat, onscreen = cat.y > sy + 50 && cat.y < sy + H + 4;
  if (!vis.length) return set("sit", { pose: "sit", face: "view", dur: 2 });
  if (!on || !onscreen) { const p = vis.slice().sort((a, b) => Math.abs(a.y - cat.y) - Math.abs(b.y - cat.y))[0]; return jumpTo(p, clamp(cat.x + rnd(-60, 60), p.x0, p.x1)); }
  const r = Math.random();
  if (r < 0.42) { const room = on.x1 - on.x0; if (room < 50) return set("sit", { pose: "sit", face: "view", dur: rnd(2, 4) }); let tx = cat.x, n = 0; while (Math.abs(tx - cat.x) < 44 && n++ < 12) tx = rnd(on.x0, on.x1); cat.tx = tx; cat.dir = tx >= cat.x ? 1 : -1; return set("walk", { pose: "stand", face: "side" }); }
  if (r < 0.62) { const others = vis.filter((p) => p !== on && Math.abs(p.y - on.y) < 330); if (others.length) { const p = pick(others); return jumpTo(p, clamp(cat.x + rnd(-90, 90), p.x0, p.x1)); } }
  if (r < 0.85) return set("sit", { pose: "sit", face: "view", dur: rnd(2.6, 5) });
  return set("sleep", { pose: "loaf", face: "view", dur: rnd(8, 13) });
}
function landOn(p) { cat.plat = p; cat.y = p.y; cat.gy = p.y; }

const STATES = {
  script() {},
  idle() { decide(); },
  walk(dt) {
    cat.walkT = 0; if (Math.abs(wrap(cat.yaw - yawFor())) > 0.5) return;
    cat.walkT = 1; const sp = 44; cat.speedL = sp / (K * cat.s); cat.x += cat.dir * sp * dt * sat(cat.st * 4);
    if ((cat.tx - cat.x) * cat.dir <= 0) { cat.x = cat.tx; cat.walkT = 0; Math.random() < 0.55 ? set("sit", { pose: "sit", face: "view", dur: rnd(1.6, 3.4) }) : set("pause", { pose: "stand", dur: rnd(0.5, 1.1) }); }
  },
  pause() { cat.walkT = 0; if (cat.st > cat.dur) set("idle"); },
  sit() { cat.walkT = 0; if (cat.st > cat.dur) set("idle"); },
  sleep() { cat.walkT = 0; cat.pose = cat.st > 1.1 ? "sleep" : "loaf"; if (cat.st > cat.dur) set("wake", { pose: "loaf", face: "view" }); },
  wake() {
    if (cat.st < 0.5) { cat.pose = "loaf"; cat.eyeT = seg(cat.st, 0.1, 0.45); }
    else if (cat.st < 1.55) { cat.pose = "stretch"; cat.face = "side"; }
    else if (cat.st < 1.95) cat.pose = "stand";
    else set("sit", { pose: "sit", face: "view", dur: rnd(1.5, 3) });
  },
  crouch() { cat.walkT = 0; if (cat.st > 0.17 && Math.abs(wrap(cat.yaw - yawFor())) < 0.7) { const dx = cat.to.x - cat.x, dy = cat.to.y - cat.y, dist = Math.hypot(dx, dy); cat.from = { x: cat.x, y: cat.y }; cat.jd = clamp(0.3 + dist / 720, 0.34, 0.66); cat.jh = Math.max(26, 18 + dist * 0.16) + Math.max(0, -dy) * 0.25; cat.plat = null; set("air", { pose: "air" }); } },
  air(dt) {
    const u = sat(cat.st / cat.jd), f = cat.from, to = cat.to;
    cat.x = lerp(f.x, to.x, u); const y0 = lerp(f.y, to.y, u) - 4 * cat.jh * u * (1 - u); cat.y = y0; cat.gy = lerp(f.y, to.y, eIO(u));
    const vx = (to.x - f.x) / cat.jd, vy = -((to.y - f.y) - 4 * cat.jh * (1 - 2 * u)) / cat.jd; cat.pitchT = clamp(Math.atan2(vy, Math.abs(vx) + 60), -0.7, 0.75) * 0.8;
    if (u > 0.82) cat.pose = "stand";
    if (u >= 1) { cat.pitchT = 0; landOn(to.p); cat.x = to.x; set("land", { pose: "crouch" }); }
  },
  land() { if (cat.st > 0.16) { cat.pose = "stand"; if (cat.st > 0.34) set(cat.after || "idle", cat.afterO || null), (cat.after = null), (cat.afterO = null); } },
  hop() { const u = sat(cat.st / 0.4); cat.lift = 4 * 20 * u * (1 - u); cat.pose = u < 0.9 ? "air" : "stand"; cat.pitchT = 0.3 * (1 - 2 * u); if (u >= 1) { cat.lift = 0; cat.pitchT = 0; set("sit", { pose: "sit", face: "view", dur: rnd(2, 3.5) }); } },
  held(dt) {
    const tx = hold.x, ty = hold.y + 30 * K, k = 1 - Math.exp(-dt * 22), ox = cat.x; cat.x = lerp(cat.x, tx, k); cat.y = lerp(cat.y, ty, k);
    cat.rollT = 0; cat.pitchT = clamp(-(cat.x - ox) / Math.max(dt, 0.001) / 900, -0.6, 0.6); cat.gy = null; cat.plat = null; cat.walkT = 0;
  },
  fall(dt) {
    cat.vy += 2300 * dt; cat.y += cat.vy * dt; cat.pitchT = 0;
    const p = cat.to && cat.to.p; if (p) { cat.gy = p.y; if (cat.y >= p.y) { landOn(p); cat.x = clamp(cat.x, p.x0, p.x1); set("land", { pose: "crouch", after: "sit", afterO: { pose: "sit", face: "view", dur: rnd(2, 3.5) } }); } }
    else if (cat.y > (window.scrollY || 0) + H + 120) { const vis = visible(), q = vis.length ? vis[vis.length - 1] : plats[plats.length - 1]; if (q) { cat.x = clamp(cat.x, q.x0, q.x1); cat.y = q.y + 200; jumpTo(q, cat.x); cat.st = 9; } }
  },
};

const hold = { x: 0, y: 0 };
let drag = null;
function tap(t) {
  tapAt = t;
  if (cat.state === "sleep") set("wake", { pose: "loaf", face: "view" });
  else if (cat.state === "sit" || cat.state === "pause" || cat.state === "walk" || cat.state === "idle") set("hop", { pose: "crouch", face: "view" });
}
grab.addEventListener("pointerdown", (e) => { if (cat.state === "script") return; try { grab.setPointerCapture(e.pointerId); } catch (_) {} drag = { id: e.pointerId, x: e.pageX, y: e.pageY, moved: false }; e.preventDefault(); });
grab.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.pageX - drag.x, e.pageY - drag.y) > 8) { drag.moved = true; if (cat.state !== "air") { cat.lift = 0; set("held", { pose: "held", face: "view" }); } }
  if (drag.moved) { hold.x = e.pageX; hold.y = e.pageY; }
});
function drop(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return; const moved = drag.moved; drag = null;
  if (!moved) return tap(now);
  if (cat.state !== "held") return;
  let p = below(cat.x, cat.y); if (!p) { const c = plats.filter((q) => q.y >= cat.y - 8).sort((a, b) => a.y - b.y)[0]; if (c) { p = c; } }
  cat.vy = 0; cat.to = p ? { p } : null; if (p) cat.x = clamp(cat.x, p.x0 - 16, p.x1 + 16); set("fall", { pose: "air" });
}
grab.addEventListener("pointerup", drop); grab.addEventListener("pointercancel", drop);
grab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(now); } });
window.addEventListener("pointermove", (e) => { ptr.x = e.pageX; ptr.y = e.pageY; ptr.t = now; }, { passive: true });
window.addEventListener("pointerdown", (e) => { ptr.x = e.pageX; ptr.y = e.pageY; ptr.t = now; }, { passive: true });

function stepCat(dt, t) {
  cat.st += dt; STATES[cat.state](dt, t);
  const P = POSE[cat.pose], k = 1 - Math.exp(-dt * cat.rate);
  for (const key of KEYS) A[key] = lerp(A[key], P[key], k);
  if (cat.eyeT != null) A.eye = cat.eyeT;
  A.walk = lerp(A.walk, cat.walkT, 1 - Math.exp(-dt * 10)); A.pitch = lerp(A.pitch, cat.pitchT, 1 - Math.exp(-dt * 14)); A.roll = lerp(A.roll, cat.rollT, 1 - Math.exp(-dt * 10));
  if (cat.state !== "walk") cat.walkT = 0;
  cat.gait = (cat.gait + dt / GT) % 1;
  cat.yaw += wrap(yawFor() - cat.yaw) * (1 - Math.exp(-dt * 9));
  /* lo sguardo: il dito se c'è, altrimenti chi guarda; ogni tanto un'occhiata di lato */
  if (t > blinkAt) { blinkAt = t + rnd(2.2, 5.5); } const bt = blinkAt - t; blink = bt < 0.16 ? Math.abs(bt - 0.08) / 0.08 : 1;
  if (t > earAt) { earT = t; earAt = t + rnd(3, 8); }
  if (t > glanceAt) { glanceAt = t + rnd(1.4, 3.6); glance = Math.random() < 0.55 ? 0 : rnd(-0.9, 0.9); }
  const hxw = cat.x, hyw = cat.y - (A.cy + A.dy) * K * cat.s;
  if (cat.state === "script") { /* lo decide la scena d'apertura */ }
  else if (cat.pose === "sleep" || cat.pose === "stretch" || cat.pose === "air" || cat.pose === "crouch") { look.ty = 0; look.tp = 0; }
  else if (t - ptr.t < 2.6 && cat.state !== "walk") { const dx = ptr.x - hxw, dy = -(ptr.y - hyw); look.ty = clamp(wrap(Math.atan2(-170, dx) - cat.yaw), -1.15, 1.15); look.tp = clamp(Math.atan2(dy, Math.hypot(dx, 170)), -0.5, 0.6); }
  else if (cat.state === "walk") { look.ty = 0; look.tp = 0; }
  else { look.ty = clamp(wrap(-Math.PI / 2 - cat.yaw) + glance, -1.15, 1.15); look.tp = cat.state === "held" ? -0.25 : 0.04; }
  const lk = 1 - Math.exp(-dt * 9); look.yaw = lerp(look.yaw, look.ty, lk); look.pitch = lerp(look.pitch, look.tp, lk);
}

/* ------------------------------------------------------------------ i nove tasti e la scatola */
const KEY = 30, PITCH = 34, KD = 9;
const face = new THREE.Group(), box = new THREE.Group(); scene.add(face); scene.add(box);
face.rotation.set(0.1, -0.36, 0); box.rotation.set(0.24, -0.38, 0);
const keyGeo = (() => {
  const r = 7, h = KEY / 2, s = new THREE.Shape(); s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: KD - 4, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 4, curveSegments: 10 }); g.translate(0, 0, -(KD - 4) / 2); return g;
})();
function glyph(ch) {
  const c = doc.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  if (ch === ".") { const g = x.createRadialGradient(64, 64, 0, 64, 64, 40); g.addColorStop(0, "rgba(240,176,66,1)"); g.addColorStop(0.34, "rgba(236,170,60,1)"); g.addColorStop(0.42, "rgba(240,180,80,.35)"); g.addColorStop(1, "rgba(240,180,80,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  else { x.fillStyle = "#1b1c25"; x.font = '800 86px Manrope, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'; x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(ch, 64, 94); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
}
const keys = [];
function buildKeys() {
  "imad.chat".split("").forEach((ch, i) => {
    const g = new THREE.Group(); mesh(keyGeo, mKey, g);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(KEY * 0.8, KEY * 0.8), new THREE.MeshBasicMaterial({ map: glyph(ch), transparent: true, depthWrite: false })); pl.position.z = KD / 2 + 0.15; g.add(pl);
    face.add(g); keys.push(g);
  });
}
const BW = 46, BH = 30, BD = 40, WT = 2.6;
const lidPivot = new THREE.Group();
{
  const bx = (w, h, d, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), mKey, box); m.position.set(x, y, z); return m; };
  bx(BW, WT, BD, 0, WT / 2, 0); bx(BW, BH, WT, 0, BH / 2, BD / 2 - WT / 2); bx(BW, BH, WT, 0, BH / 2, -BD / 2 + WT / 2); bx(WT, BH, BD, -BW / 2 + WT / 2, BH / 2, 0); bx(WT, BH, BD, BW / 2 - WT / 2, BH / 2, 0);
  lidPivot.position.set(0, BH, -BD / 2); box.add(lidPivot);
  const lid = mesh(new THREE.BoxGeometry(BW + 2.4, WT, BD + 2.4), mKey, lidPivot); lid.position.set(0, WT / 2, BD / 2);
  const dot = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: glyph("."), transparent: true, depthWrite: false })); dot.rotation.x = -Math.PI / 2; dot.position.set(0, WT + 0.2, BD / 2); lidPivot.add(dot);
}
const anchor = { x: 0, y: 0, side: -1 };
function placeStage() { const p = plats[0]; if (!p) return; anchor.x = (p.x0 + p.x1) / 2; anchor.y = p.y; anchor.side = anchor.x - 104 > p.x0 ? -1 : 1; face.position.set(anchor.x, -anchor.y, 0); box.position.set(anchor.x, -anchor.y, 0); }

/* i tempi dell'apertura (secondi) */
const TS = { fl: 0.7, fr: 0.98, ft: 1.52, fb: 1.76, fd: 0.42, drop: 2.3, box: 2.72, wob: 3.0, lid: 3.5, peek: 3.8, lookL: 4.35, lookR: 4.85, lookC: 5.3, crouch: 5.45, jump: 5.62, land: 6.12, bubble: 6.45, end: 6.9, bubbleOff: 11.2 };
const bump = (ts, at) => { const u = (ts - at) / 0.26; return u > 0 && u < 1 ? 0.12 * Math.sin(Math.PI * u) * (1 - u) : 0; };
function stage(ts, t) {
  const yMid = PITCH + KEY / 2 + 1, hp = PITCH / 2;
  for (let i = 0; i < 9; i++) {
    const c = i % 3, r = (i / 3) | 0, k = keys[i]; let x = (c - 1) * PITCH, y = (2 - r) * PITCH + KEY / 2 + 1, z = 0, rx = 0, ry = 0, sc = 1, vis = ts < TS.box;
    const fl = Math.sin(t * 1.3 + i * 0.9) * 1.1 * (1 - seg(ts, 0.3, TS.fl)); y += fl;
    if (c === 0) { const u = seg(ts, TS.fl, TS.fl + TS.fd), th = Math.PI * eIO(u); x = -hp - hp * Math.cos(th); z = hp * Math.sin(th); ry = th; sc = 1 - seg(u, 0.84, 1); }
    else if (c === 2) { const u = seg(ts, TS.fr, TS.fr + TS.fd), th = -Math.PI * eIO(u); x = hp + hp * Math.cos(th); z = -hp * Math.sin(th); ry = th; sc = 1 - seg(u, 0.84, 1); }
    else {
      sc += bump(ts, TS.fl + TS.fd * 0.9) + bump(ts, TS.fr + TS.fd * 0.9);
      if (r === 0) { const u = seg(ts, TS.ft, TS.ft + TS.fd), ph = Math.PI * eIO(u); y = yMid + hp + hp * Math.cos(ph) + fl; z = hp * Math.sin(ph); rx = ph; sc *= 1 - seg(u, 0.84, 1); }
      else if (r === 2) { const u = seg(ts, TS.fb, TS.fb + TS.fd), ph = -Math.PI * eIO(u); y = yMid - hp - hp * Math.cos(ph) + fl; z = -hp * Math.sin(ph); rx = ph; sc *= 1 - seg(u, 0.84, 1); }
      else { sc += bump(ts, TS.ft + TS.fd * 0.9) + bump(ts, TS.fb + TS.fd * 0.9); const u = seg(ts, TS.drop, TS.box); y = lerp(yMid, KD / 2 + 3, u * u); rx = -Math.PI / 2 * eIO(u); sc *= 1 + 0.25 * u; }
    }
    k.visible = vis && sc > 0.02; k.position.set(x, y, z); k.rotation.set(rx, ry, 0); k.scale.setScalar(Math.max(0.001, sc));
  }
  const on = ts >= TS.box; box.visible = on;
  if (on) {
    const p = seg(ts, TS.box, TS.box + 0.34), s = lerp(0.6, 1, eBack(p, 2.2)), w = seg(ts, TS.wob, TS.lid), env = Math.sin(Math.PI * w);
    box.scale.set(s, s * (1 + 0.1 * Math.sin(Math.PI * p) * (1 - p)), s); box.rotation.z = Math.sin((ts - TS.wob) * 26) * 0.075 * env; box.position.y = -anchor.y + Math.abs(Math.sin((ts - TS.wob) * 13)) * 2.4 * env;
    const o = seg(ts, TS.lid, TS.lid + 0.36); lidPivot.rotation.x = -1.95 * eBack(o, 1.4);
  }
}
/* il gatto nell'apertura: spunta, guarda a sinistra e a destra, salta fuori, si siede, si presenta */
function scriptCat(ts) {
  if (ts < TS.peek) { cat.vis = false; return; }
  cat.vis = true; const tx = anchor.x + anchor.side * 100;
  if (ts < TS.crouch + 0.17) {
    const u = eBack(seg(ts, TS.peek, TS.peek + 0.42), 1.5); cat.s = 0.78; cat.x = anchor.x; cat.y = anchor.y - 3 + (1 - u) * 40; cat.lift = 0; cat.gy = null; cat.dir = anchor.side; cat.face = "view"; cat.pose = ts < TS.crouch ? "sit" : "crouch"; cat.plat = null;
    look.tp = 0.12; look.ty = ts < TS.lookL ? wrap(-Math.PI / 2 - cat.yaw) : ts < TS.lookR ? wrap(-Math.PI / 2 - cat.yaw) - 0.95 : ts < TS.lookC ? wrap(-Math.PI / 2 - cat.yaw) + 0.95 : wrap(-Math.PI / 2 - cat.yaw);
    if (ts >= TS.crouch) { cat.face = "side"; look.ty = 0; }
    return;
  }
  if (ts < TS.land) {
    const u = seg(ts, TS.jump - 0.0, TS.land), h = 58; cat.s = lerp(0.78, 1, eOut(u)); cat.x = lerp(anchor.x, tx, u); cat.y = anchor.y - 3 * (1 - u) - 4 * h * u * (1 - u); cat.gy = anchor.y; cat.pose = u > 0.84 ? "stand" : "air"; cat.face = "side";
    cat.pitchT = clamp(Math.atan2(4 * h * (1 - 2 * u), 120), -0.7, 0.75) * 0.8; look.ty = 0; look.tp = 0; return;
  }
  cat.s = 1; cat.x = tx; cat.pitchT = 0; landOn(plats[0]); cat.pose = ts < TS.land + 0.16 ? "crouch" : ts < TS.land + 0.36 ? "stand" : "sit"; cat.face = ts < TS.land + 0.3 ? "side" : "view";
  look.ty = wrap(-Math.PI / 2 - cat.yaw); look.tp = 0.05;
}

/* ------------------------------------------------------------------ ciclo */
let now = 0, last = 0, t0 = 0, started = false, bubbleOn = false;
function restart() { t0 = now; cat.state = "script"; cat.vis = false; cat.lift = 0; cat.pitchT = 0; cat.walkT = 0; bubbleOn = false; fum.classList.remove("is-on"); window.scrollTo(0, 0); readPlats(); placeStage(); }
function tick(dt) {
  now += dt; if (!started) return;
  const ts = calm ? 99 : window.__ts != null ? window.__ts : now - t0;   /* __ts: per le prove, ferma l'apertura a un istante */
  setCam(); stage(ts, now);
  if (cat.state === "script") { scriptCat(ts); if (ts >= TS.end) set("sit", { pose: "sit", face: "view", dur: calm ? 1e9 : 4.6 }); }
  stepCat(dt, now); drawCat(now);
  const want = ts >= TS.bubble && ts < TS.bubbleOff && cat.state !== "held" && cat.state !== "fall" && cat.state !== "air";
  if (want !== bubbleOn) { bubbleOn = want; fum.classList.toggle("is-on", want); }
  const hy = cat.y - cat.lift - (A.cy + A.dy + 13) * K * cat.s;
  fum.style.left = clamp(cat.x, 124, Math.max(124, doc.documentElement.clientWidth - 124)) + "px"; fum.style.top = hy - 12 + "px";
  const free = cat.vis && cat.state !== "script";
  grab.style.display = free ? "block" : "none"; if (free && !(drag && drag.moved)) { grab.style.left = cat.x - 42 + "px"; grab.style.top = cat.y - cat.lift - 68 + "px"; } else if (free) { grab.style.left = hold.x - 42 + "px"; grab.style.top = hold.y - 42 + "px"; }
  renderer.render(scene, cam);
}
function frame(ms) {
  requestAnimationFrame(frame); if (doc.hidden) { last = 0; return; }
  const tt = ms / 1000, dt = last ? Math.min(0.05, tt - last) : 0.016; last = tt;
  if (!window.__manual) tick(dt);                 /* __manual: per le prove, il tempo avanza solo con __gatto.tick(dt) */
}
window.addEventListener("resize", () => { resize(); placeStage(); });
$("#again").addEventListener("click", restart);
const fontsReady = doc.fonts && doc.fonts.load ? Promise.race([doc.fonts.load('800 86px Manrope'), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
fontsReady.catch(() => {}).then(() => { buildKeys(); resize(); placeStage(); t0 = now; started = true; window.__gatto = { cat, A, TS, set, restart, tick, look, ptr, plats: () => plats }; });
requestAnimationFrame(frame);
