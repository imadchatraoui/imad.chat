/* Riquadri vivi della bento: la luce del sole vero, il globo a puntini, la bandiera, il cubo che si risolve, la riga dei saluti.
   Viene dopo app.js. Scritto per girare anche su Safari non recente: niente sintassi oltre ES2017. */
(function () {
  "use strict";
  var root = document.documentElement, doc = document, A = window.ImadAstro, D = window.IMAD_DATA, TERRA = window.IMAD_TERRA;
  if (!A || !D) return;
  var Q = new URLSearchParams(location.search), SHOT = Q.get("shot") === "1";
  var frozen = Q.get("t") ? new Date(Q.get("t")) : null; if (frozen && isNaN(frozen.getTime())) frozen = null;
  function now() { return frozen ? new Date(frozen.getTime()) : new Date(); }
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function still() { return SHOT || mq.matches; }
  var RAD = Math.PI / 180;
  function $(s, r) { return (r || doc).querySelector(s); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function city(id) { for (var i = 0; i < D.cities.length; i++) if (D.cities[i].id === id) return D.cities[i]; return null; }
  function mix(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)); }; return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")"; }
  var TOR = city("torino");

  /* ------------------------------------------------------------------ la luce: da dove sta il sole su Torino (di notte, la luna) */
  var WIND = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest"];
  function luce() {
    var d = now(), s = A.sun(d, TOR.lat, TOR.lon), m = A.moon(d, TOR.lat, TOR.lon), ph = A.moonPhase(d);
    var src = null, k = 0.28, rgb = [255, 246, 232], txt = "";
    if (s.altitude > -1) {
      var h = Math.max(0, s.altitude), warm = 1 - Math.min(1, h / 24);
      src = s; k = 0.5 + 0.5 * Math.min(1, h / 30);
      rgb = [255, Math.round(lerp(247, 198, warm)), Math.round(lerp(236, 140, warm))];
      txt = ", sole da " + WIND[Math.round(s.azimuth / 45) % 8];
    } else if (m.altitude > 3 && ph.fraction > 0.1) {
      src = m; k = 0.2 + 0.25 * ph.fraction; rgb = [200, 214, 255];
      txt = ", luce della luna da " + WIND[Math.round(m.azimuth / 45) % 8];
    }
    /* guardando verso sud: il mattino la luce viene da sinistra, la sera da destra; più il sole è alto, più viene dall'alto */
    var ang = 180, shx = 0, shy = 12;
    if (src) {
      var alt = Math.max(0, src.altitude) * RAD, sx = -Math.sin(src.azimuth * RAD) * Math.cos(alt), up = 0.3 + Math.sin(alt);
      ang = Math.atan2(-sx, -up) / RAD; if (ang < 0) ang += 360;
      shx = -sx * 18; shy = 7 + 9 * Math.sin(alt);
    }
    var st = root.style;
    st.setProperty("--sun-ang", ang.toFixed(1) + "deg"); st.setProperty("--sun-a", (0.2 * k).toFixed(3)); st.setProperty("--sun-rgb", rgb.join(" "));
    st.setProperty("--shx", shx.toFixed(1) + "px"); st.setProperty("--shy", shy.toFixed(1) + "px");
    var el = $("#luceTxt"); if (el) el.textContent = txt;
  }
  Array.prototype.forEach.call(doc.querySelectorAll(".tile:not(.hero)"), function (t) { var i = doc.createElement("i"); i.className = "luce"; i.setAttribute("aria-hidden", "true"); t.insertBefore(i, t.firstChild); });

  /* ------------------------------------------------------------------ strumenti per le tele */
  function fit(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width < 2 || r.height < 2) return null;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    return { W: r.width, H: r.height, dpr: dpr };
  }
  function v3(lat, lon) { var cl = Math.cos(lat * RAD); return [cl * Math.sin(lon * RAD), Math.sin(lat * RAD), cl * Math.cos(lon * RAD)]; }
  function slerp(a, b, t) {
    var om = Math.acos(clamp(dot(a, b), -1, 1)), so = Math.sin(om); if (so < 1e-6) return a;
    var ka = Math.sin((1 - t) * om) / so, kb = Math.sin(t * om) / so;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  }

  /* ------------------------------------------------------------------ il globo: terre a puntini, giorno e notte veri, le cinque città, le linee verso Makkah */
  function Globo(cv, hit) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1, dots = [], cls = null, sunV = [0, 0, 1];
    var cs = ["torino", "casablanca", "gaza", "medina", "makkah"].map(function (id) { var c = city(id); return { id: id, name: c.name, v: v3(c.lat, c.lon) }; });
    var mak = cs[4], arcs = [];
    cs.forEach(function (c, i) {
      if (c === mak) return;
      var pts = [], om = Math.acos(clamp(dot(c.v, mak.v), -1, 1)), lift = 0.04 + 0.2 * om;
      for (var k = 0; k <= 40; k++) { var t = k / 40, p = slerp(c.v, mak.v, t), s = 1 + lift * Math.sin(Math.PI * t); pts.push([p[0] * s, p[1] * s, p[2] * s]); }
      arcs.push({ pts: pts, ph: i * 0.27 });
    });
    if (TERRA) {
      var bin = atob(TERRA.mask), n = 0;
      for (var r = 0; r < TERRA.rows; r++) {
        var lat = -90 + (r + 0.5) * (180 / TERRA.rows), m = Math.max(1, Math.round(TERRA.cols * Math.cos(lat * RAD)));
        for (var k = 0; k < m; k++, n++) if ((bin.charCodeAt(n >> 3) >> (n & 7)) & 1) dots.push(v3(lat, -180 + (k + 0.5) * (360 / m)));
      }
    }
    var home = { lon: 16, lat: 27 }, off = { lon: 0, lat: 0 }, drag = null, touched = -1e9, suppress = false, active = 0, swapAt = 0;
    var now_ = $("#mCity") ? $("#mCity").parentNode : null;
    function sunUpdate() {
      var d = now(), e = A.sunEquatorial(d), lon = (e.ra - A.lstHours(d, 0)) * 15; lon = ((lon % 360) + 540) % 360 - 180;
      sunV = v3(e.dec, lon); cls = new Uint8Array(dots.length);
      for (var i = 0; i < dots.length; i++) { var s = dot(dots[i], sunV); cls[i] = s > 0.12 ? 2 : s > -0.1 ? 1 : 0; }
    }
    function size() { var f = fit(cv); if (f) { W = f.W; H = f.H; dpr = f.dpr; } }
    function readout(fade) {
      if (!now_) return;
      var c = cs[active], li = $('#cities li[data-city="' + c.id + '"]');
      function put() {
        $("#mCity").textContent = c.name;
        $("#mTime").textContent = li ? $(".city__time", li).textContent : "";
        $("#mPart").textContent = li ? $(".city__part", li).textContent : "";
        now_.classList.remove("is-out");
      }
      if (fade && !still()) { now_.classList.add("is-out"); setTimeout(put, 270); } else put();
    }
    function bucket(arr, fill) { if (!arr.length) return; ctx.fillStyle = fill; ctx.beginPath(); for (var i = 0; i < arr.length; i += 3) { var s = arr[i + 2]; ctx.rect(arr[i] - s / 2, arr[i + 1] - s / 2, s, s); } ctx.fill(); }
    function draw(t) {
      if (!W) return;
      if (!cls) sunUpdate();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var rad = Math.min(W, H) * 0.385, cx = W / 2, cy = H * 0.515, live = !still();
      if (!drag && t - touched > 3200) { off.lon *= 0.94; off.lat *= 0.94; }
      if (live && t - swapAt > 3200) { swapAt = t; active = (active + 1) % cs.length; readout(true); }
      var lon0 = home.lon + off.lon + (live ? 8 * Math.sin(t / 5200) : 0), lat0 = clamp(home.lat + off.lat + (live ? 2.5 * Math.sin(t / 7400) : 0), -70, 70);
      var cy_ = Math.cos(-lon0 * RAD), sy_ = Math.sin(-lon0 * RAD), cx_ = Math.cos(lat0 * RAD), sx_ = Math.sin(lat0 * RAD);
      function R(v) { var x = v[0] * cy_ + v[2] * sy_, z = -v[0] * sy_ + v[2] * cy_; return [x, v[1] * cx_ - z * sx_, v[1] * sx_ + z * cx_]; }
      /* l'atmosfera e la sfera */
      var g = ctx.createRadialGradient(cx, cy, rad * 0.94, cx, cy, rad * 1.2); g.addColorStop(0, "rgba(140,170,255,.3)"); g.addColorStop(1, "rgba(140,170,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad * 1.2, 0, 6.3); ctx.fill();
      g = ctx.createRadialGradient(cx - rad * 0.28, cy - rad * 0.34, rad * 0.08, cx, cy, rad); g.addColorStop(0, "rgba(58,78,160,.72)"); g.addColorStop(0.62, "rgba(26,36,98,.74)"); g.addColorStop(1, "rgba(12,16,50,.86)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.fill();
      /* dove batte il sole, il mare schiarisce appena */
      var sv = R(sunV);
      if (sv[2] > -0.35) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.clip(); var gx = cx + sv[0] * rad, gy = cy - sv[1] * rad; g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad * 1.05); g.addColorStop(0, "rgba(255,236,204,.2)"); g.addColorStop(1, "rgba(255,236,204,0)"); ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); ctx.restore(); }
      ctx.strokeStyle = "rgba(170,190,255,.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.stroke();
      /* le terre: chiare dove è giorno, calde sul terminatore, in penombra dove è notte */
      var b0 = [], b1 = [], b2 = [], i, p;
      for (i = 0; i < dots.length; i++) { p = R(dots[i]); if (p[2] <= 0.02) continue; (cls[i] === 2 ? b2 : cls[i] === 1 ? b1 : b0).push(cx + p[0] * rad, cy - p[1] * rad, (0.62 + 0.5 * p[2]) * rad * 0.0125); }
      bucket(b0, "rgba(128,146,224,.5)"); bucket(b1, "rgba(255,196,150,.94)"); bucket(b2, "rgba(240,244,255,.97)");
      /* le linee verso Makkah, con un punto di luce che le percorre */
      ctx.lineWidth = 1; ctx.lineCap = "round";
      arcs.forEach(function (a) {
        var P = a.pts.map(R), k;
        ctx.strokeStyle = "rgba(255,232,190,.5)"; ctx.beginPath(); var open = false;
        for (k = 0; k < P.length; k++) { if (P[k][2] <= 0) { open = false; continue; } var x = cx + P[k][0] * rad, y = cy - P[k][1] * rad; if (open) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open = true; } }
        ctx.stroke();
        if (!live) return;
        var u = ((t / 2600) + a.ph) % 1, e = eIO(u), fade = Math.sin(Math.PI * u);
        for (k = 0; k < 6; k++) { var j = Math.round(clamp(e * 40 - k * 0.9, 0, 40)), q = P[j]; if (q[2] <= 0) continue; ctx.fillStyle = "rgba(255,246,222," + (fade * (1 - k / 6) * 0.95).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(cx + q[0] * rad, cy - q[1] * rad, 2.1 - k * 0.24, 0, 6.3); ctx.fill(); }
      });
      /* le città */
      cs.forEach(function (c, idx) {
        var q = R(c.v); if (q[2] <= 0.02) return;
        var x = cx + q[0] * rad, y = cy - q[1] * rad, on = idx === active, big = c === mak ? 1.35 : 1;
        var gg = ctx.createRadialGradient(x, y, 0, x, y, 11 * big); gg.addColorStop(0, "rgba(255,226,170,.75)"); gg.addColorStop(1, "rgba(255,226,170,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 11 * big, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#fff8e8"; ctx.beginPath(); ctx.arc(x, y, 2.6 * big, 0, 6.3); ctx.fill();
        if (on) {
          var w = live ? ((t - swapAt) % 1600) / 1600 : 0.35;
          ctx.strokeStyle = "rgba(255,240,208," + (0.8 * (1 - w)).toFixed(3) + ")"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, 5 + 13 * w, 0, 6.3); ctx.stroke();
          ctx.font = '600 12px Manrope, -apple-system, "Segoe UI", sans-serif'; ctx.textBaseline = "middle"; var left = q[0] < -0.08;
          ctx.textAlign = left ? "right" : "left"; ctx.fillStyle = "rgba(6,10,34,.55)"; ctx.fillText(c.name, x + (left ? -11 : 11), y + 1.5);
          ctx.fillStyle = "#fff"; ctx.fillText(c.name, x + (left ? -11 : 11), y + 0.5);
        }
      });
    }
    /* trascinando di lato il globo gira; un tocco secco apre la pagina */
    if (hit) {
      hit.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, lon: off.lon, lat: off.lat, moved: false, id: e.pointerId }; });
      window.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        drag.moved = true; off.lon = drag.lon - dx * 0.42; if (e.pointerType === "mouse") off.lat = clamp(drag.lat + dy * 0.3, -50, 50); touched = performance.now();
      });
      var end = function () { if (!drag) return; if (drag.moved) { suppress = true; setTimeout(function () { suppress = false; }, 380); } drag = null; };
      window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
      hit.addEventListener("click", function (e) { if (suppress) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    }
    return { size: size, draw: draw, sun: sunUpdate, readout: readout, every: 2 };
  }

  /* ------------------------------------------------------------------ la bandiera della Palestina, che sventola */
  function Bandiera(cv) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1;
    function size() { var f = fit(cv); if (f) { W = f.W; H = f.H; dpr = f.dpr; } }
    function draw(t) {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#0b0d10"; ctx.fillRect(0, 0, W, H);
      var FH = H * 1.18, L = Math.max(W * 1.06, FH * 2), x0 = -(L - W) * 0.2, top = (H - FH) / 2, ph = still() ? 1.2 : t * 0.0030, b = FH / 3;
      for (var x = 0; x < W; x += 2) {
        var u = (x - x0) / L, k = u * 10.5 - ph, amp = FH * 0.026 * (0.3 + u * 1.7);
        var y = top + Math.sin(k) * amp + Math.sin(k * 0.47 + 1.3) * amp * 0.5, sl = Math.cos(k);
        ctx.fillStyle = "#000000"; ctx.fillRect(x, y, 2, b + 0.5);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y + b, 2, b + 0.5);
        ctx.fillStyle = "#009736"; ctx.fillRect(x, y + 2 * b, 2, b);
        if (u < 1 / 3) { var hh = (1 - u * 3) * FH / 2; ctx.fillStyle = "#ee2a35"; ctx.fillRect(x, y + FH / 2 - hh, 2, hh * 2); }
        ctx.fillStyle = sl > 0 ? "rgba(255,255,255," + (0.11 * sl).toFixed(3) + ")" : "rgba(0,0,0," + (-0.24 * sl).toFixed(3) + ")"; ctx.fillRect(x, y, 2, FH);
      }
    }
    return { size: size, draw: draw, every: 2 };
  }

  /* ------------------------------------------------------------------ il cubo di Imad: si mescola, si ferma, si risolve */
  function Cubo(cv) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1;
    var C = D.cube || {}, COL = [C.R || "#77dd77", C.L || "#ff6961", C.U || "#ffb6c1", C.D || "#fdfd96", C.F || "#ffb347", C.B || "#aec6cf"], PL = C.plastic || "#f4f3ef";
    var N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], cub = [], todo = [], cur = null, wait = 1400, seed = 20261112;
    function rand() { seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) { if (!x && !y && !z) continue; cub.push({ p: [x, y, z], c: [x === 1 ? 0 : -1, x === -1 ? 1 : -1, y === 1 ? 2 : -1, y === -1 ? 3 : -1, z === 1 ? 4 : -1, z === -1 ? 5 : -1] }); }
    function q4(v, a, s) { var X = v[0], Y = v[1], Z = v[2]; if (a === 0) return s > 0 ? [X, -Z, Y] : [X, Z, -Y]; if (a === 1) return s > 0 ? [Z, Y, -X] : [-Z, Y, X]; return s > 0 ? [-Y, X, Z] : [Y, -X, Z]; }
    function rotA(v, a, th) { var c = Math.cos(th), s = Math.sin(th), X = v[0], Y = v[1], Z = v[2]; if (a === 0) return [X, Y * c - Z * s, Y * s + Z * c]; if (a === 1) return [X * c + Z * s, Y, -X * s + Z * c]; return [X * c - Y * s, X * s + Y * c, Z]; }
    function nIdx(n) { for (var k = 0; k < 6; k++) if (N[k][0] === n[0] && N[k][1] === n[1] && N[k][2] === n[2]) return k; return 0; }
    function apply(m) { cub.forEach(function (q) { if (q.p[m.a] !== m.l) return; q.p = q4(q.p, m.a, m.s); var nc = [-1, -1, -1, -1, -1, -1]; for (var k = 0; k < 6; k++) if (q.c[k] >= 0) nc[nIdx(q4(N[k], m.a, m.s))] = q.c[k]; q.c = nc; }); }
    function plan() {
      var seq = [], last = -1, i;
      for (i = 0; i < 7; i++) { var a, l, key; do { a = (rand() * 3) | 0; l = rand() < 0.5 ? -1 : 1; key = a * 2 + (l > 0 ? 1 : 0); } while (key === last); last = key; seq.push({ a: a, l: l, s: rand() < 0.5 ? -1 : 1 }); }
      todo = seq.map(function (m) { return { a: m.a, l: m.l, s: m.s, gap: 190 }; });
      todo[todo.length - 1].gap = 1300;
      for (i = seq.length - 1; i >= 0; i--) todo.push({ a: seq[i].a, l: seq[i].l, s: -seq[i].s, gap: i ? 150 : 2600 });
    }
    var DUR = 400, tPrev = 0;
    function size() { var f = fit(cv); if (f) { W = f.W; H = f.H; dpr = f.dpr; } }
    function draw(t) {
      if (!W) return;
      var live = !still();
      if (live) {
        var dt = Math.min(64, t - tPrev); tPrev = t;
        if (cur) { if (t - cur.t0 >= DUR) { apply(cur); wait = cur.gap; cur = null; } }
        else { wait -= dt; if (wait <= 0) { if (!todo.length) plan(); cur = todo.shift(); cur.t0 = t; } }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var s = Math.min(W, H * 1.08) / 5.7, cx = W / 2, cy = H * 0.53, yaw = live ? t * 0.00042 + 0.62 : 0.62, pitch = 0.5;
      var cw = Math.cos(yaw), sw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      function G(v) { var X = v[0] * cw + v[2] * sw, Z = -v[0] * sw + v[2] * cw; return [X, v[1] * cp - Z * sp, v[1] * sp + Z * cp]; }
      var ang = cur ? cur.s * Math.PI / 2 * eIO(clamp((t - cur.t0) / DUR, 0, 1)) : 0, quads = [];
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
    return { size: size, draw: draw, every: 1 };
  }

  /* ------------------------------------------------------------------ avvio: ogni tela si disegna solo se si vede */
  var mods = [];
  function add(id, make, hit) { var cv = doc.getElementById(id); if (!cv || !cv.getContext) return null; var m = make(cv, hit); m.cv = cv; m.vis = true; m.size(); mods.push(m); return m; }
  var globo = add("globo", Globo, $(".mondo .tile__hit"));
  add("bandiera", Bandiera);
  add("cuboCv", Cubo);
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { mods.forEach(function (m) { if (m.cv === e.target) m.vis = e.isIntersecting; }); }); }, { rootMargin: "80px" });
    mods.forEach(function (m) { io.observe(m.cv); });
  }
  function drawAll(t) { mods.forEach(function (m) { m.draw(t); }); }
  function refresh() { luce(); if (globo) { globo.sun(); globo.readout(false); } }
  var n = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (doc.hidden || root.classList.contains("is-sheet") || root.classList.contains("ni-on")) return;
    n++;
    mods.forEach(function (m, i) { if (m.vis && (m.every === 1 || (n + i) % m.every === 0)) m.draw(t); });
  }
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { mods.forEach(function (m) { m.size(); }); drawAll(performance.now()); }, 120); });
  refresh(); drawAll(0);
  /* le ore delle città le scrive app.js: quando sono pronte, e poi ogni mezzo minuto, si rilegge tutto */
  setTimeout(function () { mods.forEach(function (m) { m.size(); }); refresh(); drawAll(still() ? 0 : performance.now()); }, 400);
  if (!frozen) setInterval(refresh, 30000);
  if (!still()) requestAnimationFrame(loop);

  /* ------------------------------------------------------------------ la riga dei saluti: il saluto viene battuto sotto imad.chat_, poi sale in cielo */
  var riga = doc.getElementById("riga"), pending = null, busy = false;
  function play(g) {
    busy = true;
    riga.innerHTML = '<span class="rg-p" aria-hidden="true">&rsaquo;</span><span class="rg-t"></span><i class="rg-c" aria-hidden="true"></i>';
    var tx = $(".rg-t", riga), chars = Array.from ? Array.from(g.text) : g.text.split(""), i = 0;
    if (g.lang) tx.lang = g.lang;
    function done() { riga.innerHTML = ""; riga.style.opacity = ""; busy = false; if (pending) kick(); }
    function rise() {
      var st = $("#heroSky .gw--me i") || $("#heroSky .gw--me");
      if (!st || !riga.animate) { setTimeout(done, 600); return; }
      var a = tx.getBoundingClientRect(), b = st.getBoundingClientRect(), x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      var fly = doc.createElement("i"); fly.className = "rg-fly"; doc.body.appendChild(fly);
      riga.style.opacity = "0"; riga.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      var an = fly.animate([
        { transform: "translate(" + x0 + "px," + y0 + "px) scale(.5)", opacity: 0.3 },
        { transform: "translate(" + lerp(x0, x1, 0.45) + "px," + (Math.min(y0, y1) - 22) + "px) scale(1.5)", opacity: 1, offset: 0.5 },
        { transform: "translate(" + x1 + "px," + y1 + "px) scale(1)", opacity: 1 }], { duration: 950, easing: "cubic-bezier(.3,.6,.25,1)", fill: "forwards" });
      an.onfinish = function () { if (fly.parentNode) fly.parentNode.removeChild(fly); if (st.animate) st.animate([{ transform: "scale(2.4)" }, { transform: "scale(1)" }], { duration: 700, easing: "cubic-bezier(.2,.9,.3,1.3)" }); done(); };
    }
    (function type() { if (i < chars.length) { tx.textContent += chars[i++]; setTimeout(type, 75 + Math.random() * 60); } else setTimeout(rise, 950); })();
  }
  function kick() {
    if (!riga || !pending || busy || still()) return;
    if (root.classList.contains("is-sheet") || root.classList.contains("ni-on")) return;
    var g = pending; pending = null; setTimeout(function () { play(g); }, 420);
  }
  doc.addEventListener("imad:saluto", function (e) { if (e && e.detail && e.detail.text) { pending = e.detail; kick(); } });
  if ("MutationObserver" in window) new MutationObserver(kick).observe(root, { attributes: true, attributeFilter: ["class"] });
  /* chi ha già lasciato un saluto lo rivede salire, una volta, quando apre il sito */
  try { var mine = JSON.parse(localStorage.getItem("imad.saluto") || "null"); if (mine && D.greetings[mine.i]) { pending = { text: D.greetings[mine.i].text, lang: D.greetings[mine.i].lang }; setTimeout(kick, 900); } } catch (e) { /* senza memoria va bene lo stesso */ }
})();
