// node gatto-pose.mjs <out-prefix> <scenario> : il tempo avanza a mano (60 passi al secondo); ritaglia attorno al gatto, ingrandito
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/home/user/imad.chat/"); const { chromium } = require("playwright");
const [out = "p", scen = "all", dprS = "3", wS = "390", hS = "844"] = process.argv.slice(2);
const dir = "/home/user/imad.chat/public";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: +wS, height: +hS }, deviceScaleFactor: +dprS, isMobile: +wS < 700, hasTouch: +wS < 700 });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
await page.addInitScript(() => { window.__manual = true; Math.random = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(); });
await page.goto(base + "gatto/", { waitUntil: "load" }); await page.waitForFunction(() => !!window.__gatto, null, { timeout: 15000 });
const ticks = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__gatto.tick(1 / 60); }, n);
let idx = 0;
const shot = async (name, bw = 190, bh = 150, oy = -52) => {
  const c = await page.evaluate(() => ({ x: window.__gatto.cat.x, y: window.__gatto.cat.y - window.scrollY }));
  await page.waitForTimeout(60);
  const x = Math.max(0, Math.min(+wS - bw, c.x - bw / 2)), y = Math.max(0, c.y + oy - bh / 2);
  await page.screenshot({ path: `${out}-${String(idx++).padStart(2, "0")}-${name}.png`, clip: { x, y, width: bw, height: bh } });
};
const ev = (f, a) => page.evaluate(f, a);
await ticks(60 * 7 + 20);                                    // l'apertura fino al gatto seduto
const S = {
  sit: async () => { await ticks(40); await shot("sit"); await ev(() => { const g = window.__gatto; g.ptr.x = g.cat.x + 160; g.ptr.y = g.cat.y - 120; g.ptr.t = 1e9; }); await ticks(40); await shot("sit-guarda"); await ev(() => { window.__gatto.ptr.t = -9; }); },
  walk: async () => { await ev(() => { const g = window.__gatto, c = g.cat; c.tx = c.x + 170; c.dir = 1; g.set("walk", { pose: "stand", face: "side" }); }); await ticks(50); for (let i = 0; i < 8; i++) { await shot("walk" + i); await ticks(4); } },
  walkl: async () => { await ev(() => { const g = window.__gatto, c = g.cat; c.tx = c.x - 120; c.dir = -1; g.set("walk", { pose: "stand", face: "side" }); }); for (let i = 0; i < 6; i++) { await ticks(8); await shot("giro" + i); } },
  sleep: async () => { await ev(() => window.__gatto.set("sleep", { pose: "loaf", face: "view", dur: 99 })); await ticks(40); await shot("loaf"); await ticks(120); await shot("sleep"); },
  wake: async () => { await ev(() => window.__gatto.set("wake", { pose: "loaf", face: "view" })); for (const n of [24, 22, 20, 24, 30, 40]) { await ticks(n); await shot("wake"); } },
  hop: async () => { await ev(() => window.__gatto.set("hop", { pose: "crouch", face: "view" })); for (const n of [5, 7, 7, 7, 14]) { await ticks(n); await shot("hop", 190, 190, -72); } },
  jump: async () => { await ev(() => { const g = window.__gatto, P = g.plats(), p = P[1], c = g.cat; c.to = { p, x: p.x0 + 40, y: p.y }; c.dir = c.to.x >= c.x ? 1 : -1; g.set("crouch", { pose: "crouch", face: "side" }); }); for (const n of [8, 8, 8, 8, 8, 8, 10, 14]) { await ticks(n); await shot("jump", 230, 230, -60); } },
  held: async () => { await ev(() => { const g = window.__gatto; g.set("held", { pose: "held", face: "view" }); }); await page.evaluate(() => { const g = window.__gatto; }); await ticks(50); await shot("held", 190, 190, -40); },
};
for (const k of scen === "all" ? Object.keys(S) : scen.split(",")) await S[k]();
console.log("stato", await ev(() => JSON.stringify({ s: window.__gatto.cat.state, x: Math.round(window.__gatto.cat.x), y: Math.round(window.__gatto.cat.y) })));
if (errs.length) console.log("ERRORI\n" + [...new Set(errs)].join("\n"));
await browser.close(); server.close();
