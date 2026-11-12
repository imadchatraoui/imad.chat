/* imad.chat — la casa nuova (anteprima): i tre riquadri vivi nuovi. Viene dopo app.js (window.IMAD), vivo.js, Dot, casa.js e il motore QR.
   Plain script, ES2017 al massimo (niente ?., ??, campi di classe, moduli), nessuna libreria oltre al motore QR.

     Tools (#qrMini)       il mini QR: un campo e il codice che si ridisegna a onda (window.QRCore, ../tools/qr/qr-core.js);
                           il nuovo codice prende il posto del vecchio dove passa l'onda, anche se il testo cambia a metà.
                           Si controlla (QRCore.verify, jsQR caricato solo al primo bisogno) una volta, quando si smette di scrivere.
                           «Salva»: un PNG di 1024 px, moduli scuri su bianco in tutti e due i temi; sul telefono il foglio di
                           condivisione se accetta un file, altrimenti si scarica. Niente viene mandato da nessuna parte.
     Heatmap (#heat)       53 settimane × 7 giorni (lunedì in alto) su una tela a pixel interi; i dati da /api/github/contributi
                           (IMAD.api, dopo l'intro). La prima volta che il riquadro si vede per metà i quadrati si accendono a onda;
                           un dito o il mouse che passa sopra dice il giorno e il conto; le frecce fanno lo stesso da tastiera.
                           Senza dati: quadrati vuoti e «Si aggiorna tra poco», nessun numero. Con n: null, i livelli e niente conti.
     Sto imparando (#impara)  Three.js Journey, gli ultimi commit di learning.commits (da /api/github/progetti) con «3 giorni fa»,
                           un icosaedro a fil di ferro che gira piano su una tela 2D (i bordi lontani più tenui).

   Niente gira fuori dallo schermo, a scheda nascosta, durante l'intro o sotto una pagina aperta (IMAD.loop, o un giro breve
   che finisce da sé). Con «meno movimento» o ?shot=1 (IMAD.still) si disegna subito lo stato finale. */
