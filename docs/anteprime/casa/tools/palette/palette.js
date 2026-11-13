/* Palette — il secondo strumento di imad.chat. Tutto si calcola qui, sul telefono: niente viene caricato, niente esce.
   Sopra window.PaletteCore (colore.js) e il guscio comune (../../comune/pagina.js). Plain script, ES2017 al massimo.

   COME È FATTO
   - Lo stato S: cinque colori voluti in OKLCH (S.c), quali sono bloccati (S.lock), quale si modifica (S.sel), l'armonia, il
     formato da esportare. Si ricorda sul dispositivo (localStorage "imad.palette", dentro try/catch) e sta anche nell'indirizzo
     (?c=3b3550-5f5478-…): l'indirizzo riapre la stessa palette ovunque, il dispositivo ricorda anche i lucchetti.
   - Quello che si vede (la «vista»: i cinque colori, l'inchiostro sopra ciascuno, i ruoli della prova) va verso quello voluto
     con un solo movimento disegnato qui (vola): i colori passano in OKLCH, la tinta per la via più corta, mai dal grigio; le
     colonne partono una dopo l'altra (28 ms), il testo scende appena e risale (anticipo, oltre, fermo), le cifre HEX rotolano,
     i numeri del contrasto e dei cursori contano fino al valore nuovo. Tutto finisce entro 600 ms; con «meno movimento» (o
     ?shot=1) si va subito allo stato finale. Mentre si trascina un cursore niente si anima: il colore segue il dito.
   - Un colore fuori dallo schermo (sRGB) si taglia abbassando la croma, e la pagina lo dice (PaletteCore.mappa).
   window.__palette: per le prove. */
