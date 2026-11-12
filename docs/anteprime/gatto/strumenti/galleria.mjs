// Galleria di Dot: dodici scene grandi (con gli oggetti e nelle pose migliori) sulla pagina dell'anteprima (index.html), in un solo PNG.
// Uso:  node docs/anteprime/gatto/strumenti/galleria.mjs <uscita.png> [aspetto=adesivo] [tema=scuro|chiaro] [candidati]
//   con «candidati» fa un foglio per scena con più istanti (per scegliere i tempi), accanto all'uscita: <uscita>-<scena>.png
//   un quinto argomento (es. "slide,long") limita le scene
// Orologio fermo (?manual=1, seme fisso), Dot alla grandezza vera del telefono, finestra 390 px fotografata a 4x (DOT.photoDpr).
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, ".."), root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "package.json")); const { chromium } = require("playwright");
const [out = "galleria.png", look = "adesivo", tema = "scuro", mode = "", only = ""] = process.argv.slice(2);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".mp3": "audio/mpeg", ".m4a": "audio/mp4" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(+(process.env.PORT || 0), "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;

/* le scene: js prepara (D = DOT.debug, P = i bordi, T = i riquadri liberi, L = l'ultimo riquadro); t = istante della foto; c = istanti candidati */
const top0 = `D.place(P[0].a + 70, 0); D.tick(0.6);`;
const SC = [
  { id: "tea", tit: "Il tè alla menta", js: top0 + `D.set("tea", { side: 1, face: "view", pose: "sit" });`, t: 3.0, c: [2.2, 3.0, 3.8, 4.6] },
  { id: "cube", tit: "Il cubo di Imad", js: top0 + `D.set("cube", { side: 1, face: "side", pose: "sit" });`, t: 1.2, c: [1.2, 2.0, 2.8, 3.6] },
  { id: "yarn", tit: "Il gomitolo", js: `D.place(P[0].a + 40, 0); D.tick(0.6); D.set("yarn", { side: 1, face: "side", pose: "sit" });`, t: 1.8, c: [0.7, 1.2, 1.8, 2.6] },
  { id: "star", tit: "La stella", js: top0 + `D.set("star", { side: 1, face: "view", pose: "sit" });`, t: 1.4, c: [1.4, 2.6, 3.8, 5.0] },
  { id: "laptop", tit: "Il portatile", js: top0 + `D.set("laptop", { side: 1, face: "view", pose: "sit" });`, t: 3.0, c: [2.0, 3.0, 4.2, 5.4] },
  { id: "peek", tit: "Spunta dal bordo", js: top0 + `D.set("peek", { p: D.platsRaw()[0], x: P[0].a + 70 });`, t: 0.9, c: [0.5, 0.9, 1.3, 1.8] },
  { id: "drape", tit: "A cavallo del bordo", js: top0 + `D.set("drape", { dur: 9, face: "side", pose: "loaf" });`, t: 2.6, c: [1.6, 2.6, 3.6, 4.6] },
  { id: "hang", tit: "Appeso", js: top0 + `D.dragTo((L.l + L.r) / 2, L.b + 8); D.tick(0.6); D.drop(0, 0);`, t: 0.9, c: [0.4, 0.9, 1.4, 2.0] },
  { id: "slide", tit: "Scivola e graffia", js: top0 + `var t = T[5];   /* «Progetti»: sotto non c è il Corano, quindi scivola fino in fondo */ D.dragTo((t.l + t.r) / 2, t.t + (t.b - t.t) * 0.3); D.tick(0.5); D.drop(0, 0);`, t: 0.5, c: [0.25, 0.5, 0.75, 1.0] },
  { id: "long", tit: "Il gatto lungo", js: top0 + `var t = T[1]; D.dragTo((t.l + t.r) / 2, t.t + 34); D.tick(0.3);`, t: 0.6, c: [0.3, 0.6, 1.0, 1.5] },
  { id: "sleep", tit: "Dorme, il fez di traverso", js: top0 + `D.set("sleep", { dur: 99, face: "view", pose: "loaf" });`, t: 3.0, c: [2.0, 3.0, 4.0, 5.0] },
  { id: "sulk", tit: "Offeso, di spalle", js: top0 + `D.set("sulk", { face: "back", pose: "annoyed", dur: 9 });`, t: 1.2, c: [0.6, 1.2, 2.0, 2.8] }
];
const W = 176, H = 148, DPR = 4;   /* la foto di ogni scena, px CSS, e quanti pixel per px */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR });
await ctx.addInitScript((d) => { window.DOT = { photoDpr: d, stageDpr: d }; }, DPR);
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 300)); });
async function shoot(sc, t) {
  await page.goto(`${base}index.html?manual=1&seme=7&primo=0&look=${look}&tema=${tema}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.evaluate(() => { document.querySelector(".barra").style.display = "none"; document.querySelector(".prova").style.visibility = "hidden"; document.querySelector(".tag").style.visibility = "hidden"; document.querySelector(".marchio i").style.animation = "none"; });
  await page.evaluate(`(function () { var D = DOT.debug, P = D.plats(), T = D.tiles().filter(function (t) { return !t.mode; }), L = T[T.length - 1]; D.tick(0.05); ${sc.js} })()`);
  await page.evaluate((t) => DOT.debug.tick(t), t);
  const b = await page.evaluate(() => DOT.debug.bbox());
  const cx = b ? (b.x0 + b.x1) / 2 : 195, cy = b ? (b.y0 + b.y1) / 2 : 300;
  const ph = await page.evaluate(() => document.documentElement.scrollHeight);
  const clip = { x: Math.max(0, Math.min(390 - W, Math.round(cx - W / 2))), y: Math.max(0, Math.min(ph - H, Math.round(cy - H / 2 + 10))), width: W, height: H };
  return page.screenshot({ clip, fullPage: true });
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "galleria-"));
const py = `import sys, json
from PIL import Image, ImageDraw, ImageFont
fs = json.loads(sys.argv[1]); labels = json.loads(sys.argv[2]); out = sys.argv[3]; cols = int(sys.argv[4]); light = sys.argv[5] == "chiaro"
ims = [Image.open(f).convert("RGB") for f in fs]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols; g = 20; cap = 64
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
except Exception: font = ImageFont.load_default()
bg = (236, 236, 244) if light else (8, 9, 20); ink = (40, 42, 60) if light else (215, 218, 236)
sheet = Image.new("RGB", (cols * w + (cols + 1) * g, rows * (h + cap) + g), bg); d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x = g + (i % cols) * (w + g); y = g + (i // cols) * (h + cap)
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), 40, fill=255); sheet.paste(im, (x, y), m)
    d.text((x + 10, y + h + 14), labels[i], fill=ink, font=font)
sheet.save(out)
`;
fs.writeFileSync(path.join(tmp, "unisci.py"), py);
const join = (files, labels, o, cols) => execFileSync("python3", ["-I", path.join(tmp, "unisci.py"), JSON.stringify(files), JSON.stringify(labels), o, String(cols), tema]);
if (mode === "candidati") {
  for (const sc of SC.filter((x) => !only || only.split(",").indexOf(x.id) >= 0)) {
    const files = [];
    for (const [i, t] of sc.c.entries()) { const f = path.join(tmp, `${sc.id}-${i}.png`); fs.writeFileSync(f, await shoot(sc, t)); files.push(f); }
    const o = out.replace(/\.png$/, "") + "-" + sc.id + ".png"; join(files, sc.c.map((t) => sc.tit + " · " + t + " s"), o, 4); console.log("salvata", o);
  }
} else {
  const files = [];
  for (const sc of SC) { const f = path.join(tmp, `${sc.id}.png`); fs.writeFileSync(f, await shoot(sc, sc.t)); files.push(f); }
  join(files, SC.map((s) => s.tit), out, 4); console.log("salvata", out);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
