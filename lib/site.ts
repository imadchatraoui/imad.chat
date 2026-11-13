// Le due impostazioni del sito: l'unico posto dove si cambiano (docs/anteprime/casa/CASA.md, sezione 7).
// Le leggono anche scripts/home/build.mjs e next.config.ts, come testo: lascia ognuna su una riga, scritta così.

// L'INTERRUTTORE DEL CAMBIO DI CASA.
//   false: come oggi. A "/" la prima pagina Widget (public/home); la casa nuova è un'anteprima non indicizzata a /anteprima.
//   true:  la casa nuova a "/", con l'intro del gatto; le pagine alla radice (/progetti, /mondo, /su-di-me, /tools, ...);
//          /anteprima e /anteprima/... portano (308) allo stesso indirizzo alla radice; le pagine si indicizzano.
// Dopo averlo cambiato: node scripts/home/build.mjs, poi la build e la pubblicazione di sempre (la build si ferma
// se public/ non è stata rifatta con lo stesso interruttore).
export const CASA_NUOVA = true;

// L'indirizzo pubblico del sito, per i link canonici, la sitemap, robots.txt e le anteprime condivise (Open Graph).
// È il dominio principale del progetto su Vercel, quello che risponde senza rimandare altrove: il 2026-11-13 è
// "www.imad.chat" (imad.chat rimanda lì; è anche il valore che Vercel dava a VERCEL_PROJECT_PRODUCTION_URL).
// Se un giorno in Vercel il principale diventa imad.chat, qui si scrive "imad.chat"; senza dominio, "imadchat.vercel.app".
export const SITE_HOST = "www.imad.chat";

export const SITE_URL = `https://${SITE_HOST}`;
