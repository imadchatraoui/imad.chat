# Il mio mondo — sito interattivo

Niente video. Il sito **è** il mondo: una scena 3D vera, in tempo reale, che si tocca, si gira e risponde. Una scrivania di notte a Torino dove stanno insieme le cose che mi piacciono. Ogni oggetto è una porta verso una sezione del sito.

Il sito parla di quello che amo, non dei fatti miei: niente studi, lavoro, età o indirizzo.

## L'apertura

Schermo nero, solo il monitor acceso. Il terminale scrive `hello, world`, si ferma, cancella `world` lettera per lettera e scrive `imad's world`. La camera si allontana dallo schermo e si accende il resto: la lampada, la lanterna, la finestra su Torino. Da lì si esplora.

## Cosa c'è sulla scrivania, e cosa fa

| Oggetto | Interazione | Sezione |
|---|---|---|
| **Monitor** con terminale | Si scrive davvero. Comandi: `help`, `ls`, `cd <sezione>`, `whoami`, `clear`, più qualche easter egg (`sudo`, `rm -rf /`, `salam`). | Il terminale è anche un modo per navigare tutto il sito. |
| **Tastiera meccanica** | Ogni tasto premuto sulla tastiera vera (computer o telefono) scende anche nella tastiera 3D, con il suo suono di click (audio spento di default). Toccando i tasti 3D si scrive nel terminale. | — |
| **Cubo di Rubik** | Si gira col dito o col mouse. Ogni faccia è un motivo di una cultura diversa (zellige marocchine, seigaiha giapponese, tessuto andino, Liberty torinese, kente ghanese, rangoli indiano). Mescolato è un mosaico di culture; risolto, ogni motivo torna intero. Ogni mossa mostra una curiosità. | Curiosità e folklore |
| **Corano sul leggio (rahle)** | Si sfoglia trascinando l'angolo della pagina. Le pagine hanno la cornice miniata e il **testo vero** (Uthmani, fonte Tanzil) reso in codice, mai generato da un'AI. | Un versetto per come stai |
| **Mappamondo** | Si gira; toccando un punto si accende un luogo. | Viaggi e culture |
| **Cartoline** sparse | Si prendono, si girano, si guardano da vicino (Chefchaouen, Kyoto, Istanbul, Cusco, Samarcanda, Torino). | Viaggi e culture |
| **Souvenir**: matrioska, gru di origami, bicchieri da tè marocchini con il vapore, moka (nata in Piemonte), gianduiotti | Si toccano: piccoli dettagli e curiosità. | Curiosità |
| **Palla di neve con la Mole** | Toccandola, o scuotendo il telefono, nevica. | — |
| **Lanterna marocchina** | Proietta stelle sul muro; toccandola cambia intensità. | — |
| **Lampada** | Il suo interruttore passa dal giorno alla notte in tutta la scena (anche fuori dalla finestra). | Tema chiaro/scuro |
| **Calendario da tavolo e orologio** | Mostrano l'ora vera di Torino e la data gregoriana e hijri. | — |
| **Finestra su Torino** | Fuori: Alpi, tetti, Mole, Gran Madre a strati con profondità (parallasse). **Il cielo è quello vero di Torino in questo momento**: colore del sole, fase della luna, stelle; ogni tanto una stella cadente. | Torino |
| **Il cassetto** | Si apre e dentro ci sono tutte le altre sezioni, quante ne vuoi. | Le tue sezioni |

## Spazi per te

- **Logo** in alto a sinistra: uno spazio fisso, fino a 160 × 40 px. Basta mettere il file in `public/logo.svg` (o `.png`).
- **Menu** in alto a destra con tutte le sezioni, per chi non vuole esplorare.
- **Sezioni**: ognuna è un file di testo in `content/sezioni/`. Puoi legarla a un oggetto della scrivania o lasciarla nel cassetto. Si apre come pannello sopra la scena, leggibile e indicizzabile da Google.

## Telefono prima di tutto (si arriva dalla bio di Instagram)

- Inquadrature pensate in verticale. Su telefono si passa da un oggetto all'altro con lo swipe o toccandoli; su computer con lo scroll o il click.
- Muovendo il telefono la scena si sposta leggermente (parallasse col giroscopio, attivato con un tocco perché iPhone chiede il permesso).
- Prestazioni: risoluzione limitata sui telefoni, luci "cotte" nelle texture, texture compresse, caricamento progressivo. Obiettivo: fluido su un iPhone di 3–4 anni fa.
- Se il telefono non regge il 3D, o chi visita ha chiesto "riduci movimento", c'è una versione 2D con la stessa copertina e le stesse sezioni.

