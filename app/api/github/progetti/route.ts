// GET /api/github/progetti: i repository pubblici di GitHub e il riquadro "Sto imparando".
// Contratto: docs/anteprime/casa/CASA.md, sezione 2b. { ok: true, repos: [...], learning: {...} | null, updated }
// oppure { ok: false }. Solo repository pubblici. Con ?debug=1 una prova fresca e `why`.

import { caricaProgetti } from "@/lib/github/carica";
import { routeGithub } from "@/lib/github/servizio";

export const GET = routeGithub("progetti-v1", 10800, () =>
  caricaProgetti({ token: process.env.GITHUB_TOKEN || null }),
);
