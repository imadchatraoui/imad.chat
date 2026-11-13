// I film di Dot sulla casa nuova per Imad, sulla build di Next (`npx next start -p <porta>`), fotogramma per fotogramma su un orologio finto
// (60 al secondo, come casa-film.cjs e casa-suggerimento-film.cjs, da cui viene l'orologio). Due copioni, senza toccare Dot:
//   prima  — una prima visita: l'intro col gatto, il passaggio, Dot che esce dalla scatola, «salam, sono Dot.», il dito fantasma, poi bussa
//            (il film finisce poco dopo il primo colpo sul vetro, o a --max secondi);
//   dock   — una seconda visita (niente apertura): Dot a casa, il visitatore scorre giù, Dot sale sul dock e ci viaggia, un filtro, di nuovo in cima,
//            Dot torna a casa. L'intro passa prima di registrare (--da: i secondi di riscaldamento senza fotogrammi).
// Uso, dalla cartella del repository:
//   node docs/anteprime/casa/strumenti/film-gatto.cjs <cartella> --copione prima|dock [--base http://localhost:4201/anteprima]
//        [--tema scuro|chiaro] [--contributi c.json --progetti p.json] [--max 50] [--nome film.mp4] [--y1 600 --y2 1300] [--scan] [--crf 26]
//   [--registra-da 44 --dopo-bussa 7] (copione prima): the same visit, frames only from 44 s on, until 7 s after the knock starts.
//   Senza --contributi/--progetti le due route di GitHub rispondono come risponde il server; con i file, con quelle risposte
//   (per esempio salvate dal sito online: sono i dati veri). --scan (copione dock) stampa le posizioni di scorrimento con posto libero sul dock e esce.
// Scrive <cartella>/<nome> (780x1688, H.264 yuv420p, +faststart), <nome>.segni.json (i secondi dei momenti) e lascia i fotogrammi in <cartella>/_f-<copione>.
const INIT = `(() => {
  const V = { t: 0, timers: [], seq: 0, rafs: [], scrollAnim: null };
  window.__V = V;
  const pn = performance.now.bind(performance), T0 = pn();
  performance.now = function () { return T0 + V.t; };
  const RD = Date, BASE = RD.now();
  function FD() { if (!new.target) return new RD(BASE + V.t).toString(); return arguments.length ? new (Function.prototype.bind.apply(RD, [null].concat([].slice.call(arguments))))() : new RD(BASE + V.t); }
  FD.prototype = RD.prototype; FD.now = function () { return BASE + V.t; }; FD.parse = RD.parse; FD.UTC = RD.UTC;
  window.Date = FD;
  window.setTimeout = function (fn, ms) { const a = [].slice.call(arguments, 2), id = ++V.seq; V.timers.push({ id, at: V.t + Math.max(0, +ms || 0), fn, a, rep: 0 }); return id; };
  window.setInterval = function (fn, ms) { const a = [].slice.call(arguments, 2), id = ++V.seq, iv = Math.max(4, +ms || 0); V.timers.push({ id, at: V.t + iv, fn, a, rep: iv }); return id; };
  window.clearTimeout = window.clearInterval = function (id) { V.timers = V.timers.filter((x) => x.id !== id); };
  window.requestAnimationFrame = function (fn) { const id = ++V.seq; V.rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = function (id) { V.rafs = V.rafs.filter((x) => x.id !== id); };
  window.requestIdleCallback = function (fn) { return setTimeout(function () { fn({ didTimeout: false, timeRemaining: function () { return 8; } }); }, 1); };
  window.cancelIdleCallback = window.clearTimeout;
  /* smooth scrolling on the virtual clock */
  const rs = window.scrollTo.bind(window);
  function smooth(y) { const y0 = scrollY, ymax = document.documentElement.scrollHeight - innerHeight; y = Math.max(0, Math.min(ymax, y)); const d = Math.abs(y - y0); V.scrollAnim = { y0, y1: y, t0: V.t, dur: Math.max(260, Math.min(720, 260 + d * 0.5)) }; }
  window.scrollTo = function (a, b) { if (a && typeof a === "object") { if (a.behavior === "smooth") { smooth(a.top != null ? a.top : scrollY); return; } V.scrollAnim = null; rs(a.left != null ? a.left : scrollX, a.top != null ? a.top : scrollY); return; } V.scrollAnim = null; rs(a, b); };
  window.scroll = window.scrollTo;
  window.scrollBy = function (a, b) { if (a && typeof a === "object") { window.scrollTo({ top: scrollY + (a.top || 0), behavior: a.behavior }); return; } window.scrollTo(scrollX + a, scrollY + b); };
  V.realScroll = rs;
  const eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  V.step = function (dt) {
    const end = V.t + dt;
    /* CSS transitions/animations and WAAPI: the timeline is frozen, each running animation moves on by dt */
    const anims = document.getAnimations();
    for (let i = 0; i < anims.length; i++) { const an = anims[i]; if (an.playState === "running" || (an.pending && an.playState !== "paused")) { try { an.currentTime = (an.currentTime || 0) + dt * (an.playbackRate || 1); } catch (e) {} } }
    for (let g = 0; g < 5000; g++) {
      V.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const x = V.timers[0]; if (!x || x.at > end) break;
      V.t = Math.max(V.t, x.at);
      if (x.rep) x.at += x.rep; else V.timers.shift();
      try { if (typeof x.fn === "function") x.fn.apply(window, x.a); } catch (e) { console.error("timer: " + e.message); }
    }
    V.t = end;
    if (V.scrollAnim) { const s = V.scrollAnim, u = Math.min(1, (V.t - s.t0) / s.dur); rs(0, Math.round(s.y0 + (s.y1 - s.y0) * eio(u))); if (u >= 1) V.scrollAnim = null; }
    const list = V.rafs; V.rafs = [];
    for (let i = 0; i < list.length; i++) { try { list[i].fn(T0 + V.t); } catch (e) { console.error("raf: " + e.message); } }
  };
  /* the fingertip shown in the film */
  V.finger = function (x, y, a, press) {
    let f = document.getElementById("__dito");
    if (!f) { f = document.createElement("div"); f.id = "__dito"; f.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(255,255,255,.42);box-shadow:0 0 0 1.5px rgba(255,255,255,.75),0 2px 10px rgba(0,0,0,.25);top:0;left:0;opacity:0;"; (document.body || document.documentElement).appendChild(f); }
    f.style.left = x + "px"; f.style.top = y + "px"; f.style.opacity = String(a); f.style.transform = "scale(" + (press ? 0.82 : 1) + ")";
  };
})();`;

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const ARGS = process.argv.slice(2), opt = (k, d) => (ARGS.includes(k) ? ARGS[ARGS.indexOf(k) + 1] : d);
const OUT = path.resolve(ARGS[0] && !ARGS[0].startsWith("--") ? ARGS[0] : "film-gatto");
const COP = opt("--copione", "prima"), BASE = opt("--base", "http://localhost:4201/anteprima"), TEMA = opt("--tema", "scuro");
const FPS = 60, DT = 1000 / FPS, MAX = +opt("--max", COP === "prima" ? 50 : 30), NOME = opt("--nome", COP === "prima" ? "prima-visita.mp4" : "dot-sul-dock.mp4");
const FR = path.join(OUT, "_f-" + COP + (opt("--registra-da") ? "-da" : "")), T = "2026-11-12T17:30:00Z", SCAN = ARGS.includes("--scan");
const DA = +opt("--registra-da", 0), DOPO = +opt("--dopo-bussa", 4.5);   /* --registra-da s: (copione prima) the clock runs from the start, frames are saved only from s on (same seed: same frames) */
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); if (!SCAN) { fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true }); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: TEMA === "chiaro" ? "light" : "dark" });
  const page = await ctx.newPage(); const errs = [], fails = [];
  page.on("pageerror", (e) => errs.push("pageerror " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console " + m.text()); });
  page.on("requestfailed", (r) => fails.push(r.url())); page.on("response", (r) => { if (r.status() >= 400) fails.push(r.status() + " " + r.url()); });
  if (opt("--contributi")) { const c = fs.readFileSync(opt("--contributi"), "utf8"); await page.route("**/api/github/contributi**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: c })); }
  if (opt("--progetti")) { const p = fs.readFileSync(opt("--progetti"), "utf8"); await page.route("**/api/github/progetti**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: p })); }
  await page.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(page); await cdp.send("Animation.enable");
  const q = (COP === "dock" ? "primo=0&" : "") + "seme=7&t=" + encodeURIComponent(T);
  await page.goto(BASE + (BASE.includes("?") ? "&" : "?") + q, { waitUntil: "domcontentloaded" });
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
  await page.waitForLoadState("load");
  const ev = (f, a) => page.evaluate(f, a);
  let n = 0, rec = false, tv = 0; const tStart = Date.now(), marks = {};
  const secs = () => n / FPS;
  const mark = (k) => { if (marks[k] == null) { marks[k] = +secs().toFixed(2); console.log("mark", k, marks[k]); } };
  async function frame() {
    await ev((dt) => window.__V.step(dt), DT); tv += 1 / FPS;
    if (!rec) return;
    if (secs() < DA) { n++; return; }
    await page.screenshot({ path: path.join(FR, String(n).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 90, animations: "allow", caret: "initial" });
    n++; if (n % 300 === 0) console.log("frame", n, ((Date.now() - tStart) / n).toFixed(0) + " ms/frame");
    const h = await ev(() => { if (!window.DOT || !DOT.debug || !window.__dot) return null; var s = DOT.debug.hint(), c = DOT.debug.cat; return { ph: s.ph, salam: s.salam, knocks: s.knocks, st: c.state, rd: DOT.debug.riding(), home: DOT.debug.follow().home }; });
    if (h) { mark("dot"); if (h.salam >= 0) mark("salam"); if (h.ph) mark("dito:" + h.ph); if (h.knocks > 0) mark("bussa"); mark("st:" + h.st); if (h.rd) mark("inGroppa"); }
  }
  const left = () => secs() < MAX;
  async function hold(s) { const end = n + Math.round(s * FPS); while (n < end && left()) await frame(); }
  async function until(fn, maxS) { const end = tv + maxS; while (tv < end && (!rec || left())) { if (await ev(fn)) return true; await frame(); } return false; }
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  async function scrollTo(y, s) {   /* a finger drags the page */
    const y0 = await ev(() => scrollY), N = Math.round(s * FPS), fx = 300, up = y > y0;
    for (let i = 1; i <= N && left(); i++) {
      const yy = Math.round(y0 + (y - y0) * ease(i / N)); await ev((yy) => window.__V.realScroll(0, yy), yy);
      const fy = up ? 640 - 380 * (i / N) : 260 + 380 * (i / N); await ev((a) => window.__V.finger(a[0], a[1], a[2], true), [fx, fy, Math.min(1, Math.min(i, N - i) / 8)]);
      await frame();
    }
    await ev(() => window.__V.finger(0, 0, 0));
  }
  async function tap(sel, s) {   /* the fingertip comes, presses, the click happens, it lifts */
    const r = await ev((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
    for (let i = 0; i < 10; i++) { await ev((a) => window.__V.finger(a[0], a[1], a[2], false), [r[0], r[1], i / 10]); await frame(); }
    for (let i = 0; i < 6; i++) { await ev((a) => window.__V.finger(a[0], a[1], 1, true), r); await frame(); }
    await ev((sel) => document.querySelector(sel).click(), sel);
    for (let i = 0; i < 12; i++) { await ev((a) => window.__V.finger(a[0], a[1], a[2], false), [r[0], r[1], 1 - i / 12]); await frame(); }
    await ev(() => window.__V.finger(0, 0, 0)); if (s) await hold(s);
  }
  if (COP === "prima") {
    rec = true; mark("start");
    await until(() => window.__niDone === true, 20); mark("introDone");
    await until(() => window.DOT && DOT.debug && DOT.debug.hint && DOT.debug.hint().knocks > 0, MAX);
    await hold(DOPO);
  } else {
    /* warm-up without frames: the intro and Dot settling at home */
    await until(() => window.__niDone === true && window.__dot === true, 30);
    await until(() => false, +opt("--da", 6));
    if (SCAN) {
      const maxY = await ev(() => document.documentElement.scrollHeight - innerHeight), r = [];
      for (let y = 300; y <= maxY; y += 50) { await ev((y) => window.__V.realScroll(0, y), y); await frame(); await frame(); await frame(); r.push([y, await ev(() => DOT.debug.dockFree().w)]); }
      console.log(JSON.stringify(r)); await browser.close(); return;
    }
    const Y1 = +opt("--y1", 600), Y2 = +opt("--y2", 1300);
    rec = true; mark("start");
    await hold(1.6);
    await scrollTo(Y1, 1.3); mark("giu1");
    await until(() => DOT.debug.riding() && /ride|sit|look|loaf|groom|pause|walk|dockpeek/.test(DOT.debug.cat.state) && DOT.debug.cat.state !== "dockup", 8); mark("sulDock");
    await hold(2.2);
    await scrollTo(Y2, 2.6); mark("giu2");
    await hold(2.6);
    await tap('#dock [data-filtro="progetti"]', 3.2); mark("filtro");
    await tap('#dock [data-filtro="tutto"]', 1.6); mark("tutto");
    await scrollTo(0, 1.6); mark("cima");
    await until(() => DOT.debug.follow().home && !DOT.debug.riding() && /sit|look|loaf|groom|sleep|yawn|pause/.test(DOT.debug.cat.state), 14); mark("aCasa");
    await hold(2);
  }
  mark("end");
  console.log("frames", n, "seconds", secs().toFixed(2), "real", ((Date.now() - tStart) / 1000).toFixed(0) + " s");
  fs.writeFileSync(path.join(OUT, NOME + ".segni.json"), JSON.stringify({ marks, errs, fails }, null, 1));
  await browser.close();
  const mp4 = path.join(OUT, NOME);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-start_number", String(Math.round(DA * FPS)), "-i", path.join(FR, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", opt("--crf", "26"), "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  console.log(JSON.stringify({ mp4, mb: +(fs.statSync(mp4).size / 1e6).toFixed(2), frames: n, marks, errs: errs.slice(0, 8), fails: fails.slice(0, 8) }));
})().catch((e) => { console.error(e); process.exit(1); });
