# Il mio mondo — piano e prompt

Il sito si apre su un terminale nero. Si scrive `hello, world`; la parola `world` viene cancellata lettera per lettera e diventa `hello, imad's world`. Poi la camera si allontana dallo schermo e rivela il mondo: una scrivania di notte, a Torino, dove stanno insieme tutte le cose che mi piacciono. Scorrendo, la camera passa da un oggetto all'altro e alla fine esce dalla finestra, sale lungo la Mole e arriva alle stelle.

Il sito parla di quello che amo, non dei fatti miei: niente studi, lavoro, età o città di casa.

## Dove generare

Le generazioni illimitate di Higgsfield **non funzionano da Claude Code** (risposta del server: *"unlimited generations are not available [in Claude Code]. They are available in: Claude chat, Claude Cowork, ChatGPT"*). Quindi:

1. Le immagini e i video si generano in **Claude chat** (app o claude.ai) con il connettore Higgsfield, incollando il messaggio in fondo a questo file.
2. Le generazioni finiscono nello stesso account Higgsfield: da Claude Code le recupero con i loro job ID e costruisco il sito.

La prova finisce il **13 novembre 2026 alle 22:00** (ora italiana).

## Come è fatto

- **Animazione cinematografica** (Higgsfield): fotogrammi chiave in 9:16 (il pubblico arriva dalla bio di Instagram, quindi dal telefono) e video di passaggio tra un fotogramma e il successivo, con fotogramma iniziale e finale fissati, così il viaggio sembra un'unica ripresa.
- **Scroll**: il video avanza e torna indietro con lo scorrimento (fotogrammi WebP o MP4 con un keyframe per fotogramma, così funziona anche su iPhone).
- **Interazione in codice** (gratis, nitida, leggera):
  - il terminale `hello, world → hello, imad's world`, che poi diventa la chat;
  - il cubo di Rubik in 3D (three.js), che si gira davvero e a ogni mossa mostra una curiosità o un pezzo di folklore;
  - il cielo vero sopra Torino nella sezione finale;
  - le stelle che si ricompongono nella stella a 8 punte e in `imad.chat`.
- **Corano**: nelle immagini il testo non deve mai essere leggibile (il testo generato sarebbe arabo inventato, cioè versetti falsi). I versetti veri, quando servono, arrivano come testo da una fonte ufficiale.

## Modelli (qualità massima, quelli coperti dall'illimitato)

| Cosa | Modello | Impostazioni |
|---|---|---|
| Fotogrammi chiave | `nano_banana_pro` | 4k, 9:16 |
| Alternativa se serve testo nitido | `gpt_image_2_6` | quality `max`, 4k |
| Passaggi video | `seedance_2_0` | mode `std`, 1080p, bitrate `high`, 5–8 s, `start_image` + `end_image`, `generate_audio: false` |
| Video lunghi / estensioni | `seedance_2_5` | 1080p, `omni_reference` o `video_extension` |

I modelli 3D (image→GLB) non sono coperti dall'illimitato: il cubo e gli oggetti interattivi li faccio in codice.

## Stile comune (da aggiungere a ogni prompt)

> Cinematic still, photorealistic, shot on ARRI Alexa 65 with a 35mm lens, shallow depth of field. Night interior lit by a warm brass desk lamp and cool blue moonlight from a window: deep lapis-blue shadows, warm gold highlights. Subtle film grain, rich tactile textures (walnut wood, brass, paper, felt). Calm, quiet, wonder. No people, no faces, no hands, no logos, no watermarks, no readable text unless specified.

## Fotogrammi chiave

**K0 — Il terminale (primo piano)**
> Extreme close-up of a dark monitor showing a minimal black terminal. In the center, in a clean monospace font, warm off-white text reads exactly: `hello, imad's world` followed by a blinking block cursor. Faint scanline glow, the reflection of a brass lamp on the glass edge. Everything else falls into soft blue darkness.

**K1 — La scrivania (il fotogramma "ancora": tutti gli altri lo usano come riferimento)**
> A cozy walnut desk by a tall window at night in Turin, Italy. On the desk: a slim monitor glowing with a black terminal; a compact mechanical keyboard with cream and lapis-blue keycaps; a scrambled Rubik's cube; a Quran open on a carved wooden rahle book stand, its page borders illuminated in gold, the script too small and soft-focused to be legible; a small antique globe; a pierced Moroccan brass lantern casting star-shaped light patterns on the wall; travel souvenirs from many cultures (a Russian matryoshka, a Mexican alebrije, Moroccan tea glasses, an Andean woven textile); an old brass compass and folded paper maps. Through the window: the Mole Antonelliana spire lit warm against a deep starry sky, the snowy Alps faint on the horizon.

