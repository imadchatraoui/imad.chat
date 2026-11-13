/* imad.chat — la casa nuova (anteprima): come risponde la casa (CASA.md 2d E). Va con moto.css; viene per ultimo, dopo vivi.js.
   Plain script, ES2017 al massimo (niente ?., ??, campi di classe, moduli).

   1. La pressione. Un dito che si posa su un riquadro o su un pulsante lo preme solo se resta fermo 70 ms senza muoversi più di 9 px:
      un dito che scorre la pagina non preme mai niente. Uno scorrimento, pointercancel o dragstart annullano senza molla (.is-sfugge,
      200 ms); un tocco breve fa vedere la pressione intera per 90 ms; lasciato, torna con una molla (.is-lascia, 520 ms). Il mouse
      preme subito. Il riquadro premuto e lasciato chiama IMAD.relayout(0.6): Dot seduto sul riquadro scende e sale con lui.
      Il Corano non si muove mai: premuto, si scurisce appena la sua carta sotto le parole (il velo, moto.css).
   2. I filtri: IMAD.moto.viaggio(o), chiamato da casa.js (viaggio). Ogni riga della mappa nuova viaggia come uno strato del cubo.
   3. Il velo: un <i class="velo"> in ogni riquadro; un filtro abbassa i riquadri con il velo, non con la trasparenza.
   4. La pillola del dock: IMAD.moto.pill(b, still), chiamato da casa.js (paintDock). Due molle, una per bordo.
   5. Il risveglio dopo l'intro: i disegni (IMAD.vivo.{globo, cubo, impara}.prime() / .wake(ms), vivo.js e vivi.js), la foto di Su di me
      e i saluti dormono dal primo fotogramma e si svegliano lungo le diagonali della griglia 3x3 dell'intro (window.__niTiles).
   6. Le cifre: IMAD.moto.cifre(el) fa salire una alla volta le cifre del testo di adesso (l'ora della città, il totale della heatmap).
   7. Aprire una pagina e tornare: il riquadro toccato si chiama «riquadro» per la transizione tra documenti (dove il browser la sa fare);
      sessionStorage imad.vt dice alla pagina quale riquadro era.
   Con «meno movimento» o ?shot=1 (IMAD.still) niente di tutto questo si muove: gli stati finali subito, niente attese. */
