/* Nuova apertura di imad.chat (anteprima, disegnata a codice su una tela). COPIA di intro.js per la casa nuova (CASA.md 2c F):
   intro.js e intro.css sono quelli della home online e non si toccano. Qui ci sono tre versioni: «stella» e «cursore» come in
   intro.js (identiche), e «gatto», quella della casa nuova (la pagina la chiede con window.__niV = "gatto"; ?v=stella mostra quella di oggi).
   imad chatraoui → si cancella «raoui» → arriva il punto (versione «stella» o «cursore») → «chat» cresce e le lettere
   diventano finestre su un mosaico di riquadri → le nove lettere si mettono in griglia, come una faccia del cubo →
   la griglia gira come un cubo e si apre nei riquadri veri → imad.chat_ con il cursore che lampeggia.
   «gatto» (il punto è la stella) cambia solo la fine, e solo se l'apertura di Dot sta per partire (prima visita della sessione:
   window.__niDot.passage, lo decide casa.js): i nove quadrati si premono uno dopo l'altro e si dividono in due; la base resta, la
   finestra si accende e vola al suo riquadro; il tasto sale verso chi guarda e i nove tasti, insieme, volano sulla mensola di Dot e
   lì la scena di Dot (dot-stage.js, lo stesso pittore) li prende sullo stesso fotogramma. In ogni altro caso la fine è quella di oggi.
   «gatto» ha anche Dot (parte 6, se ci sono dot-rig.js e look-manifesto.js): è lui a buttare giù «raoui» dalla riga, al posto della
   cancellazione (mezzo secondo in più prima della griglia); col passaggio salta nel quadrato del punto prima della pressione.
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
  const VERSIONS = ["stella", "cursore", "gatto"];
  let version = VERSIONS.includes(window.__niV) ? window.__niV : "stella";
  if (doc.getElementById("nbar")) { try { const s = localStorage.getItem("imad.anteprima.intro"); if (VERSIONS.includes(s)) version = s; } catch (e) { /* senza memoria va bene lo stesso */ } }
  if (VERSIONS.includes(Q.get("v"))) version = Q.get("v");
  const MEDIA = window.__niMedia || "media/";
  /* il punto: «gatto» ha la stella, come «stella» (attributo data-ni: lo stile del punto nell'hero; data-ni-v: la versione) */
  const star = () => version !== "cursore";
  const dotKind = () => (star() ? "stella" : "cursore");

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
  if (!root.classList.contains("ni-on")) { prepareWord(); root.setAttribute("data-ni", dotKind()); root.setAttribute("data-ni-v", version); root.classList.add("ni-done"); window.__niDone = true; window.__niReady = true; return; }

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
  /* «gatto», il passaggio alla scatola di Dot: i suoi numeri (ms) e i momenti con un nome, in __ni.T come gli altri.
     settled: le nove lettere sono ferme nella griglia (il quadrato del punto è quello in cui Dot salterà, prima della pressione: DOT_GAP);
     press: comincia la pressione (un quadrato ogni STEP, in ordine di lettura); split: il primo tasto si stacca dalla sua base;
     landed: l'ultima base è atterrata nel suo riquadro, la pagina è libera (si scorre, si tocca); handover: i nove tasti sono fermi
     sulla mensola e la scena di Dot li prende. I tempi di oggi (fly0, fly1, type0, type1, end...) cambiano solo quando il passaggio c'è. */
  const G = {
    DOT_GAP: 280,     /* fermi, prima della pressione: lo spazio per Dot che salta nel quadrato del punto (la prossima parte) */
    STEP: 30,         /* tra un quadrato e il successivo */
    DIP: 110,         /* il quadrato scende */
    RISE: 300,        /* il tasto sale verso chi guarda (con un poco di troppo, poi si posa nell'aria) */
    LIFT: 0.1,        /* quanto sale il tasto: la distanza della sua ombra, in celle */
    CAPF: 0.64,       /* la faccia del tasto sulla griglia, in celle: intorno si vede la finestra della base */
    FLY_AFTER: 500,   /* dalla pressione alla prima base che vola */
    CAPS_AFTER: 560,  /* dalla pressione ai tasti che partono */
    ROWLAG: 36,       /* le righe partono e arrivano una dopo l'altra, l'ultima in basso: in volo il gruppo si allunga appena e torna */
    CAPDUR: 760,      /* il volo di una riga */
    SETTLE: 190,      /* l'arrivo: il tasto «scatta» al suo posto (la riga in basso si posa sul bordo), poi tre fotogrammi fermi prima della scena */
    ARC: 0.2,         /* quanto si incurva la strada (in parti della sua lunghezza) */
  };
  T.settled = T.back1 + 520;
  T.press = T.settled + G.DOT_GAP;
  T.split = T.press + G.DIP;
  T.capsGo = T.press + G.CAPS_AFTER;
  T.handover = T.capsGo + 2 * G.ROWLAG + G.CAPDUR + G.SETTLE;
  T.landed = T.press + G.FLY_AFTER + T.flyDur + 8 * 26;
  const T_TODAY = Object.assign({}, T);
  function passTimes() {
    const fly0 = T.press + G.FLY_AFTER, type0 = fly0 + 560, type1 = type0 + 9 * 44;
    return { open0: 1e9, open1: 1e9, mv1: 1e9, mv2: 1e9, fly0, fly1: fly0 + T.flyDur + 8 * 26, type0, type1, end: Math.max(type1 + 260, T.handover + 1) };
  }
  const impact = () => T.dot0 + (star() ? 350 : 430);

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
    const mx = ctx.measureText("x"); xh = mx.actualBoundingBoxAscent > 0 ? mx.actualBoundingBoxAscent : fm * 0.52;   /* «gatto»: l'altezza delle lettere, il bordo su cui Dot appoggia le zampe */
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
    TAS.gag.ok = TAS.jump.ok = false;                                     /* «gatto»: con le misure nuove il fiocco riparte da capo (stesso risultato di un seek) */
    if (capsCv && PASS && stg()) { CDPR = stg().dpr(); capsCv.width = Math.round(W * CDPR); capsCv.height = Math.round((H + CAPS_PAD) * CDPR); capsCv.style.width = W + "px"; capsCv.style.height = (H + CAPS_PAD) + "px"; capsTop = 0; capsCv.style.top = "0px"; }
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
    return -fm * (star() ? 0.34 : 0.2) * Math.exp(-0.55 * d) * Math.exp(-tau / 130) * Math.sin(tau / 48);
  }
  /* stato del punto nella riga a macchina: { x, y, r } a riposo; disegna anche l'arrivo */
  function dotRest(t) { return { x: xA + shiftX(t) + 4.5 * adv, y: baseM - rM, r: rM }; }
  function drawDotArrival(t) {
    const tau = t - T.dot0; if (tau < 0) return;
    const R = dotRest(t);
    if (star()) {
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
  function drawDot(x, y, r) { if (star()) drawStar(ctx, x, y, Math.min(r, 13), clamp(r * 5.6, 9, 170), 1); else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); } }

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
    if (!star() || t < T.dot0) {
      const h = starHome(), br = 0.5 + 0.5 * Math.sin(t * 6.283 / 3400 + 1.1), wake = star() ? eIO(seg(t, T.dot0 - 300, T.dot0)) : 0;
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
    if (GAGON) drawGag(t);                                                /* «gatto»: Dot sta dietro le lettere */
    for (let i = 0; i < TEXT.length; i++) {
      if (t < T.key[i] || i === 4) continue;
      let a = 1, dy = 0;
      const ti = t - T.key[i]; if (ti < 90) { const p = ti / 90; a = 0.4 + 0.6 * p; dy = (1 - eOut(p)) * fm * 0.16; }
      if (i >= 9 && GAGON) { if (letterBody(i, t)) continue; }          /* «gatto»: spinta da Dot, la lettera è un oggetto che cade (più sotto) */
      else if (i >= 9) { const td = T.del[13 - i]; if (t >= td) { const p = (t - td) / 100; if (p >= 1) continue; a *= (1 - p) * 0.5; dy -= p * fm * 0.1; } }
      const x = xA + sx + i * adv, ch = TEXT[i];
      if (i < 9) {
        const p = boldP(i), yy = lerp(baseM, yB, p) + dy + hop(i, t), xx = lerp(x, W / 2 + (EM.e[i] - EM.E / 2) * fb, p), pop = 1 + 0.1 * Math.sin(Math.PI * p);
        if (p < 1) { ctx.globalAlpha = a * (1 - p); ctx.fillStyle = INK; ctx.font = `500 ${fm * lerp(1, 1.3, p)}px ${MONO}`; ctx.fillText(ch, xx, yy); }
        if (p > 0) { ctx.globalAlpha = p; ctx.fillStyle = INK; ctx.font = `800 ${lerp(fm * 1.1, fb, p) * pop}px ${SANS}`; ctx.fillText(ch, xx, yy); }
      } else { ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.font = `500 ${fm}px ${MONO}`; ctx.fillText(ch, x, baseM + dy); }
    }
    ctx.globalAlpha = 1;
    if (GAGON) for (let i = 9; i < 14; i++) drawLetterBody(i, letterBody(i, t));   /* le lettere che cadono stanno davanti a tutto */
    /* il punto */
    if (t >= T.dot0) {
      if (t < T.dot1) drawDotArrival(t);
      else { const R = dotRest(t), p = boldP(4), rb = 0.095 * fb; drawDot(lerp(R.x, W / 2 + (EM.e[4] + EM.a[4] / 2 - EM.E / 2) * fb, p), lerp(R.y, yB - rb, p) + hop(4, t), lerp(R.r, rb, p)); }
    }
    /* il cursore: fermo mentre si scrive, poi lampeggia */
    let cv = false, cs = 1;
    const cursorAway = !star() && t >= T.dot0 && t < T.dot0 + 600;
    if (!cursorAway) {
      const last = Math.max(0, ...T.key.filter((k) => k <= t), ...T.del.filter((k) => k <= t), !star() && t >= T.dot0 + 600 ? T.dot0 + 600 : 0);
      const since = t - last;
      cv = t > 60 && (last === 0 ? Math.floor(t / 265) % 2 === 0 : since < 380 || Math.floor((since - 380) / 530) % 2 === 1);
      if (!star() && t >= T.dot0 + 600) cs = eBack(seg(t, T.dot0 + 600, T.dot0 + 760), 2);
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
      const sc = lerp(0.82, 1, eBack(seg(t, t0 + 110, t0 + 400), 1.6)) * (i === 4 ? 1 - dipAt(t) : 1), s = cell * sc, px = B.cx - s / 2, py = B.cy - s / 2;   /* «gatto»: il quadrato del punto sotto il peso di Dot */
      /* il riquadro: già vivo, ma in penombra finché la lettera è accesa */
      if (pa > 0) { ctx.save(); ctx.globalAlpha = pa; rrect(ctx, px, py, s, s, s * 0.24); ctx.clip(); CONTENT[CELLS[i]](ctx, px, py, s, s, t); ctx.fillStyle = `rgba(6,7,13,${(0.62 * (1 - oa)).toFixed(3)})`; ctx.fillRect(px, py, s, s); ctx.restore(); }
      GEO.sq[i] = { x: px, y: py, w: s, h: s, ds: 1 };                 /* solo un appunto per chi disegna Dot nell'intro: il disegno non cambia */
      if (i === 4) {
        const r0 = 0.095 * c.size, rb = cell * 0.075, dx = lerp(A.x + EM.a[4] * c.size / 2, B.cx, pe), dyy = lerp(A.y - r0, B.cy, pe), bk = blinkAt(t);
        if (bk < 1) { ctx.save(); ctx.translate(dx, dyy); ctx.scale(1, bk); ctx.translate(-dx, -dyy); }   /* «gatto»: il punto d'oro chiude e riapre l'occhio */
        const fd = dotFront(t); if (fd > 0) ctx.globalAlpha = 1 - fd;      /* «gatto»: mentre Dot entra, il punto passa davanti a lui (drawJump) */
        drawDot(dx, dyy, lerp(r0, rb, ps)); if (fd > 0) ctx.globalAlpha = 1; if (bk < 1) ctx.restore(); continue;
      }
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

  /* ------------------------------------------------------------------ 5. «gatto»: il passaggio alla scatola di Dot (solo quando PASS)
     I nove quadrati si premono uno dopo l'altro (STEP ms, in ordine di lettura). Ognuno scende e, risalendo, si divide: la base resta
     (la sua finestra si accende e poi vola al suo riquadro, come oggi) e il tasto (la lettera, ora un tasto color crema: lo stesso
     disegno della scena di Dot) sale verso chi guarda con un'ombra morbida. I nove tasti tengono la loro griglia, si rimpiccioliscono
     fino alla misura dei tasti della scena e volano insieme lungo un arco sulla mensola sopra l'hero; le righe arrivano una dopo
     l'altra, l'ultima in basso, e scattano al loro posto. All'arrivo la scena di Dot li prende sullo stesso fotogramma. */
  let PASS = false, freed = false, handed = false, cut = false, setupDone = false, lastT = 0;
  let capsCv = null, cctx = null, CDPR = 1, FORMED = null, capsTop = 0;
  const CAPS_PAD = 240;   /* la tela dei tasti è più alta dello schermo: così può salire e stare allineata, in verticale, alla tela della scena */
  const GEO = { phase: "", sq: [], cap: null };          /* dove sono adesso i quadrati e i tasti (per chi disegna Dot nell'intro) */
  const HOOKS = [];
  const stg = () => { const D = window.DOT, s = D && D.stage; return s && s.paint && s.formed && s.dpr && s.size ? s : null; };
  function passWanted() {
    const d = window.__niDot;
    if (version !== "gatto" || !d || !d.passage || !d.anchor || !d.handover || !stg()) return false;
    try { return !!d.anchor(); } catch (e) { return false; }
  }
  function makeCaps() {
    if (!capsCv) {
      capsCv = doc.createElement("canvas"); capsCv.setAttribute("aria-hidden", "true"); capsCv.className = "ni-tasti";
      const s = capsCv.style; s.position = "fixed"; s.top = "0px"; s.left = "0px"; s.margin = "0"; s.pointerEvents = "none";
      (doc.body || root).appendChild(capsCv); cctx = capsCv.getContext("2d");
    }
    capsCv.style.display = "block"; capsCv.style.zIndex = "91";        /* sopra la tela dell'intro; quando la pagina è libera scende sotto i fogli (60) */
  }
  function anchorV() { let a = null; try { a = window.__niDot.anchor(); } catch (e) { a = null; } return a ? { x: a.x - (window.pageXOffset || 0), y: a.y - (window.pageYOffset || 0) } : null; }
  const bez = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * c + u * u * b;

  /* un quadrato nel passaggio: quanto è premuto (ds), il buio sulla sua finestra, la lettera bianca che entra nel tasto, il tasto che esce */
  function kst(i, t) {
    const p0 = T.press + i * G.STEP, s0 = p0 + G.DIP, o = { ds: 1, shade: 0.62, la: 1, ls: 1, ca: 0, cs: 0.3, lf: 0 };
    if (t <= p0) return o;
    if (t < s0) { const u = eIO((t - p0) / G.DIP); o.ds = 1 - 0.1 * u; o.shade = 0.62 + 0.14 * u; }
    else {
      const tau = t - s0, r = sat(tau / G.RISE);
      o.ds = 1 - 0.1 * Math.exp(-tau / 70) * Math.cos(tau / 42);      /* risale, un filo oltre, si ferma */
      o.shade = 0.76 * (1 - eOut(sat(tau / 340)));                     /* la finestra si accende */
      o.ca = sat(tau / 16); o.cs = 0.3 + 0.7 * eBack(r, 1.6); o.lf = eBack(r, 1.2);     /* il tasto sboccia dal centro della lettera, pieno da subito, e cresce */
    }
    const v = sat((t - (s0 - 40)) / 90); o.la = 1 - eIO(v); o.ls = o.ds * lerp(1, 0.62, eIO(v));   /* la lettera bianca scende nel quadrato */
    return o;
  }
  /* la base: come square(), con il buio della griglia e senza il punto (il punto sale con il suo tasto) */
  function baseSq(k, x, y, w, h, rad, a, t, shade, wash) {
    if (a <= 0 || w < 1 || h < 1) return;
    ctx.save(); ctx.globalAlpha = a; rrect(ctx, x, y, w, h, rad); ctx.clip(); CONTENT[CELLS[k]](ctx, x, y, w, h, t);
    if (shade > 0) { ctx.fillStyle = `rgba(6,7,13,${shade.toFixed(3)})`; ctx.fillRect(x, y, w, h); }
    if (wash > 0) { ctx.globalAlpha = a * wash; ctx.fillStyle = isDark() ? "#1e1a14" : "#fbf5e9"; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  }
  function phaseKeys(t) {
    GEO.phase = t < T.capsGo ? "press" : "fly";
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort((a, b) => SQ[b].t0 - SQ[a].t0);   /* chi parte prima sta sopra */
    for (const i of order) {
      const q = SQ[i], k = kst(i, t), B = gCell(i), p = seg(t, q.t0, q.t0 + T.flyDur);
      if (p >= 1) { GEO.sq[i] = null; continue; }
      const s0 = cell * k.ds, e = eIO(p), es = eOutQ(p), paper = i === 0;   /* il quadrato che diventa il Corano */
      const x = lerp(B.cx - s0 / 2, q.x, e), y = lerp(B.cy - s0 / 2, q.y, e), w = lerp(s0, q.w, es), h = lerp(s0, q.h, es);
      baseSq(i, x, y, w, h, lerp(s0 * 0.24, 32, e), paper ? 1 - seg(p, 0.86, 1) : 1 - eIn(seg(p, 0.5, 1)), t, k.shade, paper ? eIO(seg(p, 0.42, 0.8)) : 0);
      GEO.sq[i] = { x, y, w, h, ds: k.ds };
    }
    /* le lettere bianche e la stella del punto, finché non entrano nel loro tasto */
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = INK;
    for (let i = 0; i < 9; i++) {
      const k = kst(i, t); if (k.la <= 0.003) continue;
      const B = gCell(i);
      ctx.save(); ctx.globalAlpha = k.la; ctx.translate(B.cx, B.cy); ctx.scale(k.ls, k.ls); ctx.translate(-B.cx, -B.cy);
      if (i === 4) drawDot(B.cx, B.cy, cell * 0.075); else { ctx.fillStyle = INK; ctx.font = `800 ${B.size}px ${SANS}`; ctx.fillText(NAME[i], B.x, B.y); }
      ctx.restore();
    }
  }
  /* i nove tasti a un istante: stati per il pittore della scena, rispetto al punto d'appoggio della scatola (A, sullo schermo).
     Arrivati e fermi sono una copia esatta degli stati della scena (DOT.stage.formed): lo stesso disegno, pixel per pixel */
  function capsStates(t, A) {
    const out = [], step = cell + gap, Z = stg().size, KEY = Z.KEY, PITCH = Z.PITCH;
    for (let i = 0; i < 9; i++) {
      const k = kst(i, t); if (k.ca <= 0) continue;
      const r = (i / 3) | 0, c = i % 3, f = FORMED[i], go = T.capsGo, arr = go + G.CAPDUR + r * G.ROWLAG;
      /* partono insieme e restano una griglia; verso la fine ogni riga resta un poco indietro, così arrivano una dopo l'altra (la più in basso per ultima) */
      const uc = seg(t, go, go + G.CAPDUR), u = seg(t - r * G.ROWLAG * uc * uc, go, go + G.CAPDUR);
      if (t >= arr + G.SETTLE - 50) { out.push(Object.assign({}, f)); continue; }   /* fermo: proprio lo stato della scena */
      const lpx = G.LIFT * cell * k.lf, face0 = G.CAPF * cell * k.cs;
      /* la riga, dalla griglia (il tasto alzato: un filo in alto a sinistra, verso la luce) alla mensola, lungo un arco */
      const sx0 = W / 2 - 0.15 * lpx, sy0 = gridY + r * step + cell / 2 - 0.3 * lpx, ex = A.x, ey = A.y - KEY / 2 - (2 - r) * PITCH;
      const ant = u < 0.3 ? Math.sin(Math.PI * u / 0.3) : 0;            /* prima di partire si raccoglie: un passo indietro, un filo più grande */
      const e = eIO(u * 0.93) / eIO(0.93) - 0.025 * ant, z = eIO(sat((u - 0.04) / 0.8));   /* arriva con un filo di velocità: lo scatto si sente */
      const dx = ex - sx0, dy = ey - sy0, len = Math.sqrt(dx * dx + dy * dy) || 1, cx = (sx0 + ex) / 2 - dy / len * G.ARC * len, cy = (sy0 + ey) / 2 + dx / len * G.ARC * len;   /* l'arco piega a destra: lontano dalla scritta dell'hero */
      const pitch = lerp(step, PITCH, z), face = lerp(face0, KEY, z) * (1 + 0.035 * ant);
      let x = bez(sx0, cx, ex, e) + (c - 1) * pitch, y = bez(sy0, cy, ey, e), kk = face / KEY, qx = 1, qy = 1;
      const tau = t - arr;                                              /* l'arrivo: il tasto scatta al suo posto (la riga in basso si posa sul bordo) */
      if (tau > 0) { const q = Math.exp(-tau / 38) * Math.sin(tau / 19); qy = 1 - (r === 2 ? 0.17 : 0.11) * q; qx = 1 + (r === 2 ? 0.09 : 0.06) * q; if (r === 2) y += KEY / 2 * (1 - qy); }
      const s = Object.assign({}, f), fl = 1 - eIO(u);
      s.x = x - A.x; s.y = y - A.y; s.sx = kk * qx; s.sy = kk * qy; s.k = kk; s.alpha = k.ca;
      s.lift = lpx * fl * (face / Math.max(1, face0)); s.light = 0.12 * Math.min(1, k.lf) * fl;
      if (f.dot) s.glow = lerp(0.95, f.glow, eIO(u));
      if (r === 2) { const land = eOut(seg(t, arr - 90, arr + 30)); s.ground = true; s.ca = land; s.aoK = 1 - land; }
      out.push(s);
    }
    return out;
  }
  function drawCaps(t) {
    if (!capsCv) return;
    cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, capsCv.width, capsCv.height); GEO.cap = null;
    if (!PASS || cut || handed || t < T.split) return;
    const A = anchorV(); if (!A) return;
    const st = capsStates(t, A); if (!st.length) return;
    const S = stg(), Z = S.size, rows = [[], [], []];
    for (const s of st) rows[s.row].push(s);
    /* la tela dei tasti comincia alla stessa altezza della tela della scena (dot-stage.js la mette a round(y - OY) nello strato di Dot):
       con le stesse righe di pixel il disegno è lo stesso anche a densità 1 (Chromium disegna le immagini rimpicciolite in modo diverso
       a seconda della riga in cui cadono). In orizzontale non serve: lì non cambia niente */
    let ly = 0; try { ly = window.__niDot.layerTop ? window.__niDot.layerTop() : 0; } catch (e) { ly = 0; }
    const ay = A.y + (window.pageYOffset || 0), top0 = ly + Math.round(ay - ly - Z.OY) - (window.pageYOffset || 0), top = top0 <= 0 && top0 >= -CAPS_PAD ? top0 : 0;
    if (top !== capsTop) { capsTop = top; capsCv.style.top = top + "px"; }
    cctx.setTransform(CDPR, 0, 0, CDPR, CDPR * A.x, CDPR * (A.y - top));
    /* riga per riga, dal basso: lo stesso ordine di disegno della scena (a riposo è identico), e ogni riga con gli sprite della sua misura */
    for (let r = 2; r >= 0; r--) {
      if (!rows[r].length) continue;
      let sc = 0; for (const s of rows[r]) sc = Math.max(sc, Math.abs(s.sx), Math.abs(s.sy));
      cctx.imageSmoothingQuality = sc > 1.001 ? "high" : "low";
      S.paint(cctx, rows[r], { dpr: CDPR, scale: sc });
    }
    GEO.cap = st.map((s) => ({ i: s.i, x: A.x + s.x - Z.KEY / 2 * Math.abs(s.sx), y: A.y + s.y - (Z.KEY / 2 + Z.BAND) * Math.abs(s.sy), w: Z.KEY * Math.abs(s.sx), h: (Z.KEY + Z.BAND) * Math.abs(s.sy), lift: s.lift || 0 }));
  }
  function doFree() {                                                   /* l'ultima base è atterrata: la pagina si scorre e si tocca */
    freed = true; root.classList.remove("ni-on", "is-locked");
    if (capsCv) capsCv.style.zIndex = "55";                            /* sopra il dock (50), sotto i fogli (60) */
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
  }
  function doHandover(formed) {                                         /* la scena di Dot prende i tasti: la tela dei tasti si svuota nello stesso compito */
    if (handed) return; handed = true;
    if (capsCv) { cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, capsCv.width, capsCv.height); }
    try { window.__niDot.handover(!!formed); } catch (e) { if (window.console) console.error(e); }
  }
  function hooks(t) {                                                   /* per chi disegnerà Dot nell'intro (versione «gatto»): un aggancio a ogni fotogramma */
    if (version !== "gatto" || !HOOKS.length) return;
    const info = { t, T, G, W, H, dpr: DPR, ctx, caps: PASS ? cctx : null, capsDpr: CDPR, pass: PASS, freed, handed, cell, gap, gridX, gridY, centre: gCell(4), geo: GEO, press: (i) => kst(i, t), anchor: PASS ? anchorV() : null };
    for (const fn of HOOKS) { ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); try { fn(info); } catch (e) { if (window.console) console.error(e); } ctx.restore(); }
  }

  /* ------------------------------------------------------------------ 6. «gatto»: Dot nell'intro (CASA.md 2c A). Solo nella versione «gatto»,
     solo se ci sono lo scheletro e l'aspetto Manifesto (dot-rig.js, look-manifesto.js: lo stesso disegno del sito), mai con ?dot=no.
     a) Al posto della cancellazione di «raoui». Dot sale da dietro la fine della riga: le lettere sono il suo bordo (le zampe ci
        stanno sopra, da dietro) e niente di lui scende sotto la riga di base. Guarda il cursore, chi guarda, la «i»; spinge la «i»
        piano, guardando chi guarda (la pausa è la battuta); poi u, o, a, r con una zampata sola, la testa dietro la zampa. Ogni
        lettera è un oggetto: si inclina in avanti sul suo piede, scivola giù, cade per gravità girando un poco e sparisce sotto la
        riga, sfumando solo alla fine della caduta; il cursore torna indietro con loro. Dot guarda «imad chat», chiude piano gli occhi
        e torna giù, le orecchie per ultime, mentre «chat» scivola al suo posto. Mezzo secondo in più (GD) prima della griglia.
     b) Solo col passaggio (prima visita della sessione): quando le nove lettere stanno in griglia Dot salta da sotto nel quadrato
        del punto: un arco scuro, schiacciato alla partenza e all'arrivo, la coda per ultima; il quadrato si abbassa sotto il suo
        peso e torna, il punto d'oro chiude e riapre l'occhio. Poi la pressione del passaggio. Mai vicino alla Kaʿba o alla bandiera
        (i quadrati a sinistra): l'arco viene da destra.
     Tutto è funzione di t: __ni.seek(ms) disegna qualunque istante (anche il fiocco del fez: si rifà dall'inizio a passi fissi). */
  const GD = 500;                 /* ms in più prima della griglia, al massimo mezzo secondo */
  const UL = 24.8 / 3;            /* una lettera della riga, in unità del modello: la testa di Dot (2 × 12.4) è larga tre lettere */
  /* i tempi della scenetta, in ms dall'ultimo tasto (T.key[13]); le lettere: i, u, o, a, r */
  const GA = {
    up0: 40, up1: 112, up2: 152, up3: 206, up4: 310, /* le punte delle orecchie; ferme (uno scatto); orecchie e fez; poi gli occhi, con un rimbalzo */
    paw0: 262, paw1: 300,                            /* le zampe salgono sulle lettere, una e poi l'altra */
    caret1: 440, view0: 472,                         /* guarda il cursore fino a caret1; chi guarda da view0 (almeno 180 ms) */
    glance: 660, stare: 735,                         /* guarda la «i»; poi di nuovo chi guarda, mentre la spinge */
    reach0: 630, reach1: 722,                        /* la zampa destra va sulla «i» */
    push0: 722, over: 848, iGo: 880,                 /* la «i»: si inclina piano; passa il punto di non ritorno; se ne va */
    wind: 882, sw0: 910, sw1: 1064,                  /* la zampa si alza e carica; la zampata */
    hits: [935, 968, 1001, 1034], leave: 22,         /* u, o, a, r: la zampa passa; ognuna se ne va LEAVE ms dopo */
    lower0: 1050, lower1: 1170,                      /* senza più lettere sotto si appoggia alla riga */
    blink0: 1084, blink1: 1290,                      /* chiude piano gli occhi guardando «imad chat», li riapre */
    sink0: 1190, sink1: 1376,                        /* torna giù; alla fine rallenta: un orecchio resta per ultimo sopra la riga */
  };
  /* il salto nel quadrato del punto: t0 in ms da T.back1 (le lettere arrivano in griglia; settled = back1 + 520), gli altri dall'inizio del salto */
  const JA = { t0: 300, crouch: 70, launch: 128, land: 420, in0: 478, in1: 612, blink0: 604, blink1: 744, press: 646 };
  const DOT_GAP_J = JA.t0 + JA.press - 520;    /* col salto, la pressione parte quando il punto chiude l'occhio */
  let GAGON = false, JUMP = false, cat = null, xh = 17, jcv = null, jctx = null, catBB = null;
  /* dove sta Dot sullo schermo (per gli strumenti): il rettangolo che lo contiene, da un fotogramma dello scheletro */
  function catBox(f, ox, oy, K, dy, clipY) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const add = (x, y, r) => { if (clipY != null && y + r < clipY) return; x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
    add(f.head.x, f.head.y, Math.max(f.head.rx, f.head.ry)); f.ears.forEach((e) => add(e.tx, e.ty, 0.5)); if (f.fez) { add(f.fez.tx, f.fez.ty, f.fez.rTop); add(f.fez.tassel.x1, f.fez.tassel.y1, 0.6); }
    add(f.body.hips.x, f.body.hips.y, f.body.hips.r); add(f.body.chest.x, f.body.chest.y, f.body.chest.r);
    f.legs.forEach((l) => { add(l.fx, l.fy, l.paw); add(l.kx, l.ky, l.r0); }); f.tail.pts.forEach((q) => add(q.x, q.y, q.r));
    return x1 < x0 ? null : { x: ox + K * x0, y: oy - K * (y1 - dy), w: K * (x1 - x0), h: K * (y1 - y0) };
  }
  const gagWanted = () => { const D = window.DOT; return version === "gatto" && Q.get("dot") !== "no" && !!(D && D.makeRig && D.looks && D.looks.manifesto && D.YAW && D.POSES && D.POSES.peek); };
  function makeCat() {
    const D = window.DOT, look = D.looks.manifesto, rig = D.makeRig(look.preset);
    rig.autoBlink = false; rig.earTwitch = false; rig.spring = 0; rig.headMax = 0.7; rig.grounded = false;
    return { D, look, rig };
  }
  /* le chiavi: [[t, valore, curva]], la curva è quella del tratto che arriva alla chiave */
  const spr = (p) => 1 - Math.exp(-6.2 * p) * Math.cos(9.6 * p) + (Math.exp(-6.2) * Math.cos(9.6)) * p;    /* arriva, passa un filo oltre, si posa */
  const EZ = { io: eIO, o: eOut, i: eIn, s: eSine, l: (p) => p, b: (p) => eBack(p, 1.8), sp: spr, oq: eOutQ };
  function kv(ks, t) {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) if (t < ks[i][0]) { const a = ks[i - 1], b = ks[i]; return a[1] + (b[1] - a[1]) * EZ[b[2] || "io"]((t - a[0]) / (b[0] - a[0])); }
    return ks[ks.length - 1][1];
  }
  /* una curva morbida che passa per i punti [[t, v]] (ferma ai due capi): la zampata */
  function spline(ks, t) {
    const n = ks.length; if (t <= ks[0][0]) return ks[0][1]; if (t >= ks[n - 1][0]) return ks[n - 1][1];
    let i = 0; while (t >= ks[i + 1][0]) i++;
    const a = ks[i], b = ks[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
    const m = (j) => (j <= 0 || j >= n - 1 ? 0 : (ks[j + 1][1] - ks[j - 1][1]) / (ks[j + 1][0] - ks[j - 1][0]) * h);
    return (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * m(i) + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * m(i + 1);
  }

  /* ---- a) la scenetta della riga: i numeri a un istante (tau = ms dall'ultimo tasto) */
  const FS = 1.6, SHL = 3.6 + FS;                    /* le spalle strette (la «peek» del Manifesto le ha a 10.2): gli avambracci corti, appoggiati sulle lettere */
  const PX1 = [[0, UL], [GA.reach0, UL], [GA.reach1, 2 * UL, "io"], [GA.iGo, 2 * UL + 1.1, "io"], [GA.wind, 2 * UL + 1.1], [GA.sw0, 2 * UL + 1.9, "io"]];
  const SWEEP = [[GA.sw0, 2 * UL + 1.9], [GA.hits[0], UL], [GA.hits[1], 0], [GA.hits[2], -UL], [GA.hits[3], -2 * UL], [GA.hits[3] + 36, -2.2 * UL], [GA.sw1 + 40, -1.75 * UL]];   /* passata la «r» la zampa torna subito: l'avambraccio non resta lungo */
  const BX = [[0, 0], [GA.reach0, 0], [GA.reach1, 2.6, "io"], [GA.wind, 2.6], [GA.sw0, 3.4, "io"], [GA.hits[3] + 20, -10.4, "io"], [GA.sw1 + 40, -11.6, "o"]];   /* il corpo va dietro alla zampa: si sporge a destra per la «i», poi scivola a sinistra con la zampata */
  const tr = {
    h: [[0, 27], [GA.up0, 27], [GA.up1, 23.4, "o"], [GA.up2, 23.1, "io"], [GA.up3, 12.6, "io"], [GA.up4, 0, "sp"], [GA.sink0, 0], [GA.sink0 + 34, -0.7, "o"], [GA.sink1 - 64, 22.4, "io"], [GA.sink1 - 20, 24.1, "io"], [GA.sink1, 27, "i"]],   /* 27: tutto sotto il bordo; 22.6: solo la punta di un orecchio (la testa è inclinata); 12.6: orecchie e fez, non gli occhi */
    ly: [[0, 0], [GA.lower0, 0], [GA.lower1, 1, "io"]],
    f1y: [[0, -11], [GA.paw1, -11], [GA.paw1 + 74, 1, "b"], [GA.reach0, 1], [GA.reach0 + 52, 4.4, "o"], [GA.reach1, 1.8, "i"], [GA.iGo, 0.6, "io"], [GA.wind, 0.6], [GA.sw0, 3.4, "o"], [GA.hits[0], 2.4, "i"], [GA.hits[3], 2.2, "l"], [GA.hits[3] + 36, 3.0, "o"], [GA.lower1, 1, "io"]],   /* la zampata passa appena sopra le lettere: si vede */
    f0y: [[0, -11], [GA.paw0, -11], [GA.paw0 + 74, 1, "b"], [GA.sw0 - 10, 1], [GA.hits[0] + 6, -7.5, "io"], [GA.lower0 + 20, -7.5], [GA.lower1, 1, "o"]],
    px0: [[0, -UL]],
    dy: [[0, 14.1], [GA.push0, 14.1], [GA.push0 + 80, 14.5], [GA.sw1, 14.3], [GA.lower1, 14.1]],
    yaw: [[0, 0], [GA.up3, -0.12], [GA.up4 + 10, -0.36, "io"], [GA.caret1, -0.36], [GA.view0 + 18, 0.02, "io"], [GA.glance - 24, 0.02], [GA.glance + 24, -0.32, "io"], [GA.glance + 52, -0.32], [GA.stare + 46, -0.13, "io"], [GA.wind, -0.13], [GA.sw0, -0.3, "io"]],
    pitch: [[0, 0.06], [GA.up4, -0.2, "io"], [GA.caret1, -0.2], [GA.view0 + 18, 0.03, "io"], [GA.glance - 24, 0.03], [GA.glance + 24, -0.26, "io"], [GA.glance + 52, -0.26], [GA.stare + 46, -0.04, "io"], [GA.wind, -0.04], [GA.sw0, -0.2, "io"], [GA.sw1, -0.16], [GA.sw1 + 90, -0.05], [GA.sink0 + 60, 0.14], [GA.sink1, 0.18]],
    gx: [[0, 0.25], [GA.up4 - 30, 0.86, "io"], [GA.caret1, 0.86], [GA.view0, 0, "io"], [GA.glance - 4, 0], [GA.glance + 22, 0.72, "io"], [GA.stare, 0.72], [GA.stare + 28, 0, "io"], [GA.wind, 0], [GA.wind + 26, 0.75, "io"]],
    gy: [[0, -0.1], [GA.up4 - 30, -0.62, "io"], [GA.caret1, -0.62], [GA.view0, 0, "io"], [GA.glance - 4, 0], [GA.glance + 22, -0.78, "io"], [GA.stare, -0.78], [GA.stare + 28, 0, "io"], [GA.wind, 0], [GA.wind + 26, -0.7, "io"]],
    eye: [[0, 1.14], [GA.up4, 1.14], [GA.view0 + 18, 1.06], [GA.stare, 1.04], [GA.stare + 60, 0.97], [GA.iGo, 0.97], [GA.iGo + 24, 1.16, "o"], [GA.sw1, 1.12], [GA.lower1, 1.04]],
    lid: [[0, 0], [GA.stare, 0], [GA.stare + 64, 0.3, "io"], [GA.iGo - 6, 0.3], [GA.iGo + 22, 0, "o"]],
    ear: [[0, -0.75], [GA.up2, -0.75], [GA.up3, -0.55, "io"], [GA.up4 + 40, -0.12, "io"], [GA.stare, -0.12], [GA.stare + 70, 0.06, "io"], [GA.iGo, 0.06], [GA.iGo + 30, -0.28, "o"], [GA.sw1, -0.22], [GA.blink0 + 60, 0.08, "io"], [GA.sink0 + 30, -0.62, "io"], [GA.sink1, -0.72]],
    hr: [[0, 0.3], [GA.up2, 0.3], [GA.up3, 0.16, "io"], [GA.up4, -0.05, "sp"], [GA.up4 + 40, 0.07, "io"], [GA.caret1, 0.07], [GA.view0 + 18, 0, "io"], [GA.stare, 0], [GA.stare + 70, -0.1, "io"], [GA.iGo, -0.1], [GA.sw0, 0.02, "io"], [GA.sw1, 0.12, "io"], [GA.blink0 + 80, 0.13], [GA.sink0 + 90, 0.46, "io"]],   /* scendendo inclina la testa: un orecchio resta l'ultima cosa sopra la riga, più alto del fez */
    roll: [[0, 0], [GA.wind, 0], [GA.sw0, -0.035, "io"], [GA.hits[2], 0.06, "io"], [GA.sw1 + 70, 0, "io"]],
    pupil: [[0, 0.8], [GA.up4, 1], [GA.blink0, 1], [GA.blink0 + 60, 0.9], [GA.blink1, 0.9], [GA.sink0 + 60, 1]],
    blink: [[0, 1], [GA.blink0, 1], [GA.blink0 + 86, 0.02, "io"], [GA.blink0 + 128, 0.02], [GA.blink1, 1, "io"]],
  };
  /* la testa e gli occhi seguono la zampa durante la zampata, poi guardano «imad chat» che arriva, poi su, verso la stella */
  function lookAt(tau, p1) {
    let yaw = kv(tr.yaw, tau), gx = kv(tr.gx, tau), gy = kv(tr.gy, tau);
    if (tau >= GA.sw0) {
      const pr = clamp(p1 / (2.4 * UL), -1, 1), w = sat((tau - GA.sw0) / 30);         /* dov'è la zampa: da -1 (a sinistra) a 1 (a destra) */
      yaw = lerp(yaw, -0.36 * pr, w); gx = lerp(gx, 0.92 * pr, w); gy = lerp(gy, -0.68, w);
      const a = eIO(seg(tau, GA.sw1 - 10, GA.sw1 + 90)), b = eIO(seg(tau, GA.lower1, GA.sink0 + 40)), c = eIO(seg(tau, GA.sink0 + 30, GA.sink1 - 40));
      yaw = lerp(lerp(yaw, 0.44, a), 0.24, b); yaw = lerp(yaw, 0.12, c);
      gx = lerp(lerp(gx, -0.9, a), -0.62, b); gx = lerp(gx, -0.35, c);
      gy = lerp(lerp(gy, -0.24, a), -0.3, b); gy = lerp(gy, 0.72, c);
    }
    return { yaw, gx, gy };
  }
  function gagState(tau) {
    const s = {};
    for (const k in tr) s[k] = kv(tr[k], tau);
    s.bx = kv(BX, tau);
    s.p1 = tau < GA.sw0 ? kv(PX1, tau) : tau < GA.sw1 + 40 ? spline(SWEEP, tau) : lerp(-1.75 * UL, s.bx + UL, eIO(seg(tau, GA.sw1 + 40, GA.lower1 + 20)));   /* la zampa destra, x dal centro di Dot all'inizio */
    s.p0 = s.px0;
    const L = lookAt(tau, s.p1 - s.bx);
    s.yaw = L.yaw; s.gx = L.gx; s.gy = L.gy;
    s.earT = tau < 600 ? (GA.up1 + 18) / 1000 : tau < GA.sink0 + 80 ? 0.52 : (GA.sink0 + 112) / 1000; s.earSide = tau < 600 ? -1 : 1;   /* piccoli scatti d'orecchio */
    return s;
  }
  /* il fiocco del fez: un pendolo spinto dai movimenti della testa, a passi fissi da t0. Lo stato si tiene (c): andando avanti si
     continua, tornando indietro (seek) si riparte da t0; essendo la griglia dei passi sempre la stessa, il risultato è identico */
  function tasselAt(tau, xOf, t0, c) {
    const h = 1000 / 120, n = Math.max(0, Math.floor((tau - t0) / h));
    if (!c.ok || c.t0 !== t0 || n < c.n) { c.ok = true; c.t0 = t0; c.n = 0; c.a = 0; c.w = 0; c.x0 = xOf(t0 - h); c.x1 = xOf(t0); }
    for (let i = c.n + 1; i <= n; i++) {
      const x2 = xOf(t0 + i * h), ax = (x2 - 2 * c.x1 + c.x0) / ((h / 1000) * (h / 1000));
      c.w += (-81 * Math.sin(c.a) - 5 * c.w - clamp(ax, -4000, 4000) / 6.6 * Math.cos(c.a)) * (h / 1000); c.a = clamp(c.a + c.w * (h / 1000), -1.5, 1.5);
      c.x0 = c.x1; c.x1 = x2;
    }
    c.n = n;
    return c.a;
  }
  const TAS = { gag: {}, jump: {} };
  /* mette lo scheletro nella posa voluta e dà il fotogramma da disegnare */
  function catFrame(base, set, o) {
    const r = cat.rig, A = r.A;
    if (Array.isArray(base)) { const P0 = r.poses[base[0]], P1 = r.poses[base[1]], w = base[2]; for (const k in P0) A[k] = P0[k] + (P1[k] - P0[k]) * w; }   /* tra due pose */
    else { const P = r.poses[base]; for (const k in P) A[k] = P[k]; }
    for (const k in set) A[k] = set[k];
    r.yaw = r.yawT = o.yaw; r.pitch = r.pitchT = o.pitch || 0; r.roll = r.rollT = o.roll || 0; r.rollPivotY = null;
    r.look.yaw = r.look.ty = o.lyaw || 0; r.look.pitch = r.look.tp = o.lpitch || 0; r.headRoll = 0;
    for (let i = 0; i < 2; i++) { r.gaze[i].x = r.gazeT[i].x = o.gx || 0; r.gaze[i].y = r.gazeT[i].y = o.gy || 0; }
    r.pupil = r.pupilT = o.pupil == null ? 0.8 : o.pupil; r.pupilDot = r.pupilDotT = 0; r.blink = o.blink == null ? 1 : o.blink;
    r.walk = r.walkT = 0; r.long = r.longT = 0; r.fezOn = true; r.fezRoll = 0; r._ws = Math.cos(o.yaw) >= 0 ? 1 : -1;
    r.t = o.t; r._ta = o.ta || 0; r._tw = 0; r._dt = 0; r._tp = null; r._earT = o.earT == null ? -9 : o.earT; r._earSide = o.earSide || 1;
    return r.frame();
  }
  function gagGeo() { const K = 3 * adv / (2 * cat.rig.P.headRx); return { K, x: xA + 11.5 * adv, top: baseM - xh + 0.6, base: baseM }; }
  function drawGag(t) {
    const tau = t - T.key[13];
    if (!GAGON || tau < GA.up0 || tau > GA.sink1) return;
    const s = gagState(tau), g = gagGeo(), K = g.K;
    const X = g.x + s.bx * K, Y = lerp(g.top, g.base, s.ly);
    const xf = (u) => { const q = gagState(u); return q.bx + 14 * Math.sin(-q.yaw) - 9 * q.hr; };
    const set = { fs: FS, fo: 0, dy: s.dy, f0x: 1.5, f1x: 1.5, f0y: s.f0y, f1y: s.f1y, fo0: -s.p0 - SHL, fo1: s.p1 - s.bx - SHL, eye: s.eye, lid: s.lid, brow: 0, ear: s.ear, hr: s.hr, hp: 0, mouth: 0 };
    const f = catFrame("peek", set, { yaw: cat.D.YAW.front, roll: s.roll, lyaw: s.yaw, lpitch: s.pitch, gx: s.gx, gy: s.gy, pupil: s.pupil, blink: s.blink, t: tau / 1000 + 1.3, ta: tasselAt(tau, xf, GA.up0, TAS.gag), earT: s.earT + 1.3, earSide: s.earSide });
    ctx.save();
    /* le lettere sono un bordo pieno (Dot sta dietro): si vede solo ciò che sta sopra il bordo, più le zampe che ci poggiano; mai sotto la riga di base */
    ctx.beginPath(); ctx.rect(0, 0, W, Math.min(g.base, Y + 1.7 * K)); ctx.clip();
    ctx.translate(X, Y); ctx.scale(K, -K); ctx.translate(0, -s.h);
    cat.look.draw(ctx, f, { dark: true, rim: "notte", scale: K, shadow: null, clipY: s.h, pawsOnEdge: true });
    ctx.restore();
    catBB = catBox(f, X, Y, K, s.h, s.h - 1.7);
  }
  /* le lettere i, u, o, a, r come oggetti: null = ancora ferma al suo posto (la disegna la riga) */
  function letterHit(i) { return i === 13 ? GA.push0 : GA.hits[12 - i]; }
  const INK3 = [243, 244, 248];
  function letterBody(i, t) {
    const tau = t - T.key[13], j = 13 - i, h0 = letterHit(i), go = j === 0 ? GA.iGo : GA.hits[j - 1] + GA.leave;
    if (tau < h0 + 4) return null;
    ctx.font = `500 ${fm}px ${MONO}`; const m = ctx.measureText(TEXT[i]);
    const side = j === 0 ? 1 : -1, xc = xA + (i + 0.5) * adv;                /* la «i» va a destra (la zampa arriva da sinistra), le altre a sinistra */
    const ink = side > 0 ? (m.actualBoundingBoxRight || adv * 0.3) : -(m.actualBoundingBoxLeft || adv * 0.3);
    const b = { side, px: xc + ink, py: baseM, dx: -ink, ph: 0, sc: 1, a: 1 };   /* il piede su cui si inclina: lo spigolo in basso dalla parte della spinta */
    if (j === 0) {                                     /* la «i»: la zampa la spinge piano (resiste), poi passa il punto e va giù da sola */
      b.ph = tau < GA.over ? 0.36 * eIO(seg(tau, h0, GA.over)) : 0.36 + 0.86 * eIn(seg(tau, GA.over, go));
    } else {                                           /* u, o, a, r: la zampata le prende e le butta giù di colpo */
      b.ph = -[0, 0.95, 0.68, 1.02, 0.78][j] * eOut(seg(tau, h0, go));   /* ognuna a modo suo: non cadono come un blocco */
    }
    if (tau > go) {                                    /* scivola giù dal bordo e cade, gira ancora un poco, viene verso chi guarda */
      const d = (tau - go) / 1000, k = fm / 32, vx = (j === 0 ? 40 : -[0, 62, 30, 58, 74][j]) * k, w = j === 0 ? 1.1 : -[0, 1.5, 0.4, 1.8, 0.8][j];   /* quasi dritte giù: la zampata le rovescia, non le lancia (così non si ammucchiano) */
      b.px += vx * d; b.py += 0.5 * 2900 * k * d * d + (j === 0 ? 30 : 90) * k * d;
      b.ph += w * d; b.sc = 1 + 0.55 * d;
      const dur = 0.3; if (d > dur) return { gone: true };
      b.a = 1 - eIO(seg(d, dur * 0.56, dur));
    }
    return b;
  }
  function drawLetterBody(i, b) {
    if (!b || b.gone || b.a <= 0) return;
    ctx.save(); ctx.globalAlpha = b.a; ctx.translate(b.px, b.py); ctx.rotate(b.side > 0 ? b.ph : b.ph); ctx.scale(b.sc, b.sc);
    ctx.font = `500 ${fm}px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const k = 1 - 0.16 * Math.min(1, Math.abs(b.ph));                     /* inclinata prende meno luce da sopra */
    ctx.fillStyle = `rgb(${Math.round(INK3[0] * k)},${Math.round(INK3[1] * k)},${Math.round(INK3[2] * k)})`; ctx.fillText(TEXT[i], b.dx, 0);
    ctx.restore(); ctx.textAlign = "left";
  }

  /* ---- b) il salto nel quadrato del punto (solo col passaggio) */
  function dipAt(t) {                                  /* il quadrato del punto sotto il peso di Dot: scende, torna con un filo di rimbalzo */
    if (!JUMP) return 0; const tau = t - (T.back1 + JA.t0 + JA.land); if (tau <= 0 || tau > 520) return 0;
    return 0.12 * Math.sin(Math.PI * tau / 110) * Math.exp(-tau / 85);
  }
  function blinkAt(t) {                                /* il punto d'oro chiude e riapre l'occhio, una volta */
    if (!JUMP) return 1; const tau = t - (T.back1 + JA.t0 + JA.blink0), d = JA.blink1 - JA.blink0; if (tau <= 0 || tau >= d) return 1;
    return tau < 52 ? 1 - 0.9 * eIO(tau / 52) : 0.1 + 0.9 * eOut((tau - 52) / (d - 52));
  }
  function dotFront(t) {                               /* quanto del punto d'oro sta davanti a Dot mentre entra nel tasto */
    if (!JUMP) return 0; const tau = t - T.back1 - JA.t0; if (tau <= JA.in0 || tau > JA.in1) return 0;
    return eIO(seg(seg(tau, JA.in0, JA.in1), 0.12, 0.5));
  }
  function jumpGeo() {
    const step = cell + gap, K = cell / 56, cx = gridX + step + cell / 2, cy = gridY + step + cell / 2;
    return { K, cx, cy, x0: gridX + 3 * cell + 2 * gap - 0.2 * cell, y0: H + 13 * K, x1: cx + 0.06 * cell, y1: cy + 0.2 * cell, apex: 0.16 * cell };   /* l'arco resta basso e a destra: lontano dal quadrato della Kaʿba (in alto a sinistra) */
  }
  /* il volo: una parabola vera (gravità), dal fondo dello schermo a destra fino al quadrato del punto */
  function flight(g, s) {
    const Tf = (JA.land - JA.launch) / 1000, D = g.y0 - g.y1, A = g.apex, sg = (Math.sqrt(2 * (D + A)) + Math.sqrt(2 * A)) / Tf, gr = sg * sg, vy0 = Math.sqrt(2 * gr * (D + A));
    const vx = (g.x1 - g.x0) / Tf;
    return { x: g.x0 + vx * s, y: g.y0 - vy0 * s + 0.5 * gr * s * s, vx, vy: -vy0 + gr * s };
  }
  /* la carica, il volo, l'arrivo, l'entrata: una sola linea del tempo (ms dall'inizio del salto), tutto continuo ai passaggi */
  const JL = JA.launch, JD = JA.land, JI0 = JA.in0, JI1 = JA.in1;
  const jt = {
    sqx: [[0, 1], [36, 1], [JL - 16, 1.13, "io"], [JL + 18, 0.9, "o"], [JL + 90, 1, "io"], [JD - 26, 1], [JD - 4, 0.96, "i"], [JD + 14, 1.18, "o"], [JD + 74, 0.97, "io"], [JI0 + 10, 1.02, "io"], [JI1, 0.96]],
    sqy: [[0, 1], [36, 1], [JL - 16, 0.8, "io"], [JL + 18, 1.16, "o"], [JL + 90, 1, "io"], [JD - 26, 1], [JD - 4, 1.06, "i"], [JD + 14, 0.8, "o"], [JD + 74, 1.04, "io"], [JI0 + 10, 0.98, "io"], [JI1, 1.04]],
    te: [[0, 0.3], [JL, 0.1], [JL + 60, -0.6, "o"], [JL + 170, 0.3, "io"], [JD, 0.62, "io"], [JD + 60, 0.78, "o"], [JI1, 1.25, "io"]],
    tc: [[0, 0.6], [JL, 0.5], [JL + 70, 0.15, "o"], [JD, 0.95, "io"], [JD + 70, 1.1, "io"], [JI1, 0.3, "io"]],
    ear: [[0, 0.05], [36, 0.05], [JL - 10, 0.3, "io"], [JL + 40, 0.42, "o"], [JL + 160, 0.05, "io"], [JD + 40, -0.1, "io"]],
    lp: [[0, 0.5], [JL, 0.45], [JL + 120, 0.05, "io"], [JD, -0.28, "io"], [JI1, -0.45]],
    gy: [[0, 0.85], [JL + 60, 0.7], [JL + 180, -0.5, "io"], [JD, -0.9, "io"]],
    gx: [[0, -0.55], [JL + 120, -0.35, "io"], [JD, -0.12, "io"]],
    eye: [[0, 1.12], [JL, 1.18], [JD, 1.12], [JD + 40, 1.0, "io"]],
  };
  function jumpState(t) {
    const tau = t - T.back1 - JA.t0, g = jumpGeo(), YW = cat.D.YAW;
    if (tau < 0 || tau > JI1) return null;
    const o = { g, x: g.x0, y: g.y0, z: 1, yaw: YW.left + 0.16, pitch: 0, inK: 0 };
    o.base = ["crouch", "air", eIO(seg(tau, JL - 12, JL + 46))];
    if (tau >= JD - 80) o.base = ["air", "land", eIO(seg(tau, JD - 80, JD))];
    o.set = {}; for (const k of ["sqx", "sqy", "te", "tc", "ear", "eye"]) o.set[k] = kv(jt[k], tau);
    o.lp = kv(jt.lp, tau); o.gy = kv(jt.gy, tau); o.gx = kv(jt.gx, tau); o.ly = 0.12; o.pupil = 1;
    const fp = (s) => { const p = flight(g, s); return clamp(Math.atan2(-p.vy, -p.vx) * 0.6, -0.5, 0.9); };   /* il muso segue la strada */
    if (tau < JL) {                                    /* sale dal fondo dello schermo già accucciato (le orecchie prima), si schiaccia: la carica */
      o.y = g.y0 + 22 * g.K * (1 - eOut(seg(tau, 0, JA.crouch)));
      o.pitch = lerp(0, fp(0), eIO(seg(tau, JL - 40, JL)) * 0.35);
    } else if (tau < JD) {                             /* in volo: una parabola vera; stirato in salita, raccolto in cima, la coda dietro */
      const s = (tau - JL) / 1000, p = flight(g, s), u = (tau - JL) / (JD - JL);
      o.x = p.x; o.y = p.y;
      o.pitch = lerp(fp(0) * 0.35, fp(s), eIO(seg(u, 0, 0.18))) * (1 - eIO(seg(u, 0.8, 1)));
      o.z = 1 + 0.08 * Math.sin(Math.PI * u);            /* in cima è un filo più vicino a chi guarda */
    } else {                                           /* sul tasto: si schiaccia, il tasto scende; poi entra a testa in giù, la coda per ultima */
      const d = dipAt(t), zi = seg(tau, JI0, JI1);
      o.x = g.x1; o.y = g.cy + (g.y1 - g.cy) * (1 - d) + 0.1 * cell * eIn(zi);
      o.pitch = -0.95 * eIn(seg(tau, JI0 - 24, JI1));
      o.z = lerp(1, 0.06, eIn(zi)) * (1 - d); o.inK = zi;
    }
    return o;
  }
  function drawJump(t) {
    if (!JUMP) return;
    const o = jumpState(t); if (!o) return;
    const g = o.g, K = g.K * o.z, tau = t - T.back1 - JA.t0;
    const xf = (u) => { const q = jumpState(T.back1 + JA.t0 + clamp(u, 0, JI1)); return q ? q.x / g.K : g.x0 / g.K; };
    const f = catFrame(o.base, o.set, { yaw: o.yaw, pitch: o.pitch, lyaw: o.ly, lpitch: o.lp, gx: o.gx, gy: o.gy, pupil: o.pupil, t: tau / 1000 + 2.1, ta: tasselAt(tau, xf, 0, TAS.jump) });
    const env = { dark: true, rim: "notte", scale: K, shadow: null, clipY: null, pawsOnEdge: false };
    if (!o.inK) {                                      /* fuori dal tasto: sopra tutto, sulla tela dell'intro */
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(K, -K); cat.look.draw(ctx, f, env); ctx.restore(); catBB = catBox(f, o.x, o.y, K, 0, null); return;
    }
    /* dentro il tasto: su una tela a parte, ritagliato dal tasto e sempre più buio (è il fondo della scatola) */
    const s = cell * (1 - dipAt(t)), kx = g.cx - s / 2, ky = g.cy - s / 2, pad = 2;
    const wpx = Math.ceil((s + 2 * pad) * DPR), hpx = wpx;
    if (!jcv) { jcv = doc.createElement("canvas"); jctx = jcv.getContext("2d"); }
    if (jcv.width < wpx || jcv.height < hpx) { jcv.width = wpx; jcv.height = hpx; }
    jctx.setTransform(1, 0, 0, 1, 0, 0); jctx.globalCompositeOperation = "source-over"; jctx.globalAlpha = 1; jctx.clearRect(0, 0, jcv.width, jcv.height);
    jctx.setTransform(DPR, 0, 0, DPR, DPR * (pad - kx), DPR * (pad - ky));
    jctx.save(); rrect(jctx, kx, ky, s, s, s * 0.24); jctx.clip();
    const ox = lerp(o.x, g.cx, eIO(o.inK)), oy = lerp(o.y, g.cy + 0.12 * cell, eIO(o.inK));
    jctx.translate(ox, oy); jctx.scale(K, -K); cat.look.draw(jctx, f, env); jctx.restore(); catBB = catBox(f, ox, oy, K, 0, null);
    jctx.setTransform(1, 0, 0, 1, 0, 0); jctx.globalCompositeOperation = "source-atop";
    jctx.fillStyle = `rgba(6,8,20,${(0.95 * eIO(sat(o.inK * 1.15))).toFixed(3)})`; jctx.fillRect(0, 0, wpx, hpx);
    jctx.globalCompositeOperation = "source-over";
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(jcv, 0, 0, wpx, hpx, Math.round((kx - pad) * DPR), Math.round((ky - pad) * DPR), wpx, hpx); ctx.restore();
    /* Dot è passato dietro la faccia del tasto: il punto d'oro, che sta sulla faccia, adesso gli sta davanti (sotto, la sua copia si spegne altrettanto) */
    const fa = dotFront(t); if (fa <= 0) return;
    const bk = blinkAt(t); ctx.save(); ctx.globalAlpha = fa; ctx.translate(g.cx, g.cy); ctx.scale(1, bk); drawDot(0, 0, cell * 0.075); ctx.restore();
  }
  /* dove disegna Dot adesso (per gli strumenti: ritagli delle strisce) */
  function gagBox(t) {
    if (!cat) return null;
    if (GAGON && t < T.zoom0) { const g = gagGeo(); return { x: xA - 0.4 * adv, y: g.top - 31 * g.K, w: 15.6 * adv, h: 31 * g.K + xh + 3.6 * fm }; }
    if (JUMP) { const g = jumpGeo(); return { x: gridX - gap, y: gridY - gap, w: 3 * cell + 4 * gap, h: H - gridY + gap }; }
    return null;
  }

  /* ------------------------------------------------------------------ la pagina sotto: compare mentre i quadrati atterrano */
  function applyDom(t) {
    const live = t < (PASS ? T.landed : T.end), typing = t < T.end;   /* col passaggio la pagina è libera prima che finisca di scrivere */
    for (const q of SQ) { if (!q.el) continue; q.el.style.opacity = live ? String(eOut(seg(t, q.t0 + T.flyDur * (q.k === 0 ? 0.84 : 0.45), q.t0 + T.flyDur))) : ""; }
    if (heroEl) { const p = eOut(seg(t, T.fly0 + 120, T.fly0 + 620)); heroEl.style.opacity = live ? String(p) : ""; heroEl.style.transform = live && p < 1 ? `translateY(${((1 - p) * 16).toFixed(2)}px) scale(${(0.965 + 0.035 * p).toFixed(4)})` : ""; }
    const pb = live ? String(eOut(seg(t, T.fly0 + 360, T.fly0 + 760))) : "";
    if (barEl) barEl.style.opacity = pb; if (footEl) footEl.style.opacity = pb;
    const n = t < T.type0 ? 0 : Math.min(9, Math.floor((t - T.type0) / 44) + 1);
    chars.forEach((s, i) => { s.style.display = i < n || !typing ? "" : "none"; });
    if (curEl) {
      const since = t - T.type1;
      curEl.style.opacity = !typing ? "" : t < T.fly0 + 300 ? "0" : since < 320 || Math.floor((since - 320) / 530) % 2 === 1 ? "1" : "0";
    }
  }

  /* ------------------------------------------------------------------ un fotogramma */
  function frame(t) {
    lastT = t; GEO.sq = []; GEO.phase = ""; catBB = null;
    if (!(PASS && freed)) {                                             /* col passaggio, dopo l'atterraggio la tela dell'intro è già via */
      if (cvs.style.background !== "transparent") cvs.style.background = "transparent";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      const bg = 1 - eIO(seg(t, T.fly0 + 30, T.fly0 + 560));
      if (bg > 0) { ctx.globalAlpha = bg; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; drawSky(t, bg); }
      if (t >= T.zoom0 - 40 && t < T.fly1) updateScenes(t);
      if (t < T.bold1) phaseType(t);
      else if (t < T.back1) phaseCam(t);
      else if (PASS) { if (t < T.press) { phaseGrid(t); if (JUMP) drawJump(t); } else if (t < T.fly1) phaseKeys(t); }
      else if (t < T.open1) phaseGrid(t);
      else if (t < T.fly1) phaseSquares(t);
    }
    applyDom(t);
    if (PASS) drawCaps(t);                                             /* dopo applyDom: i tasti mirano all'hero com'è in questo istante (anche con seek) */
    hooks(t);
  }

  /* «gatto»: i tempi con la scenetta (le lettere se ne vanno quando Dot le butta giù, tutto il resto GD ms dopo) e, col passaggio, il salto */
  function gagTimes() {
    const k = T.key[13];
    T.del = [k + GA.iGo].concat(GA.hits.map((h) => k + h + GA.leave));
    for (const n in T_TODAY) if (n !== "key" && n !== "del" && n !== "flyDur") T[n] = T_TODAY[n] + GD;
    T.gag = k; T.gagUp = k + GA.up4; T.iGo = k + GA.iGo; T.swept = k + GA.hits[3] + GA.leave; T.gagEnd = k + GA.sink1;
    if (JUMP) {
      T.press = T.settled + DOT_GAP_J; T.split = T.press + G.DIP; T.capsGo = T.press + G.CAPS_AFTER;
      T.handover = T.capsGo + 2 * G.ROWLAG + G.CAPDUR + G.SETTLE; T.landed = T.press + G.FLY_AFTER + T.flyDur + 8 * 26;
      T.jump = T.back1 + JA.t0; T.jumpLand = T.jump + JA.land; T.jumpIn = T.jump + JA.in1;
    }
  }

  /* ------------------------------------------------------------------ avvio, fine, comandi dell'anteprima */
  let raf = 0, t0 = 0, playing = false, ready = false;
  function setup() {
    root.classList.remove("ni-done"); root.classList.add("ni-on", "is-locked"); root.setAttribute("data-ni", dotKind()); root.setAttribute("data-ni-v", version);
    window.scrollTo(0, 0);
    /* il passaggio c'è solo se l'apertura di Dot sta per partire e la sua scena c'è; altrimenti la fine è quella di oggi */
    PASS = passWanted(); freed = false; handed = false; cut = false; setupDone = true;
    GAGON = gagWanted(); if (GAGON && !cat) { try { cat = makeCat(); } catch (e) { cat = null; } } if (!cat) GAGON = false;
    JUMP = GAGON && PASS;
    Object.assign(T, T_TODAY); if (GAGON) gagTimes(); if (PASS) Object.assign(T, passTimes());
    if (window.__niDot) window.__niDot.wait = PASS;
    if (PASS) { makeCaps(); FORMED = stg().formed(); } else if (capsCv) capsCv.style.display = "none";
    heroEl = doc.getElementById("hero"); barEl = doc.getElementById("bar"); footEl = doc.querySelector(".foot"); wordEl = prepareWord();
    chars = wordEl ? Array.from(wordEl.querySelectorAll(".ch")) : []; curEl = wordEl ? wordEl.querySelector(".cur") : null;
    measure();
    if (PASS) {                                                         /* gli sprite dei tasti si fanno adesso, non al primo fotogramma del passaggio */
      const S = stg(), k0 = G.CAPF * cell * 1.12 / S.size.KEY;
      [1, Math.min(k0, 2), k0].forEach((sc) => { if (sc >= 1) S.paint(cctx, [], { dpr: CDPR, scale: sc }); });
    }
  }
  function finish() {
    playing = false; cancelAnimationFrame(raf);
    if (PASS) { if (!freed) doFree(); if (!handed) doHandover(!cut); }
    applyDom(T.end); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
    root.classList.remove("ni-on", "is-locked"); root.classList.add("ni-done");
    if (capsCv) { cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, capsCv.width, capsCv.height); capsCv.style.display = "none"; }
    if (PASS && stg() && stg().trim) stg().trim();
    setupDone = false;
    window.__niDone = true;
  }
  /* col passaggio: la pagina si libera all'atterraggio delle basi, la scena prende i tasti al loro arrivo; con un giro rotto
     (una rotazione mentre i tasti ci sono) i tasti spariscono e, a pagina libera, Dot fa la sua apertura intera */
  function milestones(t) {
    if (!PASS) return;
    if (!freed && t >= T.landed) doFree();
    if (!handed && freed && (t >= T.handover || cut)) doHandover(!cut);
  }
  let lastNow = 0, slow = 0;
  function loop(now) {
    const t = now - t0; milestones(t); if (t >= T.end) { finish(); return; }
    /* se i fotogrammi arrivano tardi nella parte pesante, la tela si alleggerisce (il tempo dell'animazione non cambia) */
    if (lastNow && t > T.zoom0 && t < T.fly1) { if (now - lastNow > 30) { if (++slow >= 5 && DPRCAP > 1) { DPRCAP = Math.max(1, DPRCAP - 0.5); slow = 0; measure(); } } else if (slow > 0) slow--; }
    lastNow = now; frame(t); raf = requestAnimationFrame(loop);
  }
  function play() { cancelAnimationFrame(raf); window.__niDone = false; lastNow = 0; slow = 0; setup(); sNight(SC.night.getContext("2d"), SW, SH); playing = true; t0 = performance.now(); raf = requestAnimationFrame(loop); }
  function seek(ms) {
    if (!ready) return false; cancelAnimationFrame(raf); playing = false;
    if (!(PASS && setupDone) && (!root.classList.contains("ni-on") || !chars.length)) { setup(); sNight(SC.night.getContext("2d"), SW, SH); }
    if (PASS && freed && ms < T.landed) { freed = false; root.classList.add("ni-on", "is-locked"); if (capsCv) capsCv.style.zIndex = "91"; }   /* indietro, prima dell'atterraggio (solo per gli strumenti; dopo il passaggio Dot resta) */
    milestones(ms);
    if (ms >= T.end) { frame(T.end); finish(); } else frame(ms);
    return true;
  }
  window.addEventListener("resize", () => { if (!playing) return; measure(); if (PASS && !handed && lastT >= T.press) cut = true; });

  const seg_ = doc.querySelectorAll(".nbar__seg button"), paint = () => seg_.forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === version)));
  seg_.forEach((b) => b.addEventListener("click", () => { version = b.getAttribute("data-v"); try { localStorage.setItem("imad.anteprima.intro", version); } catch (e) { /* va bene lo stesso */ } paint(); play(); }));
  const again = doc.getElementById("nbarPlay"); if (again) again.addEventListener("click", play);
  paint();

  const fonts = doc.fonts && doc.fonts.load ? [doc.fonts.load(`500 26px ${MONO}`, TEXT + "_."), doc.fonts.load(`800 60px ${SANS}`, NAME)] : [];
  const pics = loadImages();
  const wait = SEEK ? Promise.race([Promise.all([pics, Promise.all(fonts).catch(() => 0)]), new Promise((r) => setTimeout(r, 6000))]) : Promise.race([Promise.all(fonts).catch(() => 0), new Promise((r) => setTimeout(r, 1500))]);
  wait.then(() => { ready = true; window.__niReady = true; if (SEEK) { setup(); sNight(SC.night.getContext("2d"), SW, SH); frame(0); } else play(); });
  /* __ni.T: i tempi (con i momenti del passaggio: settled, press, split, capsGo, landed, handover); __ni.G: i numeri del passaggio;
     __ni.onFrame(fn): fn(info) a ogni fotogramma della versione «gatto», dopo il disegno, con la tela dell'intro (info.ctx, in px CSS),
     quella dei tasti (info.caps), i tempi, dove stanno i quadrati e i tasti (info.geo.sq, info.geo.cap, info.centre: il quadrato del punto),
     info.press(i) (quanto è premuto il quadrato i). Dot nell'intro lo disegna questo file (parte 6), non serve un aggancio.
     Per gli strumenti: __ni.t (l'ultimo istante disegnato), __ni.gag / __ni.jump (la scenetta e il salto ci sono?), __ni.GA / __ni.JA
     (i loro tempi), __ni.box(ms) (dove ritagliare le strisce), __ni.catBox() (il rettangolo di Dot nell'ultimo fotogramma),
     __ni.squares() (i nove quadrati della griglia). */
  window.__ni = { seek, play, T, G, onFrame(fn) { if (typeof fn === "function") HOOKS.push(fn); }, offFrame(fn) { const i = HOOKS.indexOf(fn); if (i >= 0) HOOKS.splice(i, 1); },
    get pass() { return PASS; }, get t() { return lastT; }, get gag() { return GAGON; }, get jump() { return JUMP; }, GA, JA, box: (ms) => gagBox(ms), catBox: () => catBB, squares: () => { const st = cell + gap; return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: gridX + (i % 3) * st, y: gridY + ((i / 3) | 0) * st, w: cell, h: cell })); }, get version() { return version; }, set version(v) { if (VERSIONS.includes(v)) { version = v; paint(); } } };
})();
