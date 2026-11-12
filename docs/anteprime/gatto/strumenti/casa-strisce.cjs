// Strisce di Dot sulla casa nuova, con l'orologio di Dot fermo (window.__manual) e mosso a mano: N fotogrammi in fila in un PNG.
// Con servi.mjs acceso:  node docs/anteprime/gatto/strumenti/casa-strisce.cjs <uscita.png> <scena> [--port 4121] [--w 390] [--h 844] [--dsf 2]
//   [--n 14] [--tema scuro|chiaro] [--scala 0.5] [--da s --per s (dockup)] [--crop dock (sale)] [--f progetti (filtro)]   (PIL per comporre)
// scene: dockup (spunta dal dock) · casa (dal dock a casa quando si torna in cima) · groppa (sul dock mentre la pagina scorre)
//        sale (seduto su un bordo, si scorre in su: sale sul dock) · logo (dal dock al logo del fondo) · filtro (tocca un filtro: guarda giù)
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const out = process.argv[2], scene = process.argv[3];
const A = {}; for (let i = 4; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const PORT = +(A.port || 4121), W = +(A.w || 390), H = +(A.h || 844), DSF = +(A.dsf || 2), N = +(A.n || 14), TEMA = A.tema || "scuro", SC = +(A.scala || 0.5);
const tmp = path.join(path.dirname(out), "_f-" + scene); fs.mkdirSync(tmp, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: W < 700, hasTouch: W < 700, colorScheme: TEMA === "chiaro" ? "light" : "dark" });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__manual = true; });
  await p.goto(`http://127.0.0.1:${PORT}/casa/home/index.html?primo=0&seme=5`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__dot === true, null, { timeout: 60000, polling: 250 });
  await p.waitForTimeout(900);
  const tick = (s) => p.evaluate((s) => DOT.debug.tick(s), s);
  const st = () => p.evaluate(() => { var D = DOT.debug; return { s: D.cat.state, vis: D.cat.vis, x: D.cat.x, y: D.cat.y - scrollY, r: D.riding(), dock: D.dock() }; });
  const frames = []; let crop = null;
  async function snap(label) {
    const f = path.join(tmp, String(frames.length).padStart(3, "0") + ".png");
    await p.screenshot({ path: f, clip: crop || undefined }); frames.push({ f, label });
  }
  // prepara: Dot sul dock, seduto, la pagina scorsa in giù
  async function onDock(y) { await p.evaluate((y) => window.scrollTo(0, y), y); await tick(0.3); await p.evaluate(() => DOT.debug.dockup()); for (let i = 0; i < 40; i++) { await tick(0.1); const s = await st(); if (s.r && s.s === "sit") break; } }
  const dk = async () => (await st()).dock;
  if (scene === "dockup") {
    await p.evaluate(() => window.scrollTo(0, 900)); await tick(0.3);
    const d = await dk(); const x = Math.round((d.a + d.b) / 2 + 60);
    crop = { x: Math.max(0, x - 60), y: d.tile.t - 900 - 100, width: 120, height: 120 };
    await p.evaluate((x) => DOT.debug.dockup(x), x);
    const da = +(A.da || 0), per = +(A.per || 2.2); if (da) await tick(da);
    for (let i = 0; i < N; i++) { await snap((da + i * per / (N - 1)).toFixed(2) + "s " + (await st()).s); await tick(per / (N - 1)); }
  } else if (scene === "casa") {
    await onDock(900); await tick(1.5);
    await p.evaluate(() => window.scrollTo(0, 0)); await tick(0.05);
    for (let i = 0; i < N; i++) { await snap((i * 6.5 / (N - 1)).toFixed(1) + "s " + (await st()).s); await tick(6.5 / (N - 1)); }
  } else if (scene === "groppa") {
    await onDock(700); await tick(1.2);
    let y = 700;
    for (let i = 0; i < N; i++) { await snap("y" + y + " " + (await st()).s); for (let j = 0; j < 6; j++) { y += i < N / 2 ? 14 : -10; await p.evaluate((y) => window.scrollTo(0, y), y); await tick(1 / 60); } }
  } else if (scene === "sale") {
    // un bordo libero: il primo bordo buono sotto la metà dello schermo; Dot ci sta seduto, poi si scorre in su finché il bordo arriva al dock
    await p.evaluate(() => window.scrollTo(0, 1500)); await tick(0.3);
    const q = await p.evaluate(() => { var P = DOT.debug.plats(), d = DOT.debug.dock(), i, best = -1; for (i = 0; i < P.length; i++) { if (P[i].quiet) continue; if (P[i].a > d.b || P[i].b < d.a) continue; if (best < 0 || Math.abs(P[i].y - 1500 - 420) < Math.abs(P[best].y - 1500 - 420)) best = i; } return best; });
    const P = await p.evaluate((i) => DOT.debug.plats()[i], q);
    await p.evaluate(({ x, i }) => { DOT.debug.place(x, i); DOT.debug.cat.vis = true; }, { x: Math.round(Math.max(P.a + 20, Math.min(P.b - 20, (P.a + P.b) / 2))), i: q });
    let y = Math.round(P.y - 520); await p.evaluate((y) => window.scrollTo(0, y), y); await tick(0.6);
    const d = await dk(); if (A.crop === "dock") crop = { x: 0, y: Math.round(d.tile.t - y) - 170, width: W, height: 230 };
    const target = Math.round(P.y - (d.tile.t - y) - 60);   // dove il bordo passa 60 px sotto la cima del dock
    const steps = N * 4; const y0 = y;
    for (let i = 0; i < steps; i++) { if (i % 4 === 0) await snap("y" + y + " " + (await st()).s + ((await st()).r ? " ⋅dock" : "")); y = Math.round(y0 + (target - y0) * (i + 1) / steps); await p.evaluate((y) => window.scrollTo(0, y), y); await tick(1 / 30); }
  } else if (scene === "logo") {
    await onDock(99999); await tick(0.5);
    await p.evaluate(() => { DOT.debug.cat.state = "sit"; });
    for (let i = 0; i < N; i++) { await snap((i * 12 / (N - 1)).toFixed(1) + "s " + (await st()).s); await tick(12 / (N - 1)); }
  } else if (scene === "filtro") {
    await onDock(700); await tick(1.2);
    const d = await dk(); crop = { x: Math.round(d.tile.l) - 6, y: Math.round(d.tile.t - 700) - 100, width: Math.round(d.tile.r - d.tile.l) + 12, height: 160 };
    await snap("prima");
    await p.evaluate((f) => { var b = document.querySelector('.dock__b[data-filtro="' + f + '"]'); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }, A.f || "progetti");   /* solo il dito che tocca: la reazione di Dot, senza che la pagina si sposti */
    for (let i = 1; i < N; i++) { await tick(1.6 / (N - 1)); await snap((i * 1.6 / (N - 1)).toFixed(2) + "s"); }
  }
  console.log(JSON.stringify(await st()), errs);
  await b.close();
  // in fila, con l'etichetta sotto (PIL)
  fs.writeFileSync(tmp + "/list.json", JSON.stringify(frames));
  execFileSync("python3", ["-I", "-c", `
import json,sys
from PIL import Image, ImageDraw
fr=json.load(open(sys.argv[1])); sc=float(sys.argv[3]); ims=[]
for f in fr:
    im=Image.open(f["f"]).convert("RGB")
    if sc!=1: im=im.resize((max(1,int(im.width*sc)),max(1,int(im.height*sc))), Image.LANCZOS)
    ims.append((im,f["label"]))
w=sum(i.width for i,_ in ims)+4*(len(ims)-1); h=max(i.height for i,_ in ims)+18
o=Image.new("RGB",(w,h),(20,20,24)); d=ImageDraw.Draw(o); x=0
for im,l in ims:
    o.paste(im,(x,0)); d.text((x+3,im.height+3),l,fill=(230,230,230)); x+=im.width+4
o.save(sys.argv[2])
`, tmp + "/list.json", out, String(scene === "dockup" || scene === "filtro" ? 1 : SC)]);
  console.log("ok", out);
})();
