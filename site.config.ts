/**
 * Impostazioni del sito. Modifica qui nome, testi e link.
 * Per quello che il bot sa di te, vedi content/me.md.
 */
export const site = {
  name: "Imad",
  fullName: "Imad Chatraoui",
  domain: "imad.chat",
  url: "https://imad.chat",
  title: "imad.chat",
  description: "Il diario di Imad. Puoi leggerlo, oppure chiedergli qualcosa.",

  /** Testo d'apertura della home, sotto il saluto. */
  intro:
    "Questo è il mio diario. Ci metto quello che mi interessa: codice, pensieri, deen. Puoi leggerlo, oppure chiedergli qualcosa.",

  /** Riga sotto la casella di testo. */
  disclaimer: "Risponde un'AI con i miei appunti; può sbagliare.",

  /** Username Instagram senza @. Se vuoto, il link non compare. */
  instagram: "",

  /** Il diario vive in questo fuso orario: date e saluto seguono questo orologio. */
  timeZone: "Europe/Rome",
  locale: "it-IT",

  /** Domande proposte quando nessuna pagina ha un campo `question`. */
  fallbackQuestions: ["Perché imad.chat?", "Cosa c'è nel diario?", "Chi sei?"],
} as const;
