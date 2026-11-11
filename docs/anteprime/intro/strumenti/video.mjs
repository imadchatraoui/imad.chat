// Video dell'intro, fotogramma per fotogramma (60 al secondo, senza scatti): node video.mjs <versione> <cartella> [tema]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const [ver = "stella", outDir = "vid", theme = "dark"] = process.argv.slice(2);
const FPS = 60, TAIL = 1500, dir = "/home/user/imad.chat/docs/anteprime";
fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, isMobile: true, hasTouch: true, locale: "it-IT" });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`${base}intro/index.html?seek=1&shot=1&v=${ver}&theme=${theme}&t=2026-11-11T15:50:00Z`, { waitUntil: "load" });
await page.waitForFunction(() => window.__niReady === true && window.__ready === true, null, { timeout: 20000 });
const T = await page.evaluate(() => window.__ni.T);
const total = T.end + TAIL, n = Math.ceil(total / 1000 * FPS);
for (let i = 0; i < n; i++) {
  const ms = i * 1000 / FPS;
  await page.evaluate(([m, end, type1]) => {
    window.__ni.seek(Math.min(m, end - 0.01));
    if (m >= end) {            /* la coda: l'intro è finita, resta il cursore che lampeggia (calcolato, non a orologio) */
      const r = document.documentElement; r.classList.remove("ni-on", "is-locked"); r.classList.add("ni-done");
      document.querySelectorAll(".tile, .bar, .foot").forEach((e) => { e.style.opacity = ""; e.style.transform = ""; });
      const cur = document.querySelector(".hero__word .cur"), since = m - type1; cur.style.animation = "none"; cur.style.opacity = since < 320 || Math.floor((since - 320) / 530) % 2 === 1 ? "1" : "0";
      const dot = document.querySelector(".hero__word .dot"); if (dot) dot.style.animation = "none";
      document.getElementById("ni").style.display = "none";
    }
  }, [ms, T.end, T.type1]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await page.screenshot({ path: path.join(outDir, `f-${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 93 });
}
console.log(ver, "fotogrammi", n, "durata", (total / 1000).toFixed(2) + " s", errs.length ? "ERRORI " + errs.join(" | ") : "nessun errore");
await browser.close(); server.close();
