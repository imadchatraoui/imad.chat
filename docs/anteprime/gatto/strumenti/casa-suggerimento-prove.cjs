// Le prove del suggerimento (CASA.md 2c C) sulla casa nuova, con l'orologio di Dot mosso a mano (window.__manual, 60 passi al secondo).
// Con servi.mjs acceso:  node docs/anteprime/gatto/strumenti/casa-suggerimento-prove.cjs [--port 4121] [--solo nome,nome] [--out prove.json]
// Prove: annulla (un dito vero in cinque istanti del dito fantasma: lo prende senza salti), pieno (il dito fantasma intero, fotogramma per
// fotogramma), memoria (sessione e telefono, al più due sessioni), scorre e scrive (mai durante), bussa (mai mentre si scorre, al più due),
// stop (DOT.stop() non lascia ascoltatori, intervalli, fotogrammi, tele), tocchi (le reazioni di DOT.md 3, il primo tocco caldo),
// vicino e zampata, pausa (un foglio), calma (movimento ridotto). Stampa un riassunto e scrive i numeri in --out.
const { chromium } = require("playwright");
const fs = require("fs");
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const PORT = +(A.port || 4121), SOLO = A.solo ? A.solo.split(",") : null, OUT = A.out || null;
const URL = (q) => `http://127.0.0.1:${PORT}/casa/home/index.html?primo=0&seme=${q && q.seme || 5}${q && q.extra || ""}`;
const R = {};
let browser;
async function ctxNew(o) {
  o = o || {};
  return browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 1, isMobile: !!o.touch, hasTouch: !!o.touch, colorScheme: "dark", reducedMotion: o.reduced ? "reduce" : "no-preference" });
}
async function open(ctx, q, init) {
  const p = await ctx.newPage(); p.__errs = [];
  p.on("pageerror", (e) => p.__errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") p.__errs.push(m.text()); });
  await p.addInitScript(() => { window.__manual = true; });
  if (init) await p.addInitScript(init);
  await p.goto(URL(q), { waitUntil: "load" });
  await p.waitForFunction(() => window.__dot === true, null, { timeout: 60000, polling: 200 });
  await p.waitForTimeout(300);
  return p;
}
const tick = (p, s) => p.evaluate((s) => DOT.debug.tick(s), s);
const H = (p) => p.evaluate(() => DOT.debug.hint());
async function frame(p) {   /* un passo di 1/60 s e i numeri di quel fotogramma */
  return p.evaluate(() => { DOT.debug.tick(1 / 60); var D = DOT.debug, h = D.hint(), b = D.bbox(), c = D.cat;
    return { now: h.now, s: c.state, vis: c.vis, ph: h.ph, t: h.t, fing: h.fing, b: b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, y0: b.y0, y1: b.y1, x0: b.x0, x1: b.x1 } : null, sy: scrollY, vh: innerHeight }; });
}
async function onLedge(p) {   /* seduto sulla mensola di casa, la pagina in cima */
  await p.evaluate(() => window.scrollTo(0, 0)); await tick(p, 0.2);
  await p.evaluate(() => { var D = DOT.debug, c = D.choice(), P = D.plats(), i, bi = -1, bd = 1e9; for (i = 0; i < P.length; i++) { var d = Math.abs(P[i].y - c.y) + (c.x < P[i].a || c.x > P[i].b ? 1e4 : 0); if (d < bd) { bd = d; bi = i; } } D.place(c.x, bi); D.cat.dir = -1; });
  await tick(p, 0.8);
}
async function grabRect(p) { return p.evaluate(() => { var g = document.querySelector(".dot-grab"); if (!g || g.style.display === "none") return null; var r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height, 76) / 2, w: r.width, h: r.height }; }); }
function maxStep(fr, key) { let m = 0; for (let i = 1; i < fr.length; i++) { const a = fr[i - 1][key], b = fr[i][key]; if (!a || !b) continue; m = Math.max(m, Math.hypot(b.x - a.x, b.y - a.y)); } return +m.toFixed(2); }
function on(name) { return !SOLO || SOLO.indexOf(name) >= 0; }

