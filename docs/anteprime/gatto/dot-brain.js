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
  var layer = null, flayer = null, flayerOwn = null, catSp = null, grab = null, bubble = null, scratches = [], props = [], fez = null, stage = null, stageOn = false;
  var CWU = 124, CHU = 134, OXU = 62, OYU = 70;               /* la tela del gatto, in unità: larga, alta, origine dentro */
  var cat = { x: 0, y: 0, s: 1, dir: 1, face: "view", plat: null, rel: 0, state: "off", st: 0, d: {}, lift: 0, gy: null, rot: 0, piv: 12, clipY: null, paws: false, vis: false,
    att: null, gz: true, coast: 0, offT: 0, voff: 0, voffV: 0, ownRot: false, ownLift: false, clipAt: null, hideL: null, hideR: null, blinkO: null, last: "", lastTap: "", taps: [], hold: null, jit: 0,
    mood: null, moodKeys: null };
  var view = { sx: 0, sy: 0, vw: 360, vh: 640, bi: 0, ti: 0 };
  var world = { tiles: [], plats: [], no: [], quiet: [], keep: [], sig: "", at: 0, dock: null };
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
  function above(n, y) { return !(n.b < y - 84 * K / 1.5 || n.t > y + 2); }
  function hwNo() { return 46 * K / 1.5; }                            /* metà della larghezza del gatto con la coda (seduto, di lato, in volo), in pixel a questa grandezza */
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
    /* le parole (titoli, righe, chip: [data-dot-keep] e il selettore O.keep) sono come il Corano per chi sta sul bordo di sotto:
       il gatto non ci si siede davanti. Il tratto di bordo sotto una parola resta, ma segnato (cov): ci si può cadere, mai restarci */
    var keep = [], ks = "[data-dot-keep]" + (O.keep ? ", " + O.keep : ""), kel, kr, kh = 74 * K / 1.5, kl = 52 * K / 1.5, km = hwNo();
    try { kel = doc.querySelectorAll(ks); } catch (e) { kel = doc.querySelectorAll("[data-dot-keep]"); }
    for (i = 0; i < kel.length && keep.length < 240; i++) { var rl = keepRects(kel[i]), ctl = isCtl(kel[i]); for (j = 0; j < rl.length; j++) { kr = rl[j]; if (kr.width < 2 || kr.height < 2) continue; keep.push({ l: kr.left + view.sx, t: kr.top + view.sy, r: kr.right + view.sx, b: kr.bottom + view.sy, c: ctl }); } }
    var cut = no.slice(); if (stageOn && stage.rim) { try { var rm = stage.rim(), bh = B.home || { y: rm.y }; cut.push({ l: rm.x - rm.w / 2 - 8, r: rm.x + rm.w / 2 + 8, t: rm.y - 8, b: bh.y, m: 10 }); } catch (e) {} }
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; if (t.mode === "no") continue;
      var m = Math.max(24, t.rad * 0.6 + 12), segs = [[t.l + m, t.r - m]], qz = [], k, q;
      for (j = 0; j < cut.length; j++) { var n = cut[j], mm = n.m || hwNo(); if (above(n, t.t)) segs = cutSegs(segs, n.l - mm, n.r + mm); }   /* mai sopra il Corano (né dentro la scatola): si taglia il tratto che gli sta sotto */
      for (j = 0; j < qt.length; j++) if (qt[j] !== t && above(qt[j], t.t)) qz.push([qt[j].l - hwNo(), qt[j].r + hwNo(), 0]);
      for (j = 0; j < keep.length; j++) { var kp = keep[j]; if (kp.b > t.t - kh && kp.t < t.t + 2 && kp.r > t.l && kp.l < t.r) qz.push([kp.l - km, kp.r + km, t.t - kp.b >= kl ? 2 : 1]); }   /* una parola meno di 74 px sopra il bordo (la statura del gatto seduto, col fez): sopra 52 px ci si può stare sdraiati (2), sotto no (1) */
      /* sotto un riquadro «quiet» (e sul suo bordo) il tratto resta, ma è segnato: ci si può cadere, mai restarci. Così sotto una parola (cov);
         sotto una parola un po' più alta il tratto è «low»: solo sdraiato (pagnotta, sonno) */
      for (j = 0; j < segs.length; j++) {
        var parts = [[segs[j][0], segs[j][1], t.mode === "quiet", false, false]];
        for (k = 0; k < qz.length; k++) { var np2 = [], zk = qz[k][2]; for (q = 0; q < parts.length; q++) { var pa = parts[q], za = qz[k][0], zb = qz[k][1];
          if (zb <= pa[0] || za >= pa[1]) { np2.push(pa); continue; }
          if (za > pa[0]) np2.push([pa[0], za, pa[2], pa[3], pa[4]]);
          np2.push([Math.max(pa[0], za), Math.min(pa[1], zb), pa[2] || zk < 2, pa[3] || zk === 1, pa[4] || zk === 2]);
          if (zb < pa[1]) np2.push([zb, pa[1], pa[2], pa[3], pa[4]]); }
          parts = np2; }
        for (q = 0; q < parts.length; q++) { pa = parts[q]; if (pa[1] - pa[0] >= 26) plats.push({ el: t.el, tile: t, a: pa[0], b: pa[1], y: t.t, quiet: pa[2], cov: pa[3] && t.mode !== "quiet", low: pa[4] && !pa[2] }); }
      }
    }
    /* chi si è mosso: per ogni riquadro di prima, di quanto (o se non c'è più) */
    var moved = [], any = false, ot, nt;
    for (i = 0; i < oldTiles.length; i++) { ot = oldTiles[i]; nt = null; for (j = 0; j < tiles.length; j++) if (tiles[j].el === ot.el) { nt = tiles[j]; break; }
      moved.push({ el: ot.el, o: ot, n: nt, dx: nt ? nt.l - ot.l : 0, dy: nt ? nt.t - ot.t : 0 });
      if (!nt || Math.abs(nt.l - ot.l) > 0.3 || Math.abs(nt.t - ot.t) > 0.3 || Math.abs(nt.w - ot.w) > 0.3) any = true; }
    world.tiles = tiles; world.plats = plats; world.no = cut; world.quiet = qt; world.keep = keep; world.moved = moved;
    dockSync(true);
    if (oldPlat && oldPlat.fixed) { cat.plat = world.dock; oldPlat = null; }   /* sul dock: il dock non è un riquadro, resta dov'è (fisso sullo schermo) */
    if (oldPlat) {                                                             /* il gatto resta attaccato al suo riquadro */
      var mo = moveOf(oldPlat.el), ntl = mo ? mo.n : tileOf(oldPlat.el), otl = mo ? mo.o : oldPlat.tile;
      if (!ntl) { cat.plat = null; if (onEdge()) B.evict = "lost"; }
      else {
        var want = ntl.l + (cat.x - otl.l) * (otl.w > 1 ? ntl.w / otl.w : 1), pn = platFor(oldPlat.el, want), gap = pn ? (want < pn.a ? pn.a - want : want > pn.b ? want - pn.b : 0) : 1e9;
        if (onEdge()) {
          cat.y = ntl.t; cat.gy = ntl.t; cat.plat = pn;
          if (pn && gap <= 8) { cat.x = clamp(want, pn.a, pn.b); B.evict = pn.quiet ? "quiet" : null; }   /* va bene così (anche se una lettura di prima diceva di no) */
          else { cat.x = want; B.evict = pn ? "spot" : "lost"; }             /* il suo posto non c'è più (ora sotto il Corano, o il riquadro si è stretto) */
        } else { cat.plat = pn; if (mo) { cat.x += mo.dx; cat.y += mo.dy; if (cat.gy != null) cat.gy += mo.dy; } }
      }
    }                                                                          /* senza bordo (oldPlat null): B.evict resta com'era, step() lo legge una volta */
    if (any) follow();
    /* i riquadri si sono spostati di colpo (una rotazione, un filtro) sotto un gatto in volo, e ora è davanti al Corano: sparisce
       (si è nascosto) e torna da un bordo visibile, invece di attraversare il versetto */
    if (any && cat.vis && AIRBORNE[cat.state] && (boxNo(cat.x, cat.y) || covered() === 2)) { if (cat.d && cat.d.sc) { cat.d.sc.done(); cat.d.sc = null; } cat.vis = false; cat.plat = null; cat.lift = 0; cat.rot = 0; cat.s = 1; set("wait"); }
    world.at = now;
  }
  /* un comando (un campo, un bottone, un link, il codice QR da inquadrare): coperto, un tocco andrebbe al gatto invece che a lui */
  function isCtl(el) { try { var m = el.matches || el.webkitMatchesSelector; return !!(m && m.call(el, "a, button, input, select, textarea, [tabindex], .pill, .qr__carta, a *, button *")); } catch (e) { return false; } }
  /* dove stanno davvero le parole di un elemento: le righe di testo (un titolo corto in un blocco largo occupa solo il suo pezzo), o il riquadro intero se non ha testo */
  var keepRange = null;
  function keepRects(el) {
    var out = [], rl, i, er = el.getBoundingClientRect(), over = false;
    if (el.getAttribute && el.getAttribute("data-dot-keep") === "box") return [er];   /* un testo che cambia da solo (la città del globo): conta tutto il suo riquadro */
    try { if (!keepRange && doc.createRange) keepRange = doc.createRange(); if (keepRange) { keepRange.selectNodeContents(el); rl = keepRange.getClientRects();
      for (i = 0; i < rl.length; i++) { if (rl[i].left < er.left - 2 || rl[i].right > er.right + 2) over = true; out.push(rl[i]); } } } catch (e) { out = []; }
    if (!out.length || over) return [er];                              /* testo che esce dal suo riquadro (una riga che scorre, come i saluti): conta tutto il riquadro */
    return out;
  }
  /* ------------------------------------------------------------------ il dock: un posatoio fisso sullo schermo (DOT.start({ dock }))
     Non è un riquadro: è la cima di una pillola che non scorre con la pagina. Il suo bordo si rilegge a ogni passo (coordinate della
     pagina = scorrimento + posto sullo schermo); chi ci sta sopra lo segue e si disegna in uno strato fisso (flayer), così mentre la
     pagina scorre resta fermo sulla pillola invece di tremare. */
  var dockOp = { at: -9, on: false }, dockRad = null;
  function dockSync(full) {
    var el = O.dock; if (!el || el.nodeType !== 1) { world.dock = null; return null; }
    var r = el.getBoundingClientRect(), p = world.dock;
    if (!p) p = world.dock = { el: el, fixed: true, a: 0, b: 0, y: 0, quiet: false, cov: false, low: false, tile: { el: el, l: 0, t: 0, r: 0, b: 0, w: 0, h: 0, mode: "dock", rad: 26 } };
    if (full || dockRad == null) { try { dockRad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; } catch (e) { dockRad = 26; } }
    if (full || now - dockOp.at > 0.25) { dockOp.at = now; var op = 1; try { op = +getComputedStyle(el).opacity; } catch (e) { op = 1; } dockOp.on = r.height > 0 && op > 0.6; }
    var t = p.tile, m = Math.max(24, dockRad * 0.6 + 12);
    t.l = r.left + view.sx; t.r = r.right + view.sx; t.t = r.top + view.sy; t.b = r.bottom + view.sy; t.w = r.width; t.h = r.height; t.rad = dockRad;
    p.y = t.t; p.a = t.l + m; p.b = t.r - m; p.on = dockOp.on && p.b - p.a > 40; p.sy = r.top;
    return p;
  }
  function dockOn() { var p = world.dock; return !!(p && p.on); }
  function onDock() { return !!(cat.plat && cat.plat.fixed); }
  /* in groppa: sul dock e disegnato nello strato fisso (anche mentre spunta o si cala dietro la pillola) */
  function riding() { return !!(flayer && cat.vis && onDock() && onEdge()); }
  function moveOf(el) { var i, m = world.moved || []; for (i = 0; i < m.length; i++) if (m[i].el === el) return m[i]; return null; }
  function tileOf(el) { var i; for (i = 0; i < world.tiles.length; i++) if (world.tiles[i].el === el) return world.tiles[i]; return null; }
  /* il tratto di bordo del riquadro el più vicino a x (o null) */
  function platFor(el, x) { var i, p, best = null, bd = 1e9, d; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (p.el !== el) continue; d = x < p.a ? p.a - x : x > p.b ? x - p.b : 0; if (d < bd) { bd = d; best = p; } } return best; }
  /* un bordo ricordato da prima di una rilettura: quello di adesso, dello stesso riquadro, vicino a x */
  function fresh(p, x) { if (!p || world.plats.indexOf(p) >= 0) return p; if (p.fixed) return world.dock; return p.el ? platFor(p.el, x == null ? (p.a + p.b) / 2 : x) : null; }
  /* i riquadri si sono mossi: chi era in viaggio verso di loro (un salto, un'uscita dalla scatola, una sbirciata), i graffi, il fez e gli oggetti li seguono */
  function follow() {
    var d = cat.d, s = cat.state, m, np, i;
    if (s === "air" && d.q) {                                                  /* il salto finisce dove il bordo è adesso: lo scarto entra piano nel resto del volo */
      m = moveOf(d.q.el); var u = sat(cat.st / d.dur), ob = d.oB || { x: 0, y: 0 }, oa = d.oA || { x: 0, y: 0 }, w = d.oB ? (d.ou >= 0.98 ? 1 : eIO(seg(u, d.ou, 1))) : 0;
      np = m && m.n ? platFor(d.q.el, d.x1 + ob.x + m.dx) : null;
      if (!np) d.q = null;
      else { var nx = clamp(d.x1 + ob.x + (m ? m.dx : 0), np.a, np.b); d.oA = { x: lerp(oa.x, ob.x, w), y: lerp(oa.y, ob.y, w) }; d.oB = { x: nx - d.x1, y: np.y - d.y1 }; d.ou = u; d.q = np;
        /* il bordo è andato lontano (un riordino, non una rotazione): non lo insegue; oppure il resto del volo passerebbe davanti al Corano: si rifà da qui */
        if (hyp(d.oB.x - d.oA.x, d.oB.y - d.oA.y) > 140) d.replan = true;
        else { var j, uu, tt2, px2, py2, wj, lx = cat.x, ly = cat.y; for (j = 1; j <= 24 && !d.replan; j++) { uu = lerp(u, 1, j / 24); tt2 = uu * d.dur; wj = d.ou >= 0.98 ? 1 : eIO(seg(uu, d.ou, 1));
          px2 = lerp(d.x0, d.x1, uu) + lerp(d.oA.x, d.oB.x, wj); py2 = (d.vy0 != null ? d.y0 + d.vy0 * tt2 + 0.5 * GRAV * tt2 * tt2 : lerp(d.y0, d.y1, uu)) + lerp(d.oA.y, d.oB.y, wj);
          if (pathNo(lx, ly, px2, py2)) d.replan = true; lx = px2; ly = py2; } } }
    }
    if (s === "crouch" && d.q) { m = moveOf(d.q.el); np = m && m.n ? platFor(d.q.el, d.tx + m.dx) : null; if (np) { d.tx = clamp(d.tx + m.dx, np.a, np.b); d.ty = np.y; }
      d.q = np && !arcBlocked(cat.x, cat.y, d.tx, d.ty, d.high) ? np : null; }   /* il salto che stava per fare ora passerebbe davanti al Corano: ci ripensa */
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
  var AIRBORNE = { air: 1, fall: 1, fly: 1, slide: 1, hang: 1, tumble: 1 };
  function onEdge() { var s = cat.state; return !(s === "air" || s === "held" || s === "fall" || s === "fly" || s === "slide" || s === "hang" || s === "opening" || s === "boxed" || s === "box"); }
  function landOn(p) { cat.plat = p; cat.y = p.y; cat.gy = p.y; cat.rel = cat.x - p.tile.l; }
  /* «si vede»: sopra e sotto ci possono essere strisce coperte (una barra in alto view.ti, la barra dell'anteprima o di Safari in fondo view.bi): lì non si vede */
  function inView(y, top, bot) { return y > view.sy + view.ti + (top || 0) && y < view.sy + view.vh - view.bi - (bot || 0); }
  function catInView() { var k = px(); return cat.y - 24 * k > view.sy + view.ti + 30 && cat.y - 10 * k < view.sy + view.vh - view.bi + 4; }
  function inset(b) { var v = 0; try { v = typeof b === "function" ? +b() : +b; } catch (e) { v = 0; } return v > 0 && v < view.vh * 0.5 ? v : 0; }
  function readInset() { view.bi = inset(O.bottomInset); view.ti = inset(O.topInset); }
  /* i bordi buoni che si vedono; low: quelli dove si può stare solo sdraiati (una parola poco sopra); m: margini più stretti (dopo un'attesa lunga) */
  function visPlats(low, m) { var o = [], i, p, mt = m ? 56 : 96, mb = m ? 14 : 26; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (!p.quiet && !!p.low === !!low && inView(p.y, mt, mb) && p.a < view.sx + view.vw - 30 && p.b > view.sx + 30) o.push(p); } return o; }
  /* i riquadri «quiet» (il riquadro sui conflitti): il gatto non ci sta, non ci gioca, non ci parla */
  function rectHits(list, x0, y0, x1, y1) { var i, n; for (i = 0; i < list.length; i++) { n = list[i]; if (x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return n; } return null; }
  function overQuiet(m) { var b = catBox(); if (!b || !cat.vis) return false; m = m || 0; return !!rectHits(world.quiet, b.x0 - m, b.y0 - m, b.x1 + m, b.y1 + m); }
  function onQuiet() { return !!(cat.plat && cat.plat.quiet) || overQuiet(2); }
  function gameRoom() { return !onQuiet() && !rectHits(world.quiet, cat.x - 150, cat.y - 170, cat.x + 150, cat.y + 30); }   /* spazio per un gioco o un oggetto, lontano dal riquadro quiet */
  /* sotto un riquadro «no» (il Corano): fez compreso, il gatto lo coprirebbe */
  function underNo(x, y) { var j, n, hw = hwNo(); for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (!n.m && above(n, y) && x > n.l - hw && x < n.r + hw) return true; } return false; }
  function platBelow(x, y, any) { var i, p, b = null; for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if ((any || !p.quiet || true) && x >= p.a - 8 && x <= p.b + 8 && p.y >= y - 3 && (!b || p.y < b.y)) b = p; }
    p = world.dock; if (p && p.on && x >= p.a - 8 && x <= p.b + 8 && p.y >= y - 3 && (!b || p.y < b.y)) b = p;   /* cadendo, anche la cima del dock tiene */
    return b; }
  function floorAt(x, y) { var p = platBelow(x, y, true); return p ? p.y : Infinity; }
  function tileAt(x, y) { var i, t; for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (x >= t.l && x <= t.r && y >= t.t && y <= t.b) return t; } return null; }
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
    if (fez && fez.hold && state !== "fezoff" && !(fez.back && fez.back.free)) { fez.hold = false; fez.back = null; }   /* interrotto mentre lanciava il fez: il fez ricade da solo (sul suo riquadro) */
    cat.state = state; cat.st = 0; cat.d = d || {};
    cat.jit = 0; cat.tangle = 0; rig.headRoll = 0; life.fezRollT = 0;   /* valori che uno stato rimette a ogni fotogramma: se lo stato è interrotto non restano */
    rig.over = {}; rig.walkT = 0; rig.pitchT = 0; rig.rollT = 0; rig.longT = 0; rig.tailSwish = 0; rig.tailRate = 0; rig.grounded = true; rig.rate = 12; rig.pupilT = 0.8; rig.pupilDotT = 0;
    rig.headMax = HEADMAX; rig.breathRate = 1.9; rig.turn = 9;
    rig.poseAs = null; rig.edge = null; rig.eyeMood = null; rig.faceTurn = null; rig.gaitT = null; cat.moodKeys = null;
    cat.clipAt = null; cat.clipTop = null; cat.hideL = cat.hideR = null; cat.paws = false; cat.att = null; cat.gz = true; cat.ownRot = false;
    if (cat.d.face) cat.face = cat.d.face; if (cat.d.pose) rig.pose = cat.d.pose;
  }
  function think() { if (reduced) return sitFor(1e9); set("think"); }   /* movimento ridotto: resta seduto */
  /* un appoggio stretto (la pillola del dock, il logo 3x3): ci si siede raccolti, la coda girata davanti, niente che penzola */
  function narrow() { var p = cat.plat; return !!(p && (p.fixed || (p.tile && p.tile.mode === "perch"))); }
  function sitFor(dur, o) { var d = o || {}; d.dur = dur; d.face = d.face || "view"; d.pose = d.pose || (narrow() ? "ride" : "sit"); set("sit", d); }
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
    if (reduced) { if (O.strict) return sitFor(1e9); if (!p || p.quiet || !catInView()) return comeBack(); return sitFor(1e9); }   /* la casa, movimento ridotto: resta seduto dov'è (la mensola) */
    if (O.strict) {                                                    /* la casa: fuori vista aspetta (lo riporta follow2), sul dock fa la vita del dock */
      if (!p) { cat.vis = false; return set("wait"); }
      if (p.fixed) return dockDecide(p);
      if (!catInView()) return sitFor(rr(1.5, 3));
    }
    if (!p || !catInView()) return comeBack();
    if (p.quiet || onQuiet()) return leaveQuiet();                     /* sul riquadro «quiet» (o sotto) non resta: se ne va subito, senza storie */
    if (underNo(cat.x, cat.y)) return escapeJump();
    if (p.low) return lowLife(p);                                      /* una parola poco sopra: qui si sta solo sdraiati */
    if (fez && !rig.fezOn && !fez.back) {                              /* il fez è per terra (un tocco interrotto): prima va a riprenderlo, se ci arriva */
      if (fezReach()) return fetchFez();
      /* non ci arriva (il Corano in mezzo): se il fez non si vede, o è lì da tanto, si nasconde un attimo dietro il bordo e risale col fez in testa */
      if ((!fezSeen() && now - fez.t0 > 1.5) || now - fez.t0 > 20) return set("dive", { fez: true, wait: 0.7, face: "side", pose: "crouch" });
    }
    if (sgHold()) return sitFor(rr(1.4, 2.2));                         /* il dito fantasma sta per arrivare: resta seduto dov'è */
    var w = {}, k, base = now - lastIn > 25 ? SLEEPY : IDLE; for (k in base) w[k] = base[k];
    if (now < life.propAt || props.length || !gameRoom()) w.prop = 0;   /* niente oggetti vicino al riquadro quiet */
    if (p.b - p.a < 60) { w.walk = 0.02; w.dive *= 0.5; }
    if (world.keep.length && rectHits(world.keep, cat.x - 44 * px(), cat.y, cat.x + 44 * px(), cat.y + 40 * px())) w.drape = 0;   /* le zampe e la coda che pendono coprirebbero una parola sotto il bordo */
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
  /* su un tratto «low» (una parola poco sopra la testa): pagnotta o sonno; ogni tanto se ne va su un bordo dove ci si può sedere */
  function lowLife(p) {
    if (rnd() < 0.35) { var o = jumpTargets(p); if (o.length) { var j = pick(o); return jumpTo(j.p, j.x); } }
    if (rnd() < (now - lastIn > 25 ? 0.6 : 0.4)) return set("sleep", { dur: rr(9, 15), face: "view", pose: "loaf" });
    return set("loaf", { dur: rr(5, 9), face: "view", pose: "loaf" });
  }
  function lowNow() { return !!(cat.plat && cat.plat.low); }
  function walkTo(tx, then, o) { var d = o || {}; d.tx = tx; d.then = then; d.face = "side"; d.pose = "stand"; cat.dir = tx >= cat.x ? 1 : -1; set("walk", d); }
  function walkSome(p) {
    var tx = cat.x, n = 0; if (p.b - p.a < 50) return sitFor(rr(2, 4));
    while (Math.abs(tx - cat.x) < 44 && n++ < 14) tx = rr(p.a, p.b);
    walkTo(tx, rnd() < 0.55 ? "sit" : "pause");
  }
  function jumpTargets(p, maxDy) {
    var o = [], v = visPlats(), i, q, tx; if (p && p.fixed) return o;  /* dal dock non si salta: si scende dietro la pillola */
    for (i = 0; i < v.length; i++) { q = v[i]; if (q === p || q.quiet || Math.abs(q.y - cat.y) > (maxDy || 330)) continue; tx = clamp(cat.x + rr(-90, 90), q.a, q.b); if (Math.abs(tx - cat.x) > 380) continue;
      if (!arcBlocked(cat.x, cat.y, tx, q.y)) o.push({ p: q, x: tx }); }   /* l'arco vero del salto, con tutto il corpo: mai davanti al Corano */
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
    clearHeld(); if (cat.plat && cat.plat.cov && !reduced && unblock(1, true)) return;   /* sotto una parola: due passi fino al tratto libero dello stesso bordo */
    var o = cat.plat ? jumpTargets(cat.plat, 520) : [], i, q, tx, best = null, bs = 1e9;
    if (o.length) { o.sort(function (a, b) { return hyp(a.x - cat.x, a.p.y - cat.y) - hyp(b.x - cat.x, b.p.y - cat.y); }); return jumpTo(o[0].p, o[0].x, "sit", { quick: true }); }
    for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (q.quiet || q.low || q === cat.plat) continue; tx = clamp(cat.x, q.a + 6, q.b - 6);
      if (Math.abs(q.y - cat.y) > 520 || Math.abs(tx - cat.x) > 380 || arcBlocked(cat.x, cat.y, tx, q.y)) continue; var sc = hyp(tx - cat.x, q.y - cat.y); if (sc < bs) { bs = sc; best = { p: q, x: tx }; } }
    if (best) return jumpTo(best.p, best.x, "sit", { quick: true });
    if (cat.plat) return set("dive", { away: true, face: "side", pose: "crouch" });
    cat.vis = false; set("wait");
  }
  /* torna dove lo si vede: spunta da dietro il bordo di un riquadro visibile, oppure ci salta dentro da fuori (mai su un riquadro quiet: allora aspetta fuori vista) */
  function comeBack(relax) {
    if (O.strict) return strictBack();                                  /* la casa: torna su un posatoio buono (la mensola, il logo, un bordo libero) o sul dock */
    var v = visPlats(false, relax); if (!v.length) return comeLow(relax);
    v.sort(function (a, b) { return Math.abs(a.y - cat.y) - Math.abs(b.y - cat.y); });
    var q = v[0], x = clamp(cat.x, q.a + 10, q.b - 10);
    clearHeld();
    if (reduced) { cat.x = x; landOn(q); cat.vis = true; cat.voff = 0; cat.voffV = 0; cat.lift = 0; cat.rot = 0; cat.s = 1; sitFor(1e9); rig.snap("sit"); return; }   /* movimento ridotto: è già lì, seduto */
    if (rnd() >= 0.62 && cat.state !== "wait") {                      /* entra con un salto da fuori: da sotto o da sopra, dal lato il cui arco non passa davanti al Corano */
      var fromTop = cat.y < view.sy, sy = fromTop ? view.sy - 30 : view.sy + view.vh + 70, hi = fromTop ? 16 : 40, s0 = rnd() < 0.5 ? -1 : 1, i, sx;
      for (i = 0; i < 2; i++) { sx = clamp(x + (i ? -s0 : s0) * 60, view.sx + 20, view.sx + view.vw - 20);
        if (!arcBlocked(sx, sy, x, q.y, hi)) { cat.x = sx; cat.y = sy; cat.gy = null; cat.plat = null; jumpTo(q, x, "sit", { quick: true, high: hi }); return; } }
    }
    cat.x = x; cat.plat = q; set("peek", { p: q, x: x });             /* spunta da dietro il bordo: non attraversa nulla */
  }
  /* nessun bordo dove sedersi in vista: se c'è un tratto «low» (si sta solo sdraiati) ci salta dentro da fuori e si accoccola; se no aspetta fuori vista */
  function comeLow(relax) {
    var v = visPlats(true, relax), i, q, x, sx, sy, fromTop = cat.y < view.sy;
    clearHeld();
    for (i = 0; i < v.length; i++) { q = v[i]; if (q.b - q.a < 44) continue; x = clamp(cat.x, q.a + 14, q.b - 14);
      if (reduced) { cat.x = x; landOn(q); cat.vis = true; cat.voff = 0; cat.voffV = 0; cat.lift = 0; cat.rot = 0; cat.s = 1; set("sit", { dur: 1e9, face: "view", pose: "loaf" }); rig.snap("loaf"); return; }
      sy = fromTop ? view.sy - 30 : view.sy + view.vh + 70; sx = clamp(x + (x > view.sx + view.vw / 2 ? 60 : -60), view.sx + 20, view.sx + view.vw - 20);
      if (!arcBlocked(sx, sy, x, q.y, fromTop ? 16 : 40)) { cat.vis = true; cat.x = sx; cat.y = sy; cat.gy = null; cat.plat = null; jumpTo(q, x, function () { set("loaf", { dur: rr(5, 9), face: "view", pose: "loaf" }); }, { quick: true, high: fromTop ? 16 : 40 }); return; } }
    cat.vis = false; if (cat.state !== "wait") set("wait");
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
  /* il rettangolo del gatto in volo (piedi in x, y) tocca un riquadro «no»? lungo un tratto, un campione ogni 14 px */
  function boxNo(x, y) { var j, n, hw = 54 * K / 1.5, hh = 72 * K / 1.5; for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (n.m) continue; if (x + hw > n.l && x - hw < n.r && y + 8 > n.t && y - hh < n.b) return true; } return false; }   /* il corpo in volo: allungato, con la coda dietro, arriva a 54 unità-pixel dal punto dei piedi */
  /* un lancio con questa velocità (la stessa fisica di «fly») passa davanti a un riquadro «no» prima di posarsi? */
  function throwHitsNo(vx, vy) {
    var x = cat.x, y = cat.y + (below() - below("air")) * px(), i, j, q, h = 1 / 60, y0;
    for (i = 0; i < 180; i++) { y0 = y; vy += 2000 * h; x += vx * h; y += vy * h;
      if (x < view.sx + 14 || x > view.sx + view.vw - 14) { x = clamp(x, view.sx + 14, view.sx + view.vw - 14); vx = -vx * 0.35; }
      if (boxNo(x, y)) return true;
      if (vy > 0) for (j = 0; j < world.plats.length; j++) { q = world.plats[j]; if (y0 <= q.y && y >= q.y && x >= q.a - 10 && x <= q.b + 10) return false; }
      if (y > view.sy + view.vh + 160) return false; }
    return false;
  }
  function pathNo(x0, y0, x1, y1) { var n = Math.max(1, Math.ceil(hyp(x1 - x0, y1 - y0) / 14)), i; for (i = 1; i <= n; i++) if (boxNo(lerp(x0, x1, i / n), lerp(y0, y1, i / n))) return true; return false; }
  /* il salto vero (lo stesso arco di arc(), con lo stesso apice) passa davanti al Corano? controlla tutto il corpo, non solo i piedi */
  function arcBlocked(x0, y0, x1, y1, c) {
    var d = arc(x0, y0, x1, y1, c), i, u, tt, x, y, lx = x0, ly = y0;
    for (i = 1; i <= 24; i++) { u = i / 24; tt = u * d.dur; x = lerp(x0, x1, u); y = y0 + d.vy0 * tt + 0.5 * GRAV * tt * tt; if (pathNo(lx, ly, x, y)) return true; lx = x; ly = y; }
    return O.strict ? arcKeep(x0, y0, x1, y1, c) : false;
  }
  /* «strict» (la casa): un viaggio non passa mai davanti a una parola, a un comando, al riquadro quiet o dietro il dock.
     Il corpo in volo è un rettangolo attorno ai piedi (x, y): largo 2 hw, alto hh sopra i piedi */
  function boxKeep(x, y) {
    var hw = 30 * K / 1.5, hh = 62 * K / 1.5, x0 = x - hw, x1 = x + hw, y0 = y - hh, y1 = y + 4, i, n, L = world.keep;
    for (i = 0; i < L.length; i++) { n = L[i]; if (x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return true; }
    for (i = 0; i < world.quiet.length; i++) { n = world.quiet[i]; if (x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return true; }
    n = world.dock; if (n && n.on) { n = n.tile; if (x1 > n.l && x0 < n.r && y1 > n.t + 2 && y0 < n.b) return true; }
    return false;
  }
  function arcKeep(x0, y0, x1, y1, c) {
    var d = arc(x0, y0, x1, y1, c), i, u, tt, x, y;
    for (i = 2; i <= 22; i++) { u = i / 24; tt = u * d.dur; x = lerp(x0, x1, u); y = y0 + d.vy0 * tt + 0.5 * GRAV * tt * tt; if (boxKeep(x, y)) return true; }
    return false;
  }
  /* l'arco vero di un salto, con tutto il corpo, per una fuga: se parte fuori da un riquadro «no» non ci deve passare mai;
     se parte davanti al Corano può solo uscirne, mai rientrarci. -1 = bloccato, altrimenti quanti campioni sta ancora dentro */
  function escArc(x0, y0, x1, y1, c) {
    var d = arc(x0, y0, x1, y1, c), i, u, tt, x, y, lx = x0, ly = y0, out = !boxNo(x0, y0), n = 0;
    for (i = 1; i <= 24; i++) { u = i / 24; tt = u * d.dur; x = lerp(x0, x1, u); y = y0 + d.vy0 * tt + 0.5 * GRAV * tt * tt;
      if (pathNo(lx, ly, x, y)) { if (out) return -1; n++; } else out = true; lx = x; ly = y; }
    return boxNo(x1, y1) ? -1 : n;
  }
  /* via da davanti al Corano (o da una caduta che ci passerebbe davanti): un salto vero, da dove è, al bordo migliore.
     Mai un arco che passa davanti al Corano (se parte già lì, ne esce e non ci rientra), mai un arrivo sotto il Corano o sul
     riquadro quiet; meglio i bordi visibili, vicini, verso l'alto. Se non c'è nessun salto pulito: si nasconde dietro il suo
     bordo (se ne ha uno) e torna altrove, oppure torna subito altrove (comeBack) */
  function escapeJump() {
    var i, j, q, tx, n, sc, best = null, bs = 1e9, inside = boxNo(cat.x, cat.y), H = [24, 8, 60], clean = null, cs = 1e9;
    for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (q.quiet || q.low) continue; tx = clamp(cat.x, q.a + 6, q.b - 6); if (underNo(tx, q.y)) continue;
      for (j = 0; j < H.length; j++) { n = escArc(cat.x, cat.y, tx, q.y, H[j]); if (n < 0 || n > 3) continue;   /* da davanti al Corano se ne esce subito (al massimo 3 campioni su 24), mai attraversandolo */
        sc = hyp(tx - cat.x, q.y - cat.y) + n * 8 + j * 30 + (inView(q.y, 60, 20) ? 0 : 500) + (inside && q.y > cat.y + 20 ? 140 : 0);
        if (sc < bs) { bs = sc; best = { p: q, x: tx, h: H[j] }; }
        if (O.strict && sc < cs && !arcKeep(cat.x, cat.y, tx, q.y, H[j])) { cs = sc; clean = { p: q, x: tx, h: H[j] }; }   /* sulla casa: meglio un salto che non passa davanti a una parola */
        break; } }
    if (O.strict && !clean && cat.plat && onEdge() && !onDock()) return set("dive", { away: true, face: "side", pose: "crouch" });   /* nessun salto pulito: giù dietro il suo bordo, poi torna da un posto buono */
    if (O.strict && clean) best = clean;
    if (!best) { if (cat.plat && onEdge()) return set("dive", { away: true, face: "side", pose: "crouch" }); return comeBack(); }   /* sul bordo: giù dietro il bordo (si allontana dal Corano), poi torna altrove */
    cat.plat = null; cat.dir = best.x >= cat.x ? 1 : -1;
    set("air", arc(cat.x, cat.y, best.x, best.p.y, best.h, { q: best.p, then: "shake", face: "side", pose: "air" }));
  }
  /* il gatto (spostato di dx px) sta davanti al Corano (2) o a una parola (1)? dal rettangolo dell'ultimo fotogramma */
  function covered(dx) {
    var b = catBox(); if (!b || !cat.vis) return 0; dx = dx || 0; var x0 = b.x0 + dx + 2, x1 = b.x1 + dx - 2, y0 = b.y0 + 2, y1 = b.y1 - 2, i, n;
    for (i = 0; i < world.no.length; i++) { n = world.no[i]; if (!n.m && x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return 2; }
    for (i = 0; i < world.keep.length; i++) { n = world.keep[i]; if (x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return 1; }
    return 0;
  }
  /* un tratto buono dello stesso bordo che contiene x */
  function sibling(p, x) { var i, q; for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (q.el === p.el && !q.quiet && !q.low && Math.abs(q.y - p.y) < 1 && x >= q.a && x <= q.b) return q; } return null; }
  /* davanti a una parola (kind 1) o al Corano (kind 2): cammina fino al punto libero più vicino dello stesso bordo, se è vicino.
     Due volte in pochi secondi non basta (si è rimesso lì): allora no, e chi chiama lo fa saltare via */
  function unblock(kind, any) {
    var p = cat.plat; if (!p || reduced) return false;
    if (!any && now - (life.unblockAt || -99) < 6) return false;
    var dx, i, x, q, best = null, far = kind === 2 ? 48 : 130;
    for (dx = 6; dx <= far && !best; dx += 6) for (i = -1; i <= 1; i += 2) { x = cat.x + i * dx; q = sibling(p, x); if (q && !underNo(x, q.y) && !covered(x - cat.x)) { best = { x: x + i * 4, q: q }; break; } }
    if (!best) return false;
    life.unblockAt = now; var q2 = best.q;
    walkTo(clamp(best.x, q2.a + 2, q2.b - 2), "sit", { lo: Math.min(cat.x, q2.a), hi: Math.max(cat.x, q2.b), gait: Math.abs(best.x - cat.x) > 60 ? "trot" : "walk" });
    cat.plat = q2; return true;
  }
  /* fermo su un bordo con una parte del corpo davanti al Corano o a una parola (un riordino, un atterraggio storto): si sposta */
  var GUARD = { sit: 1, look: 1, loaf: 1, sleep: 1, groom: 1, yawn: 1, stretch: 1, drape: 1, sulk: 1, pause: 1, purr: 1, meow: 1, hop: 1, greet: 1, shake: 1, annoyed: 1, land: 1, think: 1 };
  function guard() {
    if (!cat.vis || !cat.plat || cat.plat.fixed || !GUARD[cat.state] || (cat.st < 0.12 && life.guardAt) || drag || fake || now < (life.guardAt || 0)) return;   /* sul dock ci pensa dockLife(); dopo un refresh guarda subito */
    if (cat.plat.low && cat.state === "land") return;                  /* sta per accucciarsi */
    life.guardAt = now + 0.2; var k = covered(); if (!k) return;
    if (O.strict && cat.plat.tile && cat.plat.tile.mode === "perch") return set("dive", { away: true, face: "side", pose: "crouch" });   /* il logo è stretto: niente passi, giù dietro i tasti (torna poi da un posto buono) */
    if (DOT.debug && DOT.debug.log) DOT.debug.log.push({ t: +now.toFixed(1), s: cat.state, k: k, x: Math.round(cat.x), y: Math.round(cat.y), a: Math.round(cat.plat.a), b: Math.round(cat.plat.b), low: !!cat.plat.low, bb: catBox() });
    if (unblock(k)) return;
    if (k === 2) return escapeJump();
    var o = jumpTargets(cat.plat, 420); if (o.length) { o.sort(function (a, b) { return hyp(a.x - cat.x, a.p.y - cat.y) - hyp(b.x - cat.x, b.p.y - cat.y); }); return jumpTo(o[0].p, o[0].x, "sit", { quick: true }); }
    set("dive", { away: true, face: "side", pose: "crouch" });
  }
  function clearHeld() { var i; for (i = 0; i < props.length; i++) if (props[i].held) dropProp(props[i]); }
  /* dopo una rilettura dei riquadri il suo posto non va più bene: why = "lost" (il riquadro non c'è più), "spot" (il suo punto
     del bordo non c'è più: ora sta sotto il Corano, o il riquadro si è stretto), "quiet" (ora è sul riquadro quiet o sotto) */
  function relocate(why) {
    clearHeld();
    if (reduced) return comeBack();
    if (inNo(cat.x, cat.y) || underNo(cat.x, cat.y) || covered() === 2) return escapeJump();
    if (why === "quiet" || (cat.plat && cat.plat.quiet)) return leaveQuiet();
    if (why === "spot" && cat.plat && Math.abs(clamp(cat.x, cat.plat.a, cat.plat.b) - cat.x) < 60) return walkTo(clamp(cat.x, cat.plat.a + 4, cat.plat.b - 4), "sit");
    if (O.strict) {                                                      /* la casa: niente cadute davanti alle parole di sotto. Due passi, o giù dietro il bordo (poi torna da un posto buono) */
      if (cat.plat && unblock(1, true)) return;
      if (cat.plat) return set("dive", { away: true, face: "side", pose: "crouch" });
      cat.vis = false; return set("wait");
    }
    var p = platBelow(cat.x, cat.y + 2);                               /* il bordo sotto i piedi è sparito: cade sul primo sotto, o salta via se cadrebbe davanti al Corano */
    reanchor(below() - below("air")); cat.plat = null;
    if (p && !fallBlocked(cat.x, cat.y) && p.y - cat.y < view.vh) return set("fall", { p: p, vy: 0, face: "view", pose: "air" });
    escapeJump();
  }

  /* i passi: lento (pigro), normale, trotto; v in px al secondo, t = durata di un ciclo */
  var GAITS = { stroll: { v: 30, t: 0.56 }, walk: { v: 42, t: 0.46 }, trot: { v: 74, t: 0.34 } };
  var STATES = {
    off: function () {}, wait: function (dt, d) {                      /* fuori vista: ogni 0.6 s guarda se c'è un bordo; dopo 9 s di attesa (è andato via offeso, o la pagina mostra poco) accetta bordi più vicini al margine */
      cat.vis = false; d.w = (d.w || 0) + dt; if (O.strict) return;     /* la casa: lo riporta follow2 (dopo circa quattro secondi a pagina ferma) */
      if (cat.st > 0.6) { cat.st = 0; var relax = d.w > 9, v = visPlats(false, relax), vl = v.length ? v : visPlats(true, relax); if (vl.length) { var w0 = d.w; cat.vis = true; comeBack(relax); if (cat.state === "wait") cat.d.w = w0; } } },
    think: function () { decide(); },
    sit: function (dt, d) {
      var st = cat.st; if (d.plop == null) d.plop = Math.abs(rig.A.hy - rig.poses.sit.hy) > 1.5;
      if (st < 0.5 && d.plop) { var pl = bell(seg(st, 0.12, 0.32)) - 0.35 * bell(seg(st, 0.32, 0.5)); rig.over.sqy = 1 - 0.045 * pl; rig.over.sqx = 1 + 0.03 * pl; } else if (!d.pl) { d.pl = 1; delete rig.over.sqy; delete rig.over.sqx; }   /* si siede con un piccolo «plof» */
      if ((rig.pose === "sit" || rig.pose === "ride") && d.mood !== "proud" && !reduced) rig.over.hr = rig.poses[rig.pose].hr + 0.07 * Math.sin(now * 0.43 + 1.3) * smooth(0.4, 1.4, st);   /* da fermo la testa ondeggia piano: non è una foto */
      if (d.mood === "proud") { rig.over.hp = 0.14; rig.over.lid = 0.28; } if (st > d.dur) { if (d.then) d.then(); else think(); }
    },
    pause: function (dt, d) { rig.pose = "stand"; if (cat.st > (d.dur || 0.8)) think(); },
    look: function (dt, d) {                                           /* curioso: la testa scatta, il corpo no */
      if (!d.at || now > d.at) { d.at = now + rr(0.5, 1.2); d.tx = rnd() < 0.3 ? null : { x: cat.x + rr(-220, 220), y: cat.y - rr(-30, 160) }; }
      cat.att = d.tx; if (cat.st > d.dur) think();
    },
    walk: function (dt, d) {                                           /* prima si gira (passetti sul posto, la testa per prima), poi parte piano, va, rallenta */
      var p = cat.plat; if (!p) return think(); var lo = d.lo != null ? d.lo : p.a, hi = d.hi != null ? d.hi : p.b;   /* d.lo/d.hi: da un tratto all'altro dello stesso bordo */
      if (!d.g) { var dist = Math.abs(d.tx - cat.x); d.g = d.speed ? { v: d.speed, t: 0.46 * Math.sqrt(42 / d.speed) } : GAITS[d.gait || (dist > 160 && rnd() < 0.4 ? "trot" : dist < 70 || now - lastIn > 25 ? "stroll" : "walk")]; d.go = 0; }
      var left = (d.tx - cat.x) * cat.dir, g = d.g, spd = 0; rig.gaitT = g.t; if (g === GAITS.trot) rig.headMax = null;   /* di corsa il profilo vero va bene */
      if (cat.st < 0.3) cat.att = { x: d.tx + cat.dir * 60, y: cat.y - 24 * px() };                     /* la testa parte per prima */
      if (aligned(0.32)) { d.go += dt; spd = g.v * (0.12 + 0.88 * smooth(0, 0.42, d.go)) * (0.3 + 0.7 * smooth(0, 22, left)); }
      rig.walkT = 1; rig.speedU = spd / (px() * Math.max(0.35, Math.abs(Math.cos(rig.yaw)))); cat.coast = spd * cat.dir;   /* il piede a terra resta fermo sullo schermo anche col corpo di tre quarti */
      if (cat.mood && cat.mood.k === "annoyed") { rig.over.te = 1.2; rig.over.tc = 0.15; rig.tailSwish = 0.25; rig.tailRate = 5; rig.faceTurn = 0; cat.gz = false; rig.look.ty = 0; rig.look.tp = 0.16; rig.gazeT[0].x = rig.gazeT[1].x = 0; }   /* se ne va offeso: coda dritta, naso all'insù, non ti guarda */
      cat.x += cat.dir * rig.walk * spd * dt;
      if (left <= 1 || cat.x < lo - 2 || cat.x > hi + 2) { cat.x = clamp(cat.x, lo, hi); if (d.lo != null) cat.x = clamp(cat.x, p.a, p.b); rig.walkT = 0; var th = d.then;
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
      if (d.replan) {                                                  /* i riquadri si sono mossi: da qui cade dritto, o salta via se cadendo passerebbe davanti al Corano */
        var tr = sat(cat.st / d.dur) * d.dur, cvy = d.vy0 != null ? d.vy0 + GRAV * tr : 0; reanchor(below() - below("air"));
        if (!fallBlocked(cat.x, cat.y) && !inNo(cat.x, cat.y)) set("fall", { vy: Math.max(0, cvy), vx: (d.x1 - d.x0) / d.dur * 0.3, face: "view", pose: "air" }); else escapeJump();
        return;
      }
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
      if (st > (d.quiet ? 0.24 : lowNow() ? 0.2 : 0.4)) { var th = d.then;   /* su un tratto low si accuccia subito: non si alza in piedi sotto la parola */
        if (cat.plat && cat.plat.quiet && th !== leaveQuiet) th = leaveQuiet;   /* comunque sia arrivato sul riquadro quiet, riparte subito */
        else if (cat.plat && !cat.plat.fixed && th !== "none" && th !== leaveQuiet && underNo(cat.x, cat.y)) { escapeJump(); return; }
        else if (lowNow() && th !== "none" && typeof th !== "function") { set("loaf", { dur: rr(5, 9), face: "view", pose: "loaf" }); return; }   /* su un tratto low: subito giù, a pagnotta */
        if (typeof th === "function") th(); else if (th === "shake") set("shake", { face: "side", pose: "stand" }); else if (th === "none") {} else if (fez && !rig.fezOn && cat.plat && !reduced && fezReach()) fetchFez(); else sitFor(rr(1.6, 3.2)); }
    },
    shake: function (dt, d) {                                          /* si scrolla: la testa vibra, il fez ondeggia, poi torna composto */
      if (lowNow()) { rig.headRoll = 0; return set("loaf", { dur: rr(4, 7), face: "view", pose: "loaf" }); }   /* sotto una parola: niente scrollata in piedi */
      var st = cat.st, e = sat(1 - st / 0.75); rig.headRoll = 0.42 * Math.sin(st * 30) * e * seg(st, 0, 0.06); rig.over.ear = 0.3 * e; rig.over.eye = 0.4 + 0.6 * (1 - e);
      if (st < 0.05) life.fezRollV += 1.5; if (st > 0.85) { rig.headRoll = 0; sitFor(rr(1.5, 2.5), d.annoyed ? { pose: "annoyed" } : null); }
    },
    hop: function (dt, d) {                                            /* il saltello felice */
      var st = cat.st, u = seg(st, 0.2, 0.58); cat.ownLift = true;
      if (st < 0.2) { rig.pose = "b-coil"; cat.lift = 0; rig.over.eye = 1.1; }
      else if (u < 1) { rig.pose = u < 0.7 ? "air" : "b-reach"; rig.grounded = false; cat.lift = 4 * 22 * u * (1 - u) * px() / 1.5; rig.pitchT = 0.25 * (1 - 2 * u); rig.over.sqy = 1 + 0.06 * (1 - 2 * u); rig.over.sqx = 1 - 0.04 * (1 - 2 * u); }
      else { cat.lift = 0; rig.pitchT = 0; rig.pose = st < 0.7 ? "land" : "sit"; rig.over.sqy = st < 0.66 ? 0.9 : 1; rig.over.sqx = st < 0.66 ? 1.06 : 1; if (st < 0.6) life.fezRollV += 0.4 * cat.dir; }
      if (st > 0.62) { rig.over.eye = st < 1.3 ? 0 : 1; rig.eyeMood = "happy"; }
      if (st > 1.5) { if (typeof d.then === "function") d.then(); else sitFor(rr(1.6, 2.6)); }   /* d.then: il primo tocco, poi le fusa */
    },
    loaf: function (dt, d) { if (cat.st > d.dur) think(); },
    sleep: function (dt, d) {
      if (cat.st > 1.1) { rig.pose = "sleep"; life.fezRollT = 0.32; rig.tailRate = -1.1; rig.eyeMood = "sleep"; }
      if (cat.st > d.dur) { life.fezRollT = 0; set("wakeup", { face: "view", pose: "loaf" }); }
    },
    wakeup: function (dt) {                                            /* occhi lenti, stiracchiata, sbadiglio */
      var st = cat.st; rig.eyeMood = "sleep";
      if (st < 0.7) { rig.over.eye = 0.7 * seg(st, 0.1, 0.6); rig.over.lid = 0.45; }
      else if (lowNow()) { set("loaf", { dur: rr(3, 6), face: "view", pose: "loaf" }); }   /* una parola poco sopra: niente stiracchiata col sedere in su né sbadiglio seduto */
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
      if (p.fixed) return set("dockdown", { away: !!d.away, then: d.then });   /* sul dock si scende dietro la pillola */
      if (!d.e) d.e = cat.y;
      var g0 = d.quick ? 0.03 : d.away ? 0.12 : 0.3, g1 = d.quick ? 0.21 : d.away ? 0.4 : 0.62;   /* quick: giù subito (un filtro sta per spostare il suo riquadro) */
      if (st > g0) { cat.clipAt = d.e; cat.hideL = p.tile.l; cat.hideR = p.tile.r; var u = seg(st, g0, g1); cat.y = d.e + eIn(u) * 46 * px(); rig.pose = "sit"; }
      if (d.away && st > g1 + 0.05) { cat.y = d.e; cat.vis = false; cat.plat = null; cat.clipAt = null; cat.hideL = cat.hideR = null; if (typeof d.then === "function") d.then(); else set("wait"); return; }
      if (d.fez && fez && st > 0.62) { if (fezSeen()) fez.fade = 1; else { killFez(); rig.fezOn = true; } }   /* dietro il bordo si rimette il fez (quello rimasto lontano svanisce piano) */
      if (st > 0.62 + (d.wait || 1.3)) { cat.y = d.e; cat.x = clamp(cat.x + rr(-50, 50), p.a + 6, p.b - 6); set("peek", { p: p, x: cat.x }); }
    },
    peek: function (dt, d) {                                           /* spunta dal bordo: orecchie, occhi, due zampe; si guarda attorno; poi sale davvero */
      if (!d.p) { cat.vis = false; return set("wait"); }                 /* il suo riquadro non c'è più */
      cat.vis = true; var st = cat.st, p = d.p, k = px(), P0 = rig.poses.peek;
      var pf = O.strict && !d.first && !d.ab ? platFor(p.el, d.x) || p : null;   /* i segni del bordo di adesso (un filtro può aver spostato le parole sopra, anche senza spostare il bordo) */
      if (pf && (pf.quiet || pf.low || pf.cov)) { d.ab = now; d.ay = cat.y; }   /* una parola (o il riquadro quiet) sopra quel bordo: torna giù, dietro lo stesso bordo */
      if (d.ab) { var ua = seg(now, d.ab, d.ab + 0.2); cat.plat = p; cat.x = d.x; cat.clipAt = p.y; cat.hideL = p.tile.l; cat.hideR = p.tile.r; rig.grounded = false; rig.pose = "peek"; cat.y = lerp(d.ay, p.y + 34 * k, ua * ua);
        if (ua >= 1) { cat.vis = false; cat.plat = null; cat.clipAt = null; cat.hideL = cat.hideR = null; set("wait"); } return; } cat.plat = p; cat.x = d.x; cat.gy = null; cat.clipAt = p.y; cat.hideL = p.tile.l; cat.hideR = p.tile.r; rig.grounded = false;
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
    var s = cat.state; if (s === "swat") s = "sit";                    /* la zampata è un attimo: conta come seduto */
    if (cat.vis && onQuiet()) { cat.taps = []; if (!reduced && s !== "crouch" && s !== "air" && s !== "land" && s !== "fall" && s !== "fly" && s !== "held") leaveQuiet(); return; }   /* sul riquadro quiet un tocco lo fa solo andare via: niente miao, niente giochi */
    if (reduced) { say("miao", 1.2, "mini"); sound("meow"); return; }
    if (s === "boxed" || s === "box") return boxOut();
    if (SG.firstNow) {                                                 /* il primo tocco vero della sessione: la risposta più calda, un saltello felice e le fusa */
      SG.firstNow = false;
      if (cat.vis && cat.plat && onEdge() && (CALM[s] || ASLEEP[s] || s === "knock" || s === "sulk" || s === "annoyed")) {
        clearHeld(); cat.mood = null; cat.s = 1; SG.ks = false; cat.taps = [now];
        var warm = function () { set("purr", { face: "view", pose: narrow() ? "ride" : lowNow() ? "loaf" : "sit", dur: rr(2.4, 3) }); };
        if (lowNow()) return warm();                                   /* sotto una parola: niente saltello davanti a lei, solo le fusa */
        cat.lastTap = "hop"; return set("hop", { face: "view", pose: "crouch", then: warm });
      }
    }
    if (cat.vis && lowNow() && onEdge()) { cat.taps = []; life.earFlick = 1; var lo = jumpTargets(cat.plat, 420); if (lo.length && s !== "crouch") { lo.sort(function (a, b) { return hyp(a.x - cat.x, a.p.y - cat.y) - hyp(b.x - cat.x, b.p.y - cat.y); }); jumpTo(lo[0].p, lo[0].x, "sit"); } return; }   /* sdraiato sotto una parola: un tocco lo fa spostare dove può sedersi (lì miagola, gioca) */
    if (ASLEEP[s] || (s === "loaf" && cat.st > 3)) return set("annoyed", { face: "view", pose: s === "drape" ? "drape" : "loaf", from: s });
    if (s === "sulk" || s === "annoyed") { rig.tailSwish = 0.8; life.earFlick = 1; say("mrr", 0.9, "mini"); return; }
    if (!CALM[s] || !cat.plat) return;
    if (cat.taps.length >= 4 && s !== "hide") { cat.taps = []; return fedUp(); }
    clearHeld();
    var fezOk = rig.fezOn && cat.plat.b - cat.plat.a > 70 && !onDock() && !(O.strict && rectHits(world.keep, cat.x - 110, cat.y - 175, cat.x + 110, cat.y - 56 * K / 1.5));   /* sul dock no; sulla casa il volo del fez non passa davanti a una parola */
    var w = { meow: 0.34, fez: fezOk ? 0.26 : 0, hop: 0.2, purr: 0.2 }, k = wpick(w, cat.lastTap); cat.lastTap = k;
    if (k === "meow") set("meow", { face: "view", pose: "sit" });
    else if (k === "fez") set("fezoff", { face: "view", pose: "sit" });
    else if (k === "hop") set("hop", { face: "view", pose: "crouch" });
    else set("purr", { face: "view", pose: "sit", dur: rr(2.2, 3) });
  }
  function fedUp() {                                                   /* troppi tocchi: se ne va nella scatola (o su un altro riquadro) */
    if (onDock()) { moodSet("annoyed", 10); return set("dockdown", { away: true }); }   /* sul dock: giù dietro la pillola, offeso; torna più tardi */
    if (stageOn && boxVisible()) return goBox();
    var o = jumpTargets(cat.plat, 520); if (!o.length) return set("annoyed", { face: "view", pose: "sit", from: "sit" });
    o.sort(function (a, b) { return Math.abs(b.x - cat.x) - Math.abs(a.x - cat.x); }); jumpTo(o[0].p, o[0].x, function () { set("sulk", { face: "back", pose: "annoyed", dur: rr(6, 8) }); });
  }

  Object.assign(STATES, {
    greet: function (dt, d) {                                          /* «salam, sono Dot.»: la bocca si muove due volte, la testa si inclina, poi un lento battito d'occhi */
      var st = cat.st, T = TS(), at = d.at != null ? d.at : (d.at = d.text ? 0.25 : stageOn && B.openT0 != null ? clamp(T.bubble - T.land - 0.4, 0.15, 0.6) : 0.3);
      if (st > at && !d.said) { d.said = 1; say(d.text || "salam, sono Dot.", d.sec || 4, d.kind); if (!d.text) SG.salamAt = now; }   /* il suggerimento conta da quando questa nuvoletta se ne va */
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
          if (!fp.quiet && inView(fp.y, 60, 20) && Math.abs(fp.y - cat.y) < 330 && Math.abs(jx - cat.x) < 380 && !arcBlocked(cat.x, cat.y, jx, fp.y)) {
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
        if (st - d.t > 0.8) { var h6 = fezHome(); if (!fezArcClear(fez.b.x, fez.b.y, h6.x, h6.y, true)) { sitFor(rr(1.5, 2.5)); return; }   /* l'arco passerebbe davanti al Corano: per ora lo lascia lì */
          d.ph = 3; d.t = st - 0.74; d.side = fez.b.x > cat.x ? 1 : -1; d.far = 1; }
      } else if (d.ph === 3) {                                         /* lo annusa, ci infila il muso sotto, colpo di testa: il fez vola in alto e ricade in testa */
        var u3 = st - d.t; cat.face = "side";
        if (!fez) { if (d.fly) { rig.over = { sqy: 0.93, sqx: 1.04, hp: 0.04 }; d.ph = 4; d.t = st; moodSet("proud", 3.2); } else think(); return; }   /* è tornato in testa (lo fa volare stepFez) */
        rig.pose = u3 < 0.55 ? "b-sniff" : u3 < 0.74 ? "b-scoop" : "b-toss"; rig.rate = u3 < 0.74 ? 13 : 19;
        cat.att = { x: fez.b.x, y: fez.b.y };
        if (u3 > 0.74 && !d.fly) { d.fly = 1; fezFly(d.far, d.side); life.earKickAt = now + 0.05; }
        if (d.fly && fez.back && seg(now, fez.back.t0, fez.back.t0 + fez.back.dur) > 0.35) { rig.pose = "sit"; cat.face = "view"; rig.rate = 12; }
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
  function pickUp(ghost) {                                             /* ghost: il dito fantasma del suggerimento (fake.ghost): per la collottola, posa «scruff» */
    clearHeld();
    set("held", { face: "view", pose: ghost ? "scruff" : "held" }); cat.plat = null; cat.gy = null; pend.a = 0; pend.w = 0; pend.pvx = 0; pend.px = cat.x;
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
      var sp = Math.abs(vx);
      if (!drag && fake && fake.ghost) {                               /* il dito fantasma: lungo e molle, per niente impressionato, guarda dritto chi guarda */
        rig.pose = "scruff"; rig.longT = clamp(1.4 + cat.st * 6, 0, 6) + sp / 260;
        rig.over.lid = 0.5; rig.over.eye = 0.92; rig.over.brow = 0.14; rig.over.ear = 0.3 + 0.12 * sat(sp / 500); rig.tailSwish = 0.16; rig.tailRate = 1.5;
        cat.att = null; cat.gz = false; rig.look.ty = clamp(wrap(-PI / 2 - rig.yaw), -0.9, 0.9) * 0.85; rig.look.tp = -0.06; rig.gazeT[0].x = rig.gazeT[1].x = 0; rig.gazeT[0].y = rig.gazeT[1].y = 0.02;
        return;
      }
      if (rig.pose === "scruff") { rig.pose = "held"; delete rig.over.brow; cat.gz = true; }   /* il dito vero l'ha preso al posto del fantasma */
      rig.longT = clamp(3 + cat.st * 4 + sp / 140, 0, 11);
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
      if (!p && (d.vy > 0 ? inNo(cat.x, cat.y) : boxNo(cat.x, cat.y))) { escapeJump(); return; }   /* finendo davanti al Corano (cadendo, o salendo con tutto il corpo): si gira in aria e salta via */
      if (p) { cat.x = clamp(cat.x, p.a, p.b); landOn(p);
        if (p.quiet) { set("land", { then: leaveQuiet, quiet: true, v: d.vy, face: "side", pose: "land" }); return; }   /* lanciato sul riquadro quiet: atterra e se ne va, senza ruzzoloni */
        moodSet("scared", 1.6); if (Math.abs(d.vx) > 360) set("tumble", { vx: d.vx * 0.5, face: "side", pose: "loaf" }); else set("land", { then: "shake", v: d.vy, face: "side", pose: "land" }); return; }
      if (cat.y > view.sy + view.vh + 160) comeBack();
    },
    tumble: function (dt, d) {                                         /* ruzzola: un giro su sé stesso mentre striscia, poi si rimette in piedi */
      var st = cat.st, u = seg(st, 0, 0.5), p = cat.plat; cat.ownRot = true; cat.piv = 11; cat.rot = -cat.dir * TAU * eOut(u);
      cat.x = clamp(cat.x + d.vx * dt, p.a, p.b); d.vx *= Math.exp(-dt * 5); rig.pose = u < 0.85 ? "loaf" : "stand"; rig.over.eye = u < 1 ? 0.3 : 1;
      if (st > 0.62) { cat.rot = 0; if (lowNow()) set("loaf", { dur: rr(4, 7), face: "view", pose: "loaf" }); else set("shake", { face: "side", pose: "stand", annoyed: true }); }   /* sotto una parola non si rialza: resta giù */
    },
    slide: function (dt, d) {                                          /* lasciato sulla faccia di un riquadro: unghie fuori, scivola e graffia (come nel riferimento 06) */
      var t = d.t, st = cat.st, k = px(), S = rig.poses.slide; rig.grounded = false; cat.face = "front"; rig.pose = "slide"; rig.rate = 16;
      if (!d.sc) { var cxm = clamp(cat.x, t.l + 16 * k, t.r - 16 * k), cx0 = Math.max(t.l, cxm - 64), cx1 = Math.min(t.r, cxm + 64);   /* i graffi stanno in una colonna larga quanto il gatto: la tela resta piccola anche a 3x */
        d.sc = fx().Scratch(layer, { x: cx0, y: t.t, w: cx1 - cx0, h: t.b - t.t }, dark); d.sc.el = t.el; scratches.push(d.sc); }
      if (d.noB == null) { var j, n; d.noB = false; for (j = 0; j < world.no.length; j++) { n = world.no[j]; if (!n.m && n.t >= t.b - 4 && n.t < t.b + 90 && cat.x > n.l - 34 && cat.x < n.r + 34) d.noB = true; } }   /* sotto c'è il Corano (fin dove arrivano le zampe e la coda che pendono)? */
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
        if (gap > 54 && !tileAt(cat.x, t.b + 24) && !rectHits(world.no.filter(function (n) { return !n.m; }), cat.x - 30, t.b, cat.x + 30, t.b + 74)) {   /* appeso solo se sotto c'è spazio libero (mai le zampe davanti al Corano) */ reanchor((t.b - cat.y) / k); set("hang", { t: t, edgeY: t.b, w: (d.vy / 300), face: "front", pose: "hang" }); }
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
    if (sp > 650) { var f = Math.min(1, 1500 / sp), tv = { vx: vx * f, vy: vy * f }, tries = 0;
      while (tries < 5 && throwHitsNo(tv.vx, tv.vy)) { tv.vx *= 0.7; tv.vy *= 0.7; tries++; }   /* il lancio passerebbe davanti al Corano: perde forza finché non ci passa più */
      if (hyp(tv.vx, tv.vy) > 650 && !throwHitsNo(tv.vx, tv.vy)) { reanchor(below() - below("air")); set("fly", { vx: tv.vx, vy: tv.vy, face: "side", pose: "air" }); return; }
      vx = tv.vx; vy = tv.vy; }                                         /* troppo debole: lo si tratta come lasciato lì */
    var i, p, best = null, t;
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode !== "no") continue;   /* lasciato davanti al Corano: non ci cade e non ci scivola, ne salta via subito */
      if (cat.x > t.l - 8 && cat.x < t.r + 8 && bodyY + 14 * k > t.t - 4 && bodyY - 10 * k < t.b + 4) { reanchor(below() - below("air")); escapeJump(); return; } }
    var cb = catBox(), nos = world.no.filter(function (n) { return !n.m; });   /* una parte del gatto è davanti al Corano (la testa, la coda): ne salta via subito */
    if (cb && rectHits(nos, cb.x0 + 4, cb.y0 + 4, cb.x1 - 4, cb.y1 - 4)) { reanchor(below() - below("air")); escapeJump(); return; }
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode !== "quiet") continue;   /* davanti al riquadro quiet: niente graffi, niente appeso; via subito */
      if (cat.x > t.l && cat.x < t.r && bodyY > t.t + 6 && bodyY < t.b + 22) { reanchor(below() - below("air")); escapeJump(); return; } }
    for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (t.mode === "no" || t.mode === "quiet" || t.mode === "perch") continue; if (cat.x > t.l + 24 && cat.x < t.r - 24 && cat.y > t.b - 24 && cat.y < t.b + 22 && !tileAt(cat.x, t.b + 30) && !rectHits(nos, cat.x - 30, t.b, cat.x + 30, t.b + 74)) { reanchor(below() - below("hang")); set("hang", { t: t, edgeY: t.b, vx: vx, face: "front", pose: "hang" }); return; } }
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
    fez = { b: b, sp: fx().Sprite(layer, 64, 64, 32, 32, 2), tas: 0, tasW: 0, pvx: 0, hold: false, wall: null, back: null, t0: now, fade: 0, alpha: 1 };
    var p = cat.plat; if (p) fez.wall = { el: p.el, l: Math.max(p.tile.l + 8, p.a - 14), r: Math.min(p.tile.r - 8, p.b + 14) };   /* resta sul riquadro da cui è caduto: alla fine del bordo si ferma */
  }
  function killFez() { if (fez) { fez.sp.remove(); fez = null; } }
  /* il fez caduto si posa solo sul riquadro da cui è caduto (anche se salta più su del riquadro di sopra) */
  function fezFloor(x, y) { var t = fez && fez.wall ? tileOf(fez.wall.el) : null; if (!t) return objFloor(x, y); return t.t >= y - 4 ? t.t : Infinity; }
  function fezSeen() { return !!fez && inView(fez.b.y, -10, -10) && fez.b.x > view.sx - 10 && fez.b.x < view.sx + view.vw + 10; }
  /* un corpo (il fez) non entra mai in un riquadro «no»: se lo tocca ne viene spinto fuori dal lato più vicino */
  function keepOut(b, hw, hh) {
    var i, n; for (i = 0; i < world.no.length; i++) { n = world.no[i]; if (n.m) continue;
      if (b.x + hw <= n.l || b.x - hw >= n.r || b.y + hh <= n.t || b.y - hh >= n.b) continue;
      var pl = b.x + hw - n.l, pr = n.r - (b.x - hw), pt = b.y + hh - n.t, pb = n.b - (b.y - hh), mn = Math.min(pl, pr, pt, pb);
      if (mn === pl) { b.x -= pl; b.vx = Math.min(0, b.vx) * 0.3; } else if (mn === pr) { b.x += pr; b.vx = Math.max(0, b.vx) * 0.3; }
      else if (mn === pt) { b.y -= pt; b.vy = Math.min(0, b.vy) * 0.2; } else { b.y += pb; b.vy = Math.max(0, b.vy); } }
  }
  /* il volo del fez che torna in testa: un arco (quadratica) dal fez alla testa. Libero se non passa davanti a un riquadro «no» */
  function fezArc(x0, y0, x1, y1, far) { var top = Math.min(y0, y1) - (far === "low" ? 6 : 34 + (far ? 30 : 0)); return { top: top, yc: 2 * top - (y0 + y1) / 2 }; }   /* far: true = più alto, "low" = basso (sotto un Corano vicino) */
  function fezArcClear(x0, y0, x1, y1, far) {
    var a = fezArc(x0, y0, x1, y1, far), i, u, x, y, nos = world.no.filter(function (n) { return !n.m; });
    for (i = 0; i <= 16; i++) { u = i / 16; x = lerp(x0, x1, u); y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * a.yc + u * u * y1; if (rectHits(nos, x - 12, y - 12, x + 12, y + 12)) return false; }
    return true;
  }
  /* si può riprendere il fez da qui? a piedi sul suo stesso riquadro, con un salto, o richiamandolo con un colpo di testa su un arco libero */
  function fezReach() {
    if (!fez) return false; if (fez.back) return true; var p = cat.plat; if (!p) return false;
    var fp = fezPlat(); if (fp && fp.el === p.el) return true;
    if (fp) { var jx = clamp(fez.b.x - (fez.b.x > cat.x ? 1 : -1) * 15 * px(), fp.a, fp.b); if (!fp.quiet && inView(fp.y, 60, 20) && Math.abs(fp.y - cat.y) < 330 && Math.abs(jx - cat.x) < 380 && !arcBlocked(cat.x, cat.y, jx, fp.y)) return true; }
    var h = fezHome(); return fezArcClear(fez.b.x, fez.b.y, h.x, h.y, true);
  }
  /* il fez parte e vola in testa (free: non è legato a uno stato del gatto, per esempio il suo riquadro è sparito) */
  function fezFly(far, side, free) { if (!fez) return; var h = fezHome(); if (!fezArcClear(fez.b.x, fez.b.y, h.x, h.y, far) && fezArcClear(fez.b.x, fez.b.y, h.x, h.y, "low")) far = "low";
    fez.back = { x0: fez.b.x, y0: fez.b.y, a0: fez.b.ang, t0: now, far: !!far, side: side || 1, free: !!free, dur: 0 }; var tg = fezHome(); fez.back.dur = clamp(hyp(fez.b.x - tg.x, fez.b.y - tg.y) / 420, 0.5, 0.95); fez.hold = true; }
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
    if (!fez) return; var b = fez.b, F = rig.P.fez, w = fez.wall, hw = F.rBase * K + 1;
    if (fez.fade) { fez.alpha -= dt / 0.35; fez.sp.cv.style.opacity = Math.max(0, fez.alpha).toFixed(3); if (fez.alpha <= 0) { killFez(); rig.fezOn = true; return; } }
    if (fez.lost && !fez.back) {                                       /* il suo riquadro è sparito: torna in testa se l'arco è libero, se no riappare in testa */
      fez.lost = false; var h0 = fezHome(); if (cat.vis && fezArcClear(b.x, b.y, h0.x, h0.y, true)) fezFly(true, b.x > cat.x ? 1 : -1, true); else { killFez(); rig.fezOn = true; return; }
    }
    if (fez.back) {                                                    /* il volo verso la testa: un arco, un giro su sé stesso, si posa */
      var fb = fez.back, u = seg(now, fb.t0, fb.t0 + fb.dur), tg = fezHome(), a = fezArc(fb.x0, fb.y0, tg.x, tg.y, fb.far);
      b.x = lerp(fb.x0, tg.x, u); b.y = (1 - u) * (1 - u) * fb.y0 + 2 * u * (1 - u) * a.yc + u * u * tg.y;
      b.ang = lerp(fb.a0, 0, u) - fb.side * TAU * eIO(u); b.vx = b.vy = 0;
      if (u >= 1) { killFez(); rig.fezOn = true; life.fezRollV = -3.4 * fb.side; if (fb.free) life.earKickAt = now; return; }
    } else if (!fez.hold) {
      b.step(dt, w ? fezFloor : objFloor);
      if (w) { if (b.x - hw < w.l) { b.x = w.l + hw; if (b.vx < 0) b.vx = -b.vx * 0.3; b.va *= 0.5; } else if (b.x + hw > w.r) { b.x = w.r - hw; if (b.vx > 0) b.vx = -b.vx * 0.3; b.va *= 0.5; } }
      keepOut(b, hw + 2, F.h * K * 0.5 + 4);
    }
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
    var cp = cat.plat; if (cp) { pr.el = cp.el; pr.wall = { l: cp.tile.l + 6, r: cp.tile.r - 6 }; }   /* resta sul suo riquadro (il cubo buttato giù apposta no: pr.wall = null) */
    props.push(pr); life.propAt = now + rr(22, 40); return pr;
  }
  /* cadere dritti da (x, y) non passa davanti al riquadro quiet e non ci si posa sopra */
  function colClear(x, y) { var p = platBelow(x, y), ly = p ? p.y : y + view.vh, i, n; if (p && p.quiet) return false; for (i = 0; i < world.quiet.length; i++) { n = world.quiet[i]; if (x > n.l - 24 && x < n.r + 24 && n.b > y && n.t < ly + 2) return false; }
    if (O.strict && (p && p.fixed || rectHits(world.keep, x - 14, y, x + 14, Math.min(ly, y + view.vh)))) return false;   /* sulla casa il cubo buttato giù non cade davanti alle parole di sotto */
    return true; }
  function dropProp(pr) { pr.held = false; pr.front = null; var p = cat.plat; if (p) { pr.x = clamp(cat.x + cat.dir * 15 * px(), p.tile.l + 10, p.tile.r - 10); pr.y = p.y; } }
  function goneProp(pr) { pr.scT = 0; pr.leaving = true; }
  function stepProps(dt) {
    var i, pr; for (i = props.length - 1; i >= 0; i--) {
      pr = props[i]; pr.t += dt; pr.age += dt;
      pr.scV += (-(pr.sc - pr.scT) * 260 - pr.scV * 15) * dt; pr.sc += pr.scV * dt; if (pr.sc < 0) pr.sc = 0;
      if (pr.b && !pr.held && !pr.pin) { pr.b.step(dt, objFloor);
        if (pr.wall) { var hw = pr.b.r || PROPS[pr.name].w * K; if (pr.b.x - hw < pr.wall.l) { pr.b.x = pr.wall.l + hw; pr.b.vx = Math.abs(pr.b.vx) * 0.3; } else if (pr.b.x + hw > pr.wall.r) { pr.b.x = pr.wall.r - hw; pr.b.vx = -Math.abs(pr.b.vx) * 0.3; } }   /* alla fine del riquadro si ferma */
        if (pr.b.ground && !pr.leaving && rectHits(world.quiet, pr.b.x - 2, pr.b.low() + 1, pr.b.x + 2, pr.b.low() + 4)) goneProp(pr);   /* mai a riposo sul riquadro quiet */
        pr.x = pr.b.x; pr.y = pr.b.y + (pr.b.r ? pr.b.r : 0); if (pr.name === "yarn" && pr.b.ground) { var L = pr.trail; if (!L.length || Math.abs(L[L.length - 1].x - pr.x) > 2) L.push({ x: pr.x, y: pr.y }); if (L.length > 40) L.shift(); } }
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
    var nm = life.propList[life.propIx++];
    if (O.strict && nm === "star" && rectHits(world.keep, cat.x - 130, cat.y - 180, cat.x + 130, cat.y - 30)) return sitFor(rr(2, 3.5));   /* la stella svolazza sopra la testa: mai davanti a una parola */
    return beginProp(nm);
  }
  function knockAt(endX, sd) { walkTo(endX - sd * 4, function () { set("cube", { side: sd, knock: true, face: "side", pose: "sit" }); }); }
  function beginProp(name) {
    var p = cat.plat; if (!p) return think();
    var side = room(p, cat.x, 1) > room(p, cat.x, -1) ? 1 : -1;
    if (name === "cube" && rnd() < 0.5) {                               /* lo butterà giù: prima va vicino alla fine vera del riquadro (non verso la scatola o il Corano) */
      var ks = [1, -1], i; for (i = 0; i < 2; i++) { var sd = ks[i], endX = sd > 0 ? p.b : p.a, tEnd = sd > 0 ? p.tile.r : p.tile.l;
        if (Math.abs(endX - tEnd) < 46 && !fallBlocked(tEnd + sd * 6, p.y + 2) && colClear(tEnd + sd * 6, p.y + 2)) return knockAt(endX, sd); }
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
      else if (d.n >= d.turns && d.knock && !d.pushed && st > d.next) { rig.pose = "b-push"; if (st > d.next + 0.24) { d.pushed = st; pr.wall = null; pr.b.vx = d.side * 235; pr.b.va = -d.side * 2; } }
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
    for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (Math.abs(p.y - hy) > 4 || p.quiet) continue;
      var s = p.a >= r.x ? 1 : p.b <= r.x ? -1 : 0; if (!s) continue; var x = clamp(r.x + s * ((r.ow || r.w) / 2 + 46), p.a, p.b), sc = (p.b - p.a) - Math.abs(x - r.x) * 0.5; if (sc > bs) { bs = sc; best = { p: p, x: x, side: s }; } }
    if (best) return best; var q = platBelow(r.x, r.y - 4); return { p: q, x: q ? clamp(r.x + 50, q.a, q.b) : r.x + 50, side: 1 };
  }
  function boxVisible() { if (!stageOn) return false; var r = stage.rim(); return r && inView(r.y, 60, 20); }
  function goBox() {
    var r = stage.rim(), hl = homeLanding(r), p = hl.p; if (!p) return think();
    if (cat.plat && Math.abs(cat.plat.y - p.y) < 3) { var side = cat.x < r.x ? -1 : 1, i, q; for (i = 0; i < world.plats.length; i++) { q = world.plats[i]; if (Math.abs(q.y - p.y) < 3 && (side < 0 ? q.b <= r.x : q.a >= r.x)) p = q; } }
    var gx = clamp(r.x + (p.a >= r.x ? 1 : -1) * (r.w / 2 + 20), p.a, p.b);
    if (p === cat.plat) walkTo(gx, function () { boxIn(false); }, { speed: 50 });
    else if (!arcBlocked(cat.x, cat.y, gx, p.y)) jumpTo(p, gx, function () { boxIn(false); });
    else set("annoyed", { face: "view", pose: "sit", from: "sit" });   /* la scatola è oltre il Corano: se ne va offeso altrove */
  }
  function boxIn(closed) { cat.plat = null; set("boxjump", { closed: closed, x0: cat.x, y0: cat.y, face: closed ? "front" : "side", pose: closed ? "held" : "crouch" }); }
  function boxOut() { if (!stageOn) return think(); lidTo(1, 0.3); set("boxexit", { face: "front", pose: "peek" }); }
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
      if (!d.closed && cat.st < 0.18) { cat.dir = r.x > cat.x ? 1 : -1; rig.pose = "crouch"; if (!d.lid) { d.lid = 1; if ((B.lidV == null ? 1 : B.lidV) < 0.99) lidTo(1, 0.22); } return; }   /* la scatola era chiusa: il coperchio si alza mentre si prepara al salto */
      if (!d.re) { d.re = 1; if (d.closed) { reanchor(below() - below("air")); if ((B.lidV == null ? 1 : B.lidV) < 0.99) lidTo(1, 0.1); } d.x0 = cat.x; d.y0 = cat.y; }
      cat.clipAt = u > 0.55 ? r.y : null; cat.hideL = r.x - (r.ow || r.w) / 2; cat.hideR = r.x + (r.ow || r.w) / 2; rig.grounded = false; cat.gy = null;
      cat.x = lerp(d.x0, r.x, eIO(u)); cat.s = lerp(1, 0.78, u); k = px();
      cat.y = lerp(d.y0, r.floor, u) - (d.closed ? 0 : 4 * 40 * u * (1 - u)); rig.pose = u < 0.7 ? "air" : "sit"; cat.face = u < 0.7 && !d.closed ? "side" : "front";
      if (u >= 1) { if (d.closed) { lidTo(0, 0.2); cat.vis = false; set("boxed"); } else set("box", { dur: rr(7, 10), face: "front", pose: "peek" }); }
    },
    box: function (dt, d) {                                            /* nascosto: solo due occhi verdi nel buio, un po' offesi */
      var r = stage.rim(), k; cat.s = 0.78; k = px(); cat.x = r.x; cat.face = "front"; rig.pose = "peek"; cat.clipAt = r.y; cat.hideL = r.x - (r.ow || r.w) / 2; cat.hideR = r.x + (r.ow || r.w) / 2; cat.voff = 0; cat.voffV = 0; rig.grounded = false;
      var band = r.back != null ? r.y - r.back : 12 * r.w / 42.6, low = ((rig.poses.peek.cy + rig.poses.peek.dy + rig.P.eye.up) * k - band * 0.5) / k;
      cat.clipTop = r.y - band; cat.y = lerp(cat.y, r.y + low * k, 1 - Math.exp(-dt * 6)); rig.over.lid = 0.42; rig.over.brow = 0.4; rig.over.ear = 0.35; cat.att = null;
      if (cat.st > d.dur) boxOut();
    },
    boxed: function () { cat.vis = false; }
  });
  /* ------------------------------------------------------------------ i posatoi della casa (O.strict): la mensola, il dock, il logo 3x3
     Dot segue chi legge: fuori vista per circa quattro secondi con la pagina ferma, torna su un posatoio buono che si vede
     (la mensola di casa, il logo del fondo, un bordo libero), se no sul dock: spunta da dietro la pillola (orecchie, occhi, un
     saltello su) e se ne va allo stesso modo. Sul dock va con lo schermo, guarda quello che passa, guarda giù il filtro toccato.
     Se la pagina lo porta contro il dock (si scorre in su), ci sale sopra. Torna a casa quando chi legge è di nuovo in cima. */
  var FOLLOW = { sit: 1, pause: 1, look: 1, loaf: 1, sleep: 1, groom: 1, yawn: 1, stretch: 1, drape: 1, sulk: 1, think: 1, walk: 1, wait: 1 };
  var DOCKCALM = { sit: 1, look: 1, loaf: 1, pause: 1 }, DOCKREST = { sit: 1, look: 1, loaf: 1, pause: 1, sleep: 1, groom: 1, yawn: 1, stretch: 1, sulk: 1, think: 1 };
  function homeSpot() {
    if (stageOn) { try { var r = stage.rim(); if (r) { var hl = homeLanding(r); if (hl && hl.p) return hl; } } catch (e) {} }
    var h = B.home, i, p, best = null, bd = 1e9; if (!h || !h.el) return null;
    for (i = 0; i < world.plats.length; i++) { p = world.plats[i]; if (p.el !== h.el || p.quiet || p.low) continue; var x = clamp(h.x, p.a + 10, p.b - 10), d = Math.abs(x - h.x); if (d < bd) { bd = d; best = { p: p, x: x, side: 1 }; } }
    return best;
  }
  function atHome() { return !!(cat.plat && B.home && B.home.el && cat.plat.el === B.home.el); }
  function homeSeen() { var h = homeSpot(); return !!(h && inView(h.p.y, 64 * K / 1.5, 30)); }
  /* la zona dove starebbe seduto sul dock in x: libera dal Corano e dal riquadro quiet? e: margine verso dove arriva la pagina che scorre */
  function dockBlocked(x, e) {
    var p = world.dock; if (!p) return true; var hw = 34 * K / 1.5, hh = 70 * K / 1.5, v = B.vy || 0; e = e == null ? (Math.abs(v) < 30 ? 4 : 14 + Math.abs(v) * 0.4) : e;   /* la statura del gatto seduto col fez; a pagina ferma quasi niente margine */
    var x0 = x - hw - 4, x1 = x + hw + 4, y0 = p.y - hh - (v < 0 ? e : 6), y1 = p.y + (v > 0 ? e : 2), nos = world.no.filter(function (n) { return !n.m; });
    return !!(rectHits(nos, x0, y0, x1, y1) || rectHits(world.quiet, x0, y0, x1, y1));
  }
  /* sul dock in x, seduto, coprirebbe una parola o un comando della pagina che sta dietro? (dal rettangolo vero del gatto, spostato in x;
     se non è sul dock, da un rettangolo da seduto) */
  function dockWords(x, ctlOnly, low) {
    var p = world.dock; if (!p) return false; var b = !low && onDock() && cat.vis && cat.clipAt == null ? catBox() : null, x0, x1, y0, i, n, L = world.keep, y1 = p.y - 2;
    if (b) { x0 = b.x0 + (x - cat.x) + 2; x1 = b.x1 + (x - cat.x) - 2; y0 = b.y0 + 2; } else if (low) { x0 = x - 30 * K / 1.5; x1 = x + 30 * K / 1.5; y0 = p.y - 48 * K / 1.5; }   /* a pagnotta: più basso e più lungo */
    else { x0 = x - 24 * K / 1.5; x1 = x + 24 * K / 1.5; y0 = p.y - 64 * K / 1.5; }
    for (i = 0; i < L.length; i++) { n = L[i]; if ((!ctlOnly || n.c) && x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return true; }
    return false;
  }
  /* dove spuntare sul dock: vicino a dove era (o a un capo della pillola), dove la zona è libera (anche dalle parole); null se non c'è */
  function dockPickX(near) {
    var p = world.dock; if (!p || !p.on) return null; var c = [], i, m = (p.a + p.b) / 2, w = p.b - p.a, x, moving = now - (B.scrollAt || -9) < 0.3;
    if (near != null) c.push(clamp(near, p.a + 8, p.b - 8));
    c.push(p.b - rr(6, 26), p.a + rr(6, 26), m + w * 0.22, m - w * 0.22, m);
    for (x = p.a + 8; x <= p.b - 8; x += 12) c.push(x);
    if (moving) { for (i = 0; i < c.length; i++) if (!dockBlocked(c[i], 30 + Math.abs(B.vy || 0) * 0.7)) return c[i]; return null; }   /* la pagina scorre: le parole passano, contano solo il Corano e il riquadro quiet (con più margine: non risale per riscendere subito) */
    for (i = 0; i < c.length; i++) if (!dockBlocked(c[i]) && !dockWords(c[i])) return c[i];   /* meglio dove dietro non c'è nessuna parola */
    for (i = 0; i < c.length; i++) if (!dockBlocked(c[i]) && !dockWords(c[i], true)) return c[i];   /* se no almeno dove non c'è un comando */
    for (i = 0; i < c.length; i++) if (!dockBlocked(c[i])) return c[i];   /* se no comunque (poi si fa piccolo, e la maniglia lascia passare i tocchi) */
    return null;
  }
  /* fermo sul dock con una parola o un comando dietro (la pagina si è fermata lì): due passi fino a un punto libero della pillola, se c'è */
  function dockClearX(ctlOnly, far, low) {
    var p = world.dock, dx, i, x; for (dx = low ? 0 : 8; dx <= (far || 130); dx += 6) for (i = -1; i <= 1; i += 2) { x = cat.x + i * dx; if (x < p.a || x > p.b) continue; if (!dockBlocked(x) && !dockWords(x, ctlOnly, low)) return x + i * 4; }
    return null;
  }
  /* il posatoio dove tornare adesso: la mensola di casa, poi il logo del fondo, poi il dock; un bordo libero a metà schermo solo se il dock non ha posto */
  function perchChoice(onlyBest) {
    var h = homeSpot(); if (h && homeSeen()) return { kind: "home", p: h.p, x: h.x };
    var v = visPlats(), i, q, best = null, bs = 1e9, dT = dockOn() ? world.dock.y : view.sy + view.vh - view.bi, x;
    for (i = 0; i < v.length; i++) { q = v[i]; if (q.fixed || q.b - q.a < 36) continue; x = clamp(cat.x, q.a + 10, q.b - 10);
      if (q.y > dT - 120 || underNo(x, q.y) || !inView(q.y, 110 * K / 1.5, 0)) continue;   /* non troppo vicino al dock (una scrollata in su lo porterebbe contro) né in cima */
      var perch = q.tile && q.tile.mode === "perch"; if (onlyBest && !perch) continue;
      var sc = (perch ? 0 : 260) + Math.abs(q.y - (view.sy + view.vh * 0.45)) * 0.5;
      if (sc < bs) { bs = sc; best = { kind: perch ? "perch" : "edge", p: q, x: x }; } }
    if (onlyBest) return best;
    if (best && best.kind === "perch") return best;
    if (dockOn()) { x = dockPickX(cat.x); if (x != null) return { kind: "dock", x: x }; }   /* il dock va con lo schermo: lì resta in vista anche quando si scorre */
    return best;                                                       /* il dock adesso non ha posto: un bordo libero, se c'è */
  }
  /* via dal posto di prima (fuori vista): niente oggetti dimenticati, il fez di nuovo in testa */
  function tidy() {
    clearHeld(); var i; for (i = props.length - 1; i >= 0; i--) goneProp(props[i]);
    if (fez && !rig.fezOn && !fez.back) { killFez(); rig.fezOn = true; }
    cat.lift = 0; cat.rot = 0; cat.s = 1; cat.voff = 0; cat.voffV = 0; cat.clipAt = null; cat.clipTop = null; cat.hideL = cat.hideR = null;
  }
  /* arriva su un posatoio scelto da perchChoice (Dot non si vede: spunta da dietro il bordo, dalla scatola o dal dock) */
  function arrive(c) {
    tidy(); cat.vis = false;
    if (c.kind === "dock") { cat.plat = world.dock; cat.x = c.x; cat.y = world.dock.y; return set("dockup", { x: c.x }); }
    if (c.kind === "home" && stageOn && boxVisible() && rnd() < 0.5) { cat.plat = null; return boxOut(); }   /* a casa: a volte esce dalla sua scatola */
    cat.x = c.x; cat.plat = c.p; cat.y = c.p.y; set("peek", { p: c.p, x: c.x });   /* spunta da dietro il bordo: si vede dal primo passo di «peek», già tagliato al bordo */
  }
  function strictBack() {
    var c = perchChoice(); B.offT = 0;
    if (!c) { tidy(); cat.vis = false; if (cat.state !== "wait") set("wait"); B.offT = Math.max(0, (O.followAfter || 4) - 1); return; }   /* nessun posto adesso: riprova fra un secondo */
    arrive(c);
  }
  /* va via da dove è (si vede): giù dietro il dock o dietro il suo bordo, poi then() */
  function leaveThen(then) {
    if (onDock()) return set("dockdown", { then: then });
    if (cat.plat && onEdge()) return set("dive", { away: true, then: then, face: "side", pose: "crouch" });
    cat.vis = false; then();
  }
  function dockDecide(p) {
    if (dockBlocked(cat.x, 18)) return set("dockdown", { duck: true });
    if (sgHold()) return sitFor(rr(1.4, 2.2));                         /* il dito fantasma sta per arrivare: resta seduto dov'è */
    var w = { sit: 0.34, look: 0.16, loaf: 0.2, sleep: now - lastIn > 25 ? 0.22 : 0.05, groom: 0.07, yawn: 0.05, walk: p.b - p.a > 90 ? 0.12 : 0, stretch: 0.03 }, k = wpick(w, cat.last); cat.last = k;
    if (k === "walk") { var tx = cat.x, n = 0; while (Math.abs(tx - cat.x) < 40 && n++ < 14) tx = rr(p.a + 4, p.b - 4); var bx = Math.abs(tx - cat.x) >= 30 ? tx : cat.x;
      if (bx !== cat.x && !dockBlocked(bx, 18) && !dockWords(bx)) return walkTo(bx, "sit", { gait: "stroll" }); return sitFor(rr(2.5, 4.5)); }
    if (k === "look") return set("look", { dur: rr(3, 5), face: "view", pose: "ride" });
    if (k === "loaf") return set("loaf", { dur: rr(5, 9), face: "view", pose: "loaf" });
    if (k === "sleep") return set("sleep", { dur: rr(9, 15), face: "view", pose: "loaf" });
    if (k === "groom") return set("groom", { dur: rr(2.4, 3.6), face: "view", pose: "groom" });
    if (k === "yawn") return set("yawn", { face: "view", pose: "ride" });
    if (k === "stretch") return set("stretch", { face: "side", pose: "stand" });
    return sitFor(rr(3, 6));
  }
  Object.assign(STATES, {
    /* spunta da dietro la pillola del dock: orecchie e fez, gli occhi, le zampe sul bordo; ti guarda un attimo; si raccoglie e salta su */
    dockup: function (dt, d) {
      var p = world.dock; if (!p || !p.on) { cat.vis = false; cat.plat = null; return set("wait"); }
      var st = cat.st, k = px(), P0 = rig.poses.peek;
      cat.plat = p; cat.x = d.x; cat.gy = null; cat.clipAt = p.y; cat.hideL = p.tile.l; cat.hideR = p.tile.r; rig.grounded = false; cat.vis = true;
      if (!d.init) { d.init = 1; cat.face = "front"; rig.yawT = Y.front; rig.pose = "peek"; rig.over = { f0y: P0.f0y - 9, f1y: P0.f1y - 9 }; rig.snap("peek"); cat.voff = 0; cat.voffV = 0; cat.rot = 0; cat.s = 1;
        d.dir = cat.x > (p.a + p.b) / 2 ? -1 : 1; if (d.hold == null) d.hold = rr(0.55, 0.95); }
      var tUp = 0.46, t1 = tUp + d.hold, c = st - t1;
      if (!d.ab && st > 0.05 && dockBlocked(cat.x)) { d.ab = now; d.ay = cat.y; }   /* arriva il Corano o il riquadro quiet mentre sale: torna giù, svelto */
      if (d.ab) { var ua = seg(now, d.ab, d.ab + 0.14); cat.y = lerp(d.ay, p.y + 52 * k, 1 - (1 - ua) * (1 - ua)); rig.pose = st < t1 ? "peek" : "sit"; if (ua >= 1) { cat.vis = false; cat.plat = null; cat.clipAt = null; cat.hideL = cat.hideR = null; set("ducked", { x: cat.x }); } return; }
      if (st < t1) {
        rig.pose = "peek"; cat.face = "front"; rig.rate = 12;
        cat.y = p.y + (1 - eBack(seg(st, 0, tUp), 1.5)) * 27 * k;            /* le orecchie per prime, un filo oltre e giù */
        rig.over.ear = 0.28 * (1 - seg(st, 0.12, 0.46));
        rig.over.f0y = P0.f0y - 9 * (1 - eBack(seg(st, 0.3, 0.5), 2)); rig.over.f1y = P0.f1y - 9 * (1 - eBack(seg(st, 0.36, 0.56), 2));
        cat.paws = rig.A.f0y > P0.f0y - 1.8 && rig.A.f1y > P0.f1y - 1.8;
        if (st > tUp) { cat.att = null; rig.pupilT = 1; if (!d.bl && st > tUp + 0.18) { d.bl = 1; life.blinkT = now; } }   /* guarda chi legge, batte gli occhi */
        else { cat.gz = false; rig.look.ty = 0; rig.look.tp = 0.05; rig.gazeT[0].x = rig.gazeT[1].x = 0.25 * Math.sin(st * 7); rig.gazeT[0].y = rig.gazeT[1].y = 0.2; }
        return;
      }
      if (c < 0.14) { cat.gz = true; cat.y = p.y; cat.dir = d.dir; cat.face = "view"; rig.over = { dy: P0.dy - 2.4, hp: -0.14 }; cat.paws = true; rig.rate = 18; cat.att = { x: cat.x + d.dir * 80, y: p.y - 30 }; return; }   /* si raccoglie: la testa giù un attimo */
      cat.y = p.y; cat.paws = false; rig.over = {};
      if (c < 0.28) { cat.face = "side"; rig.pose = "b-pull"; rig.rate = 24; return; }
      if (c < 0.5) { cat.face = "side"; rig.pose = c < 0.4 ? "b-hoist" : "b-reach"; rig.rate = 20; cat.ownLift = true; cat.lift = bell(seg(c, 0.26, 0.56)) * 9 * k; rig.grounded = c > 0.44; return; }   /* il saltello su: il corpo esce da dietro la pillola */
      cat.clipAt = null; cat.hideL = cat.hideR = null; landOn(p); rig.grounded = true;
      set("land", { v: 360, face: "side", pose: "land", then: function () { sitFor(rr(2.4, 4), { pose: "ride" }); } });
    },
    /* giù dietro la pillola: si raccoglie, poi scende dritto (le orecchie per ultime). d.duck: svelto, poi aspetta che passi
       quello che non deve coprire; d.away: resta via (fuori vista); d.then: dopo, dove va */
    dockdown: function (dt, d) {
      var p = world.dock; if (!p || !p.on) { cat.vis = false; cat.plat = null; return set("wait"); }
      var st = cat.st, k = px(), g = d.duck ? 0.02 : 0.18, dur = d.duck ? 0.16 : 0.32; cat.plat = p; cat.gy = st < g ? p.y : null;   /* d.duck: giù di scatto (non piano come quando se ne va) */
      if (st < g) { cat.y = p.y; rig.pose = d.duck ? "crouch" : "sit"; cat.face = "view"; rig.over.ear = 0.3; rig.over.hp = -0.16; cat.att = { x: cat.x, y: p.y + 40 }; rig.rate = 16; return; }
      cat.clipAt = p.y; cat.hideL = p.tile.l; cat.hideR = p.tile.r; rig.grounded = false;
      var u = seg(st, g, g + dur); cat.y = p.y + (d.duck ? 1 - (1 - u) * (1 - u) : eIn(u)) * 52 * k; rig.pose = "sit"; rig.over.ear = 0.3 * (1 - u);
      if (u >= 1) { var x = cat.x; cat.y = p.y; cat.vis = false; cat.clipAt = null; cat.hideL = cat.hideR = null;
        if (d.duck) { cat.plat = null; return set("ducked", { x: x }); }
        cat.plat = null; if (typeof d.then === "function") d.then(); else set("wait"); }
    },
    /* nascosto dietro il dock mentre passa il Corano o il riquadro quiet: torna su appena la sua zona è libera */
    ducked: function (dt, d) {
      cat.vis = false; var p = world.dock; if (!p || !p.on) return set("wait"); d.w = (d.w || 0) + dt;
      if (d.w > 0.4 && now - (B.scrollAt || -9) > 0.6) { var c = perchChoice(true) || (homeSeen() ? perchChoice() : null); if (c && c.kind !== "dock") return arrive(c); }   /* intanto si vede casa (o il logo): va lì */
      if (d.w > 0.45) {                                                  /* appena la sua zona è libera (mentre scorre basta che non ci sia il Corano o il riquadro quiet) */ var x = dockPickX(d.x); if (x != null) { cat.plat = p; cat.x = x; cat.y = p.y; return set("dockup", { x: x, hold: rr(0.3, 0.5) }); } }
      if (d.w > 6) { B.offT = O.followAfter || 3.6; strictBack(); }    /* troppo a lungo: prova subito un altro posatoio (se non ce n'è, aspetta fuori vista) */
    }
  });
  /* il dito sul dock: guarda giù il filtro toccato */
  function onDockDown(e) {
    var t = e && e.target, b = t && t.closest ? t.closest("button") : null; if (life.dockTap && now - life.dockTap.t < 0.25) return; life.dockTap = { el: b || O.dock, t: now };
    if (riding()) { life.earFlick = 1; life.earSide = 1; return; }
    /* un filtro sposterà i riquadri: chi sta sul bordo di uno di loro (non la mensola, non il logo) scende subito dietro il bordo e torna dopo, sul dock o altrove */
    if (O.strict && !reduced && cat.vis && cat.plat && !cat.plat.fixed && onEdge() && !atHome() && !(cat.plat.tile && cat.plat.tile.mode === "perch") && !drag && cat.state !== "dive" && cat.state !== "peek") set("dive", { away: true, quick: true, face: cat.face, pose: "crouch" });
  }
  /* a ogni passo, sulla casa: la regola del «seguire», il ritorno a casa, la salita sul dock, il dock stesso */
  function follow2(dt) {
    if (!O.strict || reduced || !B.on || drag || fake) { B.offT = 0; return; }
    var s = cat.state, still = now - (B.scrollAt || -9), seen = cat.vis && catInView(), FA = O.followAfter || 3.6;
    /* 1. fuori vista per FA secondi, con la pagina ferma: torna */
    if (!seen && FOLLOW[s]) B.offT = (B.offT || 0) + dt; else if (s !== "ducked") B.offT = 0;
    if (B.offT > (homeSeen() ? Math.min(FA, 1.6) : FA) && (still > 0.5 || B.offT > FA + 2.5)) return strictBack();   /* chi legge è tornato in cima: a casa prima; dopo un po' anche mentre la pagina scorre (sul dock lo scorrere non conta) */
    if (riding() && s !== "dockup" && s !== "dockdown" && s !== "held" && dockBlocked(cat.x)) return set("dockdown", { duck: true });   /* passa il Corano o il riquadro quiet dietro di lui: giù, svelto */
    /* 2. a casa quando chi legge è di nuovo in cima */
    if (FOLLOW[s] && s !== "wait" && seen && !atHome() && still > 3 && now > (B.homeTry || 0) && homeSeen()) {   /* in cima e fermo da un paio di secondi: non a ogni passaggio */
      B.homeTry = now + 4; var h = homeSpot();
      if (h && !onDock() && cat.plat && Math.abs(h.p.y - cat.y) < 330 && Math.abs(h.x - cat.x) < 380 && !arcBlocked(cat.x, cat.y, h.x, h.p.y)) return jumpTo(h.p, h.x, "sit");
      return leaveThen(function () { var c = perchChoice(); if (c) arrive(c); else { cat.vis = false; set("wait"); } });
    }
    /* 3. sul dock da un po', con la pagina ferma, si vede il logo del fondo: ci va */
    if (onDock() && seen && FOLLOW[s] && still > 5 && now > (B.upTry || 0)) { B.upTry = now + 9; var cp = perchChoice(true); if (cp) return leaveThen(function () { arrive(cp); }); }
    /* 4. la pagina lo porta contro il dock (si scorre in su): ci sale sopra; se non ci arriva, giù dietro il suo bordo */
    if (dockOn() && cat.vis && cat.plat && !onDock() && onEdge()) {
      var bb = catBox(), dk = world.dock.tile;
      if (bb && bb.y1 > dk.t - 2 && bb.x1 > dk.l && bb.x0 < dk.r) {
        if (s === "peek" || s === "dive" || s === "dockup" || s === "dockdown") { cat.vis = false; return set("wait"); }
        if (cat.y >= dk.t - 28 * K / 1.5 && cat.x > dk.l - 4 && cat.x < dk.r + 4) return board();
        return set("dive", { away: true, face: "side", pose: "crouch" });
      }
    }
    if (onDock()) dockLife(dt);
  }
  /* sale sul dock: la pillola lo prende al volo, un piccolo assestamento, e si gira a guardare il riquadro che se ne va */
  function board() {
    var p = world.dock, from = cat.plat, fx0 = cat.x, fy0 = cat.y; tidy();
    var i; for (i = props.length - 1; i >= 0; i--) { props[i].sp.remove(); props.splice(i, 1); }   /* gli oggetti restano sul riquadro, che va dietro il dock */
    cat.plat = p; cat.y = p.y; cat.gy = p.y; cat.rel = cat.x - p.tile.l;
    var look = { x: fx0 + rr(-30, 30), y: fy0 - 30 }, then = function () { set("sit", { dur: rr(2.4, 4), face: "view", pose: "ride", lookAt: look }); };
    if (cat.x < p.a || cat.x > p.b) return walkTo(clamp(cat.x, p.a + 4, p.b - 4), then, { lo: p.tile.l, hi: p.tile.r, gait: "walk" });
    set("land", { v: 300, face: cat.face === "front" ? "view" : cat.face, pose: "land", then: then });
    void from;
  }
  function dockLife(dt) {
    var p = world.dock, s = cat.state, base = rig.poses[rig.pose] || rig.poses.sit;
    if (!cat.vis) { life.watching = 0; return; }
    if (DOCKREST[s] && now - (B.scrollAt || -9) > 0.25 && now > (life.dockMoveAt || 0) && cat.st > 0.15 && dockWords(cat.x)) {
      /* la pagina si è fermata con una parola dietro di lui: due passi fino a un punto libero della pillola, se è vicino. Con un comando
         dietro (un campo, un bottone, un link, il QR) non resta: si sposta, o giù dietro la pillola finché la pagina non si muove */
      life.dockMoveAt = now + 1.2; var ctl = dockWords(cat.x, true), cx = dockClearX(false, 260), lowx = null;
      if (cx == null) lowx = dockClearX(false, 260, true);                /* nessun punto libero da seduto: forse ci sta a pagnotta, più basso */
      if (cx == null && lowx == null && ctl) { cx = dockClearX(true, 260); if (cx == null) lowx = dockClearX(true, 260, true); }   /* almeno nessun comando dietro */
      var dd = cx != null ? Math.abs(cx - cat.x) : lowx != null ? Math.abs(lowx - cat.x) : 0, go = { gait: dd > 50 ? "trot" : "walk" }; if (dd > 120) go = { speed: 118 };
      if (cx != null) return walkTo(clamp(cx, p.a + 2, p.b - 2), "sit", go);
      if (lowx != null) { var lf = function () { set("loaf", { dur: rr(6, 10), face: "view", pose: "loaf" }); }; if (dd < 4) return lf(); return walkTo(clamp(lowx, p.a + 2, p.b - 2), lf, go); }
      if (ctl && s !== "loaf" && s !== "sleep") return set("loaf", { dur: rr(5, 8), face: "view", pose: "loaf" });   /* nessun posto pulito: si fa piccolo; la maniglia non copre i comandi (render), un tocco va al comando */
    }
    if (!DOCKCALM[s]) { life.watching = 0; return; }
    if (cat.d.lookAt && cat.st < 1.1) cat.att = cat.d.lookAt;        /* appena salito: guarda il riquadro che se ne va */
    var tp = life.dockTap;
    if (tp && now - tp.t < 1.5) {                                      /* un filtro toccato: lo guarda, giù */
      var r = tp.el.getBoundingClientRect(); cat.att = { x: r.left + r.width / 2 + view.sx, y: r.top + r.height / 2 + view.sy }; rig.pupilT = 1;
      rig.over.hp = base.hp - 0.14 * smooth(0, 0.25, now - tp.t) * (1 - smooth(1.1, 1.5, now - tp.t)); life.watching = 0; return;
    }
    var v = B.vy || 0, av = Math.abs(v);
    if (av > 40) {                                                     /* la pagina scorre: guarda quello che passa (le pupille lo seguono), un filo inclinato */
      life.watchV = now; var w = life.watch, sy2 = w ? w.y - view.sy : 0;
      if (!w || sy2 < 30 || sy2 > p.sy - 16 || now - w.t > 2.4 || (w.v > 0) !== (v > 0)) w = life.watch = { x: cat.x + rr(-100, 100), y: view.sy + (v > 0 ? p.sy - rr(30, 80) : rr(90, 200)), t: now, v: v };
      cat.att = { x: w.x, y: w.y }; rig.pupilT = 0.95; var ln = clamp(v / 1400, -1, 1) * smooth(40, 260, av);
      rig.over.hr = (base.hr || 0) + 0.1 * ln; rig.over.hp = (base.hp || 0) - 0.05 * Math.abs(ln); rig.over.ear = -0.06; life.watching = 1;
    } else if (life.watching && now - (life.watchV || 0) > 0.5) { life.watching = 0; life.watch = null; cat.att = null; delete rig.over.hr; delete rig.over.hp; delete rig.over.ear; }
  }

  /* ------------------------------------------------------------------ il suggerimento: Dot si può toccare (CASA.md 2c C)
     Niente parole, piccolo, solo su Dot, tutto finito in pochi secondi. Solo con DOT.start({ hint: true }) (la casa nuova), mai col
     movimento ridotto. Tutto va con l'orologio del cervello (now):
     - vicino: un dito o il puntatore che si avvicina: orecchie su, testa e pupille verso di lui, pupille più larghe;
     - la zampata: un dito che scorre vicino (o il puntatore mentre la rotella scorre) prende una zampata svelta, non ogni volta;
     - il dito fantasma, una volta: quattro secondi dopo che «salam, sono Dot.» se n'è andato, se nessuno l'ha ancora toccato, un
       polpastrello traslucido arriva, preme (un anello), lo prende per la collottola e lo alza un poco lungo un arco (lungo, per niente
       impressionato), lo tiene mezzo secondo, lo rimette giù (atterra, si scrolla), lascia (un anello) e se ne va; Dot guarda dove è
       andato, poi chi guarda. È un trascinamento vero: lo stato «held» con un dito finto (fake.ghost), lo stesso cammino del dito vero.
       Un dito vero in qualsiasi istante lo prende al suo posto, senza salti. Mai più dopo che il visitatore l'ha trascinato (lo
       ricorda il telefono), al più in due sessioni, mai mentre si scorre o si scrive, con un foglio aperto o con Dot fuori vista;
     - bussa: se ancora nessuno l'ha toccato e la pagina è ferma da un po' con Dot in vista, viene verso il vetro (due passi, un filo
       più grande), alza una zampa e bussa due volte (un anello sul vetro a ogni colpo, nessun suono), inclina la testa e aspetta con le
       pupille grandi; poi si arrende e fa la pagnotta. Due volte per sessione al più;
     - il primo tocco vero della sessione riceve la risposta più calda: un saltello felice e le fusa. */
  var SG = { on: false, g: null, fing: null, fp: null, rings: [], gest: 0, ks: false };
  var SGK = { preso: "dot-preso", visti: "dot-dito-n", sess: "dot-dito", tocco: "dot-tocco", bussa: "dot-bussa" };   /* preso, visti: sul telefono (localStorage); gli altri: in questa sessione */
  function sgStore(local, k, v) { try { var s = local ? window.localStorage : window.sessionStorage; if (!s) return null; if (v === undefined) return s.getItem(k); s.setItem(k, String(v)); } catch (e) {} return null; }
  function sgInit(first) {
    sgClear();
    SG.on = !!O.hint && !reduced;
    SG.touched = sgStore(0, SGK.tocco) === "1"; SG.dragged = sgStore(1, SGK.preso) === "1"; SG.seen = +sgStore(1, SGK.visti) || 0;
    SG.ghostOk = SG.on && !SG.touched && !SG.dragged && sgStore(0, SGK.sess) !== "1" && SG.seen < 2;
    SG.ghostAt = first ? -1 : now + 8; SG.salamAt = -1; SG.ghostEnd = -1; SG.knocks = +sgStore(0, SGK.bussa) || 0; SG.knockAt = -99;
    SG.keyAt = -99; SG.resAt = -99; SG.near = 0; SG.nkeys = null; SG.batAt = -99; SG.batG = -1; SG.first = !SG.touched; SG.firstNow = false; SG.t0 = now; SG.chk = 0;
  }
  /* via il dito e gli anelli; se il dito fantasma teneva il gatto, lo rimette seduto dov'era (DOT.stop, una pausa, «Rivedi») */
  function sgClear() {
    var g = SG.g, i;
    if (g && fake && fake.ghost) { fake = null; var p = fresh(g.plat, cat.x); if (p && cat.state === "held") { cat.x = clamp(cat.x, p.a, p.b); landOn(p); cat.voff = 0; cat.voffV = 0; cat.rot = 0; cat.lift = 0; rig.longT = 0; rig.long = 0; sitFor(rr(1.5, 2.5)); rig.snap(rig.pose); } }
    else if (g && cat.state === "sit" && cat.d.ghost) cat.d.dur = cat.st + 1;
    if (g) SG.ghostEnd = now; SG.g = null;
    if (SG.fing) { SG.fing.remove(); SG.fing = null; }
    for (i = 0; i < SG.rings.length; i++) SG.rings[i].remove(); SG.rings = [];
  }
  /* un dito vero su Dot: la sessione lo ricorda; il primo della sessione riceve la risposta calda (tap) */
  function sgTouch() { if (!SG.touched) { SG.touched = true; SG.firstNow = SG.on && SG.first; sgStore(0, SGK.tocco, "1"); } SG.ghostOk = false; }
  function sgDragged() { if (!SG.dragged) { SG.dragged = true; sgStore(1, SGK.preso, "1"); } }
  /* il puntatore: c'è adesso (il mouse sulla pagina e mosso da poco; un dito giù, o appena alzato) e dov'è in pagina */
  function ptrLive() { if (ptr.x < -1e3) return false; if (ptr.kind === "mouse") return !ptr.out && now - ptr.t < 3; return ptr.down || now - (ptr.upAt || -9) < 0.6; }
  function ptrPage() { if (ptr.kind === "mouse" && ptr.cx != null) return { x: ptr.cx + view.sx, y: ptr.cy + view.sy }; return { x: ptr.x, y: ptr.y }; }   /* il mouse resta fermo sullo schermo mentre la pagina scorre; un dito resta sulla pagina */
  function typing() { var a = doc.activeElement, t = a && a.tagName; return now - SG.keyAt < 3 || !!(a && (t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || a.isContentEditable)); }
  /* un punto del modello (unità, y in alto) dove è disegnato adesso, in pagina: con lo scarto dell'origine e la rotazione */
  function drawnPt(mx, my) { var k = px(), Oy = cat.y - cat.lift - cat.voff * k, cr = Math.cos(cat.rot), sr = Math.sin(cat.rot), yy = my - cat.piv; return { x: cat.x + (mx * cr - yy * sr) * k, y: Oy - (mx * sr + yy * cr + cat.piv) * k }; }
  /* la collottola: sulla schiena, subito dietro la testa */
  function scruffPt(f) { var c = f.body.chest, h = f.head; return drawnPt(lerp(c.x, h.x, 0.3), Math.max(c.y + c.r * 0.82, h.y - h.ry * 0.35)); }
  function sgRing(x, y, o) {   /* un anello sul vetro (x, y in pagina adesso); nello strato fisso, se c'è: resta sul vetro anche se la pagina si muove */
    var par = flayer || layer; if (!par) return; o = o || {}; o.dark = dark;
    var r = fx().Anello(par, x - (flayer ? view.sx : 0), y - (flayer ? view.sy : 0), o); r.t0 = now; r.dur = o.dur || 0.42; SG.rings.push(r);
  }
  function sgDraw() {
    var i, r, F = SG.fp;
    if (SG.fing && F) { var par = flayer || layer; SG.fing.move(par); SG.fing.draw(F.x - (flayer ? view.sx : 0), F.y - (flayer ? view.sy : 0), F.a, F.sc, F.press, dark); if (!SG.g && F.a <= 0.004) { SG.fing.remove(); SG.fing = null; } }
    for (i = SG.rings.length - 1; i >= 0; i--) { r = SG.rings[i]; r.draw((now - r.t0) / r.dur); if (r.dead) SG.rings.splice(i, 1); }
  }
  /* il dito fantasma sta per arrivare: intanto Dot resta seduto dov'è (decide() non lo manda a dormire o lontano) */
  function sgHold() { return SG.on && SG.ghostOk && !SG.g && SG.ghostAt >= 0 && now > SG.ghostAt - 3.2 && now < SG.ghostAt + 20; }
  var GHOSTOK = { sit: 1, look: 1, pause: 1 };
  function sgClearArea(x0, y0, x1, y1, ctlOnly) {   /* nessuna parola (o nessun comando) né il Corano in questo rettangolo della pagina */
    var i, n, L = world.keep; for (i = 0; i < world.no.length; i++) { n = world.no[i]; if (!n.m && x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return false; }
    if (O.strict) for (i = 0; i < L.length; i++) { n = L[i]; if ((!ctlOnly || n.c) && x1 > n.l && x0 < n.r && y1 > n.t && y0 < n.b) return false; }
    return true;
  }
  function ghostCan() {
    if (drag || fake || !cat.vis || !cat.plat || !onEdge() || !GHOSTOK[cat.state] || cat.st < 0.35 || (bubble && bubble.on)) return false;
    if (now - (B.scrollAt || -9) < 1.2 || typing() || now - SG.resAt < 1.5 || now - (ptr.downAt || -9) < 1) return false;
    if (cat.plat.quiet || cat.plat.low || onQuiet() || !gameRoom() || underNo(cat.x, cat.y)) return false;
    var b = catBox(); if (!b || !lastF) return false; var up = 30 * K / 1.5 + 34, rd = riding();
    if (b.y0 - up < view.sy + view.ti + 4 || b.y1 > view.sy + view.vh - (rd ? 0 : view.bi) + (rd ? 6 : -4) || b.x0 < view.sx + 8 || b.x1 > view.sx + view.vw - 8) return false;   /* tutto in vista, anche alzato col dito sopra */
    return sgClearArea(b.x0 - 14, b.y0 - up, b.x1 + 14, b.y1 - 4, rd);   /* alzato non copre il Corano né una parola (sul dock: nessun comando) */
  }
  function ghostSide() {                                              /* da che parte va l'arco: verso il centro dello schermo, via dalla scatola, dove il bordo ha posto */
    var s = cat.x < view.sx + view.vw / 2 ? 1 : -1, p = cat.plat;
    if (stageOn) { try { var r = stage.rim(); if (r && Math.abs(r.x - cat.x) < 150 && Math.abs(r.y - cat.y) < 70) s = cat.x < r.x ? -1 : 1; } catch (e) {} }
    if (p && room(p, cat.x, s) < 20 && room(p, cat.x, -s) > room(p, cat.x, s)) s = -s;
    return s;
  }
  /* i tempi del dito fantasma (secondi dall'arrivo): arriva, preme, prende, alza, tiene, rimette giù */
  var GT = { press: 0.34, grab: 0.43, lift: 0.47, up: 1.1, hold: 1.6, down: 2.1, set: 0.16, out: 0.38 };
  function ghostStart() {
    var f = lastF, p = cat.plat; if (!f || !p || !(layer || flayer)) return false;
    var s0 = scruffPt(f), side = ghostSide();
    SG.ghostOk = false; sgStore(0, SGK.sess, "1"); sgStore(1, SGK.visti, SG.seen + 1);
    sitFor(60, { ghost: true });                                      /* seduto, fermo: guarda il dito che arriva */
    SG.g = { t0: now, ph: "in", plat: p, side: side, H: 28 * K / 1.5, x: s0.x + side * 22, y: s0.y - 30, sx: 0, sy: 0 };
    SG.fp = { x: SG.g.x, y: SG.g.y, a: 0, sc: 1.18, press: 0 };
    if (!SG.fing) SG.fing = fx().Dito(flayer || layer);
    return true;
  }
  /* il dito se ne va: si alza dal vetro (un filo più grande) e svanisce, muovendosi; quick: più svelto (annullato) */
  function ghostLeave(quick) { var g = SG.g, F = SG.fp; g.ph = "out"; g.tOut = now; g.ox = F.x; g.oy = F.y; g.ex = F.x + g.side * (quick ? 12 : 18); g.ey = F.y - (quick ? 18 : 26); g.quick = !!quick; g.p0 = F.press; }
  /* rimesso giù: i piedi toccano il bordo; l'origine torna sotto il corpo senza che il disegno salti, poi atterra e si scrolla */
  function ghostPut() {
    var g = SG.g, p = fresh(g.plat, cat.x); fake = null;
    if (!p) { reanchor(below() - below("air")); set("fall", { vy: 0, face: "view", pose: "air" }); ghostLeave(false); sgRing(SG.fp.x, SG.fp.y, { r0: 5, r1: 17, a: 0.42 }); return; }
    reanchor(below() - below("land")); reanchor((p.y - cat.y) / px());
    cat.x = clamp(cat.x, p.a, p.b); landOn(p);
    set("land", { v: 240, face: "view", pose: "land", then: "shake" });
    g.ph = "set"; g.tSet = now; g.plat = p;
  }
  /* un dito vero, uno scorrimento, la tastiera, un tocco altrove: il dito fantasma lascia stare, pulito. why = "touch": il dito vero l'ha già preso */
  function ghostCancel(why) {
    var g = SG.g; if (!g || g.cancel) return; var F = SG.fp, ph = g.ph;
    g.cancel = why; SG.ghostEnd = now;
    if (ph === "in" || ph === "press") { if (cat.state === "sit" && cat.d.ghost) cat.d.dur = cat.st + rr(0.6, 1.4); }   /* riprende la sua vita (resta seduto ancora un attimo) */
    else if (ph === "lift" || ph === "hold" || ph === "down") {
      if (fake && fake.ghost) fake = null;
      if (why !== "touch" && cat.state === "held") { var p = fresh(g.plat, cat.x); reanchor(below() - below("air")); set("fall", { p: p, vy: 0, face: "view", pose: "air" }); sgRing(F.x, F.y, { r0: 5, r1: 17, a: 0.42 }); }   /* lasciato: ricade sul suo bordo */
    }
    if (ph !== "out" && ph !== "after") ghostLeave(true);
  }
  function ghostStep() {
    var g = SG.g, t = now - g.t0, F = SG.fp, f = lastF, k = px(), u, e, s;
    if (g.ph !== "out" && g.ph !== "after" && !g.cancel && (now - (B.scrollAt || -9) < 0.05 || now - SG.keyAt < 0.05)) ghostCancel("scroll");   /* chi legge scorre o scrive: lascia stare */
    if (g.ph === "in" || g.ph === "press") {
      if (cat.state !== "sit" || !cat.d.ghost || drag) return ghostCancel("state");
      s = f ? scruffPt(f) : { x: g.x, y: g.y }; u = seg(t, 0, GT.press); e = eOut(u);
      F.x = lerp(g.x, s.x, e) + g.side * 5 * bell(u); F.y = lerp(g.y, s.y, e); F.a = eOut(seg(t, 0, 0.24)); F.sc = lerp(1.18, 1, e);   /* arriva lungo un arco, scendendo verso il vetro */
      if (t < GT.press) { cat.att = t > 0.08 ? { x: F.x, y: F.y } : null; return; }   /* lo guarda arrivare */
      g.ph = "press"; F.x = s.x; F.y = s.y; F.press = eOut(seg(t, GT.press, GT.press + 0.07)); cat.att = null;
      if (!g.r1) { g.r1 = 1; sgRing(F.x, F.y, { r0: 6, r1: 19, a: 0.46 }); life.earFlick = 1; life.earSide = g.side; }
      if (t < GT.grab) { rig.over.sqy = 1 - 0.035 * eOut(seg(t, GT.press, GT.grab)); rig.over.lid = 0.3; return; }   /* il dito preme: si fa un filo più basso, socchiude */
      g.ph = "lift"; pickUp(true); reanchor((F.y - cat.y) / px()); fake = { x: F.x, y: F.y, ghost: true }; g.sx = F.x; g.sy = F.y;   /* preso per la collottola: l'origine passa sotto il dito, il disegno resta dov'era */
      return;
    }
    if (g.ph === "lift" || g.ph === "hold" || g.ph === "down") {
      if (cat.state !== "held" || !fake || !fake.ghost) return ghostCancel("state");
      F.press = 1; F.a = 1; F.sc = 1;
      if (t < GT.up) { e = eIO(seg(t, GT.lift, GT.up)); fake.x = g.sx + g.side * 9 * Math.pow(e, 1.6); fake.y = g.sy - g.H * e; }   /* su lungo un arco: prima in alto, poi un poco di lato */
      else if (t < GT.hold) { g.ph = "hold"; u = t - GT.up; fake.x = g.sx + g.side * 9 + 0.5 * Math.sin(u * 6.1); fake.y = g.sy - g.H + 0.45 * Math.sin(u * 4.3 + 1); g.tx = fake.x; g.ty = fake.y; }   /* tenuto: un dito non è mai fermo del tutto */
      else {
        g.ph = "down"; var p = fresh(g.plat, cat.x); if (!p) return ghostCancel("lost"); g.plat = p;
        var lo = -1e9, i, l, q; if (f) for (i = 0; i < 4; i++) { l = f.legs[i]; q = drawnPt(l.fx, l.fy - l.paw * 0.85); if (q.y > lo) lo = q.y; }
        if (g.tx == null) { g.tx = fake.x; g.ty = fake.y; }
        u = seg(t, GT.hold, GT.down); e = eIO(u); var ty = p.y - (lo > -1e8 ? lo - cat.y : 30 * k);   /* dove deve stare il dito perché le zampe tocchino il bordo */
        fake.x = lerp(g.tx, g.sx + g.side * 3, e); fake.y = lerp(g.ty, ty, e);
        if ((lo > -1e8 && lo >= p.y - 0.8 && u > 0.5) || u >= 1) { F.x = fake.x; F.y = fake.y; ghostPut(); return; }
      }
      F.x = fake.x; F.y = fake.y; return;
    }
    if (g.ph === "set") {                                               /* appoggiato: il dito resta sulla collottola mentre si assesta */
      if (f) { s = scruffPt(f); F.x = lerp(F.x, s.x, 0.5); F.y = lerp(F.y, s.y, 0.5); }
      if (now - g.tSet >= GT.set) { sgRing(F.x, F.y, { r0: 5, r1: 17, a: 0.42 }); ghostLeave(false); }   /* lascia: un anello */
      return;
    }
    if (g.ph === "out") {
      u = seg(now, g.tOut, g.tOut + (g.quick ? 0.2 : GT.out)); e = eIn(u);
      F.press = g.p0 * (1 - eOut(seg(now, g.tOut, g.tOut + 0.08))); F.x = lerp(g.ox, g.ex, 1 - Math.pow(1 - u, 2)); F.y = lerp(g.oy, g.ey, 1 - Math.pow(1 - u, 2)); F.sc = 1 + 0.16 * u; F.a = 1 - e;
      if (u >= 1) { F.a = 0; if (g.cancel) { SG.g = null; return; } g.ph = "after"; g.tAft = now; }
      return;
    }
    if (g.ph === "after") {                                             /* si è scrollato: guarda dove è andato il dito, poi chi guarda (un lento battito d'occhi) */
      var at = now - g.tAft; s = cat.state;
      if (s === "sit" && !g.sat) { g.sat = now; cat.d.dur = Math.max(cat.d.dur || 0, cat.st + 2.4); }
      if (g.sat) { var a2 = now - g.sat; if (a2 < 0.8) cat.att = { x: g.ex, y: g.ey }; else if (!g.bl) { g.bl = 1; cat.att = null; life.slow = now + 0.12; }
        if (a2 > 1.7 || s !== "sit") { SG.g = null; SG.ghostEnd = now; } }
      else if ((s !== "land" && s !== "shake") || at > 4) { SG.g = null; SG.ghostEnd = now; }
    }
  }
  /* bussa sul vetro: ancora nessun tocco, la pagina ferma da un po', Dot in vista e tranquillo */
  var KNOCKOK = { sit: 1, look: 1, pause: 1, loaf: 1 };
  function knockCan() {
    if (SG.touched || SG.knocks >= 2 || SG.g || drag || fake || !cat.vis || !cat.plat || !onEdge() || !KNOCKOK[cat.state] || cat.st < 1.2 || (bubble && bubble.on)) return false;
    var gate = SG.ghostOk ? (SG.ghostAt >= 0 && now > SG.ghostAt + 120 ? 0 : 1e9) : Math.max(SG.ghostEnd + 18, SG.t0 + 24);   /* prima il dito fantasma, se c'è ancora da fare */
    if (SG.knocks > 0) gate = Math.max(gate, SG.knockAt + 45);
    if (now < gate || now - lastIn < 7 || now - (B.scrollAt || -9) < 7 || typing() || now - SG.resAt < 3) return false;
    if (cat.plat.quiet || cat.plat.low || onQuiet() || !gameRoom() || underNo(cat.x, cat.y)) return false;
    var b = catBox(); if (!b) return false; var m = 0.12 * (b.x1 - b.x0) + 4, rd = riding();
    if (b.y0 - 16 < view.sy + view.ti + 4 || b.y1 > view.sy + view.vh - (rd ? 0 : view.bi) + (rd ? 6 : -4) || b.x0 - m < view.sx + 6 || b.x1 + m > view.sx + view.vw - 6) return false;
    return sgClearArea(b.x0 - m, b.y0 - m * 1.6, b.x1 + m, b.y1 - 4, rd);   /* più grande (viene verso il vetro): non copre una parola né il Corano */
  }
  /* la zampata: il puntatore che passa vicino mentre la pagina scorre (una volta per gesto, non sempre) */
  var BATOK = { sit: 1, look: 1, pause: 1 };
  function batCheck() {
    if (SG.gest === SG.batG || !BATOK[cat.state] || cat.st < 0.3 || !cat.vis || !cat.plat || !onEdge() || drag || fake || SG.g || lowNow() || cat.plat.quiet || !lastF) return;
    if (Math.abs(B.vy || 0) < 160 || now - (B.scrollAt || -9) > 0.1 || !ptrLive() || now < SG.batAt + 16 || !gameRoom()) return;
    var pp = ptrPage(), h = drawnPt(lastF.head.x, lastF.head.y), c = drawnPt(lastF.body.chest.x, lastF.body.chest.y), R = 78 * K / 1.5;
    if (Math.min(hyp(pp.x - h.x, pp.y - h.y), hyp(pp.x - c.x, pp.y - c.y)) > R) return;
    SG.batG = SG.gest; if (rnd() > 0.6) return;                         /* deve restare una sorpresa */
    SG.batAt = now; cat.dir = pp.x >= cat.x ? 1 : -1; set("swat", { face: "view", pose: narrow() ? "ride" : "sit", at: pp });
  }
  var NEAROK = { sit: 1, look: 1, pause: 1, loaf: 1, think: 1 };
  /* prima dello stato: il dito fantasma, l'inizio di un gesto, la grandezza lasciata da chi bussava; i valori del «vicino» di prima via */
  function sgPre(dt) {
    var i, ks = SG.nkeys; if (ks) { for (i = 0; i < ks.length; i++) delete rig.over[ks[i]]; SG.nkeys = null; }
    if (SG.ks && cat.state !== "knock") { cat.s = lerp(cat.s, 1, 1 - Math.exp(-dt * 9)); if (Math.abs(cat.s - 1) < 0.002) { cat.s = 1; SG.ks = false; } }   /* interrotto mentre bussava: torna piano alla sua grandezza */
    if (!SG.on) return;
    if (SG.salamAt >= 0 && SG.ghostAt < 0 && bubble && !bubble.on && bubble.sc < 0.02) SG.ghostAt = now + 4;   /* «salam, sono Dot.» se n'è andato: fra quattro secondi */
    if (SG.g) { ghostStep(); return; }
    if (now < SG.chk) return; SG.chk = now + 0.2;
    if (SG.ghostOk && SG.ghostAt >= 0 && now >= SG.ghostAt && now < SG.ghostAt + 120 && !SG.touched && ghostCan()) { ghostStart(); return; }
    if (knockCan()) { SG.knocks++; SG.knockAt = now; sgStore(0, SGK.bussa, SG.knocks); SG.ks = true; set("knock", { face: "front", pose: narrow() ? "ride" : "sit" }); }
  }
  /* dopo lo stato: il dito vicino (orecchie su, pupille larghe, lo guarda), la zampata */
  function sgPost(dt) {
    if (!SG.on) return;
    var on = 0, s = cat.state, f = lastF;
    if (cat.vis && f && !drag && !fake && NEAROK[s] && ptrLive()) {
      var pp = ptrPage(), h = drawnPt(f.head.x, f.head.y), d = hyp(pp.x - h.x, pp.y - h.y), R = 150 * K / 1.5;
      if (d < R) on = (1 - smooth(R * 0.5, R, d)) * (ptr.kind === "mouse" ? 1 - smooth(2, 3, now - ptr.t) : 1);
      if (on > 0.5 && cat.state !== "walk") cat.att = pp;                /* la testa e le pupille vanno al dito */
    }
    SG.near += (on - SG.near) * (1 - Math.exp(-dt * (on > SG.near ? 7 : 2.4)));
    if (NEAROK[s]) rig.pupilT = 0.8 + 0.2 * SG.near;                   /* le pupille si allargano */
    if (SG.near > 0.01 && NEAROK[s]) {
      var base = rig.poses[rig.pose] || rig.poses.sit, keys = [];
      if (!rig.over.hasOwnProperty("ear")) { rig.over.ear = Math.min(base.ear || 0, 0.06) - 0.16 * SG.near; keys.push("ear"); }   /* orecchie su, in avanti */
      if (!rig.over.hasOwnProperty("eye")) { rig.over.eye = (base.eye || 1) * (1 + 0.07 * SG.near); keys.push("eye"); }
      if (s === "loaf" && !rig.over.hasOwnProperty("hp")) { rig.over.hp = (base.hp || 0) + 0.08 * SG.near; keys.push("hp"); }   /* a pagnotta alza la testa */
      SG.nkeys = keys;
    }
    batCheck();
  }
  Object.assign(STATES, {
    /* la zampata: si accorge (occhi grandi, si abbassa un filo), la zampa scatta verso il dito e torna; poi lo segue con gli occhi */
    swat: function (dt, d) {
      var st = cat.st, base = narrow() ? "ride" : "sit", k = px(), pp = ptrLive() ? ptrPage() : d.at, h = lastF ? drawnPt(lastF.head.x, lastF.head.y) : { y: cat.y - 30 * k };
      cat.face = "view"; cat.att = pp; cat.gz = true;
      if (st < 0.09) { rig.pose = base; rig.rate = 22; rig.over.ear = 0.18; rig.over.eye = 1.16; rig.over.hp = -0.06; rig.over.sqy = 0.97; rig.pupilT = 1; return; }
      if (st < 0.25) { rig.pose = "bat"; rig.rate = 32; delete rig.over.sqy; delete rig.over.hp; rig.over.ear = 0.04; rig.over.eye = 1.1;
        rig.over.f0y = clamp(rig.poses.bat.f0y + (h.y - pp.y) / k * 0.35, 4, 19); return; }   /* la zampa va all'altezza del dito */
      if (st < 0.52) { rig.pose = base; rig.rate = 14; delete rig.over.f0y; rig.over.eye = 1.08; rig.over.ear = 0; return; }
      rig.pupilT = 0.95; delete rig.over.eye; if (st > 1.3) sitFor(rr(1.6, 2.6));
    },
    /* bussa sul vetro, da dentro lo schermo */
    knock: function (dt, d) {
      var st = cat.st, T0 = 0.62, base = narrow() ? "ride" : "sit", u = st - T0, P0 = rig.poses[base] || rig.poses.sit;
      cat.face = "front"; SG.ks = true; rig.headMax = null;
      if (st < T0) {                                                   /* viene verso il vetro: passi sul posto, si fa un filo più grande */
        rig.pose = "stand"; rig.walkT = st < T0 - 0.14 ? 1 : 0; rig.speedU = 0; rig.gaitT = 0.36; cat.att = null;
        cat.s = lerp(1, 1.1, eIO(seg(st, 0.06, T0 - 0.04))); return;
      }
      rig.walkT = 0; cat.s = 1.1; cat.gz = false; rig.look.ty = 0; rig.look.tp = 0.03; rig.gazeT[0].x = rig.gazeT[1].x = 0; rig.gazeT[0].y = rig.gazeT[1].y = 0.05;   /* guarda dritto chi guarda */
      if (u < 0.26) { rig.pose = base; rig.rate = 12; return; }         /* si siede davanti al vetro */
      if (u < 0.46) { rig.pose = "knock"; rig.rate = 13; rig.over.eye = 1.08; return; }   /* la zampa si alza verso il vetro: la carica */
      if (u < 1.02) {                                                  /* due colpi: avanti svelta fino al vetro, il colpo, indietro */
        var n = u < 0.74 ? 1 : 2, kk = u - (n === 1 ? 0.46 : 0.74), hit = kk >= 0.065 && kk < 0.13;
        rig.pose = kk < 0.13 ? "knock-glass" : "knock"; rig.rate = kk < 0.13 ? 30 : 17; rig.over.eye = 1.1;
        if (hit) rig.over.sqy = 0.985; else delete rig.over.sqy;
        if (kk >= 0.065 && !d["h" + n] && lastF) { d["h" + n] = 1; var l = lastF.legs[0], q = drawnPt(l.fx, l.fy); sgRing(q.x, q.y, { r0: 3, r1: 14 * K / 1.5, a: 0.5, w: 1.3, dur: 0.44 }); }   /* un anello sul vetro, nessun suono */
        return;
      }
      if (u < 3.05) {                                                  /* la testa si inclina, aspetta con le pupille grandi */
        delete rig.over.sqy; rig.pose = base; rig.rate = 9; rig.pupilT = 1; rig.over.eye = 1.13; rig.over.ear = -0.12;
        var tl = 0.3 * eBack(seg(u, 1.02, 1.42), 1.6) - 0.42 * eIO(seg(u, 2.05, 2.45)) * (1 - eIO(seg(u, 2.7, 3.05)));   /* inclina, poi un filo dall'altra parte, curioso */
        rig.over.hr = (P0.hr || 0) + tl; if (u > 2.5 && !d.bl) { d.bl = 1; life.blinkT = now; }
        return;
      }
      if (u < 3.75) {                                                  /* si arrende: un piccolo sospiro, si accuccia, torna indietro dal vetro */
        delete rig.over.hr; rig.over.eye = 1; delete rig.over.ear; rig.pupilT = 0.8;
        rig.over.sqy = 1 - 0.04 * bell(seg(u, 3.05, 3.4)); rig.over.lid = 0.3 * seg(u, 3.1, 3.5); rig.pose = u > 3.28 ? "loaf" : base; rig.rate = 7;
        cat.s = lerp(1.1, 1, eIO(seg(u, 3.2, 3.75))); return;
      }
      cat.s = 1; SG.ks = false; set("loaf", { dur: rr(6, 9), face: "view", pose: "loaf" });
    }
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
    now += dt; readView();
    var dsy = B.lsy == null ? 0 : view.sy - B.lsy; B.lsy = view.sy;      /* quanto scorre la pagina (px al secondo, smussato) */
    if (dt > 0) B.vy = lerp(B.vy || 0, dsy / dt, 1 - Math.exp(-dt * 12)); if (Math.abs(dsy) > 0.5) { if (now - (B.scrollAt || -9) > 0.35) SG.gest++; B.scrollAt = now; }   /* SG.gest: un gesto di scorrimento nuovo (la zampata ci prova una volta per gesto) */
    if (O.dock) { dockSync(false); if (onDock() && onEdge() && cat.state !== "dockup" && cat.state !== "dockdown") { var dp = world.dock; cat.y = dp.y; cat.gy = dp.y; if (cat.state !== "walk") cat.x = clamp(cat.x, dp.tile.l + 6, dp.tile.r - 6); } }   /* sul dock: segue la pillola, fotogramma per fotogramma */
    if (now < (B.followTo || 0)) { readWorld(true); if (stageOn && stage.place && O.home && O.home.nodeType === 1) { var hp0 = homePoint(); if (Math.abs(hp0.x - B.home.x) > 0.3 || Math.abs(hp0.y - B.home.y) > 0.3) { B.home = hp0; stage.place(hp0.x, hp0.y); } } }   /* DOT.refresh(secondi): segue i riquadri mentre si muovono */
    else if (now - world.at > 0.8) readWorld();
    if (B.evict) { var why = B.evict, s0 = cat.state; B.evict = null;
      if (cat.vis && onEdge() && s0 !== "crouch" && s0 !== "land" && s0 !== "peek" && s0 !== "think" && s0 !== "wait" && s0 !== "dive") relocate(why); }
    if (B.lidA && stageOn) { var la = B.lidA, lu = seg(now, la.t0, la.t0 + la.dur); B.lidV = lerp(la.a, la.b, eIO(lu)); try { stage.lid(B.lidV); } catch (e) {} if (lu >= 1) B.lidA = null; }   /* il coperchio si apre e si chiude, non scatta */
    if (script) { var i; for (i = script.length - 1; i >= 0; i--) if (now >= script[i].t) { var fn = script[i].fn; script.splice(i, 1); fn(); } }
    cat.st += dt; rig.yawT = yawFor(cat.face, cat.dir);
    sgPre(dt); rig.yawT = yawFor(cat.face, cat.dir);                     /* il suggerimento (il dito fantasma muove il dito finto prima dello stato) */
    rig.tailSwish -= life.flAdd || 0; var S = STATES[cat.state]; if (S) S(dt, cat.d);
    applyMood(); sgPost(dt); turnStep(dt);
    if (bubble && (bubble.on || bubble.a > 0.01) && cat.vis && world.quiet.length && onQuiet()) bubble.hide(true);   /* sul riquadro quiet nessuna nuvoletta, nemmeno una rimasta da prima */
    if (CALM[cat.state] && now > (life.flAt || 0) && !reduced) { life.flAt = now + rr(3, 7); life.flT = now; }
    life.tailKick = (life.tailKick || 0) * Math.exp(-dt * 3.5);
    life.flAdd = (CALM[cat.state] ? 0.32 * bell(seg(now - (life.flT || -9), 0, 0.7)) : 0) + life.tailKick; rig.tailSwish += life.flAdd;   /* la punta della coda dà un colpetto ogni tanto; dopo un salto la coda continua */
    if (drag && !drag.moved && !drag.pet && now - drag.t0 > 0.45 && CALM[cat.state] && cat.plat && !reduced && !onQuiet() && !lowNow()) { drag.pet = true; set("pet", { face: "view", pose: "sit" }); }
    if (!ptr.touch && ptr.sp > 1000 && now - ptr.t < 0.12 && cat.plat && !cat.plat.fixed && (cat.state === "sit" || cat.state === "look" || cat.state === "pause") && now > (life.pounceAt || 0) && !reduced && gameRoom()) {
      var pdx = ptr.x - cat.x, pdy = ptr.y - (cat.y - 20); if (Math.abs(pdx) < 170 && Math.abs(pdx) > 30 && Math.abs(pdy) < 80) { life.pounceAt = now + 10; set("pounce", { tx: clamp(ptr.x, cat.plat.a, cat.plat.b), wait: 0.8, then: "sit" }); }
    }
    if (life.braceAt && now - life.braceAt < 0.1 && cat.plat && !cat.plat.fixed && cat.vis && (cat.state === "sit" || cat.state === "look" || cat.state === "pause" || cat.state === "loaf") && !reduced && !lowNow()) { life.braceAt = 0; set("brace", { face: cat.face, pose: "crouch" }); }
    if (cat.state !== "walk" && rig.walk > 0.03 && cat.plat && onEdge()) cat.x = clamp(cat.x + rig.walk * cat.coast * dt, cat.plat.a, cat.plat.b);
    if (cat.plat && onEdge()) cat.rel = cat.x - cat.plat.tile.l;
    if (!cat.ownRot) cat.rot *= Math.exp(-dt * 10); cat.ownRot = false;
    if (!cat.ownLift) cat.lift *= Math.exp(-dt * 12); cat.ownLift = false;
    if (rig.spring) { var vw = rig.rate * 1.35, va = -vw * vw * cat.voff - 2 * rig.zeta * vw * cat.voffV; cat.voffV += va * dt; cat.voff += cat.voffV * dt; }   /* lo scarto dell'origine rientra con la stessa molla delle pose */
    else cat.voff *= Math.exp(-dt * rig.rate);
    if (Math.abs(cat.voff) < 0.01 && Math.abs(cat.voffV) < 0.05) { cat.voff = 0; cat.voffV = 0; }
    gaze(dt); lifeStep(dt); guard();
    rig.wx = cat.x / K; rig.wy = -cat.y / K;
    rig.step(dt);
    stepFez(dt); stepProps(dt); if (bubble) bubble.phys(dt);
    for (var j = scratches.length - 1; j >= 0; j--) { scratches[j].step(dt); if (scratches[j].dead) scratches.splice(j, 1); }
    /* fuori dalla vista: torna */
    var free = CALM[cat.state] || cat.state === "sleep" || cat.state === "drape" || cat.state === "sulk";
    if (O.strict) { cat.offT = 0; follow2(dt); }                        /* la casa: la regola dei quattro secondi, i posatoi, il dock */
    else if (free && cat.vis && !catInView()) { cat.offT += dt; if (cat.offT > 1.2) { cat.offT = 0; comeBack(); } } else cat.offT = 0;
    if (life.sayAt && now >= life.sayAt) { life.sayAt = 0; say("salam, sono Dot.", 4); }
    if (!frenchDone && (now - lastIn > 90 || now - openedAt > 240) && CALM[cat.state] && cat.vis && inView(cat.y, 80, 0) && !(bubble && bubble.on) && gameRoom() && !lowNow()) {
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
  /* il rettangolo che il gatto occupa adesso, in pagina (dall'ultimo fotogramma disegnato; ritagli «dietro il bordo» esclusi) */
  function catBox() {
    var f = lastF; if (!f) return null; var k = px(), Oy = cat.y - cat.lift - cat.voff * k, P = [], i, l, cr = Math.cos(cat.rot), sr = Math.sin(cat.rot);
    function add(x, y, r) { P.push([x - r, y - r], [x + r, y + r]); }
    add(f.head.x, f.head.y, f.head.rx); for (i = 0; i < 2; i++) add(f.ears[i].tx, f.ears[i].ty, 1); if (f.fez) { add(f.fez.tx, f.fez.ty, 4); add(f.fez.tassel.x1, f.fez.tassel.y1, 1); }
    add(f.body.hips.x, f.body.hips.y, f.body.hips.r); add(f.body.chest.x, f.body.chest.y, f.body.chest.r);
    for (i = 0; i < 4; i++) { l = f.legs[i]; add(l.fx, l.fy, l.paw + 1); add(l.kx, l.ky, l.r0); }
    for (i = 0; i < f.tail.pts.length; i++) add(f.tail.pts[i].x, f.tail.pts[i].y, f.tail.pts[i].r);
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (i = 0; i < P.length; i++) { var mx = P[i][0], my = P[i][1] - cat.piv, rx = mx * cr - my * sr, ry = mx * sr + my * cr + cat.piv, X = cat.x + rx * k, Yp = Oy - ry * k; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Yp < y0) y0 = Yp; if (Yp > y1) y1 = Yp; }
    if (cat.clipAt != null && cat.clipTop == null && y1 > cat.clipAt) y1 = Math.max(y0, cat.clipAt);   /* la parte dietro il bordo non si vede */
    else if (cat.clipAt == null && riding() && y1 > world.dock.y + 1.5) y1 = Math.max(y0, world.dock.y + 1.5);   /* sulla pillola: sotto la cima non si disegna nulla */
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function render(dt) {
    var f = rig.frame(), k = px(), i; lastF = f;
    var Oy = cat.y - cat.lift - cat.voff * k, on = cat.vis && Oy > view.sy - 220 && Oy < view.sy + view.vh + 260 && !(cat.state === "think" && !cat.plat);   /* «think» senza bordo: un passaggio, non si disegna */
    /* in groppa al dock: la tela passa nello strato fisso (va con lo schermo, non trema mentre la pagina scorre); altrimenti nella pagina */
    var rd = riding(), ox0 = rd ? view.sx : 0, oy0 = rd ? view.sy : 0;
    if (rd !== !!B.fixedNow && flayer) { (rd ? flayer : layer).appendChild(catSp.cv); if (bubble && bubble.el) (rd ? flayer : layer).appendChild(bubble.el); B.fixedNow = rd; }
    catSp.show(on);
    if (on) {
      var jx = cat.jit ? cat.jit * Math.sin(now * 95) : 0; catSp.place(cat.x + jx - ox0, Oy - oy0); catSp.clear();
      var c = catSp.model(k), env = envFor(k);
      if (cat.rot) { c.translate(0, cat.piv); c.rotate(cat.rot); c.translate(0, -cat.piv); }
      if (cat.gy != null && Math.abs(cat.rot) < 0.5) { var hh = cat.gy - (cat.y - cat.lift); env.shadow = { y: (Oy - cat.gy) / k, k: 1 - 0.6 * sat(hh / 140) }; }
      if (cat.clipAt != null) env.clipY = (Oy - cat.clipAt) / k;
      else if (rd) env.clipY = (Oy - (world.dock.y + 1.5)) / k;       /* sulla pillola: niente sotto la cima (coda, zampe), così nulla copre i filtri */
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
    var cs = cat.state, free = on && cs !== "opening" && cs !== "boxjump" && cs !== "boxed" && cs !== "boxexit" && cs !== "box" && cs !== "wait" && cs !== "dockup" && cs !== "dockdown" && cs !== "ducked" && !reduced || (reduced && on);
    /* la maniglia: nello strato fisso se c'è (coordinate dello schermo), mai sopra il dock: un tocco su un filtro arriva sempre al filtro */
    var gox = flayer ? view.sx : 0, goy = flayer ? view.sy : 0, gh = 76;
    if (free) { var gxp, gyp; if (drag && drag.moved) { gxp = drag.x; gyp = drag.y; } else { var b = f.body, mx = (b.hips.x + b.chest.x) / 2 * 0.6 + f.head.x * 0.4, my = (b.hips.y + b.chest.y) / 2 * 0.6 + f.head.y * 0.4; gxp = cat.x + mx * k; gyp = Oy - my * k; }
      if (dockOn() && !(drag && drag.moved)) { var dk = world.dock.tile, gt = gyp - 38; if (gxp + 38 > dk.l && gxp - 38 < dk.r && gt + 76 > dk.t) gh = Math.floor(dk.t - 1 - gt); }
      if (gh < 30) free = false;
      else if (O.strict && !(drag && drag.moved)) { var j, kn, gx0 = gxp - 34, gx1 = gxp + 34, gy0 = gyp - 38, gy1 = gyp - 38 + gh; for (j = 0; j < world.keep.length; j++) { kn = world.keep[j]; if (kn.c && gx1 > kn.l && gx0 < kn.r && gy1 > kn.t && gy0 < kn.b) { free = false; break; } } }   /* sopra un comando la maniglia non c'è: il tocco arriva al comando */
      if (free) { grab.style.transform = "translate3d(" + (gxp - 38 - gox).toFixed(1) + "px," + (gyp - 38 - goy).toFixed(1) + "px,0)"; if (grab.style.display === "none") grab.style.display = "block";
        if (gh !== B.grabH) { B.grabH = gh; grab.style.height = gh + "px"; } } }
    if (!free && grab.style.display !== "none" && !(drag && drag.moved)) grab.style.display = "none";
    if (SG.fing || SG.rings.length) sgDraw();                           /* il dito fantasma e gli anelli sul vetro, sopra il gatto */
    if (bubble) { var ax = cat.x + f.head.x * k, ay = Oy - (f.head.y + f.head.ry + (rig.fezOn ? 9 : 3)) * k; bubble.place(ax - ox0, ay - oy0, cat.y + 6 - oy0, view.sx - ox0, view.sy + view.ti - oy0, view.vw, on && cat.state !== "held" && cat.state !== "fly"); }
  }

  /* ------------------------------------------------------------------ il ciclo */
  function loop(ms) {
    if (!B.on || B.paused) return; raf = requestAnimationFrame(loop);
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
    if (!B.on || B.paused || !canGrab() && !reduced) return; if (e.button && e.button !== 0) return;
    if (drag) { if (e.cancelable) e.preventDefault(); return; }       /* un secondo dito sul gatto: conta solo il primo */
    try { grab.setPointerCapture(e.pointerId); } catch (er) {}
    drag = { id: e.pointerId, x: e.pageX, y: e.pageY, x0: e.pageX, y0: e.pageY, t0: now, moved: false, pet: false, mouse: e.pointerType === "mouse", hist: [{ x: e.pageX, y: e.pageY, t: now, rt: perf() }] };
    lastIn = now; if (e.cancelable) e.preventDefault();
    sgTouch();                                                         /* un dito vero: la sessione lo ricorda (niente dito fantasma, niente bussare) */
    if (SG.g) { var hg = cat.state === "held" && fake && fake.ghost; ghostCancel("touch"); if (hg) { drag.moved = true; sgDragged(); grabbing(true); } }   /* il dito fantasma lo teneva: lo prende il dito vero, dal punto dov'è (held lo porta piano sotto il dito) */
  }
  /* col mouse, la mano chiusa su tutta la pagina mentre Dot è tenuto */
  function grabbing(on) { var r = doc.documentElement; if (!r || !r.classList) return; if (on && drag && drag.mouse) r.classList.add("dot-tiene"); else r.classList.remove("dot-tiene"); }
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
  function onKey(e) { if (B.paused) return; if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); tap(); } }
  function onPtr(e) {
    var t = now, dx = e.pageX - ptr.x, dy = e.pageY - ptr.y, dd = hyp(dx, dy), dtp = t - ptr.t;
    if (dtp > 0.0001) ptr.sp = dd / dtp; if (dd > 3) ptr.still = 0;
    ptr.x = e.pageX; ptr.y = e.pageY; ptr.t = t; ptr.touch = e.pointerType === "touch"; lastIn = now;
  }
  function onPtrDown(e) {
    if (B.paused) return; onPtr(e); ptr.still = 0;
    if (stageOn && stage.hit && stage.hit(e.pageX, e.pageY) && (cat.state === "boxed" || cat.state === "box")) { boxOut(); return; }
    if (lastF && cat.vis && e.target !== grab) { var dx = e.pageX - cat.x, dy = e.pageY - (cat.y - 25 * px()); if (hyp(dx, dy) < 170) { life.earFlick = 1; life.earSide = dx > 0 ? 1 : -1; } }
  }
  var scr = { y: 0, t: 0 };
  function onScroll() {                                                /* uno scorrimento molto veloce: si aggrappa, orecchie indietro */
    lastIn = now; var y = window.pageYOffset || 0, t = perf(), pt = scr.t, v = t > pt ? Math.abs(y - scr.y) / Math.max(0.008, t - pt) : 0; scr.y = y; scr.t = t;
    if (v > 2600 && t - pt < 0.2) life.braceAt = now;                  /* la velocità conta solo tra due eventi vicini (il tempo di prima, non quello appena scritto) */
  }
  function stillTick() { ptr.still += 0.25; }

  /* ------------------------------------------------------------------ accendere, spegnere */
  function makeCanvas() { if (catSp) catSp.remove(); catSp = fx().Sprite(layer, Math.round(CWU * K), Math.round(CHU * K), Math.round(OXU * K), Math.round(OYU * K), 3); }
  function pickK() { var w = view.vw; return O.k || clamp(1.5 + (w - 600) / 500 * 0.4, 1.5, 1.9); }
  function onResize() { readView(); var nk = pickK(), nd = sprDpr(); if (Math.abs(nk - K) > 0.01 || nd !== dpr) { K = nk; dpr = nd; makeCanvas(); } relayout(false); }
  /* rilegge tutto dopo un cambio di impaginazione: i riquadri, la casa (la scatola si sposta con lei), di nuovo i riquadri (la scatola taglia i bordi) */
  function relayout(fast) { readWorld(fast); if (stageOn && stage.place) { var h = homePoint(); B.home = h; stage.place(h.x, h.y); readWorld(true); } }
  function sprDpr() { return DOT.photoDpr || Math.min(Math.max(window.devicePixelRatio || 1, 1), 3); }   /* la nitidezza vera del telefono, fino a 3 */
  function homePoint() {
    var h = O.home, r, sx = view.sx, sy = view.sy;
    var hx = O.homeX > 0 && O.homeX < 1 ? O.homeX : 0.58;   /* la scatola (e i nove tasti sopra) un po' a destra del centro: lontani dai bottoni della barra in alto a destra */
    if (h && h.nodeType === 1) { r = h.getBoundingClientRect(); return { x: r.left + sx + (r.width > 220 ? r.width * hx : r.width / 2), y: r.top + sy, el: h }; }
    if (h && typeof h.x === "number") return { x: h.x, y: h.y };
    var i, t; for (i = 0; i < world.tiles.length; i++) { t = world.tiles[i]; if (!t.mode && t.w > 150) return { x: t.l + (t.w > 220 ? t.w * hx : t.w / 2), y: t.t, el: t.el }; }
    return { x: view.vw / 2, y: 200 };
  }
  var RO = null, stillI = 0;
  DOT.start = function (opts) {
    if (B.on) DOT.stop();
    O = opts || {}; O.tiles = O.tiles || ".t, [data-tile]";
    reduced = !!O.reducedMotion; try { if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) reduced = true; } catch (e) {}
    dark = O.dark != null ? !!O.dark : true; try { if (O.dark == null && window.matchMedia) dark = !matchMedia("(prefers-color-scheme: light)").matches; } catch (e) {}
    fx().css(); dpr = sprDpr(); B.paused = false; B.followTo = 0; B.evict = null; B.lidA = null; B.lidV = 1; world = { tiles: [], plats: [], no: [], quiet: [], keep: [], sig: "", at: 0 };
    layer = doc.createElement("div"); layer.className = "dot-layer"; (O.parent && O.parent.nodeType === 1 ? O.parent : doc.body).appendChild(layer);   /* O.parent: un contenitore che taglia ciò che sporge */
    if (O.dock && O.dock.nodeType !== 1) O.dock = null;
    O.strict = O.strict != null ? !!O.strict : !!O.dock;                /* strict: i viaggi non passano davanti alle parole, i posatoi, la regola del seguire */
    flayer = null; flayerOwn = null; B.fixedNow = false; B.grabH = 76; B.offT = 0; B.homeTry = 0; B.upTry = 0; B.scrollAt = -9; B.lsy = null; B.vy = 0; dockRad = null; dockOp.at = -9;
    if (O.dock || O.fixedParent) {                                      /* lo strato fisso: Dot sul dock, la maniglia, la nuvoletta in groppa (sopra il dock, sotto le pagine aperte) */
      var fp = O.fixedParent && O.fixedParent.nodeType === 1 ? O.fixedParent : null;
      if (!fp) { fp = flayerOwn = doc.createElement("div"); fp.className = "dot-fixed"; fp.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:51;pointer-events:none"; doc.body.appendChild(fp); }
      flayer = doc.createElement("div"); flayer.className = "dot-layer dot-layer--fisso"; fp.appendChild(flayer);
    }
    grab = doc.createElement("button"); grab.type = "button"; grab.className = "dot-grab"; grab.setAttribute("aria-label", "Dot, il gatto"); grab.style.display = "none"; (flayer || layer).appendChild(grab);
    if (O.dock) { O.dock.addEventListener("pointerdown", onDockDown, { passive: true }); O.dock.addEventListener("click", onDockDown); }
    bubble = fx().Bubble(layer);
    look = DOT.looks[O.look] || DOT.looks.base; rig = DOT.makeRig(look.preset); addPoses(rig); rig.autoBlink = false; rig.spring = 1; rig.earTwitch = false;
    readView(); K = pickK(); makeCanvas(); cat.plat = null; cat.d = {}; readWorld();
    try { frenchDone = sessionStorage.getItem("dot-fr") === "1"; } catch (e) { frenchDone = false; }
    now = 0; lastIn = 0; openedAt = 0; B.on = true; B.openT0 = null;
    grab.addEventListener("pointerdown", onDown); grab.addEventListener("pointermove", onMove); grab.addEventListener("pointerup", onUp); grab.addEventListener("pointercancel", onUp);
    grab.addEventListener("lostpointercapture", function (e) { if (drag && e.pointerId === drag.id && drag.moved) onUp(e); });
    grab.addEventListener("keydown", onKey); grab.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    window.addEventListener("pointermove", onPtr, { passive: true }); window.addEventListener("pointerdown", onPtrDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onResize); doc.addEventListener("visibilitychange", onVis);
    if (window.ResizeObserver) { try { RO = new ResizeObserver(function () { world.at = -9; }); RO.observe(doc.body); } catch (e) { RO = null; } }
    stillI = setInterval(stillTick, 250);
    B.fromKeys = !!O.keysFormed;                                        /* keysFormed: l'intro ha già messo i nove tasti al loro posto: l'apertura parte da lì (stage.TS.keys) */
    begin(O.firstVisit !== false && !reduced);
    step(0); render(0);                                                /* il primo fotogramma subito, prima che la pagina si mostri: niente che spunta dal nulla */
    raf = requestAnimationFrame(loop);
    return DOT;
  };
  function begin(first) {
    var fromKeys = B.fromKeys; B.fromKeys = false;                      /* vale una volta sola: «Rivedi» riparte dall'inizio */
    var h = homePoint(); B.home = h; killFez(); rig.fezOn = true; cat.s = 1; cat.voff = 0; cat.voffV = 0; cat.rot = 0; cat.lift = 0; cat.clipAt = null; cat.clipTop = null;
    cat.mood = null; cat.taps = []; cat.jit = 0; cat.tangle = 0; life.fezRollT = 0; life.fezRoll = 0; life.fezRollV = 0; if (bubble) bubble.hide(); sound("purr", false);   /* «Rivedi»: si riparte puliti */
    var i; for (i = 0; i < props.length; i++) props[i].sp.remove(); props = [];
    for (i = 0; i < scratches.length; i++) scratches[i].remove(); scratches = [];
    stageOn = false; if (DOT.stage && DOT.stage.mount) { try { stage = DOT.stage; if (!B.mounted) { stage.mount(layer, { x: h.x, y: h.y }); B.mounted = true; } else stage.place(h.x, h.y); stageOn = true; } catch (e) { stageOn = false; } }
    B.lidA = null; readWorld();
    var p = platBelow(h.x, h.y - 4, true) || world.plats[0];
    if (first && underNo(h.x, h.y)) first = false;                       /* la casa sta sotto il Corano (non dovrebbe mai): niente apertura lì */
    if (first) { B.lidV = 1; if (stageOn) { try { stage.lid(null); } catch (e) {} } B.openT0 = now - (fromKeys && stageOn && TS().keys ? TS().keys : 0); cat.vis = false; cat.x = h.x; cat.y = h.y; set("opening", { first: true, p: p, x: p ? clamp(h.x, p.a, p.b) : h.x }); }
    else {
      B.openT0 = null; B.lidV = 0;
      if (stageOn) { try { stage.lid(0); stage.draw(TS().end + 2, now); } catch (e) {} readWorld(); }   /* la scatola sta già al suo posto, chiusa */
      placeAround(p);
    }
  }
  /* una visita successiva: Dot c'è già, da qualche parte dove lo si vede. Dorme su un bordo, o fa la pagnotta, o sbircia da dietro un bordo.
     Tutto è messo in posa subito (niente che entra, niente che spunta): il primo fotogramma è già giusto */
  function placeAround(home) {
    if (O.strict) return placeStrict();
    var v = visPlats(), cand = [], i, q, x, md;
    for (i = 0; i < v.length; i++) { q = v[i]; if (q.b - q.a < 44 || underNo((q.a + q.b) / 2, q.y)) continue; cand.push(q); if (home && q.el === home.el) cand.push(q, q); }   /* il bordo di casa conta di più */
    if (!cand.length && home && !home.quiet && !home.low) cand.push(home);
    if (!cand.length) { v = visPlats(true); for (i = 0; i < v.length; i++) if (v[i].b - v[i].a >= 44) cand.push(v[i]); }   /* solo tratti dove si sta sdraiati: allora dorme o fa la pagnotta */
    if (!cand.length) { cat.vis = false; set("wait"); return; }
    q = pick(cand); x = rr(q.a + 12, q.b - 12); if (q.b - q.a < 24) x = (q.a + q.b) / 2;
    cat.x = x; cat.dir = rnd() < 0.5 ? 1 : -1; cat.vis = true;
    if (reduced) { landOn(q); var rp = q.low ? "loaf" : "sit"; set("sit", { dur: 1e9, face: "view", pose: rp }); rig.yawT = yawFor("view", cat.dir); rig.snap(rp); return; }
    md = rnd(); md = md < 0.45 ? "sleep" : md < 0.75 || q.low ? "loaf" : "peek";
    if (md === "peek") { cat.plat = q; cat.y = q.y; set("peek", { p: q, x: x, ready: true, hold: rr(1.2, 2.4) }); rig.yawT = Y.front; return; }   /* la posa la mette peek al primo passo */
    landOn(q);
    if (md === "sleep") { set("sleep", { dur: rr(12, 22), face: "view", pose: "sleep" }); cat.st = 1.2; rig.eyeMood = "sleep"; life.fezRoll = life.fezRollT = rig.fezRoll = 0.32; }
    else set("loaf", { dur: rr(6, 10), face: "view", pose: "loaf" });
    rig.yawT = yawFor(cat.face, cat.dir); rig.snap(rig.pose);
  }
  /* la casa: dorme, fa la pagnotta o sta seduto su un posatoio buono che si vede (la mensola prima di tutto), se no sul dock.
     Movimento ridotto: seduto sulla mensola, fermo */
  function placeStrict() {
    var h = homeSpot(), c = reduced ? (h ? { kind: "home", p: h.p, x: h.x } : null) : perchChoice(), md;
    if (!c) { cat.vis = false; set("wait"); return; }
    cat.vis = true; cat.dir = rnd() < 0.5 ? 1 : -1;
    if (c.kind === "dock") { cat.x = c.x; landOn(world.dock); }
    else { cat.x = c.kind === "home" ? clamp(c.x + cat.dir * rr(0, 24), c.p.a + 8, c.p.b - 8) : c.x; landOn(c.p); }
    if (reduced) { var rp = narrow() ? "ride" : "sit"; set("sit", { dur: 1e9, face: "view", pose: rp }); rig.yawT = yawFor("view", cat.dir); rig.snap(rp); return; }
    md = rnd(); md = md < 0.45 ? "sleep" : md < 0.8 ? "loaf" : "sit";
    if (md === "sleep") { set("sleep", { dur: rr(12, 22), face: "view", pose: "sleep" }); cat.st = 1.2; rig.eyeMood = "sleep"; life.fezRoll = life.fezRollT = rig.fezRoll = 0.32; }
    else if (md === "loaf") set("loaf", { dur: rr(6, 10), face: "view", pose: "loaf" });
    else sitFor(rr(3, 5));
    rig.yawT = yawFor(cat.face, cat.dir); rig.snap(rig.pose);
  }
  function lidTo(v, dur) { if (!stageOn) return; B.lidA = { a: B.lidV == null ? 1 : B.lidV, b: v, t0: now, dur: dur || 0.25 }; }
  DOT.stop = function () {
    if (!B.on) return; B.on = false; B.paused = false; cancelAnimationFrame(raf); clearInterval(stillI); sound("purr", false);
    window.removeEventListener("pointermove", onPtr); window.removeEventListener("pointerdown", onPtrDown); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); doc.removeEventListener("visibilitychange", onVis);
    if (RO) { try { RO.disconnect(); } catch (e) {} RO = null; }
    if (stageOn && stage.unmount) { try { stage.unmount(); } catch (e) {} } stageOn = false; B.mounted = false;
    killFez(); props = []; scratches = []; if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; catSp = null; cat.state = "off";
    if (O.dock) { O.dock.removeEventListener("pointerdown", onDockDown, { passive: true }); O.dock.removeEventListener("click", onDockDown); }
    if (flayer && flayer.parentNode) flayer.parentNode.removeChild(flayer); if (flayerOwn && flayerOwn.parentNode) flayerOwn.parentNode.removeChild(flayerOwn);
    flayer = null; flayerOwn = null; B.fixedNow = false; world.dock = null; cat.plat = null;
  };
  DOT.setLook = function (name) {
    if (!rig) return; var nl = DOT.looks[name]; if (!nl) return; var old = rig; look = nl; rig = DOT.makeRig(look.preset); addPoses(rig); rig.spring = 1; rig.earTwitch = false;
    rig.pose = old.pose; rig.over = old.over; rig.yawT = old.yawT; rig.pitchT = old.pitchT; rig.rollT = old.rollT; rig.fezOn = old.fezOn; rig.longT = old.longT; rig.walkT = old.walkT; rig.speedU = old.speedU; rig.grounded = old.grounded;
    rig.look.ty = old.look.ty; rig.look.tp = old.look.tp; rig.pupilT = old.pupilT; rig.pupilDotT = old.pupilDotT; rig.poseAs = old.poseAs; rig.edge = old.edge; rig.eyeMood = old.eyeMood; rig.faceTurn = old.faceTurn; rig.gaitT = old.gaitT;
    rig.headMax = old.headMax; rig.breathRate = old.breathRate; rig.turn = old.turn; rig._bp = old._bp; rig.fezRoll = old.fezRoll;
    rig.snap(old.pose); rig.gait = old.gait; rig.autoBlink = false;
  };
  /* rilegge i riquadri dopo un cambio di impaginazione (riordinati, ridimensionati, nascosti). Dot resta col suo riquadro; se il suo bordo
     non c'è più, o ora sta sotto il Corano o sotto il riquadro quiet, va su un bordo buono e visibile. sec > 0: continua a seguire i riquadri
     a ogni fotogramma per sec secondi (mentre un'animazione li sposta: Dot ci resta sopra) */
  DOT.refresh = function (sec) { if (!B.on) return; relayout(false); life.guardAt = 0; if (sec > 0) B.followTo = Math.max(B.followTo || 0, now + sec); };   /* la guardia guarda subito il posto nuovo */
  /* congela tutto mentre un foglio copre la pagina: nessun fotogramma, nessun suono, nessuna nuvoletta, nessun tocco */
  DOT.pause = function () {
    if (!B.on || B.paused) return; B.paused = true; cancelAnimationFrame(raf); raf = 0; clearInterval(stillI); stillI = 0; sound("purr", false);
    if (drag) { try { grab.releasePointerCapture(drag.id); } catch (e) {} drag = null; }
    if (grab) grab.style.visibility = "hidden"; if (bubble && bubble.el) bubble.el.style.visibility = "hidden";
  };
  DOT.resume = function () {
    if (!B.on || !B.paused) return; B.paused = false; last = 0; world.at = -9;   /* al primo passo rilegge i riquadri: mentre era fermo l'impaginazione può essere cambiata */
    if (grab) grab.style.visibility = ""; if (bubble && bubble.el) bubble.el.style.visibility = "";
    if (cat.state === "purr" && cat.d.said) sound("purr", true);
    stillI = setInterval(stillTick, 250); raf = requestAnimationFrame(loop);
  };
  DOT.paused = function () { return !!B.paused; };
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
    press: function () { var y = cat.y - 20 * px(); drag = { id: -7, x: cat.x, y: y, x0: cat.x, y0: y, t0: now, moved: false, pet: false, hist: [] }; lastIn = now; },   /* un dito fermo sul gatto (finto) */
    lift: function () { onUp(); },
    refresh: function (s) { DOT.refresh(s); }, quiet: function () { return world.quiet.map(function (t) { return { l: t.l, t: t.t, r: t.r, b: t.b }; }); },
    fezInfo: function () { return fez ? { x: fez.b.x, y: fez.b.y, back: !!fez.back, wall: fez.wall ? { l: fez.wall.l, r: fez.wall.r } : null } : null; },
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
    bbox: function () { return catBox(); },                            /* il rettangolo che il gatto occupa adesso, in pagina */
    dock: function () { var p = world.dock; return p ? { a: p.a, b: p.b, y: p.y, on: !!p.on, tile: { l: p.tile.l, t: p.tile.t, r: p.tile.r, b: p.tile.b } } : null; },
    riding: function () { return riding(); }, follow: function () { return { offT: B.offT || 0, vy: B.vy || 0, still: now - (B.scrollAt || -9), home: atHome(), homeSeen: homeSeen(), now: now }; },
    choice: function () { var c = perchChoice(); return c ? { kind: c.kind, x: c.x, y: c.p ? c.p.y : null } : null; },
    dockup: function (x) { var p = world.dock; if (!p) return; tidy(); cat.vis = false; cat.plat = p; cat.x = x != null ? x : dockPickX(cat.x) || (p.a + p.b) / 2; cat.y = p.y; set("dockup", { x: cat.x }); },
    dockdown: function () { if (onDock()) set("dockdown", { away: true }); },
    blocked: function (x, e) { return dockBlocked(x, e); }, dockFree: function () { var p = world.dock, x, o = { n: 0, q: 0, c: 0, w: 0 }; if (!p) return o; for (x = p.a + 8; x <= p.b - 8; x += 6) { o.n++; if (!dockBlocked(x, 4)) { o.q++; if (!dockWords(x, true)) { o.c++; if (!dockWords(x)) o.w++; } } } return o; }, no: function () { return world.no.map(function (n) { return { l: n.l, t: n.t, r: n.r, b: n.b, m: n.m }; }); },
    home: function () { leaveThen(function () { var h = homeSpot(); if (h) arrive({ kind: "home", p: h.p, x: h.x }); }); },
    look: function () { return look; }, rig: function () { return rig; }, cat: cat, life: life
  };
})();
