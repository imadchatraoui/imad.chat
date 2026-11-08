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
};

export default config;
