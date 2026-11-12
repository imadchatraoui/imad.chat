// node gatto-ts.mjs <out-prefix> "<ts,ts,...>" : ferma l'apertura a istanti dati e ritaglia la zona della scena, ingrandita
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/home/user/imad.chat/"); const { chromium } = require("playwright");
const [out = "k", list = "1", clipS = "60,40,270,160"] = process.argv.slice(2); const [cx, cy, cw, ch] = clipS.split(",").map(Number);
const dir = "/home/user/imad.chat/public";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await page.goto(base + "gatto/", { waitUntil: "load" }); await page.waitForFunction(() => !!window.__gatto, null, { timeout: 15000 });
for (const s of list.split(",").map(Number)) {
  await page.evaluate((v) => { window.__ts = v; }, s); await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}-${String(Math.round(s * 100)).padStart(4, "0")}.png`, clip: { x: cx, y: cy, width: cw, height: ch } });
}
if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
