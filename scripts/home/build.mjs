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
