# imad.chat

**hello, imad’s world.** Il sito è un astrolabio d’ottone, vero e interattivo: il calcolatore da tenere in mano
degli astronomi del mondo islamico, che qui legge il cielo in tempo reale. Si arriva soprattutto dal link nella
bio di Instagram, quindi dal telefono: tutto è pensato prima per uno schermo verticale.

## Che cosa si vede

1. **L’intro.** Nella notte si scrive `hello, world`; `world` si cancella e si dissolve in stelle, dalle stelle si
   condensa *imad’s world* in oro, e intorno si incide un cerchio graduato. Il cerchio è già il lembo
   dell’astrolabio: l’ottone compare esattamente lì e si monta pezzo per pezzo. Chi torna nella stessa sessione
   vede subito il cerchio finito; nel menu *Sezioni* c’è «Rivedi l’intro».
2. **L’astrolabio.** La rete gira con il cielo vero sopra la città della piastra (Torino all’inizio).
   - Trascinando la rete si viaggia nel tempo; **Adesso** riporta al cielo di questo istante.
   - Le **piastre** sono otto città: Torino, Al-Quds, Gaza, Fès, Istanbul, Samarcanda, Kyoto, Cusco. Toccando
     di nuovo la città scelta, o l’ora, si apre la sua scheda (la stessa luna su Torino e su Gaza, l’ora, la qibla).
   - Toccando la punta di una **stella** si legge il suo nome arabo, il significato, i dati veri e una curiosità.
   - **gira** mostra il retro, dove è inciso il codice che calcola il cielo; **qibla** gira la regola verso la
     Kaʿba (dalla città scelta o, se chi visita lo permette, da dove si trova); **at-Tariq** fa bussare una stella
     tre volte nel buio.
   - Le **sezioni** sono incise come segni sul lembo graduato: si aprono da lì o dal menu *Sezioni*.
3. **Le sezioni** hanno anche un indirizzo loro, da condividere: `imad.chat/sezioni/<nome>`.

Il suono è spento finché non lo si accende (l’altoparlante in alto). La posizione si chiede solo toccando
*qibla* e non esce dal browser. Niente cookie, niente statistiche.

Senza WebGL, o con «riduci movimento» attivo, l’astrolabio è la sua versione 2D in SVG, con la stessa
matematica.

## Aggiungere una sezione

1. Crea un file in `content/sezioni/`, per esempio `la-luna.md`. Il nome del file diventa l’indirizzo:
   `imad.chat/sezioni/la-luna`.
2. In cima i dati, poi il testo in Markdown:

```md
---
title: "La luna"
order: 7
anchor: "cielo"
summary: "Una riga che compare nel menu e nelle anteprime condivise."
---

Il testo della sezione, in Markdown normale.

{{verse:10:5}}

Un altro paragrafo.
```

- `order`: la posizione nel menu e sul lembo (le sezioni si distribuiscono a intervalli uguali; con `angle:`
  in gradi, da 0 in alto in senso orario, si sceglie il punto esatto).
- `anchor` (facoltativo): il gesto che la sezione offre sull’astrolabio con un pulsante. Valori: `cielo`
  (torna ad adesso), `tariq`, `qibla`, `retro` (gira lo strumento), `citta:<id>` (mostra quella piastra, con gli
  id di `content/astro/cities.json`, per esempio `citta:gaza`).
- `{{verse:CHIAVE}}`, su una riga da solo, diventa il versetto con l’arabo, la traduzione e la fonte. Le chiavi
  sono quelle di `content/astro/verses.json` (per esempio `86:1-3`, `53:49`, `2:144`). Il testo coranico arriva
  solo da quel file, verificato su quran.com: per un versetto nuovo va aggiunto lì, con la sua fonte.
- I file che iniziano con `_` non vengono pubblicati.

Salva, fai commit e push: Vercel ricostruisce il sito, la sezione compare nel menu, sul lembo e nella sitemap.

## Il logo

Metti il logo in `public/logo.svg`. Compare in alto a sinistra, al posto della stella incisa con la scritta
*imad.chat*, al massimo 160 × 40 pixel: conviene un SVG largo e basso, in ottone chiaro (`#ead6a0`) o crema
(`#efe6d2`) su trasparente, perché sta sulla notte. Il sito controlla il file alla build: dopo il push basta
aspettare il nuovo deploy. L’icona del sito (scheda del browser, schermata Home) è in `app/icon.svg` e
`app/apple-icon.tsx`.

## Immagini, suoni e video (Higgsfield)

Gli asset si generano con Higgsfield: cosa generare, i prompt e i passaggi sono in `docs/higgsfield.md`.

