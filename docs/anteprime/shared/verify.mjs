// Controllo automatico delle regole fisse su un'anteprima. Non sostituisce gli occhi: li affianca.
// Uso: node shared/verify.mjs <cartella-variante> [--t 2026-11-11T15:50:00Z]
//      node docs/anteprime/shared/verify.mjs --base http://localhost:3000 --repo . [--t ...]   (il sito vero, in esecuzione)
// Esce con codice 2 se ci sono BLOCCHI (regole fisse violate), 0 altrimenti. Gli AVVISI vanno letti e valutati.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : "");
const BASE = opt("--base");            // sito in esecuzione (es. http://localhost:3000): niente server statico, niente controlli sui file
const REPO = opt("--repo");            // cartella del repository: l'arabo ammesso si legge da content/astro invece che da data.js
const dir = path.resolve(BASE ? "." : args[0] || ".");
const T = args.includes("--t") ? args[args.indexOf("--t") + 1] : "2026-11-11T15:50:00Z";
const here = path.dirname(new URL(import.meta.url).pathname);
const astro = require(path.join(here, "astro-lite.js"));
const dataSrc = fs.readFileSync(path.join(here, "data.js"), "utf8");
const DATA = JSON.parse(dataSrc.slice(dataSrc.indexOf("{"), dataSrc.lastIndexOf("}") + 1));
if (REPO) {
  const items = (f) => JSON.parse(fs.readFileSync(path.join(path.resolve(REPO), "content/astro", f), "utf8")).items;
  DATA.verses = items("verses.json");
  DATA.stars = items("stars.json");
  DATA.cities = items("cities.json");
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let file = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
if (!BASE) await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = BASE ? BASE.replace(/\/?$/, "/") : `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const blocks = [], warns = [];
const block = (m) => blocks.push(m), warn = (m) => warns.push(m);

// ---- controlli statici sui file
const files = BASE ? [] : fs.readdirSync(dir).filter((f) => /\.(html|css|js)$/.test(f) && !["data.js", "astro-lite.js"].includes(f));
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const it = src.match(/font-style\s*:\s*(italic|oblique)/gi);
  if (it) block(`file: ${f}: font-style italic/oblique nel codice (${it.length} volte)`);
  if (/[؀-ۿݐ-ݿﭐ-ﷹﷻ-﷿ﹰ-﻿]/.test(src)) block(`file: ${f}: testo arabo scritto nel file (deve arrivare solo da IMAD_DATA via script)`);
  const emoji = src.match(/\p{Extended_Pictographic}/gu);
  if (emoji) { const set = [...new Set(emoji)].filter((c) => !/[©®™]/.test(c)); if (set.length) warn(`file: ${f}: caratteri pittografici nel codice: ${set.join(" ")} (usa SVG)`); }
  if (/<(em|i|cite|address|dfn|var)[\s>]/i.test(src) && !/font-style\s*:\s*normal/i.test(fs.readFileSync(path.join(dir, files.find((x) => x.endsWith(".css")) || f), "utf8"))) warn(`file: ${f}: tag che nascono corsivi (em/i/cite...) senza reset font-style: normal`);
}

const IN_PAGE = (DATA_JSON) => {
  const DATA = JSON.parse(DATA_JSON);
  const out = { blocks: [], warns: [] };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
  const sel = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += "#" + el.id; if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\s+/).slice(0, 2).join("."); return s; };
  const AR = /[؀-ۿݐ-ݿﭐ-ﷹﷻ-﷿ﹰ-﻿]/;
  const verses = DATA.verses.map((v) => v.ar), known = new Set([...verses, ...DATA.cities.map((c) => c.ar), ...DATA.stars.map((s) => s.ar)].filter(Boolean));
  // corsivo
  const italics = [...document.querySelectorAll("body *")].filter((el) => visible(el) && getComputedStyle(el).fontStyle !== "normal" && el.textContent.trim());
  if (italics.length) out.blocks.push(`corsivo calcolato su ${italics.length} elementi, es. ${italics.slice(0, 3).map(sel).join(", ")}`);
  // arabo
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!AR.test(n.nodeValue)) continue;
    const el = n.parentElement; if (seen.has(el)) continue; seen.add(el);
    const holder = el.closest('[lang^="ar"]');
    const text = (holder || el).textContent.trim();
    if (!holder) out.blocks.push(`testo arabo fuori da un elemento lang="ar": ${sel(el)}`);
    if (!known.has(text)) out.blocks.push(`testo arabo che non coincide con i dati (${sel(holder || el)}): "${text.slice(0, 40)}…"`);
    if (verses.includes(text)) {
      const h = holder || el, s = getComputedStyle(h);
      if (!/Amiri Quran/i.test(s.fontFamily)) out.blocks.push(`versetto non in Amiri Quran (${sel(h)}): ${s.fontFamily.slice(0, 60)}`);
      if (s.direction !== "rtl") out.blocks.push(`versetto senza dir rtl (${sel(h)})`);
      if (s.letterSpacing !== "normal" && s.letterSpacing !== "0px") out.blocks.push(`letter-spacing sul versetto (${sel(h)})`);
      if (s.textShadow !== "none") out.blocks.push(`text-shadow sul versetto (${sel(h)})`);
      if (s.webkitBackgroundClip === "text" || s.backgroundClip === "text") out.blocks.push(`gradiente nel testo del versetto (${sel(h)})`);
      if (s.textOverflow === "ellipsis" || (s.webkitLineClamp && s.webkitLineClamp !== "none")) out.blocks.push(`versetto troncabile: ellipsis/line-clamp (${sel(h)})`);
      for (let a = h; a && a !== document.body; a = a.parentElement) { const as = getComputedStyle(a); if ((as.overflowY === "hidden" || as.overflow === "hidden") && a.scrollHeight - a.clientHeight > 2 && visible(h)) { const hr = h.getBoundingClientRect(), ar = a.getBoundingClientRect(); if (hr.bottom > ar.bottom + 1 || hr.top < ar.top - 1) out.blocks.push(`versetto tagliato dal contenitore ${sel(a)}`); } }
      if (s.animationName !== "none") out.warns.push(`animazione sul versetto (${sel(h)}): ${s.animationName}`);
    }
  }
  // emoji nel testo visibile
  const txt = document.body.innerText;
  const pict = [...new Set(txt.match(/\p{Extended_Pictographic}/gu) || [])];
  if (pict.length) out.blocks.push(`caratteri pittografici/emoji nel testo: ${pict.join(" ")}`);
  // città
  for (const c of DATA.cities) if (!txt.includes(c.name)) out.warns.push(`manca la città ${c.name} nel testo della pagina`);
  for (const old of ["Istanbul", "Samarcanda", "Kyoto", "Cusco", "Al-Quds", "Fès", "Fes ", "Gerusalemme"]) if (txt.includes(old)) out.blocks.push(`città tolta ancora presente: ${old}`);
  // testo piccolo, bersagli piccoli
  const small = new Set();
  const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w2.nextNode(); n; n = w2.nextNode()) { const el = n.parentElement; if (!n.nodeValue.trim() || !visible(el)) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.5) small.add(`${sel(el)} ${fs}px "${n.nodeValue.trim().slice(0, 24)}"`); }
  if (small.size) out.warns.push(`testo sotto 12px: ${[...small].slice(0, 8).join(" | ")}${small.size > 8 ? ` (+${small.size - 8})` : ""}`);
  const tiny = [...document.querySelectorAll('button, a[href], [role="button"], input, select, [tabindex]:not([tabindex="-1"])')].filter(visible).filter((el) => { const r = el.getBoundingClientRect(); return (r.width < 43.5 || r.height < 43.5) && !(el.tagName === "A" && getComputedStyle(el).display === "inline"); });
  if (tiny.length) out.warns.push(`bersagli sotto 44px: ${tiny.slice(0, 8).map((el) => { const r = el.getBoundingClientRect(); return `${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; }).join(" | ")}${tiny.length > 8 ? ` (+${tiny.length - 8})` : ""}`);
  // contrasto (solo su sfondi a tinta unita: stima)
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const low = new Set();
  const w3 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w3.nextNode(); n; n = w3.nextNode()) {
    const el = n.parentElement; if (!n.nodeValue.trim() || !visible(el)) continue;
    const s = getComputedStyle(el); const fg = parse(s.color); if (!fg || fg.a < 0.99) continue;
    let bg = null, unsure = false;
    for (let a = el; a; a = a.parentElement) { const as = getComputedStyle(a); if (as.backgroundImage !== "none" || as.backdropFilter !== "none") { unsure = true; break; } const c = parse(as.backgroundColor); if (c && c.a > 0.99) { bg = c; break; } if (c && c.a > 0.01) { unsure = true; break; } }
    if (unsure || !bg) continue;
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const fs = parseFloat(s.fontSize), big = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5)) low.add(`${sel(el)} ${ratio.toFixed(2)}:1 "${n.nodeValue.trim().slice(0, 20)}"`);
  }
  if (low.size) out.warns.push(`contrasto basso su sfondo pieno: ${[...low].slice(0, 8).join(" | ")}${low.size > 8 ? ` (+${low.size - 8})` : ""}`);
  out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.ready = window.__ready === true;
  out.bodyFont = getComputedStyle(document.body).fontFamily;
  out.bg = getComputedStyle(document.body).backgroundColor;
  out.text = txt;
  return out;
};

