// Il film del suggerimento (CASA.md 2c C): i primi 30 secondi di una prima visita alla casa nuova, senza toccare niente.
// L'intro, l'apertura di Dot fino a «salam, sono Dot.», poi il dito fantasma. Ogni orologio della pagina è finto (60 fotogrammi al secondo),
// come in casa-film.cjs (da cui vengono gli orologi e i dati di prova, copiati qui sotto).
// Con servi.mjs acceso:  node docs/anteprime/gatto/strumenti/casa-suggerimento-film.cjs <cartella> [--base http://127.0.0.1:4121/casa/home/index.html]
//   [--max 30] [--tema scuro|chiaro] [--nome prima-visita-dati-di-prova.mp4] [--crf 27]
// Scrive il film e film-segni.json (quando parte Dot, quando dice «salam», quando arriva il dito fantasma, quando finisce).
/* dati di prova inventati (nomi neutri): solo per foto e film che lo dicono nel nome del file ("dati-di-prova") */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function contributi() {
  const r = rng(11), days = [];
  const to = new Date(Date.UTC(2026, 10, 12)), from = new Date(Date.UTC(2025, 10, 9));
  let total = 0;
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
    const wd = d.getUTCDay(), month = d.getUTCMonth();
    const busy = (month >= 8 || month <= 1 ? 0.62 : 0.4) * (wd === 0 || wd === 6 ? 0.55 : 1);
    let n = 0;
    if (r() < busy) n = 1 + Math.floor(Math.pow(r(), 2.2) * 14);
    days.push({ d: d.toISOString().slice(0, 10), n });
    total += n;
  }
  for (const x of days) x.l = x.n === 0 ? 0 : x.n <= 2 ? 1 : x.n <= 5 ? 2 : x.n <= 9 ? 3 : 4;
  return { ok: true, user: "imadchatraoui", total, from: days[0].d, to: days[days.length - 1].d, days, updated: "2026-11-12T16:00:00.000Z" };
}
function progetti() {
  const R = (name, description, language, days, extra) => Object.assign({ name, description, language, url: "https://github.com/imadchatraoui/" + name, homepage: null, pushedAt: new Date(Date.UTC(2026, 10, 12, 15) - days * 86400000).toISOString(), stars: 0, fork: false }, extra || {});
  return {
    ok: true,
    repos: [
      R("orologio-solare", "Descrizione di prova.", "JavaScript", 0),
      R("lista-della-spesa", "Descrizione di prova, un po' più lunga, per vedere come va a capo su due righe.", "TypeScript", 3, { homepage: "https://example.org" }),
      R("galleria-foto", null, "HTML", 12),
      R("appunti", "Descrizione di prova.", "Python", 40),
      R("meteo-semplice", "Descrizione di prova.", "Java", 95),
      R("editor-di-testo", "Descrizione di prova.", "C", 200, { fork: true }),
    ],
    learning: { repo: "threejs-journey", url: "https://github.com/imadchatraoui/threejs-journey", pushedAt: "2026-11-10T18:00:00.000Z",
      commits: [{ message: "Commit di prova: luci e ombre", date: "2026-11-10T18:00:00.000Z" }, { message: "Commit di prova: materiali", date: "2026-11-07T20:00:00.000Z" }] },
    updated: "2026-11-12T16:00:00.000Z",
  };
}
async function route(page, withData) {
  const c = JSON.stringify(withData ? contributi() : { ok: false }), p = JSON.stringify(withData ? progetti() : { ok: false });
  await page.route("**/api/github/contributi**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: c }));
  await page.route("**/api/github/progetti**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: p }));
}

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const ARGS = process.argv.slice(2), opt = (k, d) => (ARGS.includes(k) ? ARGS[ARGS.indexOf(k) + 1] : d);
const OUT = path.resolve(ARGS[0] && !ARGS[0].startsWith("--") ? ARGS[0] : "film-suggerimento"), FR = path.join(OUT, "fotogrammi");
const BASE = opt("--base", "http://127.0.0.1:4121/casa/home/index.html"), TEMA = opt("--tema", "scuro"), DATI = opt("--dati", "prova") === "prova";
const FPS = 60, DT = 1000 / FPS;
const MAX = +opt("--max", 30);
const T = "2026-11-12T17:30:00Z";
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
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: TEMA === "chiaro" ? "light" : "dark" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console " + m.text()); });
  await route(page, DATI);
  await page.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Animation.enable");
  await page.goto(BASE + (BASE.includes("?") ? "&" : "?") + "seme=7&t=" + encodeURIComponent(T), { waitUntil: "domcontentloaded" });   /* una prima visita: l'intro, l'apertura */
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
  await page.waitForLoadState("load");
  let n = 0; const tStart = Date.now(), marks = {};
  const ev = (f, a) => page.evaluate(f, a);
  const secs = () => n / FPS;
  const mark = (k) => { if (marks[k] == null) { marks[k] = +secs().toFixed(2); console.log("mark", k, marks[k]); } };
  while (secs() < MAX) {
    await ev((dt) => window.__V.step(dt), DT);
    await page.screenshot({ path: path.join(FR, String(n).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 90, animations: "allow", caret: "initial" });
    n++;
    const h = await ev(() => { if (!window.DOT || !DOT.debug || !window.__dot) return null; var s = DOT.debug.hint(), b = document.querySelector(".dot-fum"); return { ph: s.ph, salam: s.salam, st: DOT.debug.cat.state, bub: b ? b.textContent : "" }; });
    if (h) { mark("dot"); if (h.salam >= 0) mark("salam"); if (h.ph) mark("dito:" + h.ph); }
    if (n % 300 === 0) console.log("frame", n, ((Date.now() - tStart) / n).toFixed(0) + " ms/frame");
  }
  fs.writeFileSync(path.join(OUT, "film-segni.json"), JSON.stringify({ marks, errs }, null, 1));
  await browser.close();
  const mp4 = path.join(OUT, opt("--nome", "prima-visita-30s" + (DATI ? "-dati-di-prova" : "") + ".mp4"));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FR, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", opt("--crf", "27"), "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  console.log(JSON.stringify({ mp4, frames: n, marks, errs: errs.slice(0, 8) }));
})().catch((e) => { console.error(e); process.exit(1); });
