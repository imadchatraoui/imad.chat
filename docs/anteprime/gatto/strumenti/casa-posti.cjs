// Dove sta Dot sulla casa nuova (CASA.md 2c E): un visitatore finto che legge e scorre, in tempo vero (Dot va col suo orologio):
// pause di 2-8 s, scrollate su e giù di 200-640 px, ogni tanto in cima, un filtro ogni 20-36 s. Non tocca mai Dot.
// Uso, con docs/anteprime/casa/strumenti/servi.mjs acceso (meglio con --contributi/--progetti, così l'impaginazione è quella vera):
//   node docs/anteprime/gatto/strumenti/casa-posti.cjs --w 390 --h 844 --sec 180 --seed 1 [--port 4121] [--label dopo] [--out cartella] [--primo 0] [--dsf 1]
// Scrive <out>/<label>-<w>x<h>-s<seed>.json (tutto), ...-tl.json (ogni mezzo secondo: tempo, scroll, stato, si vede, in groppa) e una foto finale.
// Misura a ogni fotogramma, sui pixel veri delle tele di Dot (alfa > 128, cioè il gatto e non l'ombra):
//  - in vista: inchiostro del gatto nella fascia visibile (sotto la zona sicura, sopra il dock)
//  - su una parola o un comando (la lista KEEP qui sotto, la stessa che passa la casa), sul Corano, sul riquadro quiet
//  - dietro il dock: inchiostro di Dot dentro il rettangolo del dock su una tela che sta sotto il dock
//  - sulle parole del dock: inchiostro di Dot sopra i bottoni dei filtri
// Il gatto (tela z 3), il fez (z 2), gli oggetti (z 1, 96 px di altezza): contati a parte.
const { chromium } = require("playwright");
const fs = require("fs");
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const W = +(A.w || 390), H = +(A.h || 844), SEC = +(A.sec || 180), SEED = +(A.seed || 1), PORT = +(A.port || 4121), LABEL = A.label || "run";
const DSF = +(A.dsf || 1), PRIMO = A.primo || "0";
const OUT = A.out || "casa-posti"; fs.mkdirSync(OUT, { recursive: true });
/* le parole e i comandi della casa: la stessa lista di casa.js (window.__dotKeep); questa copia serve per misurare anche una versione
   della pagina che non la passa ancora (il «prima») */
const KEEP_FISSA = ["#bar .logo", "#bar .iconbtn", ".hero__word", ".riga", ".ciao__t", ".ciao__p", ".ciao__b .pill",
  ".grid .label", ".grid h2", ".grid p", ".grid li", ".grid input", ".grid .tile__in button", ".grid .tile__in a", ".grid .tile__go", ".grid .qr__carta", ".grid .marq",
  ".foot__sky", ".foot__cred", ".foot .l9--big i"].join(", ");
