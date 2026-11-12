/* imad.chat — la casa nuova (anteprima). Il guscio della pagina: il cielo di Torino adesso (sfondo, hero, logo), il versetto di oggi,
   le pagine che si aprono sopra la casa (Le città, Lascia un saluto, il lettore del Corano), i suoni, e i piccoli aiuti comuni
   in window.IMAD che usano gli altri script della pagina (vivo.js, casa.js, vivi.js).
   Viene dopo ../../shared/data.js e ../../shared/astro-lite.js. Plain script, ES2017 al massimo, nessuna dipendenza. */
(function () {
  "use strict";

  var D = window.IMAD_DATA, A = window.ImadAstro;
  var doc = document, root = doc.documentElement;
  var Q = new URLSearchParams(location.search);
  var SHOT = Q.get("shot") === "1";
  var frozen = (function () { var t = Q.get("t"); if (!t) return null; var d = new Date(t); return isNaN(d.getTime()) ? null : d; })();
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqDark = window.matchMedia("(prefers-color-scheme: dark)");

  function now() { return frozen ? new Date(frozen.getTime()) : new Date(); }
  function reduced() { return mqReduce.matches; }
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function store(key, val) {
    try {
      if (val === undefined) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* in-app browser senza memoria: va bene lo stesso */ }
    return null;
  }
  function isDark() { var t = root.getAttribute("data-theme"); return t ? t === "dark" : mqDark.matches; }

  /* ---------------------------------------------------------------- movimento */
  function springCurve(zeta, n) {
    if (!(window.CSS && CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)"))) return null;
    var w = 6.4 / zeta, wd = w * Math.sqrt(1 - zeta * zeta), pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
      pts.push(i === n ? 1 : Math.round(x * 1000) / 1000);
    }
    return "linear(" + pts.join(", ") + ")";
  }
  var EASE_OUT = "cubic-bezier(.22, 1, .36, 1)";
  var EASE_IN_OUT = "cubic-bezier(.65, 0, .35, 1)";
  var SPRING = springCurve(0.8, 36) || "cubic-bezier(.2, .9, .25, 1)";      /* morph dei riquadri, viaggi del filtro */
  var SPRING_POP = springCurve(0.66, 36) || "cubic-bezier(.2, 1.1, .3, 1)";   /* entrate, stella */
  var DUR_OPEN = 560, DUR_CLOSE = 420;
  root.style.setProperty("--spring", SPRING);

  /* ---------------------------------------------------------------- colore del cielo (OKLab) */
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function gam(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(clamp(c, 0, 1) * 255); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toLab(c) {
    var r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
      m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
      s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function toRgb(L) {
    var l = L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], m = L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], s = L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  function mixLab(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c) { return "rgb(" + c[0] + ", " + c[1] + ", " + c[2] + ")"; }
  function rgba(c, a) { return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + a.toFixed(3) + ")"; }
  function toLch(l) { return [l[0], Math.hypot(l[1], l[2]), Math.atan2(l[2], l[1])]; }
  function fromLch(c) { return [c[0], c[1] * Math.cos(c[2]), c[1] * Math.sin(c[2])]; }
  /* come mixLab, ma la tinta gira lungo l'arco breve: dal viola all'arancio si passa dal rosa, non dal grigio */
  function mixLch(a, b, t, boost) { var A_ = toLch(a), B = toLch(b), dh = B[2] - A_[2]; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI; return fromLch([A_[0] + (B[0] - A_[0]) * t, (A_[1] + (B[1] - A_[1]) * t) * (boost || 1), A_[2] + dh * t]); }
  /* stessa tinta di un colore, con luminosità e croma scelte: serve allo sfondo nei due temi */
  function tone(rgb, L, C) { var c = toLch(toLab(rgb)); return toRgb(fromLch([L, C, c[2]])); }

  /* altezza del Sole (gradi) → zenit, mezzo cielo, orizzonte, bagliore. I toni restano abbastanza profondi da reggere il testo bianco. */
  var SKY = [
    [60, "#154bb8", "#2565cf", "#4a8ce0", "#d6e7ff", 0.34],
    [15, "#1a51be", "#2d6cd2", "#5193e2", "#dbe9ff", 0.36],
    [6, "#2051b3", "#436fc7", "#7f8ec9", "#ffe0c2", 0.5],
    [2, "#22489e", "#5961ae", "#bf7f60", "#ffc08e", 0.72],
    [0, "#1e3f8c", "#5b4f98", "#c96f4c", "#ffa674", 0.8],
    [-3, "#172f70", "#46407f", "#b0563f", "#ff8d68", 0.7],
    [-7, "#101f52", "#262a62", "#5e3a62", "#c2668a", 0.4],
    [-12, "#0b1538", "#131c48", "#2a2752", "#6653a6", 0.26],
    [-18, "#070c22", "#0c1230", "#141a3c", "#4650a6", 0.2]
  ].map(function (k) { return { alt: k[0], zen: toLab(hex(k[1])), mid: toLab(hex(k[2])), hor: toLab(hex(k[3])), glow: toLab(hex(k[4])), ga: k[5] }; });
  function skyAt(alt) {
    var a = SKY[0], b = SKY[SKY.length - 1], t = 0;
    if (alt >= a.alt) b = a; else if (alt <= b.alt) a = b; else {
      for (var i = 0; i < SKY.length - 1; i++) if (alt <= SKY[i].alt && alt >= SKY[i + 1].alt) { a = SKY[i]; b = SKY[i + 1]; t = (a.alt - alt) / (a.alt - b.alt); break; }
    }
    var mid = mixLab(a.mid, b.mid, t), hor = mixLab(a.hor, b.hor, t);
    return { zen: toRgb(mixLab(a.zen, b.zen, t)), mid: toRgb(mid), rose: toRgb(mixLch(mid, hor, 0.56, 1.06)), hor: toRgb(hor), glow: toRgb(mixLab(a.glow, b.glow, t)), ga: a.ga + (b.ga - a.ga) * t };
  }
  /* gx: da che parte sta il bagliore (percento); k: quanto è forte su questa superficie */
  function setSky(el, sk, gx, k) {
    var st = el.style;
    st.setProperty("--zen", css(sk.zen)); st.setProperty("--mid", css(sk.mid)); st.setProperty("--rose", css(sk.rose)); st.setProperty("--hor", css(sk.hor));
    st.setProperty("--glow", rgba(sk.glow, sk.ga * (k == null ? 1 : k))); if (gx != null) st.setProperty("--gx", gx + "%");
  }
  function skyStyle(sk, gx, k) { return "--zen:" + css(sk.zen) + ";--mid:" + css(sk.mid) + ";--rose:" + css(sk.rose) + ";--hor:" + css(sk.hor) + ";--glow:" + rgba(sk.glow, sk.ga * (k == null ? 1 : k)) + ";--gx:" + gx + "%"; }

  /* ---------------------------------------------------------------- le cinque città */
  var ORDER = ["gaza", "torino", "medina", "makkah", "casablanca"];
  function cityById(id) { return D.cities.filter(function (c) { return c.id === id; })[0]; }
  var CITIES = ORDER.map(cityById);
  var TORINO = cityById("torino");
  function cityState(c, d) {
    var s = A.sun(d, c.lat, c.lon), alt = s.altitude, part = A.dayPart(alt), label = part;
    var rising = A.sun(new Date(d.getTime() + 600000), c.lat, c.lon).altitude > alt;
    if (part === "alba/tramonto") label = rising ? "alba" : "tramonto";
    else if (part === "crepuscolo") label = rising ? "aurora" : "crepuscolo";
    return { alt: alt, az: s.azimuth, label: label, rising: rising, gx: rising ? 20 : 80, sky: skyAt(alt), time: A.localTime(d, c.tz) };
  }
  var WINDS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  function wind(b) { return WINDS[Math.round(b / 22.5) % 16]; }
  var fmtInt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

  /* ---------------------------------------------------------------- il saluto di questo telefono (finché non c'è un archivio comune) */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var mine = store("imad.saluto") || null;      /* { i, x, y } */
  if (mine && !(D.greetings[mine.i])) mine = null;
  /* la stella di chi ha lasciato un saluto da qui: dorata, con la sua parola */
  function myStar() {
    if (!mine) return "";
    var g = D.greetings[mine.i];
    return '<span class="gw gw--me" style="--mx:' + mine.x.toFixed(3) + ";--my:" + mine.y.toFixed(3) + '"><i></i><b lang="' + esc(g.lang) + '">' + esc(g.text) + "</b></span>";
  }
  function paintMine() {
    var box = $("#salMine"), w = $("#salMineW"); if (!box || !w) return;
    if (!mine) { box.hidden = true; return; }
    var g = D.greetings[mine.i]; w.textContent = g.text; w.lang = g.lang; box.hidden = false;
  }

  /* ---------------------------------------------------------------- riferimenti al DOM */
  var home = $("#home"), heroSky = $("#heroSky"), grid = $("#grid"), dotClip = $("#dotclip"), dock = $("#dock");

  function layout() {
    var cs = getComputedStyle(root), cols = parseInt(cs.getPropertyValue("--cols"), 10) || 4;
    var gap = parseFloat(cs.getPropertyValue("--gap")) || 12, gut = parseFloat(cs.getPropertyValue("--gutter")) || 16;
    var max = cols === 4 ? 98 : cols === 8 ? 92 : 80;
    var cell = Math.min(max, (home.clientWidth - 2 * gut - (cols - 1) * gap) / cols);
    root.style.setProperty("--cell", (Math.floor(cell * 100) / 100) + "px");
  }

  /* ---------------------------------------------------------------- il versetto di oggi */
  /* uno al giorno, tra i versetti brevi che stanno nel riquadro senza essere mai tagliati */
  var SHORT = ["53:49", "16:16", "55:5"].map(function (k) { return D.verses.filter(function (v) { return v.key === k; })[0]; }).filter(Boolean);
  function dayNumber(d) { var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-"); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  var HOME_VERSE = SHORT[dayNumber(now()) % SHORT.length] || D.verses[0];
  function setVerse(v) {
    $(".js-var").textContent = v.ar;                              /* solo dal dato, mai digitato */
    $(".js-vit").textContent = v.it;
    $(".js-vref").textContent = v.key;
    $(".js-vsurah").textContent = v.surahName;
  }
  /* il versetto non si taglia mai: se non sta, il corpo scende di poco; se ancora non sta, si passa a un versetto più breve */
  function paintCorano() {
    var box = $(".corano__verse"), ar = $(".js-var"), list = [HOME_VERSE].concat(SHORT.filter(function (v) { return v !== HOME_VERSE; }));
    var steps = [1, 0.94, 0.88, 0.82, 0.76];
    for (var i = 0; i < list.length; i++) {
      setVerse(list[i]); ar.style.fontSize = "";
      var base = parseFloat(getComputedStyle(ar).fontSize) || 32;
      for (var j = 0; j < steps.length; j++) {
        ar.style.fontSize = j ? Math.max(24, base * steps[j]).toFixed(2) + "px" : "";
        if (box.scrollHeight <= box.clientHeight + 1) return;
      }
    }
  }

  /* ---------------------------------------------------------------- il cielo di Torino adesso: sfondo, hero, fondo pagina */
  /* lo sfondo: quattro campi presi dal cielo di Torino, profondi nel tema scuro e pallidi in quello chiaro */
  function paintWall(st) {
    var k = st.sky, day = clamp((st.alt + 4) / 14, 0, 1), dusk = clamp(1 - Math.abs(st.alt) / 9, 0, 1), rs = root.style;
    rs.setProperty("--wd-1", css(tone(k.zen, 0.25 + 0.13 * day, 0.105 + 0.03 * day)));
    rs.setProperty("--wd-2", css(tone(k.mid, 0.27 + 0.14 * day, 0.1)));
    rs.setProperty("--wd-3", css(tone(k.rose, 0.26 + 0.1 * dusk + 0.14 * day, 0.09 + 0.02 * dusk)));
    rs.setProperty("--wd-4", css(toRgb(fromLch((function (c) { return [0.25 + 0.07 * dusk + 0.15 * day, 0.075 + 0.02 * dusk, c[2]]; })(toLch(mixLch(toLab(k.rose), toLab(k.hor), 0.6)))))));
    rs.setProperty("--wl-1", css(tone(k.zen, 0.905, 0.05)));
    rs.setProperty("--wl-2", css(tone(k.mid, 0.9, 0.052)));
    rs.setProperty("--wl-3", css(tone(k.rose, 0.915, 0.045 + 0.012 * dusk)));
    rs.setProperty("--wl-4", css(tone(k.hor, 0.925, 0.045 + 0.02 * dusk)));
  }
  function moonSVG(mp, size) {
    var r = 18, k = mp.fraction, rx = (r * Math.abs(1 - 2 * k)).toFixed(2);
    var lit = "M0 -" + r + "A" + r + " " + r + " 0 0 1 0 " + r + "A" + rx + " " + r + " 0 0 " + (k < 0.5 ? 0 : 1) + " 0 -" + r + "Z";
    return '<svg width="' + size + '" height="' + size + '" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false"><circle r="20" fill="#141b44"/><circle r="17.4" fill="#333c78"/><path d="' + lit + '" fill="#fff3d6" stroke="#fff3d6" stroke-width="' + (size < 30 ? 2.4 : 1) + '" stroke-linejoin="round"' + (mp.waxing ? "" : ' transform="scale(-1 1)"') + "/></svg>";
  }
  var lastMinute = "";
  function paintLive(d, force) {
    var minute = A.localTime(d, "Europe/Rome");
    if (!force && minute === lastMinute) return;
    lastMinute = minute;
    var tor = cityState(TORINO, d), rs = root.style;
    setSky(heroSky, tor.sky, 97);
    rs.setProperty("--sky-zen", css(tor.sky.zen)); rs.setProperty("--sky-mid", css(tor.sky.mid)); rs.setProperty("--sky-rose", css(tor.sky.rose)); rs.setProperty("--sky-hor", css(tor.sky.hor));
    rs.setProperty("--sky-glow", rgba(tor.sky.glow, tor.sky.ga)); rs.setProperty("--sky-gx", tor.gx + "%");
    paintWall(tor);
    heroSky.innerHTML = myStar();
    $(".js-moon").innerHTML = moonSVG(A.moonPhase(d), 18);
    $(".js-tortime").textContent = tor.time; $(".js-torpart").textContent = tor.label; setSky($(".js-tordot"), tor.sky, tor.gx, 0.6);
  }

  /* due file di saluti che scorrono in versi opposti; la seconda comincia da metà elenco, così le due file non si somigliano */
  function buildMarquee() {
    var G = D.greetings, h = Math.floor(G.length / 2);
    function row(list) { var one = list.map(function (g) { return '<span lang="' + esc(g.lang) + '">' + esc(g.text) + "</span>"; }).join(""); return one + one; }
    $("#marq").innerHTML = row(G);
    var r2 = $("#marq2"); if (r2) r2.innerHTML = row(G.slice(h).concat(G.slice(0, h)));
  }

  /* ---------------------------------------------------------------- suoni: rispondono solo a un tocco; un solo interruttore, anche per Dot */
  var Snd = (function () {
    var on = store("imad.suoni"), ctx = null, fans = [];
    on = on == null ? true : !!on;
    function ac() { if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } } if (ctx.state === "suspended") ctx.resume(); return ctx; }
    function tone(f, at, dur, g) { var c = ac(); if (!c) return; var o = c.createOscillator(), a = c.createGain(), t = c.currentTime + at; o.type = "sine"; o.frequency.setValueAtTime(f, t); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + dur + 0.03); }
    var bank = { tap: [[880, 0, 0.07, 0.03]], star: [[1318.5, 0, 0.9, 0.05], [1975.5, 0.09, 1.1, 0.03], [2637, 0.2, 1.2, 0.016]] };
    function play(n) { if (!on || !bank[n]) return; try { bank[n].forEach(function (p) { tone(p[0], p[1], p[2], p[3]); }); } catch (e) { } }
    return {
      on: function () { return on; },
      set: function (v) { on = !!v; store("imad.suoni", on); if (on) play("tap"); fans.forEach(function (f) { try { f(on); } catch (e) { } }); },
      play: play,
      listen: function (f) { fans.push(f); }
    };
  })();
  function paintSound() {
    var b = $("#sound"), on = Snd.on();
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", on ? "Suoni accesi. Tocca per spegnerli" : "Suoni spenti. Tocca per accenderli");
  }

  /* ---------------------------------------------------------------- pagine aperte sopra la casa */
  var sheetEl = $("#sheet"), card = $("#sheetCard"), bg = $("#sheetBg"), body = $("#sheetBody"), scrim = $("#sheetScrim"), closeBtn = $("#sheetClose"), grab = $(".sheet__grab");
  var S = { open: null, src: null, pushed: false, busy: false, cleanup: null, tick: null, anims: [] };
  function track(a) { S.anims.push(a); return a; }
  function dropAnims() { S.anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); S.anims = []; }

  /* striscia panoramica: i cinque cieli da ovest a est, sfumati l'uno nell'altro */
  var WEST_EAST = ["casablanca", "torino", "gaza", "medina", "makkah"].map(cityById);
  function panoHTML(d) {
    var st = WEST_EAST.map(function (c) { return cityState(c, d); }), stars = "", r = rng(77);
    for (var i = 0; i < 110; i++) {
      var u = r(), v = Math.pow(r(), 1.5) * 0.6, m = r(), q = r();
      var f = clamp(u * 5 - 0.5, 0, 4), a = Math.floor(f), b = Math.min(4, a + 1), alt = st[a].alt + (st[b].alt - st[a].alt) * (f - a), vis = clamp((1 - alt) / 11, 0, 1);
      if (vis > 0.03) stars += '<circle cx="' + (u * 100).toFixed(2) + '%" cy="' + (5 + v * 100).toFixed(2) + '%" r="' + (0.4 + m * m * 0.8).toFixed(2) + '" fill="#fff6e0" opacity="' + (vis * (0.3 + 0.7 * q)).toFixed(2) + '"/>';
    }
    return '<figure class="pano lit" id="pano" aria-label="Il cielo di adesso da ovest a est: ' + WEST_EAST.map(function (c, i) { return esc(c.name) + ", " + esc(st[i].label); }).join("; ") + '">' +
      '<canvas width="240" height="48" aria-hidden="true"></canvas><div class="pano__g"></div><svg aria-hidden="true" focusable="false">' + stars + "</svg>" +
      '<p class="pano__we" aria-hidden="true"><span>ovest</span><span>est</span></p>' +
      '<ol class="pano__l">' + WEST_EAST.map(function (c) { return '<li><b class="num js-pt"></b><span>' + esc(c.name) + "</span></li>"; }).join("") + "</ol></figure>";
  }
  function panoDraw(cv, d) {
    if (!cv || !cv.getContext) return;
    var L = WEST_EAST.map(function (c) { var s = cityState(c, d).sky; return [toLab(s.zen), toLab(s.mid), toLab(s.rose), toLab(s.hor)]; });
    var ctx = cv.getContext("2d"), W = cv.width, H = cv.height, stops = [0, 0.5, 0.8, 1];
    for (var x = 0; x < W; x++) {
      var f = clamp((x + 0.5) / W * 5 - 0.5, 0, 4), a = Math.floor(f), b = Math.min(4, a + 1), t = f - a; t = t * t * (3 - 2 * t);
      var g = ctx.createLinearGradient(0, 0, 0, H);
      for (var k = 0; k < 4; k++) g.addColorStop(stops[k], css(toRgb(mixLab(L[a][k], L[b][k], t))));
      ctx.fillStyle = g; ctx.fillRect(x, 0, 1, H);
    }
  }
  function arcSVG(c, d) {
    var t = A.sunTimes(d, c.lat, c.lon, c.tz), f = null, g = null, n = d.getTime();
    if (t.sunrise && t.sunset) {
      var a = t.sunrise.getTime(), b = t.sunset.getTime();
      if (n >= a && n <= b) f = (n - a) / (b - a);
      else if (n > b) g = (n - b) / (a + 86400000 - b);
      else g = (n - (b - 86400000)) / (a - (b - 86400000));
    }
    var h = '<svg class="arc" viewBox="0 0 120 38" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#fff" vector-effect="non-scaling-stroke">' +
      '<path d="M0 30H120" opacity=".34" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
      '<path d="M10 30A50 25 0 0 1 110 30" opacity=".34" stroke-width="1.2" stroke-dasharray="1.5 3.5" vector-effect="non-scaling-stroke"/>';
    if (f != null) h += '<path d="M10 30A50 25 0 0 1 110 30" pathLength="1" stroke-dasharray="' + f.toFixed(3) + ' 2" stroke-width="1.6" opacity=".95" vector-effect="non-scaling-stroke"/>';
    h += "</g></svg>";
    var x, y, dot;
    if (f != null) { x = 60 - 50 * Math.cos(Math.PI * f); y = 30 - 25 * Math.sin(Math.PI * f); dot = '<i class="sundot" style="left:' + (x / 1.2).toFixed(2) + "%;top:" + (y / 0.38).toFixed(2) + '%"></i>'; }
    else { g = g == null ? 0.5 : clamp(g, 0, 1); x = 110 - 100 * g; y = 30 + 6 * Math.sin(Math.PI * g); dot = '<i class="sundot sundot--low" style="left:' + (x / 1.2).toFixed(2) + "%;top:" + (y / 0.38).toFixed(2) + '%"></i>'; }
    return {
      html: '<div class="arcbox">' + h + dot + "</div>",
      rise: t.sunrise ? A.localTime(t.sunrise, c.tz) : "—", set: t.sunset ? A.localTime(t.sunset, c.tz) : "—"
    };
  }
  function offText(c, d) {
    if (c.id === "torino") return "";
    var o = A.offsetFromRome(d, c.tz); if (!o) return "stessa ora";
    var n = Math.abs(o), s = (n === 1 ? "1 ora" : String(n).replace(".", ",") + " ore");
    return s + (o > 0 ? " avanti" : " indietro");
  }
  function qiblaRow(c) {
    var q = A.qibla(c.lat, c.lon);
    if (q.distanceKm < 5) return '<div class="cc__q"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fff" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="9.2" opacity=".7"/><circle cx="11" cy="11" r="2.6" fill="#fff" stroke="none"/></svg><span>La qibla è qui</span></div>';
    return '<div class="cc__q"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="9.2" opacity=".7"/><g transform="rotate(' + q.bearing.toFixed(1) + ' 11 11)"><path d="M11 15.6V6.4"/><path d="M8.1 9.1L11 6.2l2.9 2.9"/></g></svg>' +
      "<span>Qibla a " + Math.round(q.bearing) + "° " + wind(q.bearing) + "</span><span>" + fmtInt.format(Math.round(q.distanceKm)) + " km dalla Kaʿba</span></div>";
  }

  /* «al 40%», ma «all’11%», «all’8%», «all’80%»: l’articolo segue il suono del numero (uno, otto, undici, diciotto, ottanta…) */
  function alPct(n) { return (/^(1|8|11|18|8\d)$/.test(String(n)) ? "all’" : "al ") + n; }
  var PAGES = {
    citta: {
      mat: "page",
      build: function (el) {
        var d = now(), mp = A.moonPhase(d), pct = Math.round(mp.fraction * 100);
        var h = '<div class="s-wrap"><h2 class="s-title" id="sheetTitle" tabindex="-1">Le città, adesso</h2>' +
          '<p class="s-sub">Cinque città. Un solo cielo.</p>' + panoHTML(d) +
          '<p class="s-cap">' + esc(cap(A.localDate(d, "Europe/Rome"))) + ". Ogni riquadro ha il colore del cielo che c’è lì adesso. Le ore di differenza sono rispetto a Torino.</p>" +
          '<div class="moon lit">' + moonSVG(mp, 44) + "<div><b>" + esc(cap(mp.name)) + ", illuminata " + (pct < 1 ? "a meno dell’1" : alPct(pct)) + "%</b><span>È la stessa in ogni città: cambia solo l’inclinazione.</span></div></div>" +
          '<ul class="cl">';
        CITIES.forEach(function (c) {
          var st = cityState(c, d), arc = arcSVG(c, d), off = offText(c, d);
          h += '<li class="cc" data-city="' + c.id + '" style="' + skyStyle(st.sky, st.gx, 0.55) + '">' +
            '<div class="cc__top"><div><h3 class="cc__name">' + esc(c.name) + '<span class="cc__ar" lang="ar" dir="rtl"></span></h3><p class="cc__meta">' + esc(c.country) + (off ? "<br>" + esc(off) : "") + "</p></div>" +
            '<div><time class="cc__time num"></time><p class="cc__meta fact--r">' + esc(st.label) + "</p></div></div>" +
            '<div class="cc__sun"><p class="fact">Alba<b class="num">' + arc.rise + "</b></p>" + arc.html + '<p class="fact fact--r">Tramonto<b class="num">' + arc.set + "</b></p></div>" +
            qiblaRow(c) + "</li>";
        });
        el.innerHTML = h + "</ul></div>";
        $$(".cc", el).forEach(function (li, i) { $(".cc__ar", li).textContent = CITIES[i].ar; });   /* i nomi arabi: solo dal dato (Wikidata) */
        panoDraw($("#pano canvas", el), d);
        function clocks(dd) {
          $$(".cc", el).forEach(function (li, i) { var t = A.localTime(dd, CITIES[i].tz, true); $(".cc__time", li).innerHTML = t.slice(0, 5) + "<small>" + t.slice(5) + "</small>"; });
          $$(".js-pt", el).forEach(function (b, i) { b.textContent = A.localTime(dd, WEST_EAST[i].tz); });
        }
        clocks(d); S.tick = clocks;
      }
    },

    saluti: {
      mat: "night", dark: true,
      build: function (el) {
        el.innerHTML = '<div class="s-wrap sal"><div class="sal__cielo" aria-hidden="true"></div>' +
          '<h2 class="s-title" id="sheetTitle" tabindex="-1">Lascia un saluto</h2><p class="s-sub">Diventa una stella nel cielo di Imad.</p>' +
          '<div class="sal__chips" role="group" aria-label="Scegli un saluto">' +
          D.greetings.map(function (g, i) { return '<button class="gchip" type="button" data-i="' + i + '" lang="' + esc(g.lang) + '" aria-pressed="' + (mine && mine.i === i ? "true" : "false") + '" aria-label="' + esc(g.text) + ", " + esc(g.label) + '">' + esc(g.text) + "</button>"; }).join("") +
          '</div><p class="sal__note" id="salNote" aria-live="polite"></p></div>';
        var star = doc.createElement("div"); star.className = "mystar"; star.innerHTML = "<u></u><i></i><em></em>"; star.hidden = true; card.insertBefore(star, body);
        var note = $("#salNote", el);
        function place() { if (!mine) { star.hidden = true; return; } var r = card.getBoundingClientRect(); star.hidden = false; star.style.left = (mine.x * r.width) + "px"; star.style.top = (r.height * (0.07 + mine.y * 0.13)) + "px"; $("em", star).textContent = D.greetings[mine.i].text; $("em", star).lang = D.greetings[mine.i].lang; }
        function say() {
          note.innerHTML = mine ? "Il tuo saluto resta su questo telefono, per ora. Puoi cambiarlo, oppure <button type=\"button\" id=\"salUndo\">toglierlo</button>." : "Scegli un saluto: la tua stella si accende nel cielo.";
        }
        function pulse() { var u = $("u", star); u.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(2.6)" }], { duration: 900, easing: EASE_OUT }); $("i", star).animate([{ transform: "scale(2.2)" }, { transform: "scale(1)" }], { duration: 700, easing: SPRING_POP }); }
        function choose(btn) {
          var i = +btn.getAttribute("data-i"), r = rng(Date.now() & 0xffff);
          $$(".gchip", el).forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
          mine = { i: i, x: mine ? mine.x : 0.2 + r() * 0.6, y: mine ? mine.y : 0.15 + r() * 0.7 };
          store("imad.saluto", mine);
          var from = btn.getBoundingClientRect(); place(); var to = star.getBoundingClientRect();
          function land() { $("em", star).style.opacity = ""; pulse(); Snd.play("star"); say(); paintLive(now(), true); paintMine(); try { doc.dispatchEvent(new CustomEvent("imad:saluto", { detail: { text: D.greetings[mine.i].text, lang: D.greetings[mine.i].lang } })); } catch (e) { } }
          if (SHOT || reduced()) { land(); return; }
          star.style.visibility = "hidden";
          var fly = doc.createElement("div"); fly.className = "fly"; fly.innerHTML = "<i></i>"; doc.body.appendChild(fly);
          var x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = to.left, y1 = to.top, dur = clamp(Math.hypot(x1 - x0, y1 - y0) * 1.5, 620, 980);
          fly.animate([{ transform: "translateX(" + x0 + "px)" }, { transform: "translateX(" + x1 + "px)" }], { duration: dur, easing: EASE_IN_OUT, fill: "forwards" });
          $("i", fly).animate([{ transform: "translateY(" + y0 + "px) scale(.6)", opacity: 0.2 }, { transform: "translateY(" + (y0 + (y1 - y0) * 0.5) + "px) scale(1.5)", opacity: 1, offset: 0.4 }, { transform: "translateY(" + y1 + "px) scale(1)", opacity: 1 }], { duration: dur, easing: "cubic-bezier(.3, .6, .25, 1)", fill: "forwards" })
            .onfinish = function () { if (fly.parentNode) fly.parentNode.removeChild(fly); star.style.visibility = ""; land(); };
        }
        el.addEventListener("click", function (e) {
          var b = e.target.closest ? e.target.closest(".gchip") : null; if (b) { choose(b); return; }
          if (e.target.id === "salUndo") { mine = null; store("imad.saluto", null); $$(".gchip", el).forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); place(); say(); paintLive(now(), true); paintMine(); }
        });
        place(); say();
        return function () { if (star.parentNode) star.parentNode.removeChild(star); };
      }
    },

    corano: {
      mat: "paper", cls: "is-reader",
      build: function (el) {
        var keys = [HOME_VERSE.key, "55:5", "37:6", "16:16", "86:1-3"].filter(function (k, i, a) { return a.indexOf(k) === i; }).slice(0, 4), vs = keys.map(function (k) { return D.verses.filter(function (v) { return v.key === k; })[0]; }).filter(Boolean);
        var h = '<div class="let"><h2 class="let__h" id="sheetTitle" tabindex="-1">Corano</h2><div class="let__pager" id="letPager" tabindex="0" role="group" aria-label="Versetti: scorri in orizzontale">';
        vs.forEach(function (v, i) {
          h += '<section class="let__page" aria-label="Versetto ' + (i + 1) + " di " + vs.length + '"><div>' + (i === 0 ? '<p class="let__k">Versetto di oggi</p>' : "") + '<p class="ayah ayah--lg" lang="ar" dir="rtl"></p><p class="let__it">' + esc(v.it) + '</p><p class="let__ref">' + esc(v.surahName) + ' <span class="num">' + esc(v.key) + '</span></p><p class="let__tr">trad. Hamza Roberto Piccardo</p>' +
            '<a class="let__src" href="' + esc(v.source) + '" target="_blank" rel="noopener">leggi su quran.com<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16l8-8"/><path d="M9.5 8H16v6.5"/></svg></a></div></section>';
        });
        h += '</div><div class="let__nav"><button class="iconbtn" type="button" id="letPrev" aria-label="Versetto precedente"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6.5L8.5 12l5.5 5.5"/></svg></button>' +
          '<span class="let__dots" aria-hidden="true">' + vs.map(function () { return "<i></i>"; }).join("") + "</span>" +
          '<button class="iconbtn" type="button" id="letNext" aria-label="Versetto successivo"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5l5.5 5.5-5.5 5.5"/></svg></button></div></div>';
        el.innerHTML = h;
        $$(".ayah", el).forEach(function (p, i) { p.textContent = vs[i].ar; });        /* testo arabo: solo dal dato */
        var pager = $("#letPager", el), dots = $$(".let__dots i", el), prev = $("#letPrev", el), next = $("#letNext", el), cur = -1;
        function idx() { return clamp(Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)), 0, vs.length - 1); }
        function mark() { var i = idx(); if (i === cur) return; cur = i; dots.forEach(function (d, j) { d.className = j === i ? "on" : ""; }); prev.disabled = i === 0; next.disabled = i === vs.length - 1; }
        function go(i) { pager.scrollTo({ left: clamp(i, 0, vs.length - 1) * pager.clientWidth, behavior: reduced() || SHOT ? "auto" : "smooth" }); }
        pager.addEventListener("scroll", mark, { passive: true });
        prev.addEventListener("click", function () { go(idx() - 1); }); next.addEventListener("click", function () { go(idx() + 1); });
        pager.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { go(idx() + 1); e.preventDefault(); } if (e.key === "ArrowLeft") { go(idx() - 1); e.preventDefault(); } });
        mark();
      }
    }
  };

  function tileFor(id) { return $('.tile[data-tile="' + id + '"]') || null; }
  function onScreen(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }

  /* Metamorfosi di apertura, solo con transform e opacity.
     Telefono (la pagina copre lo schermo): un «fantasma» grande quanto il riquadro, con i suoi angoli, cresce in scala uniforme
     fino a coprire lo schermo (gli angoli escono dai bordi); poi il fondo vero della pagina gli si dissolve sopra.
     Tablet e computer (la pagina è una scheda al centro): il fondo della scheda cresce in scala uniforme dal centro del riquadro.
     La casa si allontana appena; lo strato di Dot si allontana con lei (e Dot si ferma finché la pagina è aperta). */
  var ghost = $("#sheetGhost"), behind = [home, dotClip].filter(Boolean);
  function isFull(to) { return to.width >= window.innerWidth - 1 && to.height >= window.innerHeight - 1; }
  function ghostEnd(from, to, rad) {
    var a = Math.max(to.width / Math.max(1, from.width - 2 * rad), to.height / from.height), b = Math.max(to.height / Math.max(1, from.height - 2 * rad), to.width / from.width);
    return "translate(" + (to.left + to.width / 2 - from.left - from.width / 2).toFixed(1) + "px," + (to.top + to.height / 2 - from.top - from.height / 2).toFixed(1) + "px) scale(" + (Math.min(a, b) * 1.04).toFixed(4) + ")";
  }
  function ghostPlace(from, rad, mat) {
    ghost.setAttribute("data-mat", mat); ghost.hidden = false;
    ghost.style.left = from.left + "px"; ghost.style.top = from.top + "px"; ghost.style.width = from.width + "px"; ghost.style.height = from.height + "px"; ghost.style.borderRadius = rad + "px";
  }
  function cardStart(from, to) {
    var k = clamp(Math.min(from.width / to.width, from.height / to.height), 0.16, 1);     /* la scheda parte dentro il rettangolo del riquadro */
    return "translate(" + (from.left + from.width / 2 - to.left - to.width / 2).toFixed(1) + "px," + (from.top + from.height / 2 - to.top - to.height / 2).toFixed(1) + "px) scale(" + k.toFixed(4) + ")";
  }
  function inert(on) { [home, dotClip, dock].forEach(function (n) { if (!n) return; if (on) n.setAttribute("inert", ""); else n.removeAttribute("inert"); }); }
  function dot(fn) { var DOT = window.DOT; if (DOT && DOT[fn]) { try { DOT[fn](); } catch (e) { } } }
  function behindTo(from, to, dur, easing, done) {
    behind.forEach(function (n, i) { var a = track(n.animate([{ transform: from }, { transform: to }], { duration: dur, easing: easing, fill: "forwards" })); if (!i && done) a.onfinish = done; });
  }

  function openSheet(id, src, o) {
    o = o || {};
    var page = PAGES[id]; if (!page || S.open || S.busy) return;
    S.open = id; S.src = src || null; S.busy = true; S.tick = null;
    card.setAttribute("data-mat", page.mat); card.className = "sheet__card" + (page.dark ? " on-dark" : "");
    body.className = "sheet__body" + (page.cls ? " " + page.cls : ""); body.innerHTML = ""; body.scrollTop = 0;
    card.style.transform = ""; card.style.opacity = "";
    sheetEl.hidden = false; root.classList.add("is-sheet", "is-locked"); inert(true); dot("pause");
    S.cleanup = page.build(body) || null;
    if (o.push !== false) { try { history.pushState({ imadSheet: id }, "", "#" + id); S.pushed = true; } catch (e) { S.pushed = false; } } else S.pushed = !!o.pushed;
    function done() { S.busy = false; card.classList.add("is-open"); ghost.hidden = true; var t = $("#sheetTitle", body); try { (t || card).focus({ preventScroll: true }); } catch (e) { } }
    var from = !o.instant && onScreen(src) ? src.getBoundingClientRect() : null;
    if (o.instant) { done(); return; }
    if (reduced() || !from) {
      track(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" }));
      track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" })).onfinish = done; return;
    }
    var to = card.getBoundingClientRect(), rad = parseFloat(getComputedStyle(src).borderTopLeftRadius) || 32;
    behind.forEach(function (n) { n.style.transformOrigin = "50% " + (window.pageYOffset + window.innerHeight / 2) + "px"; });
    if (isFull(to)) {
      ghostPlace(from, rad, page.mat);
      track(ghost.animate([{ transform: "none" }, { transform: ghostEnd(from, to, rad) }], { duration: DUR_OPEN, easing: SPRING, fill: "forwards" }));
      track(ghost.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 110, easing: "linear" }));
      track(bg.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.82 }, { opacity: 1 }], { duration: DUR_OPEN, easing: "linear", fill: "backwards" }));
    } else {
      track(bg.animate([{ transform: cardStart(from, to) }, { transform: "none" }], { duration: DUR_OPEN, easing: SPRING }));
      track(bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "linear" }));
    }
    setTimeout(function () { if (S.open === id && src) src.classList.add("is-source"); }, 120);
    [body, closeBtn, grab].concat($$(".mystar", card)).forEach(function (n) { track(n.animate([{ opacity: 0, transform: n === body ? "translateY(18px)" : "none" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 140, easing: EASE_OUT, fill: "backwards" })); });
    track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" }));
    behindTo("none", "scale(.955)", DUR_OPEN, SPRING, done);
  }

  function finishClose() {
    var src = S.src;
    dropAnims(); if (S.cleanup) { try { S.cleanup(); } catch (e) { } }
    sheetEl.hidden = true; ghost.hidden = true; body.innerHTML = ""; card.style.transform = ""; card.style.opacity = ""; card.style.borderRadius = ""; card.style.overflow = ""; scrim.style.opacity = "";
    root.classList.remove("is-sheet", "is-locked"); inert(false); behind.forEach(function (n) { n.style.transformOrigin = ""; });
    if (src) { src.classList.remove("is-source"); var f = $(".tile__hit", src) || src; try { f.focus({ preventScroll: true }); } catch (e) { } }
    S.open = null; S.src = null; S.cleanup = null; S.tick = null; S.busy = false;
    if (location.hash && !S.pushed) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { } }
    dot("resume");
  }
  function closeSheet(o) {
    o = o || {};
    if (!S.open || (S.busy && !o.force)) return;
    if (S.pushed && !o.fromPop) { S.pushed = false; try { history.back(); return; } catch (e) { } }
    S.busy = true; card.classList.remove("is-open");
    var src = S.src, from = onScreen(src) ? src.getBoundingClientRect() : null;
    if (o.instant) { finishClose(); return; }
    if (reduced() || !from || o.swiped) {
      /* chiusura con il dito, o senza riquadro visibile: rimpicciolisce verso il riquadro e svanisce */
      var cr = card.getBoundingClientRect(), cur = getComputedStyle(card).transform, end = "translateY(24px) scale(.94)";
      if (from && !reduced()) { var s = from.width / (card.offsetWidth || cr.width); end = "translate(" + (from.left + from.width / 2 - (card.offsetLeft + card.offsetWidth / 2)) + "px," + (from.top - card.offsetTop) + "px) scale(" + s + ")"; }
      if (src) src.classList.remove("is-source");
      behindTo("scale(.955)", "none", 300, EASE_OUT);
      track(scrim.animate([{ opacity: getComputedStyle(scrim).opacity }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }));
      track(card.animate(reduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: cur === "none" ? "none" : cur, opacity: 1 }, { transform: end, opacity: 0 }], { duration: reduced() ? 150 : 300, easing: EASE_OUT, fill: "forwards" })).onfinish = finishClose;
      return;
    }
    var to = card.getBoundingClientRect(), rad = parseFloat(getComputedStyle(src).borderTopLeftRadius) || 32, last = bg;
    [body, closeBtn, grab].concat($$(".mystar", card)).forEach(function (n) { track(n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: "ease-out", fill: "forwards" })); });
    if (isFull(to)) {
      /* il fantasma torna sotto il fondo, già grande; il fondo svanisce e il fantasma si restringe fino al riquadro */
      ghostPlace(from, rad, card.getAttribute("data-mat")); last = ghost;
      track(ghost.animate([{ transform: ghostEnd(from, to, rad) }, { transform: "none" }], { duration: DUR_CLOSE, easing: EASE_OUT, fill: "both" }));
      track(bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, easing: "linear", fill: "forwards" }));
    } else {
      track(bg.animate([{ transform: "none" }, { transform: cardStart(from, to) }], { duration: DUR_CLOSE, easing: EASE_OUT, fill: "forwards" }));
    }
    track(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR_CLOSE - 80, easing: "ease-out", fill: "forwards" }));
    behindTo("scale(.955)", "none", DUR_CLOSE, EASE_OUT);
    setTimeout(function () { if (src) src.classList.remove("is-source"); track(last.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-out", fill: "forwards" })).onfinish = finishClose; }, DUR_CLOSE - 150);
  }

  /* trascina in giù per chiudere (telefono) */
  (function () {
    var g = null;
    card.addEventListener("touchstart", function (e) { if (e.touches.length !== 1 || S.busy || window.innerWidth >= 700) { g = null; return; } var t = e.touches[0]; g = { x: t.clientX, y: t.clientY, t: performance.now(), on: false, off: false, dy: 0, v: 0, ly: t.clientY, lt: performance.now(), top: body.scrollTop <= 0 }; }, { passive: true });
    card.addEventListener("touchmove", function (e) {
      if (!g || g.off) return;
      var t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y, nowT = performance.now();
      if (!g.on) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        var inner = e.target.closest ? e.target.closest(".let__page") : null;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.3 && g.top && body.scrollTop <= 0 && !(inner && inner.scrollTop > 0)) { g.on = true; g.y = t.clientY; dy = 0; card.style.overflow = "hidden"; card.style.borderRadius = "38px"; }
        else { g.off = true; return; }
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, dy); g.dy = dy; g.v = (t.clientY - g.ly) / Math.max(1, nowT - g.lt); g.ly = t.clientY; g.lt = nowT;
      var s = 1 - clamp(dy / 1400, 0, 0.16);
      card.style.transform = "translateY(" + (dy * 0.82).toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
      scrim.style.opacity = String(clamp(1 - dy / 520, 0.25, 1));
    }, { passive: false });
    function end() {
      if (!g || !g.on) { g = null; return; }
      var go = g.dy > 130 || (g.dy > 36 && g.v > 0.55); g = null;
      if (go) { closeSheet({ swiped: true }); return; }
      var cur = card.style.transform; card.style.transform = ""; scrim.style.opacity = "";
      card.animate([{ transform: cur }, { transform: "none" }], { duration: 380, easing: SPRING }).onfinish = function () { card.style.borderRadius = ""; card.style.overflow = ""; };
    }
    card.addEventListener("touchend", end); card.addEventListener("touchcancel", end);
  })();

  closeBtn.addEventListener("click", function () { closeSheet(); });
  scrim.addEventListener("click", function () { closeSheet(); });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.open) { e.preventDefault(); closeSheet(); } });
  window.addEventListener("popstate", function (e) {
    var st = e.state;
    if (st && st.imadSheet) { if (!S.open) openSheet(st.imadSheet, tileFor(st.imadSheet), { push: false, pushed: true }); }
    else if (S.open) { S.pushed = false; closeSheet({ fromPop: true, force: true }); }
  });

  /* tocco sui riquadri: pressione, apertura, luce al passaggio */
  doc.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var op = t.closest("[data-open]"); if (!op || S.open) return;
    openSheet(op.getAttribute("data-open"), op.closest(".tile[data-mat]") || op);
  });
  grid.addEventListener("pointerdown", function (e) { var h = e.target.closest ? e.target.closest(".tile__hit") : null; if (h) h.parentNode.classList.add("is-pressed"); });
  ["pointerup", "pointercancel", "pointerleave", "dragstart"].forEach(function (n) { grid.addEventListener(n, function () { $$(".tile.is-pressed", grid).forEach(function (t) { t.classList.remove("is-pressed"); }); }, true); });
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    grid.addEventListener("pointermove", function (e) { var t = e.target.closest ? e.target.closest(".tile") : null; if (!t) return; var r = t.getBoundingClientRect(); t.style.setProperty("--mx", (e.clientX - r.left) + "px"); t.style.setProperty("--my", (e.clientY - r.top) + "px"); });
  }
  $("#logo").addEventListener("click", function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); });
  $("#sound").addEventListener("click", function () { Snd.set(!Snd.on()); paintSound(); });

  /* grana: una tessera di rumore disegnata una volta (seme fisso), primo livello di sfondo di ogni superficie */
  (function () {
    try {
      var n = 128, cv = doc.createElement("canvas"); cv.width = cv.height = n;
      var ctx = cv.getContext("2d"), im = ctx.createImageData(n, n), r = rng(1968), px = im.data;
      for (var i = 0; i < px.length; i += 4) { var v = r() < 0.5 ? 0 : 255, a = r(); px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = Math.round((a * a + a) * 0.5 * 0.075 * 255); }
      ctx.putImageData(im, 0, 0);
      root.style.setProperty("--grain", "url(" + cv.toDataURL("image/png") + ")");
    } catch (e) { /* senza canvas: superfici lisce, va bene lo stesso */ }
  })();

  /* ---------------------------------------------------------------- window.IMAD: gli aiuti comuni della pagina */
  /* un solo giro di fotogrammi per tutte le tele vive: gira solo se almeno una si vede, mai a scheda nascosta,
     mai mentre l'intro copre la pagina o una pagina aperta la copre */
  var loops = [], raf = 0, io = null;
  function free() { return !doc.hidden && !root.classList.contains("is-sheet") && !root.classList.contains("ni-on"); }
  function wantFrames() { for (var i = 0; i < loops.length; i++) if (loops[i].on && loops[i].vis) return true; return false; }
  function frame(t) {
    raf = 0; if (!free()) return;
    for (var i = 0; i < loops.length; i++) { var l = loops[i]; if (l.on && l.vis) { try { l.fn(t); } catch (e) { l.on = false; if (window.console) console.error(e); } } }
    if (wantFrames()) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && free() && wantFrames()) raf = requestAnimationFrame(frame); }
  if ("IntersectionObserver" in window) io = new IntersectionObserver(function (es) { es.forEach(function (e) { loops.forEach(function (l) { if (l.el === e.target) l.vis = e.isIntersecting; }); }); wake(); }, { rootMargin: "80px" });
  doc.addEventListener("visibilitychange", wake);
  if ("MutationObserver" in window) new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ["class"] });

  var readyFns = [], isReady = false;
  function whenFree(fn) {
    function go() { if (!root.classList.contains("ni-on")) { fn(); return true; } return false; }
    if (!isReady) { readyFns.push(function () { whenFree(fn); }); return; }
    if (go()) return;
    var mo = new MutationObserver(function () { if (go()) mo.disconnect(); });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  }
  var apiCache = {};

  window.IMAD = {
    shot: SHOT,
    now: now,
    reduced: reduced,
    still: function () { return SHOT || reduced(); },
    isDark: isDark,
    esc: esc,
    clamp: clamp,
    ease: { out: EASE_OUT, inOut: EASE_IN_OUT, spring: SPRING, pop: SPRING_POP },
    sound: { on: Snd.on, play: Snd.play, listen: Snd.listen },
    /* adatta una tela alla sua misura CSS: { W, H, dpr } in px CSS, o null se non si vede */
    fit: function (cv, cap) {
      var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, cap || 2);
      if (r.width < 2 || r.height < 2) return null;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      return { W: r.width, H: r.height, dpr: dpr };
    },
    /* fn(t) a ogni fotogramma finché el si vede (e niente copre la casa). Torna { stop, start } */
    loop: function (el, fn) {
      var l = { el: el, fn: fn, on: !(SHOT || reduced()), vis: true }; loops.push(l);
      if (io && el) io.observe(el); wake();
      return { stop: function () { l.on = false; }, start: function () { if (SHOT || reduced()) return; l.on = true; wake(); } };
    },
    /* fn() la prima volta che el entra nello schermo (soglia: quanta parte deve vedersi, 0..1) */
    onView: function (el, fn, soglia) {
      if (!("IntersectionObserver" in window)) { fn(); return; }
      var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: soglia == null ? 0.35 : soglia });
      o.observe(el);
    },
    /* fn() quando la pagina è libera: caratteri pronti, intro finita */
    whenFree: whenFree,
    /* i dati di GitHub dalle due rotte del sito (/api/github/contributi, /api/github/progetti): una Promise che si risolve
       sempre, con la risposta o con { ok: false }. Mai numeri inventati: senza risposta, la tile dice «si aggiorna tra poco». */
    api: function (name) {
      if (apiCache[name]) return apiCache[name];
      apiCache[name] = new Promise(function (res) {
        var done = false, ctl = window.AbortController ? new AbortController() : null;
        var t = setTimeout(function () { if (done) return; done = true; if (ctl) ctl.abort(); res({ ok: false }); }, 8000);
        fetch("/api/github/" + name, { signal: ctl ? ctl.signal : undefined, headers: { accept: "application/json" } })
          .then(function (r) { return r.ok ? r.json() : { ok: false }; })
          .then(function (j) { if (done) return; done = true; clearTimeout(t); res(j && j.ok ? j : { ok: false }); })
          .catch(function () { if (done) return; done = true; clearTimeout(t); res({ ok: false }); });
      });
      return apiCache[name];
    },
    /* dopo un cambio di impaginazione: Dot rilegge i riquadri (sec > 0: li segue per sec secondi mentre si muovono) */
    relayout: function (sec) { var DOT = window.DOT; if (DOT && DOT.refresh) { try { DOT.refresh(sec || 0); } catch (e) { } } },
    /* le cinque città, per il globo: nome, ora del posto, parte del giorno */
    city: function (id) { var c = cityById(id), st = cityState(c, now()); return { id: id, name: c.name, time: st.time, label: st.label, lat: c.lat, lon: c.lon }; }
  };

  /* ---------------------------------------------------------------- avvio */
  function refit() { layout(); paintCorano(); }
  layout(); paintCorano(); buildMarquee(); paintLive(now(), true); paintMine(); paintSound();
  if ("ResizeObserver" in window) new ResizeObserver(function () { layout(); paintCorano(); }).observe(home); else window.addEventListener("resize", refit);

  function tick() { var d = now(); paintLive(d, false); if (S.tick) { try { S.tick(d); } catch (e) { } } }
  if (!frozen) setTimeout(function () { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));

  var faces = [];
  if (doc.fonts && doc.fonts.load) {
    try { faces = [doc.fonts.load("800 40px Manrope"), doc.fonts.load("700 16px Manrope"), doc.fonts.load("600 13px Manrope"), doc.fonts.load("500 15px Manrope"), doc.fonts.load('500 13px "Geist Mono"'), doc.fonts.load('400 30px "Amiri Quran"', HOME_VERSE.ar)]; } catch (e) { faces = []; }
  }
  var fontsReady = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();
  var settle = Promise.race([Promise.all(faces).then(function () { return fontsReady; }), new Promise(function (r) { setTimeout(r, 2600); })]);
  function start() {
    if (isReady) return;
    refit();
    var open = Q.get("open") || (location.hash ? location.hash.slice(1) : "");
    if (open && PAGES[open]) openSheet(open, tileFor(open), { instant: true, push: false });
    isReady = true; var fns = readyFns; readyFns = []; fns.forEach(function (f) { f(); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { window.__ready = true; }); });
  }
  /* con l'intro la casa sotto si misura presto (l'intro aspetta i caratteri da sé); senza, si aspettano i caratteri */
  if (root.classList.contains("ni-on")) { Promise.race([settle, new Promise(function (r) { setTimeout(r, 900); })]).then(start, start); settle.then(function () { refit(); }); }
  else settle.then(start, start);
})();
