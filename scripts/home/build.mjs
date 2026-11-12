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

// ------------------------------------------------------------------ l'anteprima della bento nuova: /anteprima (non indicizzata)
// Stessa intro, ma atterra sui riquadri nuovi (docs/anteprime/bento). Qui l'intro si innesta a programma nella pagina.
{
  const bento = path.join(root, "docs/anteprime/bento");
  const dst = path.join(root, "public/anteprima");
  const B = "/anteprima/";
  let h = fs.readFileSync(path.join(bento, "index.html"), "utf8");
  // lo script che decide, prima del primo disegno, se l'intro parte: è quello dell'anteprima dell'intro
  const introPage = fs.readFileSync(path.join(intro, "index.html"), "utf8");
  const pre = introPage.slice(introPage.indexOf("<script>"), introPage.indexOf("</script>") + "</script>".length);
  const s0 = h.indexOf("<script>"), s1 = h.indexOf("</script>") + "</script>".length;
  h = h.slice(0, s0) + pre + h.slice(s1);
  h = swap(h, "<title>imad.chat — anteprima della bento</title>", "<title>imad.chat — anteprima</title>", "bento");
  for (const f of ["style.css", "vivo.css"]) h = swap(h, `<link rel="stylesheet" href="${f}">`, `<link rel="stylesheet" href="${B}${f}">`, "bento");
  h = swap(h, `<link rel="stylesheet" href="${B}vivo.css">`, `<link rel="stylesheet" href="${B}vivo.css">\n<link rel="stylesheet" href="${B}intro.css">`, "bento");
  for (const f of ["data.js", "astro-lite.js", "app.js", "terra.js", "vivo.js"]) h = swap(h, `<script src="${f}"></script>`, `<script src="${B}${f}"></script>`, "bento");
  h = swap(h, `<script src="${B}vivo.js"></script>`, `<script src="${B}vivo.js"></script>\n<script>window.__niMedia = "${B}media/";</script>\n<script src="${B}intro.js"></script>`, "bento");
  h = swap(h, 'src="media/torino.jpg"', `src="${B}media/torino.jpg"`, "bento");
  h = swap(h, "<!-- barra dell'anteprima: non fa parte del design -->", '<!-- la nuova apertura: una tela sopra la pagina -->\n<canvas class="ni" id="ni" aria-hidden="true"></canvas>\n\n<!-- barra della vecchia anteprima: resta nel codice, è nascosta -->', "bento");
  h = swap(h, '<span><b class="js-count num">128</b> saluti nel cielo</span>', '<span><b class="js-count num"></b></span>', "bento");
  if (/128/.test(h)) throw new Error("bento: c'è ancora un numero di saluti di esempio");
  let a2 = fs.readFileSync(path.join(bento, "app.js"), "utf8");
  a2 = swap(a2, "function wordStars() {", 'function wordStars() { return ""; }\n  function wordStarsEsempio() {', "bento app.js");
  a2 = swap(a2, "Il tuo saluto resta su questo telefono, in questa anteprima.", "Il tuo saluto resta su questo telefono, per ora.", "bento app.js");
  a2 = swap(a2, "Scegli un saluto: la tua stella si accende tra le altre.", "Scegli un saluto: la tua stella si accende nel cielo.", "bento app.js");
  let d2 = swap(fs.readFileSync(path.join(bento, "data.js"), "utf8"), '"sampleStars": 128', '"sampleStars": 0', "bento data.js");
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.join(dst, "media"), { recursive: true });
  fs.writeFileSync(path.join(dst, "index.html"), h);
  fs.writeFileSync(path.join(dst, "app.js"), a2);
  fs.writeFileSync(path.join(dst, "data.js"), d2);
  for (const f of ["style.css", "vivo.css", "vivo.js", "terra.js", "astro-lite.js"]) fs.copyFileSync(path.join(bento, f), path.join(dst, f));
  for (const f of ["intro.css", "intro.js"]) fs.copyFileSync(path.join(intro, f), path.join(dst, f));
  for (const dir of [path.join(intro, "media"), path.join(bento, "media")]) for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(dst, "media", f));
  console.log("public/anteprima pronta:", fs.readdirSync(dst).join(", "));
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
