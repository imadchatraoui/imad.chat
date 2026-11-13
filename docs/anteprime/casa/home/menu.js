/* imad.chat — il menu dal logo 3x3 (CASA.md 2f D; lo stile in menu.css).
   Il logo in alto a sinistra è una faccia del cubo: otto quadratini e il punto d'oro al centro. Toccato, i nove quadratini volano fuori
   e crescono nei nove tasti di una griglia 3x3, nello stesso ordine: otto posti della casa (gli stessi dei riquadri) e il punto, che
   chiude. Il nono posto, «Lascia un saluto», è un gesto e non un posto: è la capsula d'oro sotto la griglia, accanto alla pillola
   «La scatola dei tasti».

   Il movimento, su un solo orologio:
     apertura  il logo si preme (moto.js, .9); al rilascio ogni tasto parte dal suo quadratino (FLIP: il quadratino è il tasto a scala
               0,07, il raggio 26 diventa da solo quello di 2 px del logo) a 40 + 45·(riga + colonna) ms, la diagonale della scia dei
               riquadri; vola 520 ms su una molla (la traslazione con lo smorzamento di --molla-piana, la scala un filo oltre, 1,5%);
               nome e disegno salgono di 6 px dal 55% del volo; il punto parte per ultimo e si posa con un 1,04; le pillole salgono
               di 12 px a 420 ms. Le ombre restano ferme: si muovono solo transform e opacity.
     chiusura  (il punto, Esc, un tocco sul velo, il gesto indietro) i tasti si gonfiano a 1,02 per 60 ms, poi tornano ognuno nel suo
               quadratino in 360 ms (ease-in) e 40 ms di posa, in diagonale al contrario, il punto per ultimo; il quadratino li riceve
               con un piccolo sobbalzo. Il velo se ne va in 220 ms. Il fuoco torna al logo.
     scelta    Corano, Le città, Heatmap, Sto imparando: il tasto diventa lui la sezione (SEZIONI.open con il suo rettangolo); gli
               altri si ripiegano nel logo e il menu se ne va da sotto la sezione. Nel mondo, Su di me, Progetti, Tools: il tasto si
               preme (.95) e la pagina si apre (al posto della voce del menu nella cronologia: «indietro» torna alla casa).
   Mai: scorrere la pagina, toccare o ridisegnare i riquadri, la classe dell'intro is-locked (qui html.is-menu, e lo scorrimento si
   ferma senza overflow: la casa sotto non si sposta di un pixel). Non si apre mentre l'intro copre la pagina, con un foglio o una
   sezione aperti. Dot sta fermo sotto (DOT.pause / DOT.resume).
   Un menu vero: il fuoco entra sul primo tasto e resta dentro; le frecce si muovono nella griglia (e scendono alle pillole), Home e
   Fine, Invio e Spazio scelgono, Esc chiude. Con «meno movimento» (e ?shot=1) appare e sparisce, senza voli.

   window.MENU = { open(), close({ instant }), isOpen(), on(fn), off(fn) }; fn({ type: "open" | "close" | "choose", id }).
   Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var W = window, doc = document, root = doc.documentElement;
  var logo = doc.getElementById("logo"), l9 = logo ? logo.querySelector(".l9") : null;
  if (!logo || !l9 || !doc.body || !doc.querySelector) return;
  var I = W.IMAD || {};
  var ANIM = !!Element.prototype.animate;
  var mqReduce = W.matchMedia ? W.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function still() { return !ANIM || (I.still ? I.still() : (!!(mqReduce && mqReduce.matches) || root.classList.contains("is-shot"))); }
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function tileOf(id) { return $('.grid > .tile[data-tile="' + id + '"]'); }

  /* ---------------------------------------------------------------- le molle (campionate qui: valgono in ogni browser con WAAPI) */
  /* x(t) di una molla smorzata da 0 a 1, t da 0 a 1 (lo stesso orologio di sezioni.js: ω = 6,4 / ζ, ferma a t = 1) */
  function molla(z, n) {
    var w = 6.4 / z, wd = w * Math.sqrt(1 - z * z), out = [];
    for (var i = 0; i <= n; i++) { var t = i / n; out.push(i === n ? 1 : 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))); }
    return out;
  }
  var N = 30;
  var M_POS = molla(0.84, N);          /* il viaggio: lo smorzamento di --molla-piana (un rimbalzo dello 0,8%, non si vede) */
  var M_SC = molla(0.8, N);            /* la scala: 1,5% oltre */
  var M_POP = molla(0.7, N);           /* il punto: si posa con un 1,04 */
  var EO = "cubic-bezier(.22, 1, .36, 1)", EIN = "cubic-bezier(.5, 0, .75, 0)";
  var FLY = 520, STEP = 45, FIRST = 40;

  /* ---------------------------------------------------------------- i posti */
  var KUK = ["#ffb6c1", "#fdfd96", "#ffb347", "#77dd77", "#aec6cf", "#ff6961"];   /* Kukko, solo sul cubo (qui il disegno è il cubo) */
  function svg(inner, cls) { return '<svg viewBox="0 0 40 40"' + (cls ? ' class="' + cls + '"' : "") + ' aria-hidden="true" focusable="false">' + inner + "</svg>"; }
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }
  var GLYPH = {
    /* una pagina: le righe finiscono tutte a destra (come si scrive l'arabo), di lunghezze diverse; mai tre righe uguali (l'icona di un menu) */
    corano: svg('<rect x="9.5" y="6.5" width="21" height="27" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M15 13.5h10.5"/><path d="M18.5 18h7"/><path d="M14 22.5h11.5"/><path d="M20.5 27h5"/></g>'),
    /* un disco a puntini (il globo) con due città d'oro */
    citta: svg((function () {
      var s = '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1"/>', i, j;
      for (i = -3; i <= 3; i++) for (j = -3; j <= 3; j++) {
        var x = 20 + i * 4.1, y = 20 + j * 4.1, d = (x - 20) * (x - 20) + (y - 20) * (y - 20);
        if (d < 150) s += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + (d < 60 ? 1.05 : 0.85) + '" fill="currentColor" opacity="' + (d < 60 ? 0.7 : 0.45) + '"/>';
      }
      return s + '<circle class="menu__gold" cx="24.1" cy="15.9" r="2.1"/><circle class="menu__gold" cx="13.9" cy="20" r="1.8"/>';
    })()),
    mondo: "",
    sudime: "",
    /* una faccia del cubo, mescolata: gli adesivi Kukko sulla plastica bianca */
    progetti: svg((function () {
      var s = '<rect x="6" y="6" width="28" height="28" rx="6.5" fill="#f6f6f8"/>', c = [0, 3, 2, 4, 1, 5, 2, 0, 3], i;
      for (i = 0; i < 9; i++) s += '<rect x="' + f1(8 + (i % 3) * 8.2) + '" y="' + f1(8 + ((i / 3) | 0) * 8.2) + '" width="7.6" height="7.6" rx="2.2" fill="' + KUK[c[i]] + '"/>';
      return s;
    })()),
    /* un cubo a fil di ferro: gli spigoli davanti pieni, quelli dietro più deboli */
    imparando: svg('<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M20 6.5l12 6.9v13.9L20 34.2 8 27.3V13.4z"/><path d="M8 13.4l12 6.9 12-6.9M20 20.3v13.9"/>' +
      '<path d="M20 6.5v13.8M8 27.3l12-7M32 27.3l-12-7" opacity=".35"/></g>'),
    /* l'angolo di un codice QR: un occhio e qualche modulo */
    tools: svg((function () {
      var s = '<rect x="7" y="7" width="13" height="13" rx="3.4" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="11" y="11" width="5" height="5" rx="1.3" fill="currentColor"/>';
      [[24, 7], [29, 7], [24, 12], [33, 16], [7, 24], [12, 29], [7, 33], [24, 24], [29, 24], [24, 29], [33, 33], [29, 33], [16, 24], [33, 24]].forEach(function (q) {
        s += '<rect x="' + q[0] + '" y="' + q[1] + '" width="3.6" height="3.6" rx="1" fill="currentColor"/>';
      });
      return s;
    })()),
    heatmap: ""   /* lo disegna heatCells(): i dati veri, o le caselle vuote */
  };
  var PLACES = [
    { id: "corano", name: "Corano", mat: "paper", sez: true },
    { id: "citta", name: "Le città", mat: "night", sez: true },
    { id: "mondo", name: "Nel mondo", mat: "glass" },
    { id: "sudime", name: "Su di me", mat: "photo" },
    null,
    { id: "progetti", name: "Progetti", mat: "glass" },
    { id: "imparando", name: "Sto imparando", mat: "glass", sez: true },
    { id: "tools", name: "Tools", mat: "glass" },
    { id: "heatmap", name: "Heatmap", mat: "glass", sez: true }
  ];
  /* gli indirizzi delle pagine stanno nel markup (il <template id="menuVie"> di index.html: la build li rende assoluti), mai qui */
  var VIE = {};
  (function () {
    var t = doc.getElementById("menuVie"), box = t ? (t.content || t) : null;
    if (box) $$("a[data-va]", box).forEach(function (a) { VIE[a.getAttribute("data-va")] = a.getAttribute("href"); });
    ["mondo", "sudime", "progetti"].forEach(function (id) {
      if (VIE[id]) return; var tl = tileOf(id), a = tl ? $("a.tile__hit", tl) : null; if (a && !a.target) VIE[id] = a.getAttribute("href");
    });
  })();

  /* ---------------------------------------------------------------- il disegno */
  var M = doc.createElement("div");
  M.className = "menu"; M.id = "menu"; M.hidden = true;
  M.setAttribute("role", "dialog"); M.setAttribute("aria-modal", "true"); M.setAttribute("aria-label", "Menu");
  M.setAttribute("data-dot-keep", "");
  var photo = (function () { var im = $(".tile.me .win__img"); return im ? (im.getAttribute("src") || "") : ""; })();
  var html = '<div class="menu__velo"></div><ul class="menu__g">';
  PLACES.forEach(function (p, i) {
    if (!p) { html += '<li class="menu__c menu__c--dot"><button class="menu__k menu__k--dot" type="button" data-i="4" aria-label="Chiudi il menu"><i class="menu__dot" aria-hidden="true"></i></button></li>'; return; }
    var href = p.sez ? null : VIE[p.id], open = href ? 'a href="' + href.replace(/"/g, "&quot;") + '"' : 'button type="button"', end = href ? "a" : "button";
    if (!p.sez && !href) return;   /* una pagina senza indirizzo: niente tasto (non dovrebbe succedere) */
    html += '<li class="menu__c"><' + open + ' class="menu__k" data-i="' + i + '" data-va="' + p.id + '" data-mat="' + p.mat + '">' +
      (p.mat === "photo" && photo ? '<img class="menu__ph" src="' + photo.replace(/"/g, "&quot;") + '" alt="" decoding="async"><i class="menu__scr" aria-hidden="true"></i>' : "") +
      '<span class="menu__in" aria-hidden="true">' + (GLYPH[p.id] || p.id === "heatmap" ? '<span class="menu__gl">' + GLYPH[p.id] + "</span>" : "") + '<span class="menu__n">' + p.name + "</span></span>" +
      '<span class="sr">' + p.name + "</span></" + end + "></li>";
  });
  html += '</ul><p class="menu__piede">' +
    '<button class="pill pill--clay menu__pill menu__saluto" type="button"><i class="stardot" aria-hidden="true"></i>Lascia un saluto</button>' +
    (VIE.scatola ? '<a class="pill menu__pill menu__pill--vetro menu__scatola" href="' + VIE.scatola.replace(/"/g, "&quot;") + '">La scatola dei tasti</a>' : "") +
    "</p>";
  M.innerHTML = html;
  doc.body.appendChild(M);
  var velo = $(".menu__velo", M), gridM = $(".menu__g", M), piede = $(".menu__piede", M);
  var keys = $$(".menu__k", M);
  keys.sort(function (a, b) { return +a.getAttribute("data-i") - +b.getAttribute("data-i"); });
  /* le celle non si muovono mai: il loro rettangolo è quello del tasto fermo, anche mentre il tasto vola */
  var cells = keys.map(function (k) { return k.parentNode; });
  var squares = Array.prototype.slice.call(l9.children);
  var pills = $$(".menu__pill", M);
  function keyIndex(k) { return +k.getAttribute("data-i"); }
  function diag(i) { return (i % 3) + ((i / 3) | 0); }     /* 0..4: la diagonale dal logo */

  logo.setAttribute("aria-label", "Menu"); logo.setAttribute("aria-haspopup", "dialog"); logo.setAttribute("aria-expanded", "false"); logo.setAttribute("aria-controls", "menu");

  /* la heatmap del tasto: le ultime quattro settimane della risposta vera (lunedì per primo, la più vecchia in alto), nelle cinque tinte
     d'oro del riquadro; senza risposta le caselle restano vuote (mai un disegno inventato) */
  var heatKey = $('.menu__k[data-va="heatmap"] .menu__gl', M), heat = null;
  function heatCells(map, last) {
    var s = "", r, c, x0 = 3.5, y0 = 10, cs = 4.05, g = 0.9;
    var end = last, dow = end ? (end.getUTCDay() + 6) % 7 : 6, start = end ? end.getTime() - (21 + dow) * 864e5 : 0;
    for (r = 0; r < 4; r++) for (c = 0; c < 7; c++) {
      var lv = 0, cls = "l0";
      if (end) { var ms = start + (r * 7 + c) * 864e5, k = new Date(ms).toISOString().slice(0, 10); if (ms > end.getTime()) cls = "l0 dopo"; else { lv = map[k] || 0; cls = "l" + lv; } }
      s += '<rect class="' + cls + '" x="' + f1(x0 + c * (cs + g)) + '" y="' + f1(y0 + r * (cs + g)) + '" width="' + cs + '" height="' + cs + '" rx="1.1"/>';
    }
    return svg(s, "menu__hm");
  }
  if (heatKey) heatKey.innerHTML = heatCells({}, null);
  if (I.api && heatKey) {
    I.api("contributi").then(function (j) {
      if (!j || !j.ok || !j.days || !j.days.length) return;
      var map = {}, last = null;
      j.days.forEach(function (d) {
        if (!d || typeof d.d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.d)) return;
        var lv = +d.l; map[d.d] = lv >= 0 && lv <= 4 ? lv | 0 : 0;
        var t = Date.UTC(+d.d.slice(0, 4), +d.d.slice(5, 7) - 1, +d.d.slice(8, 10)); if (!last || t > last.getTime()) last = new Date(t);
      });
      if (last) { heat = { map: map, last: last }; heatKey.innerHTML = heatCells(map, last); }
    }, function () { });
  }
  /* le tinte della heatmap vengono dal riquadro (vivi.css, --hm-0..4): si rileggono a ogni apertura, così seguono il tema */
  function heatTints() {
    var t = tileOf("heatmap"), k = $('.menu__k[data-va="heatmap"]', M); if (!t || !k || !W.getComputedStyle) return;
    var cs = getComputedStyle(t);
    for (var i = 0; i < 5; i++) { var v = cs.getPropertyValue("--hm-" + i).trim(); if (v) k.style.setProperty("--hm-" + i, v); }
  }

  /* ---------------------------------------------------------------- lo stato */
  var state = "closed";            /* closed | opening | open | closing | handoff | leaving */
  var anims = [], timers = [], pushed = false, skipPop = 0, kbdOpen = false, dotPaused = false, subs = [];
  function emit(type, id) { subs.slice().forEach(function (f) { try { f({ type: type, id: id }); } catch (e) { if (W.console) console.error(e); } }); }
  function A(el, kf, o) { var a = null; try { a = el.animate(kf, o); anims.push(a); if (hold) a.pause(); } catch (e) { } return a; }
  /* i passi della coreografia (ms dall'inizio): con gli strumenti di prova (_prova.seek) aspettano l'orologio fermo, non il tempo vero */
  var hold = false, seekAt = 0;
  function run(j) { if (j.done) return; j.done = true; var i = timers.indexOf(j); if (i >= 0) timers.splice(i, 1); j.fn(); }
  function later(fn, ms) { var j = { fn: fn, at: ms, id: 0, done: false }; timers.push(j); if (!hold) j.id = setTimeout(function () { run(j); }, ms); return j; }
  function stopAll() {
    anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); anims = [];
    timers.forEach(function (j) { clearTimeout(j.id); j.done = true; }); timers = [];
  }
  function sectionOpen() { var S = W.SEZIONI; try { return !!(S && S.isOpen && S.isOpen()); } catch (e) { return false; } }
  function canOpen() {
    var sh = doc.getElementById("sheet");
    return state === "closed" && !skipPop && !root.classList.contains("ni-on") && !root.classList.contains("is-sheet") && !root.classList.contains("is-sz") &&
      !sectionOpen() && !(sh && !sh.hidden);
  }
  var behind = function () { return [doc.getElementById("home"), doc.getElementById("dock"), doc.getElementById("dotclip"), doc.getElementById("dotfixe")].filter(Boolean); };
  function inert(on) {
    behind().forEach(function (n) { if (on) n.setAttribute("inert", ""); else if (!sectionOpen() && !root.classList.contains("is-sheet")) n.removeAttribute("inert"); });
  }
  function dot(fn) { var D = W.DOT; if (D && D[fn]) { try { D[fn](); } catch (e) { } } }
  /* il logo: i suoi quadratini sono fuori finché il menu è aperto */
  function squaresOut(on) { squares.forEach(function (s) { s.style.opacity = on ? "0" : ""; }); }

  /* ---------------------------------------------------------------- aprire */
  function rectOf(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  function flipFrames(s, r, pop) {
    var k = s.w / r.w, dx = s.x - r.x, dy = s.y - r.y, out = [], sc = pop ? M_POP : M_SC;
    for (var i = 0; i <= N; i++) {
      var p = M_POS[i], q = sc[i], kk = k + (1 - k) * q;
      out.push({ offset: i / N, transform: "translate(" + (dx * (1 - p)).toFixed(2) + "px," + (dy * (1 - p)).toFixed(2) + "px) scale(" + kk.toFixed(4) + ")", opacity: Math.min(1, i / (N * 0.16)) });
    }
    return out;
  }
  function open(ev) {
    if (!canOpen()) return false;
    state = "opening"; stopAll();
    kbdOpen = !!(ev && ev.detail === 0);
    heatTints();
    M.hidden = false; M.classList.remove("is-sotto", "is-via");
    root.classList.add("is-menu"); logo.setAttribute("aria-expanded", "true");
    inert(true); dot("pause"); dotPaused = true;
    try { history.pushState({ imadMenu: 1 }, ""); pushed = true; } catch (e) { pushed = false; }
    emit("open");
    try { keys[0].focus({ preventScroll: true }); } catch (e) { }
    if (still()) { squaresOut(true); state = "open"; return true; }

    var R = cells.map(rectOf), S = squares.map(rectOf), longest = 0;
    A(velo, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out", fill: "backwards" });
    if (kbdOpen) A(l9, [{ transform: "scale(.9)" }, { transform: "none" }], { duration: 360, easing: "cubic-bezier(.34, 1.36, .64, 1)" });
    keys.forEach(function (k, n) {
      var i = keyIndex(k), isDot = i === 4, d = isDot ? FIRST + STEP * 4 + 20 : FIRST + STEP * diag(i);
      A(k, flipFrames(S[i], R[n], isDot), { duration: FLY, delay: d, easing: "linear", fill: "backwards" });
      var inn = $(".menu__in", k) || $(".menu__dot", k);
      if (inn) A(inn, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: d + Math.round(FLY * 0.55), easing: EO, fill: "backwards" });
      /* il quadratino del logo se ne va con il suo tasto */
      A(squares[i], [{ opacity: getComputedStyle(squares[i]).opacity }, { opacity: 0 }], { duration: 90, delay: d, easing: "ease-out", fill: "forwards" });
      longest = Math.max(longest, d + FLY);
    });
    A(piede, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 420, easing: EO, fill: "backwards" });
    later(function () { if (state === "opening") { squaresOut(true); state = "open"; } }, longest);
    return true;
  }

  /* ---------------------------------------------------------------- chiudere */
  /* o: { instant, fromPop, quick (le pieghe veloci di una consegna), then(), keepHistory } */
  function close(o) {
    o = o || {};
    if (state === "closed" || state === "handoff" || state === "leaving") return false;
    if (state === "closing" && !o.instant) return false;
    /* chiuso mentre i tasti volano ancora: si ripiegano da dove sono, senza scatti */
    var now = keys.map(function (k) { var cs = getComputedStyle(k); return { t: cs.transform && cs.transform !== "none" ? cs.transform : "none", o: +cs.opacity }; });
    stopAll(); state = "closing";
    logo.setAttribute("aria-expanded", "false");
    if (pushed && !o.fromPop && !o.keepHistory) { pushed = false; skipPop++; try { history.back(); } catch (e) { skipPop--; } }
    else if (o.fromPop) pushed = false;
    M.classList.add("is-via");
    var finish = function () {
      stopAll();
      M.hidden = true; M.classList.remove("is-via", "is-sotto");
      keys.forEach(function (k) { k.classList.remove("is-giu", "is-scelto"); k.style.visibility = ""; k.style.translate = ""; });
      squaresOut(false); state = "closed"; emit("close");
      if (o.then) { try { o.then(); } catch (e) { if (W.console) console.error(e); } }
    };
    /* la casa torna viva appena il velo se n'è andato; i tasti finiscono di ripiegarsi sopra di lei */
    var free = function () {
      root.classList.remove("is-menu"); inert(false);
      if (dotPaused) { dotPaused = false; dot("resume"); }
      if (!o.then) { try { logo.focus({ preventScroll: true }); } catch (e) { } }
      kbdOpen = false;
    };
    if (o.instant || still()) { free(); finish(); return true; }

    var R = cells.map(rectOf), S = squares.map(rectOf), longest = 0;
    var quick = !!o.quick, pre = quick ? 0 : 60, fold = quick ? 240 : 360, settle = 40, step = quick ? 14 : 26;
    keys.forEach(function (k, n) {
      var i = keyIndex(k), isDot = i === 4, d = isDot ? step * 5 : step * (4 - diag(i));
      if (k.style.visibility === "hidden") return;
      var s = S[i], r = R[n], kk = s.w / r.w, dx = s.x - r.x, dy = s.y - r.y, tot = pre + fold + settle;
      var to = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px) scale(" + kk.toFixed(4) + ")";
      var kf = [{ offset: 0, transform: now[n].t, opacity: now[n].o, easing: "ease-out" }];
      if (pre) kf.push({ offset: pre / tot, transform: "scale(1.02)", opacity: 1, easing: EIN });
      else kf[0].easing = EIN;
      kf.push({ offset: (pre + fold) / tot, transform: to, opacity: 1, easing: "linear" }, { offset: 1, transform: to, opacity: 0 });
      A(k, kf, { duration: tot, delay: d, fill: "forwards" });
      var inn = $(".menu__in", k) || $(".menu__dot", k);
      if (inn) A(inn, [{ opacity: 1 }, { opacity: 0 }], { duration: 110, delay: d + pre, easing: "ease-out", fill: "forwards" });
      /* il quadratino lo riceve: riappare e si posa con un filo di sobbalzo */
      A(squares[i], [{ opacity: 0, transform: (i === 4 ? "scale(.8) " : "") + "scale(1.22)" }, { opacity: 1, transform: i === 4 ? "scale(.8)" : "none" }],
        { duration: 220, delay: d + pre + fold, easing: "cubic-bezier(.34, 1.36, .64, 1)", fill: "backwards" });
      later(function () { squares[i].style.opacity = ""; }, d + pre + fold);
      longest = Math.max(longest, d + tot);
    });
    A(piede, [{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: 160, easing: "ease-in", fill: "forwards" });
    var vd = quick ? 0 : pre, vdur = 220;
    A(velo, [{ opacity: 1 }, { opacity: 0 }], { duration: vdur, delay: vd, easing: "ease-out", fill: "forwards" });
    later(free, vd + vdur);
    later(finish, Math.max(longest, vd + vdur) + 20);
    return true;
  }

  /* ---------------------------------------------------------------- scegliere */
  function choose(k, kbd) {
    var id = k.getAttribute("data-va");
    if (!id || (state !== "open" && state !== "opening")) return;
    emit("choose", id);
    var p = null; PLACES.forEach(function (q) { if (q && q.id === id) p = q; });
    if (p && p.sez) { section(k, id, kbd); return; }
    var href = VIE[id]; if (!href) return;
    /* una pagina: il tasto si preme, poi la pagina si apre al posto della voce del menu nella cronologia */
    state = "leaving"; stopAll(); squaresOut(true);
    k.classList.remove("is-giu"); k.classList.add("is-scelto");
    leave(k.href || href);
  }
  /* via verso una pagina: dopo la pressione; se la pagina non arriva (la navigazione fermata), dopo 8 s il menu si chiude da sé */
  function leave(url) {
    setTimeout(function () { try { if (pushed) location.replace(url); else location.href = url; } catch (e) { location.href = url; } }, still() ? 0 : 130);
    later(function () { if (state === "leaving") { state = "open"; close({ instant: true }); } }, 8000);
  }
  function section(k, id, kbd) {
    var S = W.SEZIONI;
    if (!S || !S.open) { fallback(id); return; }
    var r = k.getBoundingClientRect(), ok = false;
    /* il raggio vero del tasto adesso (se si sceglie durante il volo il tasto è ancora più piccolo) */
    var rad = 26 * (r.width / (k.offsetWidth || r.width));
    try { ok = S.open(id, { from: r, fromEl: k, radius: rad, kbd: !!kbd, replace: pushed }) === true; } catch (e) { if (W.console) console.error(e); ok = false; }
    if (!ok) return;                      /* la sezione non può adesso: il menu resta com'è */
    handoff(k);
  }
  /* il menu scende sotto la sezione che si apre: gli altri tasti si ripiegano nel logo, il velo se ne va, poi niente (inerte, nascosto) */
  function handoff(k) {
    pushed = false;                       /* la voce della cronologia ora è della sezione (replace) */
    stopAll(); state = "handoff";
    logo.setAttribute("aria-expanded", "false");
    M.classList.add("is-sotto");
    k.style.visibility = "hidden";
    var gone = function () {
      stopAll();
      M.setAttribute("inert", ""); M.hidden = true; M.removeAttribute("inert"); M.classList.remove("is-sotto", "is-via");
      keys.forEach(function (q) { q.classList.remove("is-giu", "is-scelto"); q.style.visibility = ""; q.style.translate = ""; });
      squaresOut(false); root.classList.remove("is-menu");
      /* l'inerte e la pausa di Dot ora sono della sezione: li toglierà lei chiudendosi */
      dotPaused = false; kbdOpen = false; state = "closed"; emit("close");
    };
    if (still()) { gone(); return; }
    var R = cells.map(rectOf), S = squares.map(rectOf), longest = 0;
    keys.forEach(function (q, n) {
      if (q === k) return;
      var i = keyIndex(q), d = 14 * (4 - diag(i)), s = S[i], r = R[n], kk = s.w / r.w;
      var to = "translate(" + (s.x - r.x).toFixed(2) + "px," + (s.y - r.y).toFixed(2) + "px) scale(" + kk.toFixed(4) + ")";
      A(q, [{ transform: "none", opacity: 1, easing: EIN }, { offset: 0.86, transform: to, opacity: 1 }, { transform: to, opacity: 0 }], { duration: 280, delay: d, fill: "forwards" });
      longest = Math.max(longest, d + 280);
    });
    A(piede, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in", fill: "forwards" });
    A(velo, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: "ease-out", fill: "forwards" });
    /* al 40% dell'apertura della sezione (640 ms) il menu non c'è più: inerte subito, nascosto quando le pieghe sono finite */
    later(function () { M.setAttribute("inert", ""); }, 256);
    later(function () { M.removeAttribute("inert"); gone(); }, Math.max(256, longest + 10));
  }
  /* senza sezioni.js: si chiude il menu, poi il riquadro fa da sé (il suo foglio, la sua pagina) */
  function fallback(id) {
    close({ quick: true, then: function () {
      var t = tileOf(id); if (!t) return;
      var h = $("[data-open]", t) || $(".hm__apri", t) || $("a.tile__hit", t); if (h) h.click();
    } });
  }

  /* ---------------------------------------------------------------- i comandi */
  /* il logo apre il menu (in cattura, prima di app.js che lo farebbe tornare in cima); il suo href="#" resta per chi non ha questo script */
  doc.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("#logo") : null; if (!t) return;
    if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); e.stopPropagation();
    if (state === "closed") open(e);
  }, true);
  logo.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); if (state === "closed") open({ detail: 0 }); } });

  /* la pressione dei tasti (moto.js preme le pillole da sé): giù subito, su con la molla */
  var pressed = null;
  function unpress() { if (pressed) { pressed.classList.remove("is-giu"); pressed = null; } }
  M.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || (state !== "open" && state !== "opening")) return;
    var k = e.target.closest ? e.target.closest(".menu__k") : null; if (!k) return;
    unpress(); pressed = k; k.classList.add("is-giu");
  });
  ["pointerup", "pointercancel"].forEach(function (n) { M.addEventListener(n, unpress); });
  M.addEventListener("pointerout", function (e) { if (pressed && e.target === pressed && !(e.relatedTarget && pressed.contains(e.relatedTarget))) unpress(); });

  M.addEventListener("click", function (e) {
    if (state !== "open" && state !== "opening") { e.preventDefault(); return; }
    var t = e.target, k = t.closest ? t.closest(".menu__k") : null, kbd = e.detail === 0;
    if (t.closest && t.closest(".menu__saluto")) {
      e.preventDefault();
      close({ quick: true, then: function () { var b = $('.ciao [data-open="saluti"]'); if (b) b.click(); } });
      return;
    }
    if (t.closest && t.closest(".menu__scatola")) {
      e.preventDefault();
      state = "leaving"; stopAll(); squaresOut(true); leave(t.closest(".menu__scatola").href);
      return;
    }
    if (!k) { close(); return; }                                        /* il velo, gli spazi tra i tasti */
    e.preventDefault();
    if (k.classList.contains("menu__k--dot")) { close(); return; }
    choose(k, kbd);
  });

  /* la tastiera: il fuoco resta nel menu; le frecce nella griglia 3x3 (e giù fino alle pillole) */
  function focusables() { return keys.concat(pills); }
  function go(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }
  doc.addEventListener("keydown", function (e) {
    if (state !== "open" && state !== "opening") return;
    var k = e.key, a = doc.activeElement, f = focusables(), i = keys.indexOf(a), pi = pills.indexOf(a);
    if (k === "Escape" || k === "Esc") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (k === "Tab") {
      e.preventDefault(); var n = f.indexOf(a);
      go(f[n < 0 ? 0 : (n + (e.shiftKey ? f.length - 1 : 1)) % f.length]); return;
    }
    var col = i >= 0 ? i % 3 : -1, row = i >= 0 ? (i / 3) | 0 : -1;
    if (k === "ArrowRight" || k === "ArrowLeft") {
      e.preventDefault(); var dx = k === "ArrowRight" ? 1 : -1;
      if (i >= 0) go(keys[(i + dx + 9) % 9]);
      else if (pi >= 0) go(pills[(pi + dx + pills.length) % pills.length]);
      else go(keys[0]);
      return;
    }
    if (k === "ArrowDown") {
      e.preventDefault();
      if (i >= 0 && row < 2) go(keys[i + 3]);
      else if (i >= 0) go(pills[Math.min(pills.length - 1, col === 2 ? 1 : 0)] || keys[col]);
      else if (pi < 0) go(keys[0]);
      return;
    }
    if (k === "ArrowUp") {
      e.preventDefault();
      if (i >= 3) go(keys[i - 3]);
      else if (pi >= 0) go(keys[pi === 0 ? 6 : 8]);
      else if (i < 0) go(keys[0]);
      return;
    }
    if (k === "Home") { e.preventDefault(); go(keys[0]); return; }
    if (k === "End") { e.preventDefault(); go(keys[8]); return; }
    /* Spazio su un collegamento: lo sceglie come Invio (sui pulsanti lo fa il browser) */
    if ((k === " " || k === "Spacebar") && a && a.tagName === "A" && M.contains(a)) { e.preventDefault(); a.click(); return; }
    /* niente scorre sotto il menu */
    if (k === "PageDown" || k === "PageUp" || ((k === " " || k === "Spacebar") && !(a && M.contains(a)))) e.preventDefault();
  }, true);
  /* il fuoco che scappa (un clic altrove, uno strumento) torna dentro */
  doc.addEventListener("focusin", function (e) { if ((state === "open" || state === "opening") && !M.contains(e.target)) go(keys[0]); });
  /* niente scorrimento con la rotella o col dito sotto il menu (la pagina non ha overflow cambiati) */
  M.addEventListener("wheel", function (e) { if (!M.hidden) e.preventDefault(); }, { passive: false });
  M.addEventListener("touchmove", function (e) { if (!M.hidden && e.touches && e.touches.length === 1) e.preventDefault(); }, { passive: false });

  /* il gesto indietro (o il tasto del browser) chiude il menu */
  W.addEventListener("popstate", function (e) {
    if (skipPop) { skipPop--; return; }
    if (state === "open" || state === "opening") close({ fromPop: true });
  });
  /* tornando dalla cache del tasto indietro (dopo una pagina aperta dal menu): la casa com'era, il menu chiuso */
  W.addEventListener("pageshow", function (e) {
    if (!e.persisted || M.hidden) return;
    pushed = false; state = "open"; close({ instant: true, keepHistory: true });
  });

  W.MENU = {
    open: function () { return open(null); },
    close: function (o) { o = o || {}; return close({ instant: !!o.instant }); },
    isOpen: function () { return state === "opening" || state === "open" || state === "closing"; },
    state: function () { return state; },
    on: function (fn) { if (typeof fn === "function" && subs.indexOf(fn) < 0) subs.push(fn); },
    off: function (fn) { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); },
    /* per gli strumenti di prova: ferma i voli a ms dall'inizio */
    _prova: {
      seek: function (ms) {
        hold = true; seekAt = ms;
        timers.forEach(function (j) { clearTimeout(j.id); });
        anims.forEach(function (a) { try { a.pause(); a.currentTime = ms; } catch (e) { } });
        timers.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (j) { if (j.at <= ms) run(j); });
      },
      play: function () {
        hold = false;
        anims.forEach(function (a) { try { a.play(); } catch (e) { } });
        timers.forEach(function (j) { j.id = setTimeout(function () { run(j); }, Math.max(0, j.at - seekAt)); });
      }
    }
  };
})();
