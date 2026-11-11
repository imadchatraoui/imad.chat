// Compone i fogli di confronto di un'anteprima a partire dalle immagini in <cartella>/shots.
// Uso: node shared/sheet.mjs <cartella-variante> "<Nome della variante>" "<una riga di descrizione>"
// Scrive: <cartella>/sheet-home.jpg (telefono chiaro + scuro), sheet-dettagli.jpg (riquadri aperti + intro), sheet-desktop.jpg
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const dir = path.resolve(process.argv[2] || ".");
const title = process.argv[3] || path.basename(dir);
const sub = process.argv[4] || "";
const shots = path.join(dir, "shots");
const has = (n) => fs.existsSync(path.join(shots, n));
const src = (n) => pathToFileURL(path.join(shots, n)).href;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const css = `*{box-sizing:border-box}body{margin:0;background:#0c0c0e;color:#f5f5f7;font:500 26px/1.3 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:56px}
h1{font-size:54px;font-weight:700;letter-spacing:-0.03em;margin:0 0 6px}p.sub{margin:0 0 40px;color:#a1a1a6;font-size:28px;max-width:44em}
.row{display:flex;gap:44px;align-items:flex-start}.cell{display:flex;flex-direction:column;gap:16px}
.cap{color:#a1a1a6;font-size:24px;font-weight:600;letter-spacing:.02em}
.phone{width:390px;border-radius:44px;overflow:hidden;box-shadow:0 0 0 2px #2a2a2e,0 30px 80px rgba(0,0,0,.6);background:#000}
.phone img{display:block;width:390px}.phone.tall{max-height:1500px}.phone.tall img{object-fit:cover;object-position:top}
.desk{width:1100px;border-radius:18px;overflow:hidden;box-shadow:0 0 0 2px #2a2a2e,0 30px 80px rgba(0,0,0,.6)}.desk img{display:block;width:1100px}`;

async function render(name, body, width) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${body}`;
  const tmp = path.join(dir, `.sheet-${name}.html`);
  fs.writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const out = path.join(dir, `sheet-${name}.jpg`);
  await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 88 });
  await browser.close();
  fs.unlinkSync(tmp);
  console.log(out);
}

const cell = (file, cap, cls = "phone") => (has(file) ? `<div class="cell"><div class="${cls}"><img src="${src(file)}"></div><div class="cap">${esc(cap)}</div></div>` : "");

await render("home", `<div class="row">${cell("phone-light-full.png", "telefono, tema chiaro", "phone tall")}${cell("phone-dark-full.png", "telefono, tema scuro", "phone tall")}</div>`, 390 * 2 + 44 + 112);

const det = ["phone-dark-citta.png:città aperta, scuro", "phone-light-citta.png:città aperta, chiaro", "phone-dark-saluti.png:saluti aperti, scuro", "phone-light-corano.png:Corano aperto, chiaro",
  "intro-dark-2.png:intro, 1", "intro-dark-4.png:intro, 2", "intro-dark-6.png:intro, 3"].map((x) => x.split(":")).filter(([f]) => has(f));
if (det.length) {
  const rows = [];
  for (let i = 0; i < det.length; i += 4) rows.push(`<div class="row" style="margin-bottom:44px">${det.slice(i, i + 4).map(([f, c]) => cell(f, c)).join("")}</div>`);
  await render("dettagli", rows.join(""), 390 * Math.min(4, det.length) + 44 * (Math.min(4, det.length) - 1) + 112);
}
if (has("desktop-light.png") || has("desktop-dark.png")) {
  await render("desktop", `<div class="row" style="flex-direction:column">${cell("desktop-light.png", "computer, tema chiaro", "desk")}${cell("desktop-dark.png", "computer, tema scuro", "desk")}</div>`, 1100 + 112);
}
