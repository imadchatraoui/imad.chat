// L'indirizzo pubblico del sito: l'unico posto dove si cambia (docs/anteprime/casa/CASA.md, sezione 7).
// Lo legge anche scripts/home/build.mjs, come testo: lascialo su una riga, scritto così.

// Serve ai link canonici, alla sitemap, a robots.txt e alle anteprime condivise (Open Graph).
// È il dominio principale del progetto su Vercel, quello che risponde senza rimandare altrove: il 2026-11-13 è
// "www.imad.chat" (imad.chat rimanda lì; è anche il valore che Vercel dava a VERCEL_PROJECT_PRODUCTION_URL).
// Se un giorno in Vercel il principale diventa imad.chat, qui si scrive "imad.chat"; senza dominio, "imadchat.vercel.app".
// Dopo averlo cambiato: node scripts/home/build.mjs, poi la build e la pubblicazione di sempre.
export const SITE_HOST = "www.imad.chat";

export const SITE_URL = `https://${SITE_HOST}`;
