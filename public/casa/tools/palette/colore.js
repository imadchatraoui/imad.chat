/* Palette — il motore dei colori (window.PaletteCore). Tutto si calcola qui, sul dispositivo. Plain script, ES2017 al massimo;
   gira anche in Node (module.exports) per le prove.

   COSA SA FARE
   - sRGB <-> OKLab <-> OKLCH (le matrici di Björn Ottosson, «A perceptual color space for image processing», 2020; le stesse
     di CSS Color 4). L, C, h: luce 0–1, croma 0–0,4 circa, tinta in gradi.
   - mappa(l, c, h): il colore più vicino che uno schermo sRGB sa mostrare, con la stessa luce e la stessa tinta e la croma
     più alta possibile (ricerca binaria sulla croma, come il «gamut mapping» di CSS Color 4 senza la tolleranza JND): così
     un colore fuori dallo schermo si taglia in modo onesto e si può dire di quanto.
   - contrasto(hexA, hexB): il rapporto di contrasto di WCAG 2 (luminanza relativa dei canali a 8 bit, soglia 0,04045 come nel
     testo attuale di WCAG 2.2; il vecchio 0,03928 cambia il risultato solo nella quinta cifra), e il verdetto AA/AAA.
   - nome(lab): il nome CSS più vicino (i 148 colori con nome di CSS Color 4, §6.1, 139 valori diversi: dei doppioni resta il
     primo in ordine alfabetico, aqua e non cyan, gray e non grey), per distanza in OKLab; un colore con una tinta
     (croma da 0,03) sceglie solo tra i nomi che ne hanno una. Fonte in docs/fonti.md.
   - armonia(tipo, base, rnd): cinque colori in OKLCH, dal più scuro al più chiaro, per ricette scelte da noi (sotto, RICETTE).
   - estrai(rgba, w, h, k, seme): i k colori principali di una foto (k-means in OKLab, inizio k-means++ con un seme), con il
     punto della foto dove ciascuno si trova davvero (il pixel più vicino al centro del gruppo). */
