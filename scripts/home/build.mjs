// Prepara le pagine statiche del sito in public/ (Vercel non esegue questo script: public/ si committa).
// Uso: node scripts/home/build.mjs
//
// L'interruttore del cambio di casa è CASA_NUOVA in lib/site.ts (docs/anteprime/casa/CASA.md, sezione 7):
//   false (oggi): public/home, la home online a "/" (il disegno c-widget con l'intro «stella»), public/anteprima (la casa nuova,
//                 non indicizzata, a /anteprima) e public/gatto;
//   true:         public/casa, la casa nuova a "/" con le sue pagine alla radice, indicizzate, con i metadati veri;
//                 public/home e public/anteprima spariscono; public/gatto resta (la pagina di prova di Dot, non indicizzata).
// next.config.ts legge lo stesso interruttore e si ferma se public/ non è stata fatta con quello.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SITO = leggiSito();
const home = path.join(root, "docs/anteprime/c-widget");
const intro = path.join(root, "docs/anteprime/intro");
const out = path.join(root, "public/home");
const swap = (text, from, to, file) => {
  if (!text.includes(from)) throw new Error(`${file}: non trovo «${from.slice(0, 60)}»`);
  return text.replace(from, to);
};
// lib/site.ts, letto come testo (questo script è JavaScript semplice): l'interruttore e l'indirizzo pubblico
function leggiSito() {
  const src = fs.readFileSync(path.join(root, "lib/site.ts"), "utf8");
  const on = src.match(/^export const CASA_NUOVA = (true|false);/m);
  const host = src.match(/^export const SITE_HOST = "([a-z0-9.-]+)";/m);
  if (!on || !host) throw new Error("lib/site.ts: non trovo «export const CASA_NUOVA = true|false;» e «export const SITE_HOST = \"...\";» (una riga ciascuno)");
  return { casaNuova: on[1] === "true", host: host[1], url: "https://" + host[1] };
}
console.log(`interruttore: CASA_NUOVA = ${SITO.casaNuova} (lib/site.ts) · indirizzo: ${SITO.url}`);