(function () {
  "use strict";
  var doc = document, win = window, C = win.PaletteCore;
  if (!C) return;
  var $ = function (id) { return doc.getElementById(id); };
  var qsa = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  var QS = new URLSearchParams(location.search);
  var SHOT = QS.get("shot") === "1";
  var mqReduce = win.matchMedia("(prefers-reduced-motion: reduce)");
  var mqWide = win.matchMedia("(min-width: 900px), (min-width: 600px) and (max-height: 520px) and (orientation: landscape)");
  var mqFine = win.matchMedia("(hover: hover) and (pointer: fine)");
  function fermo() { return SHOT || mqReduce.matches; }
  function now() { return win.performance && performance.now ? performance.now() : Date.now(); }
  var clamp = C.clamp;
  function bezier(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var u = 1 - t, xt = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t - x;
        var dx = 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
        if (Math.abs(xt) < 1e-5 || Math.abs(dx) < 1e-6) break;
        t = clamp(t - xt / dx, 0, 1);
      }
      var v = 1 - t; return 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t;
    };
  }
  var piana = bezier(0.2, 0.9, 0.25, 1);
  var raf = win.requestAnimationFrame ? function (f) { return win.requestAnimationFrame(f); } : function (f) { return setTimeout(function () { f(now()); }, 16); };
  function virgola(n, d) { return n.toFixed(d).replace(".", ","); }
  function giu2(r) { return Math.floor(r * 100 + 1e-9) / 100; }   /* il contrasto non si arrotonda mai per eccesso: 4,499 resta 4,49 */
  var T = win.__palette = { voli: 0, tempi: [], salvati: [], js: [] };

  var pa = $("pa"), carta = $("carta"), lato = $("lato"), fileEl = $("file"), azioni = $("azioni");
  var annuncio = $("annuncio"), bollaEl = $("bolla");
  var rnd = QS.get("seme") ? C.seme(parseInt(QS.get("seme"), 10) || 1) : Math.random;

  /* ================================================================== lo stato */
  var LUCI = [0.32, 0.46, 0.6, 0.74, 0.88];
  /* la prima palette: «crepuscolo», la stessa che la scheda di Palette mostra ferma nell'indice degli strumenti */
  var PRIMA = [[0.085, 270], [0.095, 295], [0.1, 335], [0.09, 25], [0.06, 60]].map(function (q, k) { var m = C.mappa(LUCI[k], q[0], q[1]); return { l: m.l, c: m.c, h: m.h }; });
  var S = { c: PRIMA.slice(), lock: [false, false, false, false, false], sel: 2, arm: "libera", fmt: "css" };
  function daHex(h, hPrima) { var x = C.hexLch(h); if (x.c < 0.002 && hPrima !== undefined) x.h = hPrima; return { l: x.l, c: x.c, h: x.h }; }
  (function () {
    var s = null;
    try { s = JSON.parse(win.localStorage.getItem("imad.palette") || "null"); } catch (e) { s = null; }
    var link = (QS.get("c") || "").split(/[-,. ]/).map(C.leggiHex).filter(Boolean);
    if (s && typeof s === "object") {
      if (C.TIPI.indexOf(s.arm) >= 0) S.arm = s.arm;
      if (["css", "tw4", "tw3", "link"].indexOf(s.fmt) >= 0) S.fmt = s.fmt;
      if (s.sel >= 0 && s.sel < 5) S.sel = s.sel | 0;
      var sc = Array.isArray(s.c) ? s.c.map(C.leggiHex).filter(Boolean) : [];
      if (sc.length === 5 && !link.length) { S.c = sc.map(function (h) { return daHex(h); }); if (Array.isArray(s.lock)) S.lock = s.lock.slice(0, 5).map(Boolean); }
      else if (sc.length === 5 && link.length === 5 && sc.join() === link.join() && Array.isArray(s.lock)) S.lock = s.lock.slice(0, 5).map(Boolean);
    }
    if (link.length === 5) S.c = link.map(function (h) { return daHex(h); });
    while (S.lock.length < 5) S.lock.push(false);
  })();
  var V = [];   /* quello che lo schermo mostra per S.c: PaletteCore.mappa */
  function calcola() { V = S.c.map(function (x) { return C.mappa(x.l, x.c, x.h); }); T.V = V; }
  calcola();
  function hexes() { return V.map(function (v) { return v.hex; }); }
  var nomiCache = {};
  function nomeDi(hex) { if (!nomiCache[hex]) nomiCache[hex] = C.nome(hex); return nomiCache[hex]; }
  function nomeBreve(hex) { var n = nomeDi(hex); return (n.d < 0.0005 ? "" : "≈ ") + n.nome; }

  var memT = 0;
  function ricorda() {
    clearTimeout(memT);
    memT = setTimeout(function () {
      try { win.localStorage.setItem("imad.palette", JSON.stringify({ c: hexes(), lock: S.lock, sel: S.sel, arm: S.arm, fmt: S.fmt })); } catch (e) { /* senza memoria va bene lo stesso */ }
      /* l'indirizzo segue la palette (senza nuove voci nella cronologia): ricaricare o mandarlo riapre questi colori */
      try {
        var q = new URLSearchParams(location.search); q.set("c", hexes().map(function (h) { return h.slice(1); }).join("-")); q.delete("seme");
        win.history.replaceState(win.history.state, "", location.pathname + "?" + q.toString() + location.hash);
      } catch (e) { /* va bene lo stesso */ }
    }, 220);
  }
  function linkPalette() { return location.origin + location.pathname + "?c=" + hexes().map(function (h) { return h.slice(1); }).join("-"); }

  /* ================================================================== l'inchiostro e i ruoli della prova */
  var BIANCO = { l: 1, c: 0, h: 0 }, NERO_HEX = "#16171d", NERO = daHex(NERO_HEX);
  function inchiostro(hex) { return C.contrasto(hex, "#ffffff") >= C.contrasto(hex, NERO_HEX) ? BIANCO : NERO; }
  function accento(fondo, via) {
    var best = -1, bs = -1, alt = -1, as = -1;
    for (var i = 0; i < 5; i++) {
      if (via.indexOf(i) >= 0) continue;
      var r = C.contrasto(V[i].hex, V[fondo].hex), s = V[i].c + (r >= 3 ? 1 : 0);
      if (s > bs) { bs = s; best = i; }
      if (r > as) { as = r; alt = i; }
    }
    return best >= 0 ? best : alt;
  }
  function ruoli() {
    var idx = [0, 1, 2, 3, 4].sort(function (a, b) { return V[a].l - V[b].l; });
    function uno(f, t, chiaro) {
      var a = accento(f, [f, t]), ch = accento(f, [f, t, a]);
      var pf = V[f], ps = chiaro ? { l: Math.min(0.995, pf.l + 0.035), c: pf.c * 0.5, h: pf.h } : { l: Math.min(0.9, pf.l + 0.055), c: pf.c, h: pf.h };
      var pb = V[a].hex, pbt = C.contrasto(pb, "#ffffff") >= C.contrasto(pb, NERO_HEX) ? BIANCO : NERO;
      return { pf: { l: pf.l, c: pf.c, h: pf.h }, ps: ps, pt: { l: V[t].l, c: V[t].c, h: V[t].h }, pb: { l: V[a].l, c: V[a].c, h: V[a].h }, pbt: pbt, pc: { l: V[ch].l, c: V[ch].c, h: V[ch].h } };
    }
    return { cl: uno(idx[4], idx[0], true), sc: uno(idx[0], idx[4], false) };
  }

  /* ================================================================== le colonne */
  var HEXC = "0123456789ABCDEF";
  var col = [];
  for (var i = 0; i < 5; i++) {
    var c = doc.createElement("div"); c.className = "pa-col";
    var sb = doc.createElement("button"); sb.type = "button"; sb.className = "pa-col__sel"; sb.setAttribute("role", "radio"); sb.setAttribute("data-i", i);
    var tx = doc.createElement("span"); tx.className = "pa-col__testo"; tx.setAttribute("aria-hidden", "true");
    var nm = doc.createElement("span"); nm.className = "pa-col__nome";
    var hx = doc.createElement("span"); hx.className = "pa-hex";
    var hh = doc.createElement("span"); hh.className = "pa-hex__h"; hh.textContent = "#"; hx.appendChild(hh);
    var rs = [];
    for (var j = 0; j < 6; j++) {
      var w = doc.createElement("span"); w.className = "pa-hex__c";
      var r = doc.createElement("i"); r.className = "pa-hex__g"; r.textContent = "0";
      w.appendChild(r); hx.appendChild(w); rs.push({ w: w, g: r, ch: "0", via: null });
    }
    tx.appendChild(nm); tx.appendChild(hx);
    var lk = doc.createElement("button"); lk.type = "button"; lk.className = "pa-lucchetto"; lk.setAttribute("data-i", i); lk.setAttribute("aria-pressed", "false");
    lk.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path class="pa-arco" d="M6.6 9V6.8a3.4 3.4 0 0 1 6.8 0V9"/><rect x="4.6" y="9" width="10.8" height="8" rx="2.4"/></svg>';
    c.appendChild(sb); c.appendChild(tx); c.appendChild(lk); fileEl.appendChild(c);
    col.push({ el: c, sel: sb, testo: tx, nome: nm, rs: rs, lk: lk, hex: "", nomeT: "" });
  }

  /* ================================================================== la matrice del contrasto */
  var matrice = $("matrice"), celle = [], testeC = [], testeR = [];
  (function () {
    var h = doc.createElement("div"); h.className = "pa-mrow"; h.setAttribute("role", "row");
    var vuoto = doc.createElement("span"); vuoto.setAttribute("role", "columnheader"); vuoto.setAttribute("aria-label", "Testo sul fondo"); h.appendChild(vuoto);
    for (var j = 0; j < 5; j++) {
      var t = doc.createElement("span"); t.className = "pa-mtesta"; t.setAttribute("role", "columnheader"); t.setAttribute("aria-label", "Fondo del colore " + (j + 1));
      t.innerHTML = "<i></i>"; h.appendChild(t); testeC.push(t.firstChild);
    }
    matrice.appendChild(h);
    for (var i = 0; i < 5; i++) {
      var row = doc.createElement("div"); row.className = "pa-mrow"; row.setAttribute("role", "row");
      var rh = doc.createElement("span"); rh.className = "pa-mriga"; rh.setAttribute("role", "rowheader"); rh.setAttribute("aria-label", "Testo del colore " + (i + 1));
      rh.innerHTML = '<i class="pa-mtesta" style="display:block;height:12px"><i></i></i>'; testeR.push(rh.firstChild.firstChild);
      row.appendChild(rh); celle.push([]);
      for (var j2 = 0; j2 < 5; j2++) {
        var ce = doc.createElement("span"); ce.className = "pa-cel" + (i === j2 ? " pa-cel--io" : ""); ce.setAttribute("role", "cell");
        var o = { el: ce, r: 0, shown: "" };
        if (i !== j2) {
          ce.innerHTML = '<span class="pa-cel__aa" aria-hidden="true">Aa</span><span class="pa-cel__r" aria-hidden="true"><b></b><i></i></span>';
          o.b = ce.querySelector("b"); o.v = ce.querySelector("i");
        } else ce.setAttribute("aria-label", "Lo stesso colore");
        row.appendChild(ce); celle[i].push(o);
      }
      matrice.appendChild(row);
    }
  })();
  var VERD = { AAA: "AAA", AA: "AA", grande: "grande", no: "no" };
  var VERD_LUNGO = { AAA: "AAA", AA: "AA", grande: "solo testo grande", no: "non basta" };

  /* ================================================================== la ruota, le prove, i cursori */
  var ruota = $("ruota"), punti = qsa("i", ruota);
  (function () {
    var st = [];
    for (var h = 0; h <= 360; h += 30) st.push(C.mappa(0.74, 0.12, h).hex);
    ruota.style.setProperty("--pa-ruota", "conic-gradient(from 90deg, " + st.join(", ") + ")");
  })();
  var prove = { cl: doc.querySelector(".pa-prova--chiaro"), sc: doc.querySelector(".pa-prova--scuro") };
  var vistaIO = null;
  var rL = $("rL"), rC = $("rC"), rH = $("rH"), vL = $("vL"), vC = $("vC"), vH = $("vH"), fHex = $("fHex");
  if (win.IntersectionObserver) {
    vistaIO = new IntersectionObserver(function (es) { es.forEach(function (e) { vede[e.target.__vede] = e.isIntersecting; }); }, { rootMargin: "80px 0px" });
    [[ruota, "ruota"], [matrice, "mat"], [doc.getElementById("prove"), "prove"], [doc.getElementById("sezMod"), "mod"]].forEach(function (q) { if (q[0]) { q[0].__vede = q[1]; vistaIO.observe(q[0]); } });
  }
  var cursori = doc.querySelector(".pa-cursori"), modCerchio = doc.querySelector(".pa-mod-cerchio");

  /* ================================================================== la vista: cosa si vede adesso, e come ci si arriva */
  function copia(x) { return { l: x.l, c: x.c, h: x.h }; }
  function bersaglio() {
    var rr = ruoli();
    return { slot: V.map(copia), ink: V.map(function (v) { return copia(inchiostro(v.hex)); }), ruoli: rr };
  }
  var vista = null, volo = null;
  function hexDi(x) { return C.mappa(x.l, x.c, x.h).hex; }
  function rgba(x, a) { var m = C.mappa(x.l, x.c, x.h).rgb; return "rgba(" + m[0] + ", " + m[1] + ", " + m[2] + ", " + a + ")"; }
  function scriviRuoli(el, r, chiaro) {
    var s = el.style;
    s.setProperty("--pf", hexDi(r.pf)); s.setProperty("--ps", hexDi(r.ps)); s.setProperty("--pt", hexDi(r.pt));
    s.setProperty("--pb", hexDi(r.pb)); s.setProperty("--pbt", hexDi(r.pbt)); s.setProperty("--pc", rgba(r.pc, chiaro ? 0.24 : 0.3));
    s.setProperty("--pct", hexDi(r.pt)); s.setProperty("--psh", chiaro ? "rgba(0, 0, 0, .06)" : "rgba(255, 255, 255, .07)");
  }
  /* i colori si scrivono sugli elementi che li usano (mai su un antenato comune: una variabile su .pa rifarebbe lo stile di tutta
     la pagina a ogni fotogramma), e solo quelli che cambiano */
  /* durante un movimento si scrive solo quello che si vede (la carta sempre; la ruota, la matrice, la prova e i cursori solo se
     sono sullo schermo: IntersectionObserver); all'ultimo passo si scrive tutto. Così il telefono rifà lo stile di poche cose. */
  var scritti = { c: [], k: [], mc: [], mk: [], sel: "" };
  var vede = { ruota: true, mat: true, prove: true, mod: true };
  function metti(el, k, v) { el.style.setProperty(k, v); }
  function scrivi(vv, parziale) {
    var hx = vv.slot.map(hexDi), ik = vv.ink.map(hexDi), i, j, tutto = !parziale;
    for (i = 0; i < 5; i++) {
      if (hx[i] !== scritti.c[i] || ik[i] !== scritti.k[i]) { metti(col[i].el, "--c", hx[i]); metti(col[i].el, "--k", ik[i]); }
      if (tutto || vede.ruota) {
        if (punti[i].__c !== hx[i]) { metti(punti[i], "--c", hx[i]); punti[i].__c = hx[i]; }
        var s = vv.slot[i], d = Math.min(1, s.c / 0.24) * 22, a = s.h.toFixed(1) + "deg", dd = d.toFixed(2) + "px";
        if (punti[i].__a !== a) { metti(punti[i], "--a", a); punti[i].__a = a; }
        if (punti[i].__d !== dd) { metti(punti[i], "--d", dd); punti[i].__d = dd; }
      }
    }
    scritti.c = hx; scritti.k = ik;
    if (tutto || vede.mat) {
      var mc = scritti.mc, mk = scritti.mk;
      for (i = 0; i < 5; i++) if (hx[i] !== mc[i]) { metti(testeC[i], "--c", hx[i]); metti(testeR[i], "--c", hx[i]); }
      for (i = 0; i < 5; i++) for (j = 0; j < 5; j++) {
        if (hx[i] === mc[i] && hx[j] === mc[j] && ik[j] === mk[j]) continue;
        var e = celle[i][j].el; metti(e, "--f", hx[i]); metti(e, "--b", hx[j]); metti(e, "--k", ik[j]);
      }
      scritti.mc = hx; scritti.mk = ik;
    }
    if (tutto || vede.mod) {
      if (hx[S.sel] !== scritti.sel) { metti(modCerchio, "--c", hx[S.sel]); metti(cursori, "--c", hx[S.sel]); scritti.sel = hx[S.sel]; }
      piste(vv.slot[S.sel]);
    }
    if (tutto || vede.prove) { scriviRuoli(prove.cl, vv.ruoli.cl, true); scriviRuoli(prove.sc, vv.ruoli.sc, false); }
  }
  /* le piste dei cursori: i colori che quel cursore raggiunge davvero, con gli altri due valori fermi */
  function piste(x) {
    var a = [], b = [], h = [], k, m;
    for (k = 0; k <= 12; k++) a.push(C.mappa(k / 12, x.c, x.h).hex);
    var mc = C.maxCroma(x.l, x.h), fin = Math.min(1, mc / 0.37);
    for (k = 0; k <= 8; k++) b.push(C.mappa(x.l, mc * k / 8, x.h).hex + " " + (fin * k / 8 * 100).toFixed(1) + "%");
    for (k = 0; k <= 12; k++) { m = C.mappa(x.l, x.c, k * 30); h.push(m.hex); }
    var pa1 = "linear-gradient(90deg, " + a.join(", ") + ")", pb1 = "linear-gradient(90deg, " + b.join(", ") + ", transparent " + (fin * 100).toFixed(1) + "%)", ph1 = "linear-gradient(90deg, " + h.join(", ") + ")";
    if (rL.__p !== pa1) { rL.style.setProperty("--pista", pa1); rL.__p = pa1; }
    if (rC.__p !== pb1) { rC.style.setProperty("--pista", pb1); rC.__p = pb1; }
    if (rH.__p !== ph1) { rH.style.setProperty("--pista", ph1); rH.__p = ph1; }
  }
  function misto3(a, b, t) {
    return { slot: a.slot.map(function (x, i) { return C.misto(x, b.slot[i], t[i]); }), ink: a.ink.map(function (x, i) { return C.misto(x, b.ink[i], t[i]); }),
      ruoli: { cl: mr(a.ruoli.cl, b.ruoli.cl, t[5]), sc: mr(a.ruoli.sc, b.ruoli.sc, t[5]) } };
  }
  function mr(a, b, t) { var o = {}; for (var k in a) o[k] = C.misto(a[k], b[k], t); return o; }

  /* i numeri che contano: il contrasto in ogni cella, i valori dei cursori */
  function numeri(t, finale) {
    if (finale || vede.mat) for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) {
      var o = celle[i][j]; if (!o.b) continue;
      var r = finale ? o.r : o.r0 + (o.r - o.r0) * t;
      var s = virgola(giu2(r), 2);
      if (s !== o.shown) { o.b.textContent = s; o.shown = s; }
    }
    var x = finale ? S.c[S.sel] : volo ? C.misto(volo.ed0, S.c[S.sel], t) : S.c[S.sel];
    vL.textContent = virgola(x.l * 100, 1) + " %"; vC.textContent = virgola(x.c, 3); vH.textContent = virgola(x.h, 0) + "°";
    /* i pomelli dei cursori vanno con i numeri (mai quello che il dito o la tastiera sta muovendo) */
    if (volo || finale) {
      var ae = doc.activeElement;
      if (ae !== rL) rL.value = (x.l * 100).toFixed(1);
      if (ae !== rC) rC.value = x.c.toFixed(3);
      if (ae !== rH) rH.value = x.h.toFixed(1);
    }
  }

  function vola(cosa) {
    var b = bersaglio();
    var vecchi = celle.map(function (r) { return r.map(function (o) { return o.r; }); });
    contrasti();
    if (!vista || fermo() || cosa === "subito") {
      vista = b; volo = null; scrivi(vista); numeri(1, true); testi(true); return;
    }
    var cambia = [0, 1, 2, 3, 4].map(function (i) { return hexDi(vista.slot[i]) !== hexDi(b.slot[i]); });
    var t0 = now(), da = vista, ordine = 0, rit = [];
    for (var i = 0; i < 5; i++) { rit.push(cambia[i] ? ordine * 28 : 0); if (cambia[i]) ordine++; }
    celle.forEach(function (r, i) { r.forEach(function (o, j) { o.r0 = vecchi[i][j]; }); });
    volo = { t0: t0, da: da, a: b, rit: rit, dur: 440, ed0: copia(vista.slot[S.sel]) };
    T.voli++;
    testi(false, cambia, rit);
    if (!loop) loop = raf(passo);
  }
  var loop = 0;
  function passo() {
    loop = 0; if (!volo) return;
    var tq = now(), t = tq - volo.t0, ts = [], fine = true;
    for (var i = 0; i < 5; i++) { var u = clamp((t - volo.rit[i]) / volo.dur, 0, 1); if (u < 1) fine = false; ts.push(piana(u)); }
    var ur = clamp((t - 40) / volo.dur, 0, 1); if (ur < 1) fine = false; ts.push(piana(ur));
    vista = fine ? volo.a : misto3(volo.da, volo.a, ts);
    scrivi(vista, !fine);
    numeri(piana(clamp(t / (volo.dur + 80), 0, 1)), fine);
    T.js.push(now() - tq); if (T.js.length > 400) T.js.shift();
    if (fine) { volo = null; T.tempi.push(Math.round(t)); dopo(); return; }
    loop = raf(passo);
  }

  /* i testi: le cifre HEX (rotolano da sole, con il CSS), i nomi (cambiano a metà, con una piccola salita), le etichette */
  function testi(subito, cambia, rit) {
    var hs = hexes();
    col.forEach(function (o, i) {
      var h = hs[i].slice(1).toUpperCase();
      if (h !== o.hex) {
        for (var j = 0; j < 6; j++) cifra(o.rs[j], h.charAt(j), subito ? -1 : (rit ? rit[i] : 0) + j * 16);
        o.hex = h;
      }
      var nt = nomeBreve(hs[i]);
      if (nt !== o.nomeT) {
        o.nomeT = nt;
        if (subito || !o.nome.animate) o.nome.textContent = nt;
        else setTimeout(function () { o.nome.textContent = nt; }, (rit ? rit[i] : 0) + 160);
      }
      if (!subito && cambia && cambia[i] && o.testo.animate) {
        o.testo.animate([{ transform: "none" }, { transform: "translateY(5px)", offset: 0.2 }, { transform: "translateY(-3px)", offset: 0.62 }, { transform: "none" }],
          { duration: 440, delay: rit[i], easing: "cubic-bezier(.3, .7, .4, 1)" });
      }
      var on = i === S.sel;
      o.el.classList.toggle("is-sel", on);
      o.sel.setAttribute("aria-checked", on ? "true" : "false"); o.sel.tabIndex = on ? 0 : -1;
      o.sel.setAttribute("aria-label", "Colore " + (i + 1) + ", " + hs[i].toUpperCase() + ", " + (nomeDi(hs[i]).d < 0.0005 ? "" : "vicino a ") + nomeDi(hs[i]).nome + (S.lock[i] ? ", bloccato" : ""));
      o.lk.setAttribute("aria-pressed", S.lock[i] ? "true" : "false");
      o.lk.setAttribute("aria-label", (S.lock[i] ? "Sblocca" : "Blocca") + " il colore " + (i + 1));
    });
    editore();
    celle.forEach(function (r, i) {
      r.forEach(function (o, j) {
        if (!o.b) return;
        var v = C.verdetto(o.r);
        o.el.setAttribute("data-v", v); o.v.textContent = VERD[v];
        o.el.setAttribute("aria-label", "Testo del colore " + (i + 1) + " sul fondo del colore " + (j + 1) + ": " + virgola(giu2(o.r), 2) + " a 1, " + VERD_LUNGO[v]);
      });
    });
    somma();
    if (subito) dopo();
  }
  /* una cifra HEX che rotola: la vecchia sale di una riga e svanisce, la nuova sale da sotto e si posa (340 ms, con il ritardo
     della sua colonna e della sua posizione). Una cifra uguale resta ferma. */
  var ROT = [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-100%)", opacity: 0 }];
  var ROT2 = [{ transform: "translateY(100%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }];
  function cifra(o, ch, ritardo) {
    if (ch === o.ch) return;
    o.ch = ch;
    if (o.via && o.via.parentNode) o.via.parentNode.removeChild(o.via);
    o.via = null;
    if (ritardo < 0 || fermo() || !o.g.animate) { o.g.textContent = ch; return; }
    var vecchia = o.g, nuova = doc.createElement("i");
    nuova.className = "pa-hex__g"; nuova.textContent = ch;
    vecchia.className = "pa-hex__g pa-hex__g--via";
    o.w.appendChild(nuova); o.g = nuova; o.via = vecchia;
    var opt = { duration: 340, delay: ritardo, easing: "cubic-bezier(.2, .9, .25, 1)", fill: "both" };
    vecchia.animate(ROT, opt).onfinish = function () { if (vecchia.parentNode) vecchia.parentNode.removeChild(vecchia); if (o.via === vecchia) o.via = null; };
    nuova.animate(ROT2, opt).onfinish = function () { this.cancel(); };
  }
  /* quando il movimento è finito: le cose che costano o che non si vedono muoversi */
  var dopoT = 0;
  function dopo() {
    clearTimeout(dopoT);
    dopoT = setTimeout(function () { esporta(); miniatura(); ricorda(); }, 60);
  }
  function contrasti() {
    var hs = hexes();
    for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) celle[i][j].r = i === j ? 1 : C.contrasto(hs[i], hs[j]);
  }
  function somma() {
    var aa = 0, gr = 0;
    for (var i = 0; i < 5; i++) for (var j = i + 1; j < 5; j++) { var r = celle[i][j].r; if (r >= 4.5) aa++; else if (r >= 3) gr++; }
    var p = function (n) { return n === 1 ? "1 coppia" : n + " coppie"; };
    $("conSomma").textContent = (aa ? p(aa) + " su 10 " + (aa === 1 ? "va" : "vanno") + " bene per il testo normale" : "Nessuna coppia va bene per il testo normale") +
      (gr ? ", " + p(gr) + " solo per il testo grande." : ".");
  }

  /* ================================================================== modifica: il colore scelto */
  var modBlocca = $("modBlocca"), fuori = $("fuori"), aHex = $("aHex");
  function editore() {
    var i = S.sel, x = S.c[i], v = V[i];
    $("modN").textContent = i + 1;
    var n = nomeDi(v.hex);
    $("modNome").textContent = (n.d < 0.0005 ? "" : "vicino a ") + n.nome;
    scritti.sel = "";
    if (doc.activeElement !== rL) rL.value = (x.l * 100).toFixed(1);
    if (doc.activeElement !== rC) rC.value = x.c.toFixed(3);
    if (doc.activeElement !== rH) rH.value = x.h.toFixed(1);
    if (doc.activeElement !== fHex) { fHex.value = v.hex.toUpperCase(); fHex.classList.remove("is-errore"); aHex.hidden = true; }
    rL.setAttribute("aria-valuetext", virgola(x.l * 100, 1) + " per cento"); rC.setAttribute("aria-valuetext", virgola(x.c, 3)); rH.setAttribute("aria-valuetext", virgola(x.h, 0) + " gradi");
    modBlocca.setAttribute("aria-pressed", S.lock[i] ? "true" : "false");
    modBlocca.querySelector("span").textContent = S.lock[i] ? "Bloccato" : "Blocca";
    if (v.tagliato) {
      fuori.hidden = false;
      fuori.textContent = "Uno schermo comune (sRGB) non arriva a croma " + virgola(x.c, 3) + " con questa luce e questa tinta: si vede " + v.hex.toUpperCase() + ", con croma " + virgola(v.c, 3) + ". È quello che si esporta.";
    } else fuori.hidden = true;
    $("modCodice").textContent = "oklch(" + (v.l * 100).toFixed(1) + "% " + v.c.toFixed(3) + " " + v.h.toFixed(1) + ")";
  }

  /* ================================================================== cambiare la palette */
  var storia = [], bIndietro = $("bIndietro");
  function salvaStoria() { storia.push({ c: S.c.map(copia), lock: S.lock.slice() }); if (storia.length > 40) storia.shift(); bIndietro.disabled = false; }
  function applica(nuovi, cosa) {
    salvaStoria();
    S.c = nuovi.map(copia); calcola(); vola(cosa);
  }
  /* i candidati (cinque, dal più scuro al più chiaro) vanno nei posti liberi; ogni colore bloccato prende il posto del candidato
     più simile a lui, così una palette con un colore bloccato resta intera */
  function inserisci(cand) {
    var pool = cand.slice();
    S.lock.forEach(function (lk, i) {
      if (!lk || !pool.length) return;
      var a = C.lchToLab(S.c[i].l, S.c[i].c, S.c[i].h), bj = 0, bd = 1e9;
      pool.forEach(function (p, j) { var d = C.dist(a, C.lchToLab(p.l, p.c, p.h)); if (d < bd) { bd = d; bj = j; } });
      pool.splice(bj, 1);
    });
    var k = 0;
    return S.c.map(function (x, i) { return S.lock[i] ? x : pool[k++] || x; });
  }
  function tuttiBloccati() {
    if (S.lock.indexOf(false) >= 0) return false;
    bolla("Sono tutti bloccati: sbloccane uno.");
    col.forEach(function (o) { o.lk.classList.remove("is-no"); void o.lk.offsetWidth; o.lk.classList.add("is-no"); });
    return true;
  }
  var giri = 0;
  function nuova() {
    if (tuttiBloccati()) return;
    var t0 = now(), base = null;
    for (var i = 0; i < 5; i++) if (S.lock[i]) { base = copia(S.c[i]); break; }
    if (base) base.c = Math.max(base.c, 0.06); else base = C.baseCaso(rnd);
    var cand = C.armonia(S.arm, base, rnd);
    applica(inserisci(cand));
    giri++; var ic = doc.querySelector(".pa-ico--mescola"); if (ic && !fermo()) ic.style.transform = "rotate(" + giri * 180 + "deg)";
    T.ultimaNuova = now() - t0;
    annuncia("Palette nuova: " + hexes().map(function (h) { return h.toUpperCase(); }).join(", ") + ".");
  }
  function annuncia(s) { annuncio.textContent = ""; setTimeout(function () { annuncio.textContent = s; }, 30); }
  var bollaT = 0;
  function bolla(s) {
    clearTimeout(bollaT); bollaEl.textContent = s; bollaEl.classList.add("is-su"); annuncia(s);
    bollaT = setTimeout(function () { bollaEl.classList.remove("is-su"); }, 1700);
  }
  $("bNuova").addEventListener("click", nuova);
  bIndietro.addEventListener("click", indietro);
  function indietro() {
    var s = storia.pop(); if (!s) return;
    bIndietro.disabled = !storia.length;
    S.c = s.c; S.lock = s.lock; calcola(); vola();
    annuncia("Di nuovo la palette di prima.");
  }

  /* scegliere un colore, bloccarlo */
  function scegli(i, fuoco, tocco) {
    if (i === S.sel && !fuoco) { if (tocco) avvicina(); return; }
    S.sel = i; testi(true); scrivi(vista); numeri(1, true);
    if (fuoco) col[i].sel.focus();
    if (tocco) avvicina();
    ricorda();
  }
  function blocca(i, btn) {
    S.lock[i] = !S.lock[i];
    testi(true);
    [col[i].lk, btn].forEach(function (b) { if (!b || fermo()) return; b.classList.remove("is-scatto"); void b.offsetWidth; b.classList.add("is-scatto"); });
    annuncia((S.lock[i] ? "Colore " + (i + 1) + " bloccato: resta quando cambi palette." : "Colore " + (i + 1) + " sbloccato."));
    ricorda();
  }
  col.forEach(function (o, i) {
    o.sel.addEventListener("click", function (e) { scegli(i, false, e.detail > 0 && !mqWide.matches); });
    o.sel.addEventListener("keydown", function (e) {
      var k = e.key, j = -1;
      if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % 5; else if (k === "ArrowLeft" || k === "ArrowUp") j = (i + 4) % 5;
      else if (k === "Home") j = 0; else if (k === "End") j = 4;
      if (j < 0) return;
      e.preventDefault(); scegli(j, true);
    });
    o.lk.addEventListener("click", function (e) { blocca(i, null); if (e.detail > 0 && mqFine.matches) o.lk.blur(); });
    o.lk.addEventListener("animationend", function () { o.lk.classList.remove("is-scatto", "is-no"); });
  });
  modBlocca.addEventListener("click", function () { blocca(S.sel, modBlocca); });
  modBlocca.addEventListener("animationend", function () { modBlocca.classList.remove("is-scatto"); });
  /* sul telefono, toccare un colore lo porta a portata di pollice: se i cursori non si vedono, la pagina scende fin lì */
  function avvicina() {
    if (mqWide.matches) return;
    var sez = $("sezMod"), r = sez.getBoundingClientRect(), vh = win.innerHeight, barra = azioni.getBoundingClientRect().top;
    if (r.top > L.top + L.Hmin + 4 && r.top + 210 < barra) return;
    if (r.top < vh * 0.25 && r.top > L.top) return;
    var y = win.pageYOffset + r.top - (L.top + L.Hmin + 12);
    if (win.scrollTo) win.scrollTo({ top: Math.max(0, y), behavior: fermo() ? "auto" : "smooth" }); else win.scrollTo(0, y);
  }

  /* i cursori e il campo HEX: si cambia un colore solo, subito, senza movimento (il colore segue il dito) */
  var inGesto = false;
  function daCursori() {
    if (!inGesto) { salvaStoria(); inGesto = true; }
    var x = { l: (+rL.value) / 100, c: +rC.value, h: +rH.value };
    S.c[S.sel] = x; calcola(); vola("subito");
  }
  [rL, rC, rH].forEach(function (r) {
    r.addEventListener("input", daCursori);
    r.addEventListener("change", function () { inGesto = false; dopo(); });
  });
  var hexGesto = false;
  fHex.addEventListener("focus", function () { hexGesto = false; try { fHex.select(); } catch (e) { /* va bene */ } });
  fHex.addEventListener("input", function () {
    var v = fHex.value.replace(/[^0-9a-f#]/gi, "");
    if (v !== fHex.value) fHex.value = v;
    var h = /^#?[0-9a-f]{6}$/i.test(v) ? C.leggiHex(v) : null;
    fHex.classList.toggle("is-errore", !h && v.replace("#", "").length >= 6);
    aHex.hidden = !(!h && v.replace("#", "").length >= 6);
    if (!h || h === V[S.sel].hex) return;
    if (!hexGesto) { salvaStoria(); hexGesto = true; }
    S.c[S.sel] = daHex(h, S.c[S.sel].h); calcola(); vola("subito");
  });
  function hexFine() {
    /* tre cifre (#F0A) valgono solo quando si ha finito di scrivere: a metà di sei sarebbero un altro colore */
    var v = fHex.value.trim();
    if (/^#?[0-9a-f]{3}$/i.test(v)) { var h3 = C.leggiHex(v); if (h3 !== V[S.sel].hex) { if (!hexGesto) salvaStoria(); S.c[S.sel] = daHex(h3, S.c[S.sel].h); calcola(); vola("subito"); } }
    fHex.classList.remove("is-errore"); aHex.hidden = true; fHex.value = V[S.sel].hex.toUpperCase(); hexGesto = false; dopo();
  }
  fHex.addEventListener("blur", hexFine);
  fHex.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); fHex.blur(); } else if (e.key === "Escape") { fHex.blur(); } });
  $("bCopiaHex").addEventListener("click", function () { copiaTesto(V[S.sel].hex.toUpperCase(), $("bCopiaHex"), "Copiato " + V[S.sel].hex.toUpperCase()); });

  /* ================================================================== le armonie e i formati: pastiglie con la pillola */
  function gruppo(el, scegliV) {
    var bs = qsa('[role="radio"]', el);
    function metti(v, fuoco) {
      bs.forEach(function (b) {
        var on = b.getAttribute("data-v") === v;
        b.setAttribute("aria-checked", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;
        if (on && fuoco) b.focus();
      });
      pillola(el);
    }
    bs.forEach(function (b, i) {
      b.addEventListener("click", function () { var v = b.getAttribute("data-v"); metti(v); scegliV(v); });
      b.addEventListener("keydown", function (e) {
        var j = -1, k = e.key;
        if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % bs.length; else if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + bs.length) % bs.length;
        else if (k === "Home") j = 0; else if (k === "End") j = bs.length - 1;
        if (j < 0) return;
        e.preventDefault(); var v = bs[j].getAttribute("data-v"); metti(v, true); scegliV(v);
      });
    });
    return { metti: metti, el: el };
  }
  var gruppi = [];
  function pillola(el) {
    var p = el.querySelector(".pa-chips__pill"), b = el.querySelector('[aria-checked="true"]'); if (!p || !b) return;
    p.style.width = b.offsetWidth + "px"; p.style.transform = "translate(" + b.offsetLeft + "px, " + (b.offsetTop - 4) + "px)";
    var l = b.offsetLeft - 18, r = b.offsetLeft + b.offsetWidth + 18;
    var to = l < el.scrollLeft ? l : r > el.scrollLeft + el.clientWidth ? r - el.clientWidth : null;
    if (to !== null) { if (el.scrollTo) el.scrollTo({ left: to, behavior: fermo() ? "auto" : "smooth" }); else el.scrollLeft = to; }
  }
  function pillole() { gruppi.forEach(function (g) { var p = g.el.querySelector(".pa-chips__pill"); p.style.transition = "none"; pillola(g.el); void p.offsetWidth; p.style.transition = ""; }); }
  var ARM = {
    libera: "Ogni volta una ricetta diversa, sempre dal più scuro al più chiaro.",
    analoga: "Tinte vicine sulla ruota: calme, si fondono.",
    complementare: "Due tinte opposte sulla ruota: forti insieme.",
    divisa: "Una tinta e le due accanto alla sua opposta: contrasto, ma più morbido.",
    triade: "Tre tinte a un terzo di giro l'una dall'altra: vivace ed equilibrata.",
    sfumature: "Una tinta sola, dalla più scura alla più chiara.",
    neutri: "Quattro neutri appena tinti e un colore che spicca: buona per un'interfaccia."
  };
  var gArm = gruppo($("armonie"), function (v) { S.arm = v; $("armTesto").textContent = ARM[v]; nuova(); });
  var gFmt = gruppo($("formati"), function (v) { S.fmt = v; esporta(); ricorda(); });
  gruppi.push(gArm, gFmt);

  /* ================================================================== da una foto */
  var fFoto = $("fFoto"), fotoScegli = $("fotoScegli"), fotoFig = $("foto"), fotoCv = $("fotoCv"), fotoPunti = $("fotoPunti"), fotoNota = $("fotoNota"), bAncora = $("bAncora");
  var FOTO = null, semeFoto = 1;
  fFoto.addEventListener("focus", function () { fotoScegli.classList.add("is-focus"); });
  fFoto.addEventListener("blur", function () { fotoScegli.classList.remove("is-focus"); });
  fFoto.addEventListener("change", function () { var f = fFoto.files && fFoto.files[0]; if (f) apriFoto(f); fFoto.value = ""; });
  function apriFoto(file) {
    var t0 = now();
    function fatto(src, w, h) {
      if (!w || !h) { bolla("Questa foto non si apre qui: prova con un JPEG o un PNG."); return; }
      /* una copia piccola per i conti (al più 128 px di lato: 16 000 pixel bastano e costano poco) e una per vederla */
      var k = Math.min(1, 128 / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
      var pc = doc.createElement("canvas"); pc.width = sw; pc.height = sh;
      var px = pc.getContext("2d"); px.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in px) px.imageSmoothingQuality = "high";
      px.drawImage(src, 0, 0, sw, sh);
      var dati; try { dati = px.getImageData(0, 0, sw, sh); } catch (e) { bolla("Questa foto non si legge qui."); return; }
      var dpr = clamp(win.devicePixelRatio || 1, 1, 3), maxW = Math.max(160, fotoFig.parentNode.clientWidth - 36), maxH = 240;
      var vk = Math.min(maxW / w, maxH / h), vw = Math.round(w * vk), vh = Math.round(h * vk);
      fotoCv.width = Math.round(vw * dpr); fotoCv.height = Math.round(vh * dpr); fotoCv.style.width = vw + "px"; fotoCv.style.height = vh + "px";
      var fc = fotoCv.getContext("2d"); fc.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in fc) fc.imageSmoothingQuality = "high";
      fc.drawImage(src, 0, 0, fotoCv.width, fotoCv.height);
      if (src.close) src.close();
      FOTO = { dati: dati, w: sw, h: sh, apri: now() - t0 };
      semeFoto = 1; fotoFig.hidden = false; bAncora.hidden = false; $("fotoScegliT").textContent = "Un'altra foto";
      daFoto();
    }
    if (win.createImageBitmap) {
      win.createImageBitmap(file).then(function (b) { fatto(b, b.width, b.height); }, function () { conImg(); });
    } else conImg();
    function conImg() {
      var u = win.URL.createObjectURL(file), img = new Image();
      img.onload = function () { fatto(img, img.naturalWidth, img.naturalHeight); win.URL.revokeObjectURL(u); };
      img.onerror = function () { win.URL.revokeObjectURL(u); bolla("Questa foto non si apre qui: prova con un JPEG o un PNG."); };
      img.src = u;
    }
  }
  function daFoto() {
    if (!FOTO) return;
    var e = C.estrai(FOTO.dati.data, FOTO.w, FOTO.h, 5, semeFoto);
    if (!e) { bolla("In questa foto non ci sono pixel da leggere."); return; }
    T.foto = { ms: e.ms, giri: e.giri, pixel: e.pixel, colori: e.colori.map(function (c) { return c.hex; }), apri: Math.round(FOTO.apri) };
    fotoPunti.innerHTML = "";
    e.colori.forEach(function (c, k) {
      var p = doc.createElement("i"); p.className = "pa-punto";
      p.style.left = (c.x * 100).toFixed(2) + "%"; p.style.top = (c.y * 100).toFixed(2) + "%";
      p.style.setProperty("--p", c.hex); p.style.setProperty("--dl", (k * 70) + "ms");
      fotoPunti.appendChild(p);
    });
    var simili = 0;
    for (var i = 0; i < 5; i++) for (var j = i + 1; j < 5; j++) if (C.dist(C.hexLab(e.colori[i].hex), C.hexLab(e.colori[j].hex)) < 0.02) simili++;
    fotoNota.hidden = false;
    fotoNota.textContent = simili ? "Questa foto ha pochi colori diversi: alcuni dei cinque si somigliano molto." : "I cinque colori principali della foto, dal più scuro al più chiaro. I punti dicono dove si trovano.";
    if (S.lock.indexOf(false) < 0) { tuttiBloccati(); return; }
    applica(inserisci(e.colori.map(function (c) { return { l: c.l, c: c.c, h: c.h }; })));
    annuncia("Cinque colori dalla foto: " + hexes().map(function (h) { return h.toUpperCase(); }).join(", ") + ".");
  }
  bAncora.addEventListener("click", function () { semeFoto++; daFoto(); });
  /* sul computer una foto si può anche trascinare sulla pagina (la sezione si accende) o incollare (ctrl/cmd+V) */
  var sezFoto = $("sezFoto"), sopra = 0;
  function haFile(e) { var t = e.dataTransfer && e.dataTransfer.types; if (!t) return false; for (var i = 0; i < t.length; i++) if (t[i] === "Files") return true; return false; }
  function primaImmagine(l) { if (!l) return null; for (var i = 0; i < l.length; i++) if (l[i] && /^image\//.test(l[i].type || "")) return l[i]; return null; }
  function portaFoto() {
    var r = sezFoto.getBoundingClientRect();
    if (r.top < 0 || r.top > win.innerHeight - 160) sezFoto.scrollIntoView({ block: "start", behavior: fermo() ? "auto" : "smooth" });
  }
  doc.addEventListener("dragenter", function (e) {
    if (!haFile(e)) return;
    e.preventDefault(); sopra++; sezFoto.classList.add("is-sopra");
    if (sopra === 1) bolla("Lasciala dove vuoi: i colori si calcolano qui.");
  });
  doc.addEventListener("dragover", function (e) { if (!haFile(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; });
  doc.addEventListener("dragleave", function (e) { if (!haFile(e)) return; sopra = Math.max(0, sopra - 1); if (!sopra) sezFoto.classList.remove("is-sopra"); });
  doc.addEventListener("drop", function (e) {
    if (!haFile(e)) return;
    e.preventDefault(); sopra = 0; sezFoto.classList.remove("is-sopra");
    var f = primaImmagine(e.dataTransfer.files);
    if (f) { apriFoto(f); portaFoto(); } else bolla("Qui va una foto: un JPEG o un PNG.");
  });
  doc.addEventListener("paste", function (e) {
    var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") return;
    var f = primaImmagine(e.clipboardData && e.clipboardData.files);
    if (f) { e.preventDefault(); apriFoto(f); portaFoto(); }
  });

  /* ================================================================== esporta */
  var espCodice = $("espCodice"), espNota = $("espNota");
  var NOTE = {
    css: "Variabili CSS, con il colore anche in OKLCH e il nome CSS più vicino.",
    tw4: "Per Tailwind 4: nel CSS, dopo @import \"tailwindcss\". Poi bg-palette-1, text-palette-5…",
    tw3: "Per Tailwind 3: in tailwind.config.js. Poi bg-palette-1, text-palette-5…",
    link: "Questo indirizzo riapre la stessa palette, su qualsiasi telefono o computer."
  };
  function codici() {
    var hs = hexes();
    var css = ":root {\n" + hs.map(function (h, i) {
      var v = V[i], n = nomeDi(h);
      return "  /* oklch(" + (v.l * 100).toFixed(1) + "% " + v.c.toFixed(3) + " " + v.h.toFixed(1) + ") " + (n.d < 0.0005 ? "" : "\u2248 ") + n.nome + " */\n  --palette-" + (i + 1) + ": " + h + ";";
    }).join("\n") + "\n}\n";
    var tw4 = "@theme {\n" + hs.map(function (h, i) { return "  --color-palette-" + (i + 1) + ": " + h + ";"; }).join("\n") + "\n}\n";
    var tw3 = "// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n" +
      hs.map(function (h, i) { return "          " + (i + 1) + ": \"" + h + "\","; }).join("\n") + "\n        },\n      },\n    },\n  },\n};\n";
    return { css: css, tw4: tw4, tw3: tw3, link: linkPalette() };
  }
  function esporta() {
    var k = codici(); T.ultimi = k;
    espCodice.textContent = k[S.fmt]; espNota.textContent = NOTE[S.fmt];
  }
  $("bCopiaCod").addEventListener("click", function () { var k = codici(); copiaTesto(k[S.fmt], $("bCopiaCod"), S.fmt === "link" ? "Link copiato" : "Copiato"); });
  function copiaTesto(s, btn, parola) {
    function ok() { if (btn && !fermo()) { btn.classList.remove("is-fatto"); void btn.offsetWidth; btn.classList.add("is-fatto"); } bolla(parola); T.copiato = s; }
    function vecchio() {
      var ta = doc.createElement("textarea"); ta.value = s; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"; ta.style.opacity = "0"; ta.style.fontSize = "16px";
      doc.body.appendChild(ta); ta.select(); var fatto = false;
      try { fatto = doc.execCommand("copy"); } catch (e) { fatto = false; }
      doc.body.removeChild(ta);
      if (fatto) ok(); else bolla("Qui non si può copiare: tieni premuto sul testo.");
    }
    if (copiaOra(s)) { ok(); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(ok, function () { bolla("Qui non si può copiare: tieni premuto sul testo."); }); else vecchio();
  }
  function copiaOra(testo) {   /* subito, dentro il tocco: il modo che Safari su iPhone accetta sempre (gli appunti moderni lì possono rifiutare) */
    var ta = doc.createElement("textarea"), ok = false, prima = doc.activeElement;
    ta.value = testo; ta.setAttribute("readonly", ""); ta.setAttribute("aria-hidden", "true"); ta.setAttribute("data-appunti", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;margin:0;border:0;opacity:0;font-size:16px;pointer-events:none;";
    doc.body.appendChild(ta);
    try { ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, testo.length); ok = !!doc.execCommand("copy"); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    try { var s = window.getSelection(); if (s) s.removeAllRanges(); } catch (e) { }
    try { if (prima && prima.focus && /^(BUTTON|A)$/.test(prima.tagName)) prima.focus({ preventScroll: true }); } catch (e) { }
    return ok;
  }
  ["bPng", "bPngCond", "bCopiaCod", "bCopiaHex"].forEach(function (id) { var b = $(id); b.addEventListener("animationend", function () { b.classList.remove("is-fatto"); }); });

  /* l'immagine: 2160 × 2700 (il formato verticale dei telefoni), cinque colonne con il nome e il codice */
  var PW = 2160, PH = 2700;
  function caratteri(fn) {
    if (!doc.fonts || !doc.fonts.load) { fn(); return; }
    Promise.all([doc.fonts.load('650 40px "Manrope"'), doc.fonts.load('500 40px "Geist Mono"')]).then(fn, fn);
  }
  function disegnaPng(cv, w, h, conTesto) {
    var x = cv.getContext("2d"), hs = hexes(), cw = w / 5, s = w / PW;
    for (var i = 0; i < 5; i++) {
      x.fillStyle = hs[i]; x.fillRect(Math.round(i * cw), 0, Math.round((i + 1) * cw) - Math.round(i * cw), h);
    }
    if (!conTesto) return;
    x.textBaseline = "alphabetic"; x.textAlign = "left";
    for (var j = 0; j < 5; j++) {
      var ink = C.contrasto(hs[j], "#ffffff") >= C.contrasto(hs[j], NERO_HEX) ? "#ffffff" : NERO_HEX, x0 = Math.round(j * cw) + 44 * s, maxW = cw - 88 * s;
      x.fillStyle = ink;
      x.globalAlpha = 0.62; x.font = "500 " + Math.round(30 * s) + 'px "Geist Mono", ui-monospace, Menlo, monospace';
      x.fillText("0" + (j + 1), x0, 96 * s);
      x.globalAlpha = 1;
      var n = nomeDi(hs[j]), nt = (n.d < 0.0005 ? "" : "≈ ") + n.nome, fs = 44;
      x.font = "650 " + Math.round(fs * s) + 'px "Manrope", -apple-system, sans-serif';
      while (fs > 24 && x.measureText(nt).width > maxW) { fs -= 2; x.font = "650 " + Math.round(fs * s) + 'px "Manrope", -apple-system, sans-serif'; }
      x.globalAlpha = 0.86; x.fillText(nt, x0, h - 190 * s); x.globalAlpha = 1;
      x.font = "500 " + Math.round(54 * s) + 'px "Geist Mono", ui-monospace, Menlo, monospace';
      x.fillText(hs[j].toUpperCase(), x0, h - 110 * s);
    }
    x.globalAlpha = 0.62; x.textAlign = "right";
    x.font = "500 " + Math.round(30 * s) + 'px "Geist Mono", ui-monospace, Menlo, monospace';
    var inkU = C.contrasto(hs[4], "#ffffff") >= C.contrasto(hs[4], NERO_HEX) ? "#ffffff" : NERO_HEX;
    x.fillStyle = inkU; x.fillText("imad.chat", w - 44 * s, 96 * s);
    x.globalAlpha = 1; x.textAlign = "left";
  }
  function png(fn) {
    caratteri(function () {
      var cv = doc.createElement("canvas"); cv.width = PW; cv.height = PH; disegnaPng(cv, PW, PH, true);
      T.pngCanvas = cv;
      if (cv.toBlob) cv.toBlob(function (b) { fn(b); }, "image/png"); else fn(null);
    });
  }
  function nomeFile() { return "palette-" + hexes().map(function (h) { return h.slice(1); }).join("-") + ".png"; }
  function scarica(blob, name) {
    var u = win.URL.createObjectURL(blob), a = doc.createElement("a");
    a.href = u; a.download = name; a.rel = "noopener"; a.style.display = "none";
    doc.body.appendChild(a); a.click();
    setTimeout(function () { win.URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); }, 4000);
    T.salvati.push({ name: name, size: blob.size });
  }
  $("bPng").addEventListener("click", function () {
    var b0 = $("bPng");
    png(function (b) { if (!b) { bolla("Qui non si può salvare l'immagine."); return; } scarica(b, nomeFile()); if (!fermo()) { b0.classList.remove("is-fatto"); void b0.offsetWidth; b0.classList.add("is-fatto"); } bolla("Immagine salvata"); });
  });
  var puoFile = false;
  try { puoFile = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(["x"], { type: "image/png" })], "p.png", { type: "image/png" })] })); } catch (e) { puoFile = false; }
  $("bPngCond").hidden = !puoFile;
  $("bPngCond").addEventListener("click", function () {
    png(function (b) {
      if (!b) return;
      var f = null; try { f = new File([b], nomeFile(), { type: "image/png" }); } catch (e) { f = null; }
      if (!f) { scarica(b, nomeFile()); return; }
      navigator.share({ files: [f] }).then(function () { bolla("Condivisa"); }, function (e) { if (!e || e.name !== "AbortError") bolla("Non si è aperta la condivisione: usa Salva."); });
    });
  });
  var espCv = $("espCv");
  function miniatura() {
    var dpr = clamp(win.devicePixelRatio || 1, 1, 3), w = Math.round(76 * dpr), h = Math.round(95 * dpr);
    if (espCv.width !== w) { espCv.width = w; espCv.height = h; }
    disegnaPng(espCv, w, h, false);
  }
  /* il link: sul telefono il foglio di condivisione, altrove si copia */
  var bLink = $("bLink"), puoLink = !!navigator.share && !mqFine.matches;
  if (puoLink) $("bLinkT").textContent = "Condividi";
  bLink.addEventListener("click", function () {
    var u = linkPalette();
    if (puoLink) navigator.share({ title: "Palette", url: u }).then(function () { bolla("Condivisa"); }, function (e) { if (!e || e.name !== "AbortError") copiaTesto(u, null, "Link copiato"); });
    else copiaTesto(u, null, "Link copiato");
  });

  /* ================================================================== la tastiera: spazio per una palette nuova, ctrl/cmd+Z indietro */
  doc.addEventListener("keydown", function (e) {
    var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
    var campo = tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable);
    if ((e.key === " " || e.code === "Space") && !e.repeat && !campo && !e.metaKey && !e.ctrlKey && !e.altKey) {
      /* sui pulsanti lo spazio fa il loro lavoro; sulle colonne (che si scelgono già con il fuoco) fa una palette nuova */
      var pulsante = tag === "button" || tag === "a" || (t.getAttribute && t.getAttribute("role") === "radio");
      if (pulsante && !(t.classList && t.classList.contains("pa-col__sel"))) return;
      e.preventDefault(); nuova();
    } else if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey) && !e.shiftKey && !campo) { e.preventDefault(); indietro(); }
    else if (!campo && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-5]$/.test(e.key)) {
      /* da 1 a 5: si sceglie quel colore (il fuoco lo segue solo se era già su una colonna) */
      e.preventDefault(); scegli(+e.key - 1, !!(t.classList && t.classList.contains("pa-col__sel")));
    } else if (!campo && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && (e.key === "l" || e.key === "L")) { e.preventDefault(); blocca(S.sel, null); }
  });

  /* ================================================================== la carta: sul telefono resta in cima e si abbassa */
  var L = { top: 56, H0: 300, Hmin: 92, startY: 0, wide: false };
  function misura() {
    L.wide = mqWide.matches;
    var head = $("testa"); L.top = Math.round(head ? head.getBoundingClientRect().height : 56);
    doc.documentElement.style.setProperty("--pa-top", L.top + "px");
    L.H0 = L.wide ? (win.innerWidth >= 1100 ? 400 : 360) : (win.innerWidth < 375 ? 268 : 300);
    if (!L.wide && win.innerHeight < 700) L.H0 = Math.max(200, Math.round(win.innerHeight * 0.36));
    lato.style.setProperty("--pa-h0", L.H0 + "px");
    var mr = pa.getBoundingClientRect(), pt = parseFloat(win.getComputedStyle(pa).paddingTop) || 0;
    L.startY = Math.round(mr.top + win.pageYOffset + pt - L.top);
  }
  var posaRaf = 0;
  function posa() {
    if (L.wide) { carta.style.height = ""; carta.style.setProperty("--pa-k", "0"); lato.style.setProperty("--pa-h", L.H0 + "px"); return; }
    var y = win.pageYOffset, k = clamp((y - L.startY) / (L.H0 - L.Hmin), 0, 1), H = Math.round(L.H0 - k * (L.H0 - L.Hmin));
    carta.style.height = H + "px"; carta.style.setProperty("--pa-k", k.toFixed(3));
    lato.style.setProperty("--pa-h", H + "px"); lato.style.setProperty("--pa-velo", y > L.startY + 0.5 ? "1" : "0");
  }
  win.addEventListener("scroll", function () { if (L.wide || posaRaf) return; posaRaf = raf(function () { posaRaf = 0; posa(); }); }, { passive: true });
  var resizeT = 0;
  win.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(function () { misura(); posa(); pillole(); suTastiera(); }, 80); });
  if (mqWide.addEventListener) mqWide.addEventListener("change", function () { misura(); posa(); pillole(); });
  /* con la tastiera su (il campo HEX) la barra scivola via e torna quando il campo perde il fuoco */
  var vv = win.visualViewport, altoMax = win.innerHeight, viaT = 0;
  function suTastiera() {
    if (win.innerHeight > altoMax) altoMax = win.innerHeight;
    var su = !L.wide && doc.activeElement === fHex && !!((vv && vv.height < win.innerHeight - 100) || win.innerHeight < altoMax - 120);
    azioni.classList.toggle("is-via", su);
  }
  fHex.addEventListener("focus", function () { clearTimeout(viaT); setTimeout(suTastiera, 360); });
  fHex.addEventListener("blur", function () { clearTimeout(viaT); viaT = setTimeout(suTastiera, 120); });
  if (vv && vv.addEventListener) vv.addEventListener("resize", suTastiera);
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", function () { pa.classList.toggle("is-fermo", fermo()); });

  /* ================================================================== all'inizio */
  if (fermo()) pa.classList.add("is-fermo");
  gArm.metti(S.arm); gFmt.metti(S.fmt); $("armTesto").textContent = ARM[S.arm];
  misura(); posa();
  vola("subito");
  /* l'entrata: la carta si posa (260 ms), i cinque colori salgono dal fondo uno dopo l'altro (34 ms), il testo li segue;
     tutto finisce entro 600 ms. Con meno movimento, o in una foto (?shot=1), niente. */
  (function entrata() {
    if (fermo() || !carta.animate) return;
    var e = "cubic-bezier(.2, .9, .25, 1)";
    carta.animate([{ opacity: 0, transform: "scale(.965)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: e });
    col.forEach(function (o, i) {
      o.el.animate([{ transform: "translateY(101%)" }, { transform: "none" }], { duration: 400, delay: 50 + i * 34, easing: e, fill: "backwards" });
      o.testo.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 160 + i * 34, easing: e, fill: "backwards" });
      o.lk.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 280, delay: 180 + i * 30, easing: "cubic-bezier(.3, 1.4, .5, 1)", fill: "backwards" });
    });
  })();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { misura(); posa(); pillole(); });
  T.S = S; T.V = V;
  T.stato = function () { return { hex: hexes(), lock: S.lock.slice(), sel: S.sel, arm: S.arm, fmt: S.fmt, volo: !!volo, storia: storia.length, vista: vista ? vista.slot.map(hexDi) : null }; };
  T.nuova = nuova; T.indietro = indietro; T.codici = codici; T.png = png; T.disegnaPng = disegnaPng; T.L = L; T.posa = posa; T.misura = misura;
  T.celle = function () { return celle.map(function (r) { return r.map(function (o) { return o.b ? o.b.textContent : ""; }); }); };
  T.imposta = function (hs) { applica(hs.map(function (h) { return daHex(C.leggiHex(h)); })); };
  T.foto = null; T.apriFoto = apriFoto;
})();
