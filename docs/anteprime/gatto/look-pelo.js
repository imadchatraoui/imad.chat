/* look-pelo.js — l'aspetto «Pelo» di Dot: antracite molto scuro con due o tre piani di luce morbidi (dorso, guancia,
   petto), un filo di luce sul lato illuminato (la luce viene da in alto a sinistra), orecchie dentro grigio-rosa,
   occhi verdi che brillano piano, pochi ciuffi puliti su guance e petto. È l'aspetto con più profondità: 2D, ma con volume.
   Un aspetto NON muove nulla: disegna il fotogramma di dot-rig.js (vedi look-base.js per il contratto).
   Ogni parte è un poligono unico (niente cerchi impilati): si riempie, poi un bordo di luce e i piani dentro un ritaglio.
   Niente canvas nuovi e niente shadowBlur a ogni fotogramma: le ombre morbide sono sfumature. Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var PI = Math.PI, TAU = PI * 2;
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { var t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return "rgb(" + Math.round(lerp(A[0], B[0], t)) + "," + Math.round(lerp(A[1], B[1], t)) + "," + Math.round(lerp(A[2], B[2], t)) + ")"; }
  function rgba(rgb, a) { return "rgba(" + rgb + "," + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ")"; }

  /* i colori: il pelo è lo stesso, cambia solo il filo di luce (freddo sul buio, quasi niente sul chiaro) */
  var INK = "#1d1c23", FARC = "#2b2a33";
  var TH = {
    dark: { ink: INK, far: FARC, r1: mix(INK, "#b9c7ff", 0.4), r2: mix(INK, "#b9c7ff", 0.13), f1: mix(FARC, "#b9c7ff", 0.24), f2: mix(FARC, "#b9c7ff", 0.08),
      plane: "140,138,170", shade: "5,5,9", whisk: "rgba(228,232,250,.74)", closed: "rgba(205,214,240,.78)", glow: 0.3, line: "rgba(160,158,190,.38)" },
    light: { ink: INK, far: "#3b3a44", r1: mix(INK, "#ffffff", 0.2), r2: mix(INK, "#ffffff", 0.08), f1: mix("#3b3a44", "#ffffff", 0.12), f2: mix("#3b3a44", "#ffffff", 0.05),
      plane: "160,157,186", shade: "0,0,0", whisk: "rgba(150,152,174,.95)", closed: "rgba(205,212,236,.8)", glow: 0.12, line: "rgba(170,168,198,.4)" }
  };
  var PAD = "#6e5560", PAD2 = "#8a6b78", EAR1 = "#6f5a66", EAR2 = "#a88e9b", NOSE = "#a97a88";

  /* ---------------------------------------------------------------- forme: poligoni piatti [x, y, x, y, ...] */
  function area(p) { var a = 0, n = p.length, i, j; for (i = 0; i < n; i += 2) { j = (i + 2) % n; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return a; }
  /* tutti i poligoni girano nello stesso verso: così l'unione con «nonzero» non lascia mai buchi */
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
  /* capsula affusolata: due cerchi uniti dalle tangenti esterne */
  function caps(x0, y0, r0, x1, y1, r1, n) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy), out = [], i, a; n = n || 10;
    if (d <= Math.abs(r0 - r1) + 0.01) return r0 > r1 ? ellP(x0, y0, r0, r0, 0, 2 * n) : ellP(x1, y1, r1, r1, 0, 2 * n);
    var A = Math.atan2(dy, dx), ph = Math.acos((r0 - r1) / d), n1 = Math.max(3, Math.round(n * ph / PI)), n0 = Math.max(3, Math.round(n * (PI - ph) / PI));
    for (i = 0; i <= n1; i++) { a = A - ph + 2 * ph * i / n1; out.push(x1 + r1 * Math.cos(a), y1 + r1 * Math.sin(a)); }
    for (i = 0; i <= n0; i++) { a = A + ph + (TAU - 2 * ph) * i / n0; out.push(x0 + r0 * Math.cos(a), y0 + r0 * Math.sin(a)); }
    return out;
  }
  /* inviluppo convesso (catena monotona): esce in senso antiorario */
  function hull(pts) {
    var P = [], i, lo = [], up = [];
    for (i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    P.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < P.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 0) lo.pop(); lo.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
    lo.pop(); up.pop(); var H = lo.concat(up), out = []; for (i = 0; i < H.length; i++) out.push(H[i][0], H[i][1]); return out;
  }
  /* ricampiona un contorno chiuso a passo costante */
  function resample(p, step) {
    var n = p.length / 2, out = [], i, carry = 0;
    for (i = 0; i < n; i++) {
      var ax = p[2 * i], ay = p[2 * i + 1], bx = p[(2 * i + 2) % p.length], by = p[(2 * i + 3) % p.length], L = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), s = carry;
      while (s < L) { out.push(ax + (bx - ax) * s / L, ay + (by - ay) * s / L); s += step; }
      carry = s - L;
    }
    return out;
  }
  function bbox(p) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i; for (i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; } return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }

  /* una parte piena: colore, filo di luce in alto a sinistra (la forma meno sé stessa spostata in basso a destra), piani dentro */
  function solid(c, sh, col, r1, r2, d, after, arg) {
    c.save(); c.beginPath(); emit(c, sh, 0, 0); c.clip();
    c.fillStyle = r1; c.fillRect(-300, -300, 600, 600);
    c.fillStyle = r2; c.beginPath(); emit(c, sh, d, -d); c.fill();
    c.fillStyle = col; c.beginPath(); emit(c, sh, 2 * d, -2 * d); c.fill();
    if (after) after(c, arg);
    c.restore();
  }
  function radial(c, x, y, r, rgb, a0, a1, mid, edge) {
    var m = mid == null ? 0.55 : mid, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(rgb, a0)); g.addColorStop(m, rgba(rgb, a1));
    if (edge) g.addColorStop(m + (1 - m) * 0.55, rgba(rgb, a1 * 0.6));   /* piano «dipinto»: bordo morbido ma leggibile */
    g.addColorStop(1, rgba(rgb, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  /* ---------------------------------------------------------------- la testa, nel suo piano (x di lato, y in su) */
  function headLocal(W, H) {
    var n = 60, p = [], i, a, cs, sn, e, x, y, t;
    for (i = 0; i < n; i++) {
      a = -PI / 2 + TAU * i / n; cs = Math.cos(a); sn = Math.sin(a); e = sn > 0 ? 2.5 : 2.15;
      x = (cs < 0 ? -1 : 1) * Math.pow(Math.abs(cs), 2 / e) * W; y = (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), 2 / e) * H;
      x *= 1 + 0.06 * Math.exp(-Math.pow((sn + 0.28) / 0.3, 2)) - 0.17 * smooth(-0.6, -1, sn);   /* guance piene, mento stretto */
      p.push(x, y);
    }
    /* ciuffi sulle guance: punte nette che scendono un po' */
    var tf = [[-0.3, 0.12], [-0.6, 0.09]], k, s2;
    for (k = 0; k < tf.length; k++) for (s2 = -1; s2 <= 1; s2 += 2) {
      a = s2 > 0 ? tf[k][0] : PI - tf[k][0]; i = Math.round(((a + PI / 2) / TAU) * n) % n; if (i < 0) i += n;
      p[2 * i] *= 1 + tf[k][1]; p[2 * i + 1] -= tf[k][1] * H * 0.7;
    }
    return p;
  }
  function toScreen(p, ox, oy, ux, uy) { var o = [], i; for (i = 0; i < p.length; i += 2) o.push(ox + p[i] * uy + p[i + 1] * ux, oy - p[i] * ux + p[i + 1] * uy); return o; }
  /* orecchio: triangolo con i lati appena curvi, punta morbida, base affondata nella testa */
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
  function innerEar(c, g, w, alpha, flat) {
    if (alpha < 0.03) return;
    var b0x = g.bx + g.ax * 1.4, b0y = g.by + g.ay * 1.4, tL = g.L * 0.74, tx = g.bx + g.ax * tL - g.nx * 0.5, ty = g.by + g.ay * tL - g.ny * 0.5, ww = w * 0.52 * (1 - 0.3 * flat);
    var gr = c.createLinearGradient(b0x, b0y, tx, ty); gr.addColorStop(0, EAR1); gr.addColorStop(1, EAR2);
    c.globalAlpha = alpha; c.fillStyle = gr; c.beginPath();
    c.moveTo(b0x + g.nx * ww, b0y + g.ny * ww); c.quadraticCurveTo((b0x + tx) / 2 + g.nx * ww * 0.7, (b0y + ty) / 2 + g.ny * ww * 0.7, tx, ty);
    c.quadraticCurveTo((b0x + tx) / 2 - g.nx * ww * 0.5, (b0y + ty) / 2 - g.ny * ww * 0.5, b0x - g.nx * ww * 0.8, b0y - g.ny * ww * 0.8); c.closePath(); c.fill();
    /* due peli chiari che escono dall'orecchio */
    c.strokeStyle = "rgba(220,214,230,.5)"; c.lineWidth = 0.22; c.lineCap = "round"; c.beginPath();
    c.moveTo(b0x - g.nx * ww * 0.3, b0y - g.ny * ww * 0.3); c.quadraticCurveTo(b0x + g.ax * 2.5 - g.nx * ww * 0.6, b0y + g.ay * 2.5 - g.ny * ww * 0.6, b0x + g.ax * 4.2 - g.nx * ww * 1.1, b0y + g.ay * 4.2 - g.ny * ww * 1.1); c.stroke();
    c.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- zampe */
  /* due ossa lunghe len/2: il gomito scende (fra le due soluzioni prende quella più bassa) */
  function ik(sx, sy, fx, fy, len) {
    var dx = fx - sx, dy = fy - sy, d = Math.sqrt(dx * dx + dy * dy) || 1, mx = (sx + fx) / 2, my = (sy + fy) / 2;
    if (d >= len) return [mx, my];
    var hb = Math.sqrt(len * len / 4 - d * d / 4), nx = -dy / d, ny = dx / d;
    return ny < 0 ? [mx + nx * hb, my + ny * hb] : [mx - nx * hb, my - ny * hb];
  }
  /* geometria di una zampa: coscia (solo dietro), avambraccio, zampetta; o.shoulder sposta la spalla (bracci alzati) */
  function legShape(l, f, o) {
    o = o || {};
    var jx = o.sx != null ? o.sx : l.jx, jy = o.sy != null ? o.sy : l.jy, kx = o.kx != null ? o.kx : l.kx, ky = o.ky != null ? o.ky : l.ky, fx = l.fx, fy = l.fy;
    var r0 = l.r0 * (o.r0k || 1), r1 = l.r1, rk = (r0 + r1) / 2, P = l.paw, sh = [];
    var dx = fx - kx, dy = fy - ky, dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / dl, uy = dy / dl;
    var gk = o.noGround ? 0 : 1 - smooth(0.8, 3.6, Math.abs(fy)), fa = Math.min(1, Math.abs(f.fwd[0]) * 1.4), sx = f.fwd[0] >= 0 ? 1 : -1;
    var rot = Math.atan2(uy, ux); if (rot > PI / 2) rot -= PI; if (rot < -PI / 2) rot += PI;
    var pcx = lerp(fx + ux * P * 0.3, fx + sx * P * 0.32 * fa, gk), pcy = lerp(fy + uy * P * 0.3, fy + P * 0.64, gk);
    var prx = lerp(P * 1.02, P * (0.92 + 0.26 * fa), gk), pry = lerp(P * 0.8, P * 0.68, gk), prot = rot * (1 - gk);
    if (!l.front && !o.noHaunch) {                                   /* la coscia: un ovale pieno che fa capire il volume */
      var fold = 1 - Math.min(1, Math.sqrt((fx - jx) * (fx - jx) + (fy - jy) * (fy - jy)) / (f.P.leg.len + 0.01)), hr = r0 * (1.05 + 0.4 * fold), hl = Math.sqrt((kx - jx) * (kx - jx) + (ky - jy) * (ky - jy));
      sh.push(ellP(lerp(jx, kx, 0.5), lerp(jy, ky, 0.5) + hr * 0.12, hl * 0.5 + rk * 0.95 * fold + hr * (1 - fold) * 0.9, hr, Math.atan2(ky - jy, kx - jx), 18));
    }
    if (!o.noUpper) sh.push(caps(jx, jy, r0, kx, ky, rk, 9));
    sh.push(caps(kx, ky, rk, pcx - ux * P * 0.2, pcy - uy * P * 0.2, r1, 9));
    if (!o.noPaw) sh.push(ellP(pcx, pcy, prx, pry, prot, 18, gk > 0.5 ? fy - 0.02 : null));
    return { sh: sh, pcx: pcx, pcy: pcy, prx: prx, pry: pry, rot: prot, gk: gk, ux: ux, uy: uy, sx: sx, fa: fa };
  }
  /* dita: due righine scure e la luce sulle punte (solo zampe vicine, a terra, abbastanza grandi) */
  function toes(c, g, th, S) {
    if (g.gk < 0.6 || S < 2) return;
    var i, x, front = g.sx * g.fa;
    c.strokeStyle = "rgba(0,0,0,.7)"; c.lineWidth = Math.max(0.22, 0.7 / S); c.lineCap = "round";
    for (i = -1; i <= 1; i += 2) { x = g.pcx + front * g.prx * 0.45 + i * g.prx * (0.32 - 0.12 * g.fa); c.beginPath(); c.moveTo(x, g.pcy - g.pry * 0.78); c.lineTo(x + front * 0.25, g.pcy + g.pry * 0.05); c.stroke(); }
  }
  /* zampetta vista dal palmo (scivola, appeso): cuscinetti rosa-grigio e unghie chiare verso dir */
  function palmPaw(c, x, y, r, dx, dy, th, S, claws, pads) {
    var nx = -dy, ny = dx, i, sh = [ellP(x, y, r * 1.05, r * 0.95, Math.atan2(dy, dx), 18)];
    for (i = -1; i <= 1; i++) sh.push(ellP(x + dx * r * 0.78 + nx * i * r * 0.62, y + dy * r * 0.78 + ny * i * r * 0.62, r * 0.42, r * 0.42, 0, 10));
    var d = Math.max(0.4, 1.15 / S);
    solid(c, sh, th.ink, th.r1, th.r2, d, function (cc) {
      radial(cc, x - r * 0.4, y + r * 0.4, r * 1.3, th.plane, 0.16, 0.08);
      if (pads) {
        cc.fillStyle = PAD; cc.beginPath(); cc.ellipse(x - dx * r * 0.08, y - dy * r * 0.08, r * 0.52, r * 0.42, Math.atan2(dy, dx), 0, TAU); cc.fill();
        for (i = -1; i <= 1; i++) { cc.fillStyle = i ? PAD : PAD2; cc.beginPath(); cc.arc(x + dx * r * 0.78 + nx * i * r * 0.62, y + dy * r * 0.78 + ny * i * r * 0.62, r * 0.22, 0, TAU); cc.fill(); }
      }
    });
    if (claws) {
      c.strokeStyle = "rgba(236,234,244,.92)"; c.lineWidth = Math.max(0.22, 0.75 / S); c.lineCap = "round";
      for (i = -1; i <= 1; i++) {
        var bx = x + dx * r * 1.12 + nx * i * r * 0.62, by = y + dy * r * 1.12 + ny * i * r * 0.62;
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + dx * r * 0.45, by + dy * r * 0.45, bx + dx * r * 0.55 - nx * r * 0.18, by + dy * r * 0.55 - ny * r * 0.18); c.stroke();
      }
    }
  }
  /* zampetta posata su un bordo (spunta, appeso): ovale largo con tre dita che scendono oltre il bordo */
  function edgePaw(c, x, y, r, th, S, hook) {
    var sh = [ellP(x, y + r * 0.45, r * 1.38, r * 0.9, 0, 20)], i;
    for (i = -1; i <= 1; i++) sh.push(ellP(x + i * r * 0.8, y - r * 0.05, r * 0.5, r * 0.55, 0, 10));
    var d = Math.max(0.4, 1.15 / S);
    solid(c, sh, th.ink, th.r1, th.r2, d, function (cc) {
      radial(cc, x - r * 0.5, y + r * 1.0, r * 1.5, th.plane, 0.22, 0.12);
      var g = cc.createLinearGradient(0, y - r * 0.6, 0, y + r * 0.2); g.addColorStop(0, rgba(th.shade, 0.55)); g.addColorStop(1, rgba(th.shade, 0)); cc.fillStyle = g; cc.fillRect(x - r * 2, y - r, r * 4, r * 1.2);
      cc.strokeStyle = "rgba(0,0,0,.75)"; cc.lineWidth = Math.max(0.22, 0.75 / S); cc.lineCap = "round";
      for (i = -1; i <= 1; i += 2) { cc.beginPath(); cc.moveTo(x + i * r * 0.4, y + r * 0.55); cc.lineTo(x + i * r * 0.4, y - r * 0.45); cc.stroke(); }
    });
    if (hook) {                                                       /* le unghie agganciate al bordo */
      c.strokeStyle = "rgba(236,234,244,.85)"; c.lineWidth = Math.max(0.2, 0.7 / S); c.lineCap = "round";
      for (i = -1; i <= 1; i++) { var bx = x + i * r * 0.8, by = y - r * 0.55; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + 0.1, by - r * 0.35, bx + r * 0.2, by - r * 0.42); c.stroke(); }
    }
  }

  /* ---------------------------------------------------------------- la coda: un tubo affusolato, punta morbida, ciuffi se gonfia */
  function crm(a, b, c, d, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
  function tailPts(f) {
    var p = f.tail.pts, n = p.length, M = 26, X = [], Y = [], R = [], k, puff = f.tail.puff || 0;
    for (k = 0; k < M; k++) {
      var u = k / (M - 1) * (n - 1), i0 = Math.min(n - 2, Math.floor(u)), t = u - i0, a = p[Math.max(0, i0 - 1)], b = p[i0], cc = p[i0 + 1], dd = p[Math.min(n - 1, i0 + 2)];
      X.push(crm(a.x, b.x, cc.x, dd.x, t)); Y.push(crm(a.y, b.y, cc.y, dd.y, t)); R.push(lerp(b.r, cc.r, t) * (1 + 0.12 * Math.sin(PI * k / (M - 1))) * (1 - 0.3 * smooth(0.72, 1, k / (M - 1))));   /* un filo più piena a metà, punta morbida */
    }
    var Lp = [], Rp = [], tx, ty, tl, nx, ny, r;
    for (k = 0; k < M; k++) {
      tx = X[Math.min(M - 1, k + 1)] - X[Math.max(0, k - 1)]; ty = Y[Math.min(M - 1, k + 1)] - Y[Math.max(0, k - 1)]; tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl; nx = -ty; ny = tx;
      var fl = k > 3 && k < M - 1 ? puff : 0, rl = R[k] * (1 + fl * (0.4 + 0.22 * Math.cos(k * 2.3))), rr2 = R[k] * (1 + fl * (0.4 + 0.22 * Math.cos(k * 2.3 + 2)));
      var tip = k > 3 && k % 5 === 0 ? fl : 0;                     /* qualche ciuffo appuntito, piegato verso la radice */
      Lp.push(X[k] + nx * rl * (1 + 0.25 * tip) - tx * 1.2 * tip, Y[k] + ny * rl * (1 + 0.25 * tip) - ty * 1.2 * tip); Rp.push(X[k] - nx * rr2, Y[k] - ny * rr2);
    }
    var out = Lp.slice(), i, a2, e = M - 1, rr = R[e];
    for (i = 1; i < 6; i++) { a2 = PI / 2 - PI * i / 6; var ca = Math.cos(a2), sa = Math.sin(a2); out.push(X[e] + (tx * ca * 1.3 + nx * sa) * rr, Y[e] + (ty * ca * 1.3 + ny * sa) * rr); }   /* punta un po' allungata */
    for (k = M - 1; k >= 0; k--) out.push(Rp[2 * k], Rp[2 * k + 1]);
    return out;
  }

  /* ---------------------------------------------------------------- il fez di feltro con la nappa */
  function fezBody(c, x, y, tx, ty, rB, rT, ell, top, th, S) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    var g = c.createLinearGradient(-rB, 0, rB, 0); g.addColorStop(0, "#e2493f"); g.addColorStop(0.32, "#c92a2f"); g.addColorStop(0.75, "#9c1824"); g.addColorStop(1, "#6e0f1a");
    c.fillStyle = g; c.beginPath(); c.moveTo(-rB, 0);
    c.ellipse(0, 0, rB, rB * ell, 0, PI, TAU, true);                /* bordo di sotto: metà davanti dell'ellisse */
    c.lineTo(rT, len); c.ellipse(0, len, rT, rT * ell, 0, 0, PI, false); c.closePath(); c.fill();
    /* il feltro: una lama di luce morbida e un'ombra alla base */
    var g2 = c.createLinearGradient(-rB, 0, -rB * 0.1, 0); g2.addColorStop(0, "rgba(255,190,170,0)"); g2.addColorStop(0.55, "rgba(255,190,170,.2)"); g2.addColorStop(1, "rgba(255,190,170,0)");
    c.fillStyle = g2; c.beginPath(); c.moveTo(-rB * 0.9, -rB * ell * 0.4); c.lineTo(-rB * 0.2, -rB * ell * 0.9); c.lineTo(-rT * 0.15, len); c.lineTo(-rT * 0.85, len); c.closePath(); c.fill();
    var g3 = c.createLinearGradient(0, -rB * ell, 0, len * 0.3); g3.addColorStop(0, "rgba(40,0,8,.45)"); g3.addColorStop(1, "rgba(40,0,8,0)"); c.fillStyle = g3;
    c.beginPath(); c.moveTo(-rB, 0); c.ellipse(0, 0, rB, rB * ell, 0, PI, TAU, true); c.lineTo(rB * 0.95, len * 0.3); c.lineTo(-rB * 0.95, len * 0.3); c.closePath(); c.fill();
    /* la cima piatta */
    c.fillStyle = top ? "#d6383a" : "#a81d28"; c.beginPath(); c.ellipse(0, len, rT, rT * ell, 0, 0, TAU); c.fill();
    if (top && ell > 0.15) { c.fillStyle = "rgba(255,200,180,.18)"; c.beginPath(); c.ellipse(-rT * 0.25, len + rT * ell * 0.2, rT * 0.55, rT * ell * 0.45, 0, 0, TAU); c.fill(); }
    c.fillStyle = "#17121a"; c.beginPath(); c.ellipse(0, len, 0.62, 0.62 * Math.max(ell, 0.5), 0, 0, TAU); c.fill();   /* il bottoncino della nappa */
    c.restore();
  }
  function tasselDraw(c, sx, sy, x0, y0, x1, y1, S) {
    var w = Math.max(0.42, 1 / S);
    c.strokeStyle = "#141018"; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + x0) / 2, (sy + y0) / 2 + 0.35, x0, y0); c.quadraticCurveTo(x0 + (x1 - x0) * 0.2, y0 - 0.3, x1, y1); c.stroke();
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    /* nodo e ciuffo della nappa */
    c.fillStyle = "#141018"; c.beginPath(); c.arc(x1, y1, 0.72, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(x1 + nx * 0.5, y1 + ny * 0.5); c.lineTo(x1 + ux * 2.6 + nx * 0.85, y1 + uy * 2.6 + ny * 0.85); c.quadraticCurveTo(x1 + ux * 2.9, y1 + uy * 2.9, x1 + ux * 2.6 - nx * 0.85, y1 + uy * 2.6 - ny * 0.85); c.lineTo(x1 - nx * 0.5, y1 - ny * 0.5); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.arc(x1 - 0.25, y1 + 0.25, 0.22, 0, TAU); c.fill();
  }

  /* ---------------------------------------------------------------- gli occhi */
  function eyeDraw(c, e, ux, uy, ss, th, S) {
    if (e.vis < 0.03) return;
    var r = e.r * (1 + 0.2 * Math.max(0, e.open - 1)), open = Math.min(1, e.open), inner = -e.side * ss;
    c.save(); c.globalAlpha = e.vis; c.translate(e.x, e.y); c.transform(uy, -ux, ux, uy, 0, 0); c.scale(e.sx, 1);
    if (open < 0.16) {                                               /* chiusi: un arco morbido all'ingiù */
      c.strokeStyle = th.closed; c.lineWidth = Math.max(0.5, 1.3 / S); c.lineCap = "round";
      c.beginPath(); c.moveTo(-r * 0.95, r * 0.05); c.quadraticCurveTo(0, -r * 0.62, r * 0.95, r * 0.05); c.stroke();
      c.restore(); return;
    }
    var top = r - 2 * r * (1 - open) * 0.92 - r * e.lid * 0.95, sl = e.brow * r * 0.62, yIn = top - sl, yOut = top + sl * 0.35, lo = -r + r * e.lid * 0.3;
    var xIn = inner * 1.4 * r, xOut = -inner * 1.4 * r;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    c.beginPath(); c.moveTo(xIn, yIn); c.lineTo(xOut, yOut); c.lineTo(xOut, lo); c.lineTo(xIn, lo); c.closePath(); c.clip();
    var g = c.createLinearGradient(0, r, 0, -r); g.addColorStop(0, "#1f6a2c"); g.addColorStop(0.45, "#4caf48"); g.addColorStop(1, "#c3f383");
    c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r);
    var g2 = c.createRadialGradient(0, 0, r * 0.55, 0, 0, r); g2.addColorStop(0, "rgba(4,30,8,0)"); g2.addColorStop(1, "rgba(4,30,8,.6)"); c.fillStyle = g2; c.fillRect(-r, -r, 2 * r, 2 * r);
    var pw = e.pupil.w, px = e.pupil.dx * r * 0.34, py = e.pupil.dy * r * 0.3;
    c.fillStyle = "#060608"; c.beginPath(); c.ellipse(px, py, r * (0.13 + 0.5 * pw), r * (0.8 - 0.12 * pw), 0, 0, TAU); c.fill();
    var g3 = c.createLinearGradient(0, Math.max(yIn, yOut), 0, Math.max(yIn, yOut) - r * 0.6); g3.addColorStop(0, "rgba(0,0,0,.55)"); g3.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g3; c.fillRect(-r, -r, 2 * r, 2 * r);   /* la palpebra fa ombra */
    c.fillStyle = "rgba(255,255,255,.95)"; c.beginPath(); c.arc(-r * 0.32 + px * 0.25, r * 0.34, r * 0.23, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,255,255,.5)"; c.beginPath(); c.arc(r * 0.3 + px * 0.2, -r * 0.38, r * 0.1, 0, TAU); c.fill();
    c.strokeStyle = "#050507"; c.lineWidth = Math.max(0.45, 1.2 / S); c.lineCap = "round";
    c.beginPath(); c.moveTo(xIn, yIn); c.lineTo(xOut, yOut); c.stroke();
    c.lineWidth = Math.max(0.35, 0.9 / S); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.restore();
  }

  /* ---------------------------------------------------------------- il disegno di un fotogramma */
  var last = { f: null, T: null };
  function draw(c, f, env) {
    env = env || {};
    var th = env.dark === false ? TH.light : TH.dark, S = env.scale || 2.6, d = Math.max(0.3, 0.95 / S);
    var i, l, g, h = f.head, legs = f.legs, b = f.body, P = f.P;
    last.f = f; last.T = null; if (typeof c.getTransform === "function") { try { last.T = c.getTransform(); } catch (er) { last.T = null; } }
    var ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul;

    /* pose di bordo riconosciute dalla geometria: scivola (zampe su e dietro larghe), appeso (zampe sopra la testa) */
    var upB = legs[0].up && legs[1].up, spread = Math.abs(legs[2].fx - legs[3].fx);
    var slideK = upB ? smooth(9, 14, spread) : 0;
    var hangK = upB && slideK < 0.5 && legs[0].fy > h.y + h.ry * 0.5 && legs[1].fy > h.y + h.ry * 0.5 && b.hips.y < b.chest.y - 3 ? 1 : 0;
    var edgeArms = slideK > 0.5 || hangK > 0.5;

    if (env.shadow && env.shadow.k > 0.01) {
      c.save(); c.translate(b.chest.x * 0.3 + b.hips.x * 0.3, env.shadow.y); c.scale(1, 0.16);
      var sg = c.createRadialGradient(0, 0, 0, 0, 0, 19); sg.addColorStop(0, "rgba(0,0,8," + (0.55 * env.shadow.k).toFixed(3) + ")"); sg.addColorStop(0.6, "rgba(0,0,8," + (0.22 * env.shadow.k).toFixed(3) + ")"); sg.addColorStop(1, "rgba(0,0,8,0)");
      c.fillStyle = sg; c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.fill(); c.restore();
    }
    c.save();
    if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); }

    /* il corpo: inviluppo di fianchi, (schiena), petto e collo; nell'appeso una goccia, nello scivolare più tondo */
    var hr = b.hips.r * (1 + 0.16 * hangK + 0.1 * slideK), cr = b.chest.r * (1 - 0.06 * hangK), pts = [], mx = (b.hips.x + b.chest.x) / 2;
    pts = pts.concat(ellP(b.hips.x, b.hips.y - 0.8 * hangK, hr, hr, 0, 22), ellP(b.chest.x, b.chest.y, cr, cr, 0, 22));
    if (b.mid) pts = pts.concat(ellP(b.mid.x, b.mid.y, b.mid.r, b.mid.r, 0, 20));
    var nkx = lerp(b.chest.x, h.x, 0.5), nky = lerp(b.chest.y, h.y, 0.5); pts = pts.concat(ellP(nkx, nky, 5.2, 5.2, 0, 14));
    for (i = 0; i < pts.length; i += 2) { pts[i] = mx + (pts[i] - mx) * b.sx; pts[i + 1] *= b.sy; }
    var body = resample(hull(pts), 1.25), bb = bbox(body), bcx = bb.cx, bcy = bb.cy, fwl = Math.sqrt(f.fwd[0] * f.fwd[0] + f.fwd[1] * f.fwd[1]) || 1, fnx = f.fwd[0] / fwl, fny = f.fwd[1] / fwl;
    /* pelo: ciuffi sul petto (sempre, piccoli) e lungo la schiena quando si gonfia */
    var puff = f.mood ? f.mood.puff || 0 : 0;
    for (i = 0; i < body.length; i += 2) {
      if ((i / 2) % 3 !== 1) continue;
      var vx = body[i] - bcx, vy = body[i + 1] - bcy, vl = Math.sqrt(vx * vx + vy * vy) || 1; vx /= vl; vy /= vl;
      var chestT = smooth(0.35, 0.8, vx * fnx * Math.min(1, fwl * 1.3) + 0.0) * smooth(0.2, -0.5, vy) * (1 - puff), amp = 0.75 * chestT + 2.2 * puff * smooth(-0.3, 0.3, vy);
      if (amp > 0.05) { body[i] += vx * amp; body[i + 1] += vy * amp - amp * 0.35; }
    }

    /* 1. dietro: coda, zampe lontane, bracci dei bordi, orecchio lontano */
    var tailSh = [tailPts(f)];
    if (!f.tail.front) solid(c, tailSh, th.ink, th.r1, th.r2, d, tailPlanes, th);
    var legG = [];
    for (i = 0; i < 4; i++) {
      l = legs[i]; if (l.tuck >= 0.95) continue;
      if (edgeArms && l.front) {                                     /* bracci alzati: partono alti sul petto, stanno dietro la testa */
        var sgn = l.fx >= b.chest.x ? 1 : -1, shx = b.chest.x + sgn * cr * 0.7, shy = b.chest.y + cr * 0.45;
        var ax = l.fx - shx, ay = l.fy - shy, ad = Math.sqrt(ax * ax + ay * ay) || 1, len = P.leg.len * 1.12, kx2 = (shx + l.fx) / 2, ky2 = (shy + l.fy) / 2;
        if (ad < len) { var bend = Math.sqrt(len * len / 4 - ad * ad / 4); kx2 += (-ay / ad) * bend * -sgn * (ay > 0 ? 1 : -1); ky2 += (ax / ad) * bend * -sgn * (ay > 0 ? 1 : -1); }
        g = legShape(l, f, { sx: shx, sy: shy, kx: kx2, ky: ky2, noPaw: true, noGround: true, r0k: 1.22 });
        g.shx = shx; g.shy = shy; legG[i] = g; solid(c, g.sh, l.near ? th.ink : th.far, l.near ? th.r1 : th.f1, l.near ? th.r2 : th.f2, d, null);
        continue;
      }
      if (l.near && !(edgeArms && !l.front)) continue;
      g = legShape(l, f, { noGround: slideK > 0.5 || hangK > 0.5, noHaunch: slideK > 0.5 || hangK > 0.5 }); legG[i] = g;
      if (l.near) solid(c, g.sh, th.ink, th.r1, th.r2, d, nearPlanes, { th: th, g: g, l: l, S: S }); else solid(c, g.sh, th.far, th.f1, th.f2, d * 0.85, farPlanes, { th: th, g: g });
    }
    var eg = [earPts(f.ears[0], h.x, h.y), earPts(f.ears[1], h.x, h.y)], farE = f.ears[0].depth < f.ears[1].depth ? 0 : 1, sepE = Math.abs(f.ears[0].depth - f.ears[1].depth) > 2.2;
    if (sepE) solid(c, [eg[farE].p], th.far, th.f1, th.f2, d * 0.85, function (cc) { innerEar(cc, eg[farE], f.ears[farE].w, 0.55 * smooth(-0.3, 0.6, h.fz), f.ears[farE].flat); });

    /* 2. il corpo */
    solid(c, [body], th.ink, th.r1, th.r2, d, bodyPlanes, { th: th, bb: bb, f: f, cr: cr, fnx: fnx, fny: fny, fwl: fwl, S: S });

    /* 3. zampe vicine (non alzate) e coda davanti */
    for (var oi = 0; oi < 4; oi++) {
      i = [2, 3, 0, 1][oi]; l = legs[i]; if (!l.near || l.tuck >= 0.95 || edgeArms || (l.up && !edgeArms) || (env.pawsOnEdge && l.front)) continue;
      g = legShape(l, f, { noGround: slideK > 0.5 || hangK > 0.5, noHaunch: slideK > 0.5 || hangK > 0.5 }); legG[i] = g;
      c.save(); c.beginPath(); emit(c, [body], 0, 0); c.clip(); c.strokeStyle = rgba(th.shade, 0.75); c.lineWidth = Math.max(0.3, 1.1 / S); c.lineJoin = "round"; c.beginPath(); emit(c, g.sh, 0, 0); c.stroke(); c.restore();   /* il filo d'ombra dove la zampa copre il corpo */
      solid(c, g.sh, th.ink, th.r1, th.r2, d, nearPlanes, { th: th, g: g, l: l, S: S });
      if (slideK < 0.5 && hangK < 0.5) toes(c, g, th, S);
    }
    /* zampe nascoste (pagnotta, dorme): si vedono appena le punte davanti */
    for (i = 0; i < 2; i++) { l = legs[i]; if (l.tuck > 0.5 && l.near !== false) { var tk = smooth(0.5, 1, l.tuck), tpx = l.fx + fnx * 3.2 * Math.min(1, fwl * 1.4) + (i ? -1 : 1) * 1.6 * (1 - Math.min(1, fwl * 1.4)), tpy = Math.max(1.1, l.fy - 1);
      solid(c, [ellP(tpx, tpy, 2.1 * tk, 1.25 * tk, 0, 14, 0.05)], i ? th.far : th.ink, th.r1, th.r2, d * 0.8, null); } }
    if (f.tail.front) solid(c, tailSh, th.ink, th.r1, th.r2, d, tailPlanes, th);

    /* 4. la testa: un solo contorno con guance, muso e orecchio vicino */
    var rxe = h.depth + (h.rx - h.depth) * Math.abs(h.fz), nlx = (f.nose.x - h.x) * uy - (f.nose.y - h.y) * ux, nly = (f.nose.x - h.x) * ux + (f.nose.y - h.y) * uy;
    var headSh = [toScreen(headLocal(rxe, h.ry), h.x, h.y, ux, uy), toScreen(ellP(nlx * 0.78, nly - 1.1, 3.6, 2.9, 0, 14), h.x, h.y, ux, uy)];
    for (i = 0; i < 2; i++) if (!sepE || i !== farE) headSh.push(eg[i].p);
    var ss = (h.s[0] * uy - h.s[1] * ux) >= 0 ? 1 : -1;
    solid(c, headSh, th.ink, th.r1, th.r2, d, headPlanes, { th: th, f: f, h: h, ux: ux, uy: uy, rxe: rxe, nlx: nlx, nly: nly, eg: eg, sepE: sepE, farE: farE, ss: ss, S: S });
    /* baffi */
    c.strokeStyle = th.whisk; c.lineWidth = Math.max(0.24, 0.62 / S); c.lineCap = "round";
    for (i = 0; i < 2; i++) {
      var wq = f.whiskers[i]; if (wq.vis < 0.05) continue; c.globalAlpha = wq.vis;
      for (var k = -1; k <= 1; k++) {
        var a = k * 0.26 - 0.04, ca = Math.cos(a), sa = Math.sin(a), wdx = wq.dx * ca - wq.dy * sa, wdy = wq.dx * sa + wq.dy * ca, wl = wq.len * (1 - 0.12 * Math.abs(k)), sx0 = wq.x - ux * k * 0.55, sy0 = wq.y - uy * k * 0.55;
        c.beginPath(); c.moveTo(sx0, sy0); c.quadraticCurveTo(sx0 + wdx * wl * 0.55, sy0 + wdy * wl * 0.55 + 0.25, sx0 + wdx * wl, sy0 + wdy * wl - 0.5 - 0.3 * k); c.stroke();
      }
    }
    c.globalAlpha = 1;

    /* 5. il fez */
    if (f.fez) {
      var fz = f.fez, fax = fz.tx - fz.x, fay = fz.ty - fz.y, fal = Math.sqrt(fax * fax + fay * fay) || 1, tsx = -fay / fal, tsy = fax / fal, tdx = fz.tassel.x0 - fz.tx, tdy = fz.tassel.y0 - fz.ty;
      if (tsx * tdx + tsy * tdy < 0) { tsx = -tsx; tsy = -tsy; }      /* la nappa scende dal lato, non davanti */
      var ex2 = fz.tx + tsx * fz.rTop * 0.98, ey2 = fz.ty + tsy * fz.rTop * 0.98, push = fz.rBase * 1.2 - fz.rTop * 0.7, mvx = tsx * push, mvy = tsy * push;
      fezBody(c, fz.x, fz.y, fz.tx, fz.ty, fz.rBase, fz.rTop, fz.ell, fz.top, th, S); tasselDraw(c, fz.tx, fz.ty, ex2, ey2, fz.tassel.x1 + mvx, fz.tassel.y1 + mvy, S);
    }

    /* 6. zampe alzate davanti alla testa (si lava, zampata) */
    for (i = 0; i < 4; i++) {
      l = legs[i]; if (!l.up || edgeArms || l.tuck >= 0.95 || (env.pawsOnEdge && l.front)) continue;
      var fa2 = Math.min(1, fwl * 1.3), usx = b.chest.x + fnx * cr * 0.35 * fa2, usy = b.chest.y + cr * 0.4, kn = ik(usx, usy, l.fx, l.fy, P.leg.len * 1.1);
      g = legShape(l, f, { noGround: true, sx: usx, sy: usy, kx: kn[0], ky: kn[1], r0k: 1.1 }); legG[i] = g;
      solid(c, g.sh, l.near ? th.ink : th.far, l.near ? th.r1 : th.f1, l.near ? th.r2 : th.f2, d, nearPlanes, { th: th, g: g, l: l, S: S });
    }
    /* 7. zampette dei bordi: appeso (agganciate), scivola (palmi aperti con unghie; dietro le piante) */
    if (hangK > 0.5) for (i = 0; i < 2; i++) { l = legs[i]; edgePaw(c, l.fx, Math.max(0.15, l.fy - 0.6), l.paw * 1.02, th, S, false); }
    if (slideK > 0.5) {
      for (i = 2; i < 4; i++) { l = legs[i]; if (l.tuck >= 0.95) continue; var hdx = l.fx - l.kx, hdy = l.fy - l.ky, hl = Math.sqrt(hdx * hdx + hdy * hdy) || 1; palmPaw(c, l.fx + hdx / hl * 0.8, l.fy + hdy / hl * 0.8, l.paw * 1.12, hdx / hl, hdy / hl, th, S, true, true); }
      for (i = 0; i < 2; i++) { l = legs[i]; var fdx = l.fx - legG[i].shx, fdy = l.fy - legG[i].shy; var fl2 = Math.sqrt(fdx * fdx + fdy * fdy) || 1; palmPaw(c, l.fx, l.fy, l.paw * 1.15, fdx / fl2, fdy / fl2, th, S, true, true); }
    }
    c.restore();

    /* 8. le zampe davanti posate sul bordo (spunta): fuori dal ritaglio, sopra tutto */
    if (env.pawsOnEdge) for (i = 0; i < 2; i++) { l = legs[i]; edgePaw(c, l.fx, 0, l.paw * 1.08, th, S, false); }
  }

  /* i piani dentro le parti (si disegnano col ritaglio della parte già attivo) */
  function tailPlanes(c, th) { var g = c.createLinearGradient(-6, 26, 6, 0); g.addColorStop(0, rgba(th.plane, 0.1)); g.addColorStop(1, rgba(th.shade, 0.3)); c.fillStyle = g; c.fillRect(-300, -300, 600, 600); }
  function farPlanes(c, o) { var g = o.g; radial(c, g.pcx, g.pcy - g.pry * 1.2, g.prx * 1.6, o.th.shade, 0.25, 0.1); }
  function nearPlanes(c, o) {
    var g = o.g, l = o.l, th = o.th;
    var gg = c.createLinearGradient(l.jx, l.jy, l.fx, l.fy); gg.addColorStop(0, rgba(th.shade, 0.45)); gg.addColorStop(0.35, rgba(th.shade, 0)); c.fillStyle = gg; c.fillRect(-300, -300, 600, 600);
    if (!l.front) radial(c, lerp(l.jx, l.kx, 0.3) - 1.2, lerp(l.jy, l.ky, 0.3) + 2.2, l.r0 * 2.2, th.plane, 0.26, 0.16);
    radial(c, g.pcx - g.prx * 0.3, g.pcy + g.pry * 0.5, g.prx * 1.1, th.plane, 0.2, 0.08);
  }
  function bodyPlanes(c, o) {
    var bb = o.bb, th = o.th, f = o.f, b = f.body, h = f.head, R = Math.max(bb.w, bb.h);
    var g = c.createLinearGradient(0, bb.y0, 0, bb.y0 + bb.h * 0.6); g.addColorStop(0, rgba(th.shade, 0.6)); g.addColorStop(1, rgba(th.shade, 0)); c.fillStyle = g; c.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);
    radial(c, bb.cx - bb.w * 0.2, bb.y1 - bb.h * 0.18, R * 0.62, th.plane, 0.28, 0.22, 0.5, true);     /* dorso */
    radial(c, bb.x1 + bb.w * 0.05, bb.cy - bb.h * 0.1, R * 0.45, th.shade, 0.35, 0.12);         /* lato in ombra */
    var fa = Math.min(1, o.fwl * 1.3), px = b.chest.x + o.fnx * o.cr * 0.55 * fa, py = b.chest.y - o.cr * 0.15;
    radial(c, px, py, o.cr * 0.95, th.plane, 0.22, 0.15, 0.5, true);                                       /* petto */
    /* ciuffi chiari sul petto, sotto il mento */
    if (o.S > 1.8 && h.fz > -0.3) {
      var tx = lerp(px, h.x, 0.25), ty = Math.min(py + o.cr * 0.2, h.y - h.ry * 0.82), k;
      c.fillStyle = rgba(th.plane, 0.3);
      for (k = -1; k <= 1; k++) { var x = tx + k * 1.5, y = ty - Math.abs(k) * 0.5, L = 2.6 - Math.abs(k) * 0.5; c.beginPath(); c.moveTo(x - 0.8, y + 0.4); c.quadraticCurveTo(x - 0.4, y - L * 0.5, x + k * 0.3, y - L); c.quadraticCurveTo(x + 0.3, y - L * 0.4, x + 0.8, y + 0.4); c.closePath(); c.fill(); }
    }
    radial(c, h.x, h.y - h.ry * 0.82, h.rx * 0.95, th.shade, 0.55, 0.3);                        /* la testa fa ombra sul corpo */
  }
  function headPlanes(c, o) {
    var h = o.h, th = o.th, W = o.rxe, H = h.ry, f = o.f, i;
    c.save(); c.translate(h.x, h.y); c.transform(o.uy, -o.ux, o.ux, o.uy, 0, 0);
    radial(c, -W * 0.3 + o.nlx * 0.25, H * 0.42, W * 0.95, th.plane, 0.3, 0.2, 0.5);           /* fronte */
    radial(c, -W * 0.52 + o.nlx * 0.45, -H * 0.3, W * 0.5, th.plane, 0.24, 0.17, 0.5, true);               /* guancia in luce */
    radial(c, o.nlx * 0.7, o.nly - 0.6, 4.2, th.plane, 0.14, 0.08);                             /* muso */
    radial(c, W * 0.95, -H * 0.25, W * 0.6, th.shade, 0.4, 0.15);                               /* guancia in ombra */
    radial(c, 0, -H * 1.1, W * 0.7, th.shade, 0.5, 0.2);                                        /* sotto il mento */
    c.restore();
    for (i = 0; i < 2; i++) if (!o.sepE || i !== o.farE) innerEar(c, o.eg[i], f.ears[i].w, smooth(-0.3, 0.55, h.fz) * (1 - 0.35 * f.ears[i].flat), f.ears[i].flat);
    if (f.fez) radial(c, f.fez.x, f.fez.y - 0.6, f.fez.rBase * 1.5, th.shade, 0.55, 0.25);      /* ombra del fez */
    /* il bagliore verde attorno agli occhi */
    for (i = 0; i < 2; i++) { var e = f.eyes[i]; if (e.vis > 0.1 && e.open > 0.2) radial(c, e.x, e.y, e.r * 2.0, "95,220,110", th.glow * 0.85 * e.vis * Math.min(1, e.open), th.glow * 0.3 * e.vis, 0.45); }
    for (i = 0; i < 2; i++) eyeDraw(c, f.eyes[i], o.ux, o.uy, o.ss, th, o.S);
    /* naso */
    if (f.nose.vis > 0.25) {
      c.save(); c.globalAlpha = f.nose.vis; c.translate(f.nose.x, f.nose.y); c.transform(o.uy, -o.ux, o.ux, o.uy, 0, 0);
      c.fillStyle = NOSE; c.beginPath(); c.moveTo(-1.25, 0.5); c.quadraticCurveTo(0, 0.95, 1.25, 0.5); c.quadraticCurveTo(0.6, -0.3, 0, -0.75); c.quadraticCurveTo(-0.6, -0.3, -1.25, 0.5); c.fill();
      c.fillStyle = "rgba(255,230,236,.45)"; c.beginPath(); c.ellipse(-0.35, 0.42, 0.42, 0.2, 0, 0, TAU); c.fill(); c.restore();
    }
    /* bocca */
    var m = f.mouth;
    if (m.vis > 0.25) {
      c.save(); c.globalAlpha = m.vis; c.translate(m.x, m.y + 0.4); c.transform(o.uy, -o.ux, o.ux, o.uy, 0, 0); c.scale(0.5 + 0.5 * smooth(0, 1, h.fz), 1);
      if (m.open > 0.06) {
        var mw = 1.4 + 1.5 * m.open, mh = 0.6 + 3.3 * m.open;
        c.fillStyle = "#3a1520"; c.beginPath(); c.moveTo(-mw, 0); c.quadraticCurveTo(0, 0.5, mw, 0); c.bezierCurveTo(mw, -mh * 0.7, mw * 0.5, -mh, 0, -mh); c.bezierCurveTo(-mw * 0.5, -mh, -mw, -mh * 0.7, -mw, 0); c.fill();
        c.save(); c.clip(); c.fillStyle = "#d9768a"; c.beginPath(); c.ellipse(0, -mh * 1.02, mw * 0.72, mh * 0.45, 0, 0, TAU); c.fill(); c.restore();
        if (m.open > 0.45 && o.S > 2) { c.fillStyle = "#f4f0f2"; for (i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(i * mw * 0.72, -0.05); c.lineTo(i * mw * 0.44, -0.05); c.lineTo(i * mw * 0.6, -0.75 - 0.3 * m.open); c.closePath(); c.fill(); } }
      } else if (o.S > 2) {
        c.strokeStyle = th.line; c.lineWidth = Math.max(0.22, 0.7 / o.S); c.lineCap = "round";
        c.beginPath(); c.moveTo(0, 0.55); c.lineTo(0, 0); c.quadraticCurveTo(-0.55, -0.55, -1.15, -0.05); c.moveTo(0, 0); c.quadraticCurveTo(0.55, -0.55, 1.15, -0.05); c.stroke();
      }
      c.restore();
    }
  }

  /* il fez quando non è in testa: fz = { rBase, rTop, h, ell, top, tasselAng }, origine al centro della base, dritto */
  function drawFez(c, fz, env) {
    env = env || {}; var th = env.dark === false ? TH.light : TH.dark, S = env.scale || 2.6, ell = fz.ell == null ? 0.22 : fz.ell;
    var g = c.createRadialGradient(0, 0, 0, 0, 0, fz.rBase * 1.5); g.addColorStop(0, "rgba(0,0,8,.35)"); g.addColorStop(1, "rgba(0,0,8,0)");
    c.save(); c.scale(1, 0.3); c.fillStyle = g; c.beginPath(); c.arc(0.6, -0.5, fz.rBase * 1.5, 0, TAU); c.fill(); c.restore();
    fezBody(c, 0, 0, 0, fz.h, fz.rBase, fz.rTop, ell, fz.top !== false, th, S);
    var a = fz.tasselAng || 0, x0 = -fz.rTop * 0.98, y0 = fz.h, L = (fz.tassel || 6.4), x1 = -fz.rBase * 1.2;
    tasselDraw(c, 0, fz.h, x0, y0, x1 + L * Math.sin(a), y0 - L * Math.cos(a), S);
  }

  /* ---------------------------------------------------------------- gli oggetti di Dot (origine alla base, y in su; p = { t }) */
  var KUKKO = ["#ffb6c1", "#fdfd96", "#ffb347", "#77dd77", "#aec6cf", "#ff6961"];
  /* le zampe davanti sopra l'oggetto: «wrap» = abbracciano i lati (xl, xr all'altezza yh), altrimenti dove sono davvero.
     Serve sapere dov'è il gatto rispetto all'oggetto: lo dà la trasformazione salvata in draw() (se il browser la offre). */
  function holdPaws(c, env, wrap, xl, xr, yh) {
    var f = last.f; if (!f || !last.T || typeof c.getTransform !== "function") return;
    var R; try { R = last.T.inverse().multiply(c.getTransform()); } catch (er) { return; }
    var ox = R.e, oy = R.f; if (Math.abs(ox - f.hold.x) > 9 || Math.abs(oy - f.hold.y) > 9) return;
    var th = env && env.dark === false ? TH.light : TH.dark, S = (env && env.scale) || 2.6, d = Math.max(0.3, 0.95 / S), i, order = [1, 0];
    c.save(); c.translate(-ox, -oy);
    var L0 = f.legs[0], L1 = f.legs[1], leftI = L0.fx <= L1.fx ? 0 : 1;
    for (var n = 0; n < 2; n++) {
      i = order[n]; var l = f.legs[i], sh, pcx, pcy, pr = l.paw;
      if (wrap) {
        var tx = ox + (i === leftI ? xl : xr), ty = oy + yh, dx = tx - l.kx, dy = ty - l.ky, dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / dl, uy = dy / dl, rk = (l.r0 + l.r1) / 2;
        pcx = tx; pcy = ty; sh = [caps(l.kx, l.ky, rk, tx - ux * pr * 0.3, ty - uy * pr * 0.3, l.r1, 9), ellP(tx, ty, pr * 0.95, pr * 0.82, Math.atan2(uy, ux), 18)];
      } else { var g = legShape(l, f, { noUpper: true, noHaunch: true }); sh = g.sh; pcx = g.pcx; pcy = g.pcy; }
      solid(c, sh, i ? th.far : th.ink, i ? th.f1 : th.r1, i ? th.f2 : th.r2, d, function (cc) { radial(cc, pcx - pr * 0.3, pcy + pr * 0.45, pr * 1.3, th.plane, 0.24, 0.1); });
    }
    c.restore();
  }
  function drawProp(c, name, p, env) {
    p = p || {}; env = env || {}; var t = p.t || 0, i, j, g, dark = env.dark !== false, S = env.scale || 2.6;
    if (name === "tea") {                                             /* il bicchiere di tè alla menta */
      var H = 8.4, wb = 2.3, wt = 3.25;
      c.fillStyle = "rgba(255,255,255,.16)"; c.beginPath(); c.moveTo(-wb, 0); c.lineTo(wb, 0); c.lineTo(wt, H); c.lineTo(-wt, H); c.closePath(); c.fill();
      g = c.createLinearGradient(0, 1, 0, H * 0.8); g.addColorStop(0, "#9c4a12"); g.addColorStop(1, "#e7a43e");
      c.fillStyle = g; c.beginPath(); c.moveTo(-wb + 0.25, 1.05); c.lineTo(wb - 0.25, 1.05); c.lineTo(lerp(wb, wt, 0.8) - 0.25, H * 0.8); c.lineTo(-lerp(wb, wt, 0.8) + 0.25, H * 0.8); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,220,150,.5)"; c.beginPath(); c.ellipse(0, H * 0.8, lerp(wb, wt, 0.8) - 0.25, 0.42, 0, 0, TAU); c.fill();
      /* la menta che esce dal bicchiere */
      c.strokeStyle = "#3f7d33"; c.lineWidth = 0.35; c.lineCap = "round"; c.beginPath(); c.moveTo(0.4, H * 0.55); c.quadraticCurveTo(0.9, H * 0.9, 1.5, H + 1.6); c.stroke();
      var lv = [[1.5, H + 1.7, 0.9], [0.6, H + 0.9, 2.3], [2.3, H + 0.8, -0.4]];
      for (i = 0; i < 3; i++) { c.fillStyle = i ? "#5fae45" : "#7cc95a"; c.save(); c.translate(lv[i][0], lv[i][1]); c.rotate(lv[i][2]); c.beginPath(); c.moveTo(-1.2, 0); c.quadraticCurveTo(0, 0.85, 1.2, 0); c.quadraticCurveTo(0, -0.85, -1.2, 0); c.fill(); c.strokeStyle = "rgba(30,70,25,.6)"; c.lineWidth = 0.15; c.beginPath(); c.moveTo(-1, 0); c.lineTo(1, 0); c.stroke(); c.restore(); }
      /* vetro: riflesso, bordo, fascia d'oro semplice */
      c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.moveTo(-wb + 0.55, 0.7); c.lineTo(-wb + 1.0, 0.7); c.lineTo(-wt + 1.15, H - 1.2); c.lineTo(-wt + 0.7, H - 1.2); c.closePath(); c.fill();
      c.fillStyle = "#e2b24a"; c.beginPath(); c.moveTo(-lerp(wb, wt, 0.86), H * 0.86); c.lineTo(lerp(wb, wt, 0.86), H * 0.86); c.lineTo(lerp(wb, wt, 0.94), H * 0.94); c.lineTo(-lerp(wb, wt, 0.94), H * 0.94); c.closePath(); c.fill();
      c.fillStyle = "#b5832a"; c.fillRect(-wb, 0, 2 * wb, 0.35);
      c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 0.22; c.beginPath(); c.ellipse(0, H, wt, 0.5, 0, 0, TAU); c.stroke();
      c.fillStyle = "rgba(255,255,255,.28)"; c.beginPath(); c.ellipse(0, 0.35, wb, 0.35, 0, 0, TAU); c.fill();
      /* il filo di vapore */
      c.lineCap = "round";
      for (i = 0; i < 2; i++) {
        var ph = t * 1.3 + i * 2.1, x0 = -0.8 + i * 1.5;
        g = c.createLinearGradient(0, H + 0.5, 0, H + 7); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.3, "rgba(255,255,255," + (dark ? 0.42 : 0.75) + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = g; c.lineWidth = 0.55; c.beginPath(); c.moveTo(x0, H + 0.6);
        c.bezierCurveTo(x0 + 1.4 * Math.sin(ph), H + 2.4, x0 - 1.4 * Math.sin(ph + 1), H + 4.4, x0 + 0.6 * Math.sin(ph + 2), H + 6.6); c.stroke();
      }
      if (!dark) { c.strokeStyle = "rgba(60,60,80,.25)"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(-wb, 0); c.lineTo(-wt, H); c.moveTo(wb, 0); c.lineTo(wt, H); c.stroke(); }
      holdPaws(c, env, true, -wb - 0.45, wb + 0.45, 2.9);
    } else if (name === "cube") {                                     /* il cubo, nei colori pastello di Imad (plastica bianca) */
      var s = 6.4, ox = 1.9, oy = 1.5, gap = 0.2, q = (s - 4 * gap) / 3, cols = [2, 0, 3, 1, 5, 2, 4, 3, 0], tops = [0, 3, 0, 1, 0, 4, 2, 0, 5], side = [3, 1, 3, 5, 3, 0, 3, 2, 4], x0c = -s / 2 - ox * 0.3;
      c.fillStyle = "#e9e5dc"; c.beginPath(); c.moveTo(x0c, 0); c.lineTo(x0c + s, 0); c.lineTo(x0c + s + ox, oy); c.lineTo(x0c + s + ox, s + oy); c.lineTo(x0c + ox, s + oy); c.lineTo(x0c, s); c.closePath(); c.fill();
      c.fillStyle = "#c9c4b9"; c.beginPath(); c.moveTo(x0c + s, 0); c.lineTo(x0c + s + ox, oy); c.lineTo(x0c + s + ox, s + oy); c.lineTo(x0c + s, s); c.closePath(); c.fill();
      c.fillStyle = "#fbf9f4"; c.beginPath(); c.moveTo(x0c, s); c.lineTo(x0c + s, s); c.lineTo(x0c + s + ox, s + oy); c.lineTo(x0c + ox, s + oy); c.closePath(); c.fill();
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
        c.fillStyle = KUKKO[cols[i * 3 + j]]; rr(c, x0c + gap + j * (q + gap), gap + (2 - i) * (q + gap), q, q, 0.35);
        var u0 = (j + 0.12) / 3, u1 = (j + 0.88) / 3, v0 = (i + 0.12) / 3, v1 = (i + 0.88) / 3;
        c.fillStyle = mix(KUKKO[tops[i * 3 + j]], "#ffffff", 0.12); quad(c, x0c + u0 * s + v0 * ox, s + v0 * oy, x0c + u1 * s + v0 * ox, s + v0 * oy, x0c + u1 * s + v1 * ox, s + v1 * oy, x0c + u0 * s + v1 * ox, s + v1 * oy);
        c.fillStyle = mix(KUKKO[side[i * 3 + j]], "#7a7468", 0.22); quad(c, x0c + s + v0 * ox, u0 * s + v0 * oy, x0c + s + v1 * ox, u0 * s + v1 * oy, x0c + s + v1 * ox, u1 * s + v1 * oy, x0c + s + v0 * ox, u1 * s + v0 * oy);
      }
      c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x0c, s); c.lineTo(x0c + ox, s + oy); c.lineTo(x0c + ox + s * 0.5, s + oy); c.lineTo(x0c + s * 0.5, s); c.closePath(); c.fill();
      holdPaws(c, env, true, x0c + 0.2, x0c + s + ox * 0.6, 2.6);
    } else if (name === "yarn") {                                     /* il gomitolo rosa, col filo che scappa */
      var Ry = 3.8;
      c.strokeStyle = "#e88fa2"; c.lineWidth = 0.5; c.lineCap = "round"; c.beginPath(); c.moveTo(2.6, 1); c.bezierCurveTo(5.5, -0.2, 7, 0.6, 8.5, 0.25); c.bezierCurveTo(10, -0.1, 10.5, 1.6, 9.2, 1.5); c.stroke();
      g = c.createRadialGradient(-1.3, Ry + 1.4, 0.4, 0, Ry, Ry); g.addColorStop(0, "#ffd3dc"); g.addColorStop(0.6, "#f6a5b6"); g.addColorStop(1, "#c96f86");
      c.fillStyle = g; c.beginPath(); c.arc(0, Ry, Ry, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, Ry, Ry, 0, TAU); c.clip(); c.lineWidth = 0.32;
      for (i = 0; i < 7; i++) { c.strokeStyle = i % 2 ? "rgba(150,50,80,.45)" : "rgba(255,235,240,.5)"; c.beginPath(); c.ellipse(0, Ry, Ry * 1.02, Ry * (0.25 + 0.11 * i), 0.5 + i * 0.42, 0, TAU); c.stroke(); }
      c.restore();
    } else if (name === "star") {                                     /* la stella-punto del sito, d'oro, che vibra piano */
      var tw = 0.85 + 0.15 * Math.sin(t * 5.3);
      radial(c, 0, 0, 7 * tw, "255,200,90", 0.55, 0.16, 0.35);
      c.fillStyle = "rgba(255,236,180,.9)"; c.save(); c.rotate(0.2 + t * 0.4);
      for (i = 0; i < 4; i++) { c.rotate(PI / 2); c.beginPath(); c.moveTo(0, 0.5); c.lineTo(0.42, 0); c.lineTo(0, 3.6 * tw); c.lineTo(-0.42, 0); c.closePath(); c.fill(); }
      c.restore();
      g = c.createRadialGradient(-0.3, 0.3, 0, 0, 0, 1.5); g.addColorStop(0, "#fffbea"); g.addColorStop(0.6, "#ffe08a"); g.addColorStop(1, "#f0b440"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1.45, 0, TAU); c.fill();
    } else if (name === "laptop") {                                   /* il portatile: tastiera di tre quarti, schermo verso il gatto */
      c.fillStyle = "#a8acb8"; quad(c, -7.2, 0, 5.6, 0, 7.6, 1.9, -5.2, 1.9);
      c.fillStyle = "#d3d6de"; quad(c, -7.2, 0.45, 5.6, 0.45, 7.6, 2.3, -5.2, 2.3);
      c.fillStyle = "rgba(60,64,80,.35)"; for (i = 0; i < 3; i++) quad(c, -5.6 + i * 0.25, 0.85 + i * 0.42, 4.2 + i * 0.25, 0.85 + i * 0.42, 4.4 + i * 0.25, 1.1 + i * 0.42, -5.4 + i * 0.25, 1.1 + i * 0.42);
      c.fillStyle = "#b9bcc7"; quad(c, -5.2, 2.3, 7.6, 2.3, 9.2, 11, -3.6, 11);
      c.fillStyle = "#0d1226"; quad(c, -4.5, 2.95, 6.9, 2.95, 8.35, 10.35, -2.95, 10.35);
      var lines = [[0.3, 5.2], [1.2, 3.5], [1.2, 4.6], [0.3, 2.8], [2.1, 3.9], [1.2, 2.4], [0.3, 4.4]], off = (t * 2.2) % 1;
      c.save(); c.beginPath(); quadPath(c, -4.5, 2.95, 6.9, 2.95, 8.35, 10.35, -2.95, 10.35); c.clip();
      for (i = 0; i < lines.length; i++) { var yy = 9.4 - (i + off) * 0.95, sk = (yy - 2.95) / 7.4 * 1.45; c.fillStyle = i % 3 === 2 ? "#a6e3ff" : "#7de08a"; c.globalAlpha = 0.95 - i * 0.08; c.fillRect(-3.8 + sk + lines[i][0], yy, lines[i][1], 0.42); }
      c.globalAlpha = 1; radial(c, 2.5, 7.5, 7, "125,224,138", 0.16, 0.05); c.restore();
      c.fillStyle = "rgba(255,255,255,.12)"; quad(c, -4.5, 2.95, -2.6, 2.95, 0.4, 10.35, -2.95, 10.35);
      holdPaws(c, env, false);
    }
  }
  function quadPath(c, a, b, cc, d, e, f, g, h) { c.moveTo(a, b); c.lineTo(cc, d); c.lineTo(e, f); c.lineTo(g, h); c.closePath(); }
  function quad(c, a, b, cc, d, e, f, g, h) { c.beginPath(); quadPath(c, a, b, cc, d, e, f, g, h); c.fill(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.fill(); }

  /* ---------------------------------------------------------------- proporzioni e pose di questo aspetto */
  var preset = {
    props: { headRx: 12.2, headRy: 10, headDepth: 9.8, eye: { r: 3.85, side: 4.9, up: -0.4 }, ear: { w: 4.7, tipUp: 15.9, tipSide: 8.9 },
      leg: { r0: 3.4, r1: 2.5, paw: 2.85 }, tail: { len: 28, r0: 3.3, r1: 2.0 }, chestR: 7.6, hipR: 8.6 },
    poses: {
      /* appeso: zampe agganciate al bordo sopra la testa, la testa sotto, il corpo pende come una goccia */
      hang: { hx: 0, hy: -33, cx: 0, cy: -24.5, dx: 0.3, dy: 8.4, f0x: 0.6, f0y: 0.7, f1x: 0.6, f1y: 0.7, fs: 4.0, fo: 1.4, f2x: 0.6, f2y: -42.5, f3x: 0.6, f3y: -42.5, hs: -1.2, ho: 1.2,
        tby: -6, te: -1.0, tc: 1.1, tw: 0.6, eye: 1.08, lid: 0.1, brow: -0.6, hp: 0.12, ear: 0.4, br: 0.4 },
      peek: { cy: -5.2, dy: 13.2, eye: 1.08 },
      drape: { hy: 5.2, cy: 5.4, dy: 1.2, sqy: 0.9, f0x: 8.6, f0y: -10, f2x: -5.2, f2y: -9.4, lid: 0.4 },
      sit: { tw: 1.7, te: -0.25, tc: 0.12, tby: -6.4 },
      /* scivola: braccia larghe e asimmetriche, zampe dietro aperte, pelo gonfio, occhi sbarrati */
      slide: { hx: 0, hy: -15, cx: 0, cy: -6.5, dx: 0.6, dy: 9, f0x: 0.8, f0y: 9.5, f1x: 0.8, f1y: 3.2, fs: 2.8, fo: 7.2, f2x: 2.6, f2y: -21.5, f3x: 2.6, f3y: -21.5, hs: 1.2, ho: 6.8,
        tby: -5, te: -0.95, tc: 1.15, tw: -0.6, eye: 1.3, ear: 0.4, puff: 0.45, mouth: 0.22, brow: -0.3 },
      hold: { fs: 0.5 }, sip: { fs: 0.5 },
      bat: { f0x: 13, f0y: 25.2 }, groom: { f0x: 9.5, f0y: 25.5, eye: 0 }
    }
  };

  DOT.looks.pelo = { label: "Pelo", preset: preset, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