// ------------------------------------------------------------------ la home di oggi: public/home (solo con CASA_NUOVA = false)
// Parte dal disegno scelto (docs/anteprime/c-widget) con sopra la nuova intro (docs/anteprime/intro), versione «stella».
// Toglie ciò che nelle anteprime è finto o di servizio: le barre "anteprima", i saluti di esempio,
// le parole di esempio sulle stelle, il pulsante Instagram senza indirizzo.
if (SITO.casaNuova) {
  fs.rmSync(out, { recursive: true, force: true });
  console.log("public/home: tolta (con la casa nuova a \"/\" non serve più)");
} else {
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
}

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
// Con CASA_NUOVA (lib/site.ts) la casa va a "/" (BASE "/") e i suoi file in public/casa (serviti da /casa/...), così /anteprima/...
// può portare tutto alla radice; ogni pagina riceve titolo, descrizione, indirizzo canonico, anteprima condivisa e icone (META, più
// sotto), e public/casa/pagine.json elenca le pagine per next.config.ts (gli indirizzi) e app/sitemap.ts.
{
  const BASE = SITO.casaNuova ? "/" : "/anteprima";  // l'indirizzo della casa e il prefisso delle pagine
  const DIR = SITO.casaNuova ? "casa" : "anteprima";  // la cartella in public/: i file si servono da /<DIR>/...
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
    // una libreria presa da fuori viaggia con la sua licenza (l'intestazione del file la indica): vendor/<nome>.js → vendor/<nome>.LICENSE
    if (path.basename(path.dirname(src)) === "vendor") {
      const lic = src.replace(/\.[^./\\]+$/, "") + ".LICENSE";
      if (lic !== src && fs.existsSync(lic)) want(lic, out.replace(/\.[^./\\]+$/, "") + ".LICENSE");
    }
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
  // Nel mondo: i testi di Imad (content/mondo/*.md, o la cartella in MONDO_DIR per le prove). Ogni testo diventa una pagina
  // da casa/mondo/pagina.html (online BASE/mondo/<nome>); l'indice casa/mondo/index.html li elenca dal più recente e il
  // riquadro della casa, al segno <!-- mondo:titoli -->, mostra i titoli e la data dell'ultimo. Senza testi non cambia niente.
  const mondo = leggiMondo(process.env.MONDO_DIR ? path.resolve(process.env.MONDO_DIR) : path.join(root, "content/mondo"));
  const MONDO_T = path.join(A, "casa/mondo/pagina.html");
  for (const t of mondo) if (t.media) want(t.media.src, path.join(PUB, "mondo/media", t.media.name));
  // le pagine (quelle dei testi di Imad si fanno dal modello: gli indirizzi si leggono rispetto al modello, che sta in casa/mondo/)
  const jobs = pages.map((file) => ({ file, rel: posix(path.relative(A, file)), text: fs.readFileSync(file, "utf8"), own: false }));
  if (mondo.length) {
    const tpl = fs.readFileSync(MONDO_T, "utf8");
    for (const t of mondo) jobs.push({ file: MONDO_T, rel: `casa/mondo/${t.slug}/index.html`, text: paginaMondo(tpl, t, DIR), own: true, t });
  }
  const built = [];
  for (const job of jobs) {
    const { file, rel } = job;
    let h = job.text;
    h = h.replace(/<!-- solo anteprima -->[\s\S]*?<!-- \/solo anteprima -->\n?/g, "");
    if (BASE === "/") h = h.replace(/<meta name="robots" content="noindex[^"]*">\n?/, "");
    else if (!/<meta name="robots" content="noindex/.test(h)) throw new Error(`casa: ${rel}: manca <meta name="robots" content="noindex"> (le anteprime non si indicizzano)`);
    if (SITO.casaNuova) h = metaPagina(h, pageUrl(rel), job);
    // il controllo dei numeri d'esempio vale per le nostre pagine, prima che ci entrino le parole di Imad (quelle sono sue)
    if (!job.own) {
      const sample0 = h.replace(/<!--[\s\S]*?-->/g, "").match(/\b\d+\s+(?:saluti|contributi|commit|progetti|stelle|visite)\b/i);
      if (sample0) throw new Error(`casa: ${rel}: un numero di esempio nella pagina: «${sample0[0]}»`);
    }
    if (mondo.length && rel === "casa/home/index.html") h = titoliMondo(h, mondo);
    if (mondo.length && rel === "casa/mondo/index.html") h = indiceMondo(h, mondo, BASE);
    h = h.replace(/(\s)(src|href|poster|data-[a-z0-9-]+)="([^"]*)"/g, (all, sp, attr, v) => {
      if (attr.startsWith("data-") && !/^\.\.?\//.test(v)) return all;
      if (!isRel(v)) return all;
      return `${sp}${attr}="${rewrite(v, file, attr === "href")}"`;
    });
    const left = h.match(/\s(?:src|href|poster|srcset)="(?![a-z][a-z0-9+.-]*:|\/|#|\?)[^"]+"/gi);
    if (left) throw new Error(`casa: ${rel}: indirizzi ancora relativi: ${left.join(" ")}`);
    if (/\{\{[a-z]+\}\}/.test(h.replace(/<!--[\s\S]*?-->/g, ""))) throw new Error(`casa: ${rel}: un segnaposto {{...}} non riempito`);
    const sub = rel.replace(/^casa\//, "").replace(/^home\//, "");
    const media = path.join(path.dirname(file), "media");
    if (!job.own && fs.existsSync(media)) wantDir(media, path.join(PUB, path.dirname(sub), "media"));
    if (SITO.casaNuova && /\s(?:src|href|content|data-[a-z0-9-]+)="[^"]*\/anteprima\b/.test(h)) throw new Error(`casa: ${rel}: un indirizzo porta ancora a /anteprima`);
    built.push({ out: path.join(PUB, sub), html: h, rel, data: job.t ? job.t.data : null });
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
  // si scrive: tutto da capo (e sparisce la cartella dell'altra posizione dell'interruttore)
  fs.rmSync(PUB, { recursive: true, force: true });
  fs.rmSync(path.join(root, "public", SITO.casaNuova ? "anteprima" : "casa"), { recursive: true, force: true });
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
  if (SITO.casaNuova) {
    // l'elenco delle pagine: next.config.ts ne fa gli indirizzi (/progetti → /casa/progetti/index.html), app/sitemap.ts la sitemap
    const pagine = built.map((b2) => ({ url: pageUrl(b2.rel), ...(b2.data ? { data: b2.data } : {}) }))
      .sort((x, y) => (x.url === "/" ? -1 : y.url === "/" ? 1 : x.url < y.url ? -1 : 1));
    fs.writeFileSync(path.join(PUB, "pagine.json"), JSON.stringify({ fatto_da: "scripts/home/build.mjs (non si scrive a mano)", pagine }, null, 1) + "\n");
  }
  for (const w of warns) console.log("  avviso:", w);
  console.log(`public/${DIR} pronta (${BASE}):`, built.map((b2) => pageUrl(b2.rel)).join(", "), `| ${copies.size} file`);
  console.log(mondo.length ? `  Nel mondo: ${mondo.length} testi (${mondo.map((t) => t.slug).join(", ")})` : "  Nel mondo: nessun testo ancora («Presto, con le parole di Imad.»)");
}

