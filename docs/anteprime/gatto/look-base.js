/* look-base.js — l'aspetto di base di Dot: nero piatto, occhi verdi, fez rosso.
   Serve da esempio per gli altri aspetti (look-*.js) e da riferimento per le prove: non è quello definitivo.
   Un aspetto NON muove nulla: riceve il fotogramma dello scheletro (dot-rig.js) e lo disegna.
   draw(ctx, frame, env): ctx è già in unità del modello, origine sul punto a terra sotto il gatto, y IN ALTO.
   env = { dark, scale (pixel per unità: 1 pixel = 1/scale), shadow: { y, k } | null, clipY: numero | null (si disegna
   solo sopra quella quota: «dietro il bordo»), pawsOnEdge: bool (le zampe davanti restano davanti al bordo),
   rim: "notte" | false (facoltativo: il filo di luce per il fondo quasi nero; questo aspetto di prova lo ignora, Manifesto no) }. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {}); DOT.looks = DOT.looks || {};
  var TAU = Math.PI * 2, INK = "#0b0b0f", FAR = "#25252e", RED = "#c8202f", RED2 = "#e0404c", GREEN = "#9be15d", GREEN2 = "#58b947";

  function cap(c, x0, y0, r0, x1, y1, r1) {                       /* capsula affusolata tra due punti */
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
    c.beginPath(); c.arc(x0, y0, r0, 0, TAU); c.fill(); c.beginPath(); c.arc(x1, y1, r1, 0, TAU); c.fill();
    if (d < 0.01) return; var nx = -dy / d, ny = dx / d;
    c.beginPath(); c.moveTo(x0 + nx * r0, y0 + ny * r0); c.lineTo(x1 + nx * r1, y1 + ny * r1); c.lineTo(x1 - nx * r1, y1 - ny * r1); c.lineTo(x0 - nx * r0, y0 - ny * r0); c.closePath(); c.fill();
  }
  function leg(c, l, f) {
    cap(c, l.jx, l.jy, l.r0, l.kx, l.ky, (l.r0 + l.r1) / 2); cap(c, l.kx, l.ky, (l.r0 + l.r1) / 2, l.fx, l.fy + l.r1, l.r1);
    var sx = f.fwd[0] >= 0 ? 1 : -1; c.beginPath(); c.ellipse(l.fx + sx * l.paw * 0.35 * Math.min(1, Math.abs(f.fwd[0]) + 0.2), l.fy + l.paw * 0.62, l.paw * 1.12, l.paw * 0.7, 0, 0, TAU); c.fill();
  }
  function tail(c, f) { var p = f.tail.pts, i; for (i = 0; i < p.length - 1; i++) cap(c, p[i].x, p[i].y, p[i].r, p[i + 1].x, p[i + 1].y, p[i + 1].r); }
  function body(c, f) {
    var b = f.body, mx = (b.hips.x + b.chest.x) / 2;
    c.save(); c.translate(mx, 0); c.scale(b.sx, b.sy); c.translate(-mx, 0);
    if (b.mid) { cap(c, b.hips.x, b.hips.y, b.hips.r, b.mid.x, b.mid.y, b.mid.r); cap(c, b.mid.x, b.mid.y, b.mid.r, b.chest.x, b.chest.y, b.chest.r); }
    else cap(c, b.hips.x, b.hips.y, b.hips.r, b.chest.x, b.chest.y, b.chest.r);
    c.restore();
  }
  function fezShape(c, x, y, tx, ty, rB, rT, ell, top) {
    var ax = tx - x, ay = ty - y, len = Math.sqrt(ax * ax + ay * ay) || 1; ax /= len; ay /= len;
    c.save(); c.translate(x, y); c.transform(ay, -ax, ax, ay, 0, 0);
    c.fillStyle = RED; c.beginPath(); c.moveTo(-rB, 0); c.lineTo(rB, 0); c.lineTo(rT, len); c.lineTo(-rT, len); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, 0, rB, rB * ell, 0, 0, TAU); c.fill();
    c.fillStyle = top ? RED2 : RED; c.beginPath(); c.ellipse(0, len, rT, rT * ell, 0, 0, TAU); c.fill();
    c.restore();
  }
  function tassel(c, t) {
    c.strokeStyle = "#101014"; c.lineWidth = 0.5; c.lineCap = "round"; c.beginPath(); c.moveTo(t.x0 + 2.2, t.y0); c.quadraticCurveTo(t.x0, t.y0 + 0.6, t.x1, t.y1); c.stroke();
    c.fillStyle = "#101014"; c.beginPath(); c.arc(t.x1, t.y1, 0.95, 0, TAU); c.fill();
  }

  function draw(c, f, env) {
    env = env || {}; var i, l, h = f.head, ul = Math.sqrt(h.u[0] * h.u[0] + h.u[1] * h.u[1]) || 1, ux = h.u[0] / ul, uy = h.u[1] / ul;
    if (env.shadow && env.shadow.k > 0.01) { c.save(); c.translate(0, env.shadow.y); c.scale(1, 0.15); var g = c.createRadialGradient(0, 0, 0, 0, 0, 18); g.addColorStop(0, "rgba(0,0,8," + (0.5 * env.shadow.k).toFixed(3) + ")"); g.addColorStop(1, "rgba(0,0,8,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill(); c.restore(); }
    c.save();
    if (env.clipY != null) { c.beginPath(); c.rect(-500, env.clipY, 1000, 1000); c.clip(); }
    c.fillStyle = INK; if (!f.tail.front) tail(c, f);
    c.fillStyle = FAR; for (i = 0; i < 4; i++) { l = f.legs[i]; if (!l.near && l.tuck < 0.95) leg(c, l, f); }
    c.fillStyle = INK; body(c, f);
    for (i = 0; i < 4; i++) { l = f.legs[i]; if (l.near && !l.up && l.tuck < 0.95 && !(env.pawsOnEdge && l.front)) leg(c, l, f); }
    if (f.tail.front) tail(c, f);
    /* orecchie (prima della testa, così la base sparisce dentro), poi la testa */
    var es = f.ears.slice().sort(function (a, b) { return a.depth - b.depth; });
    for (i = 0; i < 2; i++) { var e = es[i], ex = e.tx - e.bx, ey = e.ty - e.by, el = Math.sqrt(ex * ex + ey * ey) || 1, nx = -ey / el, ny = ex / el, w = e.w;
      c.fillStyle = i === 0 ? FAR : INK; c.beginPath(); c.moveTo(e.bx + nx * w, e.by + ny * w); c.lineTo(e.tx, e.ty); c.lineTo(e.bx - nx * w, e.by - ny * w); c.closePath(); c.fill(); }
    var rxe = h.depth + (h.rx - h.depth) * Math.abs(h.fz);
    c.fillStyle = INK; c.save(); c.translate(h.x, h.y); c.transform(uy, -ux, ux, uy, 0, 0); c.beginPath(); c.ellipse(0, 0, rxe, h.ry, 0, 0, TAU); c.fill(); c.restore();
    if (f.fez) { fezShape(c, f.fez.x, f.fez.y, f.fez.tx, f.fez.ty, f.fez.rBase, f.fez.rTop, f.fez.ell, f.fez.top); tassel(c, f.fez.tassel); }
    c.fillStyle = INK; for (i = 0; i < 4; i++) { l = f.legs[i]; if (l.up && !(env.pawsOnEdge && l.front)) leg(c, l, f); }   /* le zampe alzate sopra la testa stanno davanti */
    /* il muso */
    var ss = (h.s[0] * uy - h.s[1] * ux) >= 0 ? 1 : -1;
    for (i = 0; i < 2; i++) {
      var ey2 = f.eyes[i]; if (ey2.vis < 0.03) continue; var r = ey2.r, open = Math.min(1, ey2.open);
      c.save(); c.globalAlpha = ey2.vis; c.translate(ey2.x, ey2.y); c.transform(uy, -ux, ux, uy, 0, 0); c.scale(ey2.sx, 1);
      if (open < 0.14) { c.strokeStyle = "rgba(235,255,225,.85)"; c.lineWidth = 0.6; c.lineCap = "round"; c.beginPath(); c.arc(0, r * 0.5, r * 0.9, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      else {
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
        var gg = c.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r); gg.addColorStop(0, GREEN); gg.addColorStop(1, GREEN2); c.fillStyle = gg; c.fillRect(-r, -r, 2 * r, 2 * r);
        c.fillStyle = "#07070a"; c.beginPath(); c.ellipse(ey2.pupil.dx * r * 0.34, ey2.pupil.dy * r * 0.3, r * (0.2 + 0.42 * ey2.pupil.w), r * 0.74, 0, 0, TAU); c.fill();
        c.fillStyle = "rgba(255,255,255,.92)"; c.beginPath(); c.arc(-r * 0.34, r * 0.38, r * 0.2, 0, TAU); c.fill();
        var lidY = r - 2 * r * (1 - open) * 0.9 - r * ey2.lid * 0.9, inner = -ey2.side * ss, sl = ey2.brow * r * 0.5;
        c.fillStyle = INK; c.beginPath(); c.moveTo(-r * 1.2, lidY + (inner < 0 ? -sl : sl)); c.lineTo(r * 1.2, lidY + (inner < 0 ? sl : -sl)); c.lineTo(r * 1.2, r * 1.5); c.lineTo(-r * 1.2, r * 1.5); c.closePath(); c.fill();
        if (open < 1) c.fillRect(-r, -r * 1.5, 2 * r, r * 0.5 + (1 - open) * r * 0.35);
      }
      c.restore();
    }
    if (f.nose.vis > 0.3) { c.save(); c.globalAlpha = f.nose.vis; c.fillStyle = "#e39aa8"; c.translate(f.nose.x, f.nose.y); c.transform(uy, -ux, ux, uy, 0, 0); c.beginPath(); c.moveTo(-1.1, 0.5); c.lineTo(1.1, 0.5); c.lineTo(0, -0.7); c.closePath(); c.fill(); c.restore(); }
    if (f.mouth.vis > 0.3 && f.mouth.open > 0.06) { c.save(); c.globalAlpha = f.mouth.vis; c.fillStyle = "#ff7f93"; c.translate(f.mouth.x, f.mouth.y); c.transform(uy, -ux, ux, uy, 0, 0); c.beginPath(); c.ellipse(0, -f.mouth.open * 0.9, 1.5 + 0.6 * f.mouth.open, 0.5 + 2.2 * f.mouth.open, 0, 0, TAU); c.fill(); c.restore(); }
    c.strokeStyle = "rgba(255,255,255,.72)"; c.lineWidth = 0.32; c.lineCap = "round";
    for (i = 0; i < 2; i++) { var wq = f.whiskers[i]; if (wq.vis < 0.05) continue; c.globalAlpha = wq.vis; for (var k = -1; k <= 1; k++) { var a = k * 0.3, ca = Math.cos(a), sa = Math.sin(a), dx = wq.dx * ca - wq.dy * sa, dy = wq.dx * sa + wq.dy * ca; c.beginPath(); c.moveTo(wq.x, wq.y + k * 0.5); c.lineTo(wq.x + dx * wq.len, wq.y + k * 0.5 + dy * wq.len); c.stroke(); } }
    c.globalAlpha = 1;
    c.restore();
    if (env.pawsOnEdge) { c.fillStyle = INK; for (i = 0; i < 2; i++) { l = f.legs[i]; c.beginPath(); c.ellipse(l.fx, l.fy + l.paw * 0.55, l.paw * 1.3, l.paw * 0.95, 0, 0, TAU); c.fill(); } }
  }

  /* il fez quando non è in testa: fz = { rBase, rTop, h, ell, top, tasselAng }, origine al centro della base, dritto */
  function drawFez(c, fz) {
    fezShape(c, 0, 0, 0, fz.h, fz.rBase, fz.rTop, fz.ell == null ? 0.22 : fz.ell, fz.top !== false);
    var a = fz.tasselAng || 0, x0 = -fz.rTop * 0.7, y0 = fz.h, L = 6.4; tassel(c, { x0: x0, y0: y0, x1: x0 + L * Math.sin(a), y1: y0 - L * Math.cos(a) });
  }

  /* gli oggetti di Dot: name = "tea" | "cube" | "yarn" | "star" | "laptop"; origine alla base dell'oggetto, y in alto; p = { t, open } */
  function drawProp(c, name, p) {
    p = p || {}; var i, j;
    if (name === "tea") {                                           /* il bicchiere di tè alla menta */
      c.fillStyle = "rgba(255,255,255,.28)"; c.beginPath(); c.moveTo(-2.1, 0); c.lineTo(2.1, 0); c.lineTo(2.9, 6.4); c.lineTo(-2.9, 6.4); c.closePath(); c.fill();
      c.fillStyle = "#c98a2b"; c.beginPath(); c.moveTo(-1.8, 0.4); c.lineTo(1.8, 0.4); c.lineTo(2.4, 4.6); c.lineTo(-2.4, 4.6); c.closePath(); c.fill();
      c.fillStyle = "#5fae4a"; c.beginPath(); c.ellipse(0.6, 5.2, 1.5, 0.8, 0.5, 0, TAU); c.fill();
      c.strokeStyle = "#e8b64a"; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-2.9, 6.4); c.lineTo(2.9, 6.4); c.stroke();
    } else if (name === "cube") {                                   /* il cubo, con i colori pastello di Imad */
      var col = ["#ffb347", "#ffb6c1", "#77dd77", "#aec6cf", "#fdfd96", "#ff6961", "#ffb347", "#77dd77", "#ffb6c1"];
      c.fillStyle = "#f4f1ea"; c.beginPath(); c.rect(-3.6, 0, 7.2, 7.2); c.fill(); c.fillStyle = "#fff"; c.fillRect(-3.6, 7.2, 7.2, 1.2);
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) { c.fillStyle = col[i * 3 + j]; c.fillRect(-3.3 + j * 2.25, 0.3 + i * 2.25, 1.95, 1.95); }
    } else if (name === "yarn") {                                   /* il gomitolo */
      c.fillStyle = "#e9e3d6"; c.beginPath(); c.arc(0, 3.4, 3.4, 0, TAU); c.fill(); c.strokeStyle = "#c9c0ae"; c.lineWidth = 0.35;
      for (i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, 3.4, 3.3, 1.1 + Math.abs(i) * 0.5, i * 0.5, 0, TAU); c.stroke(); }
      c.strokeStyle = "#e9e3d6"; c.lineWidth = 0.5; c.beginPath(); c.moveTo(3, 1.2); c.quadraticCurveTo(7, -0.4, 10, 0.6); c.stroke();
    } else if (name === "star") {                                   /* la stella-punto del sito */
      var g = c.createRadialGradient(0, 0, 0, 0, 0, 5); g.addColorStop(0, "rgba(255,226,160,.9)"); g.addColorStop(0.3, "rgba(240,180,80,.4)"); g.addColorStop(1, "rgba(240,180,80,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill();
      c.fillStyle = "#fff3d2"; c.beginPath(); c.arc(0, 0, 1.15, 0, TAU); c.fill();
    } else if (name === "laptop") {                                 /* il portatile */
      c.fillStyle = "#d9dbe2"; c.fillRect(-7, 0, 14, 1); c.fillStyle = "#c2c5cf"; c.beginPath(); c.moveTo(-6, 1); c.lineTo(6, 1); c.lineTo(7.2, 9.6); c.lineTo(-4.8, 9.6); c.closePath(); c.fill();
      c.fillStyle = "#12142a"; c.beginPath(); c.moveTo(-5.2, 1.7); c.lineTo(5.4, 1.7); c.lineTo(6.4, 8.9); c.lineTo(-4.2, 8.9); c.closePath(); c.fill();
      c.fillStyle = "#7de08a"; c.fillRect(-3.6, 6.8, 4, 0.5); c.fillRect(-3.3, 5.4, 6, 0.5); c.fillRect(-3, 4, 3, 0.5);
    }
  }

  DOT.looks.base = { label: "Base", preset: {}, draw: draw, drawFez: drawFez, drawProp: drawProp };
})();
