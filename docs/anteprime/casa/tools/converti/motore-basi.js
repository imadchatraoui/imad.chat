/* Convertitore — le basi: binario, ottale, decimale, esadecimale. Numeri interi di qualsiasi grandezza (BigInt) fino a 4096 bit,
   anche scritti come conto: 2^64, 2^64 - 1, -2^63, 0xff + 1. Si dice sempre come si è letto un numero («letto come decimale»):
   1010 può essere mille e dieci o dieci; la pagina lo legge in decimale e offre le altre letture, non le nasconde.
   Plain script, ES2017. */
(function (G) {
  "use strict";
  var CV = G.CV = G.CV || {};
  var B = G.BigInt, ZERO = B(0), UNO = B(1), DUE = B(2);
  var LIMITE = 4096;
  var NOMI = { 2: "binario", 8: "ottale", 10: "decimale", 16: "esadecimale" };
  var CIFRE = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i };
  var PAROLE = { bin: 2, binario: 2, binary: 2, b: 2, base2: 2, oct: 8, ottale: 8, octal: 8, o: 8, base8: 8, dec: 10, decimale: 10, decimal: 10, d: 10, base10: 10,
    hex: 16, esadecimale: 16, esa: 16, hexadecimal: 16, h: 16, base16: 16 };

  function daCifre(s, base) {
    var b = B(base), v = ZERO; s = s.toLowerCase();
    for (var i = 0; i < s.length; i++) v = v * b + B(parseInt(s.charAt(i), base));
    return v;
  }
  function bits(v) { if (v < ZERO) v = -v; return v === ZERO ? 0 : v.toString(2).length; }
  /* un numero con il suo prefisso: 0x1f, 0b101, 0o17, 1f (se la lettura è 16) */
  function numero(t, lettura) {
    var m = t.match(/^0([xbo])([0-9a-f_]+)$/i);
    if (m) {
      var base = { x: 16, b: 2, o: 8 }[m[1].toLowerCase()], c = m[2].replace(/_/g, "");
      if (!CIFRE[base].test(c)) return { errore: "«" + t + "» non è un numero " + NOMI[base] + ": in " + NOMI[base] + " vanno solo " + (base === 2 ? "0 e 1" : base === 8 ? "le cifre da 0 a 7" : "le cifre e le lettere da a a f") + "." };
      return { v: daCifre(c, base), base: base, prefisso: true };
    }
    var p = t.replace(/_/g, "");
    if (CIFRE[lettura].test(p)) return { v: daCifre(p, lettura), base: lettura };
    if (CIFRE[16].test(p)) return { v: daCifre(p, 16), base: 16, lettere: true };
    return null;
  }
  /* un piccolo conto: + − × ^ e parentesi, solo interi */
  function conto(s, lettura) {
    var tok = s.match(/0[xbo][0-9a-f_]+|[0-9a-f_]+|\*\*|[-+*^()×·]/gi);
    if (!tok || tok.join("") !== s.replace(/\s+/g, "")) return null;
    var i = 0, basi = [], err = null, lettere = false;
    function prossimo() { return tok[i]; }
    function primario() {
      var t = tok[i++];
      if (t === "(") { var v = somma(); if (tok[i++] !== ")") throw new Error("manca una parentesi"); return v; }
      if (t === "-") return -potenza();
      if (t === "+") return potenza();
      if (t === undefined) throw new Error("conto a metà");
      var n = numero(t, lettura); if (!n) throw new Error("«" + t + "» non è un numero");
      if (n.errore) { err = n.errore; throw new Error(n.errore); }
      basi.push(n.base); if (n.lettere) lettere = true; return n.v;
    }
    function potenza() {
      var b = primario();
      if (prossimo() === "^" || prossimo() === "**") {
        i++; var e = potenza();
        if (e < ZERO) throw new Error("solo esponenti positivi");
        if (bits(b) * Number(e) > LIMITE + 64 && b !== UNO && b !== ZERO && b !== -UNO) throw new Error("troppo grande");
        var r = UNO; for (var k = ZERO; k < e; k++) r *= b; return r;
      }
      return b;
    }
    function prodotto() { var v = potenza(); while (prossimo() === "*" || prossimo() === "×" || prossimo() === "·") { i++; v *= potenza(); } return v; }
    function somma() { var v = prodotto(); while (prossimo() === "+" || prossimo() === "-") { var o = tok[i++], w = prodotto(); v = o === "+" ? v + w : v - w; } return v; }
    try { var v = somma(); if (i !== tok.length) return null; return { v: v, basi: basi, lettere: lettere, conto: tok.length > 1 }; }
    catch (e) { return { errore: err || (e.message === "troppo grande" ? "Troppo grande: qui si arriva a " + LIMITE + " bit." : "Il conto non torna: " + e.message + ".") }; }
  }

  /* → { stato: "ok", v, base (come si è letto), conto, a (base di destinazione o null), letture: [basi possibili] } | errore | no */
  function leggi(testo, inBasi, lettura) {
    var s = String(testo || "").trim().replace(/−/g, "-").replace(/[   ]/g, " ");
    if (!s) return { stato: "vuoto" };
    var a = null, m = s.match(/^(.*?)\s+(?:in|a|to|->|→)\s+([a-z0-9]+)$/i);
    if (m && PAROLE[m[2].toLowerCase()]) { a = PAROLE[m[2].toLowerCase()]; s = m[1]; }
    var dichiarata = null; m = s.match(/^(.*?)\s*(?:\(|\s)(bin|binario|binary|oct|ottale|octal|dec|decimale|decimal|hex|esadecimale|esa|base\s?(?:2|8|10|16))\)?$/i);
    if (m && /[0-9a-f]/i.test(m[1])) { dichiarata = PAROLE[m[2].toLowerCase().replace(/\s/g, "")]; s = m[1]; }
    var segnali = a || dichiarata || /0[xbo][0-9a-f]/i.test(s) || /\d\s*(\^|\*\*)\s*\d/.test(s);
    if (!inBasi && !segnali) return { stato: "no" };
    if (/^[+-]?\d+[.,]\d+$/.test(s)) return { stato: "errore", messaggio: "Qui solo numeri interi: «" + s + "» ha una parte dopo la virgola." };
    var let0 = dichiarata || lettura || 10;
    var r = conto(s.replace(/\s+/g, ""), let0);
    if (!r) return inBasi ? { stato: "errore", messaggio: "Non capisco «" + s + "»: scrivi un numero, come 255, 0xff, 0b1010 o 2^64." } : { stato: "no" };
    if (r.errore) return { stato: "errore", messaggio: r.errore };
    if (bits(r.v) > LIMITE) return { stato: "errore", messaggio: "Troppo grande: qui si arriva a " + LIMITE + " bit (questo ne ha " + bits(r.v) + ")." };
    /* le letture possibili di un numero solo, senza prefisso */
    var letture = [];
    var nudo = s.replace(/^[+-]/, "").replace(/_/g, "");
    if (!r.conto && !/^0[xbo]/i.test(nudo)) [2, 8, 10, 16].forEach(function (b) { if (CIFRE[b].test(nudo)) letture.push(b); });
    var base = r.basi.length === 1 ? r.basi[0] : 10;
    if (r.lettere && !dichiarata && let0 !== 16) base = 16;
    return { stato: "ok", v: r.v, base: base, conto: r.conto, a: a, letture: letture, dichiarata: !!dichiarata };
  }

  var SP = " ";
  function raggruppa(s, n) { var out = ""; for (var i = s.length; i > 0; i -= n) out = s.slice(Math.max(0, i - n), i) + (out ? SP + out : ""); return out; }
  function formati(v) {
    var neg = v < ZERO, a = neg ? -v : v, sg = neg ? "−" : "", sc = neg ? "-" : "";
    var b2 = a.toString(2), b8 = a.toString(8), b10 = a.toString(10), b16 = a.toString(16).toUpperCase();
    var nb = bits(v);
    var r = {
      2: { testo: sg + raggruppa(b2, 4), copia: sc + b2, prefisso: "0b" },
      8: { testo: sg + raggruppa(b8, 3), copia: sc + b8, prefisso: "0o" },
      10: { testo: sg + raggruppa(b10, 3), copia: sc + b10, prefisso: "" },
      16: { testo: sg + raggruppa(b16, 4), copia: sc + b16, prefisso: "0x" },
      bit: nb, cifre: b10.length
    };
    /* in quali interi a larghezza fissa entra (come nei programmi): senza segno e con segno */
    r.larghezze = [8, 16, 32, 64, 128].map(function (w) {
      var W = B(w), max = (UNO << W) - UNO, smin = -(UNO << (W - UNO)), smax = (UNO << (W - UNO)) - UNO;
      return { w: w, senza: !neg && v <= max, con: v >= smin && v <= smax };
    });
    if (neg) {
      var w = r.larghezze.filter(function (x) { return x.con; })[0];
      if (w) {
        var c2 = (UNO << B(w.w)) + v;
        r.complemento = { w: w.w, hex: raggruppa(c2.toString(16).toUpperCase().padStart(w.w / 4, "0"), 4), bin: raggruppa(c2.toString(2).padStart(w.w, "0"), 4), copiaHex: c2.toString(16).toUpperCase().padStart(w.w / 4, "0"), copiaBin: c2.toString(2).padStart(w.w, "0") };
      }
    }
    return r;
  }
  CV.basi = { leggi: leggi, formati: formati, NOMI: NOMI, LIMITE: LIMITE, bits: bits };
})(typeof window !== "undefined" ? window : globalThis);
