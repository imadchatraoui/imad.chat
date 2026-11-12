(() => {
  const V = { t: 0, timers: [], seq: 0, rafs: [], scrollAnim: null };
  window.__V = V;
  const pn = performance.now.bind(performance), T0 = pn();
  performance.now = function () { return T0 + V.t; };
  const RD = Date, BASE = RD.now();
  function FD() { if (!new.target) return new RD(BASE + V.t).toString(); return arguments.length ? new (Function.prototype.bind.apply(RD, [null].concat([].slice.call(arguments))))() : new RD(BASE + V.t); }
  FD.prototype = RD.prototype; FD.now = function () { return BASE + V.t; }; FD.parse = RD.parse; FD.UTC = RD.UTC;
  window.Date = FD;
  window.setTimeout = function (fn, ms) { const a = [].slice.call(arguments, 2), id = ++V.seq; V.timers.push({ id, at: V.t + Math.max(0, +ms || 0), fn, a, rep: 0 }); return id; };
  window.setInterval = function (fn, ms) { const a = [].slice.call(arguments, 2), id = ++V.seq, iv = Math.max(4, +ms || 0); V.timers.push({ id, at: V.t + iv, fn, a, rep: iv }); return id; };
  window.clearTimeout = window.clearInterval = function (id) { V.timers = V.timers.filter((x) => x.id !== id); };
  window.requestAnimationFrame = function (fn) { const id = ++V.seq; V.rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = function (id) { V.rafs = V.rafs.filter((x) => x.id !== id); };
  window.requestIdleCallback = function (fn) { return setTimeout(function () { fn({ didTimeout: false, timeRemaining: function () { return 8; } }); }, 1); };
  window.cancelIdleCallback = window.clearTimeout;
  /* smooth scrolling on the virtual clock */
  const rs = window.scrollTo.bind(window);
  function smooth(y) { const y0 = scrollY, ymax = document.documentElement.scrollHeight - innerHeight; y = Math.max(0, Math.min(ymax, y)); const d = Math.abs(y - y0); V.scrollAnim = { y0, y1: y, t0: V.t, dur: Math.max(260, Math.min(720, 260 + d * 0.5)) }; }
  window.scrollTo = function (a, b) { if (a && typeof a === "object") { if (a.behavior === "smooth") { smooth(a.top != null ? a.top : scrollY); return; } V.scrollAnim = null; rs(a.left != null ? a.left : scrollX, a.top != null ? a.top : scrollY); return; } V.scrollAnim = null; rs(a, b); };
  window.scroll = window.scrollTo;
  window.scrollBy = function (a, b) { if (a && typeof a === "object") { window.scrollTo({ top: scrollY + (a.top || 0), behavior: a.behavior }); return; } window.scrollTo(scrollX + a, scrollY + b); };
  V.realScroll = rs;
  const eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  V.step = function (dt) {
    const end = V.t + dt;
    /* CSS transitions/animations and WAAPI: the timeline is frozen, each running animation moves on by dt */
    const anims = document.getAnimations();
    for (let i = 0; i < anims.length; i++) { const an = anims[i]; if (an.playState === "running" || (an.pending && an.playState !== "paused")) { try { an.currentTime = (an.currentTime || 0) + dt * (an.playbackRate || 1); } catch (e) {} } }
    for (let g = 0; g < 5000; g++) {
      V.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const x = V.timers[0]; if (!x || x.at > end) break;
      V.t = Math.max(V.t, x.at);
      if (x.rep) x.at += x.rep; else V.timers.shift();
      try { if (typeof x.fn === "function") x.fn.apply(window, x.a); } catch (e) { console.error("timer: " + e.message); }
    }
    V.t = end;
    if (V.scrollAnim) { const s = V.scrollAnim, u = Math.min(1, (V.t - s.t0) / s.dur); rs(0, Math.round(s.y0 + (s.y1 - s.y0) * eio(u))); if (u >= 1) V.scrollAnim = null; }
    const list = V.rafs; V.rafs = [];
    for (let i = 0; i < list.length; i++) { try { list[i].fn(T0 + V.t); } catch (e) { console.error("raf: " + e.message); } }
  };
  /* the fingertip shown in the film */
  V.finger = function (x, y, a, press) {
    let f = document.getElementById("__dito");
    if (!f) { f = document.createElement("div"); f.id = "__dito"; f.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(255,255,255,.42);box-shadow:0 0 0 1.5px rgba(255,255,255,.75),0 2px 10px rgba(0,0,0,.25);top:0;left:0;opacity:0;"; (document.body || document.documentElement).appendChild(f); }
    f.style.left = x + "px"; f.style.top = y + "px"; f.style.opacity = String(a); f.style.transform = "scale(" + (press ? 0.82 : 1) + ")";
  };
})();
