// La prova del passaggio di mano (intro «gatto» → scena di Dot): il fotogramma prima (i tasti disegnati dall'intro) e quello dopo (la
// scena), nell'area dei nove tasti. node casa-passaggio.cjs URL OUTDIR [w h dpr theme] [--scroll y]; poi python3 diff.py OUTDIR/prima.png
// OUTDIR/dopo.png (livelli 0..255 per canale). Orologio finto, 60 fotogrammi al secondo. Serve servi.mjs acceso (vedi casa-fotogrammi.cjs).
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const A = process.argv.slice(2), opt = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const [URL_, OUT, w = "390", h = "844", dpr = "2", theme = "dark"] = A.filter((x, i) => !x.startsWith("--") && !(i > 0 && A[i - 1].startsWith("--")));
const SCROLL = opt("--scroll") ? +opt("--scroll") : null;
const DT = 1000 / 60, INIT = fs.readFileSync(path.join(__dirname, "vclock.js"), "utf8");
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), W = +w, touch = W < 700;
  const ctx = await b.newContext({ viewport: { width: W, height: +h }, deviceScaleFactor: +dpr, hasTouch: touch, isMobile: touch, colorScheme: theme === "light" ? "light" : "dark", locale: "it-IT" });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.route("**/api/github/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' }));
  await p.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(p); await cdp.send("Animation.enable");
  await p.goto(URL_, { waitUntil: "domcontentloaded" }); await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 }); await p.waitForLoadState("load");
  let g = 0; while (!(await p.evaluate(() => window.__niReady === true)) && g++ < 400) { await p.evaluate((dt) => window.__V.step(dt), DT); await p.waitForTimeout(5); }
  const T = await p.evaluate(() => ({ handover: window.__ni.T.handover, landed: window.__ni.T.landed, pass: window.__ni.pass }));
  if (!T.pass) { console.log("NO PASSAGE"); await b.close(); return; }
  let i = 0, prev = null, res = null;
  while (i * DT < T.handover + 400) {
    i++;
    if (SCROLL != null && i * DT >= T.landed + 60 && i * DT < T.landed + 60 + DT) await p.evaluate((y) => window.__V.realScroll(0, y), SCROLL);
    await p.evaluate((dt) => window.__V.step(dt), DT);
    if (i * DT < T.handover - 4 * DT) continue;
    const st = await p.evaluate(() => { const a = window.__niDot.anchor(); return { dot: !!window.__dot, ax: a.x - scrollX, ay: a.y - scrollY, sy: scrollY, state: window.DOT && window.DOT.debug ? window.DOT.debug.state().state : null }; });
    const clip = { x: Math.round(st.ax - 62), y: Math.max(0, Math.round(st.ay - 118)), width: 124, height: 132 };
    const f = path.join(OUT, "f" + i + ".png");
    await p.screenshot({ path: f, clip, animations: "allow" });
    if (prev && !prev.st.dot && st.dot) { res = { before: prev, after: { f, st, clip, t: i * DT } }; break; }
    prev = { f, st, clip, t: i * DT };
  }
  await b.close();
  if (!res) { console.log("handover not found", errs); return; }
  fs.copyFileSync(res.before.f, path.join(OUT, "prima.png")); fs.copyFileSync(res.after.f, path.join(OUT, "dopo.png"));
  console.log(JSON.stringify({ before: { t: +res.before.t.toFixed(1), state: res.before.st.state, clip: res.before.clip }, after: { t: +res.after.t.toFixed(1), state: res.after.st.state, clip: res.after.clip }, handover: T.handover, errs }));
})();