// ------------------------------------------------------------------ Nel mondo: i testi di Imad in Markdown → HTML sicuro
// Ogni file <nome>.md (non README.md) comincia con un'intestazione tra due righe «---»:
//   titolo: (obbligatorio)   data: AAAA-MM-GG (obbligatoria)   luogo:   immagine: (un file in media/ o un indirizzo https)
//   didascalia:   fonti: (poi una riga «- ...» per fonte: un indirizzo, [nome](indirizzo) o «nome: indirizzo»)   bozza: sì (resta fuori)
// Poi il testo in Markdown semplice: paragrafi (una riga vuota tra l'uno e l'altro; un a capo resta un a capo), titoli (#, ##, ###),
// elenchi (- oppure 1.), citazioni (>), una riga ---, **grassetto** e *enfasi* (tutte e due solo più pesanti: mai corsivo), `codice`,
// link [testo](https://...) e indirizzi nudi. Tutto il testo è protetto (&, <, >, " diventano entità): l'HTML scritto non passa,
// i link sono solo http e https. Un file sbagliato ferma la build con il nome del file e cosa manca.
function escHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function dataIt(iso) {
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const [y, m, d] = iso.split("-").map(Number); return `${d} ${MESI[m - 1]} ${y}`;
}
function corto(url) { return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, ""); }
// in linea: si protegge tutto, poi si riconoscono link, indirizzi, grassetto, enfasi, codice
function mdInline(src) {
  const parts = String(src).split(/(`[^`\n]+`)/);
  return parts.map((part) => {
    if (/^`[^`\n]+`$/.test(part)) return `<code>${escHtml(part.slice(1, -1))}</code>`;
    const keep = [];
    const hold = (html) => { keep.push(html); return `\u0000${keep.length - 1}\u0000`; };
    let s = escHtml(part);
    const link = (url, text) => hold(`<a href="${url}" target="_blank" rel="noopener">${text}</a>`);
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi, (all, text, url) => link(url, enfasi(text)));
    s = s.replace(/https?:\/\/[^\s<\u0000]+/gi, (url) => {
      const m = url.match(/^(.*?)([.,;:!?)\]]*)$/), u = m[1], tail = m[2];
      return u.length > 8 ? link(u, corto(u)) + tail : url;
    });
    s = enfasi(s);
    return s.replace(/\u0000(\d+)\u0000/g, (all, i) => keep[+i]);
  }).join("");
}
function enfasi(s) {
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>").replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?![\w])/g, "$1<strong>$2</strong>");
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/g, "$1<b>$2</b>").replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?![\w])/g, "$1<b>$2</b>");
  return s;
}
// a blocchi
function mdBlocks(text) {
  const lines = text.split("\n"), out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p dir="auto">${para.map(mdInline).join("<br>")}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], t = line.trim();
    if (!t) { flush(); continue; }
    let m;
    if ((m = t.match(/^(#{1,6})\s+(.+?)\s*#*$/))) { flush(); const tag = m[1].length <= 2 ? "h2" : "h3"; out.push(`<${tag} dir="auto">${mdInline(m[2])}</${tag}>`); continue; }
    if (/^(?:\*\s*){3,}$|^(?:-\s*){3,}$|^(?:_\s*){3,}$/.test(t)) { flush(); out.push("<hr>"); continue; }
    if (/^>/.test(t)) {
      flush(); const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      i--; out.push(`<blockquote>${mdBlocks(q.join("\n"))}</blockquote>`); continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/, ol = /^\s*(\d{1,9})[.)]\s+(.*)$/;
    if (ul.test(line) || ol.test(line)) {
      flush(); const ordered = !ul.test(line), re = ordered ? ol : ul, items = [];
      const start = ordered ? +line.match(ol)[1] : 1;
      while (i < lines.length) {
        const l = lines[i];
        if (re.test(l)) { items.push([l.match(re)[ordered ? 2 : 1]]); i++; continue; }
        if (l.trim() && /^\s{2,}\S/.test(l) && items.length) { items[items.length - 1].push(l.trim()); i++; continue; }
        break;
      }
      i--;
      const lis = items.map((it) => `<li dir="auto">${it.map(mdInline).join("<br>")}</li>`).join("");
      out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ""}>${lis}</ol>` : `<ul>${lis}</ul>`); continue;
    }
    para.push(t);
  }
  flush();
  return out.join("\n");
}
function slugMondo(name) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function leggiMondo(dir) {
  if (!fs.existsSync(dir)) return [];
  const CHIAVI = ["titolo", "data", "luogo", "immagine", "didascalia", "fonti", "bozza"];
  const out = [], visti = new Map();
  for (const f of fs.readdirSync(dir).filter((n) => /\.md$/i.test(n) && n.toLowerCase() !== "readme.md").sort()) {
    const where = `Nel mondo, ${f}`;
    const raw = fs.readFileSync(path.join(dir, f), "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "");
    const fm = raw.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (!fm) throw new Error(`${where}: il file deve cominciare con l'intestazione tra due righe «---» (vedi content/mondo/README.md)`);
    const meta = { fonti: [] }; let lista = null;
    fm[1].split("\n").forEach((l, n) => {
      if (!l.trim() || /^\s*#/.test(l)) return;
      const item = l.match(/^\s*-\s+(.+)$/);
      if (item) { if (lista !== "fonti") throw new Error(`${where}, riga ${n + 2}: una riga «- ...» va solo sotto «fonti:»`); meta.fonti.push(item[1].trim()); return; }
      const kv = l.match(/^\s*([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
      if (!kv) throw new Error(`${where}, riga ${n + 2}: non capisco «${l.trim()}» (si scrive nome: valore)`);
      const k = kv[1].toLowerCase(); let v = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
      if (!CHIAVI.includes(k)) throw new Error(`${where}, riga ${n + 2}: «${kv[1]}» non è tra i nomi possibili (${CHIAVI.join(", ")})`);
      lista = k === "fonti" ? "fonti" : null;
      if (k === "fonti") { if (v) meta.fonti.push(v); return; }
      meta[k] = v;
    });
    if (/^(s[iì]|true|yes)$/i.test(meta.bozza || "")) continue;
    if (!meta.titolo) throw new Error(`${where}: manca «titolo:»`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.data || "")) throw new Error(`${where}: «data:» si scrive così: 2026-11-20 (anno-mese-giorno)`);
    const dt = new Date(meta.data + "T12:00:00Z");
    if (isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== meta.data) throw new Error(`${where}: la data «${meta.data}» non esiste`);
    const slug = slugMondo(f.replace(/\.md$/i, ""));
    if (!slug || slug === "media") throw new Error(`${where}: il nome del file non va bene: usa lettere, numeri e trattini (es. sudan.md)`);
    if (visti.has(slug)) throw new Error(`${where}: dà lo stesso indirizzo (${slug}) di ${visti.get(slug)}`);
    visti.set(slug, f);
    let media = null, img = null;
    if (meta.immagine) {
      if (/^https:\/\/[^\s"'<>]+$/i.test(meta.immagine)) img = meta.immagine;
      else if (/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|avif|gif)$/i.test(meta.immagine)) {
        const src = path.join(dir, "media", meta.immagine);
        if (!fs.existsSync(src)) throw new Error(`${where}: l'immagine «${meta.immagine}» non c'è in content/mondo/media/`);
        media = { src, name: meta.immagine }; img = null;
      } else throw new Error(`${where}: «immagine:» è il nome di un file in content/mondo/media/ (es. foto.jpg) o un indirizzo https://`);
    }
    const corpo = mdBlocks(raw.slice(fm[0].length).trim());
    out.push({ file: f, slug, titolo: meta.titolo, data: meta.data, luogo: meta.luogo || "", didascalia: meta.didascalia || "", fonti: meta.fonti, img, media, corpo });
  }
  return out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.titolo.localeCompare(b.titolo, "it")));
}
function metaMondo(t) {
  return (t.luogo ? `<span dir="auto">${escHtml(t.luogo)}</span><span aria-hidden="true"> · </span>` : "") + `<time datetime="${t.data}">${dataIt(t.data)}</time>`;
}
function urlMondo(base, slug) { return (base === "/" ? "" : base) + "/mondo/" + slug; }
// dir: la cartella in public/ (i file si servono sempre da /<dir>/..., anche quando la casa sarà a "/")
function paginaMondo(tpl, t, dir) {
  const imgSrc = t.media ? `/${dir}/mondo/media/${encodeURIComponent(t.media.name)}` : t.img;
  const fig = imgSrc ? `<figure class="mo-foto"><img src="${escHtml(imgSrc)}" alt="${escHtml(t.didascalia || "")}" loading="lazy" decoding="async">${t.didascalia ? `<figcaption dir="auto">${mdInline(t.didascalia)}</figcaption>` : ""}</figure>` : "";
  const fonti = t.fonti.length ? `<section class="mo-fonti" aria-labelledby="moFonti"><h2 id="moFonti">Fonti</h2><ol>${t.fonti.map((f) => {
    const md = f.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (md) return `<li dir="auto"><a href="${escHtml(md[2])}" target="_blank" rel="noopener">${escHtml(md[1])}</a></li>`;
    const u = f.match(/https?:\/\/[^\s<>"]+/i);
    if (u) { const label = f.slice(0, u.index).replace(/[\s:–—-]+$/, "").trim(); return `<li dir="auto">${label ? escHtml(label) + ": " : ""}<a href="${escHtml(u[0])}" target="_blank" rel="noopener">${escHtml(corto(u[0]))}</a></li>`; }
    return `<li dir="auto">${escHtml(f)}</li>`;
  }).join("")}</ol></section>` : "";
  const fill = { titolo: escHtml(t.titolo), meta: metaMondo(t), immagine: fig, corpo: t.corpo, fonti };
  return tpl.replace(/\{\{([a-z]+)\}\}/g, (all, k) => (k in fill ? fill[k] : all));
}
function indiceMondo(h, list, base) {
  const a = "<!-- mondo:indice -->", b = "<!-- /mondo:indice -->", i = h.indexOf(a), j = h.indexOf(b);
  if (i < 0 || j < i) throw new Error("casa/mondo/index.html: non trovo <!-- mondo:indice --> ... <!-- /mondo:indice -->");
  const voci = list.map((t) => `<li><a class="mo-voce" href="${urlMondo(base, t.slug)}"><span class="mo-voce__in"><span class="mo-voce__t" dir="auto">${escHtml(t.titolo)}</span><span class="mo-voce__m">${metaMondo(t)}</span></span><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5l5.5 5.5-5.5 5.5"/></svg></a></li>`).join("\n    ");
  return h.slice(0, i) + `<ol class="mo-indice" aria-label="I testi, dal più recente">\n    ${voci}\n  </ol>` + h.slice(j + b.length);
}
function titoliMondo(h, list) {
  const mark = "<!-- mondo:titoli -->";
  if (!h.includes(mark)) throw new Error("casa/home/index.html: non trovo <!-- mondo:titoli --> nel riquadro Nel mondo");
  const titoli = list.map((t) => `<span dir="auto">${escHtml(t.titolo)}</span>`).join('<span aria-hidden="true"> · </span>');
  const html = `<p class="mondo__p mondo__titoli" style="color: var(--t-ink); font-weight: 650; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;">${titoli}</p>\n        <p class="mondo__p mondo__data" style="margin-top: 6px;">Ultimo testo: <time datetime="${list[0].data}">${dataIt(list[0].data)}</time></p>`;
  return h.replace(new RegExp(mark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + `\\s*<p class="mondo__p">Presto, con le parole di Imad\\.</p>`), html).replace(mark, "");
}

// ------------------------------------------------------------------ i metadati del sito vero (solo con CASA_NUOVA)
// Titolo e descrizione di ogni pagina, in italiano semplice, con i soli fatti del sito: niente su Imad che lui non abbia detto.
// Una pagina che non è in META tiene il suo <title> e la sua <meta name="description"> (scritti nella pagina, in docs/anteprime/casa/).
// I testi di Nel mondo tengono il loro titolo; la descrizione dice solo titolo, luogo e data (le parole sono sue: non si riassumono).
// L'anteprima condivisa (/opengraph-image, disegnata da app/opengraph-image.tsx) e le icone (/icon.svg, /apple-icon) sono del sito Next.
// (funzioni, non costanti: la casa si costruisce più sopra, prima che il file arrivi fin qui)
function META() { return {
  "/": {
    title: "imad.chat — il sito di Imad Chatraoui",
    description: "Il sito di Imad Chatraoui: i suoi progetti, piccoli strumenti da usare dal telefono, un versetto del Corano al giorno, cinque città con la loro ora e Dot, il gatto.",
  },
  "/progetti": { description: "I progetti di Imad Chatraoui su GitHub, dal più recente." },
  "/mondo": { description: "Nel mondo: i testi di Imad Chatraoui." },
  "/su-di-me": { description: "Su di me: Imad Chatraoui, con le sue parole." },
}; }
function OG_ALT() { return "imad.chat: il logo dei nove tasti con il centro d'oro e la scritta imad.chat, su un cielo di notte"; }
function metaPagina(h, url, job) {
  const rel = job.rel, m = META()[url] || {};
  const tm = h.match(/<title>([^<]*)<\/title>/);
  if (!tm) throw new Error(`casa: ${rel}: manca <title>`);
  const dm = h.match(/<meta name="description" content="([^"]*)">\n?/);
  const title = m.title ? escHtml(m.title) : tm[1];
  let desc = m.description ? escHtml(m.description) : dm ? dm[1] : "";
  if (!desc && job.t) desc = escHtml(`«${job.t.titolo}»: un testo di Imad Chatraoui${job.t.luogo ? ", " + job.t.luogo : ""}, del ${dataIt(job.t.data)}.`);
  if (!desc) { desc = escHtml("Su imad.chat, il sito di Imad Chatraoui."); console.log(`  avviso: ${rel}: nessuna descrizione (aggiungila nella pagina o in META, scripts/home/build.mjs)`); }
  if (/anteprima/i.test(title + " " + desc)) throw new Error(`casa: ${rel}: il titolo o la descrizione dicono ancora «anteprima»: «${title}»`);
  const abs = SITO.url + (url === "/" ? "/" : url);
  const tags = [
    `<meta name="description" content="${desc}">`,
    `<link rel="canonical" href="${abs}">`,
    `<meta property="og:type" content="${job.t ? "article" : "website"}">`,
    `<meta property="og:site_name" content="imad.chat">`,
    `<meta property="og:locale" content="it_IT">`,
    `<meta property="og:url" content="${abs}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${SITO.url}/opengraph-image">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escHtml(OG_ALT())}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/icon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="/apple-icon">`,
  ].join("\n");
  if (dm) h = h.replace(dm[0], "");
  return h.replace(tm[0], `<title>${title}</title>\n${tags}`);
}

// ------------------------------------------------------------------ l'anteprima di Dot, il gatto: /gatto (non indicizzata)
// Copia la pagina di docs/anteprime/gatto e solo i file che la pagina usa (gli script che index.html carica, gatto.css, i suoni);
// gli indirizzi diventano assoluti (/gatto/...), perché la pagina si apre anche come /gatto, senza barra finale.
// Le pagine di prova (prova, scena, tavola, riordina) e gli strumenti non vanno online.
{
  const src = path.join(root, "docs/anteprime/gatto");
  const dst = path.join(root, "public/gatto");
  const G = "/gatto/";
  let h = fs.readFileSync(path.join(src, "index.html"), "utf8");
  const scripts = [...h.matchAll(/<script src="([a-z-]+\.js)"><\/script>/g)].map((m) => m[1]);
  for (const f of scripts) if (!fs.existsSync(path.join(src, f))) throw new Error("gatto index.html: manca " + f);
  if (!scripts.includes("look-manifesto.js")) throw new Error("gatto index.html: non carica look-manifesto.js");
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
