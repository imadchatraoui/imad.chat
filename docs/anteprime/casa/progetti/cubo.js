/* imad.chat — Progetti: il cubo di Imad nei colori Kukko, grande, che si mescola, si ferma e si risolve da solo.
   È una COPIA del cubo della casa (docs/anteprime/casa/home/vivo.js: function Cubo, rsq, hexRgb e il blocco LUCE di luce()), dal giro
   «casa bella» (CASA.md 2d D): un oggetto vero, plastica bianca con le scanalature tra i cubetti, adesivi arrotondati in prospettiva con
   un velo lucido, la luce dal lato dove sta il sole su Torino (o la luna; di notte senza luna una luce quieta), un'ombra morbida a terra
   tutta dentro la tela. Stesso disegno e stesso giro di mosse; qui senza window.IMAD (la pagina interna non carica i file della casa:
   la luce si calcola con ImadAstro, se c'è) e con le cose sue: il giro lento con l'inerzia, il dito che lo gira di lato, il giro dei
   fotogrammi che si ferma quando la tela non si vede o la scheda è nascosta.
   Se il cubo della casa cambia, cambia anche qui (o si porta in un file comune: vedi CASA.md, sezione 6).
   Uso: ImadCubo(canvas)  →  si disegna solo quando si vede; fermo con «meno movimento», con ?shot=1 o con la scheda nascosta.
   Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  /* i colori Kukko del suo gioco e la plastica bianca (gli stessi di shared/data.js, «cube») */
  var KUKKO = { U: "#ffb6c1", D: "#fdfd96", F: "#ffb347", R: "#77dd77", B: "#aec6cf", L: "#ff6961", plastic: "#ffffff" };
  var Q = new URLSearchParams(location.search), SHOT = Q.get("shot") === "1", A = window.ImadAstro, RAD = Math.PI / 180;
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)"), mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  function still() { return SHOT || mqReduce.matches; }
  function isDark() { var t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : mqDark.matches; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function hexRgb(h) { var n = parseInt(String(h).replace("#", ""), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  var frozen = (function () { var t = Q.get("t"); if (!t) return null; var d = new Date(t); return isNaN(d.getTime()) ? null : d; })();

  /* la luce per il cubo, come luce() della casa: direzione nello spazio della vista (x a destra, y in alto, z verso chi guarda), quanta
     luce d'ambiente e quanta dalla sorgente, il suo colore (0..1). Dal sole su Torino; di notte dalla luna, se è alta e non è nuova */
  var LUCE = { v: [-0.35, 0.82, 0.46], amb: 0.78, key: 0.3, spec: 0.2, rgb: [0.86, 0.9, 1] };
  function luce() {
    if (!A || !A.sun || !A.moon || !A.moonPhase) return;
    var d = frozen ? new Date(frozen.getTime()) : new Date(), lat = 45.0703, lon = 7.6869;   /* Torino */
    var s = A.sun(d, lat, lon), m = A.moon(d, lat, lon), ph = A.moonPhase(d), src = null, rgb = [255, 246, 232];
    if (s.altitude > -1) {
      var h = Math.max(0, s.altitude), warm = 1 - Math.min(1, h / 24);
      src = s; rgb = [255, Math.round(lerp(247, 198, warm)), Math.round(lerp(236, 140, warm))];
    } else if (m.altitude > 3 && ph.fraction > 0.1) src = m;
    var lv = [-0.35, 0.82, 0.46];
    if (src) { var a2 = Math.max(0, src.altitude) * RAD; lv = [-Math.sin(src.azimuth * RAD) * Math.cos(a2), 0.3 + Math.sin(a2), 0.55]; }
    var ll = Math.sqrt(lv[0] * lv[0] + lv[1] * lv[1] + lv[2] * lv[2]); lv = [lv[0] / ll, lv[1] / ll, lv[2] / ll];
    LUCE = src === s ? { v: lv, amb: 0.6, key: 0.46, spec: 0.9, rgb: [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255] }
      : src ? { v: lv, amb: 0.72, key: 0.32, spec: 0.35, rgb: [0.85, 0.9, 1] } : { v: lv, amb: 0.76, key: 0.3, spec: 0.2, rgb: [0.88, 0.9, 1] };
  }
  luce();
  if (!frozen) setInterval(luce, 30000);

  window.ImadCubo = function (cv) {
    if (!cv || !cv.getContext) return null;
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1;
    var COL = [KUKKO.R, KUKKO.L, KUKKO.U, KUKKO.D, KUKKO.F, KUKKO.B].map(hexRgb), PL = hexRgb(KUKKO.plastic), INNER = [206, 200, 190];
    var N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], cub = [], todo = [], cur = null, wait = 1400, seed = 20261112;
    function rand() { seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) { if (!x && !y && !z) continue; cub.push({ p: [x, y, z], c: [x === 1 ? 0 : -1, x === -1 ? 1 : -1, y === 1 ? 2 : -1, y === -1 ? 3 : -1, z === 1 ? 4 : -1, z === -1 ? 5 : -1] }); }
    function q4(v, a, s) { var X = v[0], Y = v[1], Z = v[2]; if (a === 0) return s > 0 ? [X, -Z, Y] : [X, Z, -Y]; if (a === 1) return s > 0 ? [Z, Y, -X] : [-Z, Y, X]; return s > 0 ? [-Y, X, Z] : [Y, -X, Z]; }
    function rotA(v, a, th) { var c = Math.cos(th), s = Math.sin(th), X = v[0], Y = v[1], Z = v[2]; if (a === 0) return [X, Y * c - Z * s, Y * s + Z * c]; if (a === 1) return [X * c + Z * s, Y, -X * s + Z * c]; return [X * c - Y * s, X * s + Y * c, Z]; }
    function nIdx(n) { for (var k = 0; k < 6; k++) if (N[k][0] === n[0] && N[k][1] === n[1] && N[k][2] === n[2]) return k; return 0; }
    function apply(m) { cub.forEach(function (q) { if (q.p[m.a] !== m.l) return; q.p = q4(q.p, m.a, m.s); var nc = [-1, -1, -1, -1, -1, -1]; for (var k = 0; k < 6; k++) if (q.c[k] >= 0) nc[nIdx(q4(N[k], m.a, m.s))] = q.c[k]; q.c = nc; }); }
    /* sette mosse a caso, una pausa, poi le stesse al contrario: il cubo torna sempre risolto */
    function plan() {
      var seq = [], last = -1, i;
      for (i = 0; i < 7; i++) { var a, l, key; do { a = (rand() * 3) | 0; l = rand() < 0.5 ? -1 : 1; key = a * 2 + (l > 0 ? 1 : 0); } while (key === last); last = key; seq.push({ a: a, l: l, s: rand() < 0.5 ? -1 : 1 }); }
      todo = seq.map(function (m) { return { a: m.a, l: m.l, s: m.s, gap: 190 }; });
      todo[todo.length - 1].gap = 1300;
      for (i = seq.length - 1; i >= 0; i--) todo.push({ a: seq[i].a, l: seq[i].l, s: -seq[i].s, gap: i ? 150 : 2600 });
    }
    /* un quadrato arrotondato nel piano della faccia: [i, j] da -h a h, angoli di raggio r (5 punti per angolo) */
    function rsq(h, r) {
      var out = [], cc = [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]];
      cc.forEach(function (c) { var ox = c[0] * (h - r), oy = c[1] * (h - r), a0 = c[2] * Math.PI / 2; for (var k = 0; k <= 4; k++) { var a = a0 + k * Math.PI / 8; out.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]); } });
      return out;
    }
    var GROOVE = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], FACE = rsq(0.484, 0.08), STK = rsq(0.396, 0.1);
    var DUR = 400, tPrev = 0, clock = 0, lastDraw = -1e9;
    /* il giro: da solo gira piano; il dito lo gira di lato, e lasciato va avanti per inerzia e torna al suo passo. Parte da −0,62 come
       nella casa: si vedono tre colori diversi, non un blocco solo */
    var yaw = -0.62, vel = 0, AUTO = 0.00042, drag = null;
    function size() {
      var r = cv.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 3); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function rgb(c, k, add) { add = add || 0; return "rgb(" + Math.round(clamp(c[0] * k + add, 0, 255)) + "," + Math.round(clamp(c[1] * k + add, 0, 255)) + "," + Math.round(clamp(c[2] * k + add, 0, 255)) + ")"; }
    function tick(dt) {
      clock += dt;
      if (cur) { if (clock - cur.t0 >= DUR) { apply(cur); wait = cur.gap; cur = null; } }
      else { wait -= dt; if (wait <= 0) { if (!todo.length) plan(); cur = todo.shift(); cur.t0 = clock; } }
      if (!drag) { vel += (AUTO - vel) * Math.min(1, dt / 420); yaw += vel * dt; }
    }
    function draw(t) {
      if (!W) return;
      lastDraw = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var s = Math.min(W, H * 1.08) / 5.95, cx = W / 2, cy = H * 0.46, pitch = 0.5;
      var cw = Math.cos(yaw), sw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      function G(v) { var X = v[0] * cw + v[2] * sw, Z = -v[0] * sw + v[2] * cw; return [X, v[1] * cp - Z * sp, v[1] * sp + Z * cp]; }
      var L = LUCE.v, hx = L[0], hy = L[1], hz = L[2] + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
      var ang = cur ? cur.s * Math.PI / 2 * eIO(clamp((clock - cur.t0) / DUR, 0, 1)) : 0, quads = [];
      cub.forEach(function (q) {
        var mov = !!cur && q.p[cur.a] === cur.l, mid = !!cur && q.p[cur.a] === 0;
        for (var k = 0; k < 6; k++) {
          var inner = q.c[k] < 0, n = N[k];
          if (inner && !(mov || (mid && n[cur.a] === cur.l))) continue;
          var ax = k >> 1, u1 = (ax + 1) % 3, u2 = (ax + 2) % 3, cen = [q.p[0] + n[0] * 0.5, q.p[1] + n[1] * 0.5, q.p[2] + n[2] * 0.5];
          var ng = G(mov ? rotA(n, cur.a, ang) : n); if (ng[2] <= 0.03) continue;
          var proj = function (shape) {
            return shape.map(function (ij) { var v = cen.slice(); v[u1] += ij[0]; v[u2] += ij[1]; if (mov) v = rotA(v, cur.a, ang); v = G(v); return [cx + v[0] * s, cy - v[1] * s]; });
          };
          var lam = Math.max(0, ng[0] * L[0] + ng[1] * L[1] + ng[2] * L[2]), spc = Math.max(0, ng[0] * hx + ng[1] * hy + ng[2] * hz);
          quads.push({ z: G(mov ? rotA(cen, cur.a, ang) : cen)[2], lam: lam, spc: Math.pow(spc, 24), face: ng[2], col: inner ? null : COL[q.c[k]],
            G: proj(GROOVE), F: inner ? null : proj(FACE), S: inner ? null : proj(STK) });
        }
      });
      quads.sort(function (a, b) { return a.z - b.z; });
      /* l'ombra a terra: un'ellisse morbida sotto il cubo, tutta dentro la tela */
      var gy = Math.min(cy + s * 2.45, H - s * 0.42), rx = s * 2.1, ry = s * 0.36;
      ctx.save(); ctx.translate(cx, gy); ctx.scale(1, ry / rx);
      var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx), dk = isDark();
      sh.addColorStop(0, dk ? "rgba(0,0,6,.5)" : "rgba(46,40,100,.24)"); sh.addColorStop(0.55, dk ? "rgba(0,0,6,.2)" : "rgba(46,40,100,.09)"); sh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.2832); ctx.fill(); ctx.restore();
      ctx.lineJoin = "round";
      var path = function (pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
      var amb = LUCE.amb, key = LUCE.key, tint = LUCE.rgb;
      /* a cubo fermo (nessuna mossa) le scanalature di una faccia sono una lastra sola: tre riempimenti invece di ventisette */
      if (!cur) {
        for (var f = 0; f < 6; f++) {
          var nf = G(N[f]); if (nf[2] <= 0.03) continue;
          var ax2 = f >> 1, a1 = (ax2 + 1) % 3, a2 = (ax2 + 2) % 3, pl = [];
          [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]].forEach(function (ij) { var v = [N[f][0] * 1.5, N[f][1] * 1.5, N[f][2] * 1.5]; v[a1] += ij[0]; v[a2] += ij[1]; v = G(v); pl.push([cx + v[0] * s, cy - v[1] * s]); });
          var lf = Math.max(0, nf[0] * L[0] + nf[1] * L[1] + nf[2] * L[2]);
          ctx.fillStyle = rgb(PL, Math.min(1.02, amb + key * lf) * 0.84); path(pl); ctx.fill();
        }
      }
      quads.forEach(function (q) {
        var k = amb + key * q.lam, sp = q.spc * LUCE.spec;
        /* la scanalatura (il corpo dietro), poi la faccia di plastica, poi l'adesivo */
        var pk = Math.min(1.02, k);
        if (cur || !q.col) { ctx.fillStyle = rgb(q.col ? PL : INNER, pk * 0.84); path(q.G); ctx.fill(); }
        if (!q.F) return;
        ctx.fillStyle = "rgb(" + Math.round(clamp(PL[0] * pk * (0.9 + 0.1 * tint[0]) + 40 * sp, 0, 255)) + "," + Math.round(clamp(PL[1] * pk * (0.9 + 0.1 * tint[1]) + 40 * sp, 0, 255)) + "," + Math.round(clamp(PL[2] * pk * (0.9 + 0.1 * tint[2]) + 40 * sp, 0, 255)) + ")";
        path(q.F); ctx.fill();
        var sk = 0.86 + 0.2 * (k - amb) / Math.max(0.01, key);
        ctx.fillStyle = rgb(q.col, Math.min(1.06, sk * (0.96 + 0.08 * q.face))); path(q.S); ctx.fill();
        /* il velo lucido: dall'angolo verso la luce, che si spegne a metà adesivo */
        var bi = 2, bv = -1e9; for (var ci = 2; ci < 20; ci += 5) { var sc = -q.S[ci][1] + LUCE.v[0] * 1.4 * q.S[ci][0]; if (sc > bv) { bv = sc; bi = ci; } }
        var a = q.S[bi], b = q.S[(bi + 10) % 20], gl = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        gl.addColorStop(0, "rgba(255,255,255," + (0.08 + 0.28 * sp + 0.12 * q.lam).toFixed(3) + ")"); gl.addColorStop(0.55, "rgba(255,255,255,0)");
        ctx.fillStyle = gl; path(q.S); ctx.fill();
      });
    }

    /* il giro dei fotogrammi: solo se la tela si vede e la scheda è aperta. Tra una mossa e l'altra, se nessuno lo tocca e l'inerzia
       è finita, il cubo gira soltanto piano: trenta disegni al secondo bastano (come nella casa); durante una mossa o col dito, tutti */
    var raf = 0, vis = true;
    function frame(t) {
      raf = 0;
      var dt = Math.min(64, Math.max(0, t - tPrev)); tPrev = t;
      if (!still()) tick(dt);
      var quiet = !cur && !drag && Math.abs(vel - AUTO) < 0.00003;
      if (!quiet || t - lastDraw >= 30 || t < lastDraw) draw(t);
      if (!still() && vis && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && !still() && vis && !document.hidden) { tPrev = performance.now(); raf = requestAnimationFrame(frame); } }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis) wake(); }, { rootMargin: "60px" }).observe(cv);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) wake(); });
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", function () { draw(performance.now()); wake(); });
    /* il tema cambia: l'ombra a terra ha due tinte */
    if (mqDark.addEventListener) mqDark.addEventListener("change", function () { draw(performance.now()); });

    /* col dito, di lato: il cubo gira (in verticale la pagina scorre come sempre: touch-action pan-y) */
    cv.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = { x: e.clientX, yaw: yaw, id: e.pointerId, lx: e.clientX, lt: performance.now(), v: 0 };
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* va bene lo stesso */ }
      cv.classList.add("is-giro");
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var now = performance.now(), k = 2.6 / Math.max(160, W);
      yaw = drag.yaw + (e.clientX - drag.x) * k;
      if (now > drag.lt) drag.v = drag.v * 0.6 + ((e.clientX - drag.lx) * k / (now - drag.lt)) * 0.4;
      drag.lx = e.clientX; drag.lt = now;
      if (still()) draw(now);
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      vel = clamp(drag.v, -0.012, 0.012); drag = null; cv.classList.remove("is-giro"); wake();
    }
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("lostpointercapture", end);

    var rz = 0;
    window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { size(); draw(performance.now()); }, 120); });
    size(); draw(performance.now()); wake();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); draw(performance.now()); });
    return { size: size, draw: draw };
  };
})();
