import type { NextConfig } from "next";

const config: NextConfig = {
  // Pagine del diario e font per le anteprime sono file letti dal filesystem:
  // li includiamo esplicitamente nel bundle delle funzioni serverless.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/**/*"],
    "/opengraph-image": ["./assets/fonts/**/*"],
    "/diario/[slug]/opengraph-image": ["./assets/fonts/**/*", "./content/**/*"],
  },
  poweredByHeader: false,
  // Permette più server di sviluppo in parallelo sullo stesso progetto (NEXT_DIST_DIR=.next-xyz).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
