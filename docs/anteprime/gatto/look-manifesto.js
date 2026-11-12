/* look-manifesto.js — l'aspetto «Manifesto» di Dot: un gatto da poster.
   Sagome nere piatte e pulite, fessure sottili di luce che staccano le zampe vicine dal corpo, occhi verdi decisi
   (disco verde, pupilla nera, un punto di luce), pochi dettagli (niente naso, due baffi per lato), coda lunga ed
   elegante, zampe un filo più lunghe. Sul fondo scuro un filo di luce attorno alla sagoma, più forte in alto a sinistra.
   Stesso contratto di look-base.js: draw(ctx, frame, env), drawFez(ctx, fez, env), drawProp(ctx, nome, p, env).
   Non muove nulla: disegna il fotogramma. Solo ES2017, niente canvas creati a ogni fotogramma, niente shadowBlur. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var TAU = Math.PI * 2, PI = Math.PI;
  var INK = "#0a0a0d", FAR = "#1b1b23";
  var GREEN = "#97e24f", GREEN_D = "#3c9a36", PUPIL = "#050507";
  var RED = "#c8242e", RED_D = "#9b1824", RED_T = "#e04850", TASSEL = "#141016";
  /* i due temi: luce = filo attorno alla sagoma (solo sul fondo scuro), fessura = linea tra le parti */
  var DARK = { rim: "rgba(158,178,240,.55)", gap: "rgba(196,208,255,.5)", gap0: "rgba(196,208,255,0)", whisk: "rgba(234,240,255,.8)", pad: "rgba(214,222,255,.88)" };
  var LIGHT = { rim: null, gap: "rgba(255,255,255,.97)", gap0: "rgba(255,255,255,0)", whisk: "rgba(14,14,20,.82)", pad: "rgba(255,255,255,.95)" };
  var GAP_W = 0.42;                                               /* metà spessore della fessura, in unità */
  var last = { f: null, m: null, env: null };                    /* l'ultimo gatto disegnato: serve agli oggetti tenuti */
  var cur = { hang: false, slide: false };                       /* la situazione del fotogramma in corso */
  function rimW(env) { var k = (env && env.scale) || 2.6; return 0.9 / k + 0.08; }   /* il filo di luce: circa un pixel, a ogni grandezza */

  function theme(env) { return env && env.dark === false ? LIGHT : DARK; }
  function nrm(x, y) { var d = Math.sqrt(x * x + y * y) || 1; return [x / d, y / d]; }

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
  function bodyPath(c, f) {
    var b = f.body, h = b.hips, ch = b.chest, mx = (h.x + ch.x) / 2, hr = h.r, cr = ch.r;
    if (cur.hang) { hr *= 1.16; cr *= 0.86; }                     /* appeso: il peso scende in basso, una goccia morbida */
    c.save(); c.translate(mx, 0); c.scale(b.sx, b.sy); c.translate(-mx, 0);
    c.beginPath();
    var up = (ch.x - h.x) >= 0 ? 1 : -1, bowBack = 0.9, bowBelly = cur.hang ? 0.9 : 0.35;
    if (b.mid) { var my = (h.y + ch.y) / 2, top = b.mid.y + b.mid.r - (my + (h.r + ch.r) / 2); bowBack = Math.max(0.9, top * 1.6); }
    if (cur.hang) bowBack = 0.9;
    if (up > 0) hull(c, h.x, h.y, hr, ch.x, ch.y, cr, bowBack, bowBelly); else hull(c, h.x, h.y, hr, ch.x, ch.y, cr, bowBelly, bowBack);
    c.restore();
  }

  /* la testa: larga più che alta, cranio pieno, guance con un piccolo ciuffo, mento morbido */
  function headPath(c, f) {
    var h = f.head, ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul;
    var W = h.depth + (h.rx - h.depth) * Math.abs(h.fz), H = h.ry;
    c.save(); c.translate(h.x, h.y); c.transform(uy, -ux, ux, uy, 0, 0);
    c.beginPath(); c.moveTo(0, H);
    c.bezierCurveTo(W * 0.58, H, W * 0.97, H * 0.74, W * 1.0, H * 0.1);
    c.quadraticCurveTo(W * 1.03, -H * 0.18, W * 1.08, -H * 0.36);
    c.bezierCurveTo(W * 0.9, -H * 0.78, W * 0.52, -H * 0.98, 0, -H * 0.98);
    c.bezierCurveTo(-W * 0.52, -H * 0.98, -W * 0.9, -H * 0.78, -W * 1.08, -H * 0.36);
    c.quadraticCurveTo(-W * 1.03, -H * 0.18, -W * 1.0, H * 0.1);
    c.bezierCurveTo(-W * 0.97, H * 0.74, -W * 0.58, H, 0, H);
    c.closePath(); c.restore();
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
      var big = mode === "pad" ? 1.22 : mode === "hook" ? 1.12 : 0.98;
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
  function pawShape(c, g) {
    c.moveTo(g.px + g.prx * Math.cos(g.pa), g.py + g.prx * Math.sin(g.pa)); c.ellipse(g.px, g.py, g.prx, g.pry, g.pa, 0, TAU, true);
    if (g.mode === "hook") {                                        /* tre dita che si piegano sopra il bordo */
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
    if (s.slide) return "pad";
    if (s.hang && l.front) return "hook";
    if (l.fy < -2.5) return "dangle";
    return "ground";
  }

  /* ------------------------------------------------------------------ il fez */
  function fezShape(c, x, y, tx, ty, rB, rT, ell, top, T) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    var e0 = rB * ell, e1 = rT * ell;
    c.beginPath(); c.moveTo(-rB, 0); c.bezierCurveTo(-rB * 0.98, len * 0.45, -rT * 1.03, len * 0.8, -rT, len);
    c.ellipse(0, len, rT, e1, 0, PI, 0, true);
    c.bezierCurveTo(rT * 1.03, len * 0.8, rB * 0.98, len * 0.45, rB, 0);
    c.ellipse(0, 0, rB, e0, 0, 0, -PI, true); c.closePath();
    c.fillStyle = RED; c.fill();
    c.save(); c.clip();
    c.fillStyle = RED_D; c.beginPath(); c.moveTo(rB * 0.34, -e0 * 2); c.quadraticCurveTo(rT * 0.5, len * 0.5, rT * 0.26, len + e1 * 2); c.lineTo(rB + 1, len + e1 * 2); c.lineTo(rB + 1, -e0 * 2); c.closePath(); c.fill();
    c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(0, 0, rB * 1.05, e0 + 0.55, 0, 0, TAU); c.fill();   /* la piega del feltro sulla testa */
    c.restore();
    if (top) { c.fillStyle = RED_T; c.beginPath(); c.ellipse(0, len, rT, e1, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  function tassel(c, t, top, T, rw) {
    var dx = t.x1 - t.x0, dy = t.y1 - t.y0, d = nrm(dx, dy), ux = d[0], uy = d[1], nx = -uy, ny = ux;
    c.lineCap = "round"; c.lineJoin = "round";
    function cord() { c.beginPath(); c.moveTo(top[0], top[1]); c.quadraticCurveTo(t.x0, t.y0 + 0.5, t.x0 + dx * 0.55, t.y0 + dy * 0.55); }
    function drop() { var bx = t.x0 + dx * 0.55, by = t.y0 + dy * 0.55; c.beginPath(); c.moveTo(bx + nx * 0.35, by + ny * 0.35); c.quadraticCurveTo(t.x1 + nx * 1.05, t.y1 + ny * 1.05, t.x1 + ux * 0.3, t.y1 + uy * 0.3); c.quadraticCurveTo(t.x1 - nx * 1.05, t.y1 - ny * 1.05, bx - nx * 0.35, by - ny * 0.35); c.closePath(); }
    if (T.rim) { c.strokeStyle = T.rim; c.lineWidth = (rw || 0.3) * 2; drop(); c.stroke(); }
    c.strokeStyle = TASSEL; c.lineWidth = 0.5; cord(); c.stroke();
    c.fillStyle = TASSEL; drop(); c.fill();
  }
  function fezOnHead(c, f, T, rw) {
    var z = f.fez; fezShape(c, z.x, z.y, z.tx, z.ty, z.rBase, z.rTop, z.ell, z.top, T); tassel(c, z.tassel, [z.tx, z.ty + z.rTop * z.ell * 0.3], T, rw);
  }

  /* ------------------------------------------------------------------ il muso */
  function face(c, f, T) {
    var h = f.head, ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul, i;
    var ss = (h.s[0] * uy - h.s[1] * ux) >= 0 ? 1 : -1;
    c.save(); headPath(c, f); c.clip();                          /* occhi e bocca restano dentro la testa */
    for (i = 0; i < 2; i++) {
      var e = f.eyes[i]; if (e.vis < 0.03) continue;
      var open = Math.min(1.4, e.open), wide = Math.max(0, open - 1), r = e.r * (1 + 0.22 * wide), o1 = Math.min(1, open);
      c.save(); c.globalAlpha = e.vis; c.translate(e.x, e.y); c.transform(uy, -ux, ux, uy, 0, 0); c.scale(e.sx, 1);
      if (o1 < 0.14) {                                              /* chiuso: un arco verde, morbido */
        c.strokeStyle = GREEN; c.lineWidth = 0.72; c.lineCap = "round";
        c.beginPath(); c.moveTo(-r * 0.86, r * 0.02); c.quadraticCurveTo(0, -r * 0.62, r * 0.86, r * 0.02); c.stroke();
      } else {
        /* palpebre: un taglio netto, inclinato quando è seccato; si disegna solo la parte aperta (niente bordi sporchi) */
        var lidY = r - 2 * r * (1 - o1) * 0.92 - r * e.lid * 0.92, inner = -e.side * ss, sl = e.brow * r * 0.55, low = -r - 0.1 + (1 - o1) * r * 0.4;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.save(); c.clip();
        c.beginPath(); c.moveTo(-r * 1.3, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.3, lidY + (inner < 0 ? sl : -sl)); c.lineTo(r * 1.3, low); c.lineTo(-r * 1.3, low); c.closePath(); c.clip();
        c.fillStyle = GREEN; c.fillRect(-r, -r, 2 * r, 2 * r);
        c.strokeStyle = GREEN_D; c.lineWidth = r * 0.22; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();   /* bordo dell'iride */
        var pw = e.pupil.w, pr = r * (0.62 - 0.12 * wide), px = e.pupil.dx * r * 0.36, py = e.pupil.dy * r * 0.3;
        c.fillStyle = PUPIL; c.beginPath(); c.ellipse(px, py, r * (0.13 + 0.42 * pw) * (1 - 0.25 * wide), pr, 0, 0, TAU); c.fill();
        c.fillStyle = "#ffffff"; c.beginPath(); c.arc(px - r * 0.3, py + r * 0.3, r * 0.17, 0, TAU); c.fill();
        if (o1 < 0.98 || e.lid > 0.02) { c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(-r * 1.3, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.3, lidY + (inner < 0 ? sl : -sl)); c.stroke(); }   /* l'ombra della palpebra */
        c.restore();
      }
      c.restore();
    }
    /* la bocca: solo quando miagola o sbadiglia */
    if (f.mouth.vis > 0.3 && f.mouth.open > 0.06) {
      var mo = f.mouth.open; c.save(); c.globalAlpha = f.mouth.vis; c.translate(f.mouth.x, f.mouth.y); c.transform(uy, -ux, ux, uy, 0, 0);
      var mw = 1.25 + 0.75 * mo, mh = 0.6 + 2.7 * mo;
      c.fillStyle = "#d9475f"; c.beginPath(); c.moveTo(-mw, 0); c.quadraticCurveTo(0, 0.5, mw, 0); c.bezierCurveTo(mw * 0.9, -mh * 0.8, mw * 0.4, -mh, 0, -mh); c.bezierCurveTo(-mw * 0.4, -mh, -mw * 0.9, -mh * 0.8, -mw, 0); c.fill();
      if (mo > 0.35) { c.fillStyle = "#ff8fa0"; c.beginPath(); c.ellipse(0, -mh * 0.78, mw * 0.55, mh * 0.24, 0, 0, TAU); c.fill(); }
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

    /* 1. il filo di luce attorno a tutta la sagoma (solo sul fondo scuro): tratto spostato in alto a sinistra */
    if (T.rim) {
      c.save(); c.translate(-RW * 0.35, RW * 0.42); c.strokeStyle = T.rim; c.lineWidth = RW * 2; c.lineJoin = "round";
      c.beginPath(); tailPath(c, f); c.stroke();
      for (i = 0; i < 4; i++) if (shown(i)) { c.beginPath(); legPath(c, G[i]); c.stroke(); }
      bodyPath(c, f); c.stroke();
      for (i = 0; i < 2; i++) { c.beginPath(); earPath(c, f, ears[i]); c.stroke(); }
      headPath(c, f); c.stroke();
      c.restore();
    }

    /* 2. le parti, da dietro in avanti */
    c.fillStyle = INK; if (!f.tail.front) { c.beginPath(); tailPath(c, f); c.fill(); }
    c.fillStyle = FAR; for (i = 0; i < 4; i++) if (!f.legs[i].near && !upFront(f.legs[i]) && shown(i)) { c.beginPath(); legPath(c, G[i]); c.fill(); }
    c.fillStyle = INK; bodyPath(c, f); c.fill();
    for (i = 0; i < 4; i++) {
      l = f.legs[i]; if (!l.near || upFront(l) || !shown(i)) continue; g = G[i];
      if (l.front) gap(c, T, foreEdges.bind(null, c, g), bodyPath.bind(null, c, f), g.kx, g.ky, g.kx + (g.ax - g.kx) * 0.5, g.ky + (g.ay - g.ky) * 0.5);
      else if (!s.hang) gap(c, T, legPath.bind(null, c, g, true), bodyPath.bind(null, c, f), g.jx, g.jy, g.jx + (g.kx - g.jx) * 0.7, g.jy + (g.ky - g.jy) * 0.7);
      c.fillStyle = INK; c.beginPath(); legPath(c, g); c.fill(); toes(c, g, T, env);
    }
    if (f.tail.front) {
      var tp = f.tail.pts, t0 = tp[0], t1 = tp[Math.min(4, tp.length - 1)];
      gap(c, T, tailPath.bind(null, c, f), bodyPath.bind(null, c, f), t0.x, t0.y, t1.x, t1.y);
      gap(c, T, tailPath.bind(null, c, f), function () { c.beginPath(); for (var j = 0; j < 4; j++) if (f.legs[j].near && shown(j)) legPath(c, G[j]); }, null);
      c.fillStyle = INK; c.beginPath(); tailPath(c, f); c.fill();
    }
    c.fillStyle = ears[1].depth - ears[0].depth > 1.2 ? FAR : INK; c.beginPath(); earPath(c, f, ears[0]); c.fill();
    c.fillStyle = INK; c.beginPath(); earPath(c, f, ears[1]); c.fill();
    headPath(c, f); c.fill();
    face(c, f, T);
    if (f.fez) fezOnHead(c, f, T, RW);
    if (s.hang || s.slide) for (i = 0; i < 2; i++) {                /* appeso o sul vetro: le braccia dietro la testa, le zampe davanti a tutto */
      g = G[i]; if (!shown(i)) continue;
      if (T.rim) { c.save(); c.translate(-RW * 0.35, RW * 0.42); c.strokeStyle = T.rim; c.lineWidth = RW * 2; c.beginPath(); pawShape(c, g); c.stroke(); c.restore(); }
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
      if (T.rim) { c.save(); c.translate(-RW * 0.35, RW * 0.42); c.strokeStyle = T.rim; c.lineWidth = RW * 2; c.beginPath(); c.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU); c.stroke(); c.restore(); }
      gap(c, T, function () { c.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU); }, function () { if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); } headPath(c, f); }, null);
      c.fillStyle = INK; c.beginPath(); c.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU); c.fill(); toes(c, g, T, env);
    }
  }

  /* il fez quando non è in testa: origine al centro della base, dritto */
  function drawFez(c, fz, env) {
    var T = theme(env), a = fz.tasselAng || 0, h = fz.h, rT = fz.rTop, ell = fz.ell == null ? 0.22 : fz.ell, L = 6.6;
    fezShape(c, 0, 0, 0, h, fz.rBase, rT, ell, fz.top !== false, T);
    var x0 = -rT * 0.72, y0 = h; tassel(c, { x0: x0, y0: y0, x1: x0 + L * Math.sin(a), y1: y0 - L * Math.cos(a) }, [0, h + rT * ell * 0.3], T, rimW(env));
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
      if (T.rim) { c.strokeStyle = T.rim; c.lineWidth = rimW(last.env) * 2; c.beginPath(); tr(); c.stroke(); }
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
  var SITX = { hy: 8.8, cy: 16, dy: 10.4, tw: 1.3, te: -0.25, tc: 0.5 };
  function withSit(o) { var k, r = {}; for (k in SITX) r[k] = SITX[k]; for (k in o) r[k] = o[k]; return r; }
  var preset = {
    props: {
      headRx: 11.4, headRy: 9.3, headDepth: 9.4,
      eye: { fwd: 8.2, up: -0.3, side: 4.9, r: 3.85 },
      ear: { fwd: -1.2, up: 6.0, side: 5.8, tipFwd: -1.8, tipUp: 16.4, tipSide: 8.9, w: 4.6 },
      mouth: { fwd: 9.4, up: -4.3 },
      whisk: { fwd: 8.0, up: -2.8, side: 6.8, len: 7.2 },
      fez: { fwd: -1.4, up: 8.3, h: 7.8, rBase: 4.8, rTop: 3.5, lean: -0.14, tassel: 6.6 },
      chestR: 7.0, hipR: 8.6,
      leg: { len: 12.2, r0: 3.15, r1: 2.25, paw: 2.8 },
      tail: { len: 31, r0: 2.5, r1: 1.95, n: 15 }
    },
    poses: {
      stand: { hy: 15.4, cy: 15.8, te: 0.16, tc: 1.0 },
      sit: withSit({}),
      yawn: withSit({}), annoyed: withSit({}), groom: withSit({}), bat: withSit({}),
      hold: withSit({ fs: 1.6, f0x: 7.6, f1x: 6.8 }), sip: withSit({ fs: 1.3 }),
      type: withSit({ f0y: 2.2, f1y: 2.8 }),
      peek: { fs: 10.2 },
      drape: { f0x: 10.6, f0y: -10.6, f2x: -2.6, f2y: -9.6, te: -1.42, tc: -0.42 },
      /* appeso: le braccia su ai lati della testa, la testa tra le braccia, il corpo che pende come una goccia */
      hang: { hx: 0, hy: -26.5, cx: 0, cy: -8.4, dx: 0.4, dy: -1.6, f0x: 0.6, f0y: 0.9, f1x: 0.6, f1y: 0.9, fs: 2.6, fo: 5.4, f2x: 0.6, f2y: -39.5, f3x: 0.6, f3y: -39.5, hs: -1.2, ho: 0.6, tby: -4, te: -1.3, tc: 0.9, tw: 0.5, eye: 1.15, hp: 0.12, ear: 0.3, sqx: 1, sqy: 1 },
      /* scivola: braccia in alto a V, zampe dietro aperte, tutto premuto sul vetro */
      slide: { hx: 0, hy: -9, cx: 0, cy: 6, dx: 0.5, dy: -3, f0x: 0.8, f0y: 14.6, f1x: 0.8, f1y: 12.4, fs: 2, fo: 6, f2x: 0.8, f2y: -19, f3x: 0.8, f3y: -19, hs: 1.5, ho: 7 }
    }
  };

  DOT.looks.manifesto = { label: "Manifesto", preset: preset, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