(function (root) {
  "use strict";
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function gam(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  var LIN8 = new Float64Array(256);
  for (var q = 0; q < 256; q++) LIN8[q] = lin(q / 255);

  /* ---------------------------------------------------------------- OKLab */
  function linToLab(r, g, b) {
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function labToLin(L, a, b) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b, m = L - 0.1055613458 * a - 0.0638541728 * b, s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function lchToLab(l, c, h) { var r = h * Math.PI / 180; return [l, c * Math.cos(r), c * Math.sin(r)]; }
  function labToLch(lab) {
    var c = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]), h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { l: lab[0], c: c, h: h };
  }
  var EPS = 1e-6;
  function dentro(v) { return v[0] >= -EPS && v[0] <= 1 + EPS && v[1] >= -EPS && v[1] <= 1 + EPS && v[2] >= -EPS && v[2] <= 1 + EPS; }

  /* ---------------------------------------------------------------- hex */
  var HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
  function leggiHex(s) {
    var m = HEX.exec(String(s || "").trim()); if (!m) return null;
    var x = m[1].toLowerCase(); if (x.length === 3) x = x.charAt(0) + x.charAt(0) + x.charAt(1) + x.charAt(1) + x.charAt(2) + x.charAt(2);
    return "#" + x;
  }
  function hexRgb8(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb8Hex(r, g, b) { return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
  function hexLab(hex) { var c = hexRgb8(hex); return linToLab(LIN8[c[0]], LIN8[c[1]], LIN8[c[2]]); }
  function hexLch(hex) { return labToLch(hexLab(hex)); }

  /* il colore che lo schermo mostra per (l, c, h): la croma si abbassa finché ci sta; luce e tinta restano */
  function linDi(l, c, h) { var lab = lchToLab(l, c, h); return labToLin(lab[0], lab[1], lab[2]); }
  function maxCroma(l, h) {
    if (l <= 0 || l >= 1) return 0;
    var lo = 0, hi = 0.4;
    if (dentro(linDi(l, hi, h))) return hi;
    for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (dentro(linDi(l, mid, h))) lo = mid; else hi = mid; }
    return lo;
  }
  function mappa(l, c, h) {
    l = clamp(l, 0, 1); c = Math.max(0, c); h = ((h % 360) + 360) % 360;
    var cc = c, v = linDi(l, c, h), tagliato = false;
    if (!dentro(v)) { cc = maxCroma(l, h); v = linDi(l, cc, h); tagliato = c - cc > 0.0015; }
    var r = Math.round(clamp(gam(clamp(v[0], 0, 1)), 0, 1) * 255), g = Math.round(clamp(gam(clamp(v[1], 0, 1)), 0, 1) * 255), b = Math.round(clamp(gam(clamp(v[2], 0, 1)), 0, 1) * 255);
    return { hex: rgb8Hex(r, g, b), rgb: [r, g, b], l: l, c: cc, h: h, voluto: c, tagliato: tagliato };
  }

  /* ---------------------------------------------------------------- WCAG 2: luminanza relativa e rapporto di contrasto */
  function luminanza(hex) { var c = hexRgb8(hex); return 0.2126 * LIN8[c[0]] + 0.7152 * LIN8[c[1]] + 0.0722 * LIN8[c[2]]; }
  function contrasto(a, b) { var x = luminanza(a), y = luminanza(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /* il verdetto per il testo: AAA da 7, AA da 4,5, «grande» da 3 (solo testo di almeno 24 px, o 18,66 px in grassetto) */
  function verdetto(r) { return r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "grande" : "no"; }

  /* ---------------------------------------------------------------- i nomi: CSS Color 4, §6.1 (scritti da nomi.txt, non a mano) */
  var NOMI_S = "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32";
  var NOMI = NOMI_S.split(",").map(function (p) { var k = p.split(":"); var hex = "#" + k[1]; return { nome: k[0], hex: hex, lab: hexLab(hex) }; });
  function dist(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }
  /* un colore con una tinta chiara (croma da 0,03) non si chiama «gray»: per lui contano solo i nomi che hanno una tinta */
  NOMI.forEach(function (n) { n.c = Math.sqrt(n.lab[1] * n.lab[1] + n.lab[2] * n.lab[2]); });
  function nome(hexOLab) {
    var lab = typeof hexOLab === "string" ? hexLab(hexOLab) : hexOLab, best = null, bd = 1e9;
    var tinto = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]) >= 0.03;
    for (var i = 0; i < NOMI.length; i++) { if (tinto && NOMI[i].c < 0.02) continue; var d = dist(lab, NOMI[i].lab); if (d < bd) { bd = d; best = NOMI[i]; } }
    return { nome: best.nome, hex: best.hex, d: bd };
  }

  /* ---------------------------------------------------------------- le armonie */
  /* Ogni ricetta dà cinque colori [dt (gradi dalla tinta di base), luce, croma relativa alla base]. La luce è un gradino fisso
     (i passi si vedono uguali perché OKLCH è percettivo); la croma scende verso gli estremi, dove lo schermo ne ha meno.
     Un giallo scuro diventa oliva: sotto L .75 le tinte dei gialli (70–125°) scivolano verso l'ambra, come fa un pittore. */
  var RICETTE = {
    analoga: function (s) { var p = 16 + s * 14; return [[-2 * p, .3, .7], [-p, .46, .9], [0, .62, 1], [p, .77, .85], [2 * p, .91, .45]]; },
    complementare: function () { return [[0, .29, .65], [0, .5, 1], [180, .66, .9], [180, .82, .5], [0, .93, .22]]; },
    divisa: function () { return [[0, .31, .8], [0, .54, 1], [150, .68, .85], [210, .62, .8], [0, .93, .2]]; },
    triade: function () { return [[0, .33, .85], [240, .47, .75], [120, .6, .9], [240, .73, .8], [0, .89, .35]]; },
    sfumature: function () { return [[-6, .28, .7], [-3, .44, .9], [0, .6, 1], [3, .76, .72], [6, .92, .3]]; },
    neutri: function () { return [[0, .21, .14], [0, .4, .16], [0, .63, 1], [0, .87, .1], [0, .97, .05]]; }
  };
  var TIPI = ["libera", "analoga", "complementare", "divisa", "triade", "sfumature", "neutri"];
  function giallo(h, l) {
    if (h > 70 && h < 125 && l < 0.75) return h - (0.75 - l) * 58 * (1 - Math.abs(h - 97) / 40);
    return h;
  }
  function armonia(tipo, base, rnd) {
    rnd = rnd || Math.random;
    var t = tipo;
    if (t === "libera") {
      /* libera: metà delle volte una ricetta a caso, metà una passeggiata di tinte su una scala di luce */
      if (rnd() < 0.5) t = ["analoga", "complementare", "divisa", "triade", "sfumature"][Math.floor(rnd() * 5)];
      else {
        var hh = base.h, dir = rnd() < 0.5 ? -1 : 1, out = [];
        var luci = [.3, .45, .6, .75, .9].map(function (v) { return v + (rnd() - 0.5) * 0.05; });
        for (var i = 0; i < 5; i++) {
          if (i) hh += dir * (22 + rnd() * 48);
          var cr = base.c * [.75, .95, 1, .85, .5][i] * (0.8 + rnd() * 0.4);
          out.push([hh - base.h, luci[i], cr / Math.max(base.c, 1e-6)]);
        }
        return fai(out, base);
      }
    }
    var ric = RICETTE[t] || RICETTE.analoga;
    return fai(ric(rnd()), base);
  }
  function fai(ric, base) {
    return ric.map(function (r) {
      var l = r[1], h = ((base.h + r[0]) % 360 + 360) % 360;
      h = giallo(h, l);
      var c = Math.min(base.c * r[2], 0.32);
      var m = mappa(l, c, h);
      return { l: m.l, c: m.c, h: m.h, hex: m.hex };
    }).sort(function (a, b) { return a.l - b.l; });
  }
  /* una base a caso, ma non qualunque: croma media, luce media */
  function baseCaso(rnd) { rnd = rnd || Math.random; return { l: 0.55 + rnd() * 0.15, c: 0.07 + rnd() * 0.1, h: rnd() * 360 }; }

  /* ---------------------------------------------------------------- un generatore con seme (mulberry32) */
  function seme(s) { s = s >>> 0; return function () { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------- i colori di una foto: k-means in OKLab */
  function estrai(px, w, h, k, s) {
    var t0 = Date.now(), rnd = seme(s || 1), n = 0, i, j;
    var L = new Float32Array(w * h), A = new Float32Array(w * h), B = new Float32Array(w * h), P = new Int32Array(w * h);
    for (i = 0; i < w * h; i++) {
      if (px[i * 4 + 3] < 128) continue;   /* i pixel trasparenti non contano */
      var lab = linToLab(LIN8[px[i * 4]], LIN8[px[i * 4 + 1]], LIN8[px[i * 4 + 2]]);
      L[n] = lab[0]; A[n] = lab[1]; B[n] = lab[2]; P[n] = i; n++;
    }
    if (!n) return null;
    /* l'inizio: k-means++ (il primo a caso, poi ognuno con probabilità pari al quadrato della distanza) */
    var cL = [], cA = [], cB = [], d2 = new Float64Array(n), first = Math.floor(rnd() * n);
    cL.push(L[first]); cA.push(A[first]); cB.push(B[first]);
    for (i = 0; i < n; i++) d2[i] = 1e9;
    while (cL.length < k) {
      var tot = 0, c = cL.length - 1;
      for (i = 0; i < n; i++) { var x = L[i] - cL[c], y = A[i] - cA[c], z = B[i] - cB[c], d = x * x + y * y + z * z; if (d < d2[i]) d2[i] = d; tot += d2[i]; }
      if (tot <= 1e-12) { cL.push(cL[0]); cA.push(cA[0]); cB.push(cB[0]); continue; }
      var r = rnd() * tot, pick = n - 1;
      for (i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { pick = i; break; } }
      cL.push(L[pick]); cA.push(A[pick]); cB.push(B[pick]);
    }
    var lab2 = new Uint8Array(n), giri = 0;
    for (var it = 0; it < 24; it++) {
      giri++;
      var sL = new Float64Array(k), sA = new Float64Array(k), sB = new Float64Array(k), cnt = new Float64Array(k);
      for (i = 0; i < n; i++) {
        var bj = 0, bd = 1e9;
        for (j = 0; j < k; j++) { var dx = L[i] - cL[j], dy = A[i] - cA[j], dz = B[i] - cB[j], dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; bj = j; } }
        lab2[i] = bj; sL[bj] += L[i]; sA[bj] += A[i]; sB[bj] += B[i]; cnt[bj]++;
      }
      var mosso = 0;
      for (j = 0; j < k; j++) {
        if (!cnt[j]) continue;
        var nl = sL[j] / cnt[j], na = sA[j] / cnt[j], nb = sB[j] / cnt[j];
        mosso = Math.max(mosso, Math.abs(nl - cL[j]) + Math.abs(na - cA[j]) + Math.abs(nb - cB[j]));
        cL[j] = nl; cA[j] = na; cB[j] = nb;
      }
      if (mosso < 1e-5) break;
    }
    /* per ogni gruppo: quanti pixel, e dove il colore «si trova» nella foto: tra i pixel veri del gruppo che hanno quasi il colore
       del centro (fino a ΔE 0,02 più del più vicino), quello più vicino al centro del gruppo nella foto. Così in una zona piatta
       il punto sta in mezzo alla zona e non sul suo primo pixel in alto. */
    var out = [], o, ex, ey, ez, ed;
    for (j = 0; j < k; j++) out.push({ lab: [cL[j], cA[j], cB[j]], n: 0, at: -1, bd: 1e9, sx: 0, sy: 0, sd: 1e18 });
    for (i = 0; i < n; i++) {
      o = out[lab2[i]]; o.n++; o.sx += P[i] % w; o.sy += Math.floor(P[i] / w);
      ex = L[i] - o.lab[0]; ey = A[i] - o.lab[1]; ez = B[i] - o.lab[2]; ed = ex * ex + ey * ey + ez * ez;
      if (ed < o.bd) o.bd = ed;
    }
    for (i = 0; i < n; i++) {
      o = out[lab2[i]];
      ex = L[i] - o.lab[0]; ey = A[i] - o.lab[1]; ez = B[i] - o.lab[2]; ed = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (ed > Math.sqrt(o.bd) + 0.02) continue;
      var px0 = P[i] % w - o.sx / o.n, py0 = Math.floor(P[i] / w) - o.sy / o.n, sd = px0 * px0 + py0 * py0;
      if (sd < o.sd) { o.sd = sd; o.at = P[i]; }
    }
    out = out.map(function (o) {
      var v = labToLin(o.lab[0], o.lab[1], o.lab[2]);
      var r8 = Math.round(clamp(gam(clamp(v[0], 0, 1)), 0, 1) * 255), g8 = Math.round(clamp(gam(clamp(v[1], 0, 1)), 0, 1) * 255), b8 = Math.round(clamp(gam(clamp(v[2], 0, 1)), 0, 1) * 255);
      var hex = rgb8Hex(r8, g8, b8), lch = hexLch(hex);
      return { hex: hex, l: lch.l, c: lch.c, h: lch.h, quota: o.n / n, x: o.at >= 0 ? (o.at % w + 0.5) / w : 0.5, y: o.at >= 0 ? (Math.floor(o.at / w) + 0.5) / h : 0.5 };
    }).sort(function (a, b) { return a.l - b.l; });
    return { colori: out, pixel: n, giri: giri, ms: Date.now() - t0 };
  }

  /* ---------------------------------------------------------------- passare da un colore all'altro senza passare dal grigio */
  /* in OKLCH: la luce e la croma vanno dritte, la tinta prende la via più corta sul cerchio; un grigio prende la tinta dell'altro */
  function misto(a, b, t) {
    var ha = a.h, hb = b.h;
    if (a.c < 0.004) ha = hb; if (b.c < 0.004) hb = ha;
    var dh = ((hb - ha + 540) % 360) - 180;
    return { l: a.l + (b.l - a.l) * t, c: a.c + (b.c - a.c) * t, h: (ha + dh * t + 360) % 360 };
  }

  var API = {
    clamp: clamp, leggiHex: leggiHex, hexRgb8: hexRgb8, rgb8Hex: rgb8Hex, hexLab: hexLab, hexLch: hexLch, labToLch: labToLch, lchToLab: lchToLab,
    linToLab: linToLab, labToLin: labToLin, maxCroma: maxCroma, mappa: mappa, luminanza: luminanza, contrasto: contrasto, verdetto: verdetto,
    nome: nome, NOMI: NOMI, armonia: armonia, baseCaso: baseCaso, TIPI: TIPI, seme: seme, estrai: estrai, misto: misto, dist: dist
  };
  if (typeof module === "object" && module.exports) module.exports = API; else root.PaletteCore = API;
})(typeof window !== "undefined" ? window : this);
