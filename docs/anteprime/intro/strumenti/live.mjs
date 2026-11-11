// Riproduzione dal vivo (non a passi): errori, durata, fotogrammi contati, stato finale.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(); const out = [];
for (const v of ["stella", "cursore"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true, locale: "it-IT" });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  await page.addInitScript(() => { window.__frames = 0; window.__long = 0; let last = 0; const tick = (n) => { if (last && !window.__niDone) { window.__frames++; if (n - last > 34) window.__long++; } last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const t0 = Date.now(); await page.goto(`${base}intro/index.html?v=${v}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__niDone === true, null, { timeout: 30000 }).catch((e) => errs.push("non finisce: " + e.message.split("\n")[0]));
  const ms = Date.now() - t0;
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({ frames: window.__frames, long: window.__long, cls: document.documentElement.className, word: document.querySelector(".hero__word").innerText, cur: getComputedStyle(document.querySelector(".hero__word .cur")).animationName, nbar: getComputedStyle(document.querySelector("#nbar")).opacity, tiles: [...document.querySelectorAll(".tile")].map((e) => getComputedStyle(e).opacity).join(","), canvas: getComputedStyle(document.querySelector("#ni")).display, scrollW: document.documentElement.scrollWidth, wordW: Math.round(document.querySelector(".hero__word").getBoundingClientRect().right), heroR: Math.round(document.querySelector("#hero").getBoundingClientRect().right) }));
  // rivedi + cambio versione dalla barra
  await page.locator("#nbarPlay").click(); await page.waitForTimeout(400);
  const replay = await page.evaluate(() => document.documentElement.classList.contains("ni-on"));
  await page.waitForFunction(() => window.__niDone === true, null, { timeout: 30000 }).catch(() => errs.push("il rivedi non finisce"));
  // un riquadro si apre dopo l'intro?
  await page.locator('[data-open="citta"]').first().click(); await page.waitForTimeout(900);
  const sheet = await page.evaluate(() => !document.querySelector("#sheet").hidden);
  out.push({ v, ms, ...st, replay, sheet, errs });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await browser.close(); server.close();
