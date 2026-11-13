/* imad.chat — le sezioni piene di dettagli (CASA.md 2f E): Corano, Le città, Heatmap, Sto imparando.
   Plain script, ES2017 al massimo. Si carica dopo vivo.js e sez-calc.js (window.SEZ_CALC); legge IMAD, IMAD_DATA, ImadAstro,
   IMAD_TERRA (già nella pagina) e, quando ci sono, DOT, MENU e TEMA (solo al momento dell'uso).

   Come si apre: app.js chiama SEZIONI.open per data-open="corano" e "citta" (e per l'indirizzo #corano, #citta, #heatmap,
   #imparando, ?open=); se SEZIONI manca o rifiuta resta il foglio di app.js. Heatmap e Sto imparando non hanno data-open:
   il loro clic (fase normale) è ascoltato qui. Nella fase di cattura qui si fa solo una cosa: dopo più di 9 px di trascinamento
   su un riquadro (il globo, i giorni) il clic che segue non apre niente.

   Il movimento, su un solo orologio (molle con un filo di rimbalzo, mai lineari):
     apertura  il riquadro, già premuto (l'anticipo), si allarga e diventa la sezione: la scheda è ritagliata (clip-path) dal
               rettangolo del riquadro (o del tasto del menu, opts.from), con i suoi angoli, fino allo schermo intero (telefono) o
               alla scheda al centro (da 700 px); la «pelle» del riquadro si allarga con lei e cede al fondo della sezione; le cose
               che ci sono in tutti e due (il versetto, il globo, l'anno, il solido, il titolo) viaggiano dal loro posto nel riquadro
               al loro posto nella sezione; il resto sale a scalini. La casa dietro arretra a .955.
     chiusura  lo stesso al contrario, verso dove il riquadro sta adesso; il riquadro vero è già sotto.
   SEZIONI.forma = "scala": il ripiego se il ritaglio che si muove scatta su iOS 18.0 (qui non si può provare): la scheda intera
   scalata da un rettangolo all'altro, con un ritaglio fermo.
   L'arabo del Corano: si sposta solo tutto intero; stesso corpo e stessa larghezza nel riquadro e nella sezione, quindi stesse
   righe; mai scalato, mai sfumato, mai tagliato da un bordo che si muove (alla chiusura i versetti degli altri se ne vanno
   prima, in 70 ms, poi parte il ritaglio).
   Con «meno movimento»: si apre e si chiude e basta.

   window.SEZIONI = { open(id, { from: DOMRect, fromEl, radius, kbd, day, replace }) → true per corano, citta, heatmap,
   imparando (false altrimenti o se non si può adesso), close({ instant }), isOpen(), id(), forma: "clip" | "scala",
   on(fn), off(fn) }; fn({ type: "open" | "close", id }). "open" parte all'inizio dell'apertura, "close" a chiusura finita. */
