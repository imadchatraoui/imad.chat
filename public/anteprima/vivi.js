/* imad.chat — la casa nuova (anteprima): i tre riquadri vivi nuovi. Viene dopo app.js (window.IMAD), vivo.js, Dot, casa.js e il motore QR.
   Plain script, ES2017 al massimo (niente ?., ??, campi di classe, moduli), nessuna libreria oltre al motore QR.

     Tools (#qrMini)       il mini QR: un campo e il codice che si ridisegna a onda (window.QRCore, ../tools/qr/qr-core.js);
                           il nuovo codice prende il posto del vecchio dove passa l'onda, anche se il testo cambia a metà.
                           Si controlla (QRCore.verify, jsQR caricato solo al primo bisogno) una volta, quando si smette di scrivere.
                           «Salva»: un PNG di 1024 px, moduli scuri su bianco in tutti e due i temi; sul telefono il foglio di
                           condivisione se accetta un file, altrimenti si scarica. Niente viene mandato da nessuna parte.
     Heatmap (#heat)       53 settimane × 7 giorni (lunedì in alto) su una tela a pixel interi; i dati da /api/github/contributi
                           (IMAD.api, dopo l'intro). La prima volta che i quadrati si vedono quasi tutti, sopra il dock, si accendono a onda;
                           un dito o il mouse che passa sopra dice il giorno e il conto; le frecce fanno lo stesso da tastiera.
                           Senza dati: quadrati vuoti e «Si aggiorna tra poco», nessun numero. Con n: null, i livelli e niente conti.
     Sto imparando (#impara)  Three.js Journey, l'ultimo commit di learning.commits (da /api/github/progetti): quando, nella voce
                           della macchina, poi il titolo su due righe al più; un icosaedro a fil di ferro che gira piano su una tela 2D
                           (i bordi lontani più tenui). Il risveglio dopo l'intro: IMAD.vivo.impara.prime() / .wake(ms) (moto.js).
   I colori delle tele vengono dai token del riquadro in vivi.css (--hm-*, --ip-line, --ip-dot) e si rileggono quando cambia il tema.

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
  /* il tema cambia (il telefono, o data-theme scritto dal bottone del tema): fn() rilegge i token e ridisegna */
  function onTema(fn) {
    if (window.matchMedia) { var mq = window.matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn); }
    if ("MutationObserver" in window) new MutationObserver(fn).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }
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
  /* una tela cade su pixel interi del dispositivo, o il browser la ricampiona e si sfoca. La posizione dei riquadri può avere
     mezzi pixel (celle di 80,5 px su un telefono x3) e cambia con i filtri del dock: si riallinea all'avvio, al cambio di misura
     e quando i riquadri hanno finito di viaggiare. */
  var snaps = [];
  function snap(el, d) {
    el.style.transform = "";
    var r = el.getBoundingClientRect(), fx = (r.left + (window.pageXOffset || 0)) * d, fy = (r.top + (window.pageYOffset || 0)) * d;
    var dx = (Math.round(fx) - fx) / d, dy = (Math.round(fy) - fy) / d;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) el.style.transform = "translate(" + dx.toFixed(3) + "px," + dy.toFixed(3) + "px)";
  }
  function snapAll() { snaps.forEach(function (f) { try { f(); } catch (e) { } }); }
  (function () {
    var grid = doc.getElementById("grid"); if (!grid || !("MutationObserver" in window)) return;
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); if (!grid.classList.contains("is-moving")) t = setTimeout(snapAll, 60); }).observe(grid, { attributes: true, attributeFilter: ["class", "data-filtro"] });
  })();

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
    var n0 = I.now(), t0 = new Date(t), d = Math.round((new Date(n0.getFullYear(), n0.getMonth(), n0.getDate()) - new Date(t0.getFullYear(), t0.getMonth(), t0.getDate())) / 86400000);   /* da qui, giorni di calendario (come in Progetti): 47 ore fa è «2 giorni fa», non «ieri» */
    if (d <= 1) return "ieri";
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

    var PROVA = "https://imad.chat", INK = "#16171d", FAINT = "#c3c5d0";
    var LOOK = { shape: "uniti", eye: "tondo" };
    var SALVA = { size: 1024, dpr: 1, quiet: 4, shape: LOOK.shape, eye: LOOK.eye, fg: INK, bg: "#ffffff", style: false };
    var ctx = cv.getContext("2d"), lay = doc.createElement("canvas"), old = doc.createElement("canvas"), octx = old.getContext("2d");
    var size = 0, dpr = 1, hasOld = false, R = 1;
    var cur = null, anim = null, raf = 0, settle = 0, seen = false, troppo = false;

    /* cosa diventa il testo: un link (QRCore.payload.url aggiunge https:// se serve) o un testo semplice, scritto com'è.
       È un link solo se lo dice: uno schema (https:, mailto:, tel:...), «www.», un nome seguito da «/», o un dominio di quelli
       comuni (imad.chat, gmitorino.org). «nome.cognome» resta testo. A_CAPO: il segno che nel campo tiene il posto di un a capo
       incollato (un campo di una riga li toglierebbe); nel codice torna un a capo vero. */
    var A_CAPO = "\u21b5";
    var TLD = /\.(com|it|org|net|io|dev|app|ai|co|me|eu|info|edu|gov|ma|ps|fr|de|es|uk|ch|be|nl|at|pt|us|ca|tv|xyz|site|online|store|shop|tech|blog|page|chat|link|news|art|design|studio|cloud|live|world)$/i;
    function sembraLink(t) {
      if (/\s/.test(t)) return false;
      if (/^(https?|mailto|tel|sms|geo|ftp):/i.test(t) || /^\/\/\S/.test(t)) return true;
      var m = /^([a-z0-9\u00a1-\uffff-]+(?:\.[a-z0-9\u00a1-\uffff-]+)+)(:\d{1,5})?([\/?#].*)?$/i.exec(t);
      if (!m) return false;
      return /^www\./i.test(m[1]) || /^\//.test(m[3] || "") || TLD.test(m[1]) || /^(\d{1,3}\.){3}\d{1,3}$/.test(m[1]);
    }
    function leggi(raw) {
      var t = Q.payload.text(String(raw).split(A_CAPO).join("\n")).replace(/^\s+|\s+$/g, "");
      if (!t) return { kind: "vuoto", text: PROVA };
      return sembraLink(t) ? { kind: "link", text: Q.payload.url(t) } : { kind: "testo", text: t };
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
      var info = Q.render(lay, cur.qr, { size: size, dpr: dpr, quiet: margine(cur.qr.n), shape: LOOK.shape, eye: LOOK.eye, fg: cur.fg, bg: "transparent", progress: p, order: "onda", style: false });
      R = Math.max(1, info.side / 2 * Math.SQRT2);
      if (cv.width !== lay.width || cv.height !== lay.height) { cv.width = lay.width; cv.height = lay.height; hasOld = false; }
      if (cv.style.width !== size + "px") { cv.style.width = size + "px"; cv.style.height = size + "px"; snap(cv, dpr); }
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
    /* sullo schermo il margine bianco è di 3 moduli; dove i pixel sono pochi (computer) i moduli interi lascerebbero un bordo
       troppo largo, e allora 2 (la carta bianca intorno fa il resto). Il PNG salvato ne ha sempre 4. */
    function margine(n) {
      var W = Math.round(size * dpr), m3 = Math.floor(W / (n + 6)), m2 = Math.floor(W / (n + 4));
      return m2 * n > m3 * n * 1.12 ? 2 : 3;
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
      if (onda && anim && seen && !I.still()) { cur = st; return; }   /* si scrive mentre l'onda corre: prosegue con il codice nuovo */
      if (onda && seen && !I.still()) { istantanea(); cur = st; anim = { t0: performance.now(), dur: 560 }; if (!raf) raf = requestAnimationFrame(passo); return; }
      cur = st; anim = null; hasOld = false;
      if (seen) quadro(1);
      dopo();
    }

    /* quando si smette di scrivere: si rilegge il codice disegnato (jsQR arriva solo adesso); se non si legge, lo si dice piano */
    var jsqr = 0, attese = [];
    function conJsQR(fn) {                              /* fn può mancare: al primo fuoco sul campo si comincia solo a caricarlo */
      if (typeof window.jsQR === "function") { if (fn) fn(true); return; }
      if (jsqr === 2) { if (fn) fn(false); return; }
      if (fn) attese.push(fn);
      if (jsqr === 1) return;
      var src = box.getAttribute("data-jsqr"); if (!src) { jsqr = 2; if (fn) fn(false); return; }
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
          if (v && !v.ok && st === cur && !nota.textContent) dici("Questo codice potrebbe non leggersi.");
        });
      }, 450);
    }

    /* il codice com'è disegnato qui, alla sua misura: moduli troppo piccoli per un'altra fotocamera che guarda lo schermo?
       (il margine stretto dello schermo è voluto: la carta bianca intorno fa il resto, quindi conta solo la misura dei moduli) */
    function fittoQui(qr) {
      if (!size || !qr) return false;
      try {
        var c = Q.scannable({ size: size, dpr: dpr, quiet: margine(qr.n), shape: LOOK.shape, eye: LOOK.eye, fg: INK, bg: "#ffffff" }, qr);
        return c.problems.some(function (p) { return p.code === "MODULI_PICCOLI"; });
      } catch (e) { return false; }
    }
    function dici(t) { nota.textContent = t || ""; box.classList.toggle("has-nota", !!t); }
    function testi(st) {
      dici("");
      if (st.kind === "vuoto") {
        tipo.textContent = "Esempio"; val.textContent = "Resta sul tuo telefono."; val.classList.remove("is-link");
        salva.disabled = true; cv.setAttribute("aria-label", "Codice QR di prova: " + PROVA); return;
      }
      if (st.kind === "link") { tipo.textContent = etichetta(st.text); val.textContent = st.text; val.classList.add("is-link"); }
      else {
        var k = Array.from ? Array.from(st.text).length : st.text.length;
        tipo.textContent = "Testo"; val.textContent = k === 1 ? "1 carattere" : fmt(k) + " caratteri"; val.classList.remove("is-link");
      }
      var chk = null; try { chk = Q.scannable(SALVA, st.qr); } catch (e) { chk = null; }
      salva.disabled = !!(chk && chk.level === "errore");
      if (chk && chk.level !== "ok" && chk.why) dici(chk.why);
      else if (fittoQui(st.qr)) dici("Da qui è troppo fitto: salva il PNG per scansionarlo.");
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
        dici(e && e.code === "TROPPO_LUNGO" ? "Troppo lungo per un codice QR: accorcia il testo." : ((e && e.message) || "Questo testo non entra in un codice QR."));
        salva.disabled = true;
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
      try { blob = blobDa(esporta(cur.qr).toDataURL("image/png")); } catch (e) { dici("L'immagine non si è potuta preparare."); return; }
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
    input.addEventListener("paste", function (e) {
      var cd = e.clipboardData || window.clipboardData, t = "";
      try { t = cd && cd.getData ? cd.getData("text") : ""; } catch (x) { t = ""; }
      if (!t || !/[\r\n]/.test(t)) return;                /* una riga sola: ci pensa il campo */
      e.preventDefault();
      var v = t.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "").split("\n").join(A_CAPO);
      var fatto = false;
      try { fatto = !!(doc.execCommand && doc.execCommand("insertText", false, v)); } catch (x) { fatto = false; }
      if (!fatto) {
        var a = input.selectionStart, b = input.selectionEnd;
        if (typeof a === "number" && input.setRangeText) input.setRangeText(v, a, b, "end"); else input.value += v;
        aggiorna();
      }
    });
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
    snaps.push(function () { if (size) snap(cv, dpr); });
    onResize(box, function () {
      if (!misura()) return;
      if (cur && cur.kind !== "vuoto" && !troppo) testi(cur);          /* la misura nuova può rendere il codice troppo fitto, o non più */
      if (seen) { anim = null; hasOld = false; quadro(1); snap(cv, dpr); }
    });
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

    /* tutti i colori della tela vengono dai token del riquadro (vivi.css): la stessa tela va sull'inchiostro e sul vetro chiaro */
    var K = { label: [227, 231, 244, 0.64], today: [244, 245, 250, 0.95], up0: [58, 61, 76, 1], up1: [92, 99, 126, 1], ring: [255, 255, 255, 0.85], shade: [4, 6, 18, 0.75] };
    function tok(cs, n, d) { var v = cs.getPropertyValue(n).trim(); return v ? rgba(v) : d; }
    function colori() {
      var cs = getComputedStyle(tile); C = [0, 1, 2, 3, 4].map(function (i) { return rgba(cs.getPropertyValue("--hm-" + i).trim()); });
      K = { label: tok(cs, "--hm-label", K.label), today: tok(cs, "--hm-today", K.today), up0: tok(cs, "--hm-up-0", K.up0), up1: tok(cs, "--hm-up-1", K.up1), ring: tok(cs, "--hm-ring", K.ring), shade: tok(cs, "--hm-shade", K.shade) };
    }

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
        if (dt.getUTCDate() === 1 && c - lastCol >= 7) { months.push({ c: c, t: MESI[dt.getUTCMonth()].toUpperCase() }); lastCol = c; }   /* GEN, FEB…: almeno 7 colonne tra due */
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
      var mh = Math.round(19 * d);
      /* se in altezza non ci sta, i quadrati si stringono (mai sotto i 3 px) */
      while (avH > 20 && (mh + 7 * p - g) / d > avH && s > Math.round(3 * d)) { s--; p--; }
      G = { dpr: d, s: s, g: g, p: p, mh: mh, W: 53 * p - g, H: mh + 7 * p - g };
      cv.width = G.W; cv.height = G.H;
      cv.style.width = (G.W / d) + "px"; cv.style.height = (G.H / d) + "px";
      snap(cv, d);
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
      var d = G.dpr, s = G.s, p = G.p, rad = Math.max(1, Math.round(s * 0.3)), top = G.mh;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, G.W, G.H);
      /* i mesi, nella voce della macchina (Geist Mono, maiuscolo); quello che uscirebbe dalla tela a destra non si scrive */
      ctx.font = "500 " + Math.round(10.5 * d) + "px 'Geist Mono', ui-monospace, monospace";
      ctx.textBaseline = "alphabetic"; ctx.fillStyle = css(K.label);
      for (var m = 0; m < months.length; m++) { var mx = months[m].c * p; if (mx + ctx.measureText(months[m].t).width > G.W) continue; ctx.fillText(months[m].t, mx, Math.round(11.5 * d)); }
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
        var base = ux.l > 0 ? mixc(e0, C[ux.l], eOut(ups[u][1])) : mixc(K.up0, K.up1, ul);
        var big = s * (1 + 0.62 * ul), oo = (s - big) / 2, bx = uc * p + oo, by = top + ur * p + oo - 1.2 * d * ul;
        ctx.save();
        ctx.shadowColor = css([K.shade[0], K.shade[1], K.shade[2], K.shade[3] * ul]); ctx.shadowBlur = 5 * d * ul; ctx.shadowOffsetY = 1.5 * d * ul;
        ctx.beginPath(); ctx.fillStyle = css([base[0], base[1], base[2], 1]); rrect(ctx, bx, by, big, big, rad * (1 + 0.5 * ul)); ctx.fill();
        ctx.restore();
        var lw = Math.max(1, Math.round(d));
        ctx.beginPath(); ctx.lineWidth = lw; ctx.strokeStyle = css([K.ring[0], K.ring[1], K.ring[2], K.ring[3] * ul]);
        rrect(ctx, bx + lw / 2, by + lw / 2, big - lw, big - lw, rad * (1 + 0.5 * ul)); ctx.stroke();
      }
      /* oggi: un anello sottile dentro il suo quadrato (l'ultimo giorno dei dati), finché non ci passa sopra il dito */
      if (ok && last >= 0 && !(lifts[last] > 0.001)) {
        var tc = Math.floor(last / 7), tr = last % 7, tw = Math.max(1, Math.round(d));
        ctx.beginPath(); ctx.lineWidth = tw; ctx.strokeStyle = css(K.today);
        rrect(ctx, tc * p + tw / 2, top + tr * p + tw / 2, s - tw, s - tw, Math.max(1, rad - tw / 2)); ctx.stroke();
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
      if (played || wave || !ok || !G.W) return;
      if (I.still()) { played = true; sale(); draw(performance.now()); return; }    /* fermo: lo stato finale subito, dovunque sia */
      if (!half) return;
      wave = { t0: performance.now() }; kick(); sale();
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
      if (typeof x.n === "number") s += "<span class=\"hm__s\" aria-hidden=\"true\">·</span><span class=\"sr\">, </span>" + (x.n === 0 ? "nessun contributo" : x.n === 1 ? "1 contributo" : fmt(x.n) + " contributi");
      return s;
    }
    var span = $(".hm__a", riga), fadeT = 0, attesa = false;
    /* il totale dell'anno aspetta l'onda: arrivati i dati resta nascosto (.is-via) finché i quadrati non si accendono, poi sale con
       loro; le sue cifre passano per IMAD.moto.cifre quando c'è (moto.js) */
    function sale() {
      if (!attesa) return;
      attesa = false; clearTimeout(fadeT);
      if (mode !== "totale") return;
      span.innerHTML = testoTotale(); span.classList.remove("is-giorno");
      void span.offsetWidth; span.classList.remove("is-via");
      var b = span.querySelector("b"), M = I.moto || window.IMAD && window.IMAD.moto;
      if (b && M && M.cifre && !I.still()) { try { M.cifre(b); } catch (e) { } }
    }
    function scrivi(html, morbido) {
      clearTimeout(fadeT);
      var g = mode === "giorno", put = function () { span.innerHTML = html; span.classList.toggle("is-giorno", g); };
      if (!morbido || I.still()) { span.classList.remove("is-via"); put(); return; }
      span.classList.add("is-via");
      fadeT = setTimeout(function () { put(); span.classList.remove("is-via"); }, 150);
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
      clearTimeout(holdT); clearTimeout(fadeT); mode = "totale"; alza(-1);
      if (played || I.still()) { span.classList.remove("is-via"); span.innerHTML = testoTotale(); span.classList.remove("is-giorno"); }
      else {
        attesa = true; span.classList.add("is-via");                         /* «Si aggiorna tra poco» se ne va; il totale arriva con l'onda */
        fadeT = setTimeout(function () { if (attesa) { span.innerHTML = testoTotale(); span.classList.remove("is-giorno"); } }, 200);
      }
      draw(performance.now());
      onda();
    }

    snaps.push(function () { if (G.W) snap(cv, G.dpr); });
    colori(); vuoti(); box.classList.add("is-vuoto");
    span.innerHTML = testoTotale();
    if (fit()) draw(0);
    onResize(wrap, function () { if (fit()) draw(performance.now()); });
    onTema(function () { colori(); draw(performance.now()); });
    /* l'onda parte quando i quadrati si vedono quasi tutti, sopra il dock (che copre il fondo dello schermo): non mentre
       scorrono ancora dietro di lui. offsetTop di un elemento fisso non conta la sua traslazione d'ingresso durante l'intro. */
    function sottoDock() {
      var d = doc.getElementById("dock"); if (!d || !d.offsetHeight) return 0;
      return Math.max(0, Math.round(window.innerHeight - d.offsetTop + 12));
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { half = es[es.length - 1].intersectionRatio >= 0.9; if (half && !root.classList.contains("ni-on")) onda(); },
        { threshold: [0, 0.9, 1], rootMargin: "0px 0px -" + sottoDock() + "px 0px" }).observe(cv);
    } else half = true;
    I.whenFree(function () {
      colori(); if (fit()) draw(performance.now());
      if (doc.fonts && doc.fonts.load) { try { doc.fonts.load("500 10px 'Geist Mono'").then(function () { draw(performance.now()); }, function () { }); } catch (e) { } }
      I.api("contributi").then(dati, function () { });
      onda();
    });
  }

  /* ================================================================== Sto imparando: Three.js Journey */
  function Impara(tile) {
    var cv = $("#imparaCv", tile), log = $("#imparaLog", tile), hit = $(".tile__hit", tile), head = $(".tile__head", tile), titolo = $(".ip__t", tile);
    if (!cv || !cv.getContext || !log) return;
    var ctx = cv.getContext("2d"), G = null;
    /* il risveglio dopo l'intro (moto.js, CASA.md 2d E). zz: 0 vivo da subito (senza prime), 1 spento (prime(): la tela vuota),
       2 si sveglia (wake(d), dopo d ms: gli spigoli crescono dall'alto in 1 s, ease-out cubico, mentre il solido gira di 0,9 rad meno;
       i vertici per ultimi), 3 sveglio. Il tempo è il suo orologio (clock), che avanza solo mentre si disegna */
    var zz = 0, zt0 = 0, zDorme = 0, zPend = false, Z_DUR = 1000, Z_TURN = 0.9;
    function sveglia() { zPend = false; if (zz !== 1) return; zz = 2; zt0 = clock; }

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
    /* i colori dai token del riquadro (vivi.css: --ip-line, --ip-dot, terne «r g b»): la stessa tela sull'inchiostro e sul vetro chiaro */
    var LN = "227,231,244", DT = "240,242,252";
    function terna(v, d) { var m = /^\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*$/.exec(v || ""); return m ? m[1] + "," + m[2] + "," + m[3] : d; }
    function colori() { var cs = getComputedStyle(tile); LN = terna(cs.getPropertyValue("--ip-line"), LN); DT = terna(cs.getPropertyValue("--ip-dot"), DT); }
    colori();
    onTema(function () { colori(); still(); });

    function fit() {
      colori();
      var f = I.fit(cv, 3); if (!f) { G = null; return; }
      var tr = tile.getBoundingClientRect(), hr = head.getBoundingClientRect(), xr = titolo.getBoundingClientRect();
      var topY = hr.bottom - tr.top, botY = xr.top - tr.top;
      /* il solido sta tutto tra l'etichetta e il titolo: nessuna linea tocca una lettera. Con la prospettiva (cam 3,6) quello che si
         vede è largo 0,752 R al più: rv, il raggio che si vede, arriva a 1 px dalle scatole delle righe (che hanno aria sopra e sotto
         le lettere); a 390 px è 19,5 px (prima circa 14), a 360 px 14. Un filo di sfumatura resta sul bordo del titolo */
      var rv = Math.max(12, Math.min(f.W * 0.2, (botY - topY) * 0.5 - 1));
      G = { W: f.W, H: f.H, dpr: f.dpr, cx: f.W * 0.5, cy: topY + (botY - topY) * 0.5, R: rv / 0.752, rv: rv, fade0: botY - 2, fade1: botY + 3 };
    }
    function draw(t) {
      if (!G) return;
      if (zz === 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); return; }   /* spento: aspetta il risveglio */
      var wu = zz === 2 ? clamp((t - zt0) / Z_DUR, 0, 1) : 1, we = eOut(wu);
      var d = G.dpr, a = t * (Math.PI * 2 / 34000) + 0.6 - Z_TURN * (1 - we), tilt = 0.42 + 0.1 * Math.sin(t / 9000);
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
      /* durante il risveglio una linea scende dall'alto del solido: ogni spigolo cresce dal suo capo più alto fin dove è arrivata */
      var yS = zz === 2 ? G.cy - G.rv * 1.06 + we * G.rv * 2.12 : Infinity;
      for (var o = 0; o < order.length; o++) {
        var ei = order[o], e = E[ei], zd = (Z[ei] + 1) / 2, al = 0.07 + 0.6 * Math.pow(zd, 1.6), p0 = P[e[0]], p1 = P[e[1]];
        if (yS < Infinity) {
          if (p1[1] < p0[1]) { var sw = p0; p0 = p1; p1 = sw; }
          if (yS <= p0[1]) continue;
          var fr = p1[1] - p0[1] > 0.01 ? Math.min(1, (yS - p0[1]) / (p1[1] - p0[1])) : 1;
          p1 = [p0[0] + (p1[0] - p0[0]) * fr, p0[1] + (p1[1] - p0[1]) * fr];
        }
        ctx.beginPath(); ctx.strokeStyle = "rgba(" + LN + "," + al.toFixed(3) + ")"; ctx.lineWidth = 0.7 + 0.55 * zd;
        ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
      /* i vertici davanti: punti piccoli, la luce del lato vicino (al risveglio, per ultimi) */
      var va = zz === 2 ? clamp((wu - 0.65) / 0.35, 0, 1) : 1;
      ctx.fillStyle = "rgba(" + DT + ",.9)";
      for (var q = 0; va > 0 && q < P.length; q++) {
        if (P[q][2] < 0.35) continue;
        var zr = (P[q][2] - 0.35) / 0.65;
        ctx.globalAlpha = (0.25 + 0.6 * zr) * va; ctx.beginPath(); ctx.arc(P[q][0], P[q][1], 0.8 + 0.5 * zr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* sotto il titolo il disegno si spegne: il testo resta pulito */
      ctx.globalCompositeOperation = "destination-out";
      var g = ctx.createLinearGradient(0, G.fade0, 0, G.fade1);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = g; ctx.fillRect(0, G.fade0, G.W, G.H - G.fade0);
      ctx.globalCompositeOperation = "source-over";
    }

    /* quante lettere (latine, greche, cirilliche, ebraiche, arabe, giapponesi, cinesi, coreane: niente cifre, segni o emoji) */
    function lettere(m) { var x = m.match(/[A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g); return x ? x.length : 0; }
    function riga(msg, quando, vuoto) {
      var li = doc.createElement("li"), a = doc.createElement("span"), b = doc.createElement("span");
      a.className = "ip__msg" + (vuoto ? " ip__msg--vuoto" : ""); a.textContent = msg;
      b.className = "ip__ago"; b.textContent = quando || " ";
      /* come una riga di git log: prima quando (tenue), poi il titolo; tutte e due nelle stesse due righe al più */
      li.appendChild(b); li.appendChild(a); return li;
    }
    function dati(j) {
      var L = j && j.ok ? j.learning : null;
      if (!L || typeof L !== "object") return;
      if (hit) hit.href = ghUrl(L.url, hit.href);
      var cs = (L.commits && L.commits.length ? L.commits : []).filter(function (c) { return c && typeof c.message === "string" && c.message.replace(/\s/g, ""); });
      var righe = [];
      /* un commit solo: il titolo com'è (la prima riga), su due righe al più. Uno che non dice niente (meno di tre lettere, come «.»
         o «v2», o un hash da solo) lascia il posto a «Ultimo aggiornamento», con la sua data: l'unica frase nostra del riquadro */
      cs.slice(0, 1).forEach(function (c) {
        var m = c.message.split(/\r?\n/)[0].replace(/^\s+|\s+$/g, "").slice(0, 140);
        if (lettere(m) < 3 || /^(?=.*\d)[0-9a-f]{7,40}$/i.test(m)) m = "Ultimo aggiornamento";     /* un hash ha almeno una cifra («defaced» no) */
        righe.push(riga(m, fa(c.date)));
      });
      if (!righe.length && L.pushedAt && fa(L.pushedAt)) righe.push(riga("Ultimo aggiornamento", fa(L.pushedAt)));
      if (!righe.length) return;
      log.innerHTML = ""; righe.forEach(function (li) { log.appendChild(li); });
      if (!I.still()) { log.classList.remove("is-nuovo"); void log.offsetWidth; log.classList.add("is-nuovo"); }
      fit(); still();                                    /* le righe nuove alzano il titolo: il solido si rimette nello spazio che resta */
      var aria = "Sto imparando: Three.js Journey. Ultimo: " + righe[0].lastChild.textContent + ", " + righe[0].firstChild.textContent + ". Apri il repository su GitHub, in una nuova scheda";
      if (hit) hit.setAttribute("aria-label", aria);
    }

    fit();
    /* il suo orologio avanza solo quando si disegna (al più 50 ms per volta): dopo una pausa (una pagina aperta, il riquadro
       fuori dallo schermo) il solido riprende da dove era, non salta avanti del tempo passato */
    var clock = 0, ultimo = -1;
    function still() { draw(clock); }
    onResize(tile, function () { fit(); still(); });
    still();
    /* gira piano: trenta disegni al secondo bastano (un quarto di grado ciascuno) e costano la metà; mentre si sveglia, tutti.
       Spento e in vista (a pagina libera) per 6 s senza che nessuno lo svegli: si sveglia da sé */
    I.loop(cv, function (t) {
      if (zz === 1) {
        zDorme += ultimo < 0 ? 0 : clamp(t - ultimo, 0, 50); ultimo = t;
        if (zDorme > 6000 && !zPend) sveglia();
        if (zz === 1) return;
      }
      if (zz !== 2 && ultimo >= 0 && t - ultimo < 30 && t >= ultimo) return;
      clock += ultimo < 0 ? 0 : clamp(t - ultimo, 0, 50); ultimo = t;
      if (zz === 2 && clock - zt0 >= Z_DUR) zz = 3;
      draw(clock);
    });
    I.whenFree(function () { fit(); still(); I.api("progetti").then(dati, function () { }); });
    return {
      prime: function () { if (I.still() || zz) return; zz = 1; zDorme = 0; draw(clock); },
      wake: function (dl) {
        if (zz !== 1 || zPend) return 0;
        dl = Math.max(0, +dl || 0); zPend = true; setTimeout(sveglia, dl);
        return dl + Z_DUR;
      }
    };
  }

  var q = $("#qrMini"), h = $("#heat"), ip = $('[data-tile="imparando"]');
  try { if (q) MiniQR(q); } catch (e) { if (window.console) console.error(e); }
  try { if (h) Heat(h); } catch (e) { if (window.console) console.error(e); }
  var imp = null;
  try { if (ip) imp = Impara(ip); } catch (e) { if (window.console) console.error(e); }
  /* il risveglio del fil di ferro dopo l'intro (moto.js): IMAD.vivo.impara = { prime(), wake(ritardoMs) → ms in tutto } */
  I.vivo = I.vivo || {};
  I.vivo.impara = imp || { prime: function () { }, wake: function () { return 0; } };
  I.whenFree(function () { setTimeout(snapAll, 120); });
})();