## Tecnica

Next.js (già usato) + React Three Fiber + drei per il 3D. Gli oggetti sono modellati in codice, così sono leggeri e animabili (i tasti, le pagine, il cubo). Higgsfield serve per le **immagini**: texture, motivi, cartoline e gli strati della finestra. Il globo usa una mappa della Terra di pubblico dominio (NASA).

## Asset da generare con Higgsfield (solo immagini, nessun video)

| ID | Cosa | Modello | Formato |
|---|---|---|---|
| C1, C2 | Copertina della scena (anteprima per Instagram e versione 2D) | nano_banana_pro 4k | 9:16 e 16:9 |
| W1–W5 | Strati della finestra: Torino di notte e di giorno, Alpi, tetti di notte e di giorno (sfondo trasparente) | gpt_image_2_6 max 4k | 16:9 |
| F1–F6 | Le 6 facce del cubo | nano_banana_pro 4k | 1:1 |
| X1–X6 | Texture: noce, intonaco, copertina in cuoio, cornice miniata (vuota), mappa antica, tessuto andino | nano_banana_pro 4k | 1:1 (X4: 2:3) |
| P1–P6 | Cartoline | nano_banana_pro 4k | 3:2 |
| M1 | Decorazione della matrioska (sfondo trasparente) | gpt_image_2_6 max 4k | 2:3 |

## Passo passo

1. **Apri una chat nuova di Claude** (app o claude.ai, non Claude Code) e controlla che il connettore Higgsfield sia attivo: *Impostazioni → Connettori*.
2. **Incolla il messaggio qui sotto** e invialo. Claude genera prima 3 immagini di prova.
3. **Guarda le 3 prove.** Se ti piacciono rispondi "ok, continua"; se no, digli cosa cambiare (più scuro, più caldo, …).
4. **Aspetta la fine**: ti darà una tabella con i job ID di tutte le immagini.
5. **Torna qui (Claude Code)**, metti Fable 5.2 se vuoi, incolla la tabella e scrivi "costruisci il sito".
6. Io scarico le immagini dal tuo account Higgsfield, costruisco il sito, lo provo su iPhone e su computer e ti mando gli screenshot. Lo pubblico prima su un indirizzo di anteprima di Vercel; su imad.chat va solo quando mi dici ok.
7. **Mandami il logo** (SVG o PNG trasparente) e i nomi delle sezioni che vuoi, quando li hai. Anche dopo va bene.

La prova Higgsfield finisce il **13 novembre 2026 alle 22:00** (ora italiana).

## Messaggio da incollare in Claude chat

