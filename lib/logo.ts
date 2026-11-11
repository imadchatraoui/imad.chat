// Il logo del sito: se esiste public/logo.svg si usa quello (in alto a sinistra, al massimo 160 × 40),
// altrimenti il segno inciso (la stella a otto punte e la scritta imad.chat). Si controlla sul server,
// alla build: basta aggiungere il file e pubblicare. Solo lato server (legge il filesystem).

import fs from "node:fs";
import path from "node:path";

export function logoSrc(): string | null {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", "logo.svg")) ? "/logo.svg" : null;
  } catch {
    return null;
  }
}
