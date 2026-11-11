// Stampa tutto il testo che un visitatore può leggere in un'anteprima: la home e ogni pagina aperta.
// Serve a rileggere le parole prima di mostrarle (niente fatti inventati, niente dati personali, niente arabo scritto a mano).
// Uso: node shared/testo.mjs <cartella> [--t 2026-11-11T15:50:00Z] [--theme dark]
//      node docs/anteprime/shared/testo.mjs --base http://localhost:3000   (il sito vero, in esecuzione)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : ""; // sito in esecuzione
const dir = path.resolve(args[0] && !args[0].startsWith("--") ? args[0] : ".");
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const T = opt("--t", "2026-11-11T15:50:00Z");
const theme = opt("--theme", "dark");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => {
  let file = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
if (!BASE) await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = BASE ? BASE.replace(/\/?$/, "/") : `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme, locale: "it-IT" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const ready = async () => { await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(500); };
const clean = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");

await page.goto(`${base}?shot=1&theme=${theme}&t=${encodeURIComponent(T)}`, { waitUntil: "load" });
await ready();
const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll("[data-open]")].map((b) => b.getAttribute("data-open")))]);
console.log("===== HOME =====");
console.log(clean(await page.evaluate(() => document.querySelector("main").innerText)));
console.log("\n===== etichette per chi non vede (aria-label) =====");
console.log((await page.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")))).join("\n"));
for (const id of ids) {
  await page.goto(`${base}?shot=1&theme=${theme}&t=${encodeURIComponent(T)}&open=${id}`, { waitUntil: "load" });
  await ready();
  const txt = await page.evaluate(() => { const s = document.querySelector("#sheet"); return s && !s.hidden ? s.innerText : "(non si è aperta)"; });
  console.log(`\n===== PAGINA APERTA: ${id} =====`);
  console.log(clean(txt));
}
if (errors.length) { console.log("\n===== ERRORI ====="); console.log([...new Set(errors)].join("\n")); }
await browser.close();
if (!BASE) server.close();
