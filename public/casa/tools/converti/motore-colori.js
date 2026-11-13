/* Convertitore — i colori: HEX, RGB, HSL, OKLCH e ritorno. sRGB come in CSS Color 4; OKLab e OKLCH di Björn Ottosson (le
   matrici sono quelle di CSS Color 4). Un OKLCH che lo schermo non sa fare (fuori dallo sRGB) si dice, e HEX, RGB e HSL danno il
   colore più vicino che si può fare, con l'algoritmo di CSS Color 4 (si riduce il croma finché la differenza è sotto 0,02).
   Plain script, ES2017. */
(function (G) {
  "use strict";
  var CV = G.CV = G.CV || {};

  function lin(c) { var a = Math.abs(c); return (a <= 0.04045 ? c / 12.92 : (c < 0 ? -1 : 1) * Math.pow((a + 0.055) / 1.055, 2.4)); }
  function gam(c) { var a = Math.abs(c); return (a <= 0.0031308 ? c * 12.92 : (c < 0 ? -1 : 1) * (1.055 * Math.pow(a, 1 / 2.4) - 0.055)); }
  function rgbAOklab(rgb) {
    var r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    l = Math.cbrt(l); m = Math.cbrt(m); s = Math.cbrt(s);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklabARgb(lab) {
    var l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
    var m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
    var s = lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
  }
  function labALch(lab) { var c = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]), h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI; if (h < 0) h += 360; return [lab[0], c, c < 1e-6 ? 0 : h]; }
  function lchALab(lch) { var h = lch[2] * Math.PI / 180; return [lch[0], lch[1] * Math.cos(h), lch[1] * Math.sin(h)]; }
  function dentro(rgb, eps) { eps = eps || 1e-6; return rgb.every(function (c) { return c >= -eps && c <= 1 + eps; }); }
  function clip(rgb) { return rgb.map(function (c) { return Math.min(1, Math.max(0, c)); }); }
  function deltaEOK(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }
  /* CSS Color 4, «binary search gamut mapping» in OKLCH */
  function inGamma(lch) {
    if (lch[0] >= 1) return [1, 1, 1];
    if (lch[0] <= 0) return [0, 0, 0];
    var rgb = oklabARgb(lchALab(lch)); if (dentro(rgb)) return clip(rgb);
    var cl = clip(rgb); if (deltaEOK(rgbAOklab(cl), lchALab(lch)) < 0.02) return cl;
    var lo = 0, hi = lch[1], ok = true;
    while (hi - lo > 0.0001) {
      var c = (lo + hi) / 2, t = [lch[0], c, lch[2]], r = oklabARgb(lchALab(t));
      if (ok && dentro(r)) { lo = c; continue; }
      var k = clip(r), e = deltaEOK(rgbAOklab(k), lchALab(t));
      if (e < 0.02) { if (0.02 - e < 0.0001) return k; ok = false; lo = c; } else hi = c;
    }
    return clip(oklabARgb(lchALab([lch[0], lo, lch[2]])));
  }
  function rgbAHsl(rgb) {
    var r = rgb[0], g = rgb[1], b = rgb[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d > 1e-9) {
      s = l === 0 || l === 1 ? 0 : (mx - l) / Math.min(l, 1 - l);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hslARgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    function f(n) { var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return [f(0), f(8), f(4)];
  }

  /* --------------------------------------------------------------- leggere */
  function numeri(s) { return s.replace(/[(),/]/g, " ").trim().split(/\s+/).filter(Boolean); }
  function n(v, scala) {               /* «50%» o «0.5» o «128» → numero; scala: quanto vale 100% */
    var m = String(v).replace(",", ".").match(/^([+-]?(?:\d+\.?\d*|\.\d+))(%|deg)?$/i); if (!m) return NaN;
    var x = parseFloat(m[1]); return m[2] === "%" ? x / 100 * scala : x;
  }
  function alfa(v) { if (v === undefined) return 1; var a = n(v, 1); return isNaN(a) ? NaN : Math.min(1, Math.max(0, a)); }
  /* → { stato: "ok", rgb (0..1, forse fuori), a, fonte, lch } | { stato: "errore", messaggio } | { stato: "no" } */
  function leggi(testo, inColori) {
    var s = String(testo || "").trim().toLowerCase().replace(/;$/, "");
    if (!s) return { stato: "vuoto" };
    var m, h = null;
    if ((m = s.match(/^#([0-9a-f]+)$/)) || inColori && !/^0[xbo]/.test(s) && (m = s.match(/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/))) {
      h = m[1];
      if ([3, 4, 6, 8].indexOf(h.length) < 0) return { stato: "errore", messaggio: "Un HEX ha 3, 4, 6 o 8 cifre: #" + h + " ne ha " + h.length + "." };
      if (h.length < 5) h = h.split("").map(function (c) { return c + c; }).join("");
      var rgb = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; });
      return fatto(rgb, h.length === 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1, "hex");
    }
    if (s.charAt(0) === "#") return { stato: "errore", messaggio: "Dopo # vanno le cifre da 0 a 9 e le lettere da a a f." };
    var f = s.match(/^(rgba?|hsla?|oklch)\s*\(?\s*(.*?)\s*\)?$/);
    if (!f) {
      if (inColori && (m = s.match(/^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/))) f = [s, "rgb", m[1] + " " + m[2] + " " + m[3]];
      else return { stato: "no" };
    }
    var p = numeri(f[2]), tipo = f[1].replace(/a$/, "");
    if (tipo === "hsl" && f[1] === "hsla") tipo = "hsl";
    if (p.length < 3 || p.length > 4) return { stato: "errore", messaggio: "Servono tre numeri" + (tipo === "oklch" ? " (luminosità, croma, tinta)" : "") + ", e se vuoi la trasparenza." };
    var a = alfa(p[3]);
    if (tipo === "rgb") {
      var c = p.slice(0, 3).map(function (v) { return n(v, 255); });
      if (c.some(isNaN) || isNaN(a)) return { stato: "errore", messaggio: "In rgb() vanno numeri da 0 a 255 (o percentuali)." };
      if (c.some(function (v) { return v < 0 || v > 255; })) return { stato: "errore", messaggio: "In rgb() ogni canale va da 0 a 255." };
      return fatto(c.map(function (v) { return v / 255; }), a, "rgb");
    }
    if (tipo === "hsl") {
      var hh = n(p[0].replace(/deg$/, ""), 360), ss = n(p[1].replace(/%$/, ""), 100), ll = n(p[2].replace(/%$/, ""), 100);
      if ([hh, ss, ll, a].some(isNaN)) return { stato: "errore", messaggio: "In hsl() vanno la tinta (0–360), la saturazione e la luminosità (0–100%)." };
      if (ss < 0 || ss > 100 || ll < 0 || ll > 100) return { stato: "errore", messaggio: "Saturazione e luminosità vanno da 0 a 100%." };
      return fatto(hslARgb(hh, ss, ll), a, "hsl");
    }
    var L = /%$/.test(p[0]) ? n(p[0], 1) : n(p[0], 1), C = n(p[1], 0.4), H = n(p[2].replace(/deg$/, ""), 360);
    if ([L, C, H, a].some(isNaN)) return { stato: "errore", messaggio: "In oklch() vanno la luminosità (0–100%), il croma (da 0 a circa 0,4) e la tinta (0–360)." };
    if (!/%$/.test(p[0]) && L > 1) L = L / 100;                          /* oklch(62 0.2 250): 62 vuol dire 62% */
    L = Math.min(1, Math.max(0, L)); C = Math.max(0, C); H = ((H % 360) + 360) % 360;
    var lch = [L, C, H], vero = oklabARgb(lchALab(lch)), fuori = !dentro(vero, 0.5 / 255 / 10);
    var r = fatto(fuori ? inGamma(lch) : clip(vero), a, "oklch");
    r.lch = lch; r.fuori = fuori; return r;
  }
  function fatto(rgb, a, fonte) { return { stato: "ok", rgb: rgb, a: a, fonte: fonte, lch: labALch(rgbAOklab(rgb)), fuori: false }; }

  /* --------------------------------------------------------------- scrivere (o: { piu: più cifre }) */
  function arr(x, d) { var p = Math.pow(10, d), v = Math.round(x * p) / p; if (Object.is(v, -0)) v = 0; var t = v.toFixed(d); return d > 0 ? t.replace(/\.?0+$/, "") : t; }
  function a8(v) { return ("0" + Math.round(v * 255).toString(16)).slice(-2); }
  function formati(c, o) {
    o = o || {}; var piu = !!o.piu, rgb = clip(c.rgb), a = c.a;
    var hex = "#" + rgb.map(a8).join("") + (a < 1 ? a8(a) : "");
    var r255 = rgb.map(function (v) { return v * 255; });
    var al = a < 1 ? " / " + arr(a * 100, 1) + "%" : "";
    var rgbS = "rgb(" + r255.map(function (v) { return piu ? arr(v, 2) : String(Math.round(v)); }).join(" ") + al + ")";
    /* onestà: un formato è «esatto» se, riletto, dà lo stesso HEX; si sceglie la scrittura più corta che ci riesce */
    function torna(t) { var r = leggi(t); return r.stato === "ok" && "#" + clip(r.rgb).map(a8).join("") === hex.slice(0, 7); }
    var hsl = rgbAHsl(rgb), hslS, hslOk = false;
    [0, 1, 2].some(function (d) { if (piu) d = 2; hslS = "hsl(" + arr(hsl[0], d) + " " + arr(hsl[1], d) + "% " + arr(hsl[2], d) + "%" + al + ")"; hslOk = torna(hslS); return hslOk || piu; });
    var lch = c.fuori && c.lch ? c.lch : labALch(rgbAOklab(rgb)), oklchS, okOk = false;
    [[2, 4, 2], [2, 5, 2], [3, 5, 3], [4, 6, 4]].some(function (d) {
      if (piu) d = [4, 6, 4];
      oklchS = "oklch(" + arr(lch[0] * 100, d[0]) + "% " + arr(lch[1], d[1]) + " " + arr(lch[2], d[2]) + al + ")";
      okOk = c.fuori || torna(oklchS); return okOk || piu;
    });
    return {
      hex: { testo: hex, esatto: true },
      rgb: { testo: rgbS, esatto: piu || r255.every(function (v) { return Math.abs(v - Math.round(v)) < 1e-6; }) },
      hsl: { testo: hslS, esatto: hslOk },
      oklch: { testo: oklchS, esatto: okOk }
    };
  }
  function luminanza(rgb) { var l = rgb.map(lin); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
  function contrasto(a, b) { var x = luminanza(a), y = luminanza(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  CV.colori = { leggi: leggi, formati: formati, contrasto: contrasto, luminanza: luminanza, rgbAOklab: rgbAOklab, oklabARgb: oklabARgb, labALch: labALch, lchALab: lchALab, inGamma: inGamma, clip: clip, hex: function (rgb) { return "#" + clip(rgb).map(a8).join(""); } };
})(typeof window !== "undefined" ? window : globalThis);
