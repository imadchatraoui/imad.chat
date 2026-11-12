// Prepara la home online e la scrive in public/home.
// Parte dal disegno scelto (docs/anteprime/c-widget) con sopra la nuova intro (docs/anteprime/intro), versione «stella».
// Toglie ciò che nelle anteprime è finto o di servizio: le barre "anteprima", i saluti di esempio,
// le parole di esempio sulle stelle, il pulsante Instagram senza indirizzo.
// Uso: node scripts/home/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const home = path.join(root, "docs/anteprime/c-widget");
const intro = path.join(root, "docs/anteprime/intro");
const out = path.join(root, "public/home");
const swap = (text, from, to, file) => {
  if (!text.includes(from)) throw new Error(`${file}: non trovo «${from.slice(0, 60)}»`);
  return text.replace(from, to);
};

let html = fs.readFileSync(path.join(intro, "index.html"), "utf8");
html = swap(html, "<title>imad.chat — anteprima dell'intro</title>", `<title>imad.chat</title>
<meta name="description" content="imad.chat, il sito di Imad Chatraoui: il Corano, le città adesso, la Palestina, il cielo vero sopra Torino, un cubo di Rubik.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="imad.chat">
<meta property="og:title" content="imad.chat">
<meta property="og:description" content="Il sito di Imad Chatraoui">`, "index.html");
html = swap(html, '<meta name="robots" content="noindex">\n', "", "index.html");
html = html.split("../c-widget/").join("/home/");
html = swap(html, '<link rel="stylesheet" href="intro.css">', '<link rel="stylesheet" href="/home/intro.css">', "index.html");
html = swap(html, '<script src="intro.js"></script>', '<script>window.__niMedia = "/home/media/";</script>\n<script src="/home/intro.js"></script>', "index.html");
// la barra di servizio dell'anteprima dell'intro non va online
const a = html.indexOf("<!-- barra di questa anteprima: non fa parte del design -->");
const b = html.indexOf("</aside>", a);
if (a < 0 || b < 0) throw new Error("index.html: non trovo la barra dell'anteprima dell'intro");
html = html.slice(0, a) + html.slice(b + "</aside>".length).replace(/^\s*\n/, "");
if (/128/.test(html)) throw new Error("index.html: c'è ancora un numero di saluti di esempio");

let app = fs.readFileSync(path.join(home, "app.js"), "utf8");
app = swap(app, "function wordStars() {", 'function wordStars() { return ""; }\n  function wordStarsEsempio() {', "app.js");
app = swap(app, "Il tuo saluto resta su questo telefono, in questa anteprima.", "Il tuo saluto resta su questo telefono, per ora.", "app.js");
app = swap(app, "Scegli un saluto: la tua stella si accende tra le altre.", "Scegli un saluto: la tua stella si accende nel cielo.", "app.js");

