// Un server statico per docs/anteprime, uguale per tutti quelli che lavorano alla casa nuova.
// Risponde anche alle due rotte del sito che le pagine leggono (/api/github/contributi e /api/github/progetti):
// con i file JSON dati sulla riga di comando, oppure con { "ok": false } (come quando GitHub non risponde).
// Uso, dalla cartella del repository:
//   node docs/anteprime/casa/strumenti/servi.mjs [--port 4121] [--contributi prova.json] [--progetti prova.json] [--lento 800]
//   poi aprire http://localhost:4121/casa/home/index.html (la radice / porta lì)
// --lento <ms>: le due rotte rispondono dopo tanti millisecondi (per vedere lo stato di attesa).
// Da un altro script: import { serve } from "./servi.mjs"; const s = await serve({ port: 0 }); ... s.url, s.close()
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");                  // docs/anteprime
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
};

export function serve(o = {}) {
  const root = path.resolve(o.root || ROOT);
  const api = {};
  for (const k of ["contributi", "progetti"]) {
    if (!o[k]) { api[k] = null; continue; }
    const f = path.resolve(o[k]);
    api[k] = () => fs.readFileSync(f, "utf8");                // si rilegge a ogni richiesta: si può cambiare il file mentre gira
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const m = url.pathname.match(/^\/api\/github\/(contributi|progetti)\/?$/);
    if (m) {
      const send = () => {
        let body = '{ "ok": false }';
        try { if (api[m[1]]) body = api[m[1]](); } catch (e) { body = '{ "ok": false }'; }
        res.writeHead(200, { "content-type": MIME[".json"], "cache-control": "no-store" }).end(body);
      };
      if (o.lento > 0) setTimeout(send, o.lento); else send();
      return;
    }
    if (url.pathname === "/") { res.writeHead(302, { location: "/casa/home/index.html" }).end(); return; }
    let file;
    try { file = path.join(root, decodeURIComponent(url.pathname)); } catch (e) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("non c'è: " + url.pathname); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(o.port == null ? 4121 : o.port, o.host || "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ port, url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const s = await serve({ port: opt("--port") ? +opt("--port") : 4121, contributi: opt("--contributi"), progetti: opt("--progetti"), lento: opt("--lento") ? +opt("--lento") : 0 });
  console.log(`docs/anteprime su ${s.url}  ·  la casa: ${s.url}/casa/home/index.html  ·  rotte: contributi ${opt("--contributi") || "{ ok: false }"}, progetti ${opt("--progetti") || "{ ok: false }"}`);
}
