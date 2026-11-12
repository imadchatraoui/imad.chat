// Fotografa la tavola delle pose (tavola.html) o una pagina qualsiasi di questa cartella.
// Uso:  node docs/anteprime/gatto/strumenti/tavola.mjs <uscita.png> "<query>" [larghezza] [pagina]
//   es. node .../tavola.mjs scuro.png ""            node .../tavola.mjs passo.png "striscia=walk&n=12&cols=12"
//       node .../tavola.mjs chiaro.png "bg=light"    node .../tavola.mjs una.png "pose=sit,peek&k=5&cols=2"
// Serve la cartella docs/anteprime/gatto con un piccolo server, apre la pagina in Chromium senza finestra e salva tutta la pagina.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, ".."), root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "package.json")); const { chromium } = require("playwright");
const [out = "tavola.png", query = "", width = "920", pageName = "tavola.html"] = process.argv.slice(2);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(+(process.env.PORT || 0), "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +width, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errs.push("console: " + m.text().slice(0, 300)); });
await page.goto(`${base}${pageName}?${query}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch((e) => errs.push("ready: " + e.message.split("\n")[0]));
await page.screenshot({ path: out, fullPage: true });
console.log("salvata", out); if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