let data = fs.readFileSync(path.join(home, "data.js"), "utf8");
data = swap(data, '"sampleStars": 128', '"sampleStars": 0', "data.js");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "media"), { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(path.join(out, "app.js"), app);
fs.writeFileSync(path.join(out, "data.js"), data);
for (const f of ["style.css", "astro-lite.js"]) fs.copyFileSync(path.join(home, f), path.join(out, f));
for (const f of ["intro.css", "intro.js"]) fs.copyFileSync(path.join(intro, f), path.join(out, f));
for (const f of fs.readdirSync(path.join(intro, "media"))) fs.copyFileSync(path.join(intro, "media", f), path.join(out, "media", f));
console.log("public/home pronta:", fs.readdirSync(out).join(", "), "| media:", fs.readdirSync(path.join(out, "media")).length, "immagini");

// ------------------------------------------------------------------ la casa nuova: /anteprima (non indicizzata)
// Sorgente: docs/anteprime/casa/home (la casa) e ogni docs/anteprime/casa/<nome>/ con un index.html (le pagine interne, anche
// annidate: casa/mondo/<luogo>/index.html). Le pagine si aprono così come sono da un server statico su docs/anteprime
// (node docs/anteprime/casa/strumenti/servi.mjs), con indirizzi relativi; qui gli indirizzi diventano assoluti PER REGOLA e si copiano
// i file a cui portano, così un file nuovo non chiede di cambiare la build. La regola, per ogni pagina HTML:
//   - si leggono src, href, poster e ogni data-* che comincia con ./ o ../ ; gli indirizzi con uno schema (https:, data:, mailto:),
//     quelli che cominciano con / # o ? restano come sono;
//   - l'indirizzo si risolve rispetto al file sorgente e prende il posto della tabella POSTI qui sotto (il prefisso più lungo vince);
//     un link a casa/<nome>/index.html diventa l'indirizzo della pagina (BASE/<nome>), anche se quella pagina non c'è ancora;
//   - un indirizzo che finisce con / è una cartella: si copia tutta (es. media/); la cartella media/ di ogni pagina si copia sempre;
//   - nei CSS copiati, url(...) e @import relativi seguono la stessa regola;
//   - gli indirizzi scritti dentro gli script NON si toccano: mettili in un attributo (data-media="../x/") e leggili da lì;
//   - <!-- solo anteprima --> ... <!-- /solo anteprima --> sparisce; con BASE "/" sparisce anche il noindex.
// Si ferma con un errore se resta un indirizzo relativo, se un file non c'è, o se c'è un numero di esempio.
{
  const BASE = "/anteprima";     // l'indirizzo della casa e il prefisso delle pagine; "/" il giorno che sostituisce la home
  const DIR = "anteprima";       // la cartella in public/: i file si servono da /anteprima/... anche quando BASE sarà "/"
  const A = path.join(root, "docs/anteprime");
  const PUB = path.join(root, "public", DIR);
  const POSTI = [                // sorgente (dentro docs/anteprime) → posto (dentro /DIR/)
    ["casa/home/", ""],
    ["casa/comune/", "comune/"],
    ["casa/tools/qr/", "qr/"],    // il motore QR (e le sue librerie in vendor/)
    ["intro/", "intro/"],
    ["gatto/", "dot/"],           // Dot: rig, aspetto, scena, suoni, fx, cervello, media/
    ["shared/", "dati/"],         // data.js, astro-lite.js
  ].sort((x, y) => y[0].length - x[0].length);
  const posix = (p) => p.split(path.sep).join("/");
  const pageUrl = (rel) => { const sub = rel.replace(/^casa\//, "").replace(/(^|\/)index\.html$/, "").replace(/\/$/, ""); return sub === "home" ? BASE : (BASE === "/" ? "" : BASE) + "/" + sub; };
  // le pagine: casa/home e ogni casa/<nome>/.../index.html (mai gli strumenti, le librerie, le cartelle media)
  const pages = [];
  (function walk(dir, depth) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (depth < 3 && !["strumenti", "vendor", "media", "comune"].includes(e.name)) walk(path.join(dir, e.name), depth + 1); continue; }
      if (e.name === "index.html") pages.push(path.join(dir, e.name));
    }
  })(path.join(A, "casa"), 0);
  if (!pages.some((f) => posix(path.relative(A, f)) === "casa/home/index.html")) throw new Error("casa: manca docs/anteprime/casa/home/index.html");
  const copies = new Map();      // destinazione → sorgente
  const warns = [];
  function place(abs, isDir) {
    let rel = posix(path.relative(A, abs)); if (isDir && !rel.endsWith("/")) rel += "/";
    if (rel.startsWith("../") || path.isAbsolute(rel)) throw new Error(`casa: un indirizzo porta fuori da docs/anteprime: ${abs}`);
    if (/^casa\/strumenti\//.test(rel)) throw new Error(`casa: gli strumenti non vanno online: ${rel}`);
    const hit = POSTI.find(([pre]) => rel.startsWith(pre));
    let sub;
    if (hit) sub = hit[1] + rel.slice(hit[0].length);
    else if (/^casa\/[^/]+\//.test(rel)) sub = rel.slice("casa/".length);
    else throw new Error(`casa: «${rel}» non ha un posto online (aggiungilo a POSTI in scripts/home/build.mjs)`);
    return { url: "/" + DIR + "/" + sub, out: path.join(PUB, sub) };
  }
  function want(src, out) {
    if (!fs.existsSync(src)) throw new Error(`casa: il file non c'è: ${posix(path.relative(root, src))}`);
    const was = copies.get(out); if (was && was !== src) throw new Error(`casa: due file nello stesso posto: ${posix(path.relative(root, out))}`);
    copies.set(out, src);
  }
  function wantDir(src, out) {
    if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) throw new Error(`casa: la cartella non c'è: ${posix(path.relative(root, src))}`);
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory()) wantDir(path.join(src, e.name), path.join(out, e.name)); else want(path.join(src, e.name), path.join(out, e.name));
    }
  }
  const isRel = (v) => v !== "" && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(v);
  function rewrite(v, fromFile, asLink) {
    const m = v.match(/^([^?#]*)([?#].*)?$/), p = m[1], tail = m[2] || "";
    const abs = path.resolve(path.dirname(fromFile), p), rel = posix(path.relative(A, abs));
    if (asLink && /^casa\/(?:[^/]+\/)*index\.html$/.test(rel) || asLink && /^casa\/[^.]+\/?$/.test(rel) && !fs.existsSync(abs)) {
      if (!fs.existsSync(abs)) warns.push(`${posix(path.relative(A, fromFile))}: porta a ${rel}, che non c'è ancora (online: ${pageUrl(rel)})`);
      return pageUrl(rel) + tail;
    }
    const dir = p.endsWith("/"), pl = place(abs, dir);
    if (dir) wantDir(abs, pl.out); else want(abs, pl.out);
    return pl.url + (dir && !pl.url.endsWith("/") ? "/" : "") + tail;
  }
  // le pagine
  const built = [];
  for (const file of pages) {
    const rel = posix(path.relative(A, file));
    let h = fs.readFileSync(file, "utf8");
    h = h.replace(/<!-- solo anteprima -->[\s\S]*?<!-- \/solo anteprima -->\n?/g, "");
    if (BASE === "/") h = h.replace(/<meta name="robots" content="noindex[^"]*">\n?/, "");
    else if (!/<meta name="robots" content="noindex/.test(h)) throw new Error(`casa: ${rel}: manca <meta name="robots" content="noindex"> (le anteprime non si indicizzano)`);
    h = h.replace(/(\s)(src|href|poster|data-[a-z0-9-]+)="([^"]*)"/g, (all, sp, attr, v) => {
      if (attr.startsWith("data-") && !/^\.\.?\//.test(v)) return all;
      if (!isRel(v)) return all;
      return `${sp}${attr}="${rewrite(v, file, attr === "href")}"`;
    });
    const left = h.match(/\s(?:src|href|poster|srcset)="(?![a-z][a-z0-9+.-]*:|\/|#|\?)[^"]+"/gi);
    if (left) throw new Error(`casa: ${rel}: indirizzi ancora relativi: ${left.join(" ")}`);
    const sample = h.replace(/<!--[\s\S]*?-->/g, "").match(/\b\d+\s+(?:saluti|contributi|commit|progetti|stelle|visite)\b/i);
    if (sample) throw new Error(`casa: ${rel}: un numero di esempio nella pagina: «${sample[0]}»`);
    const sub = rel.replace(/^casa\//, "").replace(/^home\//, "");
    const media = path.join(path.dirname(file), "media");
    if (fs.existsSync(media)) wantDir(media, path.join(PUB, path.dirname(sub), "media"));
    built.push({ out: path.join(PUB, sub), html: h, rel });
  }
  // i CSS: url(...) e @import relativi, per la stessa regola
  const cssOut = new Map();
  for (const [out, src] of copies) {
    if (!out.endsWith(".css")) continue;
    let c = fs.readFileSync(src, "utf8");
    c = c.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (all, q, v) => (isRel(v) && !v.startsWith("data:") ? `url(${q}${rewrite(v, src, false)}${q})` : all));
    c = c.replace(/@import\s+(["'])([^"']+)\1/g, (all, q, v) => (isRel(v) ? `@import ${q}${rewrite(v, src, false)}${q}` : all));
    cssOut.set(out, c);
  }
  // si scrive: tutto da capo
  fs.rmSync(PUB, { recursive: true, force: true });
  for (const [out, src] of copies) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (cssOut.has(out)) { fs.writeFileSync(out, cssOut.get(out)); continue; }
    if (posix(path.relative(A, src)) === "shared/data.js") {
      // i dati delle anteprime hanno un numero di stelle di esempio: online non c'è
      const d = fs.readFileSync(src, "utf8").replace(/"sampleStars":\s*\d+/, '"sampleStars": 0');
      fs.writeFileSync(out, d); continue;
    }
    fs.copyFileSync(src, out);
  }
  for (const b2 of built) { fs.mkdirSync(path.dirname(b2.out), { recursive: true }); fs.writeFileSync(b2.out, b2.html); }
  for (const [out] of copies) if (out.endsWith(".js") && /"sampleStars":\s*[1-9]/.test(fs.readFileSync(out, "utf8"))) throw new Error(`casa: ${posix(path.relative(root, out))}: c'è ancora un numero di stelle di esempio`);
  for (const w of warns) console.log("  avviso:", w);
  console.log(`public/${DIR} pronta (${BASE}):`, built.map((b2) => pageUrl(b2.rel)).join(", "), `| ${copies.size} file`);
}

// ------------------------------------------------------------------ l'anteprima di Dot, il gatto: /gatto (non indicizzata)
// Copia la pagina di docs/anteprime/gatto e i suoi file; gli indirizzi diventano assoluti (/gatto/...),
// perché la pagina si apre anche come /gatto, senza barra finale. Le pagine di prova (prova, scena, tavola) non vanno online.
{
  const src = path.join(root, "docs/anteprime/gatto");
  const dst = path.join(root, "public/gatto");
  const G = "/gatto/";
  const scripts = fs.readdirSync(src).filter((f) => /^(dot|look)-[a-z]+\.js$/.test(f)).sort();
  let h = fs.readFileSync(path.join(src, "index.html"), "utf8");
  h = swap(h, '<link rel="stylesheet" href="gatto.css">', `<link rel="stylesheet" href="${G}gatto.css">`, "gatto index.html");
  h = swap(h, 'window.DOT.mediaBase = "media/";', `window.DOT.mediaBase = "${G}media/";`, "gatto index.html");
  for (const f of scripts) if (h.includes(`<script src="${f}"></script>`)) h = swap(h, `<script src="${f}"></script>`, `<script src="${G}${f}"></script>`, "gatto index.html");
  const left = h.match(/(?:src|href)="(?!https?:|\/|#|data:)[^"]+"/g);
  if (left) throw new Error("gatto index.html: indirizzi ancora relativi: " + left.join(" "));
  if (!h.includes('<meta name="robots" content="noindex')) throw new Error("gatto index.html: manca noindex");
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.join(dst, "media"), { recursive: true });
  fs.writeFileSync(path.join(dst, "index.html"), h);
  for (const f of ["gatto.css", ...scripts]) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  for (const f of fs.readdirSync(path.join(src, "media"))) fs.copyFileSync(path.join(src, "media", f), path.join(dst, "media", f));
  console.log("public/gatto pronta:", fs.readdirSync(dst).join(", "), "| media:", fs.readdirSync(path.join(dst, "media")).length, "file");
}