(async () => {
  const browser = await chromium.launch();
  const phone = W < 700;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  const url = `http://127.0.0.1:${PORT}/casa/home/index.html?primo=${PRIMO}&seme=${SEED}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.__dot === true, null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(PRIMO === "1" ? 9000 : 1500);
  const KEEP = (await page.evaluate(() => window.__dotKeep)) || KEEP_FISSA;
  await page.evaluate(({ KEEP, SEED, SEC }) => {
    var s = SEED * 7919 + 13; function R() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; } function rr(a, b) { return a + R() * (b - a); }
    var doc = document, dock = doc.getElementById("dock"), grid = doc.getElementById("grid");
    var O = window.__soak = { frames: 0, inView: 0, word: 0, wordCat: 0, wordThings: 0, corano: 0, quiet: 0, behindDock: 0, dockWords: 0, riding: 0, ridingWord: 0, ridingWordStill: 0,
      states: {}, ep: [], filters: 0, scrolls: 0, maxKeep: 0, t0: performance.now(), done: false, offRuns: [], wordBy: {} };
    var V = { phase: "read", until: performance.now() + rr(2000, 8000), dir: 1, from: 0, to: 0, t0: 0, dur: 0, nextFilter: performance.now() + rr(18000, 32000), lastScroll: -1e9 };
    function rectsOf(sel) { var o = []; doc.querySelectorAll(sel).forEach(function (e) { var cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return; var rg = doc.createRange(); rg.selectNodeContents(e); var rl = rg.getClientRects(), er = e.getBoundingClientRect(), over = false, i;
      var list = []; for (i = 0; i < rl.length; i++) { if (rl[i].left < er.left - 2 || rl[i].right > er.right + 2) over = true; list.push(rl[i]); } if (!list.length || over) list = [er];
      var sx = pageXOffset, sy = pageYOffset; for (i = 0; i < list.length; i++) { var q = list[i]; if (q.width >= 2 && q.height >= 2) o.push({ L: q.left + sx, T: q.top + sy, R: q.right + sx, B: q.bottom + sy, el: e }); } }); return o; }
    function toView(L) { var sx = pageXOffset, sy = pageYOffset; for (var i = 0; i < L.length; i++) { var q = L[i]; q.l = q.L - sx; q.t = q.T - sy; q.r = q.R - sx; q.b = q.B - sy; } return L; }
    function boxes(sel) { var o = []; doc.querySelectorAll(sel).forEach(function (e) { var q = e.getBoundingClientRect(); if (q.width > 2) o.push({ l: q.left, t: q.top, r: q.right, b: q.bottom, el: e }); }); return o; }
    function name(e) { return (e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + (e.className && e.className.baseVal == null ? String(e.className).split(" ")[0] : "")); }
    var KR = [], f6 = 0;
    function dotCanvases() { var o = []; doc.querySelectorAll(".dot-layer canvas").forEach(function (cv) { var z = cv.style.zIndex, cs; if (cv.style.display === "none") return; if (z === "3") o.push({ cv: cv, k: "cat" }); else if (z === "2") o.push({ cv: cv, k: "fez" }); else if (z === "1" && cv.style.height === "96px") o.push({ cv: cv, k: "prop" }); }); return o; }
    function isFixed(cv) { var n = cv.parentNode; while (n && n !== doc.body) { if (getComputedStyle(n).position === "fixed") return true; n = n.parentNode; } return false; }
    function count(ink, r, L) { var x0 = Math.max(L.l, r.l), x1 = Math.min(L.r, r.r), y0 = Math.max(L.t, r.t), y1 = Math.min(L.b, r.b); if (x1 - x0 < 1 || y1 - y0 < 1) return 0;
      var n = 0, x, y, sx = ink.sx, sy = ink.sy; for (y = Math.floor(y0); y < y1; y++) for (x = Math.floor(x0); x < x1; x++) { var px = Math.floor((x - r.l) * sx), py = Math.floor((y - r.t) * sy); if (px >= 0 && py >= 0 && px < ink.w && py < ink.h && ink.a[(py * ink.w + px) * 4 + 3] > 128) n++; } return n; }
    function countA(ink, r, L, th) { var x0 = Math.max(L.l, r.l), x1 = Math.min(L.r, r.r), y0 = Math.max(L.t, r.t), y1 = Math.min(L.b, r.b); if (x1 - x0 < 1 || y1 - y0 < 1) return 0;
      var n = 0, x, y; for (y = Math.floor(y0); y < y1; y++) for (x = Math.floor(x0); x < x1; x++) { var px = Math.floor((x - r.l) * ink.sx), py = Math.floor((y - r.t) * ink.sy); if (px >= 0 && py >= 0 && px < ink.w && py < ink.h && ink.a[(py * ink.w + px) * 4 + 3] > th) n++; } return n; }
    function inkOf(cv) { var R0 = cv.getBoundingClientRect(); if (R0.width < 1) return null; var r = { l: R0.left, t: R0.top, r: R0.right, b: R0.bottom, left: R0.left, top: R0.top, width: R0.width, height: R0.height }; var c = cv.getContext("2d"), d; try { d = c.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return null; }
      var w = cv.width, h = cv.height, x, y, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; for (y = 0; y < h; y += 1) for (x = 0; x < w; x += 1) if (d[(y * w + x) * 4 + 3] > 128) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (!n) return { n: 0, r: r }; var sx = w / r.width, sy = h / r.height; return { n: n, a: d, w: w, h: h, sx: sx, sy: sy, r: r, bb: { l: r.left + x0 / sx, t: r.top + y0 / sy, r: r.left + (x1 + 1) / sx, b: r.top + (y1 + 1) / sy } }; }
    function hit(a, b) { return a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b; }
    var prevKey = {};
    function mark(key, info) { if (!prevKey[key] && O.ep.length < 60) O.ep.push(((performance.now() - O.t0) / 1000).toFixed(1) + "s " + key + " " + info); prevKey[key] = 2; }
    function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function visitor(t) {
      var maxY = Math.max(0, doc.documentElement.scrollHeight - innerHeight), y = pageYOffset;
      if (V.phase === "scroll") { var u = Math.min(1, (t - V.t0) / V.dur); window.scrollTo(0, Math.round(V.from + (V.to - V.from) * ease(u))); V.lastScroll = t; if (u >= 1) { V.phase = "read"; V.until = t + rr(2000, 8000); } return; }
      if (V.phase === "filterwait") { if (t > V.until) { V.phase = "read"; V.until = t + rr(2000, 6000); } return; }
      if (t < V.until) return;
      if (t > V.nextFilter) { var bs = [].slice.call(dock.querySelectorAll(".dock__b")), cur = dock.querySelector('[aria-pressed="true"]'), cand = bs.filter(function (b) { return b !== cur; }), b = cand[Math.floor(R() * cand.length)];
        b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })); b.click(); O.filters++; V.nextFilter = t + rr(20000, 36000); V.phase = "filterwait"; V.until = t + rr(2500, 5000); return; }
      var r = R(), to;
      if (r < 0.08) to = 0; else { if (y >= maxY - 4) V.dir = -1; else if (y <= 4) V.dir = 1; else if (R() < 0.18) V.dir = -V.dir; to = y + V.dir * rr(200, 640); }
      to = Math.max(0, Math.min(maxY, Math.round(to))); if (Math.abs(to - y) < 30) { V.until = t + rr(1500, 4000); return; }
      V.phase = "scroll"; V.from = y; V.to = to; V.t0 = t; V.dur = Math.max(420, Math.min(1500, 300 + Math.abs(to - y) * 1.1)); O.scrolls++;
    }
    function frame(t) {
      if (O.done) return; requestAnimationFrame(frame);
      if (t - O.t0 > SEC * 1000) { O.done = true; return; }
      O.frames++; var D = window.DOT && DOT.debug, c = D ? D.cat : null, st = c ? c.state : "?"; O.states[st] = (O.states[st] || 0) + 1;
      if (f6++ % 3 === 0 || grid.classList.contains("is-moving")) KR = rectsOf(KEEP); toView(KR);   /* in coordinate della pagina, riportate sullo schermo a ogni fotogramma */
      O.maxKeep = Math.max(O.maxKeep, KR.length);
      var dr = dock.getBoundingClientRect(), dockOn = dr.height > 0 && +getComputedStyle(dock).opacity > 0.5, band = { l: 0, t: 0, r: innerWidth, b: dockOn ? dr.top : innerHeight };
      var NO = boxes('[data-dot="no"]'), QU = boxes('[data-dot="quiet"]'), DB = boxes(".dock__b");
      var riding = !!(c && c.plat && c.plat.fixed), still = t - V.lastScroll > 600; if (riding) O.riding++;
      var cvs = dotCanvases(), vis = false, any = { word: 0, cat: 0, th: 0, cor: 0, q: 0, bd: 0, dw: 0, rw: 0 }, i, j;
      for (i = 0; i < cvs.length; i++) {
        var ink = inkOf(cvs[i].cv); if (!ink || !ink.n) continue; var bb = ink.bb, fixed = isFixed(cvs[i].cv), k = cvs[i].k;
        if (k === "cat") { var vb = { l: Math.max(bb.l, 0), t: Math.max(bb.t, 0), r: Math.min(bb.r, innerWidth), b: Math.min(bb.b, band.b) }; if (vb.r - vb.l > 6 && vb.b - vb.t > 6 && count(ink, ink.r, vb) > 25) vis = true; }
        for (j = 0; j < KR.length; j++) if (hit(bb, KR[j])) { var n = count(ink, ink.r, KR[j]); if (n >= 3) { if (riding && k === "cat") { any.rw++; if (still) mark("ridingWord-" + name(KR[j].el), "n" + n); } else { any.word++; if (k === "cat") any.cat++; else any.th++; var nm = name(KR[j].el); O.wordBy[nm + ":" + st] = (O.wordBy[nm + ":" + st] || 0) + 1; mark("word-" + nm + "-" + k, st + " n" + n + " x" + Math.round(c.x) + " y" + Math.round(c.y - pageYOffset) + " plat" + (c.plat ? Math.round(c.plat.y - pageYOffset) + (c.plat.low ? "L" : "") + (c.plat.cov ? "C" : "") + (c.plat.fixed ? "D" : "") + (c.plat.tile && c.plat.tile.mode === "perch" ? "P" : "") : "-") + " pose " + (DOT.debug.rig ? DOT.debug.rig().pose : "?") + " st" + c.st.toFixed(2) + " clip" + (c.clipAt == null ? "-" : Math.round(c.clipAt - pageYOffset)) + " ink[" + [bb.l, bb.t, bb.r, bb.b].map(Math.round) + "] kr[" + [KR[j].l, KR[j].t, KR[j].r, KR[j].b].map(Math.round) + "] v" + (DOT.debug.follow ? Math.round(DOT.debug.follow().vy) : 0)); } break; } }
        for (j = 0; j < NO.length; j++) if (hit(bb, NO[j]) && count(ink, ink.r, NO[j]) >= 3) { any.cor++; mark("corano-" + k, st); }
        for (j = 0; j < QU.length; j++) if (hit(bb, QU[j]) && count(ink, ink.r, QU[j]) >= 3) { any.q++; mark("quiet-" + k, st + (riding ? " riding" : "")); }
        if (dockOn) { var dk = { l: dr.left, t: dr.top, r: dr.right, b: dr.bottom };
          if (!fixed) { if (hit(bb, dk) && count(ink, ink.r, dk) >= 3) { any.bd++; mark("behindDock-" + k, st + " y" + Math.round(c.y - pageYOffset) + " dockTop" + Math.round(dr.top)); } }
          else { for (j = 0; j < DB.length; j++) { var tb = { l: DB[j].l + 10, t: DB[j].t + 12, r: DB[j].r - 10, b: DB[j].b - 12 }; if (hit(bb, tb) && count(ink, ink.r, tb) >= 3) { any.dw++; mark("dockWords-" + k, st); } }
            var below = { l: dk.l, t: dk.t + 3, r: dk.r, b: dk.b }; if (hit(bb, below) && countA(ink, ink.r, below, 160) >= 6) { any.bd++; mark("intoDock-" + k, st); } } }
      }
      for (var kk in prevKey) { if (prevKey[kk] === 2) prevKey[kk] = 1; else delete prevKey[kk]; }
      if (vis) O.inView++; else { if (!O._off) O._off = { t: t, st: st }; }
      if (vis && O._off) { var len = (t - O._off.t) / 1000; if (len > 1) O.offRuns.push(len.toFixed(1) + "s from " + O._off.st + " @" + ((O._off.t - O.t0) / 1000).toFixed(0)); O._off = null; }
      if (any.word) O.word++; if (any.cat) O.wordCat++; if (any.th) O.wordThings++; if (any.cor) O.corano++; if (any.q) O.quiet++; if (any.bd) O.behindDock++; if (any.dw) O.dockWords++; if (any.rw) { O.ridingWord++; if (still) O.ridingWordStill++; }
      if (O.frames % 30 === 0) { (O.tl = O.tl || []).push([Math.round((t - O.t0) / 100) / 10, Math.round(pageYOffset), st, vis ? 1 : 0, riding ? 1 : 0, V.phase[0]]); }
      visitor(t);
    }
    requestAnimationFrame(frame);
  }, { KEEP, SEED, SEC });
  const t0 = Date.now();
  while (true) { await page.waitForTimeout(2000); const d = await page.evaluate(() => window.__soak.done); if (d || Date.now() - t0 > (SEC + 60) * 1000) break; }
  const O = await page.evaluate(() => { var o = window.__soak, f = o.frames; var s = {}; for (var k in o.states) s[k] = +(o.states[k] / f * 100).toFixed(1); o.states = s; o.inViewPct = +(o.inView / f * 100).toFixed(1); o.ridingPct = +(o.riding / f * 100).toFixed(1); o.fps = +(f / ((performance.now() - o.t0) / 1000)).toFixed(1); o.end = DOT.debug.cat.state; return o; });
  const TL = await page.evaluate(() => window.__soak.tl || []); fs.writeFileSync(`${OUT}/${LABEL}-${W}x${H}-s${SEED}-tl.json`, JSON.stringify(TL));
  const res = { label: LABEL, W, H, SEC, SEED, frames: O.frames, fps: O.fps, inViewPct: O.inViewPct, word: O.word, wordCat: O.wordCat, wordThings: O.wordThings, corano: O.corano, quiet: O.quiet, behindDock: O.behindDock, dockWords: O.dockWords, ridingPct: O.ridingPct, ridingWord: O.ridingWord, ridingWordStill: O.ridingWordStill, scrolls: O.scrolls, filters: O.filters, maxKeep: O.maxKeep, end: O.end, states: O.states, wordBy: O.wordBy, offRuns: O.offRuns.slice(0, 20), ep: O.ep, errs };
  fs.writeFileSync(`${OUT}/${LABEL}-${W}x${H}-s${SEED}.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ label: LABEL, W, H, seed: SEED, frames: O.frames, fps: O.fps, inView: O.inViewPct, word: O.word, wordCat: O.wordCat, things: O.wordThings, corano: O.corano, quiet: O.quiet, behindDock: O.behindDock, dockWords: O.dockWords, riding: O.ridingPct, ridingWord: O.ridingWord, ridingWordStill: O.ridingWordStill, scrolls: O.scrolls, filters: O.filters, errs: errs.length }));
  await page.screenshot({ path: `${OUT}/${LABEL}-${W}x${H}-s${SEED}.png` });
  await ctx.close(); await browser.close();
})();
