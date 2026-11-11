// L'astrolabio di imad's world.
//
//   const Astrolabe = dynamic(() => import("@/components/astrolabe").then((m) => m.Astrolabe), { ssr: false });
//
// Vedi README.md in questa cartella.

export { default as Astrolabe, hasWebGL, prefersReducedMotion } from "./Astrolabe";
export { default as AstrolabeFallback } from "./AstrolabeFallback";
export type { AstrolabeHandle, AstrolabeProps, AstrolabeEventName } from "./types";
export * from "@/lib/astro";
