// Il film della prima visita della casa nuova con l'intro «gatto» (la scenetta di Dot, il salto, il passaggio, l'apertura di Dot):
// ogni fotogramma a 60 al secondo su un orologio finto (vclock.js: ogni orologio della pagina), poi ffmpeg (H.264, yuv420p).
// Prima: node docs/anteprime/casa/strumenti/servi.mjs --port <porta>. Uso:
// node gatto-film.cjs --base http://127.0.0.1:<porta> --out film.mp4 [--w 390 --h 844 --dpr 2 --theme dark] [--da 0 --a 16500] (ms)
//   [--query "&v=stella"] [--crf 20] [--momenti momenti.jpg] (un foglio con alcuni istanti presi dal film)
// Stampa i tempi dell'intro, quando appare «salam, sono Dot.», gli errori della console e le richieste fallite.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const A = process.argv.slice(2), opt = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const BASE = opt("--base", "http://127.0.0.1:4331"), OUT = path.resolve(opt("--out", "film.mp4")), W = +opt("--w", 390), H = +opt("--h", 844), DPR = +opt("--dpr", 2), THEME = opt("--theme", "dark");
const DA = +opt("--da", 0), AL = +opt("--a", 16500), Q = opt("--query", ""), CRF = opt("--crf", "20");
const DT = 1000 / 60, INIT = fs.readFileSync(path.join(__dirname, "vclock.js"), "utf8");
(async () => {
  const FR = OUT + ".fotogrammi"; fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const b = await chromium.launch(), touch = W < 700;
  /* i caratteri in memoria prima (le misure delle lettere non devono dipendere da quando arrivano) */
  const warm = await b.newContext(); const wp = await warm.newPage(); await wp.goto(`${BASE}/casa/home/index.html?seek=1`); await wp.waitForFunction(() => document.fonts.check('500 26px "Geist Mono"') && document.fonts.check("800 40px Manrope"), null, { timeout: 15000 }).catch(() => 0); await warm.close();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: touch, isMobile: touch, colorScheme: THEME === "light" ? "light" : "dark", locale: "it-IT" });
  const p = await ctx.newPage(), errs = [], failed = [];
  p.on("pageerror", (e) => errs.push("pageerror " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console " + m.text().slice(0, 240)); });
  p.on("requestfailed", (r) => failed.push(r.url()));
  await p.route("**/api/github/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' }));
  await p.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(p); await cdp.send("Animation.enable");
  await p.goto(`${BASE}/casa/home/index.html?primo=1&seme=7&t=2026-11-12T17:30:00Z${Q}`, { waitUntil: "domcontentloaded" });
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 }); await p.waitForLoadState("load");
  const ev = (f, a) => p.evaluate(f, a);
  let g = 0; while (!(await ev(() => window.__niReady === true)) && g++ < 600) { await ev((dt) => window.__V.step(dt), DT); await p.waitForTimeout(4); }
  const T = await ev(() => (window.__ni ? JSON.parse(JSON.stringify(window.__ni.T)) : null));
  const info = await ev(() => ({ v: window.__ni && window.__ni.version, pass: window.__ni && window.__ni.pass, gag: window.__ni && window.__ni.gag, jump: window.__ni && window.__ni.jump }));
  let n = 0, salam = null, free = null; const n0 = Math.round(DA / DT), n1 = Math.round(AL / DT);
  for (let i = 1; i <= n1; i++) {
    await ev((dt) => window.__V.step(dt), DT);
    if (salam === null && (await ev(() => /salam, sono Dot/.test(document.body.innerText || "")))) salam = Math.round(i * DT);
    if (free === null && (await ev(() => !document.documentElement.classList.contains("is-locked")))) free = Math.round(i * DT);
    if (i >= n0) await p.screenshot({ path: path.join(FR, String(n++).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 90, animations: "allow" });
  }
  await b.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "60", "-i", path.join(FR, "%05d.jpg"), "-c:v", "libx264", "-preset", "medium", "-crf", CRF, "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-movflags", "+faststart", OUT]);
  const MOM = opt("--momenti");
  if (MOM) {
    const tt = (opt("--istanti", "") || "").split(",").filter(Boolean).map(Number);
    const list = tt.length ? tt : [1300, 1650, 1900, 2100, 2250, 2450, 5000, 6080, 6260, 6420, 6560, 7200, 9000, 15000].filter((x) => x < AL);
    const dir = OUT + ".momenti"; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    list.forEach((ms, k) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String((ms - DA) / 1000), "-i", OUT, "-frames:v", "1", "-vf", "scale=390:-2", path.join(dir, "f-" + String(k).padStart(3, "0") + "_t" + ms + ".png")]));
    execFileSync("python3", [path.join(__dirname, "striscia.py"), dir, MOM, "7", "390"], { stdio: "inherit" });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.rmSync(FR, { recursive: true, force: true });
  console.log(JSON.stringify({ film: OUT, fotogrammi: n, ...info, settled: T && T.settled, press: T && T.press, landed: T && T.landed, end: T && T.end, liberaMs: free, salamMs: salam, errori: errs, fallite: failed }));
})();
