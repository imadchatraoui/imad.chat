/* imad.chat — il cursore (CASA.md 2f C; lo stile in cursore.css). Solo con un mouse: mai sui telefoni, mai a tocco.
   Un dischetto d'oro (la stella-punto) al posto della freccia: il suo centro è esattamente dove punta il mouse, mosso dentro il
   pointermove stesso (con getCoalescedEvents dove c'è), mai in ritardo; per questo la freccia del sistema si può nascondere. Intorno un
   alone, un anello di 14 px che lo segue con una molla (posizione k 1500, misura k 900, ζ .82, a passi di 1/240 s).
   Sopra ciò che si preme l'alone diventa un anello di 34 px; sopra i tasti rotondi, le pillole, le parole del dock e i tasti del menu si
   posa sulla loro forma (il rettangolo e il raggio, 4 px fuori) e il tasto si sposta verso il mouse di 3 px al più (l'idea «Magnet» di
   React Bits, scritta qui da capo: forza .18, lasciato torna con la molla viva, ζ .58). Premendo l'alone si stringe (.82, ζ .55).
   Nei campi di testo il dischetto e l'alone spariscono e torna la I del sistema; su ciò che si afferra (Dot, il filo, il globo, la
   scatola dei tasti) torna la mano del sistema. Fuori dalla finestra spariscono in 120 ms.
   Il ciclo dei fotogrammi gira solo mentre l'alone si muove. Con «meno movimento» niente molle: l'alone salta.
   La guardia: se la pagina si inceppa (tre fotogrammi oltre 120 ms in 10 s) il dischetto si spegne per tutta la visita e torna la
   freccia del sistema: il puntatore non deve mai essere più difficile da usare.
   window.CURSORE = { on(), mode(), off() }. Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var W = window, doc = document, root = doc.documentElement;
  if (!W.matchMedia || !W.requestAnimationFrame || !doc.body) return;
  var fine = W.matchMedia("(hover: hover) and (pointer: fine)"), forced = W.matchMedia("(forced-colors: active)"), more = W.matchMedia("(prefers-contrast: more)");
  var mqReduce = W.matchMedia("(prefers-reduced-motion: reduce)");
  var dead = false;
  try { dead = sessionStorage.getItem("imad.pnt") === "spento"; } catch (e) { }
  function allowed() { return !dead && fine.matches && !forced.matches && !more.matches; }

  var el = doc.createElement("div"); el.className = "pnt is-fuori"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<i class="pnt__h"></i><i class="pnt__d"></i>';
  var halo = el.firstChild, disc = el.lastChild;

  /* che cosa c'è sotto il mouse */
  var TEXT = "input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, select, [contenteditable=''], [contenteditable=true], [contenteditable=plaintext-only]";
  var GRAB = ".dot-grab, .filo__presa, .citta .tile__hit, #globo, .scatola__cv, [data-pnt=mano]";
  var WRAP = ".iconbtn, .pill, .dock__b, .menu__k";
  var PRESS = "a[href], button, [role=button], label, summary, .tile__hit, .dock__b, .pill, .menu__k";
  function up(n, s) { return n && n.closest ? n.closest(s) : null; }
  function off(n) { return !n || n.disabled || n.getAttribute("aria-disabled") === "true"; }
  function decide(n) {
    if (!n || n.nodeType !== 1) return { m: "dot" };
    if (up(n, TEXT)) return { m: "text" };
    if (up(n, GRAB)) return { m: "grab" };
    var w = up(n, WRAP); if (w && !off(w)) return { m: "wrap", el: w };
    var p = up(n, PRESS); if (p && !off(p)) return { m: "ring", el: p };
    return { m: "dot" };
  }

  /* le molle: valori adesso (S), velocità (V), bersagli (T) */
  var KEYS = ["x", "y", "w", "h", "r", "sc", "o"];
  var S = { x: -50, y: -50, w: 14, h: 14, r: 7, sc: 1, o: 0 }, V = { x: 0, y: 0, w: 0, h: 0, r: 0, sc: 0, o: 0 }, T = { x: -50, y: -50, w: 14, h: 14, r: 7, sc: 1, o: 0 };
  var K = { x: 1500, y: 1500, w: 900, h: 900, r: 900, sc: 900, o: 900 }, Z = { x: 0.82, y: 0.82, w: 0.82, h: 0.82, r: 0.82, sc: 0.55, o: 1 };
  var on = false, sys = false, inWin = false, down = false, mode = "dot", tgt = null, cur = null, px = -50, py = -50, raf = 0, last = 0;
  /* il magnete: lo spostamento del tasto (translate, una proprietà sua: non tocca il transform di moto.js né i voli del menu) */
  var mag = null;   /* { el, x, y, vx, vy, tx, ty, z, gone, sh: la forma ferma } */
  var dirty = false, lastMove = 0;

  function setSys(v) { if (v !== sys) { sys = v; root.classList.toggle("pnt-sys", v); } }
  function enable() {
    if (on || !allowed()) return;
    on = true; if (!el.parentNode) doc.body.appendChild(el);
    root.classList.add("pnt-on");
    S.x = T.x = px; S.y = T.y = py; V.x = V.y = 0;
  }
  function disable() {
    if (!on) return; on = false;
    root.classList.remove("pnt-on", "pnt-sys"); sys = false;
    el.classList.add("is-fuori"); dropMag(true);
    if (raf) { W.cancelAnimationFrame(raf); raf = 0; }
  }
  function kill() { dead = true; try { sessionStorage.setItem("imad.pnt", "spento"); } catch (e) { } disable(); if (el.parentNode) el.parentNode.removeChild(el); }

  function dropMag(now) {
    if (!mag) return;
    if (now || mqReduce.matches) { mag.el.style.translate = ""; mag = null; return; }
    mag.tx = 0; mag.ty = 0; mag.z = 0.58; mag.gone = true; wake();      /* lasciato: torna con la molla viva */
  }
  function shapeOf(n) {
    var r = n.getBoundingClientRect(), cs = getComputedStyle(n), rad = parseFloat(cs.borderTopLeftRadius) || 0, ins = 0;
    if (n.classList.contains("iconbtn")) { ins = 4; rad = (r.width - 8) / 2; }                 /* il vetro visibile sta 4 px dentro (36 di 44) */
    var ox = mag && mag.el === n ? mag.x : 0, oy = mag && mag.el === n ? mag.y : 0;          /* il rettangolo senza lo spostamento del magnete */
    return { l: r.left - ox + ins, t: r.top - oy + ins, w: r.width - ins * 2, h: r.height - ins * 2, rad: Math.min(rad, (r.height - ins * 2) / 2) };
  }

  function aim() {
    var d = decide(tgt), was = mode;
    mode = d.m;
    var showSys = mode === "text" || mode === "grab";
    setSys(showSys);
    T.o = !inWin || showSys ? 0 : 1;
    disc.style.opacity = !inWin || showSys ? "0" : "1";
    var calm = mqReduce.matches;
    if (mode === "wrap") {
      /* la forma si misura entrando (e dopo uno scorrimento o una pressione), non a ogni movimento del mouse */
      if (!mag || mag.el !== d.el) {
        if (mag) { mag.el.style.translate = ""; mag = null; }
        mag = { el: d.el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, z: 0.82, gone: false, sh: null };
      }
      if (!mag.sh || mag.gone || dirty) { mag.sh = shapeOf(d.el); dirty = false; }
      var sh = mag.sh, cx = sh.l + sh.w / 2, cy = sh.t + sh.h / 2;
      mag.gone = false; mag.z = 0.82;
      var mx = (px - cx) * 0.18, my = (py - cy) * 0.18, L = Math.sqrt(mx * mx + my * my);
      if (L > 3) { mx *= 3 / L; my *= 3 / L; }
      mag.tx = calm ? 0 : mx; mag.ty = calm ? 0 : my;
      T.x = cx + mag.tx; T.y = cy + mag.ty; T.w = sh.w + 8; T.h = sh.h + 8; T.r = sh.rad + 4; T.sc = down ? 0.92 : 1;
    } else {
      if (mag && !mag.gone) dropMag(false);
      T.x = px; T.y = py;
      if (mode === "ring") { T.w = T.h = 34; T.r = 17; } else { T.w = T.h = 14; T.r = 7; }
      T.sc = down ? 0.82 : 1;
    }
    if (calm) { KEYS.forEach(function (k) { S[k] = T[k]; V[k] = 0; }); if (mag) { mag.x = mag.tx; mag.y = mag.ty; mag.vx = mag.vy = 0; if (mag.gone) { mag.el.style.translate = ""; mag = null; } else paintMag(); } paint(); return; }
    if (was !== mode && was === "text") { S.x = T.x; S.y = T.y; V.x = V.y = 0; }           /* uscendo da un campo l'alone non arriva volando da lontano */
    wake();
  }
  function wake() { if (!raf && on) { last = 0; raf = W.requestAnimationFrame(step); } }

  /* la guardia: tre fotogrammi oltre 120 ms nello spazio di 10 s spengono il dischetto per la visita */
  var slow = [];
  function guard(dtMs, t) {
    if (dtMs < 120) return;
    slow.push(t); while (slow.length && t - slow[0] > 10000) slow.shift();
    if (slow.length >= 3) kill();
  }
  function step(t) {
    raf = 0; if (!on) return;
    if (last) guard(t - last, t);
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60; last = t;
    var moving = false, n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, i, j, k;
    for (i = 0; i < KEYS.length; i++) {
      k = KEYS[i]; var st = K[k], c = 2 * Z[k] * Math.sqrt(st);
      for (j = 0; j < n; j++) { V[k] += (st * (T[k] - S[k]) - c * V[k]) * h; S[k] += V[k] * h; }
      if (Math.abs(T[k] - S[k]) > 0.01 || Math.abs(V[k]) > 0.02) moving = true; else { S[k] = T[k]; V[k] = 0; }
    }
    if (mag) {
      var mk = 900, mc = 2 * mag.z * Math.sqrt(mk);
      for (j = 0; j < n; j++) { mag.vx += (mk * (mag.tx - mag.x) - mc * mag.vx) * h; mag.x += mag.vx * h; mag.vy += (mk * (mag.ty - mag.y) - mc * mag.vy) * h; mag.y += mag.vy * h; }
      var still = Math.abs(mag.tx - mag.x) < 0.01 && Math.abs(mag.ty - mag.y) < 0.01 && Math.abs(mag.vx) < 0.02 && Math.abs(mag.vy) < 0.02;
      if (still) { mag.x = mag.tx; mag.y = mag.ty; mag.vx = mag.vy = 0; } else moving = true;
      paintMag();
      if (still && mag.gone) { mag.el.style.translate = ""; mag = null; }
    }
    paint();
    /* finché il mouse si muove il giro resta acceso anche con l'alone fermo: la guardia deve vedere i fotogrammi lunghi */
    if (moving || t - lastMove < 250) raf = W.requestAnimationFrame(step);
  }
  function paintMag() { if (mag) mag.el.style.translate = (Math.abs(mag.x) < 0.01 && Math.abs(mag.y) < 0.01) ? "" : mag.x.toFixed(2) + "px " + mag.y.toFixed(2) + "px"; }
  function paint() {
    var w = Math.max(4, S.w), hh = Math.max(4, S.h), sc = Math.max(0.3, S.sc), o = Math.max(0, Math.min(1, S.o));
    halo.style.width = w.toFixed(2) + "px"; halo.style.height = hh.toFixed(2) + "px";
    halo.style.borderRadius = Math.max(2, Math.min(S.r, w / 2, hh / 2)).toFixed(2) + "px";
    halo.style.transform = "translate3d(" + (S.x - w / 2).toFixed(2) + "px," + (S.y - hh / 2).toFixed(2) + "px,0) scale(" + (sc * (0.6 + 0.4 * o)).toFixed(4) + ")";
    halo.style.opacity = o.toFixed(3);
  }

  function move(e) {
    if (e.pointerType && e.pointerType !== "mouse") { if (on) disable(); return; }
    if (!allowed()) { if (on) disable(); return; }
    var ev = e;
    if (e.getCoalescedEvents) { try { var cs = e.getCoalescedEvents(); if (cs && cs.length) ev = cs[cs.length - 1]; } catch (x) { } }
    px = ev.clientX; py = ev.clientY; lastMove = performance.now();
    if (!on) enable();
    if (!inWin) { inWin = true; el.classList.remove("is-fuori"); S.x = T.x = px; S.y = T.y = py; V.x = V.y = 0; S.o = 0; }   /* rientrando non vola dal punto dove era uscito */
    /* il dischetto: subito, qui dentro, dove punta il mouse */
    disc.style.transform = "translate3d(" + px + "px," + py + "px,0)";
    tgt = e.target;
    aim();
  }
  doc.addEventListener("pointermove", move, { passive: true });
  doc.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") { if (on) disable(); return; }
    down = true; dirty = true; move(e);
  }, { passive: true, capture: true });
  W.addEventListener("pointerup", function (e) { if (e.pointerType === "mouse") { down = false; dirty = true; if (on) aim(); } }, { passive: true, capture: true });
  W.addEventListener("pointercancel", function () { down = false; if (on) aim(); }, { passive: true });
  /* fuori dalla finestra: niente dischetto né alone (in 120 ms, cursore.css) */
  doc.addEventListener("mouseout", function (e) { if (!e.relatedTarget && on) { inWin = false; el.classList.add("is-fuori"); dropMag(false); aim(); } });
  W.addEventListener("blur", function () { if (on) { inWin = false; el.classList.add("is-fuori"); dropMag(false); aim(); } });
  /* la pagina scorre (o si apre qualcosa) sotto il mouse fermo: ciò che c'è sotto cambia */
  var sr = 0;
  function reread() { if (!on || sr || !inWin) return; sr = W.requestAnimationFrame(function () { sr = 0; dirty = true; var n = doc.elementFromPoint(px, py); if (n) { tgt = n; aim(); } }); }
  W.addEventListener("scroll", reread, { passive: true, capture: true });
  if (W.MutationObserver) new MutationObserver(reread).observe(root, { attributes: true, attributeFilter: ["class"] });
  function recheck() { if (!allowed()) disable(); }
  [fine, forced, more].forEach(function (q) { if (q.addEventListener) q.addEventListener("change", recheck); else if (q.addListener) q.addListener(recheck); });

  W.CURSORE = { on: function () { return on; }, mode: function () { return mode; }, off: kill };
})();
