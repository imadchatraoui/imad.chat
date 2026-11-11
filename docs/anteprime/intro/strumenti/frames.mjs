// Fotogrammi dell'intro a istanti scelti: node frames.mjs <versione> <out-prefix> "<ms,ms,...>" [w h dpr theme]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const [ver = "stella", out = "f", list = "0", w = "390", h = "844", dpr = "1", theme = "dark"] = process.argv.slice(2);
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, colorScheme: theme, isMobile: +w < 700, hasTouch: +w < 700, locale: "it-IT" });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
await page.goto(`${base}intro/index.html?seek=1&shot=1&v=${ver}&theme=${theme}&t=2026-11-11T15:50:00Z`, { waitUntil: "load" });
await page.waitForFunction(() => window.__niReady === true && window.__ready === true, null, { timeout: 20000 }).catch((e) => errs.push("ready: " + e.message.split("\n")[0]));
const T = await page.evaluate(() => JSON.stringify(window.__ni && window.__ni.T));
const times = list === "auto" ? null : list.split(",").map(Number);
const made = [];
for (const ms of times) {
  const t0 = Date.now(); await page.evaluate((m) => window.__ni.seek(m), ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  const f = `${out}-${String(ms).padStart(5, "0")}.png`; await page.screenshot({ path: f }); made.push(f);
}
console.log("T", T); console.log("fatti", made.length); if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
