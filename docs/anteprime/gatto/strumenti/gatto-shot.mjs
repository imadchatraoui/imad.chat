// node gatto-shot.mjs <out-prefix> "<s,s,...>" [w h] : serve public/ e scatta a istanti dati (secondi dall'avvio)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/home/user/imad.chat/"); const { chromium } = require("playwright");
const [out = "g", list = "1", w = "390", h = "844", extra = ""] = process.argv.slice(2);
const dir = "/home/user/imad.chat/public";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 700, hasTouch: +w < 700 });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
await page.goto(base + "gatto/", { waitUntil: "load" });
await page.waitForFunction(() => !!window.__gatto, null, { timeout: 15000 }).catch((e) => errs.push("ready: " + e.message.split("\n")[0]));
const start = Date.now();
if (extra) await page.evaluate(extra);
for (const s of list.split(",").map(Number)) {
  const wait = s * 1000 - (Date.now() - start); if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}-${String(Math.round(s * 10)).padStart(4, "0")}.png`, clip: { x: 0, y: 0, width: +w, height: Math.min(+h, 470) } });
}
console.log("stato", await page.evaluate(() => JSON.stringify({ s: window.__gatto.cat.state, x: Math.round(window.__gatto.cat.x), y: Math.round(window.__gatto.cat.y) })));
if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