async function visit(label, { width = 390, height = 844, theme = "dark", query = "", reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme, isMobile: true, hasTouch: true, reducedMotion: reduce ? "reduce" : "no-preference", locale: "it-IT", timezoneId: "Europe/Rome" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => block(`${label}: errore di pagina: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") block(`${label}: errore in console: ${m.text().slice(0, 160)}`); });
  let res = null;
  try {
    await page.goto(`${base}?shot=1&theme=${theme}&t=${encodeURIComponent(T)}${query}`, { waitUntil: "load", timeout: 45000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(900);
    res = await page.evaluate(IN_PAGE, JSON.stringify(DATA));
    for (const b of res.blocks) block(`${label}: ${b}`);
    for (const w of res.warns) warn(`${label}: ${w}`);
    if (res.overflow > 1) block(`${label}: la pagina scorre in orizzontale di ${res.overflow}px`);
    if (!res.ready) warn(`${label}: window.__ready non è true`);
  } catch (e) { block(`${label}: ${String(e.message || e).split("\n")[0]}`); }
  await ctx.close();
  return res;
}

const now = new Date(T);
const dark = await visit("telefono scuro", { theme: "dark" });
const light = await visit("telefono chiaro", { theme: "light" });
await visit("telefono 360", { width: 360, height: 740, theme: "dark" });
await visit("telefono 430", { width: 430, height: 932, theme: "light" });
await visit("computer", { width: 1440, height: 900, theme: "light" });
await visit("movimento ridotto", { theme: "dark", reduce: true });
for (const s of ["citta", "saluti", "corano"]) { await visit(`aperto ${s} scuro`, { theme: "dark", query: `&open=${s}` }); await visit(`aperto ${s} chiaro 360`, { width: 360, height: 740, theme: "light", query: `&open=${s}` }); }
if (dark && light && dark.bg === light.bg) warn(`tema: il colore di fondo è uguale in chiaro e in scuro (${dark.bg}): il parametro theme funziona?`);
if (dark) for (const c of DATA.cities) { const t = astro.localTime(now, c.tz); if (!dark.text.includes(t)) warn(`ore: ora attesa per ${c.name} (${t}) non trovata nella home a ${T}`); }
// i caratteri alternativi e la barra "anteprima" esistono solo nell'anteprima, non nel sito vero
for (const [key, fam] of BASE ? [] : [["inter", "Inter"], ["geist", "Geist"], ["manrope", "Manrope"], ["instrument", "Instrument Sans"], ["sistema", "system"]]) {
  const r = await visit(`carattere ${key}`, { width: 360, height: 740, theme: "light", query: `&font=${key}` });
  if (r && key !== "sistema" && !new RegExp(`^["']?${fam}`, "i").test(r.bodyFont)) warn(`caratteri: font=${key}: il corpo usa ${r.bodyFont.slice(0, 50)}`);
}
// la barra "anteprima" deve esserci senza shot=1
if (!BASE) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  try { await page.goto(`${base}?t=${encodeURIComponent(T)}`, { waitUntil: "load", timeout: 45000 }); await page.waitForTimeout(1500);
    const has = await page.evaluate(() => /anteprima/i.test(document.body.innerText)); if (!has) warn("barra: senza shot=1 non trovo la barra \"anteprima\"");
  } catch (e) { warn("barra: " + String(e.message).split("\n")[0]); }
  await ctx.close();
}
await browser.close(); if (!BASE) server.close();

// stesso messaggio in più viste: una riga sola, con l'elenco delle viste
const group = (list) => { const m = new Map(); for (const x of list) { const i = x.indexOf(": "); const label = x.slice(0, i), msg = x.slice(i + 2).replace(/\b\d+(\.\d+)?x\d+(\.\d+)?\b/g, "NxN"); if (!m.has(msg)) m.set(msg, { text: x.slice(i + 2), labels: [] }); if (!m.get(msg).labels.includes(label)) m.get(msg).labels.push(label); } return [...m.values()]; };
const show = (mark, g) => console.log(`  ${mark} ${g.text}  [${g.labels.length > 3 ? g.labels.slice(0, 3).join(", ") + ` e altre ${g.labels.length - 3} viste` : g.labels.join(", ")}]`);
const gb = group(blocks), gw = group(warns);
console.log(`\n== ${BASE || path.basename(dir)} a ${T}`);
console.log(`BLOCCHI (${gb.length}):`); for (const g of gb) show("✗", g);
console.log(`AVVISI (${gw.length}):`); for (const g of gw) show("!", g);
if (!blocks.length) console.log("nessun blocco: le regole fisse controllabili sono rispettate");
process.exitCode = blocks.length ? 2 : 0;
