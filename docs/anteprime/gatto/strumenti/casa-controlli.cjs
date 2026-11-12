// Controlli di Dot sulla casa nuova (Chromium senza testa): i tocchi sui filtri arrivano ai filtri, in groppa non trema, l'apertura,
// movimento ridotto, i fogli, DOT.stop(), tocchi e trascinamento dal dock.
// Con servi.mjs acceso:  node docs/anteprime/gatto/strumenti/casa-controlli.cjs [--port 4121] [--w 390 --h 844]
const { chromium } = require("playwright");
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const PORT = +(A.port || 4121), W = +(A.w || 390), H = +(A.h || 844), phone = W < 700;
const URL0 = `http://127.0.0.1:${PORT}/casa/home/index.html`;
const res = []; const ok = (name, cond, info) => { res.push((cond ? "OK   " : "FAIL ") + name + (info ? "  " + info : "")); };
async function open(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone, reducedMotion: o.reduced ? "reduce" : "no-preference" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  if (o.manual) await p.addInitScript(() => { window.__manual = true; });
  await p.goto(URL0 + "?seme=5&primo=" + (o.primo || 0), { waitUntil: "load" });
  await p.waitForFunction(() => window.__dot === true, null, { timeout: 60000, polling: 250 });
  return { ctx, p, errs };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  /* A, B, G: sul dock (orologio a mano) */
  {
    const { ctx, p, errs } = await open(b, { manual: true }); await sleep(800);
    await p.evaluate(() => { window.scrollTo(0, 900); DOT.debug.tick(0.3); });
    const btns = await p.evaluate(() => [].map.call(document.querySelectorAll(".dock__b"), (e) => { const r = e.getBoundingClientRect(); return { f: e.getAttribute("data-filtro"), x: r.left + r.width / 2, y: r.top + r.height / 2, t: r.top }; }));
    let allHit = true, info = [];
    for (const bt of btns) {
      await p.evaluate((x) => { DOT.debug.dockup(x); for (var i = 0; i < 40; i++) DOT.debug.tick(0.1); }, bt.x);
      const r = await p.evaluate((bt) => { var o = []; [[0, 0], [0, -14], [-20, -14], [20, -14], [0, 14]].forEach(function (d) { var e = document.elementFromPoint(bt.x + d[0], bt.y + d[1]); o.push(!!(e && e.closest && e.closest('.dock__b[data-filtro="' + bt.f + '"]'))); }); return { o: o, st: DOT.debug.cat.state, ride: DOT.debug.riding(), x: Math.round(DOT.debug.cat.x) }; }, bt);
      if (r.o.indexOf(false) >= 0) allHit = false; info.push(bt.f + ":" + r.st + (r.ride ? "/ride" : "") + "@" + r.x + "=" + r.o.map((v) => (v ? 1 : 0)).join(""));
    }
    ok("A. un tocco su un filtro arriva al filtro con Dot seduto sopra", allHit, info.join(" "));
    // il tocco vero (touch) sul filtro Tools con Dot sopra
    const tl = btns.find((x) => x.f === "tools");
    await p.evaluate((x) => { DOT.debug.dockup(x); for (var i = 0; i < 40; i++) DOT.debug.tick(0.1); }, tl.x);
    if (phone) await p.touchscreen.tap(tl.x, tl.y - 12); else await p.mouse.click(tl.x, tl.y - 12);
    await sleep(300);
    const pressed = await p.evaluate(() => document.querySelector('.dock__b[data-filtro="tools"]').getAttribute("aria-pressed"));
    ok("A2. tocco vero sul filtro Tools (12 px sotto la cima) con Dot sopra", pressed === "true");
    await p.evaluate(() => { document.querySelector('.dock__b[data-filtro="tutto"]').click(); });
    await sleep(900);
    // B: in groppa mentre la pagina scorre: la tela del gatto resta ferma sullo schermo
    await p.evaluate(() => { window.scrollTo(0, 1350); DOT.debug.tick(0.2); DOT.debug.dockup(); for (var i = 0; i < 40; i++) DOT.debug.tick(0.1); DOT.debug.set("sit", { dur: 99, face: "view", pose: "ride" }); DOT.debug.tick(0.3); });
    const tr = await p.evaluate(() => { var cv = [].filter.call(document.querySelectorAll(".dot-layer canvas"), function (c) { return c.style.zIndex === "3"; })[0], o = [], y = 1350, i;
      var sts = {}; for (i = 0; i < 60; i++) { y += i < 30 ? 23 : -17; window.scrollTo(0, y); DOT.debug.tick(1 / 60); var s0 = DOT.debug.cat.state; sts[s0] = (sts[s0] || 0) + 1; if (!/^(sit|loaf|sleep|look|pause|groom|yawn)$/.test(s0)) continue; var r = cv.getBoundingClientRect(); o.push([Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10]); }
      if (!o.length) return { n: 0, sts: sts };
      var xs = o.map(function (q) { return q[0]; }), ys = o.map(function (q) { return q[1]; }); return { n: o.length, dx: Math.max.apply(0, xs) - Math.min.apply(0, xs), dy: Math.max.apply(0, ys) - Math.min.apply(0, ys), st: DOT.debug.cat.state, ride: DOT.debug.riding(), sts: sts }; });
    ok("B. in groppa (seduto) la tela del gatto non si muove in verticale sullo schermo mentre la pagina scorre (dx: solo i suoi passi)", tr.n >= 25 && tr.dy < 0.5, JSON.stringify(tr));
    // G: tocchi sul gatto sul dock, poi trascinato via dal dock e lasciato
    await p.evaluate(() => { DOT.debug.dockup(); for (var i = 0; i < 40; i++) DOT.debug.tick(0.1); });
    const reacts = [];
    for (let i = 0; i < 3; i++) { await p.evaluate(() => { DOT.debug.tap(); DOT.debug.tick(0.3); }); reacts.push(await p.evaluate(() => DOT.debug.cat.state)); await p.evaluate(() => { for (var i = 0; i < 40; i++) DOT.debug.tick(0.1); }); }
    ok("G. tre tocchi sul gatto in groppa: tre reazioni", reacts.every((s) => /meow|hop|purr/.test(s)), reacts.join(","));
    const g = await p.evaluate(() => { var g = document.querySelector(".dot-grab"), r = g.getBoundingClientRect(), d = document.getElementById("dock").getBoundingClientRect(); return { gb: r.bottom, dt: d.top, disp: g.style.display, par: g.parentNode.parentNode.id }; });
    ok("G2. la maniglia sta nello strato fisso e finisce sopra il dock", g.gb <= g.dt + 0.5 && g.par === "dotfixe", JSON.stringify(g));
    const dr = await p.evaluate(() => { var D = DOT.debug; D.dragTo(D.cat.x, D.cat.y - 200); D.tick(0.4); var s1 = D.cat.state, r1 = D.riding(); D.drop(0, 0); for (var i = 0; i < 50; i++) D.tick(0.1); return { held: s1, ridingHeld: r1, after: D.cat.state, vis: D.cat.vis }; });
    ok("G3. preso dal dock: in mano non è più in groppa, lasciato vive", dr.held === "held" && !dr.ridingHeld, JSON.stringify(dr));
    ok("A-G senza errori", !errs.length, errs.slice(0, 3).join(" | "));
    await ctx.close();
  }
  /* C: l'apertura (prima visita, il passaggio dell'intro) fino a «salam, sono Dot.» */
  {
    const { ctx, p, errs } = await open(b, { primo: 1 });
    let said = false; for (let i = 0; i < 60 && !said; i++) { await sleep(400); said = await p.evaluate(() => { var e = document.querySelector(".dot-fum__in"); return !!(e && /salam, sono Dot/.test(e.textContent) && +getComputedStyle(e).opacity > 0.5); }); }
    const st = await p.evaluate(() => ({ s: DOT.debug.cat.state, home: DOT.debug.follow().home }));
    ok("C. prima visita: l'apertura arriva a «salam, sono Dot.»", said, JSON.stringify(st));
    ok("C senza errori", !errs.length, errs.slice(0, 3).join(" | "));
    await ctx.close();
  }
  /* D: movimento ridotto: seduto sulla mensola, fermo, anche dopo una scrollata */
  {
    const { ctx, p, errs } = await open(b, { reduced: true }); await sleep(800);
    const s0 = await p.evaluate(() => { var D = DOT.debug, h = document.getElementById("hero").getBoundingClientRect().top + scrollY; return { s: D.cat.state, y: D.cat.y, h: h, x: D.cat.x }; });
    await p.evaluate(() => window.scrollTo(0, 900)); await sleep(6500); await p.evaluate(() => window.scrollTo(0, 0)); await sleep(1200);
    const s1 = await p.evaluate(() => ({ s: DOT.debug.cat.state, y: DOT.debug.cat.y, x: DOT.debug.cat.x, ride: DOT.debug.riding() }));
    ok("D. movimento ridotto: seduto sulla mensola e lì resta", s0.s === "sit" && Math.abs(s0.y - s0.h) < 1 && s1.s === "sit" && Math.abs(s1.x - s0.x) < 0.5 && Math.abs(s1.y - s0.y) < 0.5, JSON.stringify([s0, s1]));
    ok("D senza errori", !errs.length, errs.slice(0, 3).join(" | "));
    await ctx.close();
  }
  /* E: i fogli fermano Dot, anche in groppa; F: DOT.stop() non lascia niente */
  {
    const { ctx, p, errs } = await open(b); await sleep(800);
    await p.evaluate(() => { window.scrollTo(0, 900); DOT.debug.dockup(); }); await sleep(3500);
    const r0 = await p.evaluate(() => DOT.debug.riding());
    await p.evaluate(() => document.querySelector('[data-open="citta"]').click()); await sleep(900);
    const e1 = await p.evaluate(() => ({ paused: DOT.paused(), op: +getComputedStyle(document.getElementById("dotfixe")).opacity }));
    await p.keyboard.press("Escape"); await sleep(900);
    const e2 = await p.evaluate(() => ({ paused: DOT.paused(), op: +getComputedStyle(document.getElementById("dotfixe")).opacity }));
    ok("E. un foglio aperto ferma Dot e lo strato fisso se ne va col dock; chiuso, torna", r0 && e1.paused && e1.op < 0.05 && !e2.paused && e2.op > 0.95, JSON.stringify([r0, e1, e2]));
    await p.evaluate(() => DOT.stop());
    const f = await p.evaluate(() => ({ layers: document.querySelectorAll(".dot-layer").length, fixKids: document.getElementById("dotfixe").children.length, own: document.querySelectorAll(".dot-fixed").length, grab: document.querySelectorAll(".dot-grab").length, fum: document.querySelectorAll(".dot-fum").length, cv: document.querySelectorAll("#dotclip canvas").length }));
    ok("F. DOT.stop() non lascia niente", !f.layers && !f.fixKids && !f.own && !f.grab && !f.fum && !f.cv, JSON.stringify(f));
    ok("E-F senza errori", !errs.length, errs.slice(0, 3).join(" | "));
    await ctx.close();
  }
  await b.close();
  console.log(`${W}x${H}\n` + res.join("\n"));
})();
