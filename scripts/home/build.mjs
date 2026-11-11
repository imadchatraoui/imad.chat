// Prepara la home online a partire dal disegno scelto (docs/anteprime/c-widget) e la scrive in public/home.
// Toglie ciò che nell'anteprima è finto o di servizio: la barra "anteprima", il numero di saluti di esempio,
// le parole di esempio sulle stelle, il pulsante Instagram senza indirizzo.
// Uso: node scripts/home/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = path.join(root, "docs/anteprime/c-widget");
const out = path.join(root, "public/home");
const read = (f) => fs.readFileSync(path.join(src, f), "utf8");
const swap = (text, from, to, file) => {
  if (!text.includes(from)) throw new Error(`${file}: non trovo «${from.slice(0, 60)}»`);
  return text.replace(from, to);
};

let html = read("index.html");
html = swap(html, "<title>imad.chat — anteprima Widget</title>", `<title>imad.chat</title>
<meta name="description" content="hello, imad's world: il Corano, le città adesso, la Palestina, il cielo vero sopra Torino, un cubo di Rubik.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="imad.chat">
<meta property="og:title" content="imad.chat">
<meta property="og:description" content="hello, imad's world">`, "index.html");
html = swap(html, '<meta name="robots" content="noindex">\n', "", "index.html");
html = swap(html, '<link rel="stylesheet" href="style.css">', `<link rel="stylesheet" href="/home/style.css">
<style>
/* online: niente barra dell'anteprima, niente numeri di esempio, niente pulsante senza indirizzo */
.pv, .me__link, .btn[data-nolink], .saluti .count, .legend span:has(> i.g) { display: none !important; }
.sal__top { visibility: hidden !important; } /* lo spazio resta: lì si accende la stella del visitatore */
</style>`, "index.html");
for (const f of ["data.js", "astro-lite.js", "app.js"]) html = swap(html, `<script src="${f}"></script>`, `<script src="/home/${f}"></script>`, "index.html");
html = swap(html, '<span><b class="js-count num">128</b> saluti nel cielo</span>', "<span>Lascia un saluto</span>", "index.html");

let app = read("app.js");
app = swap(app, "function wordStars() {", 'function wordStars() { return ""; }\n  function wordStarsEsempio() {', "app.js");
app = swap(app, "Il tuo saluto resta su questo telefono, in questa anteprima.", "Il tuo saluto resta su questo telefono, per ora.", "app.js");
app = swap(app, "Scegli un saluto: la tua stella si accende tra le altre.", "Scegli un saluto: la tua stella si accende nel cielo.", "app.js");

let data = read("data.js");
data = swap(data, '"sampleStars": 128', '"sampleStars": 0', "data.js");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(path.join(out, "app.js"), app);
fs.writeFileSync(path.join(out, "data.js"), data);
for (const f of ["style.css", "astro-lite.js"]) fs.copyFileSync(path.join(src, f), path.join(out, f));
console.log("public/home pronta:", fs.readdirSync(out).join(", "));
