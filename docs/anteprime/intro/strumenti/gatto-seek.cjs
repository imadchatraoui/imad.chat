// Controlla che window.__ni.seek(ms) disegni lo stesso fotogramma della riproduzione vera (intro-gatto.js, versione «gatto»):
// una pagina riproduce l'intro su un orologio finto (vclock.js, 60 fotogrammi al secondo) e a certi fotogrammi della scenetta
// e del salto prende un'impronta della tela dell'intro e l'istante disegnato (__ni.t); un'altra pagina, con ?seek=1, disegna
// gli stessi istanti con seek. Le impronte devono essere uguali. Prima: node docs/anteprime/casa/strumenti/servi.mjs --port <porta>.
// Uso: node gatto-seek.cjs --base http://127.0.0.1:<porta> [--w 390 --h 844 --dpr 2] [--ogni 7] (un fotogramma ogni N)
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const A = process.argv.slice(2), opt = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const BASE = opt("--base", "http://127.0.0.1:4331"), W = +opt("--w", 390), H = +opt("--h", 844), DPR = +opt("--dpr", 2), EVERY = +opt("--ogni", 7);
const URL_ = `${BASE}/casa/home/index.html?primo=1&seme=7&t=2026-11-12T17:30:00Z`;
const INIT = fs.readFileSync(path.join(__dirname, "vclock.js"), "utf8"), DT = 1000 / 60;
const HASH = `(() => { const cv = document.getElementById("ni"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let x = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 3) { x ^= d[i]; x = Math.imul(x, 16777619) >>> 0; } return x.toString(16); })()`;
async function ctxFor(b) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: W < 700, isMobile: W < 700, colorScheme: "dark", locale: "it-IT" });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  await p.route("**/api/github/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' }));
  return { ctx, p, errs };
}
(async () => {
  const b = await chromium.launch();
  /* prima i caratteri in memoria (altrimenti le misure delle lettere dipendono da quando arrivano) */
  const w = await ctxFor(b); await w.p.goto(URL_ + "&seek=1"); await w.p.waitForFunction(() => document.fonts.check('500 26px "Geist Mono"') && document.fonts.check("800 40px Manrope"), null, { timeout: 15000 }).catch(() => 0);
  const A1 = await ctxFor(b); await A1.p.addInitScript(INIT);
  const cdp = await A1.ctx.newCDPSession(A1.p); await cdp.send("Animation.enable");
  await A1.p.goto(URL_, { waitUntil: "domcontentloaded" }); await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 }); await A1.p.waitForLoadState("load");
  const ev = (f, a) => A1.p.evaluate(f, a);
  let g = 0; while (!(await ev(() => window.__niReady === true && window.__ni && window.__ni.T)) && g++ < 600) { await ev((dt) => window.__V.step(dt), DT); await A1.p.waitForTimeout(4); }
  const T = await ev(() => JSON.parse(JSON.stringify(window.__ni.T)));
  const wins = [[T.gag, T.gagEnd], [T.jump - 30, T.jumpIn + 160]];
  const got = []; let n = 0;
  for (let i = 0; i < 1200; i++) {
    await ev((dt) => window.__V.step(dt), DT);
    const t = await ev(() => window.__ni.t);
    if (t > wins[1][1]) break;
    if (wins.some((q) => t >= q[0] && t <= q[1]) && n++ % EVERY === 0) { got.push({ t, h: await ev(HASH) }); if (opt("--dump")) { const u = await ev(() => document.getElementById("ni").toDataURL("image/png")); fs.writeFileSync(path.join(opt("--dump"), "play-" + Math.round(t) + ".png"), Buffer.from(u.split(",")[1], "base64")); } }
  }
  /* lo stesso, nella pagina che ha riprodotto: seek indietro agli stessi istanti (separa la logica dalla memoria delle immagini del browser) */
  const same = []; for (const x of got) { const h = await A1.p.evaluate(`(function(t){ window.__ni.seek(t); return ${HASH}; })(${x.t})`); if (h !== x.h) same.push(Math.round(x.t)); }
  console.log("seek nella stessa pagina, diversi:", same.length ? same.join(", ") : "nessuno");
  const B1 = await ctxFor(b); await B1.p.goto(URL_ + "&seek=1"); await B1.p.waitForFunction(() => window.__niReady === true && window.__ni);
  let bad = [];
  const DUMP = opt("--dump");
  for (const x of got) {
    const h = await B1.p.evaluate(`(function(t){ window.__ni.seek(t); return ${HASH}; })(${x.t})`);
    if (h !== x.h) { bad.push(Math.round(x.t)); if (DUMP) { const u = await B1.p.evaluate(() => document.getElementById("ni").toDataURL("image/png")); fs.writeFileSync(path.join(DUMP, "seek-" + Math.round(x.t) + ".png"), Buffer.from(u.split(",")[1], "base64")); } }
  }
  if (DUMP && bad.length) console.log("istanti diversi salvati in", DUMP);
  console.log(`${W}x${H}@${DPR}: ${got.length} fotogrammi (scenetta ${T.gag}-${T.gagEnd}, salto ${T.jump}-${T.jumpIn}), diversi: ${bad.length ? bad.join(", ") : "nessuno"}`);
  const errs = A1.errs.concat(B1.errs); if (errs.length) console.log("ERRORI", [...new Set(errs)].join(" | "));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
