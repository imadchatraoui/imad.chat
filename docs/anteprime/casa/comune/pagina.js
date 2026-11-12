/* imad.chat — il guscio comune delle pagine interne: la grana, i colori dello sfondo presi dal cielo di Torino adesso,
   il tema (?theme=light|dark per le foto; altrimenti segue il telefono), la testa che diventa vetro quando si scorre, e window.PAGINA.
   COME SI USA: in fondo alla pagina, dopo ../../shared/astro-lite.js (facoltativo: senza, lo sfondo resta nei colori di base):
     <script src="../comune/pagina.js"></script>
   window.PAGINA = { now(), reduced(), still(), isDark(), esc(s), api(nome) }  — api("contributi" | "progetti"): una Promise che si
   risolve sempre, con la risposta di /api/github/<nome> o con { ok: false } (allora la pagina dice «si aggiorna tra poco»: mai numeri
   inventati). ?t=2026-11-12T17:30:00Z ferma «adesso» (per le foto), ?shot=1 ferma i movimenti.
   Plain script, ES2017 al massimo. Il calcolo del cielo è lo stesso della casa (docs/anteprime/casa/home/app.js), in piccolo. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, Q = new URLSearchParams(location.search), A = window.ImadAstro;
  var th = Q.get("theme"); if (th === "light" || th === "dark") root.setAttribute("data-theme", th);
  var SHOT = Q.get("shot") === "1"; if (SHOT) root.classList.add("is-shot");
  var frozen = (function () { var t = Q.get("t"); if (!t) return null; var d = new Date(t); return isNaN(d.getTime()) ? null : d; })();
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)"), mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  function now() { return frozen ? new Date(frozen.getTime()) : new Date(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* la grana: una tessera di rumore disegnata una volta (stesso seme della casa) */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  try {
    var n = 128, cv = doc.createElement("canvas"); cv.width = cv.height = n;
    var ctx = cv.getContext("2d"), im = ctx.createImageData(n, n), r = rng(1968), px = im.data;
    for (var i = 0; i < px.length; i += 4) { var v = r() < 0.5 ? 0 : 255, a = r(); px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = Math.round((a * a + a) * 0.5 * 0.075 * 255); }
    ctx.putImageData(im, 0, 0); root.style.setProperty("--grain", "url(" + cv.toDataURL("image/png") + ")");
  } catch (e) { /* senza tela: superfici lisce */ }

  /* lo sfondo: quattro campi presi dal cielo di Torino (OKLab), profondi nel tema scuro e pallidi in quello chiaro */
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function gam(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(clamp(c, 0, 1) * 255); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toLab(c) {
    var r1 = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    var l = Math.cbrt(0.4122214708 * r1 + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r1 + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r1 + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function toRgb(L) {
    var l = L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], m = L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], s = L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  function mixLab(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function toLch(l) { return [l[0], Math.hypot(l[1], l[2]), Math.atan2(l[2], l[1])]; }
  function fromLch(c) { return [c[0], c[1] * Math.cos(c[2]), c[1] * Math.sin(c[2])]; }
  function mixLch(a, b, t, k) { var P = toLch(a), R = toLch(b), dh = R[2] - P[2]; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI; return fromLch([P[0] + (R[0] - P[0]) * t, (P[1] + (R[1] - P[1]) * t) * (k || 1), P[2] + dh * t]); }
  function tone(rgb, L, C) { var c = toLch(toLab(rgb)); return toRgb(fromLch([L, C, c[2]])); }
  function css(c) { return "rgb(" + c[0] + ", " + c[1] + ", " + c[2] + ")"; }
  var SKY = [[60, "#154bb8", "#2565cf", "#4a8ce0"], [15, "#1a51be", "#2d6cd2", "#5193e2"], [6, "#2051b3", "#436fc7", "#7f8ec9"], [2, "#22489e", "#5961ae", "#bf7f60"], [0, "#1e3f8c", "#5b4f98", "#c96f4c"],
    [-3, "#172f70", "#46407f", "#b0563f"], [-7, "#101f52", "#262a62", "#5e3a62"], [-12, "#0b1538", "#131c48", "#2a2752"], [-18, "#070c22", "#0c1230", "#141a3c"]]
    .map(function (k) { return { alt: k[0], zen: toLab(hex(k[1])), mid: toLab(hex(k[2])), hor: toLab(hex(k[3])) }; });
  function paintWall() {
    if (!A || !A.sun) return;
    var alt = A.sun(now(), 45.0703, 7.6869).altitude, a = SKY[0], b = SKY[SKY.length - 1], t = 0, i;   /* Torino */
    if (alt >= a.alt) b = a; else if (alt <= b.alt) a = b; else for (i = 0; i < SKY.length - 1; i++) if (alt <= SKY[i].alt && alt >= SKY[i + 1].alt) { a = SKY[i]; b = SKY[i + 1]; t = (a.alt - alt) / (a.alt - b.alt); break; }
    var mid = mixLab(a.mid, b.mid, t), hor = mixLab(a.hor, b.hor, t), zen = toRgb(mixLab(a.zen, b.zen, t)), midR = toRgb(mid), rose = toRgb(mixLch(mid, hor, 0.56, 1.06)), horR = toRgb(hor);
    var day = clamp((alt + 4) / 14, 0, 1), dusk = clamp(1 - Math.abs(alt) / 9, 0, 1), rs = root.style;
    rs.setProperty("--wd-1", css(tone(zen, 0.25 + 0.13 * day, 0.105 + 0.03 * day)));
    rs.setProperty("--wd-2", css(tone(midR, 0.27 + 0.14 * day, 0.1)));
    rs.setProperty("--wd-3", css(tone(rose, 0.26 + 0.1 * dusk + 0.14 * day, 0.09 + 0.02 * dusk)));
    rs.setProperty("--wd-4", css(tone(toRgb(mixLch(toLab(rose), toLab(horR), 0.6)), 0.25 + 0.07 * dusk + 0.15 * day, 0.075 + 0.02 * dusk)));
    rs.setProperty("--wl-1", css(tone(zen, 0.905, 0.05))); rs.setProperty("--wl-2", css(tone(midR, 0.9, 0.052)));
    rs.setProperty("--wl-3", css(tone(rose, 0.915, 0.045 + 0.012 * dusk))); rs.setProperty("--wl-4", css(tone(horR, 0.925, 0.045 + 0.02 * dusk)));
  }
  paintWall(); if (!frozen) setInterval(paintWall, 60000);

  /* la testa diventa vetro appena la pagina scorre */
  var head = doc.querySelector(".pg-testa"), stuck = false;
  if (head) window.addEventListener("scroll", function () { var s = window.pageYOffset > 4; if (s !== stuck) { stuck = s; head.classList.toggle("is-stuck", s); } }, { passive: true });

  var cache = {};
  window.PAGINA = {
    now: now,
    reduced: function () { return mqReduce.matches; },
    still: function () { return SHOT || mqReduce.matches; },
    isDark: function () { var t = root.getAttribute("data-theme"); return t ? t === "dark" : mqDark.matches; },
    esc: function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); },
    api: function (name) {
      if (cache[name]) return cache[name];
      cache[name] = new Promise(function (res) {
        var done = false, ctl = window.AbortController ? new AbortController() : null;
        var t = setTimeout(function () { if (done) return; done = true; if (ctl) ctl.abort(); res({ ok: false }); }, 8000);
        fetch("/api/github/" + name, { signal: ctl ? ctl.signal : undefined, headers: { accept: "application/json" } })
          .then(function (r) { return r.ok ? r.json() : { ok: false }; })
          .then(function (j) { if (done) return; done = true; clearTimeout(t); res(j && j.ok ? j : { ok: false }); })
          .catch(function () { if (done) return; done = true; clearTimeout(t); res({ ok: false }); });
      });
      return cache[name];
    }
  };
})();
