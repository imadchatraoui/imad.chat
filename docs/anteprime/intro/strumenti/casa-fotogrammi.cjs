// Fotogrammi della casa nuova (docs/anteprime/casa/home, con intro-gatto.js) su un orologio finto, 60 al secondo, a istanti del tempo
// dell'intro (0 = il primo fotogramma di play()). Prima: node docs/anteprime/casa/strumenti/servi.mjs --port <porta>. Uso:
// node casa-fotogrammi.cjs --url "http://127.0.0.1:<porta>/casa/home/index.html?seme=7&t=2026-11-12T17:30:00Z" --out DIR [--w 390 --h 844
//   --dpr 2 --theme dark|light] [--shots "ms,ms"] [--from a --to b --every 50] [--clip x,y,w,h] [--init "js"] [--scroll "ms:y"] [--resize "ms:w,h"] [--jpg]
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const A = process.argv.slice(2), opt = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d), has = (k) => A.includes(k);
const URL_ = opt("--url"), OUT = path.resolve(opt("--out", "out"));
const W = +opt("--w", 390), H = +opt("--h", 844), DPR = +opt("--dpr", 2), THEME = opt("--theme", "dark");
const DT = 1000 / 60;
const clip = opt("--clip") ? opt("--clip").split(",").map(Number) : null;
let shots = opt("--shots") ? opt("--shots").split(",").map(Number) : [];
if (opt("--every")) { const a = +opt("--from"), b = +opt("--to"), e = +opt("--every"); for (let t = a; t <= b + 0.01; t += e) shots.push(Math.round(t)); }
const scrolls = (opt("--scroll") || "").split(",").filter(Boolean).map((s) => s.split(":").map(Number));
const resizes = (opt("--resize") || "").split(";").filter(Boolean).map((s) => { const [t, wh] = s.split(":"); const [w, h] = wh.split(",").map(Number); return { t: +t, w, h }; });
const INIT = fs.readFileSync(path.join(__dirname, "vclock.js"), "utf8");
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const touch = W < 700;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: touch, isMobile: touch, colorScheme: THEME === "light" ? "light" : "dark", locale: "it-IT" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror " + e.message)); page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + " " + m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => errs.push("requestfailed " + r.url()));
  await page.route("**/api/github/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' }));
  await page.addInitScript(INIT);
  if (opt("--init")) await page.addInitScript(opt("--init"));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Animation.enable");
  await page.goto(URL_, { waitUntil: "domcontentloaded" });
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
  await page.waitForLoadState("load");
  const ev = (f, a) => page.evaluate(f, a);
  // il tempo passa a passi finché l'intro non parte (aspetta i caratteri: sono veri, non finti)
  let guard = 0;
  while (!(await ev(() => window.__niReady === true)) && guard++ < 400) { await ev((dt) => window.__V.step(dt), DT); await page.waitForTimeout(5); }
  const t0 = await ev(() => window.__V.t);
  const T = await ev(() => window.__ni && window.__ni.T ? JSON.parse(JSON.stringify(window.__ni.T)) : null);
  const fontsOk = await ev(() => document.fonts.check('800 17px Manrope') && document.fonts.check('500 26px "Geist Mono"'));
  const tail = +opt("--tail", 0);
  const last = Math.max(shots.length ? Math.max(...shots) : 0, tail);
  shots.sort((a, b) => a - b);
  let k = 0, made = [], info = [];
  const n = Math.ceil(last / DT) + 1;
  for (let i = 1; i <= n; i++) {
    const tt = i * DT;
    for (const s of scrolls) if (s[0] > tt - DT && s[0] <= tt) await ev((y) => window.__V.realScroll(0, y), s[1]);
    for (const r of resizes) if (r.t > tt - DT && r.t <= tt) await page.setViewportSize({ width: r.w, height: r.h });
    await ev((dt) => window.__V.step(dt), DT);
    while (k < shots.length && shots[k] <= tt + 0.01) {
      const f = path.join(OUT, "f-" + String(shots[k]).padStart(5, "0") + (has("--jpg") ? ".jpg" : ".png"));
      const o = { path: f, animations: "allow", caret: "initial" };
      if (clip) o.clip = { x: clip[0], y: clip[1], width: clip[2], height: clip[3] };
      if (has("--jpg")) { o.type = "jpeg"; o.quality = 88; }
      await page.screenshot(o); made.push(f);
      info.push(await ev((ms) => ({ ms, cls: document.documentElement.className, dot: window.DOT && window.DOT.debug ? (function () { try { return window.DOT.debug.state().state; } catch (e) { return null; } })() : null, done: !!window.__niDone, sy: scrollY }), shots[k]));
      k++;
    }
  }
  fs.writeFileSync(path.join(OUT, "log.json"), JSON.stringify({ T, fontsOk, t0, errs, info }, null, 1));
  console.log("fotogrammi", made.length, "caratteri", fontsOk, "errori", errs.length ? errs : "nessuno");
  await browser.close();
})();
