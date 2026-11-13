// La prova lunga di Dot (soak): orologio fermo, molti minuti simulati di tocchi, raffiche di tocchi, trascinamenti, lanci, scorrimenti,
// cambi d'aspetto, dita ferme (carezze), pause, «Rivedi» e, su riordina.html, riquadri riordinati e nascosti a caso seguiti da DOT.refresh().
// Conta: eccezioni, NaN, stati fermi, il gatto davanti a un riquadro «no» (escluso mentre lo si trascina, dietro un bordo, e nel balzo subito dopo
// averlo lasciato), il gatto fermo su o sotto un riquadro «quiet», nuvolette lì, il fez davanti al Corano, le tele.
// Uso:  node docs/anteprime/gatto/strumenti/soak.mjs [minuti=10] [pagina=riordina.html] [semi=1,2,3]      (PORT=4111 per la porta)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, ".."), root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "package.json")); const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".mp3": "audio/mpeg", ".m4a": "audio/mp4" };
const server = http.createServer((req, res) => { let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(+(process.env.PORT || 0), "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}/`;
async function phone(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (!/fonts\.g|ERR_FAILED|Failed to load resource/.test(t)) errs.push(m.type() + ": " + t.slice(0, 300)); } });
  return { ctx, page, errs };
}
async function open(page, url) { await page.goto(url, { waitUntil: "load" }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }); }
const MIN = +(process.argv[2] || 10), PAGE = process.argv[3] || "riordina.html", SEEDS = (process.argv[4] || "1,2,3").split(",").map(Number);
const browser = await chromium.launch();
for (const seed of SEEDS) {
  const { page, errs, ctx } = await phone(browser); await open(page, base + PAGE + "?manual=1&primo=0&suono=no&look=" + (process.env.LOOK || "manifesto") + "&seme=" + seed);   /* l'aspetto scelto da Imad (riordina.html, senza ?look, prenderebbe quello di prova) */
  const rep = await page.evaluate(({ MIN, seed }) => {
    var D = DOT.debug, s = seed * 7919 + 13; function R() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    /* gli errori dentro l'aspetto: il cervello li inghiotte e passa a «base»; qui si contano */
    var LE = { n: 0, first: null }; Object.keys(DOT.looks).forEach(function (ln) { ["draw", "drawFez", "drawProp"].forEach(function (fn) { var L = DOT.looks[ln], o = L[fn]; if (!o) return;
      L[fn] = function () { try { return o.apply(this, arguments); } catch (e) { LE.n++; if (!LE.first) LE.first = ln + "." + fn + ": " + e.message + " | " + (e.stack || "").split("\n")[1]; throw e; } }; }); });
    var IDS = [].map.call(document.querySelectorAll(".t"), function (e) { return e.id; }), canReorder = typeof window.order === "function";
    function rect(e) { var r = e.getBoundingClientRect(); return { l: r.left + pageXOffset, t: r.top + pageYOffset, r: r.right + pageXOffset, b: r.bottom + pageYOffset, w: r.width }; }
    function zones(mode) { return [].filter.call(document.querySelectorAll(".t"), function (e) { return e.getAttribute("data-dot") === mode && getComputedStyle(e).display !== "none"; }).map(rect); }
    var REST = { sit: 1, look: 1, loaf: 1, sleep: 1, groom: 1, yawn: 1, stretch: 1, drape: 1, walk: 1, pause: 1, tea: 1, star: 1, cube: 1, yarn: 1, laptop: 1, purr: 1, meow: 1, hop: 1, greet: 1, pet: 1, melt: 1, getup: 1, sulk: 1, annoyed: 1, fezoff: 1, shake: 1, tangle: 1, pounce: 1, brace: 1, wakeup: 1 };
    var out = { lookErr: LE, frames: 0, thrown: [], nan: 0, overNo: {}, overNoMax: {}, quietRest: {}, overQuietRest: {}, quietBubble: 0, stuck: [], invisLong: [], states: {}, fezOverNo: 0, maxCv: 0, actions: {}, propOnQuiet: 0, floatFrames: {} };
    var F = Math.round(MIN * 60 * 60), last = "", since = 0, invis = 0, dragging = 0, paused = 0, pressing = 0, lastAct = "", afterDrop = 0, dragT = null;
    function act(n) { out.actions[n] = (out.actions[n] || 0) + 1; lastAct = n + "@" + (out.frames / 60).toFixed(1); }
    var NO = zones("no"), QU = zones("quiet");
    function hits(L, b, m) { for (var i = 0; i < L.length; i++) { var n = L[i]; var w = Math.min(b.x1, n.r) - Math.max(b.x0, n.l), h = Math.min(b.y1, n.b) - Math.max(b.y0, n.t); if (w > m && h > m) return h; } return 0; }
    for (var f = 0; f < F; f++) {
      if (paused) { paused--; if (!paused) { DOT.resume(); act("resume"); } continue; }
      try { D.tick(1 / 60); } catch (e) { out.thrown.push((f / 60).toFixed(1) + "s " + D.cat.state + ": " + e.message + " | " + (e.stack || "").split("\n")[1] + " | last " + lastAct); if (out.thrown.length > 5) break; }
      out.frames++; if (afterDrop) afterDrop--;
      var c = D.cat, st = c.state; out.states[st] = (out.states[st] || 0) + 1;
      if (!(c.x === c.x) || !(c.y === c.y) || !isFinite(c.x) || !isFinite(c.y) || !(c.voff === c.voff)) { out.nan++; if (out.nan === 1) out.nanAt = (f / 60).toFixed(1) + "s " + st + " after " + lastAct; }
      if (st === last) since++; else { last = st; since = 0; }
      if (since === 60 * 45 && st !== "sleep" && st !== "boxed" && st !== "wait") out.stuck.push(st + " for 45 s at " + (f / 60).toFixed(0) + "s, last " + lastAct);
      if (!c.vis && st !== "boxed") { invis++; if (invis === 60 * 15) out.invisLong.push(st + " at " + (f / 60).toFixed(0) + "s after " + lastAct + " sy " + pageYOffset); } else invis = 0;
      if (f % 6 === 0) { NO = zones("no"); QU = zones("quiet"); }
      var bb = c.vis ? D.bbox() : null;
      if (bb && st !== "held") { var h = hits(NO, bb, 6); if (h && st !== "peek" && st !== "dive" && !(afterDrop && (st === "air" || st === "fall" || st === "fly"))) { out.overNo[st] = (out.overNo[st] || 0) + 1; if (!(out.overNoMax[st] >= h)) out.overNoMax[st] = Math.round(h); if (!out.overNoAt) out.overNoAt = (f / 60).toFixed(1) + "s " + st + " after " + lastAct; } }
      if (REST[st] && c.vis && c.plat && c.plat.quiet) { out.quietRest[st] = (out.quietRest[st] || 0) + 1; if (!out.quietRestAt) out.quietRestAt = (f / 60).toFixed(1) + "s " + st + " after " + lastAct; }
      if (REST[st] && bb && hits(QU, bb, 3)) { out.overQuietRest[st] = (out.overQuietRest[st] || 0) + 1; if (!out.overQuietAt) out.overQuietAt = (f / 60).toFixed(1) + "s " + st + " after " + lastAct; }
      var fz = D.fezInfo(); if (fz && hits(NO, { x0: fz.x - 7, x1: fz.x + 7, y0: fz.y - 7, y1: fz.y + 7 }, 0)) out.fezOverNo++;
      if (c.plat && (st === "sit" || st === "loaf" || st === "sleep" || st === "look") && Math.abs(c.y - c.plat.y) > 1.5) out.floatFrames[st] = (out.floatFrames[st] || 0) + 1;
      if (f % 10 === 0) { var bub = document.querySelector(".dot-fum__in"); if (bub && bub.parentNode.style.display !== "none" && getComputedStyle(bub.parentNode).visibility !== "hidden" && +bub.style.opacity > 0.3 && bb && hits(QU, bb, 3)) { out.quietBubble++; out.qbAt = (f / 60).toFixed(1) + " " + st + " " + bub.textContent; } var n = document.querySelectorAll(".dot-layer canvas").length; if (n > out.maxCv) out.maxCv = n; }
      /* azioni */
      if (dragging) { dragging--; if (dragging === 0) { var v = R(); D.drop(v < 0.3 ? (R() - 0.5) * 3000 : 0, v < 0.3 ? (R() - 0.7) * 2400 : 0); act("drop"); afterDrop = 70; } else if (dragging % 6 === 0) D.dragTo(dragT.x + (R() - 0.5) * 30, dragT.y + (R() - 0.5) * 30); continue; }
      if (pressing) { pressing--; if (!pressing) { D.lift(); act("lift"); } continue; }
      var r = R(), ok = c.vis && st !== "opening" && st !== "boxjump" && st !== "boxed" && st !== "boxexit" && st !== "box" && st !== "wait";
      if (r < 1 / 240) { D.tap(); act("tap"); }
      else if ((r -= 1 / 240) < 1 / 500) { if (ok) { dragT = { x: 20 + R() * 350, y: pageYOffset + 40 + R() * 760 }; D.dragTo(dragT.x, dragT.y); dragging = 20 + Math.floor(R() * 60); act("drag"); } }
      else if ((r -= 1 / 500) < 1 / 900) { window.scrollTo(0, Math.floor(R() * Math.max(0, document.documentElement.scrollHeight - innerHeight))); act("scroll"); }
      else if ((r -= 1 / 900) < 1 / 6000) { DOT.replay(); act("replay"); }
      else if ((r -= 1 / 6000) < 1 / 3000) { DOT.setLook(["manifesto", "base"][Math.floor(R() * 2)]); act("look"); }
      else if ((r -= 1 / 3000) < 1 / 1500) { for (var k = 0; k < 5; k++) D.tap(); act("5taps"); }
      else if ((r -= 1 / 1500) < 1 / 1200) { if (canReorder) { var ids = IDS.filter(function (x) { return x !== "corano"; }), i2, j2, tmp; for (i2 = ids.length - 1; i2 > 0; i2--) { j2 = Math.floor(R() * (i2 + 1)); tmp = ids[i2]; ids[i2] = ids[j2]; ids[j2] = tmp; }
          var ci = Math.floor(R() * 4); ids.splice(ci, 0, "corano"); window.order(ids);
          var hr = R(); if (hr < 0.15) window.hide(ids[Math.floor(R() * ids.length)]); else if (hr < 0.35) IDS.forEach(function (x) { window.hide(x, false); });
          DOT.refresh(R() < 0.3 ? 0.5 : 0); act("reorder"); } }
      else if ((r -= 1 / 1200) < 1 / 3000) { DOT.pause(); paused = 30 + Math.floor(R() * 120); act("pause"); }
      else if ((r -= 1 / 3000) < 1 / 2000) { if (ok && c.plat) { D.press(); pressing = 120 + Math.floor(R() * 300); act("press"); } }
    }
    out.end = D.cat.state; out.cvEnd = document.querySelectorAll(".dot-layer canvas").length;
    for (var k2 in out.states) out.states[k2] = +(out.states[k2] / out.frames * 100).toFixed(1);
    return out;
  }, { MIN, seed });
  console.log("seed", seed, PAGE, MIN + " min:", JSON.stringify(rep), "pageerrs", errs);
  await ctx.close();
}
await browser.close(); server.close();
