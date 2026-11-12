/* Nuova apertura di imad.chat (anteprima, disegnata a codice su una tela).
   imad chatraoui → si cancella «raoui» → arriva il punto (versione «stella» o «cursore») → «chat» cresce e le lettere
   diventano finestre su un mosaico di riquadri → le nove lettere si mettono in griglia, come una faccia del cubo →
   la griglia gira come un cubo e si apre nei riquadri veri → imad.chat_ con il cursore che lampeggia.
   Tutto dipende da un solo tempo t (ms): ?seek=1 ferma la riproduzione e window.__ni.seek(ms) disegna quell'istante. */
(() => {
  "use strict";
  const root = document.documentElement, doc = document, Q = new URLSearchParams(location.search);
  const cvs = doc.getElementById("ni");
  if (!cvs || !cvs.getContext) return;
  window.__niStarted = true;
  const ctx = cvs.getContext("2d");
  const win = doc.createElement("canvas"), wctx = win.getContext("2d");
  const SEEK = Q.get("seek") === "1";
  const VERSIONS = ["stella", "cursore"];
  let version = "stella";
  if (doc.getElementById("nbar")) { try { const s = localStorage.getItem("imad.anteprima.intro"); if (VERSIONS.includes(s)) version = s; } catch (e) { /* senza memoria va bene lo stesso */ } }
  if (VERSIONS.includes(Q.get("v"))) version = Q.get("v");
  const MEDIA = window.__niMedia || "media/";

  /* la scritta nell'hero: nove caratteri e il cursore da terminale */
  function prepareWord() {
    const w = doc.querySelector(".hero__word");
    if (w && !w.querySelector(".ch")) {
      w.setAttribute("aria-label", "imad.chat");
      w.innerHTML = "imad.chat".split("").map((ch) => `<span class="ch${ch === "." ? " dot" : ""}" aria-hidden="true">${ch}</span>`).join("") + '<i class="cur" aria-hidden="true"></i>';
    }
    return w;
  }
  /* niente intro (meno movimento, pagina aperta su un riquadro, fotografie): la pagina è già nello stato finale */
  if (!root.classList.contains("ni-on")) { prepareWord(); root.setAttribute("data-ni", version); root.classList.add("ni-done"); window.__niDone = true; window.__niReady = true; return; }

  const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const SANS = 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const BG = "#05060a", INK = "#f3f4f8", GAPC = "#1c2038";
  const TEXT = "imad chatraoui", NAME = "imad.chat", TRACK = -0.045;
  /* che cosa c'è in ogni quadrato della griglia (i m a / d . c / h a t) e in quale riquadro vero va a finire */
  const CELLS = ["kaaba", "marocco", "torino", "viaggio", "night", "cube", "flag", "sky", "term"];
  const TILES = Array.isArray(window.__niTiles) && window.__niTiles.length === 9 ? window.__niTiles.slice() : ["corano", "curiosita", "sudime", "citta", "saluti", "cubo", "palestina", "cielo", "codice"];
  const MOSAIC = ["kaaba", "flag", "cube", "marocco", "term", "torino", "sky", "viaggio", "marocco2", "kaaba2"];

  /* ------------------------------------------------------------------ strumenti */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sat = (v) => clamp(v, 0, 1);
  const seg = (t, a, b) => sat((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const eOut = (p) => 1 - Math.pow(1 - p, 3);
  const eIn = (p) => p * p * p;
  const eIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const eOutQ = (p) => 1 - Math.pow(1 - p, 4);
  const eBack = (p, s) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  const eSine = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p);
  function rrect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function cover(c, img, iw, ih, x, y, w, h, z, fx, fy) {
    const s = Math.max(w / iw, h / ih) * z, sw = w / s, sh = h / s;
    c.drawImage(img, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h);
  }
  function mix(hex, k) { /* k < 1 scurisce, k > 1 schiarisce */
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ------------------------------------------------------------------ i tempi (ms) */
  const T = {};
  (() => {
    const gaps = [0, 58, 62, 70, 120, 78, 56, 62, 72, 96, 58, 54, 60, 66];
    let t = 260; T.key = gaps.map((g) => (t += g));
    t += 300; T.del = [0, 78, 64, 54, 48].map((g) => (t += g));
    T.glide0 = t + 30; T.glide1 = T.glide0 + 280;
    T.dot0 = T.glide1 - 30; T.dot1 = T.dot0 + 760;
    T.bold0 = T.dot1 + 90; T.bold1 = T.bold0 + 8 * 24 + 170;
    T.zoom0 = T.bold1; T.pan0 = T.zoom0 + 520; T.pan1 = T.pan0 + 1000; T.back1 = T.pan1 + 460;
    T.grid1 = T.back1 + 440; T.open0 = T.grid1 + 220; T.open1 = T.open0 + 300;
    T.mv1 = T.open1 + 210; T.mv2 = T.mv1 + 210; T.fly0 = T.mv2; T.flyDur = 600; T.fly1 = T.fly0 + T.flyDur + 8 * 26;
    T.type0 = T.fly0 + 560; T.type1 = T.type0 + 9 * 44; T.end = T.type1 + 260;
  })();
  const impact = () => T.dot0 + (version === "stella" ? 350 : 430);

  /* ------------------------------------------------------------------ immagini e scene vive */
  const IMG = {};
  const loadImages = () => Promise.all(["kaaba", "kaaba-2", "marocco", "marocco-2", "torino", "viaggio"].map((n) => new Promise((res) => {
    const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = () => res(); im.src = MEDIA + n + ".jpg";
  })));
  const SW = 360, SH = 450, SC = {};
  for (const n of ["flag", "term", "cube", "sky", "night"]) { const c = doc.createElement("canvas"); c.width = SW; c.height = SH; SC[n] = c; }

  /* la bandiera della Palestina, che sventola: nero, bianco, verde e il triangolo rosso all'asta */
  function sFlag(c, w, h, t) {
    c.fillStyle = "#0d0f15"; c.fillRect(0, 0, w, h);
    const FH = h * 0.86, L = FH * 2, x0 = -L * 0.03, top = (h - FH) / 2, ph = t * 0.0036, b = FH / 3;
    for (let x = 0; x < w; x += 2) {
      const u = (x - x0) / L; if (u < 0 || u > 1) continue;
      const k = u * 10.5 - ph, amp = FH * 0.028 * (0.3 + u * 1.7);
      const y = top + Math.sin(k) * amp + Math.sin(k * 0.47 + 1.3) * amp * 0.5, sl = Math.cos(k);
      c.fillStyle = "#000000"; c.fillRect(x, y, 2, b + 0.5);
      c.fillStyle = "#ffffff"; c.fillRect(x, y + b, 2, b + 0.5);
      c.fillStyle = "#009736"; c.fillRect(x, y + 2 * b, 2, b);
      if (u < 1 / 3) { const hh = (1 - u * 3) * FH / 2; c.fillStyle = "#ee2a35"; c.fillRect(x, y + FH / 2 - hh, 2, hh * 2); }
      c.fillStyle = sl > 0 ? `rgba(255,255,255,${(0.11 * sl).toFixed(3)})` : `rgba(0,0,0,${(-0.24 * sl).toFixed(3)})`; c.fillRect(x, y, 2, FH);
    }
  }
  /* un terminale che batte il codice vero del sito (il cuore di reteAngle) */
  const CODE = ["const giri =", "  (gast + lon / 15) / 24;", "return (giri % 1)", "  * 2 * Math.PI;"];
  const CODE_N = CODE.reduce((n, l) => n + l.length, 0);
  function sTerm(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#1c2458"); g.addColorStop(1, "#0f1434"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.textBaseline = "alphabetic"; c.textAlign = "left";
    c.fillStyle = "#f1dea6"; c.beginPath(); c.arc(34, 56, 5.5, 0, 6.3); c.fill();
    c.font = `500 17px ${MONO}`; c.fillStyle = "rgba(233,236,248,.66)"; c.fillText("reteAngle.ts", 50, 62);
    const cyc = CODE_N * 34 + 1900; let n = Math.floor(((t + 2500) % cyc) / 34);
    const typing = n < CODE_N;
    c.font = `500 21px ${MONO}`; let y = 136, cx = 28, cy = y;
    for (const line of CODE) {
      const m = Math.min(line.length, n), txt = line.slice(0, m), kw = /^(const|return)/.exec(line);
      c.fillStyle = "#e9ecf8"; c.fillText(txt, 28, y);
      if (kw) { c.fillStyle = "#f3d58c"; c.fillText(txt.slice(0, kw[0].length), 28, y); }
      cx = 28 + c.measureText(txt).width; cy = y; n -= line.length;
      if (n < 0) break; y += 42;
    }
    if (typing || Math.floor(t / 420) % 2 === 0) { c.fillStyle = "#f1dea6"; c.fillRect(cx + 3, cy - 19, 12, 23); }
  }
  /* il cubo di Imad: plastica bianca e i suoi colori pastello (Kukko) */
  const FACES = [
    { n: [0, 1, 0], a: [1, 0, 0], b: [0, 0, 1], col: "#ffb6c1" }, { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, 1], col: "#fdfd96" },
    { n: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0], col: "#ffb347" }, { n: [0, 0, -1], a: [1, 0, 0], b: [0, 1, 0], col: "#aec6cf" },
    { n: [1, 0, 0], a: [0, 0, 1], b: [0, 1, 0], col: "#77dd77" }, { n: [-1, 0, 0], a: [0, 0, 1], b: [0, 1, 0], col: "#ff6961" },
  ];
  function sCube(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#f7f2ea"); g.addColorStop(1, "#e4d9c8"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.47, s = w * 0.235, yaw = t * 0.00105 + 0.62, pitch = 0.56;
    const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rot = (p) => { const x1 = p[0] * cy_ + p[2] * sy_, z1 = -p[0] * sy_ + p[2] * cy_; return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp]; };
    const P = (p) => { const r = rot(p); return [cx + r[0] * s, cy - r[1] * s]; };
    const sh = c.createRadialGradient(cx, cy + s * 1.72, 0, cx, cy + s * 1.72, s * 1.5); sh.addColorStop(0, "rgba(70,48,24,.26)"); sh.addColorStop(1, "rgba(70,48,24,0)");
    c.save(); c.translate(0, (cy + s * 1.72) * 0.72); c.scale(1, 0.28); c.fillStyle = sh; c.fillRect(cx - s * 1.6, cy + s * 0.2, s * 3.2, s * 3.1); c.restore();
    const vis = FACES.map((f) => ({ f, r: rot(f.n) })).filter((o) => o.r[2] > 0.02).sort((p, q) => p.r[2] - q.r[2]);
    const quad = (pts, fill) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = fill; c.stroke(); };
    c.lineJoin = "round";
    for (const { f, r } of vis) {
      const k = 0.8 + 0.24 * Math.max(0, r[0] * -0.35 + r[1] * 0.75 + r[2] * 0.56);
      const at = (u, v) => P([f.n[0] + f.a[0] * u + f.b[0] * v, f.n[1] + f.a[1] * u + f.b[1] * v, f.n[2] + f.a[2] * u + f.b[2] * v]);
      c.lineWidth = s * 0.06; quad([at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)], mix("#f4f3ef", Math.min(1, k)));
      c.lineWidth = s * 0.07;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const u = i * 2 / 3, v = j * 2 / 3, e = 0.245;
        quad([at(u - e, v - e), at(u + e, v - e), at(u + e, v + e), at(u - e, v + e)], mix(f.col, k));
      }
    }
  }
  /* il cielo dell'ora blu, con le stelle */
  const STARS = (() => { const r = rng(20261111), a = []; for (let i = 0; i < 54; i++) a.push({ x: r(), y: Math.pow(r(), 1.5) * 0.72, m: 0.4 + r() * 0.9, p: r() * 6.3, s: 0.6 + r() }); return a; })();
  function sSky(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#0d1442"); g.addColorStop(0.42, "#27378a"); g.addColorStop(0.72, "#7a58a4"); g.addColorStop(0.9, "#d98a78"); g.addColorStop(1, "#f0b27e"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    STARS.forEach((st, i) => {
      const a = (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0021 * st.s + st.p))) * (1 - st.y * 0.9), x = st.x * w, y = st.y * h, r = st.m * (i % 9 === 0 ? 2.6 : 1.6);
      if (i % 9 === 0) { const gg = c.createRadialGradient(x, y, 0, x, y, r * 6); gg.addColorStop(0, `rgba(255,244,220,${(0.5 * a).toFixed(3)})`); gg.addColorStop(1, "rgba(255,244,220,0)"); c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 6, 0, 6.3); c.fill(); }
      c.fillStyle = `rgba(255,250,238,${a.toFixed(3)})`; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill();
    });
  }
  function sNight(c, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#0b1030"); g.addColorStop(1, "#18245c"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = rng(7); for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(255,248,232,${(0.15 + r() * 0.35).toFixed(3)})`; c.beginPath(); c.arc(r() * w, r() * h, 0.6 + r() * 1.2, 0, 6.3); c.fill(); }
  }
  function updateScenes(t) {
    sFlag(SC.flag.getContext("2d"), SW, SH, t); sTerm(SC.term.getContext("2d"), SW, SH, t);
    sCube(SC.cube.getContext("2d"), SW, SH, t); sSky(SC.sky.getContext("2d"), SW, SH, t);
  }
  const photo = (name, fx, fy, ph) => (c, x, y, w, h, t) => {
    const im = IMG[name];
    if (!im) { c.fillStyle = "#1a2248"; c.fillRect(x, y, w, h); return; }
    cover(c, im, im.naturalWidth, im.naturalHeight, x, y, w, h, 1.05 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.0005 + ph)), fx, fy);
  };
  const scene = (name) => (c, x, y, w, h) => cover(c, SC[name], SW, SH, x, y, w, h, 1, 0.5, 0.5);
  const CONTENT = {
    kaaba: photo("kaaba", 0.5, 0.5, 0), kaaba2: photo("kaaba-2", 0.5, 0.62, 1.3), marocco: photo("marocco", 0.5, 0.42, 2.1), marocco2: photo("marocco-2", 0.5, 0.5, 0.7),
    torino: photo("torino", 0.5, 0.36, 2.9), viaggio: photo("viaggio", 0.62, 0.55, 1.9),
    flag: scene("flag"), term: scene("term"), cube: scene("cube"), sky: scene("sky"), night: scene("night"),
  };

  /* ------------------------------------------------------------------ misure */
  let DPRCAP = 2;       /* densità della tela: scende da sola se il telefono fatica */
  let W = 0, H = 0, DPR = 1, fm = 26, adv = 16, xA = 0, anchorY = 0, baseM = 0, rM = 2.5, fb = 40, sBig = 500, sFit = 66, cell = 100, gap = 9, gridX = 0, gridY = 0, tw = 120;
  const EM = { e: [], a: [], E: 0 };
  const SQ = [];        /* i nove quadrati: dove atterrano */
  let heroEl = null, barEl = null, footEl = null, wordEl = null, chars = [], curEl = null;
  function measure() {
    W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, DPRCAP);
    cvs.width = win.width = Math.round(W * DPR); cvs.height = win.height = Math.round(H * DPR);
    fm = clamp(W * 0.082, 24, 40);
    ctx.font = `500 ${fm}px ${MONO}`; adv = ctx.measureText("m").width;
    xA = W / 2 - (TEXT.length * adv) / 2; anchorY = Math.round(H * 0.47); baseM = anchorY + fm * 0.28; rM = fm * 0.098;
    ctx.font = `800 100px ${SANS}`; let x = 0; EM.e.length = 0; EM.a.length = 0;
    for (const ch of NAME) { const a = ctx.measureText(ch).width / 100; EM.e.push(x); EM.a.push(a); x += a + TRACK; }
    EM.E = x - TRACK;
    fb = clamp(W * 0.105, 34, 76);
    sBig = Math.min(0.8 * Math.min(W, 820) / EM.a[5], H * 0.9);
    sFit = Math.min(0.84 * Math.min(W, 900) / EM.E, 150);
    gap = clamp(W * 0.024, 8, 14);
    cell = Math.min((Math.min(W, 560) - 2 * 26 - 2 * gap) / 3, (H * 0.62 - 2 * gap) / 3);
    gridX = W / 2 - (3 * cell + 2 * gap) / 2; gridY = anchorY - (3 * cell + 2 * gap) / 2;
    tw = clamp(W * 0.31, 108, 168);
    SQ.length = 0;
    TILES.forEach((id, k) => { const el = doc.querySelector('[data-tile="' + id + '"]'); const r = el ? el.getBoundingClientRect() : { left: W / 2, top: H, width: cell, height: cell }; SQ.push({ k, el, x: r.left, y: r.top, w: r.width, h: r.height }); });
    const order = SQ.slice().sort((p, q) => p.y - q.y || p.x - q.x); order.forEach((q, i) => { q.t0 = T.fly0 + i * 26; });
  }

  /* ------------------------------------------------------------------ il mosaico: tanti riquadri con dentro le sue cose */
  const PAT = [{ h: [1.28, 0.86, 1.06, 1.42], off: 0 }, { h: [0.9, 1.36, 1.1, 0.82, 1.2], off: 0.55 }, { h: [1.12, 1.0, 1.4, 0.88], off: 0.2 }, { h: [1.3, 0.84, 1.18], off: 0.8 }];
  PAT.forEach((p) => { p.total = p.h.reduce((a, b) => a + b, 0); });
  function drawMosaic(c, t, ox, oy, bb) {
    const gp = Math.max(5, tw * 0.055), colW = tw + gp, rad = tw * 0.13;
    const dx = ox - t * 0.008, dy = oy - t * 0.03;
    const j0 = Math.floor((bb.x0 - dx) / colW) - 1, j1 = Math.floor((bb.x1 - dx) / colW) + 1;
    for (let j = j0; j <= j1; j++) {
      const x = j * colW + dx; if (x + tw < bb.x0 || x > bb.x1) continue;
      const pat = PAT[((j % PAT.length) + PAT.length) % PAT.length], cyc = pat.total * tw + pat.h.length * gp;
      let y = ((((dy + pat.off * tw) % cyc) + cyc) % cyc) - cyc, k = 0;
      while (y < bb.y1) {
        const hh = pat.h[k % pat.h.length] * tw;
        if (y + hh > bb.y0) {
          const name = MOSAIC[((((j * 3 + (k % pat.h.length) * 7) % MOSAIC.length) + MOSAIC.length) % MOSAIC.length)];
          c.save(); rrect(c, x, y, tw, hh, rad); c.clip(); CONTENT[name](c, x, y, tw, hh, t); c.restore();
        }
        y += hh + gp; k++;
      }
    }
  }

  /* ------------------------------------------------------------------ il punto: stella o cursore */
  function drawStar(c, x, y, r, glow, a) {
    if (a <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, glow);
    g.addColorStop(0, `rgba(255,246,222,${(0.9 * a).toFixed(3)})`); g.addColorStop(0.18, `rgba(255,226,170,${(0.42 * a).toFixed(3)})`); g.addColorStop(0.5, `rgba(255,206,140,${(0.12 * a).toFixed(3)})`); g.addColorStop(1, "rgba(255,200,130,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, glow, 0, 6.3); c.fill();
    c.fillStyle = `rgba(255,251,240,${a.toFixed(3)})`; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill();
  }
  const shiftX = (t) => 2.5 * adv * eIO(seg(t, T.glide0, T.glide1));
  function hop(i, t) { /* le lettere sentono l'atterraggio del punto: un'onda che parte dal centro */
    const d = Math.abs(i - 4), tau = t - (impact() + d * 34);
    if (tau <= 0 || tau > 900) return 0;
    return -fm * (version === "stella" ? 0.34 : 0.2) * Math.exp(-0.55 * d) * Math.exp(-tau / 130) * Math.sin(tau / 48);
  }
  /* stato del punto nella riga a macchina: { x, y, r } a riposo; disegna anche l'arrivo */
  function dotRest(t) { return { x: xA + shiftX(t) + 4.5 * adv, y: baseM - rM, r: rM }; }
  function drawDotArrival(t) {
    const tau = t - T.dot0; if (tau < 0) return;
    const R = dotRest(t);
    if (version === "stella") {
      const hm = starHome(), xs = hm.x, ys = hm.y;
      const at = (u) => ({ x: lerp(xs, R.x, Math.pow(u, 0.82)), y: lerp(ys, R.y, u * u) });
      if (tau < 350) {
        const u = tau / 350;
        ctx.lineCap = "round";
        for (let k = 26; k >= 1; k--) { const u1 = u - k * 0.014, u2 = u - (k - 1) * 0.014; if (u1 <= 0) continue; const p1 = at(u1), p2 = at(u2), f = 1 - k / 27; ctx.strokeStyle = `rgba(255,232,186,${(0.5 * f * f).toFixed(3)})`; ctx.lineWidth = R.r * 2.1 * f + 0.4; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
        const p = at(u); drawStar(ctx, p.x, p.y, R.r * 1.15, fm * 1.25, 1);
        return;
      }
      const ti = tau - 350;                                   /* dopo l'impatto */
      let yo = 0;
      if (ti < 250) { const v = ti / 250; yo = -fm * 0.66 * 4 * v * (1 - v); } else if (ti < 390) { const v = (ti - 250) / 140; yo = -fm * 0.18 * 4 * v * (1 - v); }
      const q = Math.exp(-ti / 55) + (ti >= 250 ? 0.4 * Math.exp(-(ti - 250) / 45) : 0), sx = 1 + 0.85 * q, sy = 1 - 0.5 * Math.min(1, q);
      if (ti < 420) { const p = eOut(ti / 420); ctx.strokeStyle = `rgba(255,236,196,${(0.5 * (1 - ti / 420)).toFixed(3)})`; ctx.lineWidth = lerp(1.6, 0.6, p); ctx.beginPath(); ctx.ellipse(R.x, baseM, lerp(R.r, fm * 2.3, p), lerp(R.r * 0.5, fm * 0.62, p), 0, 0, 6.3); ctx.stroke(); }
      if (ti < 380) { const p = eOut(ti / 300 > 1 ? 1 : ti / 300), hw = 4.6 * adv * p, a = 0.5 * (1 - ti / 380); const g = ctx.createLinearGradient(R.x - hw, 0, R.x + hw, 0); g.addColorStop(0, "rgba(255,236,196,0)"); g.addColorStop(0.5, `rgba(255,236,196,${a.toFixed(3)})`); g.addColorStop(1, "rgba(255,236,196,0)"); ctx.fillStyle = g; ctx.fillRect(R.x - hw, baseM + 1.5, hw * 2, 1.4); }
      if (ti < 460) { /* scintille: schizzano basse lungo la riga e ricadono */
        const v = ti / 460;
        for (let k = 0; k < 9; k++) { const dir = k % 2 ? 1 : -1, sp = 0.55 + ((k * 37) % 10) / 10, px = R.x + dir * fm * (0.5 + 1.9 * sp) * eOut(v), py = baseM - fm * (0.5 + 0.5 * sp) * 4 * v * (1 - v) * 0.6 - 1; ctx.fillStyle = `rgba(255,234,190,${(0.8 * (1 - v) * (1 - v)).toFixed(3)})`; ctx.beginPath(); ctx.arc(px, py, Math.max(0.5, R.r * 0.42 * (1 - v)), 0, 6.3); ctx.fill(); }
      }
      ctx.save(); ctx.translate(R.x, baseM + yo); ctx.scale(sx, sy); drawStar(ctx, 0, -R.r, R.r, lerp(fm * 1.25, R.r * 5.6, sat(ti / 380)), 1); ctx.restore();
      return;
    }
    /* versione «cursore»: il _ salta all'indietro sopra «chat», atterra nello spazio e si stringe fino a diventare il punto */
    const bw = adv * 0.84, bh = Math.max(2, fm * 0.085), x9 = xA + shiftX(t) + 9 * adv + bw / 2, y9 = baseM + fm * 0.14 + bh / 2;
    ctx.fillStyle = INK;
    if (tau < 110) { const p = eOut(tau / 110); ctx.save(); ctx.translate(x9, y9 + p * 1.6); ctx.scale(1 + 0.14 * p, 1 - 0.42 * p); ctx.fillRect(-bw / 2, -bh / 2, bw, bh); ctx.restore(); return; }
    if (tau < 430) {
      const u = (tau - 110) / 320, e = eIO(u), s = Math.sin(Math.PI * u);
      ctx.save(); ctx.translate(lerp(x9, R.x, e), lerp(y9, R.y, u) - fm * 1.5 * 4 * u * (1 - u)); ctx.rotate(-Math.PI * 2 * e);
      const w = bw * (1 - 0.16 * s), h = bh * (1 + 0.7 * s); rrect(ctx, -w / 2, -h / 2, w, h, h / 2 * s); ctx.fill(); ctx.restore(); return;
    }
    const ti = tau - 430, v = sat(ti / 280);
    const w = 2 * R.r + (bw - 2 * R.r) * Math.exp(-v * 5.2) * Math.cos(v * 8.4), h = lerp(bh, 2 * R.r, eOut(v)), q = Math.exp(-ti / 50);
    if (ti < 340) { const p = eOut(ti / 340); ctx.strokeStyle = `rgba(243,244,248,${(0.34 * (1 - ti / 340)).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(R.x, baseM, lerp(R.r, fm * 1.5, p), lerp(R.r * 0.5, fm * 0.42, p), 0, 0, 6.3); ctx.stroke(); }
    ctx.save(); ctx.translate(R.x, baseM); ctx.scale(1 + 0.32 * q, 1 - 0.3 * q); rrect(ctx, -w / 2, -h, w, h, h / 2); ctx.fill(); ctx.restore();
  }
  function drawDot(x, y, r) { if (version === "stella") drawStar(ctx, x, y, Math.min(r, 13), clamp(r * 5.6, 9, 170), 1); else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); } }

  /* ------------------------------------------------------------------ il cielo dell'intro: stelle piccole e grandi che respirano, una stella cadente lontana.
     Una di quelle stelle ferme è quella che poi scende e diventa il punto. */
  const SKY = (() => { const r = rng(41), a = []; for (let i = 0; i < 84; i++) { const big = i % 7 === 0; a.push({ x: r(), y: Math.pow(r(), 1.25), r: big ? 1.15 + r() * 0.75 : 0.35 + r() * 0.6, big, a: big ? 0.7 + r() * 0.25 : 0.28 + r() * 0.42, per: 2600 + r() * 3200, ph: r() * 6.283, d: r() * 700 }); } return a; })();
  function starHome() { const R = dotRest(T.dot1); return { x: Math.min(W - 26, R.x + Math.min(W * 0.26, 130)), y: Math.max(44, anchorY * 0.42) }; }
  function drawSky(t, k) {
    if (k <= 0) return;
    const dim = 1 - 0.45 * seg(t, T.zoom0, T.zoom0 + 320);          /* dietro le lettere-finestra il cielo si abbassa un poco */
    for (let i = 0; i < SKY.length; i++) {
      const st = SKY[i], x = st.x * W, y = st.y * H * 0.96, br = 0.5 + 0.5 * Math.sin(t * 6.283 / st.per + st.ph);
      let a = st.a * (0.62 + 0.38 * br) * sat((t - st.d) / 520) * k * dim;
      if (Math.abs(y - anchorY) < fm * 1.15) a *= 0.3;                 /* la riga scritta resta pulita */
      if (a <= 0.01) continue;
      const rr = st.r * (0.9 + 0.2 * br);
      if (st.big) { const gl = rr * 5.5, g = ctx.createRadialGradient(x, y, 0, x, y, gl); g.addColorStop(0, `rgba(255,240,212,${(0.34 * a).toFixed(3)})`); g.addColorStop(1, "rgba(255,236,200,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, gl, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = `rgba(255,250,238,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.3); ctx.fill();
    }
    /* la stella che diventerà il punto: ferma tra le altre, respira; poco prima di scendere si accende */
    if (version !== "stella" || t < T.dot0) {
      const h = starHome(), br = 0.5 + 0.5 * Math.sin(t * 6.283 / 3400 + 1.1), wake = version === "stella" ? eIO(seg(t, T.dot0 - 300, T.dot0)) : 0;
      drawStar(ctx, h.x, h.y, lerp(1.7 * (0.9 + 0.2 * br), rM * 1.15, wake), lerp(10 + 3 * br, fm * 1.25, wake), sat(t / 520) * k * lerp(0.78 + 0.22 * br, 1, wake));
    }
    /* una stella cadente piccola e chiara, lontana, in alto */
    const s0 = T.key[4] + 40, u = (t - s0) / 760;
    if (u > 0 && u < 1) {
      const ax = W * 0.1, ay = H * 0.06, bx = W * 0.66, by = H * 0.15, e = Math.sin(Math.PI * u) * 0.42 * k;
      ctx.lineCap = "round";
      for (let j = 14; j >= 1; j--) { const u1 = u - j * 0.016, u2 = u - (j - 1) * 0.016; if (u1 <= 0) continue; const f = 1 - j / 15; ctx.strokeStyle = `rgba(235,240,255,${(e * f * f).toFixed(3)})`; ctx.lineWidth = 0.5 + 0.8 * f; ctx.beginPath(); ctx.moveTo(lerp(ax, bx, u1), lerp(ay, by, u1)); ctx.lineTo(lerp(ax, bx, u2), lerp(ay, by, u2)); ctx.stroke(); }
      ctx.fillStyle = `rgba(245,248,255,${Math.min(1, e * 1.6).toFixed(3)})`; ctx.beginPath(); ctx.arc(lerp(ax, bx, u), lerp(ay, by, u), 0.9, 0, 6.3); ctx.fill();
    }
  }

  /* ------------------------------------------------------------------ 1. la riga a macchina, poi le lettere diventano piene */
  function haze(a) { /* il nero non è piatto: un chiarore blu, appena accennato, dietro la scritta */
    if (a <= 0) return; const r = Math.max(W, H) * 0.62, g = ctx.createRadialGradient(W / 2, anchorY, 0, W / 2, anchorY, r);
    g.addColorStop(0, `rgba(52,64,140,${(0.17 * a).toFixed(3)})`); g.addColorStop(0.5, `rgba(34,42,96,${(0.07 * a).toFixed(3)})`); g.addColorStop(1, "rgba(20,24,60,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function phaseType(t) {
    haze(seg(t, 0, 500));
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    const sx = shiftX(t), pressed = T.key.filter((k) => k <= t).length, deleted = T.del.filter((k) => k <= t).length, n = pressed - deleted;
    const boldP = (i) => eOut(seg(t, T.bold0 + i * 24, T.bold0 + i * 24 + 170));
    const yB = anchorY + 0.27 * fb;
    for (let i = 0; i < TEXT.length; i++) {
      if (t < T.key[i] || i === 4) continue;
      let a = 1, dy = 0;
      const ti = t - T.key[i]; if (ti < 90) { const p = ti / 90; a = 0.4 + 0.6 * p; dy = (1 - eOut(p)) * fm * 0.16; }
      if (i >= 9) { const td = T.del[13 - i]; if (t >= td) { const p = (t - td) / 100; if (p >= 1) continue; a *= (1 - p) * 0.5; dy -= p * fm * 0.1; } }
      const x = xA + sx + i * adv, ch = TEXT[i];
      if (i < 9) {
        const p = boldP(i), yy = lerp(baseM, yB, p) + dy + hop(i, t), xx = lerp(x, W / 2 + (EM.e[i] - EM.E / 2) * fb, p), pop = 1 + 0.1 * Math.sin(Math.PI * p);
        if (p < 1) { ctx.globalAlpha = a * (1 - p); ctx.fillStyle = INK; ctx.font = `500 ${fm * lerp(1, 1.3, p)}px ${MONO}`; ctx.fillText(ch, xx, yy); }
        if (p > 0) { ctx.globalAlpha = p; ctx.fillStyle = INK; ctx.font = `800 ${lerp(fm * 1.1, fb, p) * pop}px ${SANS}`; ctx.fillText(ch, xx, yy); }
      } else { ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.font = `500 ${fm}px ${MONO}`; ctx.fillText(ch, x, baseM + dy); }
    }
    ctx.globalAlpha = 1;
    /* il punto */
    if (t >= T.dot0) {
      if (t < T.dot1) drawDotArrival(t);
      else { const R = dotRest(t), p = boldP(4), rb = 0.095 * fb; drawDot(lerp(R.x, W / 2 + (EM.e[4] + EM.a[4] / 2 - EM.E / 2) * fb, p), lerp(R.y, yB - rb, p) + hop(4, t), lerp(R.r, rb, p)); }
    }
    /* il cursore: fermo mentre si scrive, poi lampeggia */
    let cv = false, cs = 1;
    const cursorAway = version === "cursore" && t >= T.dot0 && t < T.dot0 + 600;
    if (!cursorAway) {
      const last = Math.max(0, ...T.key.filter((k) => k <= t), ...T.del.filter((k) => k <= t), version === "cursore" && t >= T.dot0 + 600 ? T.dot0 + 600 : 0);
      const since = t - last;
      cv = t > 60 && (last === 0 ? Math.floor(t / 265) % 2 === 0 : since < 380 || Math.floor((since - 380) / 530) % 2 === 1);
      if (version === "cursore" && t >= T.dot0 + 600) cs = eBack(seg(t, T.dot0 + 600, T.dot0 + 760), 2);
    }
    const ca = 1 - seg(t, T.bold0 - 40, T.bold0 + 110);
    if (cv && ca > 0) { const bw = adv * 0.84, bh = Math.max(2, fm * 0.085); ctx.globalAlpha = ca; ctx.fillStyle = INK; ctx.fillRect(xA + sx + n * adv, baseM + fm * 0.14 + bh * (1 - cs), bw, bh * cs); ctx.globalAlpha = 1; }
  }

  /* ------------------------------------------------------------------ 2. la cinepresa: entra in «chat», la attraversa, torna indietro */
  function cam(t) {
    const E = EM.E, cC = EM.e[5] + EM.a[5] / 2, cT = EM.e[8] + EM.a[8] / 2;
    if (t < T.pan0) { const u = seg(t, T.zoom0, T.pan0); return { size: fb * Math.pow(sBig / fb, eIO(u)), f: lerp(E / 2, cC, eOut(u)) }; }
    if (t < T.pan1) { const v = eSine(seg(t, T.pan0, T.pan1)); return { size: sBig * (1 + 0.035 * Math.sin(Math.PI * v)), f: lerp(cC, cT, v) }; }
    const w = eIO(seg(t, T.pan1, T.back1)); return { size: sBig * Math.pow(sFit / sBig, w), f: lerp(cT, E / 2, w) };
  }
  function roll(t) { /* la cinepresa si inclina un poco mentre attraversa le lettere */
    if (t < T.pan0) return -0.05 * eIO(seg(t, T.zoom0, T.pan0));
    if (t < T.pan1) return lerp(-0.05, 0.038, eSine(seg(t, T.pan0, T.pan1)));
    return 0.038 * (1 - eIO(seg(t, T.pan1, T.back1)));
  }
  const gCam = (i, c) => ({ x: W / 2 + (EM.e[i] - c.f) * c.size, y: anchorY + 0.27 * c.size, size: c.size });
  const gCell = (i) => { const size = cell * 0.64, cx = gridX + (i % 3) * (cell + gap) + cell / 2, cy = gridY + ((i / 3) | 0) * (cell + gap) + cell / 2; return { x: cx - EM.a[i] * size / 2, y: cy + 0.27 * size, size, cx, cy }; };
  /* le lettere come finestre: prima le lettere (del colore delle fughe), poi il mosaico solo dove ci sono loro */
  function drawWindows(t, glyphs, par, rot) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    wctx.setTransform(DPR, 0, 0, DPR, 0, 0); wctx.globalCompositeOperation = "source-over"; wctx.clearRect(0, 0, W, H);
    if (rot) { wctx.translate(W / 2, anchorY); wctx.rotate(rot); wctx.translate(-W / 2, -anchorY); }
    wctx.textBaseline = "alphabetic"; wctx.textAlign = "left"; wctx.fillStyle = GAPC;
    for (const g of glyphs) {
      if (g.a <= 0) continue;
      wctx.globalAlpha = g.a; wctx.font = `800 ${g.size}px ${SANS}`; wctx.fillText(g.ch, g.x, g.y);
      x0 = Math.min(x0, g.x - 2); x1 = Math.max(x1, g.x + g.size * 0.8); y0 = Math.min(y0, g.y - g.size * 0.82); y1 = Math.max(y1, g.y + g.size * 0.26);
    }
    wctx.globalAlpha = 1;
    if (x1 <= x0) return;
    if (rot) { wctx.setTransform(DPR, 0, 0, DPR, 0, 0); x0 = 0; y0 = 0; x1 = W; y1 = H; }      /* il mosaico resta dritto: sono le lettere a inclinarsi */
    wctx.globalCompositeOperation = "source-atop";
    drawMosaic(wctx, t, par, 0, { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x1), y1: Math.min(H, y1) });
    wctx.globalCompositeOperation = "source-over";
  }
  const blit = (a) => { if (a <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(win, 0, 0); ctx.restore(); };
  function phaseCam(t) {
    const c = cam(t), wa = eIO(seg(t, T.zoom0 + 60, T.zoom0 + 360)), glyphs = [], rot = roll(t);
    haze(1 - seg(t, T.zoom0, T.zoom0 + 300));
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.save(); ctx.translate(W / 2, anchorY); ctx.rotate(rot); ctx.translate(-W / 2, -anchorY);
    for (let i = 0; i < 9; i++) { if (i === 4) continue; const g = gCam(i, c); if (g.x > W + 4 || g.x + g.size < -4) continue; glyphs.push({ ch: NAME[i], x: g.x, y: g.y, size: g.size, a: 1 }); }
    if (wa < 1) { ctx.globalAlpha = 1 - wa; ctx.fillStyle = INK; for (const g of glyphs) { ctx.font = `800 ${g.size}px ${SANS}`; ctx.fillText(g.ch, g.x, g.y); } ctx.globalAlpha = 1; }
    if (wa > 0) {
      ctx.restore(); drawWindows(t, glyphs, -(c.f - EM.E / 2) * c.size * 0.16, rot); blit(wa);
      ctx.save(); ctx.translate(W / 2, anchorY); ctx.rotate(rot); ctx.translate(-W / 2, -anchorY);
      ctx.strokeStyle = `rgba(255,255,255,${(0.34 * wa).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.lineJoin = "round";
      for (const g of glyphs) { ctx.font = `800 ${g.size}px ${SANS}`; ctx.strokeText(g.ch, g.x, g.y); }
    }
    const d = gCam(4, c), r = 0.095 * c.size; drawDot(d.x + EM.a[4] * c.size / 2, d.y - r, r);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ 3. le nove lettere in griglia, poi le finestre si aprono */
  const plate = (x, y, s, a) => {
    if (a <= 0) return; ctx.globalAlpha = a; rrect(ctx, x, y, s, s, s * 0.24);
    const g = ctx.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, "#1b1d2b"); g.addColorStop(1, "#12131d"); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  };
  function phaseGrid(t) {
    const c = cam(T.back1), glyphs = [], whites = [];
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    for (let i = 0; i < 9; i++) {
      const t0 = T.back1 + i * 14, p = seg(t, t0, t0 + 330), pe = eOutQ(p), ps = eBack(p, 1.3), A = gCam(i, c), B = gCell(i);
      const pa = eOut(seg(t, t0 + 110, t0 + 360)), oa = eOut(seg(t, T.open0 + i * 16, T.open0 + i * 16 + 240)), wh = eOut(seg(t, t0 + 90, t0 + 330));
      const sc = lerp(0.82, 1, eBack(seg(t, t0 + 110, t0 + 400), 1.6)), s = cell * sc, px = B.cx - s / 2, py = B.cy - s / 2;
      /* il riquadro: già vivo, ma in penombra finché la lettera è accesa */
      if (pa > 0) { ctx.save(); ctx.globalAlpha = pa; rrect(ctx, px, py, s, s, s * 0.24); ctx.clip(); CONTENT[CELLS[i]](ctx, px, py, s, s, t); ctx.fillStyle = `rgba(6,7,13,${(0.62 * (1 - oa)).toFixed(3)})`; ctx.fillRect(px, py, s, s); ctx.restore(); }
      if (i === 4) { const r0 = 0.095 * c.size, rb = cell * 0.075; drawDot(lerp(A.x + EM.a[4] * c.size / 2, B.cx, pe), lerp(A.y - r0, B.cy, pe), lerp(r0, rb, ps)); continue; }
      const g = { ch: NAME[i], x: lerp(A.x, B.x, pe), y: lerp(A.y, B.y, pe), size: lerp(A.size, B.size, ps) };
      if (wh < 1) glyphs.push(Object.assign({ a: 1 - wh }, g));
      whites.push(Object.assign({ a: wh * (1 - oa) }, g));
    }
    if (glyphs.length) { drawWindows(t, glyphs, 0); blit(1); }
    ctx.fillStyle = INK;
    for (const g of whites) { if (g.a <= 0) continue; ctx.globalAlpha = g.a; ctx.font = `800 ${g.size}px ${SANS}`; ctx.fillText(g.ch, g.x, g.y); }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ 4. la griglia gira come un cubo e i quadrati volano ai riquadri veri */
  const isDark = () => { const a = root.getAttribute("data-theme"); return a ? a === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); };
  function square(k, x, y, w, h, rad, a, t, shade, wash) {
    if (a <= 0 || w < 1 || h < 1) return;
    ctx.save(); ctx.globalAlpha = a; rrect(ctx, x, y, w, h, rad); ctx.clip(); CONTENT[CELLS[k]](ctx, x, y, w, h, t);
    if (shade > 0) { ctx.fillStyle = `rgba(4,5,10,${shade.toFixed(3)})`; ctx.fillRect(x, y, w, h); }
    if (wash > 0) { ctx.globalAlpha = a * wash; ctx.fillStyle = isDark() ? "#1e1a14" : "#fbf5e9"; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    if (k === 4) { ctx.save(); ctx.globalAlpha = a; drawDot(x + w / 2, y + h / 2, Math.min(w, h) * 0.075); ctx.restore(); }
  }
  /* un quadrato in una posizione di griglia anche non intera: vicino al bordo si schiaccia, come uno strato che gira dietro lo spigolo */
  function slot(k, cf, rf, t) {
    const step = cell + gap, gx1 = gridX + 3 * cell + 2 * gap, gy1 = gridY + 3 * cell + 2 * gap;
    const x0 = gridX + cf * step, y0 = gridY + rf * step;
    const xa = Math.max(x0, gridX), xb = Math.min(x0 + cell, gx1), ya = Math.max(y0, gridY), yb = Math.min(y0 + cell, gy1);
    const w = xb - xa, h = yb - ya; if (w < 1 || h < 1) return;
    square(k, xa, ya, w, h, Math.min(cell * 0.24, w / 2, h / 2), 1, t, 0.5 * (1 - Math.min(w, h) / cell));
  }
  function phaseSquares(t) {
    if (t < T.mv2) {
      const s1 = eIO(seg(t, T.open1, T.mv1)), s2 = eIO(seg(t, T.mv1, T.mv2));
      if (t < T.mv1) {       /* mossa 1: la riga in alto scorre a sinistra, quella in basso a destra */
        for (let c = 0; c < 3; c++) { slot(c, c - s1, 0, t); slot(3 + c, c, 1, t); slot(6 + c, c + s1, 2, t); }
        slot(0, 3 - s1, 0, t); slot(8, -1 + s1, 2, t);
      } else {               /* mossa 2: la colonna a sinistra scende, quella a destra sale */
        const g = [[1, 2, 0], [3, 4, 5], [8, 6, 7]];
        for (let r = 0; r < 3; r++) { slot(g[r][0], 0, r + s2, t); slot(g[r][1], 1, r, t); slot(g[r][2], 2, r - s2, t); }
        slot(g[2][0], 0, -1 + s2, t); slot(g[0][2], 2, 3 - s2, t);
      }
      return;
    }
    const g2 = [[8, 2, 5], [1, 4, 7], [3, 6, 0]], step = cell + gap;
    const list = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) list.push({ q: SQ[g2[r][c]], x: gridX + c * step, y: gridY + r * step });
    list.sort((a, b) => b.q.t0 - a.q.t0);                 /* chi parte prima sta sopra */
    for (const it of list) {
      const q = it.q, p = seg(t, q.t0, q.t0 + T.flyDur); if (p >= 1) continue;
      const e = eIO(p), es = eOutQ(p);
      const paper = q.k === 0;        /* il quadrato che diventa il Corano */
      square(q.k, lerp(it.x, q.x, e), lerp(it.y, q.y, e), lerp(cell, q.w, es), lerp(cell, q.h, es), lerp(cell * 0.24, 32, e), paper ? 1 - seg(p, 0.86, 1) : 1 - eIn(seg(p, 0.5, 1)), t, 0, paper ? eIO(seg(p, 0.42, 0.8)) : 0);
    }
  }

  /* ------------------------------------------------------------------ la pagina sotto: compare mentre i quadrati atterrano */
  function applyDom(t) {
    const live = t < T.end;
    for (const q of SQ) { if (!q.el) continue; q.el.style.opacity = live ? String(eOut(seg(t, q.t0 + T.flyDur * (q.k === 0 ? 0.84 : 0.45), q.t0 + T.flyDur))) : ""; }
    if (heroEl) { const p = eOut(seg(t, T.fly0 + 120, T.fly0 + 620)); heroEl.style.opacity = live ? String(p) : ""; heroEl.style.transform = live && p < 1 ? `translateY(${((1 - p) * 16).toFixed(2)}px) scale(${(0.965 + 0.035 * p).toFixed(4)})` : ""; }
    const pb = live ? String(eOut(seg(t, T.fly0 + 360, T.fly0 + 760))) : "";
    if (barEl) barEl.style.opacity = pb; if (footEl) footEl.style.opacity = pb;
    const n = t < T.type0 ? 0 : Math.min(9, Math.floor((t - T.type0) / 44) + 1);
    chars.forEach((s, i) => { s.style.display = i < n || !live ? "" : "none"; });
    if (curEl) {
      const since = t - T.type1;
      curEl.style.opacity = !live ? "" : t < T.fly0 + 300 ? "0" : since < 320 || Math.floor((since - 320) / 530) % 2 === 1 ? "1" : "0";
    }
  }

  /* ------------------------------------------------------------------ un fotogramma */
  function frame(t) {
    if (cvs.style.background !== "transparent") cvs.style.background = "transparent";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    const bg = 1 - eIO(seg(t, T.fly0 + 30, T.fly0 + 560));
    if (bg > 0) { ctx.globalAlpha = bg; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; drawSky(t, bg); }
    if (t >= T.zoom0 - 40 && t < T.fly1) updateScenes(t);
    if (t < T.bold1) phaseType(t);
    else if (t < T.back1) phaseCam(t);
    else if (t < T.open1) phaseGrid(t);
    else if (t < T.fly1) phaseSquares(t);
    applyDom(t);
  }

  /* ------------------------------------------------------------------ avvio, fine, comandi dell'anteprima */
  let raf = 0, t0 = 0, playing = false, ready = false;
  function setup() {
    root.classList.remove("ni-done"); root.classList.add("ni-on", "is-locked"); root.setAttribute("data-ni", version);
    window.scrollTo(0, 0);
    heroEl = doc.getElementById("hero"); barEl = doc.getElementById("bar"); footEl = doc.querySelector(".foot"); wordEl = prepareWord();
    chars = wordEl ? Array.from(wordEl.querySelectorAll(".ch")) : []; curEl = wordEl ? wordEl.querySelector(".cur") : null;
    measure();
  }
  function finish() {
    playing = false; cancelAnimationFrame(raf);
    applyDom(T.end); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
    root.classList.remove("ni-on", "is-locked"); root.classList.add("ni-done");
    window.__niDone = true;
  }
  let lastNow = 0, slow = 0;
  function loop(now) {
    const t = now - t0; if (t >= T.end) { finish(); return; }
    /* se i fotogrammi arrivano tardi nella parte pesante, la tela si alleggerisce (il tempo dell'animazione non cambia) */
    if (lastNow && t > T.zoom0 && t < T.fly1) { if (now - lastNow > 30) { if (++slow >= 5 && DPRCAP > 1) { DPRCAP = Math.max(1, DPRCAP - 0.5); slow = 0; measure(); } } else if (slow > 0) slow--; }
    lastNow = now; frame(t); raf = requestAnimationFrame(loop);
  }
  function play() { cancelAnimationFrame(raf); window.__niDone = false; lastNow = 0; slow = 0; setup(); sNight(SC.night.getContext("2d"), SW, SH); playing = true; t0 = performance.now(); raf = requestAnimationFrame(loop); }
  function seek(ms) { if (!ready) return false; cancelAnimationFrame(raf); playing = false; if (!root.classList.contains("ni-on") || !chars.length) { setup(); sNight(SC.night.getContext("2d"), SW, SH); } if (ms >= T.end) { frame(T.end); finish(); } else frame(ms); return true; }
  window.addEventListener("resize", () => { if (playing) measure(); });

  const seg_ = doc.querySelectorAll(".nbar__seg button"), paint = () => seg_.forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === version)));
  seg_.forEach((b) => b.addEventListener("click", () => { version = b.getAttribute("data-v"); try { localStorage.setItem("imad.anteprima.intro", version); } catch (e) { /* va bene lo stesso */ } paint(); play(); }));
  const again = doc.getElementById("nbarPlay"); if (again) again.addEventListener("click", play);
  paint();

  const fonts = doc.fonts && doc.fonts.load ? [doc.fonts.load(`500 26px ${MONO}`, TEXT + "_."), doc.fonts.load(`800 60px ${SANS}`, NAME)] : [];
  const pics = loadImages();
  const wait = SEEK ? Promise.race([Promise.all([pics, Promise.all(fonts).catch(() => 0)]), new Promise((r) => setTimeout(r, 6000))]) : Promise.race([Promise.all(fonts).catch(() => 0), new Promise((r) => setTimeout(r, 1500))]);
  wait.then(() => { ready = true; window.__niReady = true; if (SEEK) { setup(); sNight(SC.night.getContext("2d"), SW, SH); frame(0); } else play(); });
  window.__ni = { seek, play, T, get version() { return version; }, set version(v) { if (VERSIONS.includes(v)) { version = v; paint(); } } };
})();
