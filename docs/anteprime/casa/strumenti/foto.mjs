// Fotografie della casa nuova: telefono scuro e chiaro, telefono stretto (360), tablet, computer; schermo intero e solo il primo schermo.
// Con ?shot=1 la pagina salta l'intro e sta ferma (come al primo giro); Dot c'è, già in giro, con un seme fisso.
// Uso, dalla cartella del repository:
//   node docs/anteprime/casa/strumenti/foto.mjs <cartella-uscita> [--base <indirizzo della pagina>] [--t 2026-11-12T17:30:00Z]
//        [--solo telefono-scuro,tablet] [--filtro sudime] [--query "&open=saluti"] [--contributi f.json] [--progetti f.json] [--scala 1]
//        [--scorri] [--attesa 1400]
// --scorri: prima della foto intera la pagina scorre fino in fondo e torna su (così ogni riquadro che si accende quando entra in vista è disegnato).
// Con --base e --contributi/--progetti le due route di GitHub rispondono con quei file (per esempio le risposte salvate dal sito online).
// Senza --base accende servi.mjs su una porta libera e fotografa docs/anteprime/casa/home/index.html.
// Con --base fotografa una pagina che gira già (es. http://localhost:4121/anteprima, la build di Next).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { serve } from "./servi.mjs";
const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const out = path.resolve(args[0] && !args[0].startsWith("--") ? args[0] : "foto-casa");
fs.mkdirSync(out, { recursive: true });
const T = opt("--t") || "2026-11-12T17:30:00Z";
const SCALE = opt("--scala") ? +opt("--scala") : 1;
let srv = null, base = opt("--base");
if (!base) { srv = await serve({ port: 0, contributi: opt("--contributi"), progetti: opt("--progetti") }); base = srv.url + "/casa/home/index.html"; }

const VISTE = {
  "telefono-scuro": { w: 390, h: 844, theme: "dark", touch: true },
  "telefono-chiaro": { w: 390, h: 844, theme: "light", touch: true },
  "telefono-360": { w: 360, h: 780, theme: "dark", touch: true },
  "tablet": { w: 820, h: 1180, theme: "light", touch: true },
  "computer": { w: 1280, h: 800, theme: "dark", touch: false },
};
const solo = opt("--solo") ? opt("--solo").split(",") : Object.keys(VISTE);
const extra = (opt("--filtro") ? "&filtro=" + opt("--filtro") : "") + (opt("--query") || "");
const browser = await chromium.launch();
const errori = [];
for (const nome of solo) {
  const v = VISTE[nome]; if (!v) { console.log("vista sconosciuta:", nome); continue; }
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SCALE, hasTouch: v.touch, isMobile: v.touch, colorScheme: v.theme });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errori.push(`${nome}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errori.push(`${nome}: console: ${m.text()}`); });
  if (opt("--base") && opt("--contributi")) { const c = fs.readFileSync(opt("--contributi"), "utf8"); await page.route("**/api/github/contributi**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: c })); }
  if (opt("--base") && opt("--progetti")) { const p = fs.readFileSync(opt("--progetti"), "utf8"); await page.route("**/api/github/progetti**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: p })); }
  const sep = base.includes("?") ? "&" : "?";
  await page.goto(`${base}${sep}shot=1&theme=${v.theme}&t=${encodeURIComponent(T)}&seme=7${extra}`, { waitUntil: "load", timeout: 45000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => errori.push(`${nome}: __ready non arriva`));
  await page.waitForTimeout(+(opt("--attesa") || 1400));  // Dot si mette in posa, le tele disegnano lo stato fermo
  await page.screenshot({ path: path.join(out, `${nome}-schermo.png`) });
  if (args.includes("--scorri")) {
    await page.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y <= H; y += Math.round(innerHeight * 0.6)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 700)); } await new Promise((r) => setTimeout(r, 2500)); scrollTo(0, 0); });
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(out, `${nome}-pagina.png`), fullPage: true });
  console.log("fatta:", nome);
  await ctx.close();
}
await browser.close();
if (srv) await srv.close();
if (errori.length) { console.log("ERRORI:\n" + errori.join("\n")); process.exitCode = 1; }
console.log("fotografie in", out);
