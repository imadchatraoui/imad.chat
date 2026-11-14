import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Le pagine del sito sono statiche: scripts/home/build.mjs le scrive in public/casa (committata: Vercel non esegue lo script)
// e qui si dice quale indirizzo apre quale file (docs/anteprime/casa/CASA.md, sezione 7).
const ROOT = process.cwd();

// Le pagine della casa, dall'elenco che la build scrive (public/casa/pagine.json): "/", "/progetti", "/mondo/<luogo>", ...
// Se public/casa non c'è, la build si ferma qui (meglio che pubblicare un sito senza pagine).
function pagineCasa(): string[] {
  const f = path.join(ROOT, "public/casa/pagine.json");
  if (!fs.existsSync(f)) throw new Error("public/casa non c'è: prima node scripts/home/build.mjs");
  const urls: string[] = JSON.parse(fs.readFileSync(f, "utf8")).pagine.map((p: { url: string }) => p.url);
  for (const u of urls) if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(u)) throw new Error(`public/casa/pagine.json: indirizzo strano «${u}»`);
  return urls;
}

// Le pagine del vecchio sito (l'astrolabio) non ci sono più: chi ha un vecchio link torna alla home.
const vecchioSito = [
  { source: "/sezioni/:path*", destination: "/", permanent: false },
  { source: "/lab/:path*", destination: "/", permanent: false },
];

const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    // la casa alla radice: ogni pagina apre il suo index.html in public/casa ("/" → /casa/index.html,
    // "/tools/qr" → /casa/tools/qr/index.html); i file (app.js, style.css, media/...) si servono da /casa/... così come sono.
    // Un indirizzo che non è nell'elenco è la pagina 404 (app/not-found.tsx).
    const pagine = pagineCasa().map((u) => ({ source: u, destination: u === "/" ? "/casa/index.html" : `/casa${u}/index.html` }));
    // l'anteprima di Dot, il gatto (non indicizzata)
    const gatto = { source: "/gatto", destination: "/gatto/index.html" };
    return { beforeFiles: [...pagine, gatto], afterFiles: [], fallback: [] };
  },
  async redirects() {
    // i vecchi indirizzi delle anteprime (link già mandati, segnalibri) portano allo stesso posto alla radice, per sempre (308)
    return [
      { source: "/anteprima", destination: "/", permanent: true },
      { source: "/anteprima/index.html", destination: "/", permanent: true },
      { source: "/anteprima/:path*/index.html", destination: "/:path*", permanent: true },
      { source: "/anteprima/:path*", destination: "/:path*", permanent: true },
      ...vecchioSito,
    ];
  },
  async headers() {
    // i file della casa aperti col loro nome (/casa/index.html, /casa/progetti/index.html) sono copie delle pagine vere: non si indicizzano
    return [{ source: "/casa/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
  // Permette più server di sviluppo in parallelo sullo stesso progetto (NEXT_DIST_DIR=.next-xyz).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