**K2 — La tastiera**
> Macro shot, low angle, of a compact mechanical keyboard with cream and lapis-blue keycaps on a walnut desk. Several keys are pressed down as if typed by an invisible hand. Warm lamp light skims the keycaps; the terminal glow reflects on them. Background in soft bokeh: the Rubik's cube and the brass lantern.

**K3 — Il cubo di Rubik**
> Close-up of a Rubik's cube on a walnut desk, caught mid-twist with its top layer rotated 30 degrees. Its stickers are not plain colors: each face carries a different traditional pattern — Moroccan zellige, Japanese seigaiha waves, Andean woven motifs, Piedmontese baroque ornament, Persian tilework, West African kente. Warm lamp light, lapis shadows.

**K4 — Il Corano**
> Close-up of a Quran open on a carved wooden rahle book stand, pages lifting gently in a breeze from the window. Gold and lapis-blue illuminated borders and an ornamental medallion in the margin. The script is soft-focused and not legible. Moonlight from the left, warm lamp from the right, dust motes in the air.

**K5 — Il mondo**
> Close-up of a small antique globe slowly turning on a brass stand, surrounded by souvenirs from many cultures (matryoshka, alebrije, Moroccan tea glass, Andean textile, brass compass) and folded paper maps with travel routes drawn in ink. Warm lamp light, the window glowing blue behind.

**K6 — La finestra su Torino**
> View through a tall window at night over the rooftops of Turin, Italy: the Mole Antonelliana lit warm gold in the center, the dome of the Gran Madre, the Po river reflecting city lights, the snowy Alps under moonlight, a deep sky full of stars. The window frame and a corner of the brass lantern in the foreground, softly out of focus.

**K7 — Le stelle sopra la Mole**
> Looking up along the illuminated spire of the Mole Antonelliana into an immense, clear night sky: the Milky Way arching overhead, thousands of crisp stars, a thin crescent moon. The city glow fades into lapis blue and then deep black.

**K8 — Lo spazio**
> Earth seen from low orbit at night: city lights tracing coastlines across Europe and North Africa, the thin blue line of the atmosphere, the Milky Way behind. Quiet, vast, still. Photorealistic, NASA-like.

## Passaggi video (seedance_2_0, inizio → fine)

| | Da → a | Movimento di camera |
|---|---|---|
| T0 | K0 → K1 | Slow continuous dolly back from the terminal screen, revealing the keyboard, then the whole desk and the window. |
| T1 | K1 → K2 | Smooth push in and tilt down onto the keyboard; keys press down by themselves. |
| T2 | K2 → K3 | Lateral slide along the desk to the Rubik's cube; the cube twists by itself and its patterns shimmer. |
| T3 | K3 → K4 | Rack focus and slide to the Quran on the rahle; pages lift gently in the breeze. |
| T4 | K4 → K5 | Slide to the globe; it starts turning slowly. |
| T5 | K5 → K6 | Push toward the window and through the glass, out over the rooftops of Turin. |
| T6 | K6 → K7 | Fly toward the Mole Antonelliana and rise along its spire into the stars. |
| T7 | K7 → K8 | Keep rising through the atmosphere into space until the Earth appears below. |

Prompt di ogni passaggio: *one continuous shot, no cuts, smooth cinematic camera move, stable geometry, no new objects appearing, no text, no people* + il movimento della tabella.

Il ritorno alla terra (dalle stelle alla stella a 8 punte e al logo) lo faccio in codice.

## Messaggio da incollare in Claude chat

