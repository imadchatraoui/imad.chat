/* look-adesivo.js — l'aspetto «Adesivo» di Dot: morbido e tondo come un adesivo, il più tenero dei tre.
   Occhioni verdi lucidi (iride sfumata, pupilla da tonda a fessura, un riflesso netto), orecchie rosa spento,
   nasino rosa, tre baffi sottili per lato. Corpo quasi nero, zampe lontane un filo più chiare; sul fondo scuro
   un filo di luce fredda in alto a sinistra tiene leggibile la sagoma.
   Stesso contratto di look-base.js: draw(ctx, frame, env), drawFez(ctx, fez, env), drawProp(ctx, nome, p, env).
   Non muove nulla: disegna il fotogramma. Niente canvas creati qui, niente shadowBlur: i gradienti sono fatti una
   volta per contesto (in unità locali) e poi solo riusati. Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var TAU = Math.PI * 2, PI = Math.PI;
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(a, b, x) { var t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  /* colori: scuro (fondo notte) e chiaro */
  var PAL = {
    dark: { ink: "#0a0a10", far: "#22222d", rim: "rgba(160,186,255,.66)", rim2: "rgba(160,186,255,.16)", sep: "rgba(160,186,255,.30)", whisk: "rgba(226,232,246,.78)", lash: "rgba(214,240,206,.9)", toe: "rgba(160,186,255,.42)", steam: "rgba(255,255,255,.42)" },
    light: { ink: "#0b0b10", far: "#25252f", rim: null, rim2: null, sep: "rgba(255,255,255,.15)", whisk: "rgba(196,202,216,.92)", lash: "rgba(214,240,206,.9)", toe: "rgba(255,255,255,.26)", steam: "rgba(118,126,150,.62)" }
  };
  var EAR_IN = "#c98494", NOSE = "#f29aae", MOUTH = "#4e0f1e", TONGUE = "#f2849a", PAD = "#d9909f";

  /* gradienti fatti una volta per contesto, in coordinate locali fisse */
  function G(c) {
    if (c.__adesivo) return c.__adesivo;
    var g = {}, x;
    x = c.createRadialGradient(0, -0.42, 0.05, 0, -0.1, 1.02);          /* iride: chiara in basso, verde profondo sul bordo */
    x.addColorStop(0, "#e6f79a"); x.addColorStop(0.38, "#9bdc55"); x.addColorStop(0.78, "#3f9d3c"); x.addColorStop(1, "#1f5e2a"); g.eye = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 1);                         /* ombra a terra */
    x.addColorStop(0, "rgba(0,0,10,.55)"); x.addColorStop(0.55, "rgba(0,0,10,.25)"); x.addColorStop(1, "rgba(0,0,10,0)"); g.shadow = x;
    x = c.createLinearGradient(-6, 0, 6, 0);                              /* fez: feltro, luce da sinistra */
    x.addColorStop(0, "#e2434b"); x.addColorStop(0.35, "#cf2734"); x.addColorStop(0.75, "#a8172a"); x.addColorStop(1, "#7d0f20"); g.fez = x;
    x = c.createLinearGradient(0, 0.6, 0, 6);                             /* tè */
    x.addColorStop(0, "#8a4510"); x.addColorStop(1, "#e3a43c"); g.tea = x;
    x = c.createRadialGradient(-1.2, 4.7, 0.3, 0, 3.6, 3.9);              /* gomitolo */
    x.addColorStop(0, "#ffd3dc"); x.addColorStop(0.6, "#f19db0"); x.addColorStop(1, "#c96b84"); g.yarn = x;
    x = c.createRadialGradient(0, 0, 0, 0, 0, 6);                         /* alone della stella */
    x.addColorStop(0, "rgba(255,232,170,.95)"); x.addColorStop(0.22, "rgba(255,200,90,.5)"); x.addColorStop(0.6, "rgba(255,180,70,.12)"); x.addColorStop(1, "rgba(255,180,70,0)"); g.star = x;
    x = c.createLinearGradient(-6, 0, 7, 0);                              /* portatile */
    x.addColorStop(0, "#e4e7ee"); x.addColorStop(1, "#aeb3c0"); g.alu = x;
    c.__adesivo = g; return g;
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
  function ribbon(c, pts, rk, tipK) {                              /* coda: un nastro affusolato con la punta tonda */
    var n = pts.length, L = [], R = [], i, a, b, nx, ny, d, r;
    for (i = 0; i < n; i++) {
      a = pts[i > 0 ? i - 1 : 0]; b = pts[i < n - 1 ? i + 1 : n - 1]; nx = -(b.y - a.y); ny = b.x - a.x; d = Math.sqrt(nx * nx + ny * ny) || 1; nx /= d; ny /= d;
      r = pts[i].r * rk * (i === n - 1 ? tipK : i === n - 2 ? (1 + tipK) / 2 : 1);
      L.push([pts[i].x + nx * r, pts[i].y + ny * r]); R.push([pts[i].x - nx * r, pts[i].y - ny * r]);
    }
    c.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < n - 1; i++) c.quadraticCurveTo(L[i][0], L[i][1], (L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2);
    c.lineTo(L[n - 1][0], L[n - 1][1]);
    var p = pts[n - 1], q = pts[n - 2], tx = p.x - q.x, ty = p.y - q.y, al = Math.atan2(tx, -ty);   /* angolo della normale sinistra */
    c.arc(p.x, p.y, p.r * rk * tipK, al, al - PI, true);
    for (i = n - 2; i > 0; i--) c.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i - 1][0]) / 2, (R[i][1] + R[i - 1][1]) / 2);
    c.lineTo(R[0][0], R[0][1]); c.arc(pts[0].x, pts[0].y, pts[0].r * rk, al + PI, al, true); c.closePath();
  }

  /* ------------------------------------------------------------------ le parti del gatto (solo tracciati + fill) */
  function partTail(c, f) { c.beginPath(); ribbon(c, f.tail.pts, 1.08, 1.12); c.fill(); }
  function partBody(c, f) {
    var b = f.body, mx = (b.hips.x + b.chest.x) / 2;
    c.save(); c.translate(mx, 0); c.scale(b.sx, b.sy); c.translate(-mx, 0); c.beginPath();
    if (b.mid) { hull(c, b.hips.x, b.hips.y, b.hips.r, b.mid.x, b.mid.y, b.mid.r); hull(c, b.mid.x, b.mid.y, b.mid.r, b.chest.x, b.chest.y, b.chest.r); }
    else hull(c, b.hips.x, b.hips.y, b.hips.r, b.chest.x, b.chest.y, b.chest.r);
    c.fill(); c.restore();
    /* il collo: dal petto alla testa, liscio */
    var h = f.head, hr = Math.min(h.ry, h.rx) * 0.72; c.beginPath(); hull(c, b.chest.x, b.chest.y, b.chest.r * 0.86, h.x, h.y - h.ry * 0.12, hr); c.fill();
  }
  function pawGeo(l, f) {
    var fx = f.fwd[0], ax = Math.abs(fx), s = fx >= 0 ? 1 : -1;
    return { x: l.fx + s * l.paw * 0.3 * Math.min(1, ax + 0.15), y: l.fy + l.paw * 0.62, rx: l.paw * (0.86 + 0.3 * ax), ry: l.paw * 0.7 };
  }
  function partLeg(c, l, f, noPaw) {
    var hind = !l.front, r0 = l.r0 * (hind ? 1.2 : 1.05), rk = (l.r0 + l.r1) / 2 * (hind ? 1.0 : 0.96), r1 = l.r1 * 0.94;
    c.beginPath(); hull(c, l.jx, l.jy, r0, l.kx, l.ky, rk); hull(c, l.kx, l.ky, rk, l.fx, l.fy + l.r1 * 0.9, r1); c.fill();
    if (noPaw) return;
    var p = pawGeo(l, f); c.beginPath(); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); c.fill();
  }
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
  function headFrame(h) { var ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1; return { ux: h.u[0] / ul, uy: h.u[1] / ul }; }
  function headPath(c, h, fr) {                                    /* testa più larga che alta, guance piene in basso, cima appena piatta */
    var rxe = h.depth + (h.rx - h.depth) * Math.abs(h.fz), ry = h.ry, i, N = 36;
    c.save(); c.translate(h.x, h.y); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0);
    for (i = 0; i < N; i++) {
      var a = i / N * TAU, ca = Math.cos(a), sa = Math.sin(a), x, y;
      if (sa >= 0) { x = rxe * (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 0.92); y = ry * Math.pow(sa, 0.82) * 0.98; }
      else { x = rxe * (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 0.74) * (1 + 0.04 * Math.abs(sa)); y = -ry * Math.pow(-sa, 1.08) * 0.9; }
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.restore();
  }

  /* la zampa davanti che si aggrappa: dita in fila, artigli chiari; pads = si vedono i cuscinetti rosa */
  function clingPaw(c, x, y, r, ang, pal, pads, sepOn, o, claws) {
    c.save(); c.translate(x, y); c.rotate(ang);
    if (sepOn) { c.save(); c.translate(-o, o); c.fillStyle = sepOn; c.beginPath(); c.ellipse(0, 0, r * 1.28, r * 1.02, 0, 0, TAU); c.fill(); c.restore(); }
    c.fillStyle = pal.ink; c.beginPath(); c.ellipse(0, 0, r * 1.28, r * 1.02, 0, 0, TAU); c.fill();
    var i;
    if (pads) {
      c.fillStyle = PAD; c.beginPath(); c.ellipse(0, -r * 0.28, r * 0.5, r * 0.36, 0, 0, TAU); c.fill();
      for (i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(i * r * 0.56, r * 0.4 - Math.abs(i) * r * 0.12, r * 0.22, r * 0.25, 0, 0, TAU); c.fill(); }
    } else {
      c.strokeStyle = pal.toe; c.lineWidth = Math.max(0.16, r * 0.09); c.lineCap = "round";
      for (i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(i * r * 0.36, r * 0.95); c.lineTo(i * r * 0.3, r * 0.22); c.stroke(); }
    }
    if (claws) { c.strokeStyle = "rgba(240,242,250,.9)"; c.lineWidth = Math.max(0.14, r * 0.08); c.lineCap = "round"; }   /* artigli */
    if (claws) for (i = -1; i <= 1; i++) { var cx0 = i * r * 0.6, cy0 = r * 0.92 - Math.abs(i) * r * 0.1; c.beginPath(); c.moveTo(cx0, cy0); c.quadraticCurveTo(cx0 + i * r * 0.05, cy0 + r * 0.42, cx0 - r * 0.06, cy0 + r * 0.5); c.stroke(); }
    c.restore();
  }

  /* ------------------------------------------------------------------ occhi, muso, baffi */
  function eye(c, e, fr, ss, pal, g) {
    var open = e.open, big = 1 + Math.max(0, open - 1) * 0.32, r = e.r * big, o = Math.min(1, open);
    c.save(); c.globalAlpha = e.vis; c.translate(e.x, e.y); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0); c.scale(e.sx, 1);
    if (o < 0.14) {                                                 /* chiuso: un arco morbido, contento */
      c.strokeStyle = pal.lash; c.lineWidth = Math.max(0.5, r * 0.17); c.lineCap = "round";
      c.beginPath(); c.arc(0, r * 0.42, r * 0.82, PI * 1.18, PI * 1.82); c.stroke(); c.restore(); return;
    }
    var inner = -e.side * ss, sl = e.brow * r * 0.62, lidY = r - 2 * r * (1 - o) * 0.92 - r * e.lid * 0.85;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.save(); c.clip();
    c.save(); c.scale(r, r); c.fillStyle = g.eye; c.fillRect(-1, -1, 2, 2); c.restore();
    var pw = r * (0.13 + 0.5 * e.pupil.w), px = e.pupil.dx * r * 0.33, py = e.pupil.dy * r * 0.28 - r * 0.04;
    c.fillStyle = "#050507"; c.beginPath(); c.ellipse(px, py, pw, r * 0.8, 0, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,255,255,.97)"; c.beginPath(); c.arc(-r * 0.36 + px * 0.25, r * 0.4 + py * 0.2, r * 0.25, 0, TAU); c.fill();   /* il riflesso netto */
    c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.arc(r * 0.34 + px * 0.2, -r * 0.4, r * 0.09, 0, TAU); c.fill();
    if (o < 1 || e.lid > 0.02 || e.brow > 0.02) {                   /* palpebra: piatta e inclinata quando è seccato */
      c.fillStyle = pal.ink; c.beginPath(); c.moveTo(-r * 1.3, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.3, lidY + (inner < 0 ? sl : -sl)); c.lineTo(r * 1.3, r * 1.6); c.lineTo(-r * 1.3, r * 1.6); c.closePath(); c.fill();
    }
    c.restore();
    c.restore();
  }
  function face(c, f, fr, pal, g, env) {
    var h = f.head, i, ss = (h.s[0] * fr.uy - h.s[1] * fr.ux) >= 0 ? 1 : -1;
    for (i = 0; i < 2; i++) if (f.eyes[i].vis >= 0.03) eye(c, f.eyes[i], fr, ss, pal, g);
    var m = f.mouth;
    if (m.vis > 0.3 && m.open > 0.06) {                              /* bocca aperta: miao o sbadiglio */
      var mo = m.open, w = 1.15 + 1.35 * mo, hh = 0.7 + 3.6 * mo;
      c.save(); c.globalAlpha = m.vis; c.translate(m.x, m.y); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0);
      c.beginPath(); c.moveTo(-w, 0); c.quadraticCurveTo(0, 0.55, w, 0); c.quadraticCurveTo(w * 1.02, -hh * 0.9, 0, -hh); c.quadraticCurveTo(-w * 1.02, -hh * 0.9, -w, 0); c.closePath();
      c.fillStyle = MOUTH; c.fill(); c.save(); c.clip();
      c.fillStyle = TONGUE; c.beginPath(); c.ellipse(0, -hh * 0.98, w * 0.78, hh * 0.42, 0, 0, TAU); c.fill(); c.restore();
      if (mo > 0.45) { c.fillStyle = "#fbf7f2"; for (i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(i * w * 0.78, 0.05); c.lineTo(i * w * 0.48, 0.12); c.lineTo(i * w * 0.62, -0.35 - 0.5 * mo); c.closePath(); c.fill(); } }
      c.restore();
    }
    if (f.nose.vis > 0.25) {                                         /* nasino rosa, un triangolo tondo */
      c.save(); c.globalAlpha = sat((f.nose.vis - 0.25) / 0.4); c.fillStyle = NOSE; c.translate(f.nose.x, f.nose.y); c.transform(fr.uy, -fr.ux, fr.ux, fr.uy, 0, 0);
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

  /* ------------------------------------------------------------------ il fez */
  function fezShape(c, x, y, tx, ty, rB, rT, ell, top, g) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    var eB = rB * Math.max(ell, 0.16), eT = rT * ell;
    c.fillStyle = g.fez; c.beginPath(); c.moveTo(-rB, 0);
    c.quadraticCurveTo(-rB * 0.93, len * 0.55, -rT, len); c.lineTo(rT, len); c.quadraticCurveTo(rB * 0.93, len * 0.55, rB, 0);
    c.ellipse(0, 0, rB, eB, 0, 0, PI, true); c.closePath(); c.fill();
    c.strokeStyle = "rgba(70,0,14,.35)"; c.lineWidth = 0.55; c.beginPath(); c.ellipse(0, 0.25, rB * 0.99, eB, 0, PI * 1.05, PI * 1.95, true); c.stroke();   /* il bordo in basso, un filo più scuro */
    c.fillStyle = top ? "#d8353f" : "#9a1526"; c.beginPath(); c.ellipse(0, len, rT, Math.max(eT, 0.2), 0, 0, TAU); c.fill();
    c.strokeStyle = "rgba(255,170,170,.45)"; c.lineWidth = 0.3; c.beginPath(); c.ellipse(0, len, rT * 0.98, Math.max(eT, 0.2), 0, PI * 1.02, PI * 1.98, true); c.stroke();
    c.fillStyle = "rgba(255,190,190,.16)"; c.beginPath(); c.moveTo(-rB * 0.62, 0.4); c.quadraticCurveTo(-rB * 0.6, len * 0.5, -rT * 0.62, len - 0.3); c.lineTo(-rT * 0.36, len - 0.3); c.quadraticCurveTo(-rB * 0.36, len * 0.5, -rB * 0.36, 0.5); c.closePath(); c.fill();   /* luce morbida del feltro */
    c.restore();
  }
  function tassel(c, x, y, t) {                                     /* il fiocco: cordino dal centro della cima, poi il ciuffo che pende */
    var dx = t.x1 - t.x0, dy = t.y1 - t.y0, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var kx = t.x0 + dx * 0.55, ky = t.y0 + dy * 0.55;
    c.strokeStyle = "#16080c"; c.lineWidth = 0.42; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(t.x0 + 0.2, t.y0 + 0.5, t.x0, t.y0); c.quadraticCurveTo(t.x0 + dx * 0.2, t.y0 + dy * 0.2 + 0.1, kx, ky); c.stroke();
    c.fillStyle = "#16080c"; c.beginPath(); c.arc(kx, ky, 0.55, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(kx + nx * 0.35, ky + ny * 0.35); c.quadraticCurveTo(t.x1 + nx * 1.1 - ux * 1.2, t.y1 + ny * 1.1 - uy * 1.2, t.x1 + nx * 0.95, t.y1 + ny * 0.95);
    c.lineTo(t.x1 - nx * 0.95, t.y1 - ny * 0.95); c.quadraticCurveTo(t.x1 - nx * 1.1 - ux * 1.2, t.y1 - ny * 1.1 - uy * 1.2, kx - nx * 0.35, ky - ny * 0.35); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,120,120,.22)"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(kx + nx * 0.2, ky + ny * 0.2); c.lineTo(t.x1 + nx * 0.5, t.y1 + ny * 0.5); c.stroke();
  }

  /* ------------------------------------------------------------------ il disegno */
  var last = { f: null, m: null, env: null };
  function draw(c, f, env) {
    env = env || {}; var pal = env.dark === false ? PAL.light : PAL.dark, g = G(c), i, l, h = f.head, fr = headFrame(h);
    var sc = env.scale || 2.6, o = Math.min(0.45, Math.max(0.15, 0.85 / sc));
    last.f = f; last.env = env; last.m = c.getTransform ? c.getTransform() : null;
    if (env.shadow && env.shadow.k > 0.01) { c.save(); c.globalAlpha = Math.min(1, env.shadow.k); c.translate((f.body.hips.x + f.body.chest.x) / 2 * 0.6, env.shadow.y); c.scale(17, 2.4); c.fillStyle = g.shadow; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore(); }
    c.save();
    if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); }

    /* che zampe vanno dove */
    var rx = h.depth + (h.rx - h.depth) * Math.abs(h.fz), cling = [false, false, false, false], beside = [false, false, false, false];
    for (i = 0; i < 2; i++) { l = f.legs[i]; if (l.up && Math.abs(l.fx - h.x) > rx * 0.7) { beside[i] = true; cling[i] = true; } }
    if (cling[0] || cling[1]) for (i = 2; i < 4; i++) { l = f.legs[i]; if (Math.abs(f.fwd[0]) < 0.4 && l.fy < f.body.hips.y && Math.abs(l.fx - f.body.hips.x) > f.body.hips.r * f.body.sx * 0.9) cling[i] = true; }   /* scivola: anche le zampe dietro, aperte, con i cuscinetti */
    var edgePaws = !!env.pawsOnEdge;
    function legsWhere(near, up) { var out = []; for (var j = 0; j < 4; j++) { var q = f.legs[j]; if (q.tuck >= 0.95) continue; if (edgePaws && q.front) continue; var isUp = q.up && !beside[j]; if (isUp !== up) continue; if (!up && !!q.near !== near) continue; out.push(q); } return out; }
    var farLegs = legsWhere(false, false), nearLegs = legsWhere(true, false), upLegs = legsWhere(true, true).concat(legsWhere(false, true));
    var es = f.ears.slice().sort(function (a, b) { return a.depth - b.depth; });

    function silhouette() {
      if (!f.tail.front) partTail(c, f);
      for (var j = 0; j < farLegs.length; j++) partLeg(c, farLegs[j], f, cling[f.legs.indexOf(farLegs[j])]);
      partBody(c, f);
      for (j = 0; j < nearLegs.length; j++) partLeg(c, nearLegs[j], f, cling[f.legs.indexOf(nearLegs[j])]);
      if (f.tail.front) partTail(c, f);
      for (j = 0; j < 2; j++) { c.beginPath(); earPath(c, es[j], h); c.fill(); }
      c.beginPath(); headPath(c, h, fr); c.fill();
      for (j = 0; j < upLegs.length; j++) partLeg(c, upLegs[j], f, false);
    }
    /* 1. il filo di luce: la sagoma intera spostata in alto a sinistra (solo sul fondo scuro) */
    if (pal.rim) {
      c.save(); c.translate(-o * 1.9, o * 1.9); c.fillStyle = pal.rim2; silhouette(); c.restore();
      c.save(); c.translate(-o, o); c.fillStyle = pal.rim; silhouette(); c.restore();
    }
    function sep(fn) { c.save(); c.translate(-o * 0.8, o * 0.8); c.fillStyle = pal.sep; fn(); c.restore(); }
    /* 2. dietro: coda, zampe lontane */
    c.fillStyle = pal.ink; if (!f.tail.front) partTail(c, f);
    for (i = 0; i < farLegs.length; i++) { l = farLegs[i]; c.fillStyle = pal.far; partLeg(c, l, f, cling[f.legs.indexOf(l)]); }
    /* 3. il corpo, poi le zampe vicine con un filo che le stacca */
    c.fillStyle = pal.ink; partBody(c, f);
    for (i = 0; i < nearLegs.length; i++) { l = nearLegs[i]; (function (q) { sep(function () { partLeg(c, q, f, cling[f.legs.indexOf(q)]); }); })(l); c.fillStyle = pal.ink; partLeg(c, l, f, cling[f.legs.indexOf(l)]); }
    if (f.tail.front) { sep(function () { partTail(c, f); }); c.fillStyle = pal.ink; partTail(c, f); }
    /* 4. orecchie (la lontana più chiara), con il rosa dentro; poi la testa */
    for (i = 0; i < 2; i++) {
      var e = es[i], farEar = i === 0 && Math.abs(es[0].depth - es[1].depth) > 1.2;
      c.fillStyle = farEar ? pal.far : pal.ink; c.beginPath(); var eg = earPath(c, e, h); c.fill();
      var pk = sm(-0.1, 0.5, h.fz) * (1 - 0.6 * e.flat) * (farEar ? 0.7 : 1);
      if (pk > 0.03) {
        var bx = e.bx + (e.tx - e.bx) * 0.12, by = e.by + (e.ty - e.by) * 0.12, w = e.w * 0.52, tx = e.tx - eg.ux * 2.4 - eg.nx * eg.out * 0.25, ty = e.ty - eg.uy * 2.4 - eg.ny * eg.out * 0.25;
        c.globalAlpha = pk; c.fillStyle = EAR_IN; c.beginPath(); c.moveTo(bx - eg.nx * w * eg.out, by - eg.ny * w * eg.out);
        c.quadraticCurveTo((bx + tx) / 2 - eg.nx * w * 0.5 * eg.out, (by + ty) / 2 - eg.ny * w * 0.5 * eg.out, tx, ty);
        c.quadraticCurveTo((bx + tx) / 2 + eg.nx * w * 0.9 * eg.out, (by + ty) / 2 + eg.ny * w * 0.9 * eg.out, bx + eg.nx * w * 0.8 * eg.out, by + eg.ny * w * 0.8 * eg.out); c.closePath(); c.fill(); c.globalAlpha = 1;
      }
    }
    sep(function () { c.beginPath(); headPath(c, h, fr); c.fill(); });
    c.fillStyle = pal.ink; c.beginPath(); headPath(c, h, fr); c.fill();
    face(c, f, fr, pal, g, env);
    if (f.fez) { fezShape(c, f.fez.x, f.fez.y, f.fez.tx, f.fez.ty, f.fez.rBase, f.fez.rTop, f.fez.ell, f.fez.top, g); var ts = f.fez.tassel, dxs = f.fez.rTop * 0.12; tassel(c, f.fez.tx, f.fez.ty, { x0: ts.x0 - dxs, y0: ts.y0 - 0.15, x1: ts.x1 - dxs, y1: ts.y1 }); }
    /* 5. zampe alzate davanti alla testa (si lava, dà una zampata) */
    for (i = 0; i < upLegs.length; i++) { l = upLegs[i]; (function (q) { sep(function () { partLeg(c, q, f, false); }); })(l); c.fillStyle = pal.ink; partLeg(c, l, f, false); }
    /* 6. zampe che si aggrappano (appeso, scivola): sopra tutto */
    for (i = 0; i < 4; i++) if (cling[i]) {
      l = f.legs[i]; var hook = i < 2 && Math.abs(l.fy) < 2.6, ang = Math.atan2(l.fy - l.ky, l.fx - l.kx) - PI / 2;
      clingPaw(c, l.fx, l.fy + (hook ? 0.9 : 0.4), l.paw, hook ? ang * 0.35 : ang * 0.6, pal, !hook, pal.sep, o, Math.abs(f.fwd[0]) < 0.4);
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
    var g = G(c); fezShape(c, 0, 0, 0, fz.h, fz.rBase, fz.rTop, fz.ell == null ? 0.22 : fz.ell, fz.top !== false, g);
    var a = fz.tasselAng || 0, x0 = -fz.rTop * 0.7, y0 = fz.h, L = (DOT.PROPS && DOT.PROPS.fez && DOT.PROPS.fez.tassel) || 6.4;
    tassel(c, 0, fz.h, { x0: x0, y0: y0, x1: x0 + L * Math.sin(a), y1: y0 - L * Math.cos(a) });
  }

  /* ------------------------------------------------------------------ gli oggetti di Dot */
  function rr(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var KUKKO = ["#ffb6c1", "#fdfd96", "#ffb347", "#77dd77", "#aec6cf", "#ff6961"];
  var CUBE = { F: [2, 0, 3, 5, 2, 4, 1, 2, 3], U: [0, 3, 0, 4, 0, 1, 2, 5, 0], R: [3, 4, 5, 3, 1, 3, 0, 3, 4] };

  /* le zampe che tengono l'oggetto: le ridisegna sopra, se il gatto le ha lì vicino (stesso contesto) */
  function pawsOver(c, w, hgt) {
    var f = last.f, m1 = last.m; if (!f || !m1 || !c.getTransform) return;
    var m2 = c.getTransform(), det = m2.a * m2.d - m2.b * m2.c; if (Math.abs(det) < 1e-9) return;
    var pal = last.env && last.env.dark === false ? PAL.light : PAL.dark, sc = (last.env && last.env.scale) || 2.6, o = Math.min(0.6, Math.max(0.17, 1.05 / sc));
    function loc(x, y) { var X = m1.a * x + m1.c * y + m1.e, Y = m1.b * x + m1.d * y + m1.f; X -= m2.e; Y -= m2.f; return [(m2.d * X - m2.c * Y) / det, (-m2.b * X + m2.a * Y) / det]; }
    var m1s = Math.sqrt(Math.abs(m1.a * m1.d - m1.b * m1.c)) / Math.sqrt(Math.abs(det)), i;
    for (i = 0; i < 2; i++) {
      var l = f.legs[i]; if (l.tuck > 0.5) continue; var p = pawGeo(l, f), q = loc(p.x, p.y), k = loc(l.kx * 0.22 + l.fx * 0.78, l.ky * 0.22 + (l.fy + l.r1) * 0.78);
      if (Math.abs(q[0]) > w * 0.5 + 3.4 || q[1] < -2.5 || q[1] > hgt + 2) continue;
      var rx = p.rx * m1s, ry = p.ry * m1s * 1.08, x = q[0], y = q[1];
      c.save(); c.translate(-o * 0.8, o * 0.8); c.fillStyle = pal.sep; c.beginPath(); hull(c, k[0], k[1], l.r1 * m1s, x, y, ry); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.restore();
      c.fillStyle = pal.ink; c.beginPath(); hull(c, k[0], k[1], l.r1 * m1s, x, y, ry); c.fill(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
      c.strokeStyle = pal.toe; c.lineWidth = 0.2; c.lineCap = "round"; var sd = x < 0 ? 1 : -1;
      c.beginPath(); c.moveTo(x + sd * rx * 0.55, y + ry * 0.35); c.lineTo(x + sd * rx * 0.9, y + ry * 0.1); c.moveTo(x + sd * rx * 0.55, y - ry * 0.3); c.lineTo(x + sd * rx * 0.92, y - ry * 0.25); c.stroke();
    }
  }

  function drawProp(c, name, p, env) {
    p = p || {}; env = env || last.env || {}; var g = G(c), t = p.t || 0, i, j, dark = env.dark !== false;
    c.save(); var SC = name === "tea" ? 1.38 : name === "cube" ? 1.3 : name === "laptop" ? 1.15 : name === "yarn" ? 1.15 : 1; c.scale(SC, SC);
    if (name === "tea") {                                           /* il bicchiere di tè alla menta, con il bordo d'oro */
      c.fillStyle = "rgba(255,255,255,.2)"; c.beginPath(); c.moveTo(-1.75, 0); c.lineTo(1.75, 0); c.quadraticCurveTo(2.0, 3.6, 2.45, 7.3); c.lineTo(-2.45, 7.3); c.quadraticCurveTo(-2.0, 3.6, -1.75, 0); c.closePath(); c.fill();
      c.fillStyle = g.tea; c.beginPath(); c.moveTo(-1.55, 0.85); c.lineTo(1.55, 0.85); c.quadraticCurveTo(1.82, 3.4, 2.15, 5.7); c.lineTo(-2.15, 5.7); c.quadraticCurveTo(-1.82, 3.4, -1.55, 0.85); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,226,150,.55)"; c.beginPath(); c.ellipse(0, 5.7, 2.15, 0.34, 0, 0, TAU); c.fill();
      c.fillStyle = "rgba(255,255,255,.16)"; c.beginPath(); c.ellipse(0, 0.42, 1.72, 0.4, 0, 0, TAU); c.fill();          /* il fondo spesso */
      c.fillStyle = "#e9c25c"; c.beginPath(); c.moveTo(-2.32, 6.35); c.lineTo(2.32, 6.35); c.lineTo(2.4, 6.95); c.lineTo(-2.4, 6.95); c.closePath(); c.fill();
      for (i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 0.82, 3.3 + Math.abs(i) * 0.05, 0.19, 0, TAU); c.fill(); }
      c.strokeStyle = "#e9c25c"; c.lineWidth = 0.16; c.beginPath(); for (i = -2; i < 2; i++) { c.moveTo(i * 0.82 + 0.2, 3.3); c.quadraticCurveTo(i * 0.82 + 0.41, 3.75, i * 0.82 + 0.62, 3.3); } c.stroke();
      c.fillStyle = "rgba(255,255,255,.75)"; c.beginPath(); c.moveTo(-1.45, 1.0); c.quadraticCurveTo(-1.6, 4, -1.85, 6.9); c.lineTo(-1.45, 6.9); c.quadraticCurveTo(-1.2, 4, -1.12, 1.0); c.closePath(); c.fill();
      /* la menta */
      c.fillStyle = "#3f8f3f"; c.beginPath(); c.ellipse(0.7, 7.75, 0.95, 0.5, 0.75, 0, TAU); c.fill();
      c.fillStyle = "#6fc15a"; c.beginPath(); c.ellipse(-0.35, 8.05, 1.05, 0.55, -0.6, 0, TAU); c.fill();
      c.fillStyle = "#56ab4c"; c.beginPath(); c.ellipse(0.25, 8.6, 0.8, 0.45, 0.2, 0, TAU); c.fill();
      c.strokeStyle = "#2f6e33"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(0.1, 6.2); c.lineTo(0.15, 8.5); c.stroke();
      /* il filo di vapore */
      c.strokeStyle = dark ? PAL.dark.steam : PAL.light.steam; c.lineWidth = 0.4; c.lineCap = "round";
      for (j = 0; j < 2; j++) { var ph = t * 1.7 + j * 2.2, sx = (j ? 1.0 : -0.6); c.globalAlpha = 0.85 - j * 0.3; c.beginPath(); c.moveTo(sx, 9.2); c.bezierCurveTo(sx + 1.1 * Math.sin(ph), 10.6, sx - 1.0 * Math.sin(ph + 1), 11.8, sx + 0.6 * Math.sin(ph + 2), 13.4 - j); c.stroke(); }
      c.globalAlpha = 1;
      pawsOver(c, 5, 7.3);
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
      pawsOver(c, S + 1, S + 1.8);
    } else if (name === "yarn") {                                   /* il gomitolo rosa, con il filo che scappa */
      var R = 3.6;
      c.strokeStyle = "#e98ea4"; c.lineWidth = 0.42; c.lineCap = "round"; c.beginPath(); c.moveTo(2.6, 1.0); c.bezierCurveTo(5.5, -0.2, 7.5, 0.5, 8.6, 0.25); c.bezierCurveTo(10, 0, 10.6, 1.4, 9.6, 1.6); c.stroke();
      c.fillStyle = g.yarn; c.beginPath(); c.arc(0, R, R, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, R, R, 0, TAU); c.clip(); c.strokeStyle = "rgba(170,70,100,.45)"; c.lineWidth = 0.26;
      for (i = 0; i < 5; i++) { c.beginPath(); c.ellipse(0.3, R - 0.2, R * 1.02, R * (0.22 + i * 0.17), -0.55, 0, TAU); c.stroke(); }
      c.strokeStyle = "rgba(255,230,236,.55)"; for (i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-0.4, R + 0.4, R * 0.95, R * (0.3 + i * 0.22), 0.9, PI * 0.9, PI * 1.6); c.stroke(); }
      c.restore();
      c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.ellipse(-1.35, R + 1.6, 0.8, 0.45, -0.6, 0, TAU); c.fill();
    } else if (name === "star") {                                   /* la stella-punto del sito: una luce d'oro */
      var tw = 1 + 0.08 * Math.sin(t * 5.3);
      c.save(); c.scale(tw, tw); c.fillStyle = g.star; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.restore();
      c.save(); c.rotate(t * 0.6); c.fillStyle = "rgba(255,240,200,.85)";
      for (i = 0; i < 2; i++) { c.rotate(PI / 2 * i); c.beginPath(); c.moveTo(0, 3.6 * tw); c.quadraticCurveTo(0.18, 0.18, 0.9, 0); c.quadraticCurveTo(0.18, -0.18, 0, -3.6 * tw); c.quadraticCurveTo(-0.18, -0.18, -0.9, 0); c.quadraticCurveTo(-0.18, 0.18, 0, 3.6 * tw); c.fill(); }
      c.restore();
      c.fillStyle = "#ffd36a"; c.beginPath(); c.arc(0, 0, 1.25, 0, TAU); c.fill(); c.fillStyle = "#fff8e4"; c.beginPath(); c.arc(-0.2, 0.2, 0.75, 0, TAU); c.fill();
    } else if (name === "laptop") {                                 /* il portatile: schermo scuro, righe di codice verdi */
      c.fillStyle = "#8d93a2"; c.beginPath(); c.moveTo(-6.6, 0); c.lineTo(6.2, 0); c.lineTo(6.6, 0.75); c.lineTo(-6.9, 0.75); c.closePath(); c.fill();
      c.fillStyle = g.alu; c.beginPath(); c.moveTo(-6.9, 0.75); c.lineTo(6.6, 0.75); c.lineTo(7.5, 2.1); c.lineTo(-5.4, 2.1); c.closePath(); c.fill();
      c.fillStyle = "rgba(60,64,80,.35)"; for (i = 0; i < 5; i++) c.fillRect(-4.8 + i * 2.1, 1.25, 1.6, 0.42);
      c.fillStyle = "#b9bfcb"; c.beginPath(); c.moveTo(-5.0, 2.1); c.lineTo(7.4, 2.1); c.lineTo(8.6, 10.4); c.lineTo(-3.6, 10.4); c.closePath(); c.fill();
      c.fillStyle = "#0f1426"; c.beginPath(); c.moveTo(-4.3, 2.75); c.lineTo(6.85, 2.75); c.lineTo(7.85, 9.8); c.lineTo(-3.3, 9.8); c.closePath(); c.fill();
      var lines = [[0, 4.2], [0.8, 3.0], [0.8, 4.6], [1.6, 2.4], [0.8, 3.4], [0, 2.0]], sh = Math.floor(t * 3) % 6;
      for (i = 0; i < 6; i++) { var ln = lines[(i + sh) % 6], yy = 9.0 - i * 1.08, xx = -2.9 + (yy - 2.75) * 0.142 + ln[0]; c.fillStyle = i === 5 ? "#a8f0b0" : "#6ad07c"; c.fillRect(xx, yy - 0.42, ln[1], 0.42); }
      c.fillStyle = "rgba(255,255,255,.07)"; c.beginPath(); c.moveTo(-4.3, 9.8); c.lineTo(0.8, 9.8); c.lineTo(-2.4, 2.75); c.lineTo(-4.3, 2.75); c.closePath(); c.fill();
      pawsOver(c, 12, 3);
    }
    c.restore();
  }

  /* ------------------------------------------------------------------ proporzioni e pose di questo aspetto */
  var SITT = { tw: 0.6, te: -0.25, tc: 1.0 };          /* seduto: la coda sta di lato e la punta si arriccia in su */
  var preset = {
    props: {
      headRx: 12.6, headRy: 10.3, headDepth: 10.4,
      eye: { fwd: 8.7, up: -1.3, side: 5.25, r: 4.05 },
      ear: { fwd: -1.2, up: 6.6, side: 6.4, tipFwd: -1.8, tipUp: 15.2, tipSide: 9.4, w: 4.7 },
      nose: { fwd: 10.2, up: -3.9 }, mouth: { fwd: 9.8, up: -5.0 },
      whisk: { fwd: 8.0, up: -3.6, side: 7.6, len: 6.2 },
      fez: { fwd: -1.0, up: 9.4, h: 7.0, rBase: 4.7, rTop: 3.4, lean: -0.14, tassel: 6.0 },
      chestR: 7.6, hipR: 8.8,
      leg: { len: 10.4, r0: 3.4, r1: 2.75, paw: 3.1 },
      tail: { len: 25, r0: 3.1, r1: 2.5 }
    },
    poses: {
      sit: { tw: 0.6, te: -0.25, tc: 1.0, dy: 10.6 }, yawn: SITT, groom: SITT, hold: { tw: 0.6, te: -0.25, tc: 1.0, fs: 0.9 }, sip: { tw: 0.6, te: -0.25, tc: 1.0, fs: 0.9 }, bat: SITT,
      type: { tw: 0.6, te: -0.25, tc: 1.0, f0x: 11.2, f0y: 2.4, f1x: 10.4, f1y: 2.8 },
      annoyed: { tw: 0.45, dy: 10.6 },
      peek: { dy: 15.4, fs: 8.4, f0y: 0.6, f1y: 0.6 },
      drape: { dx: 7.2, dy: 0.6, f0x: 8.4, f0y: -12.4, f2x: -6.4, f2y: -12.0, te: -1.5, tc: 0.35, hp: -0.16 },
      hang: { cy: -18.6, hy: -29, dy: 7.8, fs: 3.6, fo: 4.6, f0y: 1.2, f1y: 0.3, f2y: -39.6, f3y: -40.8, hs: -0.8, ho: 1.2, te: -1.3, tc: 0.7, tw: 0.3, eye: 1.12, hp: 0.12, sqx: 1.12 },
      belly: { f0x: 11, f0y: -3.5, f1y: -2, f2x: -6, f2y: -3.5, f3y: -2, hr: 3.0, dx: 8, dy: 1.5 },   /* a pancia in su: zampe in aria, testa dritta */
      slide: { cy: -8, hy: -17, dy: 9.4, fs: 3.2, fo: 7.4, f0y: 10.5, f1y: 6.5, f2y: -22.5, f3y: -21.2, hs: 1.4, ho: 5.6, sqx: 1.14, sqy: 1.0, ear: 0.5, eye: 1.32, te: -1.35, tc: 0.55, tw: -0.5 }
    }
  };

  DOT.looks.adesivo = { label: "Adesivo", preset: preset, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
