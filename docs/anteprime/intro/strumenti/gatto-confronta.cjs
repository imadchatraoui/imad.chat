// Confronta la copia (intro-gatto.js) con l'intro della home online (intro.js) sulla casa nuova, istante per istante:
// la pagina si apre due volte con ?seek=1, una con la copia e una con intro.js servito al suo posto, e a ogni istante
// window.__ni.seek(ms) disegna; si confrontano i pixel della tela dell'intro e tutto ciò che l'intro scrive nella pagina.
// Per le versioni «stella» e «cursore» devono essere identiche. Prima: node docs/anteprime/casa/strumenti/servi.mjs --port <porta>.
// Uso: node gatto-confronta.cjs --base http://127.0.0.1:<porta> [--v stella,cursore] [--w 390 --h 844 --dpr 2] [--primo 1]
//        [--ms "0,600,1300,..."] (senza: dieci istanti fissi più la fine)
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const A = process.argv.slice(2), opt = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const BASE = opt("--base", "http://127.0.0.1:4331"), VS = opt("--v", "stella,cursore").split(","), W = +opt("--w", 390), H = +opt("--h", 844), DPR = +opt("--dpr", 2), PRIMO = opt("--primo", "1");
const MS = opt("--ms", "0,700,1250,1480,1700,2300,3300,4600,5700,6600").split(",").map(Number);
const OGGI = fs.readFileSync(path.join(__dirname, "..", "intro.js"), "utf8");
async function shoot(browser, v, oggi) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: W < 700, isMobile: W < 700, colorScheme: "dark", locale: "it-IT" });
  const page = await ctx.newPage(), errs = [];
  page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  await page.route("**/api/github/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' }));
  if (oggi) await page.route("**/intro/intro-gatto.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: OGGI }));
  /* due volte: alla seconda i caratteri sono già in memoria (in ?seek=1 l'intro misura le lettere una volta sola, all'inizio) */
  for (let k = 0; k < 2; k++) {
    await page.goto(`${BASE}/casa/home/index.html?seek=1&v=${v}&primo=${PRIMO}&seme=7`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__niReady === true && window.__ni, null, { timeout: 20000 });
    if (!k) await page.waitForFunction(() => document.fonts.check('500 26px "Geist Mono"') && document.fonts.check("800 40px Manrope"), null, { timeout: 15000 }).catch(() => 0);
  }
  /* i caratteri devono esserci (altrimenti la riga è scritta con un carattere di riserva e il confronto non vale) */
  const fontsOk = await page.waitForFunction(() => document.fonts.check('500 26px "Geist Mono"') && document.fonts.check("800 40px Manrope"), null, { timeout: 15000 }).then(() => true, () => false);
  if (!fontsOk) errs.push("caratteri non arrivati");
  const out = await page.evaluate((list) => {
    const N = window.__ni, cv = document.getElementById("ni"), c = cv.getContext("2d");
    document.documentElement.classList.remove("ni-on"); N.seek(0);   /* di nuovo setup(): ora che i caratteri ci sono, le misure delle lettere sono quelle vere */
    const T = N.T, end = T.end;
    const h = (d) => { let x = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 3) { x ^= d[i]; x = Math.imul(x, 16777619) >>> 0; } return x.toString(16); };
    const dom = () => { const hero = document.getElementById("hero"), w = document.querySelector(".hero__word"), chars = w ? Array.from(w.querySelectorAll(".ch")).map((s) => s.style.display).join("") : "", cur = w && w.querySelector(".cur"); return [document.documentElement.className.replace(/\s+/g, " ").trim(), document.documentElement.getAttribute("data-ni"), hero && hero.style.opacity, hero && hero.style.transform, chars, cur && cur.style.opacity, Array.from(document.querySelectorAll("[data-tile]")).map((e) => e.style.opacity).join(",")].join("|"); };
    const r = [];
    for (const ms of list.concat([end - 1])) { N.seek(ms); r.push({ ms, px: h(c.getImageData(0, 0, cv.width, cv.height).data), dom: dom() }); }
    return { r, end, version: N.version };
  }, MS);
  await ctx.close();
  return { out, errs };
}
(async () => {
  const browser = await chromium.launch(); let bad = 0;
  for (const v of VS) {
    const a = await shoot(browser, v, false), b = await shoot(browser, v, true);
    const diff = a.out.r.filter((x, i) => x.px !== b.out.r[i].px || x.dom !== b.out.r[i].dom).map((x) => x.ms);
    bad += diff.length;
    console.log(`${v} ${W}x${H}@${DPR} primo=${PRIMO}: ${a.out.r.length} istanti, fine ${a.out.end} / ${b.out.end}, diversi: ${diff.length ? diff.join(", ") : "nessuno"}`, a.errs.concat(b.errs).length ? "ERRORI " + a.errs.concat(b.errs).join(" | ") : "");
  }
  await browser.close(); process.exit(bad ? 1 : 0);
})();
