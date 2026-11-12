// Chi può chiedere ?debug alle route di GitHub (una prova fresca fuori dalla cache, con `why`).
// Niente Next qui, così scripts/check/github.mjs lo prova.
//
// Su Vercel (produzione e anteprime) solo con ?debug=<GITHUB_DEBUG_KEY>, una variabile d'ambiente di almeno
// 8 caratteri; senza chiave il debug è spento. Fuori da Vercel (next dev, next start sul proprio computer) basta ?debug=1.

export function debugPermesso(valore: string | null, env: Record<string, string | undefined> = process.env): boolean {
  if (!valore) return false;
  const chiave = (env.GITHUB_DEBUG_KEY || "").trim();
  if (chiave.length >= 8 && valore === chiave) return true;
  return !env.VERCEL && !env.VERCEL_ENV && valore === "1";
}
