// Strisce di movimento di Dot: apre prova.html con l'orologio fermo, esegue un'azione e mette N fotogrammi in fila in un PNG,
// con il tempo sotto ogni fotogramma. Serve a giudicare tempi, archi, piedi che non scivolano, niente scatti.
// Uso:  node docs/anteprime/gatto/strumenti/striscia.mjs <uscita.png> <scena> [n=14] [aspetto] [k=1.5]
//   scene: opening opening-keys walk turn jump tap-meow tap-fez wake-annoyed drag-drop-edge drag-drop-face hang peek-climb drape idle-bubble hop tea star cube cube-knock yarn laptop pet pounce hide
//   es. node .../striscia.mjs /tmp/walk.png walk 14 adesivo
// Due passate identiche (seme fisso): la prima trova il riquadro che il gatto occupa, la seconda fotografa.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, ".."), root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "package.json")); const { chromium } = require("playwright");
const [out = "striscia.png", scene = "walk", nArg = "14", lookArg = "", kArg = "1.5"] = process.argv.slice(2);
const N = +nArg;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(+(process.env.PORT || 0), "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;

/* le scene: setup (nella pagina, con D = DOT.debug e P = i bordi) restituisce { pre, T } (secondi: prima di cominciare, durata) */
const SCENES = {
  opening: { primo: 1, js: `return { pre: 3.45, T: 5.2 };` },
  "opening-keys": { primo: 1, js: `return { pre: 0.05, T: 3.4 };` },
  walk: { js: `D.place(P[0].a + 30, 0); D.tick(0.5); D.walkTo(P[0].a + 190); return { pre: 0.1, T: 2.6 };` },
  turn: { js: `D.place(P[0].a + 120, 0); D.set("pause", { pose: "stand", dur: 99, face: "side" }); D.cat.dir = 1; D.tick(0.8); D.at(0.15, function () { D.cat.dir = -1; }); return { pre: 0, T: 1.1 };` },
  jump: { js: `var i = P.findIndex(function (p) { return p.y > P[0].y + 20; }); D.place(P[i].a + 40, i); D.tick(0.6); D.jumpTo(0, P[0].a + 110); return { pre: 0, T: 1.3 };` },
  "tap-meow": { js: `D.place(P[0].a + 90, 0); D.tick(0.6); D.set("meow", { face: "view", pose: "sit" }); return { pre: 0, T: 1.2 };` },
  "tap-fez": { js: `D.place(P[0].a + 90, 0); D.tick(0.6); D.set("fezoff", { face: "view", pose: "sit" }); return { pre: 0, T: 6.0 };` },
  "wake-annoyed": { js: `D.place(P[0].a + 120, 0); D.set("sleep", { dur: 99, face: "view", pose: "loaf" }); D.tick(2.5); D.tap(); return { pre: 0, T: 3.4 };` },
  "drag-drop-edge": { js: `var x = P[0].a + 80; D.place(x, 0); D.tick(0.5); var y = P[0].y; var j = P.findIndex(function (p) { return p.y > P[0].y + 20; }), q = P[j];
    for (var i = 1; i <= 8; i++) (function (i) { D.at(i * 0.07, function () { D.dragTo(x + (q.a + 50 - x) * i / 8, y - 60 + (q.y - 40 - (y - 60)) * i / 8 - Math.sin(i / 8 * Math.PI) * 40); }); })(i);
    D.dragTo(x, y - 50); D.at(1.15, function () { D.drop(0, 40); }); return { pre: 0, T: 2.2 };` },
  "drag-drop-face": { js: `var x = P[0].a + 80; D.place(x, 0); D.tick(0.5); var T = D.tiles().filter(function (t) { return !t.mode; })[1];
    D.dragTo(x, P[0].y - 50); for (var i = 1; i <= 6; i++) (function (i) { D.at(i * 0.08, function () { D.dragTo(x + ((T.l + T.r) / 2 - x) * i / 6, P[0].y - 50 + (T.t + 40 - (P[0].y - 50)) * i / 6); }); })(i);
    D.at(0.9, function () { D.drop(0, 0); }); return { pre: 0.85, T: 2.6 };` },
  hang: { js: `var x = P[0].a + 80; D.place(x, 0); D.tick(0.5); var T = D.tiles().filter(function (t) { return !t.mode; })[1];
    D.dragTo((T.l + T.r) / 2, T.b + 8); D.tick(0.6); D.drop(0, 0); return { pre: 0, T: 3.2 };` },
  "peek-climb": { js: `D.place(P[0].a + 100, 0); D.set("peek", { p: D.platsRaw()[0], x: P[0].a + 100 }); return { pre: 0, T: 3.0 };` },
  drape: { js: `D.place(P[0].a + 100, 0); D.tick(0.4); D.set("drape", { dur: 3.2, face: "side", pose: "loaf" }); return { pre: 0, T: 4.4 };` },
  "idle-bubble": { js: `D.place(P[0].a + 100, 0); D.tick(0.5); D.idle(95); return { pre: 0, T: 1.4 };` },
  hop: { js: `D.place(P[0].a + 100, 0); D.tick(0.6); D.set("hop", { face: "view", pose: "crouch" }); return { pre: 0, T: 1.6 };` },
  tea: { js: `D.place(P[0].a + 80, 0); D.tick(0.6); D.set("tea", { side: 1, face: "view", pose: "sit" }); return { pre: 0, T: 7.6 };` },
  star: { js: `D.place(P[0].a + 110, 0); D.tick(0.6); D.set("star", { side: 1, face: "view", pose: "sit" }); return { pre: 0, T: 7.0 };` },
  cube: { js: `D.place(P[0].a + 90, 0); D.tick(0.6); D.set("cube", { side: 1, face: "side", pose: "sit" }); return { pre: 0, T: 5.0 };` },
  "cube-knock": { js: `var i = P.findIndex(function (p) { return p.y > P[0].y + 20; }); D.place(P[i].b - 4, i); D.tick(0.6); D.set("cube", { side: 1, knock: true, face: "side", pose: "sit" }); return { pre: 0, T: 4.4 };` },
  yarn: { js: `D.place(P[0].a + 60, 0); D.tick(0.6); D.set("yarn", { side: 1, face: "side", pose: "sit" }); return { pre: 0, T: 3.6 };` },
  laptop: { js: `D.place(P[0].a + 100, 0); D.tick(0.6); D.set("laptop", { side: 1, face: "view", pose: "sit" }); return { pre: 0, T: 6.4 };` },
  pet: { js: `D.place(P[0].a + 100, 0); D.tick(0.6); D.press(); D.at(6.3, function () { D.lift(); }); return { pre: 3.1, T: 5.6 };` },   /* un dito fermo: fusa, poi si scioglie; il dito se ne va: si alza stiracchiandosi */
  pounce: { js: `D.place(P[0].a + 50, 0); D.tick(0.6); D.set("pounce", { tx: P[0].a + 150, then: "sit" }); return { pre: 0, T: 2.0 };` },
  hide: { js: `D.place(D.box().x - 60, 0); D.tick(0.6); D.fedUp(); return { pre: 0, T: 6.0 };` },
  "tap-annoy": { js: `D.place(P[0].a + 120, 0); D.set("sulk", { face: "back", pose: "annoyed", dur: 6 }); return { pre: 0, T: 7.6 };` }
};
const S = SCENES[scene]; if (!S) { console.log("scena sconosciuta:", scene, "\nscene:", Object.keys(SCENES).join(" ")); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { sessionStorage.clear(); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 300)); });
const q = `manual=1&seme=7&k=${kArg}&primo=${S.primo ? 1 : 0}${lookArg ? "&look=" + lookArg : ""}`;
async function run(shoot, region) {
  await page.goto(`${base}prova.html?${q}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.evaluate(() => { document.querySelector(".bar").style.display = "none"; });
  const info = await page.evaluate(`(function () { var D = DOT.debug, P = D.plats(); D.tick(0.05); ${S.js} })()`);
  await page.evaluate((t) => DOT.debug.tick(t), info.pre || 1 / 60);
  const step = info.T / (N - 1), boxes = [], shots = [];
  for (let i = 0; i < N; i++) {
    if (i) await page.evaluate((t) => DOT.debug.tick(t), step);
    const st = await page.evaluate(() => { var D = DOT.debug, b = D.bbox(), s = D.state(); return { b: b, s: s }; });
    boxes.push(st);
    if (shoot) { const r = region(i, st); shots.push(await page.screenshot({ clip: r, fullPage: true })); }
  }
  return { info, boxes, shots, step };
}
const p1 = await run(false);
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
for (const { b, s } of p1.boxes) { if (!b || !s.vis) continue; x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
if (x0 > x1) { x0 = 100; x1 = 300; y0 = 100; y1 = 300; }
const pad = 26, W = Math.min(400, x1 - x0 + pad * 2), H = Math.min(420, Math.max(170, y1 - y0 + pad * 2 + 26)), follow = x1 - x0 + pad * 2 > 400;
const region = (i, st) => { let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - 8; if (follow && st.b) cx = (st.b.x0 + st.b.x1) / 2; return { x: Math.max(0, Math.round(cx - W / 2)), y: Math.max(0, Math.round(cy - H / 2)), width: Math.round(W), height: Math.round(H) }; };
const p2 = await run(true, region);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "striscia-")), files = [];
p2.shots.forEach((b, i) => { const f = path.join(tmp, `f${String(i).padStart(2, "0")}.png`); fs.writeFileSync(f, b); files.push(f); });
const labels = p2.boxes.map((b, i) => ((p2.info.pre || 0) + i * p2.step).toFixed(2) + " s · " + b.s.state);
const py = `import sys, json
from PIL import Image, ImageDraw, ImageFont
fs = json.loads(sys.argv[1]); labels = json.loads(sys.argv[2]); out = sys.argv[3]
ims = [Image.open(f).convert("RGB") for f in fs]; w, h = ims[0].size; cols = min(len(ims), 7); rows = (len(ims) + cols - 1) // cols
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
except Exception: font = ImageFont.load_default()
sheet = Image.new("RGB", (cols * w + (cols + 1) * 6, rows * (h + 34) + 6), (8, 9, 20)); d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x = 6 + (i % cols) * (w + 6); y = 6 + (i // cols) * (h + 34); sheet.paste(im, (x, y)); d.text((x + 8, y + h + 5), labels[i], fill=(200, 205, 230), font=font)
sheet.save(out)
`;
fs.writeFileSync(path.join(tmp, "unisci.py"), py);
execFileSync("python3", ["-I", path.join(tmp, "unisci.py"), JSON.stringify(files), JSON.stringify(labels), out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("salvata", out, `(${N} fotogrammi, ${W | 0}x${H | 0} px CSS ciascuno${follow ? ", segue il gatto" : ""})`);
if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
