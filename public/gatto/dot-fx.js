/* dot-fx.js — le piccole cose attorno a Dot: la nuvoletta, i graffi sul riquadro, le tele degli oggetti liberi
   (il fez caduto, il cubo, il gomitolo, la stella) con una fisica minima. Non decide nulla: lo muove dot-brain.js.
   Tutto vive in un livello posizionato in coordinate della pagina (scorre con la pagina). Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {});
  var doc = document, PI = Math.PI;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  var fx = (DOT.fx = {});

  /* ------------------------------------------------------------------ lo stile (una volta sola) */
  fx.css = function () {
    if (doc.getElementById("dot-css")) return;
    var s = doc.createElement("style"); s.id = "dot-css";
    s.textContent = [
      ".dot-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:40;pointer-events:none}",
      ".dot-layer canvas{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}",
      ".dot-grab{position:absolute;left:0;top:0;z-index:5;width:76px;height:76px;margin:0;padding:0;border:0;border-radius:50%;background:transparent;pointer-events:auto;touch-action:none;cursor:grab;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}",
      ".dot-grab:active{cursor:grabbing}.dot-grab:focus{outline:none}.dot-grab:focus-visible{outline:2px solid rgba(255,255,255,.7);outline-offset:-8px}",
      ".dot-fum{position:absolute;left:0;top:0;z-index:6;pointer-events:none;will-change:transform}",
      ".dot-fum__in{position:relative;padding:8px 13px 9px;border-radius:17px;background:rgba(250,249,246,.97);color:#16171d;font:700 14px/1.3 Manrope,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;letter-spacing:-.01em;white-space:nowrap;box-shadow:0 12px 30px -14px rgba(0,0,0,.6),0 0 0 .5px rgba(0,0,0,.07);opacity:0}",
      ".dot-fum--long .dot-fum__in{white-space:normal;width:204px;font-weight:650;font-size:13.5px}",
      ".dot-fum--mini .dot-fum__in{padding:4px 9px 5px;border-radius:12px;font-size:12px}",
      ".dot-fum__in:after{content:\"\";position:absolute;left:var(--tx,50%);bottom:-5px;width:11px;height:11px;margin-left:-5.5px;border-radius:2px;background:inherit;-webkit-transform:rotate(45deg);transform:rotate(45deg)}",
      ".dot-fum.is-below .dot-fum__in:after{bottom:auto;top:-5px}"
    ].join("\n");
    doc.head.appendChild(s);
  };

  /* ------------------------------------------------------------------ una tela che segue qualcosa: origine (ox, oy) dentro la tela */
  fx.Sprite = function (layer, w, h, ox, oy, z) {
    var cv = doc.createElement("canvas"), dpr = DOT.photoDpr || Math.min(window.devicePixelRatio || 1, 2), o = { cv: cv, ctx: cv.getContext("2d"), w: w, h: h, ox: ox, oy: oy, dpr: dpr, on: true };   /* DOT.photoDpr: solo per le foto di prova */
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px"; cv.style.zIndex = z || 2; cv.setAttribute("aria-hidden", "true");
    layer.appendChild(cv);
    o.place = function (x, y) { cv.style.transform = "translate3d(" + (x - ox).toFixed(2) + "px," + (y - oy).toFixed(2) + "px,0)"; };
    o.clear = function () { o.ctx.setTransform(1, 0, 0, 1, 0, 0); o.ctx.clearRect(0, 0, cv.width, cv.height); };
    /* trasforma ctx in unità del modello (k pixel per unità), y in alto, origine sul punto seguito */
    o.model = function (k) { o.ctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * ox, dpr * oy); return o.ctx; };
    o.show = function (v) { if (v !== o.on) { o.on = v; cv.style.display = v ? "block" : "none"; } };
    o.remove = function () { if (cv.parentNode) cv.parentNode.removeChild(cv); };
    return o;
  };

  /* ------------------------------------------------------------------ la nuvoletta: una molla vera (va col tempo del cervello, non con il CSS) */
  fx.Bubble = function (layer) {
    var el = doc.createElement("div"), inn = doc.createElement("div"), b = { on: false, sc: 0, v: 0, a: 0, left: 0, top: 0, w: 0, h: 0, until: 0, text: "" };
    el.className = "dot-fum"; inn.className = "dot-fum__in"; el.appendChild(inn); el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); layer.appendChild(el);
    b.el = el;
    b.say = function (text, sec, kind) {
      b.text = text; inn.textContent = text; el.className = "dot-fum" + (kind ? " dot-fum--" + kind : ""); el.style.display = "block";   /* visibile per misurarla (l'interno è ancora trasparente) */
      inn.style.transform = "none"; b.w = inn.offsetWidth || 120; b.h = inn.offsetHeight || 34; inn.style.transform = "scale(" + Math.max(0.001, b.sc).toFixed(3) + ")";
      b.on = true; b.until = sec; b.sc = Math.min(b.sc, 0.35); b.v = 0;
    };
    b.hide = function () { b.on = false; };
    b.vis = true;
    /* la molla: va chiamata con passi piccoli (il cervello lo fa a ogni passo) */
    b.phys = function (dt) {
      if (b.on) { b.until -= dt; if (b.until <= 0) b.on = false; }
      var want = b.on && b.vis ? 1 : 0, k = want ? 330 : 520, d = want ? 15 : 30;
      b.v += (-(b.sc - want) * k - b.v * d) * dt; b.sc += b.v * dt; if (!want && b.sc < 0.02) { b.sc = 0; b.v = 0; }
      b.a += ((want ? 1 : 0) - b.a) * (1 - Math.exp(-dt * (want ? 14 : 18)));
    };
    /* dove sta: ax, ay = punta della coda (sopra la testa); fy = sotto i piedi (se sopra non c'è posto); vx0, vy0, vw: la finestra */
    b.place = function (ax, ay, fy, vx0, vy0, vw, vis) {
      b.vis = vis;
      if (b.sc <= 0.001 && b.a < 0.01) { if (el.style.display !== "none") el.style.display = "none"; return; }
      if (el.style.display === "none") el.style.display = "block";
      var below = ay - b.h - 12 < vy0 + 8, left = clamp(ax - b.w / 2, vx0 + 12, vx0 + vw - 12 - b.w), top = below ? fy + 12 : ay - b.h - 7;
      var tx = clamp(ax - left, 16, b.w - 16);
      el.className = el.className.replace(/ is-below/, "") + (below ? " is-below" : "");
      el.style.transform = "translate3d(" + left.toFixed(1) + "px," + top.toFixed(1) + "px,0)";
      inn.style.setProperty("--tx", tx.toFixed(1) + "px");
      inn.style.transformOrigin = tx.toFixed(1) + "px " + (below ? "0%" : "100%");
      inn.style.transform = "scale(" + Math.max(0.001, b.sc).toFixed(3) + ")"; inn.style.opacity = clamp(b.a * 1.4, 0, 1).toFixed(3);
    };
    b.remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    return b;
  };

  /* ------------------------------------------------------------------ i graffi: una tela sopra il riquadro, quattro segni che poi svaniscono */
  fx.Scratch = function (layer, r, dark) {
    var w = Math.ceil(r.w), h = Math.ceil(r.h), sp = fx.Sprite(layer, w, h, 0, 0, 1), c = sp.ctx, s = { sp: sp, r: r, last: [null, null, null, null], life: -1, alpha: 1, dead: false };
    sp.place(r.x, r.y); c.setTransform(sp.dpr, 0, 0, sp.dpr, 0, 0); c.lineCap = "round";
    var col = dark ? "255,255,255" : "24,24,34";
    /* i: zampa 0..3, (x, y) in pagina, k: pixel per unità; ogni zampa lascia tre unghiate parallele */
    s.add = function (i, x, y, k) {
      var p = s.last[i]; x -= r.x; y -= r.y; s.last[i] = { x: x, y: y };
      if (!p || y - p.y < 0.6) { if (!p) s.last[i] = { x: x, y: y }; return; }
      for (var j = -1; j <= 1; j++) {
        var off = j * 1.45 * k + (i % 2 ? 0.4 : -0.4) * k, a = (0.42 - Math.abs(j) * 0.1) * (i < 2 ? 1 : 0.8);
        c.strokeStyle = "rgba(" + col + "," + a.toFixed(3) + ")"; c.lineWidth = (j ? 0.85 : 1.15) * Math.min(1.3, k / 1.5);
        c.beginPath(); c.moveTo(p.x + off, p.y - 1); c.lineTo(x + off * 1.04, y); c.stroke();
      }
    };
    s.done = function (wait) { s.life = wait == null ? 2.6 : wait; };
    s.step = function (dt) { if (s.life < 0 || s.dead) return; s.life -= dt; if (s.life < 0) { s.alpha -= dt / 2.4; sp.cv.style.opacity = Math.max(0, s.alpha).toFixed(3); s.life = 0; if (s.alpha <= 0) { s.dead = true; sp.remove(); } } };
    s.remove = function () { s.dead = true; sp.remove(); };
    return s;
  };

  /* ------------------------------------------------------------------ un corpo rigido piccolo (fez, cubo, gomitolo): cade, rimbalza, si assesta
     shape: angoli in pixel rispetto al centro, y in alto; rest: angoli stabili; r: raggio se rotola (gomitolo) */
  fx.Body = function (o) {
    var b = { x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, ang: o.ang || 0, va: o.va || 0, shape: o.shape, rest: o.rest || [0], r: o.r || 0, ground: false, still: 0, bounces: 0, landed: 0, out: false, g: o.g || 1500, onBounce: null };
    b.low = function () {                                           /* il punto più basso, in pagina */
      if (b.r) return b.y + b.r; var i, m = -1e9, ca = Math.cos(b.ang), sa = Math.sin(b.ang), p, yy;
      for (i = 0; i < b.shape.length; i++) { p = b.shape[i]; yy = -(p[0] * sa + p[1] * ca); if (yy > m) m = yy; } return b.y + m;
    };
    b.nearRest = function () { var i, best = b.rest[0], bd = 1e9, d; for (i = 0; i < b.rest.length; i++) { d = Math.abs(wrapA(b.ang - b.rest[i])); if (d < bd) { bd = d; best = b.rest[i]; } } return b.ang + wrapA(best - b.ang); };
    /* floor(x, y): la quota del bordo sotto (pagina) o Infinity */
    b.step = function (dt, floor) {
      var fy = floor(b.x, b.y), was = b.ground;
      b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.ang += b.va * dt; b.landed += dt;
      var lo = b.low();
      if (lo >= fy && b.y - (lo - b.y) < fy + 30) {
        b.y -= lo - fy;
        if (b.vy > 90) { b.vy = -b.vy * (b.bounces ? 0.22 : 0.34); b.va = b.va * 0.45 - b.vx * 0.012; b.vx *= 0.72; b.bounces++; if (b.onBounce) b.onBounce(b); }
        else { b.vy = 0; b.ground = true; }
      } else if (lo < fy - 0.5) b.ground = false;
      if (b.ground) {
        var tgt = b.nearRest();
        if (b.r) { b.va = -b.vx / b.r; b.vx *= Math.exp(-dt * 1.6); }                        /* rotola: angolo dal cammino */
        else { b.va += (-(b.ang - tgt) * 90 - b.va * 7) * dt; b.vx *= Math.exp(-dt * 4.2); }  /* dondola fino a un lato stabile, striscia e si ferma */
        if (!was) b.landed = 0;
      }
      if (Math.abs(b.vx) < 3 && Math.abs(b.va) < 0.15 && b.ground) b.still += dt; else b.still = 0;
      if (fy === Infinity && b.y > 1e5) b.out = true;
    };
    return b;
  };
  function wrapA(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  fx.wrapA = wrapA;
})();
