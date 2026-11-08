# imad.chat

Un diario con una chat davanti. Le pagine sono file Markdown; la chat è un modello linguistico che risponde in prima persona usando solo quelle pagine (e `content/me.md`), citandole come schede cliccabili.

- **Home** `/` — il saluto del giorno, la data (gregoriana e hijri), le domande suggerite, le ultime pagine, la chat.
- **Diario** `/diario` — tutte le pagine; ognuna ha un suo indirizzo (`/diario/nome-file`) con anteprima per Instagram e WhatsApp.
- **Chat** `/api/chat` — riceve la conversazione, sceglie le pagine pertinenti, chiede al modello e risponde in streaming.

## Scrivere una pagina

1. Crea un file in `content/notes/`, per esempio `cose-che-leggo.md`. Il nome del file diventa l'indirizzo: `imad.chat/diario/cose-che-leggo`.
2. In cima metti i dati, poi il testo in Markdown:

```md
---
title: Cose che leggo
date: 2026-11-10
tags: [pensieri]
question: Cosa stai leggendo?
---

Il testo della pagina. Si usa il **Markdown** normale.

> Un paragrafo che inizia in arabo viene mostrato da destra a sinistra, con il font giusto.
```

- `question` è facoltativo: se c'è, compare in home tra le domande suggerite (le prime tre, dalla pagina più recente).
- `draft: true` nasconde la pagina. I file che iniziano con `_` vengono ignorati (`_template.md` è un modello da copiare).
- Salva, fai commit e push: Vercel ricostruisce il sito da solo.

Quello che il bot sa di te sta in `content/me.md`. Scrivici quello che può dire e quello che non deve dire. Nome, testi della home e link sono in `site.config.ts`.

## Accendere il bot

Il bot ha bisogno di una chiave API. Senza chiave il sito funziona lo stesso: la chat risponde «Il bot non è ancora acceso» e rimanda al diario.

**Gratis (consigliato per iniziare)**

- **Groq** — [console.groq.com](https://console.groq.com) → *API Keys* → *Create API Key*. Nessuna carta. Su Vercel aggiungi la variabile `GROQ_API_KEY`. Il piano gratuito ha limiti per modello (circa 30 richieste al minuto, 1.000 al giorno e qualche migliaio di token al minuto): per un sito personale bastano.
- **Google AI Studio** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Nessuna carta per i modelli Flash. Variabile: `GEMINI_API_KEY`.

**A pagamento (qualità più alta)**

- **Anthropic** — [console.anthropic.com](https://console.anthropic.com). Variabile: `ANTHROPIC_API_KEY`. Il modello predefinito è `claude-opus-5-5`; se preferisci spendere meno, imposta `AI_MODEL=claude-haiku-5-5`. In questo caso il codice attiva anche il *fallback lato server*: se il modello declina una richiesta per policy, risponde un modello sostitutivo invece di lasciare la chat vuota.

Tutte le variabili, con i modelli predefiniti, sono in `.env.example`. Basta una chiave sola; se ce n'è più d'una vince la prima in questo ordine: Anthropic, endpoint personalizzato (`AI_API_KEY` + `AI_BASE_URL`), Groq, Gemini, OpenRouter.

### Su Vercel

1. Nel progetto: *Settings → Environment Variables* → aggiungi la chiave (per esempio `GROQ_API_KEY`) per *Production*.
2. *Deployments → … → Redeploy* sull'ultimo deploy, così la funzione legge la nuova variabile.
3. Il file `vercel.json` dice a Vercel che il sito è Next.js, anche se il progetto era stato importato come «Other».

Per il dominio: *Settings → Domains* → aggiungi `imad.chat` e copia i record DNS che Vercel ti mostra nel pannello dove hai comprato il dominio.

## In locale

```bash
npm install
cp .env.example .env.local   # e inserisci una chiave
npm run dev                  # http://localhost:3000
```

`npm run build` controlla anche i tipi TypeScript.

## Com'è fatto

```
app/                 pagine e API (Next.js, App Router)
  page.tsx           home: saluto, date, chat
  diario/            elenco e pagine del diario, con immagini di anteprima
  api/chat/route.ts  la chat
components/          Chat, Header, NoteCard, Prose (Markdown), Star (il segno ۞)
content/
  me.md              quello che il bot sa di te
  notes/*.md         le pagine del diario
lib/
  ai.ts              i provider (Anthropic, Groq, Gemini, OpenRouter, qualsiasi endpoint OpenAI)
  prompt.ts          sceglie le pagine pertinenti e scrive le istruzioni per il modello
  notes.ts           legge i file Markdown
  dates.ts           date gregoriane e hijri, saluto del giorno
site.config.ts       nome, testi, link
```

Scelte di design, in breve: due caratteri (Newsreader per tutto ciò che hai scritto tu, Geist per l'interfaccia e per chi visita; Amiri per l'arabo), un solo colore d'accento (lapislazzuli), date sempre nei due calendari, il segno ۞ dei manoscritti a chiudere ogni pagina. Il saluto in home cambia da solo il venerdì, in Ramadan e nei giorni di Eid.

## Limiti da sapere

- Le conversazioni non vengono salvate da nessuna parte; il provider AI riceve il testo della chat e le pagine pertinenti.
- Il freno alle richieste (10 al minuto per visitatore, 120 in totale) è in memoria: vale per singola istanza della funzione. Il vero tetto lo mette il piano del provider.
- Con i piani gratuiti, se il provider si lamenta dei token al minuto, abbassa `AI_CONTEXT_CHARS` (per esempio a 4000).
