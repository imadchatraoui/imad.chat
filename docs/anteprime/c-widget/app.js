/* imad.chat — anteprima C «Widget». Vanilla JS, nessuna dipendenza oltre a data.js e astro-lite.js. */
(function () {
  "use strict";

  var D = window.IMAD_DATA, A = window.ImadAstro;
  var doc = document, root = doc.documentElement;
  var Q = new URLSearchParams(location.search);
  var SHOT = Q.get("shot") === "1";
  var WANT_INTRO = Q.get("intro") === "1";
  var frozen = (function () { var t = Q.get("t"); if (!t) return null; var d = new Date(t); return isNaN(d.getTime()) ? null : d; })();
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var RAD = Math.PI / 180;

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
  var SPRING = springCurve(0.8, 36) || "cubic-bezier(.2, .9, .25, 1)";      /* morph dei riquadri */
  var SPRING_POP = springCurve(0.66, 36) || "cubic-bezier(.2, 1.1, .3, 1)";   /* entrate, stella */
  var DUR_OPEN = 560, DUR_CLOSE = 420;

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
  function mixLch(a, b, t, boost) { var A = toLch(a), B = toLch(b), dh = B[2] - A[2]; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI; return fromLch([A[0] + (B[0] - A[0]) * t, (A[1] + (B[1] - A[1]) * t) * (boost || 1), A[2] + dh * t]); }
  /* stessa tinta di un colore, con luminosità e croma scelte: serve allo sfondo nei due temi */
  function tone(rgb, L, C) { var c = toLch(toLab(rgb)); return toRgb(fromLch([L, C, c[2]])); }

  /* altezza del Sole (gradi) → zenit, mezzo cielo, orizzonte. I toni restano abbastanza profondi da reggere il testo bianco. */
  /* ultime due colonne: il bagliore all'orizzonte (colore e forza) */
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

  /* ---------------------------------------------------------------- città */
  var ORDER = ["gaza", "torino", "medina", "makkah", "casablanca"];
  var CITIES = ORDER.map(function (id) { return D.cities.filter(function (c) { return c.id === id; })[0]; });
  var TORINO = CITIES[1], GAZA = CITIES[0];
  function cityState(c, d) {
    var s = A.sun(d, c.lat, c.lon), alt = s.altitude, part = A.dayPart(alt), label = part;
    var rising = A.sun(new Date(d.getTime() + 600000), c.lat, c.lon).altitude > alt;
    if (part === "alba/tramonto") label = rising ? "alba" : "tramonto";
    else if (part === "crepuscolo") label = rising ? "aurora" : "crepuscolo";
    return { alt: alt, az: s.azimuth, label: label, rising: rising, gx: rising ? 20 : 80, sky: skyAt(alt), time: A.localTime(d, c.tz) };
  }
  /* dove si trova il Sole nel suo percorso: di giorno 0..1 dall'alba al tramonto, di notte 0..1 dal tramonto all'alba */
  function sunTrack(c, d) {
    var t = A.sunTimes(d, c.lat, c.lon, c.tz), n = d.getTime(), day = null, night = null;
    if (t.sunrise && t.sunset) {
      var a = t.sunrise.getTime(), b = t.sunset.getTime();
      if (n >= a && n <= b) day = (n - a) / (b - a);
      else if (n > b) night = (n - b) / (a + 86400000 - b);
      else night = (n - (b - 86400000)) / (a - (b - 86400000));
    } else night = 0.5;
    return { day: day, night: night == null ? null : clamp(night, 0, 1) };
  }
  /* 34×16: l'orizzonte, l'arco del giorno e il Sole dov'è adesso (di notte passa sotto l'orizzonte) */
  function miniArc(tr) {
    var h = '<svg viewBox="0 0 34 16" aria-hidden="true" focusable="false"><g fill="none" stroke="#fff" stroke-linecap="round">' +
      '<path d="M0 11.5H34" stroke-width="1" opacity=".32"/><path d="M4 11.5A13 9.5 0 0 1 30 11.5" stroke-width="1" opacity=".4"/>', x, y;
    if (tr.day != null) {
      x = 17 - 13 * Math.cos(Math.PI * tr.day); y = 11.5 - 9.5 * Math.sin(Math.PI * tr.day);
      h += '<path d="M4 11.5A13 9.5 0 0 1 30 11.5" pathLength="1" stroke-dasharray="' + tr.day.toFixed(3) + ' 2" stroke-width="1.3" opacity=".95"/></g>' +
        '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4.6" fill="#fff" opacity=".22"/><circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="2.2" fill="#fff"/>';
    } else {
      x = 30 - 26 * tr.night; y = 11.5 + 3.4 * Math.sin(Math.PI * tr.night);
      h += '</g><circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="1.7" fill="#fff" opacity=".6"/>';
    }
    return h + "</svg>";
  }
  function timeHTML(t) { return t.slice(0, 2) + '<i class="colon">:</i>' + t.slice(3); }
  var WINDS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  function wind(b) { return WINDS[Math.round(b / 22.5) % 16]; }
  var fmtInt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

  /* ---------------------------------------------------------------- saluti: stelle con seme fisso */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var GREET = (function () { var r = rng(20261111), a = []; for (var i = 0; i < D.sampleStars; i++) a.push({ u: r(), v: r(), m: r(), p: r() }); return a; })();
  var mine = store("imad.saluto") || null;      /* { i, x, y } */
  if (mine && !(D.greetings[mine.i])) mine = null;
  function greetCount() { return D.sampleStars + (mine ? 1 : 0); }
  function paintCount() { var n = String(greetCount()); $$(".js-count").forEach(function (e) { e.textContent = n; }); }

  /* stelle dei saluti in un rettangolo (hero, intro, pagina dei saluti): posizioni in percentuale, raggi in px */
  function starField(vis, o) {
    o = o || {};
    var h = '<svg aria-hidden="true" focusable="false">', tw = "", k = o.scale || 1, twN = 0;
    for (var i = 0; i < GREET.length; i++) {
      var g = GREET[i], x = 2 + g.u * 96, y = 3 + Math.pow(g.v, o.pow || 1.3) * (o.depth || 88);
      var fade = 1 - 0.7 * Math.pow(y / 100, 1.6);
      var r = (0.34 + Math.pow(g.m, 3) * 0.95) * k, op = Math.min(1, (0.2 + 0.7 * g.p * g.p + 0.22 * g.m) * vis * fade);
      h += '<circle cx="' + x.toFixed(2) + '%" cy="' + y.toFixed(2) + '%" r="' + r.toFixed(2) + '" fill="' + (g.p > 0.8 ? "#ffe9bd" : g.u > 0.72 ? "#e4eaff" : "#fff6e0") + '" opacity="' + op.toFixed(2) + '"/>';
      if (g.m > 0.78 && y < 62 && twN < 9 && vis > 0.3) { twN++; tw += '<i class="tw" style="left:' + x.toFixed(2) + "%;top:" + y.toFixed(2) + "%;--d:" + (2.8 + g.p * 2.6).toFixed(2) + "s;--dl:-" + (g.u * 4).toFixed(2) + 's"></i>'; }
    }
    if (mine && o.mine !== false && !o.words) {
      h += '<circle cx="' + (mine.x * 100).toFixed(2) + '%" cy="' + (o.mineY != null ? o.mineY : 8 + mine.y * 44).toFixed(2) + '%" r="' + (2.1 * k).toFixed(2) + '" fill="#fff6dc"/>' +
        '<circle cx="' + (mine.x * 100).toFixed(2) + '%" cy="' + (o.mineY != null ? o.mineY : 8 + mine.y * 44).toFixed(2) + '%" r="' + (5.2 * k).toFixed(2) + '" fill="#f3dfa8" opacity=".22"/>';
    }
    return h + "</svg>" + tw + (o.words ? myStar() + wordStars() : "");
  }
  function starVis(alt) { return clamp((7 - alt) / 15, 0.42, 1); }
  /* alcune stelle-saluto portano la loro parola (ciao, salam, hola…): le posizioni sono nel CSS */
  var wordIdx = [0, 1, 4];
  /* la stella di chi ha lasciato un saluto da questo telefono: dorata, con la sua parola, in una zona libera del cielo dell'hero */
  function myStar() {
    if (!mine) return "";
    var g = D.greetings[mine.i];
    return '<span class="gw gw--me" style="--mx:' + mine.x.toFixed(3) + ";--my:" + mine.y.toFixed(3) + '"><i></i><b lang="' + esc(g.lang) + '">' + esc(g.text) + "</b></span>";
  }
  function wordStars() {
    return wordIdx.map(function (gi, j) {
      var g = D.greetings[gi % D.greetings.length];
      return '<span class="gw gw--' + (j + 1) + (j ? " gw--l" : "") + '" style="--d:' + (4 + j * 0.9).toFixed(1) + "s;--dl:-" + (j * 1.3).toFixed(1) + 's"><i></i><b lang="' + esc(g.lang) + '">' + esc(g.text) + "</b></span>";
    }).join("");
  }

  /* ---------------------------------------------------------------- volta celeste (mappa zenitale: N in alto, E a sinistra) */
  var uid = 0;
  function domeSVG(d, big) {
    var id = "d" + (++uid), R = 100;
    var sun = A.sun(d, TORINO.lat, TORINO.lon), sk = skyAt(sun.altitude), moon = A.moon(d, TORINO.lat, TORINO.lon);
    var night = clamp((-sun.altitude - 1) / 9, 0, 1), sv = 0.3 + 0.7 * night;
    function P(alt, az) { var r = (90 - alt) / 90 * R, a = az * RAD; return [-r * Math.sin(a), -r * Math.cos(a)]; }
    var sp = P(Math.max(sun.altitude, -3), sun.azimuth);
    var glow = clamp(1 - Math.abs(sun.altitude + 1) / 12, 0, 1) * 0.95, day = clamp((sun.altitude - 2) / 10, 0, 1);
    var edge = toRgb(mixLab(toLab(sk.zen), toLab(sk.mid), 0.85));
    var h = '<svg viewBox="-106 -106 212 212" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="' + id + 'a" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100"><stop offset="0" stop-color="' + css(sk.zen) + '"/><stop offset="1" stop-color="' + css(edge) + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'b" gradientUnits="userSpaceOnUse" cx="' + sp[0].toFixed(1) + '" cy="' + sp[1].toFixed(1) + '" r="150"><stop offset="0" stop-color="' + css(sk.hor) + '" stop-opacity="' + glow.toFixed(2) + '"/><stop offset=".45" stop-color="' + css(sk.hor) + '" stop-opacity="' + (glow * 0.42).toFixed(2) + '"/><stop offset="1" stop-color="' + css(sk.hor) + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'c" gradientUnits="userSpaceOnUse" cx="' + sp[0].toFixed(1) + '" cy="' + sp[1].toFixed(1) + '" r="70"><stop offset="0" stop-color="#fff" stop-opacity="' + (0.55 * day).toFixed(2) + '"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="' + id + 'k"><circle r="100"/></clipPath></defs>' +
      '<circle r="100" fill="url(#' + id + 'a)"/>' +
      '<g clip-path="url(#' + id + 'k)"><rect x="-106" y="-106" width="212" height="212" fill="url(#' + id + 'b)"/><rect x="-106" y="-106" width="212" height="212" fill="url(#' + id + 'c)"/></g>' +
      '<g fill="none" stroke="#fff" stroke-width=".7"><circle r="66.7" opacity=".09"/><circle r="33.3" opacity=".09"/><path d="M-100 0H100M0-100V100" opacity=".07"/><circle r="100" opacity=".3" stroke-width="1"/></g>';
    /* tacche dei punti cardinali */
    h += '<g stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".6"><path d="M0-100v7M100 0h-5M0 100v-5M-100 0h5"/></g>';
    /* le scritte della volta grande sono elementi HTML sopra il disegno: restano a 12 px qualunque sia la sua misura */
    var labels = "", named = [], boxes = [], pts = [];
    function lab(x, y, t, side) { labels += '<span class="dl dl--' + side + '" style="left:' + ((x + 106) / 2.12).toFixed(2) + "%;top:" + ((y + 106) / 2.12).toFixed(2) + '%">' + esc(t) + "</span>"; }
    /* i saluti: stelle dorate, ferme nella volta */
    h += '<g fill="#f3dfa8">';
    for (var i = 0; i < GREET.length; i++) {
      var g = GREET[i], rr = Math.sqrt(g.u) * 95, th = g.v * Math.PI * 2;
      h += '<circle cx="' + (rr * Math.cos(th)).toFixed(1) + '" cy="' + (rr * Math.sin(th)).toFixed(1) + '" r="' + (0.75 + g.m * 0.75).toFixed(2) + '" opacity="' + (0.34 + 0.56 * g.p).toFixed(2) + '"/>';
    }
    if (mine) { var mr = Math.sqrt(mine.y) * 70, mt = mine.x * Math.PI * 2, mx = (mr * Math.cos(mt)).toFixed(1), my = (mr * Math.sin(mt)).toFixed(1); h += '<circle cx="' + mx + '" cy="' + my + '" r="7" opacity=".22"/><circle cx="' + mx + '" cy="' + my + '" r="2.6" fill="#fff6dc"/>'; }
    h += "</g>";
    /* le stelle vere: posizione calcolata per Torino in questo istante */
    h += '<g fill="#f2f5ff">';
    D.stars.forEach(function (s) {
      var p = A.altAz(s.ra, s.dec, d, TORINO.lat, TORINO.lon); if (p.altitude <= 1) return;
      var q = P(p.altitude, p.azimuth), r = clamp(2.75 - 0.6 * s.mag, 1.05, 3.4), ext = clamp(p.altitude / 14, 0.45, 1);
      if (s.mag < 1.2) h += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (r * 2.7).toFixed(1) + '" opacity="' + (0.16 * sv * ext).toFixed(2) + '"/>';
      var dot = '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + r.toFixed(2) + '" opacity="' + (sv * ext).toFixed(2) + '"/>';
      h += s.mag < 2.1 ? '<g class="shim" style="--d:' + (3.4 + (s.ra * 7) % 3.2).toFixed(2) + "s;--dl:-" + ((Math.abs(s.dec) * 3) % 5).toFixed(2) + 's">' + dot + "</g>" : dot;
      if (r > 1.3) pts.push([q[0], q[1]]);
      if (big && s.mag < 1.3 && p.altitude > 8) named.push({ x: q[0], y: q[1], r: r, t: s.name });
    });
    h += "</g>";
    if (moon.altitude > 2) { var mq = P(moon.altitude, moon.azimuth); h += '<circle cx="' + mq[0].toFixed(1) + '" cy="' + mq[1].toFixed(1) + '" r="4" fill="#e9edf8" opacity=".92"/>'; pts.push([mq[0], mq[1]]); if (big) named.push({ x: mq[0], y: mq[1], r: 4, t: "Luna" }); }
    if (sun.altitude > -0.8) { var sq = P(Math.max(sun.altitude, 0), sun.azimuth); pts.push([sq[0], sq[1]]); h += '<circle cx="' + sq[0].toFixed(1) + '" cy="' + sq[1].toFixed(1) + '" r="11" fill="#fff" opacity=".2"/><circle cx="' + sq[0].toFixed(1) + '" cy="' + sq[1].toFixed(1) + '" r="5" fill="#fff"/>'; }
    /* ogni nome prova a destra, a sinistra, sopra e sotto la sua stella e prende il primo posto libero (dentro il cerchio,
       lontano dalle altre stelle e dagli altri nomi); se non c'è posto, quel nome non si scrive. Poi i punti cardinali, se liberi. */
    function fits(x0, y0, w, own) {
      if (Math.hypot(x0, y0) > 97 || Math.hypot(x0 + w, y0) > 97) return false;
      for (var i = 0; i < pts.length; i++) { var o = pts[i]; if (o !== own && !(own && o[0] === own.x && o[1] === own.y) && o[0] > x0 - 3 && o[0] < x0 + w + 3 && Math.abs(o[1] - y0) < 6.4) return false; }
      for (var j = 0; j < boxes.length; j++) { var b = boxes[j]; if (x0 < b[0] + b[2] + 2 && x0 + w > b[0] - 2 && Math.abs(b[1] - y0) < 8.4) return false; }
      return true;
    }
    named.forEach(function (n) {
      var w = n.t.length * 4.4 + 2, gap = n.r + 3.5;
      var tries = [["r", n.x + gap, n.y], ["l", n.x - gap - w, n.y], ["c", n.x - w / 2, n.y - n.r - 6.5], ["c", n.x - w / 2, n.y + n.r + 6.5]];
      for (var k = 0; k < tries.length; k++) {
        var side = tries[k][0], x0 = tries[k][1], y0 = tries[k][2];
        if (!fits(x0, y0, w, n)) continue;
        boxes.push([x0, y0, w]); lab(side === "r" ? x0 : side === "l" ? x0 + w : x0 + w / 2, y0, n.t, side); break;
      }
    });
    if (big) [["N", 0, -85], ["E", -86, 0], ["S", 0, 86], ["O", 86, 0]].forEach(function (c) { if (fits(c[1] - 4, c[2], 8, null)) lab(c[1], c[2], c[0], "k"); });
    return h + "</svg>" + labels;
  }

  /* ---------------------------------------------------------------- riferimenti al DOM */
  var home = $("#home"), grid = $("#grid"), bar = $("#bar"), hero = $("#hero"), heroSky = $("#heroSky"), heroText = $("#heroText");
  var citiesEl = $("#cities"), domeEl = $("#dome"), pv = $("#pv");

  function layout() {
    var cs = getComputedStyle(root), cols = parseInt(cs.getPropertyValue("--cols"), 10) || 4;
    var gap = parseFloat(cs.getPropertyValue("--gap")) || 12, gut = parseFloat(cs.getPropertyValue("--gutter")) || 16;
    var max = cols === 4 ? 98 : cols === 8 ? 92 : 85.34;
    var cell = Math.min(max, (home.clientWidth - 2 * gut - (cols - 1) * gap) / cols);
    root.style.setProperty("--cell", (Math.floor(cell * 100) / 100) + "px");
  }

  /* ---------------------------------------------------------------- contenuti vivi dei riquadri */
  /* Versetto di oggi: uno al giorno, tra i versetti brevi che stanno nel riquadro senza essere mai tagliati. */
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

  function buildCities() {
    citiesEl.innerHTML = CITIES.map(function (c) {
      return '<li class="city" data-city="' + c.id + '"><span class="city__r"><span class="city__name">' + esc(c.name) + '</span><i class="city__arc"></i></span><span class="city__r"><span class="city__part"></span><time class="city__time num"></time></span></li>';
    }).join("");
  }
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
  function paintCodeOut(d) { var e = $("#codeOut"); if (e) e.textContent = (((A.lstHours(d, TORINO.lon) / 24) % 1) * 360).toFixed(1).replace(".", ",") + "°"; }
  var lastMinute = "";
  function paintLive(d, force) {
    var minute = A.localTime(d, "Europe/Rome");
    if (!force && minute === lastMinute) return;
    lastMinute = minute;
    var tor = null;
    $$(".city", citiesEl).forEach(function (li, i) {
      var c = CITIES[i], st = cityState(c, d); if (i === 1) tor = st;
      setSky(li, st.sky, st.gx, 0.5);
      $(".city__arc", li).innerHTML = miniArc(sunTrack(c, d));
      $(".city__part", li).textContent = st.label; $(".city__time", li).innerHTML = timeHTML(st.time);
      if (i === 0) { $(".js-gaza").innerHTML = timeHTML(st.time); setSky($(".js-gazadot"), st.sky, st.gx, 0.6); }
    });
    /* cielo di Torino: hero, logo, sfondo, volta, riga in fondo alla pagina */
    setSky(heroSky, tor.sky, 97);
    var rs = root.style;
    rs.setProperty("--sky-zen", css(tor.sky.zen)); rs.setProperty("--sky-mid", css(tor.sky.mid)); rs.setProperty("--sky-rose", css(tor.sky.rose)); rs.setProperty("--sky-hor", css(tor.sky.hor));
    rs.setProperty("--sky-glow", rgba(tor.sky.glow, tor.sky.ga)); rs.setProperty("--sky-gx", tor.gx + "%");
    paintWall(tor);
    heroSky.innerHTML = starField(starVis(tor.alt), { words: true });
    domeEl.innerHTML = domeSVG(d, false);
    $(".js-moon").innerHTML = moonSVG(A.moonPhase(d), 18);
    $(".js-tortime").textContent = tor.time; $(".js-torpart").textContent = tor.label; setSky($(".js-tordot"), tor.sky, tor.gx, 0.6);
    paintCodeOut(d);
  }

  function buildMarquee() {
    var one = D.greetings.map(function (g) { return '<span lang="' + esc(g.lang) + '">' + esc(g.text) + "</span>"; }).join("");
    $("#marq").innerHTML = one + one;
  }

  /* — codice: la funzione vera, colorata e battuta a macchina */
  function tokenize(src) {
    var out = [], re = /(\/\/[^\n]*)|\b(export|function|const|return)\b|\b(Date|number|Math|PI)\b|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z0-9_$]+)/g, m;
    while ((m = re.exec(src))) out.push([m[0], m[1] ? "c" : m[2] ? "k" : m[3] ? "t" : m[4] ? "n" : m[5] ? "f" : m[8] ? "p" : ""]);
    return out;
  }
  var CODE_TOK = tokenize(D.code);
  /* ogni riga del sorgente è un blocco: così, dove il codice va a capo, il rientro resta giusto riga per riga */
  function codeHTML(n, caret) {
    var h = '<span class="ln">', left = n;
    for (var i = 0; i < CODE_TOK.length && left > 0; i++) {
      var s = CODE_TOK[i][0].slice(0, left), cls = CODE_TOK[i][1]; left -= s.length;
      s.split("\n").forEach(function (part, j) {
        if (j) h += '</span><span class="ln">';
        if (part) h += cls ? '<span class="tk-' + cls + '">' + esc(part) + "</span>" : esc(part);
      });
    }
    return h + (caret ? '<i class="caret"></i>' : "") + "</span>";
  }
  var codeEl = $("#code"), codeTimer = 0, codeStarted = false;
  function followCaret() {
    var pre = codeEl.parentNode, c = $(".caret", codeEl); if (!c) return;
    var over = c.offsetLeft - (pre.clientWidth - 46);
    codeEl.style.transform = over > 0 ? "translateX(" + (-Math.round(over)) + "px)" : "";
  }
  function typeCode() {
    if (codeStarted) return; codeStarted = true;
    var n = 0, total = D.code.length;
    (function step() {
      n++; codeEl.innerHTML = codeHTML(n, true); followCaret();
      if (n < total) { var ch = D.code.charAt(n - 1); codeTimer = setTimeout(step, ch === "\n" ? 320 : ch === " " ? 30 : 26 + Math.random() * 52); }
      else { codeEl.style.transform = ""; codeTimer = setTimeout(function () { codeStarted = false; codeEl.innerHTML = '<span class="ln"><i class="caret"></i></span>'; typeCode(); }, 22000); }
    })();
  }
  function paintCodeStatic() { codeEl.innerHTML = codeHTML(D.code.length, true); codeEl.style.transform = ""; }

  /* — curiosità: una alla volta */
  var curEl = $("#curio"), curBar = $("#curioBar"), curI = 0, curAnim = null, CUR_MS = 9500;
  function curHTML(c) { return '<h2 class="title">' + esc(c.title) + '</h2><p class="curio__text">' + esc(c.text) + "</p>"; }
  function curCount() { $("#curioN").textContent = (curI + 1) + "/" + D.curiosities.length; }
  function cycleCur() {
    if (SHOT || reduced()) return;
    if (curAnim) curAnim.cancel();
    curAnim = curBar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: CUR_MS, easing: "linear", fill: "forwards" });
    curAnim.onfinish = function () {
      curI = (curI + 1) % D.curiosities.length;
      var out = curEl.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-5px)" }], { duration: 170, easing: "ease-in", fill: "forwards" });
      out.onfinish = function () {
        curEl.innerHTML = curHTML(D.curiosities[curI]); curCount(); out.cancel();
        curEl.animate([{ opacity: 0, transform: "translateY(7px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: EASE_OUT });
        cycleCur();
      };
    };
  }

  /* ---------------------------------------------------------------- cubo: CSS 3D, matrice di rotazione, inerzia */
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function mul(a, b) { var o = []; for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) o.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]); return o; }
  function ortho(m) { /* Gram-Schmidt, per non accumulare errori */
    var x = [m[0], m[3], m[6]], y = [m[1], m[4], m[7]];
    var nx = Math.hypot(x[0], x[1], x[2]); x = [x[0] / nx, x[1] / nx, x[2] / nx];
    var dt = x[0] * y[0] + x[1] * y[1] + x[2] * y[2]; y = [y[0] - dt * x[0], y[1] - dt * x[1], y[2] - dt * x[2]];
    var ny = Math.hypot(y[0], y[1], y[2]); y = [y[0] / ny, y[1] / ny, y[2] / ny];
    var z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  }
  var FACES = [["F", "translateZ", [0, 0, 1]], ["B", "rotateY(180deg) translateZ", [0, 0, -1]], ["R", "rotateY(90deg) translateZ", [1, 0, 0]], ["L", "rotateY(-90deg) translateZ", [-1, 0, 0]], ["U", "rotateX(90deg) translateZ", [0, -1, 0]], ["D", "rotateX(-90deg) translateZ", [0, 1, 0]]];
  var LIGHT = (function () { var v = [-0.3, -0.76, 0.58], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
  function makeCube(stage, onTap) {
    var cube = doc.createElement("div"); cube.className = "cube"; cube.style.setProperty("--plastic", D.cube.plastic);
    var faces = FACES.map(function (f) {
      var el = doc.createElement("div"); el.className = "cube__f"; el.style.transform = f[1] + "(calc(var(--s) / 2))"; el.style.setProperty("--c", D.cube[f[0]]);
      el.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>"; cube.appendChild(el); return el;
    });
    var fl = doc.createElement("div"); fl.className = "cube-float"; fl.appendChild(cube);
    var ground = doc.createElement("i"); ground.className = "cube-shadow";
    stage.appendChild(ground); stage.appendChild(fl);
    var M = mul(rotX(-0.5), rotY(-0.68)), vx = 0, vy = 0, drag = null, raf = 0, last = 0, alive = true, visible = true;
    var idle = !(SHOT || reduced());
    function apply() {
      cube.style.transform = "matrix3d(" + [M[0], M[3], M[6], 0, M[1], M[4], M[7], 0, M[2], M[5], M[8], 0, 0, 0, 0, 1].map(function (v) { return v.toFixed(5); }).join(",") + ")";
      for (var i = 0; i < 6; i++) { var n = FACES[i][2], w = [M[0] * n[0] + M[1] * n[1] + M[2] * n[2], M[3] * n[0] + M[4] * n[1] + M[5] * n[2], M[6] * n[0] + M[7] * n[1] + M[8] * n[2]]; var lit = Math.max(0, w[0] * LIGHT[0] + w[1] * LIGHT[1] + w[2] * LIGHT[2]); faces[i].style.setProperty("--shade", ((1 - lit) * 0.24).toFixed(3)); faces[i].style.setProperty("--hl", clamp(Math.pow(lit, 2.6) * 1.15, 0, 0.9).toFixed(3)); }
    }
    function frame(t) {
      raf = 0; if (!alive) return;
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (!drag) {
        var sp = idle ? 0.42 : 0;
        M = mul(rotY((sp + vy) * dt), mul(rotX((sp * 0.24 + vx) * dt), M));
        vx *= Math.pow(0.08, dt); vy *= Math.pow(0.08, dt);
        if (Math.abs(vx) < 0.01) vx = 0; if (Math.abs(vy) < 0.01) vy = 0;
        M = ortho(M); apply();
      }
      if (visible && (idle || drag || vx || vy)) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && alive) { last = 0; raf = requestAnimationFrame(frame); } }
    function down(e) { if (e.button) return; drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), t0: performance.now(), moved: false }; vx = vy = 0; try { stage.setPointerCapture(e.pointerId); } catch (er) { } }
    function move(e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, t = performance.now(), dt = Math.max(1, t - drag.t) / 1000;
      if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 6) drag.moved = true;
      M = ortho(mul(rotY(dx * 0.014), mul(rotX(-dy * 0.014), M))); apply();
      vy = clamp(dx * 0.014 / dt, -9, 9); vx = clamp(-dy * 0.014 / dt, -9, 9);
      drag.x = e.clientX; drag.y = e.clientY; drag.t = t;
    }
    function up(e) {
      if (!drag) return; var d = drag; drag = null;
      if (performance.now() - d.t > 90) vx = vy = 0;
      if (!d.moved && performance.now() - d.t0 < 500 && onTap) onTap(e);
      kick();
    }
    stage.addEventListener("pointerdown", down); stage.addEventListener("pointermove", move); stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", function () { drag = null; kick(); });
    var io = null;
    if ("IntersectionObserver" in window) { io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }); io.observe(stage); }
    apply(); kick();
    return { destroy: function () { alive = false; if (raf) cancelAnimationFrame(raf); if (io) io.disconnect(); } };
  }

  /* ---------------------------------------------------------------- suoni (spenti finché non li accendi) */
  var Snd = (function () {
    var on = false, ctx = null;
    function ac() { if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } } if (ctx.state === "suspended") ctx.resume(); return ctx; }
    function tone(f, at, dur, g) { var c = ac(); if (!c) return; var o = c.createOscillator(), a = c.createGain(), t = c.currentTime + at; o.type = "sine"; o.frequency.setValueAtTime(f, t); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + dur + 0.03); }
    var bank = { open: [[523.25, 0, 0.16, 0.05], [783.99, 0.055, 0.22, 0.045]], close: [[783.99, 0, 0.12, 0.04], [523.25, 0.05, 0.2, 0.045]], tap: [[880, 0, 0.07, 0.03]], star: [[1318.5, 0, 0.9, 0.05], [1975.5, 0.09, 1.1, 0.03], [2637, 0.2, 1.2, 0.016]] };
    return {
      toggle: function () { on = !on; if (on) this.play("tap"); return on; },
      play: function (n) { if (!on || !bank[n]) return; try { bank[n].forEach(function (p) { tone(p[0], p[1], p[2], p[3]); }); } catch (e) { } }
    };
  })();

  /* ---------------------------------------------------------------- pagine aperte */
  var sheetEl = $("#sheet"), card = $("#sheetCard"), bg = $("#sheetBg"), body = $("#sheetBody"), scrim = $("#sheetScrim"), closeBtn = $("#sheetClose"), grab = $(".sheet__grab");
  var S = { open: null, src: null, pushed: false, busy: false, cleanup: null, tick: null, anims: [] };
  function track(a) { S.anims.push(a); return a; }
  function dropAnims() { S.anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); S.anims = []; }
  function soon(text) { return '<div class="s-soon"><p><b>In arrivo:</b> ' + esc(text) + "</p></div>"; }

  /* striscia panoramica: i cinque cieli da ovest a est, sfumati l'uno nell'altro */
  var WEST_EAST = ["casablanca", "torino", "gaza", "medina", "makkah"].map(function (id) { return D.cities.filter(function (c) { return c.id === id; })[0]; });
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

  function moonSVG(mp, size) {
    var r = 18, k = mp.fraction, rx = (r * Math.abs(1 - 2 * k)).toFixed(2);
    var lit = "M0 -" + r + "A" + r + " " + r + " 0 0 1 0 " + r + "A" + rx + " " + r + " 0 0 " + (k < 0.5 ? 0 : 1) + " 0 -" + r + "Z";
    return '<svg width="' + size + '" height="' + size + '" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false"><circle r="20" fill="#141b44"/><circle r="17.4" fill="#333c78"/><path d="' + lit + '" fill="#fff3d6" stroke="#fff3d6" stroke-width="' + (size < 30 ? 2.4 : 1) + '" stroke-linejoin="round"' + (mp.waxing ? "" : ' transform="scale(-1 1)"') + "/></svg>";
  }
  function arcSVG(c, d, st) {
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

  var PAGES = {
    citta: {
      mat: "page",
      build: function (el) {
        var d = now(), mp = A.moonPhase(d), pct = Math.round(mp.fraction * 100);
        var h = '<div class="s-wrap"><h2 class="s-title" id="sheetTitle" tabindex="-1">Le città, adesso</h2>' +
          '<p class="s-sub">Cinque città. Un solo cielo.</p>' + panoHTML(d) +
          '<p class="s-cap">' + esc(cap(A.localDate(d, "Europe/Rome"))) + ". Ogni riquadro ha il colore del cielo che c’è lì adesso. Le ore di differenza sono rispetto a Torino.</p>" +
          '<div class="moon lit">' + moonSVG(mp, 44) + "<div><b>" + esc(cap(mp.name)) + ", illuminata al " + (pct < 1 ? "meno dell’1" : pct) + "%</b><span>È la stessa in ogni città: cambia solo l’inclinazione.</span></div></div>" +
          '<ul class="cl">';
        CITIES.forEach(function (c) {
          var st = cityState(c, d), arc = arcSVG(c, d, st), off = offText(c, d);
          h += '<li class="cc" data-city="' + c.id + '" style="' + skyStyle(st.sky, st.gx, 0.55) + '">' +
            '<div class="cc__top"><div><h3 class="cc__name">' + esc(c.name) + '<span class="cc__ar" lang="ar" dir="rtl"></span></h3><p class="cc__meta">' + esc(c.country) + (off ? "<br>" + esc(off) : "") + "</p></div>" +
            '<div><time class="cc__time num"></time><p class="cc__meta fact--r js-part">' + esc(st.label) + "</p></div></div>" +
            '<div class="cc__sun"><p class="fact">Alba<b class="num">' + arc.rise + "</b></p>" + arc.html + '<p class="fact fact--r">Tramonto<b class="num">' + arc.set + "</b></p></div>" +
            qiblaRow(c) + "</li>";
        });
        el.innerHTML = h + "</ul></div>";
        $$(".cc", el).forEach(function (li, i) { $(".cc__ar", li).textContent = CITIES[i].ar; });
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
        var h = '<div class="s-wrap sal"><div class="sal__top"><p class="sal__n num" id="salN"><span>' + greetCount() + '</span></p><p class="sal__nl"><i class="stardot"></i>saluti nel cielo</p></div>' +
          '<h2 class="s-title" id="sheetTitle" tabindex="-1">Lascia un saluto</h2><p class="s-sub">Diventa una stella nel cielo di Imad.</p>' +
          '<div class="sal__chips" role="group" aria-label="Scegli un saluto">' +
          D.greetings.map(function (g, i) { return '<button class="gchip" type="button" data-i="' + i + '" lang="' + esc(g.lang) + '" aria-pressed="' + (mine && mine.i === i ? "true" : "false") + '" aria-label="' + esc(g.text) + ", " + esc(g.label) + '">' + esc(g.text) + "</button>"; }).join("") +
          '</div><p class="sal__note" id="salNote" aria-live="polite"></p></div>';
        el.innerHTML = h;
        var sky = doc.createElement("div"); sky.className = "sal__sky"; sky.innerHTML = starField(1, { mine: false, scale: 1.25, depth: 25, pow: 0.9 }); card.insertBefore(sky, body);
        var star = doc.createElement("div"); star.className = "mystar"; star.innerHTML = "<u></u><i></i><em></em>"; star.hidden = true; card.insertBefore(star, body);
        var note = $("#salNote", el), nEl = $("#salN", el);
        function place() { if (!mine) { star.hidden = true; return; } var r = card.getBoundingClientRect(); star.hidden = false; star.style.left = (mine.x * r.width) + "px"; star.style.top = (r.height * (0.07 + mine.y * 0.17)) + "px"; $("em", star).textContent = D.greetings[mine.i].text; $("em", star).lang = D.greetings[mine.i].lang; }
        function say() {
          note.innerHTML = mine ? "Il tuo saluto resta su questo telefono, in questa anteprima. Puoi cambiarlo, oppure <button type=\"button\" id=\"salUndo\">toglierlo</button>." : "Scegli un saluto: la tua stella si accende tra le altre.";
        }
        function bump(n) {
          var old = nEl.firstChild, nu = doc.createElement("span"); nu.textContent = n;
          if (SHOT || reduced()) { nEl.replaceChild(nu, old); return; }
          nEl.style.width = nEl.offsetWidth + "px"; old.style.position = "absolute"; old.style.left = ".06em"; nEl.appendChild(nu);
          old.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-60%)", opacity: 0 }], { duration: 260, easing: "ease-in", fill: "forwards" }).onfinish = function () { if (old.parentNode) nEl.removeChild(old); nEl.style.width = ""; };
          nu.animate([{ transform: "translateY(60%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, easing: SPRING_POP });
        }
        function pulse() { var u = $("u", star); u.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(2.6)" }], { duration: 900, easing: EASE_OUT }); $("i", star).animate([{ transform: "scale(2.2)" }, { transform: "scale(1)" }], { duration: 700, easing: SPRING_POP }); }
        function choose(btn) {
          var i = +btn.getAttribute("data-i"), first = !mine, r = rng(Date.now() & 0xffff);
          $$(".gchip", el).forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
          mine = { i: i, x: mine ? mine.x : 0.2 + r() * 0.6, y: mine ? mine.y : 0.15 + r() * 0.7 };
          store("imad.saluto", mine);
          var from = btn.getBoundingClientRect(); place(); var to = star.getBoundingClientRect();
          function land() { $("em", star).style.opacity = ""; pulse(); Snd.play("star"); if (first) { bump(greetCount()); paintCount(); } say(); paintLive(now(), true); }
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
          if (e.target.id === "salUndo") { mine = null; store("imad.saluto", null); $$(".gchip", el).forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); place(); bump(greetCount()); paintCount(); say(); paintLive(now(), true); }
        });
        place(); say();
        return function () { if (sky.parentNode) sky.parentNode.removeChild(sky); if (star.parentNode) star.parentNode.removeChild(star); };
      }
    },

    corano: {
      mat: "paper", cls: "is-reader",
      build: function (el) {
        var keys = [HOME_VERSE.key, "55:5", "37:6", "16:16", "86:1-3"].filter(function (k, i, a) { return a.indexOf(k) === i; }).slice(0, 4), vs = keys.map(function (k) { return D.verses.filter(function (v) { return v.key === k; })[0]; }).filter(Boolean);
        var h = '<div class="qr"><h2 class="qr__h" id="sheetTitle" tabindex="-1">Corano</h2><div class="qr__pager" id="qrPager" tabindex="0" role="group" aria-label="Versetti: scorri in orizzontale">';
        vs.forEach(function (v, i) {
          h += '<section class="qr__page" aria-label="Versetto ' + (i + 1) + " di " + vs.length + '"><div>' + (i === 0 ? '<p class="qr__k">Versetto di oggi</p>' : "") + '<p class="ayah ayah--lg" lang="ar" dir="rtl"></p><p class="qr__it">' + esc(v.it) + '</p><p class="qr__ref">' + esc(v.surahName) + ' <span class="num">' + esc(v.key) + '</span></p><p class="qr__tr">trad. Hamza Roberto Piccardo</p>' +
            '<a class="qr__src" href="' + esc(v.source) + '" target="_blank" rel="noopener">leggi su quran.com<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16l8-8"/><path d="M9.5 8H16v6.5"/></svg></a></div></section>';
        });
        h += '</div><div class="qr__nav"><button class="iconbtn" type="button" id="qrPrev" aria-label="Versetto precedente"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6.5L8.5 12l5.5 5.5"/></svg></button>' +
          '<span class="qr__dots" aria-hidden="true">' + vs.map(function () { return "<i></i>"; }).join("") + "</span>" +
          '<button class="iconbtn" type="button" id="qrNext" aria-label="Versetto successivo"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5l5.5 5.5-5.5 5.5"/></svg></button></div></div>';
        el.innerHTML = h;
        $$(".ayah", el).forEach(function (p, i) { p.textContent = vs[i].ar; });        /* testo arabo: solo dal dato */
        var pager = $("#qrPager", el), dots = $$(".qr__dots i", el), prev = $("#qrPrev", el), next = $("#qrNext", el), cur = -1;
        function idx() { return clamp(Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)), 0, vs.length - 1); }
        function mark() { var i = idx(); if (i === cur) return; cur = i; dots.forEach(function (d, j) { d.className = j === i ? "on" : ""; }); prev.disabled = i === 0; next.disabled = i === vs.length - 1; }
        function go(i) { pager.scrollTo({ left: clamp(i, 0, vs.length - 1) * pager.clientWidth, behavior: reduced() || SHOT ? "auto" : "smooth" }); }
        pager.addEventListener("scroll", mark, { passive: true });
        prev.addEventListener("click", function () { go(idx() - 1); }); next.addEventListener("click", function () { go(idx() + 1); });
        pager.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { go(idx() + 1); e.preventDefault(); } if (e.key === "ArrowLeft") { go(idx() - 1); e.preventDefault(); } });
        mark();
      }
    },

    cielo: {
      mat: "night", dark: true,
      build: function (el) {
        var d = now();
        el.innerHTML = '<div class="s-wrap"><h2 class="s-title" id="sheetTitle" tabindex="-1">Il cielo sopra Torino</h2><p class="s-sub">Adesso, alle ' + A.localTime(d, TORINO.tz) + ". Le stelle sono dove sono davvero; il nord è in alto.</p>" +
          '<div class="domebig" id="domeBig">' + domeSVG(d, true) + '</div><p class="legend"><span><i></i>stelle vere, con i loro nomi</span><span><i class="g"></i><span><b class="js-count num">' + greetCount() + "</b> saluti nel cielo di Imad</span></span></p>" +
          soon("l’astrolabio, per far girare il cielo e viaggiare nel tempo.") + "</div>";
      }
    },

    palestina: {
      mat: "olive", dark: true,
      build: function (el) {
        var d = now(), st = cityState(GAZA, d);
        el.innerHTML = '<div class="s-wrap"><i class="palmark" aria-hidden="true"><i></i><i></i><i></i><i></i></i><h2 class="palbig" id="sheetTitle" tabindex="-1">Palestina</h2><p class="s-sub">Presto, con le parole di Imad.</p>' +
          '<p class="palnow"><i class="skydot" style="' + skyStyle(st.sky, st.gx, 0.6) + '"></i><span>A Gaza sono le <time id="palT">' + st.time + "</time></span></p>" +
          soon("un testo scritto da Imad.") + "</div>";
        S.tick = function (dd) { var t = $("#palT", el); if (t) t.textContent = A.localTime(dd, GAZA.tz); };
      }
    },

    sudime: {
      mat: "page",
      build: function (el) {
        el.innerHTML = '<div class="s-wrap"><div class="mebig"><span class="avatar" aria-hidden="true">i</span><h2 class="s-title" id="sheetTitle" tabindex="-1">Imad</h2></div>' +
          '<p class="s-sub" style="margin-top:18px">Coding, Corano, stelle, un cubo di Rubik, Torino, Palestina.</p>' +
          '<p style="margin-top:22px"><a class="btn btn--lg" href="#" data-nolink>Instagram<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16l8-8"/><path d="M9.5 8H16v6.5"/></svg></a></p>' +
          soon("qualche riga scritta da Imad.") + "</div>";
      }
    },

    codice: {
      mat: "ink", dark: true,
      build: function (el) {
        el.innerHTML = '<div class="s-wrap"><h2 class="s-title" id="sheetTitle" tabindex="-1">Il codice del cielo</h2><p class="s-sub">La funzione vera che decide di quanto gira il cielo di questo sito.</p>' +
          '<pre class="codebig"><code>' + codeHTML(D.code.length, false) + '</code></pre>' +
          '<div class="run"><span>reteAngle(adesso, <span class="num">7.6869</span>) per Torino</span><b class="num" id="runV"></b></div>' +
          soon("come è fatto questo sito, pezzo per pezzo.") + "</div>";
        function run(dd) { var giri = A.lstHours(dd, TORINO.lon) / 24, ang = (giri % 1) * 2 * Math.PI; $("#runV", el).textContent = ang.toFixed(4).replace(".", ",") + " rad, cioè " + (ang / RAD).toFixed(1).replace(".", ",") + "°"; }
        run(now()); S.tick = run;
      }
    },

    curiosita: {
      mat: "page",
      build: function (el) {
        var i = curI;
        el.innerHTML = '<div class="s-wrap"><span class="label label--clay" style="font-size:14px">Lo sapevi</span><h2 class="s-title" id="sheetTitle" tabindex="-1" style="margin-top:4px;font-size:30px"></h2><p class="cur-text" id="curT"></p>' +
          '<div class="cur-list" id="curL">' + D.curiosities.map(function (c, j) { return '<button type="button" data-j="' + j + '">' + esc(c.title) + "</button>"; }).join("") + "</div>" +
          soon("le fonti di ogni curiosità, una per una.") + "</div>";
        function show(j) { i = j; $("#sheetTitle", el).textContent = D.curiosities[j].title; $("#curT", el).textContent = D.curiosities[j].text; $$("#curL button", el).forEach(function (b, k) { if (k === j) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }); }
        el.addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("#curL button") : null; if (b) { show(+b.getAttribute("data-j")); body.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); } });
        show(i);
      }
    },

    cubo: {
      mat: "page",
      build: function (el) {
        el.innerHTML = '<div class="s-wrap"><h2 class="s-title" id="sheetTitle" tabindex="-1">Il cubo di Imad</h2><p class="s-sub">I suoi colori, in pastello. Trascinalo per girarlo.</p><div class="cubebig" id="cubeBig" aria-hidden="true"></div>' + soon("il gioco del cubo, con cronometro e tempi migliori.") + "</div>";
        var c = makeCube($("#cubeBig", el), null);
        return function () { c.destroy(); };
      }
    }
  };

  function tileFor(id) { var t = $('.tile[data-tile="' + id + '"]'); return t || null; }
  function onScreen(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }

  /* Metamorfosi di apertura, solo con transform e opacity.
     Telefono (la pagina copre lo schermo): un «fantasma» grande quanto il riquadro, con i suoi angoli, cresce in scala uniforme
     fino a coprire lo schermo (gli angoli escono dai bordi); poi il fondo vero della pagina gli si dissolve sopra.
     Tablet e computer (la pagina è una scheda al centro): il fondo della scheda cresce in scala uniforme dal centro del riquadro. */
  var ghost = $("#sheetGhost");
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

  function openSheet(id, src, o) {
    o = o || {};
    var page = PAGES[id]; if (!page || S.open || S.busy) return;
    S.open = id; S.src = src || null; S.busy = true; S.tick = null;
    card.setAttribute("data-mat", page.mat); card.className = "sheet__card" + (page.dark ? " on-dark" : "");
    body.className = "sheet__body" + (page.cls ? " " + page.cls : ""); body.innerHTML = ""; body.scrollTop = 0;
    card.style.transform = ""; card.style.opacity = "";
    sheetEl.hidden = false; root.classList.add("is-sheet", "is-locked"); home.setAttribute("inert", ""); pv.setAttribute("inert", "");
    S.cleanup = page.build(body) || null;
    if (o.push !== false) { try { history.pushState({ imadSheet: id }, "", "#" + id); S.pushed = true; } catch (e) { S.pushed = false; } } else S.pushed = !!o.pushed;
    Snd.play("open");
    function done() { S.busy = false; card.classList.add("is-open"); ghost.hidden = true; var t = $("#sheetTitle", body); try { (t || card).focus({ preventScroll: true }); } catch (e) { } }
    var from = !o.instant && onScreen(src) ? src.getBoundingClientRect() : null;
    if (o.instant) { done(); return; }
    if (reduced() || !from) {
      track(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" }));
      track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" })).onfinish = done; return;
    }
    var to = card.getBoundingClientRect(), rad = parseFloat(getComputedStyle(src).borderTopLeftRadius) || 32;
    home.style.transformOrigin = "50% " + (window.scrollY + window.innerHeight / 2) + "px";
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
    [body, closeBtn, grab].concat($$(".sal__sky, .mystar", card)).forEach(function (n) { track(n.animate([{ opacity: 0, transform: n === body ? "translateY(18px)" : "none" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 140, easing: EASE_OUT, fill: "backwards" })); });
    track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" }));
    track(home.animate([{ transform: "none" }, { transform: "scale(.955)" }], { duration: DUR_OPEN, easing: SPRING, fill: "forwards" })).onfinish = done;
  }

  function finishClose() {
    var src = S.src;
    dropAnims(); if (S.cleanup) { try { S.cleanup(); } catch (e) { } }
    sheetEl.hidden = true; ghost.hidden = true; body.innerHTML = ""; card.style.transform = ""; card.style.opacity = ""; card.style.borderRadius = ""; card.style.overflow = ""; scrim.style.opacity = "";
    root.classList.remove("is-sheet", "is-locked"); home.removeAttribute("inert"); pv.removeAttribute("inert"); home.style.transformOrigin = "";
    if (src) { src.classList.remove("is-source"); var f = $(".tile__hit", src) || src; try { f.focus({ preventScroll: true }); } catch (e) { } }
    S.open = null; S.src = null; S.cleanup = null; S.tick = null; S.busy = false;
    if (location.hash && !S.pushed) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { } }
  }
  function closeSheet(o) {
    o = o || {};
    if (!S.open || (S.busy && !o.force)) return;
    if (S.pushed && !o.fromPop) { S.pushed = false; try { history.back(); return; } catch (e) { } }
    S.busy = true; card.classList.remove("is-open"); Snd.play("close");
    var src = S.src, from = onScreen(src) ? src.getBoundingClientRect() : null;
    if (o.instant) { finishClose(); return; }
    if (reduced() || !from || o.swiped) {
      /* chiusura con il dito, o senza riquadro visibile: rimpicciolisce verso il riquadro e svanisce */
      var cr = card.getBoundingClientRect(), cur = getComputedStyle(card).transform, end = "translateY(24px) scale(.94)";
      if (from && !reduced()) { var s = from.width / (card.offsetWidth || cr.width); end = "translate(" + (from.left + from.width / 2 - (card.offsetLeft + card.offsetWidth / 2)) + "px," + (from.top - card.offsetTop) + "px) scale(" + s + ")"; }
      if (src) src.classList.remove("is-source");
      track(home.animate([{ transform: "scale(.955)" }, { transform: "none" }], { duration: 300, easing: EASE_OUT, fill: "forwards" }));
      track(scrim.animate([{ opacity: getComputedStyle(scrim).opacity }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }));
      track(card.animate(reduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: cur === "none" ? "none" : cur, opacity: 1 }, { transform: end, opacity: 0 }], { duration: reduced() ? 150 : 300, easing: EASE_OUT, fill: "forwards" })).onfinish = finishClose;
      return;
    }
    var to = card.getBoundingClientRect(), rad = parseFloat(getComputedStyle(src).borderTopLeftRadius) || 32, last = bg;
    [body, closeBtn, grab].concat($$(".sal__sky, .mystar", card)).forEach(function (n) { track(n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: "ease-out", fill: "forwards" })); });
    if (isFull(to)) {
      /* il fantasma torna sotto il fondo, già grande; il fondo svanisce e il fantasma si restringe fino al riquadro */
      ghostPlace(from, rad, card.getAttribute("data-mat")); last = ghost;
      track(ghost.animate([{ transform: ghostEnd(from, to, rad) }, { transform: "none" }], { duration: DUR_CLOSE, easing: EASE_OUT, fill: "both" }));
      track(bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, easing: "linear", fill: "forwards" }));
    } else {
      track(bg.animate([{ transform: "none" }, { transform: cardStart(from, to) }], { duration: DUR_CLOSE, easing: EASE_OUT, fill: "forwards" }));
    }
    track(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR_CLOSE - 80, easing: "ease-out", fill: "forwards" }));
    track(home.animate([{ transform: "scale(.955)" }, { transform: "none" }], { duration: DUR_CLOSE, easing: EASE_OUT, fill: "forwards" }));
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
        var inner = e.target.closest ? e.target.closest(".qr__page") : null;
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
    var nl = t.closest("[data-nolink]"); if (nl) { e.preventDefault(); Snd.play("tap"); return; }
    var op = t.closest("[data-open]"); if (!op || S.open) return;
    var id = op.getAttribute("data-open"); openSheet(id, op.closest(".tile[data-mat]") || op);
  });
  grid.addEventListener("pointerdown", function (e) { var h = e.target.closest ? e.target.closest(".tile__hit") : null; if (h) h.parentNode.classList.add("is-pressed"); });
  ["pointerup", "pointercancel", "pointerleave", "dragstart"].forEach(function (n) { grid.addEventListener(n, function () { $$(".tile.is-pressed", grid).forEach(function (t) { t.classList.remove("is-pressed"); }); }, true); });
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    grid.addEventListener("pointermove", function (e) { var t = e.target.closest ? e.target.closest(".tile") : null; if (!t) return; var r = t.getBoundingClientRect(); t.style.setProperty("--mx", (e.clientX - r.left) + "px"); t.style.setProperty("--my", (e.clientY - r.top) + "px"); });
  }
  $("#logo").addEventListener("click", function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); });
  $("#sound").addEventListener("click", function () { var on = Snd.toggle(); this.setAttribute("aria-pressed", on ? "true" : "false"); this.setAttribute("aria-label", on ? "Suoni accesi. Tocca per spegnerli" : "Suoni spenti. Tocca per accenderli"); });
  var stuck = false;
  window.addEventListener("scroll", function () { var s = window.scrollY > 6; if (s !== stuck) { stuck = s; bar.classList.toggle("is-stuck", s); } }, { passive: true });

  /* ---------------------------------------------------------------- apertura: una stella sale; hello, world → hello, imad's world → imad.chat */
  var introEl = $("#intro"), introSky = $("#introSky"), introSkyBox = $("#introSkyBox"), introStars = $("#introStars"), introGrain = $("#introGrain"), introStar = $("#introStar"), introText = $("#introText"), introHello = $("#introHello"), introTyped = $("#introTyped"), introWord = $("#introWord"), star1 = $("#star1");
  var IN = { on: false, timers: [], anims: [], dog: 0 };
  function introSkyPaint() {
    var tor = cityState(TORINO, now());
    setSky(introSkyBox, tor.sky, 97);
    introStars.innerHTML = starField(Math.max(0.55, starVis(tor.alt)), { scale: 1.15, depth: 78, mine: false });
  }
  function introEnd() {
    IN.timers.forEach(clearTimeout); IN.timers = []; clearTimeout(IN.dog);
    IN.anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); IN.anims = [];
    root.classList.remove("is-intro", "is-pre"); if (!S.open) root.classList.remove("is-locked");
    IN.on = false; window.__introStarted = true;
    introEl.style.opacity = ""; introText.style.transform = ""; introHello.style.transform = ""; introSky.style.cssText = ""; introStars.style.opacity = "";
  }
  function runIntro() {
    if (IN.on || S.open) return;
    if (reduced()) { introEnd(); return; }
    IN.on = true; window.__introStarted = true;
    window.scrollTo(0, 0);
    root.classList.add("is-intro", "is-pre", "is-locked");
    try { sessionStorage.setItem("imad.intro.widget", "1"); } catch (e) { }
    function at(ms, fn) { IN.timers.push(setTimeout(fn, ms)); }
    function keep(a) { IN.anims.push(a); return a; }
    IN.dog = setTimeout(introEnd, 9000);

    introSkyPaint();
    introStars.style.opacity = "0.16";                       /* le compagne si accendono dopo, quando la stella si posa */
    introWord.innerHTML = "imad.chat".split("").map(function (c) { return "<span>" + c + "</span>"; }).join("");
    introTyped.textContent = "hello, imad's world";
    introText.style.transform = ""; introHello.style.transform = "";
    var H = window.innerHeight, W = window.innerWidth;
    /* il cielo dell'apertura è grande quanto l'hero, con i suoi angoli, e ingrandito in scala uniforme fino a coprire lo schermo:
       alla fine si posa nel riquadro con la sola trasformazione (nessun raggio animato) */
    var hrc = hero.getBoundingClientRect(), hrad = parseFloat(getComputedStyle(hero).borderTopLeftRadius) || 32;
    var S0 = "translate(" + (W / 2 - hrc.left - hrc.width / 2).toFixed(1) + "px," + (H / 2 - hrc.top - hrc.height / 2).toFixed(1) + "px) scale(" + (Math.max(W / Math.max(1, hrc.width - 2 * hrad), H / hrc.height) * 1.03).toFixed(4) + ")";
    introSky.style.cssText = "left:" + hrc.left + "px;top:" + hrc.top + "px;right:auto;bottom:auto;width:" + hrc.width + "px;height:" + hrc.height + "px;border-radius:" + hrad + "px;transform:" + S0;
    var tr = heroText.getBoundingClientRect();
    introText.style.left = tr.left + "px"; introText.style.top = tr.top + "px";
    var hr = introHello.getBoundingClientRect(), br = introText.getBoundingClientRect();
    /* la prima stella riposa qui, nel cielo dell'hero: sale in verticale fino a questo punto */
    var sr = star1.getBoundingClientRect();
    introStar.style.left = sr.left + "px"; introStar.style.top = sr.top + "px";
    /* la frase, grande, allineata a sinistra come sarà dopo; lascia libera la colonna della stella */
    var K = clamp((sr.left - 44 - hr.left) / (introTyped.getBoundingClientRect().width + 12), 1, 1.9), cy = Math.round(H * 0.47);
    var A0 = "translateY(" + (cy + hr.height * K / 2 - hr.bottom).toFixed(1) + "px) scale(" + K.toFixed(3) + ")";
    var B0 = "translateY(" + (cy - br.height / 2 - br.top).toFixed(1) + "px)";
    introHello.style.transform = A0; introTyped.textContent = "";

    /* la stella: sale piano, si fa brillante, si posa con un solo battito di luce */
    var RISE = 2600, halo = $("b", introStar), core = $("i", introStar);
    keep(introStar.animate([{ transform: "translateY(" + (H - sr.top + 80).toFixed(0) + "px) scale(.5)" }, { transform: "none" }], { duration: RISE, easing: "cubic-bezier(.36, .3, .2, 1)", fill: "both" }));
    keep(introStar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out", fill: "both" }));
    keep(halo.animate([{ opacity: 0.3, transform: "scale(.55)" }, { opacity: 0.86, transform: "scale(1)" }], { duration: RISE, easing: "ease-in", fill: "both" }));
    at(RISE - 80, function () {
      keep(halo.animate([{ opacity: 0.86, transform: "scale(1)" }, { opacity: 1, transform: "scale(2.6)", offset: 0.3 }, { opacity: 0.9, transform: "scale(1)" }], { duration: 1150, easing: "cubic-bezier(.3, .6, .3, 1)", fill: "forwards" }));
      keep(core.animate([{ transform: "scale(1)" }, { transform: "scale(2)", offset: 0.28 }, { transform: "scale(1)" }], { duration: 950, easing: EASE_OUT }));
      keep(introStars.animate([{ opacity: 0.16 }, { opacity: 1 }], { duration: 900, easing: "ease-out", fill: "forwards" }));
      Snd.play("star");
    });

    var txt = "", T = 380;
    function type(s, gap) { s.split("").forEach(function (ch) { at(T, function () { txt += ch; introTyped.textContent = txt; }); T += gap; }); }
    function erase(n, gap) { for (var i = 0; i < n; i++) { at(T, function () { txt = txt.slice(0, -1); introTyped.textContent = txt; }); T += gap; } }
    type("hello, world", 56); T += 380;
    erase(5, 44); T += 90;
    type("imad's world", 52);
    T = Math.max(T + 160, RISE + 250);
    /* la frase si raccoglie: si fa piccola, sotto compare imad.chat */
    at(T, function () {
      keep(introHello.animate([{ transform: A0 }, { transform: "none" }], { duration: 440, easing: EASE_IN_OUT, fill: "forwards" }));
      keep(introText.animate([{ transform: "none" }, { transform: B0 }], { duration: 440, easing: EASE_IN_OUT, fill: "forwards" }));
      $$("span", introWord).forEach(function (sp, i) { keep(sp.animate([{ opacity: 0, transform: "translateY(.22em)" }, { opacity: 1, transform: "none" }], { duration: 440, delay: 100 + i * 30, easing: EASE_OUT, fill: "forwards" })); });
    });
    T += 440 + 420;
    /* il cielo si posa nel riquadro in alto, e intorno entrano gli altri */
    at(T, function () {
      keep(introSky.animate([{ transform: S0 }, { transform: "none" }], { duration: 660, easing: SPRING, fill: "forwards" }));
      keep(introStars.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" }));
      keep(introGrain.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" }));
      keep(introText.animate([{ transform: B0 }, { transform: "none" }], { duration: 660, easing: SPRING, fill: "forwards" }));
      root.classList.remove("is-pre");
      var items = [bar].concat($$(".tile", grid).filter(function (t) { return t !== hero; }).sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); }), [$(".foot")]);
      items.forEach(function (t, i) { keep(t.animate([{ opacity: 0, transform: "translateY(26px) scale(.93)" }, { opacity: 1, transform: "none" }], { duration: 620, delay: 80 + i * 45, easing: SPRING_POP, fill: "backwards" })); });
      at(600, function () {
        keep(introEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" })).onfinish = function () {
          root.classList.remove("is-intro"); if (!S.open) root.classList.remove("is-locked");
          IN.timers.push(setTimeout(introEnd, 900));       /* lascia finire l'entrata dei riquadri */
        };
      });
    });
  }
  introEl.addEventListener("click", function () { if (IN.on) introEnd(); });
  doc.addEventListener("keydown", function (e) { if (IN.on && root.classList.contains("is-intro") && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); introEnd(); } });

  /* le parole dei saluti cambiano piano, una alla volta: ciao, salam, hello, salut, hola… (contano solo le stelle visibili su questo schermo) */
  function cycleWords() {
    if (SHOT || reduced()) return;
    var turn = 0, next = 1;
    setInterval(function () {
      if (doc.hidden || IN.on || S.open) return;
      var all = $$(".gw:not(.gw--me)", heroSky), vis = [], n = D.greetings.length;
      all.forEach(function (e, k) { if (e.offsetParent !== null) vis.push(k); });
      if (!vis.length) return;
      var j = vis[turn++ % vis.length], el = $("b", all[j]), shown = vis.map(function (v) { return wordIdx[v]; });
      while (shown.indexOf(next % n) >= 0) next++;
      var g = D.greetings[next % n]; wordIdx[j] = next % n; next++;
      var out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-in", fill: "forwards" });
      out.onfinish = function () { el.textContent = g.text; el.lang = g.lang; out.cancel(); el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "ease-out" }); };
    }, 4200);
  }

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

  /* ---------------------------------------------------------------- barra dell'anteprima */
  var FONT = { inter: '"Inter"', geist: '"Geist"', manrope: '"Manrope"', instrument: '"Instrument Sans"', sistema: "" };
  var SYS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  var prefs = store("imad.anteprima.widget") || {};
  var pvTheme = $("#pvTheme"), pvFont = $("#pvFont");
  function refit() { layout(); paintCorano(); if (SHOT || reduced() || !codeStarted) paintCodeStatic(); }
  pvTheme.value = root.getAttribute("data-theme") || "auto";
  pvFont.value = root.getAttribute("data-font") || "manrope";
  pvTheme.addEventListener("change", function () { var v = this.value; if (v === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", v); prefs.theme = v; store("imad.anteprima.widget", prefs); });
  pvFont.addEventListener("change", function () {
    var v = this.value; root.setAttribute("data-font", v); root.style.setProperty("--font-sans", (FONT[v] ? FONT[v] + ", " : "") + SYS); prefs.font = v; store("imad.anteprima.widget", prefs);
    if (doc.fonts && doc.fonts.load && FONT[v]) { Promise.all([doc.fonts.load("800 40px " + FONT[v]), doc.fonts.load("500 15px " + FONT[v]), doc.fonts.load("700 15px " + FONT[v])]).then(refit, refit); } else refit();
  });
  $("#pvIntro").addEventListener("click", function () { runIntro(); });

  /* ---------------------------------------------------------------- avvio */
  layout(); paintCorano(); buildCities(); buildMarquee(); paintCount(); paintLive(now(), true);
  curEl.innerHTML = curHTML(D.curiosities[curI]); curCount();
  if (root.classList.contains("is-intro")) introSkyPaint();
  cycleWords();
  makeCube($("#cubeStage"), function () { if (!S.open) openSheet("cubo", tileFor("cubo")); });
  if (SHOT || reduced()) paintCodeStatic(); else {
    codeEl.innerHTML = '<span class="ln"><i class="caret"></i></span>';
    if ("IntersectionObserver" in window) { var cio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { typeCode(); cio.disconnect(); } }, { threshold: 0.6 }); cio.observe(codeEl.parentNode); } else typeCode();
    cycleCur();
  }
  if ("ResizeObserver" in window) new ResizeObserver(function () { layout(); paintCorano(); }).observe(home); else window.addEventListener("resize", layout);

  function tick() { var d = now(); paintLive(d, false); if (S.tick) { try { S.tick(d); } catch (e) { } } }
  if (!frozen) setTimeout(function () { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));

  var willIntro = root.classList.contains("is-intro");
  var fontsReady = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();
  var faces = [];
  if (doc.fonts && doc.fonts.load) {
    var fam = getComputedStyle(root).getPropertyValue("--font-sans").split(",")[0].trim();
    try { faces = [doc.fonts.load("800 40px " + fam), doc.fonts.load("700 16px " + fam), doc.fonts.load("600 13px " + fam), doc.fonts.load("500 15px " + fam), doc.fonts.load('500 13px "Geist Mono"'), doc.fonts.load('400 13px "Geist Mono"'), doc.fonts.load('400 30px "Amiri Quran"', HOME_VERSE.ar)]; } catch (e) { faces = []; }
  }
  var settle = Promise.race([Promise.all(faces).then(function () { return fontsReady; }), new Promise(function (r) { setTimeout(r, 2600); })]);
  function start() {
    refit();
    var open = Q.get("open") || (location.hash ? location.hash.slice(1) : "");
    if (open && PAGES[open]) openSheet(open, tileFor(open), { instant: true, push: false });
    else if (willIntro) runIntro();
    requestAnimationFrame(function () { requestAnimationFrame(function () { window.__ready = true; }); });
  }
  if (willIntro) { Promise.race([settle, new Promise(function (r) { setTimeout(r, 900); })]).then(start, start); settle.then(function () { if (!IN.on) refit(); }); }
  else settle.then(start, start);
})();
