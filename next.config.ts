import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Le pagine del sito sono statiche: scripts/home/build.mjs le scrive in public/ (committata: Vercel non esegue lo script) e qui si
// dice quale indirizzo apre quale file. L'interruttore CASA_NUOVA sta in lib/site.ts (docs/anteprime/casa/CASA.md, sezione 7);
// si legge come testo perché next.config.ts non importa altri file TypeScript in modo affidabile (Node risolve da sé i .ts).
const ROOT = process.cwd();
const sito = fs.readFileSync(path.join(ROOT, "lib/site.ts"), "utf8").match(/^export const CASA_NUOVA = (true|false);/m);
if (!sito) throw new Error("lib/site.ts: non trovo «export const CASA_NUOVA = true;» o «export const CASA_NUOVA = false;» (su una riga)");
const CASA_NUOVA = sito[1] === "true";

// Le pagine della casa nuova, dall'elenco che la build scrive (public/casa/pagine.json): "/", "/progetti", "/mondo/<luogo>", ...
// Se public/ è stata fatta con l'altro interruttore, la build si ferma qui (meglio che pubblicare un sito senza pagine).
function pagineCasa(): string[] {
  const f = path.join(ROOT, "public/casa/pagine.json");
  if (!fs.existsSync(f)) throw new Error("CASA_NUOVA è true in lib/site.ts, ma public/casa non c'è: prima node scripts/home/build.mjs");
  const urls: string[] = JSON.parse(fs.readFileSync(f, "utf8")).pagine.map((p: { url: string }) => p.url);
  for (const u of urls) if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(u)) throw new Error(`public/casa/pagine.json: indirizzo strano «${u}»`);
  return urls;
}
if (!CASA_NUOVA && !fs.existsSync(path.join(ROOT, "public/home/index.html"))) {
  throw new Error("CASA_NUOVA è false in lib/site.ts, ma public/home non c'è: prima node scripts/home/build.mjs");
}

// Le pagine del vecchio sito (l'astrolabio) non ci sono più: chi ha un vecchio link torna alla home.
const vecchioSito = [
  { source: "/sezioni/:path*", destination: "/", permanent: false },
  { source: "/lab/:path*", destination: "/", permanent: false },
];

const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    // l'anteprima di Dot, il gatto (non indicizzata): resta con tutti e due gli interruttori
    const gatto = { source: "/gatto", destination: "/gatto/index.html" };
    if (CASA_NUOVA) {
      // la casa nuova alla radice: ogni pagina apre il suo index.html in public/casa ("/" → /casa/index.html,
      // "/tools/qr" → /casa/tools/qr/index.html); i file (app.js, style.css, media/...) si servono da /casa/... così come sono.
      // Un indirizzo che non è nell'elenco è la pagina 404 (app/not-found.tsx).
      const pagine = pagineCasa().map((u) => ({ source: u, destination: u === "/" ? "/casa/index.html" : `/casa${u}/index.html` }));
      return { beforeFiles: [...pagine, gatto], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: [
        // La home online è la pagina statica in public/home (scripts/home/build.mjs la genera dal disegno scelto).
        { source: "/", destination: "/home/index.html" },
        // la casa nuova, a un indirizzo a parte (non indicizzato): scripts/home/build.mjs la scrive in public/anteprima.
        // Le pagine interne (/anteprima/progetti, /anteprima/mondo/<luogo>, ...) aprono il loro index.html; i nomi con un punto
        // (app.js, style.css) sono file e non passano di qui.
        { source: "/anteprima", destination: "/anteprima/index.html" },
        { source: "/anteprima/:a([a-z0-9-]+)", destination: "/anteprima/:a/index.html" },
        { source: "/anteprima/:a([a-z0-9-]+)/:b([a-z0-9-]+)", destination: "/anteprima/:a/:b/index.html" },
        gatto,
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    if (CASA_NUOVA) {
      // i vecchi indirizzi delle anteprime (link già mandati, segnalibri) portano allo stesso posto alla radice, per sempre (308)
      return [
        { source: "/anteprima", destination: "/", permanent: true },
        { source: "/anteprima/index.html", destination: "/", permanent: true },
        { source: "/anteprima/:path*/index.html", destination: "/:path*", permanent: true },
        { source: "/anteprima/:path*", destination: "/:path*", permanent: true },
        ...vecchioSito,
      ];
    }
    return vecchioSito;
  },
  async headers() {
    // i file della casa aperti col loro nome (/casa/index.html, /casa/progetti/index.html) sono copie delle pagine vere: non si indicizzano
    return CASA_NUOVA ? [{ source: "/casa/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }] : [];
  },
  // Permette più server di sviluppo in parallelo sullo stesso progetto (NEXT_DIST_DIR=.next-xyz).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
