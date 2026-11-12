import type { NextConfig } from "next";

const config: NextConfig = {
  // Le sezioni (content/sezioni/*.md) si leggono dal filesystem sul server (lib/sections.ts):
  // le includiamo nel bundle delle funzioni, nel caso una di queste pagine venga resa su richiesta.
  outputFileTracingIncludes: {
    "/": ["./content/sezioni/**/*"],
    "/sezioni/*": ["./content/sezioni/**/*"],
    "/sitemap.xml": ["./content/sezioni/**/*"],
  },
  poweredByHeader: false,
  // La home online è la pagina statica in public/home (scripts/home/build.mjs la genera dal disegno scelto).
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/home/index.html" },
        // la casa nuova, a un indirizzo a parte (non indicizzato): scripts/home/build.mjs la scrive in public/anteprima.
        // Le pagine interne (/anteprima/progetti, /anteprima/mondo/<luogo>, ...) aprono il loro index.html; i nomi con un punto
        // (app.js, style.css) sono file e non passano di qui. Il giorno che la casa sostituisce la home (BASE "/" nella build),
        // "/" e "/:a" puntano a /anteprima/index.html e /anteprima/:a/index.html.
        { source: "/anteprima", destination: "/anteprima/index.html" },
        { source: "/anteprima/:a([a-z0-9-]+)", destination: "/anteprima/:a/index.html" },
        { source: "/anteprima/:a([a-z0-9-]+)/:b([a-z0-9-]+)", destination: "/anteprima/:a/:b/index.html" },
        // l'anteprima di Dot, il gatto (non indicizzata)
        { source: "/gatto", destination: "/gatto/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // Le pagine del vecchio sito non si mostrano più: tornano alla home.
  async redirects() {
    return [
      { source: "/sezioni/:path*", destination: "/", permanent: false },
      { source: "/lab/:path*", destination: "/", permanent: false },
    ];
  },
  // Permette più server di sviluppo in parallelo sullo stesso progetto (NEXT_DIST_DIR=.next-xyz).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