const tests = {
  /* il dito fantasma intero, a 60 fotogrammi al secondo: le fasi, i salti più grandi tra due fotogrammi del gatto e del dito */
  async pieno() {
    const ctx = await ctxNew(); const p = await open(ctx); await onLedge(p);
    const ok = await p.evaluate(() => DOT.debug.hintGo()); const fr = [];
    for (let i = 0; i < 60 * 4.2; i++) fr.push(await frame(p));
    const phases = []; fr.forEach((f) => { const k = (f.ph || "-") + "/" + f.s; if (!phases.length || phases[phases.length - 1].k !== k) phases.push({ k, t: +(f.t == null ? -1 : f.t).toFixed(2) }); });
    const fing = fr.filter((f) => f.fing && f.fing.a > 0.05).map((f) => ({ b: { x: f.fing.x, y: f.fing.y } }));
    const top = Math.min.apply(null, fr.map((f) => f.b ? f.b.y0 : 1e9)), end = fr[fr.length - 1];
    const r = { ok, phases, catMaxStep: maxStep(fr, "b"), fingMaxStep: maxStep(fing, "b"), liftPx: +(fr[0].b.y0 - top).toFixed(1), endState: end.s, endPh: end.ph, hint: await H(p), errs: p.__errs };
    await ctx.close(); return r;
  },
  /* un dito vero in cinque istanti (arriva, preme, alza, tiene, rimette giù) e uno dopo: lo prende al suo posto senza salti */
  async annulla() {
    const out = [];
    for (const T of [0.25, 0.47, 0.85, 1.4, 1.9, 2.25]) {
      const ctx = await ctxNew(); const p = await open(ctx); await onLedge(p);
      await p.evaluate(() => DOT.debug.hintGo()); let f = null;
      for (let i = 0; i < 400; i++) { f = await frame(p); if (f.t != null && f.t >= T) break; }
      const ph0 = f.ph, s0 = f.s, g = await grabRect(p);
      if (!g) { out.push({ T, ph0, s0, err: "maniglia nascosta" }); await ctx.close(); continue; }
      const fr = [f];
      await p.mouse.move(g.x, g.y); await p.mouse.down();
      for (let i = 0; i < 14; i++) fr.push(await frame(p));            /* il dito vero fermo: il gatto non deve saltare */
      const still = maxStep(fr, "b"), sAfter = fr[fr.length - 1].s;
      for (let i = 1; i <= 10; i++) { await p.mouse.move(g.x + 4 * i, g.y - 5 * i); fr.push(await frame(p)); }   /* lo trascina */
      const sDrag = fr[fr.length - 1].s;
      for (let i = 0; i < 10; i++) fr.push(await frame(p));
      await p.mouse.up();
      const after = []; for (let i = 0; i < 150; i++) after.push(await frame(p));
      const hh = await H(p), fingGone = after.findIndex((x) => !x.fing || x.fing.a < 0.01);
      out.push({ T, ph0, s0, stillMaxStep: still, stateAfterPress: sAfter, stateWhileDragged: sDrag, dragMaxStep: maxStep(fr, "b"), fingGoneAfterFrames: fingGone, endState: after[after.length - 1].s, landed: after.some((x) => x.s === "land" || x.s === "sit"), ghost: hh.ph, touched: hh.touched, dragged: hh.dragged, errs: p.__errs });
      await ctx.close();
    }
    return out;
  },
  /* la memoria: una volta per sessione, mai più dopo un trascinamento vero, al più in due sessioni */
  async memoria() {
    const r = {}; const ctx = await ctxNew();
    async function waitGhost(p, sec) { for (let i = 0; i < sec * 4; i++) { await tick(p, 0.25); const h = await H(p); if (h.ph) return +h.now.toFixed(1); } return null; }
    let p = await open(ctx); r.s1 = { start: await waitGhost(p, 45), hint: await H(p) };
    for (let i = 0; i < 16; i++) await tick(p, 0.25);
    await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => window.__dot === true, null, { timeout: 60000 }); await p.waitForTimeout(300);
    r.s1reload = { start: await waitGhost(p, 40), hint: await H(p) };
    const p2 = await open(ctx); r.s2 = { start: await waitGhost(p2, 45), hint: await H(p2) };
    const p3 = await open(ctx); r.s3 = { start: await waitGhost(p3, 45), hint: await H(p3) };
    r.local = await p3.evaluate(() => ({ visti: localStorage.getItem("dot-dito-n"), preso: localStorage.getItem("dot-preso") }));
    await ctx.close();
    const c2 = await ctxNew(); const q = await open(c2); await onLedge(q);   /* trascinato davvero prima del dito fantasma */
    const g = await grabRect(q); await q.mouse.move(g.x, g.y); await q.mouse.down(); for (let i = 1; i <= 10; i++) { await q.mouse.move(g.x + 5 * i, g.y - 4 * i); await tick(q, 1 / 60); } await q.mouse.up(); await tick(q, 2);
    r.dragged = await H(q);
    const q2 = await open(c2); r.afterDrag = { start: await waitGhost(q2, 40), hint: await H(q2) };
    await c2.close(); return r;
  },
  /* mai mentre si scorre o si scrive */
  async scorre() {
    const r = {}; let ctx = await ctxNew(); let p = await open(ctx); const starts = [];
    let y = 0, dir = 1;
    for (let i = 0; i < 60 * 30; i++) {
      if (i % 2 === 0) { y += dir * 3; if (y > 240) dir = -1; if (y < 2) dir = 1; await p.evaluate((y) => window.scrollTo(0, y), y); }
      const f = await frame(p); if (f.ph === "in" && (!starts.length || starts[starts.length - 1].end)) starts.push({ t: f.now });
    }
    r.whileScrolling = { starts: starts.length, hint: await H(p) };
    let st = null; for (let i = 0; i < 60 * 30 && st == null; i++) { const f = await frame(p); if (f.ph) st = f.now; }
    const last = await p.evaluate(() => DOT.debug.follow());
    r.afterStop = { start: st, stillAtStart: last.still };
    await ctx.close();
    ctx = await ctxNew(); p = await open(ctx);
    await p.evaluate(() => window.scrollTo(0, 0)); const inp = await p.$(".grid input");
    if (inp) { await inp.focus({ preventScroll: true }); }
    let tw = 0; for (let i = 0; i < 4 * 30; i++) { if (i % 4 === 0 && inp) await p.keyboard.type("a"); await tick(p, 0.25); const h = await H(p); if (h.ph) { tw = h.now; break; } }
    r.whileTyping = { started: tw, hasInput: !!inp, hint: await H(p) };
    await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    let ta = null; for (let i = 0; i < 4 * 60 && ta == null; i++) { await tick(p, 0.25); const h = await H(p); if (h.ph) ta = h.now; }
    r.afterTyping = { start: ta };
    await ctx.close(); return r;
  },
  /* bussa: mai mentre si scorre, al più due volte per sessione; le condizioni vere (dopo il dito fantasma) */
  async bussa() {
    const r = {}; const ctx = await ctxNew(); const p = await open(ctx, { seme: 3 });
    for (let i = 0; i < 4 * 60; i++) { await tick(p, 0.25); const h = await H(p); if (h.end > 0 && !h.ph) break; }
    r.ghost = await H(p);
    /* si scorre per 60 s: niente bussare */
    let y = 0, dir = 1, kScroll = 0;
    for (let i = 0; i < 60 * 60; i += 2) { y += dir * 4; if (y > 200) dir = -1; if (y < 2) dir = 1; await p.evaluate((y) => window.scrollTo(0, y), y); await tick(p, 1 / 30); if (i % 30 === 0) { const s = await p.evaluate(() => DOT.debug.cat.state); if (s === "knock") kScroll++; } }
    r.knocksWhileScrolling = (await H(p)).knocks; r.knockFramesSeen = kScroll;
    await p.evaluate(() => window.scrollTo(0, 0));
    const seen = []; for (let i = 0; i < 4 * 400; i++) { await tick(p, 0.25); const s = await p.evaluate(() => [DOT.debug.cat.state, DOT.debug.hint().knocks, DOT.debug.hint().now]); if (s[0] === "knock" && (!seen.length || seen[seen.length - 1].n !== s[1])) seen.push({ n: s[1], t: +s[2].toFixed(1) }); }
    r.knocks = seen; r.final = await H(p);
    await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => window.__dot === true, null, { timeout: 60000 }); await p.waitForTimeout(300);
    let k2 = 0; for (let i = 0; i < 4 * 120; i++) { await tick(p, 0.25); if ((await p.evaluate(() => DOT.debug.cat.state)) === "knock") k2++; }
    r.afterReload = { knockFrames: k2, hint: await H(p) };
    r.errs = p.__errs; await ctx.close(); return r;
  },
  /* DOT.stop() non lascia niente: ascoltatori su window, document e il dock, intervalli, fotogrammi chiesti, tele, classi */
  async stop() {
    const ctx = await ctxNew();
    const p = await open(ctx, null, () => {
      const L = (window.__L = { on: false, add: [], rem: [], iv: [], civ: [], raf: 0 });
      const wrap = (T, name) => { const a = T.addEventListener, r = T.removeEventListener;
        T.addEventListener = function (type, fn, o) { if (L.on) L.add.push({ t: name, type, fn }); return a.call(this, type, fn, o); };
        T.removeEventListener = function (type, fn, o) { if (L.on) L.rem.push({ t: name, type, fn }); return r.call(this, type, fn, o); }; };
      wrap(window, "window"); wrap(document, "document");
      const si = window.setInterval, ci = window.clearInterval, ra = window.requestAnimationFrame;
      window.setInterval = function () { const id = si.apply(window, arguments); if (L.on && /dot-/.test(new Error().stack || "")) L.iv.push(id); return id; };
      window.clearInterval = function (id) { L.civ.push(id); return ci.call(window, id); };
      window.requestAnimationFrame = function (fn) { L.raf++; return ra.call(window, fn); };
    });
    await p.evaluate(() => { const d = document.getElementById("dock"); const a = d.addEventListener, r = d.removeEventListener, L = window.__L;
      d.addEventListener = function (type, fn, o) { if (L.on) L.add.push({ t: "dock", type, fn }); return a.call(this, type, fn, o); };
      d.removeEventListener = function (type, fn, o) { if (L.on) L.rem.push({ t: "dock", type, fn }); return r.call(this, type, fn, o); }; });
    const r = await p.evaluate(async () => {
      const L = window.__L, D = window.DOT;
      D.stop(); const before = document.querySelectorAll(".dot-layer, .dot-grab, .dot-fum").length;
      L.on = true;
      D.start({ tiles: ".testa > .tile, .grid > .tile, .foot [data-dot=\"perch\"]", home: document.getElementById("hero"), homeX: 0.58, parent: document.getElementById("dotclip"), look: "manifesto", firstVisit: false, dark: true,
        keep: window.__dotKeep, strict: true, dock: document.getElementById("dock"), fixedParent: document.getElementById("dotfixe"), hint: true });
      window.scrollTo(0, 0); D.debug.tick(0.3);
      var c = D.debug.choice(), P = D.debug.plats(), i, bi = -1, bd = 1e9; for (i = 0; i < P.length; i++) { var d = Math.abs(P[i].y - c.y) + (c.x < P[i].a || c.x > P[i].b ? 1e4 : 0); if (d < bd) { bd = d; bi = i; } } D.debug.place(c.x, bi); D.debug.tick(0.8);
      const went = D.debug.hintGo(); for (i = 0; i < 70; i++) D.debug.tick(1 / 60);   /* il dito fantasma lo tiene */
      const mid = D.debug.hint(), canv = document.querySelectorAll("#dotfixe canvas, #dotclip canvas").length;
      D.stop(); L.on = false;
      const left = L.add.filter((a) => !L.rem.some((r) => r.t === a.t && r.type === a.type && r.fn === a.fn)).map((a) => a.t + ":" + a.type);
      const ivLeft = L.iv.filter((id) => L.civ.indexOf(id) < 0);
      const r0 = L.raf; await new Promise((res) => setTimeout(res, 400)); const rafAfter = L.raf - r0;
      return { before, went, mid: { ph: mid.ph, fing: !!mid.fing, rings: mid.rings }, canvasesDuring: canv, listenersAdded: L.add.length, listenersLeft: left, intervalsLeft: ivLeft.length,
        domLeft: document.querySelectorAll(".dot-layer, .dot-grab, .dot-fum, #dotfixe canvas, #dotclip canvas").length, htmlClass: document.documentElement.classList.contains("dot-tiene"), rafAfterStop400ms: rafAfter };
    });
    /* fotogrammi chiesti dalla pagina senza Dot (per confronto) */
    r.rafBaseline400ms = await p.evaluate(async () => { const L = window.__L, r0 = L.raf; await new Promise((res) => setTimeout(res, 400)); return L.raf - r0; });
    r.errs = p.__errs; await ctx.close(); return r;
  },
  /* i tocchi veri (dito, telefono): il primo caldo (saltello e fusa), poi le reazioni di DOT.md 3; addormentato: seccato */
  async tocchi() {
    const ctx = await ctxNew({ touch: true }); const p = await open(ctx); await onLedge(p);
    const seq = [];
    async function tapCat(label) {
      const g = await grabRect(p); if (!g) { seq.push({ label, err: "maniglia nascosta" }); return; }
      await p.touchscreen.tap(g.x, g.y); const ss = [];
      for (let i = 0; i < 60 * 4; i++) { const f = await frame(p); if (!ss.length || ss[ss.length - 1] !== f.s) ss.push(f.s); }
      seq.push({ label, states: ss });
    }
    await tapCat("primo");
    for (let i = 0; i < 5; i++) { await tick(p, 2.5); await p.evaluate(() => { var D = DOT.debug; if (D.cat.state !== "sit") D.set("sit", { dur: 99, face: "view", pose: "sit" }); }); await tick(p, 0.5); await tapCat("tocco " + (i + 2)); }
    await p.evaluate(() => DOT.debug.set("sleep", { dur: 99, face: "view", pose: "loaf" })); await tick(p, 2);
    await tapCat("addormentato");
    const r = { seq, hint: await H(p), errs: p.__errs }; await ctx.close(); return r;
  },
  /* il dito vicino (mouse): orecchie su, pupille larghe, lo guarda; la zampata a un puntatore mentre la pagina scorre */
  async vicino() {
    const ctx = await ctxNew(); const p = await open(ctx); await onLedge(p);
    const head = await p.evaluate(() => { var D = DOT.debug, f = D.rig().frame(), k = D.state().k; return { x: D.cat.x + f.head.x * k, y: D.cat.y - f.head.y * k - scrollY }; });
    const rd = () => p.evaluate(() => { var D = DOT.debug, r = D.rig(); return { near: +D.hint().near.toFixed(2), ear: r.over.ear, pupilT: r.pupilT, att: D.cat.att ? { x: Math.round(D.cat.att.x), y: Math.round(D.cat.att.y) } : null, s: D.cat.state }; });
    const far = await rd();
    for (let i = 0; i < 30; i++) { await p.mouse.move(head.x + 70 + Math.sin(i) * 3, head.y - 30); await tick(p, 1 / 60); }
    const near = await rd();
    await p.mouse.move(5, 830); for (let i = 0; i < 90; i++) await tick(p, 1 / 60);
    const gone = await rd();
    /* la zampata: il puntatore fermo vicino alla testa, la pagina scorre in giù (il gatto passa sotto il puntatore) */
    const bats = [];
    for (let k = 0; k < 6; k++) {
      await onLedge(p); await tick(p, 0.6);
      const hd = await p.evaluate(() => { var D = DOT.debug, f = D.rig().frame(), kk = D.state().k; return { x: D.cat.x + f.head.x * kk, y: D.cat.y - f.head.y * kk - scrollY }; });
      await p.mouse.move(hd.x - 30, hd.y + 10);   /* davanti a Dot (sulla mensola guarda a sinistra) */ await tick(p, 0.1);
      let y = 0, saw = false; for (let i = 0; i < 12; i++) { y += 12; await p.evaluate((y) => window.scrollTo(0, y), y); await tick(p, 1 / 30); if ((await p.evaluate(() => DOT.debug.cat.state)) === "swat") saw = true; }
      for (let i = 0; i < 20; i++) { await tick(p, 1 / 30); if ((await p.evaluate(() => DOT.debug.cat.state)) === "swat") saw = true; }
      bats.push(saw); await tick(p, 17);
    }
    const r = { head, far, near, gone, bats, errs: p.__errs }; await ctx.close(); return r;
  },
  /* un foglio aperto (DOT.pause) mentre il dito fantasma lo tiene: torna seduto, il dito sparisce; ripreso, niente di nuovo */
  async pausa() {
    const ctx = await ctxNew(); const p = await open(ctx); await onLedge(p);
    await p.evaluate(() => DOT.debug.hintGo()); for (let i = 0; i < 70; i++) await frame(p);
    const mid = await H(p);
    const r = await p.evaluate(() => { DOT.pause(); var h = DOT.debug.hint(), c = DOT.debug.cat; return { ph: h.ph, fing: !!h.fing, fake: h.fake, s: c.state, canv: document.querySelectorAll("#dotfixe canvas").length }; });
    await p.evaluate(() => DOT.resume()); for (let i = 0; i < 60 * 12; i++) await tick(p, 1 / 60);
    const after = await H(p);
    const out = { mid: { ph: mid.ph }, paused: r, after: { ph: after.ph, ok: after.ok }, errs: p.__errs }; await ctx.close(); return out;
  },
  /* movimento ridotto: niente suggerimento */
  async calma() {
    const ctx = await ctxNew({ reduced: true }); const p = await open(ctx);
    for (let i = 0; i < 4 * 30; i++) await tick(p, 0.25);
    const r = { hint: await H(p), state: await p.evaluate(() => DOT.debug.cat.state), went: await p.evaluate(() => DOT.debug.hintGo()), errs: p.__errs }; await ctx.close(); return r;
  }
};
(async () => {
  browser = await chromium.launch();
  for (const k of Object.keys(tests)) { if (!on(k)) continue; const t0 = Date.now(); try { R[k] = await tests[k](); } catch (e) { R[k] = { error: String(e && e.stack || e) }; } console.log("== " + k + " (" + ((Date.now() - t0) / 1000).toFixed(0) + " s)\n" + JSON.stringify(R[k])); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  await browser.close();
})();
