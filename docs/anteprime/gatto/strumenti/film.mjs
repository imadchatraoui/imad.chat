// Il film dell'anteprima: l'apertura e poi una ventina di secondi di vita (un tocco, il fez che cade, una presa e una scivolata),
// fotogramma per fotogramma con l'orologio fermo (60 al secondo), uniti con ffmpeg in un MP4 H.264 a forma di telefono.
// Uso:  node docs/anteprime/gatto/strumenti/film.mjs <cartella di uscita> [aspetto=adesivo] [tema=scuro]
// Scrive <cartella>/apertura.mp4 e sei fotogrammi chiave <cartella>/apertura-<n>-<istante>.png. Il dito finto è un cerchio chiaro.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, ".."), root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "package.json")); const { chromium } = require("playwright");
const [outDir = ".", look = "adesivo", tema = "scuro"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".mp3": "audio/mpeg", ".m4a": "audio/mp4" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(+(process.env.PORT || 0), "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;

const FPS = 60, END = 31.5;
const KEY = [1.25, 4.35, 5.5, 8.4, 16.6, 25.1];   /* i fotogrammi chiave (secondi) */
/* il copione: in pagina, D = DOT.debug; dito(x, y, a) mostra il dito finto */
const SCRIPT = `
  var D = DOT.debug, P = D.plats(), T = D.tiles().filter(function (t) { return !t.mode; }), C = T[1];
  function catAt() { var b = D.bbox(); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 + 4 }; }
  window.__film = [];
  function tapAt(t, then) { D.at(t, function () { var c = catAt(); window.__film.push({ k: "tap", t: D.state().now, x: c.x, y: c.y }); then(); }); }
  tapAt(12.4, function () { D.set("meow", { face: "view", pose: "sit" }); });
  tapAt(15.2, function () { D.set("fezoff", { face: "view", pose: "sit" }); });
  /* la presa: il dito arriva sul gatto, lo solleva, lo porta sulla faccia di «Le città», si ferma, lascia */
  D.at(22.2, function () {
    var c = catAt(), tx = (C.l + C.r) / 2, ty = C.t + (C.b - C.t) * 0.32, n = 48, i;
    window.__film.push({ k: "down", t: D.state().now, x: c.x, y: c.y - 10 });
    for (i = 1; i <= n; i++) (function (i) { D.at(0.25 + i / 60, function () { var u = i / n, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      var x = c.x + (tx - c.x) * e, y = c.y - 10 + (ty - c.y + 10) * e - Math.sin(u * Math.PI) * 40; D.dragTo(x, y); window.__film.push({ k: "move", t: D.state().now, x: x, y: y }); }); })(i);
    D.at(0.25 + n / 60 + 0.45, function () { D.drop(0, 0); window.__film.push({ k: "up", t: D.state().now }); });
  });
`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { sessionStorage.clear(); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 300)); });
await page.goto(`${base}index.html?manual=1&seme=11&look=${look}&tema=${tema}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.evaluate(() => {
  var i = document.querySelector(".marchio i"); i.style.animation = "none"; i.style.webkitAnimation = "none";
  var d = document.createElement("div"); d.id = "dito"; d.style.cssText = "position:absolute;left:0;top:0;z-index:55;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;pointer-events:none;opacity:0;background:rgba(255,255,255,.28);box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 6px 18px rgba(0,0,0,.35)";
  document.body.appendChild(d);
});
await page.evaluate(SCRIPT);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "film-"));
const N = Math.round(END * FPS); let keyI = 0;
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  await page.evaluate((t) => {
    DOT.debug.tick(1 / 60);
    var c = document.querySelector(".marchio i"); c.style.opacity = Math.floor(t / 0.55) % 2 ? "0" : "1";
    /* il dito finto */
    var ev = window.__film || [], d = document.getElementById("dito"), now = DOT.debug.state().now, a = 0, x = 0, y = 0, s = 1, j, e, down = null, moving = null, up = null;
    for (j = 0; j < ev.length; j++) { e = ev[j]; if (e.k === "tap" && now - e.t < 0.45) { a = 1 - (now - e.t) / 0.45; x = e.x; y = e.y; s = 0.7 + 0.6 * (now - e.t) / 0.45; } if (e.k === "down") down = e; if (e.k === "move") moving = e; if (e.k === "up") up = e; }
    if (down && (!up || now - up.t < 0.3)) { var p = moving || down; x = p.x; y = p.y; a = up ? 1 - (now - up.t) / 0.3 : Math.min(1, (now - down.t) / 0.15); s = up ? 1 + 0.4 * (now - up.t) / 0.3 : 1; }
    d.style.opacity = a.toFixed(3); d.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")";
  }, t);
  await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  while (keyI < KEY.length && t >= KEY[keyI] - 1e-6) { await page.screenshot({ path: path.join(outDir, `apertura-${keyI + 1}-${KEY[keyI].toFixed(2)}s.png`) }); keyI++; }
  if (i % 300 === 0) console.log("fotogramma", i, "di", N, (await page.evaluate(() => DOT.debug.state().state)));
}
const mp4 = path.join(outDir, "apertura.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%05d.jpg"), "-vf", "scale=720:-2:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("salvato", mp4, (fs.statSync(mp4).size / 1048576).toFixed(2), "MB");
if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