```text
Usa il connettore Higgsfield. Per OGNI generazione passa use_unlim: true. Se l'illimitato viene rifiutato, fermati e dimmelo: non usare mai i crediti. Non cambiare i prompt.

Sto creando le immagini per il mio sito: una scena 3D interattiva di una scrivania di notte a Torino. Le immagini diventano texture, motivi e sfondi della scena, quindi devono essere pulite e precise.

FASE 1 — genera solo C1, W1 e F1 e mostramele. Aspetta il mio ok.
FASE 2 — genera tutto il resto (usa generate_image_batch, al massimo 12 per volta).
FASE 3 — scrivimi una tabella con ID dell'asset (C1, W1, …) e job ID, in ordine.

Modelli:
- dove c'è [NB]: model nano_banana_pro, resolution 4k
- dove c'è [GPT]: model gpt_image_2_6, quality max, resolution 4k, background transparent
Il formato (aspect_ratio) è indicato per ogni immagine.

C1 [NB] 9:16 — A cozy walnut desk by a tall window at night in Turin, Italy. On the desk: a slim monitor glowing with a black terminal; a compact mechanical keyboard with cream and lapis-blue keycaps; a scrambled Rubik's cube; a Quran open on a carved wooden rahle book stand with gold-illuminated borders, the script too small and soft-focused to be legible; a small antique globe; a pierced Moroccan brass lantern casting star-shaped light on the wall; a snow globe with a tiny Mole Antonelliana inside; Moroccan tea glasses with steam; a Russian matryoshka; a white origami crane; an Italian moka pot; a few gold-wrapped gianduiotti; scattered vintage postcards; a small desk calendar and clock; a brass desk lamp. Through the window: the Mole Antonelliana lit warm against a deep starry sky, the snowy Alps faint on the horizon. Cinematic, photorealistic, 35mm lens, shallow depth of field, warm brass lamp light and cool blue moonlight, deep lapis-blue shadows, gold highlights, subtle film grain. No people, no hands, no logos, no readable text.
C2 [NB] 16:9 — same prompt as C1, wide composition.

W1 [GPT] 16:9 — Panoramic skyline of Turin, Italy at night seen from a hill: the Mole Antonelliana illuminated warm gold in the center, the Gran Madre di Dio dome, baroque domes and bell towers, rows of warm lit windows, slight haze at the base. Only the buildings: the sky must be fully transparent. Photorealistic, cinematic.
W2 [GPT] 16:9 — The same skyline of Turin on a clear winter afternoon, warm low sunlight, long soft shadows. Only the buildings: the sky must be fully transparent. Photorealistic.
W3 [GPT] 16:9 — Panoramic silhouette of the snowy western Alps seen from Turin, with the pyramid of Monviso, soft atmospheric perspective, neutral even light. Only the mountains: the sky must be fully transparent.
W4 [GPT] 16:9 — Foreground rooftops of Turin's old town at night seen from a high window: terracotta tiles, chimneys, dormers, a few warm lit windows, old antennas. Only the roofs: the sky must be fully transparent. Photorealistic.
W5 [GPT] 16:9 — The same rooftops on a clear winter afternoon in warm low sunlight. Only the roofs: the sky must be fully transparent. Photorealistic.

Per F1–F6 aggiungi a ogni prompt: "Flat square pattern filling the entire frame edge to edge, front orthographic view, evenly lit, no border, no perspective, no shadows, no text. It must clearly read as one colored face of a Rubik's cube."
F1 [NB] 1:1 — Moroccan zellige mosaic, eight-pointed star geometry, dominant lapis blue with white.
F2 [NB] 1:1 — Japanese seigaiha wave pattern, dominant white and pearl with fine silver lines.
F3 [NB] 1:1 — Andean woven textile pattern, bold geometric diamonds, dominant red.
F4 [NB] 1:1 — Turin Liberty (Art Nouveau) floral ornament with whiplash curves, dominant green.
F5 [NB] 1:1 — Ghanaian kente cloth pattern, woven strips, dominant yellow with small black accents.
F6 [NB] 1:1 — Indian rangoli and marigold block print pattern, dominant orange.

X1 [NB] 1:1 — Seamless tileable texture of oiled walnut wood, straight grain, top-down orthographic, flat even lighting, no objects, no shadows.
X2 [NB] 1:1 — Seamless tileable texture of warm sand-colored lime plaster wall (tadelakt) with subtle trowel marks, flat even lighting.
X3 [NB] 1:1 — Front cover of a Quran in dark burgundy-brown leather with a gold-tooled eight-pointed star interlace medallion and gold corner pieces. No text, no calligraphy. Flat front view, evenly lit, fills the frame.
X4 [NB] 2:3 — One page illumination frame of a Quran in Ottoman-Maghrebi style: gold and lapis-blue ornamental border and a decorative medallion in the outer margin, on warm cream paper. The central text panel is completely EMPTY: blank cream paper, no letters, no script, no calligraphy. Flat front view, evenly lit.
X5 [NB] 1:1 — Antique hand-drawn travel map on aged paper: imaginary coastlines and islands, an ink compass rose, dotted travel routes, small sketches of mountains and sailing ships. No readable text, no labels. Flat top-down, evenly lit.
X6 [NB] 1:1 — Andean woven textile (aguayo) with bold geometric bands in red, magenta, orange and green, visible weave, flat top-down, evenly lit, fills the frame.

Per P1–P6 aggiungi a ogni prompt: "Vintage travel postcard photograph, warm film colors, empty streets, no people, no text, no border."
P1 [NB] 3:2 — The blue alleys and stairs of Chefchaouen, Morocco, at dusk.
P2 [NB] 3:2 — Kyoto's Higashiyama district with the Yasaka pagoda at dusk.
P3 [NB] 3:2 — Istanbul skyline with mosques and minarets over the Bosphorus at sunset.
P4 [NB] 3:2 — Cusco, Peru: the main square with colonial arcades and the Andes behind.
P5 [NB] 3:2 — The Registan in Samarkand, Uzbekistan, with its blue-tiled madrasas at golden hour.
P6 [NB] 3:2 — Turin, Italy: the porticoes of Via Po with the Mole Antonelliana at the end of the street, at blue hour.

M1 [GPT] 2:3 — Flat front-view illustration of the painted design of a Russian matryoshka doll body: rosy painted face, red headscarf, apron with folk flowers. Isolated, transparent background, no text.
```
