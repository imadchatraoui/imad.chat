/* dot-stage.js — gli oggetti dell'apertura: i nove tasti di imad.chat e la scatola di Dot (vedi DOT.md).
   Canvas 2D, «2D con profondità»: niente prospettiva storta, niente parallelogrammi. La profondità viene dalle due
   facce di ogni tasto (davanti e un filo di sopra), dalla luce che cambia mentre un lembo gira, dall'ombra del lembo
   sui tasti sotto, da schiacciamenti e sovrapposizioni.
   Contratto (lo usa il cervello, dot-brain.js):
     DOT.stage = { TS, mount(layer, {x, y}), place(x, y), draw(ts, t), rim(), lid(open), hit(x, y), unmount() }
   x, y sono coordinate della pagina del punto sul bordo alto del riquadro dove poggia la scatola (in basso al centro).
   Si disegna solo quando si chiama draw() o lid(). Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {});
  var PI = Math.PI, TAU = PI * 2;
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return sat((t - a) / (b - a)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function eIO(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function eOut(u) { return 1 - Math.pow(1 - u, 3); }
  function eBack(u, s) { return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* i tempi dell'apertura (secondi): il cervello li legge. Il coperchio finisce di aprirsi a lid + 0.42;
     eyes: due occhi verdi si aprono nel buio; blink: battono; peek: la testa sale; poi guarda, salta, atterra, saluta */
  var TS = { fl: 0.70, fr: 0.98, ft: 1.52, fb: 1.76, fd: 0.42, drop: 2.30, box: 2.72, wob: 3.00, lid: 3.50, eyes: 4.02, blink: 4.52, peek: 4.92, lookL: 5.46, lookR: 5.96, lookC: 6.42, crouch: 6.56, jump: 6.80, land: 7.28, bubble: 7.86, end: 8.10 };

  /* misure (px CSS) */
  var CW = 280, CH = 250, OX = 140, OY = 222;            /* tela e punto d'appoggio dentro la tela */
  var KEY = 30, PITCH = 34, BAND = 4, KR = 8, THICK = 7;  /* tasto: faccia, passo, filo di sopra, raggio, spessore */
  var PAD = 4, SW = KEY + PAD * 2, SH = KEY + BAND + PAD * 2;
  var BW = 46, BH = 30, BT = 14, LIDT = 3.2, WALL = 1.7, RIMF = 1.7, B_OPEN = 1.83;   /* scatola */
  var KZ = 0.58;                                          /* quanto sale sullo schermo ciò che è più lontano */
  var LETTERS = "imad.chat";
  var FONT = '800 17px Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /* colori: ceramica opaca, bianco caldo */
  var C = {
    band0: "#fffdf8", band1: "#f1e9da", face0: "#f8f4eb", face1: "#e2d9c8", back0: "#efe7d8", back1: "#d9ceba",
    side: "#e1d6c3", ink: "#1c1d26", hair: "rgba(70,50,22,.17)", crease: "rgba(120,92,52,.20)",
    top0: "#fffcf5", top1: "#efe6d5", under0: "#e3d8c5", under1: "#cfc1aa", rim: "#fbf6ec",
    in0: "#1d1916", in1: "#060507", dot: "#e9a93c", dotC: "#fbe0a0"
  };

  var S = null;   /* lo stato della scena montata */

  /* ------------------------------------------------------------------ piccoli strumenti di disegno */
  function rr(c, x, y, w, h, r, rb) {                     /* rettangolo arrotondato; rb = raggio degli angoli in basso */
    if (rb == null) rb = r; r = Math.max(0, Math.min(r, w / 2, h / 2)); rb = Math.max(0, Math.min(rb, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - rb);
    c.arcTo(x + w, y + h, x + w - rb, y + h, rb); c.lineTo(x + rb, y + h); c.arcTo(x, y + h, x, y + h - rb, rb); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function vgrad(c, y0, y1, a, b) { var g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function makeCanvas(w, h, k) { var cv = document.createElement("canvas"); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k); var c = cv.getContext("2d"); c.setTransform(k, 0, 0, k, 0, 0); return { cv: cv, c: c }; }

  /* ------------------------------------------------------------------ gli sprite, fatti una volta sola */
  function keySprite(ch, kind, k) {                       /* kind: "front" (con la lettera) | "back" (il retro, vuoto) | "white" | "black" (sagome per la luce) */
    var o = makeCanvas(SW, SH, k), c = o.c, x = PAD, y = PAD + BAND;
    if (kind === "white" || kind === "black") {
      c.fillStyle = kind === "white" ? "#fffaf0" : "#3b2a16"; rr(c, x, PAD, KEY, BAND + KR + 2, KR); c.fill(); rr(c, x, y, KEY, KEY, KR); c.fill(); return o.cv;
    }
    var back = kind === "back";
    /* il filo di sopra: la faccia alta del tasto, più chiara */
    c.fillStyle = vgrad(c, PAD, y + 4, back ? "#f8f2e6" : C.band0, back ? "#e6dccb" : C.band1); rr(c, x, PAD, KEY, BAND + KR + 2, KR); c.fill();
    c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + KR, PAD + 0.5); c.lineTo(x + KEY - KR, PAD + 0.5); c.stroke();
    /* la faccia davanti */
    c.fillStyle = vgrad(c, y, y + KEY, back ? C.back0 : C.face0, back ? C.back1 : C.face1); rr(c, x, y, KEY, KEY, KR); c.fill();
    /* ombra morbida ai lati: la faccia è appena bombata */
    var g = c.createLinearGradient(x, 0, x + KEY, 0); g.addColorStop(0, "rgba(90,64,30,.10)"); g.addColorStop(0.22, "rgba(90,64,30,0)"); g.addColorStop(0.78, "rgba(90,64,30,0)"); g.addColorStop(1, "rgba(90,64,30,.12)");
    c.fillStyle = g; rr(c, x, y, KEY, KEY, KR); c.fill();
    /* lo spigolo tra sopra e davanti, poi un filo di luce sotto lo spigolo */
    var gc = c.createLinearGradient(0, y, 0, y + 3); gc.addColorStop(0, "rgba(120,92,52,.16)"); gc.addColorStop(1, "rgba(120,92,52,0)"); c.fillStyle = gc; rr(c, x, y, KEY, KEY, KR); c.fill();
    /* un filo sottile tutt'intorno: sul chiaro il tasto non si perde */
    c.strokeStyle = C.hair; c.lineWidth = 0.6; rr(c, x + 0.3, PAD + 0.3, KEY - 0.6, KEY + BAND - 0.6, KR); c.stroke();
    if (!back && ch !== ".") {
      c.font = FONT; c.textAlign = "center"; c.textBaseline = "alphabetic";
      var bx = x + KEY / 2, by = y + KEY / 2 + 6;
      c.fillStyle = "rgba(255,255,255,.4)"; c.fillText(ch, bx, by + 0.5);     /* incisa: un filo di luce sotto */
      c.fillStyle = C.ink; c.fillText(ch, bx, by);
    }
    return o.cv;
  }
  function blurSprite(w, h, r, blur, k) {                 /* ombra morbida di un rettangolo arrotondato */
    var p = blur * 2, o = makeCanvas(w + p * 2, h + p * 2, k), c = o.c;
    c.shadowColor = "rgba(0,0,0,1)"; c.shadowBlur = blur * k; c.shadowOffsetX = 1000 * k; c.fillStyle = "#000";
    rr(c, p - 1000, p, w, h, r); c.fill(); return { cv: o.cv, w: w + p * 2, h: h + p * 2 };
  }
  function radialSprite(stops, k) {                       /* disco con sfumatura radiale, raggio 32 */
    var o = makeCanvas(64, 64, k), c = o.c, g = c.createRadialGradient(32, 32, 0, 32, 32, 32), i;
    for (i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); return o.cv;
  }
  function buildSprites() {
    var k = S.dpr * 1.15, i, sp = { front: [], back: null, white: null, black: null };
    for (i = 0; i < 9; i++) sp.front.push(keySprite(LETTERS[i], "front", k));
    sp.back = keySprite("", "back", k); sp.white = keySprite("", "white", k); sp.black = keySprite("", "black", k);
    sp.ao = blurSprite(KEY - 2, KEY - 2, KR, 2.2, S.dpr);
    sp.soft = blurSprite(KEY, KEY, KR, 5, S.dpr);
    sp.contact = radialSprite([[0, "rgba(6,6,14,.55)"], [0.55, "rgba(6,6,14,.25)"], [1, "rgba(6,6,14,0)"]], S.dpr);
    sp.glow = radialSprite([[0, "rgba(255,220,150,.95)"], [0.22, "rgba(242,180,70,.55)"], [0.55, "rgba(236,166,58,.16)"], [1, "rgba(236,166,58,0)"]], S.dpr * 1.5);
    sp.spark = radialSprite([[0, "rgba(255,246,214,1)"], [0.18, "rgba(255,214,140,.9)"], [0.45, "rgba(240,176,66,.28)"], [1, "rgba(240,176,66,0)"]], S.dpr);
    S.sp = sp;
  }

  /* ------------------------------------------------------------------ la stella-punto: il nucleo dorato e il suo alone */
  function drawDot(c, x, y, r, ky, glow) {
    var sp = S.sp; ky = Math.max(0.04, ky);
    if (glow > 0.01) { c.globalAlpha = Math.min(1, glow); c.drawImage(sp.glow, x - r * 3.3, y - r * 3.3 * Math.max(ky, 0.5), r * 6.6, r * 6.6 * Math.max(ky, 0.5)); c.globalAlpha = 1; }
    var g = c.createRadialGradient(x - r * 0.25, y - r * 0.3 * ky, 0, x, y, r); g.addColorStop(0, C.dotC); g.addColorStop(0.45, "#f0b54c"); g.addColorStop(1, C.dot);
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * ky, 0, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,250,232,.9)"; c.beginPath(); c.ellipse(x - r * 0.32, y - r * 0.34 * ky, r * 0.26, r * 0.22 * ky, 0, 0, TAU); c.fill();
  }

  /* ------------------------------------------------------------------ un tasto: posizione del centro della faccia, scale, retro, luce */
  function drawKey(c, i, s) {
    var sp = S.sp, img = s.back ? sp.back : sp.front[i], ax = Math.abs(s.sx), ay = Math.abs(s.sy);
    if (s.alpha <= 0.01 || (ax < 0.002 && !s.side) || ay < 0.002) return;
    c.save(); c.globalAlpha = s.alpha;
    /* lo spessore della lastra mentre gira: una fascia del colore del fianco tra la faccia e il retro */
    if (s.side) {
      var hw = KEY / 2 * ax, hh = KEY / 2 * ay, dx = s.sideX || 0, dy = s.sideY || 0;
      var x0 = Math.min(-hw, -hw + dx), x1 = Math.max(hw, hw + dx), y0 = Math.min(-hh, -hh + dy) - BAND * ay, y1 = Math.max(hh, hh + dy);
      c.fillStyle = vgrad(c, s.y + y0, s.y + y1, "#efe6d6", "#d4c8b3");
      rr(c, s.x + x0, s.y + y0, x1 - x0, y1 - y0, Math.min(KR * Math.max(ax, 0.4), (x1 - x0) / 2)); c.fill();
    }
    if (ax > 0.002) {
      c.translate(s.x, s.y); c.scale(s.sx, s.sy);
      var ox = -(PAD + KEY / 2), oy = -(PAD + BAND + KEY / 2);
      c.drawImage(img, ox, oy, SW, SH);
      if (s.dark > 0.01) { c.globalAlpha = s.alpha * Math.min(0.6, s.dark); c.drawImage(sp.black, ox, oy, SW, SH); }
      if (s.light > 0.01) { c.globalAlpha = s.alpha * Math.min(0.5, s.light); c.drawImage(sp.white, ox, oy, SW, SH); }
      if (s.dot && !s.back) { c.globalAlpha = s.alpha; drawDot(c, 0, 0.5, 4.4, 1, s.glow); }
    }
    c.restore();
  }

  /* luce: da sopra, un po' da sinistra, verso chi guarda */
  var LX = -0.42, LY = 0.55, LZ = 0.72;
  function lum(nx, ny, nz) { return nx * LX + ny * LY + nz * LZ; }
  function shade(s, l) { s.dark = sat((0.72 - l) / 0.9) * 0.36; s.light = sat((l - 0.74) / 0.26) * 0.4; }

  function bump(ts, at) { var v = (ts - at) / 0.3; return v > 0 && v < 1 ? Math.sin(PI * v) * (1 - v) : 0; }

  /* ------------------------------------------------------------------ la faccia di nove tasti e le pieghe */
  function keysState(ts) {
    var out = [], i, hp = PITCH / 2, yMid = -KEY / 2 - PITCH;
    for (i = 0; i < 9; i++) {
      var col = i % 3, row = (i / 3) | 0, s = { i: i, x: (col - 1) * PITCH, y: -KEY / 2 - (2 - row) * PITCH, sx: 1, sy: 1, alpha: 1, back: false, dark: 0, light: 0, z: 0, flap: false, dot: i === 4, glow: 0.4, row: row, col: col, ground: row === 2 };
      /* arrivano uno dopo l'altro, in ordine di lettura: una piccola caduta e si posano */
      var a0 = 0.02 + i * 0.045, u = seg(ts, a0, a0 + 0.24);
      if (u <= 0) { s.alpha = 0; out.push(s); continue; }
      if (u < 0.45) { var f = u / 0.45, gr = 0.55 + 0.45 * eOut(sat(f * 1.4)); s.y -= 12 * (1 - f * f); s.alpha = sat(u / 0.06); s.sy = gr * (1 + 0.06 * f); s.sx = gr * (1 - 0.03 * f); }
      else { var v = (u - 0.45) / 0.55, q = Math.sin(PI * Math.min(1, v * 1.6)) * (1 - v); s.sy = 1 - 0.1 * q; s.sx = 1 + 0.07 * q; s.y += KEY / 2 * 0.1 * q; }
      var B = 0;                                         /* la colonna di mezzo riceve i colpi delle pieghe */
      if (col === 1) B = bump(ts, TS.fl + TS.fd * 0.92) + bump(ts, TS.fr + TS.fd * 0.92);
      if (i === 4) B += bump(ts, TS.ft + TS.fd * 0.92) + bump(ts, TS.fb + TS.fd * 0.92);
      if (B) { s.sx *= 1 + 0.07 * B; s.sy *= 1 - 0.09 * B; s.light = 0.25 * B; }
      var at = col === 0 ? TS.fl : col === 2 ? TS.fr : row === 0 ? TS.ft : row === 2 ? TS.fb : -1, w, th, cs, sn, big, sink;
      if (at >= 0 && ts >= at) {
        w = seg(ts, at, at + TS.fd);
        if (w >= 1) { s.alpha = 0; out.push(s); continue; }
        th = PI * eIO(sat(w / 0.8)); cs = Math.cos(th); sn = Math.sin(th); sink = seg(w, 0.8, 1); big = (1 + 0.1 * sn) * (1 - 0.1 * eIO(sat(sink / 0.65)));
        s.flap = true; s.z = hp * sn; s.back = cs < 0; s.alpha = w < 0.93 ? 1 : 0;
        if (col !== 1) {                                  /* piega di lato: la cerniera sta tra le colonne */
          var sg = col === 0 ? -1 : 1;
          s.x = sg * hp + sg * hp * cs; s.sx = cs * big; s.sy = big; s.y += 2.5 * sn; s.side = true; s.sideX = sg * THICK * sn; s.sideY = 0;   /* il dietro della lastra scappa verso l'esterno */
          if (!s.back) shade(s, lum(-sg * sn, 0, cs)); else shade(s, lum(sg * sn, 0, -cs));
        } else {                                          /* piega in alto o in basso: la cerniera sta tra le righe */
          var sv = row === 0 ? -1 : 1, hinge = yMid + sv * hp;
          /* la cinepresa sta un filo in alto: la faccia che viene verso di noi si vede anche un po' da sopra */
          var m = cs + sv * 0.35 * sn; s.back = m < 0;
          s.y = hinge + sv * hp * m + 2.5 * sn; s.sy = m * big; s.sx = big; s.side = true; s.sideX = 0; s.sideY = sv * THICK * sn * 0.8;
          if (!s.back) shade(s, lum(0, row === 0 ? -sn : sn, cs)); else shade(s, lum(0, row === 0 ? sn : -sn, -cs));
        }
        s.ground = false;
      }
      if (i === 4) s.glow = 0.34 + 0.13 * (seg(ts, TS.fl + TS.fd * 0.92, TS.fl + TS.fd * 1.1) + seg(ts, TS.fr + TS.fd * 0.92, TS.fr + TS.fd * 1.1) + seg(ts, TS.ft + TS.fd * 0.92, TS.ft + TS.fd * 1.1) + seg(ts, TS.fb + TS.fd * 0.92, TS.fb + TS.fd * 1.1));
      out.push(s);
    }
    /* il tasto col punto, rimasto solo, cade sul bordo: gravità, poi si schiaccia */
    var c4 = out[4], tf = 0.19, g = 2 * PITCH / (tf * tf);
    if (ts >= TS.drop) {
      var tau = ts - TS.drop;
      if (tau < tf) { c4.y = yMid + 0.5 * g * tau * tau; c4.sy = 1 + 0.07 * tau / tf; c4.sx = 1 - 0.04 * tau / tf; }
      else { var l = (tau - tf) / 0.22, sq = l < 1 ? Math.sin(PI * l) * (1 - l) * 1.3 : 0; c4.y = -KEY / 2; c4.sx = 1 + 0.18 * sq; c4.sy = 1 - 0.2 * sq; c4.y += KEY / 2 * 0.2 * sq; }
      c4.ground = true; c4.gk = sat(tau / tf); c4.gk *= c4.gk;
    } else if (ts >= TS.fb + TS.fd * 0.5) { c4.ground = true; c4.gk = 0.22; }
    return out;
  }

  function drawKeys(c, ts) {
    var st = keysState(ts), sp = S.sp, i, s, order = [];
    /* ombre di contatto sul bordo del riquadro */
    for (i = 0; i < 9; i++) { s = st[i]; if (!s.ground || s.alpha <= 0.01) continue; var gk = s.gk == null ? 1 : s.gk, hgt = -(s.y + KEY / 2 * s.sy);
      var cw = (KEY + 8) * Math.abs(s.sx) * (1 + hgt / 60), chh = 7 * (1 + hgt / 50);
      c.globalAlpha = s.alpha * (0.85 - 0.4 * sat(hgt / 34)) * (0.4 + 0.6 * gk); c.drawImage(sp.contact, s.x - cw / 2, 1 - chh / 2, cw, chh); }
    c.globalAlpha = 1;
    /* prima i tasti fermi, dal basso in alto (l'ombra di quello sopra cade sul filo di quello sotto), poi i lembi che girano */
    for (i = 0; i < 9; i++) if (!st[i].flap) order.push(st[i]);
    order.sort(function (a, b) { return b.row - a.row; });
    for (i = 0; i < order.length; i++) { s = order[i]; if (s.alpha <= 0.01) continue;
      if (!s.ground || s.row < 2) { c.globalAlpha = s.alpha * 0.26; c.drawImage(sp.ao.cv, s.x - sp.ao.w / 2 * s.sx, s.y + 2.6 - sp.ao.h / 2 * s.sy, sp.ao.w * s.sx, sp.ao.h * s.sy); c.globalAlpha = 1; }
      drawKey(c, s.i, s); }
    var flaps = []; for (i = 0; i < 9; i++) if (st[i].flap && st[i].alpha > 0.01) flaps.push(st[i]);
    if (flaps.length) {
      /* l'ombra del lembo cade solo sui tasti che stanno sotto */
      c.save(); c.beginPath(); var any = false;
      for (i = 0; i < order.length; i++) { s = order[i]; if (s.alpha <= 0.01) continue; any = true; var w2 = KEY * s.sx, h2 = (KEY + BAND) * s.sy; rrSub(c, s.x - w2 / 2, s.y - KEY / 2 * s.sy - BAND, w2, h2, KR); }
      if (any) { c.clip();
        for (i = 0; i < flaps.length; i++) { s = flaps[i]; var z = s.z, wsh = KEY * Math.max(Math.abs(s.sx), 0.3) + z * 0.6, hsh = KEY * Math.max(Math.abs(s.sy), 0.3) + z * 0.4;
          c.globalAlpha = 0.3 * (z / (PITCH / 2)) * s.alpha; c.drawImage(sp.soft.cv, s.x + z * 0.5 - wsh / 2 - 5, s.y + z * 0.62 - hsh / 2 - 5, wsh + 10, hsh + 10); } }
      c.restore(); c.globalAlpha = 1;
      for (i = 0; i < flaps.length; i++) drawKey(c, flaps[i].i, flaps[i]);
    }
    S.geo = { mode: "keys", x0: -PITCH * 1.5, x1: PITCH * 1.5, y0: -KEY - 2 * PITCH - BAND - 4, y1: 2 };
  }
  function rrSub(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); }

  /* ------------------------------------------------------------------ la scatola */
  function boxState(ts) {
    var b = { W: BW, H: BH, T: BT, lidT: LIDT, beta: 0, tip: 1, band: 0, rot: 0, piv: 0, hop: 0, sx: 1, sy: 1, glow: 0.8 };
    var tu = eIO(seg(ts, TS.box, TS.box + 0.15));
    /* si ribalta all'indietro: la faccia col punto diventa il coperchio */
    b.tip = tu; b.hop = -5 * Math.sin(PI * seg(ts, TS.box, TS.box + 0.17));
    var gt = ts - (TS.box + 0.1), g = gt <= 0 ? 0 : 1 - Math.exp(-11 * gt) * Math.cos(14 * gt);
    var tipW = KEY, tipH = lerp(0, 6, tu), tipT = lerp(KEY, 17, tu);
    b.W = lerp(tipW, BW, g); b.H = lerp(tipH, BH, g); b.T = lerp(tipT, BT, Math.min(1, g)); b.lidT = lerp(0, LIDT, sat(g)); b.band = BAND * (1 - tu);
    b.glow = 0.82 + 0.1 * sat(g);
    if (ts < TS.box + 0.4) { var sp = Math.sin(PI * seg(ts, TS.box + 0.1, TS.box + 0.36)); b.sy = 1 + 0.05 * sp; b.sx = 1 - 0.03 * sp; }
    /* qualcosa dentro: dondola due volte, poi saltella */
    if (ts >= TS.wob && ts < TS.lid + 0.02) {
      var w1 = seg(ts, TS.wob, TS.wob + 0.15), w2 = seg(ts, TS.wob + 0.15, TS.wob + 0.3), h = seg(ts, TS.wob + 0.31, TS.lid);
      if (w1 > 0 && w1 < 1) { b.rot = 0.1 * Math.sin(PI * w1); b.piv = BW / 2; b.beta = 0.07 * Math.sin(PI * w1); }
      else if (w2 > 0 && w2 < 1) { b.rot = -0.085 * Math.sin(PI * w2); b.piv = -BW / 2; b.beta = 0.06 * Math.sin(PI * w2); }
      if (h > 0) {
        if (h < 0.22) { var a = Math.sin(PI * h / 0.22); b.sy = 1 - 0.08 * a; b.sx = 1 + 0.05 * a; }
        else { var hh = (h - 0.22) / 0.78; b.hop = -5.5 * 4 * hh * (1 - hh); b.sy = 1 + 0.05 * Math.sin(PI * hh); b.sx = 1 - 0.03 * Math.sin(PI * hh); b.beta = 0.2 * Math.sin(PI * Math.min(1, hh * 1.3)); }
      }
    }
    /* il coperchio si apre sul cardine di dietro e resta su */
    if (ts >= TS.lid) {
      var o = seg(ts, TS.lid, TS.lid + 0.42); b.beta = B_OPEN * eBack(o, 1.5);
      var r = seg(ts, TS.lid, TS.lid + 0.2); if (r < 1) { var ra = Math.sin(PI * r); b.sy = 1 - 0.07 * ra; b.sx = 1 + 0.045 * ra; }
    }
    if (ts >= TS.end && S.lidOv != null) b.beta = B_OPEN * sat(S.lidOv);
    return b;
  }
  function lidGeo(b) {                                    /* il coperchio: dove sta il suo bordo davanti rispetto al cardine */
    var D = b.T / KZ, e = D * (0.82 * Math.sin(b.beta) - KZ * Math.cos(b.beta));   /* e > 0: il bordo è sopra il cardine (si vede la faccia di sotto) */
    var off = b.lidT * (0.82 * Math.cos(b.beta) + KZ * Math.sin(b.beta));
    return { D: D, e: e, off: off };
  }

  function drawBox(c, ts, t) {
    var b = boxState(ts), sp = S.sp, W = b.W, H = b.H, T = b.T, yF = -H, yH = yF - T, L = lidGeo(b), x0 = -W / 2;
    /* ombra di contatto (non gira con la scatola, si stringe quando salta) */
    var hk = sat(-b.hop / 8), cw = (W + 16) * (1 - 0.2 * hk) * b.sx, chh = 8 * (1 - 0.2 * hk);
    c.globalAlpha = 0.9 - 0.4 * hk; c.drawImage(sp.contact, -cw / 2 + b.rot * 10, 1 - chh / 2, cw, chh); c.globalAlpha = 1;
    c.save();
    if (b.rot) { c.translate(b.piv, 0); c.rotate(b.rot); c.translate(-b.piv, 0); }
    c.translate(0, b.hop); c.scale(b.sx, b.sy);
    var lx0 = x0 - 1 * sat(b.lidT / LIDT), lw = W + 2 * sat(b.lidT / LIDT), open = L.e > 0, inside = b.beta > 0.005 && b.tip >= 1;
    if (open) drawLid(c, b, L, lx0, lw, yH, true);
    /* sopra: il bordo delle pareti e il buio dentro */
    if (inside) {
      c.fillStyle = vgrad(c, yH, yF, "#f6efe2", C.rim); rr(c, x0, yH, W, T + 1, 5, 0); c.fill();
      var ix = x0 + WALL, iw = W - WALL * 2, iy = yH + 1.1, ih = T - 1.1 - RIMF;
      /* dentro: la parete di dietro in ombra calda, poi il buio quasi nero */
      var gi = c.createLinearGradient(0, iy, 0, iy + ih); gi.addColorStop(0, "#43372d"); gi.addColorStop(0.42, "#241e19"); gi.addColorStop(0.62, C.in0); gi.addColorStop(1, C.in1);
      c.fillStyle = gi; rr(c, ix, iy, iw, ih, 3.2); c.fill();
      var gv = c.createLinearGradient(ix, 0, ix + iw, 0); gv.addColorStop(0, "rgba(0,0,0,.35)"); gv.addColorStop(0.2, "rgba(0,0,0,0)"); gv.addColorStop(0.8, "rgba(0,0,0,0)"); gv.addColorStop(1, "rgba(0,0,0,.35)");
      c.fillStyle = gv; rr(c, ix, iy, iw, ih, 3.2); c.fill();
      /* in fondo resta un poco della luce del punto: calda, appena visibile, respira piano */
      var lg = 0.55 * seg(ts, TS.lid, TS.lid + 0.25) - 0.3 * seg(ts, TS.lid + 0.4, TS.lid + 1.6) + (ts >= TS.end && t != null ? 0.04 * Math.sin(t * 1.1) : 0);
      if (lg > 0.01) { c.save(); rr(c, ix, iy, iw, ih, 3.2); c.clip(); c.globalAlpha = lg; c.drawImage(sp.glow, -iw * 0.6, iy + ih * 0.15, iw * 1.2, ih * 1.9); c.restore(); c.globalAlpha = 1; }
      drawSparks(c, ts, t, ix, iw, yF - RIMF);
    }
    /* la faccia davanti */
    if (H > 0.3) {
      var rt = inside ? 0 : Math.min(2, H / 2) * b.tip, rb = Math.min(7, H / 2);
      var ext = inside ? 0 : Math.min(8, T * 0.5); c.fillStyle = vgrad(c, yF, 0, C.face0, C.face1); rr(c, x0, yF - ext, W, H + ext, rt, rb); c.fill();
      var gs = c.createLinearGradient(x0, 0, x0 + W, 0); gs.addColorStop(0, "rgba(90,64,30,.11)"); gs.addColorStop(0.16, "rgba(90,64,30,0)"); gs.addColorStop(0.84, "rgba(90,64,30,0)"); gs.addColorStop(1, "rgba(90,64,30,.13)");
      c.fillStyle = gs; rr(c, x0, yF, W, H, rt, rb); c.fill();
      var gb = c.createLinearGradient(0, -Math.min(6, H), 0, 0); gb.addColorStop(0, "rgba(90,64,30,0)"); gb.addColorStop(1, "rgba(90,64,30,.10)"); c.fillStyle = gb; rr(c, x0, yF, W, H, rt, rb); c.fill();
      c.strokeStyle = C.hair; c.lineWidth = 0.6; rr(c, x0 + 0.3, yF + 0.3, W - 0.6, H - 0.6, rt, rb); c.stroke();
      if (inside) {                                       /* lo spessore della parete davanti: un filo chiaro, è la riga dove il gatto sparisce */
        c.fillStyle = "#fffaf1"; c.fillRect(x0 + 0.3, yF - RIMF, W - 0.6, RIMF + 0.6);
        c.strokeStyle = "rgba(255,255,255,.95)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x0 + 2.5, yF - RIMF + 0.35); c.lineTo(x0 + W - 2.5, yF - RIMF + 0.35); c.stroke();
        c.strokeStyle = "rgba(120,92,52,.22)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + 1.5, yF + 0.6); c.lineTo(x0 + W - 1.5, yF + 0.6); c.stroke();
      }
    }
    if (!open) drawLid(c, b, L, lx0, lw, yH, false);
    c.restore();
    S.geo = { mode: "box", b: b, L: L };
  }

  function drawLid(c, b, L, x0, w, yH, under) {
    var e = L.e, off = L.off, r = Math.min(5, Math.abs(e) / 2 + 1.5), tipK = b.tip;
    if (!under) {
      /* coperchio chiuso o appena alzato: si vede la sua faccia di sopra, col punto */
      var yT = yH - off, yB = yH - e - off, h = yB - yT;       /* e < 0: il bordo davanti sta sotto il cardine */
      var rad = lerp(KR, r, tipK), radB = lerp(KR, Math.min(r, 3), tipK);
      if (off > 0.05) {                                   /* il labbro del coperchio: la sua faccia davanti, sottile */
        c.fillStyle = vgrad(c, yB - 1, yB + off, "#f1e9da", "#d5c8b2"); rr(c, x0, yT + 1, w, h - 1 + off, r, Math.min(3, (h + off) / 2)); c.fill();
        c.strokeStyle = C.hair; c.lineWidth = 0.6; rr(c, x0 + 0.3, yT + 1.3, w - 0.6, h - 1.6 + off, r, Math.min(3, (h + off) / 2)); c.stroke();
      }
      if (b.band > 0.05) { c.fillStyle = vgrad(c, yT - b.band, yT + 4, C.band0, C.band1); rr(c, x0 + 0.4, yT - b.band, w - 0.8, b.band + 8, 6); c.fill(); }
      /* mentre si ribalta, la faccia passa dal colore «davanti» al colore «sopra» */
      if (tipK < 1) { c.fillStyle = vgrad(c, yT, yB, C.face0, C.face1); rr(c, x0, yT, w, h, rad, radB); c.fill(); }
      c.globalAlpha = tipK; c.fillStyle = vgrad(c, yT, yB, C.top0, C.top1); rr(c, x0, yT, w, h, rad, radB); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = C.hair; c.lineWidth = 0.6; rr(c, x0 + 0.3, yT + 0.3, w - 0.6, h - 0.6, rad, radB); c.stroke();
      c.strokeStyle = "rgba(255,255,255," + (0.6 + 0.35 * tipK).toFixed(2) + ")"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x0 + rad, yT + 0.6); c.lineTo(x0 + w - rad, yT + 0.6); c.stroke();
      if (h > 0.6) { var dr = lerp(4.4, 5.4, sat((b.W - KEY) / (BW - KEY))); drawDot(c, 0, (yT + yB) / 2 + (1 - tipK) * 0.5, dr, lerp(1, Math.min(1, h / L.D), tipK), b.glow * sat(h / 4)); }
    } else {
      /* coperchio aperto, in piedi dietro l'apertura: la sua faccia di sotto, un tono più scura; in cima il labbro chiaro */
      var yU = yH - e, hu = e + 1, ed = Math.max(1.5, off);
      c.fillStyle = vgrad(c, yU - ed, yU + 2, C.top0, "#ece3d2"); rr(c, x0, yU - ed, w, hu + ed, r); c.fill();
      c.fillStyle = vgrad(c, yU, yH, C.under0, C.under1); rr(c, x0, yU, w, hu, r, 5); c.fill();
      var li = 2.2, ri = Math.max(1, r - 1.5);
      if (hu > li * 2 + 2) { c.fillStyle = vgrad(c, yU + li, yH, "#d4c7b0", "#c2b39a"); rr(c, x0 + li, yU + li, w - li * 2, hu - li - 0.6, ri, 1); c.fill();
        c.strokeStyle = "rgba(80,58,28,.18)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + li + ri, yU + li + 0.3); c.lineTo(x0 + w - li - ri, yU + li + 0.3); c.stroke(); }
      var ga = c.createLinearGradient(0, yH - Math.min(7, hu), 0, yH); ga.addColorStop(0, "rgba(40,28,12,0)"); ga.addColorStop(1, "rgba(40,28,12,.2)"); c.fillStyle = ga; rr(c, x0, yU, w, hu, r, 5); c.fill();
      c.strokeStyle = C.hair; c.lineWidth = 0.6; rr(c, x0 + 0.3, yU - ed + 0.3, w - 0.6, hu + ed - 0.6, r); c.stroke();
      c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x0 + r, yU - ed + 0.5); c.lineTo(x0 + w - r, yU - ed + 0.5); c.stroke();
    }
  }

  /* scintille calde che salgono dal buio e si spengono */
  function drawSparks(c, ts, t, ix, iw, yR) {
    var sp = S.sp, i, n = 7, list = [];
    for (i = 0; i < n; i++) list.push({ t0: TS.lid + 0.06 + i * 0.07 + hash(i) * 0.05, life: 0.55 + hash(i + 9) * 0.4, x: (hash(i + 3) - 0.5) * iw * 0.8, rise: 18 + hash(i + 5) * 22, drift: (hash(i + 7) - 0.5) * 10, r: 0.8 + hash(i + 11) * 0.9, k: 1 });
    if (ts >= TS.end && t != null) {                       /* dopo: ogni tanto una, piano */
      var per = 4.2, cyc = Math.floor(t / per); for (i = 0; i < 2; i++) { var cc = cyc - i; list.push({ t0: cc * per + hash(cc) * 1.5, life: 1.3, x: (hash(cc + 2) - 0.5) * iw * 0.6, rise: 16 + hash(cc + 4) * 10, drift: (hash(cc + 6) - 0.5) * 6, r: 0.8, k: 0.55, run: t }); }
    }
    for (i = 0; i < list.length; i++) {
      var s = list[i], now = s.run != null ? s.run : ts, u = (now - s.t0) / s.life; if (u <= 0 || u >= 1) continue;
      var y = yR - 2 - s.rise * eOut(u), x = s.x + s.drift * u + Math.sin(u * 7 + i) * 1.2, a = Math.sin(PI * Math.min(1, u * 1.4)) * (1 - u * 0.4) * s.k, rr2 = s.r * 5 * (1 - 0.4 * u);
      c.globalAlpha = a; c.drawImage(sp.spark, x - rr2, y - rr2, rr2 * 2, rr2 * 2);
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ geometria in coordinate della pagina */
  function toPage(x, y) {                                 /* dal disegno (origine al punto d'appoggio) alla pagina */
    var g = S.geo, b = g && g.b;
    if (b) { x *= b.sx; y = y * b.sy + b.hop; if (b.rot) { var px = x - b.piv, cs = Math.cos(b.rot), sn = Math.sin(b.rot); x = b.piv + px * cs - y * sn; y = px * sn + y * cs; } }
    return { x: S.ax + x, y: S.ay + y };
  }
  function ensureGeo() { if (!S.geo || S.geo.mode !== "box") { var b = boxState(S.lastTs != null && S.lastTs >= TS.box ? S.lastTs : TS.end); S.geo = { mode: "box", b: b, L: lidGeo(b) }; } }

  /* ------------------------------------------------------------------ montaggio */
  function setPos() {
    var r = S.layer.getBoundingClientRect(), lx = r.left + (window.pageXOffset || 0), ly = r.top + (window.pageYOffset || 0);
    var px = S.ax - lx - OX, py = S.ay - ly - OY, left = Math.round(px), top = Math.round(py);
    S.fx = OX + (px - left); S.fy = OY + (py - top);
    S.cv.style.left = left + "px"; S.cv.style.top = top + "px";
  }
  function render(ts, t) {
    var c = S.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S.cv.width, S.cv.height);
    if (ts == null || ts < 0) { S.geo = null; return; }
    c.setTransform(S.dpr, 0, 0, S.dpr, S.dpr * S.fx, S.dpr * S.fy);
    try { if (ts < TS.box) drawKeys(c, ts); else drawBox(c, ts, t); } catch (err) { c.setTransform(1, 0, 0, 1, 0, 0); if (!S.warned) { S.warned = true; if (window.console) console.warn("dot-stage:", err); } }
    c.globalAlpha = 1;
  }

  DOT.stage = {
    TS: TS,
    mount: function (layer, p) {
      if (S) DOT.stage.unmount();
      var cv = document.createElement("canvas"), dpr = DOT.stageDpr || Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);   /* DOT.stageDpr: solo per le foto di prova */
      cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
      cv.setAttribute("aria-hidden", "true");
      var st = cv.style; st.position = "absolute"; st.width = CW + "px"; st.height = CH + "px"; st.pointerEvents = "none"; st.left = "0px"; st.top = "0px"; st.zIndex = "0";   /* sotto il gatto (3), i graffi e gli oggetti (1), il fez (2) */
      layer.appendChild(cv);
      S = { cv: cv, c: cv.getContext("2d"), dpr: dpr, layer: layer, ax: p ? p.x : 0, ay: p ? p.y : 0, lastTs: null, lastT: 0, lidOv: null, geo: null };
      buildSprites(); setPos();
      /* aspetta Manrope: quando arriva rifà le lettere e ridisegna */
      var me = S;
      try {
        if (document.fonts && document.fonts.load) document.fonts.load(FONT).then(function () { if (S !== me) return; buildSprites(); if (S.lastTs != null) render(S.lastTs, S.lastT); }, function () {});
      } catch (e) {}
    },
    place: function (x, y) { if (!S) return; S.ax = x; S.ay = y; setPos(); if (S.lastTs != null) render(S.lastTs, S.lastT); },
    draw: function (ts, t) { if (!S) return; S.lastTs = ts; S.lastT = t || 0; render(ts, S.lastT); },
    rim: function () {
      if (!S) return null; ensureGeo();
      var b = S.geo.b, yR = -b.H - RIMF, p = toPage(0, yR), f = toPage(0, -b.T * 0.5);
      var bk = toPage(0, -b.H - b.T + 1.1);                 /* back: il bordo di dietro dell'apertura (sopra c'è il coperchio) */
      return { x: p.x, y: p.y, w: (b.W - WALL * 2) * b.sx, floor: f.y, back: bk.y, ow: b.W * b.sx, bottom: toPage(0, 0).y };
    },
    lid: function (open) { if (!S) return; S.lidOv = open == null ? null : sat(+open); if (S.lastTs == null || S.lastTs < TS.end) S.lastTs = TS.end; render(S.lastTs, S.lastT); },
    hit: function (x, y) {
      if (!S || !S.geo) return false; var g = S.geo, lx = x - S.ax, ly = y - S.ay;
      if (g.mode === "keys") return lx >= g.x0 && lx <= g.x1 && ly >= g.y0 && ly <= g.y1;
      var b = g.b, L = g.L, top = -b.H - b.T - Math.max(0, L.e) - L.off - 2;
      lx = lx / b.sx; ly = (ly - b.hop) / b.sy;
      return lx >= -b.W / 2 - 4 && lx <= b.W / 2 + 4 && ly >= top && ly <= 3;
    },
    unmount: function () { if (!S) return; if (S.cv.parentNode) S.cv.parentNode.removeChild(S.cv); S = null; }
  };
})();
