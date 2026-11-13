/* Convertitore — i numeri esatti. Ogni fattore è una frazione di interi (BigInt), così 12 km in miglia è 12000/1609,344 senza
   errori di virgola mobile: si arrotonda solo alla fine, per mostrarlo, e si dice quando si è arrotondato («≈»).
   CV.Q: frazioni; CV.leggiNumero: un numero scritto come lo scrive una persona (1.500, 1,5, 1e3, 3/4), con i dubbi detti;
   CV.scrivi: una frazione in italiano (virgola, punto delle migliaia come Intl it-IT, «× 10ⁿ» per i molto grandi e piccoli).
   Plain script, ES2017: BigInt si chiama come funzione (niente letterali 10n). Va anche in Node (per le prove). */
(function (G) {
  "use strict";
  var CV = G.CV = G.CV || {};
  var B = G.BigInt;
  var ZERO = B(0), UNO = B(1), DIECI = B(10);

  function abs(a) { return a < ZERO ? -a : a; }
  function mcd(a, b) { a = abs(a); b = abs(b); while (b !== ZERO) { var t = a % b; a = b; b = t; } return a; }
  function pot10(k) { var r = UNO; for (var i = 0; i < k; i++) r *= DIECI; return r; }
  function da(n, d) {
    n = B(n); d = d === undefined ? UNO : B(d);
    if (d === ZERO) throw new Error("divisione per zero");
    if (d < ZERO) { n = -n; d = -d; }
    var g = mcd(n, d); if (g > UNO) { n /= g; d /= g; }
    return { n: n, d: d };
  }
  /* "1609.344", "-2.5e-3", "5/18": la forma pulita, già senza dubbi */
  function dec(s) {
    s = String(s).trim();
    var f = s.match(/^([+-]?\d+)\/(\d+)$/); if (f) return da(f[1], f[2]);
    var m = s.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if (!m || (m[2] + (m[3] || "")) === "") throw new Error("numero non valido: " + s);
    var cifre = (m[2] || "0") + (m[3] || ""), k = (m[3] || "").length, e = m[4] ? parseInt(m[4], 10) : 0;
    var n = B(cifre), d = UNO; e -= k;
    if (e >= 0) n *= pot10(e); else d = pot10(-e);
    return da(m[1] === "-" ? -n : n, d);
  }
  var Q = CV.Q = {
    da: da, dec: dec,
    add: function (a, b) { return da(a.n * b.d + b.n * a.d, a.d * b.d); },
    sub: function (a, b) { return da(a.n * b.d - b.n * a.d, a.d * b.d); },
    mul: function (a, b) { return da(a.n * b.n, a.d * b.d); },
    div: function (a, b) { return da(a.n * b.d, a.d * b.n); },
    neg: function (a) { return { n: -a.n, d: a.d }; },
    zero: function (a) { return a.n === ZERO; },
    intero: function (a) { return a.d === UNO; },
    cmp: function (a, b) { var x = a.n * b.d, y = b.n * a.d; return x < y ? -1 : x > y ? 1 : 0; },
    num: function (a) { return Number(a.n) / Number(a.d); },
    /* un decimale finito? (il denominatore ha solo 2 e 5) */
    finito: function (a) { var d = a.d, D2 = B(2), D5 = B(5); while (d % D2 === ZERO) d /= D2; while (d % D5 === ZERO) d /= D5; return d === UNO; },
    pot10: pot10
  };

  /* --------------------------------------------------------------- scrivere: cifre significative, onestà sull'arrotondamento */
  var APICI = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  function gruppi(intS) { return intS.length < 5 ? intS : intS.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function esponente(n, d) {             /* floor(log10(n/d)) per n, d > 0 */
    var e = n.toString().length - d.toString().length;
    if (e >= 0) { if (n < d * pot10(e)) e--; } else { if (n * pot10(-e) < d) e--; }
    return e;
  }
  /* o = { sig: cifre significative (6), max: decimali al massimo (20) } → { testo, copia, esatto, sci }
     testo: per gli occhi (− vero, punto delle migliaia, × 10ⁿ); copia: per incollare (- e virgola, niente punti delle migliaia) */
  CV.scrivi = function (r, o) {
    o = o || {}; var sig = o.sig || 6, max = o.max === undefined ? 20 : o.max;
    if (r.n === ZERO) return { testo: "0", copia: "0", esatto: true, sci: false };
    var neg = r.n < ZERO, n = abs(r.n), d = r.d, e = esponente(n, d), sci = e >= 15 || e < -6;
    var k = sci ? sig - 1 - e : Math.min(Math.max(sig - 1 - e, 0), max);
    var num = n, den = d; if (k >= 0) num = n * pot10(k); else den = d * pot10(-k);
    var q = num / den, resto = num % den, esatto = resto === ZERO;
    if (resto * B(2) >= den) q += UNO;                           /* a metà si arrotonda per eccesso */
    var s = q.toString();
    if (sci) {
      if (s.length > sig) { e++; s = s.slice(0, sig); }        /* 9,99999… → 10,0000 */
      var m = s.charAt(0) + (s.length > 1 ? "," + s.slice(1) : "");
      m = m.replace(/,?0+$/, "");
      var ap = String(e).split("").map(function (c) { return APICI[c]; }).join("");
      return { testo: (neg ? "−" : "") + m + " × 10" + ap, copia: (neg ? "-" : "") + m + "e" + e, esatto: esatto, sci: true };
    }
    var ip, fp = "";
    if (k > 0) { while (s.length <= k) s = "0" + s; ip = s.slice(0, s.length - k); fp = s.slice(s.length - k).replace(/0+$/, ""); }
    else ip = s;
    var zero = /^0+$/.test(ip) && fp === "";
    var segno = neg && !zero ? "−" : "";
    return { testo: segno + gruppi(ip) + (fp ? "," + fp : ""), copia: (segno ? "-" : "") + ip + (fp ? "," + fp : ""), esatto: esatto, sci: false };
  };

  /* --------------------------------------------------------------- leggere un numero come lo scrive una persona
     Il punto e la virgola: in italiano 1.500 è millecinquecento e 1,5 è uno e mezzo; in inglese il contrario. Quando un numero si
     legge in due modi (un solo separatore seguito da tre cifre: 1.500, 2,250) non si sceglie a caso: si chiede, l'italiano per primo.
     → { valore: Q } oppure { dubbio: [{ valore, testo, nota }, { ... }] } oppure null */
  CV.leggiNumero = function (s) {
    s = String(s).replace(/−/g, "-").replace(/[\s  ']/g, "");
    var segno = "", m;
    if (/^[+-]/.test(s)) { segno = s.charAt(0) === "-" ? "-" : ""; s = s.slice(1); }
    if ((m = s.match(/^(\d+)\/(\d+)$/))) { if (/^0+$/.test(m[2])) return null; return { valore: da(B(segno + m[1]), B(m[2])) }; }
    if ((m = s.match(/^(\d+)\s*(\d+)\/(\d+)$/))) return null;
    var ex = "", me = s.match(/^(.*?)(e[+-]?\d+)$/i);
    if (me && /\d/.test(me[1])) { s = me[1]; ex = me[2]; }
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    var punti = (s.match(/\./g) || []).length, virgole = (s.match(/,/g) || []).length;
    function q(pulito) { try { return dec(segno + pulito + ex); } catch (e) { return null; } }
    function migliaia(t, sep) { var p = t.split(sep); return p.length > 1 && /^\d{1,3}$/.test(p[0]) && p.slice(1).every(function (g) { return /^\d{3}$/.test(g); }); }
    if (punti && virgole) {                                        /* tutti e due: l'ultimo è la virgola dei decimali */
      var ultimoP = s.lastIndexOf("."), ultimaV = s.lastIndexOf(",");
      var dsep = ultimoP > ultimaV ? "." : ",", gsep = dsep === "." ? "," : ".";
      var parti = s.split(dsep); if (parti.length !== 2 || !migliaia(parti[0], gsep) && parti[0].indexOf(gsep) >= 0) return null;
      var v = q(parti[0].split(gsep).join("") + "." + parti[1]); return v ? { valore: v } : null;
    }
    var sep = punti ? "." : virgole ? "," : "";
    if (!sep) { var w = q(s); return w ? { valore: w } : null; }
    var n = punti || virgole, pz = s.split(sep);
    if (n > 1) { if (!migliaia(s, sep)) return null; var g = q(pz.join("")); return g ? { valore: g } : null; }
    if (pz[0] === "") pz[0] = "0";
    if (pz[1] === "") return null;
    var comeDecimale = q(pz[0] + "." + pz[1]);
    if (/^\d{3}$/.test(pz[1]) && !/^0+$/.test(pz[0]) && !ex) {   /* 1.500 o 1,500: due letture */
      var comeMigliaia = q(pz[0] + pz[1]);
      var it = sep === "." ? comeMigliaia : comeDecimale, en = sep === "." ? comeDecimale : comeMigliaia;
      return { dubbio: [
        { valore: it, nota: sep === "." ? "il punto separa le migliaia" : "la virgola separa i decimali" },
        { valore: en, nota: sep === "." ? "il punto separa i decimali (all'inglese)" : "la virgola separa le migliaia (all'inglese)" }
      ] };
    }
    return comeDecimale ? { valore: comeDecimale } : null;
  };
})(typeof window !== "undefined" ? window : globalThis);
