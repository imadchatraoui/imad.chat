/* dot-brain.js — il cervello di Dot: dove sta, cosa fa, come reagisce (vedi DOT.md, sezioni 3 e 4).
   Non disegna il gatto: guida lo scheletro (dot-rig.js) per nome di posa, valori forzati e pochi comandi, poi passa il
   fotogramma all'aspetto scelto (look-*.js). Le cose attorno (nuvoletta, graffi, oggetti) sono in dot-fx.js.
   Coordinate: pixel della pagina (x a destra, y in GIÙ); il gatto è disegnato in unità del modello (y in alto),
   K pixel per unità. Uso: DOT.start({ tiles, home, look, firstVisit, reducedMotion }), DOT.stop(), DOT.setLook(nome),
   DOT.say(testo, secondi), DOT.replay(). Per le prove: window.__manual = true e DOT.debug.tick(dt). Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {});
  var doc = document, PI = Math.PI, TAU = PI * 2;
  var U = DOT.util, lerp = U.lerp, clamp = U.clamp, sat = U.sat, seg = U.seg, smooth = U.smooth, wrap = U.wrap, eIO = U.eIO, eOut = U.eOut, eBack = U.eBack;
  var Y = DOT.YAW;
  function eIn(u) { return u * u * u; }
  function bell(u) { return u <= 0 || u >= 1 ? 0 : Math.sin(PI * u); }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }

  /* ------------------------------------------------------------------ numeri a caso (con un seme per le prove) */
  var seedOn = false, seedS = 1;
  function rnd() {
    if (!seedOn) return Math.random();
    seedS = (seedS + 0x6d2b79f5) | 0; var t = Math.imul(seedS ^ (seedS >>> 15), 1 | seedS); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rr(a, b) { return a + rnd() * (b - a); }
  function pick(a) { return a[Math.floor(rnd() * a.length) % a.length]; }
  function wpick(o, not) { var k, s = 0, r; for (k in o) if (k !== not) s += o[k]; r = rnd() * s; for (k in o) { if (k === not) continue; r -= o[k]; if (r <= 0) return k; } for (k in o) if (k !== not) return k; return null; }

  /* ------------------------------------------------------------------ pose in più (del cervello), costruite sulle pose dell'aspetto
     appeso e scivola: il corpo è dritto (rig.pitchT = PI/2: il muso del corpo punta in alto, la pancia verso chi guarda),
     la testa torna a guardarci (hp = -PI/2). In questa posa x = in alto sullo schermo, y = profondità (negativo = verso di noi);
     l'origine è al centro del corpo: le zampe davanti (il bordo a cui si tiene) stanno 20 unità più in alto (HANG_TOP). */
  var HANG_TOP = 20.4, SLIDE_TOP = 16.6;
  var HANG = { hx: -7, hy: 0, cx: 8.5, cy: 0, dx: 3.6, dy: -1.2, f0x: 19.3, f0y: -3.6, f1x: 19.3, f1y: -3.6, fs: 7.2, fo: 1.8, f2x: -17.4, f2y: -4.6, f3x: -16.2, f3y: -6.4, hs: 0.2, ho: 1.4,
    tuck: 0, tby: 4, te: -0.25, tc: 0.25, tw: 0.5, puff: 0, eye: 1.05, lid: 0.05, brow: 0, hp: -PI / 2, hr: 0, ear: 0.12, mouth: 0, sqx: 1, sqy: 1, arch: 0, br: 0.5 };
  var SLIDE = { hx: -6.5, hy: 0, cx: 7.6, cy: 0, dx: 3.4, dy: -1.4, f0x: 15.6, f0y: -3.4, f1x: 15.6, f1y: -3.4, fs: 4.4, fo: 5.8, f2x: -14.2, f2y: -4, f3x: -14.2, f3y: -4, hs: 2.4, ho: 6.6,
    tuck: 0, tby: 3, te: -0.3, tc: 0.85, tw: 0.62, puff: 0.45, eye: 1.32, lid: 0, brow: 0, hp: -PI / 2, hr: 0, ear: 0.42, mouth: 0.18, sqx: 1.12, sqy: 1, arch: 0, br: 0.2 };
  function addPoses(rig) {
    var P = rig.poses, S = P.sit, St = P.stand, pz = DOT.pose;
    P["b-hang"] = pz(HANG, St); P["b-slide"] = pz(SLIDE, St);
    P["b-paw"] = pz({ f0x: 11.6, f0y: 5.4, hp: -0.28, dx: 3.2, dy: 9.6 }, S);                 /* una zampa sopra il cubo */
    P["b-push"] = pz({ f0x: 15.5, f0y: 1.6, hp: -0.18, cx: 7.4, cy: 12.4, dx: 6, dy: 8.6 }, St);   /* lo spinge giù dal bordo */
    P["b-sniff"] = pz({ cx: 7.4, cy: 11.6, dx: 7.6, dy: 4.2, hp: -0.5, f0x: 9.4, f1x: 8.2, te: 0.9, tc: 0.7 }, St);   /* il muso a terra, sul fez */
    P["b-over"] = pz({ hx: -5.5, hy: 11.4, cx: 7.6, cy: 10.4, dx: 7.6, dy: 4.6, hp: -0.62, f0x: 9.6, f1x: 8.4, f2x: -5.4, f3x: -6.4, te: 0.4, tc: 0.6, ear: -0.1 }, St);   /* si sporge e guarda giù */
    P["b-knead"] = pz({ f0y: 6.5, f1y: 5, f2y: 6.5, f3y: 4.5 }, P.belly);
    P["b-pounce"] = pz({ f0x: 13.5, f0y: 4.5, f1x: 12, f1y: 4.5, f2x: -9, f3x: -10, hx: -7.5, hy: 11.5, cx: 7.5, cy: 9.2, dx: 6.6, dy: 6.4, eye: 1.2, ear: 0.1, te: 0.9, tc: 0.3 }, St);
  }

  /* ------------------------------------------------------------------ lo stato */
  var O = {}, B = { on: false };
  var look = null, rig = null, K = 1.5, dpr = 1, dark = true, reduced = false;
  var layer = null, catSp = null, grab = null, bubble = null, scratches = [], props = [], fez = null, stage = null, stageOn = false;
  var CWU = 124, CHU = 134, OXU = 62, OYU = 70;               /* la tela del gatto, in unità: larga, alta, origine dentro */
  var cat = { x: 0, y: 0, s: 1, dir: 1, face: "view", plat: null, rel: 0, state: "off", st: 0, d: {}, lift: 0, gy: null, rot: 0, piv: 12, clipY: null, paws: false, vis: false,
    att: null, gz: true, coast: 0, offT: 0, voff: 0, ownRot: false, ownLift: false, clipAt: null, blinkO: null, last: "", lastTap: "", taps: [], hold: null, jit: 0 };
  var view = { sx: 0, sy: 0, vw: 360, vh: 640 };
  var world = { tiles: [], plats: [], no: [], sig: "", at: 0 };
  var ptr = { x: -1e4, y: -1e4, t: -99, vx: 0, vy: 0, sp: 0, still: 0, touch: false, down: false };
  var now = 0, lastIn = 0, openedAt = 0, frenchDone = false, last = 0, raf = 0, lastF = null, life = { blinkAt: 2, blinkT: -9, dbl: false, slow: -9, earAt: 3, glAt: 1, gl: 0, glY: 0, petNear: 0, fezRoll: 0, fezRollV: 0, propAt: 14, propIx: 0, propList: null };
  var drag = null, fake = null, script = null;

  function px() { return K * cat.s; }                                          /* pixel per unità adesso */
  function toPage(mx, my) { var k = px(); return { x: cat.x + mx * k, y: cat.y - cat.lift - my * k }; }

  /* ------------------------------------------------------------------ il mondo: i riquadri e i loro bordi */
  function readView() { view.sx = window.pageXOffset || 0; view.sy = window.pageYOffset || 0; view.vw = doc.documentElement.clientWidth || window.innerWidth; view.vh = window.innerHeight; }
  function readWorld() {
    readView();
    var els = doc.querySelectorAll(O.tiles), i, j, r, el, mode, rad, t, tiles = [], plats = [], no = [], oldPlat = cat.plat;
    for (i = 0; i < els.length; i++) {
      el = els[i]; r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 24) continue;
      mode = el.getAttribute("data-dot") || ""; rad = 30;
      try { rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; } catch (e) { rad = 30; }
      t = { el: el, l: r.left + view.sx, t: r.top + view.sy, r: r.right + view.sx, b: r.bottom + view.sy, w: r.width, h: r.height, mode: mode, rad: rad };
      tiles.push(t); if (mode === "no") no.push(t);
    }
    var cut = no.slice(); if (stageOn && stage.rim) { try { var rm = stage.rim(), bh = B.home || { y: rm.y }; cut.push({ l: rm.x - rm.w / 2 - 8, r: rm.x + rm.w / 2 + 8, t: rm.y - 8, b: bh.y, m: 10 }); } catch (e) {} }
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; if (t.mode === "no") continue;
      var m = Math.max(24, t.rad * 0.6 + 12), segs = [[t.l + m, t.r - m]];
      for (j = 0; j < cut.length; j++) {                                       /* mai sopra il Corano (né dentro la scatola): si taglia il tratto che gli sta sotto */
        var n = cut[j], mm = n.m || 34; if (n.b < t.t - 84 || n.t > t.t + 2) continue; var a = n.l - mm, b = n.r + mm, out = [], k;
        for (k = 0; k < segs.length; k++) { var s = segs[k]; if (b <= s[0] || a >= s[1]) out.push(s); else { if (a > s[0]) out.push([s[0], a]); if (b < s[1]) out.push([b, s[1]]); } }
        segs = out;
      }
      for (j = 0; j < segs.length; j++) if (segs[j][1] - segs[j][0] >= 26) plats.push({ el: t.el, tile: t, a: segs[j][0], b: segs[j][1], y: t.t, quiet: t.mode === "quiet" });
    }
    world.tiles = tiles; world.plats = plats; world.no = cut;
    if (oldPlat) {                                                             /* il gatto resta attaccato al suo riquadro */
      var np = null, best = 1e9; for (i = 0; i < plats.length; i++) if (plats[i].el === oldPlat.el) { var d = Math.abs(plats[i].tile.l + cat.rel - clamp(plats[i].tile.l + cat.rel, plats[i].a, plats[i].b)); if (d < best) { best = d; np = plats[i]; } }
      if (np) { var dy = np.y - oldPlat.y, nx = clamp(np.tile.l + cat.rel, np.a, np.b), dx = nx - cat.x; cat.plat = np; if (onEdge()) { cat.x = nx; cat.y = np.y; cat.gy = np.y; } else { cat.x += dx; cat.y += dy; if (cat.gy != null) cat.gy += dy; } }
      else cat.plat = null;
    }
    world.at = now;
  }
  function onEdge() { var s = cat.state; return !(s === "air" || s === "held" || s === "fall" || s === "fly" || s === "slide" || s === "hang" || s === "opening" || s === "boxed" || s === "box"); }
  function landOn(p) { cat.plat = p; cat.y = p.y; cat.gy = p.y; cat.rel = cat.x - p.tile.l; }
  function inView(y, top, bot) { return y > view.sy + (top || 0) && y < view.sy + view.vh - (bot || 0); }
  function visPlats(any) { var o = [], i, p; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if ((any || !p.quiet) && inView(p.y, 96, 26) && p.a < view.sx + view.vw - 30 && p.b > view.sx + 30) o.push(p); } return o; }
  function platBelow(x, y, any) { var i, p, b = null; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if ((any || !p.quiet || true) && x >= p.a - 8 && x <= p.b + 8 && p.y >= y - 3 && (!b || p.y < b.y)) b = p; } return b; }
  function floorAt(x, y) { var p = platBelow(x, y, true); return p ? p.y : Infinity; }
  function tileAt(x, y) { var i, t; for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (x >= t.l && x <= t.r && y >= t.t && y <= t.b) return t; } return null; }
  function hitsNo(x0, y0, x1, y1, h) {                                         /* un salto che passa sopra il Corano? (campiona l'arco) */
    var i, j, u, x, y, n; for (i = 0; i <= 12; i++) { u = i / 12; x = lerp(x0, x1, u); y = lerp(y0, y1, u) - 4 * h * u * (1 - u);
      for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (x > n.l - 30 && x < n.r + 30 && y > n.t - 8 && y - 60 < n.b) return true; } }
    return false;
  }
  function room(p, x, dir) { return dir > 0 ? p.b - x : x - p.a; }

  /* ------------------------------------------------------------------ i comandi di base */
  function yawFor(face, dir) {
    if (face === "side") return dir > 0 ? Y.right : Y.left;
    if (face === "front") return Y.front;
    if (face === "back") return dir > 0 ? Y.backRight : Y.backLeft;
    return dir > 0 ? Y.viewRight : Y.viewLeft;
  }
  function aligned(tol) { return Math.abs(wrap(rig.yaw - rig.yawT)) < (tol || 0.4); }
  function set(state, d) {
    if (cat.state === "slide" && cat.d.sc) cat.d.sc.done();
    cat.state = state; cat.st = 0; cat.d = d || {};
    rig.over = {}; rig.walkT = 0; rig.pitchT = 0; rig.rollT = 0; rig.longT = 0; rig.tailSwish = 0; rig.tailRate = 0; rig.grounded = true; rig.rate = 12; rig.pupilT = 0.8;
    cat.clipAt = null; cat.clipTop = null; cat.paws = false; cat.att = null; cat.gz = true; cat.ownRot = false;
    if (cat.d.face) cat.face = cat.d.face; if (cat.d.pose) rig.pose = cat.d.pose;
  }
  function think() { set("think"); }
  function sitFor(dur, o) { var d = o || {}; d.dur = dur; d.face = d.face || "view"; d.pose = d.pose || "sit"; set("sit", d); }
  /* sposta l'origine del gatto di dy unità (in giù sullo schermo se dy > 0) senza che il disegno salti:
     lo scarto rientra con la stessa prontezza della posa, così il corpo resta dov'è mentre le zampe si riordinano */
  function reanchor(dy) { cat.y += dy * px(); cat.voff += dy; }
  function fx() { return DOT.fx; }
  function sound(n) { try { if (DOT.sound && typeof DOT.sound[n] === "function") DOT.sound[n](); } catch (e) {} }
  function say(text, sec, kind) { if (bubble) bubble.say(text, sec || 3, kind); }

  /* ------------------------------------------------------------------ la vita di tutti i giorni */
  var IDLE = { walk: 0.24, jump: 0.15, sit: 0.13, look: 0.08, loaf: 0.07, sleep: 0.05, groom: 0.07, yawn: 0.04, stretch: 0.04, drape: 0.05, dive: 0.05, prop: 0.12 };
  var SLEEPY = { walk: 0.1, jump: 0.05, sit: 0.08, look: 0.04, loaf: 0.14, sleep: 0.22, groom: 0.11, yawn: 0.09, stretch: 0.05, drape: 0.09, dive: 0.02, prop: 0.05 };
  function decide() {
    var p = cat.plat;
    if (!p || !inView(cat.y, 40, -10)) return comeBack();
    if (p.quiet) return leave("sit");
    var w = {}, k, base = now - lastIn > 25 ? SLEEPY : IDLE; for (k in base) w[k] = base[k];
    if (now < life.propAt || props.length) w.prop = 0;
    if (p.b - p.a < 60) { w.walk = 0.02; w.dive *= 0.5; }
    k = wpick(w, cat.last); cat.last = k;
    if (k === "walk") return walkSome(p);
    if (k === "jump") return jumpSome(p) || walkSome(p);
    if (k === "sit") return sitFor(rr(2.4, 4.6));
    if (k === "look") return set("look", { dur: rr(3, 5), face: "view", pose: "sit" });
    if (k === "loaf") return set("loaf", { dur: rr(5, 9), face: "view", pose: "loaf" });
    if (k === "sleep") return set("sleep", { dur: rr(9, 15), face: "view", pose: "loaf" });
    if (k === "groom") return set("groom", { dur: rr(2.6, 4), face: "view", pose: "groom" });
    if (k === "yawn") return set("yawn", { face: "view", pose: "sit" });
    if (k === "stretch") return set("stretch", { face: "side", pose: "stand" });
    if (k === "drape") return set("drape", { dur: rr(7, 11), face: "side", pose: "loaf" });
    if (k === "dive") return room(p, cat.x, 1) + room(p, cat.x, -1) > 60 ? set("dive", { face: "side", pose: "crouch" }) : sitFor(3);
    return startProp();
  }
  function walkTo(tx, then, o) { var d = o || {}; d.tx = tx; d.then = then; d.face = "side"; d.pose = "stand"; cat.dir = tx >= cat.x ? 1 : -1; set("walk", d); }
  function walkSome(p) {
    var tx = cat.x, n = 0; if (p.b - p.a < 50) return sitFor(rr(2, 4));
    while (Math.abs(tx - cat.x) < 44 && n++ < 14) tx = rr(p.a, p.b);
    walkTo(tx, rnd() < 0.55 ? "sit" : "pause");
  }
  function jumpTargets(p, maxDy) {
    var o = [], v = visPlats(), i, q, tx;
    for (i = 0; i < v.length; i++) { q = v[i]; if (q === p || q.quiet || Math.abs(q.y - cat.y) > (maxDy || 330)) continue; tx = clamp(cat.x + rr(-90, 90), q.a, q.b); if (Math.abs(tx - cat.x) > 380) continue;
      if (!hitsNo(cat.x, cat.y, tx, q.y, 26 + Math.max(0, cat.y - q.y) * 0.3)) o.push({ p: q, x: tx }); }
    return o;
  }
  function jumpSome(p, then) { var o = jumpTargets(p); if (!o.length) return false; var j = pick(o); jumpTo(j.p, j.x, then); return true; }
  function jumpH(dx, dy) { var d = hyp(dx, dy); return Math.max(22, 14 + d * 0.15) + Math.max(0, -dy) * 0.6; }
  var GRAV = 2300;
  /* un salto da (x0, y0) a (x1, y1) (pagina, y in giù): l'apice sta «c» pixel sopra il punto più alto */
  function arc(x0, y0, x1, y1, c, d) {
    var dist = hyp(x1 - x0, y1 - y0); c = c != null ? c : 18 + dist * 0.08;
    var top = Math.min(y0, y1) - c, up = Math.sqrt(2 * GRAV * Math.max(1, y0 - top)), ta = up / GRAV, td = Math.sqrt(2 * Math.max(1, y1 - top) / GRAV);
    d = d || {}; d.x0 = x0; d.y0 = y0; d.x1 = x1; d.y1 = y1; d.vy0 = -up; d.dur = ta + td; d.h = c; return d;
  }
  function jumpTo(q, x, then, o) { var d = o || {}; d.q = q; d.tx = x; d.ty = q.y; d.then = then; d.face = "side"; d.pose = "crouch"; cat.dir = x >= cat.x ? 1 : -1; set("crouch", d); }
  function leave(then) { var o = jumpTargets(cat.plat, 520); if (o.length) { o.sort(function (a, b) { return Math.abs(a.p.y - cat.y) - Math.abs(b.p.y - cat.y); }); jumpTo(o[0].p, o[0].x, then || "sit"); } else sitFor(3); }
  /* torna dove lo si vede: spunta da dietro il bordo di un riquadro visibile, oppure ci salta dentro da fuori */
  function comeBack() {
    var v = visPlats(); if (!v.length) { v = visPlats(true); } if (!v.length) { cat.vis = false; set("wait"); return; }
    v.sort(function (a, b) { return Math.abs(a.y - cat.y) - Math.abs(b.y - cat.y); });
    var q = v[0], x = clamp(cat.x, q.a + 10, q.b - 10);
    clearHeld();
    if (rnd() < 0.62 || cat.state === "wait") { cat.x = x; cat.plat = q; set("peek", { p: q, x: x }); return; }
    var fromTop = cat.y < view.sy; cat.x = clamp(x + (rnd() < 0.5 ? -60 : 60), view.sx + 20, view.sx + view.vw - 20); cat.y = fromTop ? view.sy - 30 : view.sy + view.vh + 70; cat.gy = null; cat.plat = null;
    jumpTo(q, x, "sit", { quick: true, high: fromTop ? 16 : 40 });
  }
  /* cadere da (x, y) passerebbe davanti al Corano? allora salta di lato su un bordo raggiungibile (o torna altrove) */
  function fallBlocked(x, y) {
    var p = platBelow(x, y), ly = p ? p.y : Infinity, i, n;
    for (i = 0; i < world.no.length; i++) { n = world.no[i]; if (n.m) continue; if (x > n.l - 24 && x < n.r + 24 && n.b > y && n.t < ly) return true; }
    return false;
  }
  function escapeJump(h0) {
    var v = visPlats(), i, q, tx, best = null, bd = 1e9;
    for (i = 0; i < v.length; i++) { q = v[i]; tx = clamp(cat.x, q.a, q.b); var dd = hyp(tx - cat.x, q.y - cat.y); if (dd < bd && dd < 420 && !hitsNo(cat.x, cat.y, tx, q.y, h0 || 30)) { bd = dd; best = { p: q, x: tx }; } }
    if (!best) return comeBack();
    cat.dir = best.x >= cat.x ? 1 : -1; set("air", arc(cat.x, cat.y, best.x, best.p.y, 24, { q: best.p, then: "shake", face: "side", pose: "air" }));
  }
  function clearHeld() { var i; for (i = 0; i < props.length; i++) if (props[i].held) dropProp(props[i]); }

  var STATES = {
    off: function () {}, wait: function () { if (cat.st > 0.6) { cat.st = 0; var v = visPlats(true); if (v.length) { cat.vis = true; comeBack(); } } },
    think: function () { decide(); },
    sit: function (dt, d) {
      var st = cat.st; if (d.plop == null) d.plop = Math.abs(rig.A.hy - rig.poses.sit.hy) > 1.5;
      if (st < 0.5 && d.plop) { var pl = bell(seg(st, 0.12, 0.32)) - 0.35 * bell(seg(st, 0.32, 0.5)); rig.over.sqy = 1 - 0.045 * pl; rig.over.sqx = 1 + 0.03 * pl; } else if (!d.pl) { d.pl = 1; delete rig.over.sqy; delete rig.over.sqx; }   /* si siede con un piccolo «plof» */
      if (d.mood === "proud") { rig.over.hp = 0.14; rig.over.lid = 0.28; } if (st > d.dur) { if (d.then) d.then(); else think(); }
    },
    pause: function (dt, d) { rig.pose = "stand"; if (cat.st > (d.dur || 0.8)) think(); },
    look: function (dt, d) {                                           /* curioso: la testa scatta, il corpo no */
      if (!d.at || now > d.at) { d.at = now + rr(0.5, 1.2); d.tx = rnd() < 0.3 ? null : { x: cat.x + rr(-220, 220), y: cat.y - rr(-30, 160) }; }
      cat.att = d.tx; if (cat.st > d.dur) think();
    },
    walk: function (dt, d) {
      var p = cat.plat; if (!p) return think();
      var left = (d.tx - cat.x) * cat.dir, spd = (d.speed || 40) * (0.35 + 0.65 * smooth(0, 16, left));
      if (cat.st < 0.3) cat.att = { x: d.tx + cat.dir * 60, y: cat.y - 24 * px() };                     /* la testa parte per prima */
      rig.walkT = aligned(0.35) ? 1 : 0; rig.speedU = spd / px(); cat.coast = spd * cat.dir;
      cat.x += cat.dir * rig.walk * spd * dt;
      if (left <= 1 || cat.x < p.a - 2 || cat.x > p.b + 2) { cat.x = clamp(cat.x, p.a, p.b); rig.walkT = 0; var th = d.then;
        if (typeof th === "function") th(); else if (th === "sit") sitFor(rr(1.8, 3.6)); else if (th === "none") {} else set("pause", { pose: "stand", dur: rr(0.5, 1.1) }); }
    },
    crouch: function (dt, d) {                                         /* l'anticipo: si abbassa, il sedere ondeggia, poi parte */
      var dist = hyp(d.tx - cat.x, d.ty - cat.y), need = d.quick ? 0.12 : dist > 140 ? 0.42 : 0.26;
      if (dist > 140 && !d.quick) { rig.over.hy = rig.poses.crouch.hy + 0.9 * Math.sin(cat.st * 26) * seg(cat.st, 0.08, 0.2); rig.tailSwish = 0.4; rig.tailRate = 6; }
      cat.att = { x: d.tx, y: d.ty - 20 }; rig.pupilT = 1;
      if (cat.st > need && (aligned(0.6) || d.quick)) {
        set("air", arc(cat.x, cat.y, d.tx, d.ty, d.high, { q: d.q, then: d.then, face: "side", pose: "air", grow: d.grow }));
        cat.plat = null;
      }
    },
    air: function (dt, d) {                                            /* in volo: una parabola vera (gravità), l'apice appena sopra il bordo più alto */
      var u = sat(cat.st / d.dur), tt = u * d.dur; rig.grounded = false; rig.rate = 15;
      cat.x = lerp(d.x0, d.x1, u); cat.y = d.vy0 != null ? d.y0 + d.vy0 * tt + 0.5 * GRAV * tt * tt : lerp(d.y0, d.y1, u) - 4 * d.h * u * (1 - u);
      var below = platBelow(cat.x, cat.y); cat.gy = below ? below.y : null;
      var vx = (d.x1 - d.x0) / d.dur, vy = d.vy0 != null ? d.vy0 + GRAV * tt : ((d.y1 - d.y0) - 4 * d.h * (1 - 2 * u)) / d.dur;
      rig.pitchT = clamp(Math.atan2(-vy, Math.abs(vx) + 70), -0.75, 0.75) * 0.75;
      if (d.grow) cat.s = lerp(d.grow, 1, eOut(u));
      rig.pose = u < 0.1 ? "stretch" : u > 0.74 ? "stand" : (d.mid || "air");
      cat.att = { x: d.x1 + cat.dir * 40, y: d.y1 - 10 }; cat.gz = true;
      if (u >= 1) { cat.x = d.x1; landOn(d.q); set("land", { then: d.then, v: Math.abs(vy), face: "side", pose: "land" }); }
    },
    land: function (dt, d) {                                           /* schiaccia, rimbalza un filo, si assesta */
      var st = cat.st, hard = clamp(d.v / 900, 0.3, 1); rig.rate = 20;
      if (st < 0.1) { rig.pose = "land"; rig.over.sqy = 1 - 0.16 * hard; rig.over.sqx = 1 + 0.1 * hard; }
      else if (st < 0.2) { rig.pose = "crouch"; rig.over.sqy = 1 + 0.04 * hard; rig.over.sqx = 0.98; }
      else rig.pose = "stand";
      if (st < 0.02 && !d.kick) { d.kick = 1; life.fezRollV += 2.6 * hard * cat.dir; }
      if (st > 0.36) { var th = d.then; if (typeof th === "function") th(); else if (th === "shake") set("shake", { face: "side", pose: "stand" }); else if (th === "none") {} else sitFor(rr(1.6, 3.2)); }
    },
    shake: function (dt, d) {                                          /* si scrolla: la testa vibra, il fez ondeggia, poi torna composto */
      var st = cat.st, e = sat(1 - st / 0.75); rig.headRoll = 0.42 * Math.sin(st * 30) * e * seg(st, 0, 0.06); rig.over.ear = 0.3 * e; rig.over.eye = 0.4 + 0.6 * (1 - e);
      if (st < 0.05) life.fezRollV += 1.5; if (st > 0.85) { rig.headRoll = 0; sitFor(rr(1.5, 2.5), d.annoyed ? { pose: "annoyed" } : null); }
    },
    hop: function (dt, d) {                                            /* il saltello felice */
      var st = cat.st, u = seg(st, 0.14, 0.54); cat.ownLift = true;
      if (st < 0.14) { rig.pose = "crouch"; cat.lift = 0; }
      else if (u < 1) { rig.pose = u < 0.75 ? "air" : "stand"; rig.grounded = false; cat.lift = 4 * 22 * u * (1 - u); rig.pitchT = 0.25 * (1 - 2 * u); }
      else { cat.lift = 0; rig.pitchT = 0; rig.pose = st < 0.66 ? "land" : "sit"; if (st < 0.56) life.fezRollV += 0.4 * cat.dir; }
      if (st > 0.6) rig.over.eye = st < 1.3 ? 0 : 1;
      if (st > 1.5) sitFor(rr(1.6, 2.6));
    },
    loaf: function (dt, d) { if (cat.st > d.dur) think(); },
    sleep: function (dt, d) {
      if (cat.st > 1.1) { rig.pose = "sleep"; life.fezRollT = 0.32; rig.tailRate = -1.1; }
      if (cat.st > d.dur) { life.fezRollT = 0; set("wakeup", { face: "view", pose: "loaf" }); }
    },
    wakeup: function (dt) {                                            /* occhi lenti, stiracchiata, sbadiglio */
      var st = cat.st;
      if (st < 0.7) { rig.over.eye = 0.7 * seg(st, 0.1, 0.6); rig.over.lid = 0.45; }
      else if (st < 2.1) { cat.face = "side"; rig.pose = "stretch"; rig.over.eye = 0.15; }
      else if (st < 3.3) { cat.face = "view"; rig.pose = "yawn"; rig.over.mouth = bell(seg(st, 2.2, 3.2)) * 1.05; rig.over.eye = 0; }
      else sitFor(rr(2, 3));
    },
    groom: function (dt, d) {
      var st = cat.st, w = Math.sin(st * 8.5); rig.over.f0y = rig.poses.groom.f0y + 1.3 * w; rig.over.hp = rig.poses.groom.hp + 0.1 * Math.sin(st * 8.5 + 1.1); rig.over.eye = 0.12;
      if (st > d.dur) { rig.over = {}; sitFor(rr(1.4, 2.4)); }
    },
    yawn: function (dt, d) {
      var st = cat.st; rig.pose = st < 1.5 ? "yawn" : "sit"; if (st < 1.5) { rig.over.mouth = bell(seg(st, 0.15, 1.4)) * 1.08; rig.over.eye = st < 0.25 ? 0.6 : 0; }
      if (st > 1.5 && st < 2.2) rig.headRoll = 0.12 * Math.sin((st - 1.5) * 24) * (1 - seg(st, 1.5, 2.2));
      if (st > 2.3) { rig.headRoll = 0; sitFor(rr(1.6, 3)); }
    },
    stretch: function (dt) { var st = cat.st; rig.pose = st < 0.25 ? "stand" : st < 1.7 ? "stretch" : "stand"; if (st > 0.3 && st < 1.6) rig.over.eye = 0.12; if (st > 2) sitFor(rr(1.8, 3)); },
    drape: function (dt, d) {                                          /* sdraiato a cavallo del bordo: una zampa e la coda giù */
      var st = cat.st; rig.grounded = st < 0.5; rig.pose = st < 0.5 ? "loaf" : st < d.dur ? "drape" : "stand"; rig.tailSwish = 0.12; rig.tailRate = -0.6;
      if (st > 0.5 && st < d.dur && !d.glAt) d.glAt = now + rr(1.5, 3);
      if (d.glAt && now > d.glAt) { d.glAt = now + rr(2, 4); cat.att = rnd() < 0.5 ? null : { x: cat.x - cat.dir * 200, y: cat.y + 120 }; }
      if (st > d.dur + 0.5) sitFor(rr(1.5, 2.5));
    },
    dive: function (dt, d) {                                           /* si nasconde dietro il bordo, poi spunta */
      var st = cat.st, p = cat.plat; if (!p) return think();
      if (!d.e) d.e = cat.y;
      if (st > 0.3) { cat.clipAt = d.e; var u = seg(st, 0.3, 0.62); cat.y = d.e + eIn(u) * 46 * px(); rig.pose = "sit"; }
      if (st > 0.62 + (d.wait || 1.3)) { cat.y = d.e; cat.x = clamp(cat.x + rr(-50, 50), p.a + 6, p.b - 6); set("peek", { p: p, x: cat.x }); }
    },
    peek: function (dt, d) {                                           /* spunta dal bordo: orecchie, occhi, due zampe; si guarda attorno; sale */
      var st = cat.st, p = d.p, k = px(); cat.plat = p; cat.x = d.x; cat.gy = null; cat.clipAt = p.y; rig.grounded = false;
      if (!d.dir) d.dir = room(p, d.x, 1) > room(p, d.x, -1) ? 1 : -1;
      if (!d.init) { d.init = 1; cat.face = "front"; rig.yawT = Y.front; rig.pose = "peek"; rig.over = {}; rig.snap("peek"); cat.voff = 0; cat.rot = 0; }
      var tUp = 0.55, tHold = d.first ? 2.0 : 1.7;
      if (st < tUp) { cat.face = "front"; rig.pose = "peek"; cat.y = p.y + (1 - eBack(seg(st, 0, tUp), 1.3)) * 28 * k; cat.paws = st > 0.3; rig.over.ear = 0.25 * (1 - seg(st, 0.2, 0.55)); }
      else if (st < tUp + tHold) { cat.y = p.y; cat.paws = true; var lt = st - tUp; cat.att = lt < 0.5 ? null : lt < 1.0 ? { x: cat.x - 240, y: cat.y - 30 } : lt < 1.45 ? { x: cat.x + 240, y: cat.y - 40 } : null; rig.pupilT = 1; }
      else if (st < tUp + tHold + 0.5) { var u = seg(st, tUp + tHold, tUp + tHold + 0.5); cat.dir = d.dir; cat.face = "side"; rig.pose = u < 0.4 ? "crouch" : "stand"; rig.rate = 16; cat.paws = u < 0.15; cat.y = p.y; cat.ownLift = true; cat.lift = bell(u) * 5 * k;
        if (u > 0.85) cat.clipAt = null; }
      else { cat.lift = 0; landOn(p); set("land", { then: d.first ? function () { sitFor(4.6, { face: "view" }); say("salam, sono Dot.", 4); } : "sit", v: 300, face: "side", pose: "land" }); }
    }
  };
  /* ------------------------------------------------------------------ al tocco */
  var CALM = { sit: 1, pause: 1, look: 1, walk: 1, loaf: 1, groom: 1, yawn: 1, stretch: 1, think: 1, land: 1, shake: 1, tea: 1, star: 1, cube: 1, yarn: 1, laptop: 1, purr: 1, meow: 1, hop: 1 };
  var ASLEEP = { sleep: 1, drape: 1 };
  function tap() {
    lastIn = now; cat.taps.push(now); while (cat.taps.length && cat.taps[0] < now - 6) cat.taps.shift();
    if (reduced) { say("miao", 1.2, "mini"); sound("meow"); return; }
    var s = cat.state;
    if (s === "boxed" || s === "box") return boxOut();
    if (ASLEEP[s] || (s === "loaf" && cat.st > 3)) return set("annoyed", { face: "view", pose: s === "drape" ? "drape" : "loaf", from: s });
    if (s === "sulk" || s === "annoyed") { rig.tailSwish = 0.8; life.earFlick = 1; say("mrr", 0.9, "mini"); return; }
    if (!CALM[s] || !cat.plat) return;
    if (cat.taps.length >= 4 && s !== "hide") { cat.taps = []; return fedUp(); }
    clearHeld();
    var w = { meow: 0.34, fez: rig.fezOn && cat.plat.b - cat.plat.a > 70 ? 0.26 : 0, hop: 0.2, purr: 0.2 }, k = wpick(w, cat.lastTap); cat.lastTap = k;
    if (k === "meow") set("meow", { face: "view", pose: "sit" });
    else if (k === "fez") set("fezoff", { face: "view", pose: "sit" });
    else if (k === "hop") set("hop", { face: "view", pose: "crouch" });
    else set("purr", { face: "view", pose: "sit", dur: rr(2.2, 3) });
  }
  function fedUp() {                                                   /* troppi tocchi: se ne va nella scatola (o su un altro riquadro) */
    if (stageOn && boxVisible()) return goBox();
    var o = jumpTargets(cat.plat, 520); if (!o.length) return set("annoyed", { face: "view", pose: "sit", from: "sit" });
    o.sort(function (a, b) { return Math.abs(b.x - cat.x) - Math.abs(a.x - cat.x); }); jumpTo(o[0].p, o[0].x, function () { set("sulk", { face: "back", pose: "annoyed", dur: rr(6, 8) }); });
  }

  Object.assign(STATES, {
    meow: function (dt, d) {                                           /* miagola: la bocca si apre davvero, il muso sale */
      var st = cat.st, m = bell(seg(st, 0.08, 0.62)); rig.over.mouth = m * 0.95; rig.over.hp = 0.26 * bell(seg(st, 0.02, 0.85)) - 0.08 * bell(seg(st, 0, 0.12)); rig.over.ear = 0.22 * m; rig.over.eye = 1 - 0.35 * m; rig.over.sqy = 1 + 0.035 * m; rig.over.dy = rig.poses.sit.dy + 0.8 * m;
      if (st > 0.1 && !d.said) { d.said = 1; say(pick(["miao", "miao", "mrr"]), 1.1, "mini"); sound("meow"); }
      if (st > 1.0) sitFor(rr(1.5, 2.6));
    },
    purr: function (dt, d) {                                           /* fusa: occhi chiusi, testa inclinata, un tremito lieve */
      var st = cat.st, e = seg(st, 0, 0.3) * (1 - seg(st, d.dur - 0.3, d.dur)); rig.over.eye = st < d.dur - 0.2 ? 0 : 0.7; rig.over.hr = 0.16 * e; rig.over.br = 1.4; rig.over.ear = -0.05;
      cat.jit = 0.22 * e; if (st > 0.4 && !d.said) { d.said = 1; say("prr", 1.2, "mini"); sound("purr"); }
      if (st > d.dur) { cat.jit = 0; life.slow = now; sitFor(rr(1.8, 2.8)); }
    },
    fezoff: function (dt, d) {                                         /* il fez cade: salta via, rotola; Dot lo guarda, va a prenderlo, se lo rimette */
      var st = cat.st, p = cat.plat; if (!p) return think();
      if (!d.ph) {
        d.ph = 1; var f = lastF, side = room(p, cat.x, 1) > room(p, cat.x, -1) ? 1 : -1, k = px();
        var c = f && f.fez ? { x: (f.fez.x + f.fez.tx) / 2, y: (f.fez.y + f.fez.ty) / 2 } : { x: 0, y: 38 }, pg = toPage(c.x, c.y);
        rig.fezOn = false; makeFez(pg.x, pg.y, side * rr(60, 95), -rr(300, 360), -side * rr(6, 9)); d.side = side; life.fezRollV = 0;
        rig.over.hp = -0.16; rig.over.ear = 0.45;
      }
      if (d.ph === 1) {                                                /* sobbalza e lo segue con gli occhi */
        if (st > 0.08) { rig.over.hp = 0; rig.over.eye = 1.25; rig.pupilT = 0.55; }
        if (st > 0.4) { rig.over.eye = 1.05; rig.over.ear = 0.1; }
        cat.att = fez ? { x: fez.b.x, y: fez.b.y } : null;
        if (fez && (fez.b.still > 0.35 || st > 2.6)) { d.ph = 2; d.t = st; }
      } else if (d.ph === 2) {                                         /* ci va */
        if (!fez) return think();
        var gx = clamp(fez.b.x - d.side * 15 * px(), p.a, p.b);
        if (Math.abs(gx - cat.x) < 6) { cat.dir = d.side; d.ph = 3; d.t = st; }
        else walkTo(gx, function () { cat.dir = fez && fez.b.x > cat.x ? 1 : -1; set("fezoff", { ph: 3, t: 0, side: cat.dir, face: "side", pose: "b-sniff" }); }, { speed: 46 });
      } else if (d.ph === 3) {                                         /* lo annusa, poi un colpo di testa e il fez torna su */
        cat.face = "side"; rig.pose = st - d.t < 0.55 ? "b-sniff" : "stand"; if (!fez) { d.ph = 5; d.t = st; return; }
        cat.att = { x: fez.b.x, y: fez.b.y };
        if (st - d.t > 0.55 && !d.fly) { d.fly = { x0: fez.b.x, y0: fez.b.y, a0: fez.b.ang, t0: st }; rig.over.hp = 0.32; }
        if (d.fly) {
          var u = seg(st, d.fly.t0, d.fly.t0 + 0.34), tgt = fezHome(); fez.b.x = lerp(d.fly.x0, tgt.x, eIO(u)); fez.b.y = lerp(d.fly.y0, tgt.y, eIO(u)) - bell(u) * 30; fez.b.ang = lerp(d.fly.a0, 0, eIO(u)) + bell(u) * 2.2 * d.side; fez.b.vx = fez.b.vy = 0; fez.hold = true;
          if (u >= 1) { killFez(); rig.fezOn = true; life.fezRollV = -3.4 * d.side; rig.over.hp = 0.06; d.ph = 4; d.t = st; }
        }
      } else if (d.ph === 4) { cat.face = "view"; rig.pose = "sit"; rig.over.hp = 0.14; rig.over.lid = 0.3; if (st - d.t > 1.3) sitFor(rr(1.5, 2.5)); }
      else think();
    },
    annoyed: function (dt, d) {                                        /* svegliato: orecchie basse, sguardo storto, la coda batte; si alza e gli dà le spalle */
      var st = cat.st; rig.over.ear = 0.9; rig.over.brow = 0.9; rig.over.lid = 0.55; rig.over.eye = st < 0.12 ? 0.5 : 0.8; rig.tailSwish = 0.55; rig.tailRate = 6.5;
      if (st < 0.1) life.fezRollT = 0;
      if (st > 0.15) cat.gz = true;
      if (st > 1.1 && st < 1.7) { rig.pose = "stand"; cat.face = "back"; rig.over.ear = 0.7; }
      if (st > 1.7) {
        var o = jumpTargets(cat.plat, 420);
        if (o.length) { o.sort(function (a, b) { return Math.abs(b.x - cat.x) - Math.abs(a.x - cat.x); }); var j = o[0];
          walkTo(clamp(cat.x + (j.x > cat.x ? 30 : -30), cat.plat.a, cat.plat.b), function () { jumpTo(j.p, j.x, function () { set("sulk", { face: "back", pose: "annoyed", dur: rr(6, 8) }); }); }, { speed: 52 }); }
        else { var p = cat.plat, tx = room(p, cat.x, 1) > room(p, cat.x, -1) ? p.b - 4 : p.a + 4; walkTo(tx, function () { set("sulk", { face: "back", pose: "annoyed", dur: rr(6, 8) }); }, { speed: 52 }); }
        rig.over.ear = 0.6; rig.over.brow = 0.6;
      }
    },
    sulk: function (dt, d) {                                           /* seduto di spalle; poi si volta a guardare e perdona */
      var st = cat.st; rig.tailSwish = 0.35; rig.tailRate = 3; rig.over.ear = 0.45 * (1 - seg(st, d.dur * 0.5, d.dur * 0.7));
      cat.gz = false; rig.look.ty = 0; rig.look.tp = 0.02;
      if (st > d.dur * 0.55 && st < d.dur * 0.8) { var u = seg(st, d.dur * 0.55, d.dur * 0.62); rig.look.ty = wrap(-PI / 2 - rig.yaw) * 0.9 * u; rig.look.ty = clamp(rig.look.ty, -1.15, 1.15); rig.gazeT[0].x = rig.gazeT[1].x = cat.dir > 0 ? -0.9 : 0.9; rig.over.lid = 0.4; }
      if (st > d.dur * 0.8) { cat.face = "view"; rig.pose = "sit"; cat.gz = true; if (!d.f) { d.f = 1; life.slow = now + 0.5; } }
      if (st > d.dur + 1.4) sitFor(rr(1.5, 2.5));
    }
  });

  /* ------------------------------------------------------------------ preso, lasciato, lanciato */
  var pend = { a: 0, w: 0, px: 0, pvx: 0 };
  function pickUp() {
    clearHeld(); var up = cat.state === "slide" || cat.state === "hang" ? 15 : 30;   /* la collottola sta 30 unità sopra i piedi, 15 sopra il centro del corpo */
    set("held", { face: "view", pose: "held" }); cat.plat = null; cat.gy = null; pend.a = 0; pend.w = 0; pend.pvx = 0; pend.px = cat.x;
    reanchor(-up); rig.rate = 14; lastIn = now;
  }
  Object.assign(STATES, {
    held: function (dt, d) {                                           /* per la collottola: gatto lungo, corpo a pendolo, sguardo seccato */
      var h = drag ? drag : fake, tx = h ? h.x : cat.x, ty = h ? h.y : cat.y, k = 1 - Math.exp(-dt * 24), ox = cat.x;
      cat.x = lerp(cat.x, tx, k); cat.y = lerp(cat.y, ty, k); rig.grounded = false;
      var vx = (cat.x - ox) / Math.max(dt, 1e-3), ax = (vx - pend.pvx) / Math.max(dt, 1e-3); pend.pvx = vx;
      pend.w += (-22 * Math.sin(pend.a) - 2.6 * pend.w - clamp(ax, -9000, 9000) / 520 * Math.cos(pend.a)) * dt; pend.a = clamp(pend.a + pend.w * dt, -1.1, 1.1);
      cat.rot = -pend.a; cat.piv = 0; cat.ownRot = true;
      var sp = Math.abs(vx); rig.longT = clamp(3 + cat.st * 4 + sp / 140, 0, 11);
      rig.over.lid = 0.42; rig.over.eye = 0.9; rig.over.ear = 0.18 + 0.25 * sat(sp / 900); rig.tailSwish = 0.25; rig.tailRate = 2;
      cat.att = null; cat.gz = true;
    },
    fall: function (dt, d) {                                           /* cade dritto fino al bordo di sotto */
      d.vy = (d.vy || 0) + 2300 * dt; var y0 = cat.y; cat.y += d.vy * dt; cat.x += (d.vx || 0) * dt; d.vx = (d.vx || 0) * Math.exp(-dt * 3);
      rig.grounded = false; rig.pose = cat.st < 0.12 ? "air" : "stand"; rig.rate = 16; rig.pitchT = 0;
      var p = d.p && cat.x >= d.p.a - 10 && cat.x <= d.p.b + 10 ? d.p : platBelow(cat.x, y0 - 2);
      cat.gy = p ? p.y : null;
      if (p && cat.y >= p.y) { cat.x = clamp(cat.x, p.a, p.b); landOn(p); set("land", { then: d.vy > 700 ? "shake" : "sit", v: d.vy, face: cat.face === "front" ? "view" : cat.face, pose: "land" }); return; }
      if (cat.y > view.sy + view.vh + 160 || cat.y > doc.documentElement.scrollHeight + 100) comeBack();
    },
    fly: function (dt, d) {                                            /* lanciato: vola lungo il lancio, poi atterra e magari ruzzola */
      var y0 = cat.y; d.vy += 2000 * dt; cat.x += d.vx * dt; cat.y += d.vy * dt; rig.grounded = false; rig.rate = 16;
      if (cat.x < view.sx + 14 || cat.x > view.sx + view.vw - 14) { cat.x = clamp(cat.x, view.sx + 14, view.sx + view.vw - 14); d.vx = -d.vx * 0.35; }
      cat.dir = d.vx >= 0 ? 1 : -1; cat.face = "side"; rig.pose = d.vy < 0 ? "air" : cat.st > 0.15 ? "stand" : "air";
      rig.pitchT = clamp(Math.atan2(-d.vy, Math.abs(d.vx) + 80), -0.8, 0.8) * 0.7;
      var p = null, i, q; for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (d.vy > 0 && y0 <= q.y && cat.y >= q.y && cat.x >= q.a - 10 && cat.x <= q.b + 10) { p = q; break; } }
      var b = platBelow(cat.x, cat.y); cat.gy = b ? b.y : null;
      if (p) { cat.x = clamp(cat.x, p.a, p.b); landOn(p); if (Math.abs(d.vx) > 360) set("tumble", { vx: d.vx * 0.5, face: "side", pose: "loaf" }); else set("land", { then: "shake", v: d.vy, face: "side", pose: "land" }); return; }
      if (cat.y > view.sy + view.vh + 160) comeBack();
    },
    tumble: function (dt, d) {                                         /* ruzzola: un giro su sé stesso mentre striscia, poi si rimette in piedi */
      var st = cat.st, u = seg(st, 0, 0.5), p = cat.plat; cat.ownRot = true; cat.piv = 11; cat.rot = -cat.dir * TAU * eOut(u);
      cat.x = clamp(cat.x + d.vx * dt, p.a, p.b); d.vx *= Math.exp(-dt * 5); rig.pose = u < 0.85 ? "loaf" : "stand"; rig.over.eye = u < 1 ? 0.3 : 1;
      if (st > 0.62) { cat.rot = 0; set("shake", { face: "side", pose: "stand", annoyed: true }); }
    },
    slide: function (dt, d) {                                          /* lasciato sulla faccia di un riquadro: unghie fuori, scivola e graffia */
      var t = d.t, st = cat.st, k = px(); rig.grounded = false; rig.pitchT = PI / 2; cat.face = "front"; rig.pose = "b-slide"; rig.rate = 16;
      if (!d.sc) d.sc = fx().Scratch(layer, { x: t.l, y: t.t, w: t.r - t.l, h: t.b - t.t }, dark), scratches.push(d.sc);
      d.vy = st < 0.16 ? 8 : Math.min((d.vy || 30) + 300 * dt, 118); cat.y += d.vy * dt;
      cat.x = clamp(cat.x, t.l + 16 * k, t.r - 16 * k);
      cat.ownRot = true; cat.piv = 0; cat.rot = 0.05 * Math.sin(st * 9) * seg(st, 0.1, 0.3);
      rig.gazeT[0].x = -0.6 + 0.2 * Math.sin(st * 7); rig.gazeT[0].y = 0.45; rig.gazeT[1].x = 0.5; rig.gazeT[1].y = -0.35 + 0.2 * Math.sin(st * 5); rig.pupilT = 0.3; cat.gz = false; rig.look.ty = 0; rig.look.tp = 0;
      if (lastF && st > 0.05) { var i, l, pg; for (i = 0; i < 4; i++) { l = lastF.legs[i]; pg = toPage(l.fx, l.fy + l.paw * 0.4); if (pg.y < t.b - 3 && pg.y > t.t + 3) d.sc.add(i, pg.x, pg.y, k); } }
      var top = cat.y - SLIDE_TOP * k;
      if (top >= t.b - 6) {
        d.sc.done(); d.sc = null;
        var below = platBelow(cat.x, t.b + 2), gap = below ? below.y - t.b : 1e9;
        if (gap > 54 && !tileAt(cat.x, t.b + 24)) set("hang", { t: t, edgeY: t.b, w: (d.vy / 300), face: "front", pose: "b-hang" });
        else { reanchor(13.5); if (fallBlocked(cat.x, cat.y)) escapeJump(30); else set("fall", { vy: d.vy, face: "view", pose: "air" }); }
      }
    },
    hang: function (dt, d) {                                           /* appeso al bordo di sotto con le zampe davanti: dondola, scalcia, molla */
      var st = cat.st, k = px(); rig.grounded = false; rig.pitchT = PI / 2; cat.face = "front"; rig.pose = "b-hang"; rig.rate = 13;
      if (d.a == null) { d.a = clamp((d.w || 0) * 0.5 + (d.vx || 0) / 900, -0.6, 0.6) || 0.22; d.av = 0; d.dur = d.dur || rr(2, 2.8); }
      var ty = d.edgeY + HANG_TOP * k; cat.y = lerp(cat.y, ty, 1 - Math.exp(-dt * 30));
      d.av += (-15 * Math.sin(d.a) - 1.0 * d.av) * dt; d.a += d.av * dt;
      if (st > 0.9 && st < 1.5) { var kk = Math.sin((st - 0.9) * 22); rig.over.f2x = HANG.f2x + 3.2 * Math.max(0, kk); rig.over.f3x = HANG.f3x + 3.2 * Math.max(0, -kk); d.av += 0.5 * kk * dt * 8; }
      cat.ownRot = true; cat.piv = HANG_TOP; cat.rot = d.a;
      cat.gz = false; rig.look.ty = 0.18 * Math.sin(st * 1.3); rig.look.tp = 0; rig.gazeT[0].x = rig.gazeT[1].x = 0.1 * Math.sin(st * 2); rig.gazeT[0].y = rig.gazeT[1].y = st < 0.8 ? -0.75 : st < 1.6 ? 0.1 : -0.8; rig.pupilT = 0.6;
      rig.over.eye = st > 1.6 ? 1.25 : 1.05; rig.tailSwish = 0.3;
      if (st > d.dur) { cat.rot = 0; reanchor(13.5); if (fallBlocked(cat.x, cat.y)) escapeJump(40); else set("fall", { vy: 40, face: "view", pose: "air" }); }
    }
  });
  /* dove lasciarlo: sul bordo, nella scatola, sulla faccia di un riquadro, appeso sotto, oppure giù */
  function release(vx, vy) {
    var sp = hyp(vx, vy), k = px(); lastIn = now;
    var bodyY = cat.y + 16 * k;
    if (stageOn && stage.hit && stage.hit(cat.x, bodyY)) return boxIn(true);
    if (sp > 650) { reanchor(28.5); var f = Math.min(1, 1500 / sp); set("fly", { vx: vx * f, vy: vy * f, face: "side", pose: "air" }); return; }
    var i, p, best = null, t;
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode === "no") continue; if (cat.x > t.l + 24 && cat.x < t.r - 24 && cat.y > t.b - 24 && cat.y < t.b + 22 && !tileAt(cat.x, t.b + 30)) { reanchor(15); set("hang", { t: t, edgeY: t.b, vx: vx, face: "front", pose: "b-hang" }); return; } }
    for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (cat.x >= p.a - 14 && cat.x <= p.b + 14 && bodyY + 14 * k >= p.y - 30 && bodyY + 14 * k <= p.y + 26) { if (!best || Math.abs(p.y - bodyY) < Math.abs(best.y - bodyY)) best = p; } }
    if (best) { reanchor(28.5); cat.x = clamp(cat.x, best.a, best.b); set("fall", { p: best, vy: 0, vx: vx * 0.2, face: "view", pose: "air" }); return; }
    t = tileAt(cat.x, bodyY);
    if (t && t.mode !== "no" && bodyY < t.b - 40 * k) { reanchor(15); set("slide", { t: t, vy: Math.max(0, vy * 0.15), face: "front", pose: "b-slide" }); return; }
    reanchor(28.5); if (fallBlocked(cat.x, cat.y)) return escapeJump(30); set("fall", { vy: Math.max(0, vy * 0.3), vx: vx * 0.3, face: "view", pose: "air" });
  }
  /* ------------------------------------------------------------------ il fez libero */
  function makeFez(x, y, vx, vy, va) {
    killFez(); var k = K, F = rig.P.fez, rB = F.rBase * k, rT = F.rTop * k, h = F.h * k, side = PI / 2 - Math.atan2(F.rBase - F.rTop, F.h);
    var b = fx().Body({ x: x, y: y, vx: vx, vy: vy, va: va, shape: [[-rB, -h / 2], [rB, -h / 2], [rT, h / 2], [-rT, h / 2]], rest: [0, side, -side, PI], g: 1500 });
    fez = { b: b, sp: fx().Sprite(layer, 64, 64, 32, 32, 2), tas: 0, tasW: 0, pvx: 0, hold: false };
  }
  function killFez() { if (fez) { fez.sp.remove(); fez = null; } }
  function fezHome() {                                                 /* dove sta il centro del fez quando è in testa (pagina) */
    var f = lastF, F = rig.P.fez; if (!f) return { x: cat.x, y: cat.y - 40 * px() };
    var h = f.head, ux = h.u[0], uy = h.u[1], bx = h.x + ux * F.up + h.f[0] * F.fwd, by = h.y + uy * F.up + h.f[1] * F.fwd;
    return toPage(bx + ux * F.h / 2, by + uy * F.h / 2);
  }
  function stepFez(dt) {
    if (!fez) return; var b = fez.b;
    if (!fez.hold) b.step(dt, objFloor);
    var ax = (b.vx - fez.pvx) / Math.max(dt, 1e-3); fez.pvx = b.vx;
    fez.tasW += (-70 * Math.sin(fez.tas) - 3.2 * fez.tasW - clamp(ax, -6000, 6000) / 380 * Math.cos(fez.tas)) * dt; fez.tas = clamp(fez.tas + fez.tasW * dt, -1.4, 1.4);
    if (b.y > view.sy + view.vh + 300) { killFez(); if (!rig.fezOn) rig.fezOn = true; }
  }
  function drawFez() {
    if (!fez) return; var sp = fez.sp, b = fez.b, F = rig.P.fez; sp.place(b.x, b.y); sp.clear();
    if (b.y < view.sy - 80 || b.y > view.sy + view.vh + 80) return;
    var c = sp.model(K); c.rotate(b.ang); c.translate(0, -F.h / 2);
    var dr = (look && look.drawFez) || DOT.looks.base.drawFez; try { dr(c, { rBase: F.rBase, rTop: F.rTop, h: F.h, ell: 0.22, top: true, tasselAng: fez.tas - b.ang }, envFor(K)); } catch (e) {}
  }
  /* il pavimento per gli oggetti: il bordo alto di un riquadro (non il Corano), fino agli angoli */
  function objFloor(x, y) { var i, t, m = Infinity; for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode === "no") continue; if (x >= t.l + 8 && x <= t.r - 8 && t.t >= y - 4 && t.t < m) m = t.t; } return m; }

  /* ------------------------------------------------------------------ gli oggetti di Dot: uno alla volta */
  var PROPS = { tea: { w: 2.9, h: 6.4 }, cube: { w: 3.6, h: 8.4 }, yarn: { r: 3.4 }, star: { r: 0 }, laptop: { w: 7.2, h: 9.6 } };
  function newProp(name, x, y, o) {
    var pr = { name: name, x: x, y: y, sc: 0, scV: 0, scT: 1, held: false, front: null, t: 0, open: 1, alpha: 1, dead: false, b: null, trail: [], steam: 0, age: 0 };
    var big = name === "yarn" ? 170 : 96; pr.sp = fx().Sprite(layer, big, 96, big / 2, 60, 1);
    if (o && o.body) {
      var S = PROPS[name], k = K;
      if (name === "yarn") pr.b = fx().Body({ x: x, y: y - S.r * k, vx: o.vx || 0, vy: o.vy || 0, r: S.r * k, shape: [], g: 1500 });
      else pr.b = fx().Body({ x: x, y: y - S.h * k / 2, vx: o.vx || 0, vy: o.vy || 0, shape: [[-S.w * k, -S.h * k / 2], [S.w * k, -S.h * k / 2], [S.w * k, S.h * k / 2], [-S.w * k, S.h * k / 2]], rest: [0, PI / 2, PI, -PI / 2], g: 1500 });
    }
    props.push(pr); life.propAt = now + rr(22, 40); return pr;
  }
  function dropProp(pr) { pr.held = false; pr.front = null; var p = cat.plat; if (p) { pr.x = clamp(cat.x + cat.dir * 15 * px(), p.tile.l + 10, p.tile.r - 10); pr.y = p.y; } }
  function goneProp(pr) { pr.scT = 0; pr.leaving = true; }
  function stepProps(dt) {
    var i, pr; for (i = props.length - 1; i >= 0; i--) {
      pr = props[i]; pr.t += dt; pr.age += dt;
      pr.scV += (-(pr.sc - pr.scT) * 260 - pr.scV * 15) * dt; pr.sc += pr.scV * dt; if (pr.sc < 0) pr.sc = 0;
      if (pr.b && !pr.held && !pr.pin) { pr.b.step(dt, objFloor); pr.x = pr.b.x; pr.y = pr.b.y + (pr.b.r ? pr.b.r : 0); if (pr.name === "yarn" && pr.b.ground) { var L = pr.trail; if (!L.length || Math.abs(L[L.length - 1].x - pr.x) > 2) L.push({ x: pr.x, y: pr.y }); if (L.length > 40) L.shift(); } }
      if (pr.free) pr.free(dt, pr);
      if (!pr.leaving && !pr.held && cat.state !== pr.name && pr.age > 3 && (pr.idle = (pr.idle || 0) + dt) > 9) goneProp(pr);
      if ((pr.leaving && pr.sc < 0.02) || pr.y > view.sy + view.vh + 400 || (pr.b && pr.b.out)) { pr.sp.remove(); props.splice(i, 1); }
    }
  }
  function drawProps() {
    var i, pr, c, dp = (look && look.drawProp) || DOT.looks.base.drawProp, S;
    for (i = 0; i < props.length; i++) {
      pr = props[i]; var sp = pr.sp; if (pr.held || pr.front) { sp.show(false); continue; } sp.show(true);
      var bx = pr.b && !pr.b.r ? pr.b.x : pr.x, by = pr.b && !pr.b.r ? pr.b.y : pr.y; sp.place(bx, by); sp.clear();
      if (by < view.sy - 120 || by > view.sy + view.vh + 120) continue;
      c = sp.model(K); S = PROPS[pr.name];
      if (pr.name === "yarn" && pr.trail.length > 1) { c.save(); c.strokeStyle = "rgba(233,227,214,.85)"; c.lineWidth = 0.42; c.beginPath(); var j, q; for (j = 0; j < pr.trail.length; j++) { q = pr.trail[j]; c[j ? "lineTo" : "moveTo"]((q.x - bx) / K, -(q.y - by) / K + 0.25); } c.stroke(); c.restore(); }
      c.scale(pr.sc, pr.sc);
      if (pr.b && !pr.b.r) { c.rotate(pr.b.ang); c.translate(0, -S.h / 2); } else if (pr.b && pr.b.r) c.rotate(pr.b.ang);
      try { dp(c, pr.name, { t: pr.t, open: pr.open }, envFor(K)); } catch (e) {}
      if (pr.steam > 0.02) steam(c, pr, 7);
    }
  }
  function steam(c, pr, top) {                                         /* un filo di vapore che sale e svanisce */
    c.save(); c.lineCap = "round"; c.lineWidth = 0.42; var j, i, t = pr.t;
    for (j = 0; j < 2; j++) { c.beginPath(); for (i = 0; i <= 10; i++) { var u = i / 10, y = top + u * 7.5, x = (j ? 0.8 : -0.6) + Math.sin(u * 5.5 + t * 2.6 + j * 2) * 0.9 * u; c[i ? "lineTo" : "moveTo"](x, y); }
      c.strokeStyle = dark ? "rgba(255,255,255," + (0.32 * pr.steam).toFixed(3) + ")" : "rgba(70,70,84," + (0.28 * pr.steam).toFixed(3) + ")"; c.stroke(); }
    c.restore();
  }
  function startProp() {
    if (!life.propList || life.propIx >= life.propList.length) { life.propList = ["tea", "star", "cube", "yarn", "laptop"]; for (var i = 4; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = life.propList[i]; life.propList[i] = life.propList[j]; life.propList[j] = tmp; } life.propIx = 0; }
    return beginProp(life.propList[life.propIx++]);
  }
  function knockAt(endX, sd) { walkTo(endX - sd * 4, function () { set("cube", { side: sd, knock: true, face: "side", pose: "sit" }); }); }
  function beginProp(name) {
    var p = cat.plat; if (!p) return think();
    var side = room(p, cat.x, 1) > room(p, cat.x, -1) ? 1 : -1;
    if (name === "cube" && rnd() < 0.5) {                               /* lo butterà giù: prima va vicino alla fine vera del riquadro (non verso la scatola o il Corano) */
      var ks = [1, -1], i; for (i = 0; i < 2; i++) { var sd = ks[i], endX = sd > 0 ? p.b : p.a, tEnd = sd > 0 ? p.tile.r : p.tile.l;
        if (Math.abs(endX - tEnd) < 46 && !fallBlocked(tEnd + sd * 6, p.y + 2)) return knockAt(endX, sd); }
    }
    set(name, { side: side, face: name === "laptop" || name === "tea" || name === "star" ? "view" : "side", pose: "sit" });
  }
  Object.assign(STATES, {
    tea: function (dt, d) {                                            /* il tè alla menta: lo prende con due zampe, sorseggia a occhi chiusi, lo posa */
      var st = cat.st, p = cat.plat, k = px(), pr = d.pr; if (!p) return think(); cat.dir = d.side;
      if (!pr) { pr = d.pr = newProp("tea", clamp(cat.x + d.side * 16 * k, p.tile.l + 10, p.tile.r - 10), p.y); pr.steam = 1; }
      var hold = lastF ? toPage(lastF.hold.x, lastF.hold.y) : { x: cat.x, y: cat.y - 12 * k };
      if (st < 0.9) { cat.att = { x: pr.x, y: pr.y - 8 }; rig.over.ear = -0.08; }
      else if (st < 1.25) { rig.pose = "hold"; var u = eIO(seg(st, 0.9, 1.25)); pr.tw = pr.tw || { x: pr.x, y: pr.y }; pr.x = lerp(pr.tw.x, hold.x, u); pr.y = lerp(pr.tw.y, hold.y + 1.2 * k, u) - bell(u) * 6; cat.att = { x: pr.x, y: pr.y - 6 }; }
      else if (st < 5.9) {
        pr.held = true; var sip = (st > 2.0 && st < 3.5) || (st > 4.2 && st < 5.3); rig.pose = sip ? "sip" : "hold"; pr.hOff = sip ? -2.2 : -3.2;
        if (sip) { rig.over.eye = 0; rig.over.lid = 0.2; } else { rig.over.eye = 1; cat.att = { x: hold.x, y: hold.y }; rig.over.lid = st > 3.5 ? 0.32 : 0.1; }
        pr.steam = 1 - 0.5 * seg(st, 2, 5.5);
      } else if (st < 6.3) { pr.held = false; rig.pose = "hold"; rig.over.eye = 1; rig.over.lid = 0.1; var gx = clamp(cat.x + d.side * 16 * k, p.tile.l + 10, p.tile.r - 10), v = eIO(seg(st, 5.9, 6.3)); if (!pr.tb) pr.tb = { x: hold.x, y: hold.y }; pr.x = lerp(pr.tb.x, gx, v); pr.y = lerp(pr.tb.y, p.y, v) - bell(v) * 4; }
      else { pr.y = p.y; rig.pose = "sit"; rig.over.lid = 0.3; rig.over.hp = 0.08; if (st > 7.6) { pr.idle = 0; sitFor(rr(1.5, 2.5)); } }
    },
    star: function (dt, d) {                                           /* la stella-punto: la segue con le pupille, la colpisce, a volte ci salta sopra */
      var st = cat.st, k = px(), pr = d.pr;
      if (!pr) { pr = d.pr = newProp("star", cat.x + d.side * 60, cat.y - 70 * k * 0.9); pr.vx = 0; pr.vy = 0; pr.nx = 0; pr.free = flit; pr.home = { x: cat.x, y: cat.y }; d.bats = 0; d.cd = 0; }
      pr.home.x = cat.x; pr.home.y = cat.y; cat.att = { x: pr.x, y: pr.y }; rig.pupilT = 1; rig.over.ear = -0.1;
      var dx = pr.x - cat.x, dy = cat.y - pr.y, near = Math.abs(dx) < 46 && dy > 18 && dy < 70;
      d.cd -= dt;
      if (near && d.cd <= 0 && st > 0.8 && st < 6) { d.batT = 0.34; d.cd = 1.1; d.bats++; cat.dir = dx > 0 ? 1 : -1; pr.vx += (dx > 0 ? 1 : -1) * 240; pr.vy -= 160; pr.nx = 0; life.earFlick = 1; }
      if (d.batT > 0) { d.batT -= dt; rig.pose = "bat"; cat.face = "view"; } else rig.pose = "sit";
      if (st > 4.6 && !d.decided) { d.decided = 1; if (d.bats && rnd() < 0.7 && cat.plat) { var tx = clamp(pr.x, cat.plat.a, cat.plat.b); pr.stay = 1.6; return set("pounce", { tx: tx, prey: pr, h: clamp(cat.y - pr.y - 10, 24, 70), then: function () { pr.flee = true; sitFor(2, { look: "up" }); } }); } }
      if (st > 6.5) { pr.flee = true; sitFor(rr(1.6, 2.4)); }
    },
    cube: function (dt, d) {                                           /* il cubo: lo gira con una zampa, testa inclinata; a volte lo butta giù e guarda */
      var st = cat.st, k = px(), p = cat.plat, pr = d.pr; if (!p) return think(); cat.dir = d.side; cat.face = "side";
      if (!pr) { pr = d.pr = newProp("cube", cat.x + d.side * 10.6 * k, p.y, { body: true }); d.n = 0; d.next = 1.0; d.turns = d.knock ? 1 : 2 + Math.floor(rnd() * 2); }
      cat.att = { x: pr.x, y: pr.y - 6 * k }; rig.over.hr = 0.2 * Math.sin(st * 0.9 + 1) * (d.n % 2 ? -1 : 1); rig.over.lid = 0.12;
      if (d.n < d.turns && st > d.next) { rig.pose = "b-paw"; if (st > d.next + 0.22 && !d.hit) { d.hit = 1; pr.b.va = -d.side * 7.4; pr.b.vx = d.side * 24; pr.b.vy = -70; } if (st > d.next + 0.5) { rig.pose = "sit"; d.n++; d.hit = 0; d.next = st + rr(0.9, 1.4); } }
      else if (d.n >= d.turns && d.knock && !d.pushed && st > d.next) { rig.pose = "b-push"; if (st > d.next + 0.24) { d.pushed = st; pr.b.vx = d.side * 235; pr.b.va = -d.side * 2; } }
      else if (d.pushed) { rig.pose = st - d.pushed < 0.4 ? "b-push" : "b-over"; rig.over.eye = 1.15; rig.over.hr = 0; cat.att = { x: pr.b.x, y: pr.b.y }; if (st - d.pushed > 2.4) sitFor(rr(1.6, 2.4)); }
      else if (d.n >= d.turns && st > d.next + 0.5) { cat.face = "view"; rig.pose = "sit"; rig.over.hr = 0.22; cat.att = null; if (st > d.next + 1.8) { pr.idle = 0; sitFor(rr(1.6, 2.6)); } }
    },
    yarn: function (dt, d) {                                           /* il gomitolo arriva rotolando: occhi grandi, sedere che ondeggia, balzo */
      var st = cat.st, k = px(), p = cat.plat, pr = d.pr; if (!p) return think(); cat.dir = d.side; cat.face = "side";
      if (!pr) { var sx = clamp(cat.x + d.side * 120, p.tile.l + 12, p.tile.r - 12); pr = d.pr = newProp("yarn", sx, p.y, { body: true, vx: -d.side * 70 }); pr.sc = 1; pr.scT = 1; }
      cat.att = { x: pr.x, y: pr.y - 3 * k }; rig.pupilT = 1; rig.over.ear = -0.15;
      if (st > 1.1 && !d.go) { d.go = 1; var tx = clamp(pr.x - d.side * 9 * k, p.a, p.b); return set("pounce", { tx: tx, prey: pr, h: 20, side: d.side, then: function () { if (rnd() < 0.4) set("tangle", { pr: pr, face: "view", pose: "sit" }); else { pr.b.vx = d.side * 190; sitFor(rr(1.4, 2.2)); } } }); }
    },
    tangle: function (dt, d) {                                         /* finisce aggrovigliato nel filo: si guarda, poi si scrolla */
      var st = cat.st; cat.tangle = 1 - seg(st, 2.6, 2.9); rig.over.hp = st < 2.4 ? -0.35 : 0; cat.att = st < 2.4 ? { x: cat.x + 20 * Math.sin(st * 2), y: cat.y } : null; rig.over.hr = 0.18 * Math.sin(st * 1.7);
      if (st > 2.4 && st < 3.2) rig.headRoll = 0.4 * Math.sin((st - 2.4) * 30) * (1 - seg(st, 2.4, 3.2));
      if (st > 3.3) { rig.headRoll = 0; cat.tangle = 0; if (d.pr && d.pr.b) d.pr.b.vx = cat.dir * 80; sitFor(rr(1.4, 2.2)); }
    },
    laptop: function (dt, d) {                                         /* il portatile: scrive veloce con due zampe, righe verdi, poi è fiero */
      var st = cat.st, pr = d.pr; cat.face = "view"; cat.dir = d.side;
      if (!pr) { pr = d.pr = newProp("laptop", cat.x, cat.y); pr.front = { x: 2.2 * d.side, y: 0 }; }
      if (st < 0.6) { rig.pose = "sit"; cat.att = { x: cat.x, y: cat.y }; }
      else if (st < 4.2) { rig.pose = "type"; var ph = st * 15; rig.over.f0y = 4.5 + Math.max(0, Math.sin(ph)) * 1.6; rig.over.f1y = 5.2 + Math.max(0, -Math.sin(ph * 1.13)) * 1.6; rig.over.hp = -0.2 + 0.03 * Math.sin(st * 3);
        rig.gazeT[0].x = rig.gazeT[1].x = 0.25 * Math.sin(st * 2.2); rig.gazeT[0].y = rig.gazeT[1].y = -0.7; cat.gz = false; rig.look.ty = wrap(-PI / 2 - rig.yaw) * 0.6; rig.look.tp = -0.15; pr.t += dt * 2; }
      else if (st < 5.6) { rig.pose = "sit"; rig.over.hp = 0.18; rig.over.eye = st < 5.2 ? 0 : 1; rig.over.lid = 0.2; }
      else { pr.open = Math.max(0, pr.open - dt * 3); if (pr.open <= 0 && !pr.leaving) goneProp(pr); if (st > 6.3) sitFor(rr(1.5, 2.4)); }
    },
    pounce: function (dt, d) {                                         /* accucciato, il sedere ondeggia, poi il balzo */
      var st = cat.st, p = cat.plat, k = px(); if (!p) return think(); cat.face = "side"; cat.dir = d.tx >= cat.x ? 1 : -1; if (d.side) cat.dir = d.side;
      rig.pose = "wiggle"; rig.pupilT = 1; rig.tailSwish = 0.5; rig.tailRate = 9; var w = seg(st, 0.25, 0.4);
      rig.over.hy = rig.poses.wiggle.hy + 1.1 * Math.sin(st * 24) * w; rig.yawT = yawFor("side", cat.dir) + 0.1 * Math.sin(st * 12) * w; cat.att = d.prey ? { x: d.prey.x, y: d.prey.y } : { x: d.tx, y: cat.y - 10 };
      if (st > (d.wait || 1.0)) { set("air", arc(cat.x, cat.y, d.tx, p.y, d.h || 24, { q: p, then: d.then, face: "side", pose: "air", mid: "b-pounce" })); cat.plat = null; }
    },
    pet: function (dt, d) {                                            /* il dito fermo sopra: si appoggia, fusa, occhi che si chiudono piano */
      var st = cat.st, h = lastF ? toPage(lastF.head.x, lastF.head.y) : { x: cat.x, y: cat.y - 30 }, dx = drag ? drag.x - h.x : 0;
      rig.over.hr = clamp(dx / 40, -1, 1) * 0.24 * seg(st, 0, 0.4); rig.over.hp = 0.1; rig.over.eye = 1 - seg(st, 0.3, 1.1); rig.over.ear = -0.1; rig.over.br = 1.4; cat.jit = 0.2 * seg(st, 0.4, 0.8);
      if (st > 0.7 && !d.said) { d.said = 1; say("prr", 1.6, "mini"); sound("purr"); }
      if (st > 3.4 && cat.plat) set("belly", { face: "side", pose: "b-knead" });
    },
    belly: function (dt, d) {                                          /* a pancia in su; il fez rotola via */
      var st = cat.st; rig.rollT = PI; rig.pose = "b-knead"; rig.over.eye = 0.25; rig.over.lid = 0.3; cat.jit = 0.15;
      rig.over.f0y = 6.5 + 1.2 * Math.sin(st * 7); rig.over.f1y = 5 + 1.2 * Math.sin(st * 7 + PI);
      if (st > 0.25 && rig.fezOn) { var hp = fezHome(); rig.fezOn = false; makeFez(hp.x, hp.y, cat.dir * 70, -180, cat.dir * 5); }
      if (!drag && st > 0.4) { cat.jit = 0; set("unroll", { face: "side", pose: "stand" }); }
    },
    brace: function (dt) { var st = cat.st; rig.over.ear = 0.75 * (1 - seg(st, 0.6, 1.1)); rig.over.eye = 1.2; rig.pupilT = 0.45; rig.tailSwish = 0.4; rig.over.sqy = 0.97; if (st > 1.2) sitFor(rr(1.5, 2.5)); },
    unroll: function (dt) { rig.rollT = 0; rig.pose = cat.st < 0.35 ? "loaf" : "sit"; if (cat.st > 0.8) { if (!rig.fezOn && fez) set("fezoff", { ph: 1, side: fez.b.x > cat.x ? 1 : -1, face: "view", pose: "sit" }); else sitFor(2); } }
  });
  function flit(dt, pr) {                                              /* la stella svolazza a scatti attorno a Dot */
    pr.nx -= dt; if (pr.nx <= 0) { pr.nx = rr(0.45, 1.1); pr.n = (pr.n || 0) + 1;
      if (pr.n % 3 === 2) { pr.tx = pr.home.x + (rnd() < 0.5 ? -1 : 1) * rr(16, 30); pr.ty = pr.home.y - rr(26, 40); }   /* ogni tanto scende a portata di zampa */
      else { pr.tx = pr.home.x + rr(-80, 80); pr.ty = pr.home.y - rr(45, 105); }
      if (pr.flee) { pr.tx = pr.x + rr(-60, 60); pr.ty = view.sy - 80; } }
    if (pr.stay > 0) { pr.stay -= dt; } else { var kk = pr.flee ? 10 : 30; pr.vx += ((pr.tx - pr.x) * kk - pr.vx * 6.5) * dt; pr.vy += ((pr.ty - pr.y) * kk - pr.vy * 6.5) * dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    if (pr.flee) { pr.scT = 0; pr.leaving = true; }
  }

  /* ------------------------------------------------------------------ la scatola: casa, nascondiglio, apertura */
  var TS0 = { fl: 0.7, fr: 0.98, ft: 1.52, fb: 1.76, fd: 0.42, drop: 2.3, box: 2.72, wob: 3.0, lid: 3.5, peek: 3.8, lookL: 4.35, lookR: 4.85, lookC: 5.3, crouch: 5.45, jump: 5.62, land: 6.12, bubble: 6.45, end: 6.9 };
  function TS() { return (stage && stage.TS) || TS0; }
  /* dove atterra uscendo dalla scatola: sul bordo di casa, dal lato con più spazio */
  function homeLanding(r) {
    var hy = B.home ? B.home.y : r.y + 30, i, p, best = null, bs = -1e9;
    for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (Math.abs(p.y - hy) > 4) continue;
      var s = p.a >= r.x ? 1 : p.b <= r.x ? -1 : 0; if (!s) continue; var x = clamp(r.x + s * (r.w / 2 + 26), p.a, p.b), sc = (p.b - p.a) - Math.abs(x - r.x) * 0.5; if (sc > bs) { bs = sc; best = { p: p, x: x, side: s }; } }
    if (best) return best; var q = platBelow(r.x, r.y - 4); return { p: q, x: q ? clamp(r.x + 50, q.a, q.b) : r.x + 50, side: 1 };
  }
  function boxVisible() { if (!stageOn) return false; var r = stage.rim(); return r && inView(r.y, 60, 20); }
  function goBox() {
    var r = stage.rim(), hl = homeLanding(r), p = hl.p; if (!p) return think();
    if (cat.plat && Math.abs(cat.plat.y - p.y) < 3) { var side = cat.x < r.x ? -1 : 1, i, q; for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (Math.abs(q.y - p.y) < 3 && (side < 0 ? q.b <= r.x : q.a >= r.x)) p = q; } }
    var gx = clamp(r.x + (p.a >= r.x ? 1 : -1) * (r.w / 2 + 20), p.a, p.b);
    if (p === cat.plat) walkTo(gx, function () { boxIn(false); }, { speed: 50 });
    else jumpTo(p, gx, function () { boxIn(false); });
  }
  function boxIn(closed) { cat.plat = null; set("boxjump", { closed: closed, x0: cat.x, y0: cat.y, face: closed ? "front" : "side", pose: closed ? "held" : "crouch" }); }
  function boxOut() { if (!stageOn) return think(); stage.lid(1); set("boxexit", { face: "front", pose: "peek" }); }
  /* la sequenza dentro la scatola (apertura e uscite): ts = tempo del copione */
  function boxSeq(ts, d) {
    var T = TS(), r = stage.rim(), kk, st;
    if (ts < T.lid + 0.12) { cat.vis = false; return; }
    cat.vis = true; cat.plat = null; cat.gy = null; rig.grounded = false;
    if (!d.side) { var lp = homeLanding(r); d.p = lp.p; d.side = lp.side; d.lx = lp.x; }
    if (ts < T.jump) {                                                 /* dentro: prima solo gli occhi nel buio, poi la testa sale, guarda a sinistra e a destra, si abbassa */
      cat.s = 0.78; cat.x = r.x; cat.face = "front"; rig.pose = "peek"; cat.clipAt = r.y; cat.voff = 0; kk = px();
      var band = r.back != null ? r.y - r.back : 12 * r.w / 42.6, eyeU = rig.poses.peek.cy + rig.poses.peek.dy + rig.P.eye.up, low = (eyeU * kk - band * 0.5) / kk;   /* all'inizio gli occhi stanno a metà della fessura buia */
      cat.clipTop = ts < T.peek + 0.05 ? r.y - band : null;
      var off = ts < T.peek ? low : lerp(low, 0, eBack(seg(ts, T.peek, T.peek + 0.42), 1.5));
      off += 6 * eIO(seg(ts, T.crouch - 0.1, T.jump));
      cat.y = r.y + off * kk; cat.paws = ts > T.peek + 0.22 && ts < T.crouch;
      var b1 = T.lid + 0.5, b2 = T.lid + 0.95; cat.blinkO = ts > b1 && ts < b1 + 0.18 ? Math.abs(ts - b1 - 0.09) / 0.09 : ts > b2 && ts < b2 + 0.18 ? Math.abs(ts - b2 - 0.09) / 0.09 : ts < T.peek ? 1 : null;
      cat.gz = true; cat.att = ts < T.lookL ? null : ts < T.lookR ? { x: r.x - 260, y: r.y - 40 } : ts < T.lookC ? { x: r.x + 260, y: r.y - 50 } : null; rig.pupilT = ts < T.peek ? 1 : 0.8;
      rig.over.ear = ts < T.peek ? 0.2 : 0; d.y0 = cat.y; d.x0 = cat.x;
      if (ts >= T.crouch) { cat.dir = d.side; cat.att = { x: d.lx, y: r.y }; }
      return;
    }
    if (ts < T.land) {                                                 /* il salto fuori, mentre cresce */
      if (!d.jumped) { d.jumped = 1; cat.blinkO = null; reanchor(26); d.y0 = cat.y; cat.dir = d.side; }
      var u = seg(ts, T.jump, T.land), ly = d.p ? d.p.y : r.y + 4, h = 34 + (d.y0 - ly) * 0.2;
      cat.face = "side"; cat.x = lerp(d.x0, d.lx, u); cat.y = lerp(d.y0, ly, u) - 4 * h * u * (1 - u); cat.s = lerp(0.78, 1, eOut(u));
      rig.pose = u < 0.12 ? "stretch" : u > 0.72 ? "stand" : "air"; rig.rate = 15;
      var vy = ((ly - d.y0) - 4 * h * (1 - 2 * u)) / (T.land - T.jump); rig.pitchT = clamp(Math.atan2(-vy, Math.abs(d.lx - d.x0) / (T.land - T.jump) + 70), -0.75, 0.75) * 0.75;
      cat.clipAt = u < 0.45 ? r.y : null; cat.gy = ly; return;
    }
    if (!d.landed) { d.landed = 1; cat.s = 1; cat.x = d.lx; if (d.p) landOn(d.p); cat.clipAt = null; set("land", { then: d.first ? function () { sitFor(4.6, { face: "view" }); } : "sit", v: 600, face: "side", pose: "land" }); if (d.first) life.sayAt = now + Math.max(0, T.bubble - T.land); }
  }
  Object.assign(STATES, {
    opening: function (dt, d) { if (!stageOn) { set("peek", { p: d.p, x: d.x, first: true }); return; } boxSeq(now - B.openT0, d); },
    boxexit: function (dt, d) { var T = TS(); boxSeq(T.lid + 0.15 + cat.st * 1, d); },
    boxjump: function (dt, d) {                                        /* salta (o è lasciato) dentro la scatola */
      var r = stage.rim(), u = seg(cat.st, d.closed ? 0 : 0.18, d.closed ? 0.25 : 0.62), k;
      if (!d.closed && cat.st < 0.18) { cat.dir = r.x > cat.x ? 1 : -1; rig.pose = "crouch"; return; }
      if (!d.re) { d.re = 1; if (d.closed) { reanchor(15); } d.x0 = cat.x; d.y0 = cat.y; }
      cat.clipAt = u > 0.55 ? r.y : null; rig.grounded = false; cat.gy = null;
      cat.x = lerp(d.x0, r.x, eIO(u)); cat.s = lerp(1, 0.78, u); k = px();
      cat.y = lerp(d.y0, r.floor, u) - (d.closed ? 0 : 4 * 40 * u * (1 - u)); rig.pose = u < 0.7 ? "air" : "sit"; cat.face = u < 0.7 && !d.closed ? "side" : "front";
      if (u >= 1) { if (d.closed) { stage.lid(0); cat.vis = false; set("boxed"); } else set("box", { dur: rr(7, 10), face: "front", pose: "peek" }); }
    },
    box: function (dt, d) {                                            /* nascosto: solo due occhi verdi nel buio, un po' offesi */
      var r = stage.rim(), k; cat.s = 0.78; k = px(); cat.x = r.x; cat.face = "front"; rig.pose = "peek"; cat.clipAt = r.y; cat.voff = 0; rig.grounded = false;
      var band = r.back != null ? r.y - r.back : 12 * r.w / 42.6, low = ((rig.poses.peek.cy + rig.poses.peek.dy + rig.P.eye.up) * k - band * 0.5) / k;
      cat.clipTop = r.y - band; cat.y = lerp(cat.y, r.y + low * k, 1 - Math.exp(-dt * 6)); rig.over.lid = 0.42; rig.over.brow = 0.4; rig.over.ear = 0.35; cat.att = null;
      if (cat.st > d.dur) boxOut();
    },
    boxed: function () { cat.vis = false; }
  });
  /* ------------------------------------------------------------------ lo sguardo, le palpebre, le orecchie, il fez */
  function gaze(dt) {
    if (!cat.gz) return;
    var f = lastF, k = px(), h = f ? toPage(f.head.x, f.head.y) : { x: cat.x, y: cat.y - 30 * k }, s = cat.state, i, gx, gy;
    var tgt = cat.att, recent = now - ptr.t < (ptr.touch ? 2.2 : 3.5) && ptr.x > -1e3;
    if (!tgt && recent && s !== "walk" && s !== "sulk") tgt = { x: ptr.x, y: ptr.y };
    if (rig.pose === "sleep" || rig.pose === "stretch" || (s === "air" && !cat.att)) { rig.look.ty = 0; rig.look.tp = 0; return; }
    if (tgt) {
      var dx = tgt.x - h.x, dy = -(tgt.y - h.y);
      rig.look.ty = clamp(wrap(Math.atan2(-170, dx) - rig.yaw), -1.1, 1.1); rig.look.tp = clamp(Math.atan2(dy, hyp(dx, 170)), -0.6, 0.6);
      gx = clamp(dx / 110, -1, 1); gy = clamp(dy / 110, -1, 1);
    } else {
      if (now > life.glAt) { life.glAt = now + rr(1.4, 3.8); var g = rnd(); life.gl = g < 0.55 ? 0 : rr(-0.85, 0.85); life.glY = g < 0.55 ? 0 : rr(-0.25, 0.3); life.glE = rnd() < 0.5; }
      var base = clamp(wrap(-PI / 2 - rig.yaw), -0.95, 0.95);
      rig.look.ty = life.glE ? base : clamp(base + life.gl, -1.1, 1.1); rig.look.tp = (s === "held" ? -0.22 : 0.04) + (life.glE ? 0 : life.glY * 0.5);
      gx = life.gl * (life.glE ? 0.9 : 0.5); gy = life.glY;
    }
    if (s === "walk" && !cat.att) { rig.look.ty *= 0.35; rig.look.tp *= 0.4; }
    for (i = 0; i < 2; i++) { rig.gazeT[i].x = gx; rig.gazeT[i].y = gy; }
  }
  function lifeStep(dt) {
    var b = 1, u;
    if (now > life.blinkAt) { life.blinkT = now; life.blinkAt = now + (rnd() < 0.18 ? 0.3 : rr(2.2, 5.6)); }
    u = now - life.blinkT; if (u < 0.15) b = Math.abs(u - 0.075) / 0.075;
    u = now - life.slow; if (u > 0 && u < 1.4) b = Math.min(b, 1 - smooth(0, 0.5, u) * (1 - smooth(0.75, 1.4, u)));     /* il lento battito di fiducia */
    rig.autoBlink = false; rig.blink = cat.blinkO != null ? cat.blinkO : b; cat.blinkO = null;
    rig._earAt = 1e9; if (now > life.earAt) { rig._earT = rig.t; rig._earSide = rnd() < 0.5 ? 1 : -1; life.earAt = now + rr(3, 8); }
    if (life.earFlick) { rig._earT = rig.t; rig._earSide = life.earSide || 1; life.earFlick = 0; }
    life.fezRollV += (-(life.fezRoll - (life.fezRollT || 0)) * 90 - life.fezRollV * 7) * dt; life.fezRoll = clamp(life.fezRoll + life.fezRollV * dt, -0.6, 0.6); rig.fezRoll = life.fezRoll;
    /* il dito fermo vicino alla testa: un lento battito d'occhi */
    if (lastF && CALM[cat.state] && now - ptr.t < 6 && ptr.still > 1.3 && now - life.slow > 7) { var h = toPage(lastF.head.x, lastF.head.y); if (hyp(ptr.x - h.x, ptr.y - h.y) < 80) life.slow = now; }
  }

  /* ------------------------------------------------------------------ un passo del mondo */
  function step(dt) {
    now += dt; readView(); if (now - world.at > 0.8) readWorld();
    if (script) { var i; for (i = script.length - 1; i >= 0; i--) if (now >= script[i].t) { var fn = script[i].fn; script.splice(i, 1); fn(); } }
    cat.st += dt; rig.yawT = yawFor(cat.face, cat.dir);
    rig.tailSwish -= life.flAdd || 0; var S = STATES[cat.state]; if (S) S(dt, cat.d);
    if (CALM[cat.state] && now > (life.flAt || 0)) { life.flAt = now + rr(3, 7); life.flT = now; }
    life.flAdd = CALM[cat.state] ? 0.32 * bell(seg(now - (life.flT || -9), 0, 0.7)) : 0; rig.tailSwish += life.flAdd;   /* la punta della coda dà un colpetto ogni tanto */
    if (drag && !drag.moved && !drag.pet && now - drag.t0 > 0.45 && CALM[cat.state] && cat.plat && !reduced) { drag.pet = true; set("pet", { face: "view", pose: "sit" }); }
    if (!ptr.touch && ptr.sp > 1000 && now - ptr.t < 0.12 && cat.plat && (cat.state === "sit" || cat.state === "look" || cat.state === "pause") && now > (life.pounceAt || 0) && !reduced) {
      var pdx = ptr.x - cat.x, pdy = ptr.y - (cat.y - 20); if (Math.abs(pdx) < 170 && Math.abs(pdx) > 30 && Math.abs(pdy) < 80) { life.pounceAt = now + 10; set("pounce", { tx: clamp(ptr.x, cat.plat.a, cat.plat.b), wait: 0.8, then: "sit" }); }
    }
    if (life.braceAt && now - life.braceAt < 0.1 && cat.plat && cat.vis && (cat.state === "sit" || cat.state === "look" || cat.state === "pause" || cat.state === "loaf") && !reduced) { life.braceAt = 0; set("brace", { face: cat.face, pose: "crouch" }); }
    if (cat.state !== "walk" && rig.walk > 0.03 && cat.plat && onEdge()) cat.x = clamp(cat.x + rig.walk * cat.coast * dt, cat.plat.a, cat.plat.b);
    if (cat.plat && onEdge()) cat.rel = cat.x - cat.plat.tile.l;
    if (!cat.ownRot) cat.rot *= Math.exp(-dt * 10); cat.ownRot = false;
    if (!cat.ownLift) cat.lift *= Math.exp(-dt * 12); cat.ownLift = false;
    cat.voff *= Math.exp(-dt * rig.rate); if (Math.abs(cat.voff) < 0.01) cat.voff = 0;
    gaze(dt); lifeStep(dt);
    rig.wx = cat.x / K; rig.wy = -cat.y / K;
    rig.step(dt);
    stepFez(dt); stepProps(dt); if (bubble) bubble.phys(dt);
    for (var j = scratches.length - 1; j >= 0; j--) { scratches[j].step(dt); if (scratches[j].dead) scratches.splice(j, 1); }
    /* fuori dalla vista: torna */
    var free = CALM[cat.state] || cat.state === "sleep" || cat.state === "drape" || cat.state === "sulk";
    if (free && cat.vis && !inView(cat.y - 24 * px(), 30, -24)) { cat.offT += dt; if (cat.offT > 1.2) { cat.offT = 0; comeBack(); } } else cat.offT = 0;
    if (life.sayAt && now >= life.sayAt) { life.sayAt = 0; say("salam, sono Dot.", 4); }
    if (!frenchDone && (now - lastIn > 90 || now - openedAt > 240) && CALM[cat.state] && cat.vis && inView(cat.y, 80, 0) && !(bubble && bubble.on)) {
      frenchDone = true; try { sessionStorage.setItem("dot-fr", "1"); } catch (e) {}
      say("Lo sapevi che «chat» vuol dire gatto in francese?", 6, "long");
    }
  }

  /* ------------------------------------------------------------------ il disegno */
  function envFor(k) { return { dark: dark, scale: k, shadow: null, clipY: null, pawsOnEdge: false }; }
  function drawTangle(c, f) {                                           /* il filo del gomitolo attorno al gatto */
    var b = f.body, mx = (b.hips.x + b.chest.x) / 2, my = (b.hips.y + b.chest.y) / 2, a = cat.tangle;
    c.save(); c.globalAlpha = a; c.strokeStyle = "#e9e3d6"; c.lineWidth = 0.42; c.lineCap = "round";
    c.beginPath(); c.ellipse(mx, my, 10.5, 6.2, 0.3, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(mx + 2, my + 3, 8.5, 4.2, -0.5, 0.4, 5.6); c.stroke();
    c.beginPath(); c.moveTo(f.legs[0].fx, f.legs[0].fy + 2); c.quadraticCurveTo(mx + 6, my - 8, b.hips.x - 2, b.hips.y + 6); c.stroke();
    c.beginPath(); c.moveTo(f.head.x - 6, f.head.y - 4); c.quadraticCurveTo(f.head.x + 3, f.head.y - 9, f.head.x + 8, f.head.y - 2); c.stroke(); c.restore();
  }
  function render(dt) {
    var f = rig.frame(), k = px(), i; lastF = f;
    var Oy = cat.y - cat.lift - cat.voff * k, on = cat.vis && Oy > view.sy - 220 && Oy < view.sy + view.vh + 260;
    catSp.show(on);
    if (on) {
      var jx = cat.jit ? cat.jit * Math.sin(now * 95) : 0; catSp.place(cat.x + jx, Oy); catSp.clear();
      var c = catSp.model(k), env = envFor(k);
      if (cat.rot) { c.translate(0, cat.piv); c.rotate(cat.rot); c.translate(0, -cat.piv); }
      if (cat.gy != null && Math.abs(cat.rot) < 0.5) { var hh = cat.gy - (cat.y - cat.lift); env.shadow = { y: (Oy - cat.gy) / k, k: 1 - 0.6 * sat(hh / 140) }; }
      if (cat.clipAt != null) env.clipY = (Oy - cat.clipAt) / k;
      env.pawsOnEdge = cat.paws;
      c.save(); if (cat.clipTop != null && cat.clipAt != null) { var yl = (Oy - cat.clipAt) / k, yh = (Oy - cat.clipTop) / k; c.beginPath(); c.rect(-500, yl, 1000, yh - yl); c.clip(); }   /* dentro la scatola: si vede solo la fessura buia */
      try { look.draw(c, f, env); } catch (e) { if (look !== DOT.looks.base) { look = DOT.looks.base; } }
      c.restore();
      var dp = (look && look.drawProp) || DOT.looks.base.drawProp;
      for (i = 0; i < props.length; i++) { var pr = props[i];
        if (pr.held) { c.save(); c.translate(f.hold.x, f.hold.y + (pr.hOff || -1.2)); try { dp(c, pr.name, { t: pr.t, open: pr.open }, env); } catch (e) {} if (pr.steam > 0.02) steam(c, pr, 7); c.restore(); }
        else if (pr.front) { c.save(); c.translate(pr.front.x, pr.front.y); c.scale(pr.sc, pr.sc); try { dp(c, pr.name, { t: pr.t, open: pr.open }, env); } catch (e) {} c.restore(); }
      }
      if (cat.tangle > 0.01) drawTangle(c, f);
    }
    drawFez(); drawProps();
    if (stageOn && stage.draw) { var ts = B.openT0 != null ? now - B.openT0 : 99; var T = TS(); if (ts < T.end + 1.5 || boxVisible()) { try { stage.draw(Math.max(0, ts), now); } catch (e) {} } }
    /* la maniglia trasparente sopra il gatto */
    var free = on && cat.state !== "opening" && cat.state !== "boxjump" && cat.state !== "boxed" && cat.state !== "boxexit" && cat.state !== "box" && cat.state !== "wait" && !reduced || (reduced && on);
    if (free) { var gxp, gyp; if (drag && drag.moved) { gxp = drag.x; gyp = drag.y; } else { var b = f.body, mx = (b.hips.x + b.chest.x) / 2 * 0.6 + f.head.x * 0.4, my = (b.hips.y + b.chest.y) / 2 * 0.6 + f.head.y * 0.4; gxp = cat.x + mx * k; gyp = Oy - my * k; }
      grab.style.transform = "translate3d(" + (gxp - 38).toFixed(1) + "px," + (gyp - 38).toFixed(1) + "px,0)"; if (grab.style.display === "none") grab.style.display = "block"; }
    else if (grab.style.display !== "none" && !(drag && drag.moved)) grab.style.display = "none";
    if (bubble) { var ax = cat.x + f.head.x * k, ay = Oy - (f.head.y + f.head.ry + (rig.fezOn ? 9 : 3)) * k; bubble.place(ax, ay, cat.y + 6, view.sx, view.sy, view.vw, on && cat.state !== "held" && cat.state !== "fly"); }
  }

  /* ------------------------------------------------------------------ il ciclo */
  function loop(ms) {
    if (!B.on) return; raf = requestAnimationFrame(loop);
    if (doc.hidden) { last = 0; return; }
    var t = ms / 1000, dt = last ? Math.min(0.05, t - last) : 1 / 60; last = t;
    if (window.__manual) return;
    if (reduced) dt = Math.min(dt, 0.05);
    step(dt); render(dt);
  }
  function onVis() { last = 0; }

  /* ------------------------------------------------------------------ le dita */
  function canGrab() { var s = cat.state; return !reduced && cat.vis && s !== "opening" && s !== "boxjump" && s !== "boxed" && s !== "boxexit" && s !== "box" && s !== "wait"; }
  function onDown(e) {
    if (!B.on || !canGrab() && !reduced) return; if (e.button && e.button !== 0) return;
    try { grab.setPointerCapture(e.pointerId); } catch (er) {}
    drag = { id: e.pointerId, x: e.pageX, y: e.pageY, x0: e.pageX, y0: e.pageY, t0: now, moved: false, pet: false, hist: [{ x: e.pageX, y: e.pageY, t: now, rt: perf() }] };
    lastIn = now; if (e.cancelable) e.preventDefault();
  }
  function perf() { return window.performance && performance.now ? performance.now() / 1000 : Date.now() / 1000; }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return; drag.x = e.pageX; drag.y = e.pageY; lastIn = now;
    drag.hist.push({ x: e.pageX, y: e.pageY, rt: perf() }); if (drag.hist.length > 10) drag.hist.shift();
    if (!drag.moved && hyp(e.pageX - drag.x0, e.pageY - drag.y0) > 8 && !reduced) { drag.moved = true; if (canGrab()) pickUp(); }
  }
  function onUp(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return; var d = drag; drag = null;
    try { grab.releasePointerCapture(d.id); } catch (er) {}
    if (!d.moved) { if (d.pet) { if (cat.state === "pet") { cat.jit = 0; life.slow = now + 0.2; sitFor(rr(2, 3)); } } else if (e && e.type !== "pointercancel") tap(); return; }
    if (cat.state !== "held") return;
    var h = d.hist, a = h[0], b = h[h.length - 1], i, rt = b.rt; for (i = h.length - 1; i >= 0; i--) if (rt - h[i].rt <= 0.1) a = h[i];
    var dtt = Math.max(0.016, rt - a.rt); release(clamp((b.x - a.x) / dtt, -2400, 2400), clamp((b.y - a.y) / dtt, -2400, 2400));
  }
  function onKey(e) { if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); tap(); } }
  function onPtr(e) {
    var t = now, dx = e.pageX - ptr.x, dy = e.pageY - ptr.y, dd = hyp(dx, dy), dtp = t - ptr.t;
    if (dtp > 0.0001) ptr.sp = dd / dtp; if (dd > 3) ptr.still = 0;
    ptr.x = e.pageX; ptr.y = e.pageY; ptr.t = t; ptr.touch = e.pointerType === "touch"; lastIn = now;
  }
  function onPtrDown(e) {
    onPtr(e); ptr.still = 0;
    if (stageOn && stage.hit && stage.hit(e.pageX, e.pageY) && (cat.state === "boxed" || cat.state === "box")) { boxOut(); return; }
    if (lastF && cat.vis && e.target !== grab) { var dx = e.pageX - cat.x, dy = e.pageY - (cat.y - 25 * px()); if (hyp(dx, dy) < 170) { life.earFlick = 1; life.earSide = dx > 0 ? 1 : -1; } }
  }
  var scr = { y: 0, t: 0 };
  function onScroll() {                                                /* uno scorrimento molto veloce: si aggrappa, orecchie indietro */
    lastIn = now; var y = window.pageYOffset || 0, t = perf(), v = t > scr.t ? Math.abs(y - scr.y) / Math.max(0.008, t - scr.t) : 0; scr.y = y; scr.t = t;
    if (v > 2600 && t - scr.t < 0.2) life.braceAt = now;
  }
  function stillTick() { ptr.still += 0.25; }

  /* ------------------------------------------------------------------ accendere, spegnere */
  function makeCanvas() { if (catSp) catSp.remove(); catSp = fx().Sprite(layer, Math.round(CWU * K), Math.round(CHU * K), Math.round(OXU * K), Math.round(OYU * K), 3); }
  function pickK() { var w = view.vw; return O.k || clamp(1.5 + (w - 600) / 500 * 0.4, 1.5, 1.9); }
  function onResize() { readView(); var nk = pickK(); if (Math.abs(nk - K) > 0.01) { K = nk; makeCanvas(); } readWorld(); if (stageOn && stage.place) { var h = homePoint(); stage.place(h.x, h.y); readWorld(); } }
  function homePoint() {
    var h = O.home, r, sx = view.sx, sy = view.sy;
    if (h && h.nodeType === 1) { r = h.getBoundingClientRect(); return { x: r.left + sx + (r.width > 220 ? r.width * 0.72 : r.width / 2), y: r.top + sy, el: h }; }
    if (h && typeof h.x === "number") return { x: h.x, y: h.y };
    var i, t; for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (!t.mode && t.w > 150) return { x: t.l + (t.w > 220 ? t.w * 0.72 : t.w / 2), y: t.t, el: t.el }; }
    return { x: view.vw / 2, y: 200 };
  }
  var RO = null, stillI = 0;
  DOT.start = function (opts) {
    if (B.on) DOT.stop();
    O = opts || {}; O.tiles = O.tiles || ".t, [data-tile]";
    reduced = !!O.reducedMotion; try { if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) reduced = true; } catch (e) {}
    dark = O.dark != null ? !!O.dark : true; try { if (O.dark == null && window.matchMedia) dark = !matchMedia("(prefers-color-scheme: light)").matches; } catch (e) {}
    fx().css(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    layer = doc.createElement("div"); layer.className = "dot-layer"; doc.body.appendChild(layer);
    grab = doc.createElement("button"); grab.type = "button"; grab.className = "dot-grab"; grab.setAttribute("aria-label", "Dot, il gatto"); grab.style.display = "none"; layer.appendChild(grab);
    bubble = fx().Bubble(layer);
    look = DOT.looks[O.look] || DOT.looks.base; rig = DOT.makeRig(look.preset); addPoses(rig); rig.autoBlink = false;
    readView(); K = pickK(); makeCanvas(); readWorld();
    try { frenchDone = sessionStorage.getItem("dot-fr") === "1"; } catch (e) { frenchDone = false; }
    now = 0; lastIn = 0; openedAt = 0; B.on = true; B.openT0 = null;
    grab.addEventListener("pointerdown", onDown); grab.addEventListener("pointermove", onMove); grab.addEventListener("pointerup", onUp); grab.addEventListener("pointercancel", onUp);
    grab.addEventListener("lostpointercapture", function (e) { if (drag && e.pointerId === drag.id && drag.moved) onUp(e); });
    grab.addEventListener("keydown", onKey); grab.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    window.addEventListener("pointermove", onPtr, { passive: true }); window.addEventListener("pointerdown", onPtrDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onResize); doc.addEventListener("visibilitychange", onVis);
    if (window.ResizeObserver) { try { RO = new ResizeObserver(function () { world.at = -9; }); RO.observe(doc.body); } catch (e) { RO = null; } }
    stillI = setInterval(stillTick, 250);
    begin(O.firstVisit !== false && !reduced);
    raf = requestAnimationFrame(loop);
    return DOT;
  };
  function begin(first) {
    var h = homePoint(); B.home = h; killFez(); rig.fezOn = true; cat.s = 1; cat.voff = 0; cat.rot = 0; cat.lift = 0;
    var i; for (i = 0; i < props.length; i++) props[i].sp.remove(); props = [];
    stageOn = false; if (DOT.stage && DOT.stage.mount) { try { stage = DOT.stage; if (!B.mounted) { stage.mount(layer, { x: h.x, y: h.y }); B.mounted = true; } else stage.place(h.x, h.y); stageOn = true; } catch (e) { stageOn = false; } }
    readWorld();
    var p = platBelow(h.x, h.y - 4, true) || world.plats[0];
    if (first) { B.openT0 = now; cat.vis = false; cat.x = h.x; cat.y = h.y; set("opening", { first: true, p: p, x: p ? clamp(h.x, p.a, p.b) : h.x }); }
    else {
      B.openT0 = null; var side = 1;
      if (stageOn) { try { stage.draw(TS().end + 2, now); } catch (e) {} var hl = homeLanding(stage.rim()); p = hl.p; side = hl.side; cat.x = hl.x; } else cat.x = p ? clamp(h.x, p.a, p.b) : h.x;
      cat.vis = true; if (p) landOn(p); else { cat.y = h.y; }
      cat.dir = -side; rig.snap("sit"); sitFor(reduced ? 1e9 : rr(3, 5), { face: "view" }); rig.snap("sit");
      if (reduced) set("sit", { dur: 1e9, face: "view", pose: "sit" });
    }
  }
  DOT.stop = function () {
    if (!B.on) return; B.on = false; cancelAnimationFrame(raf); clearInterval(stillI);
    window.removeEventListener("pointermove", onPtr); window.removeEventListener("pointerdown", onPtrDown); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); doc.removeEventListener("visibilitychange", onVis);
    if (RO) { try { RO.disconnect(); } catch (e) {} RO = null; }
    if (stageOn && stage.unmount) { try { stage.unmount(); } catch (e) {} } stageOn = false; B.mounted = false;
    killFez(); props = []; scratches = []; if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; catSp = null; cat.state = "off";
  };
  DOT.setLook = function (name) {
    if (!rig) return; var nl = DOT.looks[name]; if (!nl) return; var old = rig; look = nl; rig = DOT.makeRig(look.preset); addPoses(rig);
    rig.pose = old.pose; rig.over = old.over; rig.yawT = old.yawT; rig.pitchT = old.pitchT; rig.rollT = old.rollT; rig.fezOn = old.fezOn; rig.longT = old.longT; rig.walkT = old.walkT; rig.speedU = old.speedU; rig.grounded = old.grounded;
    rig.look.ty = old.look.ty; rig.look.tp = old.look.tp; rig.snap(old.pose); rig.gait = old.gait; rig.autoBlink = false;
  };
  DOT.say = function (text, sec) { say(text, sec || 3, text.length > 26 ? "long" : text.length < 8 ? "mini" : null); };
  DOT.replay = function () { if (!B.on) return; drag = null; fake = null; begin(!reduced); };

  /* ------------------------------------------------------------------ la porta per le prove (window.__manual = true) */
  DOT.debug = {
    state: function () { var f = lastF, k = px(); return { state: cat.state, st: cat.st, x: cat.x, y: cat.y, s: cat.s, k: k, K: K, vis: cat.vis, voff: cat.voff, top: f ? cat.y - cat.lift - cat.voff * k - (f.head.y + 16) * k : cat.y - 60, plat: cat.plat ? { a: cat.plat.a, b: cat.plat.b, y: cat.plat.y } : null, fez: fez ? { x: fez.b.x, y: fez.b.y } : null, now: now }; },
    set: function (name, d) { set(name, d || {}); },
    tick: function (dt) { var n = Math.max(1, Math.round(dt / (1 / 60))), h = dt / n, i; for (i = 0; i < n; i++) step(h); render(dt); },
    seed: function (n) { seedOn = true; seedS = n | 0; },
    tap: function () { tap(); },
    dragTo: function (x, y) { fake = { x: x, y: y }; if (cat.state !== "held") pickUp(); },
    drop: function (vx, vy) { fake = null; if (cat.state === "held") release(vx || 0, vy || 0); },
    replay: function () { DOT.replay(); },
    prop: function (name) { beginProp(name); },
    at: function (t, fn) { script = script || []; script.push({ t: now + t, fn: fn }); },
    place: function (x, p) { var q = p != null ? world.plats[p] : platBelow(x, cat.y - 200); if (!q) return; cat.x = clamp(x, q.a, q.b); landOn(q); cat.vis = true; rig.snap("sit"); sitFor(1e9, { face: "view" }); },
    plats: function () { return world.plats.map(function (p) { return { a: p.a, b: p.b, y: p.y, quiet: p.quiet, tile: { l: p.tile.l, t: p.tile.t, r: p.tile.r, b: p.tile.b } }; }); },
    tiles: function () { return world.tiles.map(function (t) { return { l: t.l, t: t.t, r: t.r, b: t.b, mode: t.mode }; }); },
    walkTo: function (x) { walkTo(x, "none"); }, jumpTo: function (pi, x) { jumpTo(world.plats[pi], x, "sit"); },
    ptr: function (x, y) { ptr.x = x; ptr.y = y; ptr.t = now; ptr.still = 0; },
    idle: function (sec) { lastIn = now - sec; }, platsRaw: function () { return world.plats; }, box: function () { return stageOn ? stage.rim() : null; }, fedUp: function () { fedUp(); },
    bbox: function () {                                                /* il rettangolo che il gatto occupa adesso, in pagina */
      var f = lastF; if (!f) return null; var k = px(), Oy = cat.y - cat.lift - cat.voff * k, P = [], i, l, cr = Math.cos(cat.rot), sr = Math.sin(cat.rot);
      function add(x, y, r) { P.push([x - r, y - r], [x + r, y + r]); }
      add(f.head.x, f.head.y, f.head.rx); for (i = 0; i < 2; i++) add(f.ears[i].tx, f.ears[i].ty, 1); if (f.fez) { add(f.fez.tx, f.fez.ty, 4); add(f.fez.tassel.x1, f.fez.tassel.y1, 1); }
      add(f.body.hips.x, f.body.hips.y, f.body.hips.r); add(f.body.chest.x, f.body.chest.y, f.body.chest.r);
      for (i = 0; i < 4; i++) { l = f.legs[i]; add(l.fx, l.fy, l.paw + 1); add(l.kx, l.ky, l.r0); }
      for (i = 0; i < f.tail.pts.length; i++) add(f.tail.pts[i].x, f.tail.pts[i].y, f.tail.pts[i].r);
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (i = 0; i < P.length; i++) { var mx = P[i][0], my = P[i][1] - cat.piv, rx = mx * cr - my * sr, ry = mx * sr + my * cr + cat.piv, X = cat.x + rx * k, Yp = Oy - ry * k; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Yp < y0) y0 = Yp; if (Yp > y1) y1 = Yp; }
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    },
    look: function () { return look; }, rig: function () { return rig; }, cat: cat, life: life
  };
})();
