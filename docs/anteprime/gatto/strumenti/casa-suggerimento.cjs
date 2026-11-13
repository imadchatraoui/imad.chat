// Strisce del suggerimento (CASA.md 2c C) sulla casa nuova: il dito fantasma, Dot che bussa, il dito vicino, la zampata.
// L'orologio di Dot è fermo (window.__manual) e va avanti a mano: un fotogramma ogni --passo secondi (0.05 = 50 ms), ritagliato attorno a Dot.
// Con servi.mjs acceso:  node docs/anteprime/gatto/strumenti/casa-suggerimento.cjs <uscita.png> <scena> [--port 4121] [--w 390] [--h 844]
//   [--dsf 2] [--tema scuro|chiaro] [--passo 0.05] [--per 2.9] [--cols 15] [--seme 5]
// scene: dito (sulla mensola di casa) · dito-dock (in groppa al dock) · bussa · bussa-dock · vicino (il puntatore si avvicina) · zampata
// Scrive il PNG (strisce di fotogrammi con il tempo, la fase e lo stato sotto ciascuno) e <uscita>.json (i numeri di ogni fotogramma).
// Ha bisogno di Python con PIL per comporre le strisce.
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const out = process.argv[2], scene = process.argv[3] || "dito";
const A = {}; for (let i = 4; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const PORT = +(A.port || 4121), W = +(A.w || 390), H = +(A.h || 844), DSF = +(A.dsf || 2), TEMA = A.tema || "scuro";
const PASSO = +(A.passo || 0.05), COLS = +(A.cols || 15), SEME = +(A.seme || 5);
const PER = +(A.per || ({ dito: 2.9, "dito-dock": 2.9, bussa: 4.6, "bussa-dock": 4.6, vicino: 2.4, zampata: 1.6 }[scene] || 2.9));
const tmp = path.join(path.dirname(path.resolve(out)), "_f-" + path.basename(out, ".png")); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, colorScheme: TEMA === "chiaro" ? "light" : "dark" });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.addInitScript(() => { window.__manual = true; try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await p.goto(`http://127.0.0.1:${PORT}/casa/home/index.html?primo=0&seme=${SEME}`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__dot === true, null, { timeout: 60000, polling: 250 });
  await p.waitForTimeout(700);
  const tick = (s) => p.evaluate((s) => DOT.debug.tick(s), s);
  const st = () => p.evaluate(() => { var D = DOT.debug, h = D.hint(), bb = D.bbox(); return { s: D.cat.state, st: D.cat.st, x: D.cat.x, y: D.cat.y, sy: scrollY, vis: D.cat.vis, r: D.riding(), ph: h.ph, h: h, bb: bb }; });
  await tick(0.4);
  /* Dot seduto dove serve: sulla mensola di casa, o in groppa al dock */
  async function onLedge() {
    await p.evaluate(() => window.scrollTo(0, 0)); await tick(0.2);
    await p.evaluate(() => { var D = DOT.debug, c = D.choice(), P = D.plats(), i, bi = -1, bd = 1e9; if (!c) return; for (i = 0; i < P.length; i++) { var d = Math.abs(P[i].y - c.y) + (c.x < P[i].a || c.x > P[i].b ? 1e4 : 0); if (d < bd) { bd = d; bi = i; } } D.place(c.x, bi); D.cat.dir = -1; });
    await tick(1.0);
  }
  async function onDock() {
    await p.evaluate(() => window.scrollTo(0, 1400)); await tick(0.3); await p.evaluate(() => DOT.debug.dockup());
    for (let i = 0; i < 50; i++) { await tick(0.1); const s = await st(); if (s.r && s.s === "sit" && s.st > 0.5) break; }
    await p.evaluate(() => { var D = DOT.debug; D.set("sit", { dur: 1e9, face: "view", pose: "ride" }); }); await tick(0.8);
  }
  if (scene.indexOf("dock") >= 0) await onDock(); else await onLedge();
  const s0 = await st();
  const cx = Math.round(s0.x), cy = Math.round(s0.y - s0.sy);
  const crop = { x: Math.max(0, cx - 66), y: Math.max(0, cy - (scene.indexOf("bussa") === 0 ? 104 : 128)), width: 132, height: scene.indexOf("bussa") === 0 ? 122 : 146 };
  if (crop.x + crop.width > W) crop.x = W - crop.width;
  const frames = [];
  async function snap(t) { const f = path.join(tmp, String(frames.length).padStart(3, "0") + ".png");
    if (scene === "zampata") { const s1 = await st(); crop.y = Math.max(0, Math.round(s1.y - s1.sy) - 128); }   /* la pagina scorre: il ritaglio segue il gatto */
    await p.screenshot({ path: f, clip: crop }); const s = await st(); frames.push({ f, label: t.toFixed(2) + "s " + (s.ph || "") + " " + s.s, s }); }
  if (scene === "dito" || scene === "dito-dock") {
    const ok = await p.evaluate(() => DOT.debug.hintGo());
    if (!ok) throw new Error("hintGo: false");
  } else if (scene === "bussa" || scene === "bussa-dock") {
    await p.evaluate(() => DOT.debug.hintKnock());
  } else if (scene === "vicino") {
    /* il puntatore (mouse) arriva da destra e si ferma vicino alla testa */
    await p.mouse.move(Math.min(W - 4, cx + 170), cy - 120);
  } else if (scene === "zampata") {
    /* un puntatore fermo vicino alla testa mentre la pagina scorre (la rotella): il gatto gli passa accanto */
    await p.mouse.move(cx - 30, cy - 30);   /* davanti a Dot (seduto sulla mensola guarda a sinistra) */
  }
  const N = Math.round(PER / PASSO) + 1;
  let wy = await p.evaluate(() => scrollY);
  for (let i = 0; i < N; i++) {
    const t = i * PASSO;
    if (scene === "vicino") { const u = Math.min(1, t / 0.9), e = 1 - Math.pow(1 - u, 3); await p.mouse.move(cx + 170 - 150 * e, cy - 120 + 70 * e); }
    if (scene === "zampata" && t >= 0.1 && t < 0.2) { wy += 20; await p.evaluate((y) => window.scrollTo(0, y), wy); }
    await snap(t);
    await tick(PASSO);
  }
  fs.writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify(frames.map((f) => ({ label: f.label, s: f.s })), null, 0));
  const list = path.join(tmp, "list.json"); fs.writeFileSync(list, JSON.stringify(frames.map((f) => [f.f, f.label])));
  execFileSync("python3", ["-c", `
import json, sys
from PIL import Image, ImageDraw, ImageFont
L = json.load(open(sys.argv[1])); cols = int(sys.argv[3]); bg = sys.argv[4]
ims = [Image.open(f).convert("RGB") for f, _ in L]; w, h = ims[0].size; lab = 26
rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * (w + 4) + 4, rows * (h + lab + 4) + 4), (40, 40, 46) if bg == "scuro" else (205, 205, 210))
d = ImageDraw.Draw(S)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
except Exception: font = ImageFont.load_default()
for i, (im, (f, t)) in enumerate(zip(ims, L)):
    x = 4 + (i % cols) * (w + 4); y = 4 + (i // cols) * (h + lab + 4)
    S.paste(im, (x, y)); d.text((x + 3, y + h + 3), t[:34], fill=(235, 235, 240) if bg == "scuro" else (20, 20, 26), font=font)
S.save(sys.argv[2])
`, list, out, String(COLS), TEMA]);
  console.log(JSON.stringify({ out, frames: frames.length, crop, errs: errs.slice(0, 5) }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
