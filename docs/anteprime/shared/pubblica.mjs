// Prepara un'anteprima per la pubblicazione come pagina viva (Artifact).
// La pagina diventa un frammento (senza doctype/html/head/body: lo scheletro lo mette chi pubblica); i file accanto restano tali.
// Scrive anche index.html: lo stesso frammento dentro uno scheletro uguale a quello di pubblicazione, per provarlo con capture/verify.
// Uso: node shared/pubblica.mjs <cartella-variante> <cartella-uscita> "<Titolo breve>" <nome-file-senza-estensione>
import fs from "node:fs";
import path from "node:path";

const [src, out, title = "imad.chat", slug = "pagina"] = process.argv.slice(2);
if (!src || !out) { console.error("uso: node shared/pubblica.mjs <cartella-variante> <cartella-uscita> \"<Titolo>\" <nome>"); process.exit(1); }
const html = fs.readFileSync(path.join(src, "index.html"), "utf8");
const between = (s, a, b) => { const i = s.indexOf(a), j = s.lastIndexOf(b); if (i < 0 || j < 0) throw new Error("manca " + a + " o " + b); return s.slice(s.indexOf(">", i) + 1, j); };
let head = between(html, "<head", "</head>");
const body = between(html, "<body", "</body>");
const lang = (html.match(/<html[^>]*\blang="([^"]+)"/) || [])[1] || "it";

// dallo head restano solo script e fogli di stile; charset, viewport, titolo e meta li mette lo scheletro o non servono in pagina
head = head
  .replace(/<meta\b[^>]*>\s*/g, "")
  .replace(/<title>[\s\S]*?<\/title>\s*/g, "")
  .trim();

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fragment = `<title>${esc(title)}</title>
<script>document.documentElement.lang = ${JSON.stringify(lang)};</script>
${head}
${body.trim()}
`;

// file accanto: tutto ciò che la pagina richiama con un percorso relativo
const refs = new Set();
for (const m of fragment.matchAll(/\b(?:src|href)="([^"#?]+)"/g)) {
  const u = m[1];
  if (/^(?:[a-z]+:)?\/\//i.test(u) || u.startsWith("data:") || u.startsWith("#")) continue;
  refs.add(u);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const files = {};
for (const u of refs) {
  const from = path.join(src, u);
  if (!fs.existsSync(from)) { console.error("ATTENZIONE: file richiamato ma assente: " + u); process.exitCode = 2; continue; }
  const to = path.join(out, u);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  files[u] = to;
}
const page = path.join(out, slug + ".html");
fs.writeFileSync(page, fragment);

// scheletro di prova: come quello che avvolge la pagina pubblicata
const skeleton = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${fragment}</body>
</html>
`;
fs.writeFileSync(path.join(out, "index.html"), skeleton);

const size = (f) => fs.statSync(f).size;
console.log(JSON.stringify({ page, bytes: size(page), files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, size(v)])) }, null, 1));
