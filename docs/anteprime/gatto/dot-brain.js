/* dot-brain.js — il cervello di Dot: dove sta, cosa fa, come reagisce (vedi DOT.md, sezioni 3 e 4).
   Non disegna il gatto: guida lo scheletro (dot-rig.js) per nome di posa, valori forzati e pochi comandi, poi passa il
   fotogramma all'aspetto scelto (look-*.js). Le cose attorno (nuvoletta, graffi, oggetti) sono in dot-fx.js.
   Coordinate: pixel della pagina (x a destra, y in GIÙ); il gatto è disegnato in unità del modello (y in alto),
   K pixel per unità. Uso (tutto spiegato in DOT.md, sezione 5): DOT.start({ tiles, home, look, firstVisit, reducedMotion, dark, parent, bottomInset, topInset, k }),
   DOT.refresh([secondi]), DOT.pause(), DOT.resume(), DOT.stop(), DOT.setLook(nome), DOT.setDark(bool), DOT.say(testo, secondi), DOT.replay().
   Per le prove: window.__manual = true e DOT.debug.tick(dt). Solo ES2017. */
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

  /* ------------------------------------------------------------------ pose in più (del cervello), costruite sulle pose dell'aspetto.
     Appeso e scivola usano le pose «hang» e «slide» dell'aspetto (quelle della tavola): origine sul bordo di sotto per
     «hang», sulla faccia del riquadro per «slide», con le zampe davanti sopra (vedi top()). */
  function addPoses(rig) {
    var P = rig.poses, S = P.sit, St = P.stand, Cr = P.crouch, pz = DOT.pose;
    /* il salto: si carica come una molla (sedere alto, muso basso, coda arcuata), spinge, vola, allunga le zampe davanti per atterrare */
    P["b-coil"] = pz({ hx: -6.2, hy: 10.4, cx: 6.2, cy: 8.2, dx: 6.8, dy: 6.0, f0x: 8.6, f1x: 7.4, f2x: -5.8, f3x: -7, hp: 0.14, tby: 2.6, te: 0.3, tc: 0.95, eye: 1.08, sqx: 1.03, sqy: 0.97 }, Cr);
    P["b-launch"] = pz({ hx: -7.4, hy: 15.4, cx: 7.6, cy: 14.2, dx: 6.8, dy: 8.2, f0x: 13.5, f0y: 4.6, f1x: 12.4, f1y: 4, f2x: -9.2, f2y: 0, f3x: -10.4, f3y: 0, te: 0.1, tc: 0.35, hp: 0.16, sqx: 0.95, sqy: 1.06 }, St);
    P["b-reach"] = pz({ hx: -6.4, hy: 13.6, cx: 6.6, cy: 13, dx: 6.2, dy: 7.8, f0x: 11.5, f0y: -1.2, f1x: 10.2, f1y: -0.6, f2x: -3.6, f2y: 3.4, f3x: -4.8, f3y: 3.8, te: 0.75, tc: 0.55, hp: -0.06 }, St);
    /* la salita dal bordo: tira su il petto con le zampe davanti piantate, poi i fianchi e una zampa dietro sopra il bordo */
    P["b-pull"] = pz({ hx: -1.6, hy: -11, cx: 2.6, cy: 2.2, dx: 4.6, dy: 9.4, f0x: 5.4, f0y: 0.4, f1x: 4.6, f1y: 0.4, fs: 2.2, f2x: -2.4, f2y: -19, f3x: -3.2, f3y: -20, tby: -2, te: -1.25, tc: 0.7, hp: 0.12, eye: 1.05, sqx: 0.97, sqy: 1.03 }, St);
    P["b-hoist"] = pz({ hx: -5.2, hy: 3.4, cx: 5.4, cy: 9.6, dx: 5.8, dy: 7.8, f0x: 9.6, f0y: 0, f1x: 8.4, f1y: 0, fs: 0.6, f2x: -3.6, f2y: 0.6, f3x: -2.6, f3y: -6.5, tby: 0.5, te: -0.4, tc: 0.9, arch: 2.2, hp: 0.04 }, St);
    /* il fez: il muso lo raccoglie da terra e lo lancia in su con un colpo di testa */
    P["b-scoop"] = pz({ cx: 7.6, cy: 10.8, dx: 8.2, dy: 3.4, hp: -0.62, f0x: 9.8, f1x: 8.6, hx: -5.6, hy: 13.8, te: 1.0, tc: 0.7, ear: 0.15 }, St);
    P["b-toss"] = pz({ cx: 6.4, cy: 15.4, dx: 4.6, dy: 9.6, hp: 0.48, f0x: 7.8, f1x: 6.6, hx: -5.8, hy: 13.2, te: 1.1, tc: 0.6 }, St);
    /* miao: prima si raccoglie un attimo, poi alza il muso */
    P["b-meow0"] = pz({ hp: -0.16, dy: S.dy - 0.8, eye: 0.75, ear: 0.15, sqy: 0.96, sqx: 1.02 }, S);
    P["b-meow"] = pz({ hp: 0.42, dy: S.dy + 1.2, cy: S.cy + 0.6, eye: 0.7, mouth: 1.0, ear: 0.28, sqy: 1.05, sqx: 0.98 }, S);
    P["b-paw"] = pz({ f0x: 11.6, f0y: 5.4, hp: -0.28, dx: 3.2, dy: 9.6 }, S);                 /* una zampa sopra il cubo */
    P["b-push"] = pz({ f0x: 15.5, f0y: 1.6, hp: -0.18, cx: 7.4, cy: 12.4, dx: 6, dy: 8.6 }, St);   /* lo spinge giù dal bordo */
    P["b-sniff"] = pz({ cx: 7.4, cy: 11.6, dx: 7.6, dy: 4.2, hp: -0.5, f0x: 9.4, f1x: 8.2, te: 0.9, tc: 0.7 }, St);   /* il muso a terra, sul fez */
    P["b-over"] = pz({ hx: -5.5, hy: 12.2, cx: 7.8, cy: 9.6, dx: 8.2, dy: 4.4, hp: -0.36, f0x: 10.2, f1x: 8.8, f2x: -5.4, f3x: -6.4, te: 0.5, tc: 0.7, ear: -0.1, eye: 1.15 }, St);   /* si sporge e guarda giù (il muso resta leggibile: guardano giù anche le pupille) */
    P["b-knead"] = pz({ f0y: 6.5, f1y: 5, f2y: 6.5, f3y: 4.5 }, P.belly);
    P["b-pounce"] = pz({ f0x: 13.5, f0y: 4.5, f1x: 12, f1y: 4.5, f2x: -9, f3x: -10, hx: -7.5, hy: 11.5, cx: 7.5, cy: 9.2, dx: 6.6, dy: 6.4, eye: 1.2, ear: 0.1, te: 0.9, tc: 0.3 }, St);
    /* sciolto sotto il dito: la «pozzanghera» dell'aspetto, il mento a terra, occhi chiusi (archi felici), respiro lento */
    P["b-melt"] = pz({ dy: 3.5, eye: 0, lid: 0, hp: -0.04, ear: -0.06, br: 1.15 }, P.puddle);
  }
  var HEADMAX = 0.7;   /* la testa si gira al massimo 0.7 rad via da chi guarda: si vedono sempre due occhi (trovato con la tavola, nei tre aspetti) */

  /* ------------------------------------------------------------------ lo stato */
  var O = {}, B = { on: false };
  var look = null, rig = null, K = 1.5, dpr = 1, dark = true, reduced = false;
  var layer = null, catSp = null, grab = null, bubble = null, scratches = [], props = [], fez = null, stage = null, stageOn = false;
  var CWU = 124, CHU = 134, OXU = 62, OYU = 70;               /* la tela del gatto, in unità: larga, alta, origine dentro */
  var cat = { x: 0, y: 0, s: 1, dir: 1, face: "view", plat: null, rel: 0, state: "off", st: 0, d: {}, lift: 0, gy: null, rot: 0, piv: 12, clipY: null, paws: false, vis: false,
    att: null, gz: true, coast: 0, offT: 0, voff: 0, voffV: 0, ownRot: false, ownLift: false, clipAt: null, hideL: null, hideR: null, blinkO: null, last: "", lastTap: "", taps: [], hold: null, jit: 0,
    mood: null, moodKeys: null };
  var view = { sx: 0, sy: 0, vw: 360, vh: 640, bi: 0, ti: 0 };
  var world = { tiles: [], plats: [], no: [], quiet: [], sig: "", at: 0 };
  var radOf = typeof WeakMap === "function" ? new WeakMap() : null;   /* il raggio degli angoli di ogni riquadro (getComputedStyle costa: si rilegge solo a un refresh pieno) */
  var ptr = { x: -1e4, y: -1e4, t: -99, vx: 0, vy: 0, sp: 0, still: 0, touch: false, down: false };
  var now = 0, lastIn = 0, openedAt = 0, frenchDone = false, last = 0, raf = 0, lastF = null, life = { blinkAt: 2, blinkT: -9, dbl: false, slow: -9, earAt: 3, glAt: 1, gl: 0, glY: 0, petNear: 0, fezRoll: 0, fezRollV: 0, propAt: 14, propIx: 0, propList: null };
  var drag = null, fake = null, script = null;

  function px() { return K * cat.s; }                                          /* pixel per unità adesso */
  function toPage(mx, my) { var k = px(); return { x: cat.x + mx * k, y: cat.y - cat.lift - my * k }; }

  /* ------------------------------------------------------------------ il mondo: i riquadri e i loro bordi */
  function readView() { view.sx = window.pageXOffset || 0; view.sy = window.pageYOffset || 0; view.vw = doc.documentElement.clientWidth || window.innerWidth; view.vh = window.innerHeight; }
  /* toglie da una lista di tratti [a, b] l'intervallo [a2, b2] */
  function cutSegs(segs, a2, b2) { var out = [], k, s; for (k = 0; k < segs.length; k++) { s = segs[k]; if (b2 <= s[0] || a2 >= s[1]) out.push(s); else { if (a2 > s[0]) out.push([s[0], a2]); if (b2 < s[1]) out.push([b2, s[1]]); } } return out; }
  /* il riquadro n sta «sopra» un bordo alto y: da 2 px sotto a 84 px sopra (la statura del gatto col fez) */
  function above(n, y) { return !(n.b < y - 84 || n.t > y + 2); }
  /* rilegge i riquadri. fast: senza rileggere gli stili (mentre li si segue durante un'animazione).
     Il gatto resta attaccato al suo riquadro anche se si è spostato; se il suo posto non c'è più, B.evict dice perché e step() lo fa spostare */
  function readWorld(fast) {
    readView(); readInset();
    var els = doc.querySelectorAll(O.tiles), i, j, r, el, mode, rad, t, tiles = [], plats = [], no = [], qt = [], oldPlat = cat.plat, oldTiles = world.tiles;
    for (i = 0; i < els.length; i++) {
      el = els[i]; r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 24) continue;
      mode = el.getAttribute("data-dot") || ""; rad = radOf && fast ? radOf.get(el) : undefined;
      if (rad == null) { rad = 30; try { rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; } catch (e) { rad = 30; } if (radOf) radOf.set(el, rad); }
      t = { el: el, l: r.left + view.sx, t: r.top + view.sy, r: r.right + view.sx, b: r.bottom + view.sy, w: r.width, h: r.height, mode: mode, rad: rad };
      tiles.push(t); if (mode === "no") no.push(t); else if (mode === "quiet") qt.push(t);
    }
    var cut = no.slice(); if (stageOn && stage.rim) { try { var rm = stage.rim(), bh = B.home || { y: rm.y }; cut.push({ l: rm.x - rm.w / 2 - 8, r: rm.x + rm.w / 2 + 8, t: rm.y - 8, b: bh.y, m: 10 }); } catch (e) {} }
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; if (t.mode === "no") continue;
      var m = Math.max(24, t.rad * 0.6 + 12), segs = [[t.l + m, t.r - m]], qz = [], k, q;
      for (j = 0; j < cut.length; j++) { var n = cut[j], mm = n.m || 34; if (above(n, t.t)) segs = cutSegs(segs, n.l - mm, n.r + mm); }   /* mai sopra il Corano (né dentro la scatola): si taglia il tratto che gli sta sotto */
      for (j = 0; j < qt.length; j++) if (qt[j] !== t && above(qt[j], t.t)) qz.push([qt[j].l - 30, qt[j].r + 30]);
      /* sotto un riquadro «quiet» (e sul suo bordo) il tratto resta, ma è segnato: ci si può cadere, mai restarci */
      for (j = 0; j < segs.length; j++) {
        var parts = [[segs[j][0], segs[j][1], t.mode === "quiet"]];
        for (k = 0; k < qz.length; k++) { var np2 = []; for (q = 0; q < parts.length; q++) { var pa = parts[q], za = qz[k][0], zb = qz[k][1];
          if (zb <= pa[0] || za >= pa[1]) { np2.push(pa); continue; }
          if (za > pa[0]) np2.push([pa[0], za, pa[2]]); np2.push([Math.max(pa[0], za), Math.min(pa[1], zb), true]); if (zb < pa[1]) np2.push([zb, pa[1], pa[2]]); }
          parts = np2; }
        for (q = 0; q < parts.length; q++) if (parts[q][1] - parts[q][0] >= 26) plats.push({ el: t.el, tile: t, a: parts[q][0], b: parts[q][1], y: t.t, quiet: parts[q][2] });
      }
    }
    /* chi si è mosso: per ogni riquadro di prima, di quanto (o se non c'è più) */
    var moved = [], any = false, ot, nt;
    for (i = 0; i < oldTiles.length; i++) { ot = oldTiles[i]; nt = null; for (j = 0; j < tiles.length; j++) if (tiles[j].el === ot.el) { nt = tiles[j]; break; }
      moved.push({ el: ot.el, o: ot, n: nt, dx: nt ? nt.l - ot.l : 0, dy: nt ? nt.t - ot.t : 0 });
      if (!nt || Math.abs(nt.l - ot.l) > 0.3 || Math.abs(nt.t - ot.t) > 0.3 || Math.abs(nt.w - ot.w) > 0.3) any = true; }
    world.tiles = tiles; world.plats = plats; world.no = cut; world.quiet = qt; world.moved = moved;
    if (oldPlat) {                                                             /* il gatto resta attaccato al suo riquadro */
      var mo = moveOf(oldPlat.el), ntl = mo ? mo.n : tileOf(oldPlat.el), otl = mo ? mo.o : oldPlat.tile;
      if (!ntl) { cat.plat = null; B.evict = onEdge() ? "lost" : null; }
      else {
        var want = ntl.l + (cat.x - otl.l) * (otl.w > 1 ? ntl.w / otl.w : 1), pn = platFor(oldPlat.el, want), gap = pn ? (want < pn.a ? pn.a - want : want > pn.b ? want - pn.b : 0) : 1e9;
        B.evict = null;
        if (onEdge()) {
          cat.y = ntl.t; cat.gy = ntl.t; cat.plat = pn;
          if (pn && gap <= 8) { cat.x = clamp(want, pn.a, pn.b); if (pn.quiet) B.evict = "quiet"; }
          else { cat.x = want; B.evict = pn ? "spot" : "lost"; }             /* il suo posto non c'è più (ora sotto il Corano, o il riquadro si è stretto) */
        } else { cat.plat = pn; if (mo) { cat.x += mo.dx; cat.y += mo.dy; if (cat.gy != null) cat.gy += mo.dy; } }
      }
    } else B.evict = null;
    if (any) follow();
    world.at = now;
  }
  function moveOf(el) { var i, m = world.moved || []; for (i = 0; i < m.length; i++) if (m[i].el === el) return m[i]; return null; }
  function tileOf(el) { var i; for (i = 0; i < world.tiles.length; i++) if (world.tiles[i].el === el) return world.tiles[i]; return null; }
  /* il tratto di bordo del riquadro el più vicino a x (o null) */
  function platFor(el, x) { var i, p, best = null, bd = 1e9, d; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (p.el !== el) continue; d = x < p.a ? p.a - x : x > p.b ? x - p.b : 0; if (d < bd) { bd = d; best = p; } } return best; }
  /* un bordo ricordato da prima di una rilettura: quello di adesso, dello stesso riquadro, vicino a x */
  function fresh(p, x) { if (!p || world.plats.indexOf(p) >= 0) return p; return p.el ? platFor(p.el, x == null ? (p.a + p.b) / 2 : x) : null; }
  /* i riquadri si sono mossi: chi era in viaggio verso di loro (un salto, un'uscita dalla scatola, una sbirciata), i graffi, il fez e gli oggetti li seguono */
  function follow() {
    var d = cat.d, s = cat.state, m, np, i;
    if (s === "air" && d.q) {                                                  /* il salto finisce dove il bordo è adesso: lo scarto entra piano nel resto del volo */
      m = moveOf(d.q.el); var u = sat(cat.st / d.dur), ob = d.oB || { x: 0, y: 0 }, oa = d.oA || { x: 0, y: 0 }, w = d.oB ? (d.ou >= 0.98 ? 1 : eIO(seg(u, d.ou, 1))) : 0;
      np = m && m.n ? platFor(d.q.el, d.x1 + ob.x + m.dx) : null;
      if (!np) d.q = null;
      else { var nx = clamp(d.x1 + ob.x + (m ? m.dx : 0), np.a, np.b); d.oA = { x: lerp(oa.x, ob.x, w), y: lerp(oa.y, ob.y, w) }; d.oB = { x: nx - d.x1, y: np.y - d.y1 }; d.ou = u; d.q = np; }
    }
    if (s === "crouch" && d.q) { m = moveOf(d.q.el); np = m && m.n ? platFor(d.q.el, d.tx + m.dx) : null; if (np) { d.tx = clamp(d.tx + m.dx, np.a, np.b); d.ty = np.y; } d.q = np; }
    if (s === "fall" && d.p) d.p = fresh(d.p, cat.x);
    if ((s === "peek" || s === "opening" || s === "boxexit") && d.p) {
      m = moveOf(d.p.el); var kx = s === "peek" ? "x" : "lx";
      if (m && m.n && d[kx] != null) { np = platFor(d.p.el, d[kx] + m.dx); if (np) d[kx] = clamp(d[kx] + m.dx, np.a, np.b); d.p = np; } else if (m && !m.n) d.p = null;
    }
    if (cat.plat && (s === "walk" || s === "dive")) { m = moveOf(cat.plat.el); if (m) { if (s === "walk" && d.tx != null) d.tx = clamp(d.tx + m.dx, cat.plat.a, cat.plat.b); if (s === "dive" && d.e != null) d.e += m.dy; } }
    if ((s === "slide" || s === "hang") && d.t) {
      m = moveOf(d.t.el);
      if (m && m.n) { cat.x += m.dx; cat.y += m.dy; if (d.edgeY != null) d.edgeY += m.dy; d.t = m.n; } else if (m) { if (d.sc) { d.sc.done(); d.sc = null; } reanchor(below() - below("air")); set("fall", { vy: 0, face: "view", pose: "air" }); }
    }
    for (i = 0; i < scratches.length; i++) { m = scratches[i].el ? moveOf(scratches[i].el) : null; if (m && m.n && (m.dx || m.dy)) scratches[i].move(m.dx, m.dy); }
    if (fez && fez.wall) { m = moveOf(fez.wall.el);
      if (m && m.n) { if (m.dx || m.dy) { fez.b.x += m.dx; fez.b.y += m.dy; fez.wall.l += m.dx; fez.wall.r += m.dx; } }
      else if (m && !fez.hold) { fez.wall = null; fez.lost = true; } }               /* il suo riquadro non c'è più: torna in testa appena può */
    for (i = 0; i < props.length; i++) { var pr = props[i]; m = pr.el ? moveOf(pr.el) : null; if (!m || pr.held || pr.front) continue;
      if (!m.n) { goneProp(pr); continue; }
      if (m.dx || m.dy) { pr.x += m.dx; pr.y += m.dy; if (pr.b) { pr.b.x += m.dx; pr.b.y += m.dy; } if (pr.tw) { pr.tw.x += m.dx; pr.tw.y += m.dy; } if (pr.home && pr.name !== "star") { pr.home.x += m.dx; pr.home.y += m.dy; } } }
  }
  function onEdge() { var s = cat.state; return !(s === "air" || s === "held" || s === "fall" || s === "fly" || s === "slide" || s === "hang" || s === "opening" || s === "boxed" || s === "box"); }
  function landOn(p) { cat.plat = p; cat.y = p.y; cat.gy = p.y; cat.rel = cat.x - p.tile.l; }
  /* «si vede»: sopra e sotto ci possono essere strisce coperte (una barra in alto view.ti, la barra dell'anteprima o di Safari in fondo view.bi): lì non si vede */
  function inView(y, top, bot) { return y > view.sy + view.ti + (top || 0) && y < view.sy + view.vh - view.bi - (bot || 0); }
  function catInView() { var k = px(); return cat.y - 24 * k > view.sy + view.ti + 30 && cat.y - 10 * k < view.sy + view.vh - view.bi + 4; }
  function inset(b) { var v = 0; try { v = typeof b === "function" ? +b() : +b; } catch (e) { v = 0; } return v > 0 && v < view.vh * 0.5 ? v : 0; }
  function readInset() { view.bi = inset(O.bottomInset); view.ti = inset(O.topInset); }
  function visPlats(any) { var o = [], i, p; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if ((any || !p.quiet) && inView(p.y, 96, 26) && p.a < view.sx + view.vw - 30 && p.b > view.sx + 30) o.push(p); } return o; }
  /* i riquadri «quiet» (il riquadro sui conflitti): il gatto non ci sta, non ci gioca, non ci parla */
  function rectHits(list, x0, y0, x1, y1) { var i, n; for (i = 0; i < list.length; i++) { n = list[i]; if (x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return n; } return null; }
  function overQuiet(m) { var b = catBox(); if (!b || !cat.vis) return false; m = m || 0; return !!rectHits(world.quiet, b.x0 - m, b.y0 - m, b.x1 + m, b.y1 + m); }
  function onQuiet() { return !!(cat.plat && cat.plat.quiet) || overQuiet(2); }
  function gameRoom() { return !onQuiet() && !rectHits(world.quiet, cat.x - 150, cat.y - 170, cat.x + 150, cat.y + 30); }   /* spazio per un gioco o un oggetto, lontano dal riquadro quiet */
  /* sotto un riquadro «no» (il Corano): fez compreso, il gatto lo coprirebbe */
  function underNo(x, y) { var j, n; for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (!n.m && above(n, y) && x > n.l - 34 && x < n.r + 34) return true; } return false; }
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
    if (face === "low") return dir > 0 ? -PI / 2 + 0.72 : -PI / 2 - 0.72;   /* sdraiato sciolto: un po' più di lato che «view», il corpo steso si vede */
    return dir > 0 ? Y.viewRight : Y.viewLeft;
  }
  function aligned(tol) { return Math.abs(wrap(rig.yaw - rig.yawT)) < (tol || 0.4); }
  function set(state, d) {
    if (cat.state === "slide" && cat.d.sc) cat.d.sc.done();
    if (cat.state !== state && (cat.state === "purr" || cat.state === "pet" || cat.state === "melt") && state !== "melt") sound("purr", false);   /* le fusa finiscono con lo stato */
    if (fez && fez.hold && state !== "fezoff") fez.hold = false;      /* interrotto mentre lanciava il fez: il fez ricade da solo */
    cat.state = state; cat.st = 0; cat.d = d || {};
    cat.jit = 0; cat.tangle = 0; rig.headRoll = 0; life.fezRollT = 0;   /* valori che uno stato rimette a ogni fotogramma: se lo stato è interrotto non restano */
    rig.over = {}; rig.walkT = 0; rig.pitchT = 0; rig.rollT = 0; rig.longT = 0; rig.tailSwish = 0; rig.tailRate = 0; rig.grounded = true; rig.rate = 12; rig.pupilT = 0.8; rig.pupilDotT = 0;
    rig.headMax = HEADMAX; rig.breathRate = 1.9; rig.turn = 9;
    rig.poseAs = null; rig.edge = null; rig.eyeMood = null; rig.faceTurn = null; rig.gaitT = null; cat.moodKeys = null;
    cat.clipAt = null; cat.clipTop = null; cat.hideL = cat.hideR = null; cat.paws = false; cat.att = null; cat.gz = true; cat.ownRot = false;
    if (cat.d.face) cat.face = cat.d.face; if (cat.d.pose) rig.pose = cat.d.pose;
  }
  function think() { if (reduced) return sitFor(1e9); set("think"); }   /* movimento ridotto: resta seduto */
  function sitFor(dur, o) { var d = o || {}; d.dur = dur; d.face = d.face || "view"; d.pose = d.pose || "sit"; set("sit", d); }
  /* sposta l'origine del gatto di dy unità (in giù sullo schermo se dy > 0) senza che il disegno salti:
     lo scarto rientra con la stessa molla della posa, così il corpo resta dov'è mentre le zampe si riordinano */
  function reanchor(dy) { cat.y += dy * px(); cat.voff += dy; }
  /* quante unità sta il centro del corpo sotto l'origine, adesso o in una posa */
  function below(name) { var p = name ? rig.poses[name] : rig.A; return -(p.hy + p.cy) / 2; }
  /* lo stato d'animo che resta anche quando cambia quello che fa: "annoyed" (orecchie basse, sguardo storto), "proud", "scared" */
  function moodSet(kind, sec) { cat.mood = { k: kind, t0: now, until: now + sec }; }
  function applyMood() {
    var m = cat.mood, keys = cat.moodKeys, i; if (keys) { for (i = 0; i < keys.length; i++) delete rig.over[keys[i]]; cat.moodKeys = null; }
    if (!m) return; if (now > m.until) { cat.mood = null; return; }
    var f = smooth(0, 0.25, now - m.t0) * (1 - smooth(m.until - 1.2, m.until, now)), add = {}, k;
    if (m.k === "annoyed") { add.ear = 0.5 * f; add.brow = 0.55 * f; add.lid = 0.32 * f; if (!rig.tailSwish) { rig.tailSwish = 0.3 * f; rig.tailRate = 4; } }
    else if (m.k === "proud") { add.hp = 0.1 * f; add.lid = 0.22 * f; }
    else if (m.k === "scared") { add.ear = 0.35 * f; add.eye = 0.12 * f; }
    var base = rig.poses[rig.pose] || rig.poses.sit; keys = [];
    for (k in add) if (!rig.over.hasOwnProperty(k)) { rig.over[k] = k === "hp" ? base.hp + add.hp : k === "eye" ? base.eye * (1 + add.eye) : Math.max(base[k], add[k]); keys.push(k); }   /* si somma alla posa, non la sostituisce */
    cat.moodKeys = keys;
  }
  function fx() { return DOT.fx; }
  function sound(n, a) { try { if (DOT.sound && typeof DOT.sound[n] === "function") DOT.sound[n](a); } catch (e) {} }
  function say(text, sec, kind) { if (bubble) bubble.say(text, sec || 3, kind); }

  /* ------------------------------------------------------------------ la vita di tutti i giorni */
  var IDLE = { walk: 0.24, jump: 0.15, sit: 0.13, look: 0.08, loaf: 0.07, sleep: 0.05, groom: 0.07, yawn: 0.04, stretch: 0.04, drape: 0.05, dive: 0.05, prop: 0.12 };
  var SLEEPY = { walk: 0.1, jump: 0.05, sit: 0.08, look: 0.04, loaf: 0.14, sleep: 0.22, groom: 0.11, yawn: 0.09, stretch: 0.05, drape: 0.09, dive: 0.02, prop: 0.05 };
  function decide() {
    var p = cat.plat;
    if (reduced) { if (!p || p.quiet || !catInView()) return comeBack(); return sitFor(1e9); }
    if (!p || !catInView()) return comeBack();
    if (p.quiet || onQuiet()) return leaveQuiet();                     /* sul riquadro «quiet» (o sotto) non resta: se ne va subito, senza storie */
    if (underNo(cat.x, cat.y)) return escapeJump();
    if (fez && !rig.fezOn && fezReach()) return fetchFez();           /* il fez è per terra (un tocco interrotto): prima va a riprenderlo, se ci arriva */
    var w = {}, k, base = now - lastIn > 25 ? SLEEPY : IDLE; for (k in base) w[k] = base[k];
    if (now < life.propAt || props.length || !gameRoom()) w.prop = 0;   /* niente oggetti vicino al riquadro quiet */
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
  function jumpTo(q, x, then, o) { q = fresh(q, x); if (!q) return think(); var d = o || {}; d.q = q; d.tx = clamp(x, q.a, q.b); d.ty = q.y; d.then = then; d.face = "side"; d.pose = "crouch"; cat.dir = d.tx >= cat.x ? 1 : -1; set("crouch", d); }
  /* via dal riquadro «quiet» (o da sotto): un salto svelto verso il bordo buono più vicino; se non se ne vede nessuno, uno qualsiasi
     raggiungibile; se proprio non c'è, si nasconde dietro il bordo e aspetta fuori vista. Niente scrollate, niente nuvolette, niente giochi */
  function leaveQuiet() {
    clearHeld(); var o = cat.plat ? jumpTargets(cat.plat, 520) : [], i, q, tx, best = null, bs = 1e9;
    if (o.length) { o.sort(function (a, b) { return hyp(a.x - cat.x, a.p.y - cat.y) - hyp(b.x - cat.x, b.p.y - cat.y); }); return jumpTo(o[0].p, o[0].x, "sit", { quick: true }); }
    for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (q.quiet || q === cat.plat) continue; tx = clamp(cat.x, q.a + 6, q.b - 6);
      if (Math.abs(q.y - cat.y) > 520 || Math.abs(tx - cat.x) > 380 || arcHitsNo(cat.x, cat.y, tx, q.y, 24)) continue; var sc = hyp(tx - cat.x, q.y - cat.y); if (sc < bs) { bs = sc; best = { p: q, x: tx }; } }
    if (best) return jumpTo(best.p, best.x, "sit", { quick: true });
    if (cat.plat) return set("dive", { away: true, face: "side", pose: "crouch" });
    cat.vis = false; set("wait");
  }
  /* torna dove lo si vede: spunta da dietro il bordo di un riquadro visibile, oppure ci salta dentro da fuori (mai su un riquadro quiet: allora aspetta fuori vista) */
  function comeBack() {
    var v = visPlats(); if (!v.length) { cat.vis = false; set("wait"); return; }
    v.sort(function (a, b) { return Math.abs(a.y - cat.y) - Math.abs(b.y - cat.y); });
    var q = v[0], x = clamp(cat.x, q.a + 10, q.b - 10);
    clearHeld();
    if (reduced) { cat.x = x; landOn(q); cat.vis = true; cat.voff = 0; cat.voffV = 0; cat.lift = 0; cat.rot = 0; cat.s = 1; sitFor(1e9); rig.snap("sit"); return; }   /* movimento ridotto: è già lì, seduto */
    if (rnd() >= 0.62 && cat.state !== "wait") {                      /* entra con un salto da fuori: da sotto o da sopra, dal lato il cui arco non passa davanti al Corano */
      var fromTop = cat.y < view.sy, sy = fromTop ? view.sy - 30 : view.sy + view.vh + 70, hi = fromTop ? 16 : 40, s0 = rnd() < 0.5 ? -1 : 1, i, sx;
      for (i = 0; i < 2; i++) { sx = clamp(x + (i ? -s0 : s0) * 60, view.sx + 20, view.sx + view.vw - 20);
        if (!arcHitsNo(sx, sy, x, q.y, hi)) { cat.x = sx; cat.y = sy; cat.gy = null; cat.plat = null; jumpTo(q, x, "sit", { quick: true, high: hi }); return; } }
    }
    cat.x = x; cat.plat = q; set("peek", { p: q, x: x });             /* spunta da dietro il bordo: non attraversa nulla */
  }
  /* cadere da (x, y) passerebbe davanti al Corano? allora salta di lato su un bordo raggiungibile (o torna altrove) */
  function fallBlocked(x, y) {
    var p = platBelow(x, y), ly = p ? p.y : Infinity, i, n;
    for (i = 0; i < world.no.length; i++) { n = world.no[i]; if (n.m) continue; if (x > n.l - 24 && x < n.r + 24 && n.b > y && n.t < ly) return true; }
    return false;
  }
  /* il gatto con i piedi in (x, y) sta davanti a un riquadro «no» (o alla scatola)? */
  function inNo(x, y) { var j, n; for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (x > n.l - 26 && x < n.r + 26 && y > n.t - 6 && y - 60 < n.b) return true; } return false; }
  /* l'arco vero di un salto (lo stesso di arc()): quanti punti passano davanti a un riquadro «no», e se ci rientra dopo esserne uscito */
  function arcNo(x0, y0, x1, y1, c) {
    var d = arc(x0, y0, x1, y1, c), i, u, tt, hit, out = !inNo(x0, y0), n = 0, re = false;
    for (i = 1; i <= 16; i++) { u = i / 16; tt = u * d.dur; hit = inNo(lerp(x0, x1, u), y0 + d.vy0 * tt + 0.5 * GRAV * tt * tt);
      if (hit) { n++; if (out) re = true; } else out = true; }
    return { n: n, re: re };
  }
  function arcHitsNo(x0, y0, x1, y1, c) { var a = arcNo(x0, y0, x1, y1, c); return a.n > 0; }
  /* via da davanti al Corano (o da una caduta che ci passerebbe davanti): un salto vero, da dove è, al bordo migliore.
     Se parte già davanti al Corano va bene uscirne, mai rientrarci; meglio i bordi visibili, vicini, verso l'alto */
  function escapeJump() {
    var i, q, tx, a, sc, best = null, bs = 1e9, inside = inNo(cat.x, cat.y);
    for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; tx = clamp(cat.x, q.a + 6, q.b - 6); a = arcNo(cat.x, cat.y, tx, q.y, 24);
      sc = hyp(tx - cat.x, q.y - cat.y) + a.n * 40 + (a.re ? 3000 : 0) + (q.quiet ? 5000 : 0) + (inView(q.y, 60, 20) ? 0 : 500) + (inside && q.y > cat.y + 20 ? 140 : 0);
      if (sc < bs) { bs = sc; best = { p: q, x: tx }; } }
    if (!best) return comeBack();
    cat.plat = null; cat.dir = best.x >= cat.x ? 1 : -1;
    set("air", arc(cat.x, cat.y, best.x, best.p.y, 24, { q: best.p, then: "shake", face: "side", pose: "air" }));
  }
  function clearHeld() { var i; for (i = 0; i < props.length; i++) if (props[i].held) dropProp(props[i]); }
  /* dopo una rilettura dei riquadri il suo posto non va più bene: why = "lost" (il riquadro non c'è più), "spot" (il suo punto
     del bordo non c'è più: ora sta sotto il Corano, o il riquadro si è stretto), "quiet" (ora è sul riquadro quiet o sotto) */
  function relocate(why) {
    clearHeld();
    if (reduced) return comeBack();
    if (inNo(cat.x, cat.y) || underNo(cat.x, cat.y)) return escapeJump();
    if (why === "quiet" || (cat.plat && cat.plat.quiet)) return leaveQuiet();
    if (why === "spot" && cat.plat && Math.abs(clamp(cat.x, cat.plat.a, cat.plat.b) - cat.x) < 60) return walkTo(clamp(cat.x, cat.plat.a + 4, cat.plat.b - 4), "sit");
    var p = platBelow(cat.x, cat.y + 2);                                 /* il bordo sotto i piedi è sparito: cade sul primo sotto, o salta via se cadrebbe davanti al Corano */
    reanchor(below() - below("air")); cat.plat = null;
    if (p && !fallBlocked(cat.x, cat.y) && p.y - cat.y < view.vh) return set("fall", { p: p, vy: 0, face: "view", pose: "air" });
    escapeJump();
  }

  /* i passi: lento (pigro), normale, trotto; v in px al secondo, t = durata di un ciclo */
  var GAITS = { stroll: { v: 30, t: 0.56 }, walk: { v: 42, t: 0.46 }, trot: { v: 74, t: 0.34 } };
  var STATES = {
    off: function () {}, wait: function () { cat.vis = false; if (cat.st > 0.6) { cat.st = 0; var v = visPlats(); if (v.length) { cat.vis = true; comeBack(); } } },
    think: function () { decide(); },
    sit: function (dt, d) {
      var st = cat.st; if (d.plop == null) d.plop = Math.abs(rig.A.hy - rig.poses.sit.hy) > 1.5;
      if (st < 0.5 && d.plop) { var pl = bell(seg(st, 0.12, 0.32)) - 0.35 * bell(seg(st, 0.32, 0.5)); rig.over.sqy = 1 - 0.045 * pl; rig.over.sqx = 1 + 0.03 * pl; } else if (!d.pl) { d.pl = 1; delete rig.over.sqy; delete rig.over.sqx; }   /* si siede con un piccolo «plof» */
      if (rig.pose === "sit" && d.mood !== "proud" && !reduced) rig.over.hr = rig.poses.sit.hr + 0.07 * Math.sin(now * 0.43 + 1.3) * smooth(0.4, 1.4, st);   /* da fermo la testa ondeggia piano: non è una foto */
      if (d.mood === "proud") { rig.over.hp = 0.14; rig.over.lid = 0.28; } if (st > d.dur) { if (d.then) d.then(); else think(); }
    },
    pause: function (dt, d) { rig.pose = "stand"; if (cat.st > (d.dur || 0.8)) think(); },
    look: function (dt, d) {                                           /* curioso: la testa scatta, il corpo no */
      if (!d.at || now > d.at) { d.at = now + rr(0.5, 1.2); d.tx = rnd() < 0.3 ? null : { x: cat.x + rr(-220, 220), y: cat.y - rr(-30, 160) }; }
      cat.att = d.tx; if (cat.st > d.dur) think();
    },
    walk: function (dt, d) {                                           /* prima si gira (passetti sul posto, la testa per prima), poi parte piano, va, rallenta */
      var p = cat.plat; if (!p) return think();
      if (!d.g) { var dist = Math.abs(d.tx - cat.x); d.g = d.speed ? { v: d.speed, t: 0.46 * Math.sqrt(42 / d.speed) } : GAITS[d.gait || (dist > 160 && rnd() < 0.4 ? "trot" : dist < 70 || now - lastIn > 25 ? "stroll" : "walk")]; d.go = 0; }
      var left = (d.tx - cat.x) * cat.dir, g = d.g, spd = 0; rig.gaitT = g.t; if (g === GAITS.trot) rig.headMax = null;   /* di corsa il profilo vero va bene */
      if (cat.st < 0.3) cat.att = { x: d.tx + cat.dir * 60, y: cat.y - 24 * px() };                     /* la testa parte per prima */
      if (aligned(0.32)) { d.go += dt; spd = g.v * (0.12 + 0.88 * smooth(0, 0.42, d.go)) * (0.3 + 0.7 * smooth(0, 22, left)); }
      rig.walkT = 1; rig.speedU = spd / (px() * Math.max(0.35, Math.abs(Math.cos(rig.yaw)))); cat.coast = spd * cat.dir;   /* il piede a terra resta fermo sullo schermo anche col corpo di tre quarti */
      if (cat.mood && cat.mood.k === "annoyed") { rig.over.te = 1.2; rig.over.tc = 0.15; rig.tailSwish = 0.25; rig.tailRate = 5; rig.faceTurn = 0; cat.gz = false; rig.look.ty = 0; rig.look.tp = 0.16; rig.gazeT[0].x = rig.gazeT[1].x = 0; }   /* se ne va offeso: coda dritta, naso all'insù, non ti guarda */
      cat.x += cat.dir * rig.walk * spd * dt;
      if (left <= 1 || cat.x < p.a - 2 || cat.x > p.b + 2) { cat.x = clamp(cat.x, p.a, p.b); rig.walkT = 0; var th = d.then;
        if (typeof th === "function") th(); else if (th === "sit") sitFor(rr(1.8, 3.6)); else if (th === "none") {} else set("pause", { pose: "stand", dur: rr(0.5, 1.1) }); }
    },
    crouch: function (dt, d) {                                         /* l'anticipo: si carica come una molla, il sedere ondeggia, le zampe spingono, parte */
      if (!d.q) return think();                                        /* il bordo dove voleva saltare non c'è più */
      var st = cat.st, dist = hyp(d.tx - cat.x, d.ty - cat.y), need = d.quick ? 0.2 : dist > 140 ? 0.66 : 0.42, Cl = rig.poses["b-coil"];
      rig.pose = "b-coil"; rig.rate = 14;
      if (dist > 140 && !d.quick) { var w = seg(st, 0.14, 0.24) * (1 - seg(st, need - 0.2, need - 0.12)); rig.over.hy = Cl.hy + 1.9 * Math.sin(st * 23) * w; rig.yawT += 0.08 * Math.sin(st * 23 + 1.2) * w; rig.tailSwish = 0.45 * w; rig.tailRate = 7; }
      if (st > need - 0.09) { rig.pose = "b-launch"; rig.rate = 30; delete rig.over.hy; rig.over.sqy = 1.06; rig.over.sqx = 0.96; }   /* le zampe dietro si stendono di scatto: il corpo sale e si allunga prima di staccarsi */
      cat.att = { x: d.tx, y: d.ty - 20 }; rig.pupilT = 1;
      if (st > need && (aligned(0.6) || d.quick)) {
        set("air", arc(cat.x, cat.y, d.tx, d.ty, d.high, { q: d.q, then: d.then, face: "side", pose: "b-launch", grow: d.grow }));
        cat.plat = null;
      }
    },
    air: function (dt, d) {                                            /* in volo: una parabola vera (gravità), il corpo si allunga salendo, le zampe davanti cercano il bordo */
      var u = sat(cat.st / d.dur), tt = u * d.dur, ox = 0, oy = 0; rig.grounded = false; rig.rate = 15;
      if (d.oB) { var w = d.ou >= 0.98 ? 1 : eIO(seg(u, d.ou, 1)); ox = lerp(d.oA.x, d.oB.x, w); oy = lerp(d.oA.y, d.oB.y, w); }   /* il bordo d'arrivo si è spostato (refresh, rotazione): lo scarto entra piano nel resto del volo */
      cat.x = lerp(d.x0, d.x1, u) + ox; cat.y = (d.vy0 != null ? d.y0 + d.vy0 * tt + 0.5 * GRAV * tt * tt : lerp(d.y0, d.y1, u) - 4 * d.h * u * (1 - u)) + oy;
      var below0 = platBelow(cat.x, cat.y); cat.gy = below0 ? below0.y : null;
      var vx = (d.x1 - d.x0) / d.dur, vy = d.vy0 != null ? d.vy0 + GRAV * tt : ((d.y1 - d.y0) - 4 * d.h * (1 - 2 * u)) / d.dur;
      flight(u, vx, vy, d.mid);
      if (d.grow) cat.s = lerp(d.grow, 1, eOut(u));
      cat.att = { x: d.x1 + ox + cat.dir * 40, y: d.y1 + oy - 10 }; cat.gz = true;
      if (u >= 1) {
        if (!d.q) { set("fall", { vy: Math.max(0, vy), vx: vx * 0.3, face: "view", pose: "air" }); return; }   /* il bordo d'arrivo è sparito in volo: continua a cadere */
        cat.x = d.x1 + ox; landOn(d.q);
        if (d.q.quiet) set("land", { then: leaveQuiet, v: Math.abs(vy), quiet: true, face: "side", pose: "land" });   /* sul riquadro quiet: atterra e riparte, niente scrollata */
        else set("land", { then: d.then, v: Math.abs(vy), face: "side", pose: "land" });
      }
    },
    land: function (dt, d) {                                           /* schiaccia, rimbalza un filo, si assesta; orecchie e coda arrivano dopo */
      var st = cat.st, hard = clamp(d.v / 900, 0.3, 1); rig.rate = 18;
      if (st < 0.09) { rig.pose = "land"; rig.over.sqy = 1 - 0.2 * hard; rig.over.sqx = 1 + 0.12 * hard; }
      else if (st < 0.22) { rig.pose = "crouch"; rig.over.sqy = 1 + 0.035 * hard; rig.over.sqx = 0.985; }
      else { rig.pose = "stand"; delete rig.over.sqy; delete rig.over.sqx; }
      rig.over.ear = 0.42 * hard * bell(seg(st, 0.03, 0.36));
      if (!d.kick) { d.kick = 1; life.fezRollV += 2.6 * hard * cat.dir; life.tailKick = 0.75 * hard; }
      if (st > (d.quiet ? 0.24 : 0.4)) { var th = d.then;
        if (cat.plat && cat.plat.quiet && th !== leaveQuiet) th = leaveQuiet;   /* comunque sia arrivato sul riquadro quiet, riparte subito */
        else if (cat.plat && th !== "none" && th !== leaveQuiet && underNo(cat.x, cat.y)) { escapeJump(); return; }
        if (typeof th === "function") th(); else if (th === "shake") set("shake", { face: "side", pose: "stand" }); else if (th === "none") {} else if (fez && !rig.fezOn && cat.plat && !reduced && fezReach()) fetchFez(); else sitFor(rr(1.6, 3.2)); }
    },
    shake: function (dt, d) {                                          /* si scrolla: la testa vibra, il fez ondeggia, poi torna composto */
      var st = cat.st, e = sat(1 - st / 0.75); rig.headRoll = 0.42 * Math.sin(st * 30) * e * seg(st, 0, 0.06); rig.over.ear = 0.3 * e; rig.over.eye = 0.4 + 0.6 * (1 - e);
      if (st < 0.05) life.fezRollV += 1.5; if (st > 0.85) { rig.headRoll = 0; sitFor(rr(1.5, 2.5), d.annoyed ? { pose: "annoyed" } : null); }
    },
    hop: function (dt, d) {                                            /* il saltello felice */
      var st = cat.st, u = seg(st, 0.2, 0.58); cat.ownLift = true;
      if (st < 0.2) { rig.pose = "b-coil"; cat.lift = 0; rig.over.eye = 1.1; }
      else if (u < 1) { rig.pose = u < 0.7 ? "air" : "b-reach"; rig.grounded = false; cat.lift = 4 * 22 * u * (1 - u) * px() / 1.5; rig.pitchT = 0.25 * (1 - 2 * u); rig.over.sqy = 1 + 0.06 * (1 - 2 * u); rig.over.sqx = 1 - 0.04 * (1 - 2 * u); }
      else { cat.lift = 0; rig.pitchT = 0; rig.pose = st < 0.7 ? "land" : "sit"; rig.over.sqy = st < 0.66 ? 0.9 : 1; rig.over.sqx = st < 0.66 ? 1.06 : 1; if (st < 0.6) life.fezRollV += 0.4 * cat.dir; }
      if (st > 0.62) { rig.over.eye = st < 1.3 ? 0 : 1; rig.eyeMood = "happy"; }
      if (st > 1.5) sitFor(rr(1.6, 2.6));
    },
    loaf: function (dt, d) { if (cat.st > d.dur) think(); },
    sleep: function (dt, d) {
      if (cat.st > 1.1) { rig.pose = "sleep"; life.fezRollT = 0.32; rig.tailRate = -1.1; rig.eyeMood = "sleep"; }
      if (cat.st > d.dur) { life.fezRollT = 0; set("wakeup", { face: "view", pose: "loaf" }); }
    },
    wakeup: function (dt) {                                            /* occhi lenti, stiracchiata, sbadiglio */
      var st = cat.st; rig.eyeMood = "sleep";
      if (st < 0.7) { rig.over.eye = 0.7 * seg(st, 0.1, 0.6); rig.over.lid = 0.45; }
      else if (st < 2.1) { cat.face = "side"; rig.pose = "stretch"; rig.over.eye = 0.15; }
      else if (st < 3.3) { cat.face = "view"; rig.pose = "yawn"; rig.over.mouth = bell(seg(st, 2.2, 3.2)) * 1.05; rig.over.eye = 0; }
      else sitFor(rr(2, 3));
    },
    groom: function (dt, d) {
      var st = cat.st, w = Math.sin(st * 8.5); rig.over.f0y = rig.poses.groom.f0y + 1.3 * w; rig.over.hp = rig.poses.groom.hp + 0.1 * Math.sin(st * 8.5 + 1.1); rig.over.eye = 0; rig.eyeMood = "happy";
      if (st > d.dur) { rig.over = {}; sitFor(rr(1.4, 2.4)); }
    },
    yawn: function (dt, d) {
      var st = cat.st; rig.pose = st < 1.5 ? "yawn" : "sit"; if (st < 1.5) { rig.over.mouth = bell(seg(st, 0.15, 1.4)) * 1.08; rig.over.eye = st < 0.25 ? 0.6 : 0; rig.eyeMood = "sleep"; }
      if (st > 1.5 && st < 2.2) rig.headRoll = 0.12 * Math.sin((st - 1.5) * 24) * (1 - seg(st, 1.5, 2.2));
      if (st > 2.3) { rig.headRoll = 0; sitFor(rr(1.6, 3)); }
    },
    stretch: function (dt) { var st = cat.st; rig.pose = st < 0.25 ? "stand" : st < 1.7 ? "stretch" : "stand"; if (st > 0.3 && st < 1.6) { rig.over.eye = 0.12; rig.eyeMood = "happy"; } if (st > 2) sitFor(rr(1.8, 3)); },
    drape: function (dt, d) {                                          /* sdraiato a cavallo del bordo: una zampa e la coda giù */
      var st = cat.st; rig.grounded = st < 0.5; rig.pose = st < 0.5 ? "loaf" : st < d.dur ? "drape" : "stand"; rig.tailSwish = 0.12; rig.tailRate = -0.6;
      if (st > 0.5 && st < d.dur && !d.glAt) d.glAt = now + rr(1.5, 3);
      if (d.glAt && now > d.glAt) { d.glAt = now + rr(2, 4); cat.att = rnd() < 0.5 ? null : { x: cat.x - cat.dir * 200, y: cat.y + 120 }; }
      if (st > d.dur + 0.5) sitFor(rr(1.5, 2.5));
    },
    dive: function (dt, d) {                                           /* si nasconde dietro il bordo, poi spunta (d.away: resta via, fuori vista) */
      var st = cat.st, p = cat.plat; if (!p) return think();
      if (!d.e) d.e = cat.y;
      if (st > (d.away ? 0.12 : 0.3)) { cat.clipAt = d.e; cat.hideL = p.tile.l; cat.hideR = p.tile.r; var u = seg(st, d.away ? 0.12 : 0.3, d.away ? 0.4 : 0.62); cat.y = d.e + eIn(u) * 46 * px(); rig.pose = "sit"; }
      if (d.away && st > 0.45) { cat.y = d.e; cat.vis = false; cat.plat = null; set("wait"); return; }
      if (st > 0.62 + (d.wait || 1.3)) { cat.y = d.e; cat.x = clamp(cat.x + rr(-50, 50), p.a + 6, p.b - 6); set("peek", { p: p, x: cat.x }); }
    },
    peek: function (dt, d) {                                           /* spunta dal bordo: orecchie, occhi, due zampe; si guarda attorno; poi sale davvero */
      if (!d.p) { cat.vis = false; return set("wait"); }                 /* il suo riquadro non c'è più */
      var st = cat.st, p = d.p, k = px(), P0 = rig.poses.peek; cat.plat = p; cat.x = d.x; cat.gy = null; cat.clipAt = p.y; cat.hideL = p.tile.l; cat.hideR = p.tile.r; rig.grounded = false;
      if (!d.dir) d.dir = room(p, d.x, 1) > room(p, d.x, -1) ? 1 : -1;
      if (!d.init) { d.init = 1; cat.face = "front"; rig.yawT = Y.front; rig.pose = "peek"; rig.over = d.ready ? {} : { f0y: P0.f0y - 9, f1y: P0.f1y - 9 }; rig.snap("peek"); cat.voff = 0; cat.voffV = 0; cat.rot = 0; if (d.ready) cat.paws = true; }   /* d.ready: c'è già, sbirciando (una visita successiva) */
      var tUp = 0.55, t1 = tUp + (d.first ? 2.0 : 1.7) + (d.hold || 0), c = st - t1;
      if (st < t1) {
        rig.pose = "peek"; cat.face = "front";
        cat.y = p.y + (d.ready ? 0 : (1 - eBack(seg(st, 0, tUp), 1.3)) * 28 * k); rig.over.ear = d.ready ? 0 : 0.25 * (1 - seg(st, 0.2, 0.55));
        if (!d.ready) { rig.over.f0y = P0.f0y - 9 * (1 - eBack(seg(st, 0.42, 0.64), 2)); rig.over.f1y = P0.f1y - 9 * (1 - eBack(seg(st, 0.47, 0.69), 2)); }   /* le zampe salgono sul bordo, una appena dopo l'altra */
        cat.paws = rig.A.f0y > P0.f0y - 1.8 && rig.A.f1y > P0.f1y - 1.8;
        if (st > tUp) { var lt = st - tUp; lookAround(lt < 0.5 ? null : lt < 1.0 ? -1 : lt < 1.45 ? 1 : null, 150); rig.pupilT = 1; }
      } else if (c < 0.2) {                                            /* si raccoglie: la testa si abbassa un attimo, il corpo comincia a girarsi */
        cat.y = p.y; cat.dir = d.dir; cat.face = "view"; rig.over = { dy: P0.dy - 1.8, hp: -0.12 }; cat.paws = true; rig.rate = 14; cat.att = { x: cat.x + d.dir * 120, y: p.y - 20 };
      } else if (c < 0.55) { rig.over = {}; cat.face = "side"; rig.pose = "b-pull"; cat.paws = true; rig.rate = 13; cat.att = { x: cat.x + d.dir * 140, y: p.y - 30 }; }
      else if (c < 0.92) { cat.face = "side"; rig.pose = "b-hoist"; cat.paws = false; rig.rate = 13; }
      else if (c < 1.22) { rig.pose = "stand"; rig.grounded = c > 1.0; if (c > 1.0) { cat.clipAt = null; cat.hideL = cat.hideR = null; } }
      else { landOn(p); rig.grounded = true; if (d.first) greet(); else sitFor(rr(2, 3.4)); }
    }
  };
  /* in volo: pose, allungamento, coda e muso che seguono la velocità; prima dell'arrivo si raddrizza (mai di pancia) */
  function flight(u, vx, vy, mid) {
    rig.pose = u < 0.14 ? "b-launch" : u < 0.6 ? (mid || "air") : "b-reach"; rig.over.eye = Math.max(1.02, (rig.poses[rig.pose] || {}).eye || 1);
    var s = clamp(-vy / 900, -0.6, 1) + (u < 0.06 ? 0.5 * (1 - u / 0.06) : 0);   /* salendo si allunga in verticale (al distacco ancora di più), scendendo poco; all'arrivo si schiaccia */
    rig.over.sqy = 1 + 0.08 * Math.abs(s); rig.over.sqx = 1 - 0.05 * Math.abs(s);
    rig.over.te = 0.35 + clamp(vy / 1500, -0.5, 0.6); rig.over.tc = 0.45 + 0.35 * sat(u * 1.6);
    var pt = clamp(Math.atan2(-vy, Math.abs(vx) + 70), -0.75, 0.75) * 0.7; if (pt < -0.32) pt = -0.32; if (pt > 0.28) pt = 0.28;   /* salendo il muso va in su solo un poco: guardano gli occhi (così il fez resta in cima, non sulla faccia) */
    rig.pitchT = lerp(pt, -0.08, smooth(0.62, 0.92, u));
  }
  /* guarda a sinistra (-1) o a destra (1) o davanti (null): la testa si piega un poco da quella parte, le orecchie arrivano dopo */
  function lookAround(side, dist) {
    cat.att = side ? { x: cat.x + side * (dist || 150), y: cat.y - 36 } : null;
    if (side !== life.lookSide) { life.lookSide = side; if (side) { life.earKickAt = now + 0.12; life.earSide = side; } }
    rig.over.hr = (rig.poses[rig.pose] || rig.poses.sit).hr + (side ? 0.13 * side : 0);
  }
  function greet() {                                                   /* la prima volta: si siede di fronte e si presenta */
    set("greet", { face: "view", pose: "sit", dur: 4.6 });
  }
  /* ------------------------------------------------------------------ al tocco */
  var CALM = { sit: 1, pause: 1, look: 1, walk: 1, loaf: 1, groom: 1, yawn: 1, stretch: 1, think: 1, land: 1, shake: 1, tea: 1, star: 1, cube: 1, yarn: 1, laptop: 1, purr: 1, meow: 1, hop: 1, greet: 1 };
  var ASLEEP = { sleep: 1, drape: 1 };
  function tap() {
    lastIn = now; cat.taps.push(now); while (cat.taps.length && cat.taps[0] < now - 6) cat.taps.shift();
    var s = cat.state;
    if (cat.vis && onQuiet()) { cat.taps = []; if (!reduced && s !== "crouch" && s !== "air" && s !== "land" && s !== "fall" && s !== "fly" && s !== "held") leaveQuiet(); return; }   /* sul riquadro quiet un tocco lo fa solo andare via: niente miao, niente giochi */
    if (reduced) { say("miao", 1.2, "mini"); sound("meow"); return; }
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
    greet: function (dt, d) {                                          /* «salam, sono Dot.»: la bocca si muove due volte, la testa si inclina, poi un lento battito d'occhi */
      var st = cat.st, T = TS(), at = d.at != null ? d.at : (d.at = d.text ? 0.25 : stageOn && B.openT0 != null ? clamp(T.bubble - T.land - 0.4, 0.15, 0.6) : 0.3);
      if (st > at && !d.said) { d.said = 1; say(d.text || "salam, sono Dot.", d.sec || 4, d.kind); }
      var u = st - at; rig.over.mouth = d.said ? 0.45 * bell(seg(u, 0.02, 0.2)) + 0.38 * bell(seg(u, 0.26, 0.48)) : 0;
      rig.over.hr = rig.poses.sit.hr + 0.14 * smooth(0, 0.5, u) * (1 - smooth(2.4, 3.2, u)); rig.over.hp = rig.poses.sit.hp + 0.06 * bell(seg(u, 0, 0.6));
      if (u > 1.3 && !d.slow) { d.slow = 1; life.slow = now; life.flT = now; }
      cat.att = null; if (st > d.dur) sitFor(rr(1.5, 2.5));
    },
    meow: function (dt, d) {                                           /* miagola: prima si raccoglie, poi il muso sale e la bocca si apre davvero */
      var st = cat.st; rig.rate = st < 0.13 ? 16 : 13;
      rig.pose = st < 0.13 ? "b-meow0" : st < 0.66 ? "b-meow" : "sit";
      rig.over.mouth = st < 0.13 ? 0 : 1.2 * Math.pow(bell(seg(st, 0.12, 0.7)), 0.6);
      if (st > 0.15 && !d.said) { d.said = 1; say(pick(["miao", "miao", "mrr"]), 1.1, "mini"); sound("meow"); life.earKickAt = now + 0.1; }
      if (st > 1.15) sitFor(rr(1.5, 2.6));
    },
    purr: function (dt, d) {                                           /* fusa: occhi chiusi, testa inclinata, un tremito lieve */
      var st = cat.st, e = seg(st, 0, 0.3) * (1 - seg(st, d.dur - 0.3, d.dur)); rig.over.eye = st < d.dur - 0.2 ? 0 : 0.7; rig.eyeMood = "happy"; rig.over.hr = 0.16 * e; rig.over.br = 1.4; rig.over.ear = -0.05;
      cat.jit = 0.22 * e; if (st > 0.4 && !d.said) { d.said = 1; say("prr", 1.2, "mini"); sound("purr", true); }
      if (st > d.dur) { cat.jit = 0; life.slow = now; sitFor(rr(1.8, 2.8)); }
    },
    fezoff: function (dt, d) {                                         /* il tocco lo schiaccia, la testa scatta, il fez vola; Dot lo segue, va a prenderlo e se lo rilancia in testa */
      var st = cat.st, p = cat.plat; if (!p) return think();
      if (!d.ph) { d.ph = 0.5; d.side = room(p, cat.x, 1) > room(p, cat.x, -1) ? 1 : -1; }
      if (d.ph === 0.5) {                                              /* il tocco: si schiaccia, poi la testa scatta su e il fez parte */
        rig.over.sqy = 0.9; rig.over.sqx = 1.05; rig.over.hp = -0.12; rig.over.eye = 0.55; rig.over.ear = 0.2; rig.rate = 20;
        if (st > 0.08) {
          var f = lastF, c = f && f.fez ? { x: (f.fez.x + f.fez.tx) / 2, y: (f.fez.y + f.fez.ty) / 2 } : { x: 0, y: 38 }, pg = toPage(c.x, c.y);
          rig.fezOn = false; makeFez(pg.x, pg.y, d.side * rr(60, 95), -rr(320, 370), -d.side * rr(6, 9)); life.fezRollV = 0;
          rig.over = { hp: 0.3, eye: 1.28, ear: 0.0, sqy: 1.05, sqx: 0.97 }; rig.pupilDotT = 0.7; d.ph = 1; d.t = st;
        }
        return;
      }
      if (d.ph === 1) {                                                /* sobbalza e lo segue con gli occhi (la testa va su e giù con lui); d.calm: solo lo guarda */
        if (d.t == null) d.t = st;
        if (!fez) return think();
        var u1 = st - d.t;
        if (!d.calm) { cat.ownLift = true; cat.lift = bell(seg(u1, 0, 0.26)) * 3 * px();
          if (u1 > 0.12) { delete rig.over.hp; delete rig.over.sqy; delete rig.over.sqx; rig.over.eye = 1.22; }
          if (u1 > 0.5) { rig.over.eye = 1.05; rig.over.ear = 0.1; rig.pupilDotT = 0; } }
        cat.att = { x: fez.b.x, y: fez.b.y };
        if (fez.b.still > 0.35 || u1 > 2.6) { d.ph = 2; d.t = st; }
      } else if (d.ph === 2) {                                         /* ci va: a piedi se è sul suo bordo, con un salto se è su un altro; se non ci arriva, lo richiama */
        if (!fez) return think();
        var fp = fezPlat(), sd = fez.b.x > cat.x ? 1 : -1;
        if (fp && fp.el !== p.el) {
          var jx = clamp(fez.b.x - sd * 15 * px(), fp.a, fp.b);
          if (!fp.quiet && inView(fp.y, 60, 20) && Math.abs(fp.y - cat.y) < 330 && Math.abs(jx - cat.x) < 380 && !hitsNo(cat.x, cat.y, jx, fp.y, 26 + Math.max(0, cat.y - fp.y) * 0.3)) {
            return jumpTo(fp, jx, function () { if (fez && !rig.fezOn) set("fezoff", { ph: 2, side: fez.b.x > cat.x ? 1 : -1, face: "view", pose: "sit" }); else sitFor(rr(1.5, 2.5)); });
          }
          fp = null;
        }
        if (!fp) { d.ph = 6; d.t = st; return; }
        var gx = clamp(fez.b.x - d.side * 15 * px(), p.a, p.b);
        if (Math.abs(gx - cat.x) < 6) { cat.dir = d.side; d.ph = 3; d.t = st; }
        else walkTo(gx, function () { cat.dir = fez && fez.b.x > cat.x ? 1 : -1; set("fezoff", { ph: 3, t: 0, side: cat.dir, face: "side", pose: "b-sniff" }); }, { gait: "walk" });
      } else if (d.ph === 6) {                                         /* troppo lontano: lo guarda, un colpo di testa, e il fez torna da solo con lo stesso arco */
        if (!fez) return think();
        cat.face = "view"; rig.pose = "sit"; cat.att = { x: fez.b.x, y: fez.b.y }; rig.over.ear = -0.08;
        if (st - d.t > 0.8) { d.ph = 3; d.t = st - 0.74; d.side = fez.b.x > cat.x ? 1 : -1; d.far = 1; }
      } else if (d.ph === 3) {                                         /* lo annusa, ci infila il muso sotto, colpo di testa: il fez vola in alto e ricade in testa */
        var u3 = st - d.t; cat.face = "side"; if (!fez) { d.ph = 5; d.t = st; return; }
        rig.pose = u3 < 0.55 ? "b-sniff" : u3 < 0.74 ? "b-scoop" : "b-toss"; rig.rate = u3 < 0.74 ? 13 : 19;
        cat.att = d.fly ? { x: fez.b.x, y: fez.b.y } : { x: fez.b.x, y: fez.b.y };
        if (u3 > 0.74 && !d.fly) { var tg0 = fezHome(); d.fly = { x0: fez.b.x, y0: fez.b.y, a0: fez.b.ang, t0: st, dur: clamp(hyp(fez.b.x - tg0.x, fez.b.y - tg0.y) / 420, 0.5, 0.95) }; fez.hold = true; life.earKickAt = now + 0.05; }
        if (d.fly) {
          var u = seg(st, d.fly.t0, d.fly.t0 + d.fly.dur), tg = fezHome(), top = Math.min(d.fly.y0, tg.y) - 34 - (d.far ? 30 : 0), yc = 2 * top - (d.fly.y0 + tg.y) / 2;
          fez.b.x = lerp(d.fly.x0, tg.x, u); fez.b.y = (1 - u) * (1 - u) * d.fly.y0 + 2 * u * (1 - u) * yc + u * u * tg.y;
          fez.b.ang = lerp(d.fly.a0, 0, u) - d.side * TAU * eIO(u); fez.b.vx = fez.b.vy = 0;
          if (u > 0.35) { rig.pose = "sit"; cat.face = "view"; rig.rate = 12; }
          if (u >= 1) { killFez(); rig.fezOn = true; life.fezRollV = -3.4 * d.side; rig.over = { sqy: 0.93, sqx: 1.04, hp: 0.04 }; d.ph = 4; d.t = st; moodSet("proud", 3.2); }
        }
      } else if (d.ph === 4) { cat.face = "view"; rig.pose = "sit"; if (st - d.t > 0.12) rig.over = { hp: 0.14, lid: 0.3 }; if (st - d.t > 1.4) sitFor(rr(1.5, 2.5)); }
      else think();
    },
    annoyed: function (dt, d) {                                        /* svegliato: occhi che si spalancano e poi si stringono, orecchie basse, la coda batte; si alza e gli dà le spalle */
      var st = cat.st; rig.tailSwish = 0.6; rig.tailRate = 7.5;
      rig.over.eye = st < 0.08 ? 1.2 : 0.8; rig.over.lid = st < 0.12 ? 0 : 0.55; rig.over.brow = st < 0.12 ? 0.2 : 0.9; rig.over.ear = st < 0.06 ? 0.1 : 0.72;
      if (st < 0.1) { life.fezRollT = 0; rig.over.sqy = 1.06; } else delete rig.over.sqy;
      if (st > 0.12 && st < 1.15) { rig.pose = d.from === "drape" ? "drape" : "annoyed"; rig.over.hp = (rig.poses.annoyed.hp || 0) - 0.08; }   /* si tira su e lo fissa da sotto le palpebre */
      if (st > 0.15) cat.gz = true;
      if (st > 1.15 && st < 1.7) { rig.pose = "stand"; cat.face = "back"; rig.faceTurn = 0; rig.headMax = null; delete rig.over.hp; rig.over.ear = 0.6; }   /* di spalle: il profilo vero va bene */
      if (st > 1.7) {
        moodSet("annoyed", 12); if (!cat.plat) return think();
        var o = jumpTargets(cat.plat, 420);
        if (o.length) { o.sort(function (a, b) { return Math.abs(b.x - cat.x) - Math.abs(a.x - cat.x); }); var j = o[0];
          walkTo(clamp(cat.x + (j.x > cat.x ? 30 : -30), cat.plat.a, cat.plat.b), function () { jumpTo(j.p, j.x, function () { set("sulk", { face: "back", pose: "annoyed", dur: rr(6, 8) }); }); }, { speed: 50 }); }
        else { var p = cat.plat, tx = room(p, cat.x, 1) > room(p, cat.x, -1) ? p.b - 4 : p.a + 4; walkTo(tx, function () { set("sulk", { face: "back", pose: "annoyed", dur: rr(6, 8) }); }, { speed: 50 }); }
      }
    },
    sulk: function (dt, d) {                                           /* seduto di spalle; poi si volta a guardare da sopra la spalla, un lento battito d'occhi, e perdona */
      var st = cat.st; rig.tailSwish = 0.35 * (1 - seg(st, d.dur * 0.6, d.dur * 0.8)); rig.tailRate = 3; rig.faceTurn = 0; rig.headMax = st > d.dur * 0.8 ? HEADMAX : null;
      cat.gz = false; rig.look.ty = 0; rig.look.tp = 0.02;
      if (st > d.dur * 0.55 && st < d.dur * 0.8) { var u = seg(st, d.dur * 0.55, d.dur * 0.63); rig.look.ty = clamp(wrap(-PI / 2 - rig.yaw) * 0.9 * u, -1.15, 1.15); rig.gazeT[0].x = rig.gazeT[1].x = cat.dir > 0 ? -0.9 : 0.9; rig.over.lid = 0.4; if (u > 0.9 && !d.s1) { d.s1 = 1; life.slow = now + 0.3; } }
      if (st > d.dur * 0.8) { cat.face = "view"; rig.pose = "sit"; cat.gz = true; rig.faceTurn = null; if (!d.f) { d.f = 1; cat.mood = null; life.slow = now + 0.6; life.flT = now + 0.2; } }
      if (st > d.dur + 1.4) sitFor(rr(1.5, 2.5));
    }
  });

  /* ------------------------------------------------------------------ preso, lasciato, lanciato */
  var pend = { a: 0, w: 0, px: 0, pvx: 0 };
  /* quanto stanno sopra l'origine le zampe davanti nella posa «slide» (l'origine è sulla faccia del riquadro) */
  function slideTop() { var s = rig.poses.slide; return Math.max(s.f0y, s.f1y) + rig.P.leg.paw * 0.6; }
  function pickUp() {
    clearHeld();
    set("held", { face: "view", pose: "held" }); cat.plat = null; cat.gy = null; pend.a = 0; pend.w = 0; pend.pvx = 0; pend.px = cat.x;
    reanchor(below() - below("held")); rig.rate = 14; lastIn = now;   /* l'origine passa alla collottola: il corpo resta dov'era */
  }
  Object.assign(STATES, {
    held: function (dt, d) {                                           /* per la collottola: gatto lungo, corpo a pendolo, sguardo seccato */
      if (!drag && !fake) { release(0, 0); return; }                  /* nessun dito lo tiene più (un dito perso, un secondo dito): lo si lascia */
      var h = drag ? drag : fake, tx = h ? h.x : cat.x, ty = h ? h.y : cat.y, k = 1 - Math.exp(-dt * 24), ox = cat.x;
      cat.x = lerp(cat.x, tx, k); cat.y = lerp(cat.y, ty, k); rig.grounded = false;
      var vx = (cat.x - ox) / Math.max(dt, 1e-3), ax = (vx - pend.pvx) / Math.max(dt, 1e-3); pend.pvx = vx;
      pend.w += (-22 * Math.sin(pend.a) - 2.6 * pend.w - clamp(ax, -9000, 9000) / 520 * Math.cos(pend.a)) * dt; pend.a = clamp(pend.a + pend.w * dt, -1.1, 1.1);
      cat.rot = -pend.a; cat.piv = 0; cat.ownRot = true;
      var sp = Math.abs(vx); rig.longT = clamp(3 + cat.st * 4 + sp / 140, 0, 11);
      rig.over.lid = 0.42; rig.over.eye = 0.9; rig.over.ear = 0.18 + 0.25 * sat(sp / 900); rig.tailSwish = 0.25; rig.tailRate = 2;
      cat.att = null; cat.gz = true;
    },
    fall: function (dt, d) {                                           /* cade dritto fino al bordo di sotto: le zampe davanti cercano il bordo */
      d.vy = (d.vy || 0) + 2300 * dt; var y0 = cat.y; cat.y += d.vy * dt; cat.x += (d.vx || 0) * dt; d.vx = (d.vx || 0) * Math.exp(-dt * 3);
      rig.grounded = false; rig.pose = cat.st < 0.12 ? "air" : "b-reach"; rig.rate = 16; rig.pitchT = 0; rig.over.eye = 1.15; rig.over.ear = 0.3; rig.pupilDotT = 0.6;
      var p = d.p && cat.x >= d.p.a - 10 && cat.x <= d.p.b + 10 ? d.p : platBelow(cat.x, y0 - 2);
      cat.gy = p ? p.y : null;
      if (p && cat.y >= p.y) { cat.x = clamp(cat.x, p.a, p.b); landOn(p);
        if (p.quiet) { set("land", { then: leaveQuiet, quiet: true, v: d.vy, face: cat.face === "front" ? "view" : cat.face, pose: "land" }); return; }
        if (d.vy > 700) moodSet("scared", 1.6); set("land", { then: d.vy > 700 ? "shake" : "sit", v: d.vy, face: cat.face === "front" ? "view" : cat.face, pose: "land" }); return; }
      if (cat.y > view.sy + view.vh + 160 || cat.y > doc.documentElement.scrollHeight + 100) comeBack();
    },
    fly: function (dt, d) {                                            /* lanciato: vola lungo il lancio, poi atterra e magari ruzzola */
      var y0 = cat.y; d.vy += 2000 * dt; cat.x += d.vx * dt; cat.y += d.vy * dt; rig.grounded = false; rig.rate = 16;
      if (cat.x < view.sx + 14 || cat.x > view.sx + view.vw - 14) { cat.x = clamp(cat.x, view.sx + 14, view.sx + view.vw - 14); d.vx = -d.vx * 0.35; }
      cat.dir = d.vx >= 0 ? 1 : -1; cat.face = "side"; flight(d.vy < 0 ? 0.3 : 0.7, d.vx, d.vy); rig.pupilDotT = 0.5;
      var p = null, i, q; for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (d.vy > 0 && y0 <= q.y && cat.y >= q.y && cat.x >= q.a - 10 && cat.x <= q.b + 10) { p = q; break; } }
      var b = platBelow(cat.x, cat.y); cat.gy = b ? b.y : null;
      if (!p && d.vy > 0 && inNo(cat.x, cat.y)) { escapeJump(); return; }   /* ricadendo davanti al Corano: si gira in aria e salta via */
      if (p) { cat.x = clamp(cat.x, p.a, p.b); landOn(p);
        if (p.quiet) { set("land", { then: leaveQuiet, quiet: true, v: d.vy, face: "side", pose: "land" }); return; }   /* lanciato sul riquadro quiet: atterra e se ne va, senza ruzzoloni */
        moodSet("scared", 1.6); if (Math.abs(d.vx) > 360) set("tumble", { vx: d.vx * 0.5, face: "side", pose: "loaf" }); else set("land", { then: "shake", v: d.vy, face: "side", pose: "land" }); return; }
      if (cat.y > view.sy + view.vh + 160) comeBack();
    },
    tumble: function (dt, d) {                                         /* ruzzola: un giro su sé stesso mentre striscia, poi si rimette in piedi */
      var st = cat.st, u = seg(st, 0, 0.5), p = cat.plat; cat.ownRot = true; cat.piv = 11; cat.rot = -cat.dir * TAU * eOut(u);
      cat.x = clamp(cat.x + d.vx * dt, p.a, p.b); d.vx *= Math.exp(-dt * 5); rig.pose = u < 0.85 ? "loaf" : "stand"; rig.over.eye = u < 1 ? 0.3 : 1;
      if (st > 0.62) { cat.rot = 0; set("shake", { face: "side", pose: "stand", annoyed: true }); }
    },
    slide: function (dt, d) {                                          /* lasciato sulla faccia di un riquadro: unghie fuori, scivola e graffia (come nel riferimento 06) */
      var t = d.t, st = cat.st, k = px(), S = rig.poses.slide; rig.grounded = false; cat.face = "front"; rig.pose = "slide"; rig.rate = 16;
      if (!d.sc) { var cxm = clamp(cat.x, t.l + 16 * k, t.r - 16 * k), cx0 = Math.max(t.l, cxm - 64), cx1 = Math.min(t.r, cxm + 64);   /* i graffi stanno in una colonna larga quanto il gatto: la tela resta piccola anche a 3x */
        d.sc = fx().Scratch(layer, { x: cx0, y: t.t, w: cx1 - cx0, h: t.b - t.t }, dark); d.sc.el = t.el; scratches.push(d.sc); }
      if (d.noB == null) { var j, n; d.noB = false; for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (!n.m && n.t >= t.b - 4 && n.t < t.b + 48 && cat.x > n.l - 30 && cat.x < n.r + 30) d.noB = true; } }   /* sotto c'è il Corano? */
      if (d.noB) { rig.over.te = -0.35; rig.over.tc = 1.1; }          /* allora la coda non pende: si arriccia di lato */
      d.vy = st < 0.16 ? 8 : Math.min((d.vy || 30) + 300 * dt, 118); cat.y += d.vy * dt;
      cat.x = clamp(cat.x, t.l + 16 * k, t.r - 16 * k);
      var sc = seg(st, 0.12, 0.3);                                     /* le zampe raspano: una su, l'altra giù, le unghie si piantano e strisciano */
      rig.over.f0y = S.f0y + 1.5 * Math.sin(st * 12.5) * sc; rig.over.f1y = S.f1y - 1.5 * Math.sin(st * 12.5) * sc;
      rig.over.f2y = S.f2y + 0.9 * Math.sin(st * 10 + 1) * sc; rig.over.f3y = S.f3y - 0.9 * Math.sin(st * 10 + 1) * sc;
      cat.ownRot = true; cat.piv = 0; cat.rot = 0.05 * Math.sin(st * 9) * sc;
      rig.gazeT[0].x = -0.6 + 0.2 * Math.sin(st * 7); rig.gazeT[0].y = 0.45; rig.gazeT[1].x = 0.5; rig.gazeT[1].y = -0.35 + 0.2 * Math.sin(st * 5); rig.pupilT = 0.9; rig.pupilDotT = 1; cat.gz = false; rig.look.ty = 0; rig.look.tp = 0;
      if (lastF && st > 0.05) { var i, l, pg; for (i = 0; i < 4; i++) { l = lastF.legs[i]; pg = toPage(l.fx, l.fy + l.paw * 0.4); if (pg.y < t.b - 3 && pg.y > t.t + 3) d.sc.add(i, pg.x, pg.y, k); } }
      if (d.noB && lastF && st > 0.2) {                                 /* col Corano sotto si ferma quando il punto più basso (zampe dietro, coda) arriva al bordo, e salta via di lato */
        var lo = -1e9, q2, m2; for (i = 0; i < 4; i++) { l = lastF.legs[i]; m2 = toPage(l.fx, l.fy - l.paw).y; if (m2 > lo) lo = m2; }
        for (i = 0; i < lastF.tail.pts.length; i++) { q2 = lastF.tail.pts[i]; m2 = toPage(q2.x, q2.y - q2.r).y; if (m2 > lo) lo = m2; }
        if (lo >= t.b - 3) { d.sc.done(); d.sc = null; reanchor(below() - below("air")); escapeJump(); return; }
      }
      if (cat.y - slideTop() * k >= t.b - 6) {                         /* le zampe arrivano al bordo di sotto: si aggrappa, oppure cade */
        d.sc.done(); d.sc = null;
        var bl = platBelow(cat.x, t.b + 2), gap = bl ? bl.y - t.b : 1e9;
        if (gap > 54 && !tileAt(cat.x, t.b + 24)) { reanchor((t.b - cat.y) / k); set("hang", { t: t, edgeY: t.b, w: (d.vy / 300), face: "front", pose: "hang" }); }
        else { reanchor(below() - below("air")); if (fallBlocked(cat.x, cat.y)) escapeJump(30); else set("fall", { vy: d.vy, face: "view", pose: "air" }); }
      }
    },
    hang: function (dt, d) {                                           /* appeso al bordo di sotto con le zampe davanti: dondola, scalcia, guarda giù, molla */
      var st = cat.st, H = rig.poses.hang; rig.grounded = false; cat.face = "front"; rig.pose = "hang"; rig.rate = 13;
      if (d.a == null) { d.a = clamp((d.w || 0) * 0.5 + (d.vx || 0) / 900, -0.6, 0.6) || 0.22; d.av = 0; d.dur = d.dur || rr(2, 2.8); }
      cat.y = lerp(cat.y, d.edgeY, 1 - Math.exp(-dt * 30));
      d.av += (-15 * Math.sin(d.a) - 1.0 * d.av) * dt; d.a += d.av * dt;
      if (st > 0.9 && st < 1.5) { var kk = Math.sin((st - 0.9) * 22); rig.over.f2y = H.f2y + 3.4 * Math.max(0, kk); rig.over.f3y = H.f3y + 3.4 * Math.max(0, -kk); d.av += 0.5 * kk * dt * 8; }   /* scalcia */
      else { delete rig.over.f2y; delete rig.over.f3y; }
      cat.ownRot = true; cat.piv = 0; cat.rot = d.a;
      cat.gz = false; rig.look.ty = 0.18 * Math.sin(st * 1.3); rig.look.tp = 0; rig.gazeT[0].x = rig.gazeT[1].x = 0.1 * Math.sin(st * 2); rig.gazeT[0].y = rig.gazeT[1].y = st < 0.8 ? -0.75 : st < 1.6 ? 0.1 : -0.8;
      rig.pupilT = 0.7; rig.pupilDotT = st > 1.6 ? 0.8 : 0.3; rig.over.eye = (H.eye || 1) * (st > 1.6 ? 1.1 : 1); rig.tailSwish = 0.3;
      if (st > d.dur) { cat.rot = 0; reanchor(below() - below("air")); if (fallBlocked(cat.x, cat.y)) escapeJump(40); else set("fall", { vy: 40, face: "view", pose: "air" }); }
    }
  });
  /* dove lasciarlo: sul bordo, nella scatola, sulla faccia di un riquadro, appeso sotto, oppure giù */
  function release(vx, vy) {
    var sp = hyp(vx, vy), k = px(); lastIn = now;
    var bodyY = cat.y + below() * k;
    if (stageOn && stage.hit && stage.hit(cat.x, bodyY)) return boxIn(true);
    if (sp > 650) { reanchor(below() - below("air")); var f = Math.min(1, 1500 / sp); set("fly", { vx: vx * f, vy: vy * f, face: "side", pose: "air" }); return; }
    var i, p, best = null, t;
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode !== "no") continue;   /* lasciato davanti al Corano: non ci cade e non ci scivola, ne salta via subito */
      if (cat.x > t.l - 8 && cat.x < t.r + 8 && bodyY + 14 * k > t.t - 4 && bodyY - 10 * k < t.b + 4) { reanchor(below() - below("air")); escapeJump(); return; } }
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode !== "quiet") continue;   /* davanti al riquadro quiet: niente graffi, niente appeso; via subito */
      if (cat.x > t.l && cat.x < t.r && bodyY > t.t + 6 && bodyY < t.b + 22) { reanchor(below() - below("air")); escapeJump(); return; } }
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode === "no" || t.mode === "quiet") continue; if (cat.x > t.l + 24 && cat.x < t.r - 24 && cat.y > t.b - 24 && cat.y < t.b + 22 && !tileAt(cat.x, t.b + 30)) { reanchor(below() - below("hang")); set("hang", { t: t, edgeY: t.b, vx: vx, face: "front", pose: "hang" }); return; } }
    for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (cat.x >= p.a - 14 && cat.x <= p.b + 14 && bodyY + 14 * k >= p.y - 30 && bodyY + 14 * k <= p.y + 26) { if (!best || Math.abs(p.y - bodyY) < Math.abs(best.y - bodyY)) best = p; } }
    if (best) { reanchor(below() - below("air")); cat.x = clamp(cat.x, best.a, best.b); set("fall", { p: best, vy: 0, vx: vx * 0.2, face: "view", pose: "air" }); return; }
    t = tileAt(cat.x, bodyY);
    if (t && !t.mode && bodyY < t.b - 40 * k) { reanchor(below() - below("slide")); set("slide", { t: t, vy: Math.max(0, vy * 0.15), face: "front", pose: "slide" }); return; }
    reanchor(below() - below("air")); if (fallBlocked(cat.x, cat.y)) return escapeJump(30); set("fall", { vy: Math.max(0, vy * 0.3), vx: vx * 0.3, face: "view", pose: "air" });
  }
  /* ------------------------------------------------------------------ il fez libero */
  function makeFez(x, y, vx, vy, va) {
    killFez(); var k = K, F = rig.P.fez, rB = F.rBase * k, rT = F.rTop * k, h = F.h * k, side = PI / 2 - Math.atan2(F.rBase - F.rTop, F.h);
    var b = fx().Body({ x: x, y: y, vx: vx, vy: vy, va: va, shape: [[-rB, -h / 2], [rB, -h / 2], [rT, h / 2], [-rT, h / 2]], rest: [0, side, -side, PI], g: 1500 });
    fez = { b: b, sp: fx().Sprite(layer, 64, 64, 32, 32, 2), tas: 0, tasW: 0, pvx: 0, hold: false, wall: null, back: null };
    var p = cat.plat; if (p) fez.wall = { el: p.el, l: Math.max(p.tile.l + 8, p.a - 14), r: Math.min(p.tile.r - 8, p.b + 14) };   /* resta sul riquadro da cui è caduto: alla fine del bordo si ferma */
  }
  function killFez() { if (fez) { fez.sp.remove(); fez = null; } }
  /* un corpo (il fez) non entra mai in un riquadro «no»: se lo tocca ne viene spinto fuori dal lato più vicino */
  function keepOut(b, hw, hh) {
    var i, n; for (i = 0; i < world.no.length; i++) { n = world.no[i]; if (n.m) continue;
      if (b.x + hw <= n.l || b.x - hw >= n.r || b.y + hh <= n.t || b.y - hh >= n.b) continue;
      var pl = b.x + hw - n.l, pr = n.r - (b.x - hw), pt = b.y + hh - n.t, pb = n.b - (b.y - hh), mn = Math.min(pl, pr, pt, pb);
      if (mn === pl) { b.x -= pl; b.vx = Math.min(0, b.vx) * 0.3; } else if (mn === pr) { b.x += pr; b.vx = Math.max(0, b.vx) * 0.3; }
      else if (mn === pt) { b.y -= pt; b.vy = Math.min(0, b.vy) * 0.2; } else { b.y += pb; b.vy = Math.max(0, b.vy); } }
  }
  /* il volo del fez che torna in testa: un arco (quadratica) dal fez alla testa. Libero se non passa davanti a un riquadro «no» */
  function fezArc(x0, y0, x1, y1, far) { var top = Math.min(y0, y1) - 34 - (far ? 30 : 0); return { top: top, yc: 2 * top - (y0 + y1) / 2 }; }
  function fezArcClear(x0, y0, x1, y1, far) {
    var a = fezArc(x0, y0, x1, y1, far), i, u, x, y, nos = world.no.filter(function (n) { return !n.m; });
    for (i = 0; i <= 16; i++) { u = i / 16; x = lerp(x0, x1, u); y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * a.yc + u * u * y1; if (rectHits(nos, x - 12, y - 12, x + 12, y + 12)) return false; }
    return true;
  }
  /* si può riprendere il fez da qui? a piedi sul suo stesso riquadro, con un salto, o richiamandolo con un colpo di testa su un arco libero */
  function fezReach() {
    if (!fez) return false; if (fez.back) return true; var p = cat.plat; if (!p) return false;
    var fp = fezPlat(); if (fp && fp.el === p.el) return true;
    if (fp) { var jx = clamp(fez.b.x - (fez.b.x > cat.x ? 1 : -1) * 15 * px(), fp.a, fp.b); if (!fp.quiet && inView(fp.y, 60, 20) && Math.abs(fp.y - cat.y) < 330 && Math.abs(jx - cat.x) < 380 && !hitsNo(cat.x, cat.y, jx, fp.y, 26 + Math.max(0, cat.y - fp.y) * 0.3)) return true; }
    var h = fezHome(); return fezArcClear(fez.b.x, fez.b.y, h.x, h.y, true);
  }
  /* il fez parte e vola in testa (free: non è legato a uno stato del gatto, per esempio il suo riquadro è sparito) */
  function fezFly(far, side, free) { if (!fez) return; fez.back = { x0: fez.b.x, y0: fez.b.y, a0: fez.b.ang, t0: now, far: !!far, side: side || 1, free: !!free, dur: 0 }; var tg = fezHome(); fez.back.dur = clamp(hyp(fez.b.x - tg.x, fez.b.y - tg.y) / 420, 0.5, 0.95); fez.hold = true; }
  /* il bordo su cui è caduto il fez (quello del suo riquadro più vicino), o null se è caduto dove Dot non va */
  function fezPlat() {
    if (!fez) return null; var b = fez.b, fy = b.low(), i, p, best = null, bd = 1e9, dd;
    for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (Math.abs(p.y - fy) > 5 || b.x < p.tile.l || b.x > p.tile.r) continue; dd = b.x < p.a ? p.a - b.x : b.x > p.b ? b.x - p.b : 0; if (dd < bd) { bd = dd; best = p; } }
    return best && bd < 60 ? best : null;
  }
  /* il fez è per terra: va a riprenderlo (aspetta che si fermi, poi ci va a piedi o con un salto, o lo richiama) */
  function fetchFez() { if (!fez || !cat.plat) return sitFor(rr(1.5, 2.5)); set("fezoff", { ph: 1, t: 0, calm: true, side: fez.b.x > cat.x ? 1 : -1, face: "view", pose: "sit" }); }
  function fezHome() {                                                 /* dove sta il centro del fez quando è in testa (pagina) */
    var f = lastF, F = rig.P.fez; if (!f) return { x: cat.x, y: cat.y - 40 * px() };
    if (f.fezSeat) return toPage(f.fezSeat.x, f.fezSeat.y);
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
      try { dp(c, pr.name, { t: pr.t, open: pr.open, held: false, frame: null }, envFor(K)); } catch (e) {}
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
      else if (d.pushed) { rig.pose = st - d.pushed < 0.4 ? "b-push" : "b-over"; rig.over.eye = 1.15; rig.over.hr = 0.12 * Math.sin((st - d.pushed) * 1.6); cat.gz = false; rig.look.ty = clamp(wrap(-PI / 2 - rig.yaw) * 0.5, -0.6, 0.6); rig.look.tp = -0.1; rig.gazeT[0].x = rig.gazeT[1].x = cat.dir * 0.5; rig.gazeT[0].y = rig.gazeT[1].y = -0.85; if (st - d.pushed > 2.4) sitFor(rr(1.6, 2.4)); }
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
      if (st > 0.7 && !d.said) { d.said = 1; say("prr", 1.6, "mini"); sound("purr", true); }
      if (!drag && st > 0.3) { cat.jit = 0; life.slow = now + 0.2; sitFor(rr(2, 3)); return; }   /* il dito non c'è più */
      if (st > 3.4 && cat.plat) set("melt", { face: "low", pose: "b-melt" });
    },
    /* il dito fermo a lungo: si scioglie sotto la mano. Il corpo si stende piano, il mento va a terra, gli occhi diventano due archi felici,
       il respiro rallenta, la punta della coda si muove appena; il fez resta in testa. Quando il dito se ne va si alza stiracchiandosi */
    melt: function (dt, d) {
      var st = cat.st, e = smooth(0, 1.4, st); rig.pose = "b-melt"; rig.rate = lerp(3.2, 6, smooth(1.2, 2.4, st)); rig.turn = 3;
      rig.over.eye = 0; rig.eyeMood = "happy"; rig.over.hr = 0.05 + 0.05 * Math.sin(st * 0.7);
      rig.breathRate = lerp(1.9, 1.05, e); rig.tailSwish = 0.06; rig.tailRate = -0.95; life.fezRollT = 0.1 * e;
      cat.jit = 0.12 * (1 - e) + 0.05; cat.att = null; cat.gz = false; rig.look.ty = lerp(rig.look.ty, 0, 1 - Math.exp(-dt * 3)); rig.look.tp = -0.05;
      if (!drag && st > 0.35) { cat.jit = 0; life.fezRollT = 0; set("getup", { face: "side", pose: "stretch" }); }
    },
    getup: function (dt, d) {                                          /* si rialza: stiracchiata col sedere in su, poi in piedi, poi seduto */
      var st = cat.st; rig.rate = st < 0.9 ? 5 : 9; rig.turn = 5; rig.pose = st < 1.25 ? "stretch" : "stand";
      if (st < 1.1) { rig.over.eye = st < 0.25 ? 0 : 0.18; rig.eyeMood = "happy"; }
      if (st > 1.7) sitFor(rr(2, 3));
    },
    belly: function () { set("melt", { face: "low", pose: "b-melt" }); },   /* nome di prima: ora è «melt» */
    brace: function (dt) { var st = cat.st; rig.over.ear = 0.75 * (1 - seg(st, 0.6, 1.1)); rig.over.eye = 1.2; rig.pupilT = 0.45; rig.tailSwish = 0.4; rig.over.sqy = 0.97; if (st > 1.2) sitFor(rr(1.5, 2.5)); },
    unroll: function () { set("getup", { face: "side", pose: "stretch" }); }   /* nome di prima */
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
      var s = p.a >= r.x ? 1 : p.b <= r.x ? -1 : 0; if (!s) continue; var x = clamp(r.x + s * ((r.ow || r.w) / 2 + 46), p.a, p.b), sc = (p.b - p.a) - Math.abs(x - r.x) * 0.5; if (sc > bs) { bs = sc; best = { p: p, x: x, side: s }; } }
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
  /* la sequenza dentro la scatola (apertura e uscite): ts = tempo del copione.
     Coperchio aperto → due occhi verdi si aprono nel buio, si guardano attorno, battono → la testa sale e le zampe
     si posano sul bordo → guarda a sinistra e a destra → si gira verso dove salterà, si abbassa, spinge → salta fuori */
  function boxSeq(ts, d) {
    var T = TS(), r = stage.rim(), kk, P0 = rig.poses.peek;
    var tEyes = T.eyes != null ? T.eyes : T.lid + 0.3, tBlink = T.blink != null ? T.blink : tEyes + 0.5;
    if (ts < tEyes - 0.03) { cat.vis = false; return; }
    cat.vis = true; cat.plat = null; cat.gy = null; rig.grounded = false;
    if (!d.side) { var lp = homeLanding(r); d.p = lp.p; d.side = lp.side; d.lx = lp.x; }
    var hl = r.x - (r.ow || r.w) / 2, hr = r.x + (r.ow || r.w) / 2;
    if (ts < T.jump) {
      if (!d.inBox) { d.inBox = 1; cat.face = "front"; rig.yawT = Y.front; rig.over = {}; rig.snap("peek"); cat.voff = 0; cat.voffV = 0; }
      cat.s = 0.78; cat.x = r.x; cat.face = "front"; rig.pose = "peek"; cat.clipAt = r.y; cat.hideL = hl; cat.hideR = hr; kk = px();
      var band = r.back != null ? r.y - r.back : 12 * r.w / 42.6, eyeU = P0.cy + P0.dy + rig.P.eye.up, low = (eyeU * kk - band * 0.5) / kk;   /* gli occhi stanno a metà della fessura buia */
      cat.clipTop = ts < T.peek + 0.05 ? r.y - band : null;
      var off = ts < T.peek ? low : lerp(low, 0, eBack(seg(ts, T.peek, T.peek + 0.42), 1.5));
      off += 5 * eIO(seg(ts, T.crouch, T.jump - 0.06));                /* si abbassa prima di saltare */
      cat.y = r.y + off * kk;
      /* le zampe: salgono sul bordo dopo la testa, una appena dopo l'altra; spariscono quando si abbassa */
      var pu = ts < T.crouch ? 1 : 1 - seg(ts, T.crouch, T.crouch + 0.12);
      rig.over.f0y = P0.f0y - 9 * (1 - eBack(seg(ts, T.peek + 0.18, T.peek + 0.38), 2) * pu); rig.over.f1y = P0.f1y - 9 * (1 - eBack(seg(ts, T.peek + 0.23, T.peek + 0.43), 2) * pu);
      cat.paws = rig.A.f0y > P0.f0y - 1.8 && rig.A.f1y > P0.f1y - 1.8;
      /* gli occhi nel buio: si aprono, guardano un po' qua e là, battono */
      var bo = null; if (ts < tEyes + 0.16) bo = eOut(seg(ts, tEyes, tEyes + 0.16)); else if (ts > tBlink && ts < tBlink + 0.16) bo = Math.abs(ts - tBlink - 0.08) / 0.08;
      cat.blinkO = bo;
      if (ts < T.peek) { cat.gz = false; var gx = ts < tEyes + 0.3 ? 0 : ts < tEyes + 0.6 ? -0.65 : ts < tBlink - 0.05 ? 0.6 : 0; rig.gazeT[0].x = rig.gazeT[1].x = gx; rig.gazeT[0].y = rig.gazeT[1].y = 0.15; rig.look.ty = gx * 0.25; rig.look.tp = 0; rig.pupilT = 1; rig.over.ear = 0.2; }
      else {
        cat.gz = true; rig.pupilT = 0.85; delete rig.over.ear;
        lookAround(ts < T.lookL ? null : ts < T.lookR ? -1 : ts < T.lookC ? 1 : null, 160);
        if (ts >= T.crouch) { cat.dir = d.side; cat.face = "view"; cat.att = { x: d.lx, y: r.y }; rig.over.hr = 0; }
      }
      d.y0 = cat.y; d.x0 = cat.x;
      return;
    }
    if (ts < T.land) {                                                 /* il salto fuori: spinge, vola mentre cresce, allunga le zampe davanti */
      if (!d.jumped) { d.jumped = 1; cat.blinkO = null; rig.over = {}; cat.paws = false; cat.clipTop = null; reanchor(below() - below("b-launch")); d.y0 = cat.y; cat.dir = d.side; cat.gz = true; }
      var u = seg(ts, T.jump, T.land), ly = d.p ? d.p.y : r.y + 4, h = 44 + (d.y0 - ly) * 0.2, dur = T.land - T.jump, ux = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);   /* prima sale, poi esce: le zampe passano sopra il bordo */
      cat.face = "side"; cat.x = lerp(d.x0, d.lx, ux); cat.y = lerp(d.y0, ly, u) - 4 * h * u * (1 - u); cat.s = lerp(0.78, 1, eOut(u));
      var vy = ((ly - d.y0) - 4 * h * (1 - 2 * u)) / dur; rig.rate = 15; flight(u, (d.lx - d.x0) / dur, vy);
      cat.att = { x: d.lx + d.side * 40, y: ly - 10 };
      cat.clipAt = u < 0.6 ? r.y : null; cat.hideL = hl; cat.hideR = hr; cat.gy = ly; return;
    }
    if (!d.landed) { d.landed = 1; cat.s = 1; cat.x = d.lx; if (d.p) landOn(d.p); cat.clipAt = null; set("land", { then: d.first ? greet : "sit", v: 650, face: "side", pose: "land" }); }
  }
  Object.assign(STATES, {
    opening: function (dt, d) { if (!stageOn) { set("peek", { p: d.p, x: d.x, first: true }); return; } boxSeq(now - B.openT0, d); },
    boxexit: function (dt, d) { var T = TS(); boxSeq(T.lid + 0.15 + cat.st * 1, d); },
    boxjump: function (dt, d) {                                        /* salta (o è lasciato) dentro la scatola */
      var r = stage.rim(), u = seg(cat.st, d.closed ? 0 : 0.18, d.closed ? 0.25 : 0.62), k;
      if (!d.closed && cat.st < 0.18) { cat.dir = r.x > cat.x ? 1 : -1; rig.pose = "crouch"; return; }
      if (!d.re) { d.re = 1; if (d.closed) { reanchor(below() - below("air")); } d.x0 = cat.x; d.y0 = cat.y; }
      cat.clipAt = u > 0.55 ? r.y : null; cat.hideL = r.x - (r.ow || r.w) / 2; cat.hideR = r.x + (r.ow || r.w) / 2; rig.grounded = false; cat.gy = null;
      cat.x = lerp(d.x0, r.x, eIO(u)); cat.s = lerp(1, 0.78, u); k = px();
      cat.y = lerp(d.y0, r.floor, u) - (d.closed ? 0 : 4 * 40 * u * (1 - u)); rig.pose = u < 0.7 ? "air" : "sit"; cat.face = u < 0.7 && !d.closed ? "side" : "front";
      if (u >= 1) { if (d.closed) { stage.lid(0); cat.vis = false; set("boxed"); } else set("box", { dur: rr(7, 10), face: "front", pose: "peek" }); }
    },
    box: function (dt, d) {                                            /* nascosto: solo due occhi verdi nel buio, un po' offesi */
      var r = stage.rim(), k; cat.s = 0.78; k = px(); cat.x = r.x; cat.face = "front"; rig.pose = "peek"; cat.clipAt = r.y; cat.hideL = r.x - (r.ow || r.w) / 2; cat.hideR = r.x + (r.ow || r.w) / 2; cat.voff = 0; cat.voffV = 0; rig.grounded = false;
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
      rig.look.ty = clamp(wrap(Math.atan2(-170, dx) - rig.yaw), -0.9, 0.9); rig.look.tp = clamp(Math.atan2(dy, hyp(dx, 170)), -0.6, 0.6);   /* mai di profilo pieno: il resto lo fanno le pupille */
      gx = clamp(dx / 110, -1, 1); gy = clamp(dy / 110, -1, 1);
    } else {
      if (now > life.glAt) { life.glAt = now + rr(1.4, 3.8); var g = rnd(); life.gl = g < 0.55 ? 0 : rr(-0.85, 0.85); life.glY = g < 0.55 ? 0 : rr(-0.25, 0.3); life.glE = rnd() < 0.5; }
      var base = clamp(wrap(-PI / 2 - rig.yaw), -0.95, 0.95);
      rig.look.ty = life.glE ? base : clamp(base + life.gl, -1.1, 1.1); rig.look.tp = (s === "held" ? -0.22 : 0.04) + (life.glE ? 0 : life.glY * 0.5);
      gx = life.gl * (life.glE ? 0.9 : 0.5); gy = life.glY;
    }
    if (s === "walk" && !cat.att) { rig.look.ty *= 0.35; rig.look.tp *= 0.4; }
    var up = Math.max(0, rig.pitchT) + Math.max(0, (rig.poses[rig.pose] || rig.poses.sit).hp), tpm = Math.max(0, 0.28 - up);   /* il muso non va troppo in su (posa + corpo + sguardo): il resto lo fanno le pupille, il fez resta in cima */
    if (rig.look.tp > tpm) { gy = Math.min(1, gy + (rig.look.tp - tpm) * 1.6); rig.look.tp = tpm; }
    var tl = now - (life.turnAt || -9);                                /* girandosi, la testa va per prima verso dove andrà il corpo */
    if (tl < 0.5) { var lw = 0.85 * (1 - smooth(0.25, 0.5, tl)); rig.look.ty = lerp(rig.look.ty, clamp(wrap(life.turnTo - rig.yaw), -0.55, 0.55), lw); gx = lerp(gx, cat.dir > 0 ? 0.6 : -0.6, lw); }
    for (i = 0; i < 2; i++) { rig.gazeT[i].x = gx; rig.gazeT[i].y = gy; }
  }
  function lifeStep(dt) {
    var b = 1, u;
    if (now > life.blinkAt) { life.blinkT = now; life.blinkAt = now + (rnd() < 0.18 ? 0.3 : rr(2.2, 5.6)); }
    u = now - life.blinkT; if (u < 0.15) b = Math.abs(u - 0.075) / 0.075;
    u = now - life.slow; if (u > 0 && u < 1.4) b = Math.min(b, 1 - smooth(0, 0.5, u) * (1 - smooth(0.75, 1.4, u)));     /* il lento battito di fiducia */
    rig.autoBlink = false; rig.blink = cat.blinkO != null ? cat.blinkO : b; cat.blinkO = null;
    rig.earTwitch = false; if (now > life.earAt && !reduced) { rig.earKick(rnd() < 0.5 ? 1 : -1); life.earAt = now + rr(3, 8); }
    if (life.earFlick) { rig.earKick(life.earSide || 1); life.earFlick = 0; }
    if (life.earKickAt && now >= life.earKickAt) { rig.earKick(life.earSide || 1); life.earKickAt = 0; }   /* l'orecchio che arriva dopo la testa */
    life.fezRollV += (-(life.fezRoll - (life.fezRollT || 0)) * 90 - life.fezRollV * 7) * dt; life.fezRoll = clamp(life.fezRoll + life.fezRollV * dt, -0.6, 0.6); rig.fezRoll = life.fezRoll;
    /* il dito fermo vicino alla testa: un lento battito d'occhi */
    if (lastF && CALM[cat.state] && now - ptr.t < 6 && ptr.still > 1.3 && now - life.slow > 7) { var h = toPage(lastF.head.x, lastF.head.y); if (hyp(ptr.x - h.x, ptr.y - h.y) < 80) life.slow = now; }
  }

  /* girarsi: la testa parte per prima, il corpo un attimo dopo; in piedi fa due passetti sul posto invece di girare come un piatto */
  var STEPPY = { stand: 1, crouch: 1, "b-sniff": 1, "b-coil": 1 };
  function turnStep(dt) {
    var goal = yawFor(cat.face, cat.dir), lead = onEdge() && cat.vis && cat.state !== "peek" && cat.state !== "dive" && cat.state !== "think";
    if (life.goal == null) life.goal = goal;
    if (Math.abs(wrap(goal - life.goal)) > 0.7 && lead) { life.turnAt = now; life.turnTo = goal; }
    life.goal = goal;
    if (lead && now - (life.turnAt || -9) < 0.1) rig.yawT = rig.yaw;   /* il corpo aspetta un attimo: si gira prima la testa */
    var err = Math.abs(wrap(rig.yawT - rig.yaw)), step = lead && cat.plat && rig.grounded && STEPPY[rig.pose] && err > 0.25;
    if (step) { if (cat.state !== "walk") { rig.walkT = 1; rig.speedU = 0; } life.stepping = true; }
    else if (life.stepping) { life.stepping = false; if (cat.state !== "walk") rig.walkT = 0; }
  }

  /* ------------------------------------------------------------------ un passo del mondo */
  function step(dt) {
    now += dt; readView(); if (now - world.at > 0.8) readWorld();
    if (script) { var i; for (i = script.length - 1; i >= 0; i--) if (now >= script[i].t) { var fn = script[i].fn; script.splice(i, 1); fn(); } }
    cat.st += dt; rig.yawT = yawFor(cat.face, cat.dir);
    rig.tailSwish -= life.flAdd || 0; var S = STATES[cat.state]; if (S) S(dt, cat.d);
    applyMood(); turnStep(dt);
    if (CALM[cat.state] && now > (life.flAt || 0) && !reduced) { life.flAt = now + rr(3, 7); life.flT = now; }
    life.tailKick = (life.tailKick || 0) * Math.exp(-dt * 3.5);
    life.flAdd = (CALM[cat.state] ? 0.32 * bell(seg(now - (life.flT || -9), 0, 0.7)) : 0) + life.tailKick; rig.tailSwish += life.flAdd;   /* la punta della coda dà un colpetto ogni tanto; dopo un salto la coda continua */
    if (drag && !drag.moved && !drag.pet && now - drag.t0 > 0.45 && CALM[cat.state] && cat.plat && !reduced) { drag.pet = true; set("pet", { face: "view", pose: "sit" }); }
    if (!ptr.touch && ptr.sp > 1000 && now - ptr.t < 0.12 && cat.plat && (cat.state === "sit" || cat.state === "look" || cat.state === "pause") && now > (life.pounceAt || 0) && !reduced) {
      var pdx = ptr.x - cat.x, pdy = ptr.y - (cat.y - 20); if (Math.abs(pdx) < 170 && Math.abs(pdx) > 30 && Math.abs(pdy) < 80) { life.pounceAt = now + 10; set("pounce", { tx: clamp(ptr.x, cat.plat.a, cat.plat.b), wait: 0.8, then: "sit" }); }
    }
    if (life.braceAt && now - life.braceAt < 0.1 && cat.plat && cat.vis && (cat.state === "sit" || cat.state === "look" || cat.state === "pause" || cat.state === "loaf") && !reduced) { life.braceAt = 0; set("brace", { face: cat.face, pose: "crouch" }); }
    if (cat.state !== "walk" && rig.walk > 0.03 && cat.plat && onEdge()) cat.x = clamp(cat.x + rig.walk * cat.coast * dt, cat.plat.a, cat.plat.b);
    if (cat.plat && onEdge()) cat.rel = cat.x - cat.plat.tile.l;
    if (!cat.ownRot) cat.rot *= Math.exp(-dt * 10); cat.ownRot = false;
    if (!cat.ownLift) cat.lift *= Math.exp(-dt * 12); cat.ownLift = false;
    if (rig.spring) { var vw = rig.rate * 1.35, va = -vw * vw * cat.voff - 2 * rig.zeta * vw * cat.voffV; cat.voffV += va * dt; cat.voff += cat.voffV * dt; }   /* lo scarto dell'origine rientra con la stessa molla delle pose */
    else cat.voff *= Math.exp(-dt * rig.rate);
    if (Math.abs(cat.voff) < 0.01 && Math.abs(cat.voffV) < 0.05) { cat.voff = 0; cat.voffV = 0; }
    gaze(dt); lifeStep(dt);
    rig.wx = cat.x / K; rig.wy = -cat.y / K;
    rig.step(dt);
    stepFez(dt); stepProps(dt); if (bubble) bubble.phys(dt);
    for (var j = scratches.length - 1; j >= 0; j--) { scratches[j].step(dt); if (scratches[j].dead) scratches.splice(j, 1); }
    /* fuori dalla vista: torna */
    var free = CALM[cat.state] || cat.state === "sleep" || cat.state === "drape" || cat.state === "sulk";
    if (free && cat.vis && !catInView()) { cat.offT += dt; if (cat.offT > 1.2) { cat.offT = 0; comeBack(); } } else cat.offT = 0;
    if (life.sayAt && now >= life.sayAt) { life.sayAt = 0; say("salam, sono Dot.", 4); }
    if (!frenchDone && (now - lastIn > 90 || now - openedAt > 240) && CALM[cat.state] && cat.vis && inView(cat.y, 80, 0) && !(bubble && bubble.on)) {
      frenchDone = true; try { sessionStorage.setItem("dot-fr", "1"); } catch (e) {}
      if (cat.plat && cat.state !== "walk") set("greet", { face: "view", pose: "sit", dur: 6.4, text: "Lo sapevi che «chat» vuol dire gatto in francese?", sec: 6, kind: "long" });   /* lo dice lui: si siede, ti guarda, inclina la testa */
      else say("Lo sapevi che «chat» vuol dire gatto in francese?", 6, "long");
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
  /* quanto si allarga il gatto a sinistra e a destra (unità del modello) */
  function frameX(f) {
    var a = f.head.x - f.head.rx, b = f.head.x + f.head.rx, i, l, p = f.tail.pts;
    for (i = 0; i < 4; i++) { l = f.legs[i]; a = Math.min(a, l.fx - l.paw, l.kx - l.r0); b = Math.max(b, l.fx + l.paw, l.kx + l.r0); }
    for (i = 0; i < p.length; i++) { a = Math.min(a, p[i].x - p[i].r); b = Math.max(b, p[i].x + p[i].r); }
    a = Math.min(a, f.body.hips.x - f.body.hips.r, f.body.chest.x - f.body.chest.r); b = Math.max(b, f.body.hips.x + f.body.hips.r, f.body.chest.x + f.body.chest.r);
    return [a, b];
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
      /* «dietro il bordo» vale solo davanti al riquadro (o alla scatola): ciò che sporge di lato, sotto il bordo, si vede */
      if (env.clipY != null && cat.hideL != null && cat.clipTop == null && !cat.rot) {
        var xl = (cat.hideL - cat.x - jx) / k, xr = (cat.hideR - cat.x - jx) / k, ext = frameX(f);
        if (ext[0] < xl || ext[1] > xr) {
          var e2 = envFor(k), cy0 = env.clipY; c.save(); c.beginPath(); c.rect(-500, cy0 - 1000, 500 + xl, 1000); c.rect(xr, cy0 - 1000, 500, 1000); c.clip();
          try { look.draw(c, f, e2); } catch (e) {} c.restore();
        }
      }
      var dp = (look && look.drawProp) || DOT.looks.base.drawProp;
      for (i = 0; i < props.length; i++) { var pr = props[i];
        if (pr.held) { c.save(); c.translate(f.hold.x, f.hold.y + (pr.hOff || -1.2)); try { dp(c, pr.name, { t: pr.t, open: pr.open, held: true, frame: f }, env); } catch (e) {} if (pr.steam > 0.02) steam(c, pr, 7); c.restore(); }
        else if (pr.front) { c.save(); c.translate(pr.front.x, pr.front.y); c.scale(pr.sc, pr.sc); try { dp(c, pr.name, { t: pr.t, open: pr.open, held: false, frame: f }, env); } catch (e) {} c.restore(); }
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
    if (drag) { if (e.cancelable) e.preventDefault(); return; }       /* un secondo dito sul gatto: conta solo il primo */
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
    if (!drag || (e && e.pointerId !== drag.id)) return;               /* si alza un altro dito: il primo tiene ancora il gatto */
    var d = drag; drag = null;
    try { grab.releasePointerCapture(d.id); } catch (er) {}
    if (!d.moved) { if (d.pet) { if (cat.state === "pet") { cat.jit = 0; life.slow = now + 0.2; sitFor(rr(2, 3)); } } else if (e && e.type !== "pointercancel") tap(); return; }
    if (cat.state !== "held") return;
    /* la velocità degli ultimi 0.1 s fino al momento in cui si alza il dito: se il dito era fermo, il gatto non viene lanciato */
    var h = d.hist, a = null, b = h[h.length - 1], i, rt = perf(); for (i = h.length - 1; i >= 0; i--) if (rt - h[i].rt <= 0.1) a = h[i];
    if (!a) { release(0, 0); return; }
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
    layer = doc.createElement("div"); layer.className = "dot-layer"; (O.parent && O.parent.nodeType === 1 ? O.parent : doc.body).appendChild(layer);   /* O.parent: un contenitore che taglia ciò che sporge */
    grab = doc.createElement("button"); grab.type = "button"; grab.className = "dot-grab"; grab.setAttribute("aria-label", "Dot, il gatto"); grab.style.display = "none"; layer.appendChild(grab);
    bubble = fx().Bubble(layer);
    look = DOT.looks[O.look] || DOT.looks.base; rig = DOT.makeRig(look.preset); addPoses(rig); rig.autoBlink = false; rig.spring = 1; rig.earTwitch = false;
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
    cat.mood = null; cat.taps = []; cat.jit = 0; cat.tangle = 0; life.fezRollT = 0; if (bubble) bubble.hide(); sound("purr", false);   /* «Rivedi»: si riparte puliti */
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
    if (!B.on) return; B.on = false; cancelAnimationFrame(raf); clearInterval(stillI); sound("purr", false);
    window.removeEventListener("pointermove", onPtr); window.removeEventListener("pointerdown", onPtrDown); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); doc.removeEventListener("visibilitychange", onVis);
    if (RO) { try { RO.disconnect(); } catch (e) {} RO = null; }
    if (stageOn && stage.unmount) { try { stage.unmount(); } catch (e) {} } stageOn = false; B.mounted = false;
    killFez(); props = []; scratches = []; if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; catSp = null; cat.state = "off";
  };
  DOT.setLook = function (name) {
    if (!rig) return; var nl = DOT.looks[name]; if (!nl) return; var old = rig; look = nl; rig = DOT.makeRig(look.preset); addPoses(rig); rig.spring = 1; rig.earTwitch = false;
    rig.pose = old.pose; rig.over = old.over; rig.yawT = old.yawT; rig.pitchT = old.pitchT; rig.rollT = old.rollT; rig.fezOn = old.fezOn; rig.longT = old.longT; rig.walkT = old.walkT; rig.speedU = old.speedU; rig.grounded = old.grounded;
    rig.look.ty = old.look.ty; rig.look.tp = old.look.tp; rig.pupilT = old.pupilT; rig.pupilDotT = old.pupilDotT; rig.poseAs = old.poseAs; rig.edge = old.edge; rig.eyeMood = old.eyeMood; rig.faceTurn = old.faceTurn; rig.gaitT = old.gaitT;
    rig.snap(old.pose); rig.gait = old.gait; rig.autoBlink = false;
  };
  DOT.setDark = function (d) { dark = !!d; };                         /* tema della pagina: scuro (true) o chiaro; vale dal fotogramma dopo */
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
