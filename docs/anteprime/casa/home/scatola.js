/* imad.chat — la scatola dei tasti (CASA.md 2f F; lo stile in scatola.css). Sta nella pagina casa/scatola/ (/anteprima/scatola).
   I nove tasti di imad.chat, quelli color crema della scena di Dot, dipinti una volta sola con il suo pittore (DOT.stage.paintKey,
   dot-stage.js), cadono in una scatola con una fisica vera: corpi rigidi, attrito, un filo di rimbalzo; si impilano. Si trascinano
   (una molla morbida verso il dito), si lanciano, due tocchi veloci li sparpagliano; con una tastiera una lettera di imad.chat (e il
   punto) solleva il suo tasto lungo un arco e lo lascia cadere, la barra spaziatrice li sparpaglia. Non escono mai dalla scatola.
   La fisica è quella di Box2D Lite di Erin Catto (zlib): impulsi sequenziali accumulati, 10 giri con il «warm start», attrito .55,
   rimbalzo .18, gravità 2200 px/s². La forma di un tasto è il quadrato con gli angoli smussati a 45° (un ottagono che sta a 1 px dal
   tasto arrotondato vero: niente tasti che galleggiano sugli angoli); il contatto tra due poligoni è quello di Box2D (la faccia di
   riferimento, il lato incidente tagliato, due punti), riscritto qui. Un tasto fermo da 0,5 s sotto 4 px/s dorme; quando dormono
   tutti il ciclo dei fotogrammi si ferma (e riparte a ogni tocco).
   Con «meno movimento» (e ?shot=1) i tasti stanno in fila sul fondo: uno si sposta col dito e torna al suo posto, subito.
   window.SCATOLA = { rect(), keys() → [{ ch, x, y, a, h, sleeping }], push(i, vx, vy), drop(ch), scatter(x, y), on(fn), off(fn) },
   in coordinate della pagina (px CSS, y in giù); fn({ type: "grab" | "throw" | "land" | "sleep", i, speed, vx, vy }).
   Per Dot, che più avanti verrà a giocarci. Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var W = window, doc = document, root = doc.documentElement;
  var box = doc.getElementById("scatola"), cv = box ? box.querySelector(".scatola__cv") : null;
  if (!box || !cv || !cv.getContext || !W.requestAnimationFrame) return;
  var ctx = cv.getContext("2d");
  var mqReduce = W.matchMedia ? W.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var SHOT = root.classList.contains("is-shot") || /[?&]shot=1(&|$)/.test(location.search);
  function calm() { return SHOT || !!(mqReduce && mqReduce.matches); }
  var LET = "imad.chat";

  /* ---------------------------------------------------------------- i numeri */
  var KEY = 30, BAND = 4, KR = 8, SC = 1.45;        /* il tasto della scena (dot-stage.js) e quanto è più grande qui: 43,5 px sul telefono */
  var HS = KEY * SC / 2, RR = KR * SC;               /* mezzo lato, raggio degli angoli */
  /* sul computer la scatola è più larga (fino a 720 px) e i tasti crescono con lei: un undicesimo della larghezza, da 43,5 a 72 px */
  function scaleFor(bw) { return Math.max(43.5, Math.min(72, bw / 11)) / KEY; }
  var G = 2200, HZ = 120, ITER = 10, REST = 0.18, MU = 0.55, SLOP = 0.75, BIAS = 0.2;
  var VMAX = 2400, SLEEP_V = 4, SLEEP_T = 0.5, SCAT = 900;
  var JK = 520, JZ = 0.9;                            /* la molla del dito (per unità di massa) */
  /* l'ottagono: i lati del quadrato e i tagli a 45° tangenti agli angoli arrotondati */
  var CH, OCT;
  function shape() { CH = HS - RR * (2 - Math.SQRT2); OCT = [[HS, -CH], [HS, CH], [CH, HS], [-CH, HS], [-HS, CH], [-HS, -CH], [-CH, -HS], [CH, -HS]]; }
  shape();
  function normals(v) { var n = [], i; for (i = 0; i < v.length; i++) { var a = v[i], b = v[(i + 1) % v.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.sqrt(ex * ex + ey * ey); n.push([ey / l, -ex / l]); } return n; }

  /* il pozzo: la tela intera (BW, BH) e, 10 px dentro il bordo, i muri veri: i tasti non entrano negli angoli arrotondati del vetro */
  var BW = 0, BH = 0, dpr = 1, PAD = 10;
  var bodies = [], walls = [], arbs = {}, joint = null, raf = 0, lastT = 0, acc = 0, started = false, vis = false, asleep = false, waitDrop = [];
  var subs = [];
  function emit(type, o) { o = o || {}; o.type = type; subs.slice().forEach(function (f) { try { f(o); } catch (e) { if (W.console) console.error(e); } }); }

  /* ---------------------------------------------------------------- i corpi */
  function Body(i, x, y, local, m) {
    this.i = i; this.x = x; this.y = y; this.a = 0; this.vx = 0; this.vy = 0; this.w = 0;
    this.lv = local; this.ln = normals(local); this.wv = local.map(function () { return [0, 0]; }); this.wn = this.ln.map(function () { return [0, 0]; });
    this.invM = m ? 1 / m : 0;
    var ix = 0, iy = 0; local.forEach(function (p) { ix = Math.max(ix, Math.abs(p[0])); iy = Math.max(iy, Math.abs(p[1])); });
    this.invI = m ? 1 / (m * (4 * ix * ix + 4 * iy * iy) / 12) : 0;
    this.st = 0; this.sx = x; this.sy = y; this.sa = 0; this.lift = null; this.enter = false; this.hot = 0; this.ex = ix; this.ey = iy;
    this.upd();
  }
  Body.prototype.upd = function () {
    var c = Math.cos(this.a), s = Math.sin(this.a), i, mx = 0, my = 0;
    for (i = 0; i < this.lv.length; i++) {
      var p = this.lv[i], q = this.wv[i], n = this.ln[i], r = this.wn[i];
      q[0] = this.x + c * p[0] - s * p[1]; q[1] = this.y + s * p[0] + c * p[1];
      r[0] = c * n[0] - s * n[1]; r[1] = s * n[0] + c * n[1];
      mx = Math.max(mx, Math.abs(q[0] - this.x)); my = Math.max(my, Math.abs(q[1] - this.y));
    }
    this.ex = mx; this.ey = my;      /* il mezzo ingombro adesso (ruotato) */
  };
  /* la scala cambia (la finestra si allarga o si stringe): ogni tasto prende la sua nuova forma, al posto giusto */
  function reshape(b, k) {
    b.lv = OCT; b.ln = normals(OCT); b.invI = 1 / ((4 * HS * HS + 4 * HS * HS) / 12);
    b.x *= k; b.y *= k; b.upd();
  }
  function box4(hx, hy) { return [[hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]]; }

  /* ---------------------------------------------------------------- il contatto tra due poligoni (Box2D) */
  function maxSep(A, B) {
    var best = -1e9, idx = 0, i, j;
    for (i = 0; i < A.wn.length; i++) {
      var n = A.wn[i], v = A.wv[i], s = 1e9;
      for (j = 0; j < B.wv.length; j++) { var d = n[0] * (B.wv[j][0] - v[0]) + n[1] * (B.wv[j][1] - v[1]); if (d < s) s = d; }
      if (s > best) { best = s; idx = i; }
    }
    return [best, idx];
  }
  function clipSeg(v, nx, ny, off, id) {
    var out = [], d0 = nx * v[0].x + ny * v[0].y - off, d1 = nx * v[1].x + ny * v[1].y - off;
    if (d0 <= 0) out.push(v[0]); if (d1 <= 0) out.push(v[1]);
    if (d0 * d1 < 0) { var t = d0 / (d0 - d1); out.push({ x: v[0].x + t * (v[1].x - v[0].x), y: v[0].y + t * (v[1].y - v[0].y), id: id }); }
    return out;
  }
  function collide(A, B) {
    var sa = maxSep(A, B); if (sa[0] > 0) return null;
    var sb = maxSep(B, A); if (sb[0] > 0) return null;
    var P1, P2, e1, flip;
    /* la faccia di riferimento: sempre quella del muro (piatta e ferma); tra due tasti quella di A, a meno che quella di B non sia
       chiaramente migliore (come Box2D Lite: se la scelta saltasse da un fotogramma all'altro il «warm start» si perderebbe e i tasti
       fermi tremerebbero) */
    if (B.invM === 0 || sb[0] > 0.98 * sa[0] + 0.1) { P1 = B; P2 = A; e1 = sb[1]; flip = 1; } else { P1 = A; P2 = B; e1 = sa[1]; flip = 0; }
    var n1 = P1.wn[e1], ie = 0, mn = 1e9, i;
    for (i = 0; i < P2.wn.length; i++) { var d = n1[0] * P2.wn[i][0] + n1[1] * P2.wn[i][1]; if (d < mn) { mn = d; ie = i; } }
    var i2 = (ie + 1) % P2.wv.length;
    var inc = [{ x: P2.wv[ie][0], y: P2.wv[ie][1], id: ie }, { x: P2.wv[i2][0], y: P2.wv[i2][1], id: i2 }];
    var v11 = P1.wv[e1], v12 = P1.wv[(e1 + 1) % P1.wv.length], tx = v12[0] - v11[0], ty = v12[1] - v11[1], tl = Math.sqrt(tx * tx + ty * ty); tx /= tl; ty /= tl;
    var nx = ty, ny = -tx, front = nx * v11[0] + ny * v11[1], s1 = -(tx * v11[0] + ty * v11[1]), s2 = tx * v12[0] + ty * v12[1];
    var c1 = clipSeg(inc, -tx, -ty, s1, 20); if (c1.length < 2) return null;
    var c2 = clipSeg(c1, tx, ty, s2, 21); if (c2.length < 2) return null;
    var out = [], mx = flip ? -nx : nx, my = flip ? -ny : ny;
    for (i = 0; i < 2; i++) {
      var sep = nx * c2[i].x + ny * c2[i].y - front;
      if (sep <= 0) out.push({ x: c2[i].x - sep * nx * 0.5, y: c2[i].y - sep * ny * 0.5, sep: sep, nx: mx, ny: my, f: flip * 1000 + e1 * 40 + c2[i].id, Pn: 0, Pt: 0 });
    }
    return out.length ? out : null;
  }

  /* ---------------------------------------------------------------- il solutore: impulsi sequenziali con il warm start (Box2D Lite) */
  function preStep(ar, inv) {
    var A = ar.A, B = ar.B, cs = ar.cs;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], r1x = c.x - A.x, r1y = c.y - A.y, r2x = c.x - B.x, r2y = c.y - B.y;
      var rn1 = r1x * c.nx + r1y * c.ny, rn2 = r2x * c.nx + r2y * c.ny;
      c.mN = 1 / (A.invM + B.invM + A.invI * (r1x * r1x + r1y * r1y - rn1 * rn1) + B.invI * (r2x * r2x + r2y * r2y - rn2 * rn2));
      var tx = c.ny, ty = -c.nx, rt1 = r1x * tx + r1y * ty, rt2 = r2x * tx + r2y * ty;
      c.mT = 1 / (A.invM + B.invM + A.invI * (r1x * r1x + r1y * r1y - rt1 * rt1) + B.invI * (r2x * r2x + r2y * r2y - rt2 * rt2));
      c.bias = -BIAS * inv * Math.min(0, c.sep + SLOP);
      c.r1x = r1x; c.r1y = r1y; c.r2x = r2x; c.r2y = r2y;
      var dvx = B.vx - B.w * r2y - A.vx + A.w * r1y, dvy = B.vy + B.w * r2x - A.vy - A.w * r1x, vn = dvx * c.nx + dvy * c.ny;
      c.rest = vn < -120 ? -REST * vn : 0; c.vn0 = vn;
      var Px = c.Pn * c.nx + c.Pt * tx, Py = c.Pn * c.ny + c.Pt * ty;
      A.vx -= A.invM * Px; A.vy -= A.invM * Py; A.w -= A.invI * (r1x * Py - r1y * Px);
      B.vx += B.invM * Px; B.vy += B.invM * Py; B.w += B.invI * (r2x * Py - r2y * Px);
    }
  }
  function impulse(ar) {
    var A = ar.A, B = ar.B, cs = ar.cs;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], r1x = c.r1x, r1y = c.r1y, r2x = c.r2x, r2y = c.r2y;
      var dvx = B.vx - B.w * r2y - A.vx + A.w * r1y, dvy = B.vy + B.w * r2x - A.vy - A.w * r1x, vn = dvx * c.nx + dvy * c.ny;
      var dPn = c.mN * (-vn + Math.max(c.bias, c.rest)), P0 = c.Pn; c.Pn = Math.max(P0 + dPn, 0); dPn = c.Pn - P0;
      var Px = dPn * c.nx, Py = dPn * c.ny;
      A.vx -= A.invM * Px; A.vy -= A.invM * Py; A.w -= A.invI * (r1x * Py - r1y * Px);
      B.vx += B.invM * Px; B.vy += B.invM * Py; B.w += B.invI * (r2x * Py - r2y * Px);
      dvx = B.vx - B.w * r2y - A.vx + A.w * r1y; dvy = B.vy + B.w * r2x - A.vy - A.w * r1x;
      var tx = c.ny, ty = -c.nx, vt = dvx * tx + dvy * ty, dPt = c.mT * -vt, maxPt = MU * c.Pn, T0 = c.Pt;
      c.Pt = Math.max(-maxPt, Math.min(maxPt, T0 + dPt)); dPt = c.Pt - T0;
      Px = dPt * tx; Py = dPt * ty;
      A.vx -= A.invM * Px; A.vy -= A.invM * Py; A.w -= A.invI * (r1x * Py - r1y * Px);
      B.vx += B.invM * Px; B.vy += B.invM * Py; B.w += B.invI * (r2x * Py - r2y * Px);
    }
  }
  /* il dito: una molla morbida (k 520, ζ .9 per unità di massa) verso il punto, attaccata dove il dito ha preso il tasto (il «mouse
     joint» di Box2D); la forza ha un tetto, così un tasto preso non trapassa gli altri */
  function jointPre(j, h) {
    var b = j.b, c = Math.cos(b.a), s = Math.sin(b.a), rx = c * j.lx - s * j.ly, ry = s * j.lx + c * j.ly, m = 1 / b.invM;
    var om = Math.sqrt(JK), k = m * om * om, d = 2 * m * JZ * om, g = h * (d + h * k); g = g ? 1 / g : 0;
    j.gamma = g; j.beta = h * k * g; j.rx = rx; j.ry = ry;
    var K00 = b.invM + b.invI * ry * ry + g, K01 = -b.invI * rx * ry, K11 = b.invM + b.invI * rx * rx + g, det = K00 * K11 - K01 * K01;
    j.M00 = K11 / det; j.M01 = -K01 / det; j.M11 = K00 / det;
    j.Cx = (b.x + rx - j.tx) * j.beta; j.Cy = (b.y + ry - j.ty) * j.beta; j.maxI = h * m * 30000;
    j.Px *= 0.9; j.Py *= 0.9;
    b.vx += b.invM * j.Px; b.vy += b.invM * j.Py; b.w += b.invI * (rx * j.Py - ry * j.Px);
  }
  function jointSolve(j) {
    var b = j.b, cx = b.vx - b.w * j.ry, cy = b.vy + b.w * j.rx;
    var ix = -(cx + j.Cx + j.gamma * j.Px), iy = -(cy + j.Cy + j.gamma * j.Py), dx = j.M00 * ix + j.M01 * iy, dy = j.M01 * ix + j.M11 * iy;
    var ox = j.Px, oy = j.Py; j.Px += dx; j.Py += dy; var L = Math.sqrt(j.Px * j.Px + j.Py * j.Py); if (L > j.maxI) { j.Px *= j.maxI / L; j.Py *= j.maxI / L; }
    dx = j.Px - ox; dy = j.Py - oy; b.vx += b.invM * dx; b.vy += b.invM * dy; b.w += b.invI * (j.rx * dy - j.ry * dx);
  }

  var CEIL = null;
  function near(A, B) { return Math.abs(A.x - B.x) <= A.ex + B.ex + 1 && Math.abs(A.y - B.y) <= A.ey + B.ey + 1; }
  var idle = 0;
  function stepWorld(h) {
    idle += h;
    var inv = 1 / h, i, j, A, B, k, cs, old, n, m;
    var fresh = {};
    for (i = 0; i < bodies.length; i++) { A = bodies[i]; if (A.wait > 0) continue; A.upd(); }
    for (i = 0; i < bodies.length; i++) {
      A = bodies[i]; if (A.lift || A.wait > 0) continue;
      for (j = i + 1; j < bodies.length + walls.length; j++) {
        B = j < bodies.length ? bodies[j] : walls[j - bodies.length];
        if (B.lift || B.wait > 0 || (B === CEIL && A.enter)) continue;
        if (!near(A, B)) continue;
        cs = collide(A, B); if (!cs) continue;
        k = A.i + ":" + B.i; old = arbs[k];
        if (old) for (n = 0; n < cs.length; n++) for (m = 0; m < old.cs.length; m++) if (old.cs[m].f === cs[n].f) { cs[n].Pn = old.cs[m].Pn; cs[n].Pt = old.cs[m].Pt; }
        fresh[k] = { A: A, B: B, cs: cs };
      }
    }
    arbs = fresh;
    for (i = 0; i < bodies.length; i++) { A = bodies[i]; if (A.lift || A.wait > 0) continue; A.vy += G * h; if (joint && joint.b === A) A.w *= 0.985; }
    for (k in arbs) preStep(arbs[k], inv);
    if (joint) jointPre(joint, h);
    for (n = 0; n < ITER; n++) { for (k in arbs) impulse(arbs[k]); if (joint) jointSolve(joint); }
    /* gli urti: «land» per Dot (e per chi ascolta), al più uno ogni 120 ms per tasto */
    var t = performance.now();
    for (k in arbs) { var ar = arbs[k], c0 = ar.cs[0]; if (c0.vn0 < -320 && t - ar.A.hot > 120) { ar.A.hot = t; emit("land", { i: ar.A.i, speed: Math.round(-c0.vn0) }); } }
    for (i = 0; i < bodies.length; i++) {
      A = bodies[i]; if (A.wait > 0) continue;
      if (A.lift) { stepLift(A, h); A.upd(); continue; }
      var sp = Math.sqrt(A.vx * A.vx + A.vy * A.vy); if (sp > 3600) { A.vx *= 3600 / sp; A.vy *= 3600 / sp; }
      /* dopo 2 s senza tocchi, un tasto incastrato che scivola piano (sotto 40 px/s) si ferma del tutto: il tremito dei tasti incastrati non
         dura per sempre e la scatola si addormenta (uno che cade va molto più veloce: non lo tocca) */
      if (idle > 2 && sp < 40 && Math.abs(A.w) < 1.5) { A.vx *= 0.96; A.vy *= 0.96; A.w *= 0.96; }
      if (A.w > 40) A.w = 40; else if (A.w < -40) A.w = -40;
      /* un tasto vero non sta in piedi su un angolo: lento (sotto 20 px/s) e a meno di 30° dalla diagonale, una piccola coppia lo porta
         verso il lato piatto più vicino e non lo lascia dormire lì. Per al più 1,5 s: appoggiato a un muro o a un altro tasto può restare
         inclinato davvero, e la scatola deve potersi addormentare */
      if (!(joint && joint.b === A) && sp < 20) {
        var q90 = Math.PI / 2, aq = ((A.a % q90) + q90) % q90, dev = aq - Math.PI / 4;
        if (Math.abs(dev) < Math.PI / 6 && (A.tt || 0) < 1.5) { A.tt = (A.tt || 0) + h; A.w += (dev < 0 ? -1 : 1) * 26 * h; A.st = 0; A.sa = A.a; }
        else if (Math.abs(dev) >= Math.PI / 6) A.tt = 0;
      } else if (sp >= 60) A.tt = 0;
      A.x += A.vx * h; A.y += A.vy * h; A.a += A.w * h;
      A.upd();
      if (A.enter && A.y - A.ey > PAD + 1) A.enter = false;
      keepIn(A);
      /* il sonno: sotto 4 px/s in media per 0,5 s (meno di 2 px di strada in mezzo secondo). Si misura la strada, non la velocità di un
         passo: tra tasti incastrati la correzione delle posizioni lascia un tremito di pochi px/s che non si vede e non deve tenerli svegli */
      if (joint && joint.b === A) { A.st = 0; A.sx = A.x; A.sy = A.y; A.sa = A.a; }
      else if (Math.abs(A.x - A.sx) > SLEEP_V * SLEEP_T || Math.abs(A.y - A.sy) > SLEEP_V * SLEEP_T || Math.abs(A.a - A.sa) > 0.03 || sp > 60) { A.st = 0; A.sx = A.x; A.sy = A.y; A.sa = A.a; }
      else A.st += h;
    }
  }
  /* mai fuori dalla scatola, qualunque cosa succeda: un tasto trovato fuori torna dentro, fermo su quel lato */
  function keepIn(b) {
    var moved = false;
    if (b.x - b.ex < PAD) { b.x = PAD + b.ex; if (b.vx < 0) b.vx = 0; moved = true; }
    if (b.x + b.ex > BW - PAD) { b.x = BW - PAD - b.ex; if (b.vx > 0) b.vx = 0; moved = true; }
    if (!b.enter && b.y - b.ey < PAD) { b.y = PAD + b.ey; if (b.vy < 0) b.vy = 0; moved = true; }
    if (b.y + b.ey > BH - PAD) { b.y = BH - PAD - b.ey; if (b.vy > 0) b.vy = 0; moved = true; }
    if (b.enter && b.y + b.ey < -4 * HS) { b.y = -4 * HS + b.ey; }
    if (moved) b.upd();
  }
  /* un tasto chiamato dalla tastiera: esce dal mucchio lungo un arco (220 ms) fino in cima, poi cade */
  function stepLift(b, h) {
    var L = b.lift;
    /* la prima caduta: dritta, con la gravità vera, fino al suo posto della fila; due rimbalzi piccoli (.18), poi è un tasto come gli altri */
    if (L.fall) {
      L.vy += G * h; b.y += L.vy * h;
      if (b.y >= L.y1) {
        b.y = L.y1;
        if (L.vy > 320 && !L.n) emit("land", { i: b.i, speed: Math.round(L.vy) });
        if (L.vy > 150 && (L.n || 0) < 2) { L.vy = -L.vy * REST; L.n = (L.n || 0) + 1; }
        else { b.lift = null; b.vx = 0; b.vy = 0; b.w = 0; b.st = 0; b.sx = b.x; b.sy = b.y; b.sa = b.a; }
      }
      return;
    }
    L.t += h; var u = Math.min(1, L.t / L.d), e = 1 - Math.pow(1 - u, 3);
    b.x = L.x0 + (L.x1 - L.x0) * e; b.y = L.y0 + (L.y1 - L.y0) * e - Math.sin(Math.PI * u) * 26; b.a = L.a0 + (L.a1 - L.a0) * e;
    if (u >= 1) { b.lift = null; b.vx = (L.x1 - L.x0) * 0.6; b.vy = 40; b.w = L.spin; b.st = 0; }
  }

  /* ---------------------------------------------------------------- i muri e i tasti */
  function build() {
    var r = cv.getBoundingClientRect(); BW = Math.max(120, Math.round(r.width)); BH = Math.max(120, Math.round(r.height));
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    cv.width = Math.round(BW * dpr); cv.height = Math.round(BH * dpr);
    var sc = scaleFor(BW);
    if (Math.abs(sc - SC) > 0.01) { var k = sc / SC; SC = sc; HS = KEY * SC / 2; RR = KR * SC; SPR = Math.ceil((KEY + 26) * SC); shape(); bodies.forEach(function (b) { reshape(b, 1); }); faces = []; }
    var T = 600;
    walls = [new Body(100, BW / 2, BH - PAD + T / 2, box4(BW / 2 + T, T / 2), 0), new Body(101, PAD - T / 2, BH / 2, box4(T / 2, BH + T), 0),
      new Body(102, BW - PAD + T / 2, BH / 2, box4(T / 2, BH + T), 0), new Body(103, BW / 2, PAD - T / 2, box4(BW / 2 + T, T / 2), 0)];
    CEIL = walls[3];
    if (!faces.length || faces.dpr !== dpr) sprites();
  }
  function make(drop) {
    bodies = [];
    for (var i = 0; i < 9; i++) {
      var b = new Body(i, 0, 0, OCT, 1);
      if (drop) {
        /* la prima caduta è un momento disegnato: ogni tasto cade dritto (al più 2°, senza girare) sopra il suo posto della fila, così sul
           fondo si legge imad.chat. Uno dopo l'altro, 70 ms l'uno dall'altro, in ordine di lettura; se la fila non ci sta (il telefono),
           prima «.chat» sul fondo e poi «imad» sopra «chat». Si rotola solo dopo, quando qualcuno li tocca */
        rowPlace(b, i); var two = rowTwo();
        b.lift = { fall: true, y1: b.y, vy: 260 }; b.y = -HS - 8; b.a = (hash(i) - 0.5) * 0.035; b.w = 0; b.vx = 0; b.vy = 0; b.st = 0; b.home = null;
        b.enter = true; b.wait = !two ? 0.07 * i : i >= 4 ? 0.07 * (i - 4) : 0.07 * 5 + 0.12 + 0.07 * i; b.upd();
      } else rowPlace(b, i);
      bodies.push(b);
    }
    asleep = false;
  }
  function rowTwo() { return (2 * HS + 4) * 9 - 4 > BW - 2 * PAD - 8; }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  /* la fila ordinata sul fondo (meno movimento, fotografie, la prima caduta): imad.chat; se non ci sta (il telefono), «.chat» sul fondo
     e «imad» sopra «chat», tasto su tasto: così ognuno posa su un lato piatto e la pila sta ferma (sfalsati come mattoni, gli angoli
     smussati di sotto si incastravano tra due tasti e li allargavano) */
  function rowPlace(b, i) {
    var per = 2 * HS + 4, x0;
    if (per * 9 - 4 <= BW - 2 * PAD - 8) { x0 = (BW - per * 9 + 4) / 2 + HS; b.x = x0 + i * per; b.y = BH - PAD - HS - 0.5; }
    else {
      var low = i >= 4, col = low ? i - 4 : i + 1; per = 2 * HS + 5; x0 = (BW - per * 5 + 5) / 2 + HS;
      b.x = x0 + col * per; b.y = low ? BH - PAD - HS - 0.5 : BH - PAD - HS * 3 - 1;
    }
    b.a = 0; b.vx = b.vy = b.w = 0; b.lift = null; b.enter = false; b.wait = 0; b.st = SLEEP_T + 1; b.home = { x: b.x, y: b.y }; b.upd();
  }

  /* ---------------------------------------------------------------- il disegno: le facce dal pittore della scena, una volta sola */
  var faces = [], contact = null, SPR = Math.ceil((KEY + 26) * SC);
  function sprites() {
    faces = []; faces.dpr = dpr;
    var st = W.DOT && W.DOT.stage, px = Math.ceil(SPR * dpr);
    for (var i = 0; i < 9; i++) {
      var c = doc.createElement("canvas"); c.width = px; c.height = px;
      var g = c.getContext("2d");
      g.setTransform(SC * dpr, 0, 0, SC * dpr, px / 2, px / 2);
      if (st && st.paintKey) {
        /* lo stato di un tasto fermo della scena, con l'ombra stretta sotto (aoK) e, sul punto, l'alone d'oro a .45 */
        st.paintKey(g, i, { x: 0, y: 0, sx: 1, sy: 1, alpha: 1, back: false, dark: 0, light: 0, dot: i === 4, glow: 0.45, row: 1, ground: false, aoK: 1 }, { dpr: dpr, scale: SC });
      } else {                                                    /* senza la scena (non dovrebbe succedere): una faccia semplice */
        g.fillStyle = "#f3ede0"; rr(g, -15, -15, 30, 30, 8); g.fill();
        g.fillStyle = "#1c1d26"; g.font = "800 17px Manrope, sans-serif"; g.textAlign = "center"; g.fillText(i === 4 ? "·" : LET[i], 0, 6);
      }
      faces.push(c);
    }
    /* l'ombra di contatto sul fondo: un'ellisse morbida, più chiara quanto più il tasto è alto */
    contact = doc.createElement("canvas"); contact.width = 64; contact.height = 16;
    var cg = contact.getContext("2d"), gr = cg.createRadialGradient(32, 8, 0, 32, 8, 32);
    gr.addColorStop(0, "rgba(6,6,14,.5)"); gr.addColorStop(0.55, "rgba(6,6,14,.2)"); gr.addColorStop(1, "rgba(6,6,14,0)");
    cg.setTransform(1, 0, 0, 0.25, 0, 6); cg.fillStyle = gr; cg.fillRect(0, -24, 64, 64);
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function isDark() { try { if (W.TEMA && W.TEMA.dark) return !!W.TEMA.dark(); } catch (e) { } return !!(W.matchMedia && W.matchMedia("(prefers-color-scheme: dark)").matches); }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, BW, BH);
    var live = bodies.filter(function (b) { return !(b.wait > 0); }), i, b, dark = isDark();
    /* le ombre sul fondo, prima di tutto: cadono sul fondo, mai sopra un tasto */
    for (i = 0; i < live.length; i++) {
      b = live[i]; var hgt = BH - PAD - (b.y + b.ey); if (hgt > 90) continue;
      var k = 1 - hgt / 90, wsh = (b.ex * 2 + 10) * (1 + hgt / 120);
      ctx.globalAlpha = (dark ? 0.85 : 0.5) * k * k; ctx.drawImage(contact, b.x - wsh / 2, BH - PAD - 7, wsh, 12);
    }
    ctx.globalAlpha = 1;
    /* dal basso in alto, come la scena: chi sta sopra copre il filo di sopra di chi sta sotto; il tasto preso o sollevato per ultimo */
    live.sort(function (p, q) { var lp = p.lift || (joint && joint.b === p) ? 1 : 0, lq = q.lift || (joint && joint.b === q) ? 1 : 0; return lp - lq || q.y - p.y; });
    var s = SPR;
    for (i = 0; i < live.length; i++) {
      b = live[i];
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.drawImage(faces[b.i], -s / 2, -s / 2, s, s); ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- il giro: solo se la scatola si vede e qualcosa si muove */
  function frame(t) {
    raf = 0; if (!vis || doc.hidden) { lastT = 0; return; }
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60; lastT = t;
    advance(dt);
    draw();
    if (!allAsleep()) raf = W.requestAnimationFrame(frame);
    else { lastT = 0; if (!asleep) { asleep = true; emit("sleep"); } }
  }
  function advance(dt) {
    var h = 1 / HZ, n = 0;
    for (var i = 0; i < bodies.length; i++) { var b = bodies[i]; if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) { b.wait = 0; b.st = 0; } } }
    acc += dt;
    while (acc >= h && n < 6) { stepWorld(h); acc -= h; n++; }
    if (n >= 6) acc = 0;
  }
  function allAsleep() {
    if (joint) return false;
    for (var i = 0; i < bodies.length; i++) { var b = bodies[i]; if (b.wait > 0 || b.lift || b.enter || b.st < SLEEP_T) return false; }
    return true;
  }
  function wake() {
    asleep = false;
    if (!raf && vis && !doc.hidden && started && !calm()) { lastT = 0; raf = W.requestAnimationFrame(frame); }
  }
  function nudge(b) { idle = 0; b.st = 0; b.sx = b.x; b.sy = b.y; b.sa = b.a; }

  /* ---------------------------------------------------------------- il dito, il mouse, la tastiera */
  function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function pick(x, y) {
    for (var i = bodies.length - 1, order = bodies.slice().sort(function (p, q) { return p.y - q.y; }); i >= 0; i--) {
      var b = order[order.length - 1 - i]; if (b.wait > 0) continue;
      var c = Math.cos(b.a), s = Math.sin(b.a), dx = x - b.x, dy = y - b.y, lx = c * dx + s * dy, ly = -s * dx + c * dy;
      if (Math.abs(lx) <= HS + 6 && ly <= HS + 6 && ly >= -HS - 6 - BAND * SC) return { b: b, lx: lx, ly: ly };
    }
    return null;
  }
  var taps = [], dragId = null, moved = 0, downAt = null;
  function grab(x, y, id) {
    var p = pick(x, y); downAt = { x: x, y: y, t: performance.now() }; moved = 0;
    if (!p || !started) return false;
    dragId = id;
    if (calm()) { joint = { b: p.b, still: true, ox: x - p.b.x, oy: y - p.b.y }; emit("grab", { i: p.b.i }); return true; }
    bodies.forEach(nudge);
    joint = { b: p.b, lx: p.lx, ly: p.ly, tx: x, ty: y, Px: 0, Py: 0 }; p.b.lift = null; p.b.enter = false;
    emit("grab", { i: p.b.i }); wake(); return true;
  }
  function moveTo(x, y) {
    if (downAt) moved = Math.max(moved, Math.abs(x - downAt.x) + Math.abs(y - downAt.y));
    if (!joint) return;
    x = Math.max(PAD, Math.min(BW - PAD, x)); y = Math.max(PAD, Math.min(BH - PAD, y));
    if (joint.still) { joint.b.x = x - joint.ox; joint.b.y = y - joint.oy; joint.b.upd(); keepIn(joint.b); draw(); return; }
    joint.tx = x; joint.ty = y; bodies.forEach(nudge); wake();
  }
  function release(x, y) {
    var was = joint; joint = null; dragId = null;
    if (was && was.still) { rowPlace(was.b, was.b.i); draw(); }
    else if (was) {
      var b = was.b, sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
      emit("throw", { i: b.i, vx: Math.round(b.vx), vy: Math.round(b.vy) });
    }
    /* due tocchi veloci nello stesso punto, senza trascinare: si sparpagliano */
    var t = performance.now();
    if (downAt && moved < 10 && t - downAt.t < 280) {
      taps.push({ x: downAt.x, y: downAt.y, t: t }); taps = taps.filter(function (q) { return t - q.t < 340; });
      if (taps.length >= 2 && Math.abs(taps[0].x - taps[1].x) + Math.abs(taps[0].y - taps[1].y) < 44) { scatter(taps[1].x, taps[1].y); taps = []; }
    }
    downAt = null; wake();
  }
  /* sparpagliare: una spinta di 900 px/s via dal punto (più forte vicino), sempre un po' in su, e un giro */
  function scatter(x, y) {
    if (calm() || !started) return;
    idle = 0;
    bodies.forEach(function (b, n) {
      if (b.wait > 0) return;
      var dx = b.x - x, dy = b.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = SCAT * (0.55 + 0.45 * Math.max(0, 1 - d / 320));
      b.vx += dx / d * f; b.vy += Math.min(dy / d * f, 0) - 520 - 260 * hash(n + performance.now() % 97); b.w += (hash(n * 3 + 1) - 0.5) * 16; b.lift = null; b.st = 0;
    });
    wake();
  }
  /* con il dito: si prende un tasto solo se il dito parte su un tasto; altrimenti la pagina scorre come sempre (touch-action: pan-y) */
  cv.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return; var t = e.touches[0], p = local(t);
    if (grab(p.x, p.y, t.identifier)) e.preventDefault();
  }, { passive: false });
  cv.addEventListener("touchmove", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], p = local(t);
      if (dragId === t.identifier) { moveTo(p.x, p.y); e.preventDefault(); }
      else if (dragId === null && downAt) moved = Math.max(moved, Math.abs(p.x - downAt.x) + Math.abs(p.y - downAt.y));
    }
  }, { passive: false });
  function tend(e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (dragId === null || dragId === t.identifier) { var p = local(t); release(p.x, p.y); } } }
  cv.addEventListener("touchend", tend); cv.addEventListener("touchcancel", tend);
  cv.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return; var p = local(e);
    if (grab(p.x, p.y, "m")) { try { cv.setPointerCapture(e.pointerId); } catch (x) { } cv.classList.add("is-preso"); }
  });
  cv.addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; var p = local(e); if (dragId === "m") moveTo(p.x, p.y); else cv.classList.toggle("is-sopra", !!pick(p.x, p.y)); });
  cv.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse" || (dragId !== "m" && !downAt)) return; var p = local(e); release(p.x, p.y); cv.classList.remove("is-preso"); });
  cv.addEventListener("lostpointercapture", function () { if (dragId === "m") { release(0, 0); cv.classList.remove("is-preso"); } });
  cv.addEventListener("pointerleave", function () { cv.classList.remove("is-sopra"); });
  /* col mouse il doppio clic sparpaglia (i due tocchi li conta release); niente selezione di testo */
  cv.addEventListener("dblclick", function (e) { e.preventDefault(); });
  cv.addEventListener("focus", function () { var kb = false; try { kb = cv.matches(":focus-visible"); } catch (x) { kb = true; } box.classList.toggle("is-tasti", kb); });

  var lastA = 7;
  function dropLetter(ch) {
    if (!started) return false;
    ch = String(ch || "").toLowerCase();
    var idx = ch === "a" ? (lastA = lastA === 2 ? 7 : 2) : LET.indexOf(ch); if (idx < 0) return false;
    var b = bodies[idx]; if (!b || b.wait > 0 || (joint && joint.b === b)) return false;
    if (calm()) return false;                                   /* meno movimento: niente arco (il tasto resta in fila) */
    var tx = Math.max(PAD + b.ex + 6, Math.min(BW - PAD - b.ex - 6, BW * (0.18 + 0.64 * hash(idx + performance.now() % 31))));
    b.lift = { t: 0, d: 0.22, x0: b.x, y0: b.y, x1: tx, y1: PAD + HS + 8, a0: b.a, a1: Math.round(b.a / (Math.PI / 2)) * (Math.PI / 2) + (hash(idx * 7) - 0.5) * 0.4, spin: (hash(idx * 5) - 0.5) * 6 };
    b.vx = b.vy = b.w = 0; b.enter = false;
    bodies.forEach(nudge); wake(); return true;
  }
  doc.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    var a = doc.activeElement; if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    var k = (e.key || "").toLowerCase();
    if ((k === " " || k === "spacebar") && a === cv) { e.preventDefault(); scatter(BW / 2, BH); return; }
    if (k.length === 1 && LET.indexOf(k) >= 0 && dropLetter(k)) e.preventDefault();
  });

  /* ---------------------------------------------------------------- avvio: la prima volta che la scatola si vede (35%) i tasti cadono */
  function start(drop) { if (started) return; started = true; make(drop && !calm()); draw(); wake(); }
  function relayout() {
    var ow = BW, oh = BH; build(); if (!started) return;
    if (ow && (ow !== BW || oh !== BH)) bodies.forEach(function (b) { if (b.wait > 0) return; if (calm()) rowPlace(b, b.i); else { b.x *= BW / ow; b.y = Math.min(b.y, BH - b.ey); b.upd(); keepIn(b); b.st = 0; } });
    draw(); wake();
  }
  build();
  if (calm()) start(false);
  if ("IntersectionObserver" in W) {
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1]; vis = e.isIntersecting;
      if (vis && !started && e.intersectionRatio >= 0.35) start(true);
      if (vis) wake();
    }, { threshold: [0, 0.35] }).observe(box);
  } else { vis = true; start(true); }
  if ("ResizeObserver" in W) new ResizeObserver(function () { relayout(); }).observe(box); else W.addEventListener("resize", relayout);
  /* le lettere dei tasti sono in Manrope 800: le facce si ridipingono quando il carattere c'è */
  function refaces() { sprites(); if (started) draw(); }
  if (doc.fonts && doc.fonts.load) { try { doc.fonts.load("800 17px Manrope").then(refaces, function () { }); } catch (e) { } }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refaces);
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden) wake(); });
  function onCalm() { if (calm()) { if (started) { bodies.forEach(function (b) { rowPlace(b, b.i); }); draw(); } } else { bodies.forEach(nudge); wake(); } }
  if (mqReduce) { if (mqReduce.addEventListener) mqReduce.addEventListener("change", onCalm); else if (mqReduce.addListener) mqReduce.addListener(onCalm); }
  function retheme() { if (started) draw(); }
  if (W.TEMA && W.TEMA.on) { try { W.TEMA.on(retheme); } catch (e) { } }
  if (W.MutationObserver) new MutationObserver(retheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------------------------------------------------------------- window.SCATOLA */
  W.SCATOLA = {
    /* il pozzo nella pagina */
    rect: function () { var r = cv.getBoundingClientRect(); return { left: r.left + W.pageXOffset, top: r.top + W.pageYOffset, width: r.width, height: r.height }; },
    keys: function () {
      var r = this.rect();
      return bodies.map(function (b) { return { i: b.i, ch: LET[b.i], x: r.left + b.x, y: r.top + b.y, a: b.a, h: HS, sleeping: b.st >= SLEEP_T && !b.lift && !(b.wait > 0), vx: b.vx, vy: b.vy }; });
    },
    /* una spinta (la zampa di Dot): px/s */
    push: function (i, vx, vy) { var b = bodies[i]; if (!b || calm() || b.wait > 0) return false; b.vx += +vx || 0; b.vy += +vy || 0; bodies.forEach(nudge); wake(); return true; },
    drop: dropLetter,
    /* x, y in coordinate della pagina (senza: dal centro del fondo) */
    scatter: function (x, y) { var r = this.rect(); scatter(x == null ? BW / 2 : x - r.left, y == null ? BH : y - r.top); },
    on: function (fn) { if (typeof fn === "function" && subs.indexOf(fn) < 0) subs.push(fn); },
    off: function (fn) { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); },
    /* per gli strumenti di prova: s secondi di fisica subito (senza fotogrammi); torna quante volte un tasto è stato trovato fuori */
    _prova: {
      run: function (s) {
        var out = 0, n = Math.round(s * HZ);
        for (var k = 0; k < n; k++) {
          advance(1 / HZ);
          for (var i = 0; i < bodies.length; i++) { var b = bodies[i]; if (b.wait > 0 || b.enter) continue; if (b.x - b.ex < PAD - 0.5 || b.x + b.ex > BW - PAD + 0.5 || b.y - b.ey < PAD - 0.5 || b.y + b.ey > BH - PAD + 0.5 || !isFinite(b.x + b.y + b.a)) out++; }
        }
        draw(); return out;
      },
      start: function () { vis = true; start(true); },
      asleep: allAsleep, raf: function () { return !!raf; }, size: function () { return [BW, BH, dpr]; }
    }
  };
})();
