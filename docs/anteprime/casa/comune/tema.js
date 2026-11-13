/* imad.chat, il tema: primo script della pagina (CASA.md 2f A). ES2017 */
(function () {
"use strict";
var W = window, d = document, R = d.documentElement, K = "imad.tema", mm = W.matchMedia && W.matchMedia.bind(W),
ph, st, keep = 1, fans = [], qs = [], was, q, pend, V = 0, AE = "addEventListener";
function ls(f) { try { return f(localStorage); } catch (e) { } }
try { ph = mm("(prefers-color-scheme: dark)"); q = new URLSearchParams(location.search).get("theme"); } catch (e) { }
st = ls(function (l) { return l.getItem(K); });
if (q === "light" || q === "dark") { st = q === "dark" ? "scuro" : "chiaro"; keep = 0; }
if (!/^(chiaro|scuro)$/.test(st)) st = "auto";
function phoneDark() { return !!(ph && ph.matches); }
function dk(s) { return s === "auto" ? phoneDark() : s === "scuro"; }
function dark() { return dk(st); }
function nop() { }
function each(a, f) { a.slice().forEach(function (x) { try { f(x); } catch (e) { console.error(e); } }); }
function Q(m, k) { this.media = m; this.k = k; this.l = []; }
var P = Q.prototype, df = Object.defineProperty;
df(P, "matches", { get: function () { return dark() === this.k; } });
df(P, "onchange", { get: function () { return this._o || null; }, set: function (f) { this._o = f; reg(this); } });
function reg(o) { if (qs.indexOf(o) < 0) qs.push(o); }
P[AE] = function (t, f) { if (t === "change" && f && this.l.indexOf(f) < 0) { this.l.push(f); reg(this); } };
P.removeEventListener = function (t, f) { var i = this.l.indexOf(f); if (i >= 0) this.l.splice(i, 1); };
P.addListener = function (f) { this[AE]("change", f); };
if (mm) W.matchMedia = function (m) {
var x = /^\s*\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)\s*$/i.exec(m);
return x ? new Q(String(m), /k/i.test(x[1])) : mm(m);
};
function metas() {
var ms = d.querySelectorAll('meta[name="theme-color"]'), c = [], i, m;
for (i = 0; (m = ms[i]); i++) { m.c = m.c || m.content; c[+/dark/.test(m.media)] = m.c; }
for (i = 0; (m = ms[i]); i++) m.content = st === "auto" ? m.c : c[+dark()] || m.c;
}
function apply(s0) {
var k = dark();
if (st === "auto") R.removeAttribute("data-theme"); else R.setAttribute("data-theme", k ? "dark" : "light");
metas();
if (k !== was) each(qs, function (o) {
var ev = { type: "change", matches: o.matches, media: o.media };
each(o._o ? [o._o].concat(o.l) : o.l, function (f) { f.call ? f.call(o, ev) : f.handleEvent(ev); });
});
if (k !== was || s0 !== st) each(fans, function (f) { f({ state: st, dark: k }); });
was = k;
}
apply(st);
d[AE]("DOMContentLoaded", metas);
function onPh() { if (st === "auto") apply(st); }
if (ph) { if (ph[AE]) ph[AE]("change", onPh); else ph.addListener(onPh); }
function change(go, o) {
var f = o && o.from, c = R.classList, r, a, vt, end, cl = function () { V = 0; c.remove("tema-vt"); };
/* un cambio durante il cerchio: il cerchio salta, il nuovo tema subito dopo */
if (V) { try { V.skipTransition(); } catch (e) { } return (V.updateCallbackDone || V.finished).then(go, go); }
if (!f || !d.startViewTransition || /ni-on|is-shot/.test(R.className) || mm("(prefers-reduced-motion: reduce)").matches) return go();
r = f.getBoundingClientRect(); a = "px at " + (r.left + r.width / 2) + "px " + (r.top + r.height / 2) + "px)";
c.add("tema-vt");
end = function () { if (V === vt) cl(); };
try {
V = vt = d.startViewTransition(go);
vt.ready.then(function () { try {
R.animate({ clipPath: ["circle(0" + a, "circle(" + Math.hypot(innerWidth, innerHeight) + a] },
{ duration: 560, easing: getComputedStyle(R).getPropertyValue("--molla-piana").trim() || "ease", pseudoElement: "::view-transition-new(root)" });
} catch (e) { } }, nop);
vt.finished.then(end, end);
} catch (e) { cl(); go(); }
}
function set(s, o) {
if (!/^(auto|chiaro|scuro)$/.test(s)) return st;
pend = s;
change(function () { var s0 = st; st = s; pend = 0; if (keep) ls(function (l) { if (s === "auto") l.removeItem(K); else l.setItem(K, s); }); apply(s0); }, o);
return s;
}
W.TEMA = { get: function () { return st; }, dark: dark, phoneDark: phoneDark, set: set,
flip: function (o) { var k = !dk(pend || st); return set(k === phoneDark() ? "auto" : k ? "scuro" : "chiaro", o); },
on: function (f) { if (f && f.call) fans.push(f); },
off: function (f) { var i = fans.indexOf(f); if (i >= 0) fans.splice(i, 1); },
vt: function () { return V || null; } };
})();
