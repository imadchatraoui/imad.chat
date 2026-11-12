// Strisce di fotogrammi di Dot nell'intro (intro-gatto.js, versione «gatto»), disegnati con window.__ni.seek(ms): ogni istante
// è disegnato da solo, senza riprodurre l'intro. Prima: node docs/anteprime/casa/strumenti/servi.mjs --port <porta>. Uso:
// node gatto-striscia.cjs --url "http://127.0.0.1:<porta>/casa/home/index.html?primo=1" --out striscia.jpg
//   [--scena gag|salto] [--from ms --to ms --every 40] (ms relativi all'inizio della scena; senza: tutta la scena)
//   [--w 390 --h 844 --dpr 2 --theme dark|light] [--cols 8] [--clip x,y,w,h] [--dir cartella-fotogrammi] [--abs] (ms assoluti)
// La scena «gag» parte dall'ultimo tasto (T.gag), «salto» dall'inizio del salto (T.jump). Il ritaglio, se manca, è quello che
// l'intro dice (window.__ni.box). Scrive un foglio JPEG con l'istante sotto ogni fotogramma e stampa i tempi e gli errori.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = require("playwright");
const A = process.argv.slice(2), opt = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d), has = (k) => A.includes(k);
const URL_ = opt("--url"), OUT = path.resolve(opt("--out", "striscia.jpg")), SCENA = opt("--scena", "gag");
const W = +opt("--w", 390), H = +opt("--h", 844), DPR = +opt("--dpr", 2), THEME = opt("--theme", "dark"), COLS = +opt("--cols", 8);
const DIR = path.resolve(opt("--dir", OUT.replace(/\.[a-z]+$/i, "") + "-f"));
(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch();
  const touch = W < 700;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: touch, isMobile: touch, colorScheme: THEME === "light" ? "light" : "dark", locale: "it-IT" });
  const page = await ctx.newPage(), errs = [];
  page.on("pageerror", (e) => errs.push("pageerror " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console " + m.text().slice(0, 300)); });
  await page.route("**/api/github/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' }));
  const u = URL_ + (URL_.includes("?") ? "&" : "?") + "seek=1";
  await page.goto(u, { waitUntil: "load" });
  await page.waitForFunction(() => window.__niReady === true && window.__ni, null, { timeout: 20000 });
  await page.evaluate(() => window.__ni.seek(1));
  const info = await page.evaluate(() => ({ T: window.__ni.T, gag: window.__ni.gag, jump: window.__ni.jump, pass: window.__ni.pass, fonts: document.fonts.check('500 26px "Geist Mono"') && document.fonts.check("800 17px Manrope") }));
  const T = info.T, base = has("--abs") ? 0 : SCENA === "salto" ? T.jump : T.gag;
  if (base == null || isNaN(base)) { console.log("la scena non c'è (gag:", info.gag, "salto:", info.jump, ")"); await browser.close(); process.exit(1); }
  const from = +opt("--from", SCENA === "salto" ? -40 : 0), to = +opt("--to", SCENA === "salto" ? 760 : 1380), every = +opt("--every", 40);
  let clip = opt("--clip") ? opt("--clip").split(",").map(Number) : null;
  if (!clip) { const b = await page.evaluate((ms) => window.__ni.box(ms), base + from + every); if (b) clip = [b.x, b.y, b.w, b.h].map((v) => Math.round(v)); }
  if (clip) { clip[0] = Math.max(0, clip[0]); clip[1] = Math.max(0, clip[1]); clip[2] = Math.min(W - clip[0], clip[2]); clip[3] = Math.min(H - clip[1], clip[3]); }
  let k = 0;
  for (let t = from; t <= to + 0.01; t += every, k++) {
    await page.evaluate((ms) => window.__ni.seek(ms), base + t);
    const o = { path: path.join(DIR, "f-" + String(k).padStart(3, "0") + "_t" + Math.round(t) + ".png") };
    if (clip) o.clip = { x: clip[0], y: clip[1], width: clip[2], height: clip[3] };
    await page.screenshot(o);
  }
  await browser.close();
  const tw = clip ? Math.round(clip[2] * DPR) : W * DPR;
  const py = path.join(__dirname, "striscia.py");
  cp.execFileSync("python3", [py, DIR, OUT, String(Math.min(COLS, k)), String(tw)], { stdio: "inherit" });
  console.log(JSON.stringify({ scena: SCENA, base, pass: info.pass, gag: info.gag, salto: info.jump, caratteri: info.fonts, clip, fotogrammi: k }));
  if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
})();
