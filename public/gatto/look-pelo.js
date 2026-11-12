/* look-pelo.js — l'aspetto «Pelo» di Dot: nero pieno come gli altri, ma con il pelo che si vede nella sagoma
   (ciuffi sulle guance, sul petto, sulla coda quando ha paura), un solo velo di luce morbido sulla testa e sul dorso,
   un filo di luce fredda in alto a sinistra sul fondo scuro. Occhi verdi grandi e chiari.
   Un aspetto NON muove nulla: disegna il fotogramma di dot-rig.js (vedi look-base.js per il contratto).
   Come è fatto: tutte le parti nere vicine (corpo, zampe, coda, testa, orecchie) sono UN solo tracciato riempito una
   volta, così non si vedono cuciture né contorni fra le parti; le zampe lontane sono un tracciato a parte, un filo
   più chiaro. I gradienti si creano una volta per contesto (in unità fisse) e poi si spostano con la trasformazione:
   niente gradienti nuovi a ogni fotogramma, niente shadowBlur, niente canvas nuovi. Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var PI = Math.PI, TAU = PI * 2;
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { var t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return "rgb(" + Math.round(lerp(A[0], B[0], t)) + "," + Math.round(lerp(A[1], B[1], t)) + "," + Math.round(lerp(A[2], B[2], t)) + ")"; }

  /* i colori: lo stesso nero degli altri aspetti; sul buio un filo di luce fredda, sul chiaro niente */
  var TH = {
    dark: { ink: "#0b0b10", far: "#262630", rim: "rgba(150,174,245,.48)", rimFar: "rgba(150,174,245,.22)", sheen: "sheenD", sheenA: 0.17,
      sep: "rgba(150,172,236,.34)", toe: "rgba(150,172,236,.3)", fur: "rgba(160,178,236,.3)", whisk: "rgba(228,233,250,.8)", closed: "rgba(206,216,244,.86)", glow: 0.2, line: "rgba(160,172,214,.5)", steam: "steamD" },
    light: { ink: "#0b0b10", far: "#2e2e3a", rim: null, rimFar: null, sheen: "sheenL", sheenA: 0.14,
      sep: "rgba(255,255,255,.3)", toe: "rgba(255,255,255,.3)", fur: "rgba(255,255,255,.2)", whisk: "rgba(176,182,204,.95)", closed: "rgba(210,216,238,.88)", glow: 0, line: "rgba(190,190,214,.5)", steam: "steamL" }
  };
  var EAR_IN = "#86636f", EAR_HAIR = "rgba(226,218,234,.5)", NOSE = "#c88a98", PAD = "#b9808f", PAD2 = "#cf97a5";

  /* ---------------------------------------------------------------- i gradienti, una volta per contesto */
  function G(c) {
    if (c.__pelo3) return c.__pelo3;
    var g = {}, x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                       /* ombra a terra (unitaria) */
    x.addColorStop(0, "rgba(0,0,8,.55)"); x.addColorStop(0.6, "rgba(0,0,8,.22)"); x.addColorStop(1, "rgba(0,0,8,0)"); g.shadow = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                       /* velo di luce, fondo scuro: freddo */
    x.addColorStop(0, "rgba(196,210,255,1)"); x.addColorStop(0.5, "rgba(196,210,255,.42)"); x.addColorStop(1, "rgba(196,210,255,0)"); g.sheenD = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                       /* velo di luce, fondo chiaro */
    x.addColorStop(0, "rgba(255,255,255,1)"); x.addColorStop(0.5, "rgba(255,255,255,.42)"); x.addColorStop(1, "rgba(255,255,255,0)"); g.sheenL = x;
    x = c.createRadialGradient(0, -0.4, 0.05, 0, 0, 1);                 /* iride: chiara in basso, verde pieno sul bordo */
    x.addColorStop(0, "#f0ffb6"); x.addColorStop(0.34, "#b8ee70"); x.addColorStop(0.76, "#63c853"); x.addColorStop(1, "#3c9c41"); g.iris = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                       /* bagliore verde attorno all'occhio */
    x.addColorStop(0, "rgba(120,235,120,1)"); x.addColorStop(0.45, "rgba(120,235,120,.32)"); x.addColorStop(1, "rgba(120,235,120,0)"); g.glow = x;
    x = c.createLinearGradient(-4.6, 0, 4.6, 0);                        /* fez: feltro, luce da sinistra */
    x.addColorStop(0, "#e2493f"); x.addColorStop(0.32, "#c92a2f"); x.addColorStop(0.75, "#9c1824"); x.addColorStop(1, "#6e0f1a"); g.fez = x;
    x = c.createLinearGradient(-4.6, 0, -0.46, 0);                      /* fez: lama di luce */
    x.addColorStop(0, "rgba(255,190,170,0)"); x.addColorStop(0.55, "rgba(255,190,170,.2)"); x.addColorStop(1, "rgba(255,190,170,0)"); g.fezLit = x;
    x = c.createLinearGradient(0, -1.3, 0, 2.4);                        /* fez: ombra alla base */
    x.addColorStop(0, "rgba(40,0,8,.45)"); x.addColorStop(1, "rgba(40,0,8,0)"); g.fezBase = x;
    x = c.createLinearGradient(0, 1, 0, 6.7);                           /* tè */
    x.addColorStop(0, "#9c4a12"); x.addColorStop(1, "#e7a43e"); g.tea = x;
    x = c.createLinearGradient(0, 8.9, 0, 15.4);                        /* vapore, fondo scuro */
    x.addColorStop(0, "rgba(255,255,255,0)"); x.addColorStop(0.3, "rgba(255,255,255,.42)"); x.addColorStop(1, "rgba(255,255,255,0)"); g.steamD = x;
    x = c.createLinearGradient(0, 8.9, 0, 15.4);                        /* vapore, fondo chiaro */
    x.addColorStop(0, "rgba(120,128,150,0)"); x.addColorStop(0.3, "rgba(120,128,150,.6)"); x.addColorStop(1, "rgba(120,128,150,0)"); g.steamL = x;
    x = c.createRadialGradient(-1.3, 5.2, 0.4, 0, 3.8, 3.8);            /* gomitolo */
    x.addColorStop(0, "#ffd3dc"); x.addColorStop(0.6, "#f6a5b6"); x.addColorStop(1, "#c96f86"); g.yarn = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                       /* alone della stella (unitario) */
    x.addColorStop(0, "rgba(255,200,90,.55)"); x.addColorStop(0.35, "rgba(255,200,90,.16)"); x.addColorStop(1, "rgba(255,200,90,0)"); g.halo = x;
    x = c.createRadialGradient(-0.3, 0.3, 0, 0, 0, 1.5);                /* cuore della stella */
    x.addColorStop(0, "#fffbea"); x.addColorStop(0.6, "#ffe08a"); x.addColorStop(1, "#f0b440"); g.core = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                       /* luce dello schermo (unitaria) */
    x.addColorStop(0, "rgba(125,224,138,.16)"); x.addColorStop(1, "rgba(125,224,138,0)"); g.screen = x;
    c.__pelo3 = g; return g;
  }
  /* un gradiente unitario steso su un'ellisse: centro, raggi, rotazione, forza */
  function blob(c, gr, x, y, rx, ry, rot, a) {
    if (a <= 0.004) return;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(rx, ry); c.globalAlpha = a > 1 ? 1 : a; c.fillStyle = gr; c.fillRect(-1, -1, 2, 2); c.restore();
  }

  /* ---------------------------------------------------------------- forme: poligoni piatti [x, y, x, y, ...] */
  function area(p) { var a = 0, n = p.length, i, j; for (i = 0; i < n; i += 2) { j = (i + 2) % n; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return a; }
  /* tutti i poligoni girano nello stesso verso: l'unione con «nonzero» non lascia buchi */
  function poly(c, p, ox, oy) {
    var n = p.length, i; if (n < 6) return;
    if (area(p) >= 0) { c.moveTo(p[0] + ox, p[1] + oy); for (i = 2; i < n; i += 2) c.lineTo(p[i] + ox, p[i + 1] + oy); }
    else { c.moveTo(p[n - 2] + ox, p[n - 1] + oy); for (i = n - 4; i >= 0; i -= 2) c.lineTo(p[i] + ox, p[i + 1] + oy); }
    c.closePath();
  }
  function emit(c, sh, ox, oy) { for (var i = 0; i < sh.length; i++) if (sh[i]) poly(c, sh[i], ox || 0, oy || 0); }
  function ellP(x, y, rx, ry, rot, n, floorY) {
    var p = [], i, a, cr = Math.cos(rot || 0), sr = Math.sin(rot || 0), px, py, yy; n = n || 16;
    for (i = 0; i < n; i++) { a = TAU * i / n; px = rx * Math.cos(a); py = ry * Math.sin(a); yy = y + px * sr + py * cr; if (floorY != null && yy < floorY) yy = floorY + (yy - floorY) * 0.22; p.push(x + px * cr - py * sr, yy); }
    return p;
  }
  /* capsula affusolata: due cerchi uniti dalle tangenti esterne (un contorno solo) */
  function caps(x0, y0, r0, x1, y1, r1, n) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy), out = [], i, a; n = n || 10;
    if (d <= Math.abs(r0 - r1) + 0.01) return r0 > r1 ? ellP(x0, y0, r0, r0, 0, 2 * n) : ellP(x1, y1, r1, r1, 0, 2 * n);
    var A = Math.atan2(dy, dx), ph = Math.acos((r0 - r1) / d), n1 = Math.max(3, Math.round(n * ph / PI)), n0 = Math.max(3, Math.round(n * (PI - ph) / PI));
    for (i = 0; i <= n1; i++) { a = A - ph + 2 * ph * i / n1; out.push(x1 + r1 * Math.cos(a), y1 + r1 * Math.sin(a)); }
    for (i = 0; i <= n0; i++) { a = A + ph + (TAU - 2 * ph) * i / n0; out.push(x0 + r0 * Math.cos(a), y0 + r0 * Math.sin(a)); }
    return out;
  }
  /* un ciuffo: triangolo morbido che esce da (x, y) verso (nx, ny), largo w, alto hgt, piegato di lean lungo (tx, ty) */
  function tuft(x, y, nx, ny, w, hgt, lean) {
    var tx = -ny, ty = nx;
    return [x - tx * w - nx * 0.6, y - ty * w - ny * 0.6, x + nx * hgt * 0.55 + tx * (lean * 0.5 - w * 0.25), y + ny * hgt * 0.55 + ty * (lean * 0.5 - w * 0.25),
      x + nx * hgt + tx * lean, y + ny * hgt + ty * lean, x + tx * w - nx * 0.6, y + ty * w - ny * 0.6];
  }
  /* riempie un gruppo di forme in un colpo: con il filo di luce (la forma meno sé stessa spostata in basso a destra) o piatto */
  function solid(c, sh, fill, rim, d) {
    c.beginPath(); emit(c, sh, 0, 0);
    if (!rim) { c.fillStyle = fill; c.fill(); return; }
    c.save(); c.clip(); c.fillStyle = rim; c.fillRect(-400, -400, 800, 800);
    c.fillStyle = fill; c.beginPath(); emit(c, sh, d, -d); c.fill(); c.restore();
  }

  /* ---------------------------------------------------------------- la testa, nel suo piano (x di lato, y in su) */
  var HEAD1 = null;                                                   /* il contorno unitario, calcolato una volta */
  function headUnit() {
    if (HEAD1) return HEAD1;
    var n = 60, p = [], i, a, cs, sn, e, x, y;
    for (i = 0; i < n; i++) {
      a = -PI / 2 + TAU * i / n; cs = Math.cos(a); sn = Math.sin(a); e = sn > 0 ? 2.5 : 2.15;
      x = (cs < 0 ? -1 : 1) * Math.pow(Math.abs(cs), 2 / e); y = (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), 2 / e);
      x *= 1 + 0.06 * Math.exp(-Math.pow((sn + 0.28) / 0.3, 2)) - 0.17 * smooth(-0.6, -1, sn);   /* guance piene, mento stretto */
      p.push(x, y);
    }
    HEAD1 = p; return p;
  }
  var CHEEK = [[-0.26, 0.13, 0.75], [-0.52, 0.11, 0.6], [-0.74, 0.06, 0.4]];   /* ciuffi sulle guance: angolo, quanto escono, quanto scendono */
  function headLocal(W, H, puff) {
    var u = headUnit(), p = [], n = u.length / 2, i, k, s2, a;
    for (i = 0; i < u.length; i += 2) p.push(u[i] * W, u[i + 1] * H);
    for (k = 0; k < CHEEK.length; k++) for (s2 = -1; s2 <= 1; s2 += 2) {
      a = s2 > 0 ? CHEEK[k][0] : PI - CHEEK[k][0]; i = Math.round(((a + PI / 2) / TAU) * n) % n; if (i < 0) i += n;
      var amt = CHEEK[k][1] * (1 + 0.9 * puff);
      p[2 * i] *= 1 + amt; p[2 * i + 1] -= amt * H * CHEEK[k][2];
    }
    return p;
  }
  function toScreen(p, ox, oy, ux, uy) { var o = [], i; for (i = 0; i < p.length; i += 2) o.push(ox + p[i] * uy + p[i + 1] * ux, oy - p[i] * ux + p[i + 1] * uy); return o; }
  /* orecchio: triangolo coi lati appena curvi, punta morbida, base affondata nella testa */
  function earPts(e, hx, hy) {
    var ex = e.tx - e.bx, ey = e.ty - e.by, L = Math.sqrt(ex * ex + ey * ey) || 1, ax = ex / L, ay = ey / L, nx = -ay, ny = ax, w = e.w;
    if (nx * (e.bx - hx) + ny * (e.by - hy) < 0) { nx = -nx; ny = -ny; }   /* n punta fuori dalla testa */
    var bx = e.bx - ax * 2.6, by = e.by - ay * 2.6, ox = bx + nx * w, oy = by + ny * w, ix = bx - nx * w * 0.95, iy = by - ny * w * 0.95, p = [], i, t, u;
    var tx = e.tx - ax * 0.5, ty = e.ty - ay * 0.5;
    var c1x = (ox + tx) / 2 + nx * w * 0.28, c1y = (oy + ty) / 2 + ny * w * 0.28, c2x = (tx + ix) / 2 + nx * w * 0.16, c2y = (ty + iy) / 2 + ny * w * 0.16;
    for (i = 0; i <= 8; i++) { t = i / 8; u = 1 - t; p.push(u * u * ox + 2 * u * t * c1x + t * t * tx, u * u * oy + 2 * u * t * c1y + t * t * ty); }
    p.push(e.tx, e.ty);
    for (i = 0; i <= 8; i++) { t = i / 8; u = 1 - t; p.push(u * u * tx + 2 * u * t * c2x + t * t * ix, u * u * ty + 2 * u * t * c2y + t * t * iy); }
    return { p: p, ax: ax, ay: ay, nx: nx, ny: ny, bx: e.bx, by: e.by, L: L };
  }
  function innerEar(c, g, w, alpha, flat, S) {
    if (alpha < 0.03) return;
    var b0x = g.bx + g.ax * 1.4, b0y = g.by + g.ay * 1.4, tL = g.L * 0.74, tx = g.bx + g.ax * tL - g.nx * 0.5, ty = g.by + g.ay * tL - g.ny * 0.5, ww = w * 0.52 * (1 - 0.3 * flat);
    c.globalAlpha = alpha; c.fillStyle = EAR_IN; c.beginPath();
    c.moveTo(b0x + g.nx * ww, b0y + g.ny * ww); c.quadraticCurveTo((b0x + tx) / 2 + g.nx * ww * 0.7, (b0y + ty) / 2 + g.ny * ww * 0.7, tx, ty);
    c.quadraticCurveTo((b0x + tx) / 2 - g.nx * ww * 0.5, (b0y + ty) / 2 - g.ny * ww * 0.5, b0x - g.nx * ww * 0.8, b0y - g.ny * ww * 0.8); c.closePath(); c.fill();
    if (S > 1.8) {                                                    /* due peli chiari che escono dall'orecchio */
      c.strokeStyle = EAR_HAIR; c.lineWidth = Math.max(0.2, 0.55 / S); c.lineCap = "round"; c.beginPath();
      c.moveTo(b0x - g.nx * ww * 0.3, b0y - g.ny * ww * 0.3); c.quadraticCurveTo(b0x + g.ax * 2.5 - g.nx * ww * 0.6, b0y + g.ay * 2.5 - g.ny * ww * 0.6, b0x + g.ax * 4.2 - g.nx * ww * 1.1, b0y + g.ay * 4.2 - g.ny * ww * 1.1); c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- zampe */
  function ik(sx, sy, fx, fy, len) {                                  /* due ossa lunghe len/2: il gomito scende */
    var dx = fx - sx, dy = fy - sy, d = Math.sqrt(dx * dx + dy * dy) || 1, mx = (sx + fx) / 2, my = (sy + fy) / 2;
    if (d >= len) return [mx, my];
    var hb = Math.sqrt(len * len / 4 - d * d / 4), nx = -dy / d, ny = dx / d;
    return ny < 0 ? [mx + nx * hb, my + ny * hb] : [mx - nx * hb, my - ny * hb];
  }
  /* una zampa affusolata: grossa dove entra nel corpo, sottile alla caviglia, zampetta tonda; le dietro con la coscia */
  function legShape(l, f, o) {
    o = o || {};
    var jx = o.sx != null ? o.sx : l.jx, jy = o.sy != null ? o.sy : l.jy, kx = o.kx != null ? o.kx : l.kx, ky = o.ky != null ? o.ky : l.ky, fx = l.fx, fy = l.fy;
    var r0 = l.r0 * (o.r0k || 1.16), r1 = l.r1 * 0.86, rk = lerp(r0, r1, 0.52), P = l.paw, sh = [];
    var dx = fx - kx, dy = fy - ky, dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / dl, uy = dy / dl;
    var gk = o.noGround ? 0 : 1 - smooth(0.8, 3.6, Math.abs(fy)), fa = Math.min(1, Math.abs(f.fwd[0]) * 1.4), sx = f.fwd[0] >= 0 ? 1 : -1;
    var rot = Math.atan2(uy, ux); if (rot > PI / 2) rot -= PI; if (rot < -PI / 2) rot += PI;
    var pcx = lerp(fx + ux * P * 0.3, fx + sx * P * 0.32 * fa, gk), pcy = lerp(fy + uy * P * 0.3, fy + P * 0.64, gk);
    var prx = lerp(P * 1.04, P * (0.96 + 0.26 * fa), gk), pry = lerp(P * 0.82, P * 0.7, gk), prot = rot * (1 - gk);
    if (!l.front && !o.noHaunch) {                                   /* la coscia: un ovale pieno che si fonde nei fianchi */
      var fold = 1 - Math.min(1, Math.sqrt((fx - jx) * (fx - jx) + (fy - jy) * (fy - jy)) / (f.P.leg.len + 0.01)), hr = r0 * (1.02 + 0.38 * fold), hl = Math.sqrt((kx - jx) * (kx - jx) + (ky - jy) * (ky - jy));
      sh.push(ellP(lerp(jx, kx, 0.5), lerp(jy, ky, 0.5) + hr * 0.12, hl * 0.5 + rk * 0.95 * fold + hr * (1 - fold) * 0.9, hr, Math.atan2(ky - jy, kx - jx), 24));
    }
    if (!o.noUpper) sh.push(caps(jx, jy, r0, kx, ky, rk, 14));
    sh.push(caps(kx, ky, rk, pcx - ux * P * 0.25, pcy - uy * P * 0.25, r1, 14));
    if (!o.noPaw) sh.push(ellP(pcx, pcy, prx, pry, prot, 22, gk > 0.5 ? fy - 0.02 : null));
    return { sh: sh, pcx: pcx, pcy: pcy, prx: prx, pry: pry, rot: prot, gk: gk, ux: ux, uy: uy, sx: sx, fa: fa };
  }
  /* braccio dei bordi (appeso, scivola): dalla spalla alla zampetta, con un gomito appena piegato in fuori */
  function armShape(sx, sy, px, py, r0, r1, bend, out) {
    var dx = px - sx, dy = py - sy, d = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / d, ny = dx / d;
    if (nx * out < 0) { nx = -nx; ny = -ny; }
    var ex = (sx + px) / 2 + nx * bend, ey = (sy + py) / 2 + ny * bend, re = lerp(r0, r1, 0.45);
    return [caps(sx, sy, r0, ex, ey, re, 14), caps(ex, ey, re, px, py, r1, 14)];
  }
  /* dita: due righine chiare sulla zampetta a terra (si vedono solo da vicino) */
  function toes(c, g, th, S) {
    if (g.gk < 0.6 || S < 2) return;
    var i, x, front = g.sx * g.fa;
    c.strokeStyle = th.toe; c.lineWidth = Math.max(0.2, 0.7 / S); c.lineCap = "round"; c.beginPath();
    for (i = -1; i <= 1; i += 2) { x = g.pcx + front * g.prx * 0.42 + i * g.prx * (0.3 - 0.1 * g.fa); c.moveTo(x, g.pcy - g.pry * 0.82); c.lineTo(x + front * 0.15, g.pcy - g.pry * 0.38); }
    c.stroke();
  }
  /* zampetta vista dal palmo (scivola): nera, cuscinetti rosa, unghie chiare verso (dx, dy) */
  function palmPaw(c, x, y, r, dx, dy, th, S, d) {
    var nx = -dy, ny = dx, i, sh = [ellP(x, y, r * 1.05, r * 0.95, Math.atan2(dy, dx), 18)];
    for (i = -1; i <= 1; i++) sh.push(ellP(x + dx * r * 0.74 + nx * i * r * 0.6, y + dy * r * 0.74 + ny * i * r * 0.6, r * 0.44, r * 0.44, 0, 10));
    solid(c, sh, th.ink, th.rim, d);
    c.fillStyle = PAD; c.beginPath(); c.ellipse(x - dx * r * 0.12, y - dy * r * 0.12, r * 0.5, r * 0.4, Math.atan2(dy, dx) + PI / 2, 0, TAU); c.fill();
    c.fillStyle = PAD2; c.beginPath();
    for (i = -1; i <= 1; i++) { var bx = x + dx * r * 0.76 + nx * i * r * 0.6, by = y + dy * r * 0.76 + ny * i * r * 0.6; c.moveTo(bx + r * 0.21, by); c.arc(bx, by, r * 0.21, 0, TAU); }
    c.fill();
    c.strokeStyle = "rgba(240,238,248,.92)"; c.lineWidth = Math.max(0.22, 0.75 / S); c.lineCap = "round"; c.beginPath();
    for (i = -1; i <= 1; i++) {
      var cx = x + dx * r * 1.16 + nx * i * r * 0.62, cy = y + dy * r * 1.16 + ny * i * r * 0.62;
      c.moveTo(cx, cy); c.quadraticCurveTo(cx + dx * r * 0.42, cy + dy * r * 0.42, cx + dx * r * 0.5 - nx * r * 0.2, cy + dy * r * 0.5 - ny * r * 0.2);
    }
    c.stroke();
  }
  /* zampetta che si aggrappa al bordo di sotto (appeso): il dorso della zampa, dita in su sulla faccia del riquadro, unghie piantate */
  function gripPaw(c, x, y, r, th, S, d) {
    var sh = [ellP(x, y, r * 1.12, r * 0.9, 0, 18)], i;
    for (i = -1; i <= 1; i++) sh.push(ellP(x + i * r * 0.66, y + r * 0.62, r * 0.46, r * 0.5, 0, 10));
    solid(c, sh, th.ink, th.rim, d);
    c.strokeStyle = th.toe; c.lineWidth = Math.max(0.2, 0.7 / S); c.lineCap = "round"; c.beginPath();
    for (i = -1; i <= 1; i += 2) { c.moveTo(x + i * r * 0.33, y + r * 1.0); c.lineTo(x + i * r * 0.3, y + r * 0.25); }
    c.stroke();
    c.strokeStyle = "rgba(240,238,248,.88)"; c.lineWidth = Math.max(0.2, 0.65 / S); c.beginPath();
    for (i = -1; i <= 1; i++) { var bx = x + i * r * 0.68, by = y + r * 1.08; c.moveTo(bx, by); c.quadraticCurveTo(bx + i * 0.12, by + r * 0.32, bx + i * 0.05 - 0.15, by + r * 0.46); }
    c.stroke();
  }
  /* zampetta posata sul bordo di sopra (spunta): ovale largo e piatto, le dita che scendono oltre il bordo */
  function edgePaw(c, x, y, r, th, S, d) {
    var sh = [ellP(x, y + r * 0.42, r * 1.4, r * 0.88, 0, 20)], i;
    for (i = -1; i <= 1; i++) sh.push(ellP(x + i * r * 0.8, y - r * 0.08, r * 0.52, r * 0.56, 0, 10));
    solid(c, sh, th.ink, th.rim, d);
    if (S < 1.8) return;
    c.strokeStyle = th.toe; c.lineWidth = Math.max(0.2, 0.7 / S); c.lineCap = "round"; c.beginPath();
    for (i = -1; i <= 1; i += 2) { c.moveTo(x + i * r * 0.4, y + r * 0.5); c.lineTo(x + i * r * 0.4, y - r * 0.5); }
    c.stroke();
  }

  /* ---------------------------------------------------------------- la coda: un tubo affusolato, punta morbida; spaventato: 5 ciuffi irregolari */
  function crm(a, b, c, d, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
  var TT = [[0.2, 1, 0.95], [0.35, -1, 0.6], [0.5, 1, 1.15], [0.64, 1, 0.55], [0.8, -1, 0.85]];   /* dove, da che lato, quanto */
  var TM = 26, TX = new Array(TM), TY = new Array(TM), TR = new Array(TM);
  function tailPts(f) {
    var p = f.tail.pts, n = p.length, M = TM, X = TX, Y = TY, R = TR, k, puff = f.tail.puff || 0;
    for (k = 0; k < M; k++) {
      var u = k / (M - 1) * (n - 1), i0 = Math.min(n - 2, Math.floor(u)), t = u - i0, a = p[Math.max(0, i0 - 1)], b = p[i0], cc = p[i0 + 1], dd = p[Math.min(n - 1, i0 + 2)];
      X[k] = crm(a.x, b.x, cc.x, dd.x, t); Y[k] = crm(a.y, b.y, cc.y, dd.y, t);
      R[k] = lerp(b.r, cc.r, t) * (1 + 0.12 * Math.sin(PI * k / (M - 1))) * (1 - 0.3 * smooth(0.72, 1, k / (M - 1))) * (1 + 0.25 * puff);   /* piena a metà, punta morbida */
    }
    var Lp = [], Rp = [], tx = 1, ty = 0, tl, nx, ny, j, s;
    for (k = 0; k < M; k++) {
      tx = X[Math.min(M - 1, k + 1)] - X[Math.max(0, k - 1)]; ty = Y[Math.min(M - 1, k + 1)] - Y[Math.max(0, k - 1)]; tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl; nx = -ty; ny = tx;
      var lx = X[k] + nx * R[k], ly = Y[k] + ny * R[k], rx = X[k] - nx * R[k], ry = Y[k] - ny * R[k];
      if (puff > 0.05) for (j = 0; j < TT.length; j++) {
        s = Math.round(TT[j][0] * (M - 1)) - k; if (s > 1 || s < -1) continue;
        var wj = s === 0 ? 1 : s > 0 ? 0.58 : 0.4, h = R[k] * 0.95 * TT[j][2] * puff * wj, lean = 1.0 * TT[j][2] * puff * wj;   /* il ciuffo esce di lato e piega verso la punta */
        if (TT[j][1] > 0) { lx += nx * h + tx * lean; ly += ny * h + ty * lean; } else { rx -= nx * h - tx * lean; ry -= ny * h - ty * lean; }
      }
      Lp.push(lx, ly); Rp.push(rx, ry);
    }
    var out = Lp, i, a2, e = M - 1, rr = R[e];
    for (i = 1; i < 6; i++) { a2 = PI / 2 - PI * i / 6; var ca = Math.cos(a2), sa = Math.sin(a2); out.push(X[e] + (tx * ca * 1.3 + nx * sa) * rr, Y[e] + (ty * ca * 1.3 + ny * sa) * rr); }
    for (k = M - 1; k >= 0; k--) out.push(Rp[2 * k], Rp[2 * k + 1]);
    return out;
  }

  /* ---------------------------------------------------------------- il fez di feltro con la nappa */
  function fezBody(c, x, y, tx, ty, rB, rT, ell, top, Gr) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    c.fillStyle = Gr.fez; c.beginPath(); c.moveTo(-rB, 0);
    c.ellipse(0, 0, rB, rB * ell, 0, PI, TAU, true);                /* bordo di sotto: metà davanti dell'ellisse */
    c.lineTo(rT, len); c.ellipse(0, len, rT, rT * ell, 0, 0, PI, false); c.closePath(); c.fill();
    c.fillStyle = Gr.fezLit; c.beginPath(); c.moveTo(-rB * 0.9, -rB * ell * 0.4); c.lineTo(-rB * 0.2, -rB * ell * 0.9); c.lineTo(-rT * 0.15, len); c.lineTo(-rT * 0.85, len); c.closePath(); c.fill();
    c.fillStyle = Gr.fezBase; c.beginPath(); c.moveTo(-rB, 0); c.ellipse(0, 0, rB, rB * ell, 0, PI, TAU, true); c.lineTo(rB * 0.95, len * 0.3); c.lineTo(-rB * 0.95, len * 0.3); c.closePath(); c.fill();
    c.fillStyle = top ? "#d6383a" : "#a81d28"; c.beginPath(); c.ellipse(0, len, rT, rT * ell, 0, 0, TAU); c.fill();   /* la cima piatta */
    if (top && ell > 0.15) { c.fillStyle = "rgba(255,200,180,.18)"; c.beginPath(); c.ellipse(-rT * 0.25, len + rT * ell * 0.2, rT * 0.55, rT * ell * 0.45, 0, 0, TAU); c.fill(); }
    c.fillStyle = "#17121a"; c.beginPath(); c.ellipse(0, len, 0.62, 0.62 * Math.max(ell, 0.5), 0, 0, TAU); c.fill();   /* il bottoncino della nappa */
    c.restore();
  }
  function tasselDraw(c, sx, sy, x0, y0, x1, y1, S) {
    var w = Math.max(0.42, 1 / S);
    c.strokeStyle = "#141018"; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + x0) / 2, (sy + y0) / 2 + 0.35, x0, y0); c.quadraticCurveTo(x0 + (x1 - x0) * 0.2, y0 - 0.3, x1, y1); c.stroke();
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    c.fillStyle = "#141018"; c.beginPath(); c.arc(x1, y1, 0.72, 0, TAU); c.fill();   /* nodo e ciuffo della nappa */
    c.beginPath(); c.moveTo(x1 + nx * 0.5, y1 + ny * 0.5); c.lineTo(x1 + ux * 2.6 + nx * 0.85, y1 + uy * 2.6 + ny * 0.85); c.quadraticCurveTo(x1 + ux * 2.9, y1 + uy * 2.9, x1 + ux * 2.6 - nx * 0.85, y1 + uy * 2.6 - ny * 0.85); c.lineTo(x1 - nx * 0.5, y1 - ny * 0.5); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.arc(x1 - 0.25, y1 + 0.25, 0.22, 0, TAU); c.fill();
  }

  /* ---------------------------------------------------------------- gli occhi */
  function eyeDraw(c, e, ux, uy, ss, th, S, Gr) {
    if (e.vis < 0.03) return;
    var r = e.r * (1 + 0.16 * Math.max(0, e.open - 1)), open = Math.min(1, e.open), inner = -e.side * ss;
    c.save(); c.globalAlpha = e.vis; c.translate(e.x, e.y); c.transform(uy, -ux, ux, uy, 0, 0); c.scale(e.sx, 1);
    if (open < 0.16) {                                               /* chiusi: un arco morbido */
      c.strokeStyle = th.closed; c.lineWidth = Math.max(0.55, 1.35 / S); c.lineCap = "round";
      c.beginPath(); c.moveTo(-r * 0.95, r * 0.05); c.quadraticCurveTo(0, -r * 0.62, r * 0.95, r * 0.05); c.stroke();
      c.restore(); return;
    }
    var top = r - 2 * r * (1 - open) * 0.92 - r * e.lid * 0.95, sl = e.brow * r * 0.62, yIn = top - sl, yOut = top + sl * 0.35, lo = -r + r * e.lid * 0.3;
    var xIn = inner * 1.4 * r, xOut = -inner * 1.4 * r;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    c.beginPath(); c.moveTo(xIn, yIn); c.lineTo(xOut, yOut); c.lineTo(xOut, lo); c.lineTo(xIn, lo); c.closePath(); c.clip();
    c.save(); c.scale(r, r); c.fillStyle = Gr.iris; c.fillRect(-1, -1, 2, 2); c.restore();
    var pw = e.pupil.w, dot = e.pupil.dot || 0, px = e.pupil.dx * r * 0.32, py = e.pupil.dy * r * 0.28;
    var prx = lerp(r * (0.13 + 0.46 * pw), r * 0.3, dot), pry = lerp(r * (0.78 - 0.1 * pw), r * 0.32, dot);
    c.fillStyle = "#060608"; c.beginPath(); c.ellipse(px, py, prx, pry, 0, 0, TAU); c.fill();
    var ly = Math.max(yIn, yOut);                                    /* la palpebra fa un filo d'ombra */
    if (ly < r) { c.fillStyle = "rgba(0,0,0,.32)"; c.beginPath(); c.moveTo(xIn, yIn); c.lineTo(xOut, yOut); c.lineTo(xOut, yOut - r * 0.2); c.lineTo(xIn, yIn - r * 0.2); c.closePath(); c.fill(); }
    c.fillStyle = "rgba(255,255,255,.96)"; c.beginPath(); c.arc(-r * 0.32 + px * 0.25, r * 0.34, r * 0.26, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.arc(r * 0.3 + px * 0.2, -r * 0.38, r * 0.11, 0, TAU); c.fill();
    if (ly < r * 0.98) { c.strokeStyle = "#050507"; c.lineWidth = Math.max(0.45, 1.1 / S); c.lineCap = "round"; c.beginPath(); c.moveTo(xIn, yIn); c.lineTo(xOut, yOut); c.stroke(); }
    c.restore();
  }

  /* ---------------------------------------------------------------- il disegno di un fotogramma */
  var last = { f: null, T: null };
  function draw(c, f, env) {
    env = env || {};
    var th = env.dark === false ? TH.light : TH.dark, S = env.scale || 2.6, d = Math.max(0.32, 1.0 / S), Gr = G(c);
    var i, l, g, h = f.head, legs = f.legs, b = f.body, P = f.P;
    last.f = f; last.T = null; if (typeof c.getTransform === "function") { try { last.T = c.getTransform(); } catch (er) { last.T = null; } }
    var ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul;
    var pose = f.pose, hangK = f.edge === "hang" || pose === "hang" ? 1 : 0, slideK = !hangK && (f.edge === "face" || pose === "slide") ? 1 : 0, edgeArms = hangK || slideK;
    var puff = f.mood ? f.mood.puff || 0 : 0;

    if (env.shadow && env.shadow.k > 0.01) blob(c, Gr.shadow, b.chest.x * 0.3 + b.hips.x * 0.3, env.shadow.y, 19, 19 * 0.16, 0, env.shadow.k);
    c.save();
    if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); }

    /* il corpo: fianchi, (schiena), petto e collo, uniti in un contorno; nell'appeso una goccia, nello scivolare un sacchetto */
    var hr = b.hips.r * (1 + 0.14 * hangK + 0.16 * slideK), cr = b.chest.r * (1 - 0.05 * hangK + 0.04 * slideK), mx = (b.hips.x + b.chest.x) / 2;
    var sqx = b.sx, sqy = b.sy;
    function SX(x) { return mx + (x - mx) * sqx; }
    var Hx = SX(b.hips.x), Hy = b.hips.y * sqy, Cx = SX(b.chest.x), Cy = b.chest.y * sqy, bodySh = [], k;
    if (b.mid) bodySh.push(caps(b.hips.x, b.hips.y, hr, b.mid.x, b.mid.y, b.mid.r, 22), caps(b.mid.x, b.mid.y, b.mid.r, b.chest.x, b.chest.y, cr, 22));
    else bodySh.push(caps(b.hips.x, b.hips.y, hr, b.chest.x, b.chest.y, cr, 24));
    bodySh.push(caps(b.chest.x, b.chest.y, cr * 0.8, lerp(b.chest.x, h.x, 0.5), lerp(b.chest.y, h.y, 0.5), 5.0, 14));
    if (sqx !== 1 || sqy !== 1) for (k = 0; k < bodySh.length; k++) { var bp = bodySh[k]; for (i = 0; i < bp.length; i += 2) { bp[i] = SX(bp[i]); bp[i + 1] *= sqy; } }
    var fwl = Math.sqrt(f.fwd[0] * f.fwd[0] + f.fwd[1] * f.fwd[1]) || 1, fnx = f.fwd[0] / fwl, fa = Math.min(1, fwl * 1.3);
    /* il pelo nella sagoma: un ciuffo di petto (di lato) e, quando ha paura, ciuffi irregolari lungo la schiena */
    if (fa > 0.3 && !edgeArms) {
      var rdx = fnx * 0.82, rdy = -0.57, ru = Math.sqrt(rdx * rdx + rdy * rdy); rdx /= ru; rdy /= ru;
      var rbx = Cx + rdx * cr * 0.9, rby = Cy + rdy * cr * 0.9, rk2 = smooth(0.3, 0.8, fa);
      bodySh.push(tuft(rbx, rby, rdx, rdy, 1.0, 1.9 * rk2, -fnx * 0.6), tuft(rbx - rdy * 1.4 * fnx, rby + rdx * 1.4 * fnx, rdx * 0.8 + 0.2 * fnx, rdy, 0.85, 1.4 * rk2, -fnx * 0.5));
    }
    if (puff > 0.05 && !edgeArms) {
      var bdx = Cx - Hx, bdy = Cy - Hy, bl2 = Math.sqrt(bdx * bdx + bdy * bdy) || 1, bnx = -bdy / bl2, bny = bdx / bl2, BK = [[0.05, 1.0], [0.27, 0.62], [0.47, 1.15], [0.66, 0.7], [0.86, 0.9]];
      if (bny < 0) { bnx = -bnx; bny = -bny; }
      for (k = 0; k < BK.length; k++) {
        var t0 = BK[k][0], rr0 = lerp(hr, cr, t0) + (b.mid ? Math.sin(PI * t0) * 3 : 0) - 0.4;
        bodySh.push(tuft(lerp(Hx, Cx, t0) + bnx * rr0, lerp(Hy, Cy, t0) + bny * rr0, bnx, bny, 1.25, 2.6 * BK[k][1] * puff, -(bdx / bl2) * 1.2 * puff));
      }
    }

    /* le zampe: vicine nel tracciato nero, lontane in quello più chiaro; i bracci dei bordi a parte */
    var main = bodySh.slice(), far = [], ups = [], hangs = [], grounded = [], arms = [], hinds = [];
    for (i = 0; i < 4; i++) {
      l = legs[i]; if (l.tuck >= 0.95) continue;
      if (edgeArms && l.front) {
        var out = l.fx >= Cx ? 1 : -1, shx = Cx + out * cr * (hangK ? 0.62 : 0.72), shy = Cy + cr * (hangK ? 0.5 : 0.3);
        var pr = l.paw * (hangK ? 1.05 : 1.12), wx, wy;
        if (hangK) { wx = l.fx; wy = l.fy + 0.5; }
        else { wx = l.fx; wy = l.fy; }
        var adx = wx - shx, ady = wy - shy, adl = Math.sqrt(adx * adx + ady * ady) || 1;
        var ex2 = wx - adx / adl * pr * 0.55, ey2 = wy - ady / adl * pr * 0.55;
        main = main.concat(armShape(shx, shy, ex2, ey2, l.r0 * 1.18, l.r1 * 0.98, hangK ? 0.9 : 1.4, out));
        arms.push({ x: wx, y: wy, r: pr, dx: adx / adl, dy: ady / adl });
        continue;
      }
      if (slideK && !l.front) {                                       /* scivola: cosce larghe ai lati, piedi aperti col palmo verso di noi */
        var so = l.fx >= Hx ? 1 : -1, hcx = Hx + so * hr * 0.5, hcy = Hy - hr * 0.12, hdx = l.fx - hcx, hdy = l.fy - hcy, hdl = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
        main.push(ellP(hcx, hcy, hr * 0.56, hr * 0.7, Math.atan2(hdy, hdx), 18), caps(hcx, hcy, hr * 0.42, l.fx - hdx / hdl * l.paw * 0.5, l.fy - hdy / hdl * l.paw * 0.5, l.r1, 9));
        var tdx = hdx / hdl * 0.55 + so * 0.35, tdy = hdy / hdl * 0.55 + 0.3, tdl = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        hinds.push({ x: l.fx, y: l.fy, r: l.paw * 1.1, dx: tdx / tdl, dy: tdy / tdl });
        continue;
      }
      if (l.up && !edgeArms) { ups.push(i); continue; }
      if (env.pawsOnEdge && l.front) continue;
      var dangle = pose === "drape" && l.near && l.fy < -4;
      g = legShape(l, f, { noGround: hangK > 0 || dangle, noHaunch: dangle });
      if (l.near) { main = main.concat(g.sh); if (dangle) hangs.push({ p: g.sh[0], y: l.jy - l.r0 * 0.3 }); if (g.gk > 0.6) grounded.push(g); }
      else far = far.concat(g.sh);
    }
    /* zampe nascoste (pagnotta, dorme): si vedono appena le punte davanti */
    for (i = 0; i < 2; i++) { l = legs[i]; if (l.tuck > 0.5) { var tk = smooth(0.5, 1, l.tuck), tpx = l.fx + fnx * 3.2 * Math.min(1, fwl * 1.4) + (i ? -1 : 1) * 1.6 * (1 - Math.min(1, fwl * 1.4)), tpy = Math.max(1.1, l.fy - 1);
      (i && l.near === false ? far : main).push(ellP(tpx, tpy, 2.15 * tk, 1.3 * tk, 0, 14, 0.05)); } }

    var eg = [earPts(f.ears[0], h.x, h.y), earPts(f.ears[1], h.x, h.y)], farE = f.ears[0].depth < f.ears[1].depth ? 0 : 1, sepE = Math.abs(f.ears[0].depth - f.ears[1].depth) > 2.2;
    if (sepE) far.push(eg[farE].p);
    var rxe = h.depth + (h.rx - h.depth) * Math.abs(h.fz), nlx = (f.nose.x - h.x) * uy - (f.nose.y - h.y) * ux, nly = (f.nose.x - h.x) * ux + (f.nose.y - h.y) * uy;
    var headOut = toScreen(headLocal(rxe, h.ry, puff), h.x, h.y, ux, uy);
    main.push(headOut, toScreen(ellP(nlx * 0.78, nly - 1.1, 3.6, 2.9, 0, 14), h.x, h.y, ux, uy));
    for (i = 0; i < 2; i++) if (!sepE || i !== farE) main.push(eg[i].p);
    var tailSh = tailPts(f);

    /* 1. dietro: la coda (se è dietro), le parti lontane */
    if (!f.tail.front) solid(c, [tailSh], th.ink, th.rim, d); else main.push(tailSh);
    if (far.length) solid(c, far, th.far, th.rimFar, d * 0.9);
    if (sepE) innerEar(c, eg[farE], f.ears[farE].w, 0.5 * smooth(-0.3, 0.6, h.fz), f.ears[farE].flat, S);
    /* 2. tutto il nero vicino in un colpo */
    solid(c, main, th.ink, th.rim, d);
    /* 3. un velo di luce sul dorso e uno sulla fronte, nient'altro */
    var sh = Gr[th.sheen];
    if (!edgeArms || slideK) {
      c.save(); c.beginPath(); emit(c, bodySh, 0, 0); c.clip();
      var top = Math.max(Hy + hr, Cy + cr), bx0 = Math.min(Hx - hr, Cx - cr), bx1 = Math.max(Hx + hr, Cx + cr), bw = bx1 - bx0;
      blob(c, sh, lerp(bx0, bx1, 0.4), top - hr * 0.3, bw * 0.38, hr * 0.42, Math.atan2(Cy - Hy, Cx - Hx) * 0.5, th.sheenA * 0.8);
      c.restore();
    }
    /* il filo di separazione dove le zampe pendono davanti al corpo (a cavallo del bordo, come nel riferimento 09) */
    if (hangs.length) {
      c.save(); c.beginPath(); emit(c, bodySh, 0, 0); c.clip(); c.strokeStyle = th.sep; c.lineWidth = Math.max(0.28, 0.9 / S); c.lineJoin = "round";
      for (i = 0; i < hangs.length; i++) { c.save(); c.beginPath(); c.rect(-500, -500, 1000, hangs[i].y + 500); c.clip(); c.beginPath(); poly(c, hangs[i].p, 0, 0); c.stroke(); c.restore(); }
      c.restore();
    }
    for (i = 0; i < grounded.length; i++) toes(c, grounded[i], th, S);

    /* 4. il muso: velo sulla fronte, bagliore degli occhi, orecchie dentro, occhi, naso, bocca, baffi */
    c.save(); c.beginPath(); poly(c, headOut, 0, 0); c.clip();
    c.save(); c.translate(h.x, h.y); c.transform(uy, -ux, ux, uy, 0, 0);
    blob(c, sh, -rxe * 0.34 + nlx * 0.18, h.ry * 0.66, rxe * 0.62, h.ry * 0.4, 0, th.sheenA);
    c.restore();
    if (th.glow > 0) for (i = 0; i < 2; i++) { var e0 = f.eyes[i]; if (e0.vis > 0.1 && e0.open > 0.2) blob(c, Gr.glow, e0.x, e0.y, e0.r * 1.9, e0.r * 1.9, 0, th.glow * e0.vis * Math.min(1, e0.open)); }
    c.restore();
    for (i = 0; i < 2; i++) if (!sepE || i !== farE) innerEar(c, eg[i], f.ears[i].w, smooth(-0.3, 0.55, h.fz) * (1 - 0.35 * f.ears[i].flat), f.ears[i].flat, S);
    var ss = (h.s[0] * uy - h.s[1] * ux) >= 0 ? 1 : -1;
    for (i = 0; i < 2; i++) eyeDraw(c, f.eyes[i], ux, uy, ss, th, S, Gr);
    face(c, f, h, ux, uy, th, S);
    /* 5. il fez */
    if (f.fez) {
      var fz = f.fez, fax = fz.tx - fz.x, fay = fz.ty - fz.y, fal = Math.sqrt(fax * fax + fay * fay) || 1, tsx = -fay / fal, tsy = fax / fal, tdx2 = fz.tassel.x0 - fz.tx, tdy2 = fz.tassel.y0 - fz.ty;
      if (tsx * tdx2 + tsy * tdy2 < 0) { tsx = -tsx; tsy = -tsy; }    /* la nappa scende dal lato, non davanti */
      var ex3 = fz.tx + tsx * fz.rTop * 0.98, ey3 = fz.ty + tsy * fz.rTop * 0.98, push = fz.rBase * 1.2 - fz.rTop * 0.7;
      fezBody(c, fz.x, fz.y, fz.tx, fz.ty, fz.rBase, fz.rTop, fz.ell, fz.top, Gr); tasselDraw(c, fz.tx, fz.ty, ex3, ey3, fz.tassel.x1 + tsx * push, fz.tassel.y1 + tsy * push, S);
    }

    /* 6. zampe alzate davanti alla testa (si lava, zampata): affusolate dalla spalla */
    for (k = 0; k < ups.length; k++) {
      i = ups[k]; l = legs[i];
      var usx = Cx + fnx * cr * 0.35 * fa, usy = Cy + cr * 0.4, kn = ik(usx, usy, l.fx, l.fy, P.leg.len * 1.1);
      g = legShape(l, f, { noGround: true, sx: usx, sy: usy, kx: kn[0], ky: kn[1], r0k: 1.1 });
      /* la zampa davanti al muso: un filo la stacca (si traccia prima e poi si riempie sopra: resta solo il bordo esterno) */
      c.save(); c.beginPath(); poly(c, headOut, 0, 0); emit(c, bodySh, 0, 0); c.clip(); c.strokeStyle = th.sep; c.lineWidth = Math.max(0.56, 1.8 / S); c.lineJoin = "round";
      c.beginPath(); emit(c, g.sh, 0, 0); c.stroke(); c.restore();
      solid(c, g.sh, l.near ? th.ink : th.far, l.near ? th.rim : th.rimFar, d);
    }
    /* 7. zampette dei bordi */
    for (k = 0; k < arms.length; k++) { var am = arms[k]; if (hangK) gripPaw(c, am.x, am.y, am.r, th, S, d); else palmPaw(c, am.x, am.y, am.r, am.dx, am.dy, th, S, d); }
    for (k = 0; k < hinds.length; k++) { var hp = hinds[k]; palmPaw(c, hp.x, hp.y, hp.r, hp.dx, hp.dy, th, S, d); }
    c.restore();

    /* 8. le zampe davanti posate sul bordo (spunta): fuori dal ritaglio, sopra tutto */
    if (env.pawsOnEdge) for (i = 0; i < 2; i++) { l = legs[i]; edgePaw(c, l.fx, 0, l.paw * 1.1, th, S, d); }
  }

  /* naso, bocca, baffi */
  function face(c, f, h, ux, uy, th, S) {
    var i, k;
    if (f.nose.vis > 0.25) {
      c.save(); c.globalAlpha = f.nose.vis; c.translate(f.nose.x, f.nose.y); c.transform(uy, -ux, ux, uy, 0, 0);
      c.fillStyle = NOSE; c.beginPath(); c.moveTo(-1.25, 0.5); c.quadraticCurveTo(0, 0.95, 1.25, 0.5); c.quadraticCurveTo(0.6, -0.3, 0, -0.75); c.quadraticCurveTo(-0.6, -0.3, -1.25, 0.5); c.fill();
      c.fillStyle = "rgba(255,232,238,.5)"; c.beginPath(); c.ellipse(-0.35, 0.42, 0.42, 0.2, 0, 0, TAU); c.fill(); c.restore();
    }
    var m = f.mouth;
    if (m.vis > 0.25) {
      c.save(); c.globalAlpha = m.vis; c.translate(m.x, m.y + 0.4); c.transform(uy, -ux, ux, uy, 0, 0); c.scale(0.5 + 0.5 * smooth(0, 1, h.fz), 1);
      if (m.open > 0.06) {
        var mw = 1.4 + 1.5 * m.open, mh = 0.6 + 3.3 * m.open;
        c.fillStyle = "#3a1520"; c.beginPath(); c.moveTo(-mw, 0); c.quadraticCurveTo(0, 0.5, mw, 0); c.bezierCurveTo(mw, -mh * 0.7, mw * 0.5, -mh, 0, -mh); c.bezierCurveTo(-mw * 0.5, -mh, -mw, -mh * 0.7, -mw, 0); c.fill();
        c.save(); c.clip(); c.fillStyle = "#e07b90"; c.beginPath(); c.ellipse(0, -mh * 1.02, mw * 0.72, mh * 0.45, 0, 0, TAU); c.fill(); c.restore();
        if (m.open > 0.45 && S > 1.8) { c.fillStyle = "#f4f0f2"; c.beginPath(); for (i = -1; i <= 1; i += 2) { c.moveTo(i * mw * 0.72, -0.05); c.lineTo(i * mw * 0.44, -0.05); c.lineTo(i * mw * 0.6, -0.75 - 0.3 * m.open); c.closePath(); } c.fill(); }
      } else if (S > 2) {
        c.strokeStyle = th.line; c.lineWidth = Math.max(0.22, 0.7 / S); c.lineCap = "round";
        c.beginPath(); c.moveTo(0, 0.55); c.lineTo(0, 0); c.quadraticCurveTo(-0.55, -0.55, -1.15, -0.05); c.moveTo(0, 0); c.quadraticCurveTo(0.55, -0.55, 1.15, -0.05); c.stroke();
      }
      c.restore();
    }
    c.strokeStyle = th.whisk; c.lineWidth = Math.max(0.24, 0.62 / S); c.lineCap = "round";
    for (i = 0; i < 2; i++) {
      var wq = f.whiskers[i]; if (wq.vis < 0.05) continue; c.globalAlpha = wq.vis; c.beginPath();
      for (k = -1; k <= 1; k++) {
        var a = k * 0.26 - 0.04, ca = Math.cos(a), sa = Math.sin(a), wdx = wq.dx * ca - wq.dy * sa, wdy = wq.dx * sa + wq.dy * ca, wl = wq.len * (1 - 0.12 * Math.abs(k)), sx0 = wq.x - ux * k * 0.55, sy0 = wq.y - uy * k * 0.55;
        c.moveTo(sx0, sy0); c.quadraticCurveTo(sx0 + wdx * wl * 0.55, sy0 + wdy * wl * 0.55 + 0.25, sx0 + wdx * wl, sy0 + wdy * wl - 0.5 - 0.3 * k);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* il fez quando non è in testa: fz = { rBase, rTop, h, ell, top, tasselAng }, origine al centro della base, dritto */
  function drawFez(c, fz, env) {
    env = env || {}; var S = env.scale || 2.6, ell = fz.ell == null ? 0.22 : fz.ell, Gr = G(c);
    blob(c, Gr.shadow, 0.6, -0.15, fz.rBase * 1.5, fz.rBase * 0.45, 0, 0.65);
    fezBody(c, 0, 0, 0, fz.h, fz.rBase, fz.rTop, ell, fz.top !== false, Gr);
    var a = fz.tasselAng || 0, x0 = -fz.rTop * 0.98, y0 = fz.h, L = (fz.tassel || 6.4), x1 = -fz.rBase * 1.2;
    tasselDraw(c, 0, fz.h, x0, y0, x1 + L * Math.sin(a), y0 - L * Math.cos(a), S);
  }

  /* ---------------------------------------------------------------- gli oggetti di Dot (origine alla base, y in su; p = { t, frame }) */
  var KUKKO = ["#ffb6c1", "#fdfd96", "#ffb347", "#77dd77", "#aec6cf", "#ff6961"];
  /* le zampe davanti sopra l'oggetto: «wrap» = abbracciano i lati (xl, xr all'altezza yh), altrimenti dove sono davvero.
     Serve sapere dov'è il gatto rispetto all'oggetto: lo dà la trasformazione salvata in draw() (se il browser la offre). */
  function holdPaws(c, env, p, wrap, xl, xr, yh) {
    var f = (p && p.frame) || last.f; if (!f || !last.T || typeof c.getTransform !== "function") return;
    var R; try { R = last.T.inverse().multiply(c.getTransform()); } catch (er) { return; }
    var ox = R.e, oy = R.f; if (Math.abs(ox - f.hold.x) > 9 || Math.abs(oy - f.hold.y) > 9) return;
    var th = env && env.dark === false ? TH.light : TH.dark, S = (env && env.scale) || 2.6, d = Math.max(0.32, 1.0 / S), i, order = [1, 0];
    c.save(); c.translate(-ox, -oy);
    var L0 = f.legs[0], L1 = f.legs[1], leftI = L0.fx <= L1.fx ? 0 : 1;
    for (var n = 0; n < 2; n++) {
      i = order[n]; var l = f.legs[i], sh, pr = l.paw * (wrap ? 0.88 : 1);
      if (wrap) {
        var tx = ox + (i === leftI ? xl : xr), ty = oy + yh, dx = tx - l.kx, dy = ty - l.ky, dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / dl, uy = dy / dl, rk = (l.r0 + l.r1) / 2;
        sh = [caps(l.kx, l.ky, rk, tx - ux * pr * 0.3, ty - uy * pr * 0.3, l.r1, 9), ellP(tx, ty, pr * 0.95, pr * 0.82, Math.atan2(uy, ux), 18)];
      } else sh = legShape(l, f, { noUpper: true, noHaunch: true }).sh;
      solid(c, sh, wrap || !i ? th.ink : th.far, wrap || !i ? th.rim : th.rimFar, d);
    }
    c.restore();
  }
  function drawProp(c, name, p, env) {
    p = p || {}; env = env || {}; var t = p.t || 0, i, j, dark = env.dark !== false, Gr = G(c);
    if (name === "tea") {                                             /* il bicchiere di tè alla menta */
      var H = 8.4, wb = 2.3, wt = 3.25;
      c.fillStyle = "rgba(255,255,255,.16)"; c.beginPath(); c.moveTo(-wb, 0); c.lineTo(wb, 0); c.lineTo(wt, H); c.lineTo(-wt, H); c.closePath(); c.fill();
      c.fillStyle = Gr.tea; c.beginPath(); c.moveTo(-wb + 0.25, 1.05); c.lineTo(wb - 0.25, 1.05); c.lineTo(lerp(wb, wt, 0.8) - 0.25, H * 0.8); c.lineTo(-lerp(wb, wt, 0.8) + 0.25, H * 0.8); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,220,150,.5)"; c.beginPath(); c.ellipse(0, H * 0.8, lerp(wb, wt, 0.8) - 0.25, 0.42, 0, 0, TAU); c.fill();
      c.strokeStyle = "#3f7d33"; c.lineWidth = 0.35; c.lineCap = "round"; c.beginPath(); c.moveTo(0.4, H * 0.55); c.quadraticCurveTo(0.9, H * 0.9, 1.5, H + 1.6); c.stroke();   /* la menta */
      var lv = [[1.5, H + 1.7, 0.9], [0.6, H + 0.9, 2.3], [2.3, H + 0.8, -0.4]];
      for (i = 0; i < 3; i++) { c.fillStyle = i ? "#5fae45" : "#7cc95a"; c.save(); c.translate(lv[i][0], lv[i][1]); c.rotate(lv[i][2]); c.beginPath(); c.moveTo(-1.2, 0); c.quadraticCurveTo(0, 0.85, 1.2, 0); c.quadraticCurveTo(0, -0.85, -1.2, 0); c.fill(); c.strokeStyle = "rgba(30,70,25,.6)"; c.lineWidth = 0.15; c.beginPath(); c.moveTo(-1, 0); c.lineTo(1, 0); c.stroke(); c.restore(); }
      c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.moveTo(-wb + 0.55, 0.7); c.lineTo(-wb + 1.0, 0.7); c.lineTo(-wt + 1.15, H - 1.2); c.lineTo(-wt + 0.7, H - 1.2); c.closePath(); c.fill();   /* vetro */
      c.fillStyle = "#e2b24a"; c.beginPath(); c.moveTo(-lerp(wb, wt, 0.86), H * 0.86); c.lineTo(lerp(wb, wt, 0.86), H * 0.86); c.lineTo(lerp(wb, wt, 0.94), H * 0.94); c.lineTo(-lerp(wb, wt, 0.94), H * 0.94); c.closePath(); c.fill();
      c.fillStyle = "#b5832a"; c.fillRect(-wb, 0, 2 * wb, 0.35);
      c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 0.22; c.beginPath(); c.ellipse(0, H, wt, 0.5, 0, 0, TAU); c.stroke();
      c.fillStyle = "rgba(255,255,255,.28)"; c.beginPath(); c.ellipse(0, 0.35, wb, 0.35, 0, 0, TAU); c.fill();
      c.lineCap = "round"; c.strokeStyle = Gr[dark ? "steamD" : "steamL"]; c.lineWidth = 0.55; c.beginPath();   /* il filo di vapore */
      for (i = 0; i < 2; i++) { var ph = t * 1.3 + i * 2.1, x0 = -0.8 + i * 1.5; c.moveTo(x0, H + 0.6); c.bezierCurveTo(x0 + 1.4 * Math.sin(ph), H + 2.4, x0 - 1.4 * Math.sin(ph + 1), H + 4.4, x0 + 0.6 * Math.sin(ph + 2), H + 6.6); }
      c.stroke();
      if (!dark) { c.strokeStyle = "rgba(60,60,80,.25)"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(-wb, 0); c.lineTo(-wt, H); c.moveTo(wb, 0); c.lineTo(wt, H); c.stroke(); }
      holdPaws(c, env, p, true, -wb - 0.45, wb + 0.45, 2.9);
    } else if (name === "cube") {                                     /* il cubo, nei colori pastello di Imad (plastica bianca) */
      var s = 6.4, ox = 1.9, oy = 1.5, gap = 0.2, q = (s - 4 * gap) / 3, cols = [2, 0, 3, 1, 5, 2, 4, 3, 0], tops = [0, 3, 0, 1, 0, 4, 2, 0, 5], side = [3, 1, 3, 5, 3, 0, 3, 2, 4], x0c = -s / 2 - ox * 0.3;
      c.fillStyle = "#e9e5dc"; c.beginPath(); c.moveTo(x0c, 0); c.lineTo(x0c + s, 0); c.lineTo(x0c + s + ox, oy); c.lineTo(x0c + s + ox, s + oy); c.lineTo(x0c + ox, s + oy); c.lineTo(x0c, s); c.closePath(); c.fill();
      c.fillStyle = "#c9c4b9"; c.beginPath(); c.moveTo(x0c + s, 0); c.lineTo(x0c + s + ox, oy); c.lineTo(x0c + s + ox, s + oy); c.lineTo(x0c + s, s); c.closePath(); c.fill();
      c.fillStyle = "#fbf9f4"; c.beginPath(); c.moveTo(x0c, s); c.lineTo(x0c + s, s); c.lineTo(x0c + s + ox, s + oy); c.lineTo(x0c + ox, s + oy); c.closePath(); c.fill();
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
        c.fillStyle = KUKKO[cols[i * 3 + j]]; rr(c, x0c + gap + j * (q + gap), gap + (2 - i) * (q + gap), q, q, 0.35);
        var u0 = (j + 0.12) / 3, u1 = (j + 0.88) / 3, v0 = (i + 0.12) / 3, v1 = (i + 0.88) / 3;
        c.fillStyle = TOPC[tops[i * 3 + j]]; quad(c, x0c + u0 * s + v0 * ox, s + v0 * oy, x0c + u1 * s + v0 * ox, s + v0 * oy, x0c + u1 * s + v1 * ox, s + v1 * oy, x0c + u0 * s + v1 * ox, s + v1 * oy);
        c.fillStyle = SIDEC[side[i * 3 + j]]; quad(c, x0c + s + v0 * ox, u0 * s + v0 * oy, x0c + s + v1 * ox, u0 * s + v1 * oy, x0c + s + v1 * ox, u1 * s + v1 * oy, x0c + s + v0 * ox, u1 * s + v0 * oy);
      }
      c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x0c, s); c.lineTo(x0c + ox, s + oy); c.lineTo(x0c + ox + s * 0.5, s + oy); c.lineTo(x0c + s * 0.5, s); c.closePath(); c.fill();
      holdPaws(c, env, p, true, x0c + 0.2, x0c + s + ox * 0.6, 2.6);
    } else if (name === "yarn") {                                     /* il gomitolo rosa, col filo che scappa */
      var Ry = 3.8;
      c.strokeStyle = "#e88fa2"; c.lineWidth = 0.5; c.lineCap = "round"; c.beginPath(); c.moveTo(2.6, 1); c.bezierCurveTo(5.5, -0.2, 7, 0.6, 8.5, 0.25); c.bezierCurveTo(10, -0.1, 10.5, 1.6, 9.2, 1.5); c.stroke();
      c.fillStyle = Gr.yarn; c.beginPath(); c.arc(0, Ry, Ry, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, Ry, Ry, 0, TAU); c.clip(); c.lineWidth = 0.32;
      for (i = 0; i < 7; i++) { c.strokeStyle = i % 2 ? "rgba(150,50,80,.45)" : "rgba(255,235,240,.5)"; c.beginPath(); c.ellipse(0, Ry, Ry * 1.02, Ry * (0.25 + 0.11 * i), 0.5 + i * 0.42, 0, TAU); c.stroke(); }
      c.restore();
    } else if (name === "star") {                                     /* la stella-punto del sito, d'oro, che vibra piano */
      var tw = 0.85 + 0.15 * Math.sin(t * 5.3);
      blob(c, Gr.halo, 0, 0, 7 * tw, 7 * tw, 0, 1);
      c.fillStyle = "rgba(255,236,180,.9)"; c.save(); c.rotate(0.2 + t * 0.4); c.beginPath();
      for (i = 0; i < 4; i++) { c.rotate(PI / 2); c.moveTo(0, 0.5); c.lineTo(0.42, 0); c.lineTo(0, 3.6 * tw); c.lineTo(-0.42, 0); c.closePath(); }
      c.fill(); c.restore();
      c.fillStyle = Gr.core; c.beginPath(); c.arc(0, 0, 1.45, 0, TAU); c.fill();
    } else if (name === "laptop") {                                   /* il portatile: tastiera di tre quarti, schermo verso il gatto */
      c.fillStyle = "#a8acb8"; quad(c, -7.2, 0, 5.6, 0, 7.6, 1.9, -5.2, 1.9);
      c.fillStyle = "#d3d6de"; quad(c, -7.2, 0.45, 5.6, 0.45, 7.6, 2.3, -5.2, 2.3);
      c.fillStyle = "rgba(60,64,80,.35)"; for (i = 0; i < 3; i++) quad(c, -5.6 + i * 0.25, 0.85 + i * 0.42, 4.2 + i * 0.25, 0.85 + i * 0.42, 4.4 + i * 0.25, 1.1 + i * 0.42, -5.4 + i * 0.25, 1.1 + i * 0.42);
      c.fillStyle = "#b9bcc7"; quad(c, -5.2, 2.3, 7.6, 2.3, 9.2, 11, -3.6, 11);
      c.fillStyle = "#0d1226"; quad(c, -4.5, 2.95, 6.9, 2.95, 8.35, 10.35, -2.95, 10.35);
      var lines = [[0.3, 5.2], [1.2, 3.5], [1.2, 4.6], [0.3, 2.8], [2.1, 3.9], [1.2, 2.4], [0.3, 4.4]], off = (t * 2.2) % 1;
      c.save(); c.beginPath(); quadPath(c, -4.5, 2.95, 6.9, 2.95, 8.35, 10.35, -2.95, 10.35); c.clip();
      for (i = 0; i < lines.length; i++) { var yy = 9.4 - (i + off) * 0.95, sk = (yy - 2.95) / 7.4 * 1.45; c.fillStyle = i % 3 === 2 ? "#a6e3ff" : "#7de08a"; c.globalAlpha = 0.95 - i * 0.08; c.fillRect(-3.8 + sk + lines[i][0], yy, lines[i][1], 0.42); }
      c.globalAlpha = 1; blob(c, Gr.screen, 2.5, 7.5, 7, 7, 0, 1); c.restore();
      c.fillStyle = "rgba(255,255,255,.12)"; quad(c, -4.5, 2.95, -2.6, 2.95, 0.4, 10.35, -2.95, 10.35);
      holdPaws(c, env, p, false);
    }
  }
  var TOPC = KUKKO.map(function (k) { return mix(k, "#ffffff", 0.12); }), SIDEC = KUKKO.map(function (k) { return mix(k, "#7a7468", 0.22); });   /* i colori del cubo, una volta sola */
  function quadPath(c, a, b, cc, d, e, f, g, h) { c.moveTo(a, b); c.lineTo(cc, d); c.lineTo(e, f); c.lineTo(g, h); c.closePath(); }
  function quad(c, a, b, cc, d, e, f, g, h) { c.beginPath(); quadPath(c, a, b, cc, d, e, f, g, h); c.fill(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.fill(); }

  /* ---------------------------------------------------------------- proporzioni e pose di questo aspetto */
  var preset = {
    props: { headRx: 12.2, headRy: 10, headDepth: 9.8, eye: { r: 4.2, side: 5.05, up: -0.4 }, ear: { w: 4.7, tipUp: 15.9, tipSide: 8.9 },
      leg: { r0: 3.4, r1: 2.5, paw: 2.85 }, tail: { len: 28, r0: 3.3, r1: 2.0 }, chestR: 7.6, hipR: 8.6 },
    poses: {
      /* appeso: la testa subito sotto il bordo, le braccia su dietro la testa fino alle zampette aggrappate, il corpo che pende */
      hang: { hx: 0, hy: -28, cx: 0, cy: -18.5, dx: 0.2, dy: 4.2, f0x: 0.6, f0y: 0.7, f1x: 0.6, f1y: 0.7, fs: 3.0, fo: 6.6, f2x: 0.6, f2y: -38, f3x: 0.6, f3y: -38, hs: -0.6, ho: 3.0,
        tby: -6, te: -1.0, tc: 1.1, tw: 0.6, eye: 1.08, lid: 0.1, brow: -0.6, hp: 0.12, ear: 0.35, br: 0.4 },
      peek: { cy: -5.2, dy: 13.2, eye: 1.08 },
      drape: { hy: 5.2, cy: 5.4, dy: 4.4, hp: 0.04, sqy: 0.9, f0x: 8.6, f0y: -11.5, f2x: -5.2, f2y: -11, lid: 0.3 },
      sit: { tw: 1.7, te: -0.25, tc: 0.12, tby: -6.4 },
      /* scivola (riferimento 06): un braccio più su dell'altro, cosce larghe, piedi aperti col palmo, pelo gonfio, occhi sbarrati */
      slide: { hx: 0, hy: -15, cx: 0, cy: -6.5, dx: 0.6, dy: 9, f0x: 0.8, f0y: 13, f1x: 0.8, f1y: 7.5, fs: 2.8, fo: 8.0, f2x: 0.8, f2y: -21, f3x: 0.8, f3y: -21, hs: 1.2, ho: 6.4,
        tby: -5, te: -0.95, tc: 1.15, tw: -0.6, eye: 1.3, ear: 0.4, puff: 0.45, mouth: 0.22, brow: -0.3 },
      hold: { fs: 0.5 }, sip: { fs: 0.5 },
      bat: { f0x: 13, f0y: 25.2 }, groom: { f0x: 9.2, f0y: 27.5, eye: 0 }
    }
  };

  DOT.looks.pelo = { label: "Pelo", preset: preset, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