(function () {
  "use strict";
  var I = window.IMAD, doc = document, root = doc.documentElement;
  if (!I || !doc.querySelector) return;
  function $(s, r) { return (r || doc).querySelector(s); }
  var clamp = I.clamp, DAY = 86400000;
  var MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  var GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];          /* lunedì = 0 */
  var INIZIALI = "GFMAMGLASOND";
  var coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)") : { matches: false };
  function fmt(n) { try { return Number(n).toLocaleString("it-IT"); } catch (e) { return String(n); } }
  function eOut(t) { t = 1 - t; return 1 - t * t * t; }
  function eBack(t) { var c1 = 1.4, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function dprOf(cap) { return Math.min(window.devicePixelRatio || 1, cap || 3); }
  function onResize(el, fn) {
    var raf = 0, go = function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; fn(); }); };
    if ("ResizeObserver" in window) new ResizeObserver(go).observe(el); else window.addEventListener("resize", go);
  }
  /* un indirizzo di GitHub e basta: quello che arriva dalle rotte non apre mai altro */
  function ghUrl(u, d) { return (typeof u === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.\-]+(\/[A-Za-z0-9_.\-]+)?\/?$/.test(u)) ? u : d; }
  function parseDay(s) { var m = typeof s === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null; return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function wdOf(ms) { return (new Date(ms).getUTCDay() + 6) % 7; }
  function oggiMs() {
    try {
      var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(I.now()).split("-");
      return Date.UTC(+p[0], +p[1] - 1, +p[2]);
    } catch (e) { var d = I.now(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  }
  /* «3 giorni fa», «ieri», «2 settimane fa» */
  function fa(iso) {
    var t = new Date(iso).getTime(); if (isNaN(t)) return "";
    var s = (I.now().getTime() - t) / 1000;
    if (s < 60) return "adesso";
    var m = Math.floor(s / 60); if (m < 60) return m === 1 ? "1 minuto fa" : m + " minuti fa";
    var h = Math.floor(m / 60); if (h < 24) return h === 1 ? "1 ora fa" : h + " ore fa";
    var d = Math.floor(h / 24); if (d === 1) return "ieri";
    if (d < 7) return d + " giorni fa";
    if (d < 30) { var w = Math.floor(d / 7); return w === 1 ? "1 settimana fa" : w + " settimane fa"; }
    if (d < 365) { var mo = Math.max(1, Math.floor(d / 30.44)); return mo === 1 ? "1 mese fa" : mo + " mesi fa"; }
    var y = Math.floor(d / 365.25); return y === 1 ? "1 anno fa" : y + " anni fa";
  }
  function rgba(s) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(s || "");
    if (m) { var a = m[4] === undefined ? 1 : (m[4].indexOf("%") > 0 ? parseFloat(m[4]) / 100 : +m[4]); return [+m[1], +m[2], +m[3], a]; }
    var h = /^#([0-9a-f]{6})$/i.exec((s || "").replace(/\s/g, ""));
    if (h) { var n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
    return [227, 231, 244, 0.08];
  }
  function css(c) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + c[3].toFixed(3) + ")"; }
  function mixc(a, b, p) { return [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p), lerp(a[3], b[3], p)]; }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  /* ================================================================== Tools: il mini QR */
  function MiniQR(box) {
    var Q = window.QRCore;
    var input = $("#qrIn", box), xBtn = $("#qrX", box), cv = $("#qrCv", box), card = $(".qr__carta", box), riga = $(".qr__riga", box);
    var tipo = $("#qrTipo", box), val = $("#qrVal", box), nota = $("#qrNota", box), salva = $("#qrSalva", box), salvaT = $("#qrSalvaT", box);
    if (!input || !cv || !cv.getContext) return;
    if (!Q) { input.disabled = true; tipo.textContent = "Il codice QR non è arrivato"; val.textContent = "Ricarica la pagina per riprovare."; return; }

    var PROVA = "https://imad.chat", INK = "#16171d", FAINT = "#dcdde4";
    var LOOK = { shape: "uniti", eye: "tondo" };
    var SALVA = { size: 1024, dpr: 1, quiet: 4, shape: LOOK.shape, eye: LOOK.eye, fg: INK, bg: "#ffffff", style: false };
    var ctx = cv.getContext("2d"), lay = doc.createElement("canvas"), old = doc.createElement("canvas"), octx = old.getContext("2d");
    var size = 0, dpr = 1, hasOld = false, R = 1;
    var cur = null, anim = null, raf = 0, settle = 0, seen = false, troppo = false;

    /* cosa diventa il testo: un link (QRCore.payload.url aggiunge https:// se serve) o un testo semplice */
    function leggi(raw) {
      var t = Q.payload.text(raw).replace(/^\s+|\s+$/g, "");
      if (!t) return { kind: "vuoto", text: PROVA };
      var u = Q.payload.url(t);
      var link = !/\s/.test(t) && (u !== t || /^(https?|mailto|tel|sms|geo|ftp):/i.test(t));
      return link ? { kind: "link", text: u } : { kind: "testo", text: t };
    }
    function etichetta(u) {
      if (/^mailto:/i.test(u)) return "E-mail";
      if (/^tel:/i.test(u)) return "Telefono";
      if (/^sms:/i.test(u)) return "Messaggio";
      return "Link";
    }
    function misura() {
      var h = riga.clientHeight, w = box.clientWidth;
      var s = Math.floor(Math.min(h, w * 0.46));
      if (s < 48) return false;
      var d = dprOf(3);
      card.style.width = s + "px"; card.style.height = s + "px";
      if (s === size && d === dpr) return false;
      size = s; dpr = d; hasOld = false;
      return true;
    }

    /* un fotogramma: il vecchio codice resta dove l'onda non è ancora passata, il nuovo arriva modulo per modulo */
    function quadro(p) {
      if (!cur || !size) return;
      var info = Q.render(lay, cur.qr, { size: size, dpr: dpr, quiet: 3, shape: LOOK.shape, eye: LOOK.eye, fg: cur.fg, bg: "transparent", progress: p, order: "onda", style: false });
      R = Math.max(1, info.side / 2 * Math.SQRT2);
      if (cv.width !== lay.width || cv.height !== lay.height) { cv.width = lay.width; cv.height = lay.height; hasOld = false; }
      cv.style.width = size + "px"; cv.style.height = size + "px";
      var W = cv.width, c = W / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, W);
      if (hasOld && p < 1) {
        ctx.drawImage(old, 0, 0);
        var r1 = Math.max(1, (p / 0.7) * R), r0 = Math.max(0, ((p - 0.24) / 0.7) * R);
        ctx.globalCompositeOperation = "destination-out";
        var g = ctx.createRadialGradient(c, c, Math.min(r0, r1 - 0.5), c, c, r1);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.drawImage(lay, 0, 0);
    }
    function istantanea() {
      if (!cv.width) { hasOld = false; return; }
      old.width = cv.width; old.height = cv.height;
      octx.clearRect(0, 0, old.width, old.height); octx.drawImage(cv, 0, 0);
      hasOld = true;
    }
    function passo(now) {
      raf = 0; if (!anim) return;
      var t = clamp((now - anim.t0) / anim.dur, 0, 1);
      quadro(1 - Math.pow(1 - t, 1.35));                 /* l'onda rallenta appena verso gli angoli */
      if (t < 1) raf = requestAnimationFrame(passo); else { anim = null; hasOld = false; dopo(); }
    }
    function vai(st, onda) {
      if (onda && seen && !I.still()) { istantanea(); cur = st; anim = { t0: performance.now(), dur: 560 }; if (!raf) raf = requestAnimationFrame(passo); return; }
      cur = st; anim = null; hasOld = false;
      if (seen) quadro(1);
      dopo();
    }

    /* quando si smette di scrivere: si rilegge il codice disegnato (jsQR arriva solo adesso); se non si legge, lo si dice piano */
    var jsqr = 0, attese = [];
    function conJsQR(fn) {
      if (typeof window.jsQR === "function") { fn(true); return; }
      if (jsqr === 2) { fn(false); return; }
      if (fn) attese.push(fn);
      if (jsqr === 1) return;
      var src = box.getAttribute("data-jsqr"); if (!src) { jsqr = 2; fn && fn(false); return; }
      jsqr = 1;
      var s = doc.createElement("script"); s.src = src; s.async = true;
      var fine = function () { jsqr = typeof window.jsQR === "function" ? 3 : 2; var a = attese; attese = []; a.forEach(function (f) { f(jsqr === 3); }); };
      s.onload = fine; s.onerror = fine;
      doc.head.appendChild(s);
    }
    function esporta(qr) { var c = doc.createElement("canvas"); Q.render(c, qr, SALVA); return c; }
    function dopo() {
      clearTimeout(settle);
      if (!cur || cur.kind === "vuoto" || anim) return;
      var st = cur;
      settle = setTimeout(function () {
        if (st !== cur || anim) return;
        conJsQR(function (pronto) {
          if (!pronto || st !== cur || anim) return;
          var v = null;
          try { v = Q.verify(cv, st.text); if (!v.ok) v = Q.verify(esporta(st.qr), st.text); } catch (e) { v = null; }
          if (v && !v.ok && st === cur && !nota.textContent) nota.textContent = "Questo codice potrebbe non leggersi.";
        });
      }, 450);
    }

    function testi(st) {
      nota.textContent = "";
      if (st.kind === "vuoto") {
        tipo.textContent = "prova: incolla un link"; val.textContent = "Si crea qui: non viene inviato niente."; val.classList.remove("is-link");
        salva.disabled = true; cv.setAttribute("aria-label", "Codice QR di prova: " + PROVA); return;
      }
      if (st.kind === "link") { tipo.textContent = etichetta(st.text); val.textContent = st.text; val.classList.add("is-link"); }
      else {
        var k = Array.from ? Array.from(st.text).length : st.text.length;
        tipo.textContent = "Testo"; val.textContent = k === 1 ? "1 carattere" : fmt(k) + " caratteri"; val.classList.remove("is-link");
      }
      var chk = null; try { chk = Q.scannable(SALVA, st.qr); } catch (e) { chk = null; }
      salva.disabled = !!(chk && chk.level === "errore");
      if (chk && chk.level !== "ok" && chk.why) nota.textContent = chk.why;
      cv.setAttribute("aria-label", "Codice QR di: " + st.text);
    }
    function aggiorna() {
      var raw = input.value;
      xBtn.hidden = !raw;
      var st = leggi(raw);
      try { st.qr = Q.encode(st.text, { ecc: "M" }); }
      catch (e) {
        /* troppo lungo (o un carattere che il motore rifiuta): una riga, niente codice nuovo, niente salvataggio */
        troppo = true; box.classList.add("is-troppo");
        tipo.textContent = st.kind === "link" ? "Link" : "Testo"; val.textContent = ""; val.classList.remove("is-link");
        nota.textContent = (e && e.message) || "Questo testo non entra in un codice QR."; salva.disabled = true;
        clearTimeout(settle); return;
      }
      st.fg = st.kind === "vuoto" ? FAINT : INK;
      var uguale = cur && cur.text === st.text && cur.kind === st.kind, era = troppo;
      troppo = false; box.classList.remove("is-troppo");
      if (uguale && !era) return;                       /* uno spazio in fondo non cambia il codice */
      testi(st);
      if (uguale) { dopo(); return; }
      vai(st, true);
    }

    /* salvare: il PNG si fa subito, dentro il tocco (Safari vuole il foglio di condivisione nello stesso gesto) */
    function blobDa(url) {
      var b = atob(url.split(",")[1]), n = b.length, u = new Uint8Array(n);
      for (var i = 0; i < n; i++) u[i] = b.charCodeAt(i);
      return new Blob([u], { type: "image/png" });
    }
    function nome(st) {
      if (st.kind === "link") { var h = st.text.replace(/^[a-z]+:(\/\/)?/i, "").split(/[\/?#]/)[0].replace(/^www\./i, "").replace(/[^a-z0-9.\-]+/gi, "-").replace(/\./g, "-").slice(0, 40); return "qr-" + (h || "link") + ".png"; }
      return "qr-testo.png";
    }
    var torna = 0;
    function detto(parola) {
      clearTimeout(torna);
      salva.classList.add("is-cambia");
      setTimeout(function () { salvaT.textContent = parola; salva.classList.remove("is-cambia"); }, 170);
      torna = setTimeout(function () { salva.classList.add("is-cambia"); setTimeout(function () { salvaT.textContent = "Salva"; salva.classList.remove("is-cambia"); }, 170); }, 1900);
    }
    function scarica(blob, name) {
      var u = URL.createObjectURL(blob), a = doc.createElement("a");
      a.href = u; a.download = name; a.rel = "noopener"; a.style.display = "none";
      doc.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); }, 4000);
      detto("Salvato");
    }
    salva.addEventListener("click", function () {
      if (salva.disabled || !cur || cur.kind === "vuoto" || troppo) return;
      var blob = null, name = nome(cur);
      try { blob = blobDa(esporta(cur.qr).toDataURL("image/png")); } catch (e) { nota.textContent = "Non sono riuscito a preparare l'immagine."; return; }
      var file = null;
      try { file = new File([blob], name, { type: "image/png" }); } catch (e) { file = null; }
      var puo = false;
      if (file && coarse.matches && navigator.share && navigator.canShare) { try { puo = navigator.canShare({ files: [file] }); } catch (e) { puo = false; } }
      if (puo) {
        navigator.share({ files: [file] }).then(function () { detto("Fatto"); }, function (e) { if (!e || e.name !== "AbortError") scarica(blob, name); });
        return;
      }
      scarica(blob, name);
    });

    input.addEventListener("input", aggiorna);
    input.addEventListener("focus", function () { root.classList.add("is-scrivo"); conJsQR(null); });
    input.addEventListener("blur", function () { root.classList.remove("is-scrivo"); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); input.blur(); } });
    xBtn.addEventListener("click", function () { input.value = ""; aggiorna(); input.focus(); });

    /* all'inizio: il codice di prova, tenue; la prima volta che si vede si disegna da sé */
    var start = leggi("");
    try { start.qr = Q.encode(start.text, { ecc: "M" }); } catch (e) { return; }
    start.fg = FAINT; cur = start; testi(start);
    if (input.value) aggiorna();                       /* il browser può aver rimesso il testo di prima */
    misura();
    onResize(box, function () { if (misura() && seen) { anim = null; hasOld = false; quadro(1); } });
    I.whenFree(function () {
      misura();
      if (I.still()) { seen = true; quadro(1); return; }
      I.onView(card, function () {
        seen = true; hasOld = false;
        if (I.still()) { quadro(1); return; }
        anim = { t0: performance.now(), dur: 720 }; if (!raf) raf = requestAnimationFrame(passo);
      }, 0.6);
    });
  }

  /* ================================================================== Heatmap: l'anno su GitHub */
  function Heat(box) {
    var cv = $("#heatCv", box), riga = $("#heatRiga", box), wrap = $(".hm__g", box), tile = box.closest ? box.closest(".tile") : box.parentNode;
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var cells = [], first = -1, last = -1, months = [], endYear = 0, total = null, counts = false, ok = false;
    var G = { dpr: 1, s: 4, g: 1, p: 5, mh: 14, W: 0, H: 0 };
    var C = [];
    var wave = null, played = false, half = false, raf = 0;
    var hover = -1, lifts = {}, mode = "totale", holdT = 0, touch = null, touchT = 0;

    function colori() { var cs = getComputedStyle(tile); C = [0, 1, 2, 3, 4].map(function (i) { return rgba(cs.getPropertyValue("--hm-" + i).trim()); }); }

    /* i giorni nelle colonne: una colonna per settimana, il lunedì in alto; l'indice col*7+riga segue il calendario */
    function costruisci(list) {
      cells = new Array(53 * 7); first = -1; last = -1; months = [];
      for (var k = 0; k < cells.length; k++) cells[k] = null;
      var end = list[list.length - 1].ms, endMon = end - wdOf(end) * DAY;
      endYear = new Date(end).getUTCFullYear();
      list.forEach(function (x) {
        var w = wdOf(x.ms), col = 52 - Math.round((endMon - (x.ms - w * DAY)) / (7 * DAY));
        if (col < 0 || col > 52) return;
        cells[col * 7 + w] = x;
      });
      for (var i = 0; i < cells.length; i++) if (cells[i]) { if (first < 0) first = i; last = i; }
      var lastCol = -9;
      for (var c = 0; c < 53; c++) for (var r = 0; r < 7; r++) {
        var x = cells[c * 7 + r]; if (!x) continue;
        var dt = new Date(x.ms);
        if (dt.getUTCDate() === 1 && c - lastCol >= 3) { months.push({ c: c, t: INIZIALI.charAt(dt.getUTCMonth()) }); lastCol = c; }
      }
    }
    function vuoti() {
      var end = oggiMs(), list = [];
      for (var t = end - (52 * 7 + wdOf(end)) * DAY; t <= end; t += DAY) list.push({ ms: t, n: null, l: 0 });
      costruisci(list);
    }

    function fit() {
      var avW = wrap.clientWidth, avH = wrap.clientHeight;
      if (avW < 100) return false;
      var d = dprOf(3), g = Math.max(1, Math.round(d)), Wd = Math.floor(avW * d);
      var p = Math.floor((Wd + g) / 53), s = p - g, maxS = Math.round(10 * d);
      if (s > maxS) { s = maxS; p = s + g; }
      var mh = Math.round(15 * d);
      /* se in altezza non ci sta, i quadrati si stringono (mai sotto i 3 px) */
      while (avH > 20 && (mh + 7 * p - g) / d > avH && s > Math.round(3 * d)) { s--; p--; }
      G = { dpr: d, s: s, g: g, p: p, mh: mh, W: 53 * p - g, H: mh + 7 * p - g };
      cv.width = G.W; cv.height = G.H;
      cv.style.width = (G.W / d) + "px"; cv.style.height = (G.H / d) + "px";
      /* la tela cade su pixel interi del dispositivo: niente sfocato */
      cv.style.transform = "";
      var r = cv.getBoundingClientRect(), fx = (r.left + (window.pageXOffset || 0)) * d, fy = (r.top + (window.pageYOffset || 0)) * d;
      var dx = (Math.round(fx) - fx) / d, dy = (Math.round(fy) - fy) / d;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) cv.style.transform = "translate(" + dx.toFixed(3) + "px," + dy.toFixed(3) + "px)";
      return true;
    }

    /* il disegno: k = quanto ogni quadrato è già arrivato al suo livello (l'onda), più quello sotto il dito alzato */
    function prog(c, r, now) {
      if (!ok) return 0;
      if (played && !wave) return 1;
      if (!wave) return 0;
      return clamp((now - wave.t0 - (c / 52) * 400 - r * 8) / 250, 0, 1);
    }
    function draw(now) {
      if (!G.W) return;
      var d = G.dpr, s = G.s, p = G.p, rad = Math.max(1, Math.round(s * 0.24)), top = G.mh;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, G.W, G.H);
      /* le iniziali dei mesi */
      ctx.font = "600 " + Math.round(10 * d) + "px Manrope, -apple-system, sans-serif";
      ctx.textBaseline = "alphabetic"; ctx.fillStyle = "rgba(227,231,244,.46)";
      for (var m = 0; m < months.length; m++) ctx.fillText(months[m].t, months[m].c * p, Math.round(10 * d));
      var e0 = C[0], later = [], ups = [];
      ctx.beginPath(); ctx.fillStyle = css(e0);
      for (var c = 0; c < 53; c++) for (var r = 0; r < 7; r++) {
        var i = c * 7 + r, x = cells[i]; if (!x) continue;
        var k = prog(c, r, now), L = lifts[i] || 0;
        if (L > 0.001) { ups.push([i, k, L]); continue; }
        if (x.l === 0 || k <= 0) { rrect(ctx, c * p, top + r * p, s, s, rad); continue; }
        later.push(i, k);
      }
      ctx.fill();
      for (var j = 0; j < later.length; j += 2) {
        var ii = later[j], kk = later[j + 1], cc = Math.floor(ii / 7), rr = ii % 7, xx = cells[ii];
        var sc = 0.5 + 0.5 * eBack(kk), ss = s * sc, o = (s - ss) / 2;
        ctx.beginPath(); ctx.fillStyle = css(mixc(e0, C[xx.l], eOut(kk))); rrect(ctx, cc * p + o, top + rr * p + o, ss, ss, rad * sc); ctx.fill();
      }
      /* i giorni sotto il dito (quello di adesso e quello che si sta posando): si alzano un poco, con un'ombra d'inchiostro
         che li stacca dai vicini e un filo di luce; il più alto per ultimo */
      ups.sort(function (a, b) { return a[2] - b[2]; });
      for (var u = 0; u < ups.length; u++) {
        var ui = ups[u][0], uc = Math.floor(ui / 7), ur = ui % 7, ux = cells[ui], ul = eOut(ups[u][2]);
        var base = ux.l > 0 ? mixc(e0, C[ux.l], eOut(ups[u][1])) : mixc([35, 40, 62, 1], [92, 99, 126, 1], ul);
        var big = s * (1 + 0.62 * ul), oo = (s - big) / 2, bx = uc * p + oo, by = top + ur * p + oo - 1.2 * d * ul;
        ctx.save();
        ctx.shadowColor = "rgba(4,6,18," + (0.75 * ul).toFixed(3) + ")"; ctx.shadowBlur = 5 * d * ul; ctx.shadowOffsetY = 1.5 * d * ul;
        ctx.beginPath(); ctx.fillStyle = css([base[0], base[1], base[2], 1]); rrect(ctx, bx, by, big, big, rad * (1 + 0.5 * ul)); ctx.fill();
        ctx.restore();
        var lw = Math.max(1, Math.round(d));
        ctx.beginPath(); ctx.lineWidth = lw; ctx.strokeStyle = "rgba(255,255,255," + (0.85 * ul).toFixed(3) + ")";
        rrect(ctx, bx + lw / 2, by + lw / 2, big - lw, big - lw, rad * (1 + 0.5 * ul)); ctx.stroke();
      }
    }
    /* un giro di fotogrammi solo finché qualcosa si muove (l'onda, un quadrato che si alza o si posa) */
    /* ogni quadrato alzato va da dove è verso 1 (sotto il dito) o verso 0 (lasciato) in 140 ms */
    var liftA = {};
    function tick(now) {
      raf = 0;
      var busy = false;
      if (wave && now - wave.t0 > 400 + 48 + 250) { wave = null; played = true; }
      if (wave) busy = true;
      for (var key in liftA) {
        var a = liftA[key], k = clamp((now - a.t0) / 140, 0, 1), v = lerp(a.from, a.to, k);
        if (k >= 1 && a.to === 0) { delete liftA[key]; delete lifts[key]; continue; }
        lifts[key] = Math.max(0.002, v); if (k < 1) busy = true;
      }
      draw(now);
      if (busy) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function alza(i) {
      if (i === hover) return;
      var now = performance.now();
      if (I.still()) { lifts = {}; liftA = {}; hover = i; if (i >= 0) lifts[i] = 1; draw(now); return; }
      if (hover >= 0) liftA[hover] = { from: lifts[hover] || 0, to: 0, t0: now };
      hover = i;
      if (i >= 0) { liftA[i] = { from: lifts[i] || 0, to: 1, t0: now }; lifts[i] = Math.max(0.002, lifts[i] || 0); }
      kick();
    }
    function onda() {
      if (played || wave || !ok || !half || !G.W) return;
      if (I.still()) { played = true; draw(performance.now()); return; }
      wave = { t0: performance.now() }; kick();
    }

    /* la riga sopra: il totale dell'anno, oppure il giorno sotto il dito */
    function testoTotale() {
      if (!ok) return "Si aggiorna tra poco";
      if (total === null) return "L'ultimo anno, giorno per giorno";
      if (total === 0) return "Nessun contributo nell'ultimo anno";
      return "<b class=\"num\">" + fmt(total) + "</b> " + (total === 1 ? "contributo" : "contributi") + " nell'ultimo anno";
    }
    function testoGiorno(x) {
      var dt = new Date(x.ms), y = dt.getUTCFullYear();
      var s = "<span class=\"hm__d\">" + GIORNI[wdOf(x.ms)] + " " + dt.getUTCDate() + " " + MESI[dt.getUTCMonth()] + (y !== endYear ? " " + y : "") + "</span>";
      if (typeof x.n === "number") s += "<span class=\"hm__s\" aria-hidden=\"true\">·</span>" + (x.n === 0 ? "nessun contributo" : x.n === 1 ? "1 contributo" : fmt(x.n) + " contributi");
      return s;
    }
    var span = $(".hm__a", riga), fadeT = 0;
    function scrivi(html, morbido) {
      clearTimeout(fadeT);
      if (!morbido || I.still()) { span.classList.remove("is-via"); span.innerHTML = html; return; }
      span.classList.add("is-via");
      fadeT = setTimeout(function () { span.innerHTML = html; span.classList.remove("is-via"); }, 150);
    }
    function giorno(i) {
      if (!ok || i < 0 || !cells[i]) return;
      var prima = mode !== "giorno"; mode = "giorno";
      alza(i); scrivi(testoGiorno(cells[i]), prima);
    }
    function totale() { clearTimeout(holdT); if (mode === "totale") return; mode = "totale"; alza(-1); scrivi(testoTotale(), true); }

    function sotto(cx, cy) {
      var r = cv.getBoundingClientRect(), d = G.dpr;
      var x = (cx - r.left) * d, y = (cy - r.top) * d - G.mh;
      var c = clamp(Math.floor((x + G.g / 2) / G.p), 0, 52), w = clamp(Math.floor((y + G.g / 2) / G.p), 0, 6);
      var i = c * 7 + w;
      if (i > last) i = last; if (i < first) i = first;
      while (i > first && !cells[i]) i--;
      return cells[i] ? i : -1;
    }
    var dalDito = 0;
    cv.addEventListener("mousedown", function (e) { e.preventDefault(); });      /* il mouse scorre i giorni, non prende il fuoco */
    cv.addEventListener("pointerdown", function (e) {
      dalDito = performance.now();
      if (!ok) return;
      clearTimeout(holdT);
      if (e.pointerType === "mouse") { giorno(sotto(e.clientX, e.clientY)); return; }
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, on: false };
      clearTimeout(touchT);
      /* un dito che scorre la pagina non deve accendere giorni: si aspetta un attimo, o un movimento di lato */
      touchT = setTimeout(function () { if (touch && !touch.on) { touch.on = true; giorno(sotto(touch.lx, touch.ly)); } }, 110);
    });
    cv.addEventListener("pointermove", function (e) {
      if (!ok) return;
      if (e.pointerType === "mouse") { giorno(sotto(e.clientX, e.clientY)); return; }
      if (!touch || e.pointerId !== touch.id) return;
      touch.lx = e.clientX; touch.ly = e.clientY;
      if (!touch.on && Math.abs(e.clientX - touch.x) > 5 && Math.abs(e.clientX - touch.x) > Math.abs(e.clientY - touch.y)) touch.on = true;
      if (touch.on) giorno(sotto(e.clientX, e.clientY));
    });
    function lascia(e, subito) {
      if (e.pointerType === "mouse") { if (doc.activeElement !== cv) totale(); return; }
      if (!touch || e.pointerId !== touch.id) return;
      clearTimeout(touchT);
      var era = touch.on; touch = null;
      if (subito) { totale(); return; }
      if (!era) giorno(sotto(e.clientX, e.clientY));      /* un tocco solo: dice quel giorno */
      clearTimeout(holdT); holdT = setTimeout(totale, 1800);   /* lascia il tempo di leggerlo */
    }
    cv.addEventListener("pointerup", function (e) { lascia(e, false); });
    cv.addEventListener("pointercancel", function (e) { lascia(e, true); });
    cv.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") lascia(e, true); });
    cv.addEventListener("contextmenu", function (e) { if (touch) e.preventDefault(); });
    /* da tastiera: sinistra e destra una settimana, su e giù un giorno, Inizio e Fine il primo e l'ultimo */
    cv.addEventListener("keydown", function (e) {
      if (!ok) return;
      var i = hover >= 0 ? hover : last, k = e.key, n = i;
      if (k === "ArrowLeft") n = i - 7; else if (k === "ArrowRight") n = i + 7;
      else if (k === "ArrowUp") n = i - 1; else if (k === "ArrowDown") n = i + 1;
      else if (k === "Home") n = first; else if (k === "End") n = last;
      else if (k === "Escape") { totale(); return; }
      else return;
      e.preventDefault();
      n = clamp(n, first, last); while (n > first && !cells[n]) n--;
      giorno(n);
    });
    cv.addEventListener("focus", function () { if (ok && hover < 0 && performance.now() - dalDito > 600) giorno(last); });
    cv.addEventListener("blur", function () { if (!touch) totale(); });

    function dati(j) {
      var list = [];
      if (j && j.ok && j.days && j.days.length) {
        for (var i = 0; i < j.days.length; i++) {
          var x = j.days[i], ms = parseDay(x && x.d);
          if (isNaN(ms)) continue;
          var n = typeof x.n === "number" && isFinite(x.n) && x.n >= 0 ? Math.round(x.n) : null;
          var l = typeof x.l === "number" ? clamp(Math.round(x.l), 0, 4) : null;
          list.push({ ms: ms, n: n, l: l });
        }
        list.sort(function (a, b) { return a.ms - b.ms; });
      }
      if (!list.length) return;
      counts = list.some(function (x) { return x.n !== null; });
      /* il livello lo dà la rotta; se manca, si ricava dal conto (quarti del giorno più pieno) */
      var max = 0; list.forEach(function (x) { if (x.n > max) max = x.n; });
      list.forEach(function (x) { if (x.l === null) x.l = x.n ? clamp(Math.ceil(4 * x.n / Math.max(1, max)), 1, 4) : 0; });
      var sum = 0; list.forEach(function (x) { sum += x.n || 0; });
      total = !counts ? null : (typeof j.total === "number" && isFinite(j.total) && j.total >= 0 ? Math.round(j.total) : sum);
      ok = true;
      costruisci(list);
      box.classList.remove("is-vuoto");
      mode = "giorno"; totale();
      draw(performance.now());
      onda();
    }

    colori(); vuoti(); box.classList.add("is-vuoto");
    span.innerHTML = testoTotale();
    if (fit()) draw(0);
    onResize(wrap, function () { if (fit()) draw(performance.now()); });
    if (window.matchMedia) { var mq = window.matchMedia("(prefers-color-scheme: dark)"); var re = function () { colori(); draw(performance.now()); }; if (mq.addEventListener) mq.addEventListener("change", re); else if (mq.addListener) mq.addListener(re); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { half = es[es.length - 1].intersectionRatio >= 0.5; if (half && !root.classList.contains("ni-on")) onda(); }, { threshold: [0, 0.5, 1] }).observe(tile);
    } else half = true;
    I.whenFree(function () {
      colori(); if (fit()) draw(performance.now());
      if (doc.fonts && doc.fonts.load) { try { doc.fonts.load("600 10px Manrope").then(function () { draw(performance.now()); }, function () { }); } catch (e) { } }
      I.api("contributi").then(dati, function () { });
      onda();
    });
  }

  /* ================================================================== Sto imparando: Three.js Journey */
  function Impara(tile) {
    var cv = $("#imparaCv", tile), log = $("#imparaLog", tile), hit = $(".tile__hit", tile), head = $(".tile__head", tile), titolo = $(".ip__t", tile);
    if (!cv || !cv.getContext || !log) return;
    var ctx = cv.getContext("2d"), G = null, dueRighe = false;

    /* un icosaedro diviso una volta (42 vertici, 120 spigoli), come IcosahedronGeometry(1, 1) di three.js */
    var V = [], E = [];
    (function () {
      var t = (1 + Math.sqrt(5)) / 2, base = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
      var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      function norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
      base.forEach(function (v) { V.push(norm(v)); });
      var mid = {};
      function m(a, b) { var k = a < b ? a + "_" + b : b + "_" + a; if (mid[k] === undefined) { V.push(norm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2])); mid[k] = V.length - 1; } return mid[k]; }
      var seen = {};
      function e(a, b) { var k = a < b ? a + "_" + b : b + "_" + a; if (!seen[k]) { seen[k] = 1; E.push([a, b]); } }
      F.forEach(function (f) {
        var a = f[0], b = f[1], c = f[2], ab = m(a, b), bc = m(b, c), ca = m(c, a);
        [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]].forEach(function (q) { e(q[0], q[1]); e(q[1], q[2]); e(q[2], q[0]); });
      });
    })();
    var P = V.map(function () { return [0, 0, 0]; }), order = E.map(function (x, i) { return i; }), Z = new Float32Array(E.length);

    function fit() {
      var f = I.fit(cv, 3); if (!f) { G = null; return; }
      var tr = tile.getBoundingClientRect(), hr = head.getBoundingClientRect(), xr = titolo.getBoundingClientRect();
      var topY = hr.bottom - tr.top, botY = xr.top - tr.top;
      /* il solido sta tra l'etichetta e il titolo, un po' più grande dello spazio: la parte bassa sfuma dietro il testo */
      var Rr = Math.max(18, Math.min(f.W * 0.36, (botY - topY) * 0.62 + 12));
      G = { W: f.W, H: f.H, dpr: f.dpr, cx: f.W * 0.5, cy: topY + (botY - topY) * 0.5 + Rr * 0.14, R: Rr, fade0: botY - 6, fade1: botY + 22 };
      dueRighe = tile.clientHeight >= 230;
    }
    function draw(t) {
      if (!G) return;
      var d = G.dpr, a = t * (Math.PI * 2 / 34000) + 0.6, tilt = 0.42 + 0.1 * Math.sin(t / 9000);
      var ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt), cam = 3.6;
      for (var i = 0; i < V.length; i++) {
        var v = V[i], x = v[0] * ca + v[2] * sa, z = -v[0] * sa + v[2] * ca, y = v[1];
        var y2 = y * ct - z * st, z2 = y * st + z * ct, k = cam / (cam - z2) * (cam - 1) / cam;
        P[i][0] = G.cx + x * G.R * k; P[i][1] = G.cy - y2 * G.R * k; P[i][2] = z2;
      }
      for (var j = 0; j < E.length; j++) Z[j] = (P[E[j][0]][2] + P[E[j][1]][2]) / 2;
      order.sort(function (p, q) { return Z[p] - Z[q]; });
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, G.W, G.H);
      ctx.lineCap = "round";
      for (var o = 0; o < order.length; o++) {
        var ei = order[o], e = E[ei], zz = (Z[ei] + 1) / 2, al = 0.07 + 0.6 * Math.pow(zz, 1.6);
        ctx.beginPath(); ctx.strokeStyle = "rgba(227,231,244," + al.toFixed(3) + ")"; ctx.lineWidth = 0.7 + 0.55 * zz;
        ctx.moveTo(P[e[0]][0], P[e[0]][1]); ctx.lineTo(P[e[1]][0], P[e[1]][1]); ctx.stroke();
      }
      /* i vertici davanti: punti piccoli, la luce del lato vicino */
      ctx.fillStyle = "rgba(240,242,252,.9)";
      for (var q = 0; q < P.length; q++) {
        if (P[q][2] < 0.35) continue;
        var zr = (P[q][2] - 0.35) / 0.65;
        ctx.globalAlpha = 0.25 + 0.6 * zr; ctx.beginPath(); ctx.arc(P[q][0], P[q][1], 0.8 + 0.5 * zr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* sotto il titolo il disegno si spegne: il testo resta pulito */
      ctx.globalCompositeOperation = "destination-out";
      var g = ctx.createLinearGradient(0, G.fade0, 0, G.fade1);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = g; ctx.fillRect(0, G.fade0, G.W, G.H - G.fade0);
      ctx.globalCompositeOperation = "source-over";
    }

    function riga(msg, quando, vuoto) {
      var li = doc.createElement("li"), a = doc.createElement("span"), b = doc.createElement("span");
      a.className = "ip__msg" + (vuoto ? " ip__msg--vuoto" : ""); a.textContent = msg;
      b.className = "ip__ago"; b.textContent = quando || " ";
      li.appendChild(a); li.appendChild(b); return li;
    }
    function dati(j) {
      var L = j && j.ok ? j.learning : null;
      if (!L || typeof L !== "object") return;
      if (hit) hit.href = ghUrl(L.url, hit.href);
      var cs = (L.commits && L.commits.length ? L.commits : []).filter(function (c) { return c && typeof c.message === "string" && c.message.replace(/\s/g, ""); });
      var righe = [];
      cs.slice(0, dueRighe ? 2 : 1).forEach(function (c) { righe.push(riga(c.message.split(/\r?\n/)[0].replace(/^\s+|\s+$/g, "").slice(0, 140), fa(c.date))); });
      if (!righe.length && L.pushedAt && fa(L.pushedAt)) righe.push(riga("Ultimo aggiornamento", fa(L.pushedAt)));
      if (!righe.length) return;
      log.innerHTML = ""; righe.forEach(function (li) { log.appendChild(li); });
      if (!I.still()) { log.classList.remove("is-nuovo"); void log.offsetWidth; log.classList.add("is-nuovo"); }
      var aria = "Sto imparando: Three.js Journey. Ultimo: " + righe[0].firstChild.textContent + ", " + righe[0].lastChild.textContent + ". Apri il repository su GitHub, in una nuova scheda";
      if (hit) hit.setAttribute("aria-label", aria);
    }

    fit();
    var t0 = performance.now();
    function still() { draw(0); }
    onResize(tile, function () { fit(); still(); });
    still();
    var giro = I.loop(cv, function (t) { draw(t - t0); });
    I.whenFree(function () { fit(); still(); I.api("progetti").then(dati, function () { }); });
    return giro;
  }

  var q = $("#qrMini"), h = $("#heat"), ip = $('[data-tile="imparando"]');
  try { if (q) MiniQR(q); } catch (e) { if (window.console) console.error(e); }
  try { if (h) Heat(h); } catch (e) { if (window.console) console.error(e); }
  try { if (ip) Impara(ip); } catch (e) { if (window.console) console.error(e); }
})();
