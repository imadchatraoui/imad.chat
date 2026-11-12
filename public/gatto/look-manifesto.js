/* look-manifesto.js — l'aspetto «Manifesto» di Dot: un gatto da poster.
   Sagome nere pulite, fessure sottili di luce che staccano le zampe vicine dal corpo e tra loro, testa tonda, occhi
   verdi con l'iride sfumata e un punto di luce grande, naso piccolo, interno delle orecchie malva spento, due baffi
   per lato, coda a punto di domanda, zampe un filo più lunghe. Profondità senza 3D: zampe e orecchio lontani più
   chiari, una luce morbida da in alto a sinistra; sul fondo scuro un filo di luce solo in alto a sinistra.
   Stesso contratto di look-base.js: draw(ctx, frame, env), drawFez(ctx, fez, env), drawProp(ctx, nome, p, env).
   Non muove nulla: disegna il fotogramma. Solo ES2017, niente canvas creati a ogni fotogramma, niente shadowBlur. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var TAU = Math.PI * 2, PI = Math.PI;
  var INK = "#0a0a0d", FAR = "#272732";
  var GREEN = "#97e24f", GREEN_L = "#c4f27a", GREEN_D = "#2f8a30", PUPIL = "#050507", SHUT = "rgba(214,240,206,.9)";
  var RED = "#c8242e", RED_L = "#e0444a", RED_D = "#8e1520", RED_T = "#e2525a", TASSEL = "#16090c";
  var EAR_IN = "#4a3440", NOSE = "#c27a88", MOUTH_IN = "#4a0f1c", TONGUE = "#ff8a9c", FANG = "#f6f2ea";
  /* i due temi: luce = filo in alto a sinistra della sagoma (solo sul fondo scuro), fessura = linea tra le parti */
  var DARK = { rim: "rgba(158,178,240,.62)", rim0: "rgba(158,178,240,0)", sheen: "rgba(130,146,210,.11)", gap: "rgba(196,208,255,.5)", gap0: "rgba(196,208,255,0)", whisk: "rgba(234,240,255,.8)", pad: "rgba(214,222,255,.88)", claw: "#eef0f8" };
  var LIGHT = { rim: null, sheen: "rgba(255,255,255,.055)", gap: "rgba(255,255,255,.97)", gap0: "rgba(255,255,255,0)", whisk: "rgba(14,14,20,.82)", pad: "rgba(255,255,255,.95)", claw: "#ffffff" };
  var GAP_W = 0.42;                                               /* metà spessore della fessura, in unità */
  var last = { f: null, m: null, env: null };                    /* l'ultimo gatto disegnato: serve agli oggetti tenuti */
  var cur = { hang: false, slide: false };                       /* la situazione del fotogramma in corso */
  function rimW(env) { var k = (env && env.scale) || 2.6; return 0.9 / k + 0.08; }   /* il filo di luce: circa un pixel, a ogni grandezza */

  function theme(env) { return env && env.dark === false ? LIGHT : DARK; }
  function nrm(x, y) { var d = Math.sqrt(x * x + y * y) || 1; return [x / d, y / d]; }
  function smooth01(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  /* il riquadro che contiene il gatto: serve alla sfumatura del filo di luce */
  function bbox(f) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i, p;
    function add(x, y, r) { if (x - r < x0) x0 = x - r; if (x + r > x1) x1 = x + r; if (y - r < y0) y0 = y - r; if (y + r > y1) y1 = y + r; }
    add(f.head.x, f.head.y, f.head.rx); add(f.body.hips.x, f.body.hips.y, f.body.hips.r); add(f.body.chest.x, f.body.chest.y, f.body.chest.r);
    for (i = 0; i < 2; i++) add(f.ears[i].tx, f.ears[i].ty, 0);
    for (i = 0; i < 4; i++) add(f.legs[i].fx, f.legs[i].fy, f.legs[i].paw);
    p = f.tail.pts; for (i = 0; i < p.length; i += 3) add(p[i].x, p[i].y, p[i].r);
    return [x0, y0, x1, y1];
  }

  /* ------------------------------------------------------------------ forme di base */
  /* scafo tra due cerchi (tangenti esterne), lati appena incurvati: bow > 0 gonfia verso fuori.
     Tutti i sottopercorsi di una parte girano nello stesso verso (orario, y in alto): così il riempimento non fa buchi. */
  function hull(c, x0, y0, r0, x1, y1, r1, bowA, bowB) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= Math.abs(r0 - r1) + 0.01) { if (r0 >= r1) { c.moveTo(x0 + r0, y0); c.arc(x0, y0, r0, 0, TAU, true); } else { c.moveTo(x1 + r1, y1); c.arc(x1, y1, r1, 0, TAU, true); } return; }
    var ang = Math.atan2(dy, dx), b = Math.asin((r0 - r1) / d), aP = ang + PI / 2 + b, aM = ang - PI / 2 - b;
    var p0x = x0 + r0 * Math.cos(aP), p0y = y0 + r0 * Math.sin(aP), p1x = x1 + r1 * Math.cos(aP), p1y = y1 + r1 * Math.sin(aP);
    var q1x = x1 + r1 * Math.cos(aM), q1y = y1 + r1 * Math.sin(aM), q0x = x0 + r0 * Math.cos(aM), q0y = y0 + r0 * Math.sin(aM);
    var nx = -dy / d, ny = dx / d;
    c.moveTo(p0x, p0y);
    if (bowA) c.quadraticCurveTo((p0x + p1x) / 2 + nx * bowA, (p0y + p1y) / 2 + ny * bowA, p1x, p1y); else c.lineTo(p1x, p1y);
    c.arc(x1, y1, r1, aP, aM, true);
    if (bowB) c.quadraticCurveTo((q1x + q0x) / 2 - nx * bowB, (q1y + q0y) / 2 - ny * bowB, q0x, q0y); else c.lineTo(q0x, q0y);
    c.arc(x0, y0, r0, aM, aP - TAU, true);
    c.closePath();
  }

  /* il corpo: fianchi → petto, con la schiena un filo gonfia; se c'è la gobba (spaventato) passa per mid */
  function bodyPath(c, f, keep) {
    var b = f.body, h = b.hips, ch = b.chest, mx = (h.x + ch.x) / 2, hr = h.r, cr = ch.r;
    if (cur.hang) { hr *= 1.16; cr *= 0.86; }                     /* appeso: il peso scende in basso, una goccia morbida */
    else if (cur.slide) { hr *= 1.14; cr *= 1.1; }                 /* sul vetro: tondo e premuto */
    else if (ch.y - h.y > 4) cr *= 1.08;                          /* seduto: il petto un filo più pieno, niente collo a birillo */
    c.save(); c.translate(mx, 0); c.scale(b.sx, b.sy); c.translate(-mx, 0);
    if (!keep) c.beginPath();
    var up = (ch.x - h.x) >= 0 ? 1 : -1, bowBack = 0.9, bowBelly = cur.hang ? 0.9 : 0.35;
    if (b.mid) { var my = (h.y + ch.y) / 2, top = b.mid.y + b.mid.r - (my + (h.r + ch.r) / 2); bowBack = Math.max(0.9, top * 1.6); }
    if (cur.hang) bowBack = 0.9;
    if (up > 0) hull(c, h.x, h.y, hr, ch.x, ch.y, cr, bowBack, bowBelly); else hull(c, h.x, h.y, hr, ch.x, ch.y, cr, bowBelly, bowBack);
    c.restore();
    /* il collo: un raccordo pieno tra petto e testa (dentro la sagoma, si vede solo dove c'era una strozzatura) */
    var hd = f.head, ul = Math.sqrt(hd.u[0] * hd.u[0] + hd.u[1] * hd.u[1]) || 1, nx2 = mx + (ch.x - mx) * b.sx, ny2 = ch.y * b.sy;
    hull(c, nx2, ny2, cr * 0.9, hd.x - hd.u[0] / ul * hd.ry * 0.35, hd.y - hd.u[1] / ul * hd.ry * 0.35, Math.min(cr * 0.95, hd.ry * 0.62), 0, 0);
  }

  /* la testa: tonda, larga più che alta, guance piene e morbide in basso, mento dolce */
  function headPath(c, f, keep) {
    var h = f.head, ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul;
    var W = h.depth + (h.rx - h.depth) * Math.abs(h.fz), H = h.ry;
    c.save(); c.translate(h.x, h.y); c.transform(uy, -ux, ux, uy, 0, 0);
    if (!keep) c.beginPath(); c.moveTo(0, H);
    c.bezierCurveTo(W * 0.62, H, W * 0.97, H * 0.64, W * 0.99, H * 0.06);
    c.bezierCurveTo(W * 1.02, -H * 0.34, W * 0.9, -H * 0.72, W * 0.6, -H * 0.88);
    c.bezierCurveTo(W * 0.38, -H * 0.99, W * 0.16, -H * 0.99, 0, -H * 0.99);
    c.bezierCurveTo(-W * 0.16, -H * 0.99, -W * 0.38, -H * 0.99, -W * 0.6, -H * 0.88);
    c.bezierCurveTo(-W * 0.9, -H * 0.72, -W * 1.02, -H * 0.34, -W * 0.99, H * 0.06);
    c.bezierCurveTo(-W * 0.97, H * 0.64, -W * 0.62, H, 0, H);
    c.closePath(); c.restore();
  }
  /* l'interno dell'orecchio: un triangolo più piccolo, color malva spento */
  function earInPath(c, f, e) {
    var ex = e.tx - e.bx, ey = e.ty - e.by, el = Math.sqrt(ex * ex + ey * ey) || 1, ax = ex / el, ay = ey / el, nx = -ay, ny = ax, w = e.w * 0.52;
    var bx = e.bx + ax * 0.6 + (f.head.x - e.bx) * 0.04, by = e.by + ay * 0.6 + (f.head.y - e.by) * 0.04, tx = e.tx - ax * 2.1, ty = e.ty - ay * 2.1;
    c.beginPath(); c.moveTo(bx + nx * w, by + ny * w);
    c.quadraticCurveTo(bx + nx * w * 0.5 + ex * 0.45, by + ny * w * 0.5 + ey * 0.45, tx, ty);
    c.quadraticCurveTo(bx - nx * w * 0.5 + ex * 0.45, by - ny * w * 0.5 + ey * 0.45, bx - nx * w, by - ny * w);
    c.closePath();
  }

  /* l'orecchio: punta decisa, lati appena curvi, base affondata nella testa */
  function earPath(c, f, e) {
    var h = f.head, ex = e.tx - e.bx, ey = e.ty - e.by, el = Math.sqrt(ex * ex + ey * ey) || 1, ax = ex / el, ay = ey / el, nx = -ay, ny = ax, w = e.w;
    var bx = e.bx - ax * 2.2 + (h.x - e.bx) * 0.08, by = e.by - ay * 2.2 + (h.y - e.by) * 0.08;
    var lx = bx + nx * w * 1.1, ly = by + ny * w * 1.1, rx = bx - nx * w * 1.1, ry = by - ny * w * 1.1;
    c.moveTo(lx, ly);
    c.quadraticCurveTo(lx + ex * 0.55 + nx * w * 0.08, ly + ey * 0.55 + ny * w * 0.08, e.tx + nx * 0.35, e.ty + ny * 0.35);
    c.quadraticCurveTo(e.tx, e.ty + 0.25, e.tx - nx * 0.35, e.ty - ny * 0.35);
    c.quadraticCurveTo(rx + ex * 0.5 - nx * w * 0.22, ry + ey * 0.5 - ny * w * 0.22, rx, ry);
    c.closePath();
  }

  /* la coda: un nastro liscio che si assottiglia, punta tonda */
  function tailPath(c, f) {
    var p = f.tail.pts, n = p.length, i, L = [], R = [], tx, ty, t;
    for (i = 0; i < n; i++) {
      var a = p[i > 0 ? i - 1 : 0], b = p[i < n - 1 ? i + 1 : n - 1];
      t = nrm(b.x - a.x, b.y - a.y); tx = t[0]; ty = t[1];
      L.push([p[i].x - ty * p[i].r, p[i].y + tx * p[i].r]); R.push([p[i].x + ty * p[i].r, p[i].y - tx * p[i].r]);
    }
    var t0 = nrm(p[1].x - p[0].x, p[1].y - p[0].y), tn = nrm(p[n - 1].x - p[n - 2].x, p[n - 1].y - p[n - 2].y);
    c.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < n - 1; i++) c.quadraticCurveTo(L[i][0], L[i][1], (L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2);
    c.lineTo(L[n - 1][0], L[n - 1][1]);
    var an = Math.atan2(tn[1], tn[0]); c.arc(p[n - 1].x, p[n - 1].y, p[n - 1].r, an + PI / 2, an - PI / 2, true);
    for (i = n - 2; i > 0; i--) c.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i - 1][0]) / 2, (R[i][1] + R[i - 1][1]) / 2);
    c.lineTo(R[0][0], R[0][1]);
    var a0 = Math.atan2(t0[1], t0[0]); c.arc(p[0].x, p[0].y, p[0].r, a0 - PI / 2, a0 - 3 * PI / 2, true);
    c.closePath();
  }

  /* ------------------------------------------------------------------ zampe */
  /* geometria di una zampa: spalla/anca J, ginocchio K, caviglia A, zampa (piede) P */
  function legGeo(l, f, mode) {
    var hind = !l.front, g = { hind: hind, mode: mode };
    g.jx = l.jx; g.jy = l.jy; g.kx = l.kx; g.ky = l.ky;
    var dx = l.fx - l.kx, dy = l.fy - l.ky, d = nrm(dx, dy);
    g.rj = hind ? l.r0 * 1.5 : l.r0 * 1.02; g.rk = hind ? l.r0 * 0.82 : (l.r0 + l.r1) * 0.46; g.ra = l.r1 * 0.82;
    var dirx = f.fwd[0] >= 0 ? 1 : -1, side = Math.min(1, Math.abs(f.fwd[0]) + 0.15);
    if (mode === "ground") { g.ax = l.fx; g.ay = l.fy + l.paw * 0.78; g.px = l.fx + dirx * l.paw * 0.32 * side; g.py = l.fy + l.paw * 0.6; g.prx = l.paw * (0.92 + 0.18 * side); g.pry = l.paw * 0.64; g.pa = 0; }
    else if (mode === "edge") { g.ax = l.fx; g.ay = l.fy + 1.8; g.px = l.fx; g.py = l.fy + 0.35; g.prx = l.paw * 1.28; g.pry = l.paw * 0.9; g.pa = 0; }
    else {                                                          /* penzola, aggancia o preme sul vetro: la zampa segue la gamba */
      var big = mode === "pad" ? 1.22 : mode === "hook" || mode === "claw" ? 1.12 : 0.98;
      g.ax = l.fx - d[0] * l.paw * 0.4; g.ay = l.fy - d[1] * l.paw * 0.4; g.px = l.fx + d[0] * l.paw * 0.25; g.py = l.fy + d[1] * l.paw * 0.25;
      g.prx = l.paw * big * (mode === "dangle" ? 0.84 : 1); g.pry = l.paw * big * (mode === "dangle" ? 0.98 : 1.02); g.pa = Math.atan2(d[1], d[0]) - PI / 2;
    }
    g.dx = d[0]; g.dy = d[1];
    return g;
  }
  function legPath(c, g, noPaw) {
    hull(c, g.jx, g.jy, g.rj, g.kx, g.ky, g.rk, 0, 0);
    hull(c, g.kx, g.ky, g.rk, g.ax, g.ay, g.ra, 0, 0);
    if (!noPaw) pawShape(c, g);
  }
  /* solo i due fianchi dell'avambraccio (ginocchio → caviglia), senza le punte tonde: la fessura lungo la zampa davanti */
  function foreEdges(c, g) {
    var dx = g.ax - g.kx, dy = g.ay - g.ky, d = Math.sqrt(dx * dx + dy * dy); if (d < 0.01) return;
    var ang = Math.atan2(dy, dx), b = Math.asin(Math.max(-1, Math.min(1, (g.rk - g.ra) / d))), j, a;
    for (j = -1; j <= 1; j += 2) { a = ang + j * (PI / 2 + b); c.moveTo(g.kx + g.rk * Math.cos(a), g.ky + g.rk * Math.sin(a)); c.lineTo(g.ax + g.ra * Math.cos(a), g.ay + g.ra * Math.sin(a)); }
  }
  /* i fianchi di tutta la zampa (spalla → ginocchio → caviglia), senza i cerchi delle giunture: la fessura tra due zampe */
  function legEdges(c, g) {
    var S = [[g.jx, g.jy, g.rj, g.kx, g.ky, g.rk], [g.kx, g.ky, g.rk, g.ax, g.ay, g.ra]], q, j, a;
    for (q = 0; q < 2; q++) {
      var s = S[q], dx = s[3] - s[0], dy = s[4] - s[1], d = Math.sqrt(dx * dx + dy * dy); if (d < 0.01) continue;
      var ang = Math.atan2(dy, dx), b = Math.asin(Math.max(-1, Math.min(1, (s[2] - s[5]) / d)));
      for (j = -1; j <= 1; j += 2) { a = ang + j * (PI / 2 + b); c.moveTo(s[0] + s[2] * Math.cos(a), s[1] + s[2] * Math.sin(a)); c.lineTo(s[3] + s[5] * Math.cos(a), s[4] + s[5] * Math.sin(a)); }
    }
  }
  function pawShape(c, g) {
    c.moveTo(g.px + g.prx * Math.cos(g.pa), g.py + g.prx * Math.sin(g.pa)); c.ellipse(g.px, g.py, g.prx, g.pry, g.pa, 0, TAU, true);
    if (g.mode === "hook" || g.mode === "claw") {                   /* tre dita: si piegano sopra il bordo, o premono sul vetro */
      var ca = Math.cos(g.pa), sa = Math.sin(g.pa), i;
      for (i = -1; i <= 1; i++) { var u = i * g.prx * 0.58, v = g.pry * (0.78 - Math.abs(i) * 0.12), x = g.px + u * ca - v * sa, y = g.py + u * sa + v * ca; c.moveTo(x + g.prx * 0.36, y); c.arc(x, y, g.prx * 0.36, 0, TAU, true); }
    }
  }
  /* le dita: tagli sottili di luce; sul vetro i cuscinetti; quando si aggrappa, le unghie */
  function toes(c, g, T, env) {
    var px = (env && env.scale) || 3; if (g.prx * px < 4.2) return;
    var i, ca = Math.cos(g.pa), sa = Math.sin(g.pa);
    function P(u, v) { return [g.px + u * ca - v * sa, g.py + u * sa + v * ca]; }   /* u lungo la larghezza, v lungo la zampa */
    c.lineCap = "round";
    if (g.mode === "pad") {
      c.fillStyle = T.pad;
      var m = P(0, -g.pry * 0.18); c.beginPath(); c.ellipse(m[0], m[1], g.prx * 0.42, g.pry * 0.34, g.pa, 0, TAU); c.fill();
      for (i = -1; i <= 1; i++) { var q = P(i * g.prx * 0.5, g.pry * (0.42 - Math.abs(i) * 0.12)); c.beginPath(); c.ellipse(q[0], q[1], g.prx * 0.17, g.pry * 0.2, g.pa, 0, TAU); c.fill(); }
      c.strokeStyle = T.pad; c.lineWidth = 0.22;
      for (i = -1; i <= 1; i++) { var a = P(i * g.prx * 0.52, g.pry * 0.88), b = P(i * g.prx * 0.62, g.pry * 1.32); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      return;
    }
    c.strokeStyle = T.gap; c.lineWidth = 0.3;
    if (g.mode === "claw") {                                        /* sul vetro: dita separate da tagli di luce, unghie fuori */
      for (i = -1; i <= 1; i += 2) { var c0 = P(i * g.prx * 0.29, g.pry * 1.12), c1 = P(i * g.prx * 0.22, g.pry * 0.38); c.beginPath(); c.moveTo(c0[0], c0[1]); c.lineTo(c1[0], c1[1]); c.stroke(); }
      c.fillStyle = T.claw;
      for (i = -1; i <= 1; i++) {
        var u0 = i * g.prx * 0.6, v0 = g.pry * (1.36 - Math.abs(i) * 0.14), k0 = P(u0 - 0.2, v0 - 0.15), k1 = P(u0 + 0.2, v0 - 0.15), k2 = P(u0 + i * 0.25, v0 + 0.95);
        c.beginPath(); c.moveTo(k0[0], k0[1]); c.quadraticCurveTo(k2[0] - (k1[0] - k0[0]) * 0.4, k2[1] - (k1[1] - k0[1]) * 0.4, k2[0], k2[1]); c.lineTo(k1[0], k1[1]); c.closePath(); c.fill();
      }
      return;
    }
    if (g.mode === "hook") { for (i = -1; i <= 1; i += 2) { var h0 = P(i * g.prx * 0.29, g.pry * 1.1), h1 = P(i * g.prx * 0.25, g.pry * 0.42); c.beginPath(); c.moveTo(h0[0], h0[1]); c.lineTo(h1[0], h1[1]); c.stroke(); } return; }
    if (g.mode === "edge") { for (i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(g.px + i * g.prx * 0.3, g.py - g.pry * 0.95); c.lineTo(g.px + i * g.prx * 0.27, g.py - g.pry * 0.3); c.stroke(); } return; }
    if (g.mode === "ground" && g.prx * px > 12) { var cx = g.px + (g.px - g.ax) * 0.35; for (i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(cx + i * g.prx * 0.26, g.py - g.pry * 0.98); c.lineTo(cx + i * g.prx * 0.24, g.py - g.pry * 0.45); c.stroke(); } }
  }

  /* la fessura di luce tra una parte vicina e ciò che le sta dietro: si traccia il contorno della parte, ritagliato
     dentro la parte di dietro (clipFn), sfumato verso l'attacco (da fx0,fy0 trasparente a fx1,fy1 pieno) */
  function gap(c, T, traceFn, clipFn, fx0, fy0, fx1, fy1) {
    c.save(); clipFn(); c.clip();
    if (fx0 != null) { var gr = c.createLinearGradient(fx0, fy0, fx1, fy1); gr.addColorStop(0, T.gap0); gr.addColorStop(1, T.gap); c.strokeStyle = gr; } else c.strokeStyle = T.gap;
    c.lineWidth = GAP_W * 2; c.lineJoin = "round"; c.beginPath(); traceFn(); c.stroke();
    c.restore();
  }

  /* quale situazione: scivola sul vetro, appeso al bordo? (il fotogramma non porta il nome della posa: lo si deduce) */
  function situation(f, env) {
    var L = f.legs, b = f.body, s = { slide: false, hang: false };
    if (f.pose === "slide" || f.pose === "hang") { s[f.pose] = true; return s; }
    if (env && env.pawsOnEdge) return s;
    var hindSpread = Math.abs(L[2].fx - L[3].fx), frontUp = L[0].fy > f.head.y && L[1].fy > f.head.y;
    if (frontUp && hindSpread > 13 && L[2].fy < b.hips.y) s.slide = true;
    else if (frontUp && L[0].fy < 4 && L[0].fy > -3 && b.hips.y < -12 && f.head.y < 2) s.hang = true;
    return s;
  }
  function legMode(l, s, env) {
    if (env && env.pawsOnEdge && l.front) return "edge";
    if (s.slide) return "claw";
    if (s.hang && l.front) return "hook";
    if (l.fy < -2.5) return "dangle";
    return "ground";
  }

  /* ------------------------------------------------------------------ il fez */
  function fezShape(c, x, y, tx, ty, rB, rT, ell, top, T) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    var e0 = rB * ell, e1 = rT * ell;
    /* fianchi dritti; il feltro: più chiaro a sinistra (da dove viene la luce), più scuro a destra */
    c.beginPath(); c.moveTo(-rB, 0); c.lineTo(-rT, len);
    c.ellipse(0, len, rT, e1, 0, PI, 0, true);
    c.lineTo(rB, 0);
    c.ellipse(0, 0, rB, e0, 0, 0, -PI, true); c.closePath();
    var fg = c.createLinearGradient(-rB, 0, rB, 0); fg.addColorStop(0, RED_L); fg.addColorStop(0.32, RED); fg.addColorStop(0.7, "#b01d29"); fg.addColorStop(1, RED_D);
    c.fillStyle = fg; c.fill();
    c.save(); c.clip();
    c.fillStyle = "rgba(255,190,190,.16)"; c.beginPath(); c.moveTo(-rB * 0.62, 0); c.lineTo(-rT * 0.5, len); c.lineTo(-rT * 0.22, len); c.lineTo(-rB * 0.3, 0); c.closePath(); c.fill();   /* il lucido morbido del feltro */
    c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.ellipse(0, 0, rB * 1.05, e0 + 0.5, 0, 0, TAU); c.fill();   /* la piega del feltro sulla testa */
    c.restore();
    if (top) {
      c.fillStyle = RED_T; c.beginPath(); c.ellipse(0, len, rT, e1, 0, 0, TAU); c.fill();
      c.fillStyle = "#5a0d16"; c.beginPath(); c.ellipse(0, len, 0.62, Math.max(0.2, 0.62 * ell), 0, 0, TAU); c.fill();   /* il bottone del fiocco */
    }
    c.restore();
  }
  /* il fiocco: dal bottone in cima, il cordone corre fino al bordo sinistro della cima e pende lungo il fianco;
     finisce in un ciuffo di fili. ax, ay: asse del fez; a: angolo del pendolo (dal rig) */
  function tassel(c, x, y, ax, ay, rT, len, ell, a, T) {
    function W(lx, ly) { return [x + ay * lx + ax * ly, y - ax * lx + ay * ly]; }   /* dal fez al mondo */
    var b = W(0, len), p = W(-rT * 0.97, len - rT * ell * 0.15), L = 5.8, sx = Math.sin(a), sy = -Math.cos(a);
    var e = [p[0] + L * sx - 0.55, p[1] + L * sy], k = [p[0] + (e[0] - p[0]) * 0.42, p[1] + (e[1] - p[1]) * 0.42];
    var tx = e[0] - k[0], ty = e[1] - k[1], tl = Math.sqrt(tx * tx + ty * ty) || 1, ux = tx / tl, uy = ty / tl, nx = -uy, ny = ux;
    function tuft() { c.beginPath(); c.moveTo(k[0] + nx * 0.3, k[1] + ny * 0.3);
      c.quadraticCurveTo(e[0] + nx * 1.0 - ux * 1.6, e[1] + ny * 1.0 - uy * 1.6, e[0] + nx * 1.0, e[1] + ny * 1.0);
      c.quadraticCurveTo(e[0] + nx * 0.5 + ux * 0.45, e[1] + ny * 0.5 + uy * 0.45, e[0], e[1] + uy * 0.2);
      c.quadraticCurveTo(e[0] - nx * 0.5 + ux * 0.45, e[1] - ny * 0.5 + uy * 0.45, e[0] - nx * 1.0, e[1] - ny * 1.0);
      c.quadraticCurveTo(e[0] - nx * 1.0 - ux * 1.6, e[1] - ny * 1.0 - uy * 1.6, k[0] - nx * 0.3, k[1] - ny * 0.3); c.closePath(); }
    function cord() { c.beginPath(); c.moveTo(b[0], b[1]); c.quadraticCurveTo((b[0] + p[0]) / 2, Math.max(b[1], p[1]) + 0.3, p[0], p[1]); c.lineTo(k[0], k[1]); }
    c.lineCap = "round"; c.lineJoin = "round";
    if (T.rim) { c.save(); c.translate(-0.22, 0.16); c.strokeStyle = T.rim; c.lineWidth = 0.34; tuft(); c.stroke(); c.lineWidth = 0.7; cord(); c.stroke(); c.restore(); }   /* un filo di luce: si legge anche sul nero */
    c.strokeStyle = TASSEL; c.lineWidth = 0.44; cord(); c.stroke();
    c.fillStyle = TASSEL; tuft(); c.fill();
    c.strokeStyle = "rgba(255,130,130,.32)"; c.lineWidth = 0.15;   /* due fili che prendono luce */
    c.beginPath(); c.moveTo(k[0] + nx * 0.14 + ux * 0.4, k[1] + ny * 0.14 + uy * 0.4); c.lineTo(e[0] + nx * 0.55 - ux * 0.25, e[1] + ny * 0.55 - uy * 0.25); c.stroke();
    c.fillStyle = "#3a1218"; c.beginPath(); c.arc(k[0], k[1], 0.52, 0, TAU); c.fill();   /* il nodo */
  }
  function fezOnHead(c, f, T) {
    var z = f.fez, ax = z.tx - z.x, ay = z.ty - z.y, len = Math.sqrt(ax * ax + ay * ay) || 1;
    fezShape(c, z.x, z.y, z.tx, z.ty, z.rBase, z.rTop, z.ell, z.top, T); tassel(c, z.x, z.y, ax / len, ay / len, z.rTop, len, z.ell, z.tassel.ang, T);
  }

  /* ------------------------------------------------------------------ il muso */
  function face(c, f, T) {
    var h = f.head, ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul, i;
    var ss = (h.s[0] * uy - h.s[1] * ux) >= 0 ? 1 : -1;
    c.save(); headPath(c, f); c.clip();                          /* occhi e bocca restano dentro la testa */
    for (i = 0; i < 2; i++) {
      var e = f.eyes[i], ev = smooth01(0.42, 0.58, e.vis); if (ev < 0.02) continue;   /* l'occhio lontano: c'è o non c'è, niente fantasmi */
      var open = Math.min(1.4, e.open), wide = Math.max(0, open - 1), r = e.r * (1 + 0.22 * wide), o1 = Math.min(1, open);
      c.save(); c.globalAlpha = ev; c.translate(e.x, e.y); c.transform(uy, -ux, ux, uy, 0, 0); c.scale(e.sx, 1);
      if (o1 < 0.14) {                                              /* chiuso: un arco chiaro; felice in su, addormentato in giù */
        var cm = f.mood && f.mood.closed, bend = cm === "happy" ? 0.7 : cm === "blink" ? -0.25 : -0.62, yb = cm === "happy" ? -r * 0.18 : r * 0.04;
        c.strokeStyle = SHUT; c.lineWidth = 0.62; c.lineCap = "round";
        c.beginPath(); c.moveTo(-r * 0.84, yb); c.quadraticCurveTo(0, yb + r * bend, r * 0.84, yb); c.stroke();
        if (cm === "sleep" && r * ((last.env && last.env.scale) || 3) > 9) {   /* due ciglia piccole sull'angolo esterno */
          var ox = -e.side * ss; c.lineWidth = 0.34; c.beginPath(); c.moveTo(ox * r * 0.78, yb - r * 0.06); c.lineTo(ox * r * 1.02, yb - r * 0.32); c.stroke();
        }
      } else {
        /* palpebre: un taglio netto, inclinato quando è seccato; si disegna solo la parte aperta (niente bordi sporchi) */
        var lidY = r - 2 * r * (1 - o1) * 0.92 - r * e.lid * 0.92, inner = -e.side * ss, sl = e.brow * r * 0.55, low = -r - 0.1 + (1 - o1) * r * 0.4;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.save(); c.clip();
        c.beginPath(); c.moveTo(-r * 1.3, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.3, lidY + (inner < 0 ? sl : -sl)); c.lineTo(r * 1.3, low); c.lineTo(-r * 1.3, low); c.closePath(); c.clip();
        /* l'iride: chiara in basso (la luce entra e si accende), più scura in alto sotto la palpebra */
        var ig = c.createRadialGradient(0, -r * 0.38, r * 0.1, 0, -r * 0.1, r * 1.05); ig.addColorStop(0, GREEN_L); ig.addColorStop(0.55, GREEN); ig.addColorStop(1, GREEN_D);
        c.fillStyle = ig; c.fillRect(-r, -r, 2 * r, 2 * r);
        c.fillStyle = "rgba(10,40,10,.32)"; c.beginPath(); c.ellipse(0, r * 0.55, r * 1.1, r * 0.62, 0, 0, TAU); c.fill();   /* l'ombra della palpebra sopra */
        c.strokeStyle = GREEN_D; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();   /* bordo dell'iride */
        var pw = e.pupil.w, pr = r * (0.62 - 0.12 * wide), px = e.pupil.dx * r * 0.36, py = e.pupil.dy * r * 0.3, dot = e.pupil.dot || 0;
        var pwx = r * (0.13 + 0.42 * pw) * (1 - 0.25 * wide), pry = pr * (1 - dot) + pwx * 1.05 * dot;
        c.fillStyle = "rgba(20,70,20,.55)"; c.beginPath(); c.ellipse(px, py, pwx + r * 0.16, pry + r * 0.12, 0, 0, TAU); c.fill();   /* l'anello scuro attorno alla pupilla */
        c.fillStyle = PUPIL; c.beginPath(); c.ellipse(px, py, pwx, pry, 0, 0, TAU); c.fill();
        c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(px - r * 0.32, py + r * 0.34, r * 0.25, r * 0.22, 0, 0, TAU); c.fill();   /* il punto di luce, grande */
        c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(px + r * 0.3, py - r * 0.34, r * 0.09, 0, TAU); c.fill();
        if (o1 < 0.98 || e.lid > 0.02) { c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(-r * 1.3, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.3, lidY + (inner < 0 ? sl : -sl)); c.stroke(); }   /* l'ombra della palpebra */
        c.restore();
      }
      c.restore();
    }
    /* il naso: un piccolo triangolo morbido, rosa spento */
    if (f.nose.vis > 0.25) {
      c.save(); c.globalAlpha = smooth01(0.25, 0.55, f.nose.vis); c.translate(f.nose.x, f.nose.y); c.transform(uy, -ux, ux, uy, 0, 0);
      c.fillStyle = NOSE; c.beginPath(); c.moveTo(-0.95, 0.42); c.quadraticCurveTo(0, 0.72, 0.95, 0.42); c.quadraticCurveTo(0.55, -0.3, 0, -0.62); c.quadraticCurveTo(-0.55, -0.3, -0.95, 0.42); c.fill();
      c.restore();
    }
    /* la bocca: solo quando miagola o sbadiglia; aperta davvero, con i canini e la lingua */
    if (f.mouth.vis > 0.3 && f.mouth.open > 0.06) {
      var mo = f.mouth.open; c.save(); c.globalAlpha = f.mouth.vis; c.translate(f.mouth.x, f.mouth.y); c.transform(uy, -ux, ux, uy, 0, 0);
      var mw = 1.3 + 0.85 * mo, mh = 0.7 + 2.9 * mo;
      c.beginPath(); c.moveTo(-mw, 0.1); c.quadraticCurveTo(-mw * 0.5, 0.42, 0, 0.02); c.quadraticCurveTo(mw * 0.5, 0.42, mw, 0.1);
      c.bezierCurveTo(mw * 0.98, -mh * 0.72, mw * 0.5, -mh, 0, -mh); c.bezierCurveTo(-mw * 0.5, -mh, -mw * 0.98, -mh * 0.72, -mw, 0.1); c.closePath();
      c.fillStyle = MOUTH_IN; c.fill();
      c.save(); c.clip();
      c.fillStyle = TONGUE; c.beginPath(); c.ellipse(0, -mh * 0.98, mw * 0.66, mh * 0.42, 0, 0, TAU); c.fill();
      c.strokeStyle = "rgba(170,50,70,.6)"; c.lineWidth = 0.16; c.beginPath(); c.moveTo(0, -mh * 0.62); c.lineTo(0, -mh * 0.9); c.stroke();
      c.restore();
      if (mo > 0.2) {                                               /* i due canini, piccoli */
        var fl = Math.min(1.05, 0.3 + mh * 0.26); c.fillStyle = FANG;
        for (var j = -1; j <= 1; j += 2) { var fx = j * mw * 0.52; c.beginPath(); c.moveTo(fx - j * 0.34, 0.2); c.lineTo(fx + j * 0.3, 0.16); c.quadraticCurveTo(fx + j * 0.12, -fl * 0.6, fx + j * 0.04, -fl); c.closePath(); c.fill(); }
      }
      c.restore();
    }
    c.restore();
    /* i baffi: due per lato, sottili, appena curvi */
    c.strokeStyle = T.whisk; c.lineWidth = 0.3; c.lineCap = "round";
    for (i = 0; i < 2; i++) {
      var w = f.whiskers[i]; if (w.vis < 0.05) continue; c.globalAlpha = w.vis;
      for (var k = 0; k < 2; k++) {
        var a = (k ? -0.16 : 0.1), ca = Math.cos(a), sa = Math.sin(a), dx = w.dx * ca - w.dy * sa, dy = w.dx * sa + w.dy * ca, L = w.len * (k ? 0.92 : 1), oy = k ? -0.55 : 0.2;
        var x0 = w.x + ux * oy, y0 = w.y + uy * oy;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + dx * L * 0.55, y0 + dy * L * 0.55 + uy * 0.25, x0 + dx * L, y0 + dy * L - uy * 0.45); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ il gatto */
  function draw(c, f, env) {
    env = env || {}; var T = theme(env), i, l, g, s = situation(f, env), G = [], RW = rimW(env);
    cur = s;
    last.f = f; last.env = env; last.m = c.getTransform ? c.getTransform() : null;
    for (i = 0; i < 4; i++) G.push(legGeo(f.legs[i], f, legMode(f.legs[i], s, env)));
    var ears = f.ears.slice().sort(function (a, b) { return a.depth - b.depth; });
    function shown(i) { var L = f.legs[i]; return L.tuck < 0.95 && !(env.pawsOnEdge && L.front); }
    function upFront(L) { return L.up && !s.hang && !s.slide; }      /* appeso o sul vetro le braccia escono da dietro la testa */

    /* ombra a terra: un'ellisse sfumata */
    if (env.shadow && env.shadow.k > 0.01) {
      c.save(); c.translate(0, env.shadow.y); c.scale(1, 0.14);
      var sg = c.createRadialGradient(0, 0, 0, 0, 0, 20), sk = (env.dark === false ? 0.32 : 0.5) * env.shadow.k;
      sg.addColorStop(0, "rgba(0,0,10," + sk.toFixed(3) + ")"); sg.addColorStop(0.6, "rgba(0,0,10," + (sk * 0.45).toFixed(3) + ")"); sg.addColorStop(1, "rgba(0,0,10,0)");
      c.fillStyle = sg; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill(); c.restore();
    }
    c.save();
    if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); }
    else if (env.shadow && Math.cos(f.roll || 0) < -0.3) { c.beginPath(); c.rect(-500, -0.5, 1000, 1000); c.clip(); }   /* a pancia in su: le orecchie si schiacciano a terra, non la bucano */
    var BB = bbox(f);

    /* 1. il filo di luce (solo sul fondo scuro): tratto spostato in alto a sinistra e sfumato verso il basso a destra,
       così c'è solo dove arriva la luce e non diventa un contorno */
    if (T.rim) {
      c.save(); c.translate(-RW * 0.62, RW * 0.62);
      var rg = c.createLinearGradient(BB[0], BB[3], BB[2], BB[1]); rg.addColorStop(0, T.rim); rg.addColorStop(0.38, T.rim); rg.addColorStop(0.78, T.rim0); rg.addColorStop(1, T.rim0);
      c.strokeStyle = rg; c.lineWidth = RW * 1.7; c.lineJoin = "round";
      c.beginPath(); tailPath(c, f); c.stroke();
      for (i = 0; i < 4; i++) if (shown(i)) { c.beginPath(); legPath(c, G[i]); c.stroke(); }
      bodyPath(c, f); c.stroke();
      for (i = 0; i < 2; i++) { c.beginPath(); earPath(c, f, ears[i]); c.stroke(); }
      headPath(c, f); c.stroke();
      c.restore();
    }

    /* 2. le parti, da dietro in avanti; ogni zampa vicina ha la sua fessura contro tutto ciò che sta già sotto */
    var under = [];                                                 /* le zampe già disegnate */
    function legsPath() { c.beginPath(); for (var j = 0; j < under.length; j++) legPath(c, under[j]); }
    c.fillStyle = INK; if (!f.tail.front) { c.beginPath(); tailPath(c, f); c.fill(); }
    c.fillStyle = FAR; for (i = 0; i < 4; i++) if (!f.legs[i].near && !upFront(f.legs[i]) && shown(i)) { c.beginPath(); legPath(c, G[i]); c.fill(); under.push(G[i]); }
    c.fillStyle = INK; bodyPath(c, f); c.fill();
    for (i = 0; i < 4; i++) {
      l = f.legs[i]; if (!l.near || upFront(l) || !shown(i)) continue; g = G[i];
      if (l.front) gap(c, T, foreEdges.bind(null, c, g), bodyPath.bind(null, c, f), g.kx, g.ky, g.kx + (g.ax - g.kx) * 0.5, g.ky + (g.ay - g.ky) * 0.5);
      else if (!s.hang) gap(c, T, legPath.bind(null, c, g, true), bodyPath.bind(null, c, f), g.jx, g.jy, g.jx + (g.kx - g.jx) * 0.7, g.jy + (g.ky - g.jy) * 0.7);
      if (under.length) gap(c, T, legEdges.bind(null, c, g), legsPath, g.jx, g.jy, (g.jx + g.kx) / 2, (g.jy + g.ky) / 2);   /* le due zampe davanti restano due */
      c.fillStyle = INK; c.beginPath(); legPath(c, g); c.fill(); toes(c, g, T, env); under.push(g);
    }
    if (f.tail.front) {
      var tp = f.tail.pts, t0 = tp[0], t1 = tp[Math.min(4, tp.length - 1)];
      gap(c, T, tailPath.bind(null, c, f), bodyPath.bind(null, c, f), t0.x, t0.y, t1.x, t1.y);
      gap(c, T, tailPath.bind(null, c, f), function () { c.beginPath(); for (var j = 0; j < 4; j++) if (f.legs[j].near && shown(j)) legPath(c, G[j]); }, null);
      c.fillStyle = INK; c.beginPath(); tailPath(c, f); c.fill();
    }
    /* la luce morbida sul corpo, da in alto a sinistra: dà volume senza diventare plastica */
    var shR = Math.max(BB[2] - BB[0], BB[3] - BB[1]) * 0.75;
    function sheen(pathFn, x, y, r) { c.save(); pathFn(); c.clip(); var sg2 = c.createRadialGradient(x, y, 0, x, y, r); sg2.addColorStop(0, T.sheen); sg2.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = sg2; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); }
    sheen(function () { bodyPath(c, f); }, BB[0] + (BB[2] - BB[0]) * 0.25, BB[3] - (BB[3] - BB[1]) * 0.3, shR);
    var farEar = ears[1].depth - ears[0].depth > 1.2;
    c.fillStyle = farEar ? FAR : INK; c.beginPath(); earPath(c, f, ears[0]); c.fill();
    c.fillStyle = INK; c.beginPath(); earPath(c, f, ears[1]); c.fill();
    if (f.head.fz > 0.15) for (i = 0; i < 2; i++) {                 /* l'interno delle orecchie, quando le vediamo davanti */
      c.save(); c.globalAlpha = smooth01(0.15, 0.5, f.head.fz) * (i === 0 && farEar ? 0.75 : 1); c.fillStyle = EAR_IN; earInPath(c, f, ears[i]); c.fill(); c.restore();
    }
    headPath(c, f); c.fill();
    sheen(function () { headPath(c, f); }, f.head.x - f.head.rx * 0.5, f.head.y + f.head.ry * 0.55, f.head.rx * 1.25);
    face(c, f, T);
    if (f.fez) fezOnHead(c, f, T);
    if (s.hang || s.slide) for (i = 0; i < 2; i++) {                /* appeso o sul vetro: le braccia dietro la testa, le zampe davanti a tutto */
      g = G[i]; if (!shown(i)) continue;
      if (T.rim) { c.save(); c.translate(-RW * 0.62, RW * 0.62); c.strokeStyle = T.rim; c.lineWidth = RW * 1.7; c.beginPath(); pawShape(c, g); c.stroke(); c.restore(); }
      gap(c, T, pawShape.bind(null, c, g), headPath.bind(null, c, f), null);
      c.fillStyle = INK; c.beginPath(); pawShape(c, g); c.fill(); toes(c, g, T, env);
    }
    for (i = 0; i < 4; i++) {                                       /* le zampe alzate stanno davanti alla testa */
      l = f.legs[i]; if (!upFront(l) || !shown(i)) continue; g = G[i];
      gap(c, T, legPath.bind(null, c, g), headPath.bind(null, c, f), g.jx, g.jy, g.kx, g.ky);
      gap(c, T, foreEdges.bind(null, c, g), bodyPath.bind(null, c, f), g.kx, g.ky, g.ax, g.ay);
      c.fillStyle = l.near ? INK : FAR; c.beginPath(); legPath(c, g); c.fill(); toes(c, g, T, env);
    }
    c.restore();

    /* 3. sul bordo: le due zampe davanti appoggiate, sopra tutto e senza ritaglio */
    if (env.pawsOnEdge) for (i = 0; i < 2; i++) {
      g = G[i];
      if (T.rim) { c.save(); c.translate(-RW * 0.62, RW * 0.62); c.strokeStyle = T.rim; c.lineWidth = RW * 1.7; c.beginPath(); c.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU); c.stroke(); c.restore(); }
      gap(c, T, function () { c.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU); }, function () { if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); } headPath(c, f); }, null);
      c.fillStyle = INK; c.beginPath(); c.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU); c.fill(); toes(c, g, T, env);
    }
  }

  /* il fez quando non è in testa: origine al centro della base, dritto */
  function drawFez(c, fz, env) {
    var T = theme(env), a = fz.tasselAng || 0, h = fz.h, rT = fz.rTop, ell = fz.ell == null ? 0.22 : fz.ell;
    fezShape(c, 0, 0, 0, h, fz.rBase, rT, ell, fz.top !== false, T);
    tassel(c, 0, 0, 0, 1, rT, h, ell, a, T);
  }

  /* ------------------------------------------------------------------ gli oggetti di Dot */
  var KUKKO = ["#ffb6c1", "#fdfd96", "#ffb347", "#77dd77", "#aec6cf", "#ff6961"];
  function quad(c, a, b, cc, d) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(d[0], d[1]); c.closePath(); }
  function stickers(c, o, u, v, cols, dim) {                       /* una faccia 3x3: o angolo, u e v i due lati */
    var i, j, g = 0.09;
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
      var a0 = (j + g) / 3, a1 = (j + 1 - g) / 3, b0 = (i + g) / 3, b1 = (i + 1 - g) / 3;
      function P(a, b) { return [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b]; }
      c.fillStyle = cols[i * 3 + j]; quad(c, P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)); c.fill();
      if (dim) { c.fillStyle = dim; c.fill(); }
    }
  }

  /* le zampe davanti sopra l'oggetto, se ci stanno sopra: così lo tengono davvero */
  function pawsOver(c, bx0, by0, bx1, by1, env, fore) {
    var f = last.f, m1 = last.m; if (!f || !m1 || !c.getTransform) return;
    var m2 = c.getTransform(), det = m2.a * m2.d - m2.b * m2.c; if (Math.abs(det) < 1e-9) return;
    var T = theme(env), s = situation(f, last.env), i, hit = [], g;
    for (i = 0; i < 2; i++) {
      g = legGeo(f.legs[i], f, legMode(f.legs[i], s, env));
      /* dal modello del gatto all'oggetto: P_oggetto = m2^-1 · m1 · P */
      var X = m1.a * g.px + m1.c * g.py + m1.e - m2.e, Y = m1.b * g.px + m1.d * g.py + m1.f - m2.f;
      var lx = (m2.d * X - m2.c * Y) / det, ly = (-m2.b * X + m2.a * Y) / det;
      if (lx > bx0 - 1.2 && lx < bx1 + 1.2 && ly > by0 - 1.2 && ly < by1 + 1.2 && f.legs[i].tuck < 0.95) hit.push([i, g]);
    }
    if (!hit.length) return;
    c.save(); c.setTransform(m1.a, m1.b, m1.c, m1.d, m1.e, m1.f);
    for (i = 0; i < hit.length; i++) {
      g = hit[i][1]; var L = f.legs[hit[i][0]];
      if (!fore) { g.prx *= 0.82; g.pry *= 0.92; g.pa = Math.atan2(g.dy, g.dx) - PI / 2; }   /* chi tiene: la zampa si chiude attorno */
      var sx = g.kx + (g.ax - g.kx) * (fore ? 0.35 : 0.7), sy = g.ky + (g.ay - g.ky) * (fore ? 0.35 : 0.7), sr = g.rk + (g.ra - g.rk) * (fore ? 0.35 : 0.7);
      function tr() { hull(c, sx, sy, sr, g.ax, g.ay, g.ra, 0, 0); pawShape(c, g); }
      if (T.rim) { var rw2 = rimW(last.env); c.save(); c.translate(-rw2 * 0.62, rw2 * 0.62); c.strokeStyle = T.rim; c.lineWidth = rw2 * 1.7; c.beginPath(); tr(); c.stroke(); c.restore(); }
      c.fillStyle = L.near ? INK : FAR; c.beginPath(); tr(); c.fill(); toes(c, g, T, last.env);
    }
    c.restore();
  }

  function drawProp(c, name, p, env) {
    p = p || {}; env = env || last.env || {}; var T = theme(env), dark = env.dark !== false, t = p.t || 0, i;
    var PS = name === "tea" ? 1.3 : name === "cube" ? 1.22 : name === "yarn" ? 1.15 : name === "laptop" ? 1.08 : 1;
    c.save(); c.scale(PS, PS);
    if (name === "tea") {                                           /* il bicchiere di tè alla menta, con il filo d'oro */
      var bw = 1.75, tw = 2.65, H = 6.8;
      function glass() { c.beginPath(); c.moveTo(-bw, 0); c.lineTo(bw, 0); c.quadraticCurveTo(tw * 0.92, H * 0.45, tw, H); c.lineTo(-tw, H); c.quadraticCurveTo(-tw * 0.92, H * 0.45, -bw, 0); c.closePath(); }
      /* vapore */
      c.strokeStyle = dark ? "rgba(230,236,255,.42)" : "rgba(110,120,150,.42)"; c.lineWidth = 0.32; c.lineCap = "round";
      for (i = 0; i < 2; i++) { var ph = t * 1.3 + i * 2.1, x0 = (i ? 0.9 : -0.7), y0 = H + 1.1; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + 1.1 * Math.sin(ph), y0 + 1.6, x0 - 1.1 * Math.sin(ph + 1), y0 + 3.2, x0 + 0.5 * Math.sin(ph + 2), y0 + 4.6 + i * 0.6); c.stroke(); }
      c.save(); glass(); c.clip();
      c.fillStyle = dark ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.62)"; c.fillRect(-4, -1, 8, H + 2);
      c.fillStyle = "#c97e22"; c.beginPath(); c.moveTo(-bw, 0.45); c.lineTo(bw, 0.45); c.lineTo(tw * 0.97, H * 0.7); c.lineTo(-tw * 0.97, H * 0.7); c.closePath(); c.fill();
      c.fillStyle = "#e3a443"; c.beginPath(); c.ellipse(0, H * 0.7, tw * 0.97, 0.42, 0, 0, TAU); c.fill();
      c.fillStyle = "#e6b54a"; c.fillRect(-4, H * 0.78, 8, 0.42); c.fillRect(-4, H * 0.9, 8, 0.22);   /* il filo d'oro */
      c.fillStyle = dark ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.8)"; c.fillRect(-tw * 0.7, H * 0.12, 0.42, H * 0.6);   /* un riflesso */
      c.fillStyle = dark ? "rgba(255,255,255,.22)" : "rgba(160,170,200,.35)"; c.fillRect(-4, 0, 8, 0.45);
      c.restore();
      /* la menta che spunta */
      c.fillStyle = "#3f9a47"; c.beginPath(); c.ellipse(0.7, H + 0.5, 0.75, 1.45, -0.5, 0, TAU); c.fill();
      c.fillStyle = "#5fbf5c"; c.beginPath(); c.ellipse(1.6, H + 0.05, 0.6, 1.2, -1.05, 0, TAU); c.fill(); c.beginPath(); c.ellipse(-0.1, H + 0.15, 0.55, 1.05, 0.45, 0, TAU); c.fill();
      c.strokeStyle = dark ? "rgba(255,255,255,.6)" : "rgba(60,70,100,.45)"; c.lineWidth = 0.22; glass(); c.stroke();
      pawsOver(c, -tw, 0, tw, H, env, false);
    } else if (name === "cube") {                                   /* il cubo di Imad, colori Kukko, un po' mescolato */
      var s = 5.6, dx = 1.9, dy = 1.35, x0c = -(s + dx) / 2;
      var o = [x0c, 0], F1 = [x0c + s, 0], F2 = [x0c + s, s], F3 = [x0c, s], R1 = [x0c + s + dx, dy], R2 = [x0c + s + dx, s + dy], U3 = [x0c + dx, s + dy];
      c.fillStyle = "#f3efe6"; quad(c, o, F1, F2, F3); c.fill();
      c.fillStyle = "#d9d3c6"; quad(c, F1, R1, R2, F2); c.fill();
      c.fillStyle = "#ffffff"; quad(c, F3, F2, R2, U3); c.fill();
      var mix = [2, 0, 5, 3, 2, 1, 4, 3, 2], mixR = [3, 3, 1, 5, 3, 0, 3, 2, 3], mixU = [0, 4, 0, 2, 0, 0, 1, 0, 5];
      stickers(c, o, [s, 0], [0, s], mix.map(function (k) { return KUKKO[k]; }), null);
      stickers(c, F1, [dx, dy], [0, s], mixR.map(function (k) { return KUKKO[k]; }), "rgba(40,30,20,.14)");
      stickers(c, F3, [s, 0], [dx, dy], mixU.map(function (k) { return KUKKO[k]; }), "rgba(255,255,255,.12)");
      pawsOver(c, x0c, 0, x0c + s + dx, s + dy, env, false);
    } else if (name === "yarn") {                                   /* il gomitolo, con il filo che scappa */
      var r = 3.5; c.strokeStyle = "#e3765c"; c.lineWidth = 0.42; c.lineCap = "round";
      c.beginPath(); c.moveTo(2.4, 0.9); c.bezierCurveTo(5, -0.1, 6.6, 1.6, 8.4, 0.35); c.bezierCurveTo(9.6, -0.4, 10.6, 0.8, 11.6, 0.3); c.stroke();
      c.fillStyle = "#e3765c"; c.beginPath(); c.arc(0, r, r, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, r, r, 0, TAU); c.clip();
      c.strokeStyle = "#b9533f"; c.lineWidth = 0.34;
      for (i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, r, r * 1.02, r * (0.28 + i * 0.2), 0.7 + i * 0.05, 0, TAU); c.stroke(); }
      c.strokeStyle = "#f29a82"; for (i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0.2, r + 0.2, r * 0.95, r * (0.35 + i * 0.22), -0.9, PI * 0.9, PI * 1.6); c.stroke(); }
      c.restore();
    } else if (name === "star") {                                   /* la stella-punto: luce d'oro, una croce che scintilla */
      var gl = c.createRadialGradient(0, 0, 0, 0, 0, 6); gl.addColorStop(0, dark ? "rgba(255,220,140,.75)" : "rgba(240,170,50,.55)"); gl.addColorStop(0.35, dark ? "rgba(245,180,70,.28)" : "rgba(240,170,50,.18)"); gl.addColorStop(1, "rgba(245,180,70,0)");
      c.fillStyle = gl; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
      var tw2 = 1 + 0.18 * Math.sin(t * 5.3), rr = 2.6 * tw2;
      c.fillStyle = dark ? "#ffd772" : "#efad2e"; c.beginPath();
      for (i = 0; i < 8; i++) { var aa = i * PI / 4 + 0.1 * Math.sin(t), q = i % 2 ? 0.55 : rr; c.lineTo(q * Math.cos(aa + PI / 2), q * Math.sin(aa + PI / 2)); }
      c.closePath(); c.fill();
      c.fillStyle = "#fff7dc"; c.beginPath(); c.arc(0, 0, 0.62, 0, TAU); c.fill();
    } else if (name === "laptop") {                                 /* il portatile: piano, schermo con il codice che scorre */
      var met = dark ? "#c9ccd6" : "#b4b8c4", met2 = dark ? "#9ea2ae" : "#8f94a2";
      c.fillStyle = met2; c.fillRect(-7, 0, 12.2, 0.75);
      c.fillStyle = met; quad(c, [-7, 0.75], [5.2, 0.75], [7.2, 2.9], [-5, 2.9]); c.fill();
      c.fillStyle = met2; quad(c, [-6.1, 1.0], [4.2, 1.0], [5.6, 2.55], [-4.7, 2.55]); c.fill();
      c.fillStyle = met; quad(c, [-5, 2.9], [7.2, 2.9], [8.1, 11.2], [-4.1, 11.2]); c.fill();
      c.fillStyle = "#11152c"; quad(c, [-4.3, 3.55], [6.5, 3.55], [7.3, 10.55], [-3.5, 10.55]); c.fill();
      c.save(); quad(c, [-4.3, 3.55], [6.5, 3.55], [7.3, 10.55], [-3.5, 10.55]); c.clip();
      var off = (t * 2.2) % 1.25, LW = [4.2, 2.6, 5.4, 3.2, 1.8, 4.6, 3.8, 2.2], LX = [0, 0.8, 0.8, 1.6, 0.8, 0, 0.8, 1.6];
      for (i = 0; i < 8; i++) { var yy = 4.1 + i * 1.25 - off - 1.25; if (yy < 3.3 || yy > 10.6) continue; var sh = (yy - 3.55) * 0.114; c.fillStyle = i === 3 ? "#ffb6c1" : i === 6 ? "#aec6cf" : "#7ee08a"; c.fillRect(-3.4 + sh + LX[i], yy, LW[i], 0.42); }
      c.restore();
      pawsOver(c, -7, 0, 7.2, 3.6, env, true);
    }
    c.restore();
  }

  /* ------------------------------------------------------------------ proporzioni e pose del manifesto */
  var SITX = { hy: 8.8, cy: 16, dy: 10.4, tw: 1.3, te: -0.25, tc: 0.5, fs: 0.7 };
  function withSit(o) { var k, r = {}; for (k in SITX) r[k] = SITX[k]; for (k in o) r[k] = o[k]; return r; }
  var preset = {
    props: {
      headRx: 12.4, headRy: 9.5, headDepth: 9.8,
      eye: { fwd: 8.2, up: -0.4, side: 5.0, r: 3.85 },
      ear: { fwd: -1.2, up: 6.0, side: 6.0, tipFwd: -1.8, tipUp: 14.6, tipSide: 9.2, w: 4.7 },
      nose: { fwd: 9.8, up: -3.0 }, mouth: { fwd: 9.4, up: -4.2 },
      whisk: { fwd: 8.0, up: -2.9, side: 7.0, len: 7.2 },
      fez: { fwd: -1.4, up: 8.3, h: 7.8, rBase: 4.8, rTop: 3.6, lean: -0.14, tassel: 6.6 },
      chestR: 7.0, hipR: 8.6,
      leg: { len: 12.2, r0: 3.15, r1: 2.25, paw: 2.8 },
      tail: { len: 27, r0: 2.5, r1: 1.95, n: 15 }
    },
    poses: {
      /* la coda sale e si piega a punto di domanda: resta dentro il riquadro invece di uscire di lato */
      stand: { hy: 15.4, cy: 15.8, te: 0.5, tc: 1.05 },
      crouch: { te: 0.22, tc: 0.95 },
      wiggle: { te: 0.55, tc: 0.7 },
      stretch: { te: 0.72, tc: 0.95 },
      startle: { te: 0.9, tc: 0.85 },
      air: { tc: 0.65 },
      puddle: { te: 0.1, tc: 0.85 },
      sit: withSit({}),
      yawn: withSit({}), annoyed: withSit({}), groom: withSit({}), bat: withSit({}),
      hold: withSit({ fs: 1.6, f0x: 7.6, f1x: 6.8 }), sip: withSit({ fs: 1.3 }),
      type: withSit({ f0y: 2.2, f1y: 2.8 }),
      peek: { fs: 10.2 },
      drape: { f0x: 10.6, f0y: -10.6, f2x: -2.6, f2y: -9.6, te: -1.42, tc: 0.55 },
      /* appeso: le braccia tese in su, larghe, fuori dalla testa; la testa tra le braccia, sotto il bordo;
         il corpo che pende come una goccia, le zampe dietro a penzoloni */
      hang: { hx: 0, hy: -24, cx: 0, cy: -5, dx: 0.3, dy: -4.6, f0x: 0.6, f0y: 0.9, f1x: 0.6, f1y: 0.9, fs: 4, fo: 7.4, f2x: 0.6, f2y: -36.5, f3x: 0.6, f3y: -36, hs: -1.2, ho: 0.8, tby: -4, te: -1.3, tc: 0.95, tw: 0.5, eye: 1.15, hp: 0.12, ear: 0.3, sqx: 1, sqy: 1 },
      /* scivola (come il disegno 06): braccia su, larghe e a quote diverse, unghie fuori; la testa un filo storta,
         il corpo tondo premuto sul vetro, le zampe dietro piegate e aperte, la coda che esce sotto */
      slide: { hx: 0, hy: -11, cx: 0, cy: 5.5, dx: 0.4, dy: 1.6, f0x: 0.8, f0y: 12.2, f1x: 0.8, f1y: 8.9, fs: 4, fo: 6.6, f2x: 0.8, f2y: -18.5, f3x: 0.8, f3y: -17.6, hs: 1.2, ho: 4.6, tby: -5, te: -1.2, tc: 0.9, tw: -0.6, hr: -0.14, sqx: 1.08 }
    }
  };

  DOT.looks.manifesto = { label: "Manifesto", preset: preset, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
