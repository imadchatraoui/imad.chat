/* imad.chat — Progetti: il cubo di Imad nei colori Kukko, grande, che si mescola, si ferma e si risolve da solo.
   È una COPIA del cubo della casa (docs/anteprime/casa/home/vivo.js, function Cubo): stesso disegno e stesso giro di mosse,
   qui senza window.IMAD (la pagina interna non carica i file della casa) e con una cosa in più: col dito, di lato, lo si gira.
   Se il cubo della casa cambia, cambia anche qui (o si porta in un file comune: vedi CASA.md, sezione 6).
   Uso: ImadCubo(canvas)  →  si disegna solo quando si vede; fermo con «meno movimento», con ?shot=1 o con la scheda nascosta.
   Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var KUKKO = { U: "#ffb6c1", D: "#fdfd96", F: "#ffb347", R: "#77dd77", B: "#aec6cf", L: "#ff6961", plastic: "#f4f3ef" };
  var Q = new URLSearchParams(location.search), SHOT = Q.get("shot") === "1";
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function still() { return SHOT || mqReduce.matches; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function mix(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)); }; return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")"; }

  window.ImadCubo = function (cv) {
    if (!cv || !cv.getContext) return null;
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1;
    var COL = [KUKKO.R, KUKKO.L, KUKKO.U, KUKKO.D, KUKKO.F, KUKKO.B], PL = KUKKO.plastic;
    var N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], cub = [], todo = [], cur = null, wait = 900, seed = 20261112;
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
    var DUR = 400, tPrev = 0, clock = 0;
    /* il giro: da solo gira piano; il dito lo gira di lato, e lasciato va avanti per inerzia e torna al suo passo */
    var yaw = 0.62, vel = 0, AUTO = 0.00042, drag = null;
    function size() {
      var r = cv.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function draw(t) {
      if (!W) return;
      var live = !still(), dt = Math.min(64, Math.max(0, t - tPrev)); tPrev = t;
      if (live) {
        clock += dt;
        if (cur) { if (clock - cur.t0 >= DUR) { apply(cur); wait = cur.gap; cur = null; } }
        else { wait -= dt; if (wait <= 0) { if (!todo.length) plan(); cur = todo.shift(); cur.t0 = clock; } }
        if (!drag) { vel += (AUTO - vel) * Math.min(1, dt / 420); yaw += vel * dt; }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var s = Math.min(W, H * 1.08) / 5.7, cx = W / 2, cy = H * 0.5, pitch = 0.5;
      var cw = Math.cos(yaw), sw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      function G(v) { var X = v[0] * cw + v[2] * sw, Z = -v[0] * sw + v[2] * cw; return [X, v[1] * cp - Z * sp, v[1] * sp + Z * cp]; }
      var ang = cur ? cur.s * Math.PI / 2 * eIO(clamp((clock - cur.t0) / DUR, 0, 1)) : 0, quads = [];
      cub.forEach(function (q) {
        var mov = !!cur && q.p[cur.a] === cur.l, mid = !!cur && q.p[cur.a] === 0;
        for (var k = 0; k < 6; k++) {
          var inner = q.c[k] < 0, n = N[k];
          if (inner && !(mov || (mid && n[cur.a] === cur.l))) continue;
          var ax = k >> 1, u1 = (ax + 1) % 3, u2 = (ax + 2) % 3, cen = [q.p[0] + n[0] * 0.5, q.p[1] + n[1] * 0.5, q.p[2] + n[2] * 0.5];
          var ng = G(mov ? rotA(n, cur.a, ang) : n); if (ng[2] <= 0.03) continue;
          var corner = function (h, i, j) { var v = cen.slice(); v[u1] += i * h; v[u2] += j * h; if (mov) v = rotA(v, cur.a, ang); v = G(v); return [cx + v[0] * s, cy - v[1] * s]; };
          quads.push({ z: G(mov ? rotA(cen, cur.a, ang) : cen)[2], k: 0.8 + 0.24 * Math.max(0, ng[0] * -0.35 + ng[1] * 0.75 + ng[2] * 0.56), col: inner ? null : COL[q.c[k]],
            P: [corner(0.5, -1, -1), corner(0.5, 1, -1), corner(0.5, 1, 1), corner(0.5, -1, 1)], S: inner ? null : [corner(0.41, -1, -1), corner(0.41, 1, -1), corner(0.41, 1, 1), corner(0.41, -1, 1)] });
        }
      });
      quads.sort(function (a, b) { return a.z - b.z; });
      /* l'ombra sotto */
      var gy = cy + s * 2.5, sh = ctx.createRadialGradient(cx, gy, 0, cx, gy, s * 2.3); sh.addColorStop(0, "rgba(40,30,60,.3)"); sh.addColorStop(1, "rgba(40,30,60,0)");
      ctx.save(); ctx.translate(0, gy * 0.74); ctx.scale(1, 0.26); ctx.fillStyle = sh; ctx.fillRect(cx - s * 2.4, gy - s * 2.4, s * 4.8, s * 4.8); ctx.restore();
      ctx.lineJoin = "round";
      var path = function (pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
      quads.forEach(function (q) {
        var pl = mix(q.col ? PL : "#dcd9d1", Math.min(1, q.k)); ctx.fillStyle = pl; ctx.strokeStyle = pl; ctx.lineWidth = s * 0.03; path(q.P); ctx.fill(); ctx.stroke();
        if (q.S) { var c = mix(q.col, q.k); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * 0.075; path(q.S); ctx.fill(); ctx.stroke(); }
      });
    }

    /* il giro dei fotogrammi: solo se la tela si vede e la scheda è aperta */
    var raf = 0, vis = true;
    function frame(t) { raf = 0; draw(t); if (!still() && vis && !document.hidden) raf = requestAnimationFrame(frame); }
    function wake() { if (!raf && !still() && vis && !document.hidden) { tPrev = performance.now(); raf = requestAnimationFrame(frame); } }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis) wake(); }, { rootMargin: "60px" }).observe(cv);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) wake(); });
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", function () { draw(performance.now()); wake(); });

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
