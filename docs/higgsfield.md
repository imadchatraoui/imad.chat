# Higgsfield: cosa generare e come

L'illimitato di Higgsfield funziona da **ChatGPT** (verificato) e scade **venerdì 13 novembre 2026 alle 22:00** ora italiana. Da Claude Code non funziona: da lì si legge solo la cronologia.

La vecchia lista (texture d'ottone, ornamenti, città tolte) è **annullata** l'11 novembre 2026: il sito ora è una griglia di riquadri in stile Apple, disegnata dal codice. Higgsfield serve per poche cose scelte, quelle che il codice non sa fare altrettanto bene.

## A cosa serve adesso

1. **L'apertura: la stella che sale.** Un video verticale di 10 secondi: una stella sale nel cielo dell'ora blu e si ferma in alto. Sopra, il codice scrive in bianco `hello, world` → `hello, imad's world` → `imad.chat`. Le scritte non le fa mai il video: i video generati le sbagliano.
2. **Lo sfondo vivo del riquadro principale.** Lo stesso cielo che continua in loop dopo l'apertura: la stella resta lì e respira. Si fa partendo dall'ultimo fotogramma dell'apertura scelta.
3. **Suoni piccoli e curati**: il cubo, l'apertura dei riquadri, il saluto che diventa stella, le onde di Casablanca. Il sito parte sempre muto.
4. **Cartoline animate** (facoltative) per Torino, Gaza e Casablanca nella pagina delle città. Per Medina e Makkah niente immagini generate: i luoghi sacri ricostruiti da un'AI vengono sbagliati; lì si usa il cielo vero.
5. **Video di lancio per Instagram** (facoltativo): la stella più la scritta, montato dal codice.

Niente immagini generate per il Corano (un'AI inventerebbe finto arabo), per il cubo (è 3D vero) e per Su di me.

## Configurazioni coperte dall'illimitato

Lette dal connettore in ChatGPT l'11 novembre 2026. Tutto ciò che sta fuori da queste righe costa crediti.

| Modello | Coperto |
|---|---|
| `nano_banana_pro`, `nano_banana_2_1`, `nano_banana_flash` | risoluzione 1k, 2k |
| `seedream_v5_pro`, `seedream_5_5` | risoluzione 1k, 1.5k, 2k |
| `gpt_image_2`, `gpt_image_2_5`, `gpt_image_2_6` | risoluzione 1k, 2k; quality low, medium |
| `seedance_2_0` | 480p, 720p; mode std o fast; fino a 15 s |
| `seedance_2_0_mini` | 480p, 720p; fino a 15 s |
| `seedance_2_5` | solo 480p; fino a 30 s |
| `text2speech_v2` | elevenlabs, minimax, seed_speech, vibe_voice |
| `seed_audio` | nessun limite |

Higgsfield accetta circa **un lavoro alla volta per tipo** (un video e un suono insieme sì, due video no): l'errore `429` vuol dire "troppi lavori insieme", non costa crediti. Un video richiede circa 15 minuti.

## Passo passo

1. Nelle due vecchie chat di ChatGPT, se stanno ancora lavorando, premi il quadratino di stop. Non scrivere più "continua".
2. Apri la chat "imad — suoni e video" (o una nuova) e incolla il **Messaggio A** nella casella normale, non nel pannello di Higgsfield.
3. Se compare la scelta "Use unlimited generations / Use credits", scegli sempre **unlimited**. Se ChatGPT si ferma, scrivi **continua**.
4. Non serve incollare niente a Claude: la cronologia viene letta direttamente dall'account.
5. Guardi i video della stella, dici quale preferisci, e arriva il **Messaggio B** (versione orizzontale e loop dello sfondo).

## Messaggio A — la stella che sale e i suoni

```text
Usa Higgsfield. ANNULLA tutta la lista precedente di questa chat: non generare più ambienti delle città, texture, ornamenti o altro di quella lista. Da ora genera solo quello che segue.

Regole fisse:
1. Per OGNI generazione passa use_unlim: true. Se l'illimitato viene rifiutato o la configurazione non è coperta, fermati e dimmelo. Non usare mai i crediti e non scegliere mai "Use credits".
2. Configurazioni coperte: seedance_2_0 con mode std, resolution 720p (mai 1080p o 4k), durata massima 15 secondi; seed_audio senza limiti.
3. Al massimo UN video e UN suono attivi alla volta: invia il successivo solo quando quello prima è completato o fallito. Se ricevi 429 (troppi lavori insieme) aspetta controllando lo stato e poi reinvia lo stesso asset; non saltarlo.
4. In nessun video ci devono essere scritte, lettere, numeri, loghi, persone, la luna o mezzelune. In nessun audio voci, parole, canto, musica, melodie o recitazioni religiose.
5. Se ti fermi, al mio "continua" riprendi dal punto esatto. Alla fine dammi una sola tabella in un blocco di codice: ID | job_id | stato.

=== VIDEO: la stella che sale ===
Per tutti: seedance_2_0, mode std, resolution 720p, aspect_ratio 9:16, duration 10, bitrate_mode high, generate_audio false. In quest'ordine:

V-STELLA-1A-V: "Blue hour over a silent desert, just after sunset. Smooth dark sand dunes fill the lower third of the frame. Above them a clean deep-blue sky that fades to soft violet near the horizon, with a few thin lilac clouds. A single small star rises slowly from behind the dunes, straight up, and grows into a brilliant white point with delicate four-point diffraction spikes and a faint circular halo. The camera tilts up slowly and steadily, following the star, until the dunes sink out of the frame. The star comes to rest in the upper third of the frame and glows calmly while a few faint stars appear around it. Final frame: only the deep-blue night sky with the bright star in the upper third; the centre and the lower half of the frame are calm, dark and empty. Slow, serene, majestic. Photorealistic, cinematic, fine film grain. No text, no letters, no logos, no people, no moon, no crescent, no planets, no shooting stars."

V-STELLA-2-V: "Blue hour over a perfectly calm sea, just after sunset. Locked-off camera, no camera movement at all. The horizon line sits in the lower fifth of the frame; above it a clean deep-blue sky fading to violet, with a thin band of warm rose at the horizon. A single small star rises slowly from the horizon, straight up, growing into a brilliant white point with delicate four-point diffraction spikes; its light draws a thin shimmering path on the still water. The star comes to rest in the upper third of the frame and glows calmly while a few faint stars appear around it. The centre of the frame stays calm and empty. Slow, serene, majestic. Photorealistic, cinematic, fine film grain. No text, no letters, no logos, no people, no boats, no moon, no crescent, no planets, no shooting stars."

V-STELLA-3-V: "Abstract and minimal, like a premium phone wallpaper in motion. A smooth deep indigo to ultramarine gradient with very fine film grain, slightly lighter and more violet at the bottom. A small point of pure white light rises slowly from the bottom edge, straight up, leaving a very faint luminous trail that fades quickly. As it rises, two or three soft concentric rings of light expand gently from it and dissolve, like ripples seen through glass. It comes to rest in the upper third of the frame and glows softly with a slow breathing pulse. No landscape, no horizon, no objects. Elegant, calm, luminous. No text, no letters, no logos, no people, no moon, no crescent."

V-STELLA-1B-V: "Locked-off camera, no camera movement at all. Blue hour over a silent desert, just after sunset: smooth dark sand dunes fill only the lower fifth of the frame; above them a clean deep-blue sky fading to soft violet at the horizon. A single small star rises slowly from behind the dunes, straight up through the empty sky, growing into a brilliant white point with delicate four-point diffraction spikes and a faint circular halo. It comes to rest in the upper third of the frame and glows calmly while a few faint stars appear around it. The centre of the frame stays calm and empty. Slow, serene, majestic. Photorealistic, cinematic, fine film grain. No text, no letters, no logos, no people, no moon, no crescent, no planets, no shooting stars."

V-STELLA-4-V (start_image = job b4613335-7013-4d1d-9118-c69402f725b3): "Locked-off camera, no camera movement at all. The city stays exactly as in the image. A single small star rises slowly from behind the mountains on the horizon, straight up into the clean dark-blue sky above the city, growing into a brilliant white point with delicate four-point diffraction spikes and a faint halo; it comes to rest in the upper third of the frame and glows calmly. Below, only very subtle living details move: a few windows flicker, small reflections shimmer on the river. No other moving stars, no moon, no crescent, no text, no people walking into frame."

=== SUONI (seed_audio) ===
S20: "A single soft plastic click of one layer of a speed cube turning, close-mic, dry, no reverb. 0.3 seconds."
S21: "Three different soft plastic clicks of a speed cube's layers turning, one after another with one second of silence between them, close-mic, dry. 3 seconds."
S22: "A quick flurry of about ten fast plastic turns of a speed cube being scrambled, light and crisp, close-mic, dry. 2 seconds."
S23: "A short bright sparkle, like tiny glass beads settling, light and happy, no melody. 1.5 seconds."
S24: "A very soft airy whoosh ending in a tiny glassy tick, like a card of frosted glass sliding open. 0.4 seconds."
S25: "A very soft short airy whoosh fading out, like a card of frosted glass sliding closed. 0.3 seconds."
S26: "A single pure glass bell tone, high and clear, with a soft shimmering tail that rises and fades, no melody. 2 seconds."
S27: "A soft rising shimmer of air and tiny glass particles that grows slowly for five seconds and settles into a warm quiet glow, no melody, no voices. 8 seconds."
S28: "A very soft tiny tick, like a fingertip tapping glass once, dry. 0.15 seconds."

=== AMBIENTI (seed_audio, seamless loop, 30 seconds; a ogni prompt aggiungi: "Seamless continuous loop: beginning and end must join naturally. Sound effects and environmental sounds only. No human voices, no speech, no singing, no music, no chants, no religious recitations, no adhan, no Quran.") ===
A-CASABLANCA: "Atlantic ocean at night against a stone breakwater: slow heavy waves, light wind, very distant gulls, calm."
A-MEDINA: "Warm desert night at the edge of an oasis: a soft breeze through palm leaves, distant crickets, very calm."
A-MAKKAH: "Warm dry night among rocky hills: a soft steady breeze, faint distant crickets, very calm, wide and open."

Ricordati: alla fine una sola tabella in un blocco di codice, ID | job_id | stato.
```

## Messaggio B — dopo la scelta (da completare)

Quando Imad ha scelto la stella che preferisce (per esempio `V-STELLA-1A-V`):

- la **versione orizzontale** per i computer: stesso prompt, `aspect_ratio 16:9`, ID `V-STELLA-<n>-H`;
- il **loop dello sfondo**: Claude carica su Higgsfield l'ultimo fotogramma del video scelto e passa il suo `media_id`; poi `seedance_2_0`, 720p, 10 s, `start_image` = `end_image` = quel fotogramma, prompt: "Locked-off camera, no camera movement at all. The sky stays exactly as in the image. The bright star glows with a slow, soft breathing pulse; the faint stars shimmer very subtly; one very thin cloud drifts slowly. The last frame matches the first frame exactly, for a seamless loop. No text, no moon, no crescent, no shooting stars." ID `L-HERO-V` e `L-HERO-H`;
- le cartoline delle città, se Imad le vuole: `N-<CITTÀ>-V` (immagine) e `L-<CITTÀ>-V` (loop) per Gaza e Casablanca; Torino ha già la sua immagine.

## Dove finisce ogni asset nel sito

I job arrivati si registrano in `scripts/media/jobs.json`. `python3 -I scripts/media/import.py` (o `npm run media`) li scarica, li converte (JPEG/PNG ridimensionati, MP3 rifilati e normalizzati, MP4 H.264 senza audio) e aggiorna `public/media/manifest.json`, che il sito legge per sapere cosa c'è. Il sito deve funzionare anche senza: ogni cosa ha la sua versione disegnata dal codice.

| ID | File nel sito |
|---|---|
| `V-STELLA-<n>-V` / `-H` | `public/media/video/stella-<n>-<v\|h>.mp4` |
| `L-HERO-V` / `-H` | `public/media/video/hero-loop-<v\|h>.mp4` |
| `S01`–`S11` (già fatti), `S20`–`S28` | `public/media/sfx/<id>.mp3` |
| `A-<LUOGO>` | `public/media/amb/<luogo>.mp3` (già importati: notte, torino, gaza) |
| `N-<CITTÀ>-V` / `-H` | `public/media/city/<città>-night-<v\|h>.jpg` (già importata: torino) |
| `L-<CITTÀ>-V` / `-H` | `public/media/city/<città>-night-<v\|h>.mp4` |
| `V-TARIQ-V` / `-H` (già fatti) | `public/media/video/tariq-<v\|h>.mp4` |

I vecchi messaggi (immagini dell'astrolabio, ornamenti, città tolte) restano nella storia di git, se mai servissero.
