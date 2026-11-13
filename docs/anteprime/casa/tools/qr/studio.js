/* QR Studio — il primo strumento di imad.chat. Tutto si calcola qui, sul telefono: niente viene caricato, niente esce.
   Sopra window.QRCore (qr-core.js) e il guscio comune (../../comune/pagina.js). Plain script, ES2017 al massimo.

   COME È FATTO
   - Lo stato dell'aspetto (S: forma, occhi, colori, sfumatura, fondo, cornice) si ricorda sul dispositivo (localStorage
     "imad.qr.stile", dentro try/catch); il contenuto e l'immagine mai.
   - Ogni cambiamento passa da aggiorna(cosa): si costruisce il testo (QRCore.payload), si codifica (QRCore.encode), e il disegno
     va dal codice di adesso al nuovo con un movimento che spiega cosa è cambiato, sempre disegnato dal motore:
       contenuto  i moduli cambiano con un'onda dal centro (un campo di grandezze per modulo, QRCore.render opts.cells): quelli
                  che restano non si muovono, quelli nuovi spuntano, quelli vecchi rientrano. Se cambia la misura del codice, il
                  vecchio si cancella dal centro mentre il nuovo si disegna (progress, ordine "onda").
                  Si scrive veloce: il disegno in corso si interrompe e riparte da dov'è (mai in coda); l'ultimo tasto vince.
       forma      ogni modulo si trasforma nella forma nuova, un'onda in diagonale (opts.morph), anche gli occhi
       colore     il colore nuovo scorre sul codice nella direzione della sfumatura (opts.flow)
       immagine   i moduli sotto di lei si ritirano, poi lei cade al centro e si assesta (opts.logoIn)
       cornice    l'anello si disegna intorno e la scritta sale (opts.frame.t), il codice si fa più piccolo senza salti
     Con «meno movimento» tutto cambia in un colpo. Ogni movimento dura meno di 600 ms.
   - Quando il disegno è fermo, il PNG da 1024 px che si salverebbe viene riletto (QRCore.verify, solo il quadrato del codice con
     il suo margine: QRCore.codeBox; una scala per compito): solo allora la spunta disegna il suo tratto e dice «Si legge»; mentre
     si ricontrolla restano le parole di prima con l'icona tenue; le regole (QRCore.scannable) dicono in arancio cosa rischia e cosa fare, in
     rosso quando non si legge, e allora Salva, Copia e Condividi si spengono.
   - Sul telefono la carta del codice resta in cima e si stringe da circa 260 a 132 px con lo scorrere (solo transform e
     l'altezza di un elemento assoluto: il posto della carta nella pagina non cambia, i comandi non saltano).
   window.__studio: per le prove (stato, tempi, contatori). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, win = window;
  var Q = win.QRCore;
  var $ = function (id) { return doc.getElementById(id); };
  var qsa = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  var QS = new URLSearchParams(location.search);
  var SHOT = QS.get("shot") === "1";
  var mqReduce = win.matchMedia("(prefers-reduced-motion: reduce)");
  var mqWide = win.matchMedia("(min-width: 900px), (min-width: 600px) and (max-height: 520px) and (orientation: landscape)");
  var mqDark = win.matchMedia("(prefers-color-scheme: dark)");
  function fermo() { return SHOT || mqReduce.matches; }
  function now() { return win.performance && performance.now ? performance.now() : Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { t = 1 - t; return 1 - t * t * t; }
  function easeOutBack(t) { var c1 = 1.3, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }
  function easeIn(t) { return t * t; }
  /* una curva cubic-bezier come quelle del CSS (per --molla-piana) */
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
  var mollaPiana = bezier(0.2, 0.9, 0.25, 1);
  var raf = win.requestAnimationFrame ? function (f) { return win.requestAnimationFrame(f); } : function (f) { return setTimeout(function () { f(now()); }, 16); };
  var caf = win.cancelAnimationFrame ? function (h) { win.cancelAnimationFrame(h); } : clearTimeout;

  var main = $("st"), lato = $("lato"), carta = $("carta"), tela = $("tela"), flip = $("flip"), cv = $("cv");
  var stato = $("stato"), statoT = $("statoT"), bFix = $("bFix"), info = $("info"), infoN = $("infoN"), annuncio = $("annuncio"), cosaEl = $("cosa");
  var bSalva = $("bSalva"), bAltro = $("bAltro"), menu = $("menu"), bCopia = $("bCopia"), bCondividi = $("bCondividi");
  var T = { tempi: [], cicli: 0, controlli: 0, salvati: [] };      /* per le prove */
  win.__studio = T;

  if (!Q || !cv || !cv.getContext) {
    if (statoT) statoT.textContent = "Il motore del codice non è arrivato: ricarica la pagina.";
    if (stato) stato.setAttribute("data-l", "errore");
    qsa(".st-b").forEach(function (b) { b.disabled = true; });
    return;
  }

  /* ================================================================== lo stato */
  var ESEMPIO = "https://imad.chat";
  var FORME = ["quadrati", "punti", "tondi", "uniti"], OCCHI = ["quadrato", "tondo", "goccia"], VERSI = [0, 45, 90, 135];
  /* i colori pronti: tutti si leggono (contrasto almeno 4,5), e ognuno ha il suo secondo colore per la sfumatura, della
     stessa famiglia, che si legge anche lui (5,4 o più sul suo fondo). «Classico», nero su bianco, è per chi stampa.
     I colori Kukko del cubo restano sul cubo (CLAUDE.md), qui non ci sono. */
  var COPPIE = [
    { id: "inchiostro", nome: "Inchiostro", fg: "#221d14", fg2: "#7f5810", bg: "#fbf6ea" },
    { id: "notte", nome: "Notte", fg: "#172554", fg2: "#1d5b8f", bg: "#f1f4fd" },
    { id: "bosco", nome: "Bosco", fg: "#1e4a35", fg2: "#146c63", bg: "#f0f5ee" },
    { id: "prugna", nome: "Prugna", fg: "#5a1f4f", fg2: "#962c58", bg: "#fbf1f6" },
    { id: "terracotta", nome: "Terracotta", fg: "#8f3a22", fg2: "#875a14", bg: "#fdf2ea" },
    { id: "classico", nome: "Classico", fg: "#111111", fg2: "#3f4654", bg: "#ffffff" }
  ];
  COPPIE.forEach(function (p) { p.fg2 = Q.fixContrast(p.fg2, p.bg, 4.6); });
  var S = { forma: "uniti", occhi: "tondo", coppia: "inchiostro", fg: "#221d14", fg2: "#7f5810", grad: false, ang: 45, bg: "#fbf6ea", trasp: false, cornice: false, scritta: "Scansiona" };
  var HEX = /^#[0-9a-f]{6}$/i;
  (function () {
    var s = null;
    try { s = JSON.parse(win.localStorage.getItem("imad.qr.stile") || "null"); } catch (e) { s = null; }
    if (!s || typeof s !== "object") return;
    if (FORME.indexOf(s.forma) >= 0) S.forma = s.forma;
    if (OCCHI.indexOf(s.occhi) >= 0) S.occhi = s.occhi;
    ["fg", "fg2", "bg"].forEach(function (k) { if (HEX.test(s[k] || "")) S[k] = s[k].toLowerCase(); });
    if (VERSI.indexOf(s.ang) >= 0) S.ang = s.ang;
    ["grad", "trasp", "cornice"].forEach(function (k) { if (typeof s[k] === "boolean") S[k] = s[k]; });
    if (typeof s.scritta === "string") S.scritta = s.scritta.slice(0, 24);
    S.coppia = typeof s.coppia === "string" && COPPIE.some(function (c) { return c.id === s.coppia; }) ? s.coppia : null;
  })();
  function ricorda() { try { win.localStorage.setItem("imad.qr.stile", JSON.stringify(S)); } catch (e) { /* senza memoria: va bene lo stesso */ } }

  var IMG = { cv: null, scala: 0.22, tonda: true, margine: 1, url: "" };
  var TIPO = "link";
  var FONTDATA = null;       /* il carattere della scritta, per l'SVG (si legge dalla cartella solo quando serve) */

  /* ================================================================== il contenuto: il testo che va nel codice */
  function val(id) { var el = $(id); return el ? el.value : ""; }
  function pulito(s) { return String(s).replace(/^\s+|\s+$/g, ""); }
  function slug(s) {
    s = String(s || "");
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }
  var PROT = "WPA", NASC = false;
  function byte(s) { try { return new TextEncoder().encode(s).length; } catch (e) { return unescape(encodeURIComponent(s)).length; } }
  function caratteri(k) { return k === 1 ? "1 carattere" : k.toLocaleString("it-IT") + " caratteri"; }
  /* desc: ciò che dice la voce dopo «Codice QR» (con l'articolo giusto); cosa: la riga breve nella carta piccola;
     avviso: ciò che il codice si legge ma non farà (una rete Wi-Fi a cui il telefono non si collega) */
  function contenuto() {
    var P = Q.payload, t;
    if (TIPO === "link") {
      t = pulito(val("fLink")); if (!t) return null;
      var u = P.url(t), host = u.replace(/^[a-z][a-z0-9+.\-]*:(\/\/)?/i, "").split(/[\/?#]/)[0].replace(/^www\./i, "");
      var link = /^[a-z][a-z0-9+.\-]*:/i.test(u);
      var corto = u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
      return { text: u, desc: (link ? "del link " : "del testo ") + u, cosa: link ? corto : "Testo · " + u, nome: "qr-" + (slug(host) || "link"), testo: !link };
    }
    if (TIPO === "testo") {
      t = P.text(val("fTesto")); if (!pulito(t)) return null;
      t = t.replace(/^\s+|\s+$/g, "");
      var k = Array.from(t).length;
      return { text: t, desc: "del testo di " + caratteri(k), cosa: "Testo · " + caratteri(k), nome: "qr-testo" };
    }
    if (TIPO === "wifi") {
      var ssid = val("fSsid"); if (!pulito(ssid)) return null;
      var pw = PROT === "nopass" ? "" : val("fPw"), lp = Array.from(pw).length, avv = null;
      if (byte(ssid) > 32) avv = "Nome della rete troppo lungo: al massimo 32 caratteri.";
      else if (PROT !== "nopass" && !pw) avv = "Manca la password: se la rete è aperta, scegli Nessuna.";
      else if (PROT === "WPA" && lp < 8) avv = "Password corta: una rete WPA ne vuole almeno 8 caratteri.";
      else if (PROT === "WPA" && lp > 63 && !/^[0-9a-f]{64}$/i.test(pw)) avv = "Password lunga: una rete WPA ne accetta al massimo 63 caratteri.";
      return { text: P.wifi({ ssid: ssid, password: pw, security: PROT, hidden: NASC }), desc: "della rete Wi-Fi " + ssid, cosa: "Wi-Fi · " + pulito(ssid), nome: "qr-wifi-" + (slug(ssid) || "rete"), avviso: avv };
    }
    if (TIPO === "contatto") {
      var c = { name: val("fNome"), phone: val("fTel"), email: val("fMail"), org: val("fOrg"), url: val("fSito") };
      if (!pulito(c.name + c.phone + c.email + c.org + c.url)) return null;
      var chi = pulito(c.name) || pulito(c.org) || pulito(c.email) || pulito(c.phone) || pulito(c.url);
      return { text: P.vcard(c), desc: "del contatto " + chi, cosa: "Contatto · " + chi, nome: "qr-contatto-" + (slug(c.name || c.org) || "nuovo") };
    }
    if (TIPO === "email") {
      var e = { to: val("fA"), subject: val("fOgg"), body: val("fCorpo") };
      if (!pulito(e.to + e.subject + e.body)) return null;
      return { text: P.email(e), desc: "dell'e-mail" + (pulito(e.to) ? " a " + pulito(e.to) : ""), cosa: "E-mail" + (pulito(e.to) ? " · " + pulito(e.to) : ""), nome: "qr-email" };
    }
    if (TIPO === "telefono") {
      if (!/\d/.test(val("fNum"))) return null;
      var tel = P.tel(val("fNum"));
      return { text: tel, desc: "del numero " + tel.slice(4), cosa: "Telefono · " + tel.slice(4), nome: "qr-telefono" };
    }
    return null;
  }

  /* l'aspetto come lo vuole il motore (senza misura) */
  function aspetto() {
    var o = { shape: S.forma, eye: S.occhi, fg: S.grad ? { from: S.fg, to: S.fg2, angle: S.ang } : S.fg, bg: S.trasp ? "transparent" : S.bg, quiet: 4 };
    if (IMG.cv) o.logo = { image: IMG.cv, scale: IMG.scala, pad: IMG.margine, round: IMG.tonda ? 1 : 0.16 };
    if (S.cornice) o.frame = { text: S.scritta, fontData: FONTDATA };
    return o;
  }
  function conMisura(o, size, dpr) { return Object.assign({}, o, { size: size, dpr: dpr, style: false }); }
  function esporta(size) { var c = doc.createElement("canvas"); Q.render(c, G.qr, conMisura(G.look, size, 1)); return c; }

  /* ================================================================== il disegno e i suoi movimenti */
  var G = {
    qr: null, look: null, text: ESEMPIO, desc: "", nome: "qr-imad-chat", esempio: true, err: null,
    field: null, old: null, morph: null, flow: null, drop: null, fr: null, wave: null, loop: 0, shown: false,
    regole: null, letto: null
  };
  var L = { wide: false, cardW: 0, box: 188, cbox: 104, H0: 262, Hmin: 132, startY: 0, top: 62, sw: 200, dpr: 2, k: -1, size: 188, cw: 188, ch: 188 };
  var WAVE = 300, FRONTE = 4, MORPH = 540, FLOW = 480, DROP = 340, FRAME = 440, SNAP = 460, FIRST = 460, VIA = 240, ASSESTA = 300;
  var layer = doc.createElement("canvas"), snapC = doc.createElement("canvas");

  function dprOra() { return clamp(Math.round((win.devicePixelRatio || 1) * 100) / 100, 1, 3); }
  function chiave(o) { return o.logo ? [o.logo.scale, o.logo.pad, o.logo.round].join(",") : "-"; }

  /* il campo: per ogni modulo, quanto è grande adesso (0 niente, 1 pieno); un cambiamento lo porta verso i moduli nuovi
     con un'onda dal centro, partendo da com'è in quel momento */
  function campoNuovo(n) {
    var N = n * n;
    return { n: n, cells: new Float32Array(N), from: new Float32Array(N), to: new Uint8Array(N), t0: new Float64Array(N), dur: new Float32Array(N), end: 0 };
  }
  /* porta il campo F verso tg con un'onda dal centro che parte dopo `ritardo` ms. L'onda è stretta: va dal centro agli angoli
     in WAVE ms, e ogni modulo cambia in quanto basta perché il fronte sia largo circa FRONTE moduli (da 45 a 150 ms): dietro
     il fronte il codice nuovo, davanti il vecchio, tutti e due con i pezzi uniti; si staccano solo i moduli sul fronte */
  function campoOnda(F, tg, t, ritardo) {
    var n = F.n, N = n * n, mid = (n - 1) / 2, maxD = Math.SQRT2 * mid || 1, end = t;
    var GROW = clamp(FRONTE * WAVE / maxD, 45, 150), SHRINK = GROW * 0.75;
    for (var i = 0; i < N; i++) {
      var r = (i / n) | 0, c = i - r * n, dr = r - mid, dc = c - mid;
      var d = Math.sqrt(dr * dr + dc * dc) / maxD;
      F.from[i] = F.cells[i]; F.to[i] = tg[i];
      if (Math.abs(F.cells[i] - tg[i]) < 1e-4) { F.dur[i] = 0; F.cells[i] = tg[i]; continue; }
      F.t0[i] = t + ritardo + d * WAVE; F.dur[i] = tg[i] > F.cells[i] ? GROW : SHRINK;
      if (F.t0[i] + F.dur[i] > end) end = F.t0[i] + F.dur[i];
    }
    F.end = end;
  }
  function campoVerso(qr, look, t, pq, pl) {
    var tg = Q.targets(qr, look), n = qr.n, N = n * n, F = G.field, i;
    if (!F || F.n !== n) {
      F = G.field = campoNuovo(n);
      var old = pq && pq.n === n ? Q.targets(pq, pl) : null;
      for (i = 0; i < N; i++) F.cells[i] = old ? old[i] : tg[i];
    }
    campoOnda(F, tg, t, 0);
  }
  function campoPasso(t) { return campoPassoF(G.field, t); }
  function campoPassoF(F, t) {
    if (!F) return false;
    var busy = false, N = F.n * F.n;
    for (var i = 0; i < N; i++) {
      if (F.dur[i] === 0) continue;
      var u = (t - F.t0[i]) / F.dur[i];
      if (u <= 0) { busy = true; continue; }
      if (u >= 1) { F.cells[i] = F.to[i]; F.dur[i] = 0; continue; }
      busy = true;
      var a = F.from[i], b = F.to[i];
      F.cells[i] = b > a ? a + (b - a) * easeOutBack(u) : a + (b - a) * easeIn(u);
    }
    return busy;
  }
  function campoFermo() {
    var F = G.field; if (!F) return;
    for (var i = 0; i < F.cells.length; i++) { F.cells[i] = F.to[i]; F.dur[i] = 0; }
  }

  /* la misura della tela: il codice sta in un quadrato di L.box px; con la cornice è più alto che largo e ci sta dentro */
  function misuraTela(look) {
    var size = L.box;
    if (look && look.frame && G.qr) {
      var m = Q.measure(G.qr, conMisura(look, 1000, 1));
      size = Math.floor(L.box * m.width / m.height);
    }
    L.size = size;
    var m2 = G.qr ? Q.measure(G.qr, conMisura(look || {}, size, L.dpr)) : { width: size, height: size };
    L.cw = m2.width; L.ch = m2.height;
    cv.style.width = L.cw + "px"; cv.style.height = L.ch + "px";
  }
  /* dove sta il codice dentro la tela (per far scivolare la tela quando la cornice cambia la misura) */
  function rettCodice(look, size) {
    var lay = Q._layout(G.qr, conMisura(look, size, L.dpr)), d = L.dpr;
    var m = Q.measure(G.qr, conMisura(look, size, L.dpr));
    return { x: (L.box - m.width) / 2 + lay.ox / d, y: (L.box - m.height) / 2 + lay.ox / d, s: lay.side / d };
  }

  function opzioni(t, ferma) {
    if (G.frOut && t - G.frOut.t0 >= VIA) {
      /* l'anello se n'è andato: la carta si assesta alla sua misura nuova (dal posto del codice con la cornice al suo) */
      var prim = rettCodice(Object.assign({}, G.look, { frame: G.frOut.frame }), L.size);
      G.frOut = null;
      misuraTela(G.look);
      var dopo = rettCodice(G.look, L.size), kk = prim.s / dopo.s;
      flip.style.transformOrigin = "0 0";
      G.fr = { t0: t, dur: ASSESTA, molla: true, flip: { tx: prim.x - dopo.x * kk, ty: prim.y - dopo.y * kk, k: kk } };
    }
    /* mentre si muove la tela si disegna a 2x al massimo; un codice molto fitto a 1,5x (costa poco più della metà) */
    var o = conMisura(G.look, L.size, ferma ? L.dpr : Math.min(L.dpr, G.qr && G.qr.n > 57 ? 1.5 : 2));
    var busy = false;
    if (G.frOut) { busy = true; o.frame = Object.assign({}, G.frOut.frame, { t: clamp(1 - (t - G.frOut.t0) / VIA, 0, 1) }); }
    if (G.field) { if (campoPasso(t)) busy = true; o.cells = G.field.cells; }
    if (G.morph) {
      var mt = (t - G.morph.t0) / MORPH;
      if (mt >= 1) G.morph = null; else { busy = true; o.morph = { shape: G.morph.shape, eye: G.morph.eye, t: Math.max(0, mt) }; }
    }
    if (G.flow) {
      var ft = (t - G.flow.t0) / FLOW;
      if (ft >= 1) G.flow = null; else { busy = true; o.flow = { fg: G.flow.fg, bg: G.flow.bg, angle: G.flow.angle, t: Math.max(0, ft) }; }
    }
    if (G.drop) {
      var dt = (t - G.drop.t0) / DROP;
      if (dt >= 1) G.drop = null; else { busy = true; o.logoIn = Math.max(0, dt); }
    }
    if (G.fr) {
      var rt = (t - G.fr.t0) / (G.fr.dur || FRAME);
      if (rt >= 1) { G.fr = null; flip.style.transform = ""; }
      else {
        busy = true;
        var e = (G.fr.molla ? mollaPiana : easeOut)(clamp(rt, 0, 1)), f = G.fr.flip;
        if (o.frame && !G.fr.molla) o.frame = Object.assign({}, o.frame, { t: clamp(rt * 1.1, 0, 1) });
        if (f) flip.style.transform = "translate(" + (f.tx * (1 - e)).toFixed(2) + "px," + (f.ty * (1 - e)).toFixed(2) + "px) scale(" + lerp(f.k, 1, e).toFixed(4) + ")";
      }
    }
    if (G.wave) {
      var wt = (t - G.wave.t0) / G.wave.dur;
      if (wt >= 1) G.wave = null;
      else { busy = true; o.progress = clamp(easeOut(clamp(wt, 0, 1)) * 1.02, 0, 1); o.order = "onda"; }
    }
    return { o: o, busy: busy };
  }

  /* un fotogramma; mentre qualcosa si muove la tela si disegna a 2x al massimo (sul telefono non si vede, costa la metà),
     da ferma alla densità dello schermo. La misura in CSS non cambia mai, quindi niente salti. */
  function disegna(t) {
    var t0 = now();
    var r = opzioni(t, false);
    if (!r.busy && !G.old && L.dpr > 2) r = opzioni(t, true);
    var o = r.o;
    if (G.old) {
      /* la misura del codice è cambiata: i moduli del vecchio rientrano a onda dal centro mentre quelli del nuovo spuntano,
         gli occhi passano dalla misura vecchia alla nuova; due strati senza fondo, sopra il fondo */
      var OD = G.old, ot = clamp((t - OD.t0) / OD.dur, 0, 1), eo = easeOut(ot);
      if (OD.field && campoPassoF(OD.field, t)) r.busy = true;
      if (ot < 1) r.busy = true;
      var bg = o.bg;
      /* la cornice del vecchio resta nella misura (stesso posto per il codice) ma non si disegna: l'anello è quello del nuovo */
      var olook = OD.look.frame ? Object.assign({}, OD.look, { frame: Object.assign({}, OD.look.frame, { t: 0 }) }) : OD.look;
      Q.render(snapC, OD.qr, Object.assign(conMisura(olook, L.size, o.dpr), { bg: "transparent", cells: OD.field.cells, eyeScale: clamp(1 - eo / 0.45, 0, 1) }));
      Q.render(layer, G.qr, Object.assign({}, o, { bg: "transparent", eyeScale: clamp((eo - 0.4) / 0.5, 0, 1) }));
      if (cv.width !== layer.width) cv.width = layer.width;
      if (cv.height !== layer.height) cv.height = layer.height;
      var W = cv.width, H = cv.height, x = cv.getContext("2d");
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
      x.clearRect(0, 0, W, H);
      if (bg !== "transparent") { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
      x.drawImage(snapC, 0, 0, W, H);
      x.drawImage(layer, 0, 0);
      /* finito: l'ultimo fotogramma è il disegno fermo, pulito, alla densità dello schermo */
      if (!r.busy) { G.old = null; Q.render(cv, G.qr, opzioni(t, true).o); }
    } else {
      Q.render(cv, G.qr, o);
    }
    T.tempi.push(now() - t0); if (T.tempi.length > 600) T.tempi.shift();
    (T.disegni || (T.disegni = [])).push(now() - t0); if (T.disegni.length > 600) T.disegni.shift();
    T.cicli++;
    return r.busy;
  }

  function ciclo(t) {
    G.loop = 0;
    var busy = disegna(typeof t === "number" ? Math.max(t, now() - 1) : now());
    if (busy) G.loop = raf(ciclo);
    else fermato();
  }
  function avvia() { if (!G.loop) G.loop = raf(ciclo); }
  function tuttoFermo() {
    if (G.loop) { caf(G.loop); G.loop = 0; }
    campoFermo(); G.morph = G.flow = G.drop = G.fr = G.wave = G.old = G.frOut = null; flip.style.transform = "";
  }
  function fermato() { controllaPresto(); tessereDopo(); }

  /* dal codice di adesso al nuovo: cosa si muove dipende da cosa è cambiato */
  function passa(qr, look, cosa) {
    var t = now(), pq = G.qr, pl = G.look;
    var prima = !G.shown;
    if (G.frOut) { G.frOut = null; misuraTela(pl); }        /* un anello che stava andando via: via subito */
    /* un codice molto fitto (più di 57 moduli per lato, oltre 150 caratteri circa) cambia contenuto in un colpo: lì l'onda
       sarebbe un brusio e costerebbe troppo a ogni tasto (forma e colore si muovono lo stesso) */
    var denso = cosa === "contenuto" && pq && (qr.n > 57 || pq.n > 57);
    if (fermo() || !pq || prima || denso) {
      tuttoFermo();
      G.qr = qr; G.look = look; G.field = null;
      misuraTela(look);
      if (!fermo() && prima && !pq) { G.wave = { t0: t + 120, dur: FIRST }; G.shown = true; G.field = null; cartaEntra(); avvia(); return; }
      G.shown = true;
      disegna(t); fermato(); return;
    }
    var stessoCodice = pq.text === qr.text && pq.ecc === qr.ecc && pq.n === qr.n;
    var fondo = function (o) { return o.bg; };
    var colore = function (o) { return typeof o.fg === "object" ? o.fg.from + ">" + o.fg.to + "@" + o.fg.angle : o.fg; };
    /* la cornice: l'anello si disegna e il codice scivola alla sua misura nuova (la tela parte da dov'era il codice) */
    var cornice = !!pl.frame !== !!look.frame || (pl.frame && look.frame && !!pl.frame.text !== !!look.frame.text);
    if (cornice && pl.frame && !look.frame && pq.n === qr.n) {
      /* togliere la cornice è l'andata al contrario: l'anello si cancella lungo il suo tratto e la scritta scende e
         sparisce (VIA ms, la tela resta della misura con la cornice), poi la carta si assesta (opzioni) */
      G.frOut = { t0: t, frame: pl.frame }; G.fr = null; flip.style.transform = "";
    } else if (cornice && pq.n === qr.n) {
      var prim = rettCodice(pl, L.size);
      G.qr = qr; misuraTela(look);
      var dopo = rettCodice(look, L.size), k = prim.s / dopo.s;
      flip.style.transformOrigin = "0 0";
      G.fr = { t0: t, flip: { tx: prim.x - dopo.x * k, ty: prim.y - dopo.y * k, k: k } };
    } else if (cornice) G.fr = { t0: t, flip: null };
    G.qr = qr;
    if (pq.n !== qr.n) {
      /* un'altra misura: il vecchio codice rientra, modulo per modulo, e il nuovo cresce da zero, un passo dopo */
      var vecchi = G.field && G.field.n === pq.n ? G.field.cells : Q.targets(pq, pl);
      var Fo = campoNuovo(pq.n), No = pq.n * pq.n, j;
      for (j = 0; j < No; j++) Fo.cells[j] = vecchi[j];
      campoOnda(Fo, new Uint8Array(No), t, 0);
      G.old = { qr: pq, look: pl, field: Fo, t0: t, dur: SNAP };
      G.field = campoNuovo(qr.n);
      campoOnda(G.field, Q.targets(qr, look), t, 70);
      G.morph = null; G.flow = null; G.wave = null;
      misuraTela(look);
    } else if (!stessoCodice || chiave(pl) !== chiave(look) || !G.field) {
      if (!G.field && stessoCodice && chiave(pl) === chiave(look)) { /* niente da muovere nei moduli */ }
      else campoVerso(qr, look, t, pq, pl);
    }
    if (pq.n === qr.n && (pl.shape !== look.shape || pl.eye !== look.eye)) G.morph = { shape: pl.shape, eye: pl.eye, t0: t };
    if (colore(pl) !== colore(look) || fondo(pl) !== fondo(look)) {
      var ang = typeof look.fg === "object" ? look.fg.angle : 45;
      G.flow = { fg: colore(pl) !== colore(look) ? pl.fg : null, bg: fondo(pl) !== fondo(look) ? pl.bg : null, angle: ang, t0: t };
    }
    if (look.logo && (!pl.logo || pl.logo.image !== look.logo.image)) G.drop = { t0: t + (pq.n !== qr.n ? 220 : 140) };
    G.look = look;
    if (!G.fr && !G.frOut) misuraTela(look);
    avvia();
  }
  /* la prima volta la carta del codice non compare di colpo: cresce da .94 e si accende (220 ms), poi i moduli a onda */
  function cartaEntra() {
    if (!cv.animate) return;
    try { cv.animate([{ transform: "scale(.94)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "backwards" }); } catch (e) { /* senza: compare e basta */ }
  }

  /* ================================================================== aggiorna: il cuore */
  var ver = 0;
  function aggiorna(cosa) {
    var t0 = now();
    var c = contenuto();
    G.esempio = !c;
    var text = c ? c.text : ESEMPIO;
    G.desc = c ? c.desc : "dell'esempio " + ESEMPIO; G.nome = c ? c.nome : "qr-imad-chat";
    G.cosa = c ? c.cosa : "imad.chat"; G.avvisoC = c && c.avviso ? c.avviso : null;
    if (cosaEl && cosaEl.textContent !== G.cosa) cosaEl.textContent = G.cosa;
    var ecc = IMG.cv ? "H" : "M", qr = null, err = null;
    try { qr = Q.encode(text, { ecc: ecc }); }
    catch (e) {
      if (e && e.code === "TROPPO_LUNGO" && ecc === "M") { try { qr = Q.encode(text, { ecc: "L" }); } catch (e2) { err = e2; } }
      else err = e;
    }
    ver++; pronto = null; G.letto = null; G.lungo = false; clearTimeout(controlloT); clearTimeout(lungoT);
    aiutoLink(c);
    if (err) {
      G.err = err.code === "TROPPO_LUNGO" && ecc === "H" ? "Troppo lungo con l'immagine: accorcia il testo o toglila."
        : (err.message || "Questo testo non entra in un codice QR.");
      tela.classList.add("is-troppo");
      mostra(); T.tempi.push(now() - t0); return;
    }
    G.err = null; tela.classList.remove("is-troppo");
    G.text = text;
    var look = aspetto();
    tela.classList.toggle("is-trasp", S.trasp);
    passa(qr, look, cosa);
    G.regole = conContenuto(Q.scannable(conMisura(look, 1024, 1), qr));
    cv.setAttribute("aria-label", "Codice QR " + G.desc);
    numeri(qr.n);
    if (G.qr) limiteImmagine();
    mostra();
    T.tempi.push(now() - t0);
  }

  /* ciò che il contenuto non farà anche se si legge (la rete senza password...) va tra gli avvisi, per primo */
  function conContenuto(sc) {
    if (!G.avvisoC) return sc;
    return { ok: false, level: sc.level === "errore" ? "errore" : "avviso", why: sc.level === "errore" ? sc.why : G.avvisoC,
      problems: [{ code: "CONTENUTO", level: "avviso", why: G.avvisoC }].concat(sc.problems || []), details: sc.details };
  }

  /* scrivere: il disegno segue mentre si scrive, ma al massimo un aggiornamento ogni 100 ms; l'ultimo tasto vince sempre
     (un'attesa breve dopo l'ultimo tasto, poi si disegna lui: niente in coda) */
  var scriviT = 0, ultimoAgg = 0;
  function scrivendo() {
    var t = now();
    clearTimeout(scriviT);
    var attesa = Math.max(45, 100 - (t - ultimoAgg));
    scriviT = setTimeout(function () { ultimoAgg = now(); aggiorna("contenuto"); }, attesa);
  }

  /* ================================================================== lo stato sotto il codice */
  var DETTI = {
    "CONTRASTO:errore": ["Contrasto troppo basso: con poca luce non si legge.", "scurisci"],
    "CONTRASTO:avviso": ["Poco contrasto tra codice e fondo.", "correggi"],
    "INVERTITO:avviso": ["Chiaro su scuro: molti non lo leggono.", "inverti"],
    "TRASPARENTE:avviso": ["Fondo trasparente: mettilo su un fondo chiaro.", null],
    "DENSO:avviso": ["Molto fitto: se puoi, accorcia il testo.", null],
    "DENSO:errore": ["Troppo fitto per un telefono: accorcia il testo.", null],
    "LOGO_GRANDE:errore": ["Immagine troppo grande: non si legge.", "piccola"],
    "MODULI_PICCOLI:errore": ["Troppo fitto: accorcia il testo.", null],
    "MARGINE:avviso": ["Margine stretto: alcuni lettori faticano.", null],
    "LOGO_ECC:avviso": ["Con un'immagine serve la correzione alta.", null]
  };
  var FIX = { scurisci: "Scurisci", correggi: "Correggi", inverti: "Inverti", piccola: "Rimpicciolisci" };
  var COSA = { scurisci: "scurisci il colore.", correggi: "dai più contrasto ai colori.", inverti: "inverti i colori.", piccola: "rimpicciolisci l'immagine." };
  /* il problema da dire: prima i rossi; tra gli arancioni, chiaro su scuro prima del contrasto (la correzione giusta è invertire) */
  function primo(sc) {
    var ps = sc.problems || [], rank = { errore: 0, avviso: 1 }, pri = { CONTENUTO: -1, INVERTITO: 0, LOGO_GRANDE: 0, CONTRASTO: 1 };
    return ps.slice().sort(function (a, b) { return (rank[a.level] - rank[b.level]) || ((pri[a.code] === undefined ? 2 : pri[a.code]) - (pri[b.code] === undefined ? 2 : pri[b.code])); })[0];
  }
  function detto(p) { var d = DETTI[p.code + ":" + p.level]; return d || [p.why, null]; }
  var livello = "attesa", ultimoAnnuncio = "", visto = null;
  function mostra() {
    var lv, msg, fix = null, dubbio = false;
    if (G.err) { lv = "errore"; msg = G.err; visto = lv; }
    else {
      var sc = G.regole || { level: "ok", problems: [] }, top = primo(sc);
      if (G.letto === false) { fix = top ? detto(top)[1] : null; lv = "errore"; msg = sc.level === "errore" ? detto(top)[0] : "Non si legge: " + (fix ? COSA[fix] : "prova colori più netti."); }
      else if (sc.level === "errore") { lv = "errore"; msg = detto(top)[0]; fix = detto(top)[1]; }
      else if (G.letto === null) {
        /* mentre si ricontrolla (anche per tutto il tempo in cui si scrive): restano le parole dell'ultimo verdetto, con
           l'icona più tenue; ciò che dicono le regole (contrasto, misura) vale subito, senza aspettare la lettura;
           «Controllo…» solo se la lettura tarda (400 ms dopo che il disegno si è fermato) o se prima non si leggeva */
        if (sc.level === "avviso") { lv = "avviso"; msg = detto(top)[0]; fix = detto(top)[1]; dubbio = true; }
        else if (visto === "ok" && !G.lungo) { lv = "ok"; msg = G.esempio ? "Esempio: si legge" : "Si legge"; dubbio = true; }
        else { lv = "attesa"; msg = G.esempio ? "Esempio: controllo…" : "Controllo…"; }
      }
      else if (sc.level === "avviso") { lv = "avviso"; msg = detto(top)[0]; fix = detto(top)[1]; }
      else { lv = "ok"; msg = G.esempio ? "Esempio: si legge" : "Si legge"; }
      if (G.letto !== null || (sc.level === "errore" && !dubbio)) visto = lv;
    }
    livello = lv;
    stato.setAttribute("data-l", lv);
    stato.classList.toggle("is-attesa", lv === "attesa" && msg.indexOf("Controllo") >= 0);
    stato.classList.toggle("is-dubbio", dubbio);
    if (statoT.textContent !== msg) statoT.textContent = msg;
    bFix.hidden = !fix; if (fix) { bFix.textContent = FIX[fix]; bFix.setAttribute("data-fix", fix); }
    var spento = lv === "errore";
    [bSalva, bAltro, bCopia, bCondividi].forEach(function (b) { b.disabled = spento; });
    if (spento) chiudiMenu();
    alto();
    posaPresto();
    if (lv !== "attesa" && !dubbio) {
      var a = msg + (lv === "ok" ? "." : "");
      if (a !== ultimoAnnuncio) { ultimoAnnuncio = a; annuncio.textContent = a; }
    }
  }

  /* quando il disegno è fermo: si rilegge il PNG che si salverebbe */
  var controlloT = 0, lungoT = 0, pronto = null;
  function controllaPresto() {
    clearTimeout(controlloT); clearTimeout(lungoT);
    if (G.err || !G.qr) return;
    controlloT = setTimeout(controlla, fermo() ? 0 : 90);
    if (G.letto === null && !fermo()) lungoT = setTimeout(function () { if (G.letto === null && !G.err && !G.lungo) { G.lungo = true; mostra(); } }, 400);
  }
  /* il codice che si rilegge è solo il quadrato del codice con il suo margine (QRCore.codeBox): l'anello e la scritta della
     cornice sono decorazione fuori dal margine, e a volte confondono jsQR (non i telefoni). Un compito breve per volta (il
     disegno a 1024 px, poi una scala per compito), così chi riprende a scrivere non aspetta: se nel frattempo qualcosa
     cambia, la lettura si lascia lì */
  function scatola(size) { return Q.codeBox(G.qr, conMisura(G.look, size, 1)); }
  function controlla() {
    if (G.loop || G.err || !G.qr) return;
    var my = ver, t0 = now();
    var exp = esporta(1024), box = scatola(1024), spesa = now() - t0, scale = [0.5, 1, 0.75], i = 0;
    (function passo() {
      controlloT = setTimeout(function () {
        if (my !== ver || G.loop) return;
        var t2 = now(), v = null;
        try { v = Q.verify(exp, G.text, { scales: [scale[i]], crop: box }); } catch (e) { v = { ok: false }; }
        spesa += now() - t2; i++;
        (T.passi || (T.passi = [])).push(now() - t2);
        if (my !== ver) return;
        if (!v.ok && i < scale.length) { passo(); return; }
        T.controlli++; T.ultimoControllo = spesa;
        G.letto = !!v.ok; clearTimeout(lungoT);
        mostra();
        if (v.ok && exp.toBlob) exp.toBlob(function (b) { if (my === ver && b) pronto = { ver: my, blob: b }; }, "image/png");
      }, 0);
    })();
  }

  /* ================================================================== i numeri che rotolano: «25 × 25» */
  var giri = [];
  function numeri(n) {
    var s = String(n), parti = [s, s];
    if (!giri.length || giri[0].length !== s.length) {
      infoN.innerHTML = "";
      giri = [];
      parti.forEach(function (p, j) {
        if (j === 1) { var x = doc.createElement("span"); x.className = "st-info__x"; x.textContent = "×"; infoN.appendChild(x); }
        var cols = [];
        for (var i = 0; i < p.length; i++) {
          var w = doc.createElement("span"); w.className = "st-rot";
          var c = doc.createElement("span"); c.className = "st-rot__c";
          for (var d = 0; d <= 9; d++) { var it = doc.createElement("i"); it.textContent = d; c.appendChild(it); }
          w.appendChild(c); infoN.appendChild(w); cols.push(c);
        }
        giri.push(cols);
      });
      var tail = doc.createElement("span"); tail.className = "st-info__m"; tail.textContent = "\u00a0moduli"; infoN.appendChild(tail);
      giri.forEach(function (cols) { cols.forEach(function (c) { c.style.transition = "none"; }); });
      var vecchio = infoN.getAttribute("data-n") || s;
      imposta(vecchio.length === s.length ? vecchio : s);
      void infoN.offsetWidth;
      giri.forEach(function (cols) { cols.forEach(function (c) { c.style.transition = ""; }); });
    }
    imposta(s);
    infoN.setAttribute("data-n", s);
    info.setAttribute("title", s + " × " + s + " moduli");
  }
  function imposta(s) {
    giri.forEach(function (cols) {
      for (var i = 0; i < cols.length; i++) cols[i].style.transform = "translateY(" + (-19 * (+s.charAt(i) || 0)) + "px)";
    });
  }

  /* ================================================================== la carta: dove sta, quanto è grande */
  function misura() {
    L.wide = mqWide.matches;
    var head = $("testa");
    L.top = Math.round(head ? head.getBoundingClientRect().height : 56);
    root.style.setProperty("--st-top", L.top + "px");
    L.cardW = lato.clientWidth;
    L.dpr = dprOra();
    if (L.wide) L.box = clamp(Math.floor(Math.min(L.cardW - 64, win.innerHeight - L.top - 14 - 98 - 12 - 60 - 28)), 140, 320);
    else L.box = clamp(Math.floor(L.cardW - 118), 160, 228);
    L.cbox = L.Hmin - 28;
    L.sw = L.wide ? L.cardW - 32 - 110 : L.cardW - 14 - L.cbox - 14 - 14;
    carta.style.setProperty("--st-sw", L.sw + "px");
    if (cosaEl) cosaEl.style.width = Math.max(40, L.sw - 25) + "px";
    L.H0 = altezza();
    lato.style.setProperty("--st-h0", L.H0 + "px");
    tela.style.width = L.box + "px"; tela.style.height = L.box + "px";
    var mr = main.getBoundingClientRect(), pt = parseFloat(win.getComputedStyle(main).paddingTop) || 0;
    L.startY = Math.round(mr.top + win.pageYOffset + pt - L.top);
    L.k = -1;
  }
  /* l'altezza piena della carta sul telefono: il codice, la riga dello stato quanto è alta adesso, i margini; un avviso su due
     righe allunga la carta di una riga invece di tenere sempre un posto vuoto */
  function altezza() { return L.wide ? L.box + 98 : 16 + L.box + 14 + Math.max(19, Math.round(stato.offsetHeight)) + 16; }
  function alto() {
    if (L.wide || !L.cardW) return;
    var h = altezza(); if (h === L.H0) return;
    var stuck = win.pageYOffset > L.startY + 0.5, com = $("comandi"), y0 = stuck ? com.getBoundingClientRect().top : 0;
    L.H0 = h; lato.style.setProperty("--st-h0", h + "px");
    /* la carta è in cima: i comandi sotto non si muovono. Chromium lo fa da sé (scroll anchoring), Safari no: si sposta solo
       quanto resta da spostare */
    if (stuck) { var dy = com.getBoundingClientRect().top - y0; if (Math.abs(dy) > 0.5) win.scrollBy(0, dy); }
    posaPresto();
  }
  var posaRaf = 0;
  function posa() {
    var k = L.wide ? 0 : clamp((win.pageYOffset - L.startY) / (L.H0 - L.Hmin), 0, 1);
    var stuck = !L.wide && win.pageYOffset > L.startY + 0.5;
    L.k = k;
    var H = Math.round(L.H0 - k * (L.H0 - L.Hmin));
    carta.style.height = H + "px";
    lato.style.setProperty("--st-h", H + "px");
    lato.style.setProperty("--st-velo", stuck ? "1" : "0");
    var s = lerp(1, L.cbox / L.box, k);
    var x = lerp((L.cardW - L.box) / 2, 14, k), y = lerp(16, 14, k);
    tela.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) scale(" + s.toFixed(4) + ")";
    if (misure.testo !== statoT.textContent + bFix.hidden || misure.n !== infoN.getAttribute("data-n")) {
      misure.testo = statoT.textContent + bFix.hidden; misure.n = infoN.getAttribute("data-n");
      misure.iw = info.offsetWidth; misure.sh = stato.offsetHeight;
    }
    var iw = misure.iw, sh = misure.sh;
    /* nella carta piccola lo stato, i moduli e cosa c'è dentro stanno in un blocco centrato in altezza accanto al codice */
    var blocco = sh + 3 + 19 + 5 + 16;
    var sx0 = 18, sy0 = 16 + L.box + 14, sx1 = 14 + L.cbox + 14, sy1 = 14 + Math.max(0, (L.cbox - blocco) / 2);
    stato.style.transform = "translate(" + lerp(sx0, sx1, k).toFixed(2) + "px," + lerp(sy0, sy1, k).toFixed(2) + "px)";
    var ix0 = L.cardW - 18 - iw, iy0 = sy0, ix1 = sx1 + 25, iy1 = sy1 + sh + 3;
    info.style.transform = "translate(" + lerp(ix0, ix1, k).toFixed(2) + "px," + lerp(iy0, iy1, k).toFixed(2) + "px)";
    if (cosaEl) {
      cosaEl.style.transform = "translate(" + lerp(ix0, ix1, k).toFixed(2) + "px," + (lerp(iy0, iy1, k) + 24).toFixed(2) + "px)";
      cosaEl.style.opacity = clamp((k - 0.55) / 0.4, 0, 1).toFixed(3);
    }
  }
  function posaPresto() { if (posaRaf) return; posaRaf = raf(function () { posaRaf = 0; posa(); }); }
  var misure = { iw: 0, sh: 0, testo: null, n: null };
  win.addEventListener("scroll", function () { if (L.wide) return; posaPresto(); }, { passive: true });
  var resizeT = 0;
  function ridisegna() {
    misura(); misure.testo = null;
    if (G.qr) { tuttoFermo(); misuraTela(G.look); disegna(now()); controllaPresto(); tessFatte = {}; tessere(true); }
    posa(); pillole(); barra();
  }
  win.addEventListener("resize", function () {
    if (win.innerWidth !== ultimaW) { ultimaW = win.innerWidth; altoMax = win.innerHeight; }
    clearTimeout(resizeT); resizeT = setTimeout(function () { ridisegna(); suTastiera(); }, 80);
  });

  /* ================================================================== la tastiera del telefono
     Mentre si scrive in un campo con la tastiera su, la barra in basso scivola via (starebbe sopra i tasti o sopra il campo)
     e torna appena il campo perde il fuoco (120 ms dopo, così passando da un campo all'altro non sfarfalla). Ciò che prende
     il fuoco non resta mai sotto la carta in cima o sotto la barra: il margine di scorrimento del CSS (scroll-padding) e,
     dopo, un controllo qui. Su iOS la carta resta sotto il bordo visibile (visualViewport.offsetTop). Non provato su un
     telefono vero: qui solo Chromium, con la tastiera finta come uno schermo più basso. */
  var vv = win.visualViewport, ultimaW = win.innerWidth, altoMax = win.innerHeight, viaT = 0, azioni = $("azioni");
  function campoAttivo() { var a = doc.activeElement; return !!(a && a.classList && a.classList.contains("st-in")); }
  function tastiera() {
    if (L.wide || !campoAttivo()) return false;
    return !!((vv && vv.height < win.innerHeight - 100) || win.innerHeight < altoMax - 120);
  }
  function suTastiera() {
    if (win.innerHeight > altoMax) altoMax = win.innerHeight;
    var su = tastiera();
    if (su !== azioni.classList.contains("is-via")) { azioni.classList.toggle("is-via", su); if (su) chiudiMenu(); }
    var off = su && vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
    root.style.setProperty("--st-top", (L.top + off) + "px");
  }
  function inVista(el) {
    if (L.wide || !el || !el.getBoundingClientRect) return;
    if (el === fImgEl) el = doc.querySelector(".st-img__scegli");
    var r = el.getBoundingClientRect(); if (!r.height) return;
    var su = carta.getBoundingClientRect().bottom + 10;
    var vb = vv ? vv.offsetTop + vv.height : win.innerHeight;
    var giu = (azioni.classList.contains("is-via") ? vb : Math.min(vb, azioni.getBoundingClientRect().top)) - 10;
    if (r.top < su) win.scrollBy(0, r.top - su);
    else if (r.bottom > giu) win.scrollBy(0, Math.min(r.bottom - giu, r.top - su));
  }
  var fImgEl = $("fImg");
  $("comandi").addEventListener("focusin", function (e) {
    var el = e.target;
    clearTimeout(viaT); suTastiera();
    raf(function () { inVista(el); });
    setTimeout(function () { suTastiera(); if (doc.activeElement === el) inVista(el); }, 360);   /* la tastiera ci mette un attimo */
  });
  $("comandi").addEventListener("focusout", function () { clearTimeout(viaT); viaT = setTimeout(suTastiera, 120); });
  if (vv && vv.addEventListener) { vv.addEventListener("resize", suTastiera); vv.addEventListener("scroll", suTastiera); }
  if (mqWide.addEventListener) mqWide.addEventListener("change", ridisegna); else if (mqWide.addListener) mqWide.addListener(ridisegna);

  /* ================================================================== le tessere: pezzetti di codice vero */
  /* Le tessere ritagliano un codice vero, sempre lo stesso (quello di https://imad.chat, versione 2; per i moduli quello di
     https://imad.chat/tools): scrivere non le fa
     ridisegnare, e il disegno costa poco. Si rifanno solo quando cambia ciò che mostrano (forma, occhi, tema, densità), un
     gruppo per volta e mai mentre il codice si muove. I colori pronti: un solo disegno in nero, che ogni tessera tinge con la
     sua coppia (la sfumatura attraversa la tessera nella sua direzione). */
  var tessT = 0, tessFatte = {}, grande = doc.createElement("canvas"), tinta = doc.createElement("canvas"), TQ = null;
  function tessereDopo() { clearTimeout(tessT); tessT = setTimeout(function () { tessere(false); }, 80); }
  function inchiostro() { var c = win.getComputedStyle(doc.body).color; return c || "#16171d"; }
  function disegnaGrande(opts, M, qr) {
    if (!TQ) TQ = Q.encode(ESEMPIO, { ecc: "M" });
    qr = qr || TQ;
    Q.render(grande, qr, Object.assign({}, opts, { size: (qr.n + 4) * M, dpr: 1, quiet: 2, style: false }));
    return Math.floor((grande.width - M * qr.n) / 2);
  }
  /* il pezzetto delle tessere dei moduli, scelto con una regola e non a caso: 6 × 6 moduli di dati con 14-20 scuri, nessuna
     riga o colonna tutta scura, almeno 3 moduli soli e almeno 2 gruppi uniti (così «Uniti» mostra le giunture); tra quelli,
     il più vicino al centro. Lo stesso per le quattro tessere: cambia solo la forma. Il codice di https://imad.chat ha pochi
     moduli soli (al massimo 2 in 6 × 6), quindi queste tessere ritagliano quello della pagina degli strumenti */
  var PEZZO = null, TQF = null;
  function pezzo() {
    if (PEZZO) return PEZZO;
    if (!TQF) TQF = Q.encode("https://imad.chat/tools", { ecc: "M" });
    var n = TQF.n, K = Q.KIND.data, best = null, bd = 1e9, r0, c0, r, c;
    var dk = function (rr, cc) { return rr >= 0 && cc >= 0 && rr < n && cc < n && TQF.modules[rr * n + cc] === 1; };
    for (r0 = 0; r0 <= n - 6; r0++) for (c0 = 0; c0 <= n - 6; c0++) {
      var ok = true, scuri = 0, soli = 0, rig = [0, 0, 0, 0, 0, 0], col = [0, 0, 0, 0, 0, 0];
      for (r = 0; r < 6 && ok; r++) for (c = 0; c < 6; c++) {
        var R = r0 + r, C = c0 + c;
        if (TQF.kinds[R * n + C] !== K) { ok = false; break; }
        if (!dk(R, C)) continue;
        scuri++; rig[r]++; col[c]++;
        if (!dk(R - 1, C) && !dk(R + 1, C) && !dk(R, C - 1) && !dk(R, C + 1)) soli++;
      }
      if (!ok || scuri < 14 || scuri > 20 || soli < 3 || rig.indexOf(6) >= 0 || col.indexOf(6) >= 0) continue;
      var visto = new Uint8Array(36), gruppi = 0;
      for (var i = 0; i < 36; i++) {
        if (visto[i] || !dk(r0 + ((i / 6) | 0), c0 + i % 6)) continue;
        var pila = [i], quanti = 0; visto[i] = 1;
        while (pila.length) {
          var j = pila.pop(), jr = (j / 6) | 0, jc = j % 6; quanti++;
          var vicini = [[jr - 1, jc], [jr + 1, jc], [jr, jc - 1], [jr, jc + 1]];
          for (var q = 0; q < 4; q++) {
            var vr = vicini[q][0], vc = vicini[q][1], vi = vr * 6 + vc;
            if (vr < 0 || vc < 0 || vr > 5 || vc > 5 || visto[vi] || !dk(r0 + vr, c0 + vc)) continue;
            visto[vi] = 1; pila.push(vi);
          }
        }
        if (quanti >= 2) gruppi++;
      }
      if (gruppi < 2) continue;
      var d = Math.abs(r0 + 3 - n / 2) + Math.abs(c0 + 3 - n / 2) + Math.abs(scuri - 17) * 0.5;
      if (d < bd) { bd = d; best = [r0, c0]; }
    }
    PEZZO = best || [9, 9];
    T.pezzo = PEZZO;
    return PEZZO;
  }
  function tela50(btn) {
    var c = btn.querySelector("canvas"); if (!c) return null;
    var px = Math.round(50 * L.dpr);
    if (c.width !== px) { c.width = px; c.height = px; }
    return c;
  }
  function ritaglio(btn, opts, r0, c0, span, M, qr) {
    var c = tela50(btn); if (!c) return;
    var ox = disegnaGrande(opts, M, qr), px = c.width, x = c.getContext("2d");
    x.clearRect(0, 0, px, px); x.imageSmoothingEnabled = true;
    x.drawImage(grande, ox + c0 * M, ox + r0 * M, span * M, span * M, 0, 0, px, px);
  }
  function coppieTessere(M) {
    var span = 10, ox = disegnaGrande({ shape: S.forma, eye: S.occhi, fg: "#000000", bg: "transparent" }, M);
    qsa("#coppie .st-tess").forEach(function (b) {
      var p = COPPIE.filter(function (x) { return x.id === b.getAttribute("data-v"); })[0], c = tela50(b); if (!p || !c) return;
      var px = c.width;
      if (tinta.width !== px) { tinta.width = px; tinta.height = px; }
      var tx = tinta.getContext("2d");
      tx.globalCompositeOperation = "source-over"; tx.clearRect(0, 0, px, px); tx.imageSmoothingEnabled = true;
      tx.drawImage(grande, ox - M, ox - M, span * M, span * M, 0, 0, px, px);
      tx.globalCompositeOperation = "source-in";
      if (p.grad) {
        var a = p.ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), h = (Math.abs(dx) + Math.abs(dy)) * px / 2;
        var g = tx.createLinearGradient(px / 2 - dx * h, px / 2 - dy * h, px / 2 + dx * h, px / 2 + dy * h);
        g.addColorStop(0, p.fg); g.addColorStop(1, p.fg2); tx.fillStyle = g;
      } else tx.fillStyle = p.fg;
      tx.fillRect(0, 0, px, px);
      tx.globalCompositeOperation = "source-over";
      var x = c.getContext("2d");
      x.globalCompositeOperation = "source-over"; x.fillStyle = p.bg; x.fillRect(0, 0, px, px);
      x.drawImage(tinta, 0, 0);
    });
  }
  function tessere(subito) {
    if (!G.qr) return;
    var ink = inchiostro(), base = L.dpr + "|", px = Math.round(50 * L.dpr);
    var M6 = Math.max(4, Math.ceil(px / 6)), M9 = Math.max(4, Math.ceil(px / 9)), M10 = Math.max(4, Math.ceil(px / 10));
    var gruppi = [
      ["forme", base + ink, function () { var pz = pezzo(); qsa("#forme .st-tess").forEach(function (b) { ritaglio(b, { shape: b.getAttribute("data-v"), eye: S.occhi, fg: ink, bg: "transparent" }, pz[0], pz[1], 6, M6, TQF); }); }],
      ["occhi", base + S.forma + ink, function () { qsa("#occhi .st-tess").forEach(function (b) { ritaglio(b, { shape: S.forma, eye: b.getAttribute("data-v"), fg: ink, bg: "transparent" }, -1, -1, 9, M9); }); }],
      ["coppie", base + S.forma + S.occhi, function () { coppieTessere(M10); }]
    ].filter(function (g) { return tessFatte[g[0]] !== g[1]; });
    var i = 0;
    (function uno() {
      if (G.loop && !subito) { tessereDopo(); return; }        /* mentre il codice si muove, le tessere aspettano */
      var g = gruppi[i++]; if (!g) return;
      g[2](); tessFatte[g[0]] = g[1];
      if (subito) uno(); else tessT = setTimeout(uno, 16);
    })();
  }

  /* ================================================================== i gruppi di scelte (frecce, Home, Fine) e le pillole che scivolano */
  function gruppo(el, scegli) {
    var bs = qsa('[role="radio"]', el);
    function metti(v, fuoco) {
      bs.forEach(function (b) {
        var on = b.getAttribute("data-v") === String(v);
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        if (on && fuoco) b.focus();
      });
      if (!bs.some(function (b) { return b.tabIndex === 0; }) && bs[0]) bs[0].tabIndex = 0;
      pillola(el);
    }
    bs.forEach(function (b, i) {
      b.addEventListener("click", function () { var v = b.getAttribute("data-v"); metti(v); scegli(v); });
      b.addEventListener("keydown", function (e) {
        var j = -1, k = e.key;
        if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % bs.length;
        else if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + bs.length) % bs.length;
        else if (k === "Home") j = 0; else if (k === "End") j = bs.length - 1;
        if (j < 0) return;
        e.preventDefault();
        var v = bs[j].getAttribute("data-v"); metti(v, true); scegli(v);
      });
    });
    return { metti: metti };
  }
  var pilloleEl = [];
  function pillola(el) {
    var p = el.querySelector(".st-chips__pill, .st-seg__pill"); if (!p) return;
    if (pilloleEl.indexOf(el) < 0) pilloleEl.push(el);
    var b = el.querySelector('[aria-checked="true"]'); if (!b) { p.style.opacity = "0"; return; }
    p.style.opacity = "";
    p.style.width = b.offsetWidth + "px";
    p.style.transform = "translateX(" + b.offsetLeft + "px)";
    if (el.classList.contains("st-chips")) {
      var l = b.offsetLeft - 18, r = b.offsetLeft + b.offsetWidth + 18;
      if (l < el.scrollLeft) el.scrollTo ? el.scrollTo({ left: l, behavior: fermo() ? "auto" : "smooth" }) : (el.scrollLeft = l);
      else if (r > el.scrollLeft + el.clientWidth) el.scrollTo ? el.scrollTo({ left: r - el.clientWidth, behavior: fermo() ? "auto" : "smooth" }) : (el.scrollLeft = r - el.clientWidth);
    }
  }
  function pillole() { pilloleEl.forEach(function (el) { var p = el.querySelector(".st-chips__pill, .st-seg__pill"); if (p) { p.style.transition = "none"; pillola(el); void p.offsetWidth; p.style.transition = ""; } }); }

  function interruttore(btn, su) {
    btn.addEventListener("click", function () { var on = btn.getAttribute("aria-checked") !== "true"; btn.setAttribute("aria-checked", on ? "true" : "false"); su(on); });
  }
  function accendi(btn, on) { btn.setAttribute("aria-checked", on ? "true" : "false"); }

  /* ================================================================== cosa ci metti */
  var campi = qsa(".st-campi");
  var gTipi = gruppo($("tipi"), function (v) {
    TIPO = v;
    campi.forEach(function (c) { c.hidden = c.getAttribute("data-per") !== v; });
    pillole();          /* le pillole dei campi appena comparsi si misurano adesso (da nascoste erano larghe zero), senza scivolare */
    aggiorna("contenuto");
  });
  ["fLink", "fTesto", "fSsid", "fPw", "fNome", "fTel", "fMail", "fOrg", "fSito", "fA", "fOgg", "fCorpo", "fNum"].forEach(function (id) {
    var el = $(id); if (!el) return;
    el.addEventListener("input", function () {
      if (el.tagName === "TEXTAREA") cresci(el);
      var x = doc.querySelector('[data-x="' + id + '"]'); if (x) x.hidden = !el.value;
      if (id === "fTesto") conta();
      scrivendo();
    });
    if (el.tagName === "INPUT") el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
  });
  qsa("[data-x]").forEach(function (x) {
    x.addEventListener("click", function () { var el = $(x.getAttribute("data-x")); el.value = ""; x.hidden = true; aggiorna("contenuto"); el.focus(); });
  });
  function cresci(el) { el.style.height = "auto"; var h = Math.min(el.scrollHeight, 22 * 9 + 24); el.style.height = Math.max(96, h) + "px"; el.style.overflowY = el.scrollHeight > h ? "auto" : "hidden"; }
  function conta() { var t = val("fTesto"), k = Array.from(t).length; $("aTesto").textContent = k ? (k === 1 ? "1 carattere" : k.toLocaleString("it-IT") + " caratteri") : ""; }
  function aiutoLink(c) { var a = $("aLink"); if (a) a.hidden = !(TIPO === "link" && c && c.testo); }
  var bMostra = $("bMostra");
  bMostra.addEventListener("click", function () {
    var pw = $("fPw"), on = pw.type === "password";
    pw.type = on ? "text" : "password";
    bMostra.textContent = on ? "Nascondi" : "Mostra"; bMostra.setAttribute("aria-pressed", on ? "true" : "false");
  });
  gruppo($("prot"), function (v) { PROT = v; $("campoPw").hidden = v === "nopass"; aggiorna("contenuto"); }).metti("WPA");
  interruttore($("fNasc"), function (on) { NASC = on; aggiorna("contenuto"); });

  /* ================================================================== forma e occhi */
  var gForme = gruppo($("forme"), function (v) { S.forma = v; ricorda(); aggiorna("forma"); });
  var gOcchi = gruppo($("occhi"), function (v) { S.occhi = v; ricorda(); aggiorna("occhi"); });

  /* ================================================================== colori */
  var boxCoppie = $("coppie");
  COPPIE.forEach(function (p) {
    var b = doc.createElement("button");
    b.type = "button"; b.className = "st-tess st-coppia"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false"); b.setAttribute("data-v", p.id);
    b.innerHTML = '<canvas aria-hidden="true"></canvas><span></span>';
    b.querySelector("span").textContent = p.nome;
    boxCoppie.appendChild(b);
  });
  var gCoppie = gruppo(boxCoppie, function (v) {
    var p = COPPIE.filter(function (x) { return x.id === v; })[0]; if (!p) return;
    S.coppia = v; S.fg = p.fg; S.fg2 = p.fg2; S.bg = p.bg; S.trasp = false; S.grad = false;
    ricorda(); mettiColori(); aggiorna("colore");
  });
  var cFg = $("cFg"), cFg2 = $("cFg2"), cBg = $("cBg"), fGrad = $("fGrad"), fTrasp = $("fTrasp");
  var gVersi = gruppo($("versi"), function (v) { S.ang = +v; S.coppia = null; ricorda(); mettiColori(); aggiorna("colore"); });
  function hexDi(input) { var s = input.parentNode.querySelector(".st-pozzo__hex"); if (s) s.textContent = input.value.toUpperCase(); }
  function mettiColori() {
    cFg.value = S.fg; cFg2.value = S.fg2; cBg.value = S.bg;
    [cFg, cFg2, cBg].forEach(hexDi);
    accendi(fGrad, S.grad); accendi(fTrasp, S.trasp);
    $("gradOpz").hidden = !S.grad;
    cBg.closest(".st-riga").classList.toggle("is-spento", S.trasp);
    gVersi.metti(S.ang);
    gCoppie.metti(S.coppia || "");
  }
  var coloreT = 0;
  function suColore(k, input) {
    input.addEventListener("input", function () {
      S[k] = input.value.toLowerCase(); S.coppia = null; hexDi(input);
      gCoppie.metti("");
      clearTimeout(coloreT); coloreT = setTimeout(function () { ricorda(); aggiorna("colore"); }, 40);
    });
  }
  suColore("fg", cFg); suColore("fg2", cFg2); suColore("bg", cBg);
  interruttore(fGrad, function (on) {
    S.grad = on;
    /* il secondo colore deve leggersi anche lui sul fondo di adesso: se non basta, si scurisce quanto serve, stessa tinta */
    if (on) S.fg2 = Q.fixContrast(S.fg2, S.trasp ? "#ffffff" : S.bg, 4.6) || S.fg2;
    S.coppia = null; ricorda(); mettiColori(); aggiorna("colore");
  });
  interruttore(fTrasp, function (on) { S.trasp = on; S.coppia = null; ricorda(); mettiColori(); aggiorna("colore"); });

  /* le correzioni a un tocco, dalla riga dello stato */
  bFix.addEventListener("click", function () {
    var f = bFix.getAttribute("data-fix");
    if (f === "scurisci" || f === "correggi") {
      var bg = S.trasp ? "#ffffff" : S.bg;
      S.fg = Q.fixContrast(S.fg, bg, 4.6) || S.fg; if (S.grad) S.fg2 = Q.fixContrast(S.fg2, bg, 4.6) || S.fg2;
      S.coppia = null; ricorda(); mettiColori(); aggiorna("colore");
    } else if (f === "inverti") {
      var a = S.fg; S.fg = S.bg; S.bg = a; S.grad = false; S.trasp = false; S.coppia = null;
      ricorda(); mettiColori(); aggiorna("colore");
    } else if (f === "piccola") {
      var mx = G.qr ? Q.maxLogoScale(G.qr, { pad: IMG.margine, round: IMG.tonda ? 1 : 0.16 }) : 0.2;
      IMG.scala = Math.max(0.12, mx); $("fScala").value = Math.round(IMG.scala * 100); scalaTesto(); aggiorna("img");
    }
    /* il pulsante si è nascosto con il fuoco addosso: il fuoco va sulla riga dello stato, che dice com'è andata */
    if (bFix.hidden) { try { stato.focus({ preventScroll: true }); } catch (e) { stato.focus(); } }
  });

  /* ================================================================== l'immagine al centro: resta sul telefono */
  var fImg = $("fImg"), bTogli = $("bTogli"), fScala = $("fScala"), imgThumb = $("imgThumb"), scegliLab = doc.querySelector(".st-img__scegli");
  fImg.addEventListener("focus", function () { scegliLab.classList.add("is-focus"); });
  fImg.addEventListener("blur", function () { scegliLab.classList.remove("is-focus"); });
  fImg.addEventListener("change", function () {
    var f = fImg.files && fImg.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type || "image/")) { $("imgNota").textContent = "Questo file non è un'immagine."; return; }
    $("imgNota").textContent = "Preparo l'immagine…";
    var male = function () { $("imgNota").textContent = "Questa immagine non si apre su questo telefono: prova con un'altra."; fImg.value = ""; };
    var bene = function () { $("imgNota").textContent = "L'immagine resta sul tuo telefono."; fImg.value = ""; };
    var conImg = function () {
      var url = win.URL.createObjectURL(f), img = new Image();
      img.decoding = "async";
      var fine = function () {
        try { usaImmagine(img); bene(); } catch (e) { male(); }
        win.URL.revokeObjectURL(url);
      };
      img.onload = function () { if (img.decode) img.decode().then(fine, fine); else fine(); };
      img.onerror = function () { win.URL.revokeObjectURL(url); male(); };
      img.src = url;
    };
    if (!win.createImageBitmap) { conImg(); return; }
    /* il browser apre la foto e la rimpicciolisce in un colpo solo, dal file e fuori dal filo della pagina (larga 768 px):
       una foto da 12 megapixel non blocca la pagina. Molto larga e bassa: si riapre alta 512. Se il browser non sa
       rimpicciolire, la foto arriva intera e la rimpicciolisce usaImmagine, a metà per volta. */
    var apri = function (o) { return win.createImageBitmap(f, Object.assign({ imageOrientation: "from-image", resizeQuality: "high" }, o)); };
    apri({ resizeWidth: 768 }).then(function (bm) {
      if (Math.min(bm.width, bm.height) >= 384 || bm.width !== 768) return bm;
      if (bm.close) bm.close();
      return apri({ resizeHeight: 512 });
    }).then(function (bm) {
      try { usaImmagine(bm); bene(); } catch (e) { conImg(); }
    }).catch(function () { conImg(); });
  });
  /* una foto grande si rimpicciolisce prima di usarla (a metà per volta: niente scalini, niente blocchi), ritagliata quadrata */
  function usaImmagine(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (!w || !h) throw new Error("vuota");
    var s = Math.min(w, h), sx = (w - s) / 2, sy = (h - s) / 2, src = img, OUT = 384;
    var cur = s, step = null;
    while (cur > OUT * 2) {
      var nx = Math.max(OUT, Math.round(cur / 2)), c = doc.createElement("canvas");
      c.width = c.height = nx;
      var cx = c.getContext("2d"); cx.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in cx) cx.imageSmoothingQuality = "high";
      if (step) cx.drawImage(step, 0, 0, cur, cur, 0, 0, nx, nx); else cx.drawImage(src, sx, sy, s, s, 0, 0, nx, nx);
      step = c; cur = nx;
    }
    var out = doc.createElement("canvas"); out.width = out.height = OUT;
    var ox = out.getContext("2d"); ox.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in ox) ox.imageSmoothingQuality = "high";
    if (step) ox.drawImage(step, 0, 0, cur, cur, 0, 0, OUT, OUT); else ox.drawImage(src, sx, sy, s, s, 0, 0, OUT, OUT);
    if (img.close) img.close();
    IMG.cv = out;
    /* l'anteprima piccola: un PNG (una foto con parti trasparenti resta trasparente), 96 px, che costa poco */
    var th = doc.createElement("canvas"); th.width = th.height = 96;
    var tx = th.getContext("2d"); tx.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in tx) tx.imageSmoothingQuality = "high";
    tx.drawImage(out, 0, 0, 96, 96);
    imgThumb.style.backgroundImage = "url(" + th.toDataURL("image/png") + ")";
    imgThumb.hidden = false; bTogli.hidden = false; $("imgOpz").hidden = false;
    $("imgScegliT").textContent = "Cambia";
    imgThumb.classList.toggle("is-quadrata", !IMG.tonda);
    aggiorna("img");
    pillole();
  }
  bTogli.addEventListener("click", function () {
    IMG.cv = null; imgThumb.hidden = true; bTogli.hidden = true; $("imgOpz").hidden = true; imgThumb.style.backgroundImage = "";
    $("imgScegliT").textContent = "Scegli un'immagine";
    aggiorna("img");
    scegliLab.focus && fImg.focus();
  });
  function scalaTesto() { $("scalaV").textContent = Math.round(IMG.scala * 100) + "%"; }
  var scalaT = 0;
  fScala.addEventListener("input", function () {
    IMG.scala = clamp(+fScala.value / 100, 0.12, 0.3); scalaTesto();
    clearTimeout(scalaT); scalaT = setTimeout(function () { aggiorna("img"); }, 16);
  });
  gruppo($("imgForma"), function (v) { IMG.tonda = v === "tonda"; imgThumb.classList.toggle("is-quadrata", !IMG.tonda); aggiorna("img"); }).metti("tonda");
  gruppo($("imgMarg"), function (v) { IMG.margine = +v; aggiorna("img"); }).metti("1");
  /* la barra della grandezza mostra fin dove il codice si legge: oltre il segno, a righe */
  function limiteImmagine() {
    if (!IMG.cv || !G.qr) return;
    var mx = Q.maxLogoScale(G.qr, { pad: IMG.margine, round: IMG.tonda ? 1 : 0.16 });
    var pos = function (v) { return clamp((v * 100 - 12) / 18 * 100, 0, 100); };
    var a = pos(IMG.scala), m = pos(mx);
    var fill = "var(--ink)", ok = "var(--fill-2)", no = "repeating-linear-gradient(135deg, rgba(180, 35, 24, .5) 0 3px, rgba(180, 35, 24, .14) 3px 6px)";
    var track = "linear-gradient(90deg, " + fill + " 0 " + Math.min(a, m) + "%, transparent " + Math.min(a, m) + "%), " +
      "linear-gradient(90deg, " + ok + " 0 " + m + "%, transparent " + m + "%), " + no;
    fScala.style.setProperty("--st-track", track);
    $("scalaAiuto").textContent = mx > 0 ? "Si legge fino al " + Math.round(mx * 100) + "%." : "Con questo testo l'immagine non ci sta: accorcialo.";
  }

  /* ================================================================== la cornice */
  var gCornice = gruppo($("cornice"), function (v) { S.cornice = v === "si"; $("scrittaOpz").hidden = !S.cornice; ricorda(); aggiorna("cornice"); pillole(); });
  var fScritta = $("fScritta"), scrittaT = 0;
  fScritta.addEventListener("input", function () { S.scritta = fScritta.value.slice(0, 24); clearTimeout(scrittaT); scrittaT = setTimeout(function () { ricorda(); aggiorna("cornice"); }, 60); });
  fScritta.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); fScritta.blur(); } });

  /* ================================================================== salvare, copiare, condividere */
  function blobDa(url) {
    var b = atob(url.split(",")[1]), n = b.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = b.charCodeAt(i);
    return new Blob([u], { type: "image/png" });
  }
  /* il PNG adesso, dentro il tocco: quello già pronto e riletto, oppure si fa e si rilegge qui */
  function pngOra(size) {
    if (G.err || !G.qr) return null;
    if (size === 1024 && pronto && pronto.ver === ver) return pronto.blob;
    var exp = esporta(size), v = null;
    try { v = Q.verify(exp, G.text, { scales: size > 1024 ? [0.25, 0.5, 1] : [0.5, 1, 0.75], crop: scatola(size) }); } catch (e) { v = { ok: false }; }
    /* il PNG grande che non si rilegge non cambia il verdetto del codice (quello da 1024 resta buono): lo si dice e basta */
    if (!v.ok && size > 1024) { nota("Il PNG da 2048 px non si rilegge: usa Salva, a 1024 px."); return null; }
    if (!v.ok) { G.letto = false; mostra(); return null; }
    if (G.letto === null) { G.letto = true; mostra(); }
    var b = blobDa(exp.toDataURL("image/png"));
    if (size === 1024) pronto = { ver: ver, blob: b };
    return b;
  }
  function scarica(blob, name) {
    var u = win.URL.createObjectURL(blob), a = doc.createElement("a");
    a.href = u; a.download = name; a.rel = "noopener"; a.style.display = "none";
    doc.body.appendChild(a); a.click();
    setTimeout(function () { win.URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); }, 4000);
    T.salvati.push({ name: name, size: blob.size, type: blob.type });
  }
  var fattoT = {};
  /* la risposta di un pulsante: la parola nuova e la spunta che disegna il suo tratto, per 1,25 s; nella barra stretta (solo
     icone per Copia e Condividi) la parola sale in una piccola etichetta sopra il pulsante. Si annuncia anche a voce. */
  function fatto(btn, parola) {
    var t = btn.querySelector(".st-b__t"), bolla = btn.querySelector(".st-b__bolla"), id = btn.id, prima = btn.getAttribute("data-t") || t.textContent;
    btn.setAttribute("data-t", prima);
    /* una risposta per volta: quella di un altro pulsante finisce subito */
    [bSalva, bCopia, bCondividi].forEach(function (o) {
      if (o === btn || !o.classList.contains("is-fatto")) return;
      clearTimeout(fattoT[o.id]); o.classList.remove("is-fatto");
      o.querySelector(".st-b__t").textContent = o.getAttribute("data-t") || o.querySelector(".st-b__t").textContent;
    });
    clearTimeout(fattoT[id]);
    btn.classList.remove("is-fatto"); void btn.offsetWidth;
    btn.classList.add("is-fatto"); t.textContent = parola;
    if (bolla) bolla.textContent = parola;
    annuncio.textContent = parola + "."; ultimoAnnuncio = "";
    fattoT[id] = setTimeout(function () { btn.classList.remove("is-fatto"); t.textContent = prima; }, 1250);
  }
  /* la barra: con Salva, Copia e Condividi tutti e tre non ci stanno le parole su un telefono; allora Copia e Condividi
     restano solo icone (il nome resta per chi legge con la voce) */
  function barra() {
    var tre = !bCopia.hidden && !bCondividi.hidden;
    $("azioni").classList.toggle("is-stretto", tre && $("azioni").clientWidth < 440);
  }
  var notaT = 0;
  function nota(msg) {
    clearTimeout(notaT);
    stato.setAttribute("data-l", "avviso"); stato.classList.remove("is-attesa", "is-dubbio"); bFix.hidden = true;
    statoT.textContent = msg; annuncio.textContent = msg; ultimoAnnuncio = "";
    alto(); posaPresto();
    notaT = setTimeout(mostra, 2600);
  }
  bSalva.addEventListener("click", function () {
    if (bSalva.disabled) return;
    var b = pngOra(1024); if (!b) return;
    scarica(b, G.nome + ".png"); fatto(bSalva, "Salvato");
  });
  /* il menu degli altri formati */
  function apriMenu() {
    menu.hidden = false; bAltro.setAttribute("aria-expanded", "true");
    var first = menu.querySelector(".st-menu__v"); if (first) first.focus();
    preparaSvg();
  }
  function chiudiMenu(fuoco) { if (menu.hidden) return; menu.hidden = true; bAltro.setAttribute("aria-expanded", "false"); if (fuoco) bAltro.focus(); }
  bAltro.addEventListener("click", function () { if (menu.hidden) apriMenu(); else chiudiMenu(true); });
  menu.addEventListener("keydown", function (e) {
    var vs = qsa(".st-menu__v", menu), i = vs.indexOf(doc.activeElement);
    if (e.key === "Escape") { e.preventDefault(); chiudiMenu(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); vs[(i + 1) % vs.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); vs[(i - 1 + vs.length) % vs.length].focus(); }
    else if (e.key === "Tab") chiudiMenu();
  });
  doc.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && !bAltro.contains(e.target)) chiudiMenu(); });
  var svgPronto = null;
  function svgOpts() { return Object.assign({}, G.look, { size: 1024 }); }
  function caricaCarattere(fn) {
    if (FONTDATA || !S.cornice || !S.scritta) { fn(); return; }
    var src = main.getAttribute("data-font");
    if (!src || !win.fetch || !win.FileReader) { fn(); return; }
    win.fetch(src).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) { fn(); return; }
      var fr = new FileReader();
      fr.onload = function () { FONTDATA = String(fr.result).replace(/^data:[^;,]*/, "data:font/woff2"); if (G.look && G.look.frame) G.look.frame.fontData = FONTDATA; fn(); };
      fr.onerror = function () { fn(); };
      fr.readAsDataURL(b);
    }).catch(function () { fn(); });
  }
  /* l'SVG si prepara quando si apre il menu: si disegna come immagine e si rilegge, poi è pronto */
  function preparaSvg() {
    var my = ver, item = menu.querySelector('[data-fmt="svg"]');
    if (svgPronto && svgPronto.ver === my) return;
    svgPronto = null;
    caricaCarattere(function () {
      if (my !== ver || G.err || !G.qr) return;
      var s = Q.svg(G.qr, svgOpts()), img = new Image();
      img.onload = function () {
        var c = doc.createElement("canvas"); c.width = c.height = 1024;
        var m = Q.measure(G.qr, conMisura(G.look, 1024, 1)); c.height = Math.round(m.deviceHeight);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var v = null; try { v = Q.verify(c, G.text, { scales: [0.5, 1, 0.75], crop: scatola(1024) }); } catch (e) { v = { ok: false }; }
        if (my !== ver) return;
        svgPronto = { ver: my, text: s, ok: !!v.ok };
        item.disabled = !v.ok;
        item.querySelector("span").textContent = v.ok ? "a qualsiasi misura, per chi stampa" : "questo codice in SVG non si legge: usa il PNG";
      };
      img.onerror = function () { if (my === ver) svgPronto = { ver: my, text: s, ok: true }; };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    });
  }
  menu.addEventListener("click", function (e) {
    var it = e.target.closest ? e.target.closest(".st-menu__v") : null; if (!it || it.disabled) return;
    var fmt = it.getAttribute("data-fmt");
    if (fmt === "png2048") { var b = pngOra(2048); if (!b) return; scarica(b, G.nome + "-2048.png"); }
    else {
      var s = svgPronto && svgPronto.ver === ver ? svgPronto.text : null;
      if (!s) { if (!pngOra(1024)) return; s = Q.svg(G.qr, svgOpts()); }
      scarica(new Blob([s], { type: "image/svg+xml" }), G.nome + ".svg");
    }
    chiudiMenu(true); fatto(bSalva, "Salvato");
  });
  /* copiare l'immagine: dove il browser lo permette (Safari vuole la promessa dentro il tocco) */
  var puoCopiare = !!(navigator.clipboard && navigator.clipboard.write && win.ClipboardItem);
  bCopia.hidden = !puoCopiare;
  bCopia.addEventListener("click", function () {
    if (bCopia.disabled) return;
    var blob = null;
    var p = new Promise(function (res, rej) { blob = pngOra(1024); if (blob) res(blob); else rej(new Error("non si legge")); });
    try {
      navigator.clipboard.write([new win.ClipboardItem({ "image/png": p })]).then(function () { fatto(bCopia, "Copiato"); }, function () {
        if (blob) nota("Qui non si può copiare un'immagine: usa Salva.");
      });
    } catch (e) { nota("Qui non si può copiare un'immagine: usa Salva."); }
  });
  /* condividere: il foglio del telefono con il PNG, solo dove i file si possono condividere */
  var puoCondividere = false;
  try { puoCondividere = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(["x"], { type: "image/png" })], "qr.png", { type: "image/png" })] })); } catch (e) { puoCondividere = false; }
  bCondividi.hidden = !puoCondividere;
  bCondividi.addEventListener("click", function () {
    if (bCondividi.disabled) return;
    var b = pngOra(1024); if (!b) return;
    var f = null; try { f = new File([b], G.nome + ".png", { type: "image/png" }); } catch (e) { f = null; }
    if (!f) { scarica(b, G.nome + ".png"); fatto(bSalva, "Salvato"); return; }
    navigator.share({ files: [f] }).then(function () { fatto(bCondividi, "Condiviso"); }, function (e) { if (!e || e.name !== "AbortError") nota("Non si è aperta la condivisione: usa Salva."); });
  });

  /* ================================================================== all'inizio */
  gTipi.metti("link");
  gForme.metti(S.forma); gOcchi.metti(S.occhi);
  mettiColori();
  if (S.cornice) { $("scrittaOpz").hidden = false; }
  fScritta.value = S.scritta;
  scalaTesto();
  gCornice.metti(S.cornice ? "si" : "no");
  /* il browser può aver rimesso i testi di prima */
  qsa(".st-in").forEach(function (el) { var x = doc.querySelector('[data-x="' + el.id + '"]'); if (x) x.hidden = !el.value; if (el.tagName === "TEXTAREA" && el.value) cresci(el); });
  misura();
  posa();
  barra();
  aggiorna("tutto");
  if (fermo()) main.classList.add("is-fermo");
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { misura(); pillole(); posa(); if (S.cornice && G.qr && !G.loop) { misuraTela(G.look); disegna(now()); } });
  var cambiaTema = function () { tessFatte = {}; tessere(true); };
  if (mqDark.addEventListener) mqDark.addEventListener("change", cambiaTema); else if (mqDark.addListener) mqDark.addListener(cambiaTema);
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", function () { main.classList.toggle("is-fermo", fermo()); });
  T.stato = function () { return { livello: livello, testo: statoT.textContent, letto: G.letto, text: G.text, n: G.qr ? G.qr.n : 0, ecc: G.qr ? G.qr.ecc : "", ver: ver, anim: !!G.loop, esempio: G.esempio, salva: !bSalva.disabled }; };
  T.G = G; T.S = S; T.IMG = IMG; T.L = L;
})();
