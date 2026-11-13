/* imad.chat — Tools, l'indice: le famiglie e le schede degli strumenti, ognuna con un piccolo disegno vivo di quello che fa.
   Viene dopo comune/pagina.js (window.PAGINA) e il motore QR (qr/vendor/qrcode-generator.js, qr/qr-core.js: window.QRCore).

   UNO STRUMENTO NUOVO = una riga in STRUMENTI qui sotto (e la sua famiglia in FAMIGLIE, se è nuova). Quando la sua pagina c'è,
   il suo indirizzo va in index.html, in <template id="tiIndirizzi"> (la build riscrive gli indirizzi dell'HTML, mai quelli degli
   script): con l'indirizzo la scheda diventa un link, senza resta «Presto». Una famiglia si vede solo se ha almeno una scheda.
   disegno: "qr" | "palette" | "converti" (DISEGNI, più giù); uno strumento senza un disegno suo prende la scena vuota.

   I disegni: QR Studio = un codice QR vero (QRCore), che porta proprio alla pagina di QR Studio, e ogni tanto si ridisegna a onda
   con un'altra forma e un altro colore; Palette = cinque colori che cambiano e si rimettono in fila dal più scuro al più chiaro,
   con peso (i più scuri partono dopo e rimbalzano meno); Convertitore = un valore che rotola da un'unità all'altra, cifra per cifra.
   Si muovono solo quando si vedono, di rado, uno alla volta, mai più di 600 ms; mai con «meno movimento» o ?shot=1 (lo stato finale
   e basta); mai a scheda nascosta. Su un computer, passare sopra la scheda pronta (o arrivarci con il tasto Tab) la fa muovere.
   Per le prove: window.__ti = { pics, stop(), reset(id), next(id), paint(id, ms) } (stop ferma il giro da solo; reset torna alla
   scena vuota, prima dell'entrata; next prepara la mossa dopo e ne dice la durata; paint disegna un istante, in ms dal suo inizio).
   Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var P = window.PAGINA, Q = window.QRCore, doc = document, root = doc.documentElement;
  var box = doc.getElementById("tiFamiglie");
  if (!box) return;

  /* ================================================================== l'elenco */
  var FAMIGLIE = [
    { id: "creare", nome: "Creare" },
    { id: "convertire", nome: "Convertire" },
    { id: "programmare", nome: "Per chi programma" },
    { id: "giorni", nome: "Di tutti i giorni" }
  ];
  var STRUMENTI = [
    { id: "qr", famiglia: "creare", nome: "QR Studio", disegno: "qr",
      cosa: "Un codice QR per un link, il Wi-Fi o un contatto, con i colori e la foto che vuoi." },
    { id: "palette", famiglia: "creare", nome: "Palette", disegno: "palette",
      cosa: "Cinque colori che stanno bene insieme, anche presi da una foto." },
    { id: "converti", famiglia: "convertire", nome: "Convertitore", disegno: "converti",
      cosa: "Unità, colori, basi e fusi orari: scrivi un valore e vedi subito il risultato." }
  ];

  /* ================================================================== piccoli aiuti */
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)"), mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  function still() { return P ? P.still() : mqReduce.matches; }
  function isDark() { return P ? P.isDark() : mqDark.matches; }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function eOut(t) { t = 1 - t; return 1 - t * t * t; }
  function eInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eBack(t, c1) { var c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }
  function esc(s) { return P ? P.esc(s) : String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function chars(s) { return Array.from ? Array.from(s) : s.split(""); }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  /* i colori del tema, letti dai token della pagina (cambiano con il tema) */
  var TOK = {};
  function leggiToken() {
    var cs = getComputedStyle(root);
    ["--ink", "--ink-2", "--ink-3", "--fill", "--fill-2", "--hair"].forEach(function (k) { TOK[k] = cs.getPropertyValue(k).trim() || "#888"; });
    TOK.dark = isDark();
  }
  /* su iPhone :active vale solo se la pagina ascolta i tocchi */
  doc.addEventListener("touchstart", function () { }, { passive: true });

  /* OKLab: i colori si mescolano qui, così il passaggio da uno all'altro resta uniforme */
  function lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function gam(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function labRgb(L) {
    var l = L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], m = L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], s = L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  function inGamut(c) { return c[0] >= -0.0005 && c[0] <= 1.0005 && c[1] >= -0.0005 && c[1] <= 1.0005 && c[2] >= -0.0005 && c[2] <= 1.0005; }
  /* OKLCH → OKLab, con il croma abbassato quanto basta per restare dentro sRGB */
  function lch(Lv, C, hDeg) {
    var h = hDeg * Math.PI / 180, lo = 0, hi = C, lab = [Lv, C * Math.cos(h), C * Math.sin(h)];
    if (inGamut(labRgb(lab))) return lab;
    for (var i = 0; i < 14; i++) { var mid = (lo + hi) / 2; if (inGamut(labRgb([Lv, mid * Math.cos(h), mid * Math.sin(h)]))) lo = mid; else hi = mid; }
    return [Lv, lo * Math.cos(h), lo * Math.sin(h)];
  }
  function labCss(L) { var c = labRgb(L); return "rgb(" + Math.round(clamp(c[0], 0, 1) * 255) + "," + Math.round(clamp(c[1], 0, 1) * 255) + "," + Math.round(clamp(c[2], 0, 1) * 255) + ")"; }
  function mixLab(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  /* ================================================================== i disegni */
  var DISEGNI = {};

  /* ---------------------------------------------------------------- QR Studio: un codice vero, che si ridisegna a onda */
  var QR_LOOK = [
    { shape: "uniti", eye: "tondo", fg: "#16171d" },
    { shape: "punti", eye: "goccia", fg: { from: "#3036a8", to: "#8a3f9e", angle: 45 } },
    { shape: "quadrati", eye: "quadrato", fg: "#a4543b" },
    { shape: "tondi", eye: "tondo", fg: { from: "#1d5c4c", to: "#1f3d73", angle: 90 } },
    { shape: "uniti", eye: "goccia", fg: "#2b2f77" },
    { shape: "punti", eye: "tondo", fg: "#16171d" },
    { shape: "quadrati", eye: "goccia", fg: { from: "#16171d", to: "#a4543b", angle: 135 } }
  ];
  DISEGNI.qr = function (p) {
    var testo = p.href || "https://imad.chat", qr = null;
    if (Q) { try { qr = Q.encode(testo, { ecc: "M" }); } catch (e) { qr = null; } }
    var lay = doc.createElement("canvas"), mix = doc.createElement("canvas"), old = doc.createElement("canvas");
    var mctx = mix.getContext("2d"), octx = old.getContext("2d");
    var ix = -1, hasOld = false, first = true, looks = QR_LOOK, s = 0, g = null;
    function geo() {
      var side = Math.floor(Math.min(p.H - 34, p.W - 40, p.W < 330 ? 112 : 124));
      if (!g || g.W !== p.W || g.H !== p.H || g.dpr !== p.dpr) {
        g = { W: p.W, H: p.H, dpr: p.dpr, s: side, x: Math.round((p.W - side) / 2 * p.dpr), y: Math.round((p.H - side) / 2 * p.dpr) };
        s = side; hasOld = false;
        /* solo gli aspetti che a questa misura si leggono di sicuro (contrasto, moduli non troppo piccoli) */
        if (qr) looks = QR_LOOK.filter(function (l) {
          try { var c = Q.scannable({ size: side, dpr: p.dpr, quiet: 3, shape: l.shape, eye: l.eye, fg: l.fg, bg: "#ffffff" }, qr);
            return !c.problems.some(function (x) { return x.level === "errore" || x.code === "CONTRASTO"; }); } catch (e) { return false; }
        });
        if (!looks.length) looks = [QR_LOOK[0]];
      }
      return g;
    }
    function carta(c, G) {
      var d = G.dpr, r = Math.round(G.s * 0.13 * d);
      c.save();
      c.shadowColor = TOK.dark ? "rgba(0,0,0,.5)" : "rgba(46,40,100,.2)"; c.shadowBlur = 20 * d; c.shadowOffsetY = 7 * d;
      rr(c, G.x, G.y, G.s * d, G.s * d, r); c.fillStyle = "#ffffff"; c.fill();
      c.restore();
      if (!TOK.dark) { c.save(); rr(c, G.x + 0.5, G.y + 0.5, G.s * d - 1, G.s * d - 1, r); c.strokeStyle = "rgba(30,28,70,.08)"; c.lineWidth = 1; c.stroke(); c.restore(); }
    }
    return {
      dur: function () { return first ? 580 : 560; },
      next: function () {
        /* il disegno di adesso (anche a metà onda) resta dove la nuova onda non è ancora passata */
        if (ix >= 0 && mix.width) { old.width = mix.width; old.height = mix.height; octx.clearRect(0, 0, old.width, old.height); octx.drawImage(mix, 0, 0); hasOld = true; }
        first = ix < 0;
        geo();
        var n = (ix + 1) % looks.length;
        ix = n;
      },
      idle: function (ctx) { var G = geo(); carta(ctx, G); },
      paint: function (ctx, t) {
        var G = geo(); carta(ctx, G);
        if (!qr || ix < 0) return false;
        var k = clamp(t / this.dur(), 0, 1), prog = 1 - Math.pow(1 - k, 1.35);   /* l'onda rallenta appena verso gli angoli */
        var l = looks[ix % looks.length];
        var info = Q.render(lay, qr, { size: G.s, dpr: G.dpr, quiet: 3, shape: l.shape, eye: l.eye, fg: l.fg, bg: "transparent", progress: prog, order: "onda", style: false });
        if (mix.width !== lay.width || mix.height !== lay.height) { mix.width = lay.width; mix.height = lay.height; }
        var W = mix.width, c = W / 2, R = Math.max(1, info.side / 2 * Math.SQRT2);
        mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalCompositeOperation = "source-over"; mctx.clearRect(0, 0, W, mix.height);
        if (hasOld && prog < 1 && old.width === W) {
          mctx.drawImage(old, 0, 0);
          var r1 = Math.max(1, (prog / 0.7) * R), r0 = Math.max(0, ((prog - 0.24) / 0.7) * R);
          mctx.globalCompositeOperation = "destination-out";
          var gr = mctx.createRadialGradient(c, c, Math.min(r0, r1 - 0.5), c, c, r1);
          gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
          mctx.fillStyle = gr; mctx.fillRect(0, 0, W, mix.height);
          mctx.globalCompositeOperation = "source-over";
        }
        mctx.drawImage(lay, 0, 0);
        ctx.drawImage(mix, G.x, G.y);
        if (k >= 1) hasOld = false;
        return k < 1;
      }
    };
  };

  /* ---------------------------------------------------------------- Palette: cinque colori che cambiano e si rimettono in fila */
  /* Palette scelte, non a caso (la scheda promette «colori che stanno bene insieme»): in OKLCH, cinque gradini di luce uguali per tutte
     (.32 .46 .60 .74 .88), croma al più .12, la tinta che scivola appena da un gradino all'altro; un giallo (tinta 80–110) mai sotto
     L .78, così non diventa oliva. Si passano in ordine, la prima è quella ferma (con «meno movimento» o ?shot=1). [croma, tinta] */
  var LUCI = [0.32, 0.46, 0.6, 0.74, 0.88];
  var PALETTE = [
    ["crepuscolo", [[0.085, 270], [0.095, 295], [0.1, 335], [0.09, 25], [0.06, 60]]],
    ["bosco", [[0.055, 170], [0.07, 160], [0.08, 145], [0.075, 125], [0.055, 105]]],
    ["terracotta", [[0.06, 30], [0.1, 35], [0.11, 45], [0.085, 60], [0.045, 80]]],
    ["mare", [[0.075, 255], [0.08, 240], [0.08, 225], [0.065, 210], [0.035, 200]]],
    ["lavanda", [[0.075, 285], [0.095, 292], [0.1, 298], [0.075, 305], [0.035, 310]]],
    ["salvia e pesca", [[0.045, 180], [0.05, 165], [0.05, 140], [0.07, 55], [0.045, 75]]],
    ["notte e oro", [[0.075, 268], [0.085, 262], [0.06, 255], [0.065, 65], [0.085, 88]]],
    ["rosa antico", [[0.06, 350], [0.08, 0], [0.09, 10], [0.07, 20], [0.035, 40]]],
    ["inchiostro e sabbia", [[0.035, 265], [0.03, 260], [0.02, 250], [0.03, 70], [0.035, 85]]]
  ].map(function (q) { return q[1].map(function (c, k) { return lch(LUCI[k], Math.min(0.12, c[0]), c[1]); }); });
  DISEGNI.palette = function (p) {
    /* il seme viene dal nome dello strumento: l'ordine in cui i chip si scambiano è sempre lo stesso, la palette dopo è sempre quella */
    var R = rng(7 + String(p.id).split("").reduce(function (h, ch) { return (h * 31 + ch.charCodeAt(0)) | 0; }, 0)), N = 5;
    var chips = [], i, giro = -1;
    function grigi() {
      var out = [];
      for (var k = 0; k < N; k++) out.push(TOK.dark ? [0.3 + k * 0.045, -0.003, -0.012] : [0.83 + k * 0.03, -0.002, -0.008]);
      return out;
    }
    var g0 = grigi();
    for (i = 0; i < N; i++) chips.push({ from: g0[i], to: g0[i], col: g0[i], s0: i, s1: i, delay: 0, c1: 1.2, lift: 0, over: 4 });
    /* la palette dopo, già data ai chip: il chip che ora sta al posto j va al posto sig[j] e prende il colore di quel gradino. Gli scambi
       sono veri (almeno tre chip cambiano posto), così rimettersi in fila dal più scuro al più chiaro si vede */
    function nuova() {
      giro = (giro + 1) % PALETTE.length;
      var pal = PALETTE[giro], sig, mossi, k, j, tmp;
      do {
        sig = [0, 1, 2, 3, 4];
        for (k = N - 1; k > 0; k--) { j = Math.floor(R() * (k + 1)); tmp = sig[k]; sig[k] = sig[j]; sig[j] = tmp; }
        mossi = 0; for (k = 0; k < N; k++) if (sig[k] !== k) mossi++;
      } while (mossi < 3);
      return chips.map(function (c) { return pal[sig[c.s1]]; });
    }
    function geo() {
      var gap = p.W < 330 ? 7 : 8, cw = clamp(Math.floor((Math.min(p.W - 56, 250) - gap * (N - 1)) / N), 24, 42), ch = Math.min(p.H - 46, 100);
      var tot = cw * N + gap * (N - 1);
      return { gap: gap, cw: cw, ch: ch, x0: Math.round((p.W - tot) / 2), y0: Math.round((p.H - ch) / 2), r: Math.min(11, Math.round(cw * 0.3)) };
    }
    function chip(ctx, G, c, x, y, sc, up) {
      var d = p.dpr, w = G.cw * sc, h = G.ch * sc, cx = x + G.cw / 2, cy = y + G.ch / 2;
      ctx.save();
      ctx.shadowColor = TOK.dark ? "rgba(0,0,0," + (0.34 + 0.2 * up).toFixed(3) + ")" : "rgba(46,40,100," + (0.1 + 0.1 * up).toFixed(3) + ")";
      ctx.shadowBlur = (5 + 14 * up) * d; ctx.shadowOffsetY = (2 + 6 * up) * d;
      rr(ctx, (cx - w / 2) * d, (cy - h / 2) * d, w * d, h * d, G.r * sc * d);
      ctx.fillStyle = labCss(c); ctx.fill();
      ctx.restore();
      /* un filo di mezzo pixel dentro il bordo (come inset 0 0 0 .5px var(--hair)): il più scuro sul tema scuro e il più chiaro sul
         chiaro restano visibili */
      var hl = 0.5 * d;
      ctx.save(); rr(ctx, (cx - w / 2) * d + hl / 2, (cy - h / 2) * d + hl / 2, w * d - hl, h * d - hl, Math.max(0, G.r * sc * d - hl / 2));
      ctx.strokeStyle = TOK["--hair"]; ctx.lineWidth = hl; ctx.stroke(); ctx.restore();
    }
    var COL = 300, VIAGGIO = 360;
    return {
      dur: function () { var m = COL; chips.forEach(function (c) { m = Math.max(m, c.delay + VIAGGIO); }); return m; },
      next: function () {
        var cols = nuova();
        /* da dove si parte: il colore e il posto di adesso (anche a metà di un passaggio) */
        chips.forEach(function (c, k) { c.from = c.col; c.to = cols[k]; c.s0 = c.s1; });
        /* in fila dal più scuro al più chiaro: il posto nuovo di ognuno */
        var ord = chips.slice().sort(function (a, b) { return a.to[0] - b.to[0]; });
        ord.forEach(function (c, k) { c.s1 = k; });
        /* il peso: i più scuri partono un poco dopo, si alzano meno e rimbalzano meno */
        chips.forEach(function (c) {
          var lw = clamp((c.to[0] - 0.25) / 0.7, 0, 1);
          c.delay = Math.round(110 + (1 - lw) * 110);
          c.c1 = 0.7 + lw * 1.1;
          c.lift = (3 + 2.4 * Math.abs(c.s1 - c.s0)) * (0.55 + 0.6 * lw);
          c.over = 2.5 + 4.5 * lw;
        });
      },
      idle: function (ctx) { var G = geo(); chips.forEach(function (c) { chip(ctx, G, c.col, G.x0 + c.s1 * (G.cw + G.gap), G.y0, 1, 0); }); },
      paint: function (ctx, t) {
        var G = geo(), e = eInOut(clamp(t / COL, 0, 1)), list = [];
        chips.forEach(function (c) {
          c.col = mixLab(c.from, c.to, e);
          var u = clamp((t - c.delay) / VIAGGIO, 0, 1), m = eBack(u, c.c1), sn = Math.sin(Math.PI * u);
          var xa = G.x0 + c.s0 * (G.cw + G.gap), xb = G.x0 + c.s1 * (G.cw + G.gap), moving = c.s0 !== c.s1;
          /* il rimbalzo oltre il posto è di pochi pixel, anche per chi viaggia lontano (i chiari un po' di più) */
          if (m > 1 && moving) { var c3 = c.c1 + 1, picco = 4 * c.c1 * c.c1 * c.c1 / (27 * c3 * c3) * Math.abs(xb - xa); m = 1 + (m - 1) * Math.min(1, c.over / Math.max(0.001, picco)); }
          /* chi va a destra si alza e passa davanti, chi va a sinistra scende un poco e passa dietro: gli scambi si leggono */
          var dir = c.s1 > c.s0 ? 1 : -1;
          list.push({ c: c, x: lerp(xa, xb, m), y: G.y0 - (moving ? (dir > 0 ? c.lift : -0.45 * c.lift) * sn : 0), sc: moving ? 1 + (dir > 0 ? 0.04 : -0.02) * sn : 1, up: moving && dir > 0 ? sn : 0, z: moving ? dir * (1 + Math.abs(c.s1 - c.s0)) : 0 });
        });
        list.sort(function (a, b) { return a.z - b.z || a.c.to[0] - b.c.to[0]; });
        list.forEach(function (o) { chip(ctx, G, o.c.col, o.x, o.y, o.sc, o.up); });
        return t < this.dur();
      }
    };
  };

  /* ---------------------------------------------------------------- Convertitore: un valore che rotola da un'unità all'altra */
  function num(v, d) {
    try { return v.toLocaleString("it-IT", { maximumFractionDigits: d || 0, minimumFractionDigits: 0 }); }
    catch (e) { return String(Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).replace(".", ","); }
  }
  function ore(d) { return ("0" + d.getUTCHours()).slice(-2) + ":" + ("0" + d.getUTCMinutes()).slice(-2); }
  function oraTorino(t) {
    try { return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false }).format(t); }
    catch (e) { return null; }
  }
  /* ogni coppia è calcolata qui, mai scritta a mano: [quello che si scrive, quello che esce] */
  var CONVERSIONI = [
    function () { return [num(12) + " km", num(12 / 1.609344, 2) + " mi"]; },
    function () { return [num(100) + " °F", num((100 - 32) * 5 / 9, 1) + " °C"]; },
    function () { return [num(2.5, 1) + " kg", num(2.5 / 0.45359237, 2) + " lb"]; },
    function () { return ["255 dec", (255).toString(16).toUpperCase() + " hex"]; },
    function () { return [num(90) + " km/h", num(90 / 3.6, 1) + " m/s"]; },
    function () {                                   /* l'ora di adesso: Torino, e Makkah (UTC+3 tutto l'anno) */
      var d = P ? P.now() : new Date(), to = oraTorino(d);
      if (!to) return null;
      return [to + " Torino", ore(new Date(d.getTime() + 3 * 3600000)) + " Makkah"];
    },
    function () { return [num(1) + " GiB", num(1024) + " MiB"]; },
    function () { return [num(180) + " cm", num(180 / 30.48, 2) + " ft"]; }
  ];
  DISEGNI.converti = function (p) {
    /* due righe senza campo intorno (la scheda non si tocca come un modulo): sopra il valore di partenza nella voce della macchina
       (Geist Mono maiuscolo, ink-3, come le intestazioni di sezione), sotto il risultato grande */
    var ix = -1, A0 = "", A1 = "", B0 = "", B1 = "", misure = null;
    var ROLL = 380, PASSO = 18, RITARDO_B = 70, TETTO = 590;
    var META = '500 11px "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';
    var ST = {
      an: { font: META, track: 0.66, col: "--ink-3" },
      au: { font: META, track: 0.66, col: "--ink-3" },
      bn: { font: "700 30px Manrope, -apple-system, sans-serif", track: -0.9, col: "--ink" },
      bu: { font: "600 19px Manrope, -apple-system, sans-serif", track: -0.3, col: "--ink-2" }
    };
    function testo(s, riga) { return riga === "a" ? s.toUpperCase() : s; }
    function ruoli(s, riga) { var cs = chars(testo(s, riga)), sp = cs.indexOf(" "); return cs.map(function (ch, k) { return { ch: ch, st: riga + (sp >= 0 && k >= sp ? "u" : "n") }; }); }
    function largo(ctx, list) {
      var x = 0, xs = [], last = 0;
      list.forEach(function (o) { xs.push(x); var S = ST[o.st]; ctx.font = S.font; x += ctx.measureText(o.ch).width + S.track; last = S.track; });
      return { xs: xs, w: x - last };
    }
    /* la distanza tra un carattere e il dopo: tutti partono entro TETTO ms, anche le righe lunghe */
    function passo(n, t0) { return n > 1 ? Math.min(PASSO, (TETTO - ROLL - t0) / (n - 1)) : 0; }
    function geo(ctx) {
      if (misure && misure.W === p.W && misure.H === p.H) return misure;
      /* ogni riga sta in mezzo alla scena, come il codice e i colori delle altre schede; in altezza, a occhio: dalla cima delle
         maiuscole piccole (8 px sopra la loro base) alla base delle cifre grandi */
      var la = 16, lb = 36, dy = 36, top = Math.round((p.H - (8 + dy)) / 2);
      misure = { W: p.W, H: p.H, ya: top + 8, yb: top + 8 + dy, la: la, lb: lb };
      return misure;
    }
    /* una riga che rotola, carattere per carattere (PASSO ms l'uno dall'altro, ROLL ms ciascuno, eOut): quello di prima sale di una riga
       intera ed esce dalla sua fascia, il nuovo sale da sotto quando il vecchio è già uscito, così nella fascia non stanno mai due valori.
       La fascia è alta una riga e taglia tutto quello che ne esce: le righe non si toccano. */
    function riga(ctx, G, s0, s1, nome, y, lh, t0, t) {
      var a = ruoli(s0, nome), b = ruoli(s1, nome), la = largo(ctx, a), lb = largo(ctx, b), n = Math.max(a.length, b.length), busy = false;
      var ps = passo(n, t0), xa = (p.W - la.w) / 2, xb = (p.W - lb.w) / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y - lh * 0.8, p.W, lh); ctx.clip();
      ctx.textBaseline = "alphabetic";
      for (var k = 0; k < n; k++) {
        var u = clamp((t - t0 - k * ps) / ROLL, 0, 1), o = a[k], q = b[k];
        if (u < 1) busy = true;
        /* un carattere uguale nello stesso posto resta fermo (come in un contachilometri); se la riga cambia larghezza e lui dovrebbe
           scivolare, rotola come gli altri: un carattere in ritardo sugli altri lascerebbe un buco nel numero */
        if (o && q && o.ch === q.ch && o.st === q.st && Math.abs(xb + lb.xs[k] - xa - la.xs[k]) < 1.5) {
          var S = ST[q.st]; ctx.font = S.font; ctx.fillStyle = TOK[S.col];
          ctx.fillText(q.ch, xb + lb.xs[k], y); continue;
        }
        /* in ms dal suo inizio: il vecchio sale di una riga intera e in 160 ms è fuori (dopo 70 non tocca più la fascia), spegnendosi;
           il nuovo parte a 70, quando la fascia è vuota, da mezza riga sotto, e si accende mentre sale: arriva a ROLL. Così nella fascia
           c'è sempre un valore solo e il nuovo, quasi tutto dentro la fascia, non si vede mai a pezzi */
        var dt = u * ROLL, eo = eOut(clamp(dt / 160, 0, 1)), ei = eOut(clamp((dt - 70) / (ROLL - 70), 0, 1));
        if (o && eo < 1) { var So = ST[o.st]; ctx.font = So.font; ctx.fillStyle = TOK[So.col]; ctx.globalAlpha = 1 - 0.75 * eo; ctx.fillText(o.ch, xa + la.xs[k], y - lh * eo); }
        if (q && ei > 0) { var Sq = ST[q.st]; ctx.font = Sq.font; ctx.fillStyle = TOK[Sq.col]; ctx.globalAlpha = Math.min(1, ei * 1.6); ctx.fillText(q.ch, xb + lb.xs[k], y + lh * 0.5 * (1 - ei)); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return busy;
    }
    function fine(s, t0) { var n = chars(s).length; return n ? t0 + (n - 1) * passo(n, t0) + ROLL : 0; }
    return {
      dur: function () { return Math.max(fine(A0.length > A1.length ? A0 : A1, 0), fine(B0.length > B1.length ? B0 : B1, RITARDO_B), 1); },
      next: function () {
        var c = null, k = 0;
        while (!c && k < CONVERSIONI.length) { ix = (ix + 1) % CONVERSIONI.length; c = CONVERSIONI[ix](); k++; }
        if (!c) return;
        A0 = A1; B0 = B1; A1 = c[0]; B1 = c[1];
      },
      idle: function () { },
      paint: function (ctx, t) {
        ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
        var G = geo(ctx);
        var bA = riga(ctx, G, A0, A1, "a", G.ya, G.la, 0, t);
        var bB = riga(ctx, G, B0, B1, "b", G.yb, G.lb, RITARDO_B, t);
        return bA || bB;
      },
      ricalcola: function () { misure = null; }
    };
  };

  /* la scena vuota, per uno strumento che non ha ancora un disegno suo */
  DISEGNI.vuoto = function () { return { dur: function () { return 0; }, next: function () { }, idle: function () { }, paint: function () { return false; } }; };

  /* ================================================================== le schede */
  var indirizzi = {};
  (function () {
    var tpl = doc.getElementById("tiIndirizzi"), list = tpl && tpl.content ? tpl.content.querySelectorAll("a[data-strumento]") : [];
    for (var k = 0; k < list.length; k++) {
      var h = list[k].getAttribute("href");
      if (h) { try { indirizzi[list[k].getAttribute("data-strumento")] = new URL(h, location.href).href; } catch (e) { } }
    }
  })();
  /* una pagina di questo sito: la freccia ›, come i riquadri della casa che aprono una pagina (↗ è per i siti fuori) */
  var FRECCIA = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 7l5 5-5 5"/></svg>';

  function scheda(t) {
    var href = indirizzi[t.id], h = '<li class="pg-card ti-card ' + (href ? "is-pronto" : "is-presto") + '" data-id="' + esc(t.id) + '">';
    h += '<div class="ti-scena" aria-hidden="true"><canvas class="ti-cv"></canvas></div>';
    h += '<div class="ti-testo"><div class="ti-riga">';
    if (href) h += '<h3 class="ti-nome"><a class="ti-a" href="' + esc(href) + '">' + esc(t.nome) + "</a></h3>" + '<span class="ti-go" aria-hidden="true">' + FRECCIA + "</span>";
    else h += '<h3 class="ti-nome">' + esc(t.nome) + '</h3><span class="ti-presto">Presto</span>';
    h += '</div><p class="ti-cosa">' + esc(t.cosa) + "</p></div></li>";
    return h;
  }
  var html = "";
  FAMIGLIE.forEach(function (f) {
    /* nella famiglia, prima quelli pronti (nell'ordine dell'elenco), poi quelli «Presto» */
    var sue = STRUMENTI.filter(function (t) { return t.famiglia === f.id; }).map(function (t, k) { return { t: t, k: k }; })
      .sort(function (a, b) { return (indirizzi[b.t.id] ? 1 : 0) - (indirizzi[a.t.id] ? 1 : 0) || a.k - b.k; }).map(function (x) { return x.t; });
    if (!sue.length) return;
    /* sui più larghi una famiglia occupa tante colonne quante schede ha (al più 2 o 3), così più famiglie stanno su una riga */
    html += '<section class="ti-fam" style="--n2:' + Math.min(sue.length, 2) + ";--n3:" + Math.min(sue.length, 3) + '" aria-labelledby="tiF-' + esc(f.id) + '"><h2 class="ti-fam__t" id="tiF-' + esc(f.id) + '">' + esc(f.nome) + '</h2><ul class="ti-lista">' + sue.map(scheda).join("") + "</ul></section>";
  });
  box.innerHTML = html;

  /* le schede entrano una dopo l'altra (40 ms l'una), come quelle dei progetti */
  var tutte = box.querySelectorAll(".ti-card");
  if (!still()) {
    for (var k0 = 0; k0 < tutte.length; k0++) { tutte[k0].classList.add("is-prima"); tutte[k0].style.transitionDelay = Math.min(k0, 12) * 40 + "ms"; }
    void box.offsetWidth;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      for (var j = 0; j < tutte.length; j++) tutte[j].classList.remove("is-prima");
      setTimeout(function () { for (var q = 0; q < tutte.length; q++) tutte[q].style.transitionDelay = ""; }, 1000);
    }); });
  }

  /* ================================================================== i disegni vivi: misura, giro, turni */
  leggiToken();
  var pics = [], byId = {}, raf = 0, manual = false;
  STRUMENTI.forEach(function (t) {
    var card = box.querySelector('.ti-card[data-id="' + t.id + '"]'); if (!card) return;
    var cv = card.querySelector(".ti-cv"), stage = card.querySelector(".ti-scena");
    if (!cv || !cv.getContext) return;
    var p = { id: t.id, card: card, stage: stage, cv: cv, ctx: cv.getContext("2d"), href: indirizzi[t.id] || null, pronto: !!indirizzi[t.id],
      W: 0, H: 0, dpr: 1, vis: false, moved: false, anim: false, t0: 0, last: -1e9, wait: 0, queued: false };
    p.d = (DISEGNI[t.disegno] || DISEGNI.vuoto)(p);
    pics.push(p); byId[t.id] = p;
  });

  function misura(p) {
    var r = p.stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 3);
    var w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    p.dpr = d; p.W = w / d; p.H = h / d;
    if (p.cv.width !== w || p.cv.height !== h) { p.cv.width = w; p.cv.height = h; }
    p.cv.style.width = p.W + "px"; p.cv.style.height = p.H + "px";
    /* la tela cade su pixel interi del dispositivo, o il browser la ricampiona e il codice si sfoca */
    p.cv.style.transform = "";
    var fx = (r.left + (window.pageXOffset || 0)) * d, fy = (r.top + (window.pageYOffset || 0)) * d;
    var dx = (Math.round(fx) - fx) / d, dy = (Math.round(fy) - fy) / d;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) p.cv.style.transform = "translate(" + dx.toFixed(3) + "px," + dy.toFixed(3) + "px)";
    if (p.d.ricalcola) p.d.ricalcola();
  }
  function disegna(p, t) {
    var c = p.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, p.cv.width, p.cv.height);
    if (!p.moved) { p.d.idle(c); return false; }
    return p.d.paint(c, t);
  }
  function ridisegna(p) { if (p.W) disegna(p, p.anim ? now() - p.t0 : 1e9); }
  function giro() {
    raf = 0; if (manual) return;
    var any = false, tn = now();
    pics.forEach(function (p) { if (!p.anim) return; if (disegna(p, tn - p.t0)) any = true; else p.anim = false; });
    if (any) raf = requestAnimationFrame(giro);
  }
  function muovi(p) {
    if (manual) return;
    var tn = now();
    p.d.next(); p.moved = true; p.last = tn;
    if (still()) { p.anim = false; disegna(p, 1e9); return; }
    p.t0 = tn; p.anim = true; p.wait = (p.pronto ? 6200 : 9000) + Math.round(Math.random() * 1600);
    disegna(p, 0);
    if (!raf) raf = requestAnimationFrame(giro);
  }

  pics.forEach(function (p) { misura(p); disegna(p, 0); });
  /* con «meno movimento» (o ?shot=1): lo stato finale, subito, e nient'altro */
  if (still()) pics.forEach(function (p) { muovi(p); });

  /* si vede? (almeno un terzo della scena sullo schermo) */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    var nuovi = [];
    es.forEach(function (e) {
      var p = null; for (var k = 0; k < pics.length; k++) if (pics[k].stage === e.target) p = pics[k];
      if (!p) return;
      p.vis = e.isIntersecting && e.intersectionRatio >= 0.34;
      if (p.vis && !p.moved && !p.queued) nuovi.push(p);
    });
    /* la prima volta che si vede, il disegno si fa da sé: dopo l'entrata della scheda, uno dopo l'altro */
    nuovi.forEach(function (p, k) { p.queued = true; setTimeout(function () { if (!p.moved) muovi(p); }, 220 + k * 200); });
  }, { threshold: [0, 0.34, 0.6] }) : null;
  pics.forEach(function (p) { if (io) io.observe(p.stage); else { p.vis = true; p.queued = true; setTimeout(function () { muovi(p); }, 220); } });

  /* i turni: ogni tanto si muove uno solo, quello che si vede e aspetta da più tempo */
  (function turno() {
    setTimeout(turno, 1300);
    if (manual || still() || doc.hidden) return;
    var tn = now(), best = null;
    pics.forEach(function (p) { if (p.vis && p.moved && !p.anim && tn - p.last >= p.wait && (!best || p.last < best.last)) best = p; });
    if (best && !pics.some(function (p) { return p.anim; })) muovi(best);
  })();

  /* su un computer: passare sopra la scheda pronta, o arrivarci con Tab, la fa muovere (se non si è appena mossa) */
  function tocca(p) { if (manual || still() || !p.moved || p.anim || now() - p.last < 1200) return; muovi(p); }
  pics.forEach(function (p) {
    if (!p.pronto) return;
    p.card.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") tocca(p); });
    var a = p.card.querySelector(".ti-a");
    if (a) a.addEventListener("focus", function () { var kb = true; try { kb = a.matches(":focus-visible"); } catch (e) { kb = true; } if (kb) tocca(p); });
  });

  /* misura nuova (rotazione, finestra più larga), tema nuovo, caratteri arrivati: si ridisegna lo stato di adesso */
  var rz = 0;
  function rifai() { pics.forEach(function (p) { misura(p); ridisegna(p); }); }
  if ("ResizeObserver" in window) { var ro = new ResizeObserver(function () { if (rz) return; rz = requestAnimationFrame(function () { rz = 0; rifai(); }); }); pics.forEach(function (p) { ro.observe(p.stage); }); }
  else window.addEventListener("resize", function () { if (rz) return; rz = requestAnimationFrame(function () { rz = 0; rifai(); }); });
  function tema() { leggiToken(); pics.forEach(ridisegna); }
  if (mqDark.addEventListener) mqDark.addEventListener("change", tema); else if (mqDark.addListener) mqDark.addListener(tema);
  function moto() { if (still()) pics.forEach(function (p) { if (!p.moved) muovi(p); else { p.anim = false; ridisegna(p); } }); }
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", moto); else if (mqReduce.addListener) mqReduce.addListener(moto);
  function caratteri() { pics.forEach(function (p) { if (p.d.ricalcola) p.d.ricalcola(); ridisegna(p); }); }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(caratteri);
  /* la tela non chiede i caratteri da sé: si chiedono qui quelli del Convertitore (anche Geist Mono, che sta solo nelle intestazioni) */
  if (doc.fonts && doc.fonts.load) { try { Promise.all([doc.fonts.load('500 11px "Geist Mono"'), doc.fonts.load("700 30px Manrope"), doc.fonts.load("600 19px Manrope")]).then(caratteri, function () { }); } catch (e) { } }

  /* per le prove (strumenti di cattura): si ferma il giro e si disegna un istante a mano */
  window.__ti = {
    pics: byId,
    stop: function () { manual = true; if (raf) cancelAnimationFrame(raf); raf = 0; pics.forEach(function (p) { p.anim = false; }); },
    next: function (id) { var p = byId[id]; if (!p) return; p.d.next(); p.moved = true; return p.d.dur(); },
    reset: function (id) { var p = byId[id]; if (!p) return; var t = STRUMENTI.filter(function (x) { return x.id === id; })[0]; p.d = (DISEGNI[t.disegno] || DISEGNI.vuoto)(p); p.moved = false; disegna(p, 0); },
    paint: function (id, ms) { var p = byId[id]; if (p) disegna(p, ms); }
  };
})();