(function () {
  "use strict";
  var I = window.IMAD, D = window.IMAD_DATA, A = window.ImadAstro, C = window.SEZ_CALC, TERRA = window.IMAD_TERRA;
  var doc = document, root = doc.documentElement;
  if (!I || !D || !A || !C || !doc.querySelector || !Element.prototype.animate) return;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  var esc = I.esc, clamp = I.clamp, RAD = Math.PI / 180;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fine() { return window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches; }

  /* ---------------------------------------------------------------- le molle */
  function spring(zeta, n) {
    if (!(window.CSS && CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)"))) return null;
    var w = 6.4 / zeta, wd = w * Math.sqrt(1 - zeta * zeta), pts = [];
    for (var i = 0; i <= n; i++) { var t = i / n, x = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t)); pts.push(i === n ? 1 : Math.round(x * 1000) / 1000); }
    return "linear(" + pts.join(", ") + ")";
  }
  var SP_OPEN = spring(0.76, 48) || "cubic-bezier(.2, .95, .25, 1.02)";     /* apre: un rimbalzo del 3% */
  var SP_CLOSE = spring(0.88, 48) || "cubic-bezier(.25, .9, .3, 1)";       /* chiude: atterra nel riquadro quasi senza rimbalzo */
  var SP_POP = spring(0.62, 40) || "cubic-bezier(.2, 1.1, .3, 1)";         /* le barre, i pulsanti */
  var EO = "cubic-bezier(.22, 1, .36, 1)";
  var DUR_OPEN = 640, DUR_CLOSE = 500;
  var CP = ("clipPath" in doc.documentElement.style) ? "clipPath" : "webkitClipPath";
  /* un orologio che gli strumenti possono fermare: tutto ciò che si muove a mano nella sezione legge questo */
  var clockOff = null;
  function now() { return clockOff == null ? performance.now() : clockOff; }

  /* ---------------------------------------------------------------- icone */
  var ICO = {
    x: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"><path d="M7 7l10 10"/><path d="M17 7L7 17"/></svg>',
    out: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16l8-8"/><path d="M9.5 8H16v6.5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.6"/><path d="M15.5 8.5V6.6A2.1 2.1 0 0 0 13.4 4.5H6.6A2.1 2.1 0 0 0 4.5 6.6v6.8a2.1 2.1 0 0 0 2.1 2.1h1.9"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4.2 4.2 8.8-9.4"/></svg>',
    go: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5l5.5 5.5-5.5 5.5"/></svg>',
    minus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 12h11"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 12h11"/><path d="M12 6.5v11"/></svg>'
  };

  /* ---------------------------------------------------------------- il guscio */
  var shell = doc.createElement("div");
  shell.className = "sz"; shell.id = "sz"; shell.hidden = true;
  shell.innerHTML = '<div class="sz__scrim"></div><div class="sz__panel" role="dialog" aria-modal="true" aria-labelledby="szTitle" tabindex="-1">' +
    '<div class="sz__bg"></div><div class="sz__skin" aria-hidden="true"></div><div class="sz__scroll"><div class="sz__body"></div></div>' +
    '<div class="sz__bar"><p class="sz__bart" aria-hidden="true"></p><button class="iconbtn sz__x" type="button" aria-label="Chiudi">' + ICO.x + '</button></div><i class="sz__grab" aria-hidden="true"></i></div>';
  doc.body.appendChild(shell);
  var scrim = $(".sz__scrim", shell), panel = $(".sz__panel", shell), bg = $(".sz__bg", shell), skin = $(".sz__skin", shell), scroller = $(".sz__scroll", shell);
  var body = $(".sz__body", shell), bar = $(".sz__bar", shell), bart = $(".sz__bart", shell), xBtn = $(".sz__x", shell), grab = $(".sz__grab", shell);
  var home = $("#home"), behind = [home, $("#dotclip")].filter(Boolean);

  var S = { id: null, tile: null, busy: false, pushed: false, anims: [], back: [], ctx: null, hold: false, origin: null };
  function track(a) { S.anims.push(a); if (S.hold) a.pause(); return a; }
  function dropAnims() { S.anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); S.anims = []; }
  function dropBack() { S.back.forEach(function (a) { try { a.cancel(); } catch (e) { } }); S.back = []; }
  function inert(on) { [home, $("#dotclip"), $("#dock"), $("#dotfixe")].forEach(function (n) { if (!n) return; if (on) n.setAttribute("inert", ""); else n.removeAttribute("inert"); }); }
  function dotCall(fn) { var DOT = window.DOT; if (DOT && DOT[fn]) { try { DOT[fn](); } catch (e) { } } }
  function menuOpen() { var M = window.MENU; try { if (M && M.isOpen && M.isOpen()) return true; } catch (e) { } return root.classList.contains("is-menu"); }
  var subs = [];
  function emit(type, id) { subs.slice().forEach(function (f) { try { f({ type: type, id: id }); } catch (e) { if (window.console) console.error(e); } }); }
  function onScreen(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }
  function wide() { return window.innerWidth >= 700; }
  /* il ritaglio della scheda ferma: tutto lo schermo sul telefono, una scheda al centro da 700 px in su (come prova.css) */
  function restClip() { if (!wide()) return inset(Z, 0); var W = panel.clientWidth, w = Math.min(880, W - 56), x = (W - w) / 2; return inset({ t: 28, r: x, b: 28, l: x }, 36); }
  function rectIn(r, p) { return { t: r.top - p.top, r: p.right - (r.left + r.width), b: p.bottom - (r.top + r.height), l: r.left - p.left }; }
  function inset(q, rad) { return "inset(" + q.t.toFixed(2) + "px " + q.r.toFixed(2) + "px " + q.b.toFixed(2) + "px " + q.l.toFixed(2) + "px round " + rad.toFixed(2) + "px)"; }
  var Z = { t: 0, r: 0, b: 0, l: 0 };
  function clipKF(a, b) { var k0 = {}, k1 = {}; k0[CP] = a; k1[CP] = b; return [k0, k1]; }
  /* la casa dietro è scalata attorno al centro dello schermo: il rettangolo di un suo elemento come sarà a scala 1 */
  function homeScale() { var m = /matrix\(([^,]+)/.exec(getComputedStyle(home).transform || ""); return m ? parseFloat(m[1]) || 1 : 1; }
  function unscaled(r) {
    var s = homeScale(); if (Math.abs(s - 1) < 1e-4 || !S.origin) return r;
    var ox = S.origin.x, oy = S.origin.y;
    return { left: ox + (r.left - ox) / s, top: oy + (r.top - oy) / s, width: r.width / s, height: r.height / s, right: ox + (r.right - ox) / s, bottom: oy + (r.bottom - oy) / s };
  }

  /* la pelle: il fondo del riquadro, copiato com'è, grande quanto il riquadro dentro la scheda */
  function skinAt(tile, tr, pr) {
    var cs = getComputedStyle(tile), st = skin.style;
    st.left = (tr.left - pr.left) + "px"; st.top = (tr.top - pr.top) + "px"; st.width = tr.width + "px"; st.height = tr.height + "px";
    st.backgroundImage = cs.backgroundImage; st.backgroundColor = cs.backgroundColor; st.backgroundSize = cs.backgroundSize; st.backgroundPosition = cs.backgroundPosition; st.backgroundRepeat = cs.backgroundRepeat;
    st.borderRadius = cs.borderTopLeftRadius; skin.hidden = false;
    return "translate(" + (pr.left - tr.left).toFixed(2) + "px," + (pr.top - tr.top).toFixed(2) + "px) scale(" + (pr.width / tr.width).toFixed(5) + "," + (pr.height / tr.height).toFixed(5) + ")";
  }

  /* un elemento della sezione che parte dal posto di uno del riquadro. kind: "move" (solo traslazione: stesso disegno, come
     l'arabo), "scale" (traslazione e scala: una tela con lo stesso disegno), "text" (traslazione e scala con una dissolvenza
     incrociata da una copia del pezzo del riquadro: parole con un altro corpo o altre righe). aBox/bBox: il rettangolo che deve
     combaciare, se non è tutto l'elemento (il cerchio del globo dentro la sua tela). */
  function boxCentre(r) { return [r.left + r.width / 2, r.top + r.height / 2]; }
  /* il rettangolo delle parole, non del blocco (un h2 è largo quanto la colonna, le sue parole no) */
  function textBox(n) { try { var r = doc.createRange(); r.selectNodeContents(n); var b = r.getBoundingClientRect(); if (b.width > 0) return b; } catch (e) { } return n.getBoundingClientRect(); }
  function boxA(p) { return p.aBox ? p.aBox() : p.kind === "text" ? textBox(p.a) : p.a.getBoundingClientRect(); }
  function boxB(p) { return p.bBox ? p.bBox() : p.kind === "text" ? textBox(p.b) : p.b.getBoundingClientRect(); }
  function flipT(p, ra, rb) {
    var el = p.b.getBoundingClientRect(), s = p.kind === "move" ? 1 : ra.width / Math.max(1, rb.width), ca = boxCentre(ra), cb = boxCentre(rb);
    var tx = ca[0] - el.left - s * (cb[0] - el.left), ty = ca[1] - el.top - s * (cb[1] - el.top);
    return "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) scale(" + s.toFixed(5) + ")";
  }
  function cloneOf(a, ra, pr) {
    var c = a.cloneNode(true), cs = getComputedStyle(a), st = c.style;
    c.removeAttribute("id"); c.setAttribute("aria-hidden", "true"); c.className = "sz-clone";
    st.position = "absolute"; st.zIndex = "3"; st.margin = "0"; st.left = (ra.left - pr.left) + "px"; st.top = (ra.top - pr.top) + "px"; st.width = ra.width + "px"; st.height = ra.height + "px";
    st.font = cs.font; st.letterSpacing = cs.letterSpacing; st.color = cs.color; st.textAlign = cs.textAlign; st.lineHeight = cs.lineHeight; st.whiteSpace = cs.whiteSpace;
    st.transformOrigin = "0 0"; st.pointerEvents = "none"; st.textShadow = cs.textShadow;
    panel.appendChild(c); return c;
  }
  function sharedGo(list, opening, dur, ease, pr, dl) {
    dl = dl || 0;
    (list || []).forEach(function (p) {
      if (!p.a || !p.b) return;
      var ra = unscaled(boxA(p)), rb = boxB(p);
      if (!ra.width || !rb.width) return;
      if (!opening && (rb.top + rb.height < 0 || rb.top > window.innerHeight)) return;      /* fuori vista: niente viaggio, svanisce col resto */
      p.b.style.transformOrigin = "0 0";
      var T = flipT(p, ra, rb), kf = opening ? [{ transform: T }, { transform: "none" }] : [{ transform: "none" }, { transform: T }];
      track(p.b.animate(kf, { duration: dur, easing: ease, fill: "both", delay: dl }));
      if (p.kind === "text") {
        var c = cloneOf(p.a, ra, pr), Tb = "translate(" + (rb.left - ra.left).toFixed(2) + "px," + (rb.top - ra.top).toFixed(2) + "px) scale(" + (rb.width / ra.width).toFixed(5) + ")";
        track(c.animate(opening ? [{ transform: "none" }, { transform: Tb }] : [{ transform: Tb }, { transform: "none" }], { duration: dur, easing: ease, fill: "both", delay: dl }));
        track(c.animate(opening ? [{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1, offset: 0.75 }, { opacity: 1 }], { duration: dur, easing: "linear", fill: "both", delay: dl }));
        track(p.b.animate(opening ? [{ opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.42 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }], { duration: dur, easing: "linear", fill: "both", delay: dl }));
      }
    });
  }
  function dropClones() { $$(".sz-clone, .sz-det", panel).forEach(function (c) { c.parentNode.removeChild(c); }); }
  /* i dettagli del riquadro che non viaggiano (etichette, piede): una copia al suo posto, che se ne va in fretta mentre la carta cresce */
  function detailsGhost(tile, tr, pr) {
    var shared = (S.ctx.share || []).map(function (q) { return q.a; }).filter(Boolean);
    shared.forEach(function (n) { n.setAttribute("data-sz-a", ""); });
    var g = tile.cloneNode(true);
    shared.forEach(function (n) { n.removeAttribute("data-sz-a"); });
    $$("[data-sz-a]", g).forEach(function (n) { n.style.visibility = "hidden"; n.removeAttribute("data-sz-a"); });
    $$("canvas, .win__img, .luce, .tile__hit, .sz-go", g).forEach(function (n) { n.style.visibility = "hidden"; });
    $$("[id]", g).forEach(function (n) { n.removeAttribute("id"); }); g.removeAttribute("id");
    g.className += " sz-det"; g.setAttribute("aria-hidden", "true"); g.removeAttribute("data-tile");
    var st = g.style; st.position = "absolute"; st.zIndex = "2"; st.margin = "0"; st.left = (tr.left - pr.left) + "px"; st.top = (tr.top - pr.top) + "px"; st.width = tr.width + "px"; st.height = tr.height + "px";
    st.background = "none"; st.boxShadow = "none"; st.transform = "none"; st.pointerEvents = "none"; st.gridArea = "auto";
    panel.appendChild(g); return g;
  }

  /* la forma «scala»: la scheda ferma al suo posto (restBox, coordinate del pannello), traslata e scalata con origine 0 0 fino
     al rettangolo r; gli angoli tondi da un ritaglio fermo (durante il volo anche sul telefono) */
  function restBox() { var W = panel.clientWidth, H = panel.clientHeight; if (!wide()) return { left: 0, top: 0, width: W, height: H }; var w = Math.min(880, W - 56); return { left: (W - w) / 2, top: 28, width: w, height: H - 56 }; }
  function scalaT(r, pr) {
    var b = restBox(), sx = r.width / b.width, sy = r.height / b.height;
    return "translate(" + (r.left - pr.left - b.left * sx).toFixed(2) + "px," + (r.top - pr.top - b.top * sy).toFixed(2) + "px) scale(" + sx.toFixed(5) + "," + sy.toFixed(5) + ")";
  }
  function scala() { return window.SEZIONI && window.SEZIONI.forma === "scala"; }
  function restAbs(pr) { var b = restBox(); return { left: pr.left + b.left, top: pr.top + b.top, width: b.width, height: b.height }; }

  /* ---------------------------------------------------------------- aprire */
  function open(id, tile, o) {
    o = o || {};
    var sec = SEC[id];
    if (!sec || S.id || S.busy || root.classList.contains("ni-on") || root.classList.contains("is-sheet")) return false;
    if (!o.from && menuOpen()) return false;                     /* il menu aperto: solo lui (con from) può aprire una sezione */
    if (o.from && !(o.from.width > 0 && o.from.height > 0)) o.from = null;
    S.id = id; S.tile = tile || null; S.busy = true; S.anims = []; S.hold = !!o.hold; S.kbd = !!o.kbd; S.any = true;
    S.ret = o.kbd ? doc.activeElement : null;                    /* da tastiera il fuoco torna proprio lì */
    panel.setAttribute("data-mat", sec.mat); panel.className = "sz__panel" + (sec.mat === "night" ? " on-dark" : "");
    panel.style.transform = ""; panel.style[CP] = "";
    body.innerHTML = ""; scroller.scrollTop = 0; shell.classList.remove("is-scrolled"); bart.textContent = sec.title; skin.hidden = true;
    var hr = home.getBoundingClientRect();
    S.origin = { x: hr.left + hr.width / 2, y: window.innerHeight / 2 };
    behind.forEach(function (n) { n.style.transformOrigin = "50% " + (window.pageYOffset + window.innerHeight / 2) + "px"; });
    shell.hidden = false; root.classList.add("is-sheet", "is-locked", "is-sz"); inert(true); dotCall("pause");
    emit("open", id);
    try { S.ctx = sec.build(body, { tile: tile, day: o.day }) || {}; } catch (e) { if (window.console) console.error(e); S.ctx = {}; }
    scroller.scrollTop = 0;          /* qui, a scheda visibile: nascosta (display: none) Chromium le lasciava lo scorrimento della volta prima */
    /* replace: il menu passa la sua voce della cronologia alla sezione (così «indietro» chiude la sezione, non il menu sotto) */
    if (o.push !== false) { try { if (o.replace) history.replaceState({ sz: id }, "", "#" + id); else history.pushState({ sz: id }, "", "#" + id); S.pushed = true; } catch (e) { S.pushed = false; } } else S.pushed = !!o.pushed;
    if (o.instant || I.still() || (!o.from && (!tile || !onScreen(tile)))) {
      if (!o.instant && !I.still()) {   /* il riquadro non si vede (aperta da un indirizzo o da un menu): la scheda sale dal basso */
        track(panel.animate([{ transform: "translateY(" + Math.round(window.innerHeight * 0.6) + "px)" }, { transform: "none" }], { duration: DUR_OPEN, easing: SP_OPEN }));
        track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" })).onfinish = openDone;
        return true;
      }
      openDone(); return true;
    }
    /* da dove parte: il riquadro, o il rettangolo dato (il tasto del menu, che diventa lui la sezione: niente viaggi dal riquadro) */
    var fr = o.from || null, pr = panel.getBoundingClientRect(), tr = fr || tile.getBoundingClientRect();
    var rad = fr ? (o.radius != null ? +o.radius : 26) : (parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 32);
    var src = fr ? (o.fromEl || null) : tile, sc = scala();
    S.from = !!fr;
    var main;
    if (sc) {
      panel.style[CP] = wide() ? restClip() : "inset(0 round 40px)";     /* fermo: solo la trasformazione si muove */
      panel.style.transformOrigin = "0 0";
      main = track(panel.animate([{ transform: scalaT(tr, pr) }, { transform: "none" }], { duration: DUR_OPEN, easing: SP_OPEN, fill: "both" }));
      if (src) skinAt(src, restAbs(pr), pr);
    } else {
      main = track(panel.animate(clipKF(inset(rectIn(tr, pr), rad), restClip()), { duration: DUR_OPEN, easing: SP_OPEN, fill: "both" }));
      if (src) { var skinT = skinAt(src, tr, pr); track(skin.animate([{ transform: "none" }, { transform: skinT }], { duration: DUR_OPEN, easing: SP_OPEN, fill: "both" })); }
    }
    if (src) track(skin.animate([{ opacity: 1 }, { opacity: 1, offset: 0.24 }, { opacity: 0, offset: 0.74 }, { opacity: 0 }], { duration: DUR_OPEN, easing: "linear", fill: "both" }));
    if (!fr) {
      var det = detailsGhost(tile, tr, pr);
      if (det && !sc) track(det.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: "ease-out", fill: "both" }));
      else if (det) det.parentNode.removeChild(det);
      tile.classList.add("is-source"); tile.classList.remove("is-pressed");
      if (!sc) sharedGo(S.ctx.share, true, DUR_OPEN, SP_OPEN, pr);
    }
    /* il resto sale a scalini, quando la scheda è già quasi aperta; solo quello che si vede */
    var k = 0;
    $$("[data-sz-in]", body).forEach(function (n) {
      var r = n.getBoundingClientRect(); if (r.top > window.innerHeight + 40) return;
      track(n.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: Math.round(DUR_OPEN * 0.3 + Math.min(k++, 8) * 46), easing: EO, fill: "backwards" }));
    });
    [bar, grab].forEach(function (n) { track(n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 220, easing: "ease-out", fill: "backwards" })); });
    track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "ease-out", fill: "backwards" }));
    behind.forEach(function (n, i) { var a = n.animate([{ transform: "none" }, { transform: "scale(.955)" }], { duration: DUR_OPEN, easing: SP_OPEN, fill: "forwards" }); S.back.push(a); if (S.hold) a.pause(); });
    main.onfinish = openDone;
    return true;
  }
  function openDone() {
    if (!S.id) return;
    dropAnims(); dropClones(); skin.hidden = true; S.busy = false;
    panel.style.transformOrigin = ""; if (scala()) panel.style[CP] = "";
    (S.ctx.share || []).forEach(function (p) { if (p.b) { p.b.style.transformOrigin = ""; } });
    var t = $("#szTitle", body); try { (t || panel).focus({ preventScroll: true }); } catch (e) { }
    if (S.ctx.start) { try { S.ctx.start(); } catch (e) { if (window.console) console.error(e); } }
  }

  /* ---------------------------------------------------------------- chiudere */
  function close(o) {
    o = o || {};
    if (!S.id || (S.busy && !o.force)) return;
    if (o.hold) S.hold = true;
    if (S.pushed && !o.fromPop) { S.pushed = false; S.nextInstant = !!o.instant; try { history.back(); return; } catch (e) { } }
    if (S.busy) { dropAnims(); dropClones(); }
    S.busy = true;
    if (S.ctx && S.ctx.stop) { try { S.ctx.stop(); } catch (e) { } }
    var tile = S.tile;
    if (o.instant || I.still() || !tile || !onScreen(tile)) {
      if (o.instant || I.still()) { finishClose(); return; }
      var cur = panel.style.transform || "none"; panel.style.transform = "";
      track(panel.animate([{ transform: cur, opacity: 1 }, { transform: "translateY(" + Math.round(window.innerHeight * 0.5) + "px)", opacity: 0 }], { duration: 360, easing: EO, fill: "forwards" })).onfinish = finishClose;
      track(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out", fill: "forwards" }));
      backTo(360);
      return;
    }
    /* da dove parte: la scheda ferma, o dove l'ha portata il dito */
    var from = restClip(), sc = scala(), fromT = "none";
    if (o.drag) {
      if (sc) { fromT = panel.style.transform || "none"; panel.style.transform = ""; }
      else { var vr = panel.getBoundingClientRect(); panel.style.transform = ""; from = inset(rectIn(vr, panel.getBoundingClientRect()), 40); }
    }
    var pr = panel.getBoundingClientRect(), tr = unscaled(tile.getBoundingClientRect()), rad = parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 32;
    var q = rectIn(tr, pr), pre = S.id === "corano" ? 70 : 0, main;
    if (sc) {
      panel.style[CP] = wide() ? restClip() : "inset(0 round 40px)"; panel.style.transformOrigin = "0 0"; skinAt(tile, restAbs(pr), pr);
      main = track(panel.animate([{ transform: fromT }, { transform: scalaT(tr, pr) }], { duration: DUR_CLOSE, easing: SP_CLOSE, fill: "both", delay: pre }));
    } else {
      var skinT = skinAt(tile, tr, pr);
      main = track(panel.animate(clipKF(from, inset(q, rad)), { duration: DUR_CLOSE, easing: SP_CLOSE, fill: "both", delay: pre }));
      track(skin.animate([{ transform: skinT }, { transform: "none" }], { duration: DUR_CLOSE, easing: SP_CLOSE, fill: "both", delay: pre }));
    }
    track(skin.animate([{ opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], { duration: DUR_CLOSE, easing: "linear", fill: "both", delay: pre }));
    /* il riquadro vero torna sotto la scheda, già al suo posto; la scheda, ormai grande quanto lui, lo lascia vedere */
    tile.classList.remove("is-source");
    track(panel.animate([{ opacity: 1 }, { opacity: 1, offset: 0.52 }, { opacity: 0, offset: 0.92 }, { opacity: 0 }], { duration: DUR_CLOSE, easing: "linear", fill: "both", delay: pre }));
    if (!sc) sharedGo(S.ctx.share, false, DUR_CLOSE, SP_CLOSE, pr, pre);
    var shared = sc ? [] : (S.ctx.share || []).map(function (p) { return p.b; });
    $$("[data-sz-in]", body).forEach(function (n) {
      if (shared.indexOf(n) >= 0) return;
      var r = n.getBoundingClientRect(); if (r.top > window.innerHeight || r.bottom < 0) return;
      track(n.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(" + (pre ? 4 : 10) + "px)" }], { duration: pre || 150, easing: "ease-out", fill: "forwards" }));
    });
    [bar, grab].forEach(function (n) { track(n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" })); });
    track(scrim.animate([{ opacity: parseFloat(getComputedStyle(scrim).opacity) || 1 }, { opacity: 0 }], { duration: DUR_CLOSE - 80, easing: "ease-out", fill: "both", delay: pre }));
    backTo(DUR_CLOSE);
    main.onfinish = finishClose;
  }
  function backTo(dur) {
    var s = homeScale(); dropBack();
    behind.forEach(function (n) { var a = n.animate([{ transform: "scale(" + s.toFixed(4) + ")" }, { transform: "none" }], { duration: dur, easing: SP_CLOSE, fill: "forwards" }); S.back.push(a); if (S.hold) a.pause(); });
  }
  function finishClose() {
    var tile = S.tile;
    dropAnims(); dropBack(); dropClones();
    if (S.ctx && S.ctx.cleanup) { try { S.ctx.cleanup(); } catch (e) { } }
    scroller.scrollTop = 0; shell.hidden = true; skin.hidden = true; body.innerHTML = ""; panel.style.transform = ""; panel.style[CP] = ""; panel.style.transformOrigin = ""; scrim.style.opacity = "";
    root.classList.remove("is-sheet", "is-locked", "is-sz"); inert(false);
    behind.forEach(function (n) { n.style.transformOrigin = ""; });
    if (tile) {
      tile.classList.remove("is-source");
      var r0 = S.ret, back = r0 && r0 !== doc.body && doc.documentElement.contains(r0) && !(r0.closest && r0.closest("#menu, #sz")) && r0.getClientRects().length ? r0 : null;
      var f = S.kbd ? (back || $(".tile__hit", tile) || $("canvas[tabindex]", tile) || tile) : tile;
      if (f === tile && !tile.hasAttribute("tabindex")) { tile.setAttribute("tabindex", "-1"); tile.classList.add("sz-quiet"); tile.addEventListener("blur", function q() { tile.removeEventListener("blur", q); tile.removeAttribute("tabindex"); tile.classList.remove("sz-quiet"); }); }
      try { f.focus({ preventScroll: true }); } catch (e) { }
    }
    if (location.hash && !S.pushed) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { } }
    var was = S.id;
    S.id = null; S.tile = null; S.ctx = null; S.busy = false; S.pushed = false; S.hold = false; S.from = false; S.ret = null;
    dotCall("resume");
    emit("close", was);
  }

  xBtn.addEventListener("click", function () { close(); });
  scrim.addEventListener("click", function () { close(); });
  doc.addEventListener("keydown", function (e) {
    if (!S.id) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab") {      /* il fuoco resta nella sezione */
      var f = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input', panel).filter(function (n) { return n.offsetParent !== null || n === xBtn; });
      if (!f.length) return;
      var i = f.indexOf(doc.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener("popstate", function (e) {
    var st = e.state;
    if (st && st.sz) { if (!S.id) open(st.sz, tileOf(st.sz), { push: false, pushed: true }); }
    else if (S.id) { S.pushed = false; var ins = !!S.nextInstant; S.nextInstant = false; close({ fromPop: true, force: true, instant: ins }); }
  });
  scroller.addEventListener("scroll", function () { shell.classList.toggle("is-scrolled", scroller.scrollTop > 56); }, { passive: true });

  /* trascina in giù per chiudere (telefono, dalla cima della sezione) */
  (function () {
    var g = null;
    panel.addEventListener("touchstart", function (e) { if (e.touches.length !== 1 || S.busy || wide()) { g = null; return; } var t = e.touches[0]; g = { x: t.clientX, y: t.clientY, on: false, off: false, dy: 0, v: 0, ly: t.clientY, lt: performance.now(), top: scroller.scrollTop <= 0 }; }, { passive: true });
    panel.addEventListener("touchmove", function (e) {
      if (!g || g.off) return;
      var t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y, nt = performance.now();
      if (!g.on) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        var inner = e.target.closest ? e.target.closest(".sz-globo, .sz-solid, .sz-ora__r, .sz-strip, .sz-chips") : null;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.3 && g.top && scroller.scrollTop <= 0 && !inner) { g.on = true; g.y = t.clientY; dy = 0; panel.style[CP] = "inset(0 round 40px)"; }
        else { g.off = true; return; }
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, dy); g.dy = dy; g.v = (t.clientY - g.ly) / Math.max(1, nt - g.lt); g.ly = t.clientY; g.lt = nt;
      panel.style.transform = "translateY(" + (dy * 0.82).toFixed(1) + "px) scale(" + (1 - clamp(dy / 1400, 0, 0.16)).toFixed(4) + ")";
      scrim.style.opacity = String(clamp(1 - dy / 520, 0.25, 1));
    }, { passive: false });
    function end() {
      if (!g || !g.on) { g = null; return; }
      var go = g.dy > 130 || (g.dy > 36 && g.v > 0.55); g = null;
      if (go) { close({ drag: true }); return; }
      var cur = panel.style.transform; panel.style.transform = ""; scrim.style.opacity = "";
      panel.animate([{ transform: cur }, { transform: "none" }], { duration: 420, easing: SP_POP }).onfinish = function () { panel.style[CP] = ""; };
    }
    panel.addEventListener("touchend", end); panel.addEventListener("touchcancel", end);
  })();

  /* ================================================================ aiuti comuni delle sezioni */
  function el(tag, cls, html) { var n = doc.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  var MESI = C.MESI, MESI3 = C.MESI3;
  function fmtN(n) { try { return Number(n).toLocaleString("it-IT"); } catch (e) { return String(n); } }
  function fa(iso) {
    var t = new Date(iso).getTime(); if (isNaN(t)) return "";
    var s = (I.now().getTime() - t) / 1000;
    if (s < 60) return "adesso";
    var m = Math.floor(s / 60); if (m < 60) return m === 1 ? "1 minuto fa" : m + " minuti fa";
    var h = Math.floor(m / 60); if (h < 24) return h === 1 ? "1 ora fa" : h + " ore fa";
    var n0 = I.now(), t0 = new Date(t), d = Math.round((new Date(n0.getFullYear(), n0.getMonth(), n0.getDate()) - new Date(t0.getFullYear(), t0.getMonth(), t0.getDate())) / 86400000);
    if (d <= 1) return "ieri";
    if (d < 7) return d + " giorni fa";
    if (d < 30) { var w = Math.floor(d / 7); return w === 1 ? "1 settimana fa" : w + " settimane fa"; }
    if (d < 365) { var mo = Math.max(1, Math.floor(d / 30.44)); return mo === 1 ? "1 mese fa" : mo + " mesi fa"; }
    var y = Math.floor(d / 365.25); return y === 1 ? "1 anno fa" : y + " anni fa";
  }
  function quando(iso) {      /* «mer 11 nov, 13:13» a Torino */
    var d = new Date(iso); if (isNaN(d.getTime())) return "";
    try { return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(/\./g, ""); } catch (e) { return d.toISOString().slice(0, 16).replace("T", " "); }
  }
  function letto(iso) {       /* «letto alle 20:43 del 12 novembre» */
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return "";
    return "letto alle " + A.localTime(d, "Europe/Rome") + " del " + new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long" }).format(d);
  }
  function ghUrl(u, d) { return (typeof u === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.\-]+(\/[A-Za-z0-9_.\-]+)?\/?$/.test(u)) ? u : d; }
  function fitCv(cv, cap) { return I.fit(cv, cap || 2); }
  /* copia negli appunti, con un ripiego per i browser vecchi */
  function copia(text) {
    return new Promise(function (res) {
      function old() { try { var t = doc.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.top = "-1000px"; doc.body.appendChild(t); t.select(); var ok = doc.execCommand("copy"); doc.body.removeChild(t); res(ok); } catch (e) { res(false); } }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { res(true); }, old); else old();
    });
  }
  /* le cifre che rotolano (l'idea del Counter di React Bits, David Haz, MIT + Commons Clause), in ES2017 e CSS:
     ogni cifra è una colonna 0-9 0-9; va avanti o indietro di poco, poi torna al posto equivalente senza farsi vedere */
  function Roll(elm) {
    var cols = [], str = "";
    function build(s) {
      elm.innerHTML = ""; cols = [];
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (/\d/.test(ch)) {
          var w = el("span", "sz-dg"), z = el("span", "sz-dg__z", ch), c = el("span", "sz-dg__c"), h = "";
          for (var k = 0; k < 20; k++) h += "<span>" + (k % 10) + "</span>";
          c.innerHTML = h; c.setAttribute("aria-hidden", "true"); w.appendChild(z); w.appendChild(c); elm.appendChild(w); cols.push({ c: c, z: z, p: +ch }); place(cols[cols.length - 1], +ch, false, true);
        } else { elm.appendChild(el("span", "sz-dg__s", esc(ch))); cols.push(null); }
      }
      str = s;
    }
    /* fresh: una colonna appena creata non ha niente da cui partire, quindi non serve forzare l'impaginazione (con trenta cifre in
       cinque città quel «void offsetWidth» impaginava la sezione trenta volte mentre si costruiva) */
    function place(o, p, anim, fresh) { o.c.style.transition = anim ? "" : "none"; o.c.style.transform = "translate(-50%, " + (-p * 5) + "%)"; o.z.textContent = String(p % 10); o.p = p; if (!anim && !fresh) void o.c.offsetWidth; }
    function set(s, dir) {
      if (s.length !== str.length || I.still()) { build(s); return; }
      for (var i = 0; i < s.length; i++) {
        var o = cols[i], ch = s.charAt(i); if (!o) continue;
        var n = +ch, cur = o.p % 10; if (n === cur) continue;
        var target;
        if (dir >= 0) target = n > cur ? n : n + 10;
        else { if (n < cur) target = n; else { place(o, cur + 10, false); target = n; } }
        if (dir >= 0 && o.p >= 10) { place(o, cur, false); target = n > cur ? n : n + 10; }
        (function (oo, tt) { requestAnimationFrame(function () { place(oo, tt, true); }); })(o, target);
      }
      str = s;
    }
    return { set: set, build: build };
  }

  /* ---------------------------------------------------------------- il colore del cielo (come app.js, copiato: CASA chiede di esporlo) */
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function gam(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(clamp(c, 0, 1) * 255); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toLab(c) { var r = lin(c[0]), g = lin(c[1]), b = lin(c[2]); var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; }
  function toRgb(L) { var l = L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], m = L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], s = L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2]; l = l * l * l; m = m * m * m; s = s * s * s; return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)]; }
  function mixLab(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  var SKY = [[60, "#154bb8", "#2565cf", "#4a8ce0", "#d6e7ff", 0.34], [15, "#1a51be", "#2d6cd2", "#5193e2", "#dbe9ff", 0.36], [6, "#2051b3", "#436fc7", "#7f8ec9", "#ffe0c2", 0.5], [2, "#22489e", "#5961ae", "#bf7f60", "#ffc08e", 0.72], [0, "#1e3f8c", "#5b4f98", "#c96f4c", "#ffa674", 0.8], [-3, "#172f70", "#46407f", "#b0563f", "#ff8d68", 0.7], [-7, "#101f52", "#262a62", "#5e3a62", "#c2668a", 0.4], [-12, "#0b1538", "#131c48", "#2a2752", "#6653a6", 0.26], [-18, "#070c22", "#0c1230", "#141a3c", "#4650a6", 0.2]]
    .map(function (k) { return { alt: k[0], zen: toLab(hex(k[1])), mid: toLab(hex(k[2])), hor: toLab(hex(k[3])), glow: toLab(hex(k[4])), ga: k[5] }; });
  function skyVars(alt, gx) {
    var a = SKY[0], b = SKY[SKY.length - 1], t = 0;
    if (alt >= a.alt) b = a; else if (alt <= b.alt) a = b; else for (var i = 0; i < SKY.length - 1; i++) if (alt <= SKY[i].alt && alt >= SKY[i + 1].alt) { a = SKY[i]; b = SKY[i + 1]; t = (a.alt - alt) / (a.alt - b.alt); break; }
    var mid = mixLab(a.mid, b.mid, t), hor = mixLab(a.hor, b.hor, t), g = toRgb(mixLab(a.glow, b.glow, t)), ga = (a.ga + (b.ga - a.ga) * t) * 0.6;
    return "--zen:" + rgb(toRgb(mixLab(a.zen, b.zen, t))) + ";--mid:" + rgb(toRgb(mid)) + ";--rose:" + rgb(toRgb(mixLab(mid, hor, 0.56))) + ";--hor:" + rgb(toRgb(hor)) + ";--glow:rgba(" + g[0] + "," + g[1] + "," + g[2] + "," + ga.toFixed(3) + ");--gx:" + gx + "%";
  }

  /* ================================================================ CORANO */
  function verseByKey(k) { return D.verses.filter(function (v) { return v.key === k; })[0] || null; }
  function refText(v) {
    var n = v.ayahs || [], r = n.length > 1 ? "versetti " + n[0] + "–" + n[n.length - 1] : "versetto " + n[0];
    return "sura " + v.surah + ", " + r;
  }
  function host(u) { var m = /^https:\/\/([^\/#]+)/.exec(u || ""); return m ? m[1].replace(/^www\./, "") : ""; }
  function verseText(v) { return v.ar + "\n\n" + v.it + "\n\n" + v.surahName + " " + v.key + " · trad. " + v.translator; }
  function copyBtn(v, big) {
    return big ? '<button class="sz-pill" type="button" data-copia="' + esc(v.key) + '"><span class="sz-cp">' + ICO.copy + '</span><span class="sz-cpt">Copia</span></button>'
      : '<button class="sz-ib" type="button" data-copia="' + esc(v.key) + '" aria-label="Copia il versetto ' + esc(v.key) + ', arabo e italiano"><span class="sz-cp">' + ICO.copy + "</span></button>";
  }
  function buildCorano(b, ctx) {
    var tile = ctx.tile || $('.tile[data-tile="corano"]');
    var tAr = $(".js-var", tile), tIt = $(".js-vit", tile), tLab = $(".tile__head .label--ink", tile), tBox = $(".corano__verse", tile);
    var v = verseByKey((($(".js-vref", tile) || {}).textContent || "").trim()) || D.verses[0];
    var tz = D.verses.filter(function (x) { return /Tanzil/.test(x.translator || ""); }).sort(function (a, c) { return a.surah - c.surah; }).map(function (x) { return x.key; });
    var others = D.verses.filter(function (x) { return x !== v; }).sort(function (a, c) { return a.surah - c.surah || a.ayahs[0] - c.ayahs[0]; });
    var h = '<h2 class="sz-t" id="szTitle" tabindex="-1">Corano</h2>' +
      '<section class="sz-vd" aria-label="Il versetto di oggi"><p class="sz-vd__k" data-sz-in>Il versetto di oggi</p>' +
      '<div class="sz-vd__box"><p class="ayah sz-vd__ar" lang="ar" dir="rtl"></p></div><p class="sz-vd__it"></p>' +
      '<div data-sz-in><p class="sz-vd__ref">' + esc(v.surahName) + " · " + esc(refText(v)) + '</p><p class="sz-vd__tr">Traduzione di ' + esc(v.translator) + "</p>" +
      '<div class="sz-pills">' + copyBtn(v, true) + '<a class="sz-pill" href="' + esc(v.source) + '" target="_blank" rel="noopener">Su ' + esc(host(v.source)) + ICO.out + '<span class="sr"> (si apre in una nuova scheda)</span></a></div></div></section>' +
      '<div class="sz-sep" data-sz-in></div><h3 class="sz-h" data-sz-in>Gli altri versetti</h3><p class="sz-cap" data-sz-in>' + others.length + " versetti, in arabo e in italiano, nell’ordine delle sure.</p>" +
      '<ul class="sz-vl">' + others.map(function (x) {
        return '<li class="sz-v" data-sz-in><p class="sz-v__ar" lang="ar" dir="rtl"></p><p class="sz-v__it"></p><div class="sz-v__f"><p class="sz-v__ref">' + esc(x.surahName) + ' <span class="num">' + esc(x.key) + "</span><span>" + esc(refText(x)) + " · trad. " + esc(x.translator) + "</span></p>" +
          copyBtn(x, false) + '<a class="sz-ib" href="' + esc(x.source) + '" target="_blank" rel="noopener" aria-label="' + esc(x.surahName + " " + x.key) + " su " + esc(host(x.source)) + ', si apre in una nuova scheda">' + ICO.out + "</a></div></li>";
      }).join("") + "</ul>" +
      '<div class="sz-note" data-sz-in><p>Il testo arabo è quello di quran.com, nella scrittura uthmani, copiato com’è: qui non si scrive a mano e non si cambia.</p>' +
      "<p>La traduzione italiana è di Hamza Roberto Piccardo, da quran.com" + (tz.length ? "; per " + tz.map(esc).join(" e ") + " è il testo di Tanzil della stessa traduzione" : "") + ". Ogni versetto ha il link alla sua pagina.</p></div>";
    b.innerHTML = h;
    var vAr = $(".sz-vd__ar", b), vIt = $(".sz-vd__it", b), box = $(".sz-vd__box", b);
    vAr.textContent = v.ar; vIt.textContent = v.it;                                  /* solo dal dato */
    $$(".sz-v", b).forEach(function (li, i) { $(".sz-v__ar", li).textContent = others[i].ar; $(".sz-v__it", li).textContent = others[i].it; });
    /* stesso corpo e stessa larghezza del riquadro: stesse righe, così l'arabo viaggia solo traslando */
    if (tAr && tBox) { var cs = getComputedStyle(tAr); vAr.style.fontSize = cs.fontSize; vAr.style.lineHeight = cs.lineHeight; box.style.width = tBox.clientWidth + "px"; box.style.maxWidth = "100%"; box.style.margin = "0 auto"; }
    b.addEventListener("click", function (e) {
      var c = e.target.closest ? e.target.closest("[data-copia]") : null; if (!c) return;
      var x = verseByKey(c.getAttribute("data-copia")); if (!x) return;
      copia(verseText(x)).then(function (ok) {
        var ic = $(".sz-cp", c), tx = $(".sz-cpt", c);
        ic.innerHTML = ok ? ICO.ok : ICO.copy; c.classList.toggle("is-ok", ok); if (tx) tx.textContent = ok ? "Copiato" : "Non si può copiare qui";
        if (!I.still()) ic.animate([{ transform: "scale(.6)" }, { transform: "none" }], { duration: 420, easing: SP_POP });
        setTimeout(function () { ic.innerHTML = ICO.copy; c.classList.remove("is-ok"); if (tx) tx.textContent = "Copia"; }, 1600);
      });
    });
    return { share: [{ a: tAr, b: vAr, kind: "move" }, { a: tIt, b: vIt, kind: "text" }, { a: tLab, b: $("#szTitle", b), kind: "text" }] };
  }

  /* ================================================================ LE CITTÀ */
  var ORDER = ["gaza", "torino", "medina", "makkah", "casablanca"];
  function cityById(id) { return D.cities.filter(function (c) { return c.id === id; })[0]; }
  function v3(lat, lon) { var cl = Math.cos(lat * RAD); return [cl * Math.sin(lon * RAD), Math.sin(lat * RAD), cl * Math.cos(lon * RAD)]; }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function slerp(a, b, t) { var om = Math.acos(clamp(dot3(a, b), -1, 1)), so = Math.sin(om); if (so < 1e-6) return a; var ka = Math.sin((1 - t) * om) / so, kb = Math.sin(t * om) / so; return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]; }
  function eIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var DOTS = null;
  function landDots() {
    if (DOTS) return DOTS; DOTS = [];
    if (!TERRA) return DOTS;
    var bin = atob(TERRA.mask), n = 0;
    for (var r = 0; r < TERRA.rows; r++) { var lat = -90 + (r + 0.5) * (180 / TERRA.rows), m = Math.max(1, Math.round(TERRA.cols * Math.cos(lat * RAD))); for (var k = 0; k < m; k++, n++) if ((bin.charCodeAt(n >> 3) >> (n & 7)) & 1) DOTS.push(v3(lat, -180 + (k + 0.5) * (360 / m))); }
    return DOTS;
  }
  /* il globo della sezione: lo stesso del riquadro (vivo.js), più grande, da girare col dito, con l'ora che si può spostare */
  function Globe(cv, cities, onPick) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1, dots = landDots(), cls = null, sunV = [0, 0, 1], clsAt = -1e15;
    var cs = cities.map(function (c) { return { id: c.id, name: c.name, v: v3(c.lat, c.lon), c: c }; }), mak = cs.filter(function (c) { return c.id === "makkah"; })[0], arcs = [];
    cs.forEach(function (c, i) {
      if (c === mak) return;
      var pts = [], om = Math.acos(clamp(dot3(c.v, mak.v), -1, 1)), lift = 0.04 + 0.2 * om;
      for (var k = 0; k <= 40; k++) { var t = k / 40, p = slerp(c.v, mak.v, t), s = 1 + lift * Math.sin(Math.PI * t); pts.push([p[0] * s, p[1] * s, p[2] * s]); }
      arcs.push({ pts: pts, ph: i * 0.27 });
    });
    /* parte da dove sta il globo del riquadro adesso (la stessa formula di vivo.js) */
    var t0 = performance.now();
    var G = { lon: 16 + 8 * Math.sin(t0 / 5200), lat: 27 + 2.5 * Math.sin(t0 / 7400), vlon: 0, vlat: 0, aim: null, sel: null, T: I.now(), proj: [] };
    function size() { var f = fitCv(cv, 2); if (f) { W = f.W; H = f.H; dpr = f.dpr; } }
    function geom() { return { rad: Math.min(W, H) * 0.4, cx: W / 2, cy: H * 0.5 }; }
    function sunUpdate() {
      var d = G.T; if (Math.abs(d.getTime() - clsAt) < 30000 && cls) return; clsAt = d.getTime();
      var e = A.sunEquatorial(d), lon = (e.ra - A.lstHours(d, 0)) * 15; lon = ((lon % 360) + 540) % 360 - 180;
      sunV = v3(e.dec, lon); cls = new Uint8Array(dots.length);
      for (var i = 0; i < dots.length; i++) { var s = dot3(dots[i], sunV); cls[i] = s > 0.12 ? 2 : s > -0.1 ? 1 : 0; }
    }
    function bucket(arr, fill) { if (!arr.length) return; ctx.fillStyle = fill; ctx.beginPath(); for (var i = 0; i < arr.length; i += 3) { var s = arr[i + 2]; ctx.rect(arr[i] - s / 2, arr[i + 1] - s / 2, s, s); } ctx.fill(); }
    function draw(t) {
      if (!W) return; sunUpdate();
      var g = geom(), rad = g.rad, cx = g.cx, cy = g.cy, live = !I.still();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var cy_ = Math.cos(-G.lon * RAD), sy_ = Math.sin(-G.lon * RAD), cx_ = Math.cos(G.lat * RAD), sx_ = Math.sin(G.lat * RAD);
      function R(v) { var x = v[0] * cy_ + v[2] * sy_, z = -v[0] * sy_ + v[2] * cy_; return [x, v[1] * cx_ - z * sx_, v[1] * sx_ + z * cx_]; }
      var gr = ctx.createRadialGradient(cx, cy, rad * 0.94, cx, cy, rad * 1.2); gr.addColorStop(0, "rgba(140,170,255,.3)"); gr.addColorStop(1, "rgba(140,170,255,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rad * 1.2, 0, 6.3); ctx.fill();
      gr = ctx.createRadialGradient(cx - rad * 0.28, cy - rad * 0.34, rad * 0.08, cx, cy, rad); gr.addColorStop(0, "rgba(58,78,160,.72)"); gr.addColorStop(0.62, "rgba(26,36,98,.74)"); gr.addColorStop(1, "rgba(12,16,50,.86)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.fill();
      var sv = R(sunV);
      if (sv[2] > -0.35) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.clip(); var gx = cx + sv[0] * rad, gy = cy - sv[1] * rad; gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad * 1.05); gr.addColorStop(0, "rgba(255,236,204,.2)"); gr.addColorStop(1, "rgba(255,236,204,0)"); ctx.fillStyle = gr; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); ctx.restore(); }
      ctx.strokeStyle = "rgba(170,190,255,.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.stroke();
      var b0 = [], b1 = [], b2 = [], i, p, ds = rad * 0.0125;
      for (i = 0; i < dots.length; i++) { p = R(dots[i]); if (p[2] <= 0.02) continue; (cls[i] === 2 ? b2 : cls[i] === 1 ? b1 : b0).push(cx + p[0] * rad, cy - p[1] * rad, (0.62 + 0.5 * p[2]) * ds); }
      bucket(b0, "rgba(128,146,224,.5)"); bucket(b1, "rgba(255,196,150,.94)"); bucket(b2, "rgba(240,244,255,.97)");
      ctx.lineWidth = 1; ctx.lineCap = "round";
      arcs.forEach(function (a) {
        var P = a.pts.map(R), k, open_ = false;
        ctx.strokeStyle = "rgba(255,232,190,.5)"; ctx.beginPath();
        for (k = 0; k < P.length; k++) { if (P[k][2] <= 0) { open_ = false; continue; } var x = cx + P[k][0] * rad, y = cy - P[k][1] * rad; if (open_) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open_ = true; } }
        ctx.stroke();
        if (!live) return;
        var u = ((t / 2600) + a.ph) % 1, e = eIO(u), fade = Math.sin(Math.PI * u);
        for (k = 0; k < 6; k++) { var j = Math.round(clamp(e * 40 - k * 0.9, 0, 40)), q = P[j]; if (q[2] <= 0) continue; ctx.fillStyle = "rgba(255,246,222," + (fade * (1 - k / 6) * 0.95).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(cx + q[0] * rad, cy - q[1] * rad, 2.1 - k * 0.24, 0, 6.3); ctx.fill(); }
      });
      G.proj = [];
      ctx.font = '600 12.5px Manrope, -apple-system, "Segoe UI", sans-serif'; ctx.textBaseline = "middle";
      cs.forEach(function (c) {
        var q = R(c.v); if (q[2] <= 0.02) return;
        var x = cx + q[0] * rad, y = cy - q[1] * rad, on = G.sel === c.id, big = c === mak ? 1.3 : 1;
        G.proj.push({ id: c.id, x: x, y: y });
        var gg = ctx.createRadialGradient(x, y, 0, x, y, 12 * big); gg.addColorStop(0, "rgba(255,226,170,.75)"); gg.addColorStop(1, "rgba(255,226,170,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 12 * big, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#fff8e8"; ctx.beginPath(); ctx.arc(x, y, 2.7 * big, 0, 6.3); ctx.fill();
        if (on) { var w = live ? (t % 1600) / 1600 : 0.35; ctx.strokeStyle = "rgba(255,240,208," + (0.8 * (1 - w)).toFixed(3) + ")"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, 5 + 14 * w, 0, 6.3); ctx.stroke(); }
        var left = q[0] < -0.1 || c.id === "casablanca", lx = x + (left ? -12 : 12);
        ctx.textAlign = left ? "right" : "left"; ctx.globalAlpha = on ? 1 : 0.72 * clamp((q[2] - 0.02) / 0.25, 0, 1);
        ctx.fillStyle = "rgba(6,10,34,.6)"; ctx.fillText(c.name, lx, y + 1.5); ctx.fillStyle = "#fff"; ctx.fillText(c.name, lx, y + 0.5); ctx.globalAlpha = 1;
      });
    }
    /* il moto: inerzia dopo il dito, molla verso una città scelta */
    var last = 0;
    function step(t) {
      var dt = last ? clamp(t - last, 0, 50) / 16.67 : 1; last = t;
      if (G.aim && !drag) {
        var dl = ((G.aim.lon - G.lon + 540) % 360) - 180, dla = G.aim.lat - G.lat;
        G.vlon += dl * 0.012 * dt; G.vlat += dla * 0.012 * dt; G.vlon *= Math.pow(0.84, dt); G.vlat *= Math.pow(0.84, dt);
        if (Math.abs(dl) < 0.05 && Math.abs(dla) < 0.05 && Math.abs(G.vlon) < 0.01) { G.aim = null; }
      } else if (!drag) { G.vlon *= Math.pow(0.95, dt); G.vlat *= Math.pow(0.92, dt); G.lat += (clamp(G.lat, -50, 60) - G.lat) * 0.2; }
      if (!drag) { G.lon += G.vlon * dt; G.lat = clamp(G.lat + G.vlat * dt, -70, 75); }
      draw(t);
    }
    function aimAt(id) { var c = cityById(id); G.sel = id; G.aim = { lon: c.lon, lat: clamp(c.lat * 0.85, -40, 50) }; if (I.still()) { G.lon = G.aim.lon; G.lat = G.aim.lat; G.aim = null; draw(now()); } }
    var drag = null, host_ = cv.parentNode;
    host_.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), lon: G.lon, lat: G.lat, moved: false, id: e.pointerId, mouse: e.pointerType === "mouse" }; G.aim = null; G.vlon = G.vlat = 0; });
    window.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (!drag.moved && !drag.mouse && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   /* sul telefono il dito in verticale scorre la pagina */
      drag.moved = true;
      var nt = performance.now(), k = Math.max(1, nt - drag.lt) / 16.67;
      G.vlon = -(e.clientX - drag.lx) * 0.42 / k; G.vlat = drag.mouse ? (e.clientY - drag.ly) * 0.3 / k : 0;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = nt;
      G.lon = drag.lon - dx * 0.42; if (drag.mouse) G.lat = clamp(drag.lat + dy * 0.3, -70, 75);
      if (I.still()) draw(now());
    });
    function up(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      if (!drag.moved && e && e.type === "pointerup") {      /* un tocco su una città la sceglie */
        var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 26;
        G.proj.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } });
        if (best && onPick) onPick(best.id);
      }
      if (performance.now() - drag.lt > 90) { G.vlon = 0; G.vlat = 0; }
      drag = null;
    }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    size();
    return { size: size, draw: draw, step: step, aim: aimAt, setTime: function (d) { G.T = d; }, geom: function () { return geom(); }, state: G };
  }
  /* la bussola: il centro è sopra la testa, il bordo è l'orizzonte; il Sole e la Luna dove sono, la qibla come una freccia */
  function domeSVG(st) {
    function pos(alt, az) { var r = alt >= 0 ? 48 * (1 - alt / 90) : 55, a = az * RAD; return [r * Math.sin(a), -r * Math.cos(a)]; }
    var s = pos(st.sun.alt, st.sun.az), m = pos(st.moon.alt, st.moon.az), sunUp = st.sun.alt > -0.833, moonUp = st.moon.alt > 0;
    var k = st.moon.fraction, rx = (4.4 * Math.abs(1 - 2 * k)).toFixed(2), lit = "M0 -4.4A4.4 4.4 0 0 1 0 4.4A" + rx + " 4.4 0 0 " + (k < 0.5 ? 0 : 1) + " 0 -4.4Z";
    var h = '<svg class="sz-dome" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">' +
      '<circle r="48" fill="rgba(4,8,30,.22)" stroke="rgba(255,255,255,.42)" stroke-width="1"/>' +
      '<circle r="32" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".8" stroke-dasharray="1.5 3"/><circle r="16" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".8" stroke-dasharray="1.5 3"/>' +
      '<circle r="55" fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".8" stroke-dasharray="1 4"/>' +
      '<g fill="rgba(255,255,255,.62)" font-family="Manrope, sans-serif" font-size="9" font-weight="700" text-anchor="middle"><text y="-50" dy="-3">N</text><text x="51" dy="3.2" text-anchor="start">E</text><text y="58" dy="3">S</text><text x="-51" dy="3.2" text-anchor="end">O</text></g>';
    if (st.id !== "makkah") { var qa = st.qibla.bearing * RAD, qx = 48 * Math.sin(qa), qy = -48 * Math.cos(qa); h += '<g stroke="#ffe7b8" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M0 0L' + qx.toFixed(2) + " " + qy.toFixed(2) + '" stroke-dasharray="2 3" opacity=".75"/><path transform="translate(' + qx.toFixed(2) + " " + qy.toFixed(2) + ") rotate(" + st.qibla.bearing.toFixed(1) + ')" d="M-3.6 4.2L0 0l3.6 4.2"/></g>'; }
    else h += '<circle r="5" fill="none" stroke="#ffe7b8" stroke-width="1.6"/>';
    h += '<g transform="translate(' + m[0].toFixed(2) + " " + m[1].toFixed(2) + ')" opacity="' + (moonUp ? 1 : 0.42) + '"><circle r="5" fill="#2b3470" stroke="rgba(255,255,255,.5)" stroke-width=".8"/><path d="' + lit + '" fill="#fff3d6"' + (st.moon.waxing ? "" : ' transform="scale(-1 1)"') + "/></g>";
    h += '<g transform="translate(' + s[0].toFixed(2) + " " + s[1].toFixed(2) + ')" opacity="' + (sunUp ? 1 : 0.45) + '">' + (sunUp ? '<circle r="11" fill="rgba(255,214,140,.28)"/>' : "") + '<circle r="5.6" fill="#ffd98f"/></g>';
    return h + '<circle r="1.4" fill="rgba(255,255,255,.5)"/></svg>';
  }
  function dirTxt(b) { return Math.round(b) + "° " + C.wind(b); }
  function hm(ms) { var m = Math.round(ms / 60000), h = Math.floor(m / 60); m -= h * 60; return h + " h " + (m < 10 ? "0" : "") + m + " min"; }
  function partOf(st) {
    var part = A.dayPart(st.sun.alt);
    if (part === "alba/tramonto") return st.sun.rising ? "alba" : "tramonto";
    if (part === "crepuscolo") return st.sun.rising ? "aurora" : "crepuscolo";
    return part;
  }
  function offTxt(o) { if (!o) return ""; var n = Math.abs(o), s = n === 1 ? "1 ora" : String(n).replace(".", ",") + " ore"; return s + (o > 0 ? " avanti" : " indietro"); }
  function buildCitta(b, ctx) {
    var tile = ctx.tile || $('.tile[data-tile="citta"]'), tLab = $(".tile__head .label--ink", tile), tCv = $("#globo", tile);
    var CITIES = ORDER.map(cityById), offMin = 0, T = I.now();
    var h = '<h2 class="sz-t" id="szTitle" tabindex="-1">Le città, adesso</h2><p class="sz-sub" id="szData" data-sz-in></p>' +
      '<div class="sz-globo" id="szGlobo"><canvas aria-hidden="true"></canvas></div>' +
      '<div class="sz-chips" role="group" aria-label="Gira il globo verso" data-sz-in>' + CITIES.map(function (c) { return '<button class="sz-chip" type="button" data-c="' + c.id + '" aria-pressed="false">' + esc(c.name) + "</button>"; }).join("") + "</div>" +
      '<div class="sz-card sz-ora" data-sz-in><div class="sz-ora__top"><p class="sz-ora__l" id="szOraL">Adesso</p><button class="sz-ora__now" type="button" id="szOraNow" hidden>Torna ad adesso</button></div>' +
      '<div class="sz-ora__r" id="szOra" role="slider" tabindex="0" aria-label="Sposta l’ora, da 12 ore fa a fra 12 ore" aria-valuemin="-720" aria-valuemax="720" aria-valuenow="0" aria-valuetext="adesso"><i class="sz-ora__tr"></i>' +
      [-12, -9, -6, -3, 0, 3, 6, 9, 12].map(function (k) { return '<i class="sz-ora__tk' + (k ? "" : " sz-ora__tk--0") + '" style="left:' + (50 + k / 24 * 100) + '%"></i>'; }).join("") + '<i class="sz-ora__fill"></i><i class="sz-ora__th"></i></div>' +
      '<p class="sz-ora__b" aria-hidden="true"><span>−12 h</span><span>sposta l’ora</span><span>+12 h</span></p></div>' +
      '<ul class="sz-cl">' + CITIES.map(function (c) {
        return '<li class="sz-cc" data-c="' + c.id + '" data-sz-in><div class="sz-cc__top"><div><h3 class="sz-cc__n">' + esc(c.name) + '</h3><span class="sz-cc__ar" lang="ar" dir="rtl"></span><p class="sz-cc__m js-m"></p></div>' +
          '<div><time class="sz-cc__t num js-t"><span class="js-hm"></span><small class="js-s"></small></time><p class="sz-cc__m sz-cc__p js-p"></p></div></div>' +
          '<div class="sz-cc__mid"><div class="js-dome"></div><div class="sz-f"><p>Sole<b class="js-sun"></b></p><p><span class="js-moonk">Luna</span><b class="js-moon"></b></p><p>Alba e tramonto<b class="js-rs num"></b></p></div></div>' +
          '<div class="sz-cc__q js-q"></div></li>';
      }).join("") + "</ul>" +
      '<div class="sz-note" data-sz-in><p>Tutto è calcolato qui, sul tuo telefono, e niente viene chiesto ad altri siti. Il Sole e la Luna: formule astronomiche semplificate (il Sole entro 0,05°, la Luna entro mezzo grado, vista dal posto e non dal centro della Terra). Alba e tramonto: quando il bordo alto del Sole tocca l’orizzonte (−0,833°, con la rifrazione).</p>' +
      "<p>La qibla: la direzione del cerchio massimo verso la Kaʿba (21,4225° N, 39,8262° E), contata da nord in senso orario; la distanza è sulla Terra come sfera di 6371 km. Il Marocco è a UTC+0 tutto l’anno dal 20 settembre 2026: l’ora di Casablanca la tiene giusta anche un telefono con i fusi vecchi.</p>" +
      '<p>I nomi in arabo vengono da Wikidata. Nella bussola il centro è sopra la testa e il bordo è l’orizzonte; la freccia tratteggiata è la qibla.</p></div>';
    b.innerHTML = h;
    $$(".sz-cc", b).forEach(function (li, i) { $(".sz-cc__ar", li).textContent = CITIES[i].ar; });   /* i nomi arabi: solo dal dato (Wikidata) */
    var gCv = $("#szGlobo canvas", b), globe = Globe(gCv, CITIES, pick), raf = 0, rolls = {};
    $$(".sz-cc", b).forEach(function (li) { rolls[li.getAttribute("data-c")] = { hm: Roll($(".js-hm", li)), s: Roll($(".js-s", li)) }; });
    function pick(id) {
      $$(".sz-chip", b).forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-c") === id ? "true" : "false"); });
      $$(".sz-cc", b).forEach(function (x) { x.classList.toggle("is-sel", x.getAttribute("data-c") === id); });
      globe.aim(id);
    }
    $(".sz-chips", b).addEventListener("click", function (e) { var c = e.target.closest ? e.target.closest(".sz-chip") : null; if (c) pick(c.getAttribute("data-c")); });
    var lastSec = "", lastFull = -1e15, lastOff = null;
    function paint(force) {
      var d = new Date(I.now().getTime() + offMin * 60000), sec = String(Math.floor(d.getTime() / 1000));
      globe.setTime(d);
      if (!force && sec === lastSec) return; lastSec = sec;
      var full = force || Math.abs(d.getTime() - lastFull) > 20000 || lastOff !== offMin;
      var dir = lastOff == null ? 1 : (offMin < lastOff ? -1 : 1); lastOff = offMin;
      var tor = cityById("torino");
      $("#szData", b).textContent = cap(A.localDate(d, "Europe/Rome")) + ". " + (offMin ? "A Torino saranno le " : "A Torino sono le ") + A.localTime(d, "Europe/Rome") + ".";
      if (offMin < 0) $("#szData", b).textContent = cap(A.localDate(d, "Europe/Rome")) + ". A Torino erano le " + A.localTime(d, "Europe/Rome") + ".";
      $$(".sz-cc", b).forEach(function (li, i) {
        var c = CITIES[i], tz = A.fixTz(c.tz, d), t = A.localTime(d, c.tz, true);
        rolls[c.id].hm.set(t.slice(0, 5), dir); rolls[c.id].s.set(t.slice(5), dir);
        if (!full) return;
        var st = C.city(c, d);
        li.setAttribute("style", skyVars(st.sun.alt, st.sun.rising ? 20 : 80));
        $(".js-m", li).textContent = c.country + (c.id === "torino" ? "" : " · " + (offTxt(st.off) || "stessa ora"));
        $(".js-p", li).textContent = partOf(st);
        $(".js-dome", li).innerHTML = domeSVG(st);
        $(".js-sun", li).textContent = st.sun.alt > -0.833 ? "alto " + Math.round(st.sun.alt) + "°, a " + C.wind(st.sun.az) : "sotto l’orizzonte";
        $(".js-moon", li).textContent = (st.moon.alt > 0 ? "alta " + Math.round(st.moon.alt) + "°, a " + C.wind(st.moon.az) : "sotto l’orizzonte");
        $(".js-moonk", li).textContent = "Luna, illuminata al " + Math.round(st.moon.fraction * 100) + "%";
        $(".js-rs", li).innerHTML = esc((st.riseT || "—") + " – " + (st.setT || "—")) + (st.light ? "<em>" + esc(hm(st.light)) + " di luce</em>" : "");
        var q = st.qibla;
        $(".js-q", li).innerHTML = c.id === "makkah" ? '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fff" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="9.2" opacity=".7"/><circle cx="11" cy="11" r="2.6" fill="#fff" stroke="none"/></svg><span>La qibla è qui</span><span>la Kaʿba è in città</span>'
          : '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="9.2" opacity=".7"/><g transform="rotate(' + q.bearing.toFixed(1) + ' 11 11)"><path d="M11 15.6V6.4"/><path d="M8.1 9.1L11 6.2l2.9 2.9"/></g></svg>' +
          "<span>Qibla a " + dirTxt(q.bearing) + "</span><span>" + fmtN(Math.round(q.km)) + " km dalla Kaʿba</span>";
      });
      if (full) lastFull = d.getTime();
    }
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    /* l'ora che si sposta: −12 h … +12 h, a scatti di 5 minuti; oltre i capi si tende un poco (elastico) e torna */
    var R = $("#szOra", b), th = $(".sz-ora__th", R), fill = $(".sz-ora__fill", R), trk = $(".sz-ora__tr", R), lab = $("#szOraL", b), nowB = $("#szOraNow", b);
    function oraTxt(m) { if (!m) return "Adesso"; var a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60, s = (h ? h + " h" : "") + (h && mm ? " " : "") + (mm ? mm + " min" : ""); return m > 0 ? "Fra " + s : s + " fa"; }
    function showOra(v, stretch) {
      var p = (v + 720) / 1440 * 100;
      th.style.left = p + "%"; fill.style.left = Math.min(p, 50) + "%"; fill.style.width = Math.abs(p - 50) + "%";
      trk.style.transform = stretch ? "scaleX(" + (1 + stretch).toFixed(4) + ")" : "";
      lab.textContent = oraTxt(v); nowB.hidden = !v;
      R.setAttribute("aria-valuenow", String(v)); R.setAttribute("aria-valuetext", oraTxt(v).toLowerCase());
    }
    function setOff(v) { offMin = clamp(Math.round(v / 5) * 5, -720, 720); showOra(offMin, 0); paint(true); }
    var od = null;
    function valAt(x) { var r = R.getBoundingClientRect(); return ((x - r.left) / r.width) * 1440 - 720; }
    R.addEventListener("pointerdown", function (e) { od = { id: e.pointerId }; R.classList.add("is-drag"); try { R.setPointerCapture(e.pointerId); } catch (x) { } move(e); });
    function move(e) {
      if (!od || e.pointerId !== od.id) return;
      var v = valAt(e.clientX), over = v < -720 ? v + 720 : v > 720 ? v - 720 : 0;
      offMin = clamp(Math.round(v / 5) * 5, -720, 720); paint(true);
      showOra(offMin, over ? 0.05 * Math.tanh(Math.abs(over) / 220) : 0);
      if (over) trk.style.transformOrigin = over < 0 ? "100% 50%" : "0 50%";
    }
    R.addEventListener("pointermove", move);
    function rel(e) {
      if (!od || e.pointerId !== od.id) return; od = null; R.classList.remove("is-drag");
      var cur = trk.style.transform; if (cur && !I.still()) { trk.style.transform = ""; trk.animate([{ transform: cur }, { transform: "none" }], { duration: 520, easing: SP_POP }); }
    }
    R.addEventListener("pointerup", rel); R.addEventListener("pointercancel", rel);
    R.addEventListener("keydown", function (e) {
      var k = e.key, v = offMin;
      if (k === "ArrowRight" || k === "ArrowUp") v += 15; else if (k === "ArrowLeft" || k === "ArrowDown") v -= 15; else if (k === "PageUp") v += 60; else if (k === "PageDown") v -= 60; else if (k === "Home") v = -720; else if (k === "End") v = 720; else return;
      e.preventDefault(); setOff(v);
    });
    var back = 0;
    nowB.addEventListener("click", function () {
      if (I.still()) { setOff(0); return; }
      var from = offMin, t0 = performance.now();
      cancelAnimationFrame(back);
      (function go() { var k = clamp((performance.now() - t0) / 700, 0, 1), e = 1 - Math.pow(1 - k, 4); offMin = Math.round(from * (1 - e)); showOra(offMin, 0); paint(true); if (k < 1) back = requestAnimationFrame(go); else setOff(0); })();
    });
    showOra(0, 0); paint(true);
    /* il globo della sezione parte dal posto di quello del riquadro: il suo cerchio combacia con il cerchio di là */
    function circleOf(cv, k, cyk) { var r = cv.getBoundingClientRect(), rad = Math.min(r.width, r.height) * k; return { left: r.left + r.width / 2 - rad, top: r.top + r.height * cyk - rad, width: rad * 2, height: rad * 2 }; }
    globe.size(); globe.draw(now());
    function frame(t) { raf = requestAnimationFrame(frame); globe.step(t); paint(false); }
    return {
      share: [{ a: tCv, b: gCv, kind: "scale", aBox: function () { return circleOf(tCv, 0.385, 0.515); }, bBox: function () { return circleOf(gCv, 0.4, 0.5); } }, { a: tLab, b: $("#szTitle", b), kind: "text" }],
      start: function () { globe.size(); if (I.still()) { globe.draw(now()); var tk = setInterval(function () { paint(false); }, 1000); this._tk = tk; return; } raf = requestAnimationFrame(frame); },
      stop: function () { cancelAnimationFrame(raf); cancelAnimationFrame(back); clearInterval(this._tk); },
      pick: pick, setOff: setOff,
      retheme: function () { globe.draw(now()); }
    };
  }

  /* ================================================================ HEATMAP */
  function tokOf(name, d) { var v = getComputedStyle(panel).getPropertyValue(name).trim(); return v || d; }
  function trip(name, d) { return tokOf(name, d).split(/[\s,]+/).join(","); }
  function hmColors() { var cs = getComputedStyle(panel); return [0, 1, 2, 3, 4].map(function (i) { return cs.getPropertyValue("--hm-" + i).trim() || ["rgba(227,231,244,.085)", "#5a4a2c", "#94713a", "#d2a352", "#f7dc9a"][i]; }); }
  function rrect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); }
  /* le 53 settimane come nel riquadro (vivi.js): colonne di sette giorni, il lunedì in alto, l'ultima colonna è la settimana di oggi */
  function weeks(list, endMs) {
    var DAY = 86400000, end = endMs, endMon = end - C.wdOf(end) * DAY, cells = new Array(371);
    for (var k = 0; k < cells.length; k++) cells[k] = null;
    list.forEach(function (x, i) { var w = C.wdOf(x.ms), col = 52 - Math.round((endMon - (x.ms - w * DAY)) / (7 * DAY)); if (col >= 0 && col <= 52) cells[col * 7 + w] = i; });
    return cells;
  }
  function oggi() { var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(I.now()).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function Strip(cv, list, cells, onDay) {
    var ctx = cv.getContext("2d"), G = null, hover = -1, COL = hmColors(), LBL = tokOf("--hm-label", "rgba(227,231,244,.6)");
    function fit() {
      var wrap = cv.parentNode, avW = wrap.clientWidth; if (avW < 100) return;
      var d = Math.min(window.devicePixelRatio || 1, 3), g = Math.max(1, Math.round(d)), Wd = Math.floor(avW * d), p = Math.floor((Wd + g) / 53), s = p - g, maxS = Math.round(14 * d);
      if (s > maxS) { s = maxS; p = s + g; }
      var mh = Math.round(15 * d);
      G = { d: d, s: s, g: g, p: p, mh: mh, W: 53 * p - g, H: mh + 7 * p - g };
      cv.width = G.W; cv.height = G.H; cv.style.width = (G.W / d) + "px"; cv.style.height = (G.H / d) + "px";
    }
    function draw() {
      if (!G) return;
      var d = G.d, s = G.s, p = G.p, rad = Math.max(1, Math.round(s * 0.24)), top = G.mh;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, G.W, G.H);
      ctx.font = "500 " + Math.round(9.5 * d) + 'px "Geist Mono", ui-monospace, Menlo, monospace'; ctx.textBaseline = "alphabetic"; ctx.fillStyle = LBL;
      var lastCol = -9;
      for (var c = 0; c < 53; c++) for (var r = 0; r < 7; r++) { var ii = cells[c * 7 + r]; if (ii == null) continue; var dt = new Date(list[ii].ms); if (dt.getUTCDate() === 1 && c - lastCol >= (G.W / d < 560 ? 8 : 4)) { ctx.fillText(["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"][dt.getUTCMonth()], c * p, Math.round(10 * d)); lastCol = c; } }
      for (var lv = 0; lv < 5; lv++) {
        ctx.beginPath(); ctx.fillStyle = COL[lv];
        for (var i = 0; i < cells.length; i++) { var x = cells[i]; if (x == null || i === hover) continue; if ((list[x].l || 0) !== lv) continue; rrect(ctx, Math.floor(i / 7) * p, top + (i % 7) * p, s, s, rad); }
        ctx.fill();
      }
      if (hover >= 0 && cells[hover] != null) {
        var hx = list[cells[hover]], big = s * 1.6, oo = (s - big) / 2, bx = Math.floor(hover / 7) * p + oo, by = top + (hover % 7) * p + oo - 1.2 * d;
        ctx.save(); ctx.shadowColor = "rgba(4,6,18,.75)"; ctx.shadowBlur = 5 * d; ctx.shadowOffsetY = 1.5 * d;
        ctx.beginPath(); ctx.fillStyle = hx.l > 0 ? COL[hx.l] : "#5c637e"; rrect(ctx, bx, by, big, big, rad * 1.5); ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.lineWidth = Math.max(1, Math.round(d)); ctx.strokeStyle = "rgba(255,255,255,.85)"; rrect(ctx, bx + 0.5 * d, by + 0.5 * d, big - d, big - d, rad * 1.5); ctx.stroke();
      }
    }
    function at(cx, cy) {
      if (!G) return -1; var r = cv.getBoundingClientRect(), d = G.d, x = (cx - r.left) * d, y = (cy - r.top) * d - G.mh;
      var c = clamp(Math.floor((x + G.g / 2) / G.p), 0, 52), w = clamp(Math.floor((y + G.g / 2) / G.p), 0, 6), i = c * 7 + w;
      while (i > 0 && cells[i] == null) i--; return cells[i] != null ? i : -1;
    }
    function set(listIdx) { hover = -1; if (listIdx != null && listIdx >= 0) for (var i = 0; i < cells.length; i++) if (cells[i] === listIdx) { hover = i; break; } draw(); }
    var t = null;
    cv.addEventListener("pointerdown", function (e) { t = { id: e.pointerId, x: e.clientX, y: e.clientY, on: e.pointerType === "mouse" }; if (t.on) { var i = at(e.clientX, e.clientY); if (i >= 0) onDay(cells[i]); } });
    cv.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") { var i = at(e.clientX, e.clientY); if (i >= 0) onDay(cells[i]); return; }
      if (!t || t.id !== e.pointerId) return;
      if (!t.on && Math.abs(e.clientX - t.x) > 5 && Math.abs(e.clientX - t.x) > Math.abs(e.clientY - t.y)) t.on = true;
      if (t.on) { var j = at(e.clientX, e.clientY); if (j >= 0) onDay(cells[j]); }
    });
    cv.addEventListener("pointerup", function (e) { if (t && !t.on && e.pointerType !== "mouse") { var i = at(e.clientX, e.clientY); if (i >= 0) onDay(cells[i]); } t = null; });
    cv.addEventListener("pointercancel", function () { t = null; });
    fit(); draw();
    return { fit: function () { fit(); draw(); }, draw: draw, set: set, retheme: function () { COL = hmColors(); LBL = tokOf("--hm-label", "rgba(227,231,244,.6)"); draw(); } };
  }
  function buildHeat(b, ctx) {
    var tile = ctx.tile || $('.tile[data-tile="heatmap"]'), tLab = $(".tile__head .label--ink", tile), tCv = $("#heatCv", tile), tNum = $(".hm__riga b", tile);
    var out = { share: [{ a: tLab, b: null, kind: "text" }, { a: tCv, b: null, kind: "scale" }] };
    var h = '<h2 class="sz-t" id="szTitle" tabindex="-1">Heatmap</h2><p class="sz-sub" data-sz-in>Un anno su GitHub, giorno per giorno.</p><div id="szH"></div>';
    b.innerHTML = h; out.share[0].b = $("#szTitle", b);
    var host_ = $("#szH", b);
    var fillNow = null;
    function fill(j) {
      var H = C.heat(j);
      if (!S.id || S.id !== "heatmap") return;
      var list, cells, endMs;
      if (H) { list = H.days; endMs = H.last.ms; } else { endMs = oggi(); list = []; for (var t = endMs - (52 * 7 + C.wdOf(endMs)) * 86400000; t <= endMs; t += 86400000) list.push({ ms: t, n: null, l: 0 }); }
      cells = weeks(list, endMs);
      var x = "";
      if (H && H.counts) x += '<p class="sz-big" data-sz-in><b class="num" id="szTot">' + fmtN(H.total != null ? H.total : H.sum) + "</b><span>contributi nell’ultimo anno</span></p>";
      x += '<div class="sz-strip" data-sz-strip><canvas tabindex="0" aria-label="I giorni dell’anno. Con le frecce scorri i giorni." aria-describedby="szRead"></canvas></div><p class="sz-read" id="szRead" aria-live="polite" data-sz-in></p>';
      if (!H) {
        x += '<p class="sz-vuoto" data-sz-in>Si aggiorna tra poco.</p><div class="sz-pills" data-sz-in><a class="sz-pill" href="https://github.com/imadchatraoui" target="_blank" rel="noopener">Il profilo su GitHub' + ICO.out + '<span class="sr"> (si apre in una nuova scheda)</span></a></div>';
        host_.innerHTML = x;
      } else {
        var lg = H.longest, cu = H.current, bu = H.busiest;
        x += '<div class="sz-stats">' +
          '<div class="sz-card sz-stat" data-sz-in><b class="num">' + fmtN(H.active) + "</b><span>giorni con contributi</span><em>su " + fmtN(H.span) + " del calendario</em></div>" +
          '<div class="sz-card sz-stat" data-sz-in data-go="' + (lg ? list.indexOf(lg.to) : -1) + '"><b class="num">' + (lg ? lg.n + "<small>" + (lg.n === 1 ? "giorno" : "giorni") + "</small>" : "—") + "</b><span>la serie più lunga</span><em>" + (lg ? esc(C.rangeLabel(lg.from, lg.to)) : "nessuna") + "</em></div>" +
          (bu ? '<div class="sz-card sz-stat" data-sz-in data-go="' + list.indexOf(bu.day) + '"><b class="num">' + fmtN(bu.n) + "</b><span>il giorno più pieno</span><em>" + esc(C.dayLabel(bu.day, true, true)) + (bu.ties > 1 ? ", e altri " + (bu.ties - 1) : "") + "</em></div>" : "") +
          '<div class="sz-card sz-stat" data-sz-in><b class="num">' + (cu ? cu.n + "<small>" + (cu.n === 1 ? "giorno" : "giorni") + "</small>" : "0") + "</b><span>la serie in corso</span><em>" + (cu ? (cu.untilYesterday ? "fino a ieri: oggi non è finito" : "fino a oggi") : "per ora nessuna") + "</em></div></div>";
        if (!H.counts) x += '<p class="sz-cap" data-sz-in style="margin-top:12px">I conti di ogni giorno non sono arrivati: qui ci sono solo i livelli.</p>';
        /* mese per mese */
        var mx = 0; H.months.forEach(function (m) { var v = H.counts ? m.sum : m.active; if (v > mx) mx = v; });
        x += '<h3 class="sz-h" data-sz-in>Mese per mese</h3><p class="sz-cap" data-sz-in>' + (H.counts ? "I contributi di ogni mese." : "I giorni con contributi di ogni mese.") + " A righe i mesi che il calendario prende solo in parte.</p>" +
          '<div class="sz-bars" data-sz-in role="group" aria-label="Mese per mese">' + H.months.map(function (m, i) {
            var v = H.counts ? m.sum : m.active, hh = mx ? Math.max(2, v / mx * 100) : 2;
            return '<button class="sz-bar' + (m.partial ? " is-part" : "") + (v ? "" : " is-zero") + '" type="button" data-m="' + i + '" aria-label="' + esc(m.name + " " + m.y + ": " + (H.counts ? v + " contributi" : v + " giorni con contributi")) + '"><i style="--h:' + hh.toFixed(1) + '%"></i><u>' + m.short.charAt(0).toUpperCase() + "</u></button>";
          }).join("") + "</div>";
        /* la settimana */
        var wmx = 0; H.week.forEach(function (w) { var v = H.counts ? w.sum : w.active; if (v > wmx) wmx = v; });
        var bw = H.bestWeekday;
        x += '<h3 class="sz-h" data-sz-in>La settimana</h3><p class="sz-cap" data-sz-in>' + (H.counts ? "Tutti i contributi dell’anno, per giorno della settimana. Il più pieno è " + ["il lunedì", "il martedì", "il mercoledì", "il giovedì", "il venerdì", "il sabato", "la domenica"][bw.wd] + ": " + fmtN(bw.sum) + " in " + bw.count + " " + ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabati", "domeniche"][bw.wd] + "." : "I giorni con contributi, per giorno della settimana.") + "</p>" +
          '<div class="sz-wk" data-sz-in>' + H.week.map(function (w) { var v = H.counts ? w.sum : w.active; return '<div class="sz-wk__r' + (w === bw ? " is-top" : "") + '"><span>' + w.short + '</span><i style="--w:' + (wmx ? (v / wmx * 100).toFixed(1) : 0) + '%"></i><b class="num">' + fmtN(v) + "</b></div>"; }).join("") + "</div>";
        /* i mesi come calendari */
        x += '<h3 class="sz-h" data-sz-in>Giorno per giorno</h3><p class="sz-cap" data-sz-in>Tocca un giorno per leggerlo. Settimane da lunedì.</p><div class="sz-cal" data-sz-in>' + H.months.map(function (m) {
          var first = Date.UTC(m.y, m.m, 1), lead = C.wdOf(first), g = "", byDay = {};
          m.days.forEach(function (d) { byDay[new Date(d.ms).getUTCDate()] = list.indexOf(d); });
          for (var k = 0; k < lead; k++) g += '<i class="v"></i>';
          for (var dd = 1; dd <= m.len; dd++) { var ix = byDay[dd]; g += ix == null ? '<i class="x"></i>' : '<i class="l' + list[ix].l + '" data-i="' + ix + '"></i>'; }
          return '<div class="sz-mo"><p class="sz-mo__h"><b>' + esc(m.name) + (m.y !== H.last && new Date(H.last.ms).getUTCFullYear() !== m.y ? " <small>" + m.y + "</small>" : "") + "</b><span>" + (H.counts ? fmtN(m.sum) : m.active + " g") + '</span></p><div class="sz-mo__g">' + g + "</div></div>";
        }).join("") + "</div>" +
          '<div class="sz-legend" data-sz-in><span>meno</span><i style="background:var(--hm-0)"></i><i style="background:var(--hm-1)"></i><i style="background:var(--hm-2)"></i><i style="background:var(--hm-3)"></i><i style="background:var(--hm-4)"></i><span>più</span></div>';
        x += '<div class="sz-note" data-sz-in><p>Dal calendario pubblico dei contributi di GitHub di imadchatraoui' + (H.updated ? ", " + esc(letto(H.updated)) : "") + ". I conti li fa questa pagina, sui " + fmtN(H.span) + " giorni del calendario, " + esc(C.rangeLabel(H.first, H.last)) + ".</p>" +
          '<p><a href="https://github.com/imadchatraoui" target="_blank" rel="noopener">Il profilo su GitHub</a></p></div>';
        host_.innerHTML = x;
      }
      var sCv = $(".sz-strip canvas", host_), read = $("#szRead", host_), sel = null;
      var strip = Strip(sCv, list, cells, function (i) { choose(i, "strip"); });
      out.retheme = function () { strip.retheme(); };
      out.share[1].b = sCv;
      function dayTxt(i) {
        var x = list[i]; if (!x) return "";
        var s = "<b>" + esc(C.dayLabel(x, new Date(x.ms).getUTCFullYear() !== new Date(endMs).getUTCFullYear(), false)) + "</b>";
        if (typeof x.n === "number") s += " · " + (x.n === 0 ? "nessun contributo" : x.n === 1 ? "1 contributo" : fmtN(x.n) + " contributi");
        return s;
      }
      function choose(i, from) {
        if (i == null || i < 0 || !list[i] || !H) return;
        sel = i; read.innerHTML = dayTxt(i); strip.set(i);
        $$(".sz-mo__g i.is-on", host_).forEach(function (n) { n.classList.remove("is-on"); });
        var c = $('.sz-mo__g i[data-i="' + i + '"]', host_); if (c) c.classList.add("is-on");
        $$(".sz-bar.is-on", host_).forEach(function (n) { n.classList.remove("is-on"); });
      }
      function chooseMonth(k) {
        var m = H.months[k]; if (!m) return;
        $$(".sz-bar", host_).forEach(function (n) { n.classList.toggle("is-on", +n.getAttribute("data-m") === k); });
        read.innerHTML = "<b>" + esc(m.name.charAt(0).toUpperCase() + m.name.slice(1) + " " + m.y) + "</b> · " + (H.counts ? fmtN(m.sum) + (m.sum === 1 ? " contributo" : " contributi") + " in " : "") + m.active + (m.active === 1 ? " giorno" : " giorni") + (m.partial ? " (dal calendario, " + m.present + " giorni su " + m.len + ")" : "");
        strip.set(-1); $$(".sz-mo__g i.is-on", host_).forEach(function (n) { n.classList.remove("is-on"); });
      }
      if (H) {
        read.innerHTML = H.counts ? "Passa sui giorni, o toccane uno." : "Passa sui giorni, o toccane uno.";
        host_.addEventListener("click", function (e) {
          var t = e.target; if (!t.closest) return;
          var c = t.closest(".sz-mo__g i[data-i]"); if (c) { choose(+c.getAttribute("data-i")); return; }
          var bb = t.closest(".sz-bar"); if (bb) { chooseMonth(+bb.getAttribute("data-m")); return; }
          var st = t.closest("[data-go]"); if (st && +st.getAttribute("data-go") >= 0) { choose(+st.getAttribute("data-go")); try { sCv.scrollIntoView({ block: "center", behavior: I.still() ? "auto" : "smooth" }); } catch (x) { } }
        });
        if (fine()) host_.addEventListener("pointerover", function (e) { var c = e.target.closest ? e.target.closest(".sz-mo__g i[data-i]") : null; if (c) choose(+c.getAttribute("data-i")); });
        sCv.addEventListener("keydown", function (e) {
          var i = sel == null ? list.length - 1 : sel, k = e.key, n = i;
          if (k === "ArrowLeft") n = i - 7; else if (k === "ArrowRight") n = i + 7; else if (k === "ArrowUp") n = i - 1; else if (k === "ArrowDown") n = i + 1; else if (k === "Home") n = 0; else if (k === "End") n = list.length - 1; else return;
          e.preventDefault(); choose(clamp(n, 0, list.length - 1));
        });
        if (ctx.day) { var di = -1; list.forEach(function (x, ii) { if (x.ms === ctx.day) di = ii; }); if (di >= 0) choose(di); }
      }
      fillNow = { H: H, strip: strip };
      return fillNow;
    }
    withData("contributi", fill);
    out.start = function () {
      if (!fillNow || !fillNow.H || I.still()) return;
      /* i numeri arrivano rotolando, le barre crescono dal basso, a scalini */
      var tot = $("#szTot", b); if (tot) { var to = fillNow.H.total != null ? fillNow.H.total : fillNow.H.sum, t0 = performance.now(); (function go() { var k = clamp((performance.now() - t0) / 900, 0, 1), e = 1 - Math.pow(1 - k, 4); tot.textContent = fmtN(Math.round(to * e)); if (k < 1) requestAnimationFrame(go); })(); }
      $$(".sz-bar i", b).forEach(function (n, i) { n.animate([{ transform: "scaleY(0)" }, { transform: "none" }], { duration: 640, delay: i * 32, easing: SP_POP, fill: "backwards" }); });
      $$(".sz-wk__r i", b).forEach(function (n, i) { n.animate([{ transform: "scaleX(0)" }, { transform: "none" }], { duration: 640, delay: 120 + i * 40, easing: SP_POP, fill: "backwards" }); });
    };
    return out;
  }

  /* ================================================================ STO IMPARANDO */
  /* IcosahedronGeometry(1, n) come in three.js: ogni faccia divisa in (n+1)² triangoli, i vertici portati sulla sfera */
  function icosa(n) {
    var t = (1 + Math.sqrt(5)) / 2, base = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    function norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
    var V = [], key = {}, E = [], seen = {}, faces = 0, N = n + 1;
    function vid(p) { var q = norm(p), k = q.map(function (c) { return Math.round(c * 1e5); }).join(","); if (key[k] === undefined) { key[k] = V.length; V.push(q); } return key[k]; }
    function edge(a, b) { var k = a < b ? a + "_" + b : b + "_" + a; if (!seen[k]) { seen[k] = 1; E.push([a, b]); } }
    F.forEach(function (f) {
      var A_ = base[f[0]], B = base[f[1]], C_ = base[f[2]], grid = [];
      for (var i = 0; i <= N; i++) { grid.push([]); for (var j = 0; j <= N - i; j++) { var u = i / N, w = j / N, s = 1 - u - w; grid[i].push(vid([A_[0] * s + B[0] * u + C_[0] * w, A_[1] * s + B[1] * u + C_[1] * w, A_[2] * s + B[2] * u + C_[2] * w])); } }
      for (var i2 = 0; i2 < N; i2++) for (var j2 = 0; j2 < N - i2; j2++) {
        var a = grid[i2][j2], b = grid[i2 + 1][j2], c = grid[i2][j2 + 1]; edge(a, b); edge(b, c); edge(c, a); faces++;
        if (j2 < N - i2 - 1) { var d = grid[i2 + 1][j2 + 1]; edge(b, d); edge(d, c); faces++; }
      }
    });
    return { V: V, E: E, faces: faces };
  }
  function Solid(cv, detail) {
    var ctx = cv.getContext("2d"), G = null, M = icosa(detail), P = [], Z = null, order = null, IPL = trip("--ip-line", "227 231 244"), IPD = trip("--ip-dot", "240 242 252");
    var S_ = { yaw: 0.6, pitch: 0.42, vyaw: 0, vpitch: 0, scale: 1, sv: 0 };
    function prep() { P = M.V.map(function () { return [0, 0, 0]; }); Z = new Float32Array(M.E.length); order = M.E.map(function (x, i) { return i; }); }
    prep();
    function fit() { var f = fitCv(cv, 2); if (!f) { G = null; return; } G = { W: f.W, H: f.H, dpr: f.dpr, cx: f.W / 2, cy: f.H / 2, R: Math.min(f.W, f.H) * 0.36 }; }
    function draw() {
      if (!G) return;
      var d = G.dpr, a = S_.yaw, tilt = S_.pitch, ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt), cam = 3.6, R = G.R * S_.scale;
      for (var i = 0; i < M.V.length; i++) { var v = M.V[i], x = v[0] * ca + v[2] * sa, z = -v[0] * sa + v[2] * ca, y = v[1], y2 = y * ct - z * st, z2 = y * st + z * ct, k = cam / (cam - z2) * (cam - 1) / cam; P[i][0] = G.cx + x * R * k; P[i][1] = G.cy - y2 * R * k; P[i][2] = z2; }
      for (var j = 0; j < M.E.length; j++) Z[j] = (P[M.E[j][0]][2] + P[M.E[j][1]][2]) / 2;
      order.sort(function (p, q) { return Z[p] - Z[q]; });
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, G.W, G.H); ctx.lineCap = "round";
      var thin = M.E.length > 300 ? 0.75 : 1;
      for (var o = 0; o < order.length; o++) { var ei = order[o], e = M.E[ei], zz = (Z[ei] + 1) / 2, al = (0.06 + 0.62 * Math.pow(zz, 1.6)) * thin; ctx.beginPath(); ctx.strokeStyle = "rgba(" + IPL + "," + al.toFixed(3) + ")"; ctx.lineWidth = (0.8 + 0.8 * zz) * thin; ctx.moveTo(P[e[0]][0], P[e[0]][1]); ctx.lineTo(P[e[1]][0], P[e[1]][1]); ctx.stroke(); }
      ctx.fillStyle = "rgba(" + IPD + ",.95)";
      for (var q = 0; q < P.length; q++) { if (P[q][2] < 0.35) continue; var zr = (P[q][2] - 0.35) / 0.65; ctx.globalAlpha = 0.25 + 0.65 * zr; ctx.beginPath(); ctx.arc(P[q][0], P[q][1], 1 + 0.9 * zr, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    var last = 0, drag = null;
    function step(t) {
      var dt = last ? clamp(t - last, 0, 50) / 16.67 : 1; last = t;
      if (!drag) { S_.vyaw = lerp(S_.vyaw, 0.0031, 1 - Math.pow(0.97, dt)); S_.vpitch *= Math.pow(0.93, dt); S_.yaw += S_.vyaw * dt; S_.pitch += S_.vpitch * dt; S_.pitch += (clamp(S_.pitch, -0.9, 1.2) - S_.pitch) * 0.15; }
      S_.sv += (1 - S_.scale) * 0.16 * dt; S_.sv *= Math.pow(0.78, dt); S_.scale += S_.sv * dt;
      draw();
    }
    var host_ = cv.parentNode;
    host_.addEventListener("pointerdown", function (e) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false, mouse: e.pointerType === "mouse" }; });
    window.addEventListener("pointermove", function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      if (!drag.moved) { if (Math.abs(e.clientX - drag.x) < 6 && Math.abs(e.clientY - drag.y) < 6) return; if (!drag.mouse && Math.abs(e.clientY - drag.y) > Math.abs(e.clientX - drag.x)) { drag = null; return; } drag.moved = true; }
      var nt = performance.now(), k = Math.max(1, nt - drag.lt) / 16.67;
      S_.yaw += dx * 0.011; S_.vyaw = dx * 0.011 / k; if (drag.mouse) { S_.pitch += dy * 0.009; S_.vpitch = dy * 0.009 / k; }
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = nt;
      if (I.still()) draw();
    });
    function up(e) { if (!drag || drag.id !== e.pointerId) return; if (performance.now() - drag.lt > 90) { S_.vyaw = 0; S_.vpitch = 0; } drag = null; }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    fit(); draw();
    return { retheme: function () { IPL = trip("--ip-line", "227 231 244"); IPD = trip("--ip-dot", "240 242 252"); draw(); }, fit: fit, draw: draw, step: step, detail: function (n) { M = icosa(n); prep(); S_.scale = 0.9; S_.sv = 0; if (I.still()) { S_.scale = 1; } draw(); return M; }, mesh: function () { return M; }, geom: function () { return G; } };
  }
  function buildImpara(b, ctx) {
    var tile = ctx.tile || $('.tile[data-tile="imparando"]'), tLab = $(".tile__head .label--ink", tile), tT = $(".ip__t", tile), tCv = $("#imparaCv", tile);
    var detail = 1, raf = 0;
    var h = '<p class="sz-k" id="szKick">Sto imparando</p><h2 class="sz-t" id="szTitle" tabindex="-1" lang="en">Three.js Journey</h2><p class="sz-desc" id="szDesc" data-sz-in lang="en"></p>' +
      '<div class="sz-solid" id="szSolid"><canvas aria-hidden="true"></canvas></div>' +
      '<div class="sz-step" data-sz-in><button type="button" id="szMeno" aria-label="Meno dettaglio">' + ICO.minus + '</button><p class="sz-step__v" aria-live="polite"><b id="szGeo"></b><span id="szGeoN"></span></p><button type="button" id="szPiu" aria-label="Più dettaglio">' + ICO.plus + "</button></div>" +
      '<div id="szImp"></div>';
    b.innerHTML = h;
    var sCv = $("#szSolid canvas", b), solid = Solid(sCv, detail), geo = $("#szGeo", b), geoN = $("#szGeoN", b), meno = $("#szMeno", b), piu = $("#szPiu", b);
    function showGeo(M) {
      geo.textContent = "IcosahedronGeometry(1, " + detail + ")";
      geoN.textContent = fmtN(M.V.length) + " vertici · " + fmtN(M.E.length) + " spigoli · " + fmtN(M.faces) + " facce";
      meno.disabled = detail <= 0; piu.disabled = detail >= 4;
    }
    showGeo(solid.mesh());
    meno.addEventListener("click", function () { if (detail > 0) { detail--; showGeo(solid.detail(detail)); } });
    piu.addEventListener("click", function () { if (detail < 4) { detail++; showGeo(solid.detail(detail)); } });
    var host_ = $("#szImp", b);
    function fill(j) {
      if (!S.id || S.id !== "imparando") return;
      var L = j && j.ok ? j.learning : null, repo = null;
      if (j && j.ok && j.repos) repo = j.repos.filter(function (r) { return L && r && r.name === L.repo; })[0] || null;
      var url = ghUrl(L && L.url, "https://github.com/imadchatraoui/threejs-journey");
      if (repo && repo.description) $("#szDesc", b).textContent = repo.description;
      var x = "";
      if (!L) {
        x = '<p class="sz-vuoto">Gli ultimi commit si aggiornano tra poco.</p>';
      } else {
        var cs = (L.commits || []).filter(function (c) { return c && typeof c.message === "string" && c.message.replace(/\s/g, ""); });
        x += '<h3 class="sz-h" data-sz-in>Gli ultimi commit</h3><ol class="sz-log" data-sz-in>' + cs.map(function (c) {
          /* lo sha corto, in minuscolo, è il link al commit (solo se la rotta l'ha dato e il link è github.com/<utente>/<repo>/commit/<sha>) */
          var sha = typeof c.sha7 === "string" && /^[0-9a-f]{7}$/.test(c.sha7) ? c.sha7 : "", cu = sha && typeof c.url === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+\/commit\/[0-9a-f]{40}$/.test(c.url) ? c.url : "";
          var shaH = !sha ? "" : cu ? ' <a class="sz-sha" href="' + esc(cu) + '" target="_blank" rel="noopener" aria-label="Il commit ' + sha + ' su GitHub, si apre in una nuova scheda">' + sha + "</a>" : ' <i class="sz-sha">' + sha + "</i>";
          return '<li><b lang="en">' + esc(c.message.split(/\r?\n/)[0].replace(/^\s+|\s+$/g, "").slice(0, 140)) + "</b><span>" + esc(fa(c.date)) + " · " + esc(quando(c.date)) + shaH + "</span></li>";
        }).join("") + "</ol>";
        if (!cs.length) x += '<p class="sz-cap">Nessun commit da mostrare.</p>';
        var f = [];
        if (repo && repo.language) f.push(esc(repo.language));
        if (L.pushedAt && fa(L.pushedAt)) f.push("aggiornato " + esc(fa(L.pushedAt)));
        if (repo && repo.stars > 0) f.push(repo.stars === 1 ? "1 stella" : fmtN(repo.stars) + " stelle");
        if (f.length) x += '<div class="sz-facts" data-sz-in>' + f.map(function (s) { return "<span>" + s + "</span>"; }).join("") + "</div>";
      }
      x += '<div class="sz-pills" data-sz-in><a class="sz-pill" href="' + esc(url) + '" target="_blank" rel="noopener">Il repository su GitHub' + ICO.out + '<span class="sr"> (si apre in una nuova scheda)</span></a></div>';
      x += '<div class="sz-note" data-sz-in><p>Il solido è una IcosahedronGeometry di three.js disegnata qui a fil di ferro: trascinalo per farlo girare, e cambia il dettaglio. I conti di vertici, spigoli e facce sono quelli del solido che vedi.</p>' + (j && j.updated ? "<p>I commit vengono dal repository pubblico su GitHub, " + esc(letto(j.updated)) + ".</p>" : "") + "</div>";
      host_.innerHTML = x;
    }
    withData("progetti", fill);
    function solidCircle(cv, R, cy) { var r = cv.getBoundingClientRect(); return { left: r.left + r.width / 2 - R, top: r.top + cy - R, width: R * 2, height: R * 2 }; }
    function tileSolid() {
      var tr = tile.getBoundingClientRect(), hr = $(".tile__head", tile).getBoundingClientRect(), xr = tT.getBoundingClientRect(), cr = tCv.getBoundingClientRect();
      var topY = hr.bottom - tr.top, botY = xr.top - tr.top, Rr = Math.max(16, Math.min(cr.width * 0.2, (botY - topY) * 0.5 - 3)), cy = topY + (botY - topY) * 0.5;
      return { left: cr.left + cr.width / 2 - Rr, top: tr.top + cy - Rr, width: Rr * 2, height: Rr * 2 };
    }
    function frame(t) { raf = requestAnimationFrame(frame); solid.step(t); }
    return {
      share: [{ a: tCv, b: sCv, kind: "scale", aBox: tileSolid, bBox: function () { var g = solid.geom(); return g ? solidCircle(sCv, g.R, g.cy) : sCv.getBoundingClientRect(); } }, { a: tT, b: $("#szTitle", b), kind: "text" }, { a: tLab, b: $("#szKick", b), kind: "text" }],
      start: function () { solid.fit(); solid.draw(); if (!I.still()) raf = requestAnimationFrame(frame); },
      stop: function () { cancelAnimationFrame(raf); },
      retheme: function () { solid.retheme(); }
    };
  }

  /* le risposte delle rotte, appena ci sono: una sezione che si apre le trova subito e si costruisce intera prima di muoversi */
  var GOT = {};
  I.whenFree(function () { ["contributi", "progetti"].forEach(function (n) { I.api(n).then(function (j) { GOT[n] = j; }, function () { GOT[n] = { ok: false }; }); }); });
  function withData(name, fn) { if (GOT[name] !== undefined) { fn(GOT[name]); return; } I.api(name).then(fn, function () { fn(null); }); }

  var SEC = {
    corano: { mat: "paper", title: "Corano", build: buildCorano },
    citta: { mat: "night", title: "Le città, adesso", build: buildCitta },
    heatmap: { mat: "glass", title: "Heatmap", build: buildHeat },
    imparando: { mat: "glass", title: "Sto imparando", build: buildImpara }
  };
  function tileOf(id) { return $('.grid > .tile[data-tile="' + id + '"]'); }

  /* ---------------------------------------------------------------- i riquadri */
  /* dopo un trascinamento (il globo, i giorni della heatmap) il clic che segue non apre niente: è l'unica cosa fatta nella fase
     di cattura (vivi.js e vivo.js non si toccano; il globo ha già il suo freno in vivo.js, questo vale anche per gli altri) */
  var P = null;
  doc.addEventListener("pointerdown", function (e) { P = { x: e.clientX, y: e.clientY, moved: false }; }, true);
  doc.addEventListener("pointermove", function (e) { if (P && !P.moved && Math.abs(e.clientX - P.x) + Math.abs(e.clientY - P.y) > 9) P.moved = true; }, true);
  doc.addEventListener("click", function (e) {
    if (!P || !P.moved || e.detail === 0) return;
    var t = e.target, tl = t && t.closest ? t.closest('.grid > .tile[data-tile="corano"], .grid > .tile[data-tile="citta"], .grid > .tile[data-tile="heatmap"], .grid > .tile[data-tile="imparando"]') : null;
    if (!tl) return;
    e.preventDefault(); e.stopPropagation(); P = null;
  }, true);
  /* il giorno sotto il dito nella tela della heatmap del riquadro (la sua griglia: 53 colonne, 15 px di mesi sopra) */
  function heatDayAt(tile, x, y) {
    var cv = $("#heatCv", tile); if (!cv || !x) return null;
    var r = cv.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    var pitch = (r.width + 1) / 53, c = clamp(Math.floor((x - r.left) / pitch), 0, 52), w = clamp(Math.floor((y - r.top - 15) / pitch), 0, 6);
    var end = oggi(), endMon = end - C.wdOf(end) * 86400000, ms = endMon - (52 - c) * 7 * 86400000 + w * 86400000;
    return ms <= end ? ms : null;
  }
  /* Heatmap e Sto imparando non hanno data-open: il loro clic (fase normale, dopo i controlli del riquadro) apre la sezione */
  function tileClick(id) {
    return function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
      var tl = e.currentTarget, day = id === "heatmap" && e.detail > 0 ? heatDayAt(tl, e.clientX, e.clientY) : null;
      if (open(id, tl, { day: day, kbd: e.detail === 0 })) e.preventDefault();
    };
  }
  ["heatmap", "imparando"].forEach(function (id) { var t = tileOf(id); if (t) t.addEventListener("click", tileClick(id)); });
  /* da tastiera: Invio sulla tela della heatmap apre l'anno intero (le frecce restano di vivi.js) */
  (function () {
    var hm = tileOf("heatmap"), hc = hm ? $("#heatCv", hm) : null;
    if (hc) hc.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open("heatmap", hm, { kbd: true }); } });
  })();

  /* Sto imparando: vivi.js scrive nell'etichetta «Apri il repository su GitHub, in una nuova scheda»; ora il riquadro apre la
     sezione (il repository è dentro), quindi la fine dell'etichetta si corregge qui, senza toccare vivi.js */
  (function () {
    var ip = tileOf("imparando"), hit = ip ? $(".tile__hit", ip) : null; if (!hit || !window.MutationObserver) return;
    function fix() { var a = hit.getAttribute("aria-label") || "", b = a.replace(/\. Apri il repository su GitHub, in una nuova scheda$/, ". Apri"); if (b !== a) hit.setAttribute("aria-label", b); }
    new MutationObserver(fix).observe(hit, { attributes: true, attributeFilter: ["aria-label"] }); fix();
  })();

  /* aperta da un indirizzo (#corano, #citta, #heatmap, #imparando, ?open=): app.js chiama SEZIONI.open quando parte; se a quel
     punto questo script non c'era ancora, ci si pensa qui, una volta sola, purché niente sia già aperto */
  (function () {
    var deep = location.hash ? location.hash.slice(1) : "";
    try { if (!SEC[deep] && window.URLSearchParams) deep = new URLSearchParams(location.search).get("open") || ""; } catch (e) { }
    if (!SEC[deep]) return;
    I.whenFree(function () { if (!S.any && !S.id && !root.classList.contains("is-sheet")) open(deep, tileOf(deep), { instant: true, push: false }); });
  })();

  /* ---------------------------------------------------------------- il tema mentre è aperta (CASA.md 2f E) */
  function retheme() {
    var c = S.ctx; if (!c || !c.retheme) return;
    requestAnimationFrame(function () { if (S.ctx === c) { try { c.retheme(); } catch (e) { if (window.console) console.error(e); } } });
  }
  if (window.MutationObserver) new MutationObserver(retheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  function temaOn() { var T = window.TEMA; if (T && T.on) { try { T.on(retheme); } catch (e) { } return true; } return false; }
  if (!temaOn()) I.whenFree(temaOn);
  try { var mqD = window.matchMedia("(prefers-color-scheme: dark)"); if (mqD.addEventListener) mqD.addEventListener("change", retheme); else if (mqD.addListener) mqD.addListener(retheme); } catch (e) { }

  /* ---------------------------------------------------------------- l'interfaccia (il menu la chiama; casa.js e Dot ascoltano) */
  function dayOf(d) {
    if (typeof d === "number" && isFinite(d)) return d;
    var m = typeof d === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(d) : null;
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  window.SEZIONI = {
    open: function (id, o) {
      o = o || {}; if (!SEC[id]) return false;
      return open(id, tileOf(id), { from: o.from || null, fromEl: o.fromEl || null, radius: o.radius, kbd: !!o.kbd, day: dayOf(o.day), instant: !!o.instant, push: o.push, replace: !!o.replace });
    },
    close: function (o) { if (!S.id) return false; o = o || {}; close({ instant: !!o.instant, force: !!o.instant }); return true; },
    isOpen: function () { return !!S.id; },
    id: function () { return S.id; },
    forma: "clip",
    on: function (fn) { if (typeof fn === "function" && subs.indexOf(fn) < 0) subs.push(fn); },
    off: function (fn) { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); },
    /* per gli strumenti di prova: tutti i movimenti in corso fermi a ms dall'inizio, poi di nuovo in moto */
    _prova: {
      seek: function (ms) { S.anims.concat(S.back).forEach(function (a) { try { a.pause(); a.currentTime = ms; } catch (e) { } }); },
      play: function () { S.hold = false; S.anims.concat(S.back).forEach(function (a) { try { a.play(); } catch (e) { } }); },
      state: function () { return { id: S.id, busy: S.busy, anims: S.anims.length, from: !!S.from }; }
    }
  };
})();