(function () {
  "use strict";
  var I = window.IMAD, doc = document, root = doc.documentElement;
  if (!I || !doc.querySelector) return;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  var grid = $("#grid"), dock = $("#dock");
  if (!grid) return;
  var tiles = $$(".grid > .tile");
  function idOf(t) { return t.getAttribute("data-tile"); }
  function tileOf(id) { for (var i = 0; i < tiles.length; i++) if (idOf(tiles[i]) === id) return tiles[i]; return null; }
  var M = I.moto = I.moto || {};

  /* ------------------------------------------------------------------ 0. le molle per il CSS */
  /* la stessa formula di springCurve in app.js; dove linear() non c'è restano le curve di style.css (cubic-bezier) */
  function springCurve(z, n) {
    if (!(window.CSS && CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)"))) return null;
    var w = 6.4 / z, wd = w * Math.sqrt(1 - z * z), pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
      pts.push(i === n ? 1 : Math.round(x * 1000) / 1000);
    }
    return "linear(" + pts.join(", ") + ")";
  }
  var MOLLA = springCurve(0.58, 40), PIANA = springCurve(0.84, 36);
  if (MOLLA) root.style.setProperty("--molla", MOLLA);        /* il rilascio, il passaggio del mouse: torna con un filo oltre (circa 0,3% di scala) */
  if (PIANA) root.style.setProperty("--molla-piana", PIANA);  /* gli arrivi, i viaggi, i risvegli: si posa senza rimbalzo visibile */

  /* ------------------------------------------------------------------ 3. il velo */
  /* dentro ogni riquadro, ultimo figlio, sotto il filo di luce (z 4 e 5, moto.css). Se questo script non gira, l'opacità .38 di casa.css
     abbassa lo stesso (il velo vale solo con #grid.has-velo) */
  tiles.forEach(function (t) { var v = doc.createElement("i"); v.className = "velo"; v.setAttribute("aria-hidden", "true"); t.appendChild(v); });
  grid.classList.add("has-velo");

  /* ------------------------------------------------------------------ 4. la pillola del dock: una forma sola, i due bordi sono due molle */
  /* Il bordo che va avanti è più rigido (k 560/s²) di quello che segue (300/s²), smorzamento .8: la pillola si allunga verso il filtro
     nuovo e si richiude arrivando. Si interrompe in ogni istante tenendo posizione e velocità. Quattro passi piccoli per fotogramma
     (stabile anche a 30 al secondo). Nel giro si scrivono solo transform e width; le misure si leggono quando si sceglie, mai nel giro. */
  var pill = dock ? $(".dock__pill", dock) : null;
  var PL = { l: 0, r: 0, vl: 0, vr: 0, tl: 0, tr: 0, dir: 1, s: 1, vs: 0, ts: 1, raf: 0, last: 0, on: false };
  function pillDraw() {
    pill.style.transform = "translateX(" + PL.l.toFixed(2) + "px)" + (PL.s !== 1 ? " scale(" + PL.s.toFixed(4) + ")" : "");
    pill.style.width = Math.max(10, PL.r - PL.l).toFixed(2) + "px";
  }
  function pillStop() { if (PL.raf) { cancelAnimationFrame(PL.raf); PL.raf = 0; } }
  function pillKick() { if (!PL.raf) { PL.last = performance.now(); PL.raf = requestAnimationFrame(pillStep); } }
  function pillStep(now) {
    PL.raf = 0;
    var dt = Math.min(34, Math.max(0, now - PL.last)) / 1000, h = dt / 4; PL.last = now;
    var kl = PL.dir > 0 ? 300 : 560, kr = PL.dir > 0 ? 560 : 300;            /* verso destra va avanti il bordo destro */
    var sq = PL.ts < 1, ks = sq ? 1400 : 520, zs = sq ? 0.9 : 0.55;            /* stringe svelta; lasciata, torna con un filo oltre */
    for (var i = 0; i < 4; i++) {
      PL.vl += (-kl * (PL.l - PL.tl) - 1.6 * Math.sqrt(kl) * PL.vl) * h; PL.l += PL.vl * h;
      PL.vr += (-kr * (PL.r - PL.tr) - 1.6 * Math.sqrt(kr) * PL.vr) * h; PL.r += PL.vr * h;
      PL.vs += (-ks * (PL.s - PL.ts) - 2 * zs * Math.sqrt(ks) * PL.vs) * h; PL.s += PL.vs * h;
    }
    var done = Math.abs(PL.l - PL.tl) < 0.2 && Math.abs(PL.r - PL.tr) < 0.2 && Math.abs(PL.vl) < 5 && Math.abs(PL.vr) < 5 &&
      Math.abs(PL.s - PL.ts) < 0.0008 && Math.abs(PL.vs) < 0.01;
    if (done) { PL.l = PL.tl; PL.r = PL.tr; PL.vl = PL.vr = 0; PL.s = PL.ts; PL.vs = 0; }
    pillDraw();
    if (!done) PL.raf = requestAnimationFrame(pillStep);
  }
  /* b: il filtro scelto; still: salta lì (girando il telefono, i caratteri arrivati, «meno movimento») */
  M.pill = function (b, still) {
    if (!pill || !b) return;
    var l = b.offsetLeft, w = b.offsetWidth;
    PL.tl = l; PL.tr = l + w;
    if (still || !PL.on || I.still()) {
      pillStop(); PL.on = true; PL.l = PL.tl; PL.r = PL.tr; PL.vl = PL.vr = 0; PL.s = PL.ts = 1; PL.vs = 0; pillDraw(); return;
    }
    PL.dir = PL.tl + PL.tr >= PL.l + PL.r ? 1 : -1;
    pillKick();
  };
  /* un dito fermo sul filtro già scelto stringe la pillola a .95 (k 1400, smorzamento .9); lasciata, torna (k 520, smorzamento .55) */
  function stringi(on) { if (!pill || !PL.on || I.still()) return; PL.ts = on ? 0.95 : 1; pillKick(); }
  if (pill && dock) {
    dock.classList.add("has-molla");                                   /* moto.css: la pillola non ha più le sue transizioni */
    var sel0 = $('.dock__b[aria-pressed="true"]', dock);               /* casa.js l'ha già messa al suo posto: si parte da lì */
    if (sel0) M.pill(sel0, true);
  }

  /* ------------------------------------------------------------------ 2. i filtri: i riquadri viaggiano a strati, come il cubo */
  /* o = { tiles, first, last, front(t), anims } da casa.js (viaggio): first e last sono i rettangoli prima e dopo la mappa nuova.
     Come prima, FLIP lungo la riga e poi lungo la colonna (IMAD.ease.inOut, poi IMAD.ease.spring); in più una riga della mappa nuova
     (le cime a meno di 3 px) si muove come uno strato: tutti i suoi riquadri hanno la durata del più lontano, clamp(380 + .1·distanza,
     440, 600) ms, e gli strati partono 34 ms l'uno dopo l'altro dall'alto. Chi viene davanti si stacca appena dal piano (scala 1,025 al
     40%). Ogni animazione va in o.anims (casa.js le ferma tutte se arriva un altro filtro: si riparte da dove si vedono). */
  M.viaggio = function (o) {
    if (I.still() || !o || !o.tiles || !o.tiles.length || !o.tiles[0].animate) return 0;
    var f = grid.getAttribute("data-filtro"), alza = !!f && f !== "tutto";   /* tornando a «Tutto» nessuno viene davanti */
    var mv = [];
    o.tiles.forEach(function (t, i) {
      var a = o.first[i], b = o.last[i], dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      mv.push({ t: t, dx: dx, dy: dy, dist: Math.abs(dx) + Math.abs(dy), top: b.top });
    });
    mv.sort(function (a, b) { return a.top - b.top; });
    var strati = [];
    mv.forEach(function (m) {
      var s = strati.length ? strati[strati.length - 1] : null;
      if (!s || Math.abs(m.top - s.top) > 3) { s = { top: m.top, list: [], len: 0 }; strati.push(s); }
      s.list.push(m); if (m.dist > s.len) s.len = m.dist;
    });
    var longest = 0;
    strati.forEach(function (s, ri) {
      var dur = Math.round(I.clamp(380 + s.len * 0.1, 440, 600)), delay = ri * 34;
      s.list.forEach(function (m) {
        var t = m.t, dx = m.dx, dy = m.dy, kf, front = !!o.front(t);
        if (Math.abs(dx) >= 1 && Math.abs(dy) >= 1) {
          var k = I.clamp(Math.abs(dx) / m.dist, 0.28, 0.6);
          kf = [{ transform: "translate(" + dx + "px," + dy + "px)", easing: I.ease.inOut }, { transform: "translate(0px," + dy + "px)", offset: k, easing: I.ease.spring }, { transform: "translate(0px,0px)" }];
        } else kf = [{ transform: "translate(" + dx + "px," + dy + "px)", easing: I.ease.spring }, { transform: "translate(0px,0px)" }];
        t.style.zIndex = front ? "3" : "2";
        o.anims.push(t.animate(kf, { duration: dur, delay: delay, easing: "linear", fill: "backwards" }));
        /* la proprietà scale da sola si somma alla traslazione (Safari 14.1+; prima non c'è, e va bene così) */
        if (alza && front) { try { o.anims.push(t.animate([{ scale: "1" }, { scale: "1.025", offset: 0.4 }, { scale: "1" }], { duration: dur, delay: delay, easing: I.ease.inOut })); } catch (e) { } }
        longest = Math.max(longest, dur + delay);
      });
    });
    return longest;
  };

  /* ------------------------------------------------------------------ 6. le cifre che salgono */
  /* le cifre del testo di adesso, una alla volta dal basso (42 ms l'una, 560 ms ciascuna): il numero è sempre quello vero, e alla fine
     torna testo semplice. Se nel frattempo il testo cambia (la città del globo), chi lo scrive sostituisce le cifre: va bene così.
     display scritto sullo span: le regole dei contenitori per i loro span (.citta__now span è un flex) non devono arrivare alle cifre */
  M.cifre = function (el, ritardo) {
    if (!el || I.still()) return;
    var txt = el.textContent, k = 0, d0 = Math.max(0, +ritardo || 0);
    if (!/\d/.test(txt)) return;
    el.innerHTML = I.esc(txt).replace(/\d/g, function (c) { return '<span class="cifra" style="display:inline-block;animation-delay:' + (d0 + 42 * k++) + 'ms">' + c + "</span>"; });
    clearTimeout(el.__cifre);
    el.__cifre = setTimeout(function () { if (el.querySelector(".cifra") && el.textContent === txt) el.textContent = txt; }, d0 + 42 * (k - 1) + 600);
  };

  /* ------------------------------------------------------------------ 1. la pressione */
  var PREMIBILI = ".tile__hit, .pill, .iconbtn, .dock__b, .qr__salva:not([disabled]), .hm__gh, .logo, .gchip, .let__src, .qr__x";
  var FERMO = 70, SOGLIA = 9, TOCCO = 90, LASCIA = 520, SFUGGE = 200;
  var P = null;   /* la pressione di adesso: { m, id, x, y, on, t, sq } */
  function eTile(m) { return m.classList.contains("tile"); }
  function giu(p) {
    var m = p.m;
    clearTimeout(m.__moto); m.classList.remove("is-sfugge", "is-lascia"); m.classList.add("is-premuto");
    if (m.classList.contains("dock__b") && m.getAttribute("aria-pressed") === "true") { p.sq = true; stringi(true); }
    if (eTile(m)) I.relayout(0.6);                                       /* Dot seduto sul riquadro scende con lui */
  }
  function su(p) {                                                       /* lasciato: la molla torna su, un filo oltre */
    var m = p.m;
    if (p.sq) { p.sq = false; stringi(false); }
    if (!m.classList.contains("is-premuto")) return;
    m.classList.remove("is-premuto"); m.classList.add("is-lascia");
    if (eTile(m)) I.relayout(0.6);
    clearTimeout(m.__moto); m.__moto = setTimeout(function () { m.classList.remove("is-lascia"); }, LASCIA);
  }
  function sfugge(p) {                                                   /* lo scorrimento ha preso il dito: torna subito, senza molla */
    var m = p.m;
    if (p.sq) { p.sq = false; stringi(false); }
    if (!m.classList.contains("is-premuto")) return;
    m.classList.remove("is-premuto", "is-lascia"); m.classList.add("is-sfugge");
    if (eTile(m)) I.relayout(0.3);
    clearTimeout(m.__moto); m.__moto = setTimeout(function () { m.classList.remove("is-sfugge"); }, SFUGGE + 20);
  }
  function accendi() { if (!P || P.on) return; P.on = true; giu(P); }
  function fine(annulla) {
    if (!P) return;
    var p = P; P = null; clearTimeout(p.t);
    if (annulla) { if (p.on) sfugge(p); return; }
    if (!p.on) { giu(p); setTimeout(function () { su(p); }, TOCCO); return; }   /* un tocco breve: la pressione intera, poi la molla */
    su(p);
  }
  doc.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || e.isPrimary === false) return;
    var h = e.target && e.target.closest ? e.target.closest(PREMIBILI) : null;
    if (!h || h.disabled || root.classList.contains("ni-on")) return;
    fine(true);
    P = { m: h.classList.contains("tile__hit") ? h.parentNode : h, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, t: 0, sq: false };
    if (e.pointerType === "mouse") accendi(); else P.t = setTimeout(accendi, FERMO);
  }, true);
  doc.addEventListener("pointermove", function (e) {
    if (!P || e.pointerId !== P.id) return;
    var dx = e.clientX - P.x, dy = e.clientY - P.y;
    if (dx * dx + dy * dy > SOGLIA * SOGLIA) fine(true);
  }, true);
  doc.addEventListener("pointerup", function (e) { if (P && e.pointerId === P.id) fine(false); }, true);
  doc.addEventListener("pointercancel", function (e) { if (P && e.pointerId === P.id) fine(true); }, true);
  doc.addEventListener("dragstart", function () { fine(true); }, true);
  /* lo scorrimento della pagina e di ciò che scorre dentro (i fogli aperti): in cattura, perché scroll non risale */
  doc.addEventListener("scroll", function () { if (P) fine(true); }, { capture: true, passive: true });
  /* andando su un'altra pagina e tornando (anche col gesto indietro di Safari) niente resta premuto */
  function sciogli() {
    fine(true);
    $$(".is-premuto, .is-sfugge, .is-lascia").forEach(function (n) { n.classList.remove("is-premuto", "is-sfugge", "is-lascia"); });
    if (PL.ts !== 1) { PL.ts = 1; PL.s = 1; PL.vs = 0; if (pill && PL.on) pillDraw(); }
  }

  /* ------------------------------------------------------------------ 5. il risveglio dopo l'intro */
  /* Solo se l'intro copre la pagina al caricamento (non con «meno movimento», ?shot=1, ?open=, un #, tornando indietro). I disegni dormono
     dal primo fotogramma (l'intro atterra su di loro così); a pagina libera (IMAD.whenFree: con il passaggio è T.landed dell'intro)
     ognuno si sveglia dopo 40 + 45·(riga + colonna) ms della griglia 3x3 dell'intro: le diagonali di una faccia del cubo. Chi si vede
     per almeno il 22% sopra il dock si sveglia subito; gli altri la prima volta che se ne vede il 35%, senza ritardo. I riquadri non si
     muovono: si svegliano i loro disegni. Il Corano e Nel mondo non si svegliano mai; Tools e Heatmap si accendono da soli quando si vedono. */
  var V = I.vivo || {};
  var me = tileOf("sudime"), sal = tileOf("saluti");
  function chiama(o, fn, d) { if (!o || !o[fn]) return 0; try { return o[fn](d) || 0; } catch (e) { if (window.console) console.error(e); return 0; } }
  var SVEGLIA = {
    citta: function (d) { if (chiama(V.globo, "wake", d) > 0) setTimeout(function () { M.cifre($("#mTime")); }, d + 140); },   /* l'ora della città sale mentre il globo arriva */
    progetti: function (d) { chiama(V.cubo, "wake", d); },
    imparando: function (d) { chiama(V.impara, "wake", d); },
    sudime: function (d) { if (me) setTimeout(function () { me.classList.remove("is-dorme"); }, d); },
    saluti: function (d) { if (sal) setTimeout(function () { sal.classList.remove("is-dorme"); }, d); }
  };
  var ORDINE = ["corano", "citta", "mondo", "sudime", "progetti", "imparando", "tools", "heatmap", "saluti"];
  if (root.classList.contains("ni-on") && !I.still()) {
    chiama(V.globo, "prime"); chiama(V.cubo, "prime"); chiama(V.impara, "prime");
    if (me) me.classList.add("is-dorme");
    if (sal) sal.classList.add("is-dorme");
    I.whenFree(sveglia);
  }
  /* la parte dello schermo che si vede davvero: sopra il dock */
  function fondo() { var b = window.innerHeight, r = dock ? dock.getBoundingClientRect() : null; if (r && r.height && r.top < b) b = r.top; return b; }
  function sveglia() {
    var ordine = Array.isArray(window.__niTiles) && window.__niTiles.length === 9 ? window.__niTiles : ORDINE;
    var b = fondo(), dopo = [];
    ordine.forEach(function (id, i) {
      var fn = SVEGLIA[id], t = tileOf(id); if (!fn || !t) return;
      var r = t.getBoundingClientRect(), h = Math.min(r.bottom, b) - Math.max(r.top, 0);
      var visto = h <= 0 ? 0 : h / Math.max(1, Math.min(r.height, b));
      if (visto >= 0.22) fn(40 + 45 * (Math.floor(i / 3) + i % 3));
      else dopo.push(t);
    });
    if (!dopo.length) return;
    if (!("IntersectionObserver" in window)) { dopo.forEach(function (t) { SVEGLIA[idOf(t)](0); }); return; }
    var dh = dock ? Math.round(dock.getBoundingClientRect().height + 12) : 0;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var rh = e.rootBounds ? e.rootBounds.height : window.innerHeight;
        if (e.intersectionRect.height / Math.max(1, Math.min(e.boundingClientRect.height, rh)) < 0.35) return;
        io.unobserve(e.target); SVEGLIA[idOf(e.target)](0);
      });
    }, { rootMargin: "0px 0px -" + dh + "px 0px", threshold: [0, 0.2, 0.35, 0.5, 0.75, 1] });
    dopo.forEach(function (t) { io.observe(t); });
  }

  /* ------------------------------------------------------------------ 7. aprire una pagina e tornare (transizioni tra documenti) */
  /* Dove il browser le sa fare (Chrome 126+, Safari 18.2+; @view-transition in moto.css, caricato anche dalle pagine): il riquadro
     toccato si chiama «riquadro» per un momento e imad.vt dice alla pagina quale era (la pagina dà lo stesso nome alla sua parte uguale:
     la foto di Su di me, il cubo di Progetti; Nel mondo non ne ha: il riquadro cresce e svanisce). Tornando, lo script nella testa di
     index.html (pagereveal arriva anche prima di questo file) rimette il nome allo stesso riquadro, se si vede, e moto.css lo posa al
     suo posto. Altrove (iOS 18.0) niente qui: la pagina sale da sola (moto.css, pg-entra). Il gesto indietro di Safari ha la sua
     animazione: il browser salta queste da solo. */
  var VT = ("onpagereveal" in window) && !I.still();
  function nomi() { tiles.forEach(function (t) { if (t.style.viewTransitionName) t.style.viewTransitionName = ""; }); }
  if (VT) {
    doc.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest("a.tile__hit") : null;
      if (!a || a.target || !a.href || a.origin !== location.origin) return;
      var t = a.parentNode; nomi(); t.style.viewTransitionName = "riquadro";
      try { sessionStorage.setItem("imad.vt", idOf(t)); } catch (er) { }
    });
  }
  window.addEventListener("pagehide", function () { sciogli(); });   /* il nome resta: serve alla pagina che arriva */
  /* di nuovo qui (anche dalla cache del tasto indietro, prima di pagereveal): niente premuto, nessun nome rimasto dal tocco, se non
     c'è una transizione in corso (window.__vtCorso, dalla testa) */
  window.addEventListener("pageshow", function () { sciogli(); if (!window.__vtCorso) nomi(); });
})();
