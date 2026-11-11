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
    return { beforeFiles: [{ source: "/", destination: "/home/index.html" }], afterFiles: [], fallback: [] };
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
