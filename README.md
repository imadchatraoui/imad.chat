# imad.chat

Il sito di Imad Chatraoui. Si arriva soprattutto dal link nella bio di Instagram, quindi dal telefono: tutto è
pensato prima per uno schermo verticale.

Le pagine sono statiche (HTML, CSS e script semplici): i disegni stanno in `docs/anteprime/` e
`node scripts/home/build.mjs` li copia in `public/`, che si committa (Vercel non esegue lo script). L'app Next.js
serve quei file e fa il resto: le due rotte dei dati di GitHub, la pagina 404, l'anteprima condivisa, le icone,
`robots.txt` e la sitemap.

## L'interruttore della casa nuova

`CASA_NUOVA` in `lib/site.ts`. Con `false` a `/` c'è la prima pagina Widget e la casa nuova è un'anteprima a
`/anteprima`; con `true` la casa nuova è a `/` con le sue pagine alla radice (`/progetti`, `/mondo`, `/su-di-me`,
`/tools`, ...). Come si accende e che cosa cambia: `docs/anteprime/casa/CASA.md`, sezione 7.
Nello stesso file c'è `SITE_HOST`, l'indirizzo pubblico (i link canonici, la sitemap, le anteprime condivise).

## In locale

```bash
npm install
node scripts/home/build.mjs   # rifà public/ dai disegni
npm run build                 # build di produzione, con il controllo dei tipi
npm run start                 # serve la build
```

- Più server insieme sullo stesso progetto: `NEXT_DIST_DIR=.next-prova npx next start -p 3001` (ognuno con la
  sua cartella; `next build` aggiunge righe a `tsconfig.json`: `git checkout -- tsconfig.json` prima del commit).
- Le pagine si aprono anche senza Next, da `docs/anteprime`: `node docs/anteprime/casa/strumenti/servi.mjs`.
- I controlli: `npm run check:content` (i dati di `content/astro`), `npm run check:astro` (la matematica del cielo
  in `lib/astro`), `node scripts/check/github.mjs` (i dati di GitHub), `npx tsc --noEmit`.

## I dati di GitHub (heatmap e progetti)

La casa legge due indirizzi del sito, che chiedono a GitHub e tengono la risposta in cache per tre ore
(se GitHub non risponde si continua a mostrare l'ultima risposta buona):

- `/api/github/contributi`: il calendario dei contributi dell'ultimo anno (la heatmap);
- `/api/github/progetti`: i repository **pubblici** di `imadchatraoui` e gli ultimi commit di `threejs-journey`.
  Un repository privato non compare mai.

Aggiungendo `?debug=1` si vede che cosa è stato provato e dove si è fermato (mai il token).
Il codice è in `lib/github/`, le prove in `node scripts/check/github.mjs`.

**Il token è facoltativo, ma consigliato.** Senza token GitHub concede poche richieste all'ora per indirizzo, e su
Vercel l'indirizzo è condiviso con altri siti: i progetti possono restare vuoti finché il limite non si azzera.
Per evitarlo:

1. su GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*;
   nome `imad.chat`, *Repository access: Public repositories (read-only)*, nessun altro permesso;
2. su Vercel: progetto *imadchat* → *Settings → Environment Variables* → nome `GITHUB_TOKEN`, valore il token,
   ambiente *Production*; poi un nuovo deploy.

Con il token la heatmap usa l'API ufficiale e i conteggi sono quelli del tuo profilo (se nel profilo hai scelto di
mostrare anche i contributi privati, contano anche quelli: solo il numero per giorno, mai i nomi dei repository).

## Pubblicare

Il sito è su Vercel (Next.js); il ramo `main` è la produzione, su `www.imad.chat` (`imad.chat` porta lì) e
`imadchat.vercel.app`. I commit il cui messaggio inizia con `WIP` non avviano una build (`vercel.json`).

## Com'è fatto

```
app/
  layout.tsx, globals.css    caratteri e colori di ciò che rende Next
  not-found.tsx              la pagina 404
  opengraph-image.tsx        l'anteprima condivisa, disegnata a codice
  icon.svg, apple-icon.tsx   le icone (il logo dei nove tasti)
  robots.ts, sitemap.ts      seguono l'interruttore
  api/github/                le due rotte dei dati di GitHub
docs/anteprime/              i disegni: casa/ (la casa e le pagine), gatto/ (Dot), intro/, c-widget/ (la home di oggi)
scripts/home/build.mjs       dai disegni a public/
content/
  astro/                     stelle, città, versetti, curiosità (verificati: docs/fonti.md)
  mondo/                     i testi di Imad per Nel mondo (come si scrivono: content/mondo/README.md)
lib/
  site.ts                    l'interruttore e l'indirizzo pubblico
  github/                    i dati di GitHub
  astro/                     la matematica del cielo (astronomy-engine), con le sue prove
components/reactbits/        componenti React Bits (dal registro shadcn), per quando servono
assets/fonts/                Manrope per l'anteprima condivisa e la 404 (licenza OFL)
```

**Accuratezza.** Nessun testo arabo è scritto a mano: i versetti e i nomi vengono da `content/astro/`,
verificati e con le fonti in `docs/fonti.md`.
