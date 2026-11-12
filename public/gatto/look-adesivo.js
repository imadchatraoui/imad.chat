/* look-adesivo.js — l'aspetto «Adesivo» di Dot: morbido e tondo come un adesivo, il più tenero dei tre.
   Occhioni verdi lucidi (iride sfumata con un anello chiaro, pupilla da tonda a fessura, un riflesso netto),
   orecchie con il rosa dentro, nasino rosa, tre baffi sottili per lato. Corpo quasi nero, zampe lontane un filo più
   chiare, zampe vicine staccate da un filo di luce; sul fondo scuro un filo di luce fredda in alto a sinistra.
   Zampe affusolate (coscia piena, caviglia sottile), coda lunga e sottile che si assottiglia.
   Stesso contratto di look-base.js: draw(ctx, frame, env), drawFez(ctx, fez, env), drawProp(ctx, nome, p, env).
   Non muove nulla: disegna il fotogramma. Niente canvas creati qui, niente shadowBlur: i gradienti sono fatti una
   volta per contesto (in unità locali) e poi solo riusati. Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var TAU = Math.PI * 2, PI = Math.PI;
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(a, b, x) { var t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function nrm(x, y) { var d = Math.sqrt(x * x + y * y) || 1; return [x / d, y / d]; }

  /* colori: scuro (fondo notte) e chiaro */
  var PAL = {
    dark: { ink: "#0a0a10", far: "#272734", rim: "rgba(160,186,255,.66)", rim2: "rgba(160,186,255,.16)", sep: "rgba(170,194,255,.38)", whisk: "rgba(226,232,246,.8)", lash: "rgba(214,240,206,.92)", toe: "rgba(160,186,255,.45)", steam: "rgba(255,255,255,.42)" },
    light: { ink: "#0b0b10", far: "#2e2e3a", rim: null, rim2: null, sep: "rgba(255,255,255,.46)", whisk: "rgba(196,202,216,.95)", lash: "rgba(214,240,206,.92)", toe: "rgba(255,255,255,.34)", steam: "rgba(118,126,150,.62)" }
  };
  var EAR_IN = "#c98494", NOSE = "#f29aae", MOUTH = "#4e0f1e", TONGUE = "#f2849a", PAD = "#d9909f";

  /* gradienti fatti una volta per contesto, in coordinate locali fisse */
  function G(c) {
    if (c.__adesivo2) return c.__adesivo2;
    var g = {}, x;
    x = c.createRadialGradient(0, -0.42, 0.05, 0, -0.1, 1.02);          /* iride: chiara in basso, verde sul bordo */
    x.addColorStop(0, "#e6f79a"); x.addColorStop(0.38, "#9bdc55"); x.addColorStop(0.78, "#45a540"); x.addColorStop(1, "#2f8a36"); g.eye = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                         /* ombra a terra */
    x.addColorStop(0, "rgba(0,0,10,.55)"); x.addColorStop(0.55, "rgba(0,0,10,.25)"); x.addColorStop(1, "rgba(0,0,10,0)"); g.shadow = x;
    x = c.createLinearGradient(-6, 0, 6, 0);                              /* fez: feltro, luce da sinistra */
    x.addColorStop(0, "#e2434b"); x.addColorStop(0.35, "#cf2734"); x.addColorStop(0.75, "#a8172a"); x.addColorStop(1, "#7d0f20"); g.fez = x;
    x = c.createLinearGradient(0, 0.6, 0, 6.2);                           /* tè: ambra scura in basso */
    x.addColorStop(0, "#7a3a0c"); x.addColorStop(0.6, "#c47a22"); x.addColorStop(1, "#e9ad48"); g.tea = x;
    x = c.createRadialGradient(-1.2, 4.7, 0.3, 0, 3.6, 3.9);              /* gomitolo */
    x.addColorStop(0, "#ffd3dc"); x.addColorStop(0.6, "#f19db0"); x.addColorStop(1, "#c96b84"); g.yarn = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 7.5);                       /* alone della stella */
    x.addColorStop(0, "rgba(255,236,180,.9)"); x.addColorStop(0.18, "rgba(255,206,100,.5)"); x.addColorStop(0.5, "rgba(255,186,70,.14)"); x.addColorStop(1, "rgba(255,180,70,0)"); g.star = x;
    x = c.createLinearGradient(-6, 0, 7, 0);                              /* portatile */
    x.addColorStop(0, "#e4e7ee"); x.addColorStop(1, "#aeb3c0"); g.alu = x;
    c.__adesivo2 = g; return g;
  }

  /* ------------------------------------------------------------------ forme */
  function hull(c, x0, y0, r0, x1, y1, r1) {                      /* inviluppo di due cerchi: un solo tracciato, senza nodi */
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= Math.abs(r0 - r1) + 0.01) { var big = r0 > r1; c.moveTo((big ? x0 : x1) + (big ? r0 : r1), big ? y0 : y1); c.arc(big ? x0 : x1, big ? y0 : y1, big ? r0 : r1, 0, TAU); return; }
    var th = Math.atan2(dy, dx), ph = Math.acos((r0 - r1) / d);
    c.moveTo(x0 + r0 * Math.cos(th + ph), y0 + r0 * Math.sin(th + ph));
    c.arc(x0, y0, r0, th + ph, th + TAU - ph, false);
    c.arc(x1, y1, r1, th - ph, th + ph, false);
    c.closePath();
  }
  /* coda: un nastro affusolato con la punta tonda; tuft = lato (1 sinistro, -1 destro) e forza dei ciuffi (spaventato) */
  var TUFT = [0.62, 0.44, 0.7, 0.5, 0.38];
  function ribbon(c, pts, tuftSide, tuftK) {
    var n = pts.length, L = [], R = [], i, a, b, nx, ny, tx, ty, d, r, k;
    for (i = 0; i < n; i++) {
      a = pts[i > 0 ? i - 1 : 0]; b = pts[i < n - 1 ? i + 1 : n - 1]; tx = b.x - a.x; ty = b.y - a.y; d = Math.sqrt(tx * tx + ty * ty) || 1; tx /= d; ty /= d; nx = -ty; ny = tx;
      r = pts[i].r; var rl = r, rr = r, lx = 0, ly = 0;
      if (tuftK > 0.02 && i >= 3 && i < n - 2 && (i - 3) % 2 === 0) {       /* un ciuffo tondo che pende verso la radice */
        k = TUFT[((i - 3) / 2) % 5] * tuftK; if (tuftSide > 0) rl *= 1 + k; else rr *= 1 + k; lx = -tx * r * k * 0.9; ly = -ty * r * k * 0.9;
      }
      L.push([pts[i].x + nx * rl + (tuftSide > 0 ? lx : 0), pts[i].y + ny * rl + (tuftSide > 0 ? ly : 0)]);
      R.push([pts[i].x - nx * rr + (tuftSide < 0 ? lx : 0), pts[i].y - ny * rr + (tuftSide < 0 ? ly : 0)]);
    }
    c.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < n - 1; i++) c.quadraticCurveTo(L[i][0], L[i][1], (L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2);
    c.lineTo(L[n - 1][0], L[n - 1][1]);
    var p = pts[n - 1], q = pts[n - 2], al = Math.atan2(p.x - q.x, -(p.y - q.y));   /* angolo della normale sinistra */
    c.arc(p.x, p.y, p.r, al, al - PI, true);
    for (i = n - 2; i > 0; i--) c.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i - 1][0]) / 2, (R[i][1] + R[i - 1][1]) / 2);
    c.lineTo(R[0][0], R[0][1]); c.arc(pts[0].x, pts[0].y, pts[0].r, al + PI, al, true); c.closePath();
  }

  /* ------------------------------------------------------------------ la situazione: appeso, scivola, a pancia in su
     il fotogramma non porta il nome della posa: lo si deduce dalla geometria (vale anche per le pose del cervello) */
  function situation(f, env) {
    var Lg = f.legs, h = f.head, b = f.body, s = { hang: false, slide: false, belly: false }, i, n = 0;
    if (f.pose === "hang" || f.pose === "b-hang") { s.hang = true; return s; }
    if (f.pose === "slide" || f.pose === "b-slide") { s.slide = true; return s; }
    if (env && env.pawsOnEdge) return s;
    var rx = h.depth + (h.rx - h.depth) * Math.abs(h.fz), top = Math.max(b.hips.y, b.chest.y);
    if (Lg[0].tuck < 0.5 && Lg[0].fy > h.y && Lg[1].fy > h.y && Math.abs(Lg[0].fx - h.x) > rx * 0.6 && Math.abs(Lg[1].fx - h.x) > rx * 0.6) {
      if (Math.abs(Lg[2].fx - Lg[3].fx) > 13 && Lg[2].fy < b.hips.y) s.slide = true; else s.hang = true;
      return s;
    }
    for (i = 0; i < 4; i++) if (Lg[i].fy > top + 2 && Lg[i].tuck < 0.5) n++;
    if (n >= 3) s.belly = true;
    return s;
  }
  function legMode(l, s, env) {
    if (env && env.pawsOnEdge && l.front) return "edge";
    if (s.slide) return "pad";
    if (s.hang) return l.front ? "hook" : "hangfoot";
    if (s.belly) return "sky";
    if (l.fy < -2.5) return "dangle";
    return "ground";
  }

  /* ------------------------------------------------------------------ zampe: anca o spalla J, ginocchio K, caviglia A, zampa P */
  function pawGeo(l, f) {
    var fx = f.fwd[0], ax = Math.abs(fx), s = fx >= 0 ? 1 : -1;
    return { x: l.fx + s * l.paw * 0.3 * Math.min(1, ax + 0.15), y: l.fy + l.paw * 0.62, rx: l.paw * (0.86 + 0.3 * ax), ry: l.paw * 0.7 };
  }
  function legGeo(l, f, mode, LEN) {
    var hind = !l.front, g = { mode: mode, front: l.front, near: l.near, jx: l.jx, jy: l.jy, kx: l.kx, ky: l.ky, fx: l.fx, fy: l.fy, paw: l.paw, prx: 0 };
    g.rj = hind ? l.r0 * 1.5 : l.r0 * 1.02; g.rk = hind ? l.r0 * 0.82 : (l.r0 + l.r1) * 0.46; g.ra = l.r1 * 0.82;
    var ex, ey, d;
    if (mode === "hangfoot") {                                      /* appeso: zampe dietro corte e vicine, che penzolano appena */
      ex = g.fx - g.jx; ey = g.fy - g.jy; d = Math.sqrt(ex * ex + ey * ey) || 1;
      if (d > 6.6) { g.fx = g.jx + ex / d * 6.6; g.fy = g.jy + ey / d * 6.6; }
      g.kx = (g.jx + g.fx) / 2 + 0.4; g.ky = (g.jy + g.fy) / 2; g.rj = l.r0 * 1.2; g.rk = l.r0 * 0.86; mode = "dangle";
    }
    if (mode === "pad" || mode === "hook") {                        /* braccio teso: un solo pezzo affusolato fino alla zampa */
      g.rj = l.r0 * 0.9; g.ra = l.r1 * 0.92; g.rk = (g.rj + g.ra) / 2; g.kx = (g.jx + g.fx) / 2; g.ky = (g.jy + g.fy) / 2;
      g.ax = g.fx; g.ay = g.fy; d = nrm(g.fx - g.jx, g.fy - g.jy);
      if (mode === "pad" && l.front) { var so = g.fx >= f.body.chest.x ? 1 : -1, ox = -d[1], oy = d[0]; if (ox * so < 0) { ox = -ox; oy = -oy; } g.kx += ox * 1.5; g.ky += oy * 1.5; }   /* il gomito piega in fuori: braccia, non una lastra */ g.dx = d[0]; g.dy = d[1]; g.pa = Math.atan2(d[1], d[0]) - PI / 2;
      return g;
    }
    d = nrm(g.fx - g.kx, g.fy - g.ky); g.dx = d[0]; g.dy = d[1];
    if (mode === "ground") {
      var p = pawGeo(l, f); g.px = p.x; g.py = p.y; g.prx = p.rx; g.pry = p.ry; g.pa = 0; g.ax = l.fx; g.ay = l.fy + l.paw * 0.75;
      if (hind) {                                                   /* seduto o accucciato: la coscia è un solo fianco pieno, non due grumi */
        ex = l.fx - l.jx; ey = l.fy - l.jy; var hb = sm(0.93, 0.74, Math.sqrt(ex * ex + ey * ey) / LEN);
        if (hb > 0.001) { g.kx = lerp(g.kx, (g.jx + g.ax) / 2, hb); g.ky = lerp(g.ky, (g.jy + g.ay) / 2, hb); g.rj = lerp(g.rj, l.r0 * 1.36, hb); g.ra = lerp(g.ra, l.r1, hb); g.rk = lerp(g.rk, (g.rj + g.ra) / 2, hb); }
      }
    } else {                                                        /* penzola, o zampa in aria (a pancia in su): la zampa segue la gamba */
      g.ra = l.r1 * 0.8; g.ax = g.fx - d[0] * l.paw * 0.4; g.ay = g.fy - d[1] * l.paw * 0.4; g.px = g.fx + d[0] * l.paw * 0.25; g.py = g.fy + d[1] * l.paw * 0.25;
      g.prx = l.paw * (mode === "sky" ? 0.96 : 0.82); g.pry = l.paw * (mode === "sky" ? 1.0 : 0.96); g.pa = Math.atan2(d[1], d[0]) - PI / 2;
    }
    return g;
  }
  function legPath(c, g) { hull(c, g.jx, g.jy, g.rj, g.kx, g.ky, g.rk); hull(c, g.kx, g.ky, g.rk, g.ax, g.ay, g.ra); }
  function pawPath(c, g) { if (g.prx > 0) { c.moveTo(g.px + g.prx * Math.cos(g.pa), g.py + g.prx * Math.sin(g.pa)); c.ellipse(g.px, g.py, g.prx, g.pry, g.pa, 0, TAU); } }
  function fillLeg(c, g) { c.beginPath(); legPath(c, g); c.fill(); if (g.prx > 0) { c.beginPath(); pawPath(c, g); c.fill(); } }
  /* i cuscinetti rosa (a pancia in su): la zampa mostra la pianta */
  function skyPads(c, g) {
    var ca = Math.cos(g.pa), sa = Math.sin(g.pa), i;
    function P(u, v) { return [g.px + u * ca - v * sa, g.py + u * sa + v * ca]; }
    c.fillStyle = PAD; var m = P(0, -g.pry * 0.16); c.beginPath(); c.ellipse(m[0], m[1], g.prx * 0.42, g.pry * 0.32, g.pa, 0, TAU); c.fill();
    for (i = -1; i <= 1; i++) { var q = P(i * g.prx * 0.5, g.pry * (0.46 - Math.abs(i) * 0.12)); c.beginPath(); c.ellipse(q[0], q[1], g.prx * 0.17, g.pry * 0.19, g.pa, 0, TAU); c.fill(); }
  }

  /* la zampa che si aggrappa (scivola): pianta rosa verso di noi, artigli chiari in cima */
  function clingPaw(c, g, pal, sepOn, o, claws) {
    var r = g.paw * 1.04;
    c.save(); c.translate(g.fx, g.fy + 0.3); c.rotate(g.pa);
    if (sepOn) { c.save(); c.translate(-o, o); c.fillStyle = sepOn; c.beginPath(); c.ellipse(0, 0, r * 1.2, r * 1.04, 0, 0, TAU); c.fill(); c.restore(); }
    c.fillStyle = pal.ink; c.beginPath(); c.ellipse(0, 0, r * 1.2, r * 1.04, 0, 0, TAU); c.fill();
    var i;
    c.fillStyle = PAD; c.beginPath(); c.ellipse(0, -r * 0.26, r * 0.5, r * 0.36, 0, 0, TAU); c.fill();
    for (i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(i * r * 0.54, r * 0.42 - Math.abs(i) * r * 0.13, r * 0.21, r * 0.24, 0, 0, TAU); c.fill(); }
    if (claws) {
      c.strokeStyle = "rgba(240,242,250,.92)"; c.lineWidth = Math.max(0.16, r * 0.085); c.lineCap = "round";
      for (i = -1; i <= 1; i++) { var cx0 = i * r * 0.56, cy0 = r * 0.92 - Math.abs(i) * r * 0.12; c.beginPath(); c.moveTo(cx0, cy0); c.quadraticCurveTo(cx0 + i * r * 0.05, cy0 + r * 0.38, cx0 - r * 0.07, cy0 + r * 0.46); c.stroke(); }
    }
    c.restore();
  }
  /* la zampa che si aggancia al bordo (appeso): tre dita tonde piegate sopra il bordo */
  function hookPath(c, g) {
    var r = g.paw * 1.08, ca = Math.cos(g.pa), sa = Math.sin(g.pa), i;
    c.moveTo(g.fx + r * ca, g.fy + r * sa); c.ellipse(g.fx, g.fy, r, r * 0.92, g.pa, 0, TAU);
    for (i = -1; i <= 1; i++) { var u = i * r * 0.6, v = r * (0.78 - Math.abs(i) * 0.14), x = g.fx + u * ca - v * sa, y = g.fy + u * sa + v * ca, rr = r * 0.4; c.moveTo(x + rr, y); c.arc(x, y, rr, 0, TAU); }
  }
  function hookToes(c, g, pal) {
    var r = g.paw * 1.08, ca = Math.cos(g.pa), sa = Math.sin(g.pa), i;
    c.strokeStyle = pal.toe; c.lineWidth = Math.max(0.17, r * 0.08); c.lineCap = "round";
    for (i = -1; i <= 1; i += 2) { var u = i * r * 0.3, a0 = [g.fx + u * ca - r * 1.05 * sa, g.fy + u * sa + r * 1.05 * ca], a1 = [g.fx + u * ca - r * 0.42 * sa, g.fy + u * sa + r * 0.42 * ca]; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.stroke(); }
  }

  /* ------------------------------------------------------------------ corpo, orecchie, testa, coda */
  var cur = { s: { hang: false, slide: false, belly: false }, tail: null, side: 1 };
  function tailGeo(f) {                                             /* coda più sottile; da spaventata non si gonfia a tronco: fa i ciuffi */
    var p = f.tail.pts, puff = f.tail.puff || 0, k = (1 + 0.2 * puff) / (1 + 0.55 * puff), out = [], i, sd = 0, b = f.body, mx = (b.hips.x + b.chest.x) / 2, my = (b.hips.y + b.chest.y) / 2;
    for (i = 0; i < p.length; i++) out.push({ x: p[i].x, y: p[i].y, r: p[i].r * k });
    for (i = 1; i < p.length - 1; i++) { var tx = p[i + 1].x - p[i - 1].x, ty = p[i + 1].y - p[i - 1].y; sd += -ty * (p[i].x - mx) + tx * (p[i].y - my); }
    return { pts: out, side: sd >= 0 ? 1 : -1, puff: puff };
  }
  function partTail(c) { var t = cur.tail; c.beginPath(); ribbon(c, t.pts, t.side, t.puff); c.fill(); }
  function bodyPath(c, f) {
    var b = f.body, mx = (b.hips.x + b.chest.x) / 2, hr = b.hips.r, cr = b.chest.r;
    if (cur.s.hang) { hr *= 1.16; cr *= 0.86; }                   /* appeso: il peso scende in basso, una goccia morbida */
    c.save(); c.translate(mx, 0); c.scale(b.sx, b.sy); c.translate(-mx, 0);
    if (b.mid) { hull(c, b.hips.x, b.hips.y, hr, b.mid.x, b.mid.y, b.mid.r); hull(c, b.mid.x, b.mid.y, b.mid.r, b.chest.x, b.chest.y, cr); }
    else hull(c, b.hips.x, b.hips.y, hr, b.chest.x, b.chest.y, cr);
    c.restore();
    var h = f.head, nr = Math.min(h.ry, h.rx) * 0.72; hull(c, b.chest.x, b.chest.y, cr * 0.86, h.x, h.y - h.ry * 0.12, nr);   /* il collo, liscio */
  }
  function partBody(c, f) { c.beginPath(); bodyPath(c, f); c.fill(); }
  function earPath(c, e, h) {
    var ex = e.tx - e.bx, ey = e.ty - e.by, el = Math.sqrt(ex * ex + ey * ey) || 1, ux = ex / el, uy = ey / el, nx = -uy, ny = ux, w = e.w;
    var out = (e.bx - h.x) * nx + (e.by - h.y) * ny >= 0 ? 1 : -1;           /* da che parte è il lato esterno */
    var ox = e.bx + nx * w * out, oy = e.by + ny * w * out, ix = e.bx - nx * w * out, iy = e.by - ny * w * out;
    var tx = e.tx - ux * 1.1, ty = e.ty - uy * 1.1;                          /* punta arrotondata */
    c.moveTo(ix, iy);
    c.quadraticCurveTo(e.bx + ex * 0.55 - nx * w * out * 0.15, e.by + ey * 0.55 - ny * w * out * 0.15, tx - nx * 0.7 * out, ty - ny * 0.7 * out);
    c.quadraticCurveTo(e.tx + ux * 0.2, e.ty + uy * 0.2, tx + nx * 0.7 * out, ty + ny * 0.7 * out);
    c.quadraticCurveTo(e.bx + ex * 0.5 + nx * w * out * 0.55, e.by + ey * 0.5 + ny * w * out * 0.55, ox, oy);
    c.closePath();
    return { ux: ux, uy: uy, nx: nx, ny: ny, out: out, el: el };
  }
  function earPink(c, e, eg, h, farEar) {
    var pk = sm(-0.1, 0.5, h.fz) * (1 - 0.4 * e.flat) * (farEar ? 0.7 : 1); if (pk < 0.03) return;
    var bx = e.bx + (e.tx - e.bx) * 0.12, by = e.by + (e.ty - e.by) * 0.12, w = e.w * 0.52, tx = e.tx - eg.ux * 2.4 - eg.nx * eg.out * 0.25, ty = e.ty - eg.uy * 2.4 - eg.ny * eg.out * 0.25;
    c.globalAlpha = pk; c.fillStyle = EAR_IN; c.beginPath(); c.moveTo(bx - eg.nx * w * eg.out, by - eg.ny * w * eg.out);
    c.quadraticCurveTo((bx + tx) / 2 - eg.nx * w * 0.5 * eg.out, (by + ty) / 2 - eg.ny * w * 0.5 * eg.out, tx, ty);
    c.quadraticCurveTo((bx + tx) / 2 + eg.nx * w * 0.9 * eg.out, (by + ty) / 2 + eg.ny * w * 0.9 * eg.out, bx + eg.nx * w * 0.8 * eg.out, by + eg.ny * w * 0.8 * eg.out); c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  function headFrame(h) {
    var ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul, fl = h.f[0] * uy - h.f[1] * ux;
    return { ux: ux, uy: uy, sd: fl >= 0 ? 1 : -1, pf: sat(1 - Math.abs(h.fz) * 1.7) };   /* sd: da che parte guarda il muso; pf: quanto è di profilo */
  }
  function headPath(c, h, fr) {                                    /* testa più larga che alta, guance piene, di profilo un piccolo muso */
    var rxe = h.depth + (h.rx - h.depth) * Math.abs(h.fz), ry = h.ry, i, N = 40, mz = rxe * 0.13 * fr.pf;
    c.save(); c.translate(h.x, h.y); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0);
    for (i = 0; i < N; i++) {
      var a = i / N * TAU, ca = Math.cos(a), sa = Math.sin(a), x, y;
      if (sa >= 0) { x = rxe * (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 0.92); y = ry * Math.pow(sa, 0.82) * 0.98; }
      else {
        x = rxe * (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 0.74) * (1 + 0.04 * Math.abs(sa)); y = -ry * Math.pow(-sa, 1.08) * 0.9;
        if (mz > 0.01 && ca * fr.sd > 0) x += fr.sd * mz * Math.sin(PI * sat((Math.asin(-sa) - 0.3) / 0.8));
      }
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.restore();
  }

  /* ------------------------------------------------------------------ occhi, muso, baffi */
  function eye(c, e, fr, ss, pal, g) {
    if (e.vis < 0.56) return;                                       /* niente occhi fantasma: o si vede, o gira via schiacciandosi */
    var open = e.open, big = 1 + Math.max(0, open - 1) * 0.32, r = e.r * big, o = Math.min(1, open), sq = e.vis < 0.72 ? (e.vis - 0.55) / 0.17 : 1;
    c.save(); c.translate(e.x, e.y); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0); c.scale(e.sx * sq, 1);
    if (o < 0.14) {                                                 /* chiuso: un arco morbido, contento */
      c.strokeStyle = pal.lash; c.lineWidth = Math.max(0.5, r * 0.17); c.lineCap = "round";
      c.beginPath(); c.arc(0, r * 0.42, r * 0.82, PI * 1.18, PI * 1.82); c.stroke(); c.restore(); return;
    }
    var inner = -e.side * ss, sl = e.brow * r * 0.8, lidY = r - 2 * r * (1 - o) * 0.92 - r * e.lid * 0.85;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.save(); c.clip();
    c.save(); c.scale(r, r); c.fillStyle = g.eye; c.fillRect(-1, -1, 2, 2); c.restore();
    var px = e.pupil.dx * r * 0.33, py = e.pupil.dy * r * 0.28 - r * 0.04;
    c.fillStyle = "#050507"; c.beginPath();
    if (open > 1.15) c.arc(px * 0.8, py * 0.8, r * 0.32, 0, TAU);   /* spaventato: pupille piccole e tonde */
    else c.ellipse(px, py, r * (0.1 + 0.36 * e.pupil.w), r * 0.66, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(182,240,106,.6)"; c.lineWidth = r * 0.09; c.beginPath(); c.arc(0, 0, r * 0.955, 0, TAU); c.stroke();   /* l'anello chiaro: stacca l'occhio dalla testa nera */
    c.fillStyle = "rgba(255,255,255,.97)"; c.beginPath(); c.arc(-r * 0.36 + px * 0.25, r * 0.4 + py * 0.2, r * (open > 1.15 ? 0.2 : 0.25), 0, TAU); c.fill();   /* il riflesso netto */
    c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.arc(r * 0.34 + px * 0.2, -r * 0.4, r * 0.09, 0, TAU); c.fill();
    if (o < 1 || e.lid > 0.02 || e.brow > 0.02) {                   /* palpebra: piatta e inclinata quando è seccato */
      c.fillStyle = pal.ink; c.beginPath(); c.moveTo(-r * 1.3, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.3, lidY + (inner < 0 ? sl : -sl)); c.lineTo(r * 1.3, r * 1.6); c.lineTo(-r * 1.3, r * 1.6); c.closePath(); c.fill();
    }
    c.restore();
    c.restore();
  }
  function face(c, f, fr, pal, g) {
    var h = f.head, i, ss = (h.s[0] * fr.uy - h.s[1] * fr.ux) >= 0 ? 1 : -1;
    c.save(); c.beginPath(); headPath(c, h, fr); c.clip();          /* occhi e muso restano dentro la testa */
    for (i = 0; i < 2; i++) eye(c, f.eyes[i], fr, ss, pal, g);
    c.restore();
    var m = f.mouth, mzx = fr.sd * fr.pf * 0.9 * fr.uy, mzy = -fr.sd * fr.pf * 0.9 * fr.ux;   /* di profilo naso e bocca vanno sulla punta del muso */
    if (m.vis > 0.2 && m.open > 0.06) {                              /* bocca aperta: miao o sbadiglio */
      var mo = m.open, w = 1.15 + 1.35 * mo, hh = 0.7 + 3.6 * mo;
      c.save(); c.globalAlpha = sat((m.vis - 0.2) / 0.25); c.translate(m.x + mzx * 0.6, m.y + mzy * 0.6); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0); c.scale(1 - 0.4 * fr.pf, 1);
      c.beginPath(); c.moveTo(-w, 0); c.quadraticCurveTo(0, 0.55, w, 0); c.quadraticCurveTo(w * 1.02, -hh * 0.9, 0, -hh); c.quadraticCurveTo(-w * 1.02, -hh * 0.9, -w, 0); c.closePath();
      c.fillStyle = MOUTH; c.fill(); c.save(); c.clip();
      c.fillStyle = TONGUE; c.beginPath(); c.ellipse(0, -hh * 0.98, w * 0.78, hh * 0.42, 0, 0, TAU); c.fill(); c.restore();
      if (mo > 0.45) { c.fillStyle = "#fbf7f2"; for (i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(i * w * 0.78, 0.05); c.lineTo(i * w * 0.48, 0.12); c.lineTo(i * w * 0.62, -0.35 - 0.5 * mo); c.closePath(); c.fill(); } }
      c.restore();
    }
    if (f.nose.vis > 0.06) {                                         /* nasino rosa, un triangolo tondo: si vede anche di profilo */
      c.save(); c.globalAlpha = sat((f.nose.vis - 0.06) / 0.25); c.fillStyle = NOSE; c.translate(f.nose.x + mzx, f.nose.y + mzy); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0); c.scale(1 - 0.35 * fr.pf, 1);
      c.beginPath(); c.moveTo(-1.05, 0.45); c.quadraticCurveTo(0, 0.78, 1.05, 0.45); c.quadraticCurveTo(0.55, -0.35, 0, -0.62); c.quadraticCurveTo(-0.55, -0.35, -1.05, 0.45); c.fill(); c.restore();
    }
    c.strokeStyle = pal.whisk; c.lineWidth = 0.26; c.lineCap = "round";
    for (i = 0; i < 2; i++) {
      var wq = f.whiskers[i]; if (wq.vis < 0.05) continue; c.globalAlpha = wq.vis;
      for (var k = -1; k <= 1; k++) {
        var a = k * 0.24 - 0.04, ca = Math.cos(a), sa = Math.sin(a), dx = wq.dx * ca - wq.dy * sa * wq.side, dy = wq.dx * sa * wq.side + wq.dy * ca, L = wq.len * (k === 0 ? 1.06 : 0.92);
        var x0 = wq.x + dx * 0.4, y0 = wq.y + k * 0.62;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + dx * L * 0.55, y0 + dy * L * 0.55 + 0.25, x0 + dx * L, y0 + dy * L - 0.35 - k * 0.2); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ il fez: cono corto a lati dritti, cima piatta, bottoncino e nappa */
  function fezShape(c, x, y, tx, ty, rB, rT, ell, top, g) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    var eB = rB * Math.max(ell, 0.16), eT = rT * ell;
    c.fillStyle = g.fez; c.beginPath(); c.moveTo(-rB, 0); c.lineTo(-rT, len); c.lineTo(rT, len); c.lineTo(rB, 0);
    c.ellipse(0, 0, rB, eB, 0, 0, PI, true); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,190,190,.17)"; c.beginPath(); c.moveTo(-rB * 0.66, 0.2 - eB * 0.6); c.lineTo(-rT * 0.64, len - 0.2); c.lineTo(-rT * 0.32, len - 0.2); c.lineTo(-rB * 0.36, 0.3 - eB * 0.9); c.closePath(); c.fill();   /* luce morbida del feltro */
    c.strokeStyle = "rgba(70,0,14,.38)"; c.lineWidth = 0.55; c.beginPath(); c.ellipse(0, 0.28, rB * 0.99, eB, 0, PI * 1.05, PI * 1.95, true); c.stroke();   /* il bordo in basso, un filo più scuro */
    c.fillStyle = top ? "#d8353f" : "#9a1526"; c.beginPath(); c.ellipse(0, len, rT, Math.max(eT, 0.2), 0, 0, TAU); c.fill();
    c.strokeStyle = "rgba(255,170,170,.45)"; c.lineWidth = 0.3; c.beginPath(); c.ellipse(0, len, rT * 0.98, Math.max(eT, 0.2), 0, PI * 1.02, PI * 1.98, true); c.stroke();
    if (top) { c.fillStyle = "#1c0a10"; c.beginPath(); c.ellipse(0, len, 0.6, 0.6 * Math.max(ell, 0.45), 0, 0, TAU); c.fill(); }   /* il bottoncino della nappa */
    c.restore();
  }
  function tassel(c, bx, by, t) {                                   /* cordino dal bottone, oltre il bordo della cima; poi il ciuffo sul feltro */
    var dx = t.x1 - t.x0, dy = t.y1 - t.y0, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var kx = t.x0 + ux * 0.55, ky = t.y0 + uy * 0.55, ex = t.x1, ey = t.y1;
    c.strokeStyle = "#16080c"; c.lineWidth = 0.4; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo((bx + t.x0) / 2, (by + t.y0) / 2 + 0.3, t.x0, t.y0); c.lineTo(kx, ky); c.stroke();
    c.fillStyle = "#16080c"; c.beginPath(); c.arc(kx, ky, 0.5, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(kx + nx * 0.32, ky + ny * 0.32);
    c.quadraticCurveTo(kx + dx * 0.5 + nx * 0.72, ky + dy * 0.5 + ny * 0.72, ex - ux * 0.7 + nx * 0.7, ey - uy * 0.7 + ny * 0.7);
    c.arc(ex - ux * 0.7, ey - uy * 0.7, 0.7, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    c.quadraticCurveTo(kx + dx * 0.5 - nx * 0.72, ky + dy * 0.5 - ny * 0.72, kx - nx * 0.32, ky - ny * 0.32); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,120,120,.35)"; c.lineWidth = 0.2; c.stroke();
  }
  function fezOnHead(c, f, g) {
    var z = f.fez; fezShape(c, z.x, z.y, z.tx, z.ty, z.rBase, z.rTop, z.ell, z.top, g);
    var ts = z.tassel, L = Math.sqrt((ts.x1 - ts.x0) * (ts.x1 - ts.x0) + (ts.y1 - ts.y0) * (ts.y1 - ts.y0)) || 1, mx = Math.min(1, z.h * 0.55 / L);
    tassel(c, z.tx, z.ty, { x0: ts.x0, y0: ts.y0 - 0.1, x1: ts.x0 + (ts.x1 - ts.x0) * mx, y1: ts.y0 - 0.1 + (ts.y1 - ts.y0) * mx });
  }

  /* ------------------------------------------------------------------ il disegno */
  var last = { f: null, m: null, env: null };
  function draw(c, f, env) {
    env = env || {}; var pal = env.dark === false ? PAL.light : PAL.dark, g = G(c), i, j, l, h = f.head, fr = headFrame(h), s = situation(f, env), LEN = (f.P && f.P.leg && f.P.leg.len) || 11.8;
    var sc = env.scale || 2.6, o = Math.min(0.45, Math.max(0.15, 0.85 / sc));
    cur.s = s; cur.tail = tailGeo(f);
    last.f = f; last.env = env; last.m = c.getTransform ? c.getTransform() : null;
    var GL = []; for (i = 0; i < 4; i++) GL.push(legGeo(f.legs[i], f, legMode(f.legs[i], s, env), LEN));
    if (env.shadow && env.shadow.k > 0.01) { c.save(); c.globalAlpha = Math.min(1, env.shadow.k); c.translate((f.body.hips.x + f.body.chest.x) / 2 * 0.6, env.shadow.y); c.scale(17, 2.4); c.fillStyle = g.shadow; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore(); }
    c.save();
    if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); }

    var edgePaws = !!env.pawsOnEdge, cling = s.hang || s.slide;
    function shown(k) { var q = f.legs[k]; return q.tuck < 0.95 && !(edgePaws && q.front); }
    function upFront(k) {                                           /* zampa alzata davanti al muso: si lava, dà una zampata, beve */
      var q = f.legs[k], gq = GL[k]; if (!q.front || cling || s.belly) return false;
      var sitting = f.legs[2].fy < 2.5 && f.legs[3].fy < 2.5;    /* solo da seduto o in piedi: in aria le zampe stanno sotto il muso */
      return sitting && (q.up || (gq.mode === "ground" && q.near && q.fy > 2 && gq.py + gq.pry > h.y - h.ry * 0.75));
    }
    var es = f.ears.slice().sort(function (a, b) { return a.depth - b.depth; }), late = Math.abs(h.fz) < 0.45 && !!f.fez;   /* di profilo l'orecchio vicino sta davanti al fez */
    function clingShape(gq) { if (gq.mode === "hook") hookPath(c, gq); else { c.save(); c.translate(gq.fx, gq.fy + 0.3); c.rotate(gq.pa); c.moveTo(gq.paw * 1.25, 0); c.ellipse(0, 0, gq.paw * 1.25, gq.paw * 1.08, 0, 0, TAU); c.restore(); } }

    function silhouette() {
      partTail(c);
      for (j = 0; j < 4; j++) if (shown(j)) fillLeg(c, GL[j]);
      partBody(c, f);
      for (j = 0; j < 2; j++) { c.beginPath(); earPath(c, es[j], h); c.fill(); }
      c.beginPath(); headPath(c, h, fr); c.fill();
      if (cling) for (j = 0; j < 4; j++) if (shown(j) && (GL[j].mode === "hook" || GL[j].mode === "pad")) { c.beginPath(); clingShape(GL[j]); c.fill(); }
    }
    /* 1. il filo di luce: la sagoma intera spostata in alto a sinistra (solo sul fondo scuro) */
    if (pal.rim) {
      c.save(); c.translate(-o * 1.9, o * 1.9); c.fillStyle = pal.rim2; silhouette(); c.restore();
      c.save(); c.translate(-o, o); c.fillStyle = pal.rim; silhouette(); c.restore();
    }
    function sep(fn) { c.save(); c.translate(-o * 0.8, o * 0.8); c.fillStyle = pal.sep; fn(); c.restore(); }
    /* 2. dietro: coda, zampe lontane */
    c.fillStyle = pal.ink; if (!f.tail.front) partTail(c);
    for (i = 0; i < 4; i++) if (shown(i) && !f.legs[i].near && !upFront(i)) { c.fillStyle = pal.far; fillLeg(c, GL[i]); if (GL[i].mode === "sky") skyPads(c, GL[i]); }
    /* 3. il corpo, poi le zampe vicine con un filo che le stacca */
    c.fillStyle = pal.ink; partBody(c, f);
    for (i = 0; i < 4; i++) if (shown(i) && f.legs[i].near && !upFront(i)) {
      (function (gq) { sep(function () { fillLeg(c, gq); }); c.fillStyle = pal.ink; fillLeg(c, gq); if (gq.mode === "sky") skyPads(c, gq); })(GL[i]);
    }
    if (f.tail.front) { sep(function () { partTail(c); }); c.fillStyle = pal.ink; partTail(c); }
    /* 4. orecchie (la lontana più chiara), con il rosa dentro; poi la testa, il muso, il fez */
    function drawEar(k) {
      var e = es[k], farEar = k === 0 && Math.abs(es[0].depth - es[1].depth) > 1.2;
      if (k === 1 && late) sep(function () { c.beginPath(); earPath(c, e, h); c.fill(); });
      c.fillStyle = farEar ? pal.far : pal.ink; c.beginPath(); var eg = earPath(c, e, h); c.fill(); earPink(c, e, eg, h, farEar);
    }
    drawEar(0); if (!late) drawEar(1);
    sep(function () { c.beginPath(); headPath(c, h, fr); c.fill(); });
    c.fillStyle = pal.ink; c.beginPath(); headPath(c, h, fr); c.fill();
    face(c, f, fr, pal, g);
    if (f.fez) fezOnHead(c, f, g);
    if (late) drawEar(1);
    /* 5. zampe alzate davanti alla testa */
    for (i = 0; i < 4; i++) if (shown(i) && upFront(i)) {
      (function (gq, near) {
        sep(function () { fillLeg(c, gq); }); c.fillStyle = near ? pal.ink : pal.far; fillLeg(c, gq);
        if (gq.prx * sc > 6) { c.strokeStyle = pal.toe; c.lineWidth = 0.22; c.lineCap = "round"; for (var t = -1; t <= 1; t += 2) { c.beginPath(); c.moveTo(gq.px + t * gq.prx * 0.3, gq.py + gq.pry * 0.85); c.lineTo(gq.px + t * gq.prx * 0.26, gq.py + gq.pry * 0.2); c.stroke(); } }
      })(GL[i], f.legs[i].near);
    }
    /* 6. zampe che si aggrappano (appeso, scivola): sopra tutto */
    if (cling) for (i = 0; i < 4; i++) {
      var gc = GL[i]; if (!shown(i)) continue;
      if (gc.mode === "pad") clingPaw(c, gc, pal, pal.sep, o, true);
      else if (gc.mode === "hook") { sep(function () { c.beginPath(); hookPath(c, gc); c.fill(); }); c.fillStyle = pal.ink; c.beginPath(); hookPath(c, gc); c.fill(); hookToes(c, gc, pal); }
    }
    c.restore();
    /* 7. spunta dal bordo: le due zampe davanti appoggiate sul bordo, fuori dal ritaglio */
    if (edgePaws) for (i = 0; i < 2; i++) {
      l = f.legs[i]; var px = l.fx, pr = l.paw;
      c.save(); c.translate(px, 0);
      if (pal.rim) { c.fillStyle = pal.rim; c.beginPath(); c.ellipse(-o, 1.15 * pr * 0.55 + o, pr * 1.42, pr * 0.92, 0, 0, TAU); c.fill(); }
      c.fillStyle = pal.ink; c.beginPath(); c.ellipse(0, pr * 0.63, pr * 1.42, pr * 0.92, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0, -0.15, pr * 1.3, pr * 0.62, 0, 0, PI, true); c.fill();      /* il labbro che scende oltre il bordo */
      c.strokeStyle = pal.toe; c.lineWidth = Math.max(0.17, pr * 0.085); c.lineCap = "round";
      for (var tt = -1; tt <= 1; tt += 2) { c.beginPath(); c.moveTo(tt * pr * 0.42, -pr * 0.5); c.lineTo(tt * pr * 0.36, pr * 0.32); c.stroke(); }
      c.restore();
    }
  }

  /* il fez quando non è in testa: origine al centro della base, dritto */
  function drawFez(c, fz, env) {
    var g = G(c), ell = fz.ell == null ? 0.22 : fz.ell; fezShape(c, 0, 0, 0, fz.h, fz.rBase, fz.rTop, ell, fz.top !== false, g);
    var a = fz.tasselAng || 0, x0 = -fz.rTop * 0.7, y0 = fz.h - 0.1, L = fz.h * 0.55;
    tassel(c, 0, fz.h, { x0: x0, y0: y0, x1: x0 + L * Math.sin(a), y1: y0 - L * Math.cos(a) });
  }

  /* ------------------------------------------------------------------ gli oggetti di Dot */
  function rr(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var KUKKO = ["#ffb6c1", "#fdfd96", "#ffb347", "#77dd77", "#aec6cf", "#ff6961"];
  var CUBE = { F: [2, 0, 3, 5, 2, 4, 1, 2, 3], U: [0, 3, 0, 4, 0, 1, 2, 5, 0], R: [3, 4, 5, 3, 1, 3, 0, 3, 4] };

  /* le zampe davanti sopra l'oggetto, se il gatto le ha lì (stesso contesto).
     grip: halfW(y) dà la mezza larghezza dell'oggetto a quella quota: le zampe lo stringono ai lati, non ci passano davanti */
  function pawsOver(c, w, hgt, halfW, gy0, gy1) {
    var f = last.f, m1 = last.m; if (!f || !m1 || !c.getTransform) return;
    var m2 = c.getTransform(), det = m2.a * m2.d - m2.b * m2.c; if (Math.abs(det) < 1e-9) return;
    var pal = last.env && last.env.dark === false ? PAL.light : PAL.dark, sc = (last.env && last.env.scale) || 2.6, o = Math.min(0.6, Math.max(0.17, 1.05 / sc));
    function loc(x, y) { var X = m1.a * x + m1.c * y + m1.e, Y = m1.b * x + m1.d * y + m1.f; X -= m2.e; Y -= m2.f; return [(m2.d * X - m2.c * Y) / det, (-m2.b * X + m2.a * Y) / det]; }
    var m1s = Math.sqrt(Math.abs(m1.a * m1.d - m1.b * m1.c)) / Math.sqrt(Math.abs(det)), i, P = [];
    for (i = 0; i < 2; i++) {
      var l = f.legs[i]; if (l.tuck > 0.5) continue; var p = pawGeo(l, f), q = loc(p.x, p.y);
      if (Math.abs(q[0]) > w * 0.5 + 3.6 || q[1] < -2.5 || q[1] > hgt + 3) continue;
      P.push({ l: l, p: p, x: q[0], y: q[1], k: loc(l.kx * 0.22 + l.fx * 0.78, l.ky * 0.22 + (l.fy + l.r1) * 0.78) });
    }
    for (i = 0; i < P.length; i++) {
      var q2 = P[i], rx = q2.p.rx * m1s, ry = q2.p.ry * m1s * 1.08, x = q2.x, y = q2.y, sd = x < 0 ? -1 : 1;
      if (P.length === 2) sd = P[i].x <= P[1 - i].x ? -1 : 1;
      c.save(); c.lineCap = "round";
      if (halfW) {                                                  /* stringe: la zampa di lato, un po' in piedi, metà sopra il vetro */
        y = Math.max(gy0, Math.min(gy1, y)); var gw = halfW(y), rx2 = rx * 0.7, ry2 = ry * 1.12; x = sd * (gw + rx2 * 0.12);
        c.save(); c.translate(-o * 0.8, o * 0.8); c.fillStyle = pal.sep; c.beginPath(); c.ellipse(x, y, rx2, ry2, 0, 0, TAU); c.fill(); c.restore();
        c.fillStyle = pal.ink; c.beginPath(); c.ellipse(x, y, rx2, ry2, 0, 0, TAU); c.fill();
        c.strokeStyle = pal.toe; c.lineWidth = 0.18;
        for (var t = -1; t <= 1; t += 2) { c.beginPath(); c.moveTo(x - sd * rx2 * 0.15, y + t * ry2 * 0.3); c.lineTo(x - sd * rx2 * 0.85, y + t * ry2 * 0.26); c.stroke(); }
      } else {                                                      /* appoggiata sopra (la tastiera) */
        c.save(); c.translate(-o * 0.8, o * 0.8); c.fillStyle = pal.sep; c.beginPath(); hull(c, q2.k[0], q2.k[1], q2.l.r1 * m1s, x, y, ry); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.restore();
        c.fillStyle = pal.ink; c.beginPath(); hull(c, q2.k[0], q2.k[1], q2.l.r1 * m1s, x, y, ry); c.fill(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
        c.strokeStyle = pal.toe; c.lineWidth = 0.2;
        c.beginPath(); c.moveTo(x - sd * rx * 0.2, y + ry * 0.4); c.lineTo(x - sd * rx * 0.75, y + ry * 0.15); c.moveTo(x - sd * rx * 0.2, y - ry * 0.3); c.lineTo(x - sd * rx * 0.78, y - ry * 0.25); c.stroke();
      }
      c.restore();
    }
  }

  function drawProp(c, name, p, env) {
    p = p || {}; env = env || last.env || {}; var g = G(c), t = p.t || 0, i, j, dark = env.dark !== false;
    c.save(); var SC = name === "tea" ? 1.42 : name === "cube" ? 1.3 : name === "laptop" ? 1.15 : name === "yarn" ? 1.15 : 1; c.scale(SC, SC);
    if (name === "tea") {                                           /* il bicchiere di tè alla menta: un bicchierino dritto, più largo in alto, il filo d'oro sul bordo */
      var bw = 1.7, tw = 2.35, H = 7.2;
      var hw = function (y) { return bw + (tw - bw) * y / H; };
      var glass = function () { c.beginPath(); c.moveTo(-bw, 0); c.lineTo(bw, 0); c.lineTo(tw, H); c.lineTo(-tw, H); c.closePath(); };
      /* il filo di vapore */
      c.strokeStyle = dark ? PAL.dark.steam : PAL.light.steam; c.lineWidth = 0.34; c.lineCap = "round";
      for (j = 0; j < 2; j++) { var ph = t * 1.7 + j * 2.2, sx = (j ? 0.9 : -0.5); c.globalAlpha = 0.7 - j * 0.3; c.beginPath(); c.moveTo(sx, H + 1.4); c.bezierCurveTo(sx + 0.7 * Math.sin(ph), H + 2.2, sx - 0.6 * Math.sin(ph + 1), H + 2.9, sx + 0.4 * Math.sin(ph + 2), H + 3.7 - j * 0.6); c.stroke(); }
      c.globalAlpha = 1;
      c.save(); glass(); c.clip();
      c.fillStyle = dark ? "rgba(210,226,240,.34)" : "rgba(255,255,255,.7)"; c.fillRect(-4, -1, 8, H + 2);            /* il vetro */
      c.fillStyle = g.tea; c.beginPath(); c.moveTo(-bw, 0.7); c.lineTo(bw, 0.7); c.lineTo(hw(5.5), 5.5); c.lineTo(-hw(5.5), 5.5); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,222,150,.6)"; c.beginPath(); c.ellipse(0, 5.5, hw(5.5), 0.3, 0, 0, TAU); c.fill();       /* la superficie del tè */
      c.fillStyle = "rgba(255,255,255,.22)"; c.fillRect(-4, 0, 8, 0.7);                                               /* il fondo spesso */
      c.fillStyle = "#e9c25c"; c.fillRect(-4, H - 1.05, 8, 0.34); c.fillRect(-4, H - 0.48, 8, 0.16);                   /* il filo d'oro, solo righe */
      c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.moveTo(-bw + 0.45, 0.9); c.lineTo(-tw + 0.5, H - 1.3); c.lineTo(-tw + 0.85, H - 1.3); c.lineTo(-bw + 0.75, 0.9); c.closePath(); c.fill();   /* il riflesso */
      c.restore();
      c.strokeStyle = dark ? "rgba(255,255,255,.55)" : "rgba(60,70,100,.4)"; c.lineWidth = 0.18; glass(); c.stroke();
      /* la menta che spunta */
      c.fillStyle = "#3f8f3f"; c.beginPath(); c.ellipse(0.75, H + 0.45, 0.62, 1.25, -0.55, 0, TAU); c.fill();
      c.fillStyle = "#6fc15a"; c.beginPath(); c.ellipse(-0.25, H + 0.6, 0.6, 1.15, 0.45, 0, TAU); c.fill();
      c.fillStyle = "#56ab4c"; c.beginPath(); c.ellipse(1.55, H + 0.05, 0.5, 1.0, -1.1, 0, TAU); c.fill();
      pawsOver(c, 2 * tw, H, hw, H * 0.2, H * 0.48);
    } else if (name === "cube") {                                   /* il cubo con i colori pastello di Imad, plastica bianca */
      var S = 5.4, d = 1.6, cs = S / 3, gp = 0.2;
      c.fillStyle = "#f7f4ee"; c.beginPath(); rr(c, -S / 2 - 0.15, -0.0, S + 0.3, S + 0.3, 0.5); c.fill();
      c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(-S / 2 - 0.15, S + 0.2); c.lineTo(S / 2 + 0.15, S + 0.2); c.lineTo(S / 2 + 0.15 + d, S + 0.2 + d); c.lineTo(-S / 2 - 0.15 + d, S + 0.2 + d); c.closePath(); c.fill();
      c.fillStyle = "#d9d4ca"; c.beginPath(); c.moveTo(S / 2 + 0.15, 0.05); c.lineTo(S / 2 + 0.15 + d, d + 0.05); c.lineTo(S / 2 + 0.15 + d, S + 0.2 + d); c.lineTo(S / 2 + 0.15, S + 0.2); c.closePath(); c.fill();
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
        c.fillStyle = KUKKO[CUBE.F[i * 3 + j]]; c.beginPath(); rr(c, -S / 2 + j * cs + gp, S - (i + 1) * cs + gp + 0.15, cs - 2 * gp, cs - 2 * gp, 0.3); c.fill();
        var u0 = j * cs, v0 = i * d / 3, x0 = -S / 2 + u0 + v0 + gp * 0.9, y0 = S + 0.2 + v0 + gp * 0.35;
        c.fillStyle = KUKKO[CUBE.U[i * 3 + j]]; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + cs - 2 * gp, y0); c.lineTo(x0 + cs - 2 * gp + d / 3 - gp * 0.7, y0 + d / 3 - gp * 0.7); c.lineTo(x0 + d / 3 - gp * 0.7, y0 + d / 3 - gp * 0.7); c.closePath(); c.fill();
        var xr = S / 2 + 0.15 + j * d / 3 + gp * 0.35, yr = S - (i + 1) * cs + j * d / 3 + gp + 0.15;
        c.fillStyle = KUKKO[CUBE.R[i * 3 + j]]; c.beginPath(); c.moveTo(xr, yr); c.lineTo(xr + d / 3 - gp * 0.7, yr + d / 3 - gp * 0.7); c.lineTo(xr + d / 3 - gp * 0.7, yr + d / 3 - gp * 0.7 + cs - 2 * gp); c.lineTo(xr, yr + cs - 2 * gp); c.closePath(); c.fill();
      }
      c.fillStyle = "rgba(40,30,60,.14)"; c.beginPath(); c.moveTo(S / 2 + 0.15, 0.05); c.lineTo(S / 2 + 0.15 + d, d + 0.05); c.lineTo(S / 2 + 0.15 + d, S + 0.2 + d); c.lineTo(S / 2 + 0.15, S + 0.2); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); rr(c, -S / 2 + 0.15, S - 0.75, S * 0.42, 0.42, 0.2); c.fill();
      pawsOver(c, S + 1 + d, S + 1.8, function (y) { return S / 2 + 0.15 + d * 0.5; }, S * 0.2, S * 0.62);
    } else if (name === "yarn") {                                   /* il gomitolo rosa, con il filo che scappa */
      var R = 3.6;
      c.strokeStyle = "#e98ea4"; c.lineWidth = 0.42; c.lineCap = "round"; c.beginPath(); c.moveTo(2.6, 1.0); c.bezierCurveTo(5.5, -0.2, 7.5, 0.5, 8.6, 0.25); c.bezierCurveTo(10, 0, 10.6, 1.4, 9.6, 1.6); c.stroke();
      c.fillStyle = g.yarn; c.beginPath(); c.arc(0, R, R, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, R, R, 0, TAU); c.clip(); c.strokeStyle = "rgba(170,70,100,.45)"; c.lineWidth = 0.26;
      for (i = 0; i < 5; i++) { c.beginPath(); c.ellipse(0.3, R - 0.2, R * 1.02, R * (0.22 + i * 0.17), -0.55, 0, TAU); c.stroke(); }
      c.strokeStyle = "rgba(255,230,236,.55)"; for (i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-0.4, R + 0.4, R * 0.95, R * (0.3 + i * 0.22), 0.9, PI * 0.9, PI * 1.6); c.stroke(); }
      c.restore();
      c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.ellipse(-1.35, R + 1.6, 0.8, 0.45, -0.6, 0, TAU); c.fill();
    } else if (name === "star") {                                   /* la stella-punto del sito: una piccola stella d'oro con il suo alone */
      var tw2 = 1 + 0.07 * Math.sin(t * 5.3), ro = 3.0 * tw2, ri = 0.95;
      c.fillStyle = g.star; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill();
      c.save(); c.rotate(0.12 * Math.sin(t * 0.9));
      c.fillStyle = dark ? "#ffd772" : "#f2b236"; c.beginPath();
      for (i = 0; i < 8; i++) { var aa = i * PI / 4, q = i % 2 ? ri : ro * (i % 4 === 0 ? 1 : 0.86); if (i === 0) c.moveTo(0, q); else c.lineTo(q * Math.sin(aa), q * Math.cos(aa)); }
      c.closePath(); c.fill();
      c.fillStyle = "rgba(255,250,230,.95)"; c.beginPath(); c.arc(-0.15, 0.15, 0.7, 0, TAU); c.fill();
      if (!dark) { c.strokeStyle = "rgba(170,110,20,.5)"; c.lineWidth = 0.16; c.beginPath(); for (i = 0; i < 8; i++) { var ab = i * PI / 4, qb = i % 2 ? ri : ro * (i % 4 === 0 ? 1 : 0.86); if (i === 0) c.moveTo(0, qb); else c.lineTo(qb * Math.sin(ab), qb * Math.cos(ab)); } c.closePath(); c.stroke(); }
      c.restore();
    } else if (name === "laptop") {                                 /* il portatile: schermo scuro, righe di codice verdi */
      c.fillStyle = "#8d93a2"; c.beginPath(); c.moveTo(-6.6, 0); c.lineTo(6.2, 0); c.lineTo(6.6, 0.75); c.lineTo(-6.9, 0.75); c.closePath(); c.fill();
      c.fillStyle = g.alu; c.beginPath(); c.moveTo(-6.9, 0.75); c.lineTo(6.6, 0.75); c.lineTo(7.5, 2.1); c.lineTo(-5.4, 2.1); c.closePath(); c.fill();
      c.fillStyle = "rgba(60,64,80,.35)"; for (i = 0; i < 5; i++) c.fillRect(-4.8 + i * 2.1, 1.25, 1.6, 0.42);
      c.fillStyle = "#b9bfcb"; c.beginPath(); c.moveTo(-5.0, 2.1); c.lineTo(7.4, 2.1); c.lineTo(8.6, 10.4); c.lineTo(-3.6, 10.4); c.closePath(); c.fill();
      c.fillStyle = "#0f1426"; c.beginPath(); c.moveTo(-4.3, 2.75); c.lineTo(6.85, 2.75); c.lineTo(7.85, 9.8); c.lineTo(-3.3, 9.8); c.closePath(); c.fill();
      var lines = [[0, 4.2], [0.8, 3.0], [0.8, 4.6], [1.6, 2.4], [0.8, 3.4], [0, 2.0]], sh = Math.floor(t * 3) % 6;
      for (i = 0; i < 6; i++) { var ln = lines[(i + sh) % 6], yy = 9.0 - i * 1.08, xx = -2.9 + (yy - 2.75) * 0.142 + ln[0]; c.fillStyle = i === 5 ? "#a8f0b0" : "#6ad07c"; c.fillRect(xx, yy - 0.42, ln[1], 0.42); }
      c.fillStyle = "rgba(255,255,255,.07)"; c.beginPath(); c.moveTo(-4.3, 9.8); c.lineTo(0.8, 9.8); c.lineTo(-2.4, 2.75); c.lineTo(-4.3, 2.75); c.closePath(); c.fill();
      pawsOver(c, 12, 3, null);
    }
    c.restore();
  }

  /* ------------------------------------------------------------------ proporzioni e pose di questo aspetto */
  var SITT = { tw: 0.6, te: -0.25, tc: 1.0 };          /* seduto: la coda sta di lato e la punta si arriccia in su */
  function withSit(o) { var k, r = {}; for (k in SITT) r[k] = SITT[k]; for (k in o) r[k] = o[k]; return r; }
  var preset = {
    props: {
      headRx: 12.6, headRy: 10.3, headDepth: 10.4,
      eye: { fwd: 8.7, up: -1.3, side: 5.25, r: 4.05 },
      ear: { fwd: -2.0, up: 6.6, side: 6.4, tipFwd: -2.8, tipUp: 15.2, tipSide: 9.4, w: 4.7 },
      nose: { fwd: 10.2, up: -3.9 }, mouth: { fwd: 9.8, up: -5.0 },
      whisk: { fwd: 8.0, up: -3.6, side: 7.6, len: 6.2 },
      fez: { fwd: -0.4, up: 9.7, h: 8.0, rBase: 4.6, rTop: 3.3, lean: -0.1, tassel: 4.4 },
      chestR: 7.6, hipR: 8.8,
      leg: { len: 11.8, r0: 3.2, r1: 2.3, paw: 2.9 },
      tail: { len: 29, r0: 2.7, r1: 1.7, n: 14 }
    },
    poses: {
      stand: { hy: 15.0, cy: 15.4 },
      sit: withSit({ dy: 10.6 }), yawn: withSit({}), bat: withSit({ dy: 9.2, hr: -0.2, f0y: 18 }),
      groom: withSit({ f0x: 9.2, f0y: 16.2, fs: 1.4, eye: 0, mouth: 0.2, hp: -0.18 }),
      hold: withSit({ fs: 0.9 }), sip: withSit({ fs: 0.9 }),
      type: withSit({ f0x: 11.2, f0y: 2.4, f1x: 10.4, f1y: 2.8 }),
      annoyed: { tw: 0.45, dy: 10.6, ear: 0.6 },
      startle: { ear: 0.35 },
      loaf: { tby: -6, te: -0.35, tc: 0.6, tw: 0.3 }, sleep: { tby: -6, te: -0.35, tc: 0.45, tw: 0.4 },
      puddle: { dx: 8.4, dy: 5.6, eye: 0.8, lid: 0.3, tby: -3, te: -0.3, tc: 0.8, tw: 0.2 },
      peek: { dy: 15.4, fs: 8.4, f0y: 0.6, f1y: 0.6 },
      drape: { hy: 5.2, cy: 5.4, sqy: 0.9, dy: 1.0, f0x: 10.4, f0y: -9.4, f2x: -2.8, f2y: -8.6, te: -1.42, tc: -0.42, lid: 0.4, hp: -0.16 },
      hang: { hx: 0, hy: -26.5, cx: 0, cy: -8.4, dx: 0.4, dy: -1.6, f0x: 0.6, f0y: 0.9, f1x: 0.6, f1y: 0.9, fs: 2.6, fo: 5.4, f2x: 0.6, f2y: -39.5, f3x: 0.6, f3y: -39.5, hs: -1.2, ho: 0.6, tby: -4, te: -1.3, tc: 0.9, tw: 0.5, eye: 1.15, hp: 0.12, ear: 0.3, sqx: 1, sqy: 1 },
      belly: { f0x: 8.4, f0y: -8, f1x: 5.6, f1y: -6.4, f2x: -5.6, f2y: -8, f3x: -8.4, f3y: -6.4, hp: 3.14, hr: 0, dx: 4, dy: -4, eye: 0.9, lid: 0.08 },   /* a pancia in su: zampe in aria, la testa all'indietro ci guarda */
      slide: { cy: -8, hy: -17, dy: 9.4, fs: 3.2, fo: 7.4, f0y: 10.5, f1y: 6.5, f2y: -22.5, f3y: -21.2, hs: 1.4, ho: 5.6, sqx: 1.0, sqy: 1.0, ear: 0.3, eye: 1.32, te: -1.35, tc: 0.55, tw: -0.5 }
    }
  };

  DOT.looks.adesivo = { label: "Adesivo", preset: preset, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
