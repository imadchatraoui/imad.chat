// Fotografa un'anteprima (cartella con index.html) su telefono e computer, in chiaro e in scuro.
// Uso:  node shared/capture.mjs <cartella-variante> [--t 2026-11-11T15:50:00Z] [--only home|stati|intro|desktop] [--out shots]
//       node docs/anteprime/shared/capture.mjs <cartella-dove-salvare> --base http://localhost:3000 [...]   (il sito vero, in esecuzione)
// Contratto con la pagina (parametri in querystring):
//   shot=1            nasconde la barra "anteprima", salta l'intro, ferma le animazioni continue sullo stato finale
//   theme=light|dark  forza il tema (oltre a prefers-color-scheme, che viene comunque emulato)
//   t=<ISO>           congela "adesso" a quell'istante
//   open=<id>         apre a tutto schermo il riquadro <id> (citta, saluti, corano, ...)
//   intro=1           fa partire l'intro (anche con shot=1)
// La pagina può impostare window.__ready = true quando è assestata.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : ""; // sito in esecuzione: niente server statico; <cartella> è solo dove salvare
const dir = path.resolve(args[0] && !args[0].startsWith("--") ? args[0] : ".");
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const T = opt("--t", "2026-11-11T15:50:00Z");
const only = opt("--only", "");
const outDir = path.join(dir, opt("--out", "shots"));
const states = opt("--open", "citta,saluti,corano").split(",").filter(Boolean);
fs.mkdirSync(outDir, { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(dir, rel);
  if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
if (!BASE) await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = BASE ? BASE.replace(/\/?$/, "/") : `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const problems = [];
const made = [];

async function shoot({ name, width, height, scale, theme, query = "", fullPage = false, waitMs = 700, mobile = true }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: theme, isMobile: mobile, hasTouch: mobile,
    reducedMotion: "no-preference", locale: "it-IT", timezoneId: "Europe/Rome" });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`${name}: errore pagina: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${name}: console: ${m.text().slice(0, 200)}`); });
  page.on("requestfailed", (r) => problems.push(`${name}: richiesta fallita: ${r.url().slice(0, 120)}`));
  const url = `${base}?shot=1&theme=${theme}&t=${encodeURIComponent(T)}${query}`;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(waitMs);
    const file = path.join(outDir, name + ".png");
    await page.screenshot({ path: file, fullPage, timeout: 60000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) problems.push(`${name}: la pagina scorre in orizzontale di ${overflow}px`);
    made.push(path.relative(dir, file));
  } catch (e) {
    problems.push(`${name}: ${String(e.message || e).split("\n")[0]}`);
  }
  await context.close();
}

async function intro(theme) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, isMobile: true, hasTouch: true, locale: "it-IT", timezoneId: "Europe/Rome" });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`intro-${theme}: errore pagina: ${e.message}`));
  try {
    await page.goto(`${base}?shot=1&intro=1&theme=${theme}&t=${encodeURIComponent(T)}`, { waitUntil: "load", timeout: 45000 });
    const start = Date.now();
    const marks = [500, 1400, 2300, 3200, 4200, 5600, 7500];
    for (let i = 0; i < marks.length; i++) {
      const wait = marks[i] - (Date.now() - start);
      if (wait > 0) await page.waitForTimeout(wait);
      const file = path.join(outDir, `intro-${theme}-${i + 1}.png`);
      await page.screenshot({ path: file, timeout: 60000 });
      made.push(path.relative(dir, file));
    }
  } catch (e) {
    problems.push(`intro-${theme}: ${String(e.message || e).split("\n")[0]}`);
  }
  await context.close();
}

for (const theme of ["light", "dark"]) {
  if (!only || only === "home") {
    await shoot({ name: `phone-${theme}`, width: 390, height: 844, scale: 2, theme });
    await shoot({ name: `phone-${theme}-full`, width: 390, height: 844, scale: 2, theme, fullPage: true });
  }
  if (!only || only === "stati") {
    for (const s of states) await shoot({ name: `phone-${theme}-${s}`, width: 390, height: 844, scale: 2, theme, query: `&open=${s}`, waitMs: 1200 });
  }
  if (!only || only === "desktop") {
    await shoot({ name: `desktop-${theme}`, width: 1440, height: 900, scale: 1, theme, fullPage: true, mobile: false });
  }
}
if (!only || only === "home") {
  await shoot({ name: "small-dark", width: 360, height: 740, scale: 2, theme: "dark" });
  await shoot({ name: "large-light", width: 430, height: 932, scale: 2, theme: "light" });
  await shoot({ name: "tablet-dark", width: 820, height: 1180, scale: 1, theme: "dark", fullPage: true });
}
if (!only || only === "intro") { await intro("dark"); await intro("light"); }

await browser.close();
if (!BASE) server.close();
console.log("fatte:", made.length, "immagini in", outDir);
for (const m of made) console.log("  " + m);
if (problems.length) { console.log("\nPROBLEMI:"); for (const p of [...new Set(problems)]) console.log("  - " + p); process.exitCode = 2; }
else console.log("nessun errore di pagina, nessuno scorrimento orizzontale");
