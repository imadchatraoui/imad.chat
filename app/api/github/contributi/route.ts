// GET /api/github/contributi: il calendario dei contributi di GitHub dell'ultimo anno, per il riquadro Heatmap.
// Contratto: docs/anteprime/casa/CASA.md, sezione 2b. { ok: true, user, total, from, to, days: [{ d, n, l }], updated }
// oppure { ok: false }. Con ?debug (in locale =1, su Vercel =la chiave GITHUB_DEBUG_KEY) una prova fresca e `why` (fonti, stati HTTP, byte, passo fallito).

import { caricaContributi } from "@/lib/github/carica";
import { routeGithub } from "@/lib/github/servizio";

export const GET = routeGithub("contributi-v1", 10800, () =>
  caricaContributi({ token: process.env.GITHUB_TOKEN || null }),
);
