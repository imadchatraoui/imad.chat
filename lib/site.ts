// L'indirizzo pubblico del sito: imad.chat quando il dominio è collegato; prima, su Vercel,
// l'indirizzo di produzione del progetto (VERCEL_PROJECT_PRODUCTION_URL, es. imadchat.vercel.app).
// Serve alle anteprime condivise, alla sitemap e a robots.txt.

export const SITE_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL || "imad.chat";
export const SITE_URL = `https://${SITE_HOST}`;
