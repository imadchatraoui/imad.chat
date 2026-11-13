/* imad.chat — la casa nuova (anteprima): i riquadri vivi del primo giro, rimessi in casa.
   La luce del sole vero su Torino, il globo a puntini (Le città), il cubo che si mescola e si risolve (Progetti),
   la riga dove si battono i saluti sotto imad.chat_. Viene dopo app.js (usa window.IMAD) e terra.js.
   Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var root = document.documentElement, doc = document, A = window.ImadAstro, D = window.IMAD_DATA, TERRA = window.IMAD_TERRA, I = window.IMAD;
  if (!A || !D || !I) return;
  var RAD = Math.PI / 180;
  function $(s, r) { return (r || doc).querySelector(s); }
  var clamp = I.clamp;
  function lerp(a, b, p) { return a + (b - a) * p; }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function city(id) { for (var i = 0; i < D.cities.length; i++) if (D.cities[i].id === id) return D.cities[i]; return null; }
  /* la molla di IMAD.ease.spring (app.js, springCurve: ω = 6,4 / ζ), qui in JS: da 0 a 1 per u da 0 a 1, si posa con un filo oltre */
  function molla(u, z) { if (u <= 0) return 0; if (u >= 1) return 1; var w = 6.4 / z, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + (z * w / wd) * Math.sin(wd * u)); }
  function hexRgb(h) { var n = parseInt(String(h).replace("#", ""), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  /* si vede davvero? Almeno il 35% del riquadro sopra il dock: la stessa prova del risveglio di moto.js (che resta chi sveglia).
     s.ok si aggiorna da solo (un IntersectionObserver, niente misure nel giro dei fotogrammi); senza IntersectionObserver vale sempre sì */
  function inVista(el) {
    var s = { ok: true };
    if (!el || !("IntersectionObserver" in window)) return s;
    s.ok = false;
    var dock = doc.getElementById("dock"), dh = dock ? Math.round(dock.getBoundingClientRect().height + 12) : 0;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var rh = e.rootBounds ? e.rootBounds.height : window.innerHeight;
        s.ok = e.isIntersecting && e.intersectionRect.height / Math.max(1, Math.min(e.boundingClientRect.height, rh)) >= 0.35;
      });
    }, { rootMargin: "0px 0px -" + dh + "px 0px", threshold: [0, 0.2, 0.35, 0.5, 0.75, 1] }).observe(el);
    return s;
  }
  function tileOf(cv) { return cv.closest ? cv.closest(".tile") || cv : cv; }
  var TOR = city("torino");
  /* la luce per i disegni che hanno un volume (il cubo): direzione nello spazio della vista (x a destra, y in alto, z verso chi guarda),
     quanta luce d'ambiente e quanta dalla sorgente, il suo colore (0..1). La scrive luce() con le variabili CSS */
  var LUCE = { v: [-0.35, 0.82, 0.46], amb: 0.78, key: 0.3, spec: 0.2, rgb: [0.86, 0.9, 1] };

  /* ------------------------------------------------------------------ la luce: da dove sta il sole su Torino (di notte, la luna) */
  function luce() {
    var d = I.now(), s = A.sun(d, TOR.lat, TOR.lon), m = A.moon(d, TOR.lat, TOR.lon), ph = A.moonPhase(d);
    var src = null, k = 0.28, rgb = [255, 246, 232];
    if (s.altitude > -1) {
      var h = Math.max(0, s.altitude), warm = 1 - Math.min(1, h / 24);
      src = s; k = 0.5 + 0.5 * Math.min(1, h / 30);
      rgb = [255, Math.round(lerp(247, 198, warm)), Math.round(lerp(236, 140, warm))];
    } else if (m.altitude > 3 && ph.fraction > 0.1) {
      src = m; k = 0.2 + 0.25 * ph.fraction; rgb = [200, 214, 255];
    }
    /* guardando verso sud: il mattino la luce viene da sinistra, la sera da destra; più il sole è alto, più viene dall'alto */
    var ang = 180, shx = 0, shy = 12;
    if (src) {
      var alt = Math.max(0, src.altitude) * RAD, sx = -Math.sin(src.azimuth * RAD) * Math.cos(alt), up = 0.3 + Math.sin(alt);
      ang = Math.atan2(-sx, -up) / RAD; if (ang < 0) ang += 360;
      shx = -sx * 18; shy = 7 + 9 * Math.sin(alt);
    }
    var lv = [-0.35, 0.82, 0.46];
    if (src) { var a2 = Math.max(0, src.altitude) * RAD; lv = [-Math.sin(src.azimuth * RAD) * Math.cos(a2), 0.3 + Math.sin(a2), 0.55]; }
    var ll = Math.sqrt(lv[0] * lv[0] + lv[1] * lv[1] + lv[2] * lv[2]); lv = [lv[0] / ll, lv[1] / ll, lv[2] / ll];
    LUCE = src === s ? { v: lv, amb: 0.6, key: 0.46, spec: 0.9, rgb: [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255] }
      : src ? { v: lv, amb: 0.72, key: 0.32, spec: 0.35, rgb: [0.85, 0.9, 1] } : { v: lv, amb: 0.76, key: 0.3, spec: 0.2, rgb: [0.88, 0.9, 1] };
    var st = root.style;
    st.setProperty("--sun-ang", ang.toFixed(1) + "deg"); st.setProperty("--sun-a", (0.2 * k).toFixed(3)); st.setProperty("--sun-rgb", rgb.join(" "));
    st.setProperty("--shx", shx.toFixed(1) + "px"); st.setProperty("--shy", shy.toFixed(1) + "px");
  }
  Array.prototype.forEach.call(doc.querySelectorAll(".tile:not(.hero)"), function (t) { var i = doc.createElement("i"); i.className = "luce"; i.setAttribute("aria-hidden", "true"); t.insertBefore(i, t.firstChild); });

  function v3(lat, lon) { var cl = Math.cos(lat * RAD); return [cl * Math.sin(lon * RAD), Math.sin(lat * RAD), cl * Math.cos(lon * RAD)]; }
  function slerp(a, b, t) {
    var om = Math.acos(clamp(dot(a, b), -1, 1)), so = Math.sin(om); if (so < 1e-6) return a;
    var ka = Math.sin((1 - t) * om) / so, kb = Math.sin(t * om) / so;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  }

  /* ------------------------------------------------------------------ il globo: terre a puntini, giorno e notte veri, le cinque città, le linee verso Makkah
     La sfera è illuminata dal sole vero: una piccola immagine (SH × SH) ricalcolata a ogni disegno con la luce di Lambert, il
     crepuscolo caldo lungo il terminatore e il riflesso del sole sul mare; poi le terre in cinque fasce (notte, crepuscolo, terminatore,
     giorno basso, giorno), puntini tondi più piccoli verso il bordo; un filo d'atmosfera più chiaro dal lato del sole; le linee verso
     Makkah nell'oro del punto; le città accese di notte, più quiete di giorno. */
  function Globo(cv, hit) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1, dots = [], cls = null, sunV = [0, 0, 1];
    var cs = ["torino", "casablanca", "gaza", "medina", "makkah"].map(function (id) { var c = city(id); return { id: id, name: c.name, v: v3(c.lat, c.lon), lit: 0 }; });
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
    /* la luce sulla sfera: le normali di un disco SH × SH, calcolate una volta */
    var SH = 88, shc = doc.createElement("canvas"); shc.width = shc.height = SH;
    var shx_ = shc.getContext("2d"), shim = shx_.createImageData(SH, SH), NRM = new Float32Array(SH * SH * 3);
    (function () {
      for (var y = 0; y < SH; y++) for (var x = 0; x < SH; x++) {
        var u = (x + 0.5) / SH * 2 - 1, v = 1 - (y + 0.5) / SH * 2, r2 = u * u + v * v, j = (y * SH + x) * 3;
        if (r2 > 1) { var l = Math.sqrt(r2); u /= l; v /= l; r2 = 1; }
        NRM[j] = u; NRM[j + 1] = v; NRM[j + 2] = Math.sqrt(Math.max(0, 1 - r2));
      }
    })();
    var NIGHT = [15, 21, 58], DAY = [38, 62, 146], WARM = [170, 96, 60];
    var lastSv = [9, 9, 9];
    function shade(sv) {
      /* la luce sulla sfera cambia piano (il globo ondeggia di pochi gradi): si ricalcola solo quando il sole visto si è spostato */
      if (Math.abs(sv[0] - lastSv[0]) + Math.abs(sv[1] - lastSv[1]) + Math.abs(sv[2] - lastSv[2]) < 0.004) return;
      lastSv = sv.slice();
      var px = shim.data, hx = sv[0], hy = sv[1], hz = sv[2] + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      hx /= hl; hy /= hl; hz /= hl;
      for (var i = 0, j = 0, o = 0; i < SH * SH; i++, j += 3, o += 4) {
        var u = NRM[j], v = NRM[j + 1], z = NRM[j + 2], d = u * sv[0] + v * sv[1] + z * sv[2];
        var day = clamp((d + 0.1) / 0.34, 0, 1); day = day * day * (3 - 2 * day);
        var limb = 0.66 + 0.34 * z, tw = Math.max(0, 1 - Math.abs(d - 0.01) / 0.15), sp = u * hx + v * hy + z * hz;
        sp = sp > 0.965 ? Math.pow((sp - 0.965) / 0.035, 2) * 0.11 * day : 0;
        px[o] = (NIGHT[0] + (DAY[0] - NIGHT[0]) * day) * limb + WARM[0] * tw * tw * 0.15 + 255 * sp;
        px[o + 1] = (NIGHT[1] + (DAY[1] - NIGHT[1]) * day) * limb + WARM[1] * tw * tw * 0.15 + 240 * sp;
        px[o + 2] = (NIGHT[2] + (DAY[2] - NIGHT[2]) * day) * limb + WARM[2] * tw * tw * 0.15 + 215 * sp;
        px[o + 3] = 255;
      }
      shx_.putImageData(shim, 0, 0);
    }
    var home = { lon: 16, lat: 27 }, off = { lon: 0, lat: 0 }, drag = null, touched = -1e9, suppress = false, active = 0, swapAt = 0, n2 = 0;
    /* il risveglio dopo l'intro (moto.js chiama prime() e wake(d), CASA.md 2d E). zz: 0 vivo da subito (senza prime), 1 addormentato
       (girato di −118° in longitudine e −10° in latitudine, le città ferme sulla prima), 2 si sveglia (una molla, ζ .7, in 1,3 s,
       ogni fotogramma), 3 sveglio. Il tempo del risveglio è suo: avanza solo mentre il globo si disegna (zzT, zzDorme) */
    var zz = 0, zzT = 0, zzDorme = 0, zzPend = false, gPrev = -1, ZZ_LON = -118, ZZ_LAT = -10, ZZ_DUR = 1300;
    function spin() {
      if (zz === 1) return [ZZ_LON, ZZ_LAT];
      if (zz === 2) { var e = 1 - molla(zzT / ZZ_DUR, 0.7); return [ZZ_LON * e, ZZ_LAT * e]; }
      return [0, 0];
    }
    function sveglia() { zzPend = false; if (zz !== 1) return; zz = 2; zzT = 0; swapAt = performance.now(); }   /* le città ripartono da qui */
    var now_ = $("#mCity") ? $("#mCity").parentNode : null;
    /* cinque fasce, dal lato della notte a quello del giorno (s = coseno tra il puntino e il sole) */
    var ROUND = 1, BANDS = [-0.2, -0.07, 0.07, 0.22], INK = ["rgba(132,150,226,.44)", "rgba(184,164,214,.6)", "rgba(255,206,150,.96)", "rgba(255,239,216,.95)", "rgba(246,248,255,.98)"];
    function sunUpdate() {
      var d = I.now(), e = A.sunEquatorial(d), lon = (e.ra - A.lstHours(d, 0)) * 15; lon = ((lon % 360) + 540) % 360 - 180;
      sunV = v3(e.dec, lon); cls = new Uint8Array(dots.length);
      for (var i = 0; i < dots.length; i++) { var s = dot(dots[i], sunV), b = 0; while (b < 4 && s > BANDS[b]) b++; cls[i] = b; }
      cs.forEach(function (c) { c.lit = clamp((0.05 - dot(c.v, sunV)) / 0.2, 0, 1); });   /* 1 = notte fonda: luci accese */
    }
    function size() { var f = I.fit(cv); if (f) { W = f.W; H = f.H; dpr = f.dpr; } }
    /* sotto il globo: la città di turno, la sua ora, la parte del giorno */
    function readout(fade) {
      if (!now_) return;
      var c = I.city(cs[active].id);
      function put() { $("#mCity").textContent = c.name; $("#mTime").textContent = c.time; $("#mPart").textContent = c.label; now_.classList.remove("is-out"); }
      if (fade && !I.still()) { now_.classList.add("is-out"); setTimeout(put, 270); } else put();
    }
    /* puntini tondi dove si guarda (il centro del disco); verso il bordo, dove sono piccoli e schiacciati, quadratini (costano meno e non si distinguono) */
    function bucket(arr, fill) { if (!arr.length) return; ctx.fillStyle = fill; ctx.beginPath(); for (var i = 0; i < arr.length; i += 3) { var x = arr[i], y = arr[i + 1], s = arr[i + 2]; if (s > ROUND) { ctx.moveTo(x + s, y); ctx.arc(x, y, s, 0, 6.2832); } else ctx.rect(x - s * 0.9, y - s * 0.9, s * 1.8, s * 1.8); } ctx.fill(); }
    function pill(x, y, text, left) {
      ctx.font = '600 12px Manrope, -apple-system, "Segoe UI", sans-serif'; ctx.textBaseline = "middle";
      var w = Math.ceil(ctx.measureText(text).width) + 12, h = 19, x0 = left ? x - 10 - w : x + 10, y0 = Math.round(y - h / 2);
      x0 = clamp(x0, 6, W - w - 6);
      ctx.fillStyle = "rgba(7,10,32,.62)"; ctx.beginPath(); ctx.moveTo(x0 + 9, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, 9.5); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, 9.5); ctx.arcTo(x0, y0 + h, x0, y0, 9.5); ctx.arcTo(x0, y0, x0 + w, y0, 9.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.fillText(text, x0 + 6, y0 + h / 2 + 0.5);
    }
    function draw(t) {
      if (!W) return;
      if (!cls) sunUpdate();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var rad = Math.min(W, H) * 0.385, cx = W / 2, cy = H * 0.515, live = !I.still();
      if (!drag && t - touched > 3200) { off.lon *= 0.94; off.lat *= 0.94; }
      if (zz === 1) swapAt = t;                                  /* addormentato: la prima città resta, il giro riparte al risveglio */
      if (live && t - swapAt > 3200) { swapAt = t; active = (active + 1) % cs.length; readout(true); }
      var so = spin(), lon0 = home.lon + off.lon + so[0] + (live ? 8 * Math.sin(t / 5200) : 0), lat0 = clamp(home.lat + off.lat + so[1] + (live ? 2.5 * Math.sin(t / 7400) : 0), -70, 70);
      var cy_ = Math.cos(-lon0 * RAD), sy_ = Math.sin(-lon0 * RAD), cx_ = Math.cos(lat0 * RAD), sx_ = Math.sin(lat0 * RAD);
      function R(v) { var x = v[0] * cy_ + v[2] * sy_, z = -v[0] * sy_ + v[2] * cy_; return [x, v[1] * cx_ - z * sx_, v[1] * sx_ + z * cx_]; }
      var sv = R(sunV), sl = Math.sqrt(sv[0] * sv[0] + sv[1] * sv[1]) || 1, ux = sv[0] / sl, uy = -sv[1] / sl;
      /* l'atmosfera: un alone stretto, più chiaro dal lato del sole */
      var g = ctx.createRadialGradient(cx, cy, rad * 0.985, cx, cy, rad * 1.085);
      g.addColorStop(0, "rgba(120,150,255,.24)"); g.addColorStop(1, "rgba(120,150,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad * 1.09, 0, 6.2832); ctx.fill();
      /* la sfera, con la luce vera */
      shade(sv);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.drawImage(shc, cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();
      g = ctx.createLinearGradient(cx - ux * rad, cy - uy * rad, cx + ux * rad, cy + uy * rad);
      g.addColorStop(0, "rgba(150,168,240,.14)"); g.addColorStop(0.55, "rgba(170,190,255,.3)"); g.addColorStop(1, "rgba(206,224,255,.7)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(cx, cy, rad - 0.3, 0, 6.2832); ctx.stroke();
      /* le terre: cinque fasce, puntini tondi, più piccoli e più tenui verso il bordo */
      var B = [[], [], [], [], []], i, p, k0 = rad * 0.0078; ROUND = k0 * 0.86;
      for (i = 0; i < dots.length; i++) { p = R(dots[i]); if (p[2] <= 0.05) continue; B[cls[i]].push(cx + p[0] * rad, cy - p[1] * rad, (0.5 + 0.5 * p[2]) * k0); }
      for (i = 0; i < 5; i++) bucket(B[i], INK[i]);
      /* le linee verso Makkah, nell'oro del punto, con una luce che le percorre */
      ctx.lineWidth = 1; ctx.lineCap = "round";
      arcs.forEach(function (a) {
        var P = a.pts.map(R), k;
        ctx.strokeStyle = "rgba(243,223,168,.46)"; ctx.beginPath(); var open = false;
        for (k = 0; k < P.length; k++) { if (P[k][2] <= 0) { open = false; continue; } var x = cx + P[k][0] * rad, y = cy - P[k][1] * rad; if (open) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open = true; } }
        ctx.stroke();
        if (!live) return;
        var u = ((t / 2600) + a.ph) % 1, e = eIO(u), fade = Math.sin(Math.PI * u);
        for (k = 0; k < 6; k++) { var j = Math.round(clamp(e * 40 - k * 0.9, 0, 40)), q = P[j]; if (q[2] <= 0) continue; ctx.fillStyle = "rgba(252,236,196," + (fade * (1 - k / 6) * 0.95).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(cx + q[0] * rad, cy - q[1] * rad, 1.9 - k * 0.22, 0, 6.2832); ctx.fill(); }
      });
      /* le città: di notte le luci accese, di giorno più quiete; quella di turno con il suo nome */
      var lab = null;
      cs.forEach(function (c, idx) {
        var q = R(c.v); if (q[2] <= 0.04) return;
        var x = cx + q[0] * rad, y = cy - q[1] * rad, on = idx === active, big = c === mak ? 1.25 : 1, gr = (6 + 3 * c.lit) * big;
        var gg = ctx.createRadialGradient(x, y, 0, x, y, gr); gg.addColorStop(0, "rgba(255,226,168," + (0.42 + 0.4 * c.lit).toFixed(3) + ")"); gg.addColorStop(1, "rgba(255,226,168,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, gr, 0, 6.2832); ctx.fill();
        ctx.fillStyle = "#fff7e2"; ctx.beginPath(); ctx.arc(x, y, 2.1 * big, 0, 6.2832); ctx.fill();
        if (on) {
          var w = live ? ((t - swapAt) % 1600) / 1600 : 0.35;
          ctx.strokeStyle = "rgba(243,223,168," + (0.85 * (1 - w)).toFixed(3) + ")"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 4.5 + 11 * eIO(w), 0, 6.2832); ctx.stroke();
          lab = [x, y, c.name, q[0] < -0.08];
        }
      });
      if (lab) pill(lab[0], lab[1], lab[2], lab[3]);
    }
    /* trascinando di lato il globo gira; un tocco secco apre la pagina */
    if (hit) {
      hit.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, lon: off.lon, lat: off.lat, moved: false, id: e.pointerId }; });
      window.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        drag.moved = true; off.lon = drag.lon - dx * 0.42; if (e.pointerType === "mouse") off.lat = clamp(drag.lat + dy * 0.3, -50, 50); touched = performance.now();
        if (I.still()) draw(touched);              /* senza movimento il globo non gira da solo, ma il dito lo gira lo stesso */
      });
      var end = function () { if (!drag) return; if (drag.moved) { suppress = true; setTimeout(function () { suppress = false; }, 380); } drag = null; };
      window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
      hit.addEventListener("click", function (e) { if (suppress) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    }
    /* il globo si ridisegna un fotogramma sì e uno no: basta, e costa la metà; mentre si sveglia girando, ogni fotogramma.
       Se dopo prime() nessuno lo sveglia (6 s in vista, a pagina libera, almeno il 35% sopra il dock: mai sotto il dock, dove il giro
       non lo vedrebbe nessuno), si sveglia da sé */
    var zzVista = null;
    function frame(t) {
      var dt = gPrev < 0 ? 0 : clamp(t - gPrev, 0, 50); gPrev = t;
      if (zz === 1) { if (zzVista && zzVista.ok) zzDorme += dt; if (zzDorme > 6000 && !zzPend) sveglia(); }
      if (zz === 2) { zzT += dt; if (zzT >= ZZ_DUR) zz = 3; draw(t); return; }
      if ((n2++ & 1) === 0) draw(t);
    }
    return { size: size, draw: frame, still: draw, sun: sunUpdate, readout: readout,
      prime: function () { if (I.still() || zz) return; zz = 1; zzDorme = 0; if (!zzVista) zzVista = inVista(tileOf(cv)); draw(performance.now()); },
      wake: function (d) {
        if (zz !== 1 || zzPend) return 0;
        d = Math.max(0, +d || 0); zzPend = true; setTimeout(sveglia, d);
        return d + ZZ_DUR;
      } };
  }

  /* ------------------------------------------------------------------ il cubo di Imad (colori Kukko): si mescola, si ferma, si risolve
     Un oggetto vero: plastica bianca con le scanalature tra i cubetti, adesivi arrotondati in prospettiva con un velo lucido,
     luce dal lato dove sta il sole su Torino (LUCE, da luce()), un'ombra morbida a terra che resta tutta dentro la tela. */
  function Cubo(cv) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1;
    var C = D.cube || {}, COL = [C.R || "#77dd77", C.L || "#ff6961", C.U || "#ffb6c1", C.D || "#fdfd96", C.F || "#ffb347", C.B || "#aec6cf"].map(hexRgb), PL = hexRgb(C.plastic || "#f4f3ef");
    var INNER = [206, 200, 190];
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
    /* un quadrato arrotondato nel piano della faccia: [i, j] da -h a h, angoli di raggio r (5 punti per angolo) */
    function rsq(h, r) {
      var out = [], cc = [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]];
      cc.forEach(function (c) { var ox = c[0] * (h - r), oy = c[1] * (h - r), a0 = c[2] * Math.PI / 2; for (var k = 0; k <= 4; k++) { var a = a0 + k * Math.PI / 8; out.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]); } });
      return out;
    }
    var GROOVE = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], FACE = rsq(0.484, 0.08), STK = rsq(0.396, 0.1);
    var DUR = 400, tPrev = 0, clock = 0;
    /* il risveglio dopo l'intro (moto.js, CASA.md 2d E). zz: 0 vivo da subito, 1 addormentato (girato di −1,05 rad dalla sua base, fermo,
       nessuna mossa: resta il disegno di prime()), 2 si sveglia (una molla, ζ .66, in 900 ms), 3 sveglio; 260 ms dopo la molla si
       mescola. Il tempo è il suo orologio (clock), che avanza solo mentre si disegna */
    var zz = 0, zzT0 = 0, zzDorme = 0, zzPend = false, zzPrev = -1, zzVista = null, ZZ_YAW = -1.05, ZZ_DUR = 900;
    function sveglia() { zzPend = false; if (zz !== 1) return; zz = 2; zzT0 = clock; wait = ZZ_DUR + 260; }
    function size() { var f = I.fit(cv, 3); if (f) { W = f.W; H = f.H; dpr = f.dpr; } }
    function rgb(c, k, add) { add = add || 0; return "rgb(" + Math.round(clamp(c[0] * k + add, 0, 255)) + "," + Math.round(clamp(c[1] * k + add, 0, 255)) + "," + Math.round(clamp(c[2] * k + add, 0, 255)) + ")"; }
    var lastDraw = -1e9;
    function frame(t) {
      if (zz === 1) {
        /* addormentato: la posa resta quella che ha disegnato prime(); si conta solo da quanto si vede davvero, almeno il 35% sopra
           il dock (dopo 6 s si sveglia da sé) */
        zzDorme += zzPrev < 0 || !zzVista || !zzVista.ok ? 0 : clamp(t - zzPrev, 0, 64); zzPrev = t; tPrev = t;
        if (zzDorme > 6000 && !zzPend) sveglia();
        if (zz === 1) return;
      }
      zzPrev = t;
      /* tra una mossa e l'altra il cubo gira soltanto piano: trenta disegni al secondo bastano; durante una mossa (e il risveglio), tutti */
      if (!cur && zz !== 2 && t - lastDraw < 30 && t >= lastDraw) { if (!I.still()) { var dt0 = Math.min(64, Math.max(0, t - tPrev)); tPrev = t; clock += dt0; wait -= dt0; if (wait <= 0) draw(t, true); } return; }
      draw(t);
    }
    function draw(t, skipTick) {
      if (!W) return;
      lastDraw = t;
      var live = !I.still();
      /* un orologio suo, che avanza solo mentre si disegna (al più 64 ms per volta): dopo una pausa il cubo riprende la mossa
         e il giro da dove li aveva lasciati, senza scatti */
      if (live) {
        var dt = skipTick ? 0 : Math.min(64, Math.max(0, t - tPrev)); if (!skipTick) { tPrev = t; clock += dt; }
        if (zz === 2 && clock - zzT0 >= ZZ_DUR) zz = 3;
        if (zz === 1) { /* addormentato: nessuna mossa */ }
        else if (cur) { if (clock - cur.t0 >= DUR) { apply(cur); wait = cur.gap; cur = null; } }
        else { wait -= dt; if (wait <= 0) { if (!todo.length) plan(); cur = todo.shift(); cur.t0 = clock; } }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var wk = zz === 1 ? ZZ_YAW : zz === 2 ? ZZ_YAW * (1 - molla((clock - zzT0) / ZZ_DUR, 0.66)) : 0;
      var s = Math.min(W, H * 1.08) / 5.95, cx = W / 2, cy = H * 0.46, yaw = (live ? clock * 0.00042 : 0) - 0.62 + wk, pitch = 0.5;
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
      var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx), dk = I.isDark();
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
    return { size: size, draw: frame, still: draw,
      prime: function () { if (I.still() || zz) return; zz = 1; zzDorme = 0; zzPrev = -1; if (!zzVista) zzVista = inVista(tileOf(cv)); draw(performance.now()); },
      wake: function (d) {
        if (zz !== 1 || zzPend) return 0;
        d = Math.max(0, +d || 0); zzPend = true; setTimeout(sveglia, d);
        return d + ZZ_DUR;
      } };
  }

  /* ------------------------------------------------------------------ avvio: ogni tela si disegna solo se si vede (il giro è IMAD.loop) */
  var mods = [];
  function add(id, make, hit) {
    var cv = doc.getElementById(id); if (!cv || !cv.getContext) return null;
    var m = make(cv, hit); m.cv = cv; m.size(); mods.push(m);
    I.loop(cv, function (t) { m.draw(t); });
    return m;
  }
  var globo = add("globo", Globo, $(".citta .tile__hit"));
  var cubo = add("cuboCv", Cubo);
  /* il risveglio dei disegni dopo l'intro (moto.js): IMAD.vivo.{globo, cubo, impara} = { prime(), wake(ritardoMs) → ms in tutto }.
     Con «meno movimento» o ?shot=1 non fanno niente; una seconda chiamata non fa niente; senza prime() tutto parte vivo, come prima */
  var nulla = { prime: function () { }, wake: function () { return 0; } };
  I.vivo = I.vivo || {};
  I.vivo.globo = globo ? { prime: globo.prime, wake: globo.wake } : nulla;
  I.vivo.cubo = cubo ? { prime: cubo.prime, wake: cubo.wake } : nulla;
  function stillAll() { var t = performance.now(); mods.forEach(function (m) { m.still(t); }); }
  function refresh() { luce(); if (globo) { globo.sun(); globo.readout(false); } }
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { mods.forEach(function (m) { m.size(); }); stillAll(); }, 120); });
  refresh(); stillAll();
  /* il tema cambia: l'ombra del cubo ha un colore per tema; anche fermi («meno movimento», ?shot=1) i disegni si rifanno */
  (function () {
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq) { if (mq.addEventListener) mq.addEventListener("change", stillAll); else if (mq.addListener) mq.addListener(stillAll); }
    if ("MutationObserver" in window) new MutationObserver(stillAll).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  })();
  /* quando i caratteri sono pronti le misure sono quelle vere; poi, ogni mezzo minuto, la luce e la notte sul globo */
  I.whenFree(function () { mods.forEach(function (m) { m.size(); }); refresh(); stillAll(); });
  if (!(new URLSearchParams(location.search).get("t"))) setInterval(refresh, 30000);

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
    if (!riga || !pending || busy || I.still()) return;
    if (root.classList.contains("is-sheet") || root.classList.contains("ni-on")) return;
    var g = pending; pending = null; setTimeout(function () { play(g); }, 420);
  }
  doc.addEventListener("imad:saluto", function (e) { if (e && e.detail && e.detail.text) { pending = e.detail; kick(); } });
  if ("MutationObserver" in window) new MutationObserver(kick).observe(root, { attributes: true, attributeFilter: ["class"] });
  /* chi ha già lasciato un saluto lo rivede salire, una volta, quando apre il sito */
  try { var mine = JSON.parse(localStorage.getItem("imad.saluto") || "null"); if (mine && D.greetings[mine.i]) { pending = { text: D.greetings[mine.i].text, lang: D.greetings[mine.i].lang }; setTimeout(kick, 900); } } catch (e) { /* senza memoria va bene lo stesso */ }
})();
