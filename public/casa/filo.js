/* imad.chat — il tasto del tema e i fili di gomitolo (CASA.md 2f A, B, H). Va con filo.css; il tema lo tiene ../comune/tema.js
   (window.TEMA, caricato per primo nella testa).
   1. Il tasto del tema (#tema, accanto ai suoni): un tocco cambia sempre ciò che si vede; il disegno (un anello che si riempie: vuoto =
      chiaro, metà = come il telefono, pieno = scuro) scorre con una molla; una pillola dice lo stato e lo legge a chi non vede.
   2. I fili: dal tasto del tema e da quello dei suoni pende il filo del gomitolo di Dot. Una corda vera (Verlet, 16 tratti, 52 px):
      pende quieta, ondeggia quando la pagina scorre e quando un dito o il mouse le passa vicino; si prende in qualunque punto e si
      tira come il cordino di una lampada: 26 px oltre il filo teso scatta il suo tasto (una volta per presa), il tasto fa un saltino
      nel suo posto; lasciata, torna su elastica e dondola. Un peso appeso (Dot, FILO.hang) la tira: se lo strappo dura, il tasto si
      stacca, cade col suo filo sulla mensola (il bordo alto dell'hero), rotola, si ferma e poi torna su da solo, senza cambiare nulla.
   3. window.FILO: l'interfaccia per il cervello di Dot (CASA.md 2f H). Coordinate della pagina, px CSS, y in giù.
   Fermo, non gira niente: il giro dei fotogrammi si spegne quando i fili sono quieti. Con «meno movimento» e ?shot=1 i fili pendono
   fermi e un tocco sul filo fa scattare il tasto subito. Plain script, ES2017. */
