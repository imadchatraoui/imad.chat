/* imad.chat — la casa nuova (anteprima): il dock con i quattro filtri e Dot che vive sui riquadri.
   Viene dopo app.js (window.IMAD) e dopo gli script di Dot (../../gatto/: rig, aspetto Manifesto, scena, suoni, fx, cervello).
   Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, I = window.IMAD;
  if (!I) return;
  var Q = new URLSearchParams(location.search);
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  var grid = $("#grid"), dock = $("#dock"), pill = $(".dock__pill", dock), said = $("#filtroDetto");

  /* ------------------------------------------------------------------ i filtri: Tutto · Su di me · Progetti · Tools */
  /* il Corano non si muove e non si abbassa mai; le mappe dei posti stanno in casa.css (una per filtro e per schermo) */
  var GROUPS = { tutto: null, sudime: ["sudime", "imparando", "heatmap", "saluti"], progetti: ["progetti", "heatmap", "imparando"], tools: ["tools"] };
  var NAMES = { tutto: "Tutto", sudime: "Su di me", progetti: "Progetti", tools: "Tools" };
  var WORDS = ["", "un riquadro", "due riquadri", "tre riquadri", "quattro riquadri"];
  var cur = "tutto", anims = [], moving = 0;
  var tiles = $$(".grid > .tile");
  function idOf(t) { return t.getAttribute("data-tile"); }
  function inGroup(f, id) { var g = GROUPS[f]; return !g || g.indexOf(id) >= 0; }

  /* la pillola sotto il filtro scelto */
  function paintDock(still) {
    var b = $('.dock__b[data-filtro="' + cur + '"]', dock);
    $$(".dock__b", dock).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    if (!b || !pill) return;
    if (still) dock.classList.add("is-still");
    pill.style.width = b.offsetWidth + "px"; pill.style.transform = "translateX(" + b.offsetLeft + "px)";
    if (still) { void pill.offsetWidth; dock.classList.remove("is-still"); }
  }
  function marks() { tiles.forEach(function (t) { var id = idOf(t); t.classList.toggle("is-dim", id !== "corano" && !inGroup(cur, id)); }); }
  function stopAnims() { anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); anims = []; tiles.forEach(function (t) { t.style.zIndex = ""; }); grid.classList.remove("is-moving"); }
  /* la zona dello schermo che si vede davvero: sotto la barra di stato, sopra il dock */
  function visibleBand() {
    var top = 12, probe = $("#home"), bot = window.innerHeight - 12;
    try { top += parseFloat(getComputedStyle(probe).paddingTop) - parseFloat(getComputedStyle(root).getPropertyValue("--mensola")) || 0; } catch (e) { }
    var r = dock.getBoundingClientRect(); if (r.height) bot = Math.min(bot, r.top - 12);
    return { top: top, bottom: bot };
  }
  function announce(f) {
    if (!said) return;
    var g = GROUPS[f], txt = g ? NAMES[f] + ": " + WORDS[g.length] + " in evidenza, gli altri restano qui sotto." : "Tutti i riquadri, nel loro ordine.";
    said.textContent = ""; setTimeout(function () { said.textContent = txt; }, 60);
  }

  /* dove sta un riquadro nella mappa di adesso, sullo schermo, senza le traslazioni di un viaggio in corso */
  function layoutRect(t) {
    var g = grid.getBoundingClientRect(), top = g.top + t.offsetTop - grid.offsetTop, left = g.left + t.offsetLeft - grid.offsetLeft;
    return { top: top, left: left, width: t.offsetWidth, height: t.offsetHeight, bottom: top + t.offsetHeight };
  }
  /* aspetta che lo scorrimento sia finito: nessun evento di scorrimento per 80 ms (al più 450 ms) */
  function dopoScroll(fn) {
    var t0 = performance.now(), ultimo = t0, fatto = false, iv = 0;
    function su() { ultimo = performance.now(); }
    function fine() { if (fatto) return; fatto = true; clearInterval(iv); window.removeEventListener("scroll", su); fn(); }
    window.addEventListener("scroll", su, { passive: true });
    iv = setInterval(function () { var n = performance.now(); if (n - ultimo >= 80 || n - t0 >= 450) fine(); }, 20);
  }

  var turno = 0;
  function setFiltro(f, how) {
    how = how || {};
    if (!GROUPS.hasOwnProperty(f) || (f === cur && !how.force)) return;
    var still = how.instant || I.still(), my = ++turno;
    cur = f; paintDock(how.instant);
    if (!how.quiet) announce(f);
    /* il primo riquadro del gruppo deve entrare nello schermo, se non c'è già abbastanza: si prova la mappa nuova senza
       disegnarla (le misure dei riquadri non cambiano con il filtro, cambia solo il posto). Se serve scorrere, prima si scorre
       e poi i riquadri viaggiano: l'occhio li vede muoversi, invece della pagina che scorre sotto di loro. */
    var y = null;
    if (GROUPS[f] && !how.noScroll) {
      var was = grid.getAttribute("data-filtro"), lead = null;
      grid.setAttribute("data-filtro", f);
      tiles.forEach(function (t) {
        if (!inGroup(f, idOf(t))) return;
        var r = layoutRect(t);
        if (!lead || r.top < lead.top - 1 || (Math.abs(r.top - lead.top) <= 1 && r.left < lead.left)) lead = r;
      });
      grid.setAttribute("data-filtro", was);
      if (lead) {
        /* si scorre solo se la sua cima non si vede o se se ne vede troppo poco (meno di metà, o meno di 200 px) */
        var band = visibleBand(), seen = Math.min(lead.bottom, band.bottom) - Math.max(lead.top, band.top);
        if (lead.top < band.top || seen < Math.min(lead.height * 0.5, 200)) y = Math.max(0, window.pageYOffset + lead.top - band.top - 4);
        if (y !== null && Math.abs(y - window.pageYOffset) < 2) y = null;
      }
    }
    function viaggio() {
      if (my !== turno) return;                         /* nel frattempo è stato scelto un altro filtro */
      /* prima: dove si vedono adesso (anche a metà di un viaggio) */
      var first = tiles.map(function (t) { return t.getBoundingClientRect(); });
      stopAnims();
      grid.setAttribute("data-filtro", f); marks();
      /* dopo: i posti nuovi */
      var last = tiles.map(function (t) { return t.getBoundingClientRect(); });
      var longest = 0;
      if (!still) {
        /* il viaggio, come le mosse di un cubo: prima lungo la riga, poi lungo la colonna; si parte riga per riga, dall'alto */
        var rows = last.map(function (r) { return Math.round(r.top); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
        tiles.forEach(function (t, i) {
          var dx = first[i].left - last[i].left, dy = first[i].top - last[i].top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
          var dist = Math.abs(dx) + Math.abs(dy), dur = Math.round(I.clamp(440 + dist * 0.16, 500, 780)), delay = rows.indexOf(Math.round(last[i].top)) * 26;
          var kf;
          if (Math.abs(dx) >= 1 && Math.abs(dy) >= 1) {
            var k = I.clamp(Math.abs(dx) / dist, 0.28, 0.6);
            kf = [{ transform: "translate(" + dx + "px," + dy + "px)", easing: I.ease.inOut }, { transform: "translate(0px," + dy + "px)", offset: k, easing: I.ease.spring }, { transform: "translate(0px,0px)" }];
          } else kf = [{ transform: "translate(" + dx + "px," + dy + "px)", easing: I.ease.spring }, { transform: "translate(0px,0px)" }];
          t.style.zIndex = inGroup(f, idOf(t)) || idOf(t) === "corano" ? "3" : "2";
          anims.push(t.animate(kf, { duration: dur, delay: delay, easing: "linear", fill: "backwards" }));
          longest = Math.max(longest, dur + delay);
        });
        if (anims.length) {
          grid.classList.add("is-moving"); var mv = ++moving;
          setTimeout(function () { if (mv === moving) { tiles.forEach(function (t) { t.style.zIndex = ""; }); grid.classList.remove("is-moving"); anims = []; I.relayout(0); } }, longest + 40);
        }
      }
      I.relayout(longest ? longest / 1000 + 0.15 : 0);     /* Dot resta sul suo riquadro mentre viaggia; se finisce sotto il Corano se ne va */
    }
    if (y === null) { viaggio(); return; }
    if (still) { window.scrollTo(0, y); viaggio(); return; }
    window.scrollTo({ top: y, behavior: "smooth" });
    dopoScroll(viaggio);
  }
  dock.addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest(".dock__b") : null; if (b) setFiltro(b.getAttribute("data-filtro")); });
  /* frecce sinistra e destra tra i filtri, come una fila di pulsanti */
  dock.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var bs = $$(".dock__b", dock), i = bs.indexOf(doc.activeElement); if (i < 0) return;
    var n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; n.focus(); e.preventDefault();
  });
  /* girando il telefono le mappe cambiano da sole (CSS): i viaggi in corso si fermano, la pillola e Dot si rimettono a posto */
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { stopAnims(); paintDock(true); I.relayout(0); }, 140); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { paintDock(true); });
  paintDock(true);
  var start = Q.get("filtro"); if (start && GROUPS.hasOwnProperty(start) && start !== "tutto") setFiltro(start, { instant: true, quiet: true, noScroll: true });

  /* ------------------------------------------------------------------ l'intro: «Ciao» e il dock arrivano con i riquadri */
  /* finché l'intro copre la pagina, la pagina sotto non si raggiunge da tastiera (né con un lettore di schermo): un filtro o
     una pagina aperta adesso sposterebbero i riquadri su cui i nove quadrati stanno volando */
  function chiusa(on) { [$("#home"), dock].forEach(function (n) { if (!n) return; if (on) { n.setAttribute("inert", ""); n.setAttribute("aria-hidden", "true"); } else { n.removeAttribute("inert"); n.removeAttribute("aria-hidden"); } }); }
  if (root.classList.contains("ni-on")) { chiusa(true); I.whenFree(function () { chiusa(false); }); }
  /* l'intro accende l'hero scrivendogli l'opacità: appena comincia, «Ciao» e il dock entrano (casa.css, .ni-ciao), un passo dopo */
  var hero = $("#hero");
  if (hero && root.classList.contains("ni-on") && "MutationObserver" in window) {
    var hm = new MutationObserver(function () {
      if (!root.classList.contains("ni-on")) { hm.disconnect(); if (root.classList.contains("ni-ciao")) root.classList.remove("ni-ciao"); return; }
      if (!root.classList.contains("ni-ciao") && parseFloat(hero.style.opacity) > 0.02) root.classList.add("ni-ciao");
    });
    hm.observe(hero, { attributes: true, attributeFilter: ["style"] });
    hm.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  /* ------------------------------------------------------------------ Dot: arriva quando l'intro ha finito */
  /* Il suo strato (#dotclip) sta sopra i riquadri e sotto ogni pagina aperta; app.js lo ferma (DOT.pause) mentre una pagina è aperta.
     La prima volta in una sessione del browser c'è l'apertura (i nove tasti, la scatola, «salam, sono Dot.»); dopo, Dot è già in giro. */
  var clip = $("#dotclip"), mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  function bottomInset() { var r = dock.getBoundingClientRect(); return r.height ? Math.max(0, window.innerHeight - r.top) + 12 : 0; }
  function startDot() {
    var DOT = window.DOT;
    if (!DOT || !DOT.start || !DOT.looks || !clip || Q.get("dot") === "no") return;
    if (clip.getAttribute("data-media")) DOT.mediaBase = clip.getAttribute("data-media");
    var look = Q.get("look"); if (!look || !DOT.looks[look]) look = DOT.looks.manifesto ? "manifesto" : Object.keys(DOT.looks)[0];
    var first = true; try { first = sessionStorage.getItem("imad.dot.aperto") !== "1"; sessionStorage.setItem("imad.dot.aperto", "1"); } catch (e) { }
    if (I.shot || Q.get("primo") === "0") first = false;
    if (Q.get("primo") === "1") first = true;
    if (Q.get("seme") && DOT.debug && DOT.debug.seed) DOT.debug.seed(+Q.get("seme"));
    try {
      DOT.start({ tiles: ".testa > .tile, .grid > .tile", home: $("#hero"), parent: clip, look: look, firstVisit: first, dark: I.isDark(), bottomInset: bottomInset });
    } catch (e) { if (window.console) console.error(e); return; }
    if (DOT.sound && DOT.sound.setMuted) { DOT.sound.setMuted(!I.sound.on()); I.sound.listen(function (on) { DOT.sound.setMuted(!on); }); }
    var dark = function () { if (DOT.setDark) DOT.setDark(I.isDark()); };
    if (mqDark.addEventListener) mqDark.addEventListener("change", dark); else if (mqDark.addListener) mqDark.addListener(dark);
    window.__dot = true;
  }
  I.whenFree(startDot);
})();