1. I lavori finiti si annotano in `scripts/media/jobs.json` (id dell’asset, job e URL del risultato).
2. `python3 -I scripts/media/import.py` li scarica, li converte (JPEG e PNG ridimensionati, SVG ripuliti, MP3
   rifilati e normalizzati, MP4 H.264 senza audio) e li mette in `public/media/`, poi riscrive
   `public/media/manifest.json`.
3. Il sito legge il manifesto e usa quello che c’è; quello che manca è disegnato o sintetizzato dal codice.

| Cartella | Uso |
|---|---|
| `tex/T02.jpg` (o `T01`) | il dettaglio fotografico dell’ottone |
| `tex/T05.jpg` | il velluto dei fogli |
| `orn/O01–O05` | sagome del trono e del cavallo, la shamsa sul retro |
| `band/<città>.png` | la fascia ornata sul bordo di ogni piastra |
| `city/<città>-<night\|day>-<v\|h>.jpg` / `.mp4` | lo sfondo dietro l’astrolabio, di notte o di giorno, verticale o orizzontale |
| `sfx/S01–S11.mp3` | i suoni (scatti, piastre, intro, at-Tariq…) |
| `amb/<città>.mp3`, `amb/notte.mp3` | l’ambiente sonoro, molto basso |
| `video/tariq-<v\|h>.mp4` | at-Tariq in video |

Il video di at-Tariq oggi in `public/media/video/` è provvisorio (senza i tre colpi), quindi la scena è quella
disegnata. Quando arriva quello definitivo, in `components/site/Home.tsx` cambia `TARIQ_VIDEO` da
`"procedural"` a `"auto"`.

## In locale

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # build di produzione, con il controllo dei tipi
npm run start          # serve la build
```

- Più server di sviluppo insieme sullo stesso progetto: `NEXT_DIST_DIR=.next-prova npx next dev -p 3001`
  (ognuno con la sua cartella).
- `/lab/astrolabio` è il banco di prova dello strumento (non indicizzato): `?city=gaza`,
  `?t=2026-11-11T21:00:00Z`, `?state=exploded`, `?fallback=1`, `?debug=1`.
- Sulla home, `?debug=1` espone lo strumento nella console (`window.__astrolabe`).

## I dati di GitHub (heatmap e progetti)

La home legge due indirizzi del sito, che chiedono a GitHub e tengono la risposta in cache per tre ore
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

Il sito è su Vercel (Next.js). Le anteprime condivise (Instagram, WhatsApp) usano il dominio di produzione del
progetto: `imad.chat` quando è collegato, prima l’indirizzo `vercel.app` (variabile
`VERCEL_PROJECT_PRODUCTION_URL`, che Vercel imposta da solo). Per il dominio: *Settings → Domains* → `imad.chat`.
I commit il cui messaggio inizia con `WIP` non avviano una build (`vercel.json`).

## Com’è fatto

```
app/
  layout.tsx, globals.css   caratteri, colori, metadati
  page.tsx                  la home: legge sezioni e città, la rende components/site/Home.tsx
  sezioni/[slug]/           le pagine delle sezioni, con la loro anteprima condivisa
  opengraph-image.png       l'anteprima condivisa della home (l'ultimo fotogramma dell'intro)
  sitemap.ts, robots.ts, not-found.tsx
components/
  intro/                    l'intro (canvas 2D)
  astrolabe/                l'astrolabio 3D (React Three Fiber) e la versione 2D; vedi il suo README
  site/                     la cornice: Home, barra in alto, comandi, fogli, pannelli, sfondo
content/
  astro/                    stelle, città, versetti, curiosità (verificati: docs/fonti.md)
  sezioni/                  le sezioni
lib/
  astro/                    la matematica del cielo (astronomy-engine)
  sections.ts, media.ts, sound.ts, logo.ts, site.ts
docs/                       fonti, riferimenti, Higgsfield
scripts/media/              importazione degli asset
```

**Caratteri.** Un solo serif, Cormorant Garamond (titoli, testi, versi, *imad’s world*); JetBrains Mono solo
per i dati veri e per `hello, world`; Amiri per l’arabo. Arrivano da Google Fonts con `next/font` al momento
della build. Per le anteprime delle sezioni c’è una copia ridotta di Cormorant in `assets/fonts/`. Tutti e tre
hanno la licenza SIL Open Font License.

**Accuratezza.** Nessun testo arabo è scritto a mano: nomi delle stelle, versetti e nomi locali vengono da
`content/astro/`, verificati e con le fonti in `docs/fonti.md`. Il cielo è calcolato con astronomy-engine.