(function () {
  "use strict";
  var W = window, doc = document, root = doc.documentElement;
  var home = doc.getElementById("home"), bar = doc.getElementById("bar");
  if (!home || !bar || !W.requestAnimationFrame) return;
  var T = W.TEMA, I = W.IMAD || null;
  var mqR = W.matchMedia("(prefers-reduced-motion: reduce)");
  var SHOT = root.classList.contains("is-shot");
  function reduced() { return mqR.matches; }
  function still() { return SHOT || reduced(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sx() { return W.pageXOffset || 0; }
  function sy() { return W.pageYOffset || 0; }
  function now() { return W.performance && performance.now ? performance.now() : Date.now(); }
  function soundOn() { return !!(I && I.sound && I.sound.on && I.sound.on()); }
  function isDark() { return T ? T.dark() : !!(I && I.isDark && I.isDark()); }
  /* --molla-piana come curva (moto.js la riscrive in CSS come molla vera; qui basta la sua curva di ripiego) */
  function bez(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return function (t) {
      if (t <= 0) return 0; if (t >= 1) return 1;
      var u = t, i, x, dx;
      for (i = 0; i < 8; i++) { x = ((ax * u + bx) * u + cx) * u - t; dx = (3 * ax * u + 2 * bx) * u + cx; if (Math.abs(x) < 1e-5 || !dx) break; u = clamp(u - x / dx, 0, 1); }
      return ((ay * u + by) * u + cy) * u;
    };
  }
  var PIANA = bez(0.2, 0.9, 0.25, 1);

  /* ================================================================== 1. il tasto del tema */
  var tb = doc.getElementById("tema"), tf = tb ? tb.querySelector(".tema__f") : null, hud = null, hudT = 0, hudT2 = 0;
  var NAME = { auto: "Come il telefono", chiaro: "Chiaro", scuro: "Scuro" };
  if (tb && !T) tb.hidden = true;                                   /* senza tema.js il tasto non saprebbe cosa fare */
  if (tb && T && tf) {
    /* il riempimento: una molla smorzata .7 che si posa in circa 420 ms (k 185, c 19: ω 13,6/s). Si disegna solo fra 0 e 1: oltre, il
       bordo si staccherebbe dal lato sinistro e il disco diventerebbe una falce. Il bordo è sempre una corda dritta */
    var f = 0.5, fv = 0, ft = 0.5, fraf = 0, flast = 0;
    var fillOf = function (s) { return s === "chiaro" ? 0 : s === "scuro" ? 1 : 0.5; };
    var paintFill = function () { var v = clamp(f, 0, 1); tf.style.transform = v > 0.999 ? "none" : "translateX(" + (v < 0.001 ? -104 : (v - 1) * 100).toFixed(2) + "%)"; };
    var fstep = function (t) {
      fraf = 0; var dt = flast ? Math.min(0.034, (t - flast) / 1000) : 1 / 60, n = Math.max(1, Math.ceil(dt * 240)), h = dt / n; flast = t;
      while (n--) { fv += (185 * (ft - f) - 19 * fv) * h; f += fv * h; }
      if (Math.abs(ft - f) > 0.002 || Math.abs(fv) > 0.02) { paintFill(); fraf = W.requestAnimationFrame(fstep); } else { f = ft; fv = 0; flast = 0; paintFill(); }
    };
    var fillTo = function (s) { ft = fillOf(s); if (still()) { f = ft; fv = 0; paintFill(); return; } if (!fraf) { flast = 0; fraf = W.requestAnimationFrame(fstep); } };
    var label = function () {
      var d = T.dark();
      tb.setAttribute("aria-label", "Tema: " + (d ? "scuro" : "chiaro") + (T.get() === "auto" ? ", come il telefono" : "") + ". Tocca per " + (d ? "il chiaro" : "lo scuro"));
    };
    f = ft = fillOf(T.get()); paintFill(); label();
    /* la pillola: vive nella riga (è lei la regione che si legge, aria-live polite); si mette accanto al tasto quando esce */
    hud = doc.createElement("span"); hud.className = "tema__hud"; hud.setAttribute("role", "status"); hud.setAttribute("aria-live", "polite");
    bar.appendChild(hud);
    var showHud = function (text) {
      var br = bar.getBoundingClientRect(), b = tb.getBoundingClientRect();
      hud.style.right = (br.right - b.left + 1).toFixed(1) + "px"; hud.style.top = (b.top - br.top + b.height / 2 - 15).toFixed(1) + "px";
      clearTimeout(hudT); clearTimeout(hudT2);
      hud.textContent = text; hud.classList.add("is-on");
      hudT = setTimeout(function () { hud.classList.remove("is-on"); hudT2 = setTimeout(function () { hud.textContent = ""; }, 240); }, 1200 + 320);
    };
    T.on(function (e) { fillTo(e.state); label(); });
    tb.addEventListener("click", function () { if (!tb.classList.contains("is-strappato")) flipTema(); });
  }
  /* un tocco sul tasto o una tirata del suo filo: il cerchio del nuovo tema parte dal tasto (tema.js) */
  function flipTema() {
    if (!T || !tb) return;
    var s = T.flip({ from: tb });
    if (hud) showHud(NAME[s]);
  }
  /* il cerchio del tema (tema.js) è una view transition: per i suoi 560 ms ogni tocco va a <html> e si perderebbe (il suono, il logo,
     un secondo tocco sul tema, un filo tirato). Un tocco lo fa saltare alla fine; poi il clic arriva a chi sta sotto il dito, e un dito
     sceso su un filo lo prende davvero (un pointerdown rifatto sulla sua presa). Solo nella casa: il cerchio parte solo dal tasto */
  var fw = null;
  doc.addEventListener("pointerdown", function (e) {
    var vt = T && T.vt ? T.vt() : null; fw = null; if (!vt) return;
    var p = fw = { x: e.clientX, y: e.clientY, id: e.pointerId, pt: e.pointerType, up: false, el: null };
    try { vt.skipTransition(); } catch (x) { }
    var go = function () {
      if (fw !== p || p.up) return;
      var el = doc.elementFromPoint(p.x, p.y);
      if (!el || !el.classList || !el.classList.contains("filo__presa") || !W.PointerEvent) return;
      p.el = el;
      try { el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true, pointerId: p.id, pointerType: p.pt, isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: 1 })); } catch (x) { }
    };
    vt.finished.then(go, go);
  }, true);
  doc.addEventListener("pointerup", function (e) { if (fw && fw.id === e.pointerId) fw.up = true; }, true);
  doc.addEventListener("click", function (e) {
    var p = fw; fw = null;
    if (!p || p.el || (e.target !== root && e.target !== doc.body)) return;
    var el = doc.elementFromPoint(p.x, p.y);
    el = el && el.closest ? el.closest("a[href], button, [role=button], label, summary") : null;
    if (!el || el.disabled) return;
    e.stopPropagation(); e.preventDefault(); el.click();
  }, true);

  /* ================================================================== 2. i fili */
  var N = 16;                 /* tratti (17 punti) */
  var REST = 52;              /* lunghezza a riposo, px */
  var G = 1700;               /* gravità, px/s²: un mondo da libro illustrato (un dondolio di circa 1,1 s), non 8 mm di lana veri */
  var H = 1 / 240;            /* passo fisso */
  var MAXSTEP = 8;            /* al più 8 passi per fotogramma: un fotogramma lento perde tempo, non ne recupera */
  var DAMP = 0.9963;          /* per passo: il dondolio scende al 10% in circa 2,5 s */
  var ITER = 12;              /* giri dei vincoli */
  var BEND = 0.035;           /* rigidezza a piegarsi (vincolo i, i+2): poca, è lana */
  var STRETCH = 0.45;         /* quanto si allunga, elastico, sotto un dito */
  var PULL = 26;              /* px oltre il filo teso: scatta il tasto */
  var KNOT = 20;              /* il nodo: 2 px sopra il fondo del tasto (44 px) */
  var BTN_R = 19;             /* il disco del tasto per Dot (36 px di vetro, un filo di margine) */
  var CONTACT = 18;           /* il disco che tocca la mensola: il vetro che si vede */
  var MASS_W = 42;            /* il peso di Dot rispetto a un punto del filo */
  var TEAR_K = 1.32;          /* lo strappo: tensione oltre 1,32 volte il peso fermo... */
  var TEAR_T = 0.09;          /* ...per 90 ms */
  var BACK_AFTER = 0.95;      /* s fermo sulla mensola prima di tornare */
  var UNROLL = 0.62;          /* s per srotolarsi all'arrivo */
  var COL = { ply: "#e3765c", ply2: "#b9533f", hi: "#f29a82", knot: "#a8473a" };   /* il gomitolo di Dot (look-manifesto.js, "yarn"), uguale nei due temi */
  var TR = "translate" in root.style;                              /* le proprietà singole: si sommano alla transform di chi tira il tasto col mouse */

  var ropes = [], fans = {}, raf = 0, lastT = 0, acc = 0, quiet = 0, ground = null, groundFn = null, shown = false, simT = 0;
  var homeOff = { x: 0, y: 0 }, light = { x: 0, y: -1 }, shad = { x: 0, y: 2.4 }, lightAt = -1e9;
  function emit(name, e) { var l = fans[name]; if (!l) return; l = l.slice(); for (var i = 0; i < l.length; i++) { try { l[i](e); } catch (x) { if (W.console) console.error(x); } } }

  /* ------------------------------------------------------------ la tela: dentro .home (sopra la riga e l'hero, sotto gli strati di Dot) */
  var cv = doc.createElement("canvas"); cv.className = "filo"; cv.setAttribute("aria-hidden", "true"); cv.style.visibility = "hidden";
  home.appendChild(cv);
  var ctx = cv.getContext("2d"), dpr = 1, box = { x: 0, y: 0, w: 0, h: 0 };
  function sizeCanvas() {
    if (!ropes.length) return;
    var x0 = 1e9, x1 = -1e9, y1 = 0, hw = home.clientWidth || doc.documentElement.clientWidth;
    ropes.forEach(function (r) { x0 = Math.min(x0, r.sock.x); x1 = Math.max(x1, r.sock.x); y1 = Math.max(y1, r.sock.y + KNOT + REST * (1 + STRETCH) + 150); });
    if (ground) y1 = Math.max(y1, ground.top + 40);
    var lx = clamp(Math.floor(x0 - homeOff.x - 150), 0, hw), rx = clamp(Math.ceil(x1 - homeOff.x + 150), 0, hw);
    var w = Math.max(1, rx - lx), h = Math.max(1, Math.ceil(y1 - homeOff.y)), d = Math.min(W.devicePixelRatio || 1, 2);
    if (w !== box.w || h !== box.h || d !== dpr || lx !== box.x) {
      box.x = lx; box.y = 0; box.w = w; box.h = h; dpr = d;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + "px"; cv.style.height = h + "px"; cv.style.left = lx + "px";
    }
  }
  function readHome() { var r = home.getBoundingClientRect(); homeOff.x = r.left + sx(); homeOff.y = r.top + sy(); }
  /* la luce: --sun-ang è l'angolo dei bordi di luce dei riquadri (il chiaro all'inizio del gradiente): il lato acceso del filo guarda di là.
     --shx/--shy: l'ombra delle tessere, accorciata per un filo così sottile */
  function readLight() {
    lightAt = simT;
    try {
      var cs = getComputedStyle(root), a = parseFloat(cs.getPropertyValue("--sun-ang")) || 180, r = a * Math.PI / 180;
      light.x = -Math.sin(r); light.y = Math.cos(r);
      var shx = parseFloat(cs.getPropertyValue("--shx")) || 0, shy = parseFloat(cs.getPropertyValue("--shy")) || 12;
      shad.x = clamp(shx * 0.2, -2.4, 2.4); shad.y = clamp(shy * 0.2, 1, 3);
    } catch (e) { }
  }

  /* ------------------------------------------------------------ la mensola: il bordo alto dell'hero, angoli tondi compresi */
  function readGround() {
    var hero = doc.getElementById("hero"); if (!hero) { ground = null; return; }
    var r = hero.getBoundingClientRect(), rad = 32;
    try { rad = parseFloat(getComputedStyle(hero).borderTopLeftRadius) || 32; } catch (e) { }
    ground = { top: r.top + sy(), left: r.left + sx(), right: r.right + sx(), r: rad };
  }
  /* un cerchio (x, y, rr) contro la mensola: { d: quanto entra, nx, ny: la normale } o null. FILO.ground(fn) la può sostituire */
  function hitGround(x, y, rr) {
    if (groundFn) { try { return groundFn(x, y, rr); } catch (e) { return null; } }
    var g = ground; if (!g || x < g.left - rr || x > g.right + rr) return null;
    if (x >= g.left + g.r && x <= g.right - g.r) { var d = y + rr - g.top; return d > 0 && y < g.top + 20 ? { d: d, nx: 0, ny: -1 } : null; }
    var cx = x < g.left + g.r ? g.left + g.r : g.right - g.r, cy = g.top + g.r;
    if (y > cy) return null;                                      /* sotto il centro dell'angolo è già il fianco del riquadro */
    var dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy) || 1, pen = g.r + rr - dist;
    if (pen <= 0 || dist < g.r * 0.4) return null;
    return { d: pen, nx: dx / dist, ny: dy / dist };
  }

  /* ------------------------------------------------------------ una corda */
  function Rope(id, btn) {
    this.id = id; this.btn = btn; this.len = REST;
    this.p = []; this.sock = { x: 0, y: 0 }; this.knot = { x: 0, y: 0 };
    this.state = "rest";            /* rest | held | weighted | torn | landed | returning */
    this.held = null; this.weight = null; this.toggled = false; this.hold = false;
    this.off = { x: 0, y: 0, vx: 0, vy: 0 };   /* il tasto tirato nel suo posto: una molla */
    this.B = null;                  /* il tasto staccato: un disco libero */
    this.strain = 0; this.tens = 0; this.overT = 0; this.restT = 0; this.stretchK = 1; this.pop = 0; this.relK = 1; this.relJ = 0; this.k2 = 1; this.pullD = 0;
    this.unroll = -1; this.twist = 0; this.tr = ""; this.calm = 0; this.tail = 0; this.slow = false; this.downT = 0;
    this.hit = doc.createElement("div"); this.hit.className = "filo__presa"; this.hit.setAttribute("aria-hidden", "true"); this.hit.setAttribute("data-dot-keep", "");
    this.hit.style.display = "none";
    home.appendChild(this.hit);
  }
  /* il posto del tasto senza nessuna trasformazione (la nostra, o il magnete del cursore): dalle misure di impaginazione */
  Rope.prototype.readSock = function () {
    var b = this.btn, x = b.offsetLeft + b.offsetWidth / 2, y = b.offsetTop + b.offsetHeight / 2, p = b.offsetParent;
    while (p && p !== home) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent; }
    if (!p) { var r = b.getBoundingClientRect(); x = r.left + r.width / 2 + sx() - homeOff.x; y = r.top + r.height / 2 + sy() - homeOff.y; }
    this.sock.x = homeOff.x + x; this.sock.y = homeOff.y + y;
    this.knot.x = this.sock.x; this.knot.y = this.sock.y + KNOT;
  };
  /* l'arrivo: tutti i punti sul nodo, fermi, sulla verticale; la lunghezza cresce e il filo cade dritto (2f B). Il filo dei suoni parte
     140 ms dopo quello del tema; a metà discesa ciascuno riceve un dondolio piccolo e diverso, dallo stesso lato (mai a specchio) */
  Rope.prototype.reset = function (unroll) {
    var late = this.id === "suono" ? 0.14 : 0;
    this.p = []; this.len = unroll ? REST * 0.0002 : REST; this.unroll = unroll ? simT + late : -1; this.swayed = !unroll;
    for (var i = 0; i <= N; i++) {
      var x = this.knot.x, y = this.knot.y + (unroll ? i * this.len / N : i * REST / N);
      this.p.push({ x: x, y: y, ox: x, oy: y, w: i ? 1 : 0 });
    }
  };
  /* la cima del filo: dove sta il nodo adesso (il tasto al suo posto, tirato o staccato) */
  Rope.prototype.top = function () {
    if (this.B) { var a = this.B.a; return { x: this.B.x - Math.sin(a) * KNOT, y: this.B.y + Math.cos(a) * KNOT }; }
    return { x: this.knot.x + this.off.x, y: this.knot.y + this.off.y };
  };
  /* un punto a s px dal nodo: x, y, l'angolo del filo lì (0 = in giù, positivo verso destra) */
  Rope.prototype.at = function (s) {
    var L = this.len / N, f = clamp(s / L, 0, N), k = Math.min(N - 1, Math.floor(f)), u = f - k, a = this.p[k], b = this.p[k + 1];
    var tx = b.x - a.x, ty = b.y - a.y, tl = Math.sqrt(tx * tx + ty * ty) || 1;
    return { x: a.x + tx * u, y: a.y + ty * u, k: k, u: u, angle: Math.atan2(tx / tl, ty / tl) };
  };

  Rope.prototype.step = function (h, fx, fy) {
    var p = this.p, i, q, wt = this.weight, top, B = this.B, seg;
    /* l'arrivo: la lunghezza cresce da 0 a 52 px in 620 ms sulla molla piana */
    if (this.unroll >= 0) {
      var u = (simT - this.unroll) / UNROLL;
      this.len = REST * Math.max(0.0002, PIANA(clamp(u, 0, 1)));
      /* il dondolio: a metà discesa la punta riceve una velocità di lato (al più 4-6 px di ampiezza), più sotto più forte */
      if (!this.swayed && u >= 0.42) {
        this.swayed = true; var sw = this.id === "suono" ? -19 : -28;
        for (var j = 1; j <= N; j++) p[j].ox = p[j].x - sw * (j / N) * H;
      }
      if (u >= 1) { this.len = REST; this.unroll = -1; }
    }
    seg = this.len / N;
    /* il tasto staccato: un disco con la gravità, che rotola sulla mensola; tornando, una molla verso il suo posto (k 120, ζ .62) */
    if (B) {
      if (this.state === "returning") {
        var k = 120, c = 2 * 0.62 * Math.sqrt(k);
        B.vx += (k * (this.sock.x - B.x) - c * B.vx) * h; B.vy += (k * (this.sock.y - B.y) - c * B.vy) * h;
        B.va += (k * 1.6 * (0 - B.a) - c * 1.3 * B.va) * h;
      } else { B.vy += G * h; B.va *= 0.999; }
      B.x += B.vx * h; B.y += B.vy * h; B.a += B.va * h;
      if (this.state !== "returning") {
        var hg = hitGround(B.x, B.y, CONTACT);
        if (hg) {
          B.x += hg.nx * hg.d; B.y += hg.ny * hg.d;
          var vn = B.vx * hg.nx + B.vy * hg.ny;
          if (vn < 0) { B.vx -= (1 + 0.22) * vn * hg.nx; B.vy -= (1 + 0.22) * vn * hg.ny; }
          /* rotola, non scivola: la velocità lungo la mensola e la rotazione si accordano un poco a ogni passo; e si ferma (attrito di rotolamento) */
          /* (un disco che rotola verso destra gira in senso orario: va > 0, come rotate() del CSS) */
          var tx = -hg.ny, ty = hg.nx, vt = B.vx * tx + B.vy * ty, roll = B.va * CONTACT, slip = vt - roll;
          B.vx -= slip * 0.35 * tx; B.vy -= slip * 0.35 * ty; B.va = (vt - slip * 0.35) / CONTACT;
          B.vx *= 0.978; B.va *= 0.978;
          /* sull'angolo tondo la pendenza lo porterebbe giù dal fianco: un labbro che non si vede lo tiene sulla mensola, verso l'interno */
          if (Math.abs(hg.nx) > 0.12) { var inward = hg.nx > 0 ? -1 : 1; B.vx += inward * (G * Math.abs(hg.nx) * 1.15) * h; }
          B.onG = true;
          if (this.state === "torn") { this.state = "landed"; this.restT = 0; var e0 = page(B.x, B.y); emit("landed", { id: this.id, x: e0.x, y: e0.y }); }
        } else B.onG = false;
        /* vicino alla mensola non va oltre il tratto piano: sugli angoli tondi rotolerebbe giù dal fianco dell'hero (a destra, fuori dallo
           schermo). Un muro che non si vede, con un rimbalzo spento: il tasto si ferma dove la curva comincia */
        /* (solo per un tasto che cade sopra la mensola: sul computer i fili pendono oltre la fine dell'hero, e il muro lo teletrasportava sull'angolo) */
        if (ground && !groundFn && B.y > ground.top - CONTACT - 8 && this.sock.x > ground.left - CONTACT && this.sock.x < ground.right + CONTACT) {
          var gl = ground.left + ground.r, gr = ground.right - ground.r;
          if (B.x > gr) { B.x = gr; if (B.vx > 0) { B.vx *= -0.3; B.va *= -0.3; } } else if (B.x < gl) { B.x = gl; if (B.vx < 0) { B.vx *= -0.3; B.va *= -0.3; } }
        }
        /* caduto oltre la mensola (una pagina strana): torna subito */
        if (ground && B.y > ground.top + 140) this.goHome();
      }
    }
    if (B) { B.cx = 0; B.cy = 0; }
    /* Verlet. Mentre il tasto torna (e per 0,6 s dopo) il filo è più frenato: segue il tasto invece di frustare verso l'altro filo */
    var dmp = DAMP, back = this.state === "returning" || this.calm > 0;
    if (back) { dmp = 0.985; this.calm = Math.max(0, this.calm - h); }
    else if (B) dmp = 0.988;                                        /* staccato: la lana caduta si posa, non serpeggia */
    if (this.tail > 0) this.tail = Math.max(0, this.tail - h);
    /* l'attrito della lana: un dondolio ormai piccolo (meno di 0,12 px a passo, circa 5 px di ampiezza) si spegne in un secondo invece
       di trascinarsi per altri tre; i dondolii grandi restano vivi (.9963) */
    else if (this.slow && !this.held && !(wt && !wt.free) && !B) dmp = 0.988;
    for (i = 1; i <= N; i++) {
      q = p[i]; if (!q.w) continue;
      var vx = (q.x - q.ox) * dmp, vy = (q.y - q.oy) * dmp;
      q.ox = q.x; q.oy = q.y; q.x += vx + fx * h * h; q.y += vy + (G + fy) * h * h;
    }
    if (wt && !wt.free) {
      var wvx = (wt.x - wt.ox) * 0.9995, wvy = (wt.y - wt.oy) * 0.9995;
      wt.ox = wt.x; wt.oy = wt.y; wt.x += wvx + fx * h * h; wt.y += wvy + (G + fy) * h * h;
      if (wt.slide > 0 && wt.s < this.len - 0.5) wt.s = Math.min(this.len - 0.5, wt.s + wt.slide * h);
    }
    /* il dito: il punto preso segue il dito; il filo sopra di lui si allunga, elastico, fino a STRETCH */
    var hd = this.held, k2 = 1;
    top = this.top();
    if (hd) {
      var dx = hd.tx - top.x, dy = hd.ty - top.y, dl = Math.sqrt(dx * dx + dy * dy) || 1, sj = Math.max(seg, hd.j * seg);
      k2 = clamp(dl / sj, 1, 1 + STRETCH);
      var reach = Math.min(dl, sj * (1 + STRETCH)), px = top.x + dx / dl * reach, py = top.y + dy / dl * reach;
      q = p[hd.j]; q.x = px; q.y = py; if (!hd.moved) { q.ox = px; q.oy = py; }
      this.pullD = dl - sj; this.k2 = k2;
    } else this.pullD = 0;
    this.stretchK += (k2 - this.stretchK) * 0.25;
    /* lasciato: la parte allungata torna corta in circa 140 ms (.97 a passo), non di colpo: niente frusta sopra il tasto */
    if (!hd && this.relK > 1) { this.relK = 1 + (this.relK - 1) * 0.97; if (this.relK < 1.002) this.relK = 1; }
    /* mentre la parte tirata torna corta (e per poco dopo) la coda sotto il punto preso sale con lui, quasi in blocco: se no il cordino che
       scatta su la comprime e lei si piega a uncino o a esse */
    if (!hd && this.tail > 0 && this.relJ > 0 && this.relJ < N) {
      var pj = p[this.relJ], vjy = pj.y - pj.oy, kt = 0.22 * Math.min(1, this.tail / 0.2);
      for (i = this.relJ + 1; i <= N; i++) { q = p[i]; var tvx = q.x - q.ox, tvy = q.y - q.oy; q.ox = q.x - tvx * (1 - kt * 0.5); q.oy = q.y - (tvy + (vjy - tvy) * kt); }
    }
    /* i vincoli */
    for (var it = 0; it < ITER; it++) {
      top = this.top(); p[0].x = top.x; p[0].y = top.y;
      for (i = 0; i < N; i++) {
        var a = p[i], b = p[i + 1], rest = seg * (hd && i < hd.j ? k2 : (this.relK > 1 && i < this.relJ ? this.relK : 1));
        var ex = b.x - a.x, ey = b.y - a.y, d = Math.sqrt(ex * ex + ey * ey) || 1e-6, diff = (d - rest) / d;
        if (i === 0 && B && d < rest) continue;                   /* il primo tratto non spinge su il tasto caduto: la lana tira, non regge */
        var wa = i === 0 ? (B && this.state !== "returning" ? 0.25 : 0) : a.w, wb = hd && i + 1 === hd.j ? 0 : b.w;
        if (hd && i === hd.j) wa = 0;
        var ws = wa + wb; if (!ws) continue;
        var cx2 = ex * diff, cy2 = ey * diff;
        if (i === 0 && B && wa) { B.x += cx2 * wa / ws; B.y += cy2 * wa / ws; B.cx += cx2 * wa / ws; B.cy += cy2 * wa / ws; }   /* il tasto staccato è tirato dal suo filo */
        else { a.x += cx2 * wa / ws; a.y += cy2 * wa / ws; }
        b.x -= cx2 * wb / ws; b.y -= cy2 * wb / ws;
      }
      /* un filo di rigidezza: niente gomiti. Mentre il tasto torna su, di più: la lana ammucchiata sulla mensola si scioglie invece di
         restare appesa a otto */
      var bend = back ? 0.3 : B ? 0.4 : BEND, bendT = back ? 0.55 : this.tail > 0 ? 0.09 : bend;
      for (i = 0; i < N - 1; i++) {
        var a2 = p[i], c2 = p[i + 2], ex2 = c2.x - a2.x, ey2 = c2.y - a2.y, d2 = Math.sqrt(ex2 * ex2 + ey2 * ey2) || 1e-6;
        if (d2 >= seg * 2) continue;
        var df = (d2 - seg * 2) / d2 * (i >= N - 6 ? Math.max(bend, bendT) : bend), wa2 = i === 0 ? 0 : a2.w, wc = c2.w, w2 = wa2 + wc; if (!w2) continue;
        a2.x += ex2 * df * wa2 / w2; a2.y += ey2 * df * wa2 / w2; c2.x -= ex2 * df * wc / w2; c2.y -= ey2 * df * wc / w2;
      }
      /* il peso appeso: un punto pesante legato al filo a s px dal nodo (C = W − ((1−u)·a + u·b)) */
      if (wt && !wt.free) {
        var g = this.at(wt.s), pa = p[g.k], pb = p[g.k + 1], wx = wt.x - g.x, wy = wt.y - g.y, u1 = 1 - g.u;
        var wW = 1 / wt.mass, wsum = wW + pa.w * u1 * u1 + pb.w * g.u * g.u;
        if (wsum > 0) {
          var lam = 1 / wsum;
          wt.x -= wx * wW * lam; wt.y -= wy * wW * lam;
          pa.x += wx * pa.w * u1 * lam; pa.y += wy * pa.w * u1 * lam;
          pb.x += wx * pb.w * g.u * lam; pb.y += wy * pb.w * g.u * lam;
        }
        /* i piedi sulla mensola: il peso si appoggia, non passa sotto */
        var hg2 = hitGround(wt.x, wt.y + wt.h - 6, 6);
        if (hg2) { wt.x += hg2.nx * hg2.d; wt.y += hg2.ny * hg2.d; wt.ox += (wt.x - wt.ox) * 0.3; wt.touch = true; }
      }
      /* il filo sulla mensola (staccato, o tirato giù fin lì) */
      /* (staccato, la lana scivola sulla mensola dietro al suo tasto invece di restare incollata e accartocciarsi) */
      var fr = B && !back ? 0.12 : 0.45;
      if (B || hd || wt) for (i = 1; i <= N; i++) { q = p[i]; var hp = hitGround(q.x, q.y, 1.1); if (hp) { q.x += hp.nx * hp.d; q.y += hp.ny * hp.d; q.ox += (q.x - q.ox) * fr; q.oy += (q.y - q.oy) * fr; } }
    }
    /* tornando su (e nel secondo dopo) il filo si rimette a piombo sotto il tasto: ogni punto scivola di lato verso la verticale del nodo,
       senza prendere velocità (si spostano insieme posizione e posizione di prima). Così segue il tasto invece di frustare in uncini */
    if (back && !hd && !(wt && !wt.free)) {
      var tp = this.top(), kg = this.state === "returning" ? 0.03 : 0.014;
      for (i = 1; i <= N; i++) { q = p[i]; var gdx = (tp.x - q.x) * kg * (0.5 + i / N); q.x += gdx; q.ox += gdx; }
      /* la coda non sale più in fretta del tasto (al più .6 della sua velocità in su): niente frusta a uncino in fondo */
      if (B) for (i = N - 5; i <= N; i++) { q = p[i]; var up = (q.oy - q.y) / h, lim = Math.max(0, -B.vy) * 0.6 + 30; if (up > lim) q.oy = q.y + lim * h; }
    }
    /* scendendo all'arrivo il filo non torna mai su se stesso: ogni punto sta sotto quello prima (niente riccioli né esse) */
    if (this.unroll >= 0 && !hd) for (i = 1; i <= N; i++) { if (p[i].y < p[i - 1].y) { p[i].y = p[i - 1].y; if (p[i].oy < p[i].y - 4) p[i].oy = p[i].y; } }
    /* quanto il filo ha spostato il tasto staccato diventa anche la sua velocità (se no il disco crederebbe di muoversi ancora) */
    if (B && this.state !== "returning") {
      B.vx += clamp(B.cx / h, -300, 300); B.vy += clamp(B.cy / h, -300, 300);
      var bv = Math.sqrt(B.vx * B.vx + B.vy * B.vy); if (bv > 900) { B.vx *= 900 / bv; B.vy *= 900 / bv; }   /* un filo teso non lo lancia via */
    }
    /* i piedi: toccano se un giro dei vincoli li ha posati; «feet» solo dopo almeno 60 ms in aria (niente raffiche) */
    if (wt && !wt.free) {
      if (wt.touch) { wt.air = 0; if (!wt.onG) { wt.onG = true; if (wt.feetOk !== false) emit("feet", { id: this.id }); wt.feetOk = false; } }
      else { wt.air = (wt.air || 0) + h; if (wt.air > 0.03) wt.onG = false; if (wt.air > 0.06) wt.feetOk = true; }
      wt.touch = false;
    }
    /* la tensione, misurata sul peso: quanto il filo lo tiene su rispetto al suo peso fermo (1 = appeso e basta). Con i piedi sulla
       mensola il filo lo regge poco (.15): conta la forza delle braccia (tug) */
    if (wt && !wt.free) {
      var ay = ((wt.y - wt.oy) - (wt.py || 0)) / (h * h); wt.py = wt.y - wt.oy;
      var tn = wt.onG ? 0.15 + (wt.tug || 0) : clamp((G - ay) / G + (wt.tug || 0), 0, 3);
      this.tens += (tn - this.tens) * 0.08;
    } else this.tens *= 0.9;
  };

  /* il tasto nel suo posto: una molla (k 900, ζ .55) che il filo tira, un dito o il peso di Dot */
  Rope.prototype.socket = function (h) {
    var o = this.off, tx = 0, ty = 0;
    if (this.held && this.pullD > -8) {
      var p = this.p[this.held.j], dx = p.x - this.knot.x, dy = p.y - this.knot.y, dl = Math.sqrt(dx * dx + dy * dy) || 1, pull = clamp((this.pullD + 8) / (PULL + 8), 0, 1.25);
      tx = dx / dl * pull * 4.2; ty = dy / dl * pull * 4.2;
    }
    if (this.weight && !this.weight.free && !this.B) { var t = this.tens; ty += clamp(t, 0, 1.6) * 4.6; this.strain = t / TEAR_K; }
    else this.strain *= 0.9;
    var k = 900, c = 2 * 0.55 * Math.sqrt(k);
    o.vx += (k * (tx - o.x) - c * o.vx) * h; o.vy += (k * (ty - o.y) - c * o.vy) * h; o.x += o.vx * h; o.y += o.vy * h;
    if (this.pop) this.pop = Math.max(0, this.pop - h * 4.5);
  };

  Rope.prototype.tear = function () {
    if (this.B || still()) return;
    var t = this.top(), wt = this.weight, v = wt && !wt.free ? { x: (wt.x - wt.ox) / H, y: (wt.y - wt.oy) / H } : { x: 0, y: 0 };
    /* cade un poco verso l'interno della mensola (i tasti stanno a destra), girando da 2,2 a 3,6 rad/s nel verso in cui poi rotola */
    var cx = ground ? (ground.left + ground.right) / 2 : this.sock.x, inward = this.sock.x > cx ? -1 : 1;
    this.B = { x: this.sock.x + this.off.x, y: this.sock.y + this.off.y, vx: inward * 90 + v.x * 0.25, vy: Math.max(150, v.y * 0.3) + 40, a: 0,
      va: inward * (2.2 + Math.random() * 1.4), onG: false };
    this.off.x = this.off.y = this.off.vx = this.off.vy = 0;
    /* il filo cade con il suo tasto: i punti prendono la sua velocità (se no il tasto gli cade addosso e la lana si arriccia) */
    for (var i = 1; i < this.p.length; i++) { var q = this.p[i]; q.ox = q.x - this.B.vx * H; q.oy = q.y - this.B.vy * H; }
    this.state = "torn"; this.held = null; this.overT = 0; this.restT = 0; this.downT = 0;
    this.btn.classList.add("is-strappato"); this.btn.setAttribute("aria-disabled", "true");
    if (this.btn === doc.activeElement) { try { this.btn.blur(); } catch (e) { } }
    var e0 = page(t.x, t.y); emit("torn", { id: this.id, x: e0.x, y: e0.y });
  };
  Rope.prototype.goHome = function () {
    if (!this.B || this.state === "returning") return;
    if (this.weight && !this.weight.free) { this.weight.free = true; this.weight = null; emit("slip", { id: this.id }); }
    this.state = "returning"; this.hold = false;
    this.B.vy = Math.min(this.B.vy, 0) - 320; this.B.vx += (this.sock.x - this.B.x) * 1.2;   /* un saltino, poi la molla lo riporta su */
    emit("return", { id: this.id });
  };

  /* ------------------------------------------------------------ i due fili e i loro tasti */
  function act(r) {
    if (r.id === "suono") { var s = doc.getElementById("sound"); if (s) s.click(); return; }   /* accesi, i suoni dicono già il loro «tap» */
    flipTema();
    if (soundOn()) tick();
  }
  /* il clic del cordino: un tic di 6 ms dai suoni di Dot quando ci sarà (DOT.sound.tick), intanto il «tap» della casa */
  function tick() {
    var D = W.DOT;
    try { if (D && D.sound && D.sound.tick) D.sound.tick(); else if (I && I.sound && I.sound.play) I.sound.play("tap"); } catch (e) { }
  }
  function make() {
    var s = doc.getElementById("sound");
    if (tb && !tb.hidden) ropes.push(new Rope("tema", tb));
    if (s) ropes.push(new Rope("suono", s));
    layout(true);
    ropes.forEach(function (r) { r.reset(false); bindHit(r); });
  }
  function layout(first) {
    nW.layout++;
    readHome(); readGround(); readLight();
    ropes.forEach(function (r) {
      var ox = r.knot.x, oy = r.knot.y; r.readSock();
      if (!first && r.p.length && (ox !== r.knot.x || oy !== r.knot.y)) {
        var dx = r.knot.x - ox, dy = r.knot.y - oy;
        r.p.forEach(function (q) { q.x += dx; q.y += dy; q.ox += dx; q.oy += dy; });
        if (r.B) { r.B.x += dx; r.B.y += dy; }
      }
    });
    sizeCanvas(); if (shown) { draw(); placeHits(); } wake();
  }
  function page(x, y) { return { x: x, y: y }; }                  /* tutto è già in coordinate della pagina: un nome per chi legge */

  /* ------------------------------------------------------------ le prese: strisce strette intorno al filo e basta, sotto il nodo */
  function placeHits() {
    var ni = root.classList.contains("ni-on");
    ropes.forEach(function (r) {
      var hs = r.hit.style;
      if (!shown || r.B || ni || !r.p.length) { if (hs.display !== "none") hs.display = "none"; return; }
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (var i = 1; i <= N; i++) { var q = r.p[i]; if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
      var pad = 13, cx = (x0 + x1) / 2, w = Math.max(30, x1 - x0 + pad * 2), top = Math.max(y0 - 2, r.knot.y + 3), ht = Math.max(24, y1 - top + 12);
      var L = (cx - w / 2 - homeOff.x).toFixed(1) + "px", Tp = (top - homeOff.y).toFixed(1) + "px", Wd = w.toFixed(1) + "px", Ht = ht.toFixed(1) + "px";
      if (hs.left !== L) hs.left = L; if (hs.top !== Tp) hs.top = Tp; if (hs.width !== Wd) hs.width = Wd; if (hs.height !== Ht) hs.height = Ht;
      if (hs.display) hs.display = "";
    });
  }
  function nearest(r, x, y) {
    var best = 1e9, bj = N, i;
    for (i = 1; i <= N; i++) { var q = r.p[i], d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y); if (d < best) { best = d; bj = i; } }
    return { j: bj, d: Math.sqrt(best) };
  }
  function bindHit(r) {
    var el = r.hit, tap = null;
    function pt(e) { return { x: e.clientX + sx(), y: e.clientY + sy() }; }
    el.addEventListener("pointerdown", function (e) {
      if (r.B || (e.pointerType === "mouse" && e.button !== 0)) return;
      var p = pt(e), n = nearest(r, p.x, p.y);
      if (n.d > 30) return;                                         /* troppo lontano dal filo: niente */
      e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { }
      /* fermi (meno movimento, fotografie): un tocco e basta, il tasto scatta al rilascio */
      if (still()) { tap = { id: e.pointerId, x: p.x, y: p.y }; return; }
      if (r.weight && !r.weight.free) { r.weight.free = true; r.weight = null; emit("slip", { id: r.id }); }   /* un dito sul filo: Dot scivola via */
      var t = now();
      r.held = { id: e.pointerId, j: Math.max(2, n.j), tx: p.x, ty: p.y, moved: false, vx: 0, vy: 0, lx: p.x, ly: p.y, lt: t };
      r.toggled = false; r.state = "held"; root.classList.add("filo-preso"); el.classList.add("is-preso");
      emit("grab", { id: r.id, j: r.held.j }); wake();
    });
    el.addEventListener("pointermove", function (e) {
      var hd = r.held; if (!hd || hd.id !== e.pointerId) return;
      var p = pt(e), t = now(), dt = Math.max(1, t - hd.lt) / 1000;
      hd.vx = hd.vx * 0.5 + (p.x - hd.lx) / dt * 0.5; hd.vy = hd.vy * 0.5 + (p.y - hd.ly) / dt * 0.5; hd.lx = p.x; hd.ly = p.y; hd.lt = t;
      hd.tx = p.x; hd.ty = p.y; hd.moved = true; wake();
    });
    function up(e) {
      if (tap && (!e || tap.id === e.pointerId)) {
        var ok = e && e.type === "pointerup"; tap = null;
        if (ok) { act(r); emit("pull", { id: r.id }); emit("release", { id: r.id, toggled: true }); }
        return;
      }
      var hd = r.held; if (!hd || (e && hd.id !== e.pointerId)) return;
      var q = r.p[hd.j], vx = clamp(hd.vx, -1600, 1600), vy = clamp(hd.vy, -1600, 1600);
      r.relK = r.k2 || 1; r.relJ = hd.j; r.tail = 0.35;   /* la coda resta un poco più rigida: niente uncino */
      if (now() - hd.lt > 80) { vx = 0; vy = 0; }                  /* fermo prima di lasciare: niente lancio */
      q.ox = q.x - vx * H; q.oy = q.y - vy * H;
      r.held = null; if (!r.B) r.state = "rest"; root.classList.remove("filo-preso"); el.classList.remove("is-preso");
      emit("release", { id: r.id, toggled: r.toggled }); wake();
    }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", function (e) { if (r.held && r.held.id === e.pointerId) up(e); });
  }

  /* ------------------------------------------------------------ il vento: la pagina che scorre, un dito o il mouse che passa vicino */
  var lastSy = sy(), vS = 0, aS = 0;
  W.addEventListener("scroll", function () { if (shown && visible()) wake(); }, { passive: true });
  /* entro 30 px: i 3 punti più vicini prendono un quarto della sua velocità */
  function brush(x, y, vx, vy) {
    if (!shown || still()) return;
    var any = false;
    ropes.forEach(function (r) {
      if (r.held || r.B || r.unroll >= 0) return;
      var n = nearest(r, x, y); if (n.d > 30) return;
      vx = clamp(vx, -1500, 1500); vy = clamp(vy, -1500, 1500);
      for (var i = Math.max(1, n.j - 1); i <= Math.min(N, n.j + 1); i++) { var q = r.p[i]; q.ox -= vx * 0.25 * H; q.oy -= vy * 0.25 * H; }
      any = true;
    });
    if (any) wake();
  }
  var mv = null;
  function onMove(x, y) {
    var t = now();
    if (mv && t - mv.t < 80 && near(x, y)) { var dt = Math.max(0.004, (t - mv.t) / 1000); brush(x, y, (x - mv.x) / dt, (y - mv.y) / dt); }
    mv = { x: x, y: y, t: t };
  }
  function near(x, y) { for (var i = 0; i < ropes.length; i++) { var r = ropes[i]; if (Math.abs(x - r.knot.x) < 70 && y > r.knot.y - 30 && y < r.knot.y + REST * 1.6) return true; } return false; }
  doc.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") onMove(e.clientX + sx(), e.clientY + sy()); }, { passive: true });
  doc.addEventListener("touchmove", function (e) { var t = e.touches[0]; if (t) onMove(t.clientX + sx(), t.clientY + sy()); }, { passive: true });

  /* ------------------------------------------------------------ il giro: gira solo finché qualcosa si muove */
  function visible() {
    var top = 1e9, bot = -1e9;
    ropes.forEach(function (r) { top = Math.min(top, r.sock.y - 30); bot = Math.max(bot, r.sock.y + REST * 2.4 + (r.B ? 200 : 0)); });
    return bot > sy() && top < sy() + W.innerHeight;
  }
  function busy() { for (var i = 0; i < ropes.length; i++) { var r = ropes[i]; if (r.held || (r.weight && !r.weight.free) || r.B || r.unroll >= 0 || r.pop > 0 || r.relK > 1) return true; } return false; }
  var nW = { wake: 0, start: 0, layout: 0 };                      /* per le prove: chi sveglia il giro */
  function wake() { quiet = 0; nW.wake++; if (!raf && !SHOT && !reduced() && !doc.hidden && shown) { nW.start++; lastT = 0; lastSy = sy(); vS = 0; aS = 0; raf = W.requestAnimationFrame(frame); } }
  function frame(t) {
    raf = 0;
    /* due chiamate con lo stesso tempo (un risveglio dentro un fotogramma) farebbero dt = 0 e NaN per sempre: almeno 1 ms */
    var dt = lastT ? clamp((t - lastT) / 1000, 0.001, 0.05) : 1 / 60; lastT = t;
    /* lo scorrimento: la pagina che accelera tira i fili (una forza apparente nel riferimento della pagina, × .045, al più ±1100 px/s²);
       un poco di lato (16% e 11%, dallo stesso lato: a specchio sembrerebbero un meccanismo), se no un filo dritto non dondolerebbe mai */
    var s = sy(), v = (s - lastSy) / dt; lastSy = s;
    var a = (v - vS) / dt; vS = v; aS += (clamp(a * 0.045, -1100, 1100) - aS) * 0.5;
    if (aS !== aS) aS = 0;
    var fy = aS, fx = aS * 0.16;
    acc += dt; var n = 0, moved = 0;
    while (acc >= H && n < MAXSTEP) {
      for (var i = 0; i < ropes.length; i++) {
        var r = ropes[i];
        r.step(H, i % 2 ? fx * 0.7 : fx, fy); r.socket(H); rules(r, H);
        var m0 = maxMove(r); r.slow = m0 < 0.12;
        if (m0 > moved) moved = m0;
        var o = r.off; if (Math.abs(o.x) + Math.abs(o.y) > 0.05 || Math.abs(o.vx) + Math.abs(o.vy) > 0.5) moved = Math.max(moved, 1);
      }
      simT += H; acc -= H; n++;
      quiet = moved < 0.02 && !busy() && Math.abs(aS) < 1 ? quiet + 1 : 0; moved = 0;
    }
    if (n >= MAXSTEP) acc = 0;
    if (simT - lightAt > 2) readLight();
    draw(); placeHits();
    for (var j = 0; j < ropes.length; j++) { var rw = ropes[j]; if (rw.weight && !rw.weight.free && !rw.B) emit("strain", { id: rw.id, strain: rw.strain }); }   /* una volta per fotogramma */
    emit("frame", null);
    if (quiet < 30 || (!visible() && busy())) {
      if (!raf && !doc.hidden && (visible() || busy())) raf = W.requestAnimationFrame(frame);
    } else { ropes.forEach(function (r) { r.p.forEach(function (q) { q.ox = q.x; q.oy = q.y; }); }); }   /* fermo: si dorme davvero */
  }
  function maxMove(r) { var m = 0, p = r.p; for (var i = 1; i <= N; i++) { var d = Math.abs(p[i].x - p[i].ox) + Math.abs(p[i].y - p[i].oy); if (d > m) m = d; } return m; }

  /* le regole: il clic del cordino, lo strappo, il ritorno, e il tasto che si muove col suo filo */
  function rules(r, h) {
    if (r.held && !r.toggled && r.pullD > PULL && r.held.ty > r.knot.y + 4) {
      r.toggled = true; r.pop = 1; r.off.vy -= 140;                /* il clic: il tasto fa un saltino nel suo posto */
      act(r); emit("pull", { id: r.id });
      try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) { }
    }
    if (r.weight && !r.weight.free && !r.B) {
      if (r.strain > 1) { r.overT += h; if (r.overT > TEAR_T) r.tear(); } else r.overT = Math.max(0, r.overT - h * 2);
    }
    if (r.state === "landed" && r.B) {
      var sp = Math.abs(r.B.vx) + Math.abs(r.B.vy) + Math.abs(r.B.va) * CONTACT;
      if (sp < 30) r.restT += h; else r.restT = 0;
      /* fermo da 0,95 s: torna. Se un peso lo tiene in ballo (Dot che non lascia il filo), torna comunque 3,5 s dopo lo strappo;
         holdDown lo trattiene */
      if ((r.restT > BACK_AFTER || r.downT > 3.5) && !r.hold) r.goHome();
    }
    if (r.B && (r.state === "landed" || r.state === "torn")) { r.downT += h; if (r.state === "torn" && r.downT > 3.5) r.goHome(); }   /* anche appeso a mezz'aria al filo di Dot */
    if (r.state === "returning" && r.B) {
      var d = Math.abs(r.B.x - r.sock.x) + Math.abs(r.B.y - r.sock.y), vv = Math.abs(r.B.vx) + Math.abs(r.B.vy);
      if (d < 0.8 && vv < 14) {
        r.B = null; r.state = "rest"; r.weight = null; r.pop = 1; r.off.vy = 40; r.calm = 1;
        r.btn.classList.remove("is-strappato"); r.btn.removeAttribute("aria-disabled");
        emit("returned", { id: r.id });
      }
    }
    paintBtn(r);
  }
  /* il tasto segue il suo filo: tirato nel suo posto, staccato, o di ritorno (un saltino che si posa con un 1,04) */
  function paintBtn(r) {
    var x = 0, y = 0, a = 0, sc = 1, B = r.B;
    if (B) { x = B.x - r.sock.x; y = B.y - r.sock.y; a = B.a; }
    else { x = r.off.x; y = r.off.y; }
    if (r.pop) sc = 1 + Math.sin(r.pop * Math.PI) * 0.04;
    var moving = B || Math.abs(x) + Math.abs(y) > 0.05 || r.pop;
    var key = moving ? x.toFixed(2) + "," + y.toFixed(2) + "," + a.toFixed(3) + "," + sc.toFixed(3) : "";
    if (key === r.tr) return; r.tr = key;
    var st = r.btn.style;
    if (TR) {
      st.translate = moving ? x.toFixed(2) + "px " + y.toFixed(2) + "px" : "";
      st.rotate = moving && a ? a.toFixed(3) + "rad" : "";
      st.scale = moving && sc !== 1 ? sc.toFixed(3) : "";
    } else st.transform = moving ? "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) rotate(" + a.toFixed(3) + "rad) scale(" + sc.toFixed(3) + ")" : "";
  }

  /* ------------------------------------------------------------ il disegno: lana a due capi ritorti, morbida, senza contorno */
  function path(p) {
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < N; i++) { var mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2; ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my); }
    ctx.lineTo(p[N].x, p[N].y);
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, box.w, box.h);
    if (!shown) return;
    ctx.translate(-(homeOff.x + box.x), -(homeOff.y + box.y));
    var dark = isDark();
    ropes.forEach(function (r) {
      var th = 2.15 / Math.sqrt(r.stretchK), p = r.p, i;
      if (th < 1.6) th = 1.6;
      /* il posto vuoto del tasto staccato: un anello appena visibile (--hair), che si accende man mano che il tasto si allontana */
      if (r.B) {
        var far = clamp((Math.abs(r.B.x - r.sock.x) + Math.abs(r.B.y - r.sock.y)) / 30, 0, 1);
        ctx.save(); ctx.globalAlpha = far; ctx.strokeStyle = dark ? "rgba(255,255,255,.1)" : "rgba(30,28,70,.09)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(r.sock.x, r.sock.y, 17.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (r.len < 0.6) return;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      /* l'ombra: il filo più scuro, spostato come le ombre delle tessere (dal sole della pagina) */
      ctx.save(); ctx.translate(shad.x, shad.y); path(p); ctx.strokeStyle = dark ? "rgba(0,0,0,.4)" : "rgba(60,40,80,.15)"; ctx.lineWidth = th + 0.5; ctx.stroke(); ctx.restore();
      /* il primo capo, poi il secondo che gli gira intorno (tratti obliqui ogni 2,5 px, più radi se il filo si allunga), poi la luce */
      path(p); ctx.strokeStyle = COL.ply; ctx.lineWidth = th; ctx.stroke();
      ctx.strokeStyle = COL.ply2; ctx.lineWidth = th * 0.42; ctx.beginPath();
      var step = 2.5 * r.stretchK, carry = r.twist, hw = th * 0.5;
      for (i = 0; i < N; i++) {
        var a = p[i], b = p[i + 1], ex = b.x - a.x, ey = b.y - a.y, L = Math.sqrt(ex * ex + ey * ey) || 1e-6, tx = ex / L, ty = ey / L, nx = -ty, ny = tx, u = carry;
        while (u < L) { var x = a.x + tx * u, y = a.y + ty * u; ctx.moveTo(x - nx * hw * 0.8 - tx * 0.75, y - ny * hw * 0.8 - ty * 0.75); ctx.lineTo(x + nx * hw * 0.8 + tx * 0.75, y + ny * hw * 0.8 + ty * 0.75); u += step; }
        carry = u - L;
      }
      ctx.stroke();
      ctx.save(); ctx.translate(light.x * th * 0.26, light.y * th * 0.26); path(p); ctx.globalAlpha = 0.8; ctx.strokeStyle = COL.hi; ctx.lineWidth = th * 0.3; ctx.stroke(); ctx.restore();
      /* la fine sfilacciata: tre fibre di 3 px che si aprono */
      var e = p[N], f = p[N - 1], ang = Math.atan2(e.y - f.y, e.x - f.x);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang); ctx.lineWidth = 0.6; ctx.lineCap = "round";
      ctx.strokeStyle = COL.ply; ctx.beginPath(); ctx.moveTo(-0.4, -0.5); ctx.quadraticCurveTo(1.4, -0.9, 2.9, -1.5); ctx.moveTo(-0.4, 0.5); ctx.quadraticCurveTo(1.5, 0.9, 2.8, 1.6); ctx.stroke();
      ctx.strokeStyle = COL.ply2; ctx.beginPath(); ctx.moveTo(-0.3, 0); ctx.lineTo(3, 0.15); ctx.stroke();
      ctx.restore();
      /* il nodo dove il filo lascia il tasto: 4,5 px di lana stretta, la luce sopra */
      var t0 = p[0], t1 = p[1], ag = Math.atan2(t1.y - t0.y, t1.x - t0.x);
      ctx.save(); ctx.translate(t0.x, t0.y); ctx.rotate(ag - Math.PI / 2);
      ctx.fillStyle = COL.knot; ctx.beginPath(); ctx.ellipse(0, 0.7, 2.25, 1.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.ply; ctx.beginPath(); ctx.ellipse(-0.35, 0.35, 1.35, 0.85, -0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.hi; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(-0.7 + light.x * 0.4, 0.1, 0.75, 0.42, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (r.weight && !r.weight.free && r.weight.draw && typeof W.FILO.drawWeight === "function") { try { W.FILO.drawWeight(ctx, apiRope(r), r.weight); } catch (x) { } }
    });
  }
  /* il peso di prova (filo-peso.html): una sagoma di 24 × 52 px appesa per le zampe, inclinata col filo. Non è Dot: Dot si disegna da sé */
  function standIn(c, rope, w) {
    var a = w.angle || 0, dark = isDark();
    if (Math.abs(a) > Math.PI / 2) a = 0;                          /* il filo sotto le zampe (il tasto caduto): la sagoma sta in piedi */
    c.save(); c.translate(w.x, w.y); c.rotate(-a);
    var bw = w.w || 24, bh = w.h || 52;
    c.fillStyle = dark ? "#2b2c36" : "#24242c";
    c.beginPath(); if (c.roundRect) c.roundRect(-bw / 2, 3, bw, bh - 3, bw / 2); else c.rect(-bw / 2, 3, bw, bh - 3); c.fill();
    c.fillStyle = dark ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.1)"; c.beginPath(); c.ellipse(-bw * 0.18, 14, bw * 0.16, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = dark ? "#3a3b47" : "#2f2f39"; c.beginPath(); c.ellipse(-3.2, 1.5, 3, 3.6, 0, 0, Math.PI * 2); c.ellipse(3.2, 1.5, 3, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /* ------------------------------------------------------------ l'arrivo: i fili si srotolano dai nodi quando la casa è libera.
     La prima volta in una sessione Dot apre la sua scatola: allora 8,6 s dopo, così non fanno a gara con lei; le altre volte 700 ms dopo.
     Con le fotografie (?shot=1) e con «meno movimento» pendono già, fermi */
  function show(unroll) {
    if (shown) return; shown = true; cv.style.visibility = "";
    layout(false);
    ropes.forEach(function (r) { r.reset(unroll && !still()); });
    draw(); placeHits(); wake();
  }
  function init() {
    make();
    if ("ResizeObserver" in W) new ResizeObserver(function () { layout(false); }).observe(doc.body); else W.addEventListener("resize", function () { layout(false); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { layout(false); });
    W.addEventListener("load", function () { layout(false); });
    doc.addEventListener("visibilitychange", function () { if (!doc.hidden) wake(); });
    /* le prese si nascondono mentre l'intro copre la pagina (html.ni-on); il tema cambia: la lana è la stessa, l'ombra no */
    if ("MutationObserver" in W) new MutationObserver(function () { if (shown) placeHits(); }).observe(root, { attributes: true, attributeFilter: ["class"] });
    if (T) T.on(function () { readLight(); if (shown) draw(); });
    var opening = false;
    try {
      var q = new URLSearchParams(location.search), seen = sessionStorage.getItem("imad.dot.aperto") === "1";
      opening = !!(W.__niDot && W.__niDot.dot) && (q.get("primo") === "1" || (q.get("primo") !== "0" && !SHOT && !seen));
    } catch (e) { }
    if (still() || !I || !I.whenFree) { show(false); return; }
    I.whenFree(function () { setTimeout(function () { show(true); }, opening ? 8600 : 700); });
  }

  /* ================================================================== 3. window.FILO: per il cervello di Dot (e per le prove) */
  function R(id) { for (var i = 0; i < ropes.length; i++) if (ropes[i].id === id) return ropes[i]; return null; }
  function apiRope(r) {
    var e = r.p[N], B = r.B, k = r.top();
    return { id: r.id, state: r.state, knot: { x: k.x, y: k.y }, socket: { x: r.sock.x, y: r.sock.y }, end: { x: e.x, y: e.y, vx: (e.x - e.ox) / H, vy: (e.y - e.oy) / H },
      length: r.len, strain: r.strain, points: r.p.map(function (q) { return { x: q.x, y: q.y }; }),
      button: B ? { x: B.x, y: B.y, a: B.a, r: BTN_R, onGround: !!B.onG } : { x: r.sock.x + r.off.x, y: r.sock.y + r.off.y, a: 0, r: BTN_R, onGround: false } };
  }
  W.FILO = {
    REST: REST, N: N, G: G,
    ids: function () { return ropes.map(function (r) { return r.id; }); },
    rope: function (id) { var r = R(id); return r && r.p.length ? apiRope(r) : null; },
    pointAt: function (id, s) { var r = R(id); if (!r || !r.p.length) return null; var g = r.at(s); return { x: g.x, y: g.y, angle: g.angle }; },
    /* appendere un peso (Dot) a s px dal nodo, con la sua velocità quando afferra. null con «meno movimento», col tasto via, o con un dito sul filo */
    hang: function (id, o) {
      var r = R(id); if (!r || !shown || r.B || r.held || still()) return null; o = o || {};
      if (r.weight && !r.weight.free) { r.weight.free = true; emit("let", { id: id, vx: 0, vy: 0 }); }
      var s = clamp(o.s == null ? 10 : +o.s, 2, REST - 0.5), g = r.at(s), vx = +o.vx || 0, vy = +o.vy || 0;
      var wt = { s: s, x: g.x, y: g.y, ox: g.x - vx * H, oy: g.y - vy * H, mass: +o.mass || MASS_W, h: +o.h || 60, w: +o.w || 24, slide: 0, tug: 0, free: false, onG: false, py: 0, draw: !!o.draw, angle: 0 };
      r.weight = wt; r.state = "weighted"; r.overT = 0; wake(); emit("hang", { id: id, s: s });
      function ang() { var a2 = r.at(Math.max(0, wt.s - 8)); return Math.atan2(wt.x - a2.x, wt.y - a2.y); }
      return {
        pos: function () { if (wt.free) return null; wt.angle = ang(); var g2 = r.at(wt.s); return { x: wt.x, y: wt.y, vx: (wt.x - wt.ox) / H, vy: (wt.y - wt.oy) / H, angle: wt.angle, ropeAngle: g2.angle, s: wt.s, strain: r.strain, onGround: wt.onG, atEnd: wt.s >= r.len - 1 }; },
        slide: function (speed) { wt.slide = speed == null ? 60 : Math.max(0, +speed || 0); wake(); },
        moveTo: function (s2) { wt.s = clamp(+s2 || 0, 2, REST - 0.5); wake(); },
        /* tirare con le braccia: f in pesi suoi (0 = appeso e basta). Coi piedi sulla mensola, f oltre 1,2 per 90 ms stacca il tasto */
        tug: function (f) { wt.tug = Math.max(0, +f || 0); wake(); },
        release: function (vx2, vy2) { if (wt.free) return; wt.free = true; r.calm = Math.max(r.calm, 0.15); if (r.weight === wt) { r.weight = null; if (!r.B) r.state = "rest"; } emit("let", { id: id, vx: vx2 || 0, vy: vy2 || 0 }); wake(); },
        get free() { return wt.free; }
      };
    },
    tear: function (id) { var r = R(id); if (r && shown && !r.B) { r.tear(); wake(); } },
    /* tenere il tasto caduto sulla mensola (Dot ci gioca), o lasciarlo tornare */
    holdDown: function (id, on) { var r = R(id); if (r) { r.hold = !!on; if (!on) { r.restT = 0; r.downT = 0; } wake(); } },
    goHome: function (id) { var r = R(id); if (r) { r.hold = false; r.goHome(); wake(); } },
    /* un colpo di zampa a x, y: ai punti del filo vicini (22 px) e, se è lì, al tasto caduto */
    bat: function (id, x, y, vx, vy) {
      var r = R(id); if (!r || still() || !r.p.length) return;
      vx = +vx || 0; vy = +vy || 0;
      r.p.forEach(function (q, i) { if (!i) return; var d = Math.sqrt((q.x - x) * (q.x - x) + (q.y - y) * (q.y - y)); if (d < 22) { var f2 = 1 - d / 22; q.ox -= vx * H * f2; q.oy -= vy * H * f2; } });
      var B = r.B; if (B && r.state !== "returning" && Math.sqrt((B.x - x) * (B.x - x) + (B.y - y) * (B.y - y)) < BTN_R + 10) { B.vx += vx * 0.6; B.vy += vy * 0.6; B.va += vx * 0.6 / CONTACT; r.restT = 0; r.downT = 0; }
      wake();
    },
    /* dove cade il tasto: di solito la mensola; fn(x, y, raggio) → { d, nx, ny } o null (null per tornare alla mensola) */
    ground: function (fn) { groundFn = typeof fn === "function" ? fn : null; },
    on: function (name, fn) { if (typeof fn === "function") (fans[name] = fans[name] || []).push(fn); },
    off: function (name, fn) { var l = fans[name]; if (l) { var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    wake: wake,
    layout: function () { layout(false); },
    show: function () { show(false); },
    /* chi disegna un peso appeso con { draw: true } (la sagoma della pagina di prova); si può sostituire */
    drawWeight: standIn,
    debug: { ropes: ropes, n: nW, step: function (n) { for (var i = 0; i < (n || 1); i++) { ropes.forEach(function (r, j) { r.step(H, 0, 0); r.socket(H); rules(r, H); }); simT += H; } draw(); placeHits(); } }
  };
  init();
})();