```text
Usa il connettore Higgsfield. Per OGNI generazione passa use_unlim: true. Se l'illimitato viene rifiutato, fermati e dimmelo: non usare mai i crediti.

Sto creando le immagini per l'animazione del mio sito. Procedi in tre fasi.

FASE 1 — genera solo K1 e mostramela. Aspetta il mio ok prima di continuare.
FASE 2 — genera K0, K2, K3, K4, K5, K6, K7, K8 usando K1 come image_references (stesso stile, stessa scrivania, stessa luce).
FASE 3 — genera i video T0…T7 con seedance_2_0, usando i fotogrammi indicati come start_image e end_image.
Alla fine scrivimi l'elenco dei job ID in ordine (K0…K8, T0…T7).

Immagini: model nano_banana_pro, resolution 4k, aspect_ratio 9:16.
Video: model seedance_2_0, mode std, resolution 1080p, bitrate_mode high, duration 6, aspect_ratio 9:16, generate_audio false.

STILE (aggiungilo alla fine di ogni prompt immagine):
Cinematic still, photorealistic, shot on ARRI Alexa 65 with a 35mm lens, shallow depth of field. Night interior lit by a warm brass desk lamp and cool blue moonlight from a window: deep lapis-blue shadows, warm gold highlights. Subtle film grain, rich tactile textures (walnut wood, brass, paper, felt). Calm, quiet, wonder. No people, no faces, no hands, no logos, no watermarks, no readable text unless specified.

K0: Extreme close-up of a dark monitor showing a minimal black terminal. In the center, in a clean monospace font, warm off-white text reads exactly: hello, imad's world — followed by a blinking block cursor. Faint scanline glow, the reflection of a brass lamp on the glass edge. Everything else falls into soft blue darkness.

K1: A cozy walnut desk by a tall window at night in Turin, Italy. On the desk: a slim monitor glowing with a black terminal; a compact mechanical keyboard with cream and lapis-blue keycaps; a scrambled Rubik's cube; a Quran open on a carved wooden rahle book stand, its page borders illuminated in gold, the script too small and soft-focused to be legible; a small antique globe; a pierced Moroccan brass lantern casting star-shaped light patterns on the wall; travel souvenirs from many cultures (a Russian matryoshka, a Mexican alebrije, Moroccan tea glasses, an Andean woven textile); an old brass compass and folded paper maps. Through the window: the Mole Antonelliana spire lit warm against a deep starry sky, the snowy Alps faint on the horizon.

K2: Macro shot, low angle, of a compact mechanical keyboard with cream and lapis-blue keycaps on a walnut desk. Several keys are pressed down as if typed by an invisible hand. Warm lamp light skims the keycaps; the terminal glow reflects on them. Background in soft bokeh: the Rubik's cube and the brass lantern.

K3: Close-up of a Rubik's cube on a walnut desk, caught mid-twist with its top layer rotated 30 degrees. Its stickers are not plain colors: each face carries a different traditional pattern — Moroccan zellige, Japanese seigaiha waves, Andean woven motifs, Piedmontese baroque ornament, Persian tilework, West African kente. Warm lamp light, lapis shadows.

K4: Close-up of a Quran open on a carved wooden rahle book stand, pages lifting gently in a breeze from the window. Gold and lapis-blue illuminated borders and an ornamental medallion in the margin. The script is soft-focused and not legible. Moonlight from the left, warm lamp from the right, dust motes in the air.

K5: Close-up of a small antique globe slowly turning on a brass stand, surrounded by souvenirs from many cultures (matryoshka, alebrije, Moroccan tea glass, Andean textile, brass compass) and folded paper maps with travel routes drawn in ink. Warm lamp light, the window glowing blue behind.

K6: View through a tall window at night over the rooftops of Turin, Italy: the Mole Antonelliana lit warm gold in the center, the dome of the Gran Madre, the Po river reflecting city lights, the snowy Alps under moonlight, a deep sky full of stars. The window frame and a corner of the brass lantern in the foreground, softly out of focus.

K7: Looking up along the illuminated spire of the Mole Antonelliana into an immense, clear night sky: the Milky Way arching overhead, thousands of crisp stars, a thin crescent moon. The city glow fades into lapis blue and then deep black.

K8: Earth seen from low orbit at night: city lights tracing coastlines across Europe and North Africa, the thin blue line of the atmosphere, the Milky Way behind. Quiet, vast, still. Photorealistic.

VIDEO (inizia ogni prompt con: "One continuous shot, no cuts, smooth cinematic camera move, stable geometry, no new objects appearing, no text, no people."):
T0 (start K0, end K1): slow continuous dolly back from the terminal screen, revealing the keyboard, then the whole desk and the window.
T1 (start K1, end K2): smooth push in and tilt down onto the keyboard; keys press down by themselves.
T2 (start K2, end K3): lateral slide along the desk to the Rubik's cube; the cube twists by itself and its patterns shimmer.
T3 (start K3, end K4): rack focus and slide to the Quran on the rahle; pages lift gently in the breeze.
T4 (start K4, end K5): slide to the globe; it starts turning slowly.
T5 (start K5, end K6): push toward the window and through the glass, out over the rooftops of Turin.
T6 (start K6, end K7): fly toward the Mole Antonelliana and rise along its spire into the stars.
T7 (start K7, end K8): keep rising through the atmosphere into space until the Earth appears below.
```
